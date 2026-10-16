import { deployDrillstring } from './deployDrillstring';
import { calcJarClearanceAcrossRun } from '../jar/jarClearanceAcrossRun';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';

const bha = { rows: [{ category: 'DC', length: 160, weight: 100, od: 8 }, { category: 'JAR', length: 30, weight: 100, od: 8 }, { category: 'DC', length: 775, weight: 100, od: 8 }, { category: 'DP', length: 11035, weight: 20, od: 5, idSize: 4, lengthMode: 'manual' }] };
const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 12000, inclinationDeg: 0, azimuthDeg: 90 }]);
const request = { bha, survey, startBitMdFt: 3320, endBitMdFt: 3320, minWobLbf: 10000, maxWobLbf: 10000, mode: 'slide', modes: 'slide', frictionCoefficient: 0.25, buoyancyFactor: 1 };

test.each([[3320, 2355, -133600], [5000, 4035, -167200], [12000, 11035, -307200]])('deploys MD %s without changing jar position or stored pipe', (md, dp, topForce) => {
  const original = JSON.stringify({ bha, survey });
  const deployed = deployDrillstring(bha, md);
  expect(deployed.valid).toBe(true);
  expect(deployed.metadata.deployedDpLengthFt).toBe(dp);
  expect(deployed.bha.rows.slice(0, 3)).toEqual(bha.rows.slice(0, 3));
  const direct = calcSurveyAxialLoads({ ...request, bha: deployed.bha, bitMdFt: md, wobLbf: 10000 });
  expect(direct.valid).toBe(true);
  expect(direct.topMdFt).toBe(0);
  expect(direct.topOfBhaAxialForce).toBeCloseTo(topForce, 6);
  expect(direct.jars[0]).toMatchObject({ centreFromBitFt: 175, mdFt: md - 175, axialForceLbf: -7500 });
  expect(direct.neutralPoints[0].fromBitFt).toBeCloseTo(100, 9);
  const run = calcJarClearanceAcrossRun({ ...request, startBitMdFt: md, endBitMdFt: md });
  expect(run.scenarios[0].jars[0]).toMatchObject({ jarFromBitFt: 175, jarMdFt: md - 175, jarAxialLoadLbf: -7500, absoluteSeparationFt: 75 });
  expect(run.scenarios[0].neutralPoints).toEqual(direct.neutralPoints);
  expect(JSON.stringify({ bha, survey })).toBe(original);
});

test('fixed-length comparison fails at shallow depths, succeeds at full saved length', () => {
  for (const md of [3320, 5000, 12000]) {
    const fixed = calcJarClearanceAcrossRun({ ...request, deploymentMode: 'fixed', startBitMdFt: md, endBitMdFt: md });
    expect(fixed.scenarios[0].valid).toBe(md === 12000);
  }
});

test('rejects multi-DP, tools above DP, shallow fixed BHA, invalid references/modes and malformed fixed lengths', () => {
  expect(deployDrillstring({ rows: [...bha.rows, { ...bha.rows[3] }] }, 5000).errors[0]).toMatch(/multiple DP/);
  expect(deployDrillstring({ rows: [...bha.rows, { category: 'HWDP', length: 30 }] }, 5000).errors[0]).toMatch(/uppermost/);
  expect(deployDrillstring(bha, 964).errors[0]).toMatch(/not shortened/);
  expect(deployDrillstring(bha, undefined).valid).toBe(false);
  expect(deployDrillstring(bha, 5000, { surfaceMdFt: -1 }).valid).toBe(false);
  expect(deployDrillstring(bha, 5000, { deploymentMode: 'guess' }).valid).toBe(false);
  expect(deployDrillstring({ rows: [{ category: 'DC', length: '' }, bha.rows[3]] }, 5000).valid).toBe(false);
});

test('omits exactly zero DP, preserves fixed HWDP and ignores empty builder placeholders', () => {
  expect(deployDrillstring(bha, 965).bha.rows).toEqual(bha.rows.slice(0, 3));
  const expanded = { rows: [...bha.rows.slice(0, 3), { category: 'HWDP', length: 100, weight: 50 }, bha.rows[3], { rowId: 'empty', length: '', category: '' }] };
  expect(deployDrillstring(expanded, 3320).metadata).toMatchObject({ fixedLengthFt: 1065, deployedDpLengthFt: 2255 });
  expect(deployDrillstring(bha, 5000, { surfaceMdFt: 100 }).metadata.deployedDpLengthFt).toBe(3935);
});

test('fractional lengths preserve survey surface coverage and Auto works without a stored manual DP length', () => {
  const fractional = { rows: [{ ...bha.rows[0], length: 965.123456789 }, { ...bha.rows[3], length: '', lengthMode: 'auto' }] };
  const deployment = deployDrillstring(fractional, 3320.987654321);
  expect(deployment.valid).toBe(true);
  const load = calcSurveyAxialLoads({ ...request, bha: deployment.bha, bitMdFt: 3320.987654321, wobLbf: 10000 });
  expect(load.valid).toBe(true);
  expect(load.topMdFt).toBeGreaterThanOrEqual(0);
  expect(load.topMdFt).toBeCloseTo(0, 9);
});

test('survey coverage uses actual deployed string and never extrapolates above surface', () => {
  const shortSurvey = calculateSurveyGeometry([{ mdFt: 100, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 12000, inclinationDeg: 0, azimuthDeg: 90 }]);
  const invalid = calcJarClearanceAcrossRun({ ...request, survey: shortSurvey });
  expect(invalid.scenarios[0].status).toBe('outside-survey');
  expect(calcJarClearanceAcrossRun({ ...request, survey: shortSurvey, surfaceMdFt: 100 }).validScenarios).toBe(1);
  expect(calcJarClearanceAcrossRun({ ...request, startBitMdFt: 964, endBitMdFt: 964 }).scenarios[0].status).toBe('invalid-deployment');
});

test.each(['slide', 'rotate'])('curved %s run equals a direct equivalent deployed Stage2A call', mode => {
  const curved = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 3000, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 5000, inclinationDeg: 60, azimuthDeg: 90 }, { mdFt: 12000, inclinationDeg: 60, azimuthDeg: 90 }]);
  const options = { ...request, survey: curved, mode, modes: mode, rpm: 40, ropFtHr: 200 };
  const direct = calcSurveyAxialLoads({ ...options, bha: deployDrillstring(bha, 3320).bha, bitMdFt: 3320, wobLbf: 10000 });
  const sample = calcJarClearanceAcrossRun(options).scenarios[0];
  expect(sample.valid).toBe(true);
  expect(sample.neutralPoints).toEqual(direct.neutralPoints);
  expect(sample.jars[0].jarAxialLoadLbf).toBe(direct.jars[0].axialForceLbf);
});
