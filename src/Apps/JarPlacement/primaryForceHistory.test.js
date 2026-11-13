import { calcSkeemPostImpact } from '../../engineering/jar/skeemDynamics';
import { samplePrimaryForceHistory, primaryForcePlot } from './primaryForceHistory';
const input = { overpullLbf: 750 * Math.PI, strokeIn: 0.5592, upperCollarLengthFt: 80,
  collarOdIn: 2, collarIdIn: 1, pipeOdIn: 1, pipeIdIn: .5, youngsModulusPsi: 16000000,
  acousticVelocityFtS: 16000, lowerCollarLengthFt: 40, lowerCollarWeightLbf: 100, freePipeLengthFt: 3000 };
test.each([1, 2, 8, 32, 128, 1024])('event-aligned sampling %s integrates independent hand-derived rectangles', n => {
  const result = calcSkeemPostImpact(input), history = samplePrimaryForceHistory(result, n);
  const F0 = 750 * Math.PI;
  const expected = ((2.92 * F0 - 200) + (3.352 * F0 - 200)) * .005;
  expect(history.valid).toBe(true);
  expect(Math.abs(history.numericalImpulseLbfS - expected)).toBeLessThan(1e-8);
  expect(Math.abs(history.analyticalImpulseLbfS - expected)).toBeLessThan(1e-8);
  expect(history.errorLbfS).toBeLessThan(1e-8);
  expect(history.solverErrorLbfS).toBeLessThan(1e-8);
  expect(history.samples.at(-1).cumulativeImpulseLbfS).toBe(history.numericalImpulseLbfS);
  expect(history.peakForceLbf).toBeCloseTo(3.352 * F0 - 200, 8);
  expect(history.peakForceLbf).not.toBe(result.impactForceLbf);
});
test.each([.06, .12, .12 - 1e-9, .12 + 1e-9, .1992, .3048, 1.2])('stroke/reflection boundary %s retains exact model event times and signs', strokeIn => {
  const result = calcSkeemPostImpact({ ...input, strokeIn }), history = samplePrimaryForceHistory(result);
  expect(history.valid).toBe(true);
  expect(history.samples[0].timeS).toBe(0);
  expect(history.samples.at(-1).timeS).toBe(result.primaryPulseDurationS);
  expect(history.samples.every(p => p.forceLbf > 0)).toBe(true);
  expect(history.solverErrorLbfS).toBeLessThan(1e-8);
  result.forceHistory.forEach(interval => {
    expect(history.samples.some(p => p.timeS === interval.relativeStartS && p.forceLbf === interval.tensileForceLbf)).toBe(true);
    expect(interval.compressionPositiveForceLbf).toBe(-interval.tensileForceLbf);
  });
});
test.each([0.5, 1, 2])('overpull factor %s preserves independently evaluated analytical impulse', factor => {
  const result = calcSkeemPostImpact({ ...input, overpullLbf: input.overpullLbf * factor });
  const h = samplePrimaryForceHistory(result);
  expect(h.valid).toBe(true);
  const d = result.forceTimeEvents[1].relativeTimeS;
  const expected = 2 * (result.impactForceLbf - 100) * result.primaryPulseDurationS + 2 * result.residualIncidentForceLbf * (result.primaryPulseDurationS - d);
  expect(Math.abs(h.numericalImpulseLbfS - expected)).toBeLessThan(1e-8);
});
test('plot units, shaded area, jumps, endpoint and optional impulse reflect integrated samples', () => {
  const result = calcSkeemPostImpact(input), original = JSON.stringify(result);
  const h = samplePrimaryForceHistory(result), plot = primaryForcePlot(h, true);
  let area = 0;
  const force = plot.data[0];
  for (let i = 1; i < force.x.length; i++) area += (force.x[i] - force.x[i - 1]) * (force.y[i] + force.y[i - 1]) / 2;
  // klbf × ms = lbf·s: conversions cancel, not a factor of 1000.
  expect(Math.abs(area - result.impulseLbfS)).toBeLessThan(1e-8);
  expect(force.fill).toBe('tozeroy'); expect(force.mode).toBe('lines'); expect(force.line.shape).toBe('linear');
  expect(force.x.some((x, i) => i && x === force.x[i - 1] && force.y[i] !== force.y[i - 1])).toBe(true);
  expect(force.x.at(-1)).toBe(result.primaryPulseDurationS * 1000); expect(force.y.at(-1)).toBeGreaterThan(0);
  expect(plot.data[2].yaxis).toBe('y2'); expect(primaryForcePlot(h, false).data).toHaveLength(2);
  expect(JSON.stringify(result)).toBe(original);
});
test('unsupported direction, invalid solver, no history and noncontiguous histories do not create a curve', () => {
  expect(samplePrimaryForceHistory(calcSkeemPostImpact({ ...input, direction: 'down' })).valid).toBe(false);
  expect(samplePrimaryForceHistory(calcSkeemPostImpact({ ...input, freePipeLengthFt: 1300 })).valid).toBe(false);
  expect(samplePrimaryForceHistory({ valid: true }).valid).toBe(false);
  const result = calcSkeemPostImpact(input);
  expect(samplePrimaryForceHistory({ ...result, forceHistory: result.forceHistory.slice(1) }).valid).toBe(false);
  expect(samplePrimaryForceHistory(result, 0).valid).toBe(false);
});
