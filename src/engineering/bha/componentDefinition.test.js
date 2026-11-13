import { sectionProperties, validateDefinition, definitionRowPatch, SEGMENT_LENGTH_TOLERANCE_FT } from './componentDefinition';
import { buildEngModel } from '../models/buildEngModel';
import { calcStraightDrag } from '../forces/calcStraightDrag';

const section = { length: 10, od: 5, idSize: 3, weight: 40, material: { name: 'Test steel', densityLbFt3: 490 } };
const component = () => ({ ...section, material: { ...section.material }, id: 'custom-test', name: 'Test section', category: 'DC', geometry: { kind: 'uniform', segments: [] } });

test('annular area and material weight independently match 4π and 490π/36; nominal weight is retained', () => {
  const p = sectionProperties(section);
  expect(p.geometricAreaIn2).toBeCloseTo(12.566370614359172, 12);
  expect(p.calculatedWeightLbFt).toBeCloseTo(42.76056667386107, 10);
  expect(p.nominalWeightLbFt).toBe(40);
  expect(validateDefinition(component()).warnings[0]).toMatch(/-6.5%/);
  expect(sectionProperties({ ...section, sectionModel: 'complex' }).calculatedWeightLbFt).toBeNull();
  expect(sectionProperties({ ...section, material: { name: 'Unknown' } }).calculatedWeightLbFt).toBeNull();
});

test('segment order, explicit materials and absolute length tolerance are preserved without averaging', () => {
  const c = { ...component(), geometry: { kind: 'segmented', segments: [{ ...section, label: 'Bit end', length: 4 }, { ...section, label: 'Surface end', length: 6, od: 4, weight: '' }] } };
  expect(validateDefinition(c).valid).toBe(true);
  expect(sectionProperties(c).calculatedWeightLbFt).toBeNull();
  expect(definitionRowPatch(c).componentDefinition.geometry.segments.map(s => s.label)).toEqual(['Bit end', 'Surface end']);
  c.geometry.segments[1].length += SEGMENT_LENGTH_TOLERANCE_FT / 2;
  expect(validateDefinition(c).valid).toBe(true);
  c.geometry.segments[1].length += SEGMENT_LENGTH_TOLERANCE_FT * 2;
  expect(validateDefinition(c).errors.join()).toMatch(/sum/);
});

test.each([{ od: 0 }, { idSize: '' }, { idSize: 5 }, { idSize: -1 }, { length: Infinity }, { weight: -1 }, { contactDiameter: 4 }, { material: { name: '' } }])('reject invalid dimensions/material: %j', patch => {
  expect(validateDefinition({ ...component(), ...patch }).valid).toBe(false);
});

test('effective properties require provenance and limitations; no stiffness is inferred', () => {
  expect(validateDefinition({ ...component(), effectiveProperties: { axialStiffnessLbf: 100 } }).valid).toBe(false);
  expect(validateDefinition({ ...component(), effectiveProperties: { axialStiffnessLbf: 100, provenance: 'User test fixture', limitations: 'Not operational data' } }).valid).toBe(true);
  expect(sectionProperties(section)).not.toHaveProperty('axialStiffnessLbf');
});

test('BIT cutting OD and structural bore/area remain separate in component validation and snapshots', () => {
  const bit = { id: 'bha-pdc', name: '8.5-in PDC', category: 'BIT', length: '1', od: '8.5', idSize: '', weight: '',
    material: { name: 'Unspecified', densityLbFt3: '', youngsModulusPsi: '' }, geometry: { kind: 'uniform', segments: [] },
    bitStructuralProperties: { bodyOdIn: '6', boreIdIn: '2.5', densityKgM3: '7850', youngsModulusGPa: '200', provenanceType: 'illustrative', provenance: 'Test only.' } };
  expect(validateDefinition(bit).valid).toBe(true);
  expect(definitionRowPatch(bit).componentDefinition.bitStructuralProperties).toEqual(bit.bitStructuralProperties);
  expect(validateDefinition({ ...bit, bitStructuralProperties: { ...bit.bitStructuralProperties, bodyOdIn: '2' } }).errors.join(' ')).toMatch(/must exceed/);
});

test('snapshots are independent and explicit updates preserve row metadata; legacy solver output is unchanged', () => {
  const c = component(), patch = definitionRowPatch(c);
  c.material.name = 'Changed'; c.weight = 90;
  expect(patch.componentDefinition.material.name).toBe('Test steel'); expect(patch.weight).toBe(40);
  const row = { rowId: 'r', orientation: 'surface-to-bottom', quantity: 3, notes: 'Retained', ...section, category: 'DC' };
  const updated = { ...row, ...patch };
  expect(updated).toMatchObject({ rowId: 'r', orientation: 'surface-to-bottom', quantity: 3, notes: 'Retained' });
  const input = { mudWeight: 10, inclination: 0, wob: 1, rows: [row] };
  const before = calcStraightDrag(buildEngModel(input), 'reference');
  const after = calcStraightDrag(buildEngModel({ ...input, rows: [updated] }), 'reference');
  expect(before.valid).toBe(true); expect(after.valid).toBe(true);
  expect(after.components.map(s => [s.bottomAxialForce, s.topAxialForce])).toEqual(before.components.map(s => [s.bottomAxialForce, s.topAxialForce]));
  expect(after.topOfBhaAxialForce).toBeCloseTo(661.0687022900763, 9);
});
