import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import { demoMotorCollarGeometry } from '../../Apps/JarConfiguration/demoMotorCollar';
import { calculatePositionMatrix, matrixDefaults } from './jarPositionMatrix';
import independent from '../../../docs/ValidationStudies/MotorFullMatrixDemo.independent.json';

const demo = () => demoMotorCollarGeometry(live.bha);
const request = (mode, policy = 'replace-pipe') => {
  const geometry = demo().geometry;
  return { geometry, fields: { ...matrixDefaults(geometry), mode, policy, overpull: '300',
    aMin: '331.16798', aMax: '1231.16798', aSamples: '4',
    bMin: '300', bMax: '900', bSamples: '3',
    c1Min: '931.16798', c1Max: '1131.16798', c1Samples: '3', c2Min: '600', c2Max: '900', c2Samples: '4' } };
};

test.each(['A', 'B', 'C'])('demo %s uses original generator and conserves candidate mass and deployment', mode => {
  const req = request(mode), result = calculatePositionMatrix(req);
  expect(result.valid).toBe(true); expect(result.invalidCount).toBe(0);
  expect(result.samples).toHaveLength(mode === 'C' ? 12 : mode === 'B' ? 3 : 4);
  for (const s of [result.actual, ...result.samples]) {
    const a = s.demoAccounting;
    expect(a.motorWeightLbf).toBeCloseTo(3085.6, 8);
    expect(a.motorLengthFt).toBe(31.16798);
    expect(a.physicalLowerCollarFt).toBeCloseTo(s.l1Ft - 31.16798, 9);
    // Independent inventory/weight arithmetic, not a call to the solver.
    const dc = s.l1Ft - 31.16798 + s.l2Ft, weight = 3085.6 + 92 * dc;
    expect(s.collarAirWeightLbf).toBeCloseTo(weight, 7);
    expect(s.lowerCollarAirWeightLbf).toBeCloseTo(weight * s.l1Ft / (s.l1Ft + s.l2Ft), 7);
    expect(a.physicalCollarAirWeightLbf).toBeCloseTo(dc * 92, 7);
    expect(s.totalAirWeightLbf).toBeCloseTo(weight + 33 * 78.8 + s.l3Ft * 22.32, 7);
    expect(s.totalStringLengthFt).toBeCloseTo(10000, 8);
    expect(a.impliedBitMdFt).toBeCloseTo(10000, 8);
    expect(s.jarCentreAboveBitFt).toBeCloseTo(31.16798 + a.physicalLowerCollarFt + 16.5, 8);
  }
  if (mode === 'C') {
    expect(new Set(result.samples.map(s => s.l1Ft)).size).toBe(3);
    expect(new Set(result.samples.map(s => s.l2Ft)).size).toBe(4);
    expect(result.samples.at(-1).additionalCollarLengthFt).toBeCloseTo(500, 8);
    expect(result.samples.at(-1).pipeLengthChangeFt).toBeCloseTo(-500, 8);
  }
});

test('extend-string reports a changed deployment and keeps fixed motor mass while adding actual DC weight', () => {
  const result = calculatePositionMatrix(request('C', 'extend-string'));
  const s = result.samples.at(-1);
  expect(s.l3Ft).toBeCloseTo(8435.83202, 8);
  expect(s.totalStringLengthFt).toBeCloseTo(10500, 8);
  expect(s.demoAccounting.impliedBitMdFt).toBeCloseTo(10500, 8);
  expect(s.demoAccounting.sourceBitMdFt).toBe(10000);
  expect(s.demoAccounting.deployment).toMatch(/Hypothetical changed bit MD/);
  expect(s.collarAirWeightLbf - result.actual.collarAirWeightLbf).toBeCloseTo(500 * 92, 7);
  expect(s.demoAccounting.uniformAirWeightPerFootLbf).not.toBe(result.actual.demoAccounting.uniformAirWeightPerFootLbf);
});

test('unavailable deployment, inside-motor positions and unsupported C removals remain invalid', () => {
  expect(demoMotorCollarGeometry(live.bha, { bitMdFt: 1000 }).valid).toBe(false);
  const a = request('A'); a.fields = { ...a.fields, aMin: '10', aMax: '31.16798', aSamples: '2' };
  expect(calculatePositionMatrix(a).samples.every(s => !s.valid && s.classification === 'unsupported')).toBe(true);
  const c = request('C'); c.fields.c1Min = '800';
  expect(calculatePositionMatrix(c).samples.some(s => !s.valid && /Mode C/.test(s.error))).toBe(true);
});

test('explicit shared depth and surface reference are used without mutating source BHA', () => {
  const before = JSON.stringify(live.bha), d = demoMotorCollarGeometry(live.bha, { bitMdFt: 9500, surfaceMdFt: 100 });
  const r = calculatePositionMatrix({ geometry: d.geometry, fields: { ...matrixDefaults(d.geometry), overpull: '300' } });
  expect(r.actual.totalStringLengthFt).toBeCloseTo(9400, 8);
  expect(r.actual.demoAccounting.impliedBitMdFt).toBeCloseTo(9500, 8);
  expect(JSON.stringify(live.bha)).toBe(before);
});

test.each(independent.cases)('cell L1=$l1Ft L2=$l2Ft matches independent Decimal inventory and wave result', expected => {
  const result = calculatePositionMatrix({ geometry: demo().geometry, fields: independent.fields });
  const s = result.samples.find(p => p.l1Ft === expected.l1Ft && p.l2Ft === expected.l2Ft);
  expect(s.valid).toBe(true);
  expect(s.input.lowerCollarWeightLbf).toBeCloseTo(expected.input.lowerCollarWeightLbf, 7);
  expect(s.l3Ft).toBeCloseTo(expected.input.freePipeLengthFt, 8);
  expect(Math.abs(s.solverResult.impactForceLbf - expected.expected.impactForceLbf)).toBeLessThan(1e-8);
  expect(Math.abs(s.peakStuckPointForceKlbf * 1000 - expected.expected.peakForceLbf)).toBeLessThan(1e-8);
  expect(Math.abs(s.impulseLbfS - expected.expected.impulseLbfS)).toBeLessThan(1e-8);
});
