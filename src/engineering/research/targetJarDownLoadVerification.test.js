import fixture from '../../../docs/ValidationStudies/JarDownUsabilityAndLoadVerificationStage5C12C.independent.json';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { solveStaticJarHookload } from '../jar/inverseStaticJarLoads';
import { calcStaticJarLoads } from '../jar/staticJarLoads';
const stations = fixture.survey.originalCsv.replace(/\\n/g, '\n').trim().split('\n').slice(1).map(line => {
  const [mdFt, inclinationDeg, azimuthDeg] = line.split(',').map(Number); return { mdFt, inclinationDeg, azimuthDeg };
});
const input = { bha: fixture.bha, survey: calculateSurveyGeometry(stations), bitMdFt: fixture.bitMdFt, surfaceMdFt: fixture.surfaceMdFt,
  mudWeightPpg: fixture.mudWeightPpg, frictionCoefficient: fixture.frictionCoefficient, jarIndex: 0 };
test('Test 4 100-klbf target agrees with independent reverse RK4 and authoritative forward branch', () => {
  const r = solveStaticJarHookload({ ...input, jarDirection: 'down', desiredJarForceLbf: 100000 });
  expect(r.valid).toBe(true);
  console.log('Stage 5C.12C Test 4 cross-check', { independent: fixture.requiredSurfaceHookloadLbf, inverse: r.requiredSurfaceHookloadLbf, verifiedJar: r.jarAxialLoadLbf });
  expect(Math.abs(r.requiredSurfaceHookloadLbf - fixture.requiredSurfaceHookloadLbf)).toBeLessThan(.1);
  const f = calcStaticJarLoads({ ...input, direction: 'slackoff', surfaceHookloadLbf: r.requiredSurfaceHookloadLbf });
  expect(f.valid).toBe(true); expect(Math.abs(f.jarAxialLoadLbf-100000)).toBeLessThanOrEqual(.01);
  const independentBoundary = calcStaticJarLoads({ ...input, direction: 'slackoff', surfaceHookloadLbf: fixture.requiredSurfaceHookloadLbf });
  expect(independentBoundary.valid).toBe(true); expect(Math.abs(independentBoundary.jarAxialLoadLbf-100000)).toBeLessThanOrEqual(.01);
  console.log('Independent boundary forward check', independentBoundary.jarAxialLoadLbf);
});
test('Jar Up overpull and drilling WOB are not inputs to the static target result', () => {
  const a = solveStaticJarHookload({ ...input, jarDirection: 'down', desiredJarForceLbf: 100000 });
  const b = solveStaticJarHookload({ ...input, bha: { ...fixture.bha, wob: 999, jarImpactInputs: { up: { overpullKlbf: '999' } } }, jarDirection: 'down', desiredJarForceLbf: 100000 });
  expect(a.requiredSurfaceHookloadLbf).toBe(b.requiredSurfaceHookloadLbf);
});
