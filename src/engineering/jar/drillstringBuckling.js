import { calcStaticJarLoads } from './staticJarLoads';
import { deployDrillstring } from '../bha/deployDrillstring';
import { calcComponentPositions } from '../bha/calcComponentPositions';
import { evaluateSurveyAtMd } from '../survey/surveyGeometry';

const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const warnings = [
  'Preliminary analytical screening, not operational guidance or a safe Jar Down force.',
  'Named long-tubular frictionless-onset criteria; finite-length, end-restraint and frictional stability effects are not resolved.',
  'The existing pre-buckling slack-off force profile is unchanged; no post-buckling redistribution is calculated.',
  'Below-jar buckling is not evaluated. The existing lower-assembly reaction assumption is retained.',
  'Exceeding an onset threshold is not a prediction of failure, release or firing.'
];

/** Local Dawson-Paslay / Chen-Lin-Cheatham idealized thresholds.
 * See docs/ValidationStudies/DrillstringBucklingStage4C.md for the restricted domain.
 * All dimensions are explicit: inches, feet, psi and lbf. No material defaults.
 */
export function calcBucklingThresholds(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const missingInputs = [];
  for (const key of ['odIn', 'youngsModulusPsi', 'wellboreDiameterIn', 'componentLengthFt']) {
    if (!finite(input[key]) || Number(input[key]) <= 0) missingInputs.push(key);
  }
  if (!finite(input.idIn) || Number(input.idIn) < 0 || Number(input.idIn) >= Number(input.odIn)) missingInputs.push('idIn');
  if (!finite(input.buoyedWeightPerFt) || Number(input.buoyedWeightPerFt) < 0) missingInputs.push('buoyedWeightPerFt');
  if (!finite(input.inclinationDeg) || Number(input.inclinationDeg) < 0 || Number(input.inclinationDeg) > 180) missingInputs.push('inclinationDeg');
  if (!finite(input.curvatureRadPerFt) || Number(input.curvatureRadPerFt) < 0) missingInputs.push('curvatureRadPerFt');
  const clearance = (Number(input.wellboreDiameterIn) - Number(input.odIn)) / 2;
  if (finite(input.wellboreDiameterIn) && finite(input.odIn) && !(clearance > 0)) missingInputs.push('positiveRadialClearance');
  const result = { applicability: 'unavailable', missingInputs, warnings: [], sinusoidalThresholdLbf: null,
    helicalThresholdLbf: null, momentOfInertiaIn4: null, bendingStiffnessLbfIn2: null,
    radialClearanceIn: Number.isFinite(clearance) ? clearance : null, criterion: 'Dawson-Paslay / Chen-Lin-Cheatham' };
  if (missingInputs.length) return result;
  const inertia = Math.PI / 64 * (Number(input.odIn) ** 4 - Number(input.idIn) ** 4);
  const stiffness = Number(input.youngsModulusPsi) * inertia;
  if (![inertia, stiffness].every(v => Number.isFinite(v) && v > 0)) {
    return { ...result, warnings: ['Bending stiffness arithmetic exceeds numerical range.'] };
  }
  Object.assign(result, { momentOfInertiaIn4: inertia, bendingStiffnessLbfIn2: stiffness });
  const reasons = [];
  if (Number(input.curvatureRadPerFt) !== 0) reasons.push('Curved interval: no supported curved-well criterion implemented.');
  if (!(Number(input.inclinationDeg) > 0 && Number(input.inclinationDeg) <= 90)) reasons.push('Vertical or over-horizontal interval: outside the implemented inclined-well criterion.');
  if (Number(input.buoyedWeightPerFt) === 0) reasons.push('Zero buoyed weight: gravity-supported criterion is not applicable.');
  if (input.bucklingIdealizationConfirmed !== true) reasons.push('Long, uniform, initially straight tubular, zero-torque and frictionless-onset idealization has not been confirmed for this component.');
  if (reasons.length) return { ...result, applicability: 'not-evaluated', warnings: reasons };
  const sinusoidal = 2 * Math.sqrt(stiffness * (Number(input.buoyedWeightPerFt) / 12) * Math.sin(Number(input.inclinationDeg) * Math.PI / 180) / clearance);
  const helical = Math.SQRT2 * sinusoidal;
  if (![inertia, stiffness, sinusoidal, helical].every(v => Number.isFinite(v) && v > 0)) {
    return { ...result, applicability: 'unavailable', warnings: ['Threshold arithmetic exceeds numerical range.'] };
  }
  return { ...result, applicability: 'applicable', sinusoidalThresholdLbf: sinusoidal, helicalThresholdLbf: helical };
}

const onset = (interval, threshold) => {
  if (interval.maximumCompressionLbf < threshold) return null;
  const { topAxialForceLbf: a, bottomAxialForceLbf: b, topMdFt, bottomMdFt } = interval;
  const mdFt = a >= threshold ? topMdFt : topMdFt + (bottomMdFt - topMdFt) * (threshold - a) / (b - a);
  return { mdFt, componentIndex: interval.componentIndex, componentId: interval.componentId,
    thresholdLbf: threshold, atIntervalTop: a >= threshold };
};

/** Calculation-only surface-to-selected-jar-centre Jar Down buckling screening.
 * Surface boundary, deployment, integration and compression sign come exclusively
 * from the existing static solver. No loads below jar centre are inferred.
 */
export function calcJarDownBuckling(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || (input.direction !== undefined && input.direction !== 'slackoff')) {
    return { valid: false, status: 'invalid-input', errors: ['Buckling screening requires Jar Down (slackoff) inputs.'], intervals: [] };
  }
  const staticLoads = calcStaticJarLoads({ ...input, direction: 'slackoff' });
  if (!staticLoads.valid) return { ...staticLoads, intervals: [] };
  const deployment = deployDrillstring(input.bha, staticLoads.bitMdFt, { surfaceMdFt: staticLoads.surfaceMdFt, deploymentMode: 'depth-dependent' });
  const { components } = calcComponentPositions(deployment.bha);
  const intervals = staticLoads.elements.map(element => {
    const c = components[element.componentIndex];
    const mdFt = element.bottomMdFt;
    const midpoint = (element.topMdFt + element.bottomMdFt) / 2;
    const segment = input.survey.segments.find(s => midpoint >= s.fromMdFt && midpoint <= s.toMdFt);
    const inclinationDeg = evaluateSurveyAtMd(input.survey, mdFt).inclinationDeg;
    const curvatureRadPerFt = segment.doglegRad / segment.lengthFt;
    const definition = c.componentDefinition;
    const unsupportedSection = definition && (definition.geometry?.kind === 'segmented' || definition.sectionModel === 'complex' || definition.effectiveProperties ||
      String(definition.material?.youngsModulusPsi ?? '').trim() !== '');
    const threshold = unsupportedSection ? { applicability: 'unavailable', missingInputs: ['validatedStructuralSection'],
      warnings: [`${c.toolName || c.category}: segmented/complex tool stiffness or explicit material properties are not integrated by the annular buckling model. Blade OD is not a solid annulus.`],
      sinusoidalThresholdLbf: null, helicalThresholdLbf: null, momentOfInertiaIn4: null, bendingStiffnessLbfIn2: null, radialClearanceIn: null } : calcBucklingThresholds({ odIn: c.od, idIn: c.idSize,
      youngsModulusPsi: c.youngsModulusPsi !== undefined ? c.youngsModulusPsi : input.youngsModulusPsi,
      wellboreDiameterIn: input.wellboreDiameterIn !== undefined ? input.wellboreDiameterIn : input.bha.holeSize,
      componentLengthFt: c.length, buoyedWeightPerFt: c.weightPerFoot * staticLoads.buoyancyFactor,
      inclinationDeg, curvatureRadPerFt, bucklingIdealizationConfirmed: c.bucklingIdealizationConfirmed });
    const maximumCompressionLbf = Math.max(0, element.topAxialForceLbf, element.bottomAxialForceLbf);
    let classification = threshold.applicability;
    if (threshold.applicability === 'applicable') {
      classification = maximumCompressionLbf === 0 ? 'no-compression'
        : maximumCompressionLbf >= threshold.helicalThresholdLbf ? 'helical-onset-reached'
          : maximumCompressionLbf >= threshold.sinusoidalThresholdLbf ? 'sinusoidal-onset-reached' : 'below-sinusoidal-onset';
    }
    return { ...element, ...threshold, mdFt, componentId: c.rowId ?? c.selectedToolId ?? `component-${element.componentIndex}`,
      componentName: c.toolName || c.category, componentLengthFt: Number(c.length), inclinationDeg, curvatureRadPerFt,
      buoyedWeightPerFt: c.weightPerFoot * staticLoads.buoyancyFactor,
      axialForceLbf: element.bottomAxialForceLbf,
      maximumCompressionLbf, classification,
      loadState: maximumCompressionLbf > 0 ? 'contains-compression' : element.topAxialForceLbf < 0 || element.bottomAxialForceLbf < 0 ? 'tension' : 'zero',
      sinusoidalUtilization: threshold.applicability === 'applicable' ? maximumCompressionLbf / threshold.sinusoidalThresholdLbf : null,
      helicalUtilization: threshold.applicability === 'applicable' ? maximumCompressionLbf / threshold.helicalThresholdLbf : null };
  });
  const applicable = intervals.filter(i => i.applicability === 'applicable');
  const first = key => applicable.map(i => onset(i, i[key])).find(Boolean) || null;
  const controlling = applicable.reduce((best, i) => !best || i.sinusoidalUtilization > best.sinusoidalUtilization ? i : best, null);
  const controllingMdFt = controlling ? controlling.topAxialForceLbf >= controlling.bottomAxialForceLbf ? controlling.topMdFt : controlling.bottomMdFt : null;
  return { valid: true, status: applicable.length === intervals.length ? 'calculated' : applicable.length ? 'partial' : intervals.some(i => i.applicability === 'unavailable') ? 'unavailable' : 'not-evaluated',
    errors: [], warnings: [...warnings, ...staticLoads.warnings],
    missingInputs: [...new Set(intervals.flatMap(i => i.missingInputs))],
    evaluatedDepthInterval: { topMdFt: staticLoads.surfaceMdFt, bottomMdFt: staticLoads.jarMdFt },
    staticLoads, intervals, summary: {
      firstSinusoidalOnset: first('sinusoidalThresholdLbf'), firstHelicalOnset: first('helicalThresholdLbf'),
      controllingComponentId: controlling?.componentId ?? null, controllingMdFt,
      maximumSinusoidalUtilization: controlling?.sinusoidalUtilization ?? null,
      maximumHelicalUtilization: controlling?.helicalUtilization ?? null,
      applicableIntervalCount: applicable.length, totalIntervalCount: intervals.length,
      completeCoverage: applicable.length === intervals.length
    } };
}
