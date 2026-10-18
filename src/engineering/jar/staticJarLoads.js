import { deployDrillstring } from '../bha/deployDrillstring';
import { calcComponentPositions } from '../bha/calcComponentPositions';
import { calcBuoyancyFactor } from '../forces/calcBuoyancy';
import { evaluateSurveyAtMd } from '../survey/surveyGeometry';

const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const fail = (message, status = 'invalid-input') => ({ valid: false, status, errors: [message] });
const populated = r => r && ['category', 'toolName', 'selectedToolId', 'length', 'weight'].some(k => r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '');
const MAX_ELEMENTS = 100000;

// Survey segments are the existing analytic minimum-curvature source of truth.
function geometryAt(segment, mdFt) {
  const rate = segment.doglegRad / segment.lengthFt, angle = rate * (mdFt - segment.fromMdFt);
  return {
    tangent: segment.tangent0.map((v, i) => Math.cos(angle) * v + Math.sin(angle) * segment.turn[i]),
    curvature: segment.tangent0.map((v, i) => rate * (-Math.sin(angle) * v + Math.cos(angle) * segment.turn[i]))
  };
}

function integrate(sections, survey, hookload, mu, directionSign, maxStepFt) {
  const elements = [], profile = [{ mdFt: sections[0].topMdFt, axialForceLbf: -hookload }];
  let force = -hookload, gravitySum = 0, frictionSum = 0, curved = false;
  for (const section of sections) {
    const knots = [section.topMdFt, ...survey.stations.filter(s => s.mdFt > section.topMdFt && s.mdFt < section.bottomMdFt).map(s => s.mdFt), section.bottomMdFt];
    for (let k = 1; k < knots.length; k += 1) {
      const a = knots[k - 1], b = knots[k];
      const segment = survey.segments.find(s => (a + b) / 2 >= s.fromMdFt && (a + b) / 2 <= s.toMdFt);
      const rate = segment.doglegRad / segment.lengthFt;
      if (rate > 0) curved = true;
      const limit = rate > 0 ? Math.min(maxStepFt, 0.05 / rate) : maxStepFt;
      const count = Math.ceil((b - a) / limit);
      if (!Number.isSafeInteger(count) || count < 1 || elements.length + count > MAX_ELEMENTS) return fail('Integration exceeds the 100,000-element safeguard.', 'numerical-limit');
      for (let j = 0; j < count; j += 1) {
        const topMdFt = a + (b - a) * j / count, bottomMdFt = j === count - 1 ? b : a + (b - a) * (j + 1) / count;
        const lengthFt = bottomMdFt - topMdFt;
        if (!(lengthFt > 0)) return fail('Integration step cannot be resolved numerically.', 'numerical-limit');
        const top = evaluateSurveyAtMd(survey, topMdFt), bottom = evaluateSurveyAtMd(survey, bottomMdFt);
        const local = geometryAt(segment, (topMdFt + bottomMdFt) / 2);
        const gravity = section.buoyedWeightPerFt * (bottom.tvdFt - top.tvdFt);
        const normalAt = mean => Math.hypot(...local.tangent.map((t, i) => section.buoyedWeightPerFt * ((i === 2 ? 1 : 0) - local.tangent[2] * t) - mean * local.curvature[i])) * lengthFt;
        let deeper = force + gravity, solved = false, iterations = 0;
        for (; iterations < 40; iterations += 1) {
          const next = force + gravity + directionSign * mu * normalAt((force + deeper) / 2);
          if (!Number.isFinite(next)) return fail('Static force integration exceeded numerical range.', 'numerical-failure');
          if (Math.abs(next - deeper) <= 1e-9 + 1e-12 * Math.max(Math.abs(force), Math.abs(next))) { deeper = next; solved = true; break; }
          deeper = next;
        }
        if (!solved) return fail('Implicit static contact balance failed to converge; no load returned.', 'numerical-failure');
        const normal = normalAt((force + deeper) / 2), friction = mu * normal;
        if (![gravity, normal, friction].every(Number.isFinite)) return fail('Static contact or gravity exceeded numerical range.', 'numerical-failure');
        elements.push({ componentIndex: section.componentIndex, topMdFt, bottomMdFt, lengthFt,
          topAxialForceLbf: force, bottomAxialForceLbf: deeper, gravityAxialLbf: gravity,
          normalContactForceLbf: normal, frictionResistanceLbf: friction,
          signedDownholeFrictionLbf: directionSign * friction, iterations: iterations + 1 });
        gravitySum += gravity; frictionSum += friction; force = deeper;
        profile.push({ mdFt: bottomMdFt, axialForceLbf: force });
      }
    }
  }
  const residual = force - (-hookload + gravitySum + directionSign * frictionSum);
  if (![gravitySum, frictionSum, residual].every(Number.isFinite) || Math.abs(residual) > 1e-6 + 1e-9 * Math.max(hookload, Math.abs(gravitySum), frictionSum)) return fail('Integrated static force balance is unresolved; no load returned.', 'numerical-failure');
  return { valid: true, jarAxialLoadLbf: force, gravityAxialLbf: gravitySum, frictionResistanceLbf: frictionSum,
    equilibriumResidualLbf: residual, elements, profile, curved };
}

/** Approved Stage 3A surface-to-jar-centre soft-string equilibrium.
 * C is compression positive, s increases downhole. dC/ds = w*cos(I) +/- mu*n,
 * plus for pickup, minus for slack-off. See Stage3AStaticJarLoadsProposal.md.
 * Absolute mode needs only surfaceHookloadLbf. Reference mode needs explicit
 * referenceHookloadLbf and appliedLoadLbf; its baseline is frictionless, assumed.
 */
export function calcStaticJarLoads(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Supply static jar inputs as an object.');
  const { bha, survey, direction } = input;
  const loadMode = input.loadMode ?? 'absolute';
  if (!['pickup', 'slackoff'].includes(direction)) return fail('Select pickup or slack-off.');
  if (!['absolute', 'reference'].includes(loadMode)) return fail('Select absolute or reference hookload input.');
  if (!survey?.valid || !Array.isArray(survey.segments) || !survey.segments.length || !survey.summary) return fail('A valid confirmed survey is required.');
  if (!finite(input.bitMdFt) || Number(input.bitMdFt) < 0) return fail('Supply a nonnegative bit MD in feet.');
  const surface = input.surfaceMdFt === undefined ? 0 : Number(input.surfaceMdFt);
  if ((input.surfaceMdFt !== undefined && !finite(input.surfaceMdFt)) || !Number.isFinite(surface) || surface < 0) return fail('Supply a nonnegative surface reference MD.');
  if (!finite(input.frictionCoefficient) || Number(input.frictionCoefficient) < 0 || Number(input.frictionCoefficient) > 1) return fail('Supply a friction coefficient from 0 to 1.');
  const hasMud = input.mudWeightPpg !== undefined, hasBf = input.buoyancyFactor !== undefined;
  if (hasMud === hasBf) return fail('Specify exactly one of mud weight or buoyancy factor.');
  if (hasMud && (!finite(input.mudWeightPpg) || Number(input.mudWeightPpg) <= 0 || Number(input.mudWeightPpg) >= 65.5)) return fail('Mud weight must be positive and below 65.5 ppg.');
  if (hasBf && (!finite(input.buoyancyFactor) || Number(input.buoyancyFactor) <= 0 || Number(input.buoyancyFactor) > 1)) return fail('Buoyancy factor must be greater than zero and at most one.');
  const bf = hasMud ? calcBuoyancyFactor(Number(input.mudWeightPpg)) : Number(input.buoyancyFactor);
  const sign = direction === 'pickup' ? 1 : -1;
  let hookload, referenceHookload = null, appliedLoad = null;
  if (loadMode === 'absolute') {
    if (!finite(input.surfaceHookloadLbf) || Number(input.surfaceHookloadLbf) < 0) return fail('Supply an absolute nonnegative surface hookload in lbf.');
    hookload = Number(input.surfaceHookloadLbf);
  } else {
    if (!finite(input.referenceHookloadLbf) || Number(input.referenceHookloadLbf) < 0 || !finite(input.appliedLoadLbf) || Number(input.appliedLoadLbf) < 0) return fail('Reference hookload and applied overpull/set-down must be explicitly nonnegative in lbf.');
    referenceHookload = Number(input.referenceHookloadLbf); appliedLoad = Number(input.appliedLoadLbf);
    hookload = referenceHookload + sign * appliedLoad;
    if (!Number.isFinite(hookload)) return fail('Calculated surface hookload exceeds numerical range.', 'numerical-limit');
    if (hookload < 0) return fail('Set-down exceeds reference hookload and would require an unsupported downward surface push.');
  }
  const jarIndex = input.jarIndex === undefined ? 0 : input.jarIndex;
  if (!Number.isSafeInteger(jarIndex) || jarIndex < 0) return fail('Select a nonnegative integer jar index.');
  const step = input.maxStepFt === undefined ? 5 : Number(input.maxStepFt);
  const tolerance = input.convergenceToleranceLbf === undefined ? 0.1 : Number(input.convergenceToleranceLbf);
  const maxRefinements = input.maxRefinements === undefined ? 6 : input.maxRefinements;
  if ((input.maxStepFt !== undefined && !finite(input.maxStepFt)) || !(step > 0 && Number.isFinite(step)) ||
      (input.convergenceToleranceLbf !== undefined && !finite(input.convergenceToleranceLbf)) || !(tolerance > 0 && Number.isFinite(tolerance)) ||
      !Number.isSafeInteger(maxRefinements) || maxRefinements < 1 || maxRefinements > 10) return fail('Supply positive integration step/tolerance and 1–10 convergence refinements.');
  if (!Array.isArray(bha?.rows) || !bha.rows.filter(populated).length || bha.rows.filter(populated).some(r =>
    !(r.category || r.toolName || r.selectedToolId) || !finite(r.weight) || Number(r.weight) < 0)) return fail('Every populated component needs identity and explicit nonnegative air weight per foot.');
  const deployment = deployDrillstring(bha, Number(input.bitMdFt), { surfaceMdFt: surface, deploymentMode: 'depth-dependent' });
  if (!deployment.valid) return fail(deployment.errors.join(' '), 'invalid-deployment');
  const positions = calcComponentPositions(deployment.bha);
  const bitMd = Number(input.bitMdFt);
  if (!Number.isFinite(positions.totalLength) || Math.abs(positions.totalLength - (bitMd - surface)) > 1e-7) return fail('The complete deployed string must extend from the surface reference to the bit; add an uppermost DP section or supply matching fixed-string depth.', 'invalid-deployment');
  if (surface < survey.summary.startMdFt || bitMd > survey.summary.endMdFt) return fail('Survey must cover the full deployed string from surface reference to bit; no extrapolation.', 'outside-survey');
  const jar = positions.components.filter(c => String(c.category).toUpperCase() === 'JAR')[jarIndex];
  if (!jar) return fail('Selected jar is unavailable.');
  const jarMd = bitMd - jar.centreFromBit;
  const sections = positions.components.map((c, componentIndex) => ({ componentIndex, topMdFt: Math.max(surface, bitMd - c.endFromBit),
    bottomMdFt: Math.min(jarMd, bitMd - c.startFromBit), buoyedWeightPerFt: c.weightPerFoot * bf }))
    .filter(c => c.bottomMdFt > c.topMdFt).reverse();
  if (!sections.length || sections.some(s => !Number.isFinite(s.buoyedWeightPerFt))) return fail('Surface-to-jar weight or geometry exceeds numerical range.', 'numerical-limit');
  const mu = Number(input.frictionCoefficient);
  let result = integrate(sections, survey, hookload, mu, sign, step);
  if (!result.valid) return result;
  let convergence = { required: result.curved && mu > 0, checked: false, maxStepFt: step, toleranceLbf: tolerance, refinements: 0, differenceLbf: 0 };
  if (convergence.required) {
    for (let i = 1; i <= maxRefinements; i += 1) {
      const refinedStep = step / 2 ** i, refined = integrate(sections, survey, hookload, mu, sign, refinedStep);
      if (!refined.valid) return refined;
      const jarDifference = Math.abs(refined.jarAxialLoadLbf - result.jarAxialLoadLbf);
      const refinedNodes = new Map(refined.profile.map(p => [p.mdFt, p.axialForceLbf]));
      let difference = jarDifference, checkedNodes = 0;
      for (const node of result.profile) {
        if (refinedNodes.has(node.mdFt)) { difference = Math.max(difference, Math.abs(refinedNodes.get(node.mdFt) - node.axialForceLbf)); checkedNodes += 1; }
      }
      convergence = { ...convergence, checked: true, maxStepFt: refinedStep, refinements: i, differenceLbf: difference,
        jarDifferenceLbf: jarDifference, sharedProfileNodesChecked: checkedNodes, coarseJarAxialLoadLbf: result.jarAxialLoadLbf };
      result = refined;
      if (difference <= tolerance) break;
      if (i === maxRefinements) return fail('Curved-section step refinement did not meet the requested force tolerance; no load returned.', 'unresolved-convergence');
    }
  }
  const referenceJar = referenceHookload === null ? null : -referenceHookload + result.gravityAxialLbf;
  const incremental = referenceJar === null ? null : sign * (referenceJar - result.jarAxialLoadLbf);
  const surfaceGeometry = evaluateSurveyAtMd(survey, surface);
  const warnings = [
    'Preliminary quasi-static screening; not operational guidance or a manufacturer operating limit.',
    'The lower assembly is assumed to provide the necessary reaction. Its support capacity and movement are not calculated.',
    'Fully mobilised nonrotating axial friction is assumed, not actual pre-slip friction or a measured parked state.',
    'Jar load is at its centre, including the upper half of the jar; it is not a manufacturer internal firing force.',
    'No impact, impulse, waves, stroke, time delay, pressure-end forces, buckling, lockup or contact stiffness is predicted.'
  ];
  if (hasMud) warnings.push('Buoyancy assumes steel density 65.5 ppg and equal internal/external fluid.');
  if (referenceHookload !== null) warnings.push('Reference jar load is an assumed frictionless baseline, not an actual measured parked state. Zero applied load does not imply zero change when friction becomes mobilised.');
  if (Math.abs(surfaceGeometry.inclinationDeg) > 1e-8) warnings.push('The surface reference is inclined: the entered boundary is local axial tensile support, not a vertical hookload reading.');
  if (result.profile.some(p => p.axialForceLbf > 1e-8)) warnings.push('Compression is propagated on the imposed survey centreline; physical stability of that compressed configuration is not established.');
  return { ...result, status: 'calculated', errors: [], warnings, direction, loadMode, bitMdFt: bitMd,
    surfaceMdFt: surface, surfaceHookloadLbf: hookload, referenceHookloadLbf: referenceHookload, appliedLoadLbf: appliedLoad,
    jarIndex, jarName: jar.toolName || 'JAR', jarFromBitFt: jar.centreFromBit, jarMdFt: jarMd,
    jarLoadState: Math.abs(result.jarAxialLoadLbf) <= 1e-8 ? 'neutral' : result.jarAxialLoadLbf > 0 ? 'compression' : 'tension',
    referenceJarAxialLoadLbf: referenceJar, incrementalTransferredLoadLbf: incremental,
    netUpwardTensileLoadLbf: Math.max(0, -result.jarAxialLoadLbf), netDownwardCompressiveLoadLbf: Math.max(0, result.jarAxialLoadLbf),
    buoyancyFactor: bf, frictionCoefficient: mu, deployment: deployment.metadata, convergence };
}
