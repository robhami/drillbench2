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

test('invalid friction input is rejected', () => {
  expect(calcStraightDrag(make(30),'slide',-0.1).valid).toBe(false);
});

test('rotate drilling starts at WOB and uses axial share of friction', () => {
  const m = make(45, 15, 0.25, 100, 200);
  m.bha.rpm = 120;
  m.bha.rop = 60;
  const r = calcStraightDrag(m, 'rotate');
  const c = r.components[0];
  const w = 20000 * BF;
  const normal = w / Math.sqrt(2);
  const tangential = Math.PI * 8 / 12 * 120 * 60;
  const fraction = 60 / Math.hypot(60, tangential);
  expect(r.bitAxialForce).toBeCloseTo(15000, 5);
  expect(c.axialDragFraction).toBeCloseTo(fraction, 8);
  expect(c.dragContribution).toBeCloseTo(0.25 * normal * fraction, 5);
  expect(r.topOfBhaAxialForce).toBeCloseTo(15000 - w/Math.sqrt(2) + 0.25*normal*fraction, 5);
});

test('rotate with zero RPM reduces exactly to slide drilling', () => {
  const m = make(60, 15, 0.25, 200, 200);
  m.bha.rpm = 0;
  m.bha.rop = 60;
  expect(calcStraightDrag(m,'rotate').topOfBhaAxialForce)
    .toBeCloseTo(calcStraightDrag(m,'slide').topOfBhaAxialForce, 5);
});

test('rotation reduces axial drag and places neutral point between reference and slide', () => {
  const m = make(45, 15, 0.25, 200, 200);
  m.bha.rpm = 120;
  m.bha.rop = 60;
  const ref = calcNeutralPointFromLoadProfile(calcStraightDrag(m,'reference')).neutralPointFromBit;
  const rot = calcNeutralPointFromLoadProfile(calcStraightDrag(m,'rotate')).neutralPointFromBit;
  const slide = calcNeutralPointFromLoadProfile(calcStraightDrag(m,'slide')).neutralPointFromBit;
  expect(rot).toBeGreaterThan(ref);
  expect(rot).toBeLessThan(slide);
});

test('higher RPM reduces rotary axial drag', () => {
  const m1 = make(45, 15, 0.25, 100, 200); m1.bha.rpm=30; m1.bha.rop=60;
  const m2 = make(45, 15, 0.25, 100, 200); m2.bha.rpm=120; m2.bha.rop=60;
  expect(calcStraightDrag(m2,'rotate').components[0].dragContribution)
    .toBeLessThan(calcStraightDrag(m1,'rotate').components[0].dragContribution);
});

test('rotate requires positive ROP, non-negative RPM and valid component OD', () => {
  const m = make(45); m.bha.rpm=120; m.bha.rop=0;
  expect(calcStraightDrag(m,'rotate').valid).toBe(false);
  m.bha.rop=60; m.bha.rpm=-1;
  expect(calcStraightDrag(m,'rotate').valid).toBe(false);
  m.bha.rpm=120; m.positions.components[0].od='';
  expect(calcStraightDrag(m,'rotate').valid).toBe(false);
});
