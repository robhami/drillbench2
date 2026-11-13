import { calculateNonUniformSkeemUp as calc } from './nonUniformSkeemUp';
import { mapRealBhaWaveGeometry } from './realBhaDynamicComparison';
import { relocateComparisonJar } from '../jar/realBhaComparison';
import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import previous from '../../../docs/ValidationStudies/RealBHADynamicStage6E3/study.json';

const sec = (id, lengthM, areaM2 = .002) => ({ id, kind: 'uniform-elastic', lengthM, areaM2, densityKgM3: 8000, youngsModulusPa: 200e9 });
const uniform = () => ({ acknowledged: true, localTensionN: 800, strokeM: .0001, upperSections: [sec('upper', 5), sec('pipe', 1000, .001)], lowerSections: [sec('lower', 20)], preImpactHorizonS: .01, durationS: .006 });
test('100-ms search extends once; a constant 0.01 m/s release closes 1.5 mm at 150 ms', () => {
  const request = { ...uniform(), upperSections: [sec('upper', 1000)], strokeM: .0015, preImpactHorizonS: .1, durationS: .05 };
  const initial = calc(request);
  expect(initial.status).toBe('stroke-closure-unresolved');
  expect(initial.computation.phaseAttempts).toHaveLength(1);
  const retry = calc({ ...request, computationalRetries: true });
  expect(retry.valid).toBe(true);
  expect(retry.impact.impactTimeS).toBeCloseTo(.15, 12);
  expect(retry.computation.strokeSearches.map(s => s.horizonS)).toEqual([.1, .2]);
  expect(retry.computation.strokeTravelAtCutoffM).toBeCloseTo(.001, 12);
  expect(retry.window.endS).toBe(.05);
  const unresolved = calc({ ...request, strokeM: .003, computationalRetries: true });
  expect(unresolved.error).toBe('Stroke closure unresolved within 200 ms');
  expect(unresolved.computation.strokeTravelAtCutoffM).toBeCloseTo(.002, 12);
  expect(unresolved.computation.impactOccurred).toBe(false);
  expect(unresolved.computation.phaseAttempts).toHaveLength(2);
  expect(unresolved.metrics).toBeNull();
});
test('actual characteristic release reproduces the independent uniform Skeem speed, phase, force and impulse', () => {
  const r = calc(uniform()); expect(r.valid).toBe(true);
  expect(r.impact.initialReleaseSpeedMS).toBeCloseTo(.01, 12);
  expect(r.motion.find(p => Math.abs(p.timeS - .002) < 1e-12).velocityMS).toBeCloseTo(-1 / 60, 12);
  expect(r.impact.impactTimeS).toBeCloseTo(171 / 26500, 12);
  expect(r.impact.impactVelocityMS).toBeCloseTo(53 / 2700, 12);
  expect(r.impact.initialImpactForceN).toBeCloseTo(21200 / 27, 8);
  expect(r.metrics.peakTensileN).toBeCloseTo(128800 / 81, 8);
  expect(r.metrics.tensileNs).toBeCloseTo(2504 / 795, 10);
  expect(Math.abs(r.diagnostics.handoffResidualJ)).toBeLessThan(1e-12);
});
test('equal-section subdivision and unrounded/finer delay representation preserve the uniform response', () => {
  const base = calc(uniform());
  const r = calc({ ...uniform(), upperSections: [sec('u1', 2.3), sec('u2', 2.7), sec('pipe', 1000, .001)], lowerSections: [sec('l1', 7.1), sec('l2', 12.9)], delayPrecisionBits: 52 });
  expect(r.valid).toBe(true); expect(r.impact.impactVelocityMS).toBeCloseTo(base.impact.impactVelocityMS, 10);
  expect(r.metrics.peakTensileN).toBeCloseTo(base.metrics.peakTensileN, 7); expect(r.metrics.tensileNs).toBeCloseTo(base.metrics.tensileNs, 9);
});
test.each([-30, 0, 30])('OES %s ft relocation preserves actual HWDP and solves returned-wave stroke motion', move => {
  const inputBha = frozen.workingCopy, copy = JSON.stringify(inputBha), b = relocateComparisonJar(inputBha, 0, move).bha;
  const m = mapRealBhaWaveGeometry({ bha: b, bitMdFt: 9318, jarIndex: 0, settings: previous.settings });
  expect(m.mapping.find(r => r.category === 'HWDP').lengthFt).toBe(274.67);
  expect(m.mapping.reduce((s, r) => s + r.lengthFt, 0)).toBeCloseTo(9318, 8);
  const request = { acknowledged: true, localTensionN: 185000 * 4.4482216152605, strokeM: 7.5 * .0254, upperSections: m.upper, lowerSections: m.lower, preImpactHorizonS: .1, durationS: .05 };
  const r = calc(request), fine = calc({ ...request, delayPrecisionBits: 52 });
  expect(r.valid).toBe(true); expect(fine.valid).toBe(true); expect(r.maintainedEngagement.admissible).toBe(true);
  expect(r.impact.impactVelocityMS).not.toBeCloseTo(r.impact.initialReleaseSpeedMS, 2);
  const firstReturn = 2 * m.upper[0].lengthM / Math.sqrt(m.upper[0].youngsModulusPa / m.upper[0].densityKgM3);
  expect(r.motion.some(p => Math.abs(p.timeS - firstReturn) < 1e-12)).toBe(true);
  const hwdpReturn = 2 * m.upper.slice(0, 2).reduce((s, p) => s + p.lengthM / Math.sqrt(p.youngsModulusPa / p.densityKgM3), 0);
  expect(r.motion.some(p => Math.abs(p.timeS - hwdpReturn) < 1e-12)).toBe(true);
  const onset = r.stuckHistory.find(p => Math.abs(p.forceN) > 1e-6);
  expect(onset.timeS).toBeCloseTo(m.firstArrivalS, 10);
  for (const key of ['peakTensileN', 'tensileNs']) expect(Math.abs(r.metrics[key] - fine.metrics[key])).toBeLessThan((key === 'tensileNs' ? 1e-5 : .01) + .001 * Math.abs(r.metrics[key]));
  expect(Math.abs(r.diagnostics.handoffResidualJ)).toBeLessThanOrEqual(r.diagnostics.energyLimitJ);
  expect(JSON.stringify(inputBha)).toBe(copy);
});
test('missing acknowledgement, unequal engagement impedances and unfinished strokes return no metrics', () => {
  for (const patch of [{ acknowledged: false }, { lowerSections: [sec('different', 20, .001)] }, { lowerSections: [sec('bad', -1), sec('good', 21)] }, { strokeM: 1, preImpactHorizonS: .001 }]) {
    const r = calc({ ...uniform(), ...patch }); expect(r.valid).toBe(false); expect(r.metrics).toBeNull();
  }
});
test('a return demanding an inadmissible Jar Up reaction suppresses all reported force/impulse metrics', () => {
  const r = calc({ ...uniform(), lowerSections: [sec('near', .1), sec('weak', 10, .000001)] });
  expect(r.valid).toBe(false); expect(r.status).toBe('inadmissible-maintained-engagement');
  expect(r.maintainedEngagement.admissible).toBe(false); expect(r.maintainedEngagement.compressionN).toBeGreaterThan(0);
  expect(r.metrics).toBeNull();
});
