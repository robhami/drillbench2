import { solveStaticJarHookload } from './inverseStaticJarLoads';
import { calcStaticJarLoads } from './staticJarLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';

const row = (category, length, weight) => ({ category, length, weight, od: 6.75 });
const bha = { rows: [row('JAR', 20, 100), row('DC', 990, 100)] };
const geometry = inclination => calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: inclination, azimuthDeg: 90 }, { mdFt: 20000, inclinationDeg: inclination, azimuthDeg: 90 }]);
const base = extra => ({ bha, survey: geometry(0), bitMdFt: 1010, frictionCoefficient: 0.25, buoyancyFactor: 1, jarDirection: 'up', desiredJarForceLbf: 20000, ...extra });
const close = (a, b, tolerance = 0.01) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);

test.each(['up', 'down'])('vertical %s matches independent hookload arithmetic and verifies through forward solver', jarDirection => {
  const r = solveStaticJarHookload(base({ jarDirection }));
  expect(r.valid).toBe(true);
  close(r.requiredSurfaceHookloadLbf, jarDirection === 'up' ? 120000 : 80000);
  close(r.jarAxialLoadLbf, jarDirection === 'up' ? -20000 : 20000);
  close(r.residualLbf, 0);
  expect(r.forwardResult.surfaceHookloadLbf).toBe(r.requiredSurfaceHookloadLbf);
  expect(r.forwardResult.loadMode).toBe('absolute');
  expect(r.forwardResult.direction).toBe(jarDirection === 'up' ? 'pickup' : 'slackoff');
});

test.each(['up', 'down'])('straight 60-degree %s agrees with independent signed gravity/friction solution', jarDirection => {
  const r = solveStaticJarHookload(base({ survey: geometry(60), jarDirection, rotatingHookloadLbf: 50500 }));
  const drag = 25000 * Math.sin(Math.PI / 3);
  expect(r.valid).toBe(true);
  const expected = jarDirection === 'up' ? 50000 + drag + 20000 : 50000 - drag - 20000;
  close(r.requiredSurfaceHookloadLbf, expected);
  close(r.differenceFromRotatingLbf, expected - 50500);
  expect(r.jarLoadState).toBe(jarDirection === 'up' ? 'tension' : 'compression');
});

test.each(['up', 'down'])('curved load-dependent contact %s round trips a known forward boundary without mutating inputs', jarDirection => {
  const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 30, azimuthDeg: 90 }, { mdFt: 1010, inclinationDeg: 60, azimuthDeg: 90 }]);
  const direction = jarDirection === 'up' ? 'pickup' : 'slackoff', hookload = jarDirection === 'up' ? 100000 : 10000;
  const input = base({ survey, jarDirection });
  const known = calcStaticJarLoads({ ...input, direction, surfaceHookloadLbf: hookload });
  expect(known.valid).toBe(true);
  expect(Math.sign(known.jarAxialLoadLbf)).toBe(jarDirection === 'up' ? -1 : 1);
  const original = JSON.stringify(input);
  const r = solveStaticJarHookload({ ...input, desiredJarForceLbf: Math.abs(known.jarAxialLoadLbf) });
  expect(r.valid).toBe(true);
  close(r.requiredSurfaceHookloadLbf, hookload, 0.03);
  close(r.jarAxialLoadLbf, known.jarAxialLoadLbf);
  expect(r.forwardResult.convergence.checked).toBe(true);
  expect(JSON.stringify(input)).toBe(original);
});

test.each([1000, 2000])('inverse at depth %s uses actual DP deployment, jar half length and optional rotating reference', bitMdFt => {
  const input = base({ bha: { rows: [row('JAR', 20, 100), row('DC', 80, 100), row('DP', 15000, 20)] }, bitMdFt });
  const r = solveStaticJarHookload(input);
  expect(r.valid).toBe(true);
  close(r.requiredSurfaceHookloadLbf, 9000 + (bitMdFt - 100) * 20 + 20000);
  expect(r.forwardResult.deployment.deployedDpLengthFt).toBe(bitMdFt - 100);
  expect(r.differenceFromRotatingLbf).toBeNull();
});

test('compression needing downward surface push and absent search bracket return no invented hookload', () => {
  const unreachable = solveStaticJarHookload(base({ jarDirection: 'down', desiredJarForceLbf: 100001 }));
  expect(unreachable.valid).toBe(false); expect(unreachable.status).toBe('unreachable-target');
  expect(unreachable.errors.join(' ')).toContain('downward surface push');
  const bounded = solveStaticJarHookload(base({ maxHookloadLbf: 10000 }));
  expect(bounded.valid).toBe(false); expect(bounded.status).toBe('unbracketed-target');
  expect(bounded).not.toHaveProperty('requiredSurfaceHookloadLbf');
  const zero = solveStaticJarHookload(base({ jarDirection: 'down', desiredJarForceLbf: 100000 }));
  expect(zero.valid).toBe(true); expect(zero.requiredSurfaceHookloadLbf).toBe(0);
});

test.each([{ desiredJarForceLbf: '' }, { desiredJarForceLbf: 0 }, { desiredJarForceLbf: -1 }, { desiredJarForceLbf: Infinity },
  { jarDirection: 'rotate' }, { maxHookloadLbf: 0 }, { maxIterations: 0 }, { residualToleranceLbf: 0 },
  { bitMdFt: '' }, { survey: null }, { jarIndex: 9 }, { frictionCoefficient: '' }])('invalid target or forward inputs fail explicitly: %j', extra => {
  const r = solveStaticJarHookload(base(extra));
  expect(r.valid).toBe(false); expect(r.errors.length).toBeGreaterThan(0);
  expect(r).not.toHaveProperty('requiredSurfaceHookloadLbf');
});

test('nonconvergent inverse and forward integration are rejected', () => {
  const r = solveStaticJarHookload(base({ desiredJarForceLbf: 21234, maxIterations: 1, residualToleranceLbf: 1e-9 }));
  expect(r.valid).toBe(false); expect(r.status).toBe('unresolved-convergence');
  const arc = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 1010, inclinationDeg: 60, azimuthDeg: 90 }]);
  const failed = solveStaticJarHookload(base({ survey: arc, maxRefinements: 1, convergenceToleranceLbf: 1e-15 }));
  expect(failed.valid).toBe(false); expect(failed.status).toBe('forward-failure');
  expect(solveStaticJarHookload(null).valid).toBe(false);
});

test('small positive magnitudes preserve the requested force sign despite absolute residual tolerance', () => {
  for (const jarDirection of ['up', 'down']) {
    const r = solveStaticJarHookload(base({ jarDirection, desiredJarForceLbf: 0.000001 }));
    expect(r.valid).toBe(true);
    expect(Math.sign(r.jarAxialLoadLbf)).toBe(jarDirection === 'up' ? -1 : 1);
    expect(Math.abs(r.residualLbf)).toBeLessThanOrEqual(0.01);
  }
});
