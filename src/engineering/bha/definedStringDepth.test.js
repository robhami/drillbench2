import { definedStringDepth } from './definedStringDepth';

const bha = { drillpipeReferenceBitMdFt: 12000, rows: [
  { category: 'DC', length: 300 }, { category: 'Jar', length: 30 },
  { category: 'DP', length: '9000', lengthMode: 'manual' }
] };
test('Defined depth sums all components without overwriting Auto reference or manual length', () => {
  expect(definedStringDepth(bha)).toEqual({ active: true, valid: true, bitMdFt: 9330 });
  const restored = JSON.parse(JSON.stringify(bha));
  expect(definedStringDepth(restored).bitMdFt).toBe(9330);
  expect(definedStringDepth({ ...bha, rows: bha.rows.map(r => r.category === 'DP' ? { ...r, lengthMode: 'auto' } : r) })).toEqual({ active: false });
  expect(restored.drillpipeReferenceBitMdFt).toBe(12000);
  expect(restored.rows[2].length).toBe('9000');
});
test.each(['', undefined, -1, 0, 'bad', Infinity])('invalid Defined DP length %s cannot provide analysis depth', length => {
  expect(definedStringDepth({ ...bha, rows: [...bha.rows.slice(0, 2), { ...bha.rows[2], length }] })).toMatchObject({ active: true, valid: false });
});
