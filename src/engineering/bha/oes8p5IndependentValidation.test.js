import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import capture from '../../../docs/ValidationStudies/OES8p5Stage6C1.source.json';
import reference from '../../../docs/ValidationStudies/OES8p5Stage6C1.reference.json';
import { fromCapture } from '../../../docs/ValidationStudies/OES8p5Stage6C1.reference.cjs';
import { analysisDepth } from './analysisDepth';
import { deployDrillstring } from './deployDrillstring';
import { calcComponentPositions } from './calcComponentPositions';
import { buildEngModel } from '../models/buildEngModel';
import { calcStraightDrag, calcNeutralPointFromLoadProfile } from '../forces/calcStraightDrag';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { calcOffBottomHookloads, calcOffBottomRotatingSummary } from '../forces/calcOffBottomHookloads';
import { calcStaticJarLoads } from '../jar/staticJarLoads';
import { solveStaticJarHookload } from '../jar/inverseStaticJarLoads';
import { calcJarClearanceAcrossRun } from '../jar/jarClearanceAcrossRun';
import { resolveActiveSurvey, surveyGeometry } from '../../Apps/Survey/surveyAssociation';
import { clearanceRequest } from '../../Apps/JarClearance/clearanceData';
import { calculateTargetStatic } from '../research/targetJarDownWorkflow';
import { assessBhaReadiness } from '../../Components/BHABuilder/bhaReadiness';

const bha = capture.workingCopy, before = JSON.stringify(capture), survey = surveyGeometry(resolveActiveSurvey(bha));
const deployment = deployDrillstring(bha, 9318, { surfaceMdFt: 0 });
const request = { bha, survey, bitMdFt: 9318, surfaceMdFt: 0, mudWeightPpg: 15.5, frictionCoefficient: 0, rpm: 120, ropFtHr: 60 };
// Fixed before evaluation in the Stage 6C.1 report. No solver defaults changed.
const tolerances = { positionFt: 1e-6, forceLbf: .1, neutralPointFt: 1e-4, buoyancyFactor: 1e-12 };
const comparisons = [];
function compare(quantity, expected, actual, tolerance, unit) {
  const difference = actual - expected;
  const status = Number.isFinite(actual) && Math.abs(difference) <= tolerance ? 'PASS' : 'FAIL';
  comparisons.push({ quantity, independent: expected, drillFrame: actual, difference, tolerance, unit, status });
  expect(status).toBe('PASS');
}
afterAll(() => {
  expect(JSON.stringify(capture)).toBe(before);
  fs.writeFileSync(path.join(process.cwd(), 'docs/ValidationStudies/OES8p5Stage6C1.comparison.json'), JSON.stringify({
    sourceSha256: reference.sourceSha256, authoritativeRecord: 'workingCopy (captured, not substituted for savedMatches)',
    assumptions: reference.basis, tolerances, comparisons,
    indeterminate: ['As-built tool displacement/material density not supplied', 'Stabilizer segment weight distribution unspecified', 'No measured operational loads or manufacturer firing verification', 'Original live UI outputs not captured; comparisons are a reproducible application replay']
  }, null, 2) + '\n');
});

test('immutable actual OES capture and independently generated fixture have verified identity', () => {
  const raw = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/OES8p5Stage6C1.source.json'));
  expect(crypto.createHash('sha256').update(raw).digest('hex')).toBe('3ca301130aec4c199ead175f7cd58ed5ff8e82a78646b35cb0c289a1b4a15128');
  expect(capture.savedMatches).toHaveLength(1); expect(capture.workingCopyMatchesSaved).toBe(false);
  expect(capture.savedMatches[0].drillpipeReferenceBitMdFt).toBe(8144.73);
  expect(capture.savedMatches[0].mudWeight).toBe(''); expect(bha.mudWeight).toBe('15.5');
  const generated = fromCapture(capture);
  for (const [key, value] of Object.entries(generated)) expect(reference[key]).toEqual(value);
  expect(fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/OES8p5Stage6C1.reference.cjs'), 'utf8')).not.toMatch(/require\(['"].*(?:src\/|engineering\/)/);
});

test('exact OES geometry/deployment retains every component and snapshot, including distinct collars and HWDP', () => {
  expect(assessBhaReadiness(bha).valid).toBe(true); expect(deployment.valid).toBe(true);
  compare('Analysis bit MD', reference.bitMdFt, analysisDepth(bha).bitMdFt, tolerances.positionFt, 'ft');
  compare('Fixed tool length', reference.fixedLengthFt, deployment.metadata.fixedLengthFt, tolerances.positionFt, 'ft');
  compare('Auto DP deployed length', reference.deployedDpLengthFt, deployment.metadata.deployedDpLengthFt, tolerances.positionFt, 'ft');
  expect(bha.rows[9].length).toBe('');
  expect(deployment.bha.rows.slice(0, -1)).toEqual(bha.rows.slice(0, -1));
  const positions = calcComponentPositions(deployment.bha);
  compare('Total deployed length', reference.totalLengthFt, positions.totalLength, tolerances.positionFt, 'ft');
  positions.components.forEach((c, i) => {
    const r = reference.components[i];
    expect(c.rowId).toBe(r.rowId); expect(c.componentDefinition).toEqual(bha.rows[i].componentDefinition);
    compare(`Row ${i + 1} lower / from bit`, r.startFromBitFt, c.startFromBit, tolerances.positionFt, 'ft');
    compare(`Row ${i + 1} upper / from bit`, r.endFromBitFt, c.endFromBit, tolerances.positionFt, 'ft');
    compare(`Row ${i + 1} buoyed weight`, r.buoyedWeightLbf, c.buoyedWeight, tolerances.forceLbf, 'lbf');
  });
});

test('off-bottom weights and hookloads independently match rational vertical sums', () => {
  for (const run of [calcOffBottomHookloads, calcOffBottomRotatingSummary]) {
    const result = run(request); expect(result.weights.valid).toBe(true);
    compare('Buoyancy factor', reference.buoyancyFactor, result.weights.buoyancyFactor, tolerances.buoyancyFactor, 'ratio');
    compare('Total air weight', reference.totalAirWeightLbf, result.weights.totalAirWeightLbf, tolerances.forceLbf, 'lbf');
    compare('Total buoyed weight', reference.totalBuoyedWeightLbf, result.weights.totalBuoyedWeightLbf, tolerances.forceLbf, 'lbf');
    compare('Buoyed weight above jar centre', reference.jar.buoyedWeightAboveCentreLbf, result.weights.buoyedWeightAboveJarLbf, tolerances.forceLbf, 'lbf');
    compare('Buoyed weight below jar centre', reference.jar.buoyedWeightBelowCentreLbf, result.weights.buoyedWeightBelowJarLbf, tolerances.forceLbf, 'lbf');
    for (const key of ['pickupHookload', 'slackOffHookload', 'rotatingHookload']) {
      expect(result[key].valid).toBe(true);
      compare(key, reference.totalBuoyedWeightLbf, result[key].valueLbf, tolerances.forceLbf, 'lbf');
    }
  }
  const offBottom = calcStaticJarLoads({ ...request, direction: 'slackoff', loadMode: 'absolute', surfaceHookloadLbf: reference.totalBuoyedWeightLbf });
  expect(offBottom.valid).toBe(true);
  compare('Off-bottom jar-centre axial force', reference.jar.offBottomForceLbf, offBottom.jarAxialLoadLbf, tolerances.forceLbf, 'lbf');
});

test.each(reference.cases)('WOB $wobLbf: axial boundaries, jar force and NP match independently across load engines', expected => {
  for (const mode of ['slide', 'rotate']) {
    const load = calcSurveyAxialLoads({ ...request, bha: deployment.bha, mode, wobLbf: expected.wobLbf }); expect(load.valid).toBe(true);
    compare(`${mode} WOB ${expected.wobLbf}: support`, expected.surfaceHookloadLbf, -load.topOfBhaAxialForce, tolerances.forceLbf, 'lbf');
    compare(`${mode} WOB ${expected.wobLbf}: jar force`, expected.jarAxialForceLbf, load.jars[0].axialForceLbf, tolerances.forceLbf, 'lbf');
    compare('Jar centre / from bit', reference.jar.centreFromBitFt, load.jars[0].centreFromBitFt, tolerances.positionFt, 'ft');
    compare('Jar centre MD', reference.jar.centreMdFt, load.jars[0].mdFt, tolerances.positionFt, 'ft');
    expect(load.neutralPoints).toHaveLength(1); expect(load.neutralPoints[0].componentIndex).toBe(expected.neutralPoint.row - 1);
    compare(`${mode} WOB ${expected.wobLbf}: NP above bit`, expected.neutralPoint.fromBitFt, load.neutralPoints[0].fromBitFt, tolerances.neutralPointFt, 'ft');
    compare(`${mode} WOB ${expected.wobLbf}: NP MD`, expected.neutralPoint.mdFt, load.neutralPoints[0].mdFt, tolerances.neutralPointFt, 'ft');
    load.components.forEach((c, i) => {
      compare(`WOB ${expected.wobLbf}: row ${i + 1} bottom force`, reference.components[i].forces[expected.wobLbf].bottomLbf, c.bottomAxialForce, tolerances.forceLbf, 'lbf');
      compare(`WOB ${expected.wobLbf}: row ${i + 1} top force`, reference.components[i].forces[expected.wobLbf].topLbf, c.topAxialForce, tolerances.forceLbf, 'lbf');
    });
  }
  const legacy = calcStraightDrag(buildEngModel({ ...deployment.bha, wob: expected.wobLbf / 1000 }), 'reference');
  expect(legacy.valid).toBe(true);
  compare(`Legacy reference WOB ${expected.wobLbf}: NP`, expected.neutralPoint.fromBitFt, calcNeutralPointFromLoadProfile(legacy).neutralPointFromBit, tolerances.neutralPointFt, 'ft');
  const topDown = calcStaticJarLoads({ ...request, direction: 'slackoff', loadMode: 'absolute', surfaceHookloadLbf: expected.surfaceHookloadLbf });
  expect(topDown.valid).toBe(true);
  compare(`Top-down WOB ${expected.wobLbf}: jar force`, expected.jarAxialForceLbf, topDown.jarAxialLoadLbf, tolerances.forceLbf, 'lbf');
});

test('40-klbf target uses independent above-jar weight minus compression; static JarFrame remains distinct from dynamics', () => {
  const inverse = solveStaticJarHookload({ ...request, jarIndex: 0, jarDirection: 'down', desiredJarForceLbf: 40000 });
  expect(inverse.valid).toBe(true);
  compare('40-klbf Jar Down: required support', reference.jar.requiredSurfaceHookloadLbf, inverse.requiredSurfaceHookloadLbf, tolerances.forceLbf, 'lbf');
  compare('40-klbf Jar Down: jar compression', 40000, inverse.jarAxialLoadLbf, tolerances.forceLbf, 'lbf');
  expect(Math.abs(inverse.residualLbf)).toBeLessThanOrEqual(inverse.residualToleranceLbf);
  const frame = calculateTargetStatic({ ...request, targetKlbf: 40, settings: { stuckPointFt: '', strokeIn: '', youngsModulusPsi: '', densitySlugFt3: '', gravityFtS2: '', horizonS: '' } });
  expect(frame.valid).toBe(true); expect(frame.dynamicInput).toBeNull();
  compare('JarFrame target-static support', reference.jar.requiredSurfaceHookloadLbf, frame.inverse.requiredSurfaceHookloadLbf, tolerances.forceLbf, 'lbf');
  compare('JarFrame target-static jar compression', 40000, frame.inverse.jarAxialLoadLbf, tolerances.forceLbf, 'lbf');
});

test('Neutral Point Behaviour request reproduces captured 10–35-klbf chart endpoints independently of primary WOB 33', () => {
  const fields = { start: '9318', end: '9318', increment: '100', modes: 'both', minWob: bha.wobAnalysis.minWobKlbf, maxWob: bha.wobAnalysis.maxWobKlbf,
    samples: bha.wobAnalysis.samples, avoidance: '0', surface: '0', mud: bha.mudWeight, friction: bha.frictionCoefficient, rpm: bha.rpm, rop: bha.rop };
  const prepared = clearanceRequest(bha, survey, fields, true); expect(prepared.valid).toBe(true);
  const chart = calcJarClearanceAcrossRun(prepared.request); expect(chart.valid).toBe(true); expect(chart.invalidScenarios).toBe(0);
  for (const wobLbf of [10000, 35000]) {
    const expected = reference.cases.find(c => c.wobLbf === wobLbf);
    const scenarios = chart.scenarios.filter(c => c.wobLbf === wobLbf); expect(scenarios).toHaveLength(2);
    for (const scenario of scenarios) {
      compare(`NP chart ${wobLbf} ${scenario.mode}: NP`, expected.neutralPoint.fromBitFt, scenario.neutralPoints[0].fromBitFt, tolerances.neutralPointFt, 'ft');
    }
  }
  expect(chart.scenarios.some(c => c.wobLbf === 33000)).toBe(false);
});
