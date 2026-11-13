// Reference identity/compatibility only; no force equations.
export const targetReferenceContext = input => JSON.stringify({ bha: input.bha, survey: input.survey,
  bitMdFt: Number(input.bitMdFt), surfaceMdFt: Number(input.surfaceMdFt), loadCase: input.loadCase || 'slackoff' });
export function compatibleTargetReference(reference, input) {
  return Boolean(reference && reference.context === targetReferenceContext(input) && reference.units === 'lbf' &&
    reference.boundaryDefinition === 'net-upward-local-axial-support' && reference.loadCase === 'slackoff' &&
    reference.rotationRpm === 0 && Number.isFinite(reference.valueLbf) && reference.valueLbf >= 0 &&
    (!input.loadCase || input.loadCase === 'slackoff'));
}
