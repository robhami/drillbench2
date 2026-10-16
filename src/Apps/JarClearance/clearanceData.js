import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions';
import { parseSurveyCsv } from '../../engineering/survey/surveyImport';
import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';
import { drillstringDeploymentStructure } from '../../engineering/bha/deployDrillstring';

const finite = v => (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '' && Number.isFinite(Number(v));
export function importedGeometry(source) {
  if (!source?.originalCsv) return { valid: false, errors: [{ message: 'Import a directional survey in the Survey window first.' }] };
  const parsed = parseSurveyCsv(source.originalCsv, source.confirmed === true ? { mdUnit: 'ft', angleUnit: 'deg' } : undefined);
  return parsed.valid ? calculateSurveyGeometry(parsed.stations) : parsed;
}

export function clearanceBounds(bha, survey, surfaceMdFt = 0) {
  if (!survey.valid) return null;
  const structure = drillstringDeploymentStructure(bha);
  if (!structure.valid) return { covered: false, error: structure.errors.join(' ') };
  const positions = calcComponentPositions(structure.pipe ? { ...bha, rows: structure.rows.filter(r => r !== structure.pipe) } : bha);
  if (!(positions.totalLength > 0 && Number.isFinite(positions.totalLength))) return null;
  if (!finite(surfaceMdFt) || Number(surfaceMdFt) < 0) return { covered: false, error: 'Surface reference MD must be nonnegative (ft).' };
  const deployed = Boolean(structure.pipe);
  const start = deployed ? Number(surfaceMdFt) + structure.fixedLengthFt : survey.summary.startMdFt + positions.totalLength, end = survey.summary.endMdFt;
  const jar = positions.components.find(c => String(c.category).toUpperCase() === 'JAR');
  return { start, end, totalLength: positions.totalLength, fixedLengthFt: structure.fixedLengthFt, deployed, defaultAvoidance: jar ? 0.2 * jar.centreFromBit : 20, covered: start <= end && (!deployed || Number(surfaceMdFt) >= survey.summary.startMdFt), error: deployed && Number(surfaceMdFt) < survey.summary.startMdFt ? 'Survey must cover the surface reference MD for the actual deployed string. No extrapolation.' : null };
}

export function clearanceRequest(bha, survey, fields, compare = false) {
  if (compare) fields = { ...fields, modes: 'both' };
  const fail = error => ({ valid: false, error });
  if (!survey.valid) return fail(survey.errors.map(e => e.message).join(' '));
  const bounds = clearanceBounds(bha, survey, fields.surface ?? 0);
  if (!bounds?.covered) return fail(bounds?.error || 'Survey cannot cover the complete BHA at any bit depth.');
  const required = ['start', 'end', 'increment', 'minWob', 'maxWob', 'samples', 'avoidance', 'mud'];
  if (required.some(key => !finite(fields[key]))) return fail('Enter finite values for all run, WOB, avoidance and mud-weight fields.');
  const start = Number(fields.start), end = Number(fields.end), min = Number(fields.minWob), max = Number(fields.maxWob), count = Number(fields.samples), step = Number(fields.increment);
  if (start < bounds.start || end > bounds.end) return fail(`Complete-BHA survey coverage requires bit MD ${bounds.start}–${bounds.end} ft. No extrapolation.`);
  if (end < start || step <= 0 || min < 0 || max < min || !Number.isSafeInteger(count) || count < 1 || (max > min && count < 2) || Number(fields.avoidance) < 0) return fail('Use ordered MD/WOB limits, positive depth increment, nonnegative avoidance distance and an integer WOB sample count (≥2 for a range).');
  if (Number(fields.mud) <= 0 || Number(fields.mud) >= 65.5) return fail('Mud weight must be positive and below the model steel density of 65.5 ppg.');
  const mus = String(fields.friction).split(',');
  if (!mus.length || mus.some(v => !finite(v) || Number(v) < 0 || Number(v) > 1)) return fail('Enter comma-separated friction coefficients between 0 and 1.');
  if (!['slide', 'rotate', 'both'].includes(fields.modes)) return fail('Choose Slide, Rotate or Both.');
  if (fields.modes !== 'slide' && (!finite(fields.rpm) || Number(fields.rpm) < 0 || !finite(fields.rop) || Number(fields.rop) <= 0)) return fail('Rotate requires RPM ≥0 and ROP >0 ft/hr.');
  const ratio = (end - start) / step, rounded = Math.round(ratio);
  const intervals = Math.abs(ratio - rounded) <= 16 * Number.EPSILON * Math.max(1, Math.abs(ratio)) ? rounded : Math.ceil(ratio);
  const scenarioCount = ((end === start ? 0 : Math.max(1, intervals)) + 1) * (max === min ? 1 : count) * (fields.modes === 'both' ? 2 : 1) * new Set(mus.map(Number)).size;
  if (!Number.isSafeInteger(scenarioCount) || scenarioCount > 2000) return fail(`Requested grid exceeds the 2,000-scenario UI limit (${scenarioCount} requested). Reduce sampling.`);
  return { valid: true, request: { bha, survey, deploymentMode: 'depth-dependent', surfaceMdFt: Number(fields.surface ?? 0), startBitMdFt: start, endBitMdFt: end, depthIncrementFt: step, minWobLbf: min * 1000, maxWobLbf: max * 1000, wobSamples: count, modes: fields.modes, frictionCoefficients: mus.map(Number), mudWeightPpg: Number(fields.mud), rpm: finite(fields.rpm) ? Number(fields.rpm) : undefined, ropFtHr: finite(fields.rop) ? Number(fields.rop) : undefined, avoidanceDistanceFt: Number(fields.avoidance), maxScenarios: 2000 } };
}

export function clearanceSummary(result) {
  return { evaluated: result.scenarios.length, invalid: result.invalidScenarios,
    violations: result.scenarios.filter(s => s.valid && s.jars.some(j => j.avoidanceStatus === 'inside-avoidance-zone')).length,
    compression: result.scenarios.some(s => s.valid && s.jars.some(j => j.jarLoadState === 'compression')),
    sampledCrossings: result.crossingEvents.filter(e => e.kind.startsWith('sampled')).length,
    inferredCrossings: result.crossingEvents.filter(e => e.kind.startsWith('inferred')).length };
}

export function selectedClearance(result, selection = result.scenarios[0], jarIndex = 0) {
  const matches = s => s.wobLbf === selection?.wobLbf && s.mode === selection?.mode && s.frictionCoefficient === selection?.frictionCoefficient;
  const samples = result.scenarios.filter(matches).map(s => ({ bitMdFt: s.bitMdFt, jar: s.valid ? s.jars.find(j => j.jarIndex === jarIndex) : null }));
  const available = samples.filter(s => s.jar?.absoluteSeparationFt != null);
  const closest = available.reduce((best, s) => !best || s.jar.absoluteSeparationFt < best.jar.absoluteSeparationFt ? s : best, null);
  const events = result.crossingEvents.filter(e => e.jarIndex === jarIndex &&
    e.mode === selection?.mode && e.frictionCoefficient === selection?.frictionCoefficient &&
    (e.kind.startsWith('sampled') ? matches(e) :
      e.kind === 'inferred-between-depth-samples' && e.from.wobLbf === selection?.wobLbf && e.to.wobLbf === selection?.wobLbf));
  return { samples, closest, events, unavailable: samples.length - available.length };
}

export function clearancePlot(result, threshold, revision, selection = result.scenarios[0], jarIndex = 0) {
  const { samples, events } = selectedClearance(result, selection, jarIndex);
  const sampled = events.filter(e => e.kind.startsWith('sampled'));
  const inferred = events.filter(e => e.kind.startsWith('inferred'));
  return { data: [
    // Engine separation uses the opposite sign. Branch identity is unavailable;
    // isolated markers avoid joining unrelated branches or spanning missing samples.
    { type: 'scatter', mode: 'markers', name: 'Nearest sampled NP', x: samples.map(s => s.bitMdFt), y: samples.map(s => s.jar?.signedSeparationFt == null ? null : -s.jar.signedSeparationFt), connectgaps: false, marker: { color: '#176b8c', size: 7 }, hovertemplate: 'Bit MD %{x:.1f} ft<br>Signed NP distance %{y:.3f} ft<extra></extra>' },
    { type: 'scatter', mode: 'markers', name: 'Sampled jar/NP coincidence', x: sampled.map(e => e.bitMdFt), y: sampled.map(() => 0), marker: { color: '#b42318', symbol: 'diamond', size: 12 } },
    { type: 'scatter', mode: 'markers', name: 'Jar axial-load sign-change bracket (refine)', x: inferred.flatMap(e => [e.from.bitMdFt, e.to.bitMdFt]), y: inferred.flatMap(() => [0, 0]), text: inferred.flatMap(e => [crossingDepthDescription(e), crossingDepthDescription(e)]), marker: { color: '#7c3aed', symbol: 'diamond-open', size: 13 }, hovertemplate: '%{text}<br>Bracket endpoint MD %{x:.1f} ft<extra></extra>' }
  ], layout: { autosize: true, uirevision: revision, margin: { l: 75, r: 15, t: 55, b: 55 }, legend: { orientation: 'h', y: 1.15 }, xaxis: { title: { text: 'Bit MD (ft)' }, automargin: true }, yaxis: { title: { text: 'Signed NP distance relative to jar (ft)' }, automargin: true, rangemode: 'tozero' }, shapes: [
    { type: 'rect', xref: 'paper', x0: 0, x1: 1, y0: -threshold, y1: threshold, fillcolor: 'rgba(245,158,11,0.18)', line: { width: 0 }, layer: 'below' },
    { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: '#777', dash: 'dash' } }
  ] } };
}

export function axialProfilePlot(load, revision) {
  return { data: [{ type: 'scatter', mode: 'lines', name: 'Selected scenario load', x: load.profile.map(p => p.fromBitFt), y: load.profile.map(p => p.axialForceLbf), hovertemplate: 'Above bit %{x:.2f} ft<br>Axial load %{y:.1f} lbf<extra></extra>' }],
    layout: { autosize: true, uirevision: revision, margin: { l: 65, r: 15, t: 30, b: 55 }, xaxis: { title: { text: 'Distance above bit (ft) — not wellbore MD' }, automargin: true }, yaxis: { title: { text: 'Axial load (lbf); + compression / − tension' }, automargin: true }, shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: '#777', dash: 'dash' } }, ...load.jars.map(j => ({ type: 'line', x0: j.centreFromBitFt, x1: j.centreFromBitFt, yref: 'paper', y0: 0, y1: 1, line: { color: '#0f766e', dash: 'dot' } }))] } };
}

// Describe existing events without calculating new crossing locations.
export function crossingDepthDescription(event, format = String) {
  if (event.kind.startsWith('sampled')) return 'Sampled at bit MD ' + format(event.bitMdFt) + ' ft' + (event.kind === 'sampled-neutral-interval' ? ' (nonunique neutral interval)' : '');
  return 'Jar axial-load sign-change bracket: bit MD ' + format(event.from.bitMdFt) + ' to ' + format(event.to.bitMdFt) + ' ft (inferred; refine sampling; not an exact NP crossing depth)';
}

// Adjacent status samples bracket transitions; no branch interpolation is assumed.
export function avoidanceDepthIntervals(samples, format = String) {
  const status = sample => sample?.jar?.avoidanceStatus;
  const inside = sample => status(sample) === 'inside-avoidance-zone';
  const outside = sample => status(sample) === 'outside-avoidance-zone';
  const intervals = [];
  for (let i = 0; i < samples.length; i += 1) {
    if (!inside(samples[i])) continue;
    const first = i;
    while (i + 1 < samples.length && inside(samples[i + 1])) i += 1;
    const last = i;
    const depth = index => format(samples[index].bitMdFt);
    const entry = first === 0 ? 'Already inside at run start ' + depth(first) + ' ft; entry unknown'
      : outside(samples[first - 1]) ? 'Entry bracket: ' + depth(first - 1) + ' to ' + depth(first) + ' ft'
      : 'Inside at ' + depth(first) + ' ft after unavailable sample; entry unknown';
    const exit = last === samples.length - 1 ? 'Still inside at run end ' + depth(last) + ' ft; exit unknown'
      : outside(samples[last + 1]) ? 'Exit bracket: ' + depth(last) + ' to ' + depth(last + 1) + ' ft'
      : 'Inside at ' + depth(last) + ' ft before unavailable sample; exit unknown';
    intervals.push({ entry, exit });
  }
  return intervals;
}

export function comparisonClearances(result, request, frictionCoefficient, jarIndex = 0) {
  const wobs = request.minWobLbf === request.maxWobLbf ? [request.minWobLbf] : [request.minWobLbf, request.maxWobLbf];
  const colors = ['#0072B2', '#009E73', '#D55E00', '#CC79A7'];
  return wobs.flatMap((wobLbf, index) => ['slide', 'rotate'].map((mode, modeIndex) => {
    const selection = { wobLbf, mode, frictionCoefficient };
    const series = selectedClearance(result, selection, jarIndex);
    const samples = result.depthsFt.map(bitMdFt => series.samples.find(s => s.bitMdFt === bitMdFt) || { bitMdFt, jar: null });
    const matching = result.scenarios.filter(s => s.wobLbf === wobLbf && s.mode === mode && s.frictionCoefficient === frictionCoefficient);
    const errors = [...new Set(matching.filter(s => !s.valid).flatMap(s => s.errors))];
    return { ...series, samples, errors, missing: result.depthsFt.length - matching.length, unavailable: samples.filter(s => s.jar?.absoluteSeparationFt == null).length,
      selection, color: colors[index * 2 + modeIndex], name: `${wobs.length === 1 ? 'Minimum = Maximum' : index === 0 ? 'Minimum' : 'Maximum'} WOB ${wobLbf / 1000} klbf — ${mode === 'slide' ? 'Slide' : 'Rotate'}` };
  }));
}

// Trapezoidal integration of sampled inside/outside status. Unknown spans are
// excluded and reported separately; this is not continuous-run certification.
export function sampledExposure(samples) {
  let estimatedFt = 0, unresolvedFt = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1], b = samples[i], span = b.bitMdFt - a.bitMdFt;
    const known = s => ['inside-avoidance-zone', 'outside-avoidance-zone'].includes(s.jar?.avoidanceStatus);
    if (!known(a) || !known(b)) { unresolvedFt += span; continue; }
    const inside = s => s.jar.avoidanceStatus === 'inside-avoidance-zone';
    estimatedFt += span * (Number(inside(a)) + Number(inside(b))) / 2;
  }
  return { estimatedFt, unresolvedFt };
}

export function compressionDepthIntervals(samples, format = String) {
  const intervals = [];
  for (let i = 0; i < samples.length; i += 1) {
    if (!(samples[i].jar?.jarAxialLoadLbf > 1e-8)) continue;
    const first = i;
    while (i + 1 < samples.length && samples[i + 1].jar?.jarAxialLoadLbf > 1e-8) i += 1;
    intervals.push(`${format(samples[first].bitMdFt)}–${format(samples[i].bitMdFt)} ft (sampled; boundaries uncertain)`);
  }
  return intervals;
}

export function comparisonPlot(result, request, revision, series, jarIndex = 0) {
  const base = clearancePlot(result, request.avoidanceDistanceFt, revision, series[0]?.selection, jarIndex);
  base.data = series.flatMap(s => {
    const plot = clearancePlot(result, request.avoidanceDistanceFt, revision, s.selection, jarIndex);
    const traces = plot.data.map((trace, index) => ({ ...trace, name: index ? `${s.name}: ${trace.name}` : s.name,
      legendgroup: s.name, showlegend: index === 0, marker: { ...trace.marker, color: s.color } }));
    traces[0].x = s.samples.map(p => p.bitMdFt);
    traces[0].y = s.samples.map(p => p.jar?.signedSeparationFt == null ? null : -p.jar.signedSeparationFt);
    const boundaries = [];
    for (let i = 1; i < s.samples.length; i += 1) {
      const a = s.samples[i - 1], b = s.samples[i];
      const known = p => ['inside-avoidance-zone', 'outside-avoidance-zone'].includes(p.jar?.avoidanceStatus);
      if (known(a) && known(b) && a.jar.avoidanceStatus !== b.jar.avoidanceStatus) boundaries.push([a, b]);
    }
    traces.push({ type: 'scatter', mode: 'markers', name: `${s.name}: zone transition bracket`, legendgroup: s.name, showlegend: false,
      x: boundaries.flatMap(pair => pair.map(p => p.bitMdFt)), y: boundaries.flatMap(pair => pair.map(p => -p.jar.signedSeparationFt)),
      marker: { color: s.color, symbol: 'square-open', size: 12 }, hovertemplate: 'Bit MD %{x} ft<br>Avoidance entry/exit bracket endpoint<extra>%{fullData.name}</extra>' });
    return traces;
  });
  return base;
}
