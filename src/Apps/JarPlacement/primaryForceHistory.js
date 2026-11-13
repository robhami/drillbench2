// Samples an existing solver history; does not reconstruct contact mechanics or
// change Skeem amplitudes/timing. See JarImpactStage5C6Audit.md before extending.
export function samplePrimaryForceHistory(result, subdivisions = 32) {
  const fail = error => ({ valid: false, error });
  if (!result?.valid || !result.forceHistory?.length) return fail('A validated primary force history is not available for this calculation.');
  if (!Number.isInteger(subdivisions) || subdivisions < 1 || subdivisions > 4096) return fail('Use 1–4096 samples per force interval.');
  const T = result.primaryPulseDurationS, d = result.forceTimeEvents?.find(event => event.kind === 'residual-wave')?.relativeTimeS ?? (result.t2S - result.t1S);
  if (![T, d, result.initialStuckPointForceLbf, result.residualStuckPointIncrementLbf, result.impulseLbfS].every(Number.isFinite) || T <= 0 || d < 0 || d > T) return fail('Primary timing or amplitudes are unavailable.');
  const samples = [];
  let previousEnd = 0;
  for (const interval of result.forceHistory) {
    const { relativeStartS: a, relativeEndS: b, tensileForceLbf: force } = interval;
    if (![a, b, force].every(Number.isFinite) || b <= a || a !== previousEnd || b > T) return fail('Primary intervals must be finite, contiguous and confined to the integration interval.');
    for (let i = 0; i <= subdivisions; i += 1) samples.push({ timeS: i === subdivisions ? b : a + (b - a) * i / subdivisions, forceLbf: force });
    previousEnd = b;
  }
  if (previousEnd !== T) return fail('Primary intervals do not cover the integration interval.');
  let numericalImpulseLbfS = 0;
  samples.forEach((sample, i) => {
    if (i) numericalImpulseLbfS += (sample.timeS - samples[i - 1].timeS) * (sample.forceLbf + samples[i - 1].forceLbf) / 2;
    sample.cumulativeImpulseLbfS = numericalImpulseLbfS;
  });
  // Closed-form two-wave integral, separate from the solver's interval-sum J.
  const analyticalImpulseLbfS = result.initialStuckPointForceLbf * T + result.residualStuckPointIncrementLbf * (T - d);
  const errorLbfS = Math.abs(numericalImpulseLbfS - analyticalImpulseLbfS);
  const peak = samples.reduce((best, point) => point.forceLbf > best.forceLbf ? point : best, samples[0]);
  return { valid: true, samples, numericalImpulseLbfS, analyticalImpulseLbfS, errorLbfS,
    solverErrorLbfS: Math.abs(numericalImpulseLbfS - result.impulseLbfS),
    relativeErrorPercent: analyticalImpulseLbfS === 0 ? null : errorLbfS / Math.abs(analyticalImpulseLbfS) * 100,
    peakForceLbf: peak.forceLbf, peakTimeS: peak.timeS, peakImpulseLbfS: peak.cumulativeImpulseLbfS, durationS: T,
    // Presentation metadata from authoritative events; no new wave calculation.
    reflectionSteps: (result.forceTimeEvents || []).filter(event => event.kind === 'residual-wave' && event.relativeTimeS >= 0 && event.relativeTimeS < T) };
}

export function primaryForcePlot(history, showCumulative) {
  const { samples, peakForceLbf, peakTimeS, durationS } = history;
  const customdata = samples.map(p => [p.cumulativeImpulseLbfS]);
  const data = [{ type: 'scatter', mode: 'lines', name: 'Primary stuck-point tensile force', x: samples.map(p => p.timeS * 1000), y: samples.map(p => p.forceLbf / 1000), customdata,
    line: { color: '#0072B2', width: 2.25, shape: 'linear', simplify: false }, fill: 'tozeroy', fillcolor: 'rgba(0,114,178,0.13)',
    hovertemplate: 'Time %{x:.3f} ms after first arrival<br>Stuck-point force %{y:,.1f} klbf<br>Accumulated impulse %{customdata[0]:,.1f} lbf·s<extra></extra>' },
  { type: 'scatter', mode: 'markers', name: 'Primary stuck-point peak', x: [peakTimeS * 1000], y: [peakForceLbf / 1000], customdata: [[history.peakImpulseLbfS]], marker: { color: '#D55E00', size: 9, symbol: 'diamond' },
    hovertemplate: 'Primary stuck-point peak %{y:,.1f} klbf<br>First attained at %{x:.3f} ms<br>Accumulated impulse %{customdata[0]:,.1f} lbf·s<extra></extra>' }];
  if (showCumulative) data.push({ type: 'scatter', mode: 'lines', name: 'Cumulative impulse', yaxis: 'y2', x: samples.map(p => p.timeS * 1000), y: samples.map(p => p.cumulativeImpulseLbfS), customdata: samples.map(p => [p.forceLbf / 1000]),
    line: { color: '#009E73', width: 2, dash: 'dash' }, hovertemplate: 'Time %{x:.3f} ms<br>Impulse %{y:,.1f} lbf·s<br>Force %{customdata[0]:,.1f} klbf<extra></extra>' });
  return { data, layout: { autosize: true, showlegend: false, uirevision: `${durationS}:${peakForceLbf}`,
    font: { family: 'Arial, sans-serif', size: 12, color: '#334155' }, paper_bgcolor: 'white', plot_bgcolor: 'white', margin: { l: 75, r: showCumulative ? 85 : 25, t: 22, b: 60 },
    xaxis: { title: { text: 'Time (ms)', font: { size: 14 }, standoff: 12 }, range: [0, durationS * 1000], automargin: true, gridcolor: '#edf0f3' },
    yaxis: { title: { text: 'Stuck-Point Force (klbf)', font: { size: 14 }, standoff: 12 }, rangemode: 'tozero', automargin: true, gridcolor: '#edf0f3' },
    ...(showCumulative ? { yaxis2: { title: { text: 'Cumulative Impulse (lbf·s)', font: { size: 13 }, standoff: 10 }, overlaying: 'y', side: 'right', rangemode: 'tozero', automargin: true, showgrid: false } } : {}),
    shapes: [durationS, ...(history.reflectionSteps || []).map(event => event.relativeTimeS)].map(time => ({ type: 'line', xref: 'x', x0: time * 1000, x1: time * 1000, yref: 'paper', y0: 0, y1: 1, line: { color: '#64748b', dash: 'dot', width: 1 } })),
    annotations: [{ x: 1, y: 1, xref: 'paper', yref: 'paper', xanchor: 'right', yanchor: 'bottom', text: `Primary interval: 0–${(durationS * 1000).toFixed(2)} ms (T⁻)`, showarrow: false, font: { size: 11 } },
      { x: peakTimeS * 1000, y: peakForceLbf / 1000, xref: 'x', yref: 'y', text: `Peak ${(peakForceLbf / 1000).toFixed(1)} klbf`, showarrow: true,
        ax: peakTimeS > durationS / 2 ? -45 : 45, ay: 35, arrowcolor: '#D55E00', arrowwidth: 1, font: { size: 11, color: '#a34200' }, bgcolor: 'rgba(255,255,255,0.9)' },
      ...(history.reflectionSteps || []).map(event => ({ x: event.relativeTimeS * 1000, y: .45, xref: 'x', yref: 'paper', xanchor: event.relativeTimeS > durationS / 2 ? 'right' : 'left',
        text: `Residual tensile wave<br>+${(event.deltaTensileForceLbf / 1000).toFixed(1)} klbf at ${(event.relativeTimeS * 1000).toFixed(2)} ms`, showarrow: false, xshift: event.relativeTimeS > durationS / 2 ? -8 : 8,
        bgcolor: 'rgba(255,255,255,0.9)', font: { size: 11, color: '#475569' } }))]
  } };
}
