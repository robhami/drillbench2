import { deriveCentredStabilizer } from './stabilizerGeometry';
import { componentEntryDefinition } from '../../Components/BHABuilder/componentEntryDefinition';
import { validateDefinition, sectionProperties, definitionRowPatch } from './componentDefinition';
import { buildEngModel } from '../models/buildEngModel';
import { calcStraightDrag } from '../forces/calcStraightDrag';

const fixture = extra => ({ id: 'stb-fixture', name: 'User stabilizer fixture', category: 'STB', length: 10, od: 6, idSize: 2, weight: 80,
  material: { name: 'Unspecified' }, geometry: { kind: 'uniform', segments: [] }, stabilizer: { mode: 'centred', bladeLength: 2, bladeOd: 8 }, ...extra });

test('independent centred geometry: 10 ft overall / 2 ft blades gives 4,2,4 ft at 0,4,6,10 ft', () => {
  const d = deriveCentredStabilizer(fixture()); expect(d.valid).toBe(true);
  expect(d.sections.map(s => [s.startFt, s.endFt, s.length, s.od])).toEqual([[0, 4, 4, 6], [4, 6, 2, 8], [6, 10, 4, 6]]);
  const input = fixture(), before = JSON.stringify(input), output = componentEntryDefinition(input);
  expect(JSON.stringify(input)).toBe(before); expect(output.od).toBe(6); expect(output.maximumOd).toBe(8);
  expect(output.geometry.segments.map(s => s.length)).toEqual([4, 2, 4]); expect(output.geometry.order).toBe('bit-to-surface');
  expect(output.weight).toBe(80); expect(validateDefinition(output).valid).toBe(true);
});

test('blade envelope never becomes an annular mass/stiffness/impedance estimate even with supplied density', () => {
  const output = componentEntryDefinition(fixture({ material: { name: 'User steel', densityLbFt3: 490, youngsModulusPsi: 30000000 } }));
  expect(output.sectionModel).toBe('complex'); expect(sectionProperties(output).calculatedWeightLbFt).toBeNull();
  output.geometry.segments.forEach(s => {
    expect(s.sectionModel).toBe('complex'); expect(s.weight).toBe(''); expect(sectionProperties(s).calculatedWeightLbFt).toBeNull();
    expect(s).not.toHaveProperty('axialStiffnessLbf'); expect(s).not.toHaveProperty('waveImpedanceLbfSecFt');
  });
  expect(output.geometry.segments[1].externalGeometry).toBe('blade-envelope'); expect(validateDefinition(output).warnings).toEqual([]);
});

test('full-length blades retain the three-section preview with zero outer spans and store only the positive span', () => {
  const c = fixture({ stabilizer: { mode: 'centred', bladeLength: 10, bladeOd: 6 } });
  expect(deriveCentredStabilizer(c).sections.map(s => s.length)).toEqual([0, 10, 0]);
  const output = componentEntryDefinition(c); expect(output.geometry.segments).toHaveLength(1); expect(validateDefinition(output).valid).toBe(true);
  expect(deriveCentredStabilizer(fixture({ idSize: 0 })).valid).toBe(true);
});

test.each([
  ['length', { length: 0 }], ['length', { length: Infinity }], ['length', { length: 'bad' }],
  ['bladeLength', { stabilizer: { bladeLength: 0, bladeOd: 8 } }], ['bladeLength', { stabilizer: { bladeLength: 11, bladeOd: 8 } }],
  ['bladeLength', { stabilizer: { bladeLength: NaN, bladeOd: 8 } }], ['bladeOd', { stabilizer: { bladeLength: 2, bladeOd: 5 } }],
  ['bladeOd', { stabilizer: { bladeLength: 2, bladeOd: Infinity } }], ['od', { od: 0 }], ['idSize', { idSize: -1 }],
  ['idSize', { idSize: 6 }], ['idSize', { idSize: '' }], ['idSize', { idSize: '  ' }], ['weight', { weight: 0 }], ['weight', { weight: -1 }]
])('rejects invalid stabilizer %s: %j', (field, patch) => {
  const derived = deriveCentredStabilizer(fixture(patch)); expect(derived.valid).toBe(false); expect(derived.errors[field]).toBeTruthy(); expect(derived.sections).toEqual([]);
});

test('fractional lengths remain ordered, centred and sum to the total without changing nominal weight', () => {
  const c = fixture({ length: '9.1', weight: '79.23', stabilizer: { mode: 'centred', bladeLength: '2.7', bladeOd: '8.125' } });
  const derived = deriveCentredStabilizer(c), out = componentEntryDefinition(c);
  expect(derived.sections[0].length).toBeCloseTo(3.2, 12); expect(derived.sections[1].endFt).toBeCloseTo(5.9, 12);
  expect(out.geometry.segments.reduce((n, s) => n + s.length, 0)).toBeCloseTo(9.1, 12); expect(out.weight).toBe('79.23'); expect(validateDefinition(out).valid).toBe(true);
});

test('manual override preserves non-standard spans, effective properties and provenance without inferring blade geometry', () => {
  const c = fixture({ stabilizer: { mode: 'manual' }, geometry: { kind: 'segmented', segments: [
    { length: 3, od: 6, idSize: 2, material: { name: 'Unspecified' } }, { length: 7, od: 8, idSize: 2, material: { name: 'Unspecified' } }
  ] }, maximumOd: 8, effectiveProperties: { axialStiffnessLbf: 123, provenance: 'User reference', limitations: 'Fixture only' } });
  const out = componentEntryDefinition(c); expect(out.geometry.segments.map(s => s.length)).toEqual([3, 7]); expect(out.effectiveProperties).toEqual(c.effectiveProperties);
  expect(validateDefinition(out).valid).toBe(true);
  const legacy = { ...fixture(), category: 'DC' }; expect(componentEntryDefinition(legacy)).toBe(legacy);
});

test('legacy/reference solver still uses the supplied row weight and body OD; geometry metadata changes no load result', () => {
  const c = fixture(), old = { rowId: 'stb', category: 'STB', toolName: c.name, length: 10, od: 6, idSize: 2, weight: 80 };
  const bha = { mudWeight: 10, inclination: 0, wob: 1, rows: [old] };
  const result = input => calcStraightDrag(buildEngModel(input), 'reference');
  const before = result(bha), after = result({ ...bha, rows: [{ ...old, ...definitionRowPatch(componentEntryDefinition(c)) }] });
  expect(before.valid).toBe(true); expect(after.valid).toBe(true);
  // Independent force balance: 1000 - (80*10)*(1 - 10/65.5).
  expect(after.topOfBhaAxialForce).toBeCloseTo(322.1374045801527, 9);
  expect(after.topOfBhaAxialForce).toBe(before.topOfBhaAxialForce);
});
