import { calculateNonUniformSkeemUp, runSkeemWavePhase } from './nonUniformSkeemUp';
import { simulateNonUniformAxialWave } from './nonUniformAxialWave';

jest.mock('./nonUniformAxialWave', () => ({ simulateNonUniformAxialWave: jest.fn() }));
const processed = 'Processed event budget reached; no complete-result claim.';
const pending = 'INCOMPLETE: pending event budget reached.';
const incomplete = error => ({ valid: false, status: 'incomplete', error, numerical: { processedEvents: 250000, maxQueue: 120 } });
const input = { durationS: .05, initialWaves: [{ forceN: -123 }], numerical: { delayPrecisionBits: 53 } };
beforeEach(() => simulateNonUniformAxialWave.mockReset());

test.each([processed, pending])('only explicit budget cutoff retries the same phase: %s', error => {
  simulateNonUniformAxialWave.mockReturnValueOnce(incomplete(error)).mockReturnValueOnce({ valid: true, status: 'complete' });
  const attempts = [];
  expect(runSkeemWavePhase(input, 'post-impact', attempts, true).valid).toBe(true);
  expect(simulateNonUniformAxialWave.mock.calls.map(([r]) => r.numerical.maxEvents)).toEqual([250000, 500000]);
  expect(simulateNonUniformAxialWave.mock.calls.map(([r]) => r.numerical.maxPendingEvents)).toEqual([250000, 500000]);
  for (const [r] of simulateNonUniformAxialWave.mock.calls) {
    expect(r.initialWaves).toBe(input.initialWaves);
    expect(r.durationS).toBe(.05);
    expect(r.numerical.delayPrecisionBits).toBe(53);
  }
  expect(attempts[1]).toMatchObject({ phase: 'post-impact', retryReason: error, eventLimit: 500000 });
});
test('second budget exhaustion remains incomplete and default phase execution does not retry', () => {
  simulateNonUniformAxialWave.mockReturnValue(incomplete(processed));
  expect(runSkeemWavePhase(input, 'post-impact', [], true).valid).toBe(false);
  expect(simulateNonUniformAxialWave).toHaveBeenCalledTimes(2);
  simulateNonUniformAxialWave.mockClear();
  runSkeemWavePhase(input, 'post-impact', []);
  expect(simulateNonUniformAxialWave).toHaveBeenCalledTimes(1);
});
test.each(['energy-tolerance-not-met', 'invalid-input', 'inadmissible-maintained-engagement'])('does not retry %s', status => {
  simulateNonUniformAxialWave.mockReturnValue({ valid: false, status, error: 'Failed engineering validation' });
  expect(runSkeemWavePhase(input, 'post-impact', [], true).valid).toBe(false);
  expect(simulateNonUniformAxialWave).toHaveBeenCalledTimes(1);
});
test('invalid structural properties never start a wave phase', () => {
  const r = calculateNonUniformSkeemUp({ acknowledged: true, localTensionN: 800, strokeM: .001, durationS: .05,
    upperSections: [{ id: 'missing-area' }], lowerSections: [{ id: 'missing-area-too' }], computationalRetries: true });
  expect(r.failureCategory).toBe('invalid-input');
  expect(r.computation.retried).toBe(false);
  expect(simulateNonUniformAxialWave).not.toHaveBeenCalled();
});
