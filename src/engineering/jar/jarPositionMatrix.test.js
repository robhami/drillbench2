import { calculatePositionMatrix, preparePositionMatrix, matrixDefaults, matrixPercent, MATRIX_METRICS } from './jarPositionMatrix';
import { configurationGeometry } from '../../Apps/JarConfiguration/configurationData';
import { calculateJarPerformance } from '../../Apps/JarPlacement/skeemPerformance';
import { samplePrimaryForceHistory } from '../../Apps/JarPlacement/primaryForceHistory';
import independent from '../../../docs/ValidationStudies/JarPositionMatrixStage5C14.independent.json';
export const bha = { id: 'matrix-bha', name: 'Uniform matrix verification', rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 }, { category: 'JAR', length: 10, weight: 150 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 }, { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95), weight: 20 }
] };
const geometry = configurationGeometry(bha);
const defaults = { ...matrixDefaults(geometry), aSamples: '3', bMin: '60', bMax: '180', bSamples: '3', c1Samples: '3', c2Samples: '3' };
const run = changes => calculatePositionMatrix({ geometry, fields: { ...defaults, ...changes } });

test.each(independent)('$mode / $policy / L1 $l1 L2 $l2 matches the independent Decimal reference and exact sampler', fixture => {
  const r = run({ mode: fixture.mode, policy: fixture.policy });
  expect(r.valid).toBe(true);
  const s = r.samples.find(sample => sample.l1Ft === fixture.l1 && sample.l2Ft === fixture.l2);
  expect(s.valid).toBe(true); expect(s.l3Ft).toBe(fixture.l3);
  for (const [actual, expected] of [[s.impactForceKlbf, fixture.expected.impactForceLbf / 1000], [s.peakStuckPointForceKlbf, fixture.expected.peakForceLbf / 1000],
    [s.averageStuckPointForceKlbf, fixture.expected.averageStuckPointForceLbf / 1000], [s.impulseLbfS, fixture.expected.impulseLbfS], [s.impactVelocityFtS, fixture.expected.hammerVelocityFtS]]) {
    expect(Math.abs(actual - expected)).toBeLessThan(1e-8);
  }
  const history = samplePrimaryForceHistory(s.solverResult);
  expect(history.valid).toBe(true); expect(Math.abs(history.numericalImpulseLbfS - fixture.expected.impulseLbfS)).toBeLessThan(1e-8);
  expect(s.solverResult.preImpact.reflectionHistory).toBeUndefined();
});

test.each(['A', 'B', 'C'])('%s baseline is the actual BHA at identical operating inputs, not a nearest grid value', mode => {
  const r = run({ mode }), direct = calculateJarPerformance(bha, { overpullKlbf: 165, strokeIn: 4, stuckPointFt: 0 });
  expect(r.actual.input.lowerCollarLengthFt).toBe(60); expect(r.actual.input.upperCollarLengthFt).toBe(180); expect(r.actual.l3Ft).toBe(3000);
  expect(r.actual.impactForceKlbf).toBeCloseTo(direct.impactForceKlbf, 10);
  expect(r.actual.impulseLbfS).toBeCloseTo(direct.impulseLbfS, 8);
});

test.each(['replace-pipe', 'extend-string'])('B/C %s conserves its stated geometry and reports inventory and weights', policy => {
  for (const mode of ['B', 'C']) {
    const r = run({ mode, policy });
    r.samples.forEach(s => {
      expect(s.valid).toBe(true);
      if (policy === 'replace-pipe') expect(s.totalStringLengthFt).toBeCloseTo(3250, 10); else expect(s.l3Ft).toBe(3000);
      if (mode === 'B') expect(s.jarCentreAboveBitFt).toBe(65);
      expect(s.additionalCollarLengthFt).toBe(Math.max(0, s.totalCollarLengthFt - 240));
      expect(s.collarAirWeightLbf).toBeCloseTo(s.totalCollarLengthFt * 84.01718313127864, 8);
      expect(s.pipeAirWeightLbf).toBe(s.l3Ft * 20);
      expect(s.totalAirWeightLbf).toBeCloseTo(s.collarAirWeightLbf + s.pipeAirWeightLbf + 1500, 8);
    });
  }
});

test('A proposes only the inventory path and preserves the BHA without added collars', () => {
  const before = JSON.stringify(bha), r = run({ mode: 'A' });
  expect(r.samples).toHaveLength(3);
  r.samples.forEach(s => { expect(s.l1Ft + s.l2Ft).toBe(240); expect(s.l3Ft).toBe(3000); expect(s.additionalCollarLengthFt).toBe(0); expect(s.feasibility).toMatch(/unverified|Actual BHA/); });
  expect(JSON.stringify(bha)).toBe(before);
});

test.each(['A', 'B', 'C'])('%s force and impulse maxima are independently identified', mode => {
  const r = run({ mode, policy: 'replace-pipe' });
  const refs = independent.filter(f => f.mode === mode && f.policy === (mode === 'A' ? 'fixed-inventory' : 'replace-pipe'));
  expect(r.maxima.peak.peakStuckPointForceKlbf).toBeCloseTo(Math.max(...refs.map(f => f.expected.peakForceLbf / 1000)), 9);
  expect(r.maxima.impulse.impulseLbfS).toBeCloseTo(Math.max(...refs.map(f => f.expected.impulseLbfS)), 8);
  expect(Object.keys(r.maxima)).toEqual(Object.keys(MATRIX_METRICS));
});

test('unsupported C removals and invalid pipe replacements remain invalid, not clamped', () => {
  const r = run({ mode: 'C', c1Min: '0', c1Max: '60', c2Min: '0', c2Max: '180' });
  expect(r.unsupportedCount).toBe(8); expect(r.validCount).toBe(1);
  expect(r.samples[0].solverResult).toBeNull(); expect(r.samples[0].impulseLbfS).toBeNull();
  const noPipe = run({ mode: 'B', bMin: '4000', bMax: '4000', bSamples: '1' });
  expect(noPipe.samples[0].l3Ft).toBe(-820); expect(noPipe.unsupportedCount).toBe(1);
  const tooShort = run({ mode: 'B', bMin: '2000', bMax: '2000', bSamples: '1' });
  expect(tooShort.samples[0].classification).toBe('solver-invalid');
});

test.each([{ aSamples: '0' }, { aSamples: '501' }, { aMin: '' }, { aMax: '-1' }, { stroke: '0' }, { overpull: '' }, { mode: 'D' }, { mode: 'B', policy: '' }, { mode: 'C', c1Samples: '51' }])('invalid request %j is rejected', change => {
  expect(run(change).valid).toBe(false);
});

test('missing/unsupported geometry and nominal weights never invent a BHA or total weight', () => {
  expect(preparePositionMatrix({ valid: false, error: 'Missing jar' }, defaults).valid).toBe(false);
  expect(preparePositionMatrix({ ...geometry, relocation: null }, defaults).valid).toBe(false);
  const noWeights = configurationGeometry({ ...bha, rows: bha.rows.map(r => ['DP', 'JAR'].includes(r.category) ? { ...r, weight: '' } : r) });
  const r = calculatePositionMatrix({ geometry: noWeights, fields: defaults });
  expect(r.validCount).toBe(3); expect(r.actual.pipeAirWeightLbf).toBeNull(); expect(r.actual.totalAirWeightLbf).toBeNull();
});

test('percentage changes do not divide by zero or replace unavailable values', () => {
  expect(matrixPercent(110, 100)).toBe(10); expect(matrixPercent(90, 100)).toBe(-10);
  expect(matrixPercent(1, 0)).toBeNull(); expect(matrixPercent(null, 100)).toBeNull();
});
