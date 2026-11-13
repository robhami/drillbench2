import { compareManufacturerJarLimits, readManufacturerLimit } from './manufacturerJarLimits';
const check = changes => compareManufacturerJarLimits({ direction: 'up', calculatedJarAxialLoadLbf: -20000,
  targetForceLbf: 20000, limits: { maximumUpwardLoadLbf: 20000 }, ...changes });

test.each([-0.009, 0.009, 0.0028395059])('near equality %s lbf is unresolved, never compliant', difference => {
  const r = check({ calculatedJarAxialLoadLbf: -(100000 + difference), calculationToleranceLbf: .01,
    limits: { maximumUpwardLoadLbf: 100000 } }).operating;
  expect(r.status).toBe('Near entered limit — unresolved');
  expect(r.differenceLbf).toBeCloseTo(difference, 8);
  expect(r.reason).toContain('no rating allowance');
});
test('tolerance is dimensional, explicit and does not relax a direct compression target', () => {
  expect(check({ calculatedJarAxialLoadLbf: -20000.02, calculationToleranceLbf: .01 }).operating.status).toBe('Exceeds entered limit');
  expect(check({ calculatedJarAxialLoadLbf: -19999.98, calculationToleranceLbf: .01 }).operating.status).toBe('Within entered limits');
  expect(check({ calculatedJarAxialLoadLbf: -20000.001 }).operating.status).toBe('Exceeds entered limit');
  expect(check({ direction: 'down', targetForceLbf: 20000.001, calculationToleranceLbf: .01,
    limits: { maximumDownwardLoadLbf: 20000 } }).operating.status).toBe('Exceeds entered limit');
});
test('missing and legacy limits remain unset', () => {
  expect(check({ limits: {} }).operating.status).toBe('Limit not provided');
  expect(check({ limits: {} }).tensile.status).toBe('Limit not provided');
});
test.each([19999, 20000, 20001])('full precision calculated tensile load %s compared to upward limit', magnitude => {
  const result = check({ calculatedJarAxialLoadLbf: -magnitude }).operating;
  expect(result.loadLbf).toBe(magnitude);
  expect(result.status).toBe(magnitude === 20000 ? 'At entered limit' : magnitude > 20000 ? 'Exceeds entered limit' : 'Within entered limits');
});
test.each([0, -1, NaN, Infinity, 'bad', ' ', false])('invalid manufacturer limit %s is explicit', value => {
  expect(readManufacturerLimit(value).valid).toBe(false);
  expect(check({ limits: { maximumUpwardLoadLbf: value } }).operating.status).toBe('Invalid limit');
});
test('absent calculation, wrong sign or disabled operation never establishes compliance', () => {
  for (const calculatedJarAxialLoadLbf of [undefined, null, NaN, 10000]) expect(check({ calculatedJarAxialLoadLbf }).operating.status).toBe('Calculation unavailable');
  expect(check({ operationAvailable: false }).operating.status).toBe('Calculation unavailable');
});
test('compression check uses requested target even without converged transmission', () => {
  const limits = { maximumDownwardLoadLbf: 25000 };
  for (const targetForceLbf of [24000, 25000, 26000]) {
    const r = check({ direction: 'down', calculatedJarAxialLoadLbf: null, targetForceLbf, limits }).operating;
    expect(r.loadLbf).toBe(targetForceLbf);
    expect(r.status).toBe(targetForceLbf === 25000 ? 'At entered limit' : targetForceLbf > 25000 ? 'Exceeds entered limit' : 'Within entered limits');
  }
  expect(check({ direction: 'down', limits: {} }).operating.status).toBe('Limit not provided');
});
test('through-jar rating is not compared without explicit compatible cross-section', () => {
  const limits = { maximumTensileLoadLbf: 15000 };
  expect(check({ limits }).tensile.status).toBe('Calculation unavailable');
  expect(check({ limits: { ...limits, tensileLoadBasis: 'jar-centre' } }).tensile).toMatchObject({ loadLbf: 20000, status: 'Exceeds entered limit' });
  expect(check({ calculatedJarAxialLoadLbf: null, limits: { ...limits, tensileLoadBasis: 'jar-centre' } }).tensile.status).toBe('Calculation unavailable');
});
test('limits are independent and inputs are immutable; no surface or incremental force is substituted', () => {
  const limits = Object.freeze({ maximumUpwardLoadLbf: 30000, maximumDownwardLoadLbf: 10000,
    maximumTensileLoadLbf: 15000, tensileLoadBasis: 'jar-centre' });
  const result = check({ limits, targetForceLbf: 5000, requiredSurfaceHookloadLbf: 500000 });
  expect(result.operating.status).toBe('Within entered limits');
  expect(result.tensile.status).toBe('Exceeds entered limit');
  expect(check({ direction: 'down', limits }).operating.status).toBe('Exceeds entered limit');
});

