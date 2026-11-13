// STATIC subset only. No Jar Up solver call or downward dynamics.
// OWS-Wenzel OM-HJDA-001 Release 2, pp. 7-8: P_open=deltaP*A opposes downward load.
// See docs/ValidationStudies/JarDownImpactModelStage5C7.md.
const numeric = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const text = v => typeof v === 'string' && v.trim().length > 0;
export const JAR_DOWN_NOTICE = 'PRELIMINARY — NOT FOR OPERATIONAL USE';

export function calcJarDownPreparation(input = {}) {
  const result = { valid: false, dynamicPredictionAvailable: false, notice: JAR_DOWN_NOTICE,
    pumpOpenForceLbf: null, netCompressionLbf: null, issues: [], warnings: [
      'Static balance only; no firing, dynamic force, impact velocity, pulse duration or impulse prediction.',
      'Compression transmission and buckling are not verified here. Existing soft-string results are pre-buckling static approximations.',
      'Manufacturer operating limits and the mechanical trip-force basis are not checked by this static balance.',
      'Tool-specific release, free-travel, moving mass and contact behaviour are not validated.'
    ] };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...result, issues: ['Provide Jar Down preparation inputs.'] };
  if (!['hydraulic', 'mechanical'].includes(input.mechanism)) result.issues.push(input.mechanism === 'unavailable'
    ? 'This jar is configured as unavailable for Jar Down.' : 'Configure the Jar Down mechanism in Jar Loading before assessing this tool.');
  if (!numeric(input.compressionLbf) || Number(input.compressionLbf) < 0) result.issues.push('Enter a nonnegative compression estimate at the jar.');
  if (!numeric(input.freeStrokeIn) || Number(input.freeStrokeIn) < 0) result.issues.push('Enter the manufacturer-defined free downward stroke, including explicit zero if applicable.');
  if (!text(input.compressionReference)) result.issues.push('Identify the source and applicability of the compression estimate.');
  if (!['at-jar-before-pump', 'at-jar-net', 'soft-string-before-pump'].includes(input.loadBasis)) result.issues.push(input.loadBasis === 'surface-slackoff'
    ? 'Surface slackoff is not compression at the jar. Establish transmission before using this input.' : 'Select an explicit at-jar load basis.');
  if (input.loadBasis !== 'at-jar-net') {
    if (!numeric(input.pressureDropPsi) || Number(input.pressureDropPsi) < 0) result.issues.push('Enter an explicit nonnegative manufacturer-defined pressure differential; zero means pumps off.');
    else if (Number(input.pressureDropPsi) > 0 && (!numeric(input.pumpOpenAreaIn2) || Number(input.pumpOpenAreaIn2) <= 0 || !text(input.manufacturerReference))) {
      result.issues.push('Positive pressure requires a positive manufacturer pump-open area and its tool-specific reference.');
    }
  }
  if (result.issues.length) return result;
  if (input.loadBasis === 'at-jar-net') {
    result.netCompressionLbf = Number(input.compressionLbf);
    result.warnings.push('Net at-jar input is already pressure-corrected; pump-open force is not independently established or subtracted again.');
  } else {
    result.pumpOpenForceLbf = Number(input.pressureDropPsi) === 0 ? 0 : Number(input.pressureDropPsi) * Number(input.pumpOpenAreaIn2);
    result.netCompressionLbf = Number(input.compressionLbf) - result.pumpOpenForceLbf;
  }
  if (!Number.isFinite(result.netCompressionLbf) || (result.pumpOpenForceLbf !== null && !Number.isFinite(result.pumpOpenForceLbf))) {
    return { ...result, pumpOpenForceLbf: null, netCompressionLbf: null, issues: ['Static balance exceeds numerical range.'] };
  }
  if (input.loadBasis === 'soft-string-before-pump') result.warnings.push('Conditional soft-string estimate: post-buckling/contact redistribution and the validity of transmitted compression remain unresolved.');
  const zeroStroke = Number(input.freeStrokeIn) === 0;
  result.valid = true;
  result.status = result.netCompressionLbf <= 0 ? 'Insufficient net compression' : zeroStroke ? 'Zero free stroke — no impact travel' : 'Conditional static balance only';
  if (result.netCompressionLbf <= 0) result.warnings.push('No positive net downward drive is established. Negative net compression means an opening/tensile load, not a downward impact.');
  if (zeroStroke) result.warnings.push('No free downward travel is entered; no stroke-impact calculation can be inferred.');
  return result;
}
