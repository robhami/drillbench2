import fs from 'fs';
import path from 'path';
import { scanWobIntervals, calcWobRangesAtDepth } from './wobOperatingRanges';
import { calcJarClearanceAcrossRun } from './jarClearanceAcrossRun';
import { parseSurveyCsv } from '../survey/surveyImport';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';

const options = { minWobLbf: 0, maxWobLbf: 100, scanStepLbf: 10, wobToleranceLbf: 0.01 };
const evaluateMargin = fn => wob => { const marginFt = fn(wob); return { status: marginFt > 0 ? 'acceptable' : 'inside-zone', marginFt, topology: '1/0' }; };
const scan = (fn, extra = {}) => scanWobIntervals({ ...options, evaluate: evaluateMargin(fn), ...extra });
const regions = (result, status) => result.regions.filter(r => r.status === status);

test('single threshold uses a bounded bracket; range clipping is explicit and no maximum is reported', () => {
  const result = scan(w => 43.21 - w);
  expect(result.boundaries).toHaveLength(1);
  expect(result.boundaries[0]).toMatchObject({ lowerStatus: 'acceptable', upperStatus: 'inside-zone' });
  expect(result.boundaries[0].lowerWobLbf).toBeLessThanOrEqual(43.21);
  expect(result.boundaries[0].upperWobLbf).toBeGreaterThanOrEqual(43.21);
  expect(result.boundaries[0].upperWobLbf - result.boundaries[0].lowerWobLbf).toBeLessThanOrEqual(0.01);
  expect(regions(result, 'acceptable')[0]).toMatchObject({ lowerBoundary: 'evaluated-range-limit', lowerIncluded: true, upperIncluded: false });
  expect(result).not.toHaveProperty('maximumWobLbf');
});

test('nonmonotonic clearance preserves every disconnected acceptable interval, even with matching range endpoint states', () => {
  const result = scan(w => (w - 20.3) * (w - 40.7) * (w - 60.2) * (w - 80.8));
  expect(result.boundaries).toHaveLength(4);
  expect(regions(result, 'acceptable')).toHaveLength(3);
  expect(regions(result, 'inside-zone')).toHaveLength(2);
  expect(result.boundaries.map(b => b.estimatedWobLbf)).toEqual(expect.arrayContaining([expect.closeTo(20.3, 2), expect.closeTo(40.7, 2), expect.closeTo(60.2, 2), expect.closeTo(80.8, 2)]));
});

test('midpoint finds an inside island missed by matching scan-cell endpoints', () => {
  const result = scan(w => Math.abs(w - 5) - 1, { maxWobLbf: 10, scanStepLbf: 10 });
  expect(result.boundaries).toHaveLength(2);
  expect(regions(result, 'acceptable')).toHaveLength(2);
});

test('no acceptable interval and entire evaluated range acceptable remain distinct', () => {
  expect(regions(scan(() => -1), 'acceptable')).toHaveLength(0);
  expect(regions(scan(() => -1), 'inside-zone')).toHaveLength(1);
  const all = scan(() => 1);
  expect(all.regions).toHaveLength(1);
  expect(all.regions[0]).toMatchObject({ status: 'acceptable', lowerWobLbf: 0, upperWobLbf: 100, lowerBoundary: 'evaluated-range-limit', upperBoundary: 'evaluated-range-limit' });
  expect(all.boundaries).toEqual([]);
  expect(all.warning).toContain('No maximum WOB');
});

test('missing, invalid and thrown results are unknown, including gaps within otherwise acceptable coverage', () => {
  const result = scanWobIntervals({ ...options, evaluate: w => {
    if (w >= 40 && w <= 60) return { status: 'unknown', reason: 'No NP' };
    return evaluateMargin(() => 1)(w);
  } });
  expect(regions(result, 'acceptable')).toHaveLength(2);
  expect(regions(result, 'unknown').length).toBeGreaterThan(0);
  for (const evaluate of [() => null, () => ({ status: 'acceptable', marginFt: NaN }), () => { throw new Error('failed'); }]) {
    expect(scanWobIntervals({ ...options, evaluate }).regions.every(r => r.status === 'unknown')).toBe(true);
  }
});

test('failed refinement, topology change, discontinuity and evaluation limits never become acceptable transitions', () => {
  const noRefinement = scan(w => w - 43.21, { maxRefinements: 0 });
  expect(noRefinement.boundaries).toEqual([]);
  expect(regions(noRefinement, 'unknown').length).toBeGreaterThan(0);
  const discontinuity = scan(w => w < 43.21 ? -10 : 10);
  expect(discontinuity.boundaries).toEqual([]);
  const topology = scanWobIntervals({ ...options, evaluate: w => ({ ...evaluateMargin(w => w - 43.21)(w), topology: w < 43.21 ? '1/0' : '3/0' }) });
  expect(topology.boundaries).toEqual([]);
  const failed = scanWobIntervals({ ...options, evaluate: w => w > 42 && w < 44 ? { status: 'unknown', reason: 'Solver failed' } : evaluateMargin(w => w - 43.21)(w) });
  expect(failed.boundaries).toEqual([]);
  expect(regions(failed, 'unknown').length).toBeGreaterThan(0);
  const budget = scan(w => w - 43.21, { maxEvaluations: 21 });
  expect(budget.evaluationCount).toBeLessThanOrEqual(21);
  expect(regions(budget, 'unknown').length).toBeGreaterThan(0);
});

test('single WOB is a point; invalid ranges and excessive scans fail explicitly', () => {
  expect(scan(() => 1, { minWobLbf: 50, maxWobLbf: 50 }).regions[0]).toMatchObject({ lowerWobLbf: 50, upperWobLbf: 50 });
  for (const extra of [{ minWobLbf: -1 }, { maxWobLbf: -1 }, { scanStepLbf: 0 }, { scanStepLbf: 0.00001 }, { wobToleranceLbf: 0 }, { maxRefinements: 65 }]) expect(scan(() => 1, extra).valid).toBe(false);
});

const row = (category, length, weight, od, idSize) => ({ category, length, weight, od, idSize });
const bha = { rows: [row('STAB', 5, 111.25, 6.75, 2), row('DC', 300, 116, 6.75, 1.5), row('JAR', 30, 150, 9.5, 3), row('DC', 180, 116, 6.75, 1.5), row('DP', 11485, 27.76, 5.5, 4.67)] };
const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
const survey = calculateSurveyGeometry(parseSurveyCsv(csv, { mdUnit: 'ft', angleUnit: 'deg' }).stations);
const input = { bha, survey, minWobLbf: 10000, maxWobLbf: 35000, mudWeightPpg: 10, rpm: 150, ropFtHr: 60,
  surfaceMdFt: 0, deploymentMode: 'depth-dependent', avoidanceDistanceFt: 64 };

test.each([515, 4000, 5000, 7000, 12000])('Validation 4 at MD %s: deployed DP and every region agree with separately evaluated run scenarios', md => {
  const before = JSON.stringify(input);
  for (const mode of ['slide', 'rotate']) {
    const result = calcWobRangesAtDepth(input, md, mode, 0.25);
    expect(result.valid).toBe(true);
    expect(result.deployment.deployedDpLengthFt).toBe(md - 515);
    expect(result.boundaries.length).toBeGreaterThan(0);
    for (const region of result.regions.filter(r => r.status !== 'unknown')) {
      const wob = (region.lowerWobLbf + region.upperWobLbf) / 2;
      const direct = calcJarClearanceAcrossRun({ ...input, minWobLbf: wob, maxWobLbf: wob, startBitMdFt: md, endBitMdFt: md, modes: mode, frictionCoefficient: 0.25 });
      expect(direct.scenarios[0].jars[0].avoidanceStatus).toBe(region.status === 'acceptable' ? 'outside-avoidance-zone' : 'inside-avoidance-zone');
    }
  }
  expect(JSON.stringify(input)).toBe(before);
});

test.each(['slide', 'rotate'])('independent vertical and 60-degree weighted arithmetic bounds every %s avoidance threshold', mode => {
  const bf = 1 - 10 / 65.5;
  const lossAt = (distance, inclination) => {
    let remaining = distance, loss = 0;
    for (const component of bha.rows) {
      const length = Math.min(remaining, component.length);
      const fraction = mode === 'slide' ? 1 : 60 / Math.hypot(60, Math.PI * component.od * 150 * 5);
      loss += length * component.weight * bf * (Math.cos(inclination) - 0.25 * fraction * Math.sin(inclination));
      remaining -= length;
      if (remaining <= 0) break;
    }
    return loss;
  };
  for (const [md, inclination] of [[515, 0], [12000, Math.PI / 3]]) {
    const expected = [lossAt(256, inclination), lossAt(384, inclination)].filter(w => w >= 10000 && w <= 35000);
    const result = calcWobRangesAtDepth(input, md, mode, 0.25);
    expect(result.boundaries).toHaveLength(expected.length);
    expected.forEach((w, index) => {
      expect(result.boundaries[index].lowerWobLbf).toBeLessThanOrEqual(w + 0.001);
      expect(result.boundaries[index].upperWobLbf).toBeGreaterThanOrEqual(w - 0.001);
      expect(Math.abs(result.boundaries[index].estimatedWobLbf - w)).toBeLessThanOrEqual(1);
    });
  }
});

test('Slide and Rotate differ; missing NP, shallow deployment, missing jar and invalid Rotate inputs are unknown', () => {
  const slide = calcWobRangesAtDepth(input, 12000, 'slide', 0.25);
  const rotate = calcWobRangesAtDepth(input, 12000, 'rotate', 0.25);
  expect(slide.boundaries[0].estimatedWobLbf).toBeLessThan(rotate.boundaries[0].estimatedWobLbf);
  for (const result of [
    calcWobRangesAtDepth(input, 500, 'slide', 0.25),
    calcWobRangesAtDepth(input, 515, 'slide', 0.25, 9),
    calcWobRangesAtDepth({ ...input, rpm: undefined }, 515, 'rotate', 0.25),
    calcWobRangesAtDepth({ ...input, minWobLbf: 100000, maxWobLbf: 100000 }, 515, 'slide', 0.25)
  ]) expect(result.regions.every(r => r.status === 'unknown')).toBe(true);
});
