import fs from 'fs';
import path from 'path';
import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';
import { parseSurveyCsv } from '../../engineering/survey/surveyImport';
import { verticalSection, defaultSectionAzimuth, trajectoryPath, trajectoryFigure, withTrajectorySelection } from './trajectoryData';
const station = (mdFt, inclinationDeg, azimuthDeg = 90) => ({ mdFt, inclinationDeg, azimuthDeg });
const figure = (g, view = '3d', azimuth = 90) => trajectoryFigure(g, trajectoryPath(g), azimuth, 1, view, 'run');

test('Test 4 shares independently derived minimum-curvature coordinates across views', () => {
  const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  const g = calculateSurveyGeometry(parseSurveyCsv(csv, { mdUnit: 'ft', angleUnit: 'deg' }).stations);
  const radius = 2000 / (Math.PI / 3);
  const tvd = 3000 + radius * Math.sin(Math.PI / 3) + 7000 * 0.5;
  const east = radius * (1 - Math.cos(Math.PI / 3)) + 7000 * Math.sqrt(3) / 2;
  expect(g.stations.find(s => s.mdFt === 3000).tvdFt).toBeCloseTo(3000, 8);
  expect(g.stations.find(s => s.mdFt === 5000).inclinationDeg).toBe(60);
  const end = g.stations.at(-1);
  expect(end.tvdFt).toBeCloseTo(tvd, 8); expect(end.eastingFt).toBeCloseTo(east, 8);
  expect(end.northingFt).toBeCloseTo(0, 8); expect(defaultSectionAzimuth(g)).toBeCloseTo(90, 8);
  const three = figure(g), vertical = figure(g, 'vertical'), plan = figure(g, 'plan');
  expect(three.data[0].x).toEqual(plan.data[0].x);
  expect(three.data[0].y).toEqual(plan.data[0].y);
  expect(three.data[0].z).toEqual(vertical.data[0].y);
  expect(vertical.data[0].x.at(-1)).toBeCloseTo(east, 8);
  const scene = three.layout.scene;
  expect(scene.aspectmode).toBe('manual');
  expect((scene.xaxis.range[1] - scene.xaxis.range[0]) / scene.aspectratio.x).toBeCloseTo((scene.yaxis.range[1] - scene.yaxis.range[0]) / scene.aspectratio.y, 8);
  expect(scene.zaxis.autorange).toBe(false);
  expect(three.layout.scene.zaxis.range[0]).toBeGreaterThan(three.layout.scene.zaxis.range[1]);
  expect(plan.layout.yaxis).toMatchObject({ scaleanchor: 'x', scaleratio: 1 });
  expect(vertical.layout.yaxis.autorange).toBe('reversed');
});

test('vertical well retains finite equal-scale bounds and zero horizontal displacement', () => {
  const g = calculateSurveyGeometry([station(0, 0), station(1000, 0)]);
  expect(defaultSectionAzimuth(g)).toBe(0);
  expect(trajectoryPath(g).every(s => s.eastingFt === 0 && s.northingFt === 0)).toBe(true);
  expect(figure(g).layout.scene.xaxis.range).toEqual([-35, 35]);
  expect(figure(g, 'vertical').data[0].x.every(x => x === 0)).toBe(true);
});

test('constant inclination has independently expected TVD, North, East and section projections', () => {
  const g = calculateSurveyGeometry([station(0, 60, 30), station(1000, 60, 30)]);
  const end = g.stations.at(-1);
  expect(end.tvdFt).toBeCloseTo(500, 8);
  expect(end.northingFt).toBeCloseTo(750, 8);
  expect(end.eastingFt).toBeCloseTo(250 * Math.sqrt(3), 8);
  expect(verticalSection(end, 30)).toBeCloseTo(500 * Math.sqrt(3), 8);
  expect(verticalSection(end, 120)).toBeCloseTo(0, 8);
});

test('build/drop and azimuth changes use existing curved interpolation and retain every station', () => {
  const g = calculateSurveyGeometry([station(0, 0), station(1000, 60), station(2000, 0), station(3000, 45, 180)]);
  const points = trajectoryPath(g);
  g.stations.forEach(s => expect(points).toContain(s));
  expect(points.length).toBeGreaterThan(g.stations.length);
  expect(points.every(s => [s.mdFt, s.tvdFt, s.eastingFt, s.northingFt].every(Number.isFinite))).toBe(true);
  expect(points.at(-1).northingFt).toBeLessThan(0);
  const wrap = calculateSurveyGeometry([station(0, 90, 350), station(100, 90, 10)]);
  const middle = trajectoryPath(wrap).find(s => s.mdFt === 50);
  expect(middle.azimuthDeg).toBeCloseTo(0, 8);
  expect(wrap.stations.at(-1).eastingFt).toBeCloseTo(0, 8);
});

test.each([[], [station(0, 0)], [station(100, 0), station(0, 0)], [station(0, 0), { mdFt: 100 }], [station(0, 0), station(100, 180)]].map(stations => [stations]))('invalid, missing, single and degenerate input does not invent a path: %j', stations => {
  expect(trajectoryPath(calculateSurveyGeometry(stations))).toEqual([]);
});

test('large survey retains every station while bounding extra render sampling', () => {
  const g = calculateSurveyGeometry(Array.from({ length: 3001 }, (_, i) => station(i * 100, 30)));
  expect(trajectoryPath(g)).toHaveLength(3001);
  const base = trajectoryFigure(g, trajectoryPath(g), 90, null, 'plan', 'large');
  expect(base.data[1].x.length).toBeLessThanOrEqual(2000);
  const selected = withTrajectorySelection(base, g, 2999, 'plan', 90);
  expect(selected.data[0]).toBe(base.data[0]);
  expect(selected.data.at(-1).customdata[0][0]).toBe(2999);
});

test('tie-in origin and selected station metadata are shared, without altering geometry', () => {
  const g = calculateSurveyGeometry([station(500, 0), station(1000, 30)]), original = JSON.stringify(g);
  ['3d', 'vertical', 'plan'].forEach(view => {
    const p = figure(g, view);
    expect(p.data[2].name).toBe('Survey origin (not surface)');
    expect(p.data.at(-1).customdata[0]).toEqual([1, 1000, g.stations[1].tvdFt, 30, 90, g.stations[1].northingFt, g.stations[1].eastingFt, verticalSection(g.stations[1], 90)]);
  });
  expect(JSON.stringify(g)).toBe(original);
});
