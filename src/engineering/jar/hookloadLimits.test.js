import { calcHookloadLimits, readMaximumHookload } from './hookloadLimits';
const base = extra => ({ jarDirection: 'up', maximumHookloadKlbf: '120', pickupHookloadLbf: 100000, requiredHookloadLbf: 110000, ...extra });

test.each([[110000, 'Within Limit', 10000], [120000, 'At Limit', 0], [130000, 'Exceeds Limit', -10000]])('required hookload %s compares at full precision', (requiredHookloadLbf, status, margin) => {
  const r = calcHookloadLimits(base({ requiredHookloadLbf }));
  expect(r.status).toBe(status);
  expect(r.requiredOverpullLbf).toBe(requiredHookloadLbf - 100000);
  expect(r.availableOverpullLbf).toBe(20000);
  expect(r.remainingMarginLbf).toBe(margin);
  expect(r.insufficientPickupCapacity).toBe(false);
});

test('negative overpull and remaining margin are retained, including insufficient pickup capacity', () => {
  const r = calcHookloadLimits(base({ maximumHookloadKlbf: 90, requiredHookloadLbf: 95000 }));
  expect(r.requiredOverpullLbf).toBe(-5000);
  expect(r.availableOverpullLbf).toBe(-10000);
  expect(r.remainingMarginLbf).toBe(-5000);
  expect(r.insufficientPickupCapacity).toBe(true);
  expect(r.status).toBe('Exceeds Limit');
});

test.each([undefined, null, '', '  '])('missing maximum %j is Not Configured, while required overpull remains calculable', maximumHookloadKlbf => {
  const r = calcHookloadLimits(base({ maximumHookloadKlbf }));
  expect(r.status).toBe('Not Configured'); expect(r.requiredOverpullLbf).toBe(10000);
  expect(r.availableOverpullLbf).toBeNull(); expect(r.remainingMarginLbf).toBeNull();
});

test.each([0, -1, 'NaN', Infinity, true, {}, 1e308])('invalid maximum %j yields an error, never a passing status', maximumHookloadKlbf => {
  expect(readMaximumHookload(maximumHookloadKlbf).valid).toBe(false);
  const r = calcHookloadLimits(base({ maximumHookloadKlbf }));
  expect(r.status).toBeNull(); expect(r.reason).toContain('finite, positive');
});

test('rounded display equality does not establish At Limit', () => {
  expect(calcHookloadLimits(base({ requiredHookloadLbf: 120000.01 })).status).toBe('Exceeds Limit');
  expect(calcHookloadLimits(base({ requiredHookloadLbf: 119999.99 })).status).toBe('Within Limit');
});

test.each([null, NaN, -1])('unavailable pickup %j is unknown, never within a configured limit', pickupHookloadLbf => {
  const r = calcHookloadLimits(base({ pickupHookloadLbf }));
  expect(r.status).toBeNull(); expect(r.requiredOverpullLbf).toBeNull();
});

test.each([90, 120, '', -1])('Jar Down has no minimum/maximum safety classification with limit %j', maximumHookloadKlbf => {
  const r = calcHookloadLimits(base({ jarDirection: 'down', maximumHookloadKlbf }));
  expect(r.applicable).toBe(false); expect(r.status).toBeNull();
  expect(r.reason).toContain('compression and buckling limits are not yet evaluated');
  expect(r).not.toHaveProperty('remainingMarginLbf');
});
