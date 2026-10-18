import { calcStaticJarLoads } from './staticJarLoads';

const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const fail = (message, status = 'invalid-input') => ({ valid: false, status, errors: [message] });

/** Invert the unchanged Stage 3A forward boundary model. See InverseStaticJarLoads.md.
 * The finite search ceiling is computational, not an equipment/operating limit.
 */
export function solveStaticJarHookload(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Supply inverse static jar inputs.');
  if (!['up', 'down'].includes(input.jarDirection)) return fail('Select Jar Up or Jar Down.');
  if (!finite(input.desiredJarForceLbf) || Number(input.desiredJarForceLbf) <= 0) return fail('Desired jar force must be an explicit positive magnitude in lbf.');
  const maxHookloadLbf = input.maxHookloadLbf === undefined ? 10000000 : Number(input.maxHookloadLbf);
  const residualToleranceLbf = input.residualToleranceLbf === undefined ? 0.01 : Number(input.residualToleranceLbf);
  const maxIterations = input.maxIterations === undefined ? 60 : input.maxIterations;
  if (!finite(maxHookloadLbf) || maxHookloadLbf <= 0 || !finite(residualToleranceLbf) || residualToleranceLbf <= 0 ||
    !Number.isSafeInteger(maxIterations) || maxIterations < 1 || maxIterations > 100) return fail('Invalid inverse search bound, tolerance or iteration limit.');
  const targetJarAxialLoadLbf = (input.jarDirection === 'up' ? -1 : 1) * Number(input.desiredJarForceLbf);
  const direction = input.jarDirection === 'up' ? 'pickup' : 'slackoff';
  let evaluations = 0;
  const evaluate = hookload => {
    evaluations += 1;
    const forward = calcStaticJarLoads({ ...input, direction, loadMode: 'absolute', surfaceHookloadLbf: hookload });
    return forward.valid ? { valid: true, forward, hookload, residual: forward.jarAxialLoadLbf - targetJarAxialLoadLbf } : forward;
  };
  const forwardFailure = r => fail('Forward static calculation failed: ' + r.errors.join(' '), 'forward-failure');
  const matchesTarget = candidate => Math.abs(candidate.residual) <= residualToleranceLbf &&
    Math.sign(candidate.forward.jarAxialLoadLbf) === Math.sign(targetJarAxialLoadLbf);
  const accept = (candidate, iterations) => {
    // Fresh verification is intentionally independent of the retained bracket result.
    const verified = evaluate(candidate.hookload);
    if (!verified.valid) return forwardFailure(verified);
    if (!Number.isFinite(verified.residual) || !matchesTarget(verified)) return fail('Forward verification did not meet the inverse residual tolerance.', 'unresolved-residual');
    const reference = input.rotatingHookloadLbf;
    return { valid: true, status: 'calculated', errors: [], warnings: verified.forward.warnings,
      requiredSurfaceHookloadLbf: candidate.hookload, targetJarAxialLoadLbf,
      jarAxialLoadLbf: verified.forward.jarAxialLoadLbf, jarLoadState: verified.forward.jarLoadState,
      differenceFromRotatingLbf: finite(reference) && Number(reference) >= 0 ? candidate.hookload - Number(reference) : null,
      residualLbf: verified.residual, residualToleranceLbf, direction, jarDirection: input.jarDirection,
      evaluations, iterations, maxHookloadLbf, forwardResult: verified.forward };
  };
  let lower = evaluate(0);
  if (!lower.valid) return forwardFailure(lower);
  if (matchesTarget(lower)) return accept(lower, 0);
  if (lower.residual < 0) return fail('Target is unreachable with nonnegative surface hookload on this friction branch; it would require an unsupported downward surface push.', 'unreachable-target');
  let upper = evaluate(Math.min(10000, maxHookloadLbf));
  if (!upper.valid) return forwardFailure(upper);
  let expansions = 0;
  while (upper.residual > 0 && upper.hookload < maxHookloadLbf && expansions < 32) {
    expansions += 1;
    if (matchesTarget(upper)) return accept(upper, 0);
    upper = evaluate(Math.min(maxHookloadLbf, upper.hookload * 2));
    if (!upper.valid) return forwardFailure(upper);
  }
  if (matchesTarget(upper)) return accept(upper, 0);
  if (upper.residual > 0) return fail('Target was not bracketed within the computational hookload search limits; no required hookload established.', 'unbracketed-target');
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const midpoint = lower.hookload + (upper.hookload - lower.hookload) / 2;
    if (midpoint === lower.hookload || midpoint === upper.hookload) break;
    const candidate = evaluate(midpoint);
    if (!candidate.valid) return forwardFailure(candidate);
    if (matchesTarget(candidate)) return accept(candidate, iteration);
    if (candidate.residual > 0) lower = candidate; else upper = candidate;
  }
  return fail('Inverse hookload search did not converge to the requested force residual.', 'unresolved-convergence');
}
