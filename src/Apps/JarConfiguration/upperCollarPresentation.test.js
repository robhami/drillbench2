import { upperCollarPlot } from './positionMatrixPresentation';

const sample = (index, l2, peak, impulse, valid = true) => ({ index, l1Ft: 60, l2Ft: l2, l3Ft: 3180 - l2,
  peakStuckPointForceKlbf: peak, impulseLbfS: impulse, valid, impactForceKlbf: 300,
  averageStuckPointForceKlbf: 500, impactVelocityFtS: 12 });
const samples = [sample(0, 60, 728, 5299), sample(1, 120, null, null, false), sample(2, 180, 619, 12303)];
const result = { samples, actual: { ...samples[2], index: 'baseline' }, maxima: { peak: samples[0], impulse: samples[2] } };

test('upper-collar response uses actual L2 on X and increasing response on Y with explicit invalid gaps', () => {
  const plot = upperCollarPlot(result, 'peak', samples[0]);
  expect(plot.data[0].x).toEqual([60, 120, 180]);
  expect(plot.data[0].y).toEqual([728, null, 619]);
  expect(plot.data[0].connectgaps).toBe(false);
  expect(plot.data[0].line.shape).toBe('linear');
  expect(plot.layout.yaxis.autorange).toBe(true);
  expect(plot.layout.xaxis.title.text).toBe('L2 — collars above jar (ft)');
  expect(plot.data.find(t => t.name === 'Current BHA L2').x).toEqual([180]);
  expect(plot.data.find(t => t.name === 'Selected candidate').customdata[0][0]).toBe(0);
});

test('force and impulse maxima use their own retained candidates', () => {
  expect(upperCollarPlot(result, 'peak').data[1].x).toEqual([60]);
  const plot = upperCollarPlot(result, 'impulse');
  expect(plot.data[1].x).toEqual([180]);
  expect(plot.data[1].y).toEqual([12303]);
  expect(plot.layout.yaxis.title.text).toContain('lbf·s');
});

test('unavailable baseline and invalid selection do not produce fabricated response markers', () => {
  const plot = upperCollarPlot({ ...result, actual: { ...result.actual, valid: false } }, 'peak', samples[1]);
  expect(plot.data.map(t => t.name)).toEqual(['Sampled upper-collar response', 'Highest sampled response']);
});
