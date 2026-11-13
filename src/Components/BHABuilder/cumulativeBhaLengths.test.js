import { cumulativeBhaLengths } from './cumulativeBhaLengths';

test('cumulative length is the precise upper-end distance in bit-to-surface row order', () => {
  const rows = [
    { category: 'BIT', length: '1.0' },
    { category: 'STB', length: '4.92' },
    { category: 'DC', length: '9.84' },
    { category: 'STB', length: '4.92' },
    { category: 'DC', length: '89.96' }
  ];
  const cumulative = cumulativeBhaLengths(rows);
  expect(cumulative).toEqual([1, 1 + 4.92, 1 + 4.92 + 9.84, 1 + 4.92 + 9.84 + 4.92, 1 + 4.92 + 9.84 + 4.92 + 89.96]);
});

test('cumulative length recalculates for edited, reordered and deployed Auto DP rows', () => {
  const bit = { category: 'BIT', length: 1 };
  const dc = { category: 'DC', length: 9.8 };
  const edited = cumulativeBhaLengths([bit, { ...dc, length: 12.5 }]);
  expect(edited).toEqual([1, 13.5]);
  expect(cumulativeBhaLengths([dc, bit])).toEqual([9.8, 10.8]);
  expect(cumulativeBhaLengths([bit, { category: 'DP', lengthMode: 'auto', length: 999 }], 100))
    .toEqual([1, 101]);
});

test('unknown component length leaves downstream cumulative values unavailable', () => {
  expect(cumulativeBhaLengths([{ category: 'BIT', length: 1 }, { category: 'DC', length: '' }, { category: 'DP', length: 10 }]))
    .toEqual([1, null, null]);
});
