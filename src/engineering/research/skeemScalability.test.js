import { compactInitialWaves } from './nonUniformSkeemUp';
import { simulateNonUniformAxialWave } from './nonUniformAxialWave';

const wave = (fromM, toM, forceN = -400, patch = {}) => ({ sectionId: 'steel', direction: 'down', fromM, toM, forceN, ...patch });
test('snapshot compaction preserves piecewise forces and never joins gaps, directions, sections or unequal amplitudes', () => {
  const input = [wave(0, 1), wave(1, 2), wave(2, 3, -400 + 1e-12), wave(3, 4, 1e-30),
    wave(5, 6, 1e-30), wave(6, 7, 1e-30, { direction: 'up' }), wave(7, 8, 1e-30, { sectionId: 'other' })];
  const before = JSON.stringify(input), output = compactInitialWaves(input);
  expect(output).toHaveLength(6);
  expect(output[0]).toEqual(wave(0, 2));
  expect(output.slice(1)).toEqual(input.slice(2));
  expect(JSON.stringify(input)).toBe(before);
  for (let x = .25; x < 8; x += .5) {
    const force = waves => waves.filter(w => w.fromM <= x && x < w.toM).reduce((s, w) => s + w.forceN, 0);
    expect(force(output)).toBe(force(input));
  }
});
test('compacted intervals preserve wave histories, initial energy and boundary response', () => {
  const request = { model: 'research-linear-axial-waves', units: 'SI', durationS: .01,
    sections: [{ id: 'steel', kind: 'uniform-elastic', lengthM: 10, areaM2: .001, densityKgM3: 8000, youngsModulusPa: 200e9 }],
    boundaries: { left: 'matched', right: 'fixed' }, initialWaves: [wave(0, 1), wave(1, 2), wave(2, 3)] };
  const original = simulateNonUniformAxialWave(request);
  const compacted = simulateNonUniformAxialWave({ ...request, initialWaves: compactInitialWaves(request.initialWaves) });
  expect(original.valid).toBe(true); expect(compacted.valid).toBe(true);
  const at = (h, t) => h.filter(p => p.timeS <= t).at(-1)?.forceN ?? 0;
  for (let i = 0; i < original.interfaces.length; i++) {
    for (const p of [...original.interfaces[i].history, ...compacted.interfaces[i].history]) {
      expect(at(compacted.interfaces[i].history, p.timeS)).toBeCloseTo(at(original.interfaces[i].history, p.timeS), 9);
    }
  }
  expect(compacted.energy[0].initialPhysicalJ).toBeCloseTo(original.energy[0].initialPhysicalJ, 12);
  expect(Math.abs(compacted.energy.at(-1).residualJ)).toBeLessThan(1e-12);
});
