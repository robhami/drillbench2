export const BIT_AREA_ROUNDING_TOLERANCE_IN2 = 0.01;

const supplied = value => value !== '' && value !== null && value !== undefined;
const positive = value => supplied(value) && Number.isFinite(Number(value)) && Number(value) > 0;
const areaFromDimensions = (bodyOdIn, boreIdIn) => Math.PI / 4 * (Number(bodyOdIn) ** 2 - Number(boreIdIn) ** 2);

/** Resolves only the bit's structural/wave-model properties; nominal cutting OD is never used. */
export function resolveBitStructuralProperties(value = {}) {
  const p = value || {}, errors = [];
  const hasBody = supplied(p.bodyOdIn), hasBore = supplied(p.boreIdIn), hasDirectArea = supplied(p.equivalentAreaIn2);
  let calculatedAreaIn2 = null, equivalentAreaIn2 = null;
  if (hasBody !== hasBore) errors.push('Enter both structural body OD and structural bore ID, or leave both blank.');
  if (hasBody && hasBore) {
    if (!positive(p.bodyOdIn)) errors.push('Structural body OD must be positive (in).');
    if (!supplied(p.boreIdIn) || !Number.isFinite(Number(p.boreIdIn)) || Number(p.boreIdIn) < 0) errors.push('Structural bore ID must be zero or positive (in).');
    if (positive(p.bodyOdIn) && Number.isFinite(Number(p.boreIdIn)) && Number(p.boreIdIn) >= 0) {
      if (Number(p.bodyOdIn) <= Number(p.boreIdIn)) errors.push('Structural body OD must exceed structural bore ID.');
      else calculatedAreaIn2 = areaFromDimensions(p.bodyOdIn, p.boreIdIn);
    }
  }
  if (hasDirectArea && !positive(p.equivalentAreaIn2)) errors.push('Direct equivalent structural area must be positive (in²).');
  if (calculatedAreaIn2 != null) {
    equivalentAreaIn2 = calculatedAreaIn2;
    if (hasDirectArea && positive(p.equivalentAreaIn2) && Math.abs(Number(p.equivalentAreaIn2) - calculatedAreaIn2) > BIT_AREA_ROUNDING_TOLERANCE_IN2)
      errors.push(`Direct area conflicts with the calculated area (${calculatedAreaIn2.toFixed(3)} in²); calculated area takes precedence when dimensions are supplied.`);
  } else if (hasDirectArea && positive(p.equivalentAreaIn2)) equivalentAreaIn2 = Number(p.equivalentAreaIn2);
  const hasAnyStructuralValue = hasBody || hasBore || hasDirectArea || supplied(p.densityKgM3) || supplied(p.youngsModulusGPa);
  if (hasAnyStructuralValue && equivalentAreaIn2 == null) errors.push('Provide valid structural body OD and bore ID, or a direct equivalent area.');

  for (const [key, label] of [['densityKgM3', 'Material density (kg/m³)'], ['youngsModulusGPa', 'Young’s modulus (GPa)']]) {
    if (supplied(p[key]) && !positive(p[key])) errors.push(`${label} must be positive when supplied.`);
  }
  const hasAny = hasBody || hasBore || hasDirectArea || supplied(p.densityKgM3) || supplied(p.youngsModulusGPa) || Boolean(String(p.provenance || '').trim());
  if (hasAny && !String(p.provenanceType || '').trim()) errors.push('Select the structural-property source.');
  if (hasAny && !String(p.provenance || '').trim()) errors.push('Add a provenance note or reference.');
  return { valid: errors.length === 0, errors, hasAny, calculatedAreaIn2, equivalentAreaIn2,
    densityKgM3: positive(p.densityKgM3) ? Number(p.densityKgM3) : null,
    youngsModulusPa: positive(p.youngsModulusGPa) ? Number(p.youngsModulusGPa) * 1e9 : null,
    provenance: String(p.provenance || '').trim(), provenanceType: p.provenanceType || '' };
}

