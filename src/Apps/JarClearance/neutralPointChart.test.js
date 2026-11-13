import { visibleAxis, neutralPointChart, curveLabel } from './neutralPointChart';

const selection = { wobLbf: 10000, mode: 'slide', frictionCoefficient: 0.25 };
function fixture(values = [-10, 0, 20], avoidanceDistanceFt = 5) {
  const scenarios = values.map((v, i) => ({ ...selection, bitMdFt: 1000 + i * 100, valid: true,
    neutralPoints: v === null ? [] : [{ fromBitFt: 100 + v, componentIndex: 1 }], neutralIntervals: [],
    jars: [{ jarIndex: 0, jarFromBitFt: 100 }] }));
  return [{ data: [{ name: 'Minimum WOB 10 klbf — Slide', showlegend: true, x: scenarios.map(s => s.bitMdFt), y: values, marker: { color: '#0072B2' } }], layout: { xaxis: {}, yaxis: {}, uirevision: 1 } },
    { scenarios }, { avoidanceDistanceFt, startBitMdFt: 1000, endBitMdFt: 1200 }];
}
const chart = (values, threshold, hidden) => neutralPointChart(...fixture(values, threshold), hidden, 0, [selection]);

test.each([[10, 20], [-20, -10], [-0.001, 0.001], [0, 0], [100, 100], [-1e7, 1e7]])('visible axis includes zero, pads finite values and uses rounded ticks: %j', (...values) => {
  const axis = visibleAxis([{ y: values }]);
  expect(axis.range[0]).toBeLessThan(Math.min(0, ...values));
  expect(axis.range[1]).toBeGreaterThan(Math.max(0, ...values));
  expect(axis.dtick).toBeGreaterThan(0);
  expect((axis.range[1] - axis.range[0]) / axis.dtick).toBeLessThanOrEqual(8);
});

test('one, two and four visible curves scale independently; hidden outliers and zone do not expand range', () => {
  const data = [1, 10, 100, 1000].map(v => ({ y: [v], visible: true }));
  const full = visibleAxis(data);
  data[3].visible = false; data[2].visible = false;
  const two = visibleAxis(data);
  data[1].visible = false;
  const one = visibleAxis(data);
  expect(full.range[1]).toBeGreaterThan(two.range[1]);
  expect(two.range[1]).toBeGreaterThan(one.range[1]);
  data[0].visible = false; expect(visibleAxis(data)).toBeNull();
  data.forEach(t => { t.visible = true; }); expect(visibleAxis(data)).toEqual(full);
  expect(chart([1, 2], 10000).layout.yaxis.range).toEqual(chart([1, 2], 1).layout.yaxis.range);
});

test('line samples preserve values and real sign changes without splines or dense markers', () => {
  const plot = chart([-10, 10, -20, 30]);
  expect(plot.data[0].y).toEqual([-10, 10, -20, 30]);
  expect(plot.data[0].mode).toBe('lines+markers');
  expect(plot.data[0].marker.size).toEqual([0, 0, 0, 0]);
  expect(plot.data[0].line).toMatchObject({ width: 2.25, shape: 'linear', simplify: false, dash: 'solid' });
});

test('missing NP and multiple zeros break connections and retain all zeros; unique component crossings retain guides', () => {
  const args = fixture([10, 20, 30, null]);
  args[1].scenarios[1].neutralPoints.push({ fromBitFt: 160, componentIndex: 2 });
  const plot = neutralPointChart(...args, {}, 0, [selection]);
  expect(plot.data[0].y).toEqual([10, null, null, null, 30, null, null]);
  expect(plot.data[1].y).toEqual([20, 60]);
  expect(plot.data[1].mode).toBe('markers');
  const changed = fixture([10, 20]); changed[1].scenarios[1].neutralPoints[0].componentIndex = 2;
  expect(neutralPointChart(...changed, {}, 0, [selection]).data[0].y).toEqual([10, 20]);
});

test('invalid or missing selected-jar samples still break a component-crossing guide and show isolated valid markers', () => {
  const args = fixture([10, 20, 30]);
  args[1].scenarios[1].valid = false;
  args[1].scenarios[2].neutralPoints[0].componentIndex = 3;
  let plot = neutralPointChart(...args, {}, 0, [selection]);
  expect(plot.data[0].y).toEqual([10, null, null, null, 30]);
  expect(plot.data[0].marker.size).toEqual([5, 0, 0, 0, 5]);
  expect(plot.data).toHaveLength(1);
  args[1].scenarios[1].valid = true; args[1].scenarios[1].jars = [];
  plot = neutralPointChart(...args, {}, 0, [selection]);
  expect(plot.data[0].y).toEqual([10, null, null, null, 30]);
  expect(plot.data[0].connectgaps).toBe(false);
});

test('neutral interval does not present the nearest projection as a unique NP at the jar', () => {
  const args = fixture([0]);
  args[1].scenarios[0].neutralPoints = [];
  args[1].scenarios[0].neutralIntervals = [{ startFromBit: 80, endFromBit: 130 }];
  const plot = neutralPointChart(...args, {}, 0, [selection]);
  expect(plot.data[0].y).toEqual([null]);
  expect(plot.data[1].y).toEqual([-20, 30]);
  expect(plot.data[1].hovertemplate).toContain('neutral interval endpoint');
});

test('zone is configured, symmetric, optional, separate from axis scaling and updates', () => {
  const plot = chart([-10, 20], 7);
  expect(plot.threshold).toBe(7);
  expect(plot.layout.shapes.find(s => s.type === 'rect')).toMatchObject({ y0: -7, y1: 7 });
  expect(chart([-10, 20], 12).layout.shapes[0]).toMatchObject({ y0: -12, y1: 12 });
  [0, -1, NaN, null, ''].forEach(value => expect(chart([-10, 20], value).layout.shapes.some(s => s.type === 'rect')).toBe(false));
});

test('tooltips use verified sign, WOB, mode and screening labels with limited precision', () => {
  const plot = chart([-10, 0, 20], 5);
  expect(plot.data[0].customdata).toEqual([
    [10, 'Slide', 'NP below jar', 'Outside user-defined screening tolerance'],
    [10, 'Slide', 'NP at jar', 'Inside user-defined screening tolerance'],
    [10, 'Slide', 'NP above jar', 'Outside user-defined screening tolerance']
  ]);
  expect(plot.data[0].hovertemplate).toContain('%{y:,.1f}');
  expect(plot.layout.xaxis.title.text).toBe('Measured Depth (ft MD)');
  expect(plot.layout.yaxis.title.text).toBe('Signed NP Distance Relative to Jar (ft)');
  expect(curveLabel({ name: 'Maximum WOB 35 klbf — Rotate' })).toBe('35 klbf — Rotate');
});

test('all hidden and all unavailable data yield an empty state; rotation uses dashed lines', () => {
  expect(chart([10, 20], 5, { 'min-slide': true }).empty).toBe(true);
  expect(chart([null, null], 5).empty).toBe(true);
  const args = fixture([10, 20]);
  args[0].data[0].name = 'Minimum WOB 10 klbf — Rotate';
  args[1].scenarios.forEach(s => { s.mode = 'rotate'; });
  expect(neutralPointChart(...args, {}, 0, [{ ...selection, mode: 'rotate' }]).data[0].line.dash).toBe('dash');
});
