import { calcSurveyAxialLoads } from './calcSurveyAxialLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { buildEngModel } from '../models/buildEngModel';
import { calcStraightDrag } from './calcStraightDrag';

const geometry = (i0 = 0, i1 = i0, length = 1000, a0 = 90, a1 = a0) => calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: i0, azimuthDeg: a0 }, { mdFt: length, inclinationDeg: i1, azimuthDeg: a1 }]);
const row = (length = 200, weight = 200, category = 'DC') => ({ category, toolName: category, length, weight, od: 8 });
const base = overrides => ({ bha: { rows: [row()] }, survey: geometry(), bitMdFt: 1000, wobLbf: 10000, mudWeightPpg: 10, mode: 'slide', frictionCoefficient: 0.25, ...overrides });
const close = (actual, expected, tolerance = 1e-7) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

test('vertical buoyed weight, exact NP and zero normal/friction force independently match reference', () => {
  const r = calcSurveyAxialLoads(base());
  expect(r.valid).toBe(true);
  close(r.buoyancyFactor, 111 / 131);
  close(r.topOfBhaAxialForce, -23893.12977099236);
  close(r.neutralPoints[0].fromBitFt, 59.00900900900901, 1e-8);
  close(r.neutralPoints[0].mdFt, 940.990990990991, 1e-8);
  expect(r.neutralStatus).toBe('crossings-found');
  expect(r.totalNormalContactForceLbf).toBe(0);
  expect(r.totalFrictionForceLbf).toBe(0);
  expect(r.bitAxialForce).toBe(10000);
  expect(r.topMdFt).toBe(800);
});

test('constant inclination reproduces independent gravity, normal weight and downward-drilling friction', () => {
  const r = calcSurveyAxialLoads(base({ bha: { rows: [row(100)] }, survey: geometry(60), wobLbf: 30000 }));
  close(r.elements.reduce((s, e) => s + e.gravityAxialLbf, 0), 8473.282442748092);
  close(r.totalNormalContactForceLbf, 14676.155697721018);
  close(r.totalFrictionForceLbf, 3669.0389244302546);
  close(r.topOfBhaAxialForce, 25195.75648168216);
  expect(r.elements.every(e => e.frictionAxialDownholeLbf <= 0)).toBe(true);
  expect(r.neutralStatus).toBe('none-within-bha');
});

test.each(['slide', 'rotate'])('straight survey agrees with existing %s calculation without changing it', mode => {
  const bha = { rows: [row(100), row(20, 150, 'JAR'), row(100, 80)], mudWeight: 10, wob: 30, inclination: 45, rpm: 40, rop: 200, frictionCoefficient: 0.25 };
  const straight = calcStraightDrag(buildEngModel(bha), mode);
  const survey = calcSurveyAxialLoads(base({ bha, survey: geometry(45), wobLbf: 30000, mode, rpm: 40, ropFtHr: 200 }));
  expect(survey.valid).toBe(true);
  close(survey.topOfBhaAxialForce, straight.topOfBhaAxialForce);
  survey.components.forEach((c, i) => close(c.topAxialForce, straight.components[i].topAxialForce));
  const fraction = mode === 'rotate' ? 200 / Math.hypot(200, Math.PI * 8 * 40 * 5) : 1;
  close(survey.elements[0].axialFrictionFraction, fraction);
});

test('Rotate RPM zero equals Slide; high RPM reduces axial friction', () => {
  const input = base({ survey: geometry(60) });
  const slide = calcSurveyAxialLoads(input);
  close(calcSurveyAxialLoads({ ...input, mode: 'rotate', rpm: 0, ropFtHr: 200 }).topOfBhaAxialForce, slide.topOfBhaAxialForce);
  expect(calcSurveyAxialLoads({ ...input, mode: 'rotate', rpm: 100, ropFtHr: 200 }).totalFrictionForceLbf).toBeLessThan(slide.totalFrictionForceLbf);
});

test('massless curved capstan reference and second-order step convergence', () => {
  const expected = 11398.534413238314;
  const input = base({ bha: { rows: [row(1000, 0)] }, survey: geometry(30, 60), mudWeightPpg: undefined, buoyancyFactor: 1 });
  const runs = [20, 10, 5, 2.5].map(maxStepFt => calcSurveyAxialLoads({ ...input, maxStepFt }));
  const errors = runs.map(r => Math.abs(r.topOfBhaAxialForce - expected));
  close(runs[2].topOfBhaAxialForce, expected, 0.01);
  errors.slice(0, -1).forEach((e, i) => { expect(e / errors[i + 1]).toBeGreaterThan(3.5); expect(e / errors[i + 1]).toBeLessThan(4.5); });
  close(runs[2].totalFrictionForceLbf, runs[2].topOfBhaAxialForce - 10000);
  expect(runs[2].elements.every(e => e.normalGravityForceLbf === 0 && e.normalCurvatureForceLbf > 0)).toBe(true);
});

test('weighted planar build matches independent closed-form solution and converges quadratically', () => {
  const expected = 172491.06040927785;
  const input = base({ bha: { rows: [row(1000, 100)] }, survey: geometry(30, 60), wobLbf: 200000, mudWeightPpg: undefined, buoyancyFactor: 1 });
  const runs = [20, 10, 5, 2.5].map(maxStepFt => calcSurveyAxialLoads({ ...input, maxStepFt }));
  const errors = runs.map(r => Math.abs(r.topOfBhaAxialForce - expected));
  close(runs[2].topOfBhaAxialForce, expected, 0.1);
  errors.slice(0, -1).forEach((e, i) => { expect(e / errors[i + 1]).toBeGreaterThan(3.5); expect(e / errors[i + 1]).toBeLessThan(4.5); });
  expect(runs[2].elements.every(e => e.topAxialForce > 0)).toBe(true);
  runs[2].elements.forEach(e => close(e.normalContactForceLbf, e.normalGravityForceLbf + e.normalCurvatureForceLbf));
});

test('curved frictionless load integrates exact TVD weight; tensile curvature can oppose gravity contact', () => {
  const survey = geometry(30, 60), weight = 100;
  const input = base({ bha: { rows: [row(1000, weight)] }, survey, wobLbf: 0, mudWeightPpg: undefined, buoyancyFactor: 1, frictionCoefficient: 0 });
  const runs = [20, 5, 1].map(maxStepFt => calcSurveyAxialLoads({ ...input, maxStepFt }));
  runs.forEach(r => close(r.topOfBhaAxialForce, -weight * survey.summary.tvdFt));
  expect(runs[1].elements.some(e => e.normalContactForceLbf < e.normalGravityForceLbf && e.normalCurvatureForceLbf > 0)).toBe(true);
  const e = runs[1].elements[10];
  const mean = (e.topAxialForce + e.bottomAxialForce) / 2, kappa = Math.PI / 6000;
  close(e.normalContactForceLbf, Math.abs(weight * Math.sin(e.inclinationDeg * Math.PI / 180) + mean * kappa) * e.lengthFt);
});

test('3D azimuth turn/wrap has correct curvature magnitude and orthogonal weight/curvature contact', () => {
  const r = calcSurveyAxialLoads(base({ bha: { rows: [row(1000, 100)] }, survey: geometry(90, 90, 1000, 350, 10), mudWeightPpg: undefined, buoyancyFactor: 1 }));
  expect(r.valid).toBe(true);
  r.elements.forEach(e => close(e.normalContactForceLbf, Math.hypot(e.normalGravityForceLbf, e.normalCurvatureForceLbf)));
  close(r.elements.reduce((s, e) => s + e.doglegDeg, 0), 20);
});

test('all component and survey boundaries are nodes, and axial force is continuous', () => {
  const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 140, inclinationDeg: 30, azimuthDeg: 90 }, { mdFt: 400, inclinationDeg: 30, azimuthDeg: 90 }]);
  const r = calcSurveyAxialLoads(base({ survey, bitMdFt: 400, bha: { rows: [row(155), row(50, 100, 'JAR'), row(195)] }, maxStepFt: 19 }));
  expect(r.valid).toBe(true);
  [155, 205, 260, 400, 180].forEach(x => expect(r.profile.some(p => p.fromBitFt === x)).toBe(true));
  r.elements.slice(1).forEach((e, i) => expect(e.bottomAxialForce).toBe(r.elements[i].topAxialForce));
  r.components.slice(1).forEach((c, i) => expect(c.bottomAxialForce).toBe(r.components[i].topAxialForce));
  expect(r.elements.every(e => e.lengthFt <= 19 + 1e-10)).toBe(true);
});

test('jar centre load and positive above-NP separation use existing positions; inputs are not mutated', () => {
  const input = base({ bha: { rows: [row(50), row(20, 200, 'JAR'), row(130)] } });
  const original = JSON.stringify(input);
  input.bha.rows.forEach(Object.freeze); Object.freeze(input.bha.rows); Object.freeze(input.bha);
  const r = calcSurveyAxialLoads(input);
  expect(JSON.stringify(input)).toBe(original);
  expect(r.jars[0].centreFromBitFt).toBe(60);
  close(r.jars[0].axialForceLbf, 10000 - 200 * 111 / 131 * 60);
  close(r.jars[0].separationsFromNeutralFt[0], 60 - 59.00900900900901, 1e-8);
  expect(r.warnings.join(' ')).toMatch(/buckling/);
});

test('zero at a shared endpoint is deduplicated; no NP and neutral intervals have explicit statuses', () => {
  const shared = calcSurveyAxialLoads(base({ bha: { rows: [row(100, 100), row(100, 100)] }, mudWeightPpg: undefined, buoyancyFactor: 1 }));
  expect(shared.neutralPoints).toHaveLength(1);
  expect(shared.neutralPoints[0].fromBitFt).toBe(100);
  const none = calcSurveyAxialLoads(base({ wobLbf: 100000, bha: { rows: [row(10, 200, 'JAR')] } }));
  expect(none.neutralStatus).toBe('none-within-bha');
  expect(none.jars[0].separationsFromNeutralFt).toBeNull();
  const neutral = calcSurveyAxialLoads(base({ wobLbf: 0, bha: { rows: [row(20, 0, 'JAR')] } }));
  expect(neutral.neutralStatus).toBe('neutral-interval');
  expect(neutral.neutralIntervals).toEqual([{ startFromBit: 0, endFromBit: 20 }]);
  expect(neutral.neutralPoints).toEqual([]);
  expect(neutral.jars[0].separationsFromNeutralFt).toBeNull();
});

test('finds multiple crossings rather than assuming one NP', () => {
  const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 180, azimuthDeg: 90 }, { mdFt: 100, inclinationDeg: 180, azimuthDeg: 90 }, { mdFt: 200, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 300, inclinationDeg: 0, azimuthDeg: 90 }]);
  // The 180-degree transition is ambiguous: add a horizontal intermediate survey.
  expect(survey.valid).toBe(false);
  const supported = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 180, azimuthDeg: 90 }, { mdFt: 100, inclinationDeg: 180, azimuthDeg: 90 }, { mdFt: 150, inclinationDeg: 90, azimuthDeg: 90 }, { mdFt: 200, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 300, inclinationDeg: 0, azimuthDeg: 90 }]);
  const r = calcSurveyAxialLoads(base({ bha: { rows: [row(300, 100)] }, survey: supported, bitMdFt: 300, wobLbf: 5000, frictionCoefficient: 0, mudWeightPpg: undefined, buoyancyFactor: 1 }));
  expect(r.neutralPoints).toHaveLength(2);
});

test.each([{ bitMdFt: undefined }, { bitMdFt: '' }, { wobLbf: undefined }, { wobLbf: -1 }, { frictionCoefficient: undefined }, { frictionCoefficient: 1.1 }, { mode: 'reference' }, { mudWeightPpg: undefined }, { mudWeightPpg: 70 }, { mudWeightPpg: 0 }, { buoyancyFactor: 1 }, { mudWeightPpg: undefined, buoyancyFactor: 0 }, { mudWeightPpg: undefined, buoyancyFactor: 1.1 }, { maxStepFt: 0 }, { maxStepFt: NaN }, { survey: null }, { bha: { rows: [] } }, { bha: { rows: [row(0)] } }, { bha: { rows: [{ category: 'DC', length: 100 }] } }, { bha: { rows: [{ length: 100, weight: 100 }] } }, { mode: 'rotate' }, { mode: 'rotate', rpm: 40, ropFtHr: 0 }, { mode: 'rotate', rpm: 40, ropFtHr: 100, bha: { rows: [{ ...row(), od: '' }] } }])('rejects missing/invalid inputs: %j', override => {
  const r = calcSurveyAxialLoads(base(override));
  expect(r.valid).toBe(false);
  expect(r.errors[0]).toBeTruthy();
});

test('rejects uncovered BHA and numerical limits, while ignoring completely blank placeholders', () => {
  expect(calcSurveyAxialLoads(base({ bitMdFt: 100 })).status).toBe('outside-survey');
  expect(calcSurveyAxialLoads(base({ bitMdFt: 1001 })).valid).toBe(false);
  expect(calcSurveyAxialLoads(base({ maxStepFt: 1e-6 })).status).toBe('numerical-limit');
  expect(calcSurveyAxialLoads(base({ mode: 'rotate', rpm: 1e308, ropFtHr: 100 })).status).toBe('numerical-limit');
  expect(calcSurveyAxialLoads(base({ bha: { rows: [{}, row()] } })).valid).toBe(true);
  expect(calcSurveyAxialLoads().valid).toBe(false);
  expect(calcSurveyAxialLoads(null).valid).toBe(false);
});
