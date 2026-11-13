import request from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import before from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.before.json';
import verified from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.after.json';
import { calcSurveyAxialLoads } from './calcSurveyAxialLoads';
import { calcJarClearanceAcrossRun } from '../jar/jarClearanceAcrossRun';
import { deployDrillstring } from '../bha/deployDrillstring';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { comparisonClearances, comparisonPlot } from '../../Apps/JarClearance/clearanceData';
import { neutralPointChart } from '../../Apps/JarClearance/neutralPointChart';

const loadAt = (md, mode = 'slide', wob = 35000, overrides = {}) => calcSurveyAxialLoads({ ...request,
  bha: deployDrillstring(request.bha, md).bha, bitMdFt: md, mode, wobLbf: wob, frictionCoefficient: .25, ...overrides });

test('exact live 860-scenario request removes all 290 precision failures without changing the 570 previously valid scenarios', () => {
  expect(before.summary.sourceSha256).toBe('a1c78090da0619220b4aaa884b3bf500b1a0aa55f3e21b30b58a7398993b7106');
  expect(before.scenarios.filter(s => !s.valid)).toHaveLength(290);
  const snapshot = JSON.stringify(request);
  const result = calcJarClearanceAcrossRun(request);
  expect(result.scenarios).toHaveLength(860);
  expect(result.validScenarios).toBe(860); expect(result.invalidScenarios).toBe(0);
  expect(result.scenarios.every(s => s.neutralPoints.length === 1 && !s.neutralIntervals.length)).toBe(true);
  before.scenarios.forEach((s, i) => { if (s.valid) expect(result.scenarios[i]).toEqual(s); });
  expect(JSON.stringify(request)).toBe(snapshot);
  const series = comparisonClearances(result, request, .25);
  const chart = neutralPointChart(comparisonPlot(result, request, 1, series), result, request, {}, 0, series.map(s => s.selection));
  expect(chart.data.filter(t => t.showlegend)).toHaveLength(4);
  for (const trace of chart.data.filter(t => t.showlegend)) {
    expect(trace.x.filter(Number.isFinite)).toHaveLength(86);
    expect(trace.y.filter(Number.isFinite)).toHaveLength(86);
    expect(trace.connectgaps).toBe(false);
  }
});

test('every precise failing depth and nearby spatial perturbations retain positive resolved steps and exact jar nodes', () => {
  for (const md of before.summary.failedDepths) for (const delta of [-1e-8, 0, 1e-8]) for (const mode of ['slide', 'rotate']) {
    const result = loadAt(md + delta, mode);
    expect(result.valid).toBe(true);
    expect(result.elements.every(e => e.lengthFt > 0 && e.bottomMdFt > e.topMdFt)).toBe(true);
    expect(result.jars.every(j => result.profile.some(p => p.fromBitFt === j.centreFromBitFt && p.axialForceLbf === j.axialForceLbf))).toBe(true);
  }
});

test('survey stations at motor/collar/jar boundaries, centres and deployed DP centre do not create numerical slivers', () => {
  const offsets = [31.16798, 931.16798, 947.66798, 964.16798, 1264.16798, 1564.16798];
  for (const offset of offsets) expect(loadAt(5000 + offset).valid).toBe(true);
  expect(loadAt(6000 + 1564.16798).valid).toBe(true); // DP centre at survey MD 3000.
  // This interval is small but *resolvable* and must not be silently merged.
  const nearby = loadAt(6264.16798 + 1e-8);
  expect(nearby.elements.some(e => e.lengthFt > 0 && e.lengthFt < 1e-7)).toBe(true);
  expect(loadAt(6264.16798, 'slide', 35000, { maxStepFt: 1e-6 }).status).toBe('numerical-limit');
});

test('Auto deployment ignores saved DP inventory length, rejects partial fixed BHA and preserves the exact full-deployment boundary', () => {
  const original = JSON.stringify(request.bha);
  expect(deployDrillstring(request.bha, 1564.16798 - 1e-7).status).toBe('invalid-deployment');
  const boundary = deployDrillstring(request.bha, 1564.16798);
  expect(boundary.metadata.deployedDpLengthFt).toBe(0); expect(boundary.bha.rows).toHaveLength(4);
  expect(loadAt(1564.16798).valid).toBe(true);
  expect(loadAt(1564.16798 + 1e-6).valid).toBe(true);
  const deployed = deployDrillstring(request.bha, 10000);
  expect(deployed.metadata.deployedDpLengthFt).toBeCloseTo(8435.83202, 8);
  const alteredInventory = { ...request.bha, rows: request.bha.rows.map(r => r.category === 'DP' ? { ...r, length: 12345 } : r) };
  expect(deployDrillstring(alteredInventory, 10000).bha.rows).toEqual(deployed.bha.rows);
  expect(JSON.stringify(request.bha)).toBe(original);
});

test('formerly failed directional cases match independent RK4 values, with tighter agreement under spatial refinement', () => {
  for (const sample of verified.independent) {
    expect(Math.abs(sample.coarse.roots[0] - sample.fine.roots[0])).toBeLessThan(.0001);
    const result = loadAt(sample.md, sample.mode, sample.wob);
    expect(result.neutralPoints).toHaveLength(sample.fine.roots.length);
    // Default 5-ft linear zero interpolation has O(h²) spatial error.
    expect(Math.abs(result.neutralPoints[0].fromBitFt - sample.fine.roots[0])).toBeLessThan(.004);
    const refined = loadAt(sample.md, sample.mode, sample.wob, { maxStepFt: 1 });
    expect(Math.abs(refined.neutralPoints[0].fromBitFt - sample.fine.roots[0])).toBeLessThan(.0002);
    expect(Math.abs(refined.jars[0].axialForceLbf - sample.fine.jarForce)).toBeLessThan(.005);
  }
});

test('fractional motor geometry in a vertical survey agrees with independent buoyed-weight statics in both modes', () => {
  const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 12000, inclinationDeg: 0, azimuthDeg: 90 }]);
  const bf = 1 - 10 / 65.5, motor = request.bha.rows[0];
  for (const wob of [10000, 35000]) {
    const expected = Number(motor.length) + (wob / bf - Number(motor.length) * Number(motor.weight)) / 92;
    for (const mode of ['slide', 'rotate']) {
      const result = loadAt(6264.16798, mode, wob, { survey });
      expect(result.valid).toBe(true);
      expect(result.neutralPoints[0].fromBitFt).toBeCloseTo(expected, 7);
      expect(result.totalNormalContactForceLbf).toBe(0);
    }
  }
});
