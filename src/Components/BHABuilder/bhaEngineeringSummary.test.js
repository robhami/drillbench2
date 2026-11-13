import { calculateBhaEngineeringSummary } from './bhaEngineeringSummary';
import oesCapture from '../../../docs/ValidationStudies/OES8p5Stage6C1.source.json';

const row = (category, length, weight = 100, density = 490) => ({ category, toolName: category,
  length: String(length), weight: String(weight), ...(category === 'DC' ? { od: '6.5', idSize: '2.813' } : {}),
  componentDefinition: { material: { name: 'Explicit material', densityLbFt3: density } } });
const bha = (rows, extra = {}) => ({ rows, mudWeight: 10, trajectoryMode: 'directional', surveyState: { active: {
  confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,60,0\n100,60,0\n200,60,0\n500,60,0\n1000,60,0'
}, history: [], reviewRequired: false }, ...extra });

test('uses actual sequence, excludes DP from BHA length, and reports the contiguous same-size adjacent DC sections', () => {
  const result = calculateBhaEngineeringSummary(bha([row('BIT', 1), row('STB', 114.53), row('DC', 509.8), row('JAR', 33), row('DC', 90), row('HWDP', 274.63), row('DP', 200), row('DC', 50)]));
  expect(result.geometry).toMatchObject({ bhaLengthFt: 1022.96, belowJarLengthFt: 625.33, availableDcBelowJarLengthFt: 509.8, availableDcAboveJarLengthFt: 90 });
  expect(result.geometry).toMatchObject({ availableDcBelowJarStartFt: 115.53, availableDcBelowJarEndFt: 625.33,
    availableDcAboveJarStartFt: 658.33, availableDcAboveJarEndFt: 748.33 });
});

test('does not aggregate DCs across intervening tools and consistently uses the first jar', () => {
  const result = calculateBhaEngineeringSummary(bha([row('BIT', 1), row('DC', 9), row('STB', 1), row('JAR', 10), row('HWDP', 1), row('DC', 20), row('JAR', 5)]));
  expect(result.geometry.availableDcBelowJarLengthFt).toBe(0);
  expect(result.geometry.availableDcAboveJarLengthFt).toBe(0);
  expect(result.geometry.belowJarLengthFt).toBe(11);
});

test('sums consecutive compatible collars, and stops at a taper or connection mismatch', () => {
  const dc = (length, od = 6.5, idSize = 2.813, connections = {}) => ({ ...row('DC', length), od, idSize, ...connections });
  const sameSize = calculateBhaEngineeringSummary(bha([row('BIT', 1), dc(8), dc(7), row('JAR', 5), dc(6), dc(4), row('DP', 100)]));
  expect(sameSize.geometry).toMatchObject({ availableDcBelowJarLengthFt: 15, availableDcAboveJarLengthFt: 10 });
  expect(sameSize.geometry.availableDcBelowJarConnectionUnverified).toBe(true);
  const tapered = calculateBhaEngineeringSummary(bha([row('BIT', 1), dc(8), dc(7, 4.75, 2.25), row('JAR', 5), dc(6), dc(4, 4.75, 2.25), row('DP', 100)]));
  expect(tapered.geometry).toMatchObject({ availableDcBelowJarLengthFt: 7, availableDcAboveJarLengthFt: 6 });
  expect(tapered.weights.availableDcBelowJarBuoyedWeightLbf).toBeCloseTo(7 * 100 * (1 - 10 / 65.5), 6);
  expect(tapered.weights.availableDcAboveJarBuoyedWeightLbf).toBeCloseTo(6 * 100 * (1 - 10 / 65.5), 6);
  const mismatched = calculateBhaEngineeringSummary(bha([row('BIT', 1), dc(8, 6.5, 2.813, { connectionTop: 'NC50' }), dc(7, 6.5, 2.813, { connectionBottom: 'NC46' }), row('JAR', 5)]));
  expect(mismatched.geometry.availableDcBelowJarLengthFt).toBe(7);
});

test('stabilizers separate adjacent DC sections and absent adjacent collars report zero', () => {
  const separated = calculateBhaEngineeringSummary(bha([row('BIT', 1), row('DC', 12), row('STB', 3), row('DC', 8), row('JAR', 5), row('STB', 2), row('DC', 6), row('DP', 100)]));
  expect(separated.geometry).toMatchObject({ availableDcBelowJarLengthFt: 8, availableDcAboveJarLengthFt: 0 });
  const none = calculateBhaEngineeringSummary(bha([row('BIT', 1), row('HWDP', 3), row('JAR', 5), row('STB', 2), row('DP', 100)]));
  expect(none.geometry).toMatchObject({ availableDcBelowJarLengthFt: 0, availableDcAboveJarLengthFt: 0 });
  expect(none.weights).toMatchObject({ availableDcBelowJarBuoyedWeightLbf: 0, availableDcBelowJarAxialWeightLbf: 0,
    availableDcAboveJarBuoyedWeightLbf: 0, availableDcAboveJarAxialWeightLbf: 0 });
});

test.each(['above', 'below'])('HWDP immediately %s the jar is a boundary, not an available DC', side => {
  const rows = side === 'above'
    ? [row('BIT', 1), row('DC', 10), row('JAR', 5), row('HWDP', 20), row('DC', 8), row('DP', 50)]
    : [row('BIT', 1), row('HWDP', 20), row('DC', 8), row('JAR', 5), row('DC', 10), row('DP', 50)];
  const result = calculateBhaEngineeringSummary(bha(rows));
  expect(result.geometry.availableDcBelowJarLengthFt).toBe(side === 'below' ? 8 : 10);
  expect(result.geometry.availableDcAboveJarLengthFt).toBe(side === 'above' ? 0 : 10);
  expect(result.weights.availableDcBelowJarBuoyedWeightLbf).toBeCloseTo((side === 'below' ? 8 : 10) * 100 * (1 - 10 / 65.5), 6);
  expect(result.weights.availableDcAboveJarBuoyedWeightLbf).toBeCloseTo((side === 'above' ? 0 : 10 * 100 * (1 - 10 / 65.5)), 6);
});

test('sums each compatible DC row ppf and projects its own position through a 60-degree survey', () => {
  const result = calculateBhaEngineeringSummary(bha([
    row('BIT', 1, 20), row('DC', 4, 100), row('DC', 6, 200), row('JAR', 5, 300),
    row('DC', 3, 50), row('DC', 2, 150), row('HWDP', 4, 70)
  ]));
  const factor = 1 - 10 / 65.5;
  expect(result.geometry).toMatchObject({ availableDcBelowJarLengthFt: 10, availableDcAboveJarLengthFt: 5 });
  expect(result.weights.availableDcBelowJarBuoyedWeightLbf).toBeCloseTo((4 * 100 + 6 * 200) * factor, 6);
  expect(result.weights.availableDcAboveJarBuoyedWeightLbf).toBeCloseTo((3 * 50 + 2 * 150) * factor, 6);
  expect(result.weights.availableDcBelowJarAxialWeightLbf).toBeCloseTo((4 * 100 + 6 * 200) * factor * 0.5, 5);
  expect(result.weights.availableDcAboveJarAxialWeightLbf).toBeCloseTo((3 * 50 + 2 * 150) * factor * 0.5, 5);
});

test('missing mud or survey affects only the dependent available-DC weight values', () => {
  const rows = [row('BIT', 1), row('DC', 4, 100), row('JAR', 2), row('DC', 3, 100)];
  const missingSurvey = calculateBhaEngineeringSummary({ ...bha(rows), surveyState: { active: null, history: [], reviewRequired: false } });
  expect(missingSurvey.geometry).toMatchObject({ availableDcBelowJarLengthFt: 4, availableDcAboveJarLengthFt: 3 });
  expect(missingSurvey.weights.availableDcBelowJarBuoyedWeightLbf).toBeCloseTo(400 * (1 - 10 / 65.5), 6);
  expect(missingSurvey.weights.availableDcBelowJarAxialWeightLbf).toBeNull();
  expect(missingSurvey.availableDcWeightReasons.below.axial).toMatch(/survey/i);
  const missingMud = calculateBhaEngineeringSummary(bha(rows, { mudWeight: '' }));
  expect(missingMud.geometry.availableDcBelowJarLengthFt).toBe(4);
  expect(missingMud.weights.availableDcBelowJarBuoyedWeightLbf).toBeNull();
  expect(missingMud.weights.availableDcAboveJarAxialWeightLbf).toBeNull();
  expect(missingMud.availableDcWeightReasons.above.buoyed).toMatch(/mud weight/i);
});

test('uses equivalent ppf and the nominal-steel factor for buoyancy; survey TVD for axial gravity', () => {
  const result = calculateBhaEngineeringSummary(bha([row('BIT', 1, 100, 170), row('DC', 9, 100, 170), row('JAR', 10, 100, 300), row('DP', 100, 999)]));
  const factor = 1 - 10 / 65.5;
  expect(result.weights.buoyedBhaWeightLbf).toBeCloseTo(2000 * factor, 5);
  expect(result.weights.buoyedBelowJarLbf).toBeCloseTo(1000 * factor, 5);
  expect(result.weights.axialBhaWeightLbf).toBeCloseTo(2000 * factor * 0.5, 1);
  expect(result.weights.axialBelowJarLbf).toBeCloseTo(1000 * factor * 0.5, 1);
});

test('BHA axial summary follows the selected trajectory and withholds Directional weights without a survey', () => {
  const rows = [row('BIT', 1, 100), row('DC', 9, 100), row('JAR', 10, 100)];
  const measured = bha(rows, { drillpipeReferenceBitMdFt: 100 });
  const directional = calculateBhaEngineeringSummary(measured);
  const vertical = calculateBhaEngineeringSummary({ ...measured, trajectoryMode: 'vertical' });
  const missing = calculateBhaEngineeringSummary({ ...measured, surveyState: { active: null, history: [], reviewRequired: false } });
  expect(directional.weights.axialBhaWeightLbf).toBeCloseTo(directional.weights.buoyedBhaWeightLbf * 0.5, 5);
  expect(vertical.weights.axialBhaWeightLbf).toBeCloseTo(vertical.weights.buoyedBhaWeightLbf, 5);
  expect(missing.weights.axialBhaWeightLbf).toBeNull();
  expect(missing.weights.buoyedBhaWeightLbf).toBeCloseTo(vertical.weights.buoyedBhaWeightLbf, 5);
});

test('does not require material density, but withholds results for missing mud, survey, or lengths', () => {
  const noDensity = calculateBhaEngineeringSummary(bha([row('BIT', 1, 10, ''), row('STB', 3, 25, ''), row('JAR', 10, 70, '')]));
  expect(noDensity.weights.buoyedBhaWeightLbf).toBeCloseTo((10 + 75) * (1 - 10 / 65.5), 8);
  const missingSurvey = calculateBhaEngineeringSummary({ ...bha([row('BIT', 1), row('JAR', 10)]), trajectoryMode: 'directional', surveyState: { active: null, history: [], reviewRequired: false } });
  expect(missingSurvey.weights.axialBhaWeightLbf).toBeNull();
  expect(missingSurvey.surveyReason).toMatch(/Load and confirm a survey/);
  const missingMud = calculateBhaEngineeringSummary(bha([row('BIT', 1), row('JAR', 10)], { mudWeight: '' }));
  expect(missingMud.weights.buoyedBhaWeightLbf).toBeNull();
  expect(missingMud.reasons.join(' ')).toMatch(/mud weight/);
  const missingLength = calculateBhaEngineeringSummary(bha([row('BIT', 1), { ...row('DC', 2), length: '' }, row('JAR', 10)]));
  expect(missingLength.geometry.bhaLengthFt).toBeNull();
  expect(missingLength.reasons.join(' ')).toMatch(/positive length/);
});

test('complete OES BHA with BIT, STB, JAR, DC, and HWDP calculates preliminary weights without material densities', () => {
  const oes = oesCapture.workingCopy;
  const bit = { rowId: 'summary-bit', category: 'BIT', toolName: 'Test bit', length: '1', weight: '95' };
  const testBha = { ...oes, rows: [bit, ...oes.rows] };
  const result = calculateBhaEngineeringSummary(testBha);
  const firstDp = testBha.rows.findIndex(component => component.category === 'DP');
  const firstJar = testBha.rows.findIndex(component => component.category === 'JAR');
  const dryBha = testBha.rows.slice(0, firstDp).reduce((sum, component) => sum + Number(component.length) * Number(component.weight), 0);
  const dryBelowJar = testBha.rows.slice(0, firstJar).reduce((sum, component) => sum + Number(component.length) * Number(component.weight), 0);
  const factor = 1 - Number(testBha.mudWeight) / 65.5;
  expect([...new Set(testBha.rows.map(component => component.category))]).toEqual(expect.arrayContaining(['BIT', 'STB', 'JAR', 'DC', 'HWDP', 'DP']));
  expect(result.weights.buoyedBhaWeightLbf).toBeCloseTo(dryBha * factor, 6);
  expect(result.weights.buoyedBelowJarLbf).toBeCloseTo(dryBelowJar * factor, 6);
  expect(result.weights.buoyedBhaWeightLbf).toBeCloseTo(67367.18, 2);
  expect(result.weights.buoyedBelowJarLbf).toBeCloseTo(48148.62, 2);
  expect(result.weights.axialBhaWeightLbf).toBeCloseTo(dryBha * factor, 5);
  expect(result.weights.axialBelowJarLbf).toBeCloseTo(dryBelowJar * factor, 5);
  expect(result.geometry).toMatchObject({ bhaLengthFt: 1022.96, belowJarLengthFt: 625.33,
    availableDcBelowJarLengthFt: 509.77, availableDcAboveJarLengthFt: 89.96 });
  expect(result.weights.axialBhaWeightLbf).toBeCloseTo(result.weights.buoyedBhaWeightLbf, 8);
  expect(result.weights.axialBelowJarLbf).toBeCloseTo(result.weights.buoyedBelowJarLbf, 8);
});
