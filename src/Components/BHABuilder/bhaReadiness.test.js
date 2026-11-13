import { assessBhaReadiness } from './bhaReadiness';
import { drillstringDeploymentStructure } from '../../engineering/bha/deployDrillstring';
const complete = { category: 'DC', od: 6.5, idSize: 2.813, weight: 92, length: 300 };
const assess = row => assessBhaReadiness({ rows: [row] });

test('distinguishes untouched, incomplete, manually valid and explicitly invalid rows', () => {
  expect(assess({ rowId: 'draft' }).rows[0].state).toBe('untouched');
  expect(assess({ category: 'DC' }).rows[0]).toMatchObject({ state: 'incomplete', message: 'Row 1: Select a tool and enter its length.' });
  expect(assess(complete).valid).toBe(true);
  expect(assess({ ...complete, length: 0 }).rows[0].state).toBe('invalid');
});
test('tailors missing fields to selected tool, without making a catalogue ID mandatory for legacy manual rows', () => {
  expect(assess({ category: 'DC', selectedToolId: 'catalogue-tool', od: 6.5, weight: 92 }).messages).toEqual(['Row 1: Enter its length.']);
  expect(assess({ category: 'DC', selectedToolId: 'catalogue-tool', length: 30 }).messages[0]).toContain('Enter OD and enter air weight');
});
test.each(['0', '-1', 'abc', 'Infinity'])('invalid length %s remains invalid in both readiness and authoritative deployment validation', length => {
  const bha = { rows: [{ ...complete, length }] };
  expect(assessBhaReadiness(bha).valid).toBe(false);
  expect(drillstringDeploymentStructure(bha).valid).toBe(false);
});
test.each([{ od: 0 }, { od: 'abc' }, { idSize: 7 }, { idSize: -1 }, { weight: -1 }])('explicit invalid field %j is rejected', changes => {
  expect(assess({ ...complete, ...changes }).valid).toBe(false);
});
test('blank trailing rows cannot be silently dropped at the application analysis boundary', () => {
  const r = assessBhaReadiness({ rows: [complete, {}] });
  expect(r.valid).toBe(false); expect(r.messages[0]).toContain('Row 2:');
});
test('Auto DP does not require a saved length; existing deployment still rejects missing target MD', () => {
  expect(assess({ ...complete, category: 'DP', lengthMode: 'auto', length: '' }).valid).toBe(true);
});
test('configured nominal-hole incompatibility remains blocking; absent optional hole input is not invented', () => {
  expect(assessBhaReadiness({ rows: [complete], holeSize: 6.5 }).valid).toBe(false);
  expect(assessBhaReadiness({ rows: [complete], holeSize: -1 }).valid).toBe(false);
  expect(assessBhaReadiness({ rows: [complete] }).valid).toBe(true);
});
