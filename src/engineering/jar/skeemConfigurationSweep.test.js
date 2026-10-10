import { calcSkeemConfigurationSweep, MAX_SWEEP_SAMPLES } from './skeemConfigurationSweep';
import { calcSkeemPostImpact } from './skeemDynamics';

const constants = {
  overpullKlbf: 165, strokeIn: 4, collarOdIn: 6.25, collarIdIn: 2.75,
  pipeOdIn: 4.5, pipeIdIn: Math.sqrt(13.95), youngsModulusPsi: 30000000,
  acousticVelocityFtS: 16000, freePipeLengthFt: 3000, materialWeightDensityLbfIn3: 0.283
};
const axis = (minFt = 60, maxFt = 180, samples = 3) => ({ minFt, maxFt, samples });
const fixed = { mode: 'fixed-total', constants, totalCollarLengthFt: 240, l1: axis() };
const independent = { mode: 'independent', constants, l1: axis(), l2: axis() };
const near = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThan(1e-8);

test('fixed total preserves collar length and recovers independent published-example references', () => {
  const result = calcSkeemConfigurationSweep(fixed);
  expect(result.valid).toBe(true);
  expect(result.validCount).toBe(3);
  expect(result.invalidCount).toBe(0);
  expect(result.samples.map(s => [s.l1Ft, s.l2Ft])).toEqual([[60, 180], [120, 120], [180, 60]]);
  result.samples.forEach(s => expect(s.totalCollarLengthFt).toBe(240));
  const expected = [
    [11.461401475005768, 265833.3333333333, 546821.0907548704, 12303.474541984585, 0.0225, 2],
    [11.461401475005768, 265833.3333333333, 599931.9844547738, 8998.979766821606, 0.015, 2],
    [14.974474724049681, 347314.8148148148, 686314.8027831711, 5147.361020873783, 0.0075, 4]
  ];
  result.samples.forEach((s, i) => {
    ['impactVelocityFtS', 'impactForceLbf', 'averageStuckPointForceLbf', 'impulseLbfS', 'primaryPulseDurationS', 'reflectionCount'].forEach((key, j) => near(s[key], expected[i][j]));
  });
});

test('independent sweep is a reproducible Cartesian product in L1-major order', () => {
  const result = calcSkeemConfigurationSweep(independent);
  expect(result.samples.map(s => [s.l1Ft, s.l2Ft, s.l1Index, s.l2Index])).toEqual([
    [60, 60, 0, 0], [60, 120, 0, 1], [60, 180, 0, 2],
    [120, 60, 1, 0], [120, 120, 1, 1], [120, 180, 1, 2],
    [180, 60, 2, 0], [180, 120, 2, 1], [180, 180, 2, 2]
  ]);
  // Independent 50-digit Decimal calculation: closed-form reflection sums
  // and corrected analytic primary-force rectangles, not production helpers.
  const impulses = [5298.591950510085, 9150.210696457907, 12303.474541984584,
    5222.976485691934, 8998.979766821607, 12076.628147530133,
    5147.361020873783, 8847.748837185305, 11849.78175307568];
  result.samples.forEach((s, i) => { near(s.impulseLbfS, impulses[i]); expect(s.totalCollarLengthFt).toBe(s.l1Ft + s.l2Ft); });
  expect(result).toEqual(calcSkeemConfigurationSweep(independent));
});

test('weights follow uniform volume and independent lengths, including density sensitivity', () => {
  const result = calcSkeemConfigurationSweep(independent);
  const weightPerFoot = 84.01718313127864; // pi/4*(6.25²-2.75²)*12*0.283.
  result.samples.forEach(s => {
    near(s.lowerCollarAirWeightLbf, weightPerFoot * s.l1Ft);
    near(s.upperCollarAirWeightLbf, weightPerFoot * s.l2Ft);
  });
  const doubled = calcSkeemConfigurationSweep({ ...independent, constants: { ...constants, materialWeightDensityLbfIn3: 0.566 } });
  doubled.samples.forEach((s, i) => {
    near(s.lowerCollarAirWeightLbf, 2 * result.samples[i].lowerCollarAirWeightLbf);
    near(s.upperCollarAirWeightLbf, 2 * result.samples[i].upperCollarAirWeightLbf);
    near(s.impactForceLbf, result.samples[i].impactForceLbf);
    near(result.samples[i].impulseLbfS - s.impulseLbfS, 2 * result.samples[i].lowerCollarAirWeightLbf * s.primaryPulseDurationS);
  });
});

test('every sample agrees with a direct Skeem call with correctly converted units', () => {
  calcSkeemConfigurationSweep(independent).samples.forEach(s => {
    const direct = calcSkeemPostImpact({ ...constants, overpullLbf: 165000,
      lowerCollarLengthFt: s.l1Ft, upperCollarLengthFt: s.l2Ft,
      lowerCollarWeightLbf: s.lowerCollarAirWeightLbf });
    expect(s.valid).toBe(direct.valid);
    expect(s.impactVelocityFtS).toBe(direct.preImpact.hammerVelocityFtS);
    expect(s.impactForceLbf).toBe(direct.impactForceLbf);
    expect(s.averageStuckPointForceLbf).toBe(direct.averageStuckPointForceLbf);
    expect(s.impulseLbfS).toBe(direct.impulseLbfS);
    expect(s.primaryPulseDurationS).toBe(direct.primaryPulseDurationS);
    near(s.impactForceKlbf * 1000, s.impactForceLbf);
    near(s.averageStuckPointForceKlbf * 1000, s.averageStuckPointForceLbf);
    near(s.averageStuckPointForceLbf * s.primaryPulseDurationS, s.impulseLbfS);
  });
});

test('does not mutate requests, constants or a supplied original BHA', () => {
  const bha = Object.freeze({ rows: Object.freeze([Object.freeze({ category: 'DC', length: 160 })]) });
  const request = Object.freeze({ ...fixed, constants: Object.freeze({ ...constants }), l1: Object.freeze(axis()), bha });
  const before = JSON.stringify(request);
  expect(calcSkeemConfigurationSweep(request).validCount).toBe(3);
  expect(JSON.stringify(request)).toBe(before);
});

test('identifies distinct sampled maxima and retains first exact impact-force tie', () => {
  const fixedResult = calcSkeemConfigurationSweep(fixed);
  expect(fixedResult.maxima.impulse.index).toBe(0);
  expect(fixedResult.maxima.averageForce.index).toBe(2);
  expect(fixedResult.maxima.impactForce.index).toBe(2);
  const result = calcSkeemConfigurationSweep(independent);
  expect(result.maxima.label).toBe('Maxima within the sampled domain');
  expect(result.maxima.impulse.index).toBe(2);
  expect(result.maxima.averageForce.index).toBe(0);
  expect(result.maxima.impactForce.index).toBe(0);
  expect(result.samples[0].impactForceLbf).toBe(result.samples[3].impactForceLbf);
});

test('retains nonpositive-length samples as invalid without interpolation or maxima contamination', () => {
  const result = calcSkeemConfigurationSweep({ ...independent, l1: axis(-60, 60), l2: axis(-60, 60) });
  expect(result.samples).toHaveLength(9);
  expect(result.validCount).toBe(1);
  expect(result.invalidCount).toBe(8);
  expect(result.maxima.impulse.index).toBe(8);
  result.samples.filter(s => !s.valid).forEach(s => {
    expect(s.error).toMatch(/LengthFt/);
    expect(s.warnings).toContain(s.error);
    expect(s.impulseLbfS).toBeNull();
    expect(s.impactForceLbf).toBeNull();
    expect(s.reflectionCount).toBeNull();
  });
  expect(result.invalidReasons.reduce((sum, r) => sum + r.count, 0)).toBe(8);
  expect(result.invalidReasons.flatMap(r => r.sampleIndices).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});

test('fixed-total points at or beyond total become explicit invalid configurations', () => {
  const result = calcSkeemConfigurationSweep({ ...fixed, l1: axis(180, 300) });
  expect(result.samples.map(s => s.l2Ft)).toEqual([60, 0, -60]);
  expect(result.validCount).toBe(1);
  expect(result.invalidCount).toBe(2);
});

test('excess lower weight is rejected independently for each L1', () => {
  const result = calcSkeemConfigurationSweep({ ...independent, l1: axis(60, 10000, 2), l2: axis(60, 60, 1) });
  expect(result.validCount).toBe(1);
  expect(result.samples[1].error).toMatch(/weight must be less than FI/);
  expect(result.samples[1].lowerCollarAirWeightLbf).toBeGreaterThan(347314);
  expect(result.maxima.impulse.index).toBe(0);
});

test.each([
  [{ freePipeLengthFt: 1300 }, /1300/], [{ collarIdIn: 7 }, /collarIdIn/],
  [{ pipeIdIn: undefined }, /pipeIdIn/], [{ overpullKlbf: '165' }, /overpullLbf/],
  [{ direction: 'down' }, /upward/], [{ strokeIn: 0 }, /strokeIn/],
  [{ youngsModulusPsi: -1 }, /youngsModulusPsi/]
])('propagates authoritative solver validity checks for %j', (change, reason) => {
  const result = calcSkeemConfigurationSweep({ ...fixed, constants: { ...constants, ...change } });
  expect(result.valid).toBe(true);
  expect(result.validCount).toBe(0);
  expect(result.invalidCount).toBe(3);
  expect(result.samples[0].error).toMatch(reason);
  expect(result.maxima.impulse).toBeNull();
  expect(result.maxima.averageForce).toBeNull();
  expect(result.maxima.impactForce).toBeNull();
});

test('keeps numerical solver safeguards and rejects unrepresentable weights', () => {
  expect(calcSkeemConfigurationSweep(fixed, { maxReflections: 0 }).invalidCount).toBe(3);
  const tiny = calcSkeemConfigurationSweep({ ...independent, l1: axis(Number.MIN_VALUE, Number.MIN_VALUE, 1), l2: axis(60, 60, 1) });
  expect(tiny.samples[0].valid).toBe(false);
  const huge = calcSkeemConfigurationSweep({ ...fixed, constants: { ...constants, materialWeightDensityLbfIn3: Number.MAX_VALUE } });
  expect(huge.invalidCount).toBe(3);
  expect(huge.samples[0].lowerCollarAirWeightLbf).toBeNull();
  expect(JSON.stringify(huge)).not.toMatch(/NaN|Infinity/);
});

test('single-point axes and inclusive fractional endpoints are supported', () => {
  const point = calcSkeemConfigurationSweep({ ...independent, l1: axis(60, 60, 1), l2: axis(180, 180, 1) });
  expect(point.samples).toHaveLength(1);
  near(point.samples[0].impulseLbfS, 12303.474541984585);
  const fractional = calcSkeemConfigurationSweep({ ...fixed, l1: axis(60.1, 180.2, 4) });
  expect(fractional.axes.l1Ft[0]).toBe(60.1);
  expect(fractional.axes.l1Ft[3]).toBe(180.2);
  fractional.samples.forEach(s => near(s.totalCollarLengthFt, 240));
});

test('overflowing derived fixed-total geometry remains an invalid sample without non-finite plot coordinates', () => {
  const result = calcSkeemConfigurationSweep({ ...fixed, totalCollarLengthFt: Number.MAX_VALUE, l1: axis(-Number.MAX_VALUE, -Number.MAX_VALUE, 1) });
  expect(result.samples[0].valid).toBe(false);
  expect(result.samples[0].l2Ft).toBeNull();
  expect(result.axes.l2Ft).toEqual([null]);
  expect(result.samples[0].error).toMatch(/upperCollarLengthFt/);
});

test.each([
  null, {}, { ...fixed, mode: 'other' }, { ...fixed, totalCollarLengthFt: 0 },
  { ...fixed, l1: axis(180, 60) }, { ...fixed, l1: axis(60, Infinity) },
  { ...fixed, l1: axis(60, 180, 0) }, { ...fixed, l1: axis(60, 180, 2.5) },
  { ...fixed, l1: axis(60, 180, 1) }, { ...fixed, l1: axis(60, 60, 2) },
  { ...fixed, l1: axis(60, 180, MAX_SWEEP_SAMPLES + 1) },
  { ...independent, l1: axis(60, 180, 101), l2: axis(60, 180, 100) },
  { ...fixed, l1: axis(1, 1 + Number.EPSILON, 3) },
  { ...fixed, constants: { ...constants, materialWeightDensityLbfIn3: 0 } },
  { ...fixed, constants: { ...constants, materialWeightDensityLbfIn3: NaN } }
])('invalid/unresolvable sweep request returns an explicit setup error', request => {
  const result = calcSkeemConfigurationSweep(request);
  expect(result.valid).toBe(false);
  expect(result.error).toBeTruthy();
  expect(result.samples).toEqual([]);
  expect(result.maxima.impulse).toBeNull();
});
