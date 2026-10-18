import { wobRangesPlot } from './wobRangesPlot';

test('WOB plot separates modes, keeps interval gaps and unresolved regions, and labels evaluated range', () => {
  const region = (status, lower, upper) => ({ status, lowerWobLbf: lower, upperWobLbf: upper, reason: 'Sample-supported', lowerBoundary: 'evaluated-range-limit' });
  const rows = [{ valid: true, bitMdFt: 4000, mode: 'slide', regions: [region('acceptable', 10000, 15000), region('unknown', 15000, 15001), region('inside-zone', 15001, 20000), region('acceptable', 20001, 35000)], boundaries: [{ lowerWobLbf: 15000, upperWobLbf: 15001, estimatedWobLbf: 15000.5 }] },
    { valid: false, bitMdFt: 5000, mode: 'rotate', regions: [], boundaries: [], errors: ['Invalid load'] }];
  const before = JSON.stringify(rows);
  const plot = wobRangesPlot(rows, [10000, 35000], 1);
  expect(plot.data[0]).toMatchObject({ x: [4000, 4000, null, 4000, 4000, null], y: [10, 15, null, 20.001, 35, null], xaxis: 'x', yaxis: 'y', connectgaps: false });
  expect(plot.data[2].y).toEqual([15, 15.001, null]);
  expect(plot.data[3].text[0]).toContain('15.0000–15.0010 klbf');
  expect(plot.data[6]).toMatchObject({ x: [5000, 5000, null], y: [10, 35, null], xaxis: 'x2', yaxis: 'y2' });
  expect(plot.data[6].text[0]).toContain('Invalid load');
  expect(plot.layout.shapes.map(s => s.y0)).toEqual([10, 35, 10, 35]);
  expect(plot.layout.xaxis2.title.text).toBe('Bit MD (ft)');
  expect(plot.layout.yaxis.title.text).toBe('WOB (klbf)');
  expect(JSON.stringify(rows)).toBe(before);
});
