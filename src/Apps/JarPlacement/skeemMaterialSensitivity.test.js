import study from '../../../docs/ValidationStudies/SkeemMaterialSensitivityStage5C6B.json';
import baselineReference from '../../../docs/ValidationStudies/Skeem1979IndependentVerificationStage5C6A.json';
import { calcSkeemPostImpact } from '../../engineering/jar/skeemDynamics';
import { samplePrimaryForceHistory } from './primaryForceHistory';

const near = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThan(1e-10 * Math.max(1, Math.abs(expected)));
const cases = Object.entries(study.groups).flatMap(([group, rows]) => rows.map(row => [group, row]));

test('independent sensitivity baseline preserves the Stage 5C.6A fixture', () => {
  expect(study.baseline).toEqual(baselineReference.cases.test4Reference);
});

test.each(cases)('%s: $label agrees with independent Decimal fixtures', (group, row) => {
  const result = calcSkeemPostImpact(row.input), e = row.expected;
  expect(result.valid).toBe(true);
  ['hammerVelocityFtS', 'impactTimeS', 'completedReflections'].forEach(k => near(result.preImpact[k], e[k]));
  ['impactForceLbf', 'initialStuckPointForceLbf', 'averageStuckPointForceLbf', 'impulseLbfS',
    'primaryPulseDurationS', 't1S', 't2S', 't3S', 'residualIncidentForceLbf'].forEach(k => near(result[k], e[k]));
  near(result.forceTimeEvents[1].relativeTimeS, e.residualDelayS);
  const history = samplePrimaryForceHistory(result);
  near(history.peakForceLbf, e.peakForceLbf);
  near(history.numericalImpulseLbfS, e.impulseLbfS);
  expect(result.t1S).toBeLessThan(result.t2S); expect(result.t2S).toBeLessThan(result.t3S);
});

test('acoustic-speed cancellation preserves amplitudes and N; time/impulse scale inversely', () => {
  const base = study.baseline.expected;
  study.groups.acoustic.forEach(({ input, expected: e }) => {
    expect(e.completedReflections).toBe(2);
    ['impactForceLbf', 'initialStuckPointForceLbf', 'peakForceLbf', 'averageStuckPointForceLbf'].forEach(k => near(e[k], base[k]));
    ['impactTimeS', 'residualDelayS', 'primaryPulseDurationS', 't1S', 't2S', 't3S', 'impulseLbfS'].forEach(k => near(e[k] * input.acousticVelocityFtS, base[k] * 16000));
    near(e.hammerVelocityFtS / input.acousticVelocityFtS, base.hammerVelocityFtS / 16000);
  });
});

test('weight changes obey -2 deltaW and -2 deltaW T without altering pre-impact quantities', () => {
  const base = study.baseline.expected;
  study.groups.weight.forEach(({ input, expected: e }) => {
    const delta = input.lowerCollarWeightLbf - 34800;
    ['initialStuckPointForceLbf', 'peakForceLbf', 'averageStuckPointForceLbf'].forEach(k => near(e[k], base[k] - 2 * delta));
    near(e.impulseLbfS, base.impulseLbfS - 2 * delta * .0225);
    ['hammerVelocityFtS', 'impactForceLbf', 'impactTimeS', 'completedReflections', 't1S', 't2S', 't3S'].forEach(k => near(e[k], base[k]));
  });
});

test('coupled experiments hold their specified density fixed, without pretending nominal weight is exact', () => {
  for (const [group, density] of [['modulusCoupledLegacyDensity', study.materialConsistency.waveImpliedWeightDensityLbfFt3],
    ['modulusCoupledNominalDensity', study.materialConsistency.nominalWeightDensityLbfFt3]]) {
    study.groups[group].forEach(row => near(row.waveImpliedWeightDensityLbfFt3, density));
  }
  near(study.materialConsistency.waveImpliedWeightDensityLbfFt3, 542.93625);
  near(study.materialConsistency.nominalWeightImpliedAcousticVelocityFtS, 16824.25058190996);
});

test('diagnostic modulus crossing changes N and peak discontinuously, with continuous impulse limit', () => {
  const [below, above] = study.groups.reflectionBoundaryDiagnostic.map(row => row.expected);
  expect(below.completedReflections).toBe(2); expect(above.completedReflections).toBe(3);
  expect(above.impactForceLbf - below.impactForceLbf).toBeGreaterThan(90000);
  expect(above.peakForceLbf - below.peakForceLbf).toBeGreaterThan(120000);
  expect(Math.abs(above.impulseLbfS - below.impulseLbfS)).toBeLessThan(.002);
  expect(below.residualDelayS).toBeLessThan(1e-8);
  expect(above.primaryPulseDurationS - above.residualDelayS).toBeLessThan(1e-8);
});
