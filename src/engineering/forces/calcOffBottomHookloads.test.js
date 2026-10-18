import fs from 'fs';
import path from 'path';
import { calcOffBottomHookloads, calcOffBottomRotatingSummary } from './calcOffBottomHookloads';
import { calcStringWeightSummary } from '../bha/calcStringWeightSummary';
import { deployDrillstring } from '../bha/deployDrillstring';
import { calcSurveyAxialLoads } from './calcSurveyAxialLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { parseSurveyCsv } from '../survey/surveyImport';

const row = (category, length, weight, od = 6.75) => ({ category, length, weight, od });
const bha = { rows: [row('JAR', 20, 100), row('DC', 980, 100)] };
const geometry = inclination => calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: inclination, azimuthDeg: 90 }, { mdFt: 20000, inclinationDeg: inclination, azimuthDeg: 90 }]);
const base = extra => ({ bha, survey: geometry(60), bitMdFt: 1000, mudWeightPpg: 10, frictionCoefficient: 0.25, rpm: 150, ropFtHr: 60, ...extra });
const bf = 1 - 10 / 65.5;
const close = (actual, expected, tolerance = 1e-6) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

test('existing weight/inclination results are unchanged; absolute/reference surface loads and WOB are not prediction boundaries', () => {
  const input = base();
  const r = calcOffBottomHookloads(input);
  expect(r.weights).toEqual(calcStringWeightSummary(input));
  const changed = calcOffBottomHookloads({ ...input, surfaceHookloadLbf: 999999, referenceHookloadLbf: 888888, appliedLoadLbf: 77777, wobLbf: 35000 });
  expect(changed).toEqual(r);
  expect(r.assumptions.bitAxialLoadLbf).toBe(0);
});

test.each([0, 30, 60])('straight %s-degree hookloads and drag agree with independent weighted formulas', inclination => {
  const r = calcOffBottomHookloads(base({ survey: geometry(inclination) }));
  const angle = inclination * Math.PI / 180, gravity = 100000 * bf * Math.cos(angle), drag = 0.25 * 100000 * bf * Math.sin(angle);
  const fraction = 60 / Math.hypot(60, Math.PI * 6.75 * 150 * 5);
  expect(r.pickupHookload.valid && r.slackOffHookload.valid && r.rotatingHookload.valid).toBe(true);
  close(r.weights.frictionlessHookloadLbf, gravity);
  close(r.pickupHookload.valueLbf, gravity + drag);
  close(r.slackOffHookload.valueLbf, gravity - drag);
  close(r.pickupDrag.valueLbf, drag); close(r.slackOffDrag.valueLbf, drag);
  close(r.rotatingHookload.valueLbf, gravity - fraction * drag);
  if (inclination > 0) expect(r.rotatingHookload.valueLbf).not.toBe(r.weights.frictionlessHookloadLbf);
});

test('pure rotation is explicitly zero axial motion; zero friction also justifies matching no-drag support', () => {
  const pure = calcOffBottomHookloads(base({ rotatingAxialMotion: 'stationary', ropFtHr: '' }));
  expect(pure.rotatingHookload.valid).toBe(true);
  close(pure.rotatingHookload.valueLbf, pure.weights.frictionlessHookloadLbf);
  expect(pure.assumptions.axialSpeedFtHr).toBe(0);
  const zero = calcOffBottomHookloads(base({ frictionCoefficient: 0 }));
  for (const key of ['pickupHookload', 'slackOffHookload', 'rotatingHookload']) close(zero[key].valueLbf, zero.weights.frictionlessHookloadLbf);
});

test('RPM, axial speed and OD change rotary drag, not nonrotating pickup/slack-off', () => {
  const a = calcOffBottomHookloads(base()), fast = calcOffBottomHookloads(base({ rpm: 300 })), axial = calcOffBottomHookloads(base({ ropFtHr: 600 }));
  expect(fast.rotatingHookload.valueLbf).toBeGreaterThan(a.rotatingHookload.valueLbf);
  expect(axial.rotatingHookload.valueLbf).toBeLessThan(a.rotatingHookload.valueLbf);
  for (const key of ['pickupHookload', 'slackOffHookload']) {
    expect(fast[key].valueLbf).toBe(a[key].valueLbf); expect(axial[key].valueLbf).toBe(a[key].valueLbf);
  }
  const big = calcOffBottomHookloads(base({ bha: { rows: bha.rows.map(c => ({ ...c, od: 12 })) } }));
  expect(big.rotatingHookload.valueLbf).toBeGreaterThan(a.rotatingHookload.valueLbf);
});

const arc = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 30, azimuthDeg: 90 }, { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 90 }]);
test('curved pickup/slack-off/rotating match independent off-bottom closed forms with load-dependent contact', () => {
  const input = base({ survey: arc }), r = calcOffBottomHookloads(input), k = Math.PI / 6000, w = 100 * bf;
  for (const [key, d, mu] of [['pickupHookload', 1, 0.25], ['slackOffHookload', -1, 0.25], ['rotatingHookload', -1, 0.25 * 60 / Math.hypot(60, Math.PI * 6.75 * 150 * 5)]]) {
    // Solve C'=w*cos(I)+d*mu*(w*sin(I)+C*k), C(bit)=0.
    const p = i => w / (k * (1 + mu * mu)) * (-2 * d * mu * Math.cos(i) + (1 - mu * mu) * Math.sin(i));
    const expected = -p(Math.PI / 6) + p(Math.PI / 3) * Math.exp(-d * mu * k * 1000);
    expect(r[key].valid).toBe(true);
    close(r[key].valueLbf, expected, 0.1);
    expect(r[key].convergence.checked).toBe(true);
    expect(r[key].convergence.differenceLbf).toBeLessThanOrEqual(0.1);
    close(r[key].equilibriumResidualLbf, 0, 1e-5);
  }
  expect(r.pickupDrag.valueLbf).not.toBeCloseTo(r.slackOffDrag.valueLbf, 1);
});

test.each([5000, 12000])('Test 4 at MD %s reuses exact deployed zero-WOB Slide/Rotate solver results', bitMdFt => {
  const assembly = { rows: [row('STAB', 5, 111.25), row('DC', 300, 116), row('JAR', 30, 150, 9.5), row('DC', 180, 116), row('DP', 11485, 27.76, 5.5)] };
  const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  const survey = calculateSurveyGeometry(parseSurveyCsv(csv, { mdUnit: 'ft', angleUnit: 'deg' }).stations);
  const input = base({ bha: assembly, survey, bitMdFt }), before = JSON.stringify(input), r = calcOffBottomHookloads(input);
  expect(r.weights.deployment.deployedDpLengthFt).toBe(bitMdFt - 515);
  for (const [key, mode] of [['slackOffHookload', 'slide'], ['rotatingHookload', 'rotate']]) {
    const direct = calcSurveyAxialLoads({ ...input, bha: deployDrillstring(assembly, bitMdFt).bha, wobLbf: 0, mode, maxStepFt: r[key].convergence.maxStepFt });
    close(r[key].valueLbf, -direct.topOfBhaAxialForce);
  }
  expect(r.pickupHookload.valueLbf).toBeGreaterThan(r.weights.frictionlessHookloadLbf);
  expect(r.slackOffHookload.valueLbf).toBeLessThan(r.rotatingHookload.valueLbf);
  expect(JSON.stringify(input)).toBe(before);
});

test.each([{ rpm: '' }, { rpm: 0 }, { rpm: -1 }, { ropFtHr: '' }, { ropFtHr: 0 }, { ropFtHr: -1 },
  { rotatingAxialMotion: 'upward' }, { bha: { rows: bha.rows.map(c => ({ ...c, od: '' })) } }])('unsupported rotary conditions are unavailable with reasons: %j', extra => {
  const r = calcOffBottomHookloads(base(extra));
  expect(r.weights.valid).toBe(true); expect(r.pickupHookload.valid && r.slackOffHookload.valid).toBe(true);
  expect(r.rotatingHookload.valid).toBe(false); expect(r.rotatingHookload.valueLbf).toBeNull(); expect(r.rotatingHookload.reason).toBeTruthy();
});

test('negative slack-off hookload is unsupported surface push, not a clipped zero or invented drag', () => {
  const r = calcOffBottomHookloads(base({ survey: geometry(90) }));
  expect(r.pickupHookload.valid).toBe(true);
  expect(r.slackOffHookload.valid).toBe(false); expect(r.slackOffHookload.reason).toContain('downward surface push');
  expect(r.slackOffDrag.valid).toBe(false);
});

test('invalid friction or convergence keeps existing weights and makes predictions unavailable', () => {
  for (const extra of [{ frictionCoefficient: '' }, { frictionCoefficient: -1 }, { frictionCoefficient: 2 }, { maxStepFt: 0 }, { maxRefinements: 0 }]) {
    const r = calcOffBottomHookloads(base(extra));
    expect(r.weights.valid).toBe(true);
    expect(r.pickupHookload.valid || r.slackOffHookload.valid || r.rotatingHookload.valid).toBe(false);
  }
  const unresolved = calcOffBottomHookloads(base({ survey: arc, maxRefinements: 1, convergenceToleranceLbf: 1e-15 }));
  expect(unresolved.pickupHookload.valid).toBe(false);
  expect(unresolved.pickupHookload.reason).toContain('refinement');
});

test('missing geometry, invalid deployment and missing input never produce a hookload', () => {
  for (const extra of [{ survey: null }, { bitMdFt: '' }, { bitMdFt: 1005 }]) {
    const r = calcOffBottomHookloads(base(extra));
    expect(r.weights.valid).toBe(false); expect(r.pickupHookload.valueLbf).toBeNull();
  }
  expect(calcOffBottomHookloads(null).pickupHookload.valid).toBe(false);
});

test('zero-weight strings return zero support and blank placeholders do not invent missing rotary dimensions', () => {
  const empty = calcOffBottomHookloads(base({ bha: { rows: [...bha.rows.map(c => ({ ...c, weight: 0 })), {}] } }));
  for (const key of ['pickupHookload', 'slackOffHookload', 'rotatingHookload']) {
    expect(empty[key].valid).toBe(true); expect(empty[key].valueLbf).toBe(0);
  }
});

test('oversized requested steps still refine below the curvature cap rather than compare identical meshes', () => {
  const r = calcOffBottomHookloads(base({ survey: arc, maxStepFt: 1000 }));
  expect(r.pickupHookload.valid).toBe(true);
  expect(r.pickupHookload.convergence.maxStepFt).toBeLessThan(50);
  expect(r.pickupHookload.convergence.differenceLbf).toBeGreaterThan(0);
});

test('Test 4 summary uses pure rotation, single auto DP and rotating-reference drags', () => {
  const assembly = { rows: [row('STAB', 5, 111.25), row('DC', 300, 116), row('JAR', 30, 150, 9.5), row('DC', 180, 116), row('DP', 11485, 27.76, 5.5)] };
  const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  const survey = calculateSurveyGeometry(parseSurveyCsv(csv, { mdUnit: 'ft', angleUnit: 'deg' }).stations);
  const input = base({ bha: assembly, survey, bitMdFt: 12000, rotatingAxialMotion: 'lowering', ropFtHr: 60 });
  const before = JSON.stringify(input), r = calcOffBottomRotatingSummary(input);
  for (const [key, expected] of Object.entries({ pickupHookload: 297.672099, rotatingHookload: 211.471604, slackOffHookload: 154.503686, pickupDrag: 86.200495, slackOffDrag: 56.967918 })) {
    expect(r[key].valid).toBe(true);
    close(r[key].valueLbf / 1000, expected, 0.0000005);
  }
  expect(r.assumptions.axialSpeedFtHr).toBe(0);
  expect(r.assumptions.rotatingAxialMotion).toBe('stationary');
  expect(r.rotatingHookload.axialDragLbf).toBe(0);
  expect(r.pickupDrag.valueLbf).toBe(r.pickupHookload.valueLbf - r.rotatingHookload.valueLbf);
  expect(r.slackOffDrag.valueLbf).toBe(r.rotatingHookload.valueLbf - r.slackOffHookload.valueLbf);
  expect(r.weights.deployment.deployedDpLengthFt).toBe(11485);
  expect(JSON.stringify(input)).toBe(before);
});

test('summary does not substitute theoretical reference when rotation is unavailable', () => {
  const r = calcOffBottomRotatingSummary(base({ rpm: 0 }));
  expect(r.weights.valid && r.pickupHookload.valid && r.slackOffHookload.valid).toBe(true);
  for (const key of ['rotatingHookload', 'pickupDrag', 'slackOffDrag']) {
    expect(r[key].valid).toBe(false);
    expect(r[key].reason).toContain('positive RPM');
  }
});
