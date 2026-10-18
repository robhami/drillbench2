import { calcComponentPositions } from '../bha/calcComponentPositions';
import { calcBuoyancyFactor } from './calcBuoyancy';
import { evaluateSurveyAtMd } from '../survey/surveyGeometry';

const finite = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value));
const stateOf = force => force > 0 ? 'compression' : force < 0 ? 'tension' : 'neutral';
const fail = (message, status = 'invalid-input') => ({ valid: false, status, errors: [message], warnings: [] });
const populated = row => row && ['category', 'toolName', 'selectedToolId', 'length', 'weight', 'od', 'id'].some(key => row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '');
const MAX_ELEMENTS = 100000;
const ZERO_FORCE = 1e-8;

// Shared by off-bottom pickup prediction; existing drilling paths are unchanged.
export function localGeometry(survey, mdFt) {
  const point = evaluateSurveyAtMd(survey, mdFt);
  const segment = survey.segments.find(s => mdFt >= s.fromMdFt && mdFt <= s.toMdFt);
  const angle = segment.doglegRad * (mdFt - segment.fromMdFt) / segment.lengthFt;
  const tangent = segment.tangent0.map((v, i) => Math.cos(angle) * v + Math.sin(angle) * segment.turn[i]);
  const curvature = segment.tangent0.map((v, i) => segment.doglegRad / segment.lengthFt * (-Math.sin(angle) * v + Math.cos(angle) * segment.turn[i]));
  return { ...point, tangent, curvature, curvaturePerFt: segment.doglegRad / segment.lengthFt };
}

// Implicit midpoint normal contact, with exact gravity integration on each arc.
export function integrateElement(bottomForce, gravity, weightPerFt, local, length, axialMu) {
  const contact = meanForce => {
    const resultant = local.tangent.map((t, i) => weightPerFt * ((i === 2 ? 1 : 0) - local.tangent[2] * t) - meanForce * local.curvature[i]);
    return { normal: Math.hypot(...resultant) * length, wallReaction: resultant.map(v => -v * length) };
  };
  let top = bottomForce - gravity;
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const normal = contact((bottomForce + top) / 2);
    const next = bottomForce - gravity + axialMu * normal.normal;
    if (!Number.isFinite(next) || !Number.isFinite(normal.normal)) return null;
    if (Math.abs(next - top) <= 1e-9 + 1e-12 * Math.max(Math.abs(bottomForce), Math.abs(next))) {
      const finalContact = contact((bottomForce + next) / 2);
      return { top: next, ...finalContact, iterations: iteration + 1 };
    }
    top = next;
  }
  return null;
}

/** Standalone drilling-only soft-string screening engine. See Stage2A study.
 * Explicit options are in ft/lbf/ppg/in/rev-min/ft-hr; BHA rows stay bottom-up.
 */
export function calcSurveyAxialLoads(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Operating inputs must be supplied as an object.');
  const { bha, survey, mode } = input;
  if (!survey?.valid || !survey.summary || !Array.isArray(survey.segments) || !survey.segments.length) return fail('A valid minimum-curvature survey geometry is required.');
  if (!['slide', 'rotate'].includes(mode)) return fail('Mode must be slide or rotate (downward drilling).');
  if (!finite(input.bitMdFt) || Number(input.bitMdFt) < 0) return fail('Bit MD must be explicitly supplied as a nonnegative depth in feet.');
  if (!finite(input.wobLbf) || Number(input.wobLbf) < 0) return fail('WOB must be explicitly supplied in lbf and be nonnegative.');
  if (!finite(input.frictionCoefficient) || Number(input.frictionCoefficient) < 0 || Number(input.frictionCoefficient) > 1) return fail('Axial friction coefficient must be explicitly supplied between 0 and 1.');
  const hasBf = input.buoyancyFactor !== undefined, hasMud = input.mudWeightPpg !== undefined;
  if (hasBf === hasMud) return fail('Specify exactly one of buoyancyFactor or mudWeightPpg.');
  if (hasBf && !finite(input.buoyancyFactor)) return fail('Buoyancy factor must be a finite number.');
  if (hasMud && (!finite(input.mudWeightPpg) || Number(input.mudWeightPpg) <= 0)) return fail('Mud weight must be positive, in ppg; use an explicit BF for zero-fluid-weight reference cases.');
  const bf = hasBf ? Number(input.buoyancyFactor) : calcBuoyancyFactor(Number(input.mudWeightPpg));
  if (!(bf > 0 && bf <= 1)) return fail('Buoyancy factor must be greater than zero and no greater than one.');
  if (mode === 'rotate' && (!finite(input.rpm) || Number(input.rpm) < 0 || !finite(input.ropFtHr) || Number(input.ropFtHr) <= 0)) return fail('Rotate requires explicitly supplied RPM ≥ 0 and ROP > 0 ft/hr.');
  const maxStep = input.maxStepFt === undefined ? 5 : Number(input.maxStepFt);
  if (!finite(maxStep) || maxStep <= 0) return fail('Maximum numerical step must be positive (ft).');
  if (!Array.isArray(bha?.rows) || !bha.rows.some(populated)) return fail('At least one populated BHA component is required.');
  const rows = [];
  for (let i = 0; i < bha.rows.length; i += 1) {
    const row = bha.rows[i];
    if (!populated(row)) continue; // Empty data-entry placeholders are not components.
    if (!(row.category || row.toolName || row.selectedToolId)) return fail(`BHA row ${i + 1}: component identity is required.`);
    if (!finite(row.length) || Number(row.length) <= 0 || !finite(row.weight) || Number(row.weight) < 0) return fail(`BHA row ${i + 1}: positive length (ft) and explicit nonnegative air weight (lbf/ft) are required.`);
    if (mode === 'rotate' && (!finite(row.od) || Number(row.od) <= 0)) return fail(`BHA row ${i + 1}: Rotate requires positive OD in inches.`);
    rows.push(row);
  }
  // Reuse the existing component-position source of truth; override only this
  // independent result's buoyancy from explicitly supplied operating inputs.
  const positions = calcComponentPositions({ ...bha, rows, mudWeight: hasMud ? input.mudWeightPpg : undefined });
  const components = positions.components.map(c => ({ ...c, length: Number(c.length), buoyancyFactor: bf, buoyedWeight: c.airWeight * bf }));
  if (!Number.isFinite(positions.totalLength) || components.some(c => !Number.isFinite(c.airWeight))) return fail('BHA length or weight exceeds numerical range.', 'numerical-limit');
  const bitMd = Number(input.bitMdFt), wob = Number(input.wobLbf), mu = Number(input.frictionCoefficient);
  const topMd = bitMd - positions.totalLength;
  if (!Number.isFinite(topMd) || topMd < survey.summary.startMdFt || bitMd > survey.summary.endMdFt) return fail('Entire BHA must lie within survey coverage; no extrapolation or partial-BHA substitution is supported.', 'outside-survey');
  if (positions.totalLength / maxStep > MAX_ELEMENTS) return fail('Requested step size exceeds the 100,000-element safeguard.', 'numerical-limit');
  const profile = [{ fromBitFt: 0, mdFt: bitMd, axialForceLbf: wob, state: stateOf(wob) }], elements = [];
  let force = wob;
  for (let ci = 0; ci < components.length; ci += 1) {
    const component = components[ci], weight = component.weightPerFoot * bf;
    const bottomMd = bitMd - component.startFromBit, componentTopMd = bitMd - component.endFromBit;
    if (!(bottomMd > componentTopMd)) return fail('Component length cannot be resolved at this measured depth.', 'numerical-limit');
    const knots = [component.startFromBit, component.endFromBit, component.centreFromBit,
      ...survey.stations.filter(s => s.mdFt > componentTopMd && s.mdFt < bottomMd).map(s => bitMd - s.mdFt)].sort((a, b) => a - b);
    const unique = [...new Set(knots)];
    component.bottomAxialForce = force;
    for (let k = 1; k < unique.length; k += 1) {
      const start = unique[k - 1], end = unique[k], middle = localGeometry(survey, bitMd - (start + end) / 2);
      const stepLimit = middle.curvaturePerFt > 0 ? Math.min(maxStep, 0.05 / middle.curvaturePerFt) : maxStep;
      const count = Math.ceil((end - start) / stepLimit);
      if (!Number.isFinite(count) || elements.length + count > MAX_ELEMENTS) return fail('Requested geometry/step size exceeds the 100,000-element safeguard.', 'numerical-limit');
      for (let j = 0; j < count; j += 1) {
        const from = j === 0 ? start : start + (end - start) * j / count, to = j === count - 1 ? end : start + (end - start) * (j + 1) / count, length = to - from;
        if (!(length > 0 && bitMd - from > bitMd - to)) return fail('Numerical step cannot be resolved at this measured depth.', 'numerical-limit');
        const lower = evaluateSurveyAtMd(survey, bitMd - from), upper = evaluateSurveyAtMd(survey, bitMd - to);
        const local = localGeometry(survey, bitMd - (from + to) / 2);
        const gravity = weight * (lower.tvdFt - upper.tvdFt);
        const tangential = mode === 'rotate' ? Math.PI * Number(component.od) * Number(input.rpm) * 5 : 0;
        if (!Number.isFinite(tangential)) return fail('Rotational surface velocity exceeds numerical range.', 'numerical-limit');
        const fraction = mode === 'rotate' ? Number(input.ropFtHr) / Math.hypot(Number(input.ropFtHr), tangential) : 1;
        const solved = integrateElement(force, gravity, weight, local, length, mu * fraction);
        if (!solved) return fail('Implicit normal-contact balance failed to converge or exceeded numerical range; refine the step and review inputs.', 'numerical-failure');
        const friction = mu * fraction * solved.normal, mean = (force + solved.top) / 2;
        elements.push({ componentIndex: ci, startFromBit: from, endFromBit: to, bottomMdFt: bitMd - from, topMdFt: bitMd - to, lengthFt: length, inclinationDeg: local.inclinationDeg, doglegDeg: local.curvaturePerFt * length * 180 / Math.PI, buoyedWeightLbf: weight * length, gravityAxialLbf: gravity, bottomAxialForce: force, topAxialForce: solved.top, normalGravityForceLbf: weight * Math.hypot(local.tangent[0], local.tangent[1]) * length, normalCurvatureForceLbf: Math.abs(mean) * local.curvaturePerFt * length, normalContactForceLbf: solved.normal, wallReactionVectorLbf: solved.wallReaction, axialFrictionFraction: fraction, frictionForceLbf: friction, frictionAxialDownholeLbf: -friction, iterations: solved.iterations });
        force = solved.top;
        profile.push({ fromBitFt: to, mdFt: bitMd - to, axialForceLbf: force, state: stateOf(force), componentIndex: ci });
      }
    }
    component.topAxialForce = force;
  }
  const neutralPoints = [], neutralIntervals = [];
  const addNeutral = (fromBitFt, componentIndex) => {
    if (!neutralPoints.some(n => Math.abs(n.fromBitFt - fromBitFt) < 1e-8)) neutralPoints.push({ fromBitFt, mdFt: bitMd - fromBitFt, componentIndex });
  };
  for (const element of elements) {
    const a = element.bottomAxialForce, b = element.topAxialForce, az = Math.abs(a) <= ZERO_FORCE, bz = Math.abs(b) <= ZERO_FORCE;
    if (az && bz) {
      const previous = neutralIntervals[neutralIntervals.length - 1];
      if (previous?.endFromBit === element.startFromBit) previous.endFromBit = element.endFromBit;
      else neutralIntervals.push({ startFromBit: element.startFromBit, endFromBit: element.endFromBit });
    } else {
      if (az) addNeutral(element.startFromBit, element.componentIndex);
      if (bz) addNeutral(element.endFromBit, element.componentIndex);
      if (!az && !bz && Math.sign(a) !== Math.sign(b)) addNeutral(element.startFromBit + a / (a - b) * element.lengthFt, element.componentIndex);
    }
  }
  const isolatedPoints = neutralPoints.filter(n => !neutralIntervals.some(interval => n.fromBitFt >= interval.startFromBit && n.fromBitFt <= interval.endFromBit));
  const jars = components.filter(c => String(c.category || '').toUpperCase() === 'JAR').map(c => {
    const node = profile.find(p => p.fromBitFt === c.centreFromBit);
    return { name: c.toolName || 'JAR', centreFromBitFt: c.centreFromBit, mdFt: bitMd - c.centreFromBit, axialForceLbf: node.axialForceLbf, separationsFromNeutralFt: isolatedPoints.length ? isolatedPoints.map(n => c.centreFromBit - n.fromBitFt) : null };
  });
  const warnings = ['Preliminary survey-based soft-string screening; not operational guidance or a fully validated torque-and-drag model.', 'No bending stiffness, buckling, clearance/contact redistribution, hydraulic pressure-end forces, dynamics or survey uncertainty.'];
  if (profile.some(p => p.axialForceLbf > ZERO_FORCE)) warnings.push('Compression is propagated along the imposed survey centreline; a buckled compressed BHA is not modelled.');
  if (hasMud) warnings.push('Mud-based buoyancy assumes steel density 65.5 ppg and equal internal/external fluid.');
  warnings.push(...(survey.warnings || []));
  return { valid: true, status: 'calculated', errors: [], warnings, mode, bitMdFt: bitMd, topMdFt: topMd, buoyancyFactor: bf, maxStepFt: maxStep, bitAxialForce: wob, topOfBhaAxialForce: force, components, profile, elements, neutralPoints: isolatedPoints, neutralIntervals, neutralStatus: neutralIntervals.length ? 'neutral-interval' : isolatedPoints.length ? 'crossings-found' : 'none-within-bha', jars, totalNormalContactForceLbf: elements.reduce((sum, e) => sum + e.normalContactForceLbf, 0), totalFrictionForceLbf: elements.reduce((sum, e) => sum + e.frictionForceLbf, 0) };
}
