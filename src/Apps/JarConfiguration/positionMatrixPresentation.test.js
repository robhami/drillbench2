import { positionMatrixPlot } from './positionMatrixPresentation';
import { calculatePositionMatrix, matrixDefaults, MATRIX_METRICS } from '../../engineering/jar/jarPositionMatrix';
import { configurationGeometry } from './configurationData';
const bha = { rows: [{ category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 }, { category: 'JAR', length: 10 }, { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 }, { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95) }] };
const geometry = configurationGeometry(bha), fields = { ...matrixDefaults(geometry), aSamples: '3', c1Samples: '3', c2Samples: '3' };
const run = changes => calculatePositionMatrix({ geometry, fields: { ...fields, ...changes } });

test('matrix rows are L1 increasing downward, columns L2, and tooltip retains all five responses', () => {
  const result = run({}), p = positionMatrixPlot(result, 'peak', result.samples[2]);
  expect(p.data[0].x).toEqual([180, 120, 60]); expect(p.data[0].y).toEqual([60, 120, 180]);
  expect(p.layout.yaxis.autorange).toBe('reversed'); expect(p.layout.xaxis.title.text).toContain('L2');
  expect(p.data[0].customdata[0].slice(0, 3)).toEqual([0, 60, 180]);
  for (const label of ['Incident FI', 'Peak stuck force', 'Average stuck force', 'Primary impulse', 'Impact velocity']) expect(p.data[0].hovertemplate).toContain(label);
  expect(p.data.find(t => t.name === 'Selected configuration')).toMatchObject({ x: [60], y: [180] });
  expect(p.data.find(t => t.name === 'Current BHA')).toMatchObject({ x: [180], y: [60] });
});

test('all five metrics reuse exact candidate values and choose their own maximum marker', () => {
  const result = run({ mode: 'C' }), before = JSON.stringify(result);
  for (const [metric, info] of Object.entries(MATRIX_METRICS)) {
    const p = positionMatrixPlot(result, metric, null), best = result.maxima[metric];
    expect(p.data[0].marker.color).toEqual(result.samples.map(s => s[info.field]));
    expect(p.data.find(t => t.name === 'Highest valid sampled response')).toMatchObject({ x: [best.l2Ft], y: [best.l1Ft] });
  }
  expect(JSON.stringify(result)).toBe(before);
});

test('unsupported cells have distinct marks and fixed-L1 row has one row tick', () => {
  const result = run({ mode: 'C', c1Min: '0' }), p = positionMatrixPlot(result, 'peak', null);
  expect(p.data.find(t => t.name === 'Unsupported geometry').marker.symbol).toBe('x');
  expect(p.data[0].x).toHaveLength(result.validCount);
  const row = positionMatrixPlot(run({ mode: 'B' }), 'impulse', null);
  expect(row.layout.yaxis.tickvals).toEqual([60]); expect(row.data.find(t => t.name === 'Fixed-L1 row').y.every(y => y === 60)).toBe(true);
});
