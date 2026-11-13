import { researchPlot } from './jarDownResearchData';
export const displayNumber = (n, digits = 1) => Number.isFinite(n)
  ? (Object.is(n, -0) ? 0 : n).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : 'Unavailable';
// Resolve sub-klbf verification loads without making an inverse residual look
// like a 0.1-klbf target mismatch. This affects text only, never solver inputs.
export const displayJarCompression = lbf => displayNumber(Number.isFinite(lbf) ? lbf / 1000 : undefined,
  Math.abs(lbf) > 0 && Math.abs(lbf) < 1000 ? 2 : 1);
export const displayEventTime = seconds => !Number.isFinite(seconds) ? 'Unavailable'
  : `${seconds !== 0 && Math.abs(seconds * 1000) < .001 ? (seconds * 1000).toPrecision(3) : displayNumber(seconds * 1000, 3)} ms`;
export function surfaceDifferenceLabel(deltaLbf) {
  if (!Number.isFinite(deltaLbf)) return 'Slackoff: Select reference hookload';
  const magnitude = Math.abs(deltaLbf) / 1000;
  const value = magnitude > 0 && magnitude < .05 ? '<0.1' : displayNumber(magnitude);
  return deltaLbf < 0 ? `Surface support increase: ${value} klbf` : `Slackoff: ${value} klbf`;
}
export function targetBucklingStatus(result) {
  if (!result) return 'Screening unavailable';
  if (!result.valid) return 'Unsupported configuration';
  const b = result.buckling;
  if (!b?.valid || !b.summary) return 'Screening unavailable';
  if (b.summary.firstSinusoidalOnset || b.summary.firstHelicalOnset) return 'Buckling onset indicated';
  return b.summary.completeCoverage ? 'No warning reported by existing screening' : 'Screening unavailable';
}
export function targetTimings(result) {
  if (!result?.valid) return {};
  return { impactS: result.contact.transitions.find(e => e.type === 'engage')?.timeS,
    reactionS: result.contact.reaction[1]?.timeS };
}
export function targetForcePlot(result, visible, selected) {
  const plot = researchPlot(result, visible, {}, selected), times = targetTimings(result);
  // Keep selected labels inside the plot near either observation-window edge.
  // The arrow remains anchored to the exact event timestamp.
  const [left, right] = plot.layout.xaxis.range;
  for (const annotation of plot.layout.annotations) {
    const position = (annotation.x - left) / (right - left);
    annotation.ax = position < .25 ? 120 : position > .75 ? -120 : 0;
    annotation.font = { size: 12 };
  }
  for (const [time, color, dash] of [[times.impactS, '#217a50', 'dash'], [times.reactionS, '#355ea0', 'dot']]) {
    if (Number.isFinite(time)) plot.layout.shapes.push({ type: 'line', x0: time * 1000, x1: time * 1000,
      y0: 0, y1: 1, yref: 'paper', line: { color, width: 1.2, dash } });
  }
  return plot;
}
