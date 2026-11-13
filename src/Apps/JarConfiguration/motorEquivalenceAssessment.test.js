import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import assessment from '../../../docs/ValidationStudies/MotorEquivalentCollarResearch.independent.json';
import reference from '../../../docs/ValidationStudies/Skeem1979IndependentVerificationStage5C6A.json';
import { configurationGeometry } from './configurationData';
import { calculateJarPerformance } from '../JarPlacement/skeemPerformance';
import { calcSkeemPostImpact } from '../../engineering/jar/skeemDynamics';
import { calculatePositionMatrix, matrixDefaults } from '../../engineering/jar/jarPositionMatrix';
import { staticJarPositionGeometry } from '../../engineering/jar/staticJarPosition';

// Assessment artifacts do not opt the production solver into a new domain.
test('retained motor stays static-eligible and dynamically blocked without mutation', () => {
  const before = JSON.stringify(live.bha);
  expect(staticJarPositionGeometry(live.bha).valid).toBe(true);
  const geometry = configurationGeometry(live.bha);
  expect(geometry.valid).toBe(false);
  const result = calculatePositionMatrix({ geometry, fields: matrixDefaults(geometry) });
  expect(result.valid).toBe(false);
  expect(result.samples).toBeUndefined();
  expect(result.maxima).toBeUndefined();
  expect(calculateJarPerformance(live.bha, { strokeIn: 4, overpullKlbf: 165, stuckPointFt: 0 }).valid).toBe(false);
  expect(JSON.stringify(live.bha)).toBe(before);
  expect(assessment.motor).toEqual(live.bha.rows[0]);
  expect(assessment.motorAirWeightLbf).toBeCloseTo(3085.6, 8);
});

test('motor removal restores the existing geometry, reinsertion blocks it again', () => {
  const collarOnly = { ...live.bha, rows: live.bha.rows.slice(1) };
  expect(configurationGeometry(collarOnly).valid).toBe(true);
  expect(configurationGeometry({ ...collarOnly, rows: [live.bha.rows[0], ...collarOnly.rows] }).valid).toBe(false);
});

test('original collar-only calculation still matches the independent reference', () => {
  const { input, expected } = reference.cases.test4Reference;
  const result = calcSkeemPostImpact(input);
  expect(result.valid).toBe(true);
  expect(Math.abs(result.impactForceLbf - expected.impactForceLbf)).toBeLessThan(1e-8);
  expect(Math.abs(result.impulseLbfS - expected.impulseLbfS)).toBeLessThan(1e-8);
});

test('independent mechanical sensitivity contains no unsupported impact or ranking predictions', () => {
  expect(assessment.provenance.liveWorkspaceCaptured).toBe(false);
  expect(assessment.sensitivities).toHaveLength(32);
  expect(assessment.checks.every(c => c.pass)).toBe(true);
  expect(assessment.maxScaledRk4Error).toBeLessThan(1e-8);
  assessment.sensitivities.forEach(s => {
    expect(s.impactForceKlbf).toBeNull(); expect(s.impulseLbfS).toBeNull(); expect(s.placementRank).toBeNull();
    expect(s.jarCentreAboveBitFt).toBeCloseTo(31.16798 + s.lowerDcFt + 16.5, 8);
    const zm = s.assumedMotorImpedanceLbfSPerFt, zc = assessment.collarRigidityLbf / 16000;
    expect(s.forceReflectionCoefficient ** 2 + zc / zm * s.firstPassForceTransmission ** 2).toBeCloseTo(1, 12);
    s.harmonicDiagnostics.forEach(h => expect(h.scaledRk4Error).toBeLessThan(1e-8));
  });
  expect(assessment.impedanceMatchRigidityRatio).not.toBeCloseTo(assessment.speedMatchRigidityRatio, 2);
  expect(assessment.sameMassStiffnessCounterexamples.some(c =>
    Math.abs(c.uniformMatrix[0][0] - c.unevenMassMatrix[0][0]) > .01)).toBe(true);
});
