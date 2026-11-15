import { calculateJarUpPositionComparison } from './jarUpPositionComparisonModel';
import { MIN_RELOCATED_COLLAR_LENGTH_FT, relocateComparisonJar } from '../../engineering/jar/realBhaComparison';
import * as performance from '../JarPlacement/skeemPerformance';

const bha = {
  id: 'uniform-skeem-bha',
  rows: [
    { rowId: 'lower', category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
    { rowId: 'jar', category: 'JAR', length: 10, od: 6.25, idSize: 2.75 },
    { rowId: 'upper', category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
    { rowId: 'dp', category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95), weight: 16.6 }
  ],
  jarImpactInputs: { up: { strokeIn: '4', overpullKlbf: '165', stuckPointFt: '0' } }
};

const calculate = (source = bha, operating = source.jarImpactInputs.up) =>
  calculateJarUpPositionComparison(source, 'jar', operating);
const withLengths = (lowerFt, upperFt) => ({ ...bha, rows: bha.rows.map((row, index) =>
  index === 0 ? { ...row, length: lowerFt } : index === 2 ? { ...row, length: upperFt } : row) });

const validSolverOutput = {
  valid: true,
  forceHistory: [{ tensileForceLbf: 120000 }],
  impulseLbfS: 12000,
  preImpact: { hammerVelocityFtS: 12 },
  primaryPulseDurationS: 0.0225,
  impactForceLbf: 210000
};

test.each([
  ['ordinary collars', 60, 180, 7],
  ['an adjacent section exactly 1e-5 ft', 60, 1e-5, 7],
  ['an adjacent section below 1e-5 ft but above the adapter minimum', 60, 5e-6, 7],
  ['both adjacent sections very short', 5e-6, 7e-6, 7],
  ['a section just above the adapter minimum', 60, MIN_RELOCATED_COLLAR_LENGTH_FT + 1e-15, 4]
])('%s yields unique, direction-safe positions with the current position exactly once', (_name, lowerFt, upperFt, count) => {
  const adapter = jest.spyOn(performance, 'calculateJarPerformance').mockReturnValue(validSolverOutput);
  try {
    const source = withLengths(lowerFt, upperFt);
    const result = calculate(source);
    expect(result.candidates).toHaveLength(count);
    expect(result.candidates.filter(candidate => candidate.movementFt === 0)).toHaveLength(1);
    expect(new Set(result.candidates.map(candidate => candidate.jarCentreFt)).size).toBe(result.candidates.length);
    const currentCentreFt = result.geometry.currentCentreFt;
    expect(result.candidates.filter(candidate => candidate.movementFt > 0).every(candidate => candidate.jarCentreFt >= currentCentreFt)).toBe(true);
    expect(result.candidates.filter(candidate => candidate.movementFt < 0).every(candidate => candidate.jarCentreFt <= currentCentreFt)).toBe(true);
    result.candidates.forEach(candidate => {
      const relocated = relocateComparisonJar(source, result.jarIndex, candidate.movementFt);
      expect(relocated.valid).toBe(true);
    });
  } finally {
    adapter.mockRestore();
  }
});

test('sections at the relocation minimum retain one unavailable current position and no invalid alternatives', () => {
  const source = withLengths(MIN_RELOCATED_COLLAR_LENGTH_FT, MIN_RELOCATED_COLLAR_LENGTH_FT);
  const result = calculate(source);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({ movementFt: 0, valid: false, jarCentreFt: 5.000001 });
  expect(result.candidates[0].error).toMatch(/more than 0\.000001 ft/);
});

test('valid uniform DC/JAR/DC/DP creates physical relocated candidates including the current position', () => {
  const before = JSON.stringify(bha);
  const result = calculate();
  expect(result.validGeometry).toBe(true);
  expect(result.candidates).toHaveLength(7);
  const current = result.candidates.find(candidate => candidate.movementFt === 0);
  expect(current).toMatchObject({ valid: true, jarCentreFt: 65 });
  expect(current.input).toMatchObject({ lowerCollarLengthFt: 60, upperCollarLengthFt: 180, freePipeLengthFt: 3000 });
  expect(result.candidates.every(candidate => candidate.valid)).toBe(true);
  expect(result.candidates.map(candidate => candidate.jarCentreFt)).toEqual([...result.candidates.map(candidate => candidate.jarCentreFt)].sort((a, b) => a - b));
  expect(JSON.stringify(bha)).toBe(before);
  expect(new Set(result.candidates.map(candidate => candidate.input.lowerCollarLengthFt)).size).toBe(7);
});

test('each relocated candidate has independently recalculated L1, L2 and lower-collar W', () => {
  const result = calculate();
  const towardBit = result.candidates.find(candidate => candidate.movementFt < -40);
  const current = result.candidates.find(candidate => candidate.movementFt === 0);
  const towardSurface = result.candidates.find(candidate => candidate.movementFt > 100);
  expect(towardBit.input.lowerCollarLengthFt).toBeLessThan(current.input.lowerCollarLengthFt);
  expect(towardBit.input.upperCollarLengthFt).toBeGreaterThan(current.input.upperCollarLengthFt);
  expect(towardBit.input.lowerCollarWeightLbf).toBeCloseTo(towardBit.input.lowerCollarLengthFt * 84.01718313127864, 7);
  expect(towardSurface.input.lowerCollarLengthFt).toBeGreaterThan(current.input.lowerCollarLengthFt);
  expect(towardSurface.input.upperCollarLengthFt).toBeLessThan(current.input.upperCollarLengthFt);
  expect(bha.rows[0].length).toBe(60);
});

test('all seven physical relocations preserve BHA inventory, row order, tubular properties and total footage', () => {
  const result = calculate();
  const totalFootage = bha.rows.reduce((sum, row) => sum + row.length, 0);
  for (const candidate of result.candidates) {
    const relocated = relocateComparisonJar(bha, result.jarIndex, candidate.movementFt);
    expect(relocated.valid).toBe(true);
    expect(relocated.bha.rows).toHaveLength(bha.rows.length);
    expect(relocated.bha.rows.map(row => row.category)).toEqual(bha.rows.map(row => row.category));
    expect(relocated.bha.rows.reduce((sum, row) => sum + row.length, 0)).toBeCloseTo(totalFootage, 10);
    relocated.bha.rows.forEach((row, index) => {
      expect({ ...row, length: null }).toEqual({ ...bha.rows[index], length: null });
    });
  }
});

test('calls the existing performance adapter once for every independently constructed position', () => {
  const adapter = jest.spyOn(performance, 'calculateJarPerformance');
  try {
    const result = calculate();
    expect(result.candidates).toHaveLength(7);
    expect(adapter).toHaveBeenCalledTimes(7);
    expect(adapter.mock.calls.map(([, operating]) => operating)).toEqual(Array(7).fill(bha.jarImpactInputs.up));
  } finally {
    adapter.mockRestore();
  }
});

test.each([
  ['missing overpull', { strokeIn: '4', overpullKlbf: '', stuckPointFt: '0' }, /Overpull at jar/],
  ['invalid stroke', { strokeIn: '0', overpullKlbf: '165', stuckPointFt: '0' }, /stroke/],
  ['invalid stuck point', { strokeIn: '4', overpullKlbf: '165', stuckPointFt: '1000' }, /below the jar lower face/]
])('%s suppresses all dynamic values and retains a reason', (_name, operating, reason) => {
  const result = calculate(bha, operating);
  expect(result.candidates.every(candidate => !candidate.valid)).toBe(true);
  expect(result.candidates.every(candidate => candidate.peakStuckPointForceKlbf === null && candidate.impulseLbfS === null)).toBe(true);
  expect(result.candidates[0].error).toMatch(reason);
});

test.each([
  ['no finite tensile-force samples', { forceHistory: [{}] }, /no finite stuck-point tensile-force history/],
  ['missing impulse', { impulseLbfS: null }, /no finite primary stuck-point impulse/],
  ['nonfinite impulse', { impulseLbfS: Infinity }, /no finite primary stuck-point impulse/],
  ['missing velocity', { preImpact: {} }, /no finite impact velocity/],
  ['nonfinite velocity', { preImpact: { hammerVelocityFtS: NaN } }, /no finite impact velocity/],
  ['missing duration', { primaryPulseDurationS: undefined }, /no finite primary pulse duration/],
  ['nonfinite duration', { primaryPulseDurationS: NaN }, /no finite primary pulse duration/]
])('solver success with %s marks only the affected candidate unavailable and keeps valid neighbors', (_name, changes, reason) => {
  const adapter = jest.spyOn(performance, 'calculateJarPerformance').mockImplementation(candidateBha =>
    candidateBha.rows[0].length === 60 ? { ...validSolverOutput, ...changes } : validSolverOutput);
  try {
    const result = calculate();
    const current = result.candidates.find(candidate => candidate.movementFt === 0);
    expect(current.valid).toBe(false);
    expect(current.error).toMatch(reason);
    expect(current.peakStuckPointForceLbf).toBeNull();
    expect(current.peakStuckPointForceKlbf).toBeNull();
    expect(current.impulseLbfS).toBeNull();
    expect(current.impactVelocityFtS).toBeNull();
    expect(current.primaryPulseDurationS).toBeNull();
    expect(result.candidates.filter(candidate => candidate.valid)).toHaveLength(6);
  } finally {
    adapter.mockRestore();
  }
});

test.each([
  ['HWDP', 'HWDP'], ['stabilizer', 'STB']
])('%s in the collar sequence is rejected by the production adapter', (_name, category) => {
  const mixed = { ...bha, rows: [...bha.rows.slice(0, 3), { rowId: 'unsupported', category, length: 10, od: 5, idSize: 3, weight: 45 }, ...bha.rows.slice(3)] };
  const result = calculate(mixed);
  expect(result.candidates.every(candidate => !candidate.valid && candidate.error.includes('Unsupported geometry'))).toBe(true);
});

test('mixed adjacent collar properties reject relocation rather than substituting a uniform section', () => {
  const mixed = { ...bha, rows: bha.rows.map((row, index) => index === 2 ? { ...row, od: 7 } : row) };
  const result = calculate(mixed);
  expect(result.validGeometry).toBe(false);
  expect(result.candidates).toHaveLength(1);
  expect(result.geometryError).toMatch(/identical properties/);
  expect(result.candidates[0].error).toMatch(/Mixed collar/);
  expect(result.candidates[0].peakStuckPointForceKlbf).toBeNull();
});

test('free DP below the existing solver minimum rejects every candidate with no plotted metrics', () => {
  const short = { ...bha, rows: bha.rows.map((row, index) => index === 3 ? { ...row, length: 1000 } : row) };
  const result = calculate(short);
  expect(result.candidates.every(candidate => !candidate.valid && /1300/.test(candidate.error))).toBe(true);
  expect(result.candidates.every(candidate => candidate.peakStuckPointForceKlbf === null && candidate.impulseLbfS === null)).toBe(true);
});

test('outputs preserve units and distinguish incident FI from peak stuck-point force', () => {
  const current = calculate().candidates.find(candidate => candidate.movementFt === 0);
  expect(current.peakStuckPointForceKlbf).toBeCloseTo(619.3623824686911, 8);
  expect(current.peakStuckPointForceKlbf).toBeCloseTo(current.peakStuckPointForceLbf / 1000, 12);
  expect(current.impulseLbfS).toBeCloseTo(12303.474541984585, 8);
  expect(current.impactVelocityFtS).toBeCloseTo(11.461401, 5);
  expect(current.primaryPulseDurationS).toBeCloseTo(0.0225, 8);
  expect(current.incidentImpactForceLbf).not.toBe(current.peakStuckPointForceLbf);
});
