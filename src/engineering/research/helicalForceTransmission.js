/** Restricted research benchmark; inches, lbf, psi throughout.
 * No connection to drilling/jar force solvers or automatic buckling selection.
 */
export const HELICAL_BENCHMARK_ASSUMPTIONS = Object.freeze([
  'uniformTubular', 'constantClearance', 'establishedHelix', 'constantPitch',
  'weightless', 'zeroAppliedTorque', 'continuousContact', 'noConnectors',
  'noGeometryTransitions', 'noLoadingHistoryTransitions'
]);
const assumptions = Object.freeze([
  'Uniform elastic tubular, constant clearance and already-established constant-pitch helical idealization.',
  'Weightless, no applied torque, continuous contact, no connectors or geometry/history transitions.',
  'Prescribed sliding from the entering-compression end toward the exit; friction opposes transmission.',
  'Research benchmark only: not sinusoidal/helical onset, lock-up, failure or a safe Jar Down limit.',
  'Local force-dependent helical contact closure; pitch evolution and end-transition equilibrium are not solved.'
]);
const fail = (status, errors) => ({ valid: false, status, applicability: 'not-evaluated', errors, assumptions });

export function calcHelicalForceTransmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('invalid-input', ['Supply explicit benchmark inputs.']);
  const errors = [];
  const positive = ['odIn', 'youngsModulusPsi', 'radialClearanceIn'];
  const nonnegative = ['idIn', 'enteringCompressionLbf', 'buckledLengthIn', 'frictionCoefficient'];
  for (const key of [...positive, ...nonnegative]) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) ||
      (positive.includes(key) ? input[key] <= 0 : input[key] < 0)) errors.push(`${key} must be an explicit finite ${positive.includes(key) ? 'positive' : 'nonnegative'} number.`);
  }
  if (Number.isFinite(input.odIn) && Number.isFinite(input.idIn) && input.idIn >= input.odIn) errors.push('Tubular ID must be smaller than OD.');
  if (errors.length) return fail('invalid-input', errors);
  const unconfirmed = HELICAL_BENCHMARK_ASSUMPTIONS.filter(key => input.conditions?.[key] !== true);
  if (unconfirmed.length || input.slidingDirection !== 'entering-to-exit') return fail('unsupported-applicability', [
    ...unconfirmed.map(key => `Required assumption not confirmed: ${key}.`),
    ...(input.slidingDirection !== 'entering-to-exit' ? ['Sliding direction must be explicitly entering-to-exit.'] : [])
  ]);
  const { odIn: od, idIn: id, youngsModulusPsi: E, radialClearanceIn: r,
    enteringCompressionLbf: C0, buckledLengthIn: L, frictionCoefficient: mu } = input;
  // Factored difference of fourth powers preserves thin-wall precision.
  const I = Math.PI / 64 * (od - id) * (od + id) * (od * od + id * id);
  const EI = E * I;
  const contactCoefficient = (r / EI) / 4;
  const a = mu * contactCoefficient;
  const attenuation = a * C0 * L;
  const denominator = 1 + attenuation;
  if (![I, EI, contactCoefficient].every(v => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(a) || (mu > 0 && a <= 0) || !Number.isFinite(denominator)) {
    return fail('numerical-unavailable', ['Benchmark stiffness/contact arithmetic is outside representable numerical range.']);
  }
  const exitCompressionLbf = C0 / denominator;
  const frictionResistanceLbf = C0 - exitCompressionLbf;
  const enteringContactLbfPerIn = (contactCoefficient * C0) * C0;
  const exitContactLbfPerIn = (contactCoefficient * exitCompressionLbf) * exitCompressionLbf;
  const exitGradientLbfPerIn = -mu * exitContactLbfPerIn;
  if (![exitCompressionLbf, frictionResistanceLbf, enteringContactLbfPerIn, exitContactLbfPerIn, exitGradientLbfPerIn].every(Number.isFinite)) {
    return fail('numerical-unavailable', ['Benchmark force/contact arithmetic exceeds numerical range.']);
  }
  return { valid: true, status: 'calculated', applicability: 'restricted-research-only', errors: [], assumptions,
    warnings: C0 === 0 ? ['Zero compression is a mathematical limiting case, not evidence that a helix exists.'] : [],
    units: { length: 'in', force: 'lbf', modulus: 'psi', secondMoment: 'in^4', contact: 'lbf/in' },
    inputs: { odIn: od, idIn: id, youngsModulusPsi: E, radialClearanceIn: r, enteringCompressionLbf: C0, buckledLengthIn: L, frictionCoefficient: mu },
    secondMomentIn4: I, bendingStiffnessLbfIn2: EI, attenuationCoefficientPerLbfIn: a, dimensionlessAttenuation: attenuation,
    exitCompressionLbf, frictionResistanceLbf, enteringContactLbfPerIn, exitContactLbfPerIn,
    exitGradientLbfPerIn, transmissionSensitivity: 1 / denominator ** 2 };
}
