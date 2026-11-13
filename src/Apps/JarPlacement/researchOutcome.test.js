import { researchOutcome } from './researchOutcome';

test.each([0, 42, -42])('no-contact status does not depend on signed impulse %s', totalLbfS => {
  expect(researchOutcome({ valid: true, contact: { transitions: [] }, observation: { totalLbfS } })).toBe('No contact during the simulated interval');
});
test('zero signed impulse with actual engagement remains a valid contact response', () => {
  expect(researchOutcome({ valid: true, contact: { transitions: [{ type: 'engage' }, { type: 'open' }] }, observation: { totalLbfS: 0 } })).toBe('Valid impact/contact response');
});
test.each([['failed', 'Calculation failed'], ['unsupported', 'Unsupported research configuration'], ['changed', 'Input changed — calculation required'], ['calculating', 'Calculating research response']])('%s is explicit with no fabricated result', (phase, label) => {
  expect(researchOutcome(null, phase)).toBe(label);
});
test('stale input overrides previously valid results', () => {
  expect(researchOutcome({ valid: true }, 'ready', true)).toBe('Stale adopted compression');
});
