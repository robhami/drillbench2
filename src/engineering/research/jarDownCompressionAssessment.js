// Research bridge only. Static forces/buckling/dynamics remain in their existing authorities.
import { calcStaticJarLoads } from '../jar/staticJarLoads';
import { calcJarDownBuckling } from '../jar/drillstringBuckling';
import { deployDrillstring } from '../bha/deployDrillstring';
import { evaluateSurveyAtMd } from '../survey/surveyGeometry';
import { simulateExtendedJarDown } from './jarDownExtendedDynamics';
import { copyResearchGeometry } from './researchJarGeometry';

const finite = v => ['number', 'string'].includes(typeof v) && String(v).trim() !== '' && Number.isFinite(Number(v));
export const compressionAssessmentKey = input => JSON.stringify(input);
export function matchingResearchShapes(expected, input) {
  if (expected.error) return false;
  const equal = (a, b) => Number.isFinite(Number(b)) && Math.abs(a - Number(b)) <= 64 * Number.EPSILON * Math.max(1, Math.abs(a));
  return ['upperRods', 'lowerRods'].every(side => expected[side].length === input?.[side]?.length && expected[side].every((r, i) => equal(r.lengthFt, input[side][i].lengthFt) && equal(r.areaIn2, input[side][i].areaIn2)));
}

// Pure assessment: no axial-force or buckling equations are implemented here.
export function assessCompressionCandidate({ staticResult, buckling, geometryValid, geometryError, dynamicDomain, survey }) {
  const issues = [], limitations = [
    'This is a static model estimate at the jar centre, not a firing threshold or measured delivered compression.',
    'Adoption prescribes equal initial compression on both ideal jar faces. It does not transfer the complete static stress/contact state.',
    'No demonstrated post-buckling transmission, wellbore contact dynamics, manufacturer release mechanism or field validation.',
    'No buckling warning is not evidence of stability or effective force transmission. Perfect axial guidance is imposed by the research model.'
  ];
  if (!staticResult?.valid) issues.push(...(staticResult?.errors || ['No current static calculation is available.']));
  if (!survey?.valid) issues.push('A current valid confirmed survey is required.');
  if (staticResult?.valid && (!Number.isFinite(staticResult.surfaceHookloadLbf) || staticResult.surfaceHookloadLbf < 0 ||
    !Number.isFinite(staticResult.jarMdFt) || !(staticResult.jarMdFt > staticResult.surfaceMdFt && staticResult.jarMdFt < staticResult.bitMdFt) ||
    !Number.isFinite(staticResult.frictionCoefficient) || !Number.isFinite(staticResult.buoyancyFactor))) issues.push('Static force boundary, location or material/friction provenance is invalid.');
  if (!geometryValid) issues.push(geometryError || 'Current BHA/stuck-point shapes do not match the research rods; copy compatible BHA shapes and reassess.');
  const force = staticResult?.valid && Number.isFinite(staticResult.jarAxialLoadLbf) ? staticResult.jarAxialLoadLbf : null;
  if (staticResult?.valid && staticResult.direction !== 'slackoff') issues.push('Only the explicit nonrotating slack-off static case is eligible; pickup, drilling Slide/Rotate and pure rotation are not Jar Down boundary substitutes.');
  if (force === null) issues.push('Jar axial force is unavailable.');
  else if (force < 0) issues.push('Static jar force is tensile; its magnitude must not be adopted as compression.');
  else if (force === 0) issues.push('Static jar force is exactly zero; there is no positive static compression candidate.');
  if (!dynamicDomain?.valid) issues.push(dynamicDomain?.error || 'Dynamic research-model inputs have not passed the existing solver domain check.');
  const onset = Boolean(buckling?.summary?.firstSinusoidalOnset || buckling?.summary?.firstHelicalOnset);
  const directional = Boolean(survey?.stations?.some(s => s.inclinationDeg !== 0));
  if (directional) limitations.push('Directional survey: fully mobilised static friction/contact and imposed centreline do not establish actual compression transfer to an axially guided dynamic string.');
  if (onset) limitations.push('Existing buckling onset screening is exceeded. Pre-buckling static compression is not proof of post-buckling transfer.');
  if (!buckling?.valid || !buckling.summary?.completeCoverage) limitations.push('Buckling screening is unavailable or incomplete, including excluded vertical/curved/unconfirmed sections and all below-jar response. No stability conclusion follows.');
  return { classification: issues.length ? 'Unsupported' : directional || onset ? 'Research with significant limitations' : 'Compatible for idealised research',
    canAdopt: issues.length === 0, issues: [...new Set(issues)], limitations,
    staticForceLbf: force, staticCompressionLbf: force === null ? null : Math.max(0, force), bucklingOnset: onset,
    bucklingStatus: buckling?.status || 'Not Evaluated', staticResult,
    provenance: 'calcStaticJarLoads → surface-to-jar-centre equilibrium; calcJarDownBuckling reuses that static result. Compression positive; lbf.' };
}

// Called off-thread; reuses the existing complete-deployment/coverage checks.
export function calculateCompressionAssessment(input) {
  const { bha, survey, bitMdFt, surfaceMdFt, boundary, researchInput, stuckFt } = input;
  const request = { bha, survey, bitMdFt, surfaceMdFt, direction: boundary.direction, loadMode: 'absolute', jarIndex: 0,
    surfaceHookloadLbf: finite(boundary.hookloadKlbf) ? Number(boundary.hookloadKlbf) * 1000 : '',
    mudWeightPpg: bha?.mudWeight, frictionCoefficient: bha?.frictionCoefficient };
  const buckling = boundary.direction === 'slackoff' ? calcJarDownBuckling(request) : null;
  const staticResult = buckling?.staticLoads || (buckling && !buckling.valid ? buckling : calcStaticJarLoads(request));
  const deployed = deployDrillstring(bha, bitMdFt, { surfaceMdFt });
  const jars = deployed.valid ? deployed.bha.rows.filter(r => String(r.category).toUpperCase() === 'JAR') : [];
  const shape = deployed.valid ? copyResearchGeometry(deployed.bha, stuckFt) : { error: deployed.errors.join(' ') };
  const geometryValid = jars.length === 1 && matchingResearchShapes(shape, researchInput);
  const dynamicDomain = geometryValid && staticResult.valid && staticResult.jarAxialLoadLbf > 0
    ? simulateExtendedJarDown({ ...researchInput, compressionLbf: staticResult.jarAxialLoadLbf }) : { valid: false, error: 'A positive current static force and matching geometry are required before dynamic domain verification.' };
  const assessment = assessCompressionCandidate({ staticResult, buckling, geometryValid, geometryError: jars.length !== 1 ? 'Exactly one jar is required for this research bridge.' : shape.error, dynamicDomain, survey });
  return { ...assessment, inclinationDeg: staticResult.valid ? evaluateSurveyAtMd(survey, staticResult.jarMdFt).inclinationDeg : null,
    buckling: buckling ? { valid: buckling.valid, status: buckling.status, summary: buckling.summary, missingInputs: buckling.missingInputs, warnings: buckling.warnings } : null };
}
