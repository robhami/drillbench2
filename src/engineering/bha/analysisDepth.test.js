import { analysisDepth } from './analysisDepth';
import { deployDrillstring } from './deployDrillstring';
const auto = { drillpipeReferenceBitMdFt: 12000, rows: [
  { category: 'JAR', length: 515, weight: 100 },
  { category: 'DP', lengthMode: 'auto', length: 9000, weight: 27.76 }
] };
test('Auto follows saved MD and deploys a copy without changing manual component lengths', () => {
  const before = JSON.stringify(auto);
  expect(analysisDepth(auto).bitMdFt).toBe(12000);
  const changed = { ...auto, drillpipeReferenceBitMdFt: 10000 };
  expect(analysisDepth(changed).bitMdFt).toBe(10000);
  expect(deployDrillstring(changed, analysisDepth(changed).bitMdFt).metadata.deployedDpLengthFt).toBe(9485);
  expect(JSON.stringify(auto)).toBe(before);
});
test('Defined follows lengths through switches and save/restore without overwriting saved Auto MD', () => {
  const defined = { ...auto, rows: [auto.rows[0], { ...auto.rows[1], lengthMode: 'manual' }] };
  expect(analysisDepth(defined).bitMdFt).toBe(9515);
  const changed = JSON.parse(JSON.stringify({ ...defined, rows: [defined.rows[0], { ...defined.rows[1], length: 8000 }] }));
  expect(analysisDepth(changed).bitMdFt).toBe(8515);
  expect(changed.drillpipeReferenceBitMdFt).toBe(12000);
  expect(analysisDepth(auto).bitMdFt).toBe(12000);
});
test.each(['', undefined, 'bad', Infinity, -1, 0, 100])('invalid/missing or insufficient Auto MD %s does not become zero', drillpipeReferenceBitMdFt => {
  expect(analysisDepth({ ...auto, drillpipeReferenceBitMdFt }).valid).toBe(false);
});
test('missing Defined length, multiple DP and incomplete BHA are explicit', () => {
  expect(analysisDepth({ ...auto, rows: [auto.rows[0], { ...auto.rows[1], lengthMode: 'manual', length: '' }] }).valid).toBe(false);
  expect(analysisDepth({ ...auto, rows: [...auto.rows, auto.rows[1]] }).valid).toBe(false);
  expect(analysisDepth({ rows: [] }).valid).toBe(false);
});
