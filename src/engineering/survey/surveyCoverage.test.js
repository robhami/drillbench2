import { validateSurveyCoverage } from './surveyCoverage';
import { calculateSurveyGeometry } from './surveyGeometry';
import { calcStaticJarLoads } from '../jar/staticJarLoads';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { calcStringWeightSummary } from '../bha/calcStringWeightSummary';
const geometry = depths => calculateSurveyGeometry(depths.map(mdFt => ({ mdFt, inclinationDeg: 0, azimuthDeg: 90 })));
const check = (survey, startMdFt = 0, endMdFt = 300) => validateSurveyCoverage(survey, { startMdFt, endMdFt });
test('complete arc coverage reports actual and required ft intervals', () => {
  const result = check(geometry([0, 100, 200, 300]));
  expect(result.covered).toBe(true);
  expect(result.requiredCoverage).toEqual({ startMdFt: 0, endMdFt: 300 });
  expect(result.actualCoverage).toEqual([{ startMdFt: 0, endMdFt: 300 }]);
  expect(result.missingIntervals).toEqual([]);
});
test('missing survey reports entire required interval', () => {
  expect(check(null).missingIntervals).toEqual([{ startMdFt: 0, endMdFt: 300, location: 'entire' }]);
  expect(check(null).covered).toBe(false);
});
test('partial and nonzero-start coverage locate beginning and end gaps', () => {
  const result = check(geometry([100, 200]));
  expect(result.missingIntervals).toEqual([{ startMdFt: 0, endMdFt: 100, location: 'beginning' }, { startMdFt: 200, endMdFt: 300, location: 'end' }]);
  expect(result.message).toContain('actual 100–200 ft; required 0–300 ft; missing 0–100 ft, 200–300 ft');
  expect(check(geometry([100, 300]), 100, 300).covered).toBe(true);
});
test('internal gap is not hidden by bounding survey range', () => {
  const survey = geometry([0, 100, 200, 300]); survey.segments.splice(1, 1);
  const result = check(survey);
  expect(result.surveyRange).toEqual({ startMdFt: 0, endMdFt: 300 });
  expect(result.missingIntervals).toEqual([{ startMdFt: 100, endMdFt: 200, location: 'internal' }]);
  expect(result.covered).toBe(false);
});
test('internally invalid arc and inconsistent summary cannot authorize calculations', () => {
  const bad = geometry([0, 100, 200, 300]); bad.segments[1].doglegRad = NaN;
  expect(check(bad)).toMatchObject({ covered: false, status: 'invalid-survey' });
  expect(check(bad).missingIntervals[0]).toMatchObject({ startMdFt: 100, endMdFt: 200 });
  const inconsistent = geometry([0, 300]); inconsistent.summary.endMdFt = 1000;
  expect(check(inconsistent).covered).toBe(false);
  const invalid = geometry([0, 300]); invalid.stations[1].inclinationDeg = NaN;
  expect(check(invalid).covered).toBe(false);
  const invalidCoordinates = geometry([0, 100, 200, 300]); invalidCoordinates.stations[1].tvdFt = NaN;
  expect(check(invalidCoordinates).covered).toBe(false);
});
test('invalid required depth is unavailable rather than zero', () => {
  expect(check(geometry([0, 300]), 0, NaN).status).toBe('invalid-required-interval');
});
test.each(['gap', 'invalid'])('all dependent engineering entry points reject internal %s before integration', type => {
  const survey = geometry([0, 100, 200, 300]);
  if (type === 'gap') survey.segments.splice(1, 1); else survey.segments[1].turn[0] = NaN;
  const bha = { rows: [{ category: 'JAR', length: 20, weight: 100, od: 6.75 }, { category: 'DC', length: 280, weight: 100, od: 6.75 }] };
  const input = { bha, survey, bitMdFt: 300, surfaceMdFt: 0, jarIndex: 0, mudWeightPpg: 10, frictionCoefficient: 0.25, direction: 'slackoff', surfaceHookloadLbf: 50000, mode: 'slide', wobLbf: 10000 };
  for (const solve of [calcStaticJarLoads, calcSurveyAxialLoads, calcStringWeightSummary]) {
    const result = solve(input);
    expect(result.valid).toBe(false);
    expect(result.status).toBe('outside-survey');
    expect(result.coverage.covered).toBe(false);
  }
});
