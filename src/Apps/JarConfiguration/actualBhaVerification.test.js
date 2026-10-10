import { configurationGeometry, configurationRequest } from './configurationData';
import { calcSkeemConfigurationSweep } from '../../engineering/jar/skeemConfigurationSweep';
import { calcSkeemPostImpact } from '../../engineering/jar/skeemDynamics';

// Geometry recovered read-only from Edge's localhost:3000 drillbenchWell
// currentBha on 2026-10-10. Keep entered string/number types; omit personal IDs.
const actualBha = { name: 'Validation test 3', rows: [
  { category: 'DC', od: 9.5, idSize: 3.75, weight: '203', length: '160' },
  { category: 'JAR', od: 9.5, idSize: 3, weight: '150', length: '30' },
  { category: 'DC', od: 9.5, idSize: 3.75, weight: 203, length: '100' },
  { category: 'DP', od: 5.5, idSize: 4.67, weight: 27.76, length: '3000' }
] };
const fields = { mode: 'independent', l1Min: '65', l1Max: '65', l2Min: '65', l2Max: '65',
  samplesL1: '1', samplesL2: '1', overpull: '165', stroke: '4' };

// Direct inputs are explicit, not obtained from the sweep's result or request.
const directInput = { collarOdIn: 9.5, collarIdIn: 3.75, pipeOdIn: 5.5, pipeIdIn: 4.67,
  freePipeLengthFt: 3000, youngsModulusPsi: 30000000, acousticVelocityFtS: 16000,
  overpullLbf: 165000, strokeIn: 4, lowerCollarLengthFt: 65, upperCollarLengthFt: 65,
  lowerCollarWeightLbf: 203 * 65 };

test('actual BHA geometry and operating units map without altering saved component lengths', () => {
  const before = JSON.stringify(actualBha);
  const geometry = configurationGeometry(actualBha);
  expect(geometry.valid).toBe(true);
  expect(geometry).toMatchObject({ l1Ft: 160, l2Ft: 100, constants: {
    collarOdIn: 9.5, collarIdIn: 3.75, pipeOdIn: 5.5, pipeIdIn: 4.67,
    freePipeLengthFt: 3000, youngsModulusPsi: 30000000, acousticVelocityFtS: 16000
  } });
  expect(geometry.constants.materialWeightDensityLbfIn3).toBeCloseTo(0.282710011026784824, 14);
  const prepared = configurationRequest(geometry, fields);
  expect(prepared.valid).toBe(true);
  expect(prepared.request).toMatchObject({ mode: 'independent', constants: { overpullKlbf: 165, strokeIn: 4 },
    l1: { minFt: 65, maxFt: 65, samples: 1 }, l2: { minFt: 65, maxFt: 65, samples: 1 } });
  const sweep = calcSkeemConfigurationSweep(prepared.request);
  expect(sweep.validCount).toBe(1);
  expect(sweep.samples[0]).toMatchObject({ l1Ft: 65, l2Ft: 65, totalCollarLengthFt: 130 });
  expect(sweep.samples[0].lowerCollarAirWeightLbf).toBeCloseTo(13195, 8);
  expect(sweep.samples[0].upperCollarAirWeightLbf).toBeCloseTo(13195, 8);
  expect(JSON.stringify(actualBha)).toBe(before);
});

test('actual 65/65-ft sweep agrees with direct solver and independent closed-form results', () => {
  const prepared = configurationRequest(configurationGeometry(actualBha), fields);
  const sample = calcSkeemConfigurationSweep(prepared.request).samples[0];
  const direct = calcSkeemPostImpact(directInput);
  expect(direct.valid).toBe(true);
  expect(sample.valid).toBe(true);
  // Independently evaluated with 60-digit Decimal geometric sums and exact
  // force rectangles; derivation and input provenance are in the documentation.
  const comparisons = [
    [sample.impactVelocityFtS, direct.preImpact.hammerVelocityFtS, 10.167687711535529872],
    [sample.impactForceKlbf, direct.impactForceKlbf, 570.383665277619645443],
    [sample.averageStuckPointForceKlbf, direct.averageStuckPointForceKlbf, 1148.429164204538307846],
    [sample.impulseLbfS, direct.impulseLbfS, 9330.986959161873751252],
    [sample.primaryPulseDurationS, direct.primaryPulseDurationS, 0.008125]
  ];
  comparisons.forEach(([swept, solved, expected]) => {
    expect(Math.abs(swept - solved)).toBeLessThan(1e-9);
    expect(Math.abs(solved - expected)).toBeLessThan(1e-9);
  });
  expect(sample.reflectionCount).toBe(6);
  expect(direct.averageStuckPointForceKlbf.toFixed(3)).toBe('1148.429');
});

test('actual-case primary impulse includes the lower-collar air-weight correction', () => {
  const direct = calcSkeemPostImpact(directInput);
  expect(direct.initialStuckPointForceLbf).toBeCloseTo(1114377.330555239291, 8);
  expect(direct.residualStuckPointIncrementLbf).toBeCloseTo(69518.020764851826, 8);
  const impulse = direct.forceHistory.reduce((sum, interval) => {
    expect(interval.weightContributionLbf).toBe(-26390);
    return sum + interval.tensileForceLbf * (interval.relativeEndS - interval.relativeStartS);
  }, 0);
  expect(impulse).toBeCloseTo(9330.986959161874, 8);
  expect(direct.averageStuckPointForceLbf).toBeCloseTo(impulse / direct.primaryPulseDurationS, 8);
});
