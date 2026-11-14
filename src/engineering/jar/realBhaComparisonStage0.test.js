import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import reference from '../../../docs/ValidationStudies/OES8p5Stage6C1.reference.json';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { calculateRealBhaStatic, listComparisonJars } from './realBhaComparison';

const verticalSurvey = endMdFt => calculateSurveyGeometry([
  { mdFt: 0, inclinationDeg: 0, azimuthDeg: 0 },
  { mdFt: endMdFt, inclinationDeg: 0, azimuthDeg: 0 }
]);

test('active static jar baseline reproduces independent OES values and retains the BHA', () => {
  const bha = JSON.parse(JSON.stringify(frozen.workingCopy));
  const before = JSON.stringify(bha);
  const expected = reference.cases.find(row => row.wobLbf === 33000);
  const result = calculateRealBhaStatic({ bha, survey: verticalSurvey(9318), bitMdFt: 9318,
    surfaceMdFt: 0, mode: 'slide', jarIndex: 0, targetCompressionKlbf: 40 });

  expect(result.valid).toBe(true);
  expect(result.values.jarCentreFt).toBeCloseTo(reference.jar.centreFromBitFt, 6);
  expect(result.values.jarForceLbf).toBeCloseTo(expected.jarAxialForceLbf, 1);
  expect(result.values.hookloadLbf).toBeCloseTo(expected.surfaceHookloadLbf, 1);
  expect(result.values.neutralFt).toBeCloseTo(expected.neutralPoint.fromBitFt, 4);
  expect(result.values.requiredHookloadLbf).toBeCloseTo(reference.jar.requiredSurfaceHookloadLbf, 1);
  expect(result.values.jarForceLbf).toBeLessThan(0); // tension is negative
  expect(result.dynamicStatus).toMatch(/Dynamic impact comparison unavailable/);
  expect(JSON.stringify(bha)).toBe(before);
});

test('selected jar indices retain row identity when the BHA contains multiple jars', () => {
  const bha = JSON.parse(JSON.stringify(frozen.workingCopy));
  const first = bha.rows.find(row => row.category === 'JAR');
  const second = { ...first, rowId: 'stage0-second-jar', toolName: 'Second jar' };
  bha.rows.splice(bha.rows.indexOf(first) + 1, 0, second);

  expect(listComparisonJars(bha)).toEqual([
    { rowIndex: bha.rows.indexOf(first), name: first.toolName },
    { rowIndex: bha.rows.indexOf(second), name: second.toolName }
  ]);
  const selected = calculateRealBhaStatic({ bha, survey: verticalSurvey(9318), bitMdFt: 9318,
    surfaceMdFt: 0, mode: 'slide', jarIndex: 1 });
  expect(selected.valid).toBe(true);
  expect(selected.component.rowId).toBe(second.rowId);
});

test('survey coverage and load mode remain explicit inputs; Reference is unsupported here', () => {
  const bha = frozen.workingCopy;
  const missingCoverage = calculateRealBhaStatic({ bha, survey: verticalSurvey(9000), bitMdFt: 9318,
    surfaceMdFt: 0, mode: 'slide', jarIndex: 0 });
  const unsupportedReference = calculateRealBhaStatic({ bha, survey: verticalSurvey(9318), bitMdFt: 9318,
    surfaceMdFt: 0, mode: 'reference', jarIndex: 0 });

  expect(missingCoverage.valid).toBe(false);
  expect(missingCoverage.error).toMatch(/survey|coverage/i);
  expect(unsupportedReference.valid).toBe(false);
  expect(unsupportedReference.error).toMatch(/mode must be slide or rotate/i);
});
