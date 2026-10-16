import fs from 'fs';
import path from 'path';
import { calcJarClearanceAcrossRun } from './jarClearanceAcrossRun';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { parseSurveyCsv } from '../survey/surveyImport';

const row = (length, category = 'DC', weight = 100) => ({ category, toolName: category, length, weight, od: 8 });
const geometry = (inclinationDeg = 0, end = 1000) => calculateSurveyGeometry([{ mdFt: 0, inclinationDeg, azimuthDeg: 90 }, { mdFt: end, inclinationDeg, azimuthDeg: 90 }]);
const base = overrides => ({ bha: { rows: [row(50), row(20, 'JAR'), row(130)] }, survey: geometry(), startBitMdFt: 300, endBitMdFt: 500, depthIncrementFt: 100, minWobLbf: 4000, maxWobLbf: 8000, wobSamples: 3, modes: 'slide', frictionCoefficient: 0.25, buoyancyFactor: 1, ...overrides });
const close = (a, b, tolerance = 1e-7) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);

test('vertical known NP, WOB scenarios, load states, avoidance and deterministic sampled minimum', () => {
  const result = calcJarClearanceAcrossRun(base());
  expect(result.valid).toBe(true);
  expect(result.validScenarios).toBe(9);
  expect(result.invalidScenarios).toBe(0);
  result.scenarios.forEach(s => {
    const jar = s.jars[0], np = s.wobLbf / 100;
    close(jar.nearestNeutral.fromBitFt, np);
    close(jar.signedSeparationFt, 60 - np);
    close(jar.absoluteSeparationFt, Math.abs(60 - np));
    close(jar.jarAxialLoadLbf, s.wobLbf - 6000);
    expect(jar.jarMdFt).toBe(s.bitMdFt - 60);
    expect(jar.jarLoadState).toBe(s.wobLbf < 6000 ? 'tension' : s.wobLbf > 6000 ? 'compression' : 'neutral');
    expect(jar.avoidanceStatus).toBe(s.wobLbf === 6000 ? 'inside-avoidance-zone' : 'outside-avoidance-zone');
    expect(jar.avoidanceLowerFt).toBe(48);
    expect(jar.avoidanceUpperFt).toBe(72);
  });
  expect(result.minimumValidClearanceFt).toBe(0);
  expect(result.worstCase).toMatchObject({ bitMdFt: 300, wobLbf: 6000, mode: 'slide', jarIndex: 0 });
  expect(result.depthEnvelope.map(e => e.minimumClearanceFt)).toEqual([0, 0, 0]);
  expect(result.crossingEvents.filter(e => e.kind === 'sampled-crossing')).toHaveLength(3);
});

test('constant inclination Slide/Rotate agree with independent formulas and direct solver calls', () => {
  const input = base({ survey: geometry(60), startBitMdFt: 300, endBitMdFt: 300, minWobLbf: 3000, maxWobLbf: 3000, modes: 'both', rpm: 40, ropFtHr: 200 });
  const result = calcJarClearanceAcrossRun(input);
  expect(result.validScenarios).toBe(2);
  result.scenarios.forEach(s => {
    const fraction = s.mode === 'slide' ? 1 : 200 / Math.hypot(200, Math.PI * 8 * 40 * 5);
    const q = 100 * (0.5 - 0.25 * Math.sqrt(3) / 2 * fraction), jar = s.jars[0];
    close(jar.nearestNeutral.fromBitFt, 3000 / q);
    close(jar.signedSeparationFt, 60 - 3000 / q);
    close(jar.jarAxialLoadLbf, 3000 - q * 60);
    const direct = calcSurveyAxialLoads({ bha: input.bha, survey: input.survey, bitMdFt: s.bitMdFt, wobLbf: s.wobLbf, mode: s.mode, frictionCoefficient: 0.25, buoyancyFactor: 1, rpm: 40, ropFtHr: 200 });
    expect(s.neutralPoints).toEqual(direct.neutralPoints);
    expect(jar.jarAxialLoadLbf).toBe(direct.jars[0].axialForceLbf);
  });
});

test('synthetic directional run matches direct Stage2A at every build/tangent scenario', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  const survey = calculateSurveyGeometry(parseSurveyCsv(text, { mdUnit: 'ft', angleUnit: 'deg' }).stations);
  const input = base({ survey, startBitMdFt: 4900, endBitMdFt: 5300, depthIncrementFt: 200, modes: 'both', rpm: 40, ropFtHr: 200 });
  const result = calcJarClearanceAcrossRun(input);
  expect(result.validScenarios).toBe(18);
  result.scenarios.forEach(s => {
    const direct = calcSurveyAxialLoads({ bha: input.bha, survey, bitMdFt: s.bitMdFt, wobLbf: s.wobLbf, mode: s.mode, frictionCoefficient: 0.25, buoyancyFactor: 1, rpm: 40, ropFtHr: 200 });
    expect(s.neutralPoints).toEqual(direct.neutralPoints);
    expect(s.jars[0].jarAxialLoadLbf).toBe(direct.jars[0].axialForceLbf);
    if (s.bitMdFt === 5300 && s.wobLbf === 4000 && s.mode === 'slide') close(s.jars[0].nearestNeutral.fromBitFt, 4000 / (100 * (0.5 - 0.25 * Math.sqrt(3) / 2)));
  });
});

test('multiple neutral crossings choose actual nearest and retain all crossings for every jar', () => {
  const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 180, azimuthDeg: 90 }, { mdFt: 100, inclinationDeg: 180, azimuthDeg: 90 }, { mdFt: 150, inclinationDeg: 90, azimuthDeg: 90 }, { mdFt: 200, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 300, inclinationDeg: 0, azimuthDeg: 90 }]);
  const input = base({ survey, bha: { rows: [row(40), row(20, 'JAR'), row(180), row(20, 'JAR'), row(40)] }, startBitMdFt: 300, endBitMdFt: 300, minWobLbf: 5000, maxWobLbf: 5000, frictionCoefficient: 0 });
  const result = calcJarClearanceAcrossRun(input), s = result.scenarios[0];
  expect(s.neutralPointCount).toBe(2);
  expect(s.jars).toHaveLength(2);
  close(s.jars[0].nearestNeutral.fromBitFt, 50);
  close(s.jars[1].nearestNeutral.fromBitFt, 250);
  expect(result.crossingEvents.filter(e => e.kind === 'sampled-crossing')).toHaveLength(2);
});

test('no NP does not imply safe; load state is separately compression or tension', () => {
  const compression = calcJarClearanceAcrossRun(base({ minWobLbf: 30000, maxWobLbf: 30000 }));
  expect(compression.minimumValidClearanceFt).toBeNull();
  expect(compression.worstCase).toBeNull();
  compression.scenarios.forEach(s => {
    expect(s.valid).toBe(true);
    expect(s.neutralPointCount).toBe(0);
    expect(s.jars[0]).toMatchObject({ avoidanceStatus: 'no-neutral-within-bha', jarLoadState: 'compression', signedSeparationFt: null, absoluteSeparationFt: null });
    expect(s.warnings.join(' ')).toContain('not a safe');
  });
  expect(compression.depthEnvelope[0].status).toBe('no-neutral-within-bha');
  // Zero WOB has a real bit NP, with tension at the jar; do not invent an
  // additional internal NP or label its load state from the avoidance status.
  const tension = calcJarClearanceAcrossRun(base({ minWobLbf: 0, maxWobLbf: 0 }));
  expect(tension.scenarios[0].jars[0].jarLoadState).toBe('tension');
  expect(tension.scenarios[0].jars[0].nearestNeutral.fromBitFt).toBe(0); // Bit NP retained.
});

test('neutral intervals retain nonunique identity and intersect avoidance bands', () => {
  const result = calcJarClearanceAcrossRun(base({ bha: { rows: [row(200, 'JAR', 0)] }, minWobLbf: 0, maxWobLbf: 0 }));
  const s = result.scenarios[0], jar = s.jars[0];
  expect(s.neutralPointCount).toBe(0);
  expect(s.neutralIntervals).toEqual([{ startFromBit: 0, endFromBit: 200 }]);
  expect(jar.nearestNeutral).toMatchObject({ kind: 'interval', startFromBit: 0, endFromBit: 200, fromBitFt: 100 });
  expect(jar.absoluteSeparationFt).toBe(0);
  expect(jar.avoidanceStatus).toBe('inside-avoidance-zone');
  expect(result.crossingEvents.every(e => e.kind === 'sampled-neutral-interval')).toBe(true);
});

test('explicit avoidance distance is inclusive, including zero distance', () => {
  const result = calcJarClearanceAcrossRun(base({ minWobLbf: 4000, maxWobLbf: 8000, avoidanceDistanceFt: 20 }));
  expect(result.scenarios.every(s => s.jars[0].avoidanceStatus === 'inside-avoidance-zone')).toBe(true);
  const zero = calcJarClearanceAcrossRun(base({ avoidanceDistanceFt: 0 }));
  expect(zero.scenarios[0].jars[0].avoidanceStatus).toBe('outside-avoidance-zone');
  expect(zero.scenarios[1].jars[0].avoidanceStatus).toBe('inside-avoidance-zone');
});

test('WOB sign-change events are explicitly inferred and not falsely reported as sampled coincidences', () => {
  const result = calcJarClearanceAcrossRun(base({ endBitMdFt: 300, wobSamples: 2 }));
  expect(result.minimumValidClearanceFt).toBe(20);
  expect(result.crossingEvents).toHaveLength(1);
  expect(result.crossingEvents[0]).toMatchObject({ kind: 'inferred-between-wob-samples', refinementRequired: true, approximateBitMdFt: 300, approximateWobLbf: 6000 });
});

test('depth sign changes are inferred at fixed WOB/mode/friction, without switching NP identities', () => {
  const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 1000, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 2000, inclinationDeg: 60, azimuthDeg: 90 }, { mdFt: 3000, inclinationDeg: 60, azimuthDeg: 90 }]);
  const result = calcJarClearanceAcrossRun(base({ survey, startBitMdFt: 1000, endBitMdFt: 2200, depthIncrementFt: 1200, minWobLbf: 3000, maxWobLbf: 3000 }));
  expect(result.scenarios[0].jars[0].jarLoadState).toBe('tension');
  expect(result.scenarios[1].jars[0].jarLoadState).toBe('compression');
  expect(result.crossingEvents).toHaveLength(1);
  expect(result.crossingEvents[0].kind).toBe('inferred-between-depth-samples');
  expect(result.crossingEvents[0].approximateBitMdFt).toBeGreaterThan(1000);
  expect(result.crossingEvents[0].approximateBitMdFt).toBeLessThan(2200);
});

test('coverage failures are explicit scenarios and do not contribute invented clearances', () => {
  const result = calcJarClearanceAcrossRun(base({ startBitMdFt: 100, endBitMdFt: 300 }));
  expect(result.validScenarios).toBe(6);
  expect(result.invalidScenarios).toBe(3);
  expect(result.scenarios[0]).toMatchObject({ valid: false, status: 'outside-survey', jars: [], neutralPointCount: null });
  expect(result.depthEnvelope[0]).toMatchObject({ status: 'invalid', minimumClearanceFt: null });
  const allInvalid = calcJarClearanceAcrossRun(base({ startBitMdFt: 1100, endBitMdFt: 1100 }));
  expect(allInvalid.status).toBe('no-valid-scenarios');
  expect(allInvalid.worstCase).toBeNull();
});

test('an invalid intermediate WOB scenario breaks crossing inference instead of bridging the gap', () => {
  const module = require('../forces/calcSurveyAxialLoads');
  const original = module.calcSurveyAxialLoads;
  const spy = jest.spyOn(module, 'calcSurveyAxialLoads').mockImplementation(input => input.wobLbf === 6000 ? { valid: false, status: 'numerical-failure', errors: ['Independent solver failure fixture'], warnings: [] } : original(input));
  try {
    const r = calcJarClearanceAcrossRun(base({ endBitMdFt: 300 }));
    expect(r.validScenarios).toBe(2);
    expect(r.invalidScenarios).toBe(1);
    expect(r.crossingEvents).toEqual([]);
    expect(r.minimumValidClearanceFt).toBe(20);
  } finally { spy.mockRestore(); }
});

test('missing Rotate inputs invalidate Rotate only; no jar and malformed BHA return solver errors', () => {
  const result = calcJarClearanceAcrossRun(base({ modes: 'both' }));
  expect(result.validScenarios).toBe(9);
  expect(result.invalidScenarios).toBe(9);
  expect(result.scenarios[1].errors[0]).toContain('Rotate requires');
  expect(calcJarClearanceAcrossRun(base({ bha: { rows: [row(200)] } })).scenarios[0].status).toBe('no-jar');
  expect(calcJarClearanceAcrossRun(base({ bha: { rows: [{ category: 'JAR', length: 20 }] } })).invalidScenarios).toBe(9);
});

test('deterministic order, duplicate axes, endpoints, caps and default sampling', () => {
  const input = base({ endBitMdFt: 550, minWobLbf: 6000, maxWobLbf: 6000, modes: ['rotate', 'slide', 'slide'], frictionCoefficient: undefined, frictionCoefficients: [0.25, 0, 0.25], rpm: 40, ropFtHr: 200 });
  const result = calcJarClearanceAcrossRun(input);
  expect(result.depthsFt).toEqual([300, 400, 500, 550]);
  expect(result.wobsLbf).toEqual([6000]);
  expect(result.modes).toEqual(['slide', 'rotate']);
  expect(result.frictionCoefficients).toEqual([0, 0.25]);
  expect(result.validScenarios).toBe(16);
  expect(result.worstCase).toMatchObject({ bitMdFt: 300, wobLbf: 6000, mode: 'slide', frictionCoefficient: 0 });
  expect(calcJarClearanceAcrossRun(input)).toEqual(result);
  expect(calcJarClearanceAcrossRun({ ...input, maxScenarios: 15 }).errors[0]).toContain('16 scenarios');
  expect(calcJarClearanceAcrossRun(base({ depthIncrementFt: undefined, wobSamples: undefined })).scenarios).toHaveLength(15);
});

test('frozen BHA, survey and operating arrays are not mutated', () => {
  const input = base({ modes: ['slide'], frictionCoefficient: undefined, frictionCoefficients: [0.25] });
  const deepFreeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } };
  const before = JSON.stringify(input); deepFreeze(input);
  expect(calcJarClearanceAcrossRun(input).validScenarios).toBe(9);
  expect(JSON.stringify(input)).toBe(before);
});

test('decimal depth increments include endpoints without a duplicate near-end sample', () => {
  const r = calcJarClearanceAcrossRun(base({ startBitMdFt: 300.3, endBitMdFt: 300.9, depthIncrementFt: 0.2, minWobLbf: 6000, maxWobLbf: 6000 }));
  expect(r.valid).toBe(true);
  expect(r.depthsFt).toHaveLength(4);
  expect(r.depthsFt[0]).toBe(300.3);
  expect(r.depthsFt[3]).toBe(300.9);
});

test.each([{ startBitMdFt: '' }, { endBitMdFt: 200 }, { minWobLbf: -1 }, { maxWobLbf: 1000 }, { depthIncrementFt: 0 }, { wobSamples: 1 }, { wobSamples: 1.5 }, { modes: [] }, { modes: 'pickup' }, { frictionCoefficient: undefined }, { frictionCoefficients: [0.25] }, { frictionCoefficient: 2 }, { avoidanceDistanceFt: -1 }, { maxScenarios: 5001 }, { maxScenarios: 0 }, { depthIncrementFt: 1e-300 }])('rejects invalid grid %j before evaluation', override => {
  expect(calcJarClearanceAcrossRun(base(override)).valid).toBe(false);
});

test('null and missing run inputs fail explicitly', () => {
  expect(calcJarClearanceAcrossRun(null).valid).toBe(false);
  expect(calcJarClearanceAcrossRun().valid).toBe(false);
});
