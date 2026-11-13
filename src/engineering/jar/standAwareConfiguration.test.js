import { resolveStandConfiguration, standChangePositions, assessRigConnections } from './standAwareConfiguration';

const bhaRows = [{ category: 'DC', length: 30, componentDefinition: {} }, { category: 'JAR', length: 33 }];
test('double and triple makeup uses measured joint lengths rather than assumed footage', () => {
  const triple = resolveStandConfiguration({ standType: 'triple', jointLengthsFt: [29.8, 30.1, 29.9], jarAboveJoints: 2, jarBelowJoints: 1, bhaRows });
  expect(triple).toMatchObject({ valid: true, jointsPerStand: 3, rackingFeasibility: 'unverified' });
  expect(triple.standLengthFt).toBeCloseTo(89.8, 10);
  expect(triple.jarStandLengthFt).toBeCloseTo(122.8, 10);
  expect(triple.handlingReasons).toContain('Connection data is incomplete.');
  expect(triple.handlingReasons).toContain('Saved BHA does not identify individual racked stand membership.');
  expect(resolveStandConfiguration({ standType: 'double', jointLengthsFt: [30, 30], jarAboveJoints: 1, jarBelowJoints: 1, bhaRows }).standLengthFt).toBe(60);
});
test('invalid makeup and configured racking limits reject infeasible stands', () => {
  expect(resolveStandConfiguration({ standType: 'triple', jointLengthsFt: [30, 30], bhaRows }).valid).toBe(false);
  const outOfRange = resolveStandConfiguration({ standType: 'double', jointLengthsFt: [30, 30], jarAboveJoints: 1, jarBelowJoints: 1, minRackingLengthFt: 70, maxRackingLengthFt: 95, bhaRows });
  expect(outOfRange.errors.join(' ')).toMatch(/outside/);
});
test('stand change sweep includes current reference, counts in stands and caps candidate count', () => {
  const config = resolveStandConfiguration({ standType: 'triple', jointLengthsFt: [30, 30, 30], jarAboveJoints: 2, jarBelowJoints: 1, bhaRows });
  expect(standChangePositions(config, -1, 2, 1)).toEqual([
    { standChange: -1, movementFt: -90 }, { standChange: 0, movementFt: 0 },
    { standChange: 1, movementFt: 90 }, { standChange: 2, movementFt: 180 }
  ]);
  expect(() => standChangePositions(config, -15, 15, 1)).toThrow(/25/);
});
test('connection compatibility stays explicitly unverified when actual connection data is absent', () => {
  expect(assessRigConnections(bhaRows)).toEqual({ verified: false, reason: 'Connection data is incomplete.' });
  const rows = [{ category: 'DC', length: 1, componentDefinition: { connectionTop: 'NC50', connectionBottom: 'NC50' } },
    { category: 'DC', length: 1, componentDefinition: { connectionTop: 'NC50', connectionBottom: 'NC50' } }];
  expect(assessRigConnections(rows).verified).toBe(true);
});
