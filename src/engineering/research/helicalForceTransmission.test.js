import { calcHelicalForceTransmission, HELICAL_BENCHMARK_ASSUMPTIONS } from './helicalForceTransmission';

const base = { odIn: 2, idIn: 0, youngsModulusPsi: 4000000 / Math.PI, radialClearanceIn: 1,
  enteringCompressionLbf: 1000, buckledLengthIn: 10000, frictionCoefficient: .2,
  slidingDirection: 'entering-to-exit', conditions: Object.fromEntries(HELICAL_BENCHMARK_ASSUMPTIONS.map(key => [key, true])) };
const run = changes => calcHelicalForceTransmission({ ...base, ...changes });
const near = (a, b, tolerance = 1e-8) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);

test('independent hand benchmark EI=1e6: x=0.5 gives 2000/3 lbf', () => {
  const r = run();
  expect(r.valid).toBe(true); near(r.secondMomentIn4, Math.PI / 4);
  near(r.bendingStiffnessLbfIn2, 1000000); near(r.dimensionlessAttenuation, .5);
  near(r.exitCompressionLbf, 2000 / 3); near(r.frictionResistanceLbf, 1000 / 3);
  near(r.enteringContactLbfPerIn, .25); near(r.exitContactLbfPerIn, 1 / 9);
  near(r.exitGradientLbfPerIn, -1 / 45); near(r.transmissionSensitivity, 4 / 9);
  expect(r.applicability).toBe('restricted-research-only');
});
test.each([{ frictionCoefficient: 0 }, { buckledLengthIn: 0 }])('zero friction or length preserves compression: %j', changes => {
  const r = run(changes); near(r.exitCompressionLbf, 1000); near(r.frictionResistanceLbf, 0);
});
test('zero entering compression is an explicit degenerate limit, not a buckling claim', () => {
  const r = run({ enteringCompressionLbf: 0 });
  expect(r.exitCompressionLbf).toBe(0); expect(r.enteringContactLbfPerIn).toBe(0);
  expect(r.warnings.join()).toContain('mathematical limiting case');
});
test.each([{ frictionCoefficient: .4 }, { buckledLengthIn: 20000 }, { radialClearanceIn: 2 }])('increasing friction, length or clearance reduces transmission: %j', changes => {
  expect(run(changes).exitCompressionLbf).toBeLessThan(run().exitCompressionLbf);
});
test('increasing bending stiffness increases transmission', () => {
  expect(run({ youngsModulusPsi: base.youngsModulusPsi * 2 }).exitCompressionLbf).toBeGreaterThan(run().exitCompressionLbf);
  expect(run({ odIn: 3 }).exitCompressionLbf).toBeGreaterThan(run().exitCompressionLbf);
});
test('analytical length derivative and input sensitivity agree with central differences', () => {
  const r = run(), h = .1;
  near((run({ buckledLengthIn: base.buckledLengthIn + h }).exitCompressionLbf - run({ buckledLengthIn: base.buckledLengthIn - h }).exitCompressionLbf) / (2 * h), r.exitGradientLbfPerIn, 1e-10);
  const d = .01;
  near((run({ enteringCompressionLbf: 1000 + d }).exitCompressionLbf - run({ enteringCompressionLbf: 1000 - d }).exitCompressionLbf) / (2 * d), r.transmissionSensitivity, 1e-10);
});

// Independent RK4 force integration and Simpson quadrature. Neither evaluates
// the closed-form transmission expression or uses the production contact output.
function integrateNumerically(input, steps) {
  const inertia = Math.PI * (input.odIn ** 4 - input.idIn ** 4) / 64;
  const stiffness = input.youngsModulusPsi * inertia;
  const normal = force => input.radialClearanceIn * force * force / (4 * stiffness);
  const derivative = force => -input.frictionCoefficient * normal(force);
  const h = input.buckledLengthIn / steps;
  let C = input.enteringCompressionLbf, simpson = normal(C);
  for (let i = 1; i <= steps; i += 1) {
    const k1 = derivative(C), k2 = derivative(C + h * k1 / 2), k3 = derivative(C + h * k2 / 2), k4 = derivative(C + h * k3);
    C += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    simpson += (i === steps ? 1 : i % 2 ? 4 : 2) * normal(C);
  }
  return { C, integratedFrictionLbf: input.frictionCoefficient * h / 3 * simpson };
}
test('independent RK4 convergence and integrated wall friction recover force balance', () => {
  const exact = run().exitCompressionLbf;
  const errors = [10, 20, 40].map(n => Math.abs(integrateNumerically(base, n).C - exact));
  expect(errors[1]).toBeLessThan(errors[0] / 12);
  expect(errors[2]).toBeLessThan(errors[1] / 12);
  const numerical = integrateNumerically(base, 1000);
  near(numerical.C, 2000 / 3, 1e-8);
  near(base.enteringCompressionLbf - numerical.C, numerical.integratedFrictionLbf, 1e-8);
});
test('SI evaluation independently verifies inch/psi/lbf dimensional conversion', () => {
  const realistic = { ...base, odIn: 5.5, idIn: 4.67, youngsModulusPsi: 30000000, radialClearanceIn: 5.25,
    enteringCompressionLbf: 50000, buckledLengthIn: 1200, frictionCoefficient: .25 };
  const inch = .0254, lbf = 4.4482216152605;
  const I = Math.PI / 64 * ((realistic.odIn * inch) ** 4 - (realistic.idIn * inch) ** 4);
  const E = realistic.youngsModulusPsi * lbf / inch ** 2;
  const C0 = realistic.enteringCompressionLbf * lbf;
  const si = C0 / (1 + realistic.frictionCoefficient * realistic.radialClearanceIn * inch * C0 * realistic.buckledLengthIn * inch / (4 * E * I));
  near(calcHelicalForceTransmission(realistic).exitCompressionLbf, si / lbf, 1e-8);
  near(integrateNumerically(realistic, 1000).C, si / lbf, 1e-8);
});
test.each(['odIn', 'idIn', 'youngsModulusPsi', 'radialClearanceIn', 'enteringCompressionLbf', 'buckledLengthIn', 'frictionCoefficient'])('missing/nonfinite %s rejected', key => {
  for (const value of [undefined, null, '', '1', NaN, Infinity, -1]) expect(run({ [key]: value }).valid).toBe(false);
});
test.each([{ odIn: 0 }, { idIn: 2 }, { idIn: 3 }, { youngsModulusPsi: 0 }, { radialClearanceIn: 0 }])('invalid geometry/material %j rejected', changes => {
  expect(run(changes).status).toBe('invalid-input');
});
test('all applicability conditions and sliding direction must be explicitly supported', () => {
  expect(run({ conditions: undefined }).status).toBe('unsupported-applicability');
  for (const key of HELICAL_BENCHMARK_ASSUMPTIONS) expect(run({ conditions: { ...base.conditions, [key]: false } }).status).toBe('unsupported-applicability');
  expect(run({ slidingDirection: 'reverse' }).status).toBe('unsupported-applicability');
  expect(run({ slidingDirection: undefined }).valid).toBe(false);
});
test('malformed and unrepresentable inputs return structured unavailable results without mutation', () => {
  for (const input of [null, undefined, [], 1]) expect(calcHelicalForceTransmission(input).valid).toBe(false);
  expect(run({ odIn: 1e100 }).status).toBe('numerical-unavailable');
  expect(run({ buckledLengthIn: 1e308, enteringCompressionLbf: 1e308 }).status).toBe('numerical-unavailable');
  const before = JSON.stringify(base); run(); expect(JSON.stringify(base)).toBe(before);
});
