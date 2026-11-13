// Geometry/presentation adapters only. All dynamics and integration use research solvers.
import { integrateSteps, stepValue } from '../../engineering/research/jarDownExtendedDynamics';
import { deriveEarlyJarDown } from '../../engineering/research/jarDownEarlyImpact';
export { copyResearchGeometry } from '../../engineering/research/researchJarGeometry';

export function researchExample(name = 'early') {
  const rod = { lengthFt: 80, areaIn2: 1, youngsModulusPsi: 16000000, densitySlugFt3: 9 };
  return { model: 'ideal-guided-extended-contact', compressionLbf: 1000,
    strokeIn: name === 'late' ? .36 : name === 'multiple' ? 1.2 : name === 'none' ? 100 : .12,
    gravityFtS2: 0, horizonS: .12, upperRods: [{ ...rod, lengthFt: name === 'surface' ? 80 : 3000, areaIn2: .25 }, rod],
    lowerRods: [{ ...rod, lengthFt: 160 }] };
}

export function researchEvents(result) {
  if (!result?.valid) return [];
  const contacts = result.contact.transitions.map((e, i) => ({ ...e, id: `contact-${i}`, kind: 'contact',
    label: e.type === 'open' ? 'Contact opening' : i === 0 ? 'First impact' : 'Re-engagement' }));
  const fronts = result.contact.reaction.slice(1).map((e, i) => ({ id: `front-${i}`, timeS: e.timeS,
    kind: 'wave', label: i === 0 ? 'First stuck-point wave arrival' : 'Stuck-point reaction front', valueLbf: e.value,
    changeLbf: e.value - result.contact.reaction[i].value }));
  // Match propagated boundary wave records to actual solver event states.
  // No analytical early-impact timing formula or guessed reflection path.
  const j = result.jarNode;
  const returns = [[j - 1, 'a', 'Upper'], [j, 'b', 'Lower']].flatMap(([rodIndex, family, side]) =>
    result.contact.waveHistories[rodIndex][family].slice(1).flatMap((wave, i) => {
      const arrival = wave.timeS + result.rods[rodIndex].tau;
      const state = result.contact.motion.find(m => Math.abs(m.timeS - arrival) <= result.timeToleranceS);
      return state ? [{ id: `return-${side}-${i}`, timeS: state.timeS, kind: 'return', label: `${side} returning-wave arrival at jar` }] : [];
    }));
  return [{ id: 'release', timeS: 0, kind: 'release', label: 'Initial release' },
    { id: 'observation-end', timeS: result.observation.endS, kind: 'interval', label: 'End of observation interval (excluded)' }, ...contacts, ...fronts, ...returns]
    .sort((a, b) => a.timeS - b.timeS || a.id.localeCompare(b.id));
}

export function earlyResearchComparison(input, result) {
  if (!result?.valid || input.upperRods.length !== 2 || input.lowerRods.length !== 1) return { valid: false, error: 'Comparison requires one pipe, one upper collar and one lower collar.' };
  const early = deriveEarlyJarDown({ model: 'ideal-guided-early-impact', compressionLbf: input.compressionLbf,
    strokeIn: input.strokeIn, gravityFtS2: input.gravityFtS2, pipe: input.upperRods[0], upper: input.upperRods[1], lower: input.lowerRods[0] });
  if (!early.valid) return early;
  if (early.impactReliefArrivalS > result.horizonS) return { valid: false, error: 'Extend the simulation through the restricted primary interval to compare.' };
  const ta = early.firstImpactArrivalS, tb = early.impactReliefArrivalS;
  const peak = Math.max(stepValue(result.contact.reaction, ta + result.timeToleranceS), ...result.contact.reaction.filter(e => e.timeS > ta + result.timeToleranceS && e.timeS < tb - result.timeToleranceS).map(e => e.value));
  const extendedImpulse = integrateSteps(result.contact.reaction, ta, tb);
  return { valid: true, startS: ta, endS: tb, rows: [
    ['First impact (ms)', early.impactTimeS * 1000, result.contact.transitions.find(e => e.type === 'engage')?.timeS * 1000],
    ['Peak total compression (klbf)', early.peakTotalCompressionLbf / 1000, peak / 1000],
    ['Signed total impulse (lbf·s)', early.primaryTotalImpulseLbfS, extendedImpulse]
  ], contactDescription: `${result.contact.transitions.filter(e => e.timeS < early.motionHorizonS && e.type === 'engage').length} engagement(s) in the restricted motion window; later extended contacts are outside that comparison.` };
}

// Duplicate x coordinates preserve vertical discontinuities; no smoothing.
function points(history, start, end, valueAt = (t, v) => v) {
  const knots = [...new Set([start, ...history.filter(e => e.timeS > start && e.timeS < end).map(e => e.timeS), end])];
  return knots.slice(0, -1).flatMap((t, i) => {
    const value = stepValue(history, (t + knots[i + 1]) / 2);
    return [{ x: t * 1000, y: valueAt(t, value) }, { x: knots[i + 1] * 1000, y: valueAt(knots[i + 1], value) }];
  });
}

export function researchPlot(result, visible, annotations, selectedId) {
  const events = researchEvents(result), selected = events.find(e => e.id === selectedId), o = result.observation;
  const start = o.startS, end = o.endS;
  const total = points(result.contact.reaction, 0, result.horizonS);
  const trace = (name, values, color, extra = {}) => ({ name, type: 'scatter', mode: 'lines', x: values.map(p => p.x), y: values.map(p => p.y / 1000),
    line: { color, width: 2.2, shape: 'linear' }, hovertemplate: '%{x:.3f} ms<br>%{y:.3f} klbf<extra>' + name + '</extra>', ...extra });
  const data = [];
  if (visible.total) {
    data.push(trace('Signed total stuck reaction', total, '#196b9a'));
    data.push(trace('Signed total integration area', points(result.contact.reaction, start, end), '#196b9a', { fill: 'tozeroy', fillcolor: 'rgba(25,107,154,0.13)', hoverinfo: 'skip', line: { width: 0 } }));
  }
  if (visible.free) data.push(trace('Matched no-contact reaction', points(result.noContact.reaction, 0, result.horizonS), '#967336', { line: { color: '#967336', width: 2, dash: 'dash' } }));
  if (visible.incremental) data.push(trace('Increment from initial equilibrium', total.map(p => ({ ...p, y: p.y - result.contact.baselineLbf })), '#955aa0'));
  if (visible.cumulative) {
    const p = points(result.contact.reaction, start, end, t => integrateSteps(result.contact.reaction, start, t));
    data.push({ ...trace('Cumulative signed total impulse', p, '#217a50'), y: p.map(e => e.y), yaxis: 'y2', hovertemplate: '%{x:.3f} ms<br>%{y:.2f} lbf·s<extra>Cumulative signed total impulse</extra>' });
  }
  const forceValues = data.filter(t => t.yaxis !== 'y2').flatMap(t => t.y), range = values => {
    const lo = Math.min(0, ...values), hi = Math.max(0, ...values), pad = Math.max((hi - lo) * .09, Math.max(Math.abs(lo), Math.abs(hi)) * .01, .001);
    return [lo - pad, hi + pad];
  };
  const times = data.flatMap(t => t.x);
  // An explicitly highlighted event remains visible even when only the
  // cumulative trace over a narrower observation interval is enabled.
  if (selected) times.push(selected.timeS * 1000);
  const majorFronts = events.filter(e => e.kind === 'wave').sort((a, b) => Math.abs(b.changeLbf) - Math.abs(a.changeLbf)).slice(0, 3);
  const firstReturns = ['Upper', 'Lower'].flatMap(side => events.find(e => e.id.startsWith(`return-${side}`)) || []);
  const marked = [...(annotations.contact ? events.filter(e => e.kind === 'contact') : []), ...(annotations.wave ? [...firstReturns, ...majorFronts.slice(0, 1)] : [])];
  const marks = [];
  if (selected) marks.push({ x: selected.timeS * 1000, y: .95, xref: 'x', yref: 'paper', text: `${selected.label} · ${(selected.timeS * 1000).toFixed(3)} ms`, showarrow: true, ax: 0, ay: 24, bgcolor: '#fff4cc' });
  const shapes = marked.map(e => ({ type: 'line', x0: e.timeS * 1000, x1: e.timeS * 1000, y0: 0, y1: 1, yref: 'paper', line: { color: '#bbc5cd', width: 1, dash: 'dot' } }));
  if (selected) shapes.push({ type: 'line', x0: selected.timeS * 1000, x1: selected.timeS * 1000, y0: 0, y1: 1, yref: 'paper', line: { color: '#b27208', width: 2 } });
  return { data, layout: { margin: { l: 82, r: visible.cumulative ? 88 : 22, t: 34, b: 62 }, showlegend: false,
    xaxis: { title: { text: 'Time (ms)', font: { size: 13 } }, range: times.length ? [Math.min(...times), Math.max(...times)] : [0, result.horizonS * 1000], tickfont: { size: 12 }, automargin: true },
    yaxis: { title: { text: 'Stuck-Point Force (klbf)', font: { size: 13 } }, visible: forceValues.length > 0, range: range(forceValues), zeroline: true, zerolinecolor: '#586575', tickfont: { size: 12 }, automargin: true },
    yaxis2: { title: { text: 'Signed total impulse (lbf·s)', font: { size: 13 } }, overlaying: 'y', side: 'right', visible: visible.cumulative, range: range(data.find(t => t.yaxis === 'y2')?.y || []), automargin: true },
    annotations: marks, shapes, hovermode: 'closest' } };
}
