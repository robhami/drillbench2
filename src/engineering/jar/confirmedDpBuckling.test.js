import fs from 'fs';
import path from 'path';
import { evaluateConfirmedDpBuckling } from './confirmedDpBuckling';
import { solveStaticJarHookload } from './inverseStaticJarLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { parseSurveyCsv } from '../survey/surveyImport';

const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 60, azimuthDeg: 0 }, { mdFt: 2000, inclinationDeg: 60, azimuthDeg: 0 }]);
const bha = { holeSize: 16, rows: [{ rowId: 'jar', category: 'JAR', length: 20, weight: 150, od: 9.5, idSize: 3, bucklingIdealizationConfirmed: true },
  { rowId: 'dp', category: 'DP', length: 980, weight: 27.76, od: 5.5, idSize: 4.67 }] };
const base = { bha, survey, selectedDpIndex: 1, youngsModulusPsi: 30000000, confirmed: true,
  bitMdFt: 1000, surfaceMdFt: 0, mudWeightPpg: 10, frictionCoefficient: .25, surfaceHookloadLbf: 0 };

test.each(['', undefined, 0, -1, 'bad', Infinity])('explicit valid modulus required: %s', youngsModulusPsi => {
  expect(evaluateConfirmedDpBuckling({ ...base, youngsModulusPsi })).toMatchObject({ status: 'Not Evaluated', valid: false });
});
test('confirmation only enables selected DP, without changing saved geometry or flags', () => {
  const before = JSON.stringify(bha);
  expect(evaluateConfirmedDpBuckling({ ...base, confirmed: false }).status).toBe('Not Evaluated');
  const r = evaluateConfirmedDpBuckling(base);
  expect(r.status).toBe('Partial screening');
  expect(r.calculated.intervals.filter(i => i.applicability === 'applicable').every(i => i.componentId === 'dp')).toBe(true);
  expect(r.exclusions.some(i => i.componentId === 'jar')).toBe(true);
  expect(r.evaluatedCompressedLengthFt + r.unevaluatedCompressedLengthFt).toBeCloseTo(r.totalCompressedLengthFt, 8);
  expect(JSON.stringify(bha)).toBe(before);
  expect(evaluateConfirmedDpBuckling({ ...base, selectedDpIndex: 0 }).status).toBe('Not Evaluated');
});
test.each([undefined, '', 0, -1, 5.5, 5])('missing hole or nonpositive clearance %s prevents DP screening', holeSize => {
  const r = evaluateConfirmedDpBuckling({ ...base, bha: { ...bha, holeSize } });
  expect(r.status).toBe('Not Evaluated');
  if (r.valid) expect(r.evaluatedCompressedLengthFt).toBe(0);
});
test('invalid DP geometry is not evaluated', () => {
  const r = evaluateConfirmedDpBuckling({ ...base, bha: { ...bha, rows: [bha.rows[0], { ...bha.rows[1], idSize: 6 }] } });
  expect(r.status).toBe('Not Evaluated');
});
test('Bit Size remains the nominal hole source even if a caller supplies a bore override', () => {
  const r = evaluateConfirmedDpBuckling({ ...base, wellboreDiameterIn: 8 });
  const dp = r.calculated.intervals.find(i => i.componentId === 'dp');
  expect(dp.radialClearanceIn).toBe(5.25);
});
test.each([0, 30])('vertical or curved survey is excluded: %s', endInclination => {
  const geometry = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 0 }, { mdFt: 2000, inclinationDeg: endInclination, azimuthDeg: 0 }]);
  const r = evaluateConfirmedDpBuckling({ ...base, survey: geometry });
  expect(r.status).toBe('Not Evaluated');
  expect(r.evaluatedCompressedLengthFt).toBe(0);
});

const reference = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/Test4BucklingStudyStage4C3.json'), 'utf8'));
const test4Survey = calculateSurveyGeometry(parseSurveyCsv(fs.readFileSync(path.join(process.cwd(), reference.configuration.surveyPath), 'utf8'), { mdUnit: 'ft', angleUnit: 'deg' }).stations);
test.each(reference.scenarios)('confirmed Test 4 reproduces conditional reference at $targetKlbf klbf', scenario => {
  const config = { ...reference.configuration, survey: test4Survey, jarDirection: 'down', desiredJarForceLbf: scenario.targetKlbf * 1000 };
  const inverse = solveStaticJarHookload(config);
  expect(inverse.valid).toBe(true);
  expect(inverse.requiredSurfaceHookloadLbf).toBeCloseTo(scenario.requiredSurfaceHookloadLbf, 6);
  const r = evaluateConfirmedDpBuckling({ ...config, selectedDpIndex: 4, confirmed: true, surfaceHookloadLbf: inverse.requiredSurfaceHookloadLbf });
  expect(r.valid).toBe(true);
  for (const key of ['firstSinusoidalOnset', 'firstHelicalOnset']) {
    const expected = scenario.conditionalDpOnly.summary[key];
    if (expected) {
      expect(r.summary[key].mdFt).toBeCloseTo(expected.mdFt, 6);
      expect(r.summary[key].atIntervalTop).toBe(expected.atIntervalTop);
    } else expect(r.summary[key]).toBeNull();
  }
  expect(r.summary.maximumSinusoidalUtilization).toBeCloseTo(scenario.conditionalDpOnly.summary.maximumSinusoidalUtilization, 10);
  expect(r.evaluatedCompressedLengthFt).toBeCloseTo(scenario.conditionalDpOnly.evaluatedCompressedLengthFt, 6);
  expect(r.unevaluatedCompressedLengthFt).toBeCloseTo(scenario.conditionalDpOnly.unevaluatedCompressedLengthFt, 6);
});
