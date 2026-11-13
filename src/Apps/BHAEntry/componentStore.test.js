import { standardComponents, loadMyComponents, saveMyComponents, filterComponents, COMPONENT_STORAGE_KEY, STANDARD_OVERRIDE_STORAGE_KEY, loadStandardComponentOverrides, saveStandardBitOverride, resetStandardComponentOverride, getResolvedStandardComponent } from './componentStore';
import catalogue from '../../data/components.json';

beforeEach(() => localStorage.clear());
test('standard IDs stay unchanged; local library round trip is versioned', () => {
  expect(standardComponents.map(c => c.id)).toEqual(catalogue.components.map(c => c.id));
  const c = { id: 'custom-1', schemaVersion: 1, name: 'User tubular', geometry: { kind: 'segmented', segments: [{ label: 'Bit end' }] } };
  saveMyComponents([c]); expect(loadMyComponents()).toEqual([c]);
  expect(JSON.parse(localStorage.getItem(COMPONENT_STORAGE_KEY)).schemaVersion).toBe(1);
});
test('standard component library offers an 8.5-inch PDC bit and retains the existing 8.5-inch TCI bit', () => {
  const pdc = standardComponents.find(component => component.id === 'bha-187');
  const tci = standardComponents.find(component => component.id === 'bha-9');
  expect(pdc).toMatchObject({ category: 'BIT', name: '8.5-inch PDC Drill Bit', od: 8.5, length: 1, source: 'standard' });
  expect(pdc.weight).toBeNull();
  expect(pdc.manufacturer).toBe('');
  expect(tci).toMatchObject({ category: 'BIT', od: 8.5, length: 1 });
  expect(tci.name).toMatch(/TCI/);
});
test('malformed/future storage is preserved and not silently reset', () => {
  localStorage.setItem(COMPONENT_STORAGE_KEY, '{bad'); expect(() => loadMyComponents()).toThrow();
  expect(localStorage.getItem(COMPONENT_STORAGE_KEY)).toBe('{bad');
  localStorage.setItem(COMPONENT_STORAGE_KEY, '{"schemaVersion":99,"components":[]}'); expect(() => loadMyComponents()).toThrow(/Unsupported/);
});
test('filters compose by type, name, diameter and manufacturer', () => {
  const c = { name: 'Special collar', category: 'DC', od: 6, manufacturer: 'User supplied source' };
  expect(filterComponents([c], { query: 'COLLAR', category: 'DC', od: '6', manufacturer: 'supplied' })).toEqual([c]);
  expect(filterComponents([c], { category: 'JAR' })).toEqual([]);
});
test('standard BIT structural overrides persist by stable ID and reset without changing source definitions', () => {
  const source = standardComponents.find(c => c.id === 'bha-187');
  const before = JSON.stringify(source);
  const properties = { bodyOdIn: '6', boreIdIn: '2.5', densityKgM3: '7850', youngsModulusGPa: '200', provenanceType: 'illustrative', provenance: 'Test assumption.' };
  saveStandardBitOverride('bha-187', properties);
  expect(loadStandardComponentOverrides()['bha-187'].bitStructuralProperties).toEqual(properties);
  expect(getResolvedStandardComponent('bha-187').bitStructuralProperties).toEqual(properties);
  expect(JSON.stringify(source)).toBe(before);
  expect(() => saveStandardBitOverride('bha-9', properties)).toThrow(/standard BIT/);
  expect(resetStandardComponentOverride('bha-187')).toBe(true);
  expect(getResolvedStandardComponent('bha-187').bitStructuralProperties).toBeUndefined();
  expect(localStorage.getItem(STANDARD_OVERRIDE_STORAGE_KEY)).toBeNull();
});
