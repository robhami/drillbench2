import fs from 'fs';
import path from 'path';
import { calcStringWeightSummary } from './calcStringWeightSummary';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { parseSurveyCsv } from '../survey/surveyImport';

const bf = 1 - 10 / 65.5;
const row = (category, length, weight) => ({ category, length, weight });
const bha = { mudWeight: 40, rows: [row('DC', 100, 200), row('JAR', 20, 150), row('DC', 80, 100), { ...row('DP', 99999, 20), lengthMode: 'auto' }] };
const geometry = (inclination = 0, end = 20000, start = 0) => calculateSurveyGeometry([{ mdFt: start, inclinationDeg: inclination, azimuthDeg: 90 }, { mdFt: end, inclinationDeg: inclination, azimuthDeg: 90 }]);
const base = extra => ({ bha, survey: geometry(), bitMdFt: 1000, mudWeightPpg: 10, ...extra });
const close = (actual, expected, tolerance = 1e-7) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

test('vertical deployed weights and free-hanging hookload match independent arithmetic using entered mud', () => {
  const r = calcStringWeightSummary(base());
  expect(r.valid).toBe(true);
  close(r.totalAirWeightLbf, 47000);
  close(r.totalBuoyedWeightLbf, 47000 * bf);
  close(r.buoyedWeightAboveJarLbf, 25500 * bf);
  close(r.buoyedWeightBelowJarLbf, 21500 * bf);
  close(r.frictionlessHookloadLbf, 47000 * bf);
  expect(r.jarFromBitFt).toBe(110);
  expect(r.jarMdFt).toBe(890);
  close(r.buoyancyFactor, bf);
});

test.each([30, 60, 90])('constant %s-degree inclination projects axial hookload but not gravitational weight magnitudes', inclination => {
  const r = calcStringWeightSummary(base({ survey: geometry(inclination) }));
  expect(r.valid).toBe(true);
  close(r.totalBuoyedWeightLbf, 47000 * bf);
  close(r.buoyedWeightAboveJarLbf + r.buoyedWeightBelowJarLbf, r.totalBuoyedWeightLbf);
  close(r.frictionlessHookloadLbf, 47000 * bf * Math.cos(inclination * Math.PI / 180));
  expect(r.deployment.deployedDpLengthFt).toBe(800); // MD deployment, not TVD.
});

test('curved nonuniform string integrates exact analytical arc TVD over each component', () => {
  const survey = geometry(0, 1000);
  const arc = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 90 }]);
  const k = Math.PI / 3000, tvd = md => Math.sin(k * md) / k;
  // Surface down: DP 0-800, upper DC 800-880, jar 880-900, lower DC 900-1000.
  const expected = bf * (20 * tvd(800) + 100 * (tvd(880) - tvd(800)) + 150 * (tvd(900) - tvd(880)) + 200 * (tvd(1000) - tvd(900)));
  const r = calcStringWeightSummary(base({ survey: arc }));
  expect(r.valid).toBe(true);
  close(r.frictionlessHookloadLbf, expected);
  close(r.totalBuoyedWeightLbf, calcStringWeightSummary(base({ survey })).totalBuoyedWeightLbf);
  expect(r.frictionlessHookloadLbf).toBeLessThan(r.totalBuoyedWeightLbf);
});

test.each([200, 1000, 2000, 12000])('Auto DP at bit MD %s uses actual length and conserves above/below weights without mutation', bitMdFt => {
  const input = base({ bitMdFt }), original = JSON.stringify(input);
  const r = calcStringWeightSummary(input), pipe = bitMdFt - 200;
  expect(r.valid).toBe(true);
  expect(r.deployment.deployedDpLengthFt).toBe(pipe);
  close(r.totalAirWeightLbf, 31000 + pipe * 20);
  close(r.totalBuoyedWeightLbf, (31000 + pipe * 20) * bf);
  close(r.buoyedWeightAboveJarLbf, (9500 + pipe * 20) * bf);
  close(r.buoyedWeightBelowJarLbf, 21500 * bf);
  close(r.buoyedWeightAboveJarLbf + r.buoyedWeightBelowJarLbf, r.totalBuoyedWeightLbf);
  close(r.weightConservationResidualLbf, 0);
  expect(JSON.stringify(input)).toBe(original);
});

test('selected jar changes the centre split only and includes half the selected jar weight on each side', () => {
  const assembly = { rows: [row('JAR', 20, 100), row('DC', 50, 100), row('JAR', 20, 200), row('DP', 15000, 100)] };
  for (const [jarIndex, belowAir, aboveAir] of [[0, 1000, 101000], [1, 9000, 93000]]) {
    const r = calcStringWeightSummary(base({ bha: assembly, jarIndex }));
    close(r.totalAirWeightLbf, 102000); close(r.totalBuoyedWeightLbf, 102000 * bf);
    close(r.buoyedWeightAboveJarLbf, aboveAir * bf); close(r.buoyedWeightBelowJarLbf, belowAir * bf);
    close(r.frictionlessHookloadLbf, 102000 * bf);
    const selected = r.components[jarIndex === 0 ? 0 : 2];
    close(selected.buoyedWeightAboveJarLbf, selected.buoyedWeightLbf / 2);
    close(selected.buoyedWeightBelowJarLbf, selected.buoyedWeightLbf / 2);
  }
});

test('explicit nonzero surface reference is honoured without survey extrapolation', () => {
  const r = calcStringWeightSummary(base({ bitMdFt: 1100, surfaceMdFt: 100, survey: geometry(60, 1100, 100) }));
  expect(r.valid).toBe(true);
  expect(r.deployment.deployedDpLengthFt).toBe(800);
  close(r.frictionlessHookloadLbf, 23500 * bf);
});

test('Test 4 at TD agrees with independently derived synthetic-well geometry and weight conservation', () => {
  const assembly = { rows: [row('STAB', 5, 111.25), row('DC', 300, 116), row('JAR', 30, 150), row('DC', 180, 116), row('DP', 11485, 27.76)] };
  const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  const survey = calculateSurveyGeometry(parseSurveyCsv(csv, { mdUnit: 'ft', angleUnit: 'deg' }).stations);
  const r = calcStringWeightSummary(base({ bha: assembly, survey, bitMdFt: 12000 }));
  const fixedAir = 60736.25, pipeAir = 11485 * 27.76;
  // DP ends at MD 11485; analytical TVD = 3000 + R*sin60 + (11485-5000)*cos60.
  const pipeTvd = 3000 + 6000 / Math.PI * Math.sin(Math.PI / 3) + 6485 * 0.5;
  const expectedHookload = bf * (27.76 * pipeTvd + fixedAir * 0.5);
  expect(r.valid).toBe(true);
  close(r.totalAirWeightLbf, fixedAir + pipeAir);
  close(r.totalBuoyedWeightLbf, (fixedAir + pipeAir) * bf);
  close(r.buoyedWeightBelowJarLbf, 37606.25 * bf);
  close(r.buoyedWeightAboveJarLbf, (2250 + 20880 + pipeAir) * bf);
  close(r.frictionlessHookloadLbf, expectedHookload);
  close(r.buoyedWeightAboveJarLbf + r.buoyedWeightBelowJarLbf, r.totalBuoyedWeightLbf);
});

test.each([{ bitMdFt: '' }, { bitMdFt: 100 }, { mudWeightPpg: '' }, { mudWeightPpg: 65.5 }, { mudWeightPpg: -1 },
  { surfaceMdFt: '' }, { jarIndex: -1 }, { jarIndex: 0.5 }, { jarIndex: 9 }, { survey: null },
  { survey: geometry(0, 900) }, { survey: geometry(0, 20000, 100) }, { bha: { rows: [row('JAR', 20, '')] } },
  { bha: { rows: [row('JAR', 20, -100)] } }, { bha: { rows: [row('JAR', 20, 100)] } }])('invalid weights, coverage or deployment produce unavailable summary: %j', extra => {
  const r = calcStringWeightSummary(base(extra));
  expect(r.valid).toBe(false); expect(r.errors[0]).toBeTruthy();
  expect(r).not.toHaveProperty('totalAirWeightLbf');
  expect(r).not.toHaveProperty('frictionlessHookloadLbf');
});

test('missing input is explicit, and zero component weights remain valid', () => {
  expect(calcStringWeightSummary(null).valid).toBe(false);
  expect(calcStringWeightSummary().valid).toBe(false);
  const r = calcStringWeightSummary(base({ bha: { rows: bha.rows.map(c => ({ ...c, weight: 0 })) } }));
  expect(r.valid).toBe(true); expect(r.totalBuoyedWeightLbf).toBe(0); expect(r.frictionlessHookloadLbf).toBe(0);
});

test.each([0, 60])('weight partitions reconcile all columns at %s degrees and exclude deployed DP from fixed above-jar BHA', inclination => {
  for (const bitMdFt of [200, 1000, 2000]) {
    const r = calcStringWeightSummary(base({ bitMdFt, survey: geometry(inclination) }));
    const { total, aboveJar, belowJar, fixedAboveJar } = r.weightPartitions;
    const projection = Math.cos(inclination * Math.PI / 180);
    close(fixedAboveJar.airWeightLbf, 9500); // upper DC 8000 + upper half jar 1500
    close(fixedAboveJar.buoyedWeightLbf, 9500 * bf);
    close(fixedAboveJar.axialWeightLbf, 9500 * bf * projection);
    close(aboveJar.airWeightLbf, 9500 + (bitMdFt - 200) * 20);
    close(belowJar.airWeightLbf, 21500);
    for (const key of ['airWeightLbf', 'buoyedWeightLbf', 'axialWeightLbf']) close(aboveJar[key] + belowJar[key], total[key]);
    close(aboveJar.axialWeightLbf, aboveJar.airWeightLbf * bf * projection);
    close(belowJar.axialWeightLbf, belowJar.airWeightLbf * bf * projection);
    close(total.axialWeightLbf, r.frictionlessHookloadLbf);
  }
});

test('curved jar-centre axial partitions match independently integrated arc geometry', () => {
  const arc = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 90 }]);
  const r = calcStringWeightSummary(base({ survey: arc }));
  const tvd = md => Math.sin(Math.PI * md / 3000) * 3000 / Math.PI;
  const fixed = bf * (100 * (tvd(880) - tvd(800)) + 150 * (tvd(890) - tvd(880)));
  close(r.weightPartitions.fixedAboveJar.axialWeightLbf, fixed);
  close(r.weightPartitions.aboveJar.axialWeightLbf, fixed + bf * 20 * tvd(800));
  close(r.weightPartitions.belowJar.axialWeightLbf, bf * (150 * (tvd(900) - tvd(890)) + 200 * (tvd(1000) - tvd(900))));
  for (const key of ['airWeightLbf', 'buoyedWeightLbf', 'axialWeightLbf']) close(r.weightPartitions.aboveJar[key] + r.weightPartitions.belowJar[key], r.weightPartitions.total[key]);
});

test.each([200, 1000, 2000])('Total BHA at MD %s excludes deployed DP while all weight partitions reconcile', bitMdFt => {
  const r = calcStringWeightSummary(base({ bitMdFt, survey: geometry(60) }));
  const { total, totalBha, aboveJar, belowJar, fixedAboveJar } = r.weightPartitions;
  close(totalBha.airWeightLbf, 31000);
  close(totalBha.buoyedWeightLbf, 31000 * bf);
  close(totalBha.axialWeightLbf, 31000 * bf * 0.5);
  close(total.airWeightLbf - totalBha.airWeightLbf, (bitMdFt - 200) * 20);
  for (const key of ['airWeightLbf', 'buoyedWeightLbf', 'axialWeightLbf']) {
    close(aboveJar[key] + belowJar[key], total[key]);
    close(fixedAboveJar[key] + belowJar[key], totalBha[key]);
  }
});

test('curved Total BHA inclination correction integrates all fixed component TVD spans', () => {
  const arc = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 90 }]);
  const r = calcStringWeightSummary(base({ survey: arc }));
  const tvd = md => Math.sin(Math.PI * md / 3000) * 3000 / Math.PI;
  const expected = bf * (100 * (tvd(880) - tvd(800)) + 150 * (tvd(900) - tvd(880)) + 200 * (tvd(1000) - tvd(900)));
  close(r.weightPartitions.totalBha.axialWeightLbf, expected);
  close(r.weightPartitions.totalBha.airWeightLbf, 31000);
});
