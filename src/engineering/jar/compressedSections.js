import { calcStaticJarLoads } from './staticJarLoads';
import { deployDrillstring } from '../bha/deployDrillstring';
import { calcComponentPositions } from '../bha/calcComponentPositions';
import { evaluateSurveyAtMd } from '../survey/surveyGeometry';

const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const fail = message => ({ valid: false, status: 'invalid-input', errors: [message], compressedIntervals: [] });
export const COMPRESSED_SECTION_TOLERANCES = Object.freeze({ forceLbf: 1e-8, mdFt: 1e-8, inclinationDeg: 1e-8, curvatureRadPerFt: 1e-12 });
const state = (force, tolerance) => Math.abs(force) <= tolerance ? 'zero' : force > 0 ? 'compression' : 'tension';

/** Piecewise-linear interpretation of calculated samples, not a force solver.
 * Zero samples separate strictly compressed sections, including a zero touch.
 */
export function identifyLoadRegions(profile, { forceToleranceLbf = COMPRESSED_SECTION_TOLERANCES.forceLbf } = {}) {
  if (!finite(forceToleranceLbf) || Number(forceToleranceLbf) < 0) return fail('Force tolerance must be finite and nonnegative.');
  if (!Array.isArray(profile) || profile.length < 2 || profile.some((p, i) =>
    !p || !Number.isFinite(p.mdFt) || p.mdFt < 0 || !Number.isFinite(p.axialForceLbf) || (i > 0 && !(p.mdFt > profile[i - 1].mdFt)))) {
    return fail('Supply at least two finite, strictly increasing axial-force samples.');
  }
  const tolerance = Number(forceToleranceLbf), regions = [], zeroForceEvents = [];
  const append = (topMdFt, bottomMdFt, loadState, topForce, bottomForce, joinIsZero) => {
    const candidate = topForce >= bottomForce ? { axialForceLbf: topForce, mdFt: topMdFt } : { axialForceLbf: bottomForce, mdFt: bottomMdFt };
    const last = regions[regions.length - 1];
    if (last && last.loadState === loadState && last.bottomMdFt === topMdFt && (!joinIsZero || loadState === 'zero')) {
      last.bottomMdFt = bottomMdFt; last.lengthFt = bottomMdFt - last.topMdFt;
      if (candidate.axialForceLbf > last.maximumAxialForceLbf) Object.assign(last, { maximumAxialForceLbf: candidate.axialForceLbf, maximumCompressionMdFt: candidate.mdFt });
    } else regions.push({ topMdFt, bottomMdFt, lengthFt: bottomMdFt - topMdFt, loadState,
      maximumAxialForceLbf: candidate.axialForceLbf, maximumCompressionMdFt: candidate.mdFt });
  };
  for (let i = 1; i < profile.length; i += 1) {
    const a = profile[i - 1], b = profile[i], sa = state(a.axialForceLbf, tolerance), sb = state(b.axialForceLbf, tolerance);
    if (sa !== 'zero' && sb !== 'zero' && sa !== sb) {
      // Ratio form avoids overflow when finite endpoint forces have opposite signs.
      const scale = Math.max(Math.abs(a.axialForceLbf), Math.abs(b.axialForceLbf));
      const fraction = (Math.abs(a.axialForceLbf) / scale) / (Math.abs(a.axialForceLbf) / scale + Math.abs(b.axialForceLbf) / scale);
      const mdFt = a.mdFt + (b.mdFt - a.mdFt) * fraction;
      if (!(mdFt > a.mdFt && mdFt < b.mdFt)) return fail('Zero crossing cannot be resolved between the supplied sample depths.');
      append(a.mdFt, mdFt, sa, a.axialForceLbf, 0, false);
      append(mdFt, b.mdFt, sb, 0, b.axialForceLbf, true);
      zeroForceEvents.push({ type: 'interpolated-crossing', mdFt, fromState: sa, toState: sb,
        bracket: { topMdFt: a.mdFt, bottomMdFt: b.mdFt }, interpolated: true });
    } else append(a.mdFt, b.mdFt, sa === 'zero' ? sb : sa, a.axialForceLbf, b.axialForceLbf, sa === 'zero');
  }
  for (let i = 0; i < profile.length; i += 1) {
    if (state(profile[i].axialForceLbf, tolerance) !== 'zero') continue;
    const first = i;
    while (i + 1 < profile.length && state(profile[i + 1].axialForceLbf, tolerance) === 'zero') i += 1;
    const before = first > 0 ? state(profile[first - 1].axialForceLbf, tolerance) : null;
    const after = i + 1 < profile.length ? state(profile[i + 1].axialForceLbf, tolerance) : null;
    const plateau = first !== i;
    zeroForceEvents.push({ type: plateau ? 'zero-plateau' : before && after ? before === after ? 'zero-touch' : 'sample-crossing' : 'zero-boundary',
      mdFt: plateau ? null : profile[first].mdFt, topMdFt: profile[first].mdFt, bottomMdFt: profile[i].mdFt,
      fromState: before, toState: after, interpolated: false,
      numericalZero: profile.slice(first, i + 1).some(p => p.axialForceLbf !== 0) });
  }
  zeroForceEvents.sort((a, b) => (a.mdFt ?? a.topMdFt) - (b.mdFt ?? b.topMdFt));
  const compressedIntervals = regions.filter(r => r.loadState === 'compression').map(r => ({ ...r, maximumCompressionLbf: r.maximumAxialForceLbf }));
  return { valid: true, status: 'identified', regions, compressedIntervals, zeroForceEvents,
    zeroForceCrossings: zeroForceEvents.filter(e => e.fromState && e.toState && e.fromState !== e.toState),
    totalCompressedLengthFt: compressedIntervals.reduce((sum, r) => sum + r.lengthFt, 0), forceToleranceLbf: tolerance };
}

function properties(c, input, buoyancyFactor) {
  const missingInputs = [];
  const read = (value, key, positive = true) => {
    if (!finite(value) || (positive ? Number(value) <= 0 : Number(value) < 0)) { missingInputs.push(key); return null; }
    return Number(value);
  };
  const odIn = read(c.od, 'odIn'), idIn = read(c.idSize, 'idIn', false);
  if (idIn !== null && odIn !== null && idIn >= odIn) missingInputs.push('idInLessThanOd');
  const youngsModulusPsi = read(c.youngsModulusPsi !== undefined ? c.youngsModulusPsi : input.youngsModulusPsi, 'youngsModulusPsi');
  const wellboreDiameterIn = read(c.wellboreDiameterIn !== undefined ? c.wellboreDiameterIn
    : input.wellboreDiameterIn !== undefined ? input.wellboreDiameterIn : input.bha.holeSize, 'wellboreDiameterIn');
  const radialClearanceIn = odIn !== null && wellboreDiameterIn !== null ? (wellboreDiameterIn - odIn) / 2 : null;
  if (radialClearanceIn !== null && radialClearanceIn <= 0) missingInputs.push('positiveRadialClearance');
  const momentOfInertiaIn4 = odIn !== null && idIn !== null && idIn < odIn ? Math.PI / 64 * (odIn ** 4 - idIn ** 4) : null;
  const ei = momentOfInertiaIn4 !== null && youngsModulusPsi !== null ? momentOfInertiaIn4 * youngsModulusPsi : null;
  if (momentOfInertiaIn4 !== null && (!Number.isFinite(momentOfInertiaIn4) || momentOfInertiaIn4 <= 0)) missingInputs.push('finiteMomentOfInertia');
  if (ei !== null && (!Number.isFinite(ei) || ei <= 0)) missingInputs.push('finiteBendingStiffness');
  return { odIn, idIn, componentLengthFt: Number(c.length), youngsModulusPsi, wellboreDiameterIn, radialClearanceIn,
    momentOfInertiaIn4: Number.isFinite(momentOfInertiaIn4) ? momentOfInertiaIn4 : null,
    bendingStiffnessLbfIn2: Number.isFinite(ei) ? ei : null,
    buoyedWeightPerFt: c.weightPerFoot * buoyancyFactor, missingInputs };
}

function localGeometry(survey, segment, mdFt, tolerances) {
  const point = evaluateSurveyAtMd(survey, mdFt), rate = segment.doglegRad / segment.lengthFt;
  const angle = rate * (mdFt - segment.fromMdFt);
  const t = segment.tangent0.map((v, i) => Math.cos(angle) * v + Math.sin(angle) * segment.turn[i]);
  const dt = segment.tangent0.map((v, i) => rate * (-Math.sin(angle) * v + Math.cos(angle) * segment.turn[i]));
  const lateral = Math.hypot(t[0], t[1]);
  const inclinationRate = lateral > 1e-15 ? -dt[2] / lateral : 0;
  const turnRate = lateral > 1e-15 ? (t[0] * dt[1] - t[1] * dt[0]) / lateral : 0;
  let classification;
  if (rate <= tolerances.curvatureRadPerFt) {
    classification = point.inclinationDeg <= tolerances.inclinationDeg ? 'vertical'
      : Math.abs(point.inclinationDeg - 90) <= tolerances.inclinationDeg ? 'horizontal' : 'straight-inclined';
  } else {
    const build = Math.abs(inclinationRate) > tolerances.curvatureRadPerFt;
    const turn = Math.abs(turnRate) > tolerances.curvatureRadPerFt;
    classification = turn && build ? 'mixed' : turn ? 'azimuthal-turn' : build ? inclinationRate > 0 ? 'build' : 'drop' : 'mixed';
  }
  const features = classification === 'mixed' ? [
    ...(Math.abs(inclinationRate) > tolerances.curvatureRadPerFt ? [inclinationRate > 0 ? 'build' : 'drop'] : []),
    ...(Math.abs(turnRate) > tolerances.curvatureRadPerFt ? ['azimuthal-turn'] : [])
  ] : [classification];
  return { classification, features, sampleMdFt: mdFt, inclinationDeg: point.inclinationDeg, azimuthDeg: point.azimuthDeg,
    curvatureRadPerFt: rate, inclinationRateRadPerFt: inclinationRate, azimuthalCurvatureRadPerFt: turnRate,
    // Tolerant labels never relax Stage 4C's exact straight-geometry requirement.
    geometricallyEligible: rate === 0 && point.inclinationDeg > 0 && point.inclinationDeg <= 90 };
}

// Minimum-curvature arcs can reverse build/drop within a station interval.
function inclinationExtrema(segment) {
  if (!(segment.doglegRad > 0)) return [];
  const phase = Math.atan2(segment.turn[2], segment.tangent0[2]), depths = [];
  for (let n = -1; n <= 2; n += 1) {
    const angle = phase + n * Math.PI;
    if (angle > 0 && angle < segment.doglegRad) depths.push(segment.fromMdFt + segment.lengthFt * angle / segment.doglegRad);
  }
  return depths;
}

/** Geometry/load-profile analysis only; no buckling thresholds are evaluated. */
export function identifyCompressedSections(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || (input.direction !== undefined && input.direction !== 'slackoff')) return fail('Supply Jar Down (slackoff) inputs.');
  const tolerances = { ...COMPRESSED_SECTION_TOLERANCES, ...input.tolerances };
  if (Object.values(tolerances).some(v => !finite(v) || Number(v) < 0)) return fail('Classification tolerances must be finite and nonnegative.');
  const staticLoads = calcStaticJarLoads({ ...input, direction: 'slackoff' });
  if (!staticLoads.valid) return { ...staticLoads, compressedIntervals: [] };
  const loads = identifyLoadRegions(staticLoads.profile, { forceToleranceLbf: tolerances.forceLbf });
  if (!loads.valid) return loads;
  const deployment = deployDrillstring(input.bha, staticLoads.bitMdFt, { surfaceMdFt: staticLoads.surfaceMdFt, deploymentMode: 'depth-dependent' });
  const components = calcComponentPositions(deployment.bha).components;
  const propertyCache = components.map(c => properties(c, input, staticLoads.buoyancyFactor));
  const changedKeys = ['odIn', 'idIn', 'componentLengthFt', 'youngsModulusPsi', 'bendingStiffnessLbfIn2', 'wellboreDiameterIn', 'radialClearanceIn', 'buoyedWeightPerFt'];
  let elementCursor = 0;
  const compressedIntervals = loads.compressedIntervals.map(interval => {
    const segments = [];
    while (elementCursor < staticLoads.elements.length && staticLoads.elements[elementCursor].bottomMdFt <= interval.topMdFt) elementCursor += 1;
    for (let elementIndex = elementCursor; elementIndex < staticLoads.elements.length; elementIndex += 1) {
      const element = staticLoads.elements[elementIndex];
      if (element.topMdFt >= interval.bottomMdFt) break;
      const top = Math.max(interval.topMdFt, element.topMdFt), bottom = Math.min(interval.bottomMdFt, element.bottomMdFt);
      if (!(bottom > top)) continue;
      const surveySegment = input.survey.segments.find(s => (top + bottom) / 2 >= s.fromMdFt && (top + bottom) / 2 <= s.toMdFt);
      const knots = [top, ...inclinationExtrema(surveySegment).filter(md => md > top + Number(tolerances.mdFt) && md < bottom - Number(tolerances.mdFt)), bottom].sort((a, b) => a - b);
      for (let i = 1; i < knots.length; i += 1) {
        const topMdFt = knots[i - 1], bottomMdFt = knots[i], componentIndex = element.componentIndex;
        const c = components[componentIndex], geometry = localGeometry(input.survey, surveySegment, (topMdFt + bottomMdFt) / 2, tolerances);
        const p = propertyCache[componentIndex], previous = segments[segments.length - 1];
        if (previous && previous.componentIndex === componentIndex && previous.bottomMdFt === topMdFt && previous.geometry.classification === geometry.classification && previous.geometry.features.join() === geometry.features.join() && previous.surveySegmentIndex === input.survey.segments.indexOf(surveySegment)) {
          previous.bottomMdFt = bottomMdFt; previous.lengthFt = bottomMdFt - previous.topMdFt;
        } else segments.push({ topMdFt, bottomMdFt, lengthFt: bottomMdFt - topMdFt, componentIndex,
          componentId: c.rowId ?? c.selectedToolId ?? `component-${componentIndex}`, componentName: c.toolName || c.category,
          componentTopMdFt: staticLoads.bitMdFt - c.endFromBit, componentBottomMdFt: staticLoads.bitMdFt - c.startFromBit,
          surveySegmentIndex: input.survey.segments.indexOf(surveySegment), geometry, properties: p,
          screening: { criterion: 'Stage 4C straight-well screening', geometricallyEligible: geometry.geometricallyEligible,
            requiredInputsAvailable: p.missingInputs.length === 0, idealizationConfirmed: c.bucklingIdealizationConfirmed === true,
            fullyEvaluated: false, evaluationStatus: 'not-evaluated' } });
      }
    }
    const componentBoundaries = [], geometryTransitions = [], tubularPropertyTransitions = [];
    segments.slice(1).forEach((current, i) => {
      const previous = segments[i], mdFt = current.topMdFt;
      if (current.componentIndex !== previous.componentIndex) componentBoundaries.push({ mdFt, fromComponentIndex: previous.componentIndex, toComponentIndex: current.componentIndex,
        fromComponentId: previous.componentId, toComponentId: current.componentId });
      if (current.geometry.classification !== previous.geometry.classification) geometryTransitions.push({ mdFt, from: previous.geometry.classification, to: current.geometry.classification });
      else if (current.geometry.features.join() !== previous.geometry.features.join()) geometryTransitions.push({ mdFt, from: previous.geometry.classification, to: current.geometry.classification,
        fromFeatures: previous.geometry.features, toFeatures: current.geometry.features });
      const changes = changedKeys.filter(key => previous.properties[key] !== current.properties[key]).map(key => ({ property: key, from: previous.properties[key], to: current.properties[key] }));
      if (changes.length) tubularPropertyTransitions.push({ mdFt, fromComponentIndex: previous.componentIndex, toComponentIndex: current.componentIndex, changes });
    });
    const geometryTypes = [...new Set(segments.map(s => s.geometry.classification))];
    return { ...interval, segments, componentBoundaries, geometryTransitions, tubularPropertyTransitions,
      geometryClassification: geometryTypes.length === 1 ? geometryTypes[0] : 'mixed', geometryTypes,
      zeroForceEvents: loads.zeroForceEvents.filter(e => (e.mdFt ?? e.bottomMdFt) >= interval.topMdFt && (e.mdFt ?? e.topMdFt) <= interval.bottomMdFt),
      missingInputs: segments.filter(s => s.properties.missingInputs.length).map(s => ({ componentIndex: s.componentIndex, componentId: s.componentId, topMdFt: s.topMdFt, bottomMdFt: s.bottomMdFt, inputs: s.properties.missingInputs })),
      fullyEvaluated: false, evaluationStatus: 'not-evaluated' };
  });
  return { ...loads, compressedIntervals, tolerances, errors: [],
    evaluatedDepthInterval: { topMdFt: staticLoads.surfaceMdFt, bottomMdFt: staticLoads.jarMdFt },
    missingInputs: compressedIntervals.flatMap(i => i.missingInputs), staticLoads,
    warnings: ['Preliminary geometry and load-profile analysis; no buckling model or safe operating limit is evaluated.',
      'Zero crossings and extrema refer to the piecewise-linear sampled profile. Curved-section crossings are bracketed estimates, not newly integrated roots.',
      'Geometric eligibility does not establish boundary conditions, sufficient compressed length or model validity.', ...staticLoads.warnings] };
}
