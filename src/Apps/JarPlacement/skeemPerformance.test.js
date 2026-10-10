import { calculateJarPerformance, primaryChartPoints } from './skeemPerformance';
import { calcSkeemPostImpact } from '../../engineering/jar/skeemDynamics';

export const demoBha = {
  rows: [
    { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
    { category: 'JAR', length: 10 },
    { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
    { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95), weight: 16.6 }
  ], mudWeight: 10, wob: 999
};
const operating = { strokeIn: '4', overpullKlbf: '165', stuckPointFt: '0' };
const changeRow = (index, changes) => ({ ...demoBha, rows: demoBha.rows.map((r, i) => i === index ? { ...r, ...changes } : r) });

test('maps real positions, faces, sections, air weight and operating units to unchanged solver', () => {
  const result = calculateJarPerformance(demoBha, operating);
  expect(result.valid).toBe(true);
  expect(result.input).toMatchObject({ overpullLbf: 165000, strokeIn: 4, lowerCollarLengthFt: 60, upperCollarLengthFt: 180, freePipeLengthFt: 3000, collarOdIn: 6.25, collarIdIn: 2.75, pipeOdIn: 4.5 });
  expect(result.jar.centreFromBit).toBe(65);
  expect(result.input.lowerCollarWeightLbf).toBeCloseTo(5041.030987876718, 8);
  const solver = calcSkeemPostImpact(result.input);
  expect(result.forceHistory).toEqual(solver.forceHistory);
  expect(result.impulseLbfS).toBeCloseTo(12303.474541984585, 8);
  expect(result.warnings.join(' ')).toMatch(/air weight.*E = 30 million/);
  expect(calculateJarPerformance({ ...demoBha, wob: 1, mudWeight: 0 }, operating).input).toEqual(result.input);
});

test('clips lower collar at stuck point without including components below it', () => {
  const result = calculateJarPerformance(demoBha, { ...operating, stuckPointFt: '20' });
  expect(result.input.lowerCollarLengthFt).toBe(40);
  expect(result.input.lowerCollarWeightLbf).toBeCloseTo(40 * demoBha.rows[0].weight, 8);
});

test.each(['60', '65', '70', '-1', ''])('rejects unsupported stuck-point position %s', stuckPointFt => {
  expect(calculateJarPerformance(demoBha, { ...operating, stuckPointFt }).valid).toBe(false);
});
test.each(['', '0', '-1', 'bad'])('validates positive stroke and overpull %s', value => {
  expect(calculateJarPerformance(demoBha, { ...operating, strokeIn: value }).valid).toBe(false);
  expect(calculateJarPerformance(demoBha, { ...operating, overpullKlbf: value }).valid).toBe(false);
});
test.each(['HWDP', 'STB', 'M_LWD', 'ACCELERATOR'])('does not approximate %s as a collar', category => {
  expect(calculateJarPerformance(changeRow(2, { category }), operating).error).toMatch(/Unsupported geometry/);
});
test.each([{ idSize: '' }, { idSize: undefined }, { od: '' }, { idSize: 7 }])('rejects missing/invalid dimensions %j', changes => {
  expect(calculateJarPerformance(changeRow(2, changes), operating).error).toMatch(/OD\/ID/);
});
test('rejects mixed sections, missing weights, incomplete rows and multiple jars', () => {
  expect(calculateJarPerformance(changeRow(2, { od: 8 }), operating).error).toMatch(/Mixed/);
  expect(calculateJarPerformance(changeRow(0, { weight: '' }), operating).error).toMatch(/air weight/);
  expect(calculateJarPerformance(changeRow(2, { length: '' }), operating).error).toMatch(/positive lengths/);
  expect(calculateJarPerformance(changeRow(2, { category: 'JAR' }), operating).error).toMatch(/exactly one jar/);
  expect(calculateJarPerformance({ rows: [] }, operating).valid).toBe(false);
  expect(calculateJarPerformance(changeRow(3, { category: 'HWDP' }), operating).valid).toBe(false);
});
test('propagates solver failure and preserves geometry for audit', () => {
  const result = calculateJarPerformance(changeRow(3, { length: 1000 }), operating);
  expect(result.valid).toBe(false);
  expect(result.error).toMatch(/1300/);
  expect(result.input.freePipeLengthFt).toBe(1000);
  expect(result.impulseLbfS).toBeUndefined();
});
test('chart uses only exact history endpoints with repeated times for vertical jumps', () => {
  const result = calculateJarPerformance(demoBha, operating);
  const points = primaryChartPoints(result.forceHistory);
  expect(points).toHaveLength(4);
  expect(points[1].timeMs).toBe(points[2].timeMs);
  expect(points[1].forceKlbf).not.toBe(points[2].forceKlbf);
  expect(points[0]).toEqual({ timeMs: 0, forceKlbf: result.forceHistory[0].tensileForceLbf / 1000 });
  expect(points[3].timeMs).toBe(result.primaryPulseDurationS * 1000);
  expect(primaryChartPoints([])).toEqual([]);
});
