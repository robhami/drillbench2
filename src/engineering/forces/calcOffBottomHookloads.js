import { calcStringWeightSummary } from '../bha/calcStringWeightSummary';
import { deployDrillstring } from '../bha/deployDrillstring';
import { calcSurveyAxialLoads, integrateElement, localGeometry } from './calcSurveyAxialLoads';

const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const unavailable = reason => ({ valid: false, valueLbf: null, reason });

function pickupFromMesh(mesh, survey, mu) {
  let force = 0, drag = 0;
  const profile = [{ mdFt: mesh.bitMdFt, axialForceLbf: 0 }];
  for (const element of mesh.elements) {
    const component = mesh.components[element.componentIndex];
    const local = localGeometry(survey, (element.bottomMdFt + element.topMdFt) / 2);
    // x increases uphole. Pickup friction is downhole: C_top=C_bottom-G-mu*N.
    // The same implicit contact solver resolves N from this branch's mean C.
    const solved = integrateElement(force, element.gravityAxialLbf, component.weightPerFoot * mesh.buoyancyFactor, local, element.lengthFt, -mu);
    if (!solved) return { valid: false, reason: 'Pickup contact balance failed to converge.' };
    force = solved.top; drag += mu * solved.normal;
    profile.push({ mdFt: element.topMdFt, axialForceLbf: force });
  }
  return { valid: true, hookloadLbf: -force, axialDragLbf: drag, profile };
}

/** Predicted off-bottom surface support. No user surface load is consumed.
 * Existing weight/inclination results are returned verbatim as `weights`.
 * Pickup/slack-off are nonrotating. Rotation supports downward axial motion
 * (existing Rotate model) or pure rotation (zero axial velocity, axial mu=0).
 */
export function calcOffBottomHookloads(input = {}) {
  const weights = calcStringWeightSummary(input);
  const failed = reason => ({ weights, pickupHookload: unavailable(reason), slackOffHookload: unavailable(reason),
    rotatingHookload: unavailable(reason), pickupDrag: unavailable(reason), slackOffDrag: unavailable(reason) });
  if (!weights.valid) return failed(weights.errors.join(' '));
  if (!finite(input.frictionCoefficient) || Number(input.frictionCoefficient) < 0 || Number(input.frictionCoefficient) > 1) return failed('Enter a friction coefficient from 0 to 1.');
  const step = input.maxStepFt === undefined ? 5 : Number(input.maxStepFt);
  const tolerance = input.convergenceToleranceLbf === undefined ? 0.1 : Number(input.convergenceToleranceLbf);
  const maxRefinements = input.maxRefinements === undefined ? 6 : input.maxRefinements;
  if (!finite(step) || step <= 0 || !finite(tolerance) || tolerance <= 0 || !Number.isSafeInteger(maxRefinements) || maxRefinements < 1 || maxRefinements > 10) return failed('Invalid numerical step or convergence settings.');
  const mu = Number(input.frictionCoefficient), motion = input.rotatingAxialMotion ?? 'lowering';
  const deployment = deployDrillstring(input.bha, weights.bitMdFt, { surfaceMdFt: weights.surfaceMdFt, deploymentMode: 'depth-dependent' });
  const base = { bha: deployment.bha, survey: input.survey, bitMdFt: weights.bitMdFt, wobLbf: 0,
    mudWeightPpg: Number(input.mudWeightPpg), frictionCoefficient: mu };
  const cache = new Map();
  const slideAt = h => {
    if (!cache.has(h)) cache.set(h, calcSurveyAxialLoads({ ...base, mode: 'slide', maxStepFt: h }));
    return cache.get(h);
  };
  const hasCurvature = input.survey.segments.some(s => s.doglegRad > 0 && s.toMdFt > weights.surfaceMdFt && s.fromMdFt < weights.bitMdFt);
  // Start below every active curvature cap, so halving really refines the mesh
  // even when a caller requests a step much larger than the dogleg limit.
  const initialStep = input.survey.segments.reduce((h, s) => s.doglegRad > 0 && s.toMdFt > weights.surfaceMdFt && s.fromMdFt < weights.bitMdFt ? Math.min(h, 0.05 * s.lengthFt / s.doglegRad) : h, step);
  const solve = (operation, h) => {
    const load = operation === 'rotating' ? calcSurveyAxialLoads({ ...base, mode: motion === 'stationary' ? 'slide' : 'rotate',
      frictionCoefficient: motion === 'stationary' ? 0 : mu, rpm: Number(input.rpm), ropFtHr: Number(input.ropFtHr), maxStepFt: h }) : slideAt(h);
    if (!load.valid) return { valid: false, reason: load.errors.join(' ') };
    if (operation === 'pickup') return pickupFromMesh(load, input.survey, mu);
    return { valid: true, hookloadLbf: -load.topOfBhaAxialForce, axialDragLbf: load.totalFrictionForceLbf,
      profile: load.profile.map(p => ({ mdFt: p.mdFt, axialForceLbf: p.axialForceLbf })) };
  };
  const predict = operation => {
    let result = solve(operation, initialStep);
    if (!result.valid) return unavailable(result.reason);
    let convergence = { checked: false, differenceLbf: 0, maxStepFt: initialStep, refinements: 0, toleranceLbf: tolerance };
    const refine = hasCurvature && mu > 0 && !(operation === 'rotating' && motion === 'stationary');
    if (refine) for (let i = 1; i <= maxRefinements; i += 1) {
      const refinedStep = initialStep / 2 ** i, next = solve(operation, refinedStep);
      if (!next.valid) return unavailable(next.reason);
      const nodes = new Map(next.profile.map(p => [p.mdFt, p.axialForceLbf]));
      let difference = Math.abs(result.hookloadLbf - next.hookloadLbf);
      for (const p of result.profile) if (nodes.has(p.mdFt)) difference = Math.max(difference, Math.abs(p.axialForceLbf - nodes.get(p.mdFt)));
      convergence = { checked: true, differenceLbf: difference, maxStepFt: refinedStep, refinements: i, toleranceLbf: tolerance };
      result = next;
      if (difference <= tolerance) break;
      if (i === maxRefinements) return unavailable('Off-bottom step refinement did not converge; no hookload prediction returned.');
    }
    if (![result.hookloadLbf, result.axialDragLbf].every(Number.isFinite)) return unavailable('Calculated hookload exceeds numerical range.');
    if (result.hookloadLbf < 0) return unavailable('Off-bottom equilibrium requires negative surface hookload (a downward surface push), which is unsupported.');
    const expected = weights.frictionlessHookloadLbf + (operation === 'pickup' ? 1 : -1) * result.axialDragLbf;
    const residual = result.hookloadLbf - expected;
    if (!Number.isFinite(residual) || Math.abs(residual) > 1e-6 + 1e-9 * Math.max(Math.abs(expected), result.axialDragLbf)) return unavailable('Off-bottom force balance is unresolved.');
    return { valid: true, valueLbf: result.hookloadLbf === 0 ? 0 : result.hookloadLbf, axialDragLbf: result.axialDragLbf, convergence, equilibriumResidualLbf: residual };
  };
  const pickupHookload = predict('pickup'), slackOffHookload = predict('slackoff');
  let rotatingHookload;
  if (!['lowering', 'stationary'].includes(motion)) rotatingHookload = unavailable('Rotating hookload supports lowering or stationary axial motion only.');
  else if (!finite(input.rpm) || Number(input.rpm) <= 0) rotatingHookload = unavailable('Enter positive RPM for a rotating hookload prediction.');
  else if (deployment.bha.rows.filter(r => Number(r.length) > 0 && (r.category || r.toolName || r.selectedToolId)).some(r => !finite(r.od) || Number(r.od) <= 0)) rotatingHookload = unavailable('Rotating hookload requires positive OD for every deployed component.');
  else if (motion === 'lowering' && (!finite(input.ropFtHr) || Number(input.ropFtHr) <= 0)) rotatingHookload = unavailable('Rotating while lowering requires a positive off-bottom axial speed (ROP input) in ft/hr.');
  else rotatingHookload = predict('rotating');
  const pickupDrag = pickupHookload.valid ? { valid: true, valueLbf: pickupHookload.valueLbf - weights.frictionlessHookloadLbf } : unavailable(pickupHookload.reason);
  const slackOffDrag = slackOffHookload.valid ? { valid: true, valueLbf: weights.frictionlessHookloadLbf - slackOffHookload.valueLbf } : unavailable(slackOffHookload.reason);
  return { weights, pickupHookload, slackOffHookload, rotatingHookload, pickupDrag, slackOffDrag,
    assumptions: { bitAxialLoadLbf: 0, frictionCoefficient: mu, pickupAndSlackOffRotationRpm: 0,
      rotatingAxialMotion: motion, rpm: finite(input.rpm) ? Number(input.rpm) : null,
      axialSpeedFtHr: motion === 'stationary' ? 0 : finite(input.ropFtHr) ? Number(input.ropFtHr) : null } };
}

/** Summary-only pure rotation at fixed depth. The general lowering API is unchanged. */
export function calcOffBottomRotatingSummary(input = {}) {
  const result = calcOffBottomHookloads({ ...input, rotatingAxialMotion: 'stationary', ropFtHr: 0 });
  const difference = (a, b) => !a.valid ? unavailable(a.reason) : !b.valid ? unavailable(b.reason) :
    { valid: true, valueLbf: a.valueLbf - b.valueLbf };
  return { ...result,
    pickupDrag: difference(result.pickupHookload, result.rotatingHookload),
    slackOffDrag: difference(result.rotatingHookload, result.slackOffHookload) };
}
