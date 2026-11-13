import { configurationGeometry, configurationRequest, relocationRequest, configurationResponseMap } from './configurationData';
import { calculateJarPerformance } from '../JarPlacement/skeemPerformance';
import { calcSkeemConfigurationSweep } from '../../engineering/jar/skeemConfigurationSweep';
import reference from '../../../docs/ValidationStudies/JarPositionCoupledGeometryAndL2Verification.independent.json';

const bha = { rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'JAR', length: 10 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95) }
] };
const fields = { mode: 'independent', total: '999', l1Min: '60', l1Max: '180', l2Min: '60', l2Max: '180', samples2d: '3', samplesL1: '3', samplesL2: '3', overpull: '165', stroke: '4' };
const geometry = configurationGeometry(bha);
const sweep = () => calcSkeemConfigurationSweep(relocationRequest(geometry, fields).request);

test('fixed-endpoint relocation conserves actual inventory, jar body, transition, L3 and free top', () => {
  const before = JSON.stringify(bha), result = sweep();
  expect(result.analysisKind).toBe('geometry-constrained-relocation');
  expect(result.relocation).toMatchObject({ collarInventoryFt: 240, jarLengthFt: 10, transitionAboveBitFt: 250, l3Ft: 3000, freeTopAboveBitFt: 3250, stuckPointAboveBitFt: 0 });
  expect(result.samples.map(s => [s.l1Ft, s.l2Ft, s.l3Ft])).toEqual([[60, 180, 3000], [120, 120, 3000], [180, 60, 3000]]);
  for (const sample of result.samples) {
    expect(sample.constructibility).toContain('assembly unverified');
    // Construct the ideal continuous uniform sections, not a different fixture.
    const candidate = { ...bha, rows: bha.rows.map((row, i) => ({ ...row, length: i === 0 ? sample.l1Ft : i === 2 ? sample.l2Ft : row.length })) };
    const direct = calculateJarPerformance(candidate, { strokeIn: 4, overpullKlbf: 165, stuckPointFt: 0 });
    expect(direct.valid).toBe(true);
    expect(direct.jar.centreFromBit).toBe(sample.l1Ft + 5);
    expect(direct.input.lowerCollarLengthFt).toBe(sample.l1Ft);
    expect(direct.input.upperCollarLengthFt).toBe(sample.l2Ft);
    expect(direct.input.freePipeLengthFt).toBe(3000);
    expect(direct.impactForceKlbf).toBeCloseTo(sample.impactForceKlbf, 10);
    expect(direct.impulseLbfS).toBeCloseTo(sample.impulseLbfS, 8);
    expect(sample.l1Ft + 10 + sample.l2Ft + sample.l3Ft).toBe(3250);
  }
  expect(JSON.stringify(bha)).toBe(before);
});

test.each(reference)('L2=$input.upperCollarLengthFt independently controls velocity, force, impulse and timing at fixed L1=60', ({ input, expected }) => {
  const result = calcSkeemConfigurationSweep(configurationRequest(geometry, { ...fields, l1Min: '60', l1Max: '60', samplesL1: '1', l2Min: String(input.upperCollarLengthFt), l2Max: String(input.upperCollarLengthFt), samplesL2: '1' }).request);
  const sample = result.samples[0]; expect(sample.valid).toBe(true);
  for (const [actual, expectedValue] of [[sample.impactVelocityFtS, expected.hammerVelocityFtS], [sample.impactTimeS, expected.impactTimeS],
    [sample.impactForceLbf, expected.impactForceLbf], [sample.peakStuckPointForceLbf, expected.peakForceLbf], [sample.impulseLbfS, expected.impulseLbfS]]) {
    expect(Math.abs(actual - expectedValue)).toBeLessThan(1e-8);
  }
  expect(sample.reflectionPeriodS).toBe(expected.primaryPulseDurationS);
  expect(sample.reflectionCount).toBe(expected.completedReflections);
});

test('L2 influence is nonlinear: some velocities repeat while timing and impulse change', () => {
  const samples = calcSkeemConfigurationSweep(configurationRequest(geometry, { ...fields, l1Min: '60', l1Max: '60', samplesL1: '1' }).request).samples;
  expect(samples[0].impactVelocityFtS).not.toBe(samples[1].impactVelocityFtS);
  expect(samples[0].impactForceLbf).not.toBe(samples[1].impactForceLbf);
  expect(samples[0].peakStuckPointForceLbf).not.toBe(samples[1].peakStuckPointForceLbf);
  expect(samples[1].impactVelocityFtS).toBe(samples[2].impactVelocityFtS);
  expect(samples[1].impactTimeS).not.toBe(samples[2].impactTimeS);
  expect(samples[1].impulseLbfS).not.toBe(samples[2].impulseLbfS);
});

test('moving an actual BHA transition at fixed free top updates L3 from the actual pipe, not the prior path', () => {
  const changed = { rows: bha.rows.map((row, i) => ({ ...row, length: i === 2 ? 220 : i === 3 ? 2960 : row.length })) };
  const next = configurationGeometry(changed);
  expect(next.relocation).toMatchObject({ transitionAboveBitFt: 290, l3Ft: 2960, freeTopAboveBitFt: 3250, collarInventoryFt: 280 });
  const result = calcSkeemConfigurationSweep(relocationRequest(next, fields).request);
  expect(result.samples.every(s => s.l3Ft === 2960 && s.l1Ft + s.l2Ft === 280)).toBe(true);
});

test.each(['transitionAboveBitFt', 'l3Ft', 'collarInventoryFt', 'jarLengthFt'])('unsupported relocation changes to %s are rejected', key => {
  const request = relocationRequest(geometry, fields).request;
  expect(calcSkeemConfigurationSweep({ ...request, relocation: { ...request.relocation, [key]: request.relocation[key] + 1 } }).valid).toBe(false);
});

test('non-collar tools, mixed dimensions and missing collar inventory cannot create a relocation path', () => {
  for (const patch of [{ category: 'HWDP' }, { od: 8 }, { weight: 100 }]) {
    const bad = configurationGeometry({ rows: bha.rows.map((row, i) => i === 2 ? { ...row, ...patch } : row) });
    expect(relocationRequest(bad, fields).valid).toBe(false);
  }
  expect(relocationRequest({ ...geometry, relocation: null }, fields).valid).toBe(false);
  const invalid = calcSkeemConfigurationSweep(relocationRequest(geometry, { ...fields, l1Min: '-1', l1Max: '-1', samples2d: '1' }).request);
  expect(invalid.validCount).toBe(0); expect(invalid.samples[0].impactForceLbf).toBeNull();
});

test.each(['peakForce', 'impulse'])('%s response map keeps exact grid cells, actual BHA and constraint path distinct', metric => {
  const result = calcSkeemConfigurationSweep(configurationRequest(geometry, fields).request), actual = sweep().samples[0];
  const map = configurationResponseMap(result, metric, actual, geometry, 1);
  const points = map.data[0], field = metric === 'peakForce' ? 'peakStuckPointForceKlbf' : 'impulseLbfS';
  expect(points.mode).toBe('markers'); expect(points.marker.symbol).toBe('square');
  result.samples.forEach((s, i) => {
    expect(points.x[i]).toBe(s.l1Ft); expect(points.y[i]).toBe(s.l2Ft);
    expect(points.marker.color[i]).toBe(s[field]);
  });
  expect(map.data.find(t => t.name === 'Actual BHA configuration')).toMatchObject({ x: [60], y: [180] });
  const path = map.data.find(t => t.name === 'Fixed-inventory geometry path');
  path.x.forEach((x, i) => expect(x + path.y[i]).toBe(240));
  expect(result.analysisKind).toBe('independent-research'); expect(result.relocation).toBeNull();
});

test('unconstrained surface maximum is outside actual collar inventory and is not labelled an achievable placement', () => {
  const result = calcSkeemConfigurationSweep(configurationRequest(geometry, fields).request);
  expect(result.maxima.peakForce.l1Ft + result.maxima.peakForce.l2Ft).toBe(120);
  expect(sweep().maxima.peakForce.l1Ft + sweep().maxima.peakForce.l2Ft).toBe(240);
  const map = configurationResponseMap(result, 'peakForce', sweep().samples[0], geometry);
  expect(map.data.find(t => t.name === 'Highest sensitivity sample').hovertemplate).toContain('Not an achievable placement claim');
  const hole = { ...result, samples: result.samples.map((s, i) => i === 4 ? { ...s, valid: false } : s) };
  const points = configurationResponseMap(hole, 'peakForce', null, geometry).data[0];
  expect(points.x).toHaveLength(8);
  expect(points.x.some((x, i) => x === 120 && points.y[i] === 120)).toBe(false);
});
