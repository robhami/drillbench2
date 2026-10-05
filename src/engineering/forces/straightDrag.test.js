import { buildEngModel } from '../models/buildEngModel';
import { calcStraightDrag, calcNeutralPointFromLoadProfile } from './calcStraightDrag';

const BF = 1 - 10/65.5;
const make = (angle, wob = 30, mu = 0.25, length = 100, ppf = 200) => buildEngModel({
  inclination: angle, mudWeight: 10, wob, frictionCoefficient: mu,
  rows: [{category:'DC', toolName:'DC', length, weight:ppf, od:8}]
});

test('slide drilling starts at specified WOB at the bit', () => {
  const r = calcStraightDrag(make(45, 30), 'slide');
  expect(r.bitAxialForce).toBeCloseTo(30000, 5);
});

test('vertical slide has zero wall drag and matches frictionless reference', () => {
  const m = make(0);
  const slide = calcStraightDrag(m, 'slide');
  const ref = calcStraightDrag(m, 'reference');
  expect(slide.components[0].dragForce).toBeCloseTo(0, 5);
  expect(slide.topOfBhaAxialForce).toBeCloseTo(ref.topOfBhaAxialForce, 5);
});

test('45 degree slide resolves axial weight, normal force and Coulomb drag', () => {
  const r = calcStraightDrag(make(45), 'slide');
  const w = 20000 * BF;
  expect(r.components[0].gravityAxial).toBeCloseTo(w / Math.sqrt(2), 5);
  expect(r.components[0].normalForce).toBeCloseTo(w / Math.sqrt(2), 5);
  expect(r.components[0].dragForce).toBeCloseTo(w / Math.sqrt(2) * 0.25, 5);
  expect(r.topOfBhaAxialForce).toBeCloseTo(30000 - w/Math.sqrt(2) + w/Math.sqrt(2)*0.25, 5);
});

test('90 degree slide requires compression to overcome wall drag', () => {
  const r = calcStraightDrag(make(90), 'slide');
  const w = 20000 * BF;
  expect(r.components[0].gravityAxial).toBeCloseTo(0, 5);
  expect(r.topOfBhaAxialForce).toBeCloseTo(30000 + w * 0.25, 5);
});

test('zero friction makes slide identical to frictionless reference', () => {
  const m = make(60, 30, 0);
  expect(calcStraightDrag(m,'slide').topOfBhaAxialForce)
    .toBeCloseTo(calcStraightDrag(m,'reference').topOfBhaAxialForce, 5);
});

test('slide neutral point is calculated from WOB plus drag profile', () => {
  // 200 ft at 200 lb/ft, 10 ppg, 45°, mu 0.25, WOB 15 klbf.
  // Net load reduction per foot = buoyed ppf*(cos45 - mu*sin45).
  const m = make(45, 15, 0.25, 200, 200);
  const r = calcStraightDrag(m, 'slide');
  const n = calcNeutralPointFromLoadProfile(r);
  const buoyedPpf = 200 * BF;
  const expected = 15000 / (buoyedPpf * (Math.cos(Math.PI/4) - 0.25*Math.sin(Math.PI/4)));
  expect(n.neutralPointFound).toBe(true);
  expect(n.neutralPointFromBit).toBeCloseTo(expected, 5);
});

test('slide drag moves neutral point farther from bit than frictionless case', () => {
  const m = make(45, 15, 0.25, 200, 200);
  const slideNP = calcNeutralPointFromLoadProfile(calcStraightDrag(m,'slide'));
  const refNP = calcNeutralPointFromLoadProfile(calcStraightDrag(m,'reference'));
  expect(slideNP.neutralPointFromBit).toBeGreaterThan(refNP.neutralPointFromBit);
});

test('invalid inputs and unsupported rotate mode are rejected', () => {
  expect(calcStraightDrag(make(30),'slide',-0.1).valid).toBe(false);
  expect(calcStraightDrag(make(30),'rotate').valid).toBe(false);
});
