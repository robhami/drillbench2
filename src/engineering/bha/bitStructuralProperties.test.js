import { resolveBitStructuralProperties } from './bitStructuralProperties';

const full = patch => resolveBitStructuralProperties({ densityKgM3: 7850, youngsModulusGPa: 200, provenanceType: 'manufacturer', provenance: 'Supplied drawing.', ...patch });

test.each(['PDC', 'TCI'])('%s structural OD/ID resolves independently of nominal cutting OD', type => {
  const result = full({ bodyOdIn: 6, boreIdIn: 2.5 });
  expect(result.valid).toBe(true);
  expect(result.calculatedAreaIn2).toBeCloseTo(23.365, 3);
  expect(result.equivalentAreaIn2).toBe(result.calculatedAreaIn2);
  expect(result.youngsModulusPa).toBe(200e9);
  expect(type).toMatch(/PDC|TCI/);
});

test('direct equivalent area works when dimensions are unavailable', () => {
  expect(full({ equivalentAreaIn2: 23.366 }).equivalentAreaIn2).toBe(23.366);
});

test.each([
  [{ bodyOdIn: 6 }, /both structural body OD/],
  [{ densityKgM3: 7850 }, /Provide valid structural body OD/],
  [{ bodyOdIn: 2, boreIdIn: 2 }, /must exceed/],
  [{ bodyOdIn: -1, boreIdIn: 0 }, /must be positive/],
  [{ equivalentAreaIn2: 0 }, /must be positive/],
  [{ bodyOdIn: 6, boreIdIn: 2.5, equivalentAreaIn2: 25 }, /conflicts/],
  [{ bodyOdIn: 6, boreIdIn: 2.5, densityKgM3: -1 }, /density.*positive/]
])('rejects invalid or contradictory BIT properties %#', (patch, expected) => {
  expect(full(patch).valid).toBe(false);
  expect(full(patch).errors.join(' ')).toMatch(expected);
});
