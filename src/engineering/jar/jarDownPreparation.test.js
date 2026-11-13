import reference from '../../../docs/ValidationStudies/JarDownImpactModelStage5C7.json';
import { calcJarDownPreparation } from './jarDownPreparation';
const base = reference.cases[0].input;

test.each(reference.cases)('$name matches independent static Decimal reference without dynamic outputs', ({ input, expected }) => {
  const actual = calcJarDownPreparation(Object.freeze({ ...input }));
  expect(actual.valid).toBe(true);
  expect(actual).toMatchObject(expected);
  ['forceHistory', 'impactForceLbf', 'impulseLbfS', 'impactTimeS', 'impactVelocityFtS'].forEach(k => expect(actual[k]).toBeUndefined());
  expect(actual.notice).toBe('PRELIMINARY — NOT FOR OPERATIONAL USE');
});
test.each(['compressionLbf', 'pressureDropPsi', 'freeStrokeIn'])('%s rejects missing/non-numeric/negative data', key => {
  for (const value of ['', null, undefined, true, NaN, Infinity, -1, 'bad']) {
    const r = calcJarDownPreparation({ ...base, [key]: value });
    expect(r.valid).toBe(false); expect(r.netCompressionLbf).toBeNull();
  }
});
test.each(['', null, undefined, 0, -1, Infinity])('positive pressure requires valid manufacturer area %s', pumpOpenAreaIn2 => {
  expect(calcJarDownPreparation({ ...base, pumpOpenAreaIn2 }).valid).toBe(false);
});
test('load-basis, configuration and source gates suppress uncertain static values', () => {
  for (const patch of [{ loadBasis: 'surface-slackoff' }, { loadBasis: '' }, { mechanism: 'unavailable' },
    { mechanism: '' }, { compressionReference: '' }, { manufacturerReference: '' }]) {
    const r = calcJarDownPreparation({ ...base, ...patch });
    expect(r.valid).toBe(false); expect(r.netCompressionLbf).toBeNull(); expect(r.dynamicPredictionAvailable).toBe(false);
  }
});
test('already net compression is not pressure-corrected a second time', () => {
  const r = calcJarDownPreparation({ ...base, loadBasis: 'at-jar-net', compressionLbf: 30000 });
  expect(r.netCompressionLbf).toBe(30000); expect(r.pumpOpenForceLbf).toBeNull();
});
test('conditional soft-string estimate never becomes a dynamic prediction or buckling clearance', () => {
  const r = calcJarDownPreparation({ ...base, loadBasis: 'soft-string-before-pump' });
  expect(r.valid).toBe(true); expect(r.warnings.join(' ')).toMatch(/post-buckling/);
  expect(r.dynamicPredictionAvailable).toBe(false);
});
test('zero stroke, zero net load and negative net load remain explicit', () => {
  expect(calcJarDownPreparation({ ...base, freeStrokeIn: 0 }).status).toMatch(/Zero free stroke/);
  expect(calcJarDownPreparation({ ...base, compressionLbf: 11800 }).status).toMatch(/Insufficient/);
  expect(calcJarDownPreparation({ ...base, compressionLbf: 0 }).netCompressionLbf).toBe(-11800);
});
test('overflow and malformed requests return unavailable instead of nonfinite loads', () => {
  expect(calcJarDownPreparation(null).valid).toBe(false);
  expect(calcJarDownPreparation({ ...base, pressureDropPsi: 1e308, pumpOpenAreaIn2: 1e308 }).netCompressionLbf).toBeNull();
});
