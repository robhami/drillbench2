import { displayNumber, displayJarCompression, displayEventTime, surfaceDifferenceLabel, targetBucklingStatus, targetTimings, targetForcePlot } from './targetJarDownPresentation';
import { researchExample } from './jarDownResearchData';
import { simulateExtendedJarDown } from '../../engineering/research/jarDownExtendedDynamics';
test('normal units round only presentation and retain signed surface difference', () => {
  expect(displayNumber(41.28)).toBe('41.3'); expect(displayNumber(41.237025664867)).toBe('41.2');
  expect(displayNumber(52762.27330696108, 0)).toBe('52,762');
  expect(displayNumber(undefined)).toBe('Unavailable');
  expect(displayJarCompression(450)).toBe('0.45');
  expect(displayJarCompression(449.997)).toBe('0.45');
  expect(displayJarCompression(100000)).toBe('100.0');
  expect(displayJarCompression(undefined)).toBe('Unavailable');
  expect(surfaceDifferenceLabel(null)).toBe('Slackoff: Select reference hookload');
  expect(surfaceDifferenceLabel(1000)).toBe('Slackoff: 1.0 klbf');
  expect(surfaceDifferenceLabel(-1000)).toBe('Surface support increase: 1.0 klbf');
  expect(surfaceDifferenceLabel(-1)).toBe('Surface support increase: <0.1 klbf');
  expect(displayEventTime(.005)).toBe('5.000 ms');
  expect(displayEventTime(.00000001)).not.toBe('0.000 ms');
});
test('buckling states do not equate missing or incomplete screening to stability', () => {
  expect(targetBucklingStatus(null)).toBe('Screening unavailable');
  expect(targetBucklingStatus({ valid: false })).toBe('Unsupported configuration');
  expect(targetBucklingStatus({ valid: true, buckling: { valid: true, summary: { completeCoverage: false } } })).toBe('Screening unavailable');
  expect(targetBucklingStatus({ valid: true, buckling: { valid: true, summary: { completeCoverage: true } } })).toBe('No warning reported by existing screening');
  expect(targetBucklingStatus({ valid: true, buckling: { valid: true, summary: { completeCoverage: false, firstSinusoidalOnset: { mdFt: 10 } } } })).toBe('Buckling onset indicated');
});
test('first jar impact is 5 ms, first stuck unloading arrival is 10 ms; negative data unchanged', () => {
  const r = simulateExtendedJarDown(researchExample());
  expect(targetTimings(r)).toEqual({ impactS: .005, reactionS: .01 });
  const p = targetForcePlot(r, { total: true }, 'contact-0');
  expect(p.layout.annotations).toHaveLength(1);
  expect(p.layout.annotations[0].ax).toBe(120);
  expect(p.layout.shapes.some(s => s.x0 === 5 && s.line.color === '#217a50')).toBe(true);
  expect(p.layout.shapes.some(s => s.x0 === 10 && s.line.color === '#355ea0')).toBe(true);
  expect(Math.min(...p.data[0].y)).toBe(-1);
  expect(targetTimings({ ...r, contact: { ...r.contact, transitions: [] } }).impactS).toBeUndefined();
});
