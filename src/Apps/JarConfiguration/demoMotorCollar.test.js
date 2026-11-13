import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import { demoMotorCollarGeometry, DEMO_MOTOR_NOTICE, labelDemoPlot } from './demoMotorCollar';
import { configurationGeometry } from './configurationData';
import { calculatePositionMatrix, matrixDefaults } from '../../engineering/jar/jarPositionMatrix';

test('temporary uniform surrogate preserves total air weight, physical lengths and original motor', () => {
  const before = JSON.stringify(live.bha), demo = demoMotorCollarGeometry(live.bha);
  expect(demo.valid).toBe(true);
  expect(demo.motor).toEqual(live.bha.rows[0]);
  expect(demo.motorWeightLbf).toBeCloseTo(3085.6, 8);
  expect(demo.geometry.l1Ft).toBeCloseTo(931.16798, 8);
  expect(demo.geometry.l2Ft).toBe(600);
  expect(demo.totalAirWeightLbf).toBeCloseTo(141085.6, 8);
  expect(demo.uniformAirWeightPerFt * demo.geometry.relocation.collarInventoryFt).toBeCloseTo(demo.totalAirWeightLbf, 8);
  expect(demo.rigidityLbf).toBeCloseTo(809047232.5176373, 5);
  const result = calculatePositionMatrix({ geometry: demo.geometry, fields: matrixDefaults(demo.geometry) });
  expect(result.validCount).toBeGreaterThan(0);
  expect(result.actual.jarCentreAboveBitFt).toBeCloseTo(947.66798, 8);
  expect(result.actual.collarAirWeightLbf).toBeCloseTo(demo.totalAirWeightLbf, 8);
  expect(JSON.stringify(live.bha)).toBe(before);
  expect(configurationGeometry(live.bha).valid).toBe(false);
});

test('missing properties and other geometry remain blocked, not replaced with a fixture', () => {
  expect(demoMotorCollarGeometry({ ...live.bha, rows: live.bha.rows.slice(1) }).valid).toBe(false);
  expect(demoMotorCollarGeometry({ ...live.bha, rows: live.bha.rows.map((r, i) => i ? r : { ...r, weight: '' }) }).valid).toBe(false);
  expect(demoMotorCollarGeometry(null).valid).toBe(false);
});

test('plot-only exports carry the exact demo warning and normal plots are unchanged', () => {
  const plot = { data: [], layout: { margin: { t: 20 } } };
  expect(labelDemoPlot(plot, null)).toBe(plot);
  expect(labelDemoPlot(plot, {}).layout.title.text).toBe(DEMO_MOTOR_NOTICE);
  expect(plot.layout.title).toBeUndefined();
});
