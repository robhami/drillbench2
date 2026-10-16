import { importedGeometry, clearanceBounds, clearanceRequest, clearanceSummary, clearancePlot, axialProfilePlot, crossingDepthDescription, avoidanceDepthIntervals } from './clearanceData';
import { calcJarClearanceAcrossRun } from '../../engineering/jar/jarClearanceAcrossRun';
import { calcSurveyAxialLoads } from '../../engineering/forces/calcSurveyAxialLoads';

const source = { originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n1000,0,90', confirmed: true };
const survey = importedGeometry(source);
const bha = { rows: [{ category: 'DC', length: 50, weight: 100, od: 8 }, { category: 'JAR', length: 20, weight: 100, od: 8 }, { category: 'DC', length: 130, weight: 100, od: 8 }] };
const fields = { start: '300', end: '500', increment: '100', minWob: '4', maxWob: '8', samples: '3', modes: 'both', friction: '0.25,0.3', avoidance: '12', mud: '10', rpm: '40', rop: '200' };

test('coverage defaults to fixed lower length for deployed DP, with explicit surface coverage and structure errors', () => {
  const withPipe = { ...bha, rows: [...bha.rows, { category: 'DP', length: 11035, weight: 20, od: 5 }] };
  expect(clearanceBounds(withPipe, survey)).toMatchObject({ start: 200, end: 1000, deployed: true, covered: true });
  expect(clearanceRequest(withPipe, survey, fields).request).toMatchObject({ deploymentMode: 'depth-dependent', surfaceMdFt: 0 });
  expect(clearanceRequest(withPipe, survey, { ...fields, surface: '' }).valid).toBe(false);
  const later = importedGeometry({ ...source, originalCsv: 'MD,Inclination,Azimuth\n100,0,90\n1000,0,90' });
  expect(clearanceBounds(withPipe, later).error).toContain('surface reference');
  expect(clearanceBounds(withPipe, later, 100)).toMatchObject({ start: 300, covered: true });
  expect(clearanceBounds({ rows: [...withPipe.rows, withPipe.rows[3]] }, survey).error).toContain('multiple DP');
});

test('uses confirmed stored survey and complete-BHA bounds without mutation or extrapolation', () => {
  const original = JSON.stringify({ bha, source });
  expect(importedGeometry(null).valid).toBe(false);
  expect(importedGeometry({ ...source, confirmed: false }).valid).toBe(false);
  expect(clearanceBounds(bha, survey)).toMatchObject({ start: 200, end: 1000, defaultAvoidance: 12 });
  expect(clearanceRequest(bha, survey, { ...fields, start: '199' }).error).toContain('No extrapolation');
  expect(clearanceRequest(bha, survey, { ...fields, end: '1001' }).valid).toBe(false);
  expect(JSON.stringify({ bha, source })).toBe(original);
});

test('converts klbf to lbf and maps explicit operating inputs without changing BHA', () => {
  const prepared = clearanceRequest(bha, survey, fields);
  expect(prepared.valid).toBe(true);
  expect(prepared.request).toMatchObject({ minWobLbf: 4000, maxWobLbf: 8000, modes: 'both', frictionCoefficients: [0.25, 0.3], mudWeightPpg: 10, rpm: 40, ropFtHr: 200, avoidanceDistanceFt: 12, maxScenarios: 2000 });
  expect(prepared.request.bha).toBe(bha);
});

test.each([{ minWob: '' }, { start: 'bad' }, { samples: '1' }, { samples: '2.5' }, { increment: '0' }, { minWob: '-1' }, { maxWob: '2' }, { avoidance: '-1' }, { friction: '0.2,' }, { friction: '1.1' }, { mud: '65.5' }, { rpm: '' }, { rop: '0' }, { modes: 'pickup' }, { samples: '1000' }])('rejects invalid inputs/cap before running: %j', override => {
  expect(clearanceRequest(bha, survey, { ...fields, ...override }).valid).toBe(false);
});

test('selected graph preserves signed distances, missing samples, and scenario isolation', () => {
  const result = calcJarClearanceAcrossRun({ bha, survey, startBitMdFt: 100, endBitMdFt: 300, depthIncrementFt: 100, minWobLbf: 4000, maxWobLbf: 8000, wobSamples: 3, modes: 'both', frictionCoefficient: 0.25, buoyancyFactor: 1 });
  const before = JSON.stringify(result);
  const below = clearancePlot(result, 12, 1, result.scenarios[0]);
  expect(below.data[0]).toMatchObject({ x: [100, 200, 300], y: [null, -20, -20], mode: 'markers', connectgaps: false });
  const above = clearancePlot(result, 12, 1, result.scenarios.find(s => s.wobLbf === 8000));
  expect(above.data[0].y).toEqual([null, 20, 20]);
  const at = clearancePlot(result, 0, 1, result.scenarios.find(s => s.wobLbf === 6000));
  expect(at.data[1].y).toEqual([0, 0]);
  expect(at.layout.shapes[0]).toMatchObject({ y0: -0, y1: 0 });
  expect(below.layout.shapes[0]).toMatchObject({ y0: -12, y1: 12 });
  expect(below.layout.xaxis.title.text).toBe('Bit MD (ft)');
  expect(JSON.stringify(result)).toBe(before);
});

test('only selected-jar depth crossings appear, separately from coincidences', () => {
  const scenario = { wobLbf: 4000, mode: 'slide', frictionCoefficient: 0.25 };
  const depthEvent = { mode: scenario.mode, frictionCoefficient: scenario.frictionCoefficient, jarIndex: 0, kind: 'inferred-between-depth-samples', from: { ...scenario, bitMdFt: 300 }, to: { ...scenario, bitMdFt: 400 }, approximateBitMdFt: 350 };
  const result = { scenarios: [{ ...scenario, bitMdFt: 300, valid: true, jars: [{ jarIndex: 0, signedSeparationFt: 20, absoluteSeparationFt: 20 }] }], crossingEvents: [depthEvent, { ...depthEvent, jarIndex: 1 }, { ...depthEvent, mode: 'rotate' }, { ...depthEvent, kind: 'inferred-between-wob-samples' }, { ...scenario, jarIndex: 0, kind: 'sampled-crossing', bitMdFt: 300 }] };
  const plot = clearancePlot(result, 12, 1);
  expect(plot.data[1]).toMatchObject({ x: [300], y: [0], marker: { symbol: 'diamond' } });
  expect(plot.data[2]).toMatchObject({ x: [300, 400], y: [0, 0], marker: { symbol: 'diamond-open' } });
  expect(clearancePlot(result, 12, 1, scenario, 1).data[0].y).toEqual([null]);
});

test('secondary chart uses actual Stage2A profile and labels above-bit distance separately from MD', () => {
  const load = calcSurveyAxialLoads({ bha, survey, bitMdFt: 300, wobLbf: 6000, mode: 'slide', frictionCoefficient: 0.25, buoyancyFactor: 1 });
  const plot = axialProfilePlot(load, 1);
  expect(plot.data[0].x).toEqual(load.profile.map(p => p.fromBitFt));
  expect(plot.data[0].y).toEqual(load.profile.map(p => p.axialForceLbf));
  expect(plot.layout.xaxis.title.text).toContain('not wellbore MD');
});

test('crossing descriptions distinguish sampled depths, nonunique intervals, and inferred brackets', () => {
  expect(crossingDepthDescription({ kind: 'sampled-crossing', bitMdFt: 300 })).toBe('Sampled at bit MD 300 ft');
  expect(crossingDepthDescription({ kind: 'sampled-neutral-interval', bitMdFt: 400 })).toContain('nonunique neutral interval');
  expect(crossingDepthDescription({ kind: 'inferred-between-depth-samples', from: { bitMdFt: 300 }, to: { bitMdFt: 500 }, approximateBitMdFt: 375 })).toBe('Jar axial-load sign-change bracket: bit MD 300 to 500 ft (inferred; refine sampling; not an exact NP crossing depth)');
});

test.each([10000, 35000].flatMap(wobLbf => ['slide', 'rotate'].map(mode => [wobLbf, mode])))('comparison retains only selected depth sign-change brackets for WOB %s / %s', (wobLbf, mode) => {
  const { comparisonClearances, comparisonPlot } = require('./clearanceData');
  const selections = [10000, 35000].flatMap(wob => ['slide', 'rotate'].map(m => ({ wobLbf: wob, mode: m, frictionCoefficient: 0.25 })));
  const events = selections.map((selection, i) => ({
    kind: 'inferred-between-depth-samples', jarIndex: 0, mode: selection.mode, frictionCoefficient: 0.25,
    from: { ...selection, bitMdFt: 300 + i * 100 }, to: { ...selection, bitMdFt: 400 + i * 100 }, approximateBitMdFt: 350 + i * 100
  }));
  const expected = events.find(e => e.mode === mode && e.from.wobLbf === wobLbf);
  const result = { depthsFt: [300], scenarios: selections.map(s => ({ ...s, bitMdFt: 300, valid: true, jars: [], errors: [] })), crossingEvents: [
    ...events,
    { ...expected, jarIndex: 1 },
    { ...expected, frictionCoefficient: 0.3 },
    { ...expected, kind: 'inferred-between-wob-samples' },
    { ...expected, from: { ...expected.from, wobLbf: 20000 } },
    { ...expected, to: { ...expected.to, wobLbf: 20000 } }
  ] };
  const before = JSON.stringify(result);
  const request = { minWobLbf: 10000, maxWobLbf: 35000, avoidanceDistanceFt: 64 };
  const series = comparisonClearances(result, request, 0.25);
  const index = series.findIndex(s => s.selection.wobLbf === wobLbf && s.selection.mode === mode);
  expect(expected).not.toHaveProperty('wobLbf');
  expect(series[index].events).toEqual([expected]);
  const trace = comparisonPlot(result, request, 1, series).data[index * 4 + 2];
  expect(trace.x).toEqual([expected.from.bitMdFt, expected.to.bitMdFt]);
  expect(trace.name).toContain('Jar axial-load sign-change bracket');
  expect(trace.text).toEqual([crossingDepthDescription(expected), crossingDepthDescription(expected)]);
  expect(JSON.stringify(result)).toBe(before);
});

const zoneSamples = statuses => statuses.map((status, index) => ({ bitMdFt: 100 + index * 100, jar: status ? { avoidanceStatus: status } : null }));
const inside = 'inside-avoidance-zone', outside = 'outside-avoidance-zone';
test('zone entry and exit brackets preserve repeated sampled visits', () => {
  expect(avoidanceDepthIntervals(zoneSamples([outside, inside, outside, inside, outside]))).toEqual([
    { entry: 'Entry bracket: 100 to 200 ft', exit: 'Exit bracket: 200 to 300 ft' },
    { entry: 'Entry bracket: 300 to 400 ft', exit: 'Exit bracket: 400 to 500 ft' }
  ]);
});
test('zone intervals stop at unavailable depths and identify open run boundaries', () => {
  expect(avoidanceDepthIntervals(zoneSamples([inside, null, inside]))).toEqual([
    { entry: 'Already inside at run start 100 ft; entry unknown', exit: 'Inside at 100 ft before unavailable sample; exit unknown' },
    { entry: 'Inside at 300 ft after unavailable sample; entry unknown', exit: 'Still inside at run end 300 ft; exit unknown' }
  ]);
  expect(avoidanceDepthIntervals(zoneSamples([outside, 'no-neutral-within-bha', null]))).toEqual([]);
  expect(avoidanceDepthIntervals([])).toEqual([]);
});


test('comparison selects exact endpoint WOB/mode/friction results and preserves gaps and errors', () => {
  const { comparisonClearances, comparisonPlot } = require('./clearanceData');
  const request = { minWobLbf: 4000, maxWobLbf: 8000, avoidanceDistanceFt: 12 };
  const scenarios = [];
  for (const bitMdFt of [300, 400, 500]) for (const wobLbf of [4000, 6000, 8000]) for (const mode of ['slide', 'rotate']) for (const frictionCoefficient of [0.25, 0.3]) {
    const signedSeparationFt = wobLbf / 100 + (mode === 'rotate' ? 1 : 0) + frictionCoefficient;
    scenarios.push({ bitMdFt, wobLbf, mode, frictionCoefficient, valid: true, errors: [], jars: [{ jarIndex: 0, signedSeparationFt, absoluteSeparationFt: signedSeparationFt, jarAxialLoadLbf: mode === 'slide' ? 10 : -10, avoidanceStatus: 'outside-avoidance-zone' }] });
  }
  const failed = scenarios.find(s => s.bitMdFt === 400 && s.wobLbf === 8000 && s.mode === 'rotate' && s.frictionCoefficient === 0.3);
  failed.valid = false; failed.errors = ['Unsupported sample']; failed.jars = [];
  const result = { depthsFt: [300, 400, 500], scenarios, crossingEvents: [] };
  const before = JSON.stringify(result);
  const series = comparisonClearances(result, request, 0.3);
  expect(series.map(s => s.selection)).toEqual([4000, 8000].flatMap(wobLbf => ['slide', 'rotate'].map(mode => ({ wobLbf, mode, frictionCoefficient: 0.3 }))));
  const traces = comparisonPlot(result, request, 2, series).data.filter(t => t.showlegend);
  expect(traces.map(t => t.y)).toEqual([[-40.3, -40.3, -40.3], [-41.3, -41.3, -41.3], [-80.3, -80.3, -80.3], [-81.3, null, -81.3]]);
  expect(new Set(traces.map(t => t.marker.color)).size).toBe(4);
  expect(traces.every(t => t.mode === 'markers' && t.connectgaps === false)).toBe(true);
  expect(series[3].errors).toEqual(['Unsupported sample']);
  expect(comparisonClearances(result, { ...request, maxWobLbf: 4000 }, 0.3)).toHaveLength(2);
  expect(comparisonClearances(result, request, 0.9).every(s => s.missing === 3)).toBe(true);
  expect(JSON.stringify(result)).toBe(before);
});

test('comparison requests both modes even for slide-only analysis and validates rotation inputs', () => {
  expect(clearanceRequest(bha, survey, { ...fields, modes: 'slide' }, true).request.modes).toBe('both');
  expect(clearanceRequest(bha, survey, { ...fields, modes: 'slide', rpm: '' }, true).valid).toBe(false);
  expect(clearanceRequest(bha, survey, { ...fields, modes: 'slide', rpm: '' }).valid).toBe(true);
});

test('sample exposure independently integrates status, reports unknown footage and compression uses load', () => {
  const { sampledExposure, compressionDepthIntervals } = require('./clearanceData');
  const samples = zoneSamples([outside, inside, inside, outside, null]);
  // Two 100-ft transitions contribute 50 ft each, plus a 100-ft inside span.
  expect(sampledExposure(samples)).toEqual({ estimatedFt: 200, unresolvedFt: 100 });
  samples[0].jar.jarAxialLoadLbf = 10;
  samples[1].jar.jarAxialLoadLbf = -10;
  samples[2].jar.jarAxialLoadLbf = 10;
  samples[3].jar.jarAxialLoadLbf = 10;
  expect(compressionDepthIntervals(samples)).toEqual(['100\u2013100 ft (sampled; boundaries uncertain)', '300\u2013400 ft (sampled; boundaries uncertain)']);
});


test('each endpoint comparison trace and jar load matches the existing Stage 2A result on an inclined survey', () => {
  const { comparisonClearances, comparisonPlot } = require('./clearanceData');
  const inclined = importedGeometry({ ...source, originalCsv: 'MD,Inclination,Azimuth\n0,45,90\n1000,45,90' });
  const request = clearanceRequest(bha, inclined, { ...fields, modes: 'slide' }, true).request;
  const result = calcJarClearanceAcrossRun(request);
  const series = comparisonClearances(result, request, 0.3);
  const plot = comparisonPlot(result, request, 1, series);
  series.forEach((s, index) => s.samples.forEach((sample, depthIndex) => {
    const load = calcSurveyAxialLoads({ bha, survey: inclined, bitMdFt: sample.bitMdFt, ...s.selection, mudWeightPpg: 10, rpm: 40, ropFtHr: 200 });
    expect(sample.jar.jarAxialLoadLbf).toBeCloseTo(load.jars[0].axialForceLbf, 8);
    const expectedDistance = load.neutralPoints[0].fromBitFt - load.jars[0].centreFromBitFt;
    expect(plot.data[index * 4].y[depthIndex]).toBeCloseTo(expectedDistance, 8);
  }));
});
