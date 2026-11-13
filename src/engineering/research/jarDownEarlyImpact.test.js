import { deriveEarlyJarDown, earlyJarDownMotionAt } from './jarDownEarlyImpact';
import reference from '../../../docs/ValidationStudies/SkeemJarDownDerivationStage5C8.json';

// Expected values come from the separate Python Decimal characteristic solver.
const close = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThan(1e-10 * Math.max(1, Math.abs(expected)));
const base = reference.cases.equalRodsZeroGravity.input;
const copy = () => JSON.parse(JSON.stringify(base));

describe.each(Object.entries(reference.cases))('%s independent characteristic comparison', (name, fixture) => {
  const result = deriveEarlyJarDown(fixture.input);
  test('scalar predictions and primary event ordering', () => {
    expect(result.valid).toBe(true);
    expect(result.productionAvailable).toBe(false);
    Object.entries(fixture.expected).forEach(([key, expected]) => close(result[key], expected));
    expect(result.firstImpactArrivalS).toBeLessThan(result.releaseReflectionArrivalS);
    expect(result.releaseReflectionArrivalS).toBeLessThan(result.impactReliefArrivalS);
  });
  test('motion and signed reaction agree between every event', () => {
    result.motionIntervals.forEach(i => {
      const time = (i.startS + i.endS) / 2;
      const expected = fixture.motion.filter(row => row.timeS <= time).pop();
      const motion = earlyJarDownMotionAt(result, time);
      ['hammer', 'anvil'].forEach(part => {
        close(motion[`${part}VelocityFtS`], expected[`${part}VelocityFtS`]);
        close(motion[`${part}DisplacementFt`], expected[`${part}DisplacementFt`] + expected[`${part}VelocityFtS`] * (time - expected.timeS));
      });
      close(motion.contactForceLbf, expected.contactForceLbf);
    });
    result.reactionIntervals.forEach(i => {
      const expected = fixture.reactionHistory.filter(row => row.timeS <= (i.startS + i.endS) / 2).pop();
      close(i.totalCompressionLbf, expected.totalCompressionLbf);
    });
    expect(earlyJarDownMotionAt(result, result.motionHorizonS).valid).toBe(false);
  });
  test('event-aligned integration converges without smoothing steps', () => {
    [1, 2, 8, 32, 128, 1024].forEach(count => {
      let integral = 0;
      result.primaryIntervals.forEach(i => {
        const dt = (i.endS - i.startS) / count;
        for (let k = 0; k < count; k++) integral += i.totalCompressionLbf * dt;
      });
      close(integral, fixture.expected.primaryTotalImpulseLbfS);
    });
  });
  test('independent full-field energy and momentum balances', () => {
    fixture.audits.forEach(a => {
      close(a.kineticEnergyFtLbf + a.elasticEnergyChangeFtLbf + a.gravityEnergyChangeFtLbf, 0);
      close(a.momentumSlugFtS, a.supportImpulseLbfS);
      close(a.energyResidualFtLbf, 0);
      close(a.momentumResidualLbfS, 0);
      if (a.timeS > fixture.expected.impactTimeS) close(a.waveEnergyFtLbf, fixture.input.compressionLbf * fixture.input.strokeIn / 12);
    });
  });
});

test('three impulse definitions remain distinct; released reaction can be tension', () => {
  const r = deriveEarlyJarDown(base);
  close(r.primaryTotalImpulseLbfS, 16);
  close(r.impactResponseImpulseLbfS, 26);
  close(r.excessOverPreReleaseImpulseLbfS, 6);
  close(r.releasedNoImpactStuckCompressionLbf, -1000);
});

test.each([
  ['zero compression', p => { p.compressionLbf = 0; }],
  ['zero stroke', p => { p.strokeIn = 0; }],
  ['negative gravity', p => { p.gravityFtS2 = -1; }],
  ['invalid density', p => { p.lower.densitySlugFt3 = 0; }],
  ['nonfinite modulus', p => { p.upper.youngsModulusPsi = Infinity; }],
  ['equal impedance', p => { p.pipe.areaIn2 = 1; }],
  ['reversed impedance', p => { p.pipe.areaIn2 = 2; }],
  ['coincident return', p => { p.strokeIn = 0.24; }],
  ['late impact', p => { p.strokeIn = 7; }],
  ['lower return interference', p => { p.lower.lengthFt = 100; }],
  ['surface return interference', p => { p.pipe.lengthFt = 10; }],
  ['unidentified model', p => { delete p.model; }],
  ...['survey', 'frictionCoefficient', 'lowerCollarWeightLbf', 'pumpOpenForceLbf'].map(key => [key, p => { p[key] = 0; }])
])('suppresses unsupported case: %s', (name, mutate) => {
  const p = copy(); mutate(p);
  const r = deriveEarlyJarDown(p);
  expect(r.valid).toBe(false);
  expect(r.productionAvailable).toBe(false);
  expect(r.primaryTotalImpulseLbfS).toBeUndefined();
  expect(r.motionIntervals).toBeUndefined();
});
