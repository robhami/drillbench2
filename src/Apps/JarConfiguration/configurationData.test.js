import { calcSkeemConfigurationSweep } from '../../engineering/jar/skeemConfigurationSweep';
import { calcSkeemPostImpact } from '../../engineering/jar/skeemDynamics';
import { configurationGeometry, configurationRequest, configurationPlot, METRICS } from './configurationData';

export const bha = { rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'JAR', length: 10 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95) }
] };
const geometry = configurationGeometry(bha);
const fields = { mode: 'fixed-total', total: '240', l1Min: '60', l1Max: '180', l2Min: '60', l2Max: '180', samples2d: '3', samplesL1: '3', samplesL2: '3', overpull: '165', stroke: '4' };
const sweep = mode => calcSkeemConfigurationSweep(configurationRequest(geometry, { ...fields, mode }).request);

test('reuses supported geometry and entered uniform air weights without changing BHA', () => {
  const before = JSON.stringify(bha);
  expect(geometry.valid).toBe(true);
  expect(geometry).toMatchObject({ l1Ft: 60, l2Ft: 180, constants: { freePipeLengthFt: 3000, collarOdIn: 6.25, collarIdIn: 2.75 } });
  expect(geometry.constants.materialWeightDensityLbfIn3).toBeCloseTo(0.283, 12);
  expect(JSON.stringify(bha)).toBe(before);
});
test.each([
  { category: 'HWDP' }, { idSize: '' }, { od: 8 }, { weight: '' }, { weight: 100 }
])('rejects unsupported or inconsistent upper collars %j', changes => {
  expect(configurationGeometry({ rows: bha.rows.map((r, i) => i === 2 ? { ...r, ...changes } : r) }).valid).toBe(false);
});
test('controls map to numeric requests and moderate explicit-run limits', () => {
  const result = configurationRequest(geometry, fields);
  expect(result.request).toMatchObject({ mode: 'fixed-total', totalCollarLengthFt: 240, l1: { minFt: 60, maxFt: 180, samples: 3 }, constants: { overpullKlbf: 165, strokeIn: 4 } });
  expect(result.request.l2).toBeUndefined();
  expect(configurationRequest(geometry, { ...fields, samples2d: '501' }).valid).toBe(false);
  expect(configurationRequest(geometry, { ...fields, mode: 'independent', samplesL1: '100' }).valid).toBe(false);
  expect(Number.isNaN(configurationRequest(geometry, { ...fields, l1Min: '' }).request.l1.minFt)).toBe(true);
});
test('fixed-total trace has correct units, hover values, maxima and actual marker', () => {
  const result = sweep('fixed-total');
  const plot = configurationPlot(result, 'impulse', result.samples[0]);
  expect(plot.data[0].x).toEqual([60, 120, 180]);
  expect(plot.data[0].y).toEqual(result.samples.map(s => s.impulseLbfS));
  expect(plot.data[0].customdata).toEqual([180, 120, 60]);
  expect(plot.data[0].text).toEqual([240, 240, 240]);
  expect(plot.data[0].hovertemplate).toContain('Total effective collars: %{text:.2f} ft');
  expect(plot.data[0].hovertemplate).toContain('L2: %{customdata:.2f} ft');
  expect(plot.layout.xaxis.title.text).toContain('L1');
  expect(plot.layout.yaxis.title.text).toBe('Primary stuck-point impulse (lbf·s)');
  expect(plot.data.find(t => t.name === 'Actual BHA').x).toEqual([60]);
  expect(plot.data.find(t => t.name === 'Maximum sampled value').y).toEqual([result.maxima.impulse.impulseLbfS]);
  expect(configurationPlot(result, 'impulse', { ...result.samples[0], totalCollarLengthFt: 300 }).data.some(t => t.name === 'Actual BHA')).toBe(false);
});
test('2D invalid samples produce null gaps, not zero or connected segments', () => {
  const result = calcSkeemConfigurationSweep({ ...configurationRequest(geometry, fields).request, l1: { minFt: 180, maxFt: 300, samples: 3 } });
  const plot = configurationPlot(result, 'impactForce');
  expect(plot.data[0].y).toEqual([result.samples[0].impactForceKlbf, null, null]);
  expect(plot.data[0].connectgaps).toBe(false);
});
test('3D X=L1 Y=L2 Z=selected metric and only actual vertices populate mesh', () => {
  const result = sweep('independent');
  const plot = configurationPlot(result, 'averageForce', null, 7);
  const mesh = plot.data.find(t => t.type === 'mesh3d');
  expect(mesh.x).toEqual(result.samples.map(s => s.l1Ft));
  expect(mesh.y).toEqual(result.samples.map(s => s.l2Ft));
  expect(mesh.z).toEqual(result.samples.map(s => s.averageStuckPointForceKlbf));
  expect(mesh.customdata).toEqual(result.samples.map(s => s.totalCollarLengthFt));
  expect(mesh.hovertemplate).toContain('Total effective collars: %{customdata:.2f} ft');
  expect(plot.data.find(t => t.name === 'Maximum sampled value').customdata).toEqual([result.maxima.averageForce.totalCollarLengthFt]);
  expect(mesh.i).toHaveLength(8); // Four cells, two triangles per cell.
  expect(plot.layout.scene.xaxis.title.text).toContain('L1');
  expect(plot.layout.scene.yaxis.title.text).toContain('L2');
  expect(plot.layout.scene.zaxis.title.text).toBe('Average force (klbf)');
  expect(plot.layout.uirevision).toBe(7);
  expect(mesh.hovertemplate).toContain('L2: %{y:.2f} ft');
  expect(plot.layout.scene.xaxis.nticks).toBe(5);
  expect(plot.layout.scene.yaxis.nticks).toBe(5);
  expect(plot.layout.scene.camera.eye.y).toBeLessThan(0);
  expect(mesh.colorbar.thickness).toBe(16);
});

test('65-ft upper and lower collars agree with a direct solver under documented reference geometry', () => {
  const constants = { ...geometry.constants, overpullKlbf: 165, strokeIn: 4 };
  const result = calcSkeemConfigurationSweep({ mode: 'independent', constants,
    l1: { minFt: 65, maxFt: 65, samples: 1 }, l2: { minFt: 65, maxFt: 65, samples: 1 } });
  const area = Math.PI / 4 * (6.25 ** 2 - 2.75 ** 2);
  const direct = calcSkeemPostImpact({ ...constants, overpullLbf: 165000,
    lowerCollarLengthFt: 65, upperCollarLengthFt: 65,
    lowerCollarWeightLbf: area * 12 * constants.materialWeightDensityLbfIn3 * 65 });
  expect(direct.valid).toBe(true);
  expect(result.samples[0].valid).toBe(true);
  expect(result.samples[0].averageStuckPointForceKlbf).toBeCloseTo(direct.averageStuckPointForceKlbf, 9);
  expect(direct.averageStuckPointForceKlbf).toBeCloseTo(695.7171900149698, 9);
  expect(result.samples[0].impulseLbfS).toBeCloseTo(direct.impulseLbfS, 9);
});
test('3D mesh does not triangulate across an invalid centre or fill isolated points', () => {
  const result = sweep('independent');
  const hole = { ...result, samples: result.samples.map((s, i) => i === 4 ? { ...s, valid: false, impulseLbfS: null } : s) };
  const plot = configurationPlot(hole, 'impulse');
  expect(plot.data.some(t => t.type === 'mesh3d')).toBe(false);
  const points = plot.data.find(t => t.name === 'Calculated samples');
  expect(points.x).toHaveLength(8);
  expect(points.z).not.toContain(null);
  expect(points.z).not.toContain(0);
});
test('metric changes only map returned metrics and preserve original results and camera revision', () => {
  const result = sweep('independent');
  const before = JSON.stringify(result);
  Object.entries(METRICS).forEach(([key, info]) => {
    const plot = configurationPlot(result, key, null, 5);
    expect(plot.data[0].z).toEqual(result.samples.map(s => s[info.field]));
    expect(plot.layout.uirevision).toBe(5);
  });
  expect(JSON.stringify(result)).toBe(before);
});
