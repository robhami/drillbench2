// Stage 6A data contract. Imperial units match existing BHA rows.
import { resolveBitStructuralProperties } from './bitStructuralProperties';
export const COMPONENT_SCHEMA_VERSION = 1;
export const SEGMENT_LENGTH_TOLERANCE_FT = 1e-6;
export const cloneDefinition = value => JSON.parse(JSON.stringify(value));
export const componentId = () => `custom-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const finite = x => x !== '' && x !== null && x !== undefined && Number.isFinite(Number(x));
const positive = x => finite(x) && Number(x) > 0;

export function sectionProperties(section) {
  const areaIn2 = positive(section.od) && finite(section.idSize) && Number(section.idSize) >= 0 && Number(section.idSize) < Number(section.od)
    ? Math.PI * (Number(section.od) ** 2 - Number(section.idSize) ** 2) / 4 : null;
  const density = section.material?.densityLbFt3;
  const calculatedWeightLbFt = section.geometry?.kind !== 'segmented' && section.sectionModel !== 'complex' && areaIn2 !== null && positive(density) ? areaIn2 * Number(density) / 144 : null;
  // No stiffness/impedance inference for tools, and no segment averaging.
  return { geometricAreaIn2: areaIn2, nominalWeightLbFt: section.weight, calculatedWeightLbFt };
}

export function validateDefinition(definition) {
  const errors = [], warnings = [];
  if (!String(definition.name || '').trim()) errors.push('Component name is required.');
  if (!String(definition.category || '').trim()) errors.push('Component type is required.');
  if (!['uniform', 'segmented'].includes(definition.geometry?.kind)) errors.push('Choose uniform or segmented geometry.');
  const check = (s, label, optionalWeight = false) => {
    if (!positive(s.length)) errors.push(`${label}: length must be positive (ft).`);
    const nominalBit = label === 'Component' && String(definition.category).toUpperCase() === 'BIT';
    if (nominalBit ? !positive(s.od) : (!positive(s.od) || !finite(s.idSize) || Number(s.idSize) < 0 || Number(s.idSize) >= Number(s.od)))
      errors.push(`${label}: ${nominalBit ? 'nominal cutting OD must be positive (in).' : 'require OD > ID >= 0 (in).'}`);
    if (!(optionalWeight && (s.weight === '' || s.weight == null)) && !(nominalBit && (s.weight === '' || s.weight == null)) && !positive(s.weight)) errors.push(`${label}: nominal linear weight must be positive (lb/ft).`);
    if (!String(s.material?.name || '').trim()) errors.push(`${label}: material name is required.`);
    for (const key of ['densityLbFt3', 'youngsModulusPsi']) if (s.material?.[key] !== '' && s.material?.[key] != null && !positive(s.material[key])) errors.push(`${label}: ${key} must be positive when supplied.`);
    for (const key of ['maximumOd', 'contactDiameter']) if (s[key] !== '' && s[key] != null && (!positive(s[key]) || Number(s[key]) < Number(s.od))) errors.push(`${label}: ${key} must be at least nominal OD.`);
    if (positive(s.maximumOd) && positive(s.contactDiameter) && Number(s.contactDiameter) > Number(s.maximumOd)) errors.push(`${label}: contact diameter exceeds maximum OD.`);
    const p = sectionProperties(s);
    if (p.calculatedWeightLbFt !== null && positive(s.weight)) {
      const discrepancy = 100 * (Number(s.weight) - p.calculatedWeightLbFt) / p.calculatedWeightLbFt;
      if (Math.abs(discrepancy) > 5) warnings.push(`${label}: nominal weight differs from annular material weight (${p.calculatedWeightLbFt.toFixed(3)} lb/ft) by ${discrepancy.toFixed(1)}%. Nominal weight retained.`);
    }
  };
  check(definition, 'Component');
  if (String(definition.category).toUpperCase() === 'BIT' && definition.bitStructuralProperties) {
    const bitProperties = resolveBitStructuralProperties(definition.bitStructuralProperties);
    errors.push(...bitProperties.errors.map(message => `BIT structural properties: ${message}`));
  }
  if (definition.geometry?.kind === 'segmented') {
    const segments = definition.geometry.segments || [];
    if (!segments.length) errors.push('At least one segment is required.');
    segments.forEach((s, i) => check(s, `Segment ${i + 1}`, true));
    if (Math.abs(segments.reduce((n, s) => n + Number(s.length), 0) - Number(definition.length)) > SEGMENT_LENGTH_TOLERANCE_FT) errors.push(`Segment lengths must sum to overall length within ${SEGMENT_LENGTH_TOLERANCE_FT} ft.`);
    if (segments.some(s => Number(s.maximumOd || s.od) > Number(definition.maximumOd || definition.od))) errors.push('Overall maximum OD must cover every segment maximum OD.');
  }
  if (definition.effectiveProperties) {
    const e = definition.effectiveProperties;
    if (!e.provenance?.trim() || !e.limitations?.trim()) errors.push('Effective properties require provenance and limitations.');
    for (const key of ['axialStiffnessLbf', 'waveImpedanceLbfSecFt']) if (e[key] !== '' && e[key] != null && !positive(e[key])) errors.push(`${key} must be positive when supplied.`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function definitionSnapshot(definition) {
  return cloneDefinition({ ...definition, schemaVersion: COMPONENT_SCHEMA_VERSION,
    ...(definition.geometry ? { geometry: { ...definition.geometry, order: 'bit-to-surface' } } : {}) });
}

// A patch deliberately leaves sequence, orientation, quantity and other row metadata alone.
export function definitionRowPatch(definition) {
  const snapshot = definitionSnapshot(definition);
  return { selectedToolId: definition.id, toolName: definition.name, category: definition.category,
    od: definition.od ?? '', idSize: definition.idSize ?? '', weight: definition.weight ?? '', length: definition.length ?? '',
    componentDefinition: snapshot, componentSchemaVersion: COMPONENT_SCHEMA_VERSION };
}
