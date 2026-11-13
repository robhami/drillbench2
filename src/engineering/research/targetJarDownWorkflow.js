// Orchestration only: unchanged inverse, buckling and characteristic engines.
import { solveStaticJarHookload } from '../jar/inverseStaticJarLoads';
import { calcJarDownBuckling } from '../jar/drillstringBuckling';
import { deployDrillstring } from '../bha/deployDrillstring';
import { copyResearchGeometry } from './researchJarGeometry';
import { simulateExtendedJarDown } from './jarDownExtendedDynamics';
import { assessCompressionCandidate } from './jarDownCompressionAssessment';
import { calcOffBottomRotatingSummary } from '../forces/calcOffBottomHookloads';
import { targetReferenceContext } from './targetJarDownReferences';
const numeric = v => String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN;

export function calculateTargetStatic(input) {
  const { bha, survey, bitMdFt, surfaceMdFt, targetKlbf, settings } = input;
  if ((bha?.rows || []).filter(r => String(r.category).toUpperCase() === 'JAR').length > 1) return { valid: false, errors: ['The simplified target workflow requires exactly one jar; no jar is selected implicitly in a multi-jar BHA.'] };
  const desiredJarForceLbf = numeric(targetKlbf) * 1000;
  const request = { bha, survey, bitMdFt, surfaceMdFt, jarIndex: 0, jarDirection: 'down', desiredJarForceLbf,
    mudWeightPpg: bha?.mudWeight, frictionCoefficient: bha?.frictionCoefficient };
  const inverse = solveStaticJarHookload(request);
  if (!inverse.valid) return { valid: false, errors: inverse.errors, inverse };
  const buckling = calcJarDownBuckling({ ...request, direction: 'slackoff', loadMode: 'absolute', surfaceHookloadLbf: inverse.requiredSurfaceHookloadLbf });
  const hookloads = calcOffBottomRotatingSummary({ bha, survey, bitMdFt, surfaceMdFt,
    mudWeightPpg: bha?.mudWeight, frictionCoefficient: bha?.frictionCoefficient, rpm: bha?.rpm });
  const referenceCandidates = hookloads.slackOffHookload.valid ? [{ id: 'calculated-slackoff',
    sourceModule: 'Hookload Calculations', method: 'calcOffBottomRotatingSummary', condition: 'Nonrotating off-bottom slack-off (zero bit/end load)',
    loadCase: 'slackoff', rotationRpm: 0, valueLbf: hookloads.slackOffHookload.valueLbf, units: 'lbf',
    boundaryDefinition: 'net-upward-local-axial-support', context: targetReferenceContext(input),
    bhaName: bha?.name || bha?.id, surfaceMdFt: Number(surfaceMdFt), bitMdFt: Number(bitMdFt) }] : [];
  const deployment = deployDrillstring(bha, bitMdFt, { surfaceMdFt });
  const shape = deployment.valid ? copyResearchGeometry(deployment.bha, settings.stuckPointFt) : { error: deployment.errors.join(' ') };
  const errors = shape.error ? [shape.error] : [];
  const values = Object.fromEntries(['strokeIn', 'youngsModulusPsi', 'densitySlugFt3', 'gravityFtS2', 'horizonS'].map(k => [k, numeric(settings[k])]));
  if (Object.entries(values).some(([k, v]) => !Number.isFinite(v) || (k === 'gravityFtS2' ? v < 0 : v <= 0))) errors.push('Review explicit stroke and research material/time/gravity settings in Advanced Research Settings. Blank values are not zero.');
  const dynamicInput = errors.length ? null : { model: 'ideal-guided-extended-contact', compressionLbf: desiredJarForceLbf,
    strokeIn: values.strokeIn, gravityFtS2: values.gravityFtS2, horizonS: values.horizonS,
    upperRods: shape.upperRods.map(r => ({ ...r, youngsModulusPsi: values.youngsModulusPsi, densitySlugFt3: values.densitySlugFt3 })),
    lowerRods: shape.lowerRods.map(r => ({ ...r, youngsModulusPsi: values.youngsModulusPsi, densitySlugFt3: values.densitySlugFt3 })) };
  return { valid: true, inverse, buckling, dynamicInput, dynamicErrors: errors, referenceCandidates,
    referenceUnavailable: hookloads.slackOffHookload.valid ? null : hookloads.slackOffHookload.reason,
    limitations: ['Perfect axial guidance, fixed surface and bilateral fixed stuck boundary; no validated real-tool firing mechanism.',
      'Confirmation prescribes the target equally on both ideal faces; full static stress, excluded jar weight/span and wall contact are not transferred.',
      'Static jar-centre force does not establish delivered compression after buckling or in a directional well.',
      ...(survey?.stations?.some(s => s.inclinationDeg !== 0) ? ['Directional-well static friction is not represented by the ideal dynamic rods.'] : []),
      ...(buckling?.summary?.firstSinusoidalOnset || buckling?.summary?.firstHelicalOnset ? ['Existing buckling onset screening is exceeded; post-buckling transfer is not established.'] : []),
      ...(!buckling?.valid || !buckling.summary?.completeCoverage ? ['Buckling screening is unavailable/incomplete; absence of a warning is not proof of stability.'] : [])] };
}

export function calculateTargetDynamics(staticOutcome, survey, confirmed) {
  if (confirmed !== true) return { valid: false, error: 'Explicit confirmation of the prescribed target initial condition is required.' };
  if (!staticOutcome?.valid || !staticOutcome.dynamicInput) return { valid: false, error: 'A current supported static result and BHA geometry are required.' };
  const result = simulateExtendedJarDown(staticOutcome.dynamicInput);
  if (result.valid && result.contact.motion.length + result.noContact.motion.length > 10000) return { valid: false, error: 'History exceeds the research visualization event limit. Shorten the horizon; no partial dynamic results are displayed.' };
  const assessment = assessCompressionCandidate({ staticResult: staticOutcome.inverse.forwardResult, buckling: staticOutcome.buckling,
    geometryValid: true, dynamicDomain: result, survey });
  return assessment.canAdopt ? { ...result, assessment } : { valid: false, error: assessment.issues.join(' '), assessment };
}
