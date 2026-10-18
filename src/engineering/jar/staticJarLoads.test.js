import fs from 'fs';
import path from 'path';
import { calcStaticJarLoads } from './staticJarLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { parseSurveyCsv } from '../survey/surveyImport';

const row = (category, length, weight) => ({ category, toolName: category, length, weight, od: 6.75 });
const geometry = (inclination = 0, end = 20000) => calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: inclination, azimuthDeg: 90 }, { mdFt: end, inclinationDeg: inclination, azimuthDeg: 90 }]);
const bha = { rows: [row('JAR', 20, 100), row('DC', 990, 100)] };
const base = extra => ({ bha, survey: geometry(), bitMdFt: 1010, direction: 'pickup', frictionCoefficient: 0.25, buoyancyFactor: 1, surfaceHookloadLbf: 120000, ...extra });
const close = (actual, expected, tolerance = 1e-6) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

test('absolute vertical load is independent of any reference and has zero friction', () => {
  for (const direction of ['pickup', 'slackoff']) for (const mu of [0, 0.25, 1]) {
    const r = calcStaticJarLoads(base({ direction, frictionCoefficient: mu, referenceHookloadLbf: '', appliedLoadLbf: '' }));
    expect(r.valid).toBe(true);
    close(r.jarAxialLoadLbf, -20000);
    close(r.gravityAxialLbf, 100000); close(r.frictionResistanceLbf, 0);
    expect(r.referenceJarAxialLoadLbf).toBeNull();
    expect(r.incrementalTransferredLoadLbf).toBeNull();
    expect(r.jarLoadState).toBe('tension');
    expect(r.jarMdFt).toBe(1000);
    expect(r.profile[0]).toEqual({ mdFt: 0, axialForceLbf: -120000 });
  }
});

test.each(['pickup', 'slackoff'])('reference vertical %s produces independently calculated signed transfer', direction => {
  const r = calcStaticJarLoads(base({ direction, loadMode: 'reference', referenceHookloadLbf: 100000, appliedLoadLbf: 20000 }));
  expect(r.valid).toBe(true);
  close(r.referenceJarAxialLoadLbf, 0);
  close(r.surfaceHookloadLbf, direction === 'pickup' ? 120000 : 80000);
  close(r.jarAxialLoadLbf, direction === 'pickup' ? -20000 : 20000);
  close(r.incrementalTransferredLoadLbf, 20000);
  expect(r.jarLoadState).toBe(direction === 'pickup' ? 'tension' : 'compression');
  expect(r.warnings.join(' ')).toContain('assumed frictionless baseline');
});

test.each(['pickup', 'slackoff'])('straight 60-degree %s balances weight and signed Coulomb friction', direction => {
  const r = calcStaticJarLoads(base({ survey: geometry(60), direction, loadMode: 'reference', referenceHookloadLbf: 50000, appliedLoadLbf: 30000 }));
  const drag = 0.25 * 100000 * Math.sqrt(3) / 2, transferred = 30000 - drag;
  expect(r.valid).toBe(true);
  close(r.gravityAxialLbf, 50000); close(r.frictionResistanceLbf, drag);
  close(r.jarAxialLoadLbf, direction === 'pickup' ? -transferred : transferred);
  close(r.incrementalTransferredLoadLbf, transferred);
  close(r.equilibriumResidualLbf, 0);
  expect(r.convergence.required).toBe(false);
  expect(r.elements.every(e => Math.sign(e.signedDownholeFrictionLbf) === (direction === 'pickup' ? 1 : -1))).toBe(true);
});

test('direction reversal at identical hookload changes force by minus twice straight drag; zero friction branches coincide', () => {
  for (const mu of [0, 0.25]) {
    const input = base({ survey: geometry(60), surfaceHookloadLbf: 50000, frictionCoefficient: mu });
    const up = calcStaticJarLoads(input), down = calcStaticJarLoads({ ...input, direction: 'slackoff' });
    close(down.jarAxialLoadLbf - up.jarAxialLoadLbf, -2 * mu * 100000 * Math.sqrt(3) / 2);
  }
});

test('zero applied load does not silently erase mobilised friction or negative transferred increments', () => {
  for (const direction of ['pickup', 'slackoff']) {
    const r = calcStaticJarLoads(base({ survey: geometry(60), direction, loadMode: 'reference', referenceHookloadLbf: 50000, appliedLoadLbf: 0 }));
    close(r.incrementalTransferredLoadLbf, -21650.635094610966);
    expect(r.surfaceHookloadLbf).toBe(50000);
  }
});

test('mud buoyancy, jar half-weight, selected jar and exact component force continuity use existing positions', () => {
  const assembly = { rows: [row('JAR', 20, 100), row('DC', 50, 100), row('JAR', 20, 200), row('DC', 910, 100)] };
  const bf = 1 - 10 / 65.5;
  for (const [jarIndex, expectedWeight, jarMd] of [[0, 101000, 990], [1, 93000, 920]]) {
    const r = calcStaticJarLoads(base({ bha: assembly, bitMdFt: 1000, jarIndex, buoyancyFactor: undefined, mudWeightPpg: 10 }));
    expect(r.valid).toBe(true); close(r.gravityAxialLbf, expectedWeight * bf);
    close(r.jarAxialLoadLbf, -120000 + expectedWeight * bf);
    expect(r.jarMdFt).toBe(jarMd);
    r.elements.slice(1).forEach((e, i) => {
      expect(e.topAxialForceLbf).toBe(r.elements[i].bottomAxialForceLbf);
      expect(e.topMdFt).toBe(r.elements[i].bottomMdFt);
    });
  }
});

const arcSurvey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 30, azimuthDeg: 90 }, { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 90 }, { mdFt: 1010, inclinationDeg: 60, azimuthDeg: 90 }]);
test.each(['pickup', 'slackoff'])('weighted curved %s agrees with independent closed form and step convergence', direction => {
  // In this planar build w*sin(I)+C*k remains positive throughout.
  // Solve C' - d*mu*k*C = w*cos(I)+d*mu*w*sin(I) analytically.
  const d = direction === 'pickup' ? 1 : -1, mu = 0.25, k = Math.PI / 6000;
  const particular = i => 100 / (k * (1 + mu * mu)) * (-2 * d * mu * Math.cos(i) + (1 - mu * mu) * Math.sin(i));
  const expected = particular(Math.PI / 3) + (-10000 - particular(Math.PI / 6)) * Math.exp(d * mu * k * 1000);
  const input = base({ survey: arcSurvey, surfaceHookloadLbf: 10000, direction });
  const r = calcStaticJarLoads(input);
  expect(r.valid).toBe(true); expect(r.convergence.checked).toBe(true);
  expect(r.convergence.differenceLbf).toBeLessThanOrEqual(0.1);
  close(r.jarAxialLoadLbf, expected, 0.1);
  const errors = [20, 10].map(maxStepFt => {
    const coarse = calcStaticJarLoads({ ...input, maxStepFt, convergenceToleranceLbf: 100 });
    return Math.abs(coarse.jarAxialLoadLbf - expected);
  });
  expect(errors[0] / errors[1]).toBeGreaterThan(3.5);
  expect(errors[0] / errors[1]).toBeLessThan(4.5);
});

test.each(['pickup', 'slackoff'])('massless curved %s tension follows the independent capstan limit', direction => {
  const massless = { rows: bha.rows.map(r => ({ ...r, weight: 0 })) };
  const d = direction === 'pickup' ? -1 : 1;
  const r = calcStaticJarLoads(base({ bha: massless, survey: arcSurvey, direction, surfaceHookloadLbf: 100000 }));
  expect(r.valid).toBe(true);
  close(r.jarAxialLoadLbf, -100000 * Math.exp(d * 0.25 * Math.PI / 6), 0.1);
  expect(r.frictionResistanceLbf).toBeGreaterThan(0);
});

const test4 = { rows: [row('STAB', 5, 111.25), row('DC', 300, 116), row('JAR', 30, 150), row('DC', 180, 116), row('DP', 11485, 27.76)] };
test.each([4000, 5000, 7000, 12000])('actual DP deployment at MD %s changes absolute loads and leaves reference increments consistent', bitMdFt => {
  const original = JSON.stringify(test4), bf = 1 - 10 / 65.5;
  const dp = bitMdFt - 515, expectedG = bf * (15 * 150 + 180 * 116 + dp * 27.76);
  const input = base({ bha: test4, bitMdFt, buoyancyFactor: undefined, mudWeightPpg: 10 });
  const absolute = calcStaticJarLoads(input);
  expect(absolute.valid).toBe(true);
  expect(absolute.deployment.deployedDpLengthFt).toBe(dp);
  expect(absolute.jarMdFt).toBe(bitMdFt - 320);
  close(absolute.gravityAxialLbf, expectedG);
  close(absolute.jarAxialLoadLbf, -120000 + expectedG);
  const reference = calcStaticJarLoads({ ...input, loadMode: 'reference', referenceHookloadLbf: expectedG + 5000, appliedLoadLbf: 20000 });
  close(reference.referenceJarAxialLoadLbf, -5000);
  close(reference.jarAxialLoadLbf, -25000);
  close(reference.incrementalTransferredLoadLbf, 20000);
  expect(JSON.stringify(test4)).toBe(original);
});

test.each(['pickup', 'slackoff'])('Test 4 directional survey %s preserves global equilibrium, data and continuity', direction => {
  const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  const survey = calculateSurveyGeometry(parseSurveyCsv(csv, { mdUnit: 'ft', angleUnit: 'deg' }).stations);
  const input = base({ bha: test4, survey, bitMdFt: 12000, direction, surfaceHookloadLbf: 200000, buoyancyFactor: undefined, mudWeightPpg: 10 });
  const original = JSON.stringify(input);
  const r = calcStaticJarLoads(input);
  expect(r.valid).toBe(true); expect(r.convergence.checked).toBe(true);
  close(r.equilibriumResidualLbf, 0, 0.001);
  close(r.jarAxialLoadLbf, -200000 + r.gravityAxialLbf + (direction === 'pickup' ? 1 : -1) * r.frictionResistanceLbf, 0.001);
  r.elements.slice(1).forEach((e, i) => expect(e.topAxialForceLbf).toBe(r.elements[i].bottomAxialForceLbf));
  expect(JSON.stringify(input)).toBe(original);
});

test.each([{ surfaceHookloadLbf: '' }, { surfaceHookloadLbf: -1 }, { bitMdFt: '' }, { direction: 'rotate' }, { frictionCoefficient: 2 },
  { mudWeightPpg: 10 }, { buoyancyFactor: 0 }, { buoyancyFactor: '' }, { jarIndex: 2 }, { jarIndex: 0.5 }, { maxStepFt: 0 },
  { maxStepFt: 1e-8 }, { convergenceToleranceLbf: '' }, { maxRefinements: 0 }, { survey: null }, { bitMdFt: 1200 },
  { bha: { rows: [row('JAR', 20, '')] } }, { surfaceMdFt: '' }, { loadMode: 'other' },
  { loadMode: 'reference', referenceHookloadLbf: '', appliedLoadLbf: 0 },
  { loadMode: 'reference', referenceHookloadLbf: 10, appliedLoadLbf: 20, direction: 'slackoff' }])('invalid static inputs are unavailable: %j', extra => {
  const r = calcStaticJarLoads(base(extra));
  expect(r.valid).toBe(false); expect(r.errors[0]).toBeTruthy(); expect(r).not.toHaveProperty('jarAxialLoadLbf');
});

test('incomplete full-string survey coverage and unresolved convergence return no loads', () => {
  const truncated = calculateSurveyGeometry([{ mdFt: 100, inclinationDeg: 0, azimuthDeg: 0 }, { mdFt: 1010, inclinationDeg: 0, azimuthDeg: 0 }]);
  expect(calcStaticJarLoads(base({ survey: truncated })).status).toBe('outside-survey');
  expect(calcStaticJarLoads(base({ survey: geometry(0, 1005) })).status).toBe('outside-survey');
  expect(calcStaticJarLoads(base({ survey: arcSurvey, convergenceToleranceLbf: 1e-15, maxRefinements: 1 })).status).toBe('unresolved-convergence');
  expect(calcStaticJarLoads(null).valid).toBe(false);
});
