import { nominalHoleDiameter, componentNominalClearance, calcDeployedNominalClearances } from './nominalHoleClearance';
import { calcJarDownBuckling } from '../jar/drillstringBuckling';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';

const rows = [{ rowId: 'jar', category: 'JAR', length: 20, weight: 100, od: 6, idSize: 3, youngsModulusPsi: 30000000, bucklingIdealizationConfirmed: true },
  { rowId: 'dp', category: 'DP', length: 1, weight: 20, od: 5, idSize: 4, youngsModulusPsi: 30000000, bucklingIdealizationConfirmed: true }];
test.each([undefined, null, ''])('missing Bit Size %s is Not Configured', holeSize => {
  expect(nominalHoleDiameter({ holeSize })).toMatchObject({ status: 'not-configured', diameterIn: null });
});
test.each([0, -1, 'abc', Infinity])('invalid Bit Size %s is rejected', holeSize => {
  expect(nominalHoleDiameter({ holeSize }).status).toBe('invalid-input');
});
test('legacy holeSize remains the single nominal-diameter source', () => {
  expect(nominalHoleDiameter({ holeSize: '8.5' })).toMatchObject({ valid: true, diameterIn: 8.5 });
});
test('component clearances preserve negative and zero values and reject missing OD', () => {
  expect(componentNominalClearance({ holeSize: 8.5 }, { od: 5.5 })).toMatchObject({ valid: true, radialClearanceIn: 1.5 });
  expect(componentNominalClearance({ holeSize: 8.5 }, { od: 9.5 })).toMatchObject({ status: 'oversize', radialClearanceIn: -0.5 });
  expect(componentNominalClearance({ holeSize: 8.5 }, { od: 8.5 }).status).toBe('no-clearance');
  for (const od of [undefined, '', 0, -1, NaN]) expect(componentNominalClearance({ holeSize: 8.5 }, { od }).valid).toBe(false);
});
test('Auto DP clearance uses actual deployed length without changing saved rows', () => {
  const bha = { holeSize: 8, rows }, original = JSON.stringify(bha);
  for (const depth of [1000, 2000]) {
    const r = calcDeployedNominalClearances(bha, depth);
    expect(r.valid).toBe(true);
    expect(r.components[1]).toMatchObject({ lengthFt: depth - 20, topMdFt: 0, bottomMdFt: depth - 20, radialClearanceIn: 1.5 });
    expect(r.components[0].radialClearanceIn).toBe(1);
  }
  expect(JSON.stringify(bha)).toBe(original);
  expect(calcDeployedNominalClearances({ rows }, 1000).status).toBe('not-configured');
  expect(calcDeployedNominalClearances(bha, 10).valid).toBe(false);
});
test('Bit Size flows through existing Stage 4C input path; explicit bore overrides remain valid', () => {
  const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 60, azimuthDeg: 0 }, { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 0 }]);
  const input = { bha: { holeSize: 8, rows }, survey, bitMdFt: 1000, buoyancyFactor: 1, frictionCoefficient: 0, surfaceHookloadLbf: 0 };
  const result = calcJarDownBuckling(input);
  expect(result.status).toBe('calculated');
  expect(result.intervals.find(i => i.componentIndex === 1).radialClearanceIn).toBe(1.5);
  expect(result.intervals.find(i => i.componentIndex === 0).radialClearanceIn).toBe(1);
  expect(calcJarDownBuckling({ ...input, bha: { rows } }).status).toBe('unavailable');
  expect(calcJarDownBuckling({ ...input, bha: { ...input.bha, holeSize: 5 } }).status).toBe('unavailable');
  expect(calcJarDownBuckling({ ...input, wellboreDiameterIn: 10 }).intervals[0].radialClearanceIn).toBe(2.5);
});
