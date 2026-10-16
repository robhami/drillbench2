import fs from 'fs';
import path from 'path';
import { parseSurveyCsv } from './surveyImport';
import { calculateSurveyGeometry, evaluateSurveyAtMd } from './surveyGeometry';

const station = (mdFt, inclinationDeg, azimuthDeg = 90) => ({ mdFt, inclinationDeg, azimuthDeg });
const source = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
const survey = parseSurveyCsv(source, { mdUnit: 'ft', angleUnit: 'deg' });
const result = calculateSurveyGeometry(survey.stations);
const close = (actual, expected, tolerance = 1e-7) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

test('synthetic fixture includes boundaries and matches independently documented analytical TVDs', () => {
  expect(survey.valid).toBe(true);
  expect(result.valid).toBe(true);
  expect(result.summary.stationCount).toBe(41);
  [[3000, 3000], [5000, 4653.986686265376], [12000, 8153.986686265376]].forEach(([md, tvd]) => close(evaluateSurveyAtMd(result, md).tvdFt, tvd));
  close(result.stations[40].eastingFt, 7017.107485042442);
  close(result.stations[40].northingFt, 0);
  close(result.summary.maxInclinationDeg, 60);
  close(result.summary.maxDlsDegPer100Ft, 3, 1e-9);
});

test('build DLS is 3 degrees/100 ft and straight-section DLS is zero for every interval', () => {
  result.segments.forEach(segment => close(segment.dlsDegPer100Ft, segment.fromMdFt >= 3000 && segment.toMdFt <= 5000 ? 3 : 0, 1e-9));
  expect(evaluateSurveyAtMd(result, 3000).dlsDegPer100Ft).toBe(0);
  close(evaluateSurveyAtMd(result, 5000).dlsDegPer100Ft, 3, 1e-9);
});

test.each([0, 2750, 3000, 3000.001, 3050, 3750, 4999.999, 5000, 5025, 11025, 12000])('analytic interpolation agrees at MD %s, including section boundaries', md => {
  const radius = 6000 / Math.PI, theta = (md - 3000) * Math.PI / 6000;
  const expectedTvd = md <= 3000 ? md : md <= 5000 ? 3000 + radius * Math.sin(theta) : 4653.986686265376 + (md - 5000) * 0.5;
  const expectedEast = md <= 3000 ? 0 : md <= 5000 ? radius * (1 - Math.cos(theta)) : radius * 0.5 + (md - 5000) * Math.sqrt(3) / 2;
  const point = evaluateSurveyAtMd(result, md);
  expect(point.valid).toBe(true);
  close(point.tvdFt, expectedTvd);
  close(point.eastingFt, expectedEast);
  close(point.inclinationDeg, md <= 3000 ? 0 : md <= 5000 ? (md - 3000) * 0.03 : 60);
});

test('minimum-curvature station integration agrees with independent RF formula in 3D', () => {
  const geometry = calculateSurveyGeometry([station(0, 20, 30), station(500, 40, 80)]);
  const rad = Math.PI / 180, i0 = 20 * rad, i1 = 40 * rad, a0 = 30 * rad, a1 = 80 * rad;
  const beta = Math.acos(Math.cos(i0) * Math.cos(i1) + Math.sin(i0) * Math.sin(i1) * Math.cos(a1 - a0));
  const rf = 2 / beta * Math.tan(beta / 2), end = geometry.stations[1];
  close(end.tvdFt, 250 * (Math.cos(i0) + Math.cos(i1)) * rf);
  close(end.northingFt, 250 * (Math.sin(i0) * Math.cos(a0) + Math.sin(i1) * Math.cos(a1)) * rf);
  close(end.eastingFt, 250 * (Math.sin(i0) * Math.sin(a0) + Math.sin(i1) * Math.sin(a1)) * rf);
  close(geometry.segments[0].doglegDeg, beta / rad);
});

test('zero and tiny doglegs are finite, with exact straight-section displacement', () => {
  const geometry = calculateSurveyGeometry([station(0, 60), station(1000, 60)]);
  close(geometry.stations[1].tvdFt, 500);
  close(evaluateSurveyAtMd(geometry, 250).eastingFt, 250 * Math.sqrt(3) / 2);
  expect(geometry.segments[0].doglegDeg).toBe(0);
  const tiny = calculateSurveyGeometry([station(0, 60), station(1000, 60 + 1e-10)]);
  expect(tiny.valid).toBe(true);
  close(tiny.stations[1].tvdFt, 500);
});

test('azimuth wrap follows shortest arc, not a 180-degree interpolated azimuth', () => {
  const geometry = calculateSurveyGeometry([station(0, 90, 350), station(100, 90, 10)]);
  const middle = evaluateSurveyAtMd(geometry, 50);
  close(geometry.segments[0].doglegDeg, 20);
  close(middle.azimuthDeg, 0);
  close(geometry.stations[1].eastingFt, 0);
  close(geometry.stations[1].northingFt, 100 * Math.sin(Math.PI / 18) / (Math.PI / 18));
});

test('exact stations preserve 360 azimuth and no imported station is mutated', () => {
  const input = [Object.freeze(station(0, 0, 360)), Object.freeze(station(100, 0, 90))];
  const original = JSON.stringify(input);
  const geometry = calculateSurveyGeometry(Object.freeze(input));
  expect(JSON.stringify(input)).toBe(original);
  expect(evaluateSurveyAtMd(geometry, 0).azimuthDeg).toBe(360);
  expect(evaluateSurveyAtMd(geometry, 50).azimuthDeg).toBe(360);
});

test('nonzero first MD uses relative origin and never fabricates an unsurveyed tie-in', () => {
  const geometry = calculateSurveyGeometry([station(500, 0), station(1000, 0)]);
  expect(geometry.warnings[0]).toContain('relative');
  expect(geometry.stations[0].tvdFt).toBe(0);
  expect(geometry.summary.tvdFt).toBe(500);
  expect(evaluateSurveyAtMd(geometry, 0).valid).toBe(false);
});

test.each([-1, 12000.001, NaN, Infinity, '100'])('does not extrapolate or accept invalid query MD %s', md => {
  expect(evaluateSurveyAtMd(result, md).valid).toBe(false);
});

test('rejects invalid surveys and ambiguous antipodal intervals', () => {
  expect(calculateSurveyGeometry([station(0, 0)]).valid).toBe(false);
  expect(evaluateSurveyAtMd(null, 0).valid).toBe(false);
  expect(calculateSurveyGeometry([station(0, 0), station(100, 180)]).errors[0].message).toContain('180°');
  expect(calculateSurveyGeometry([station(0, 0), station(100, 179.9999999)]).valid).toBe(false);
});
