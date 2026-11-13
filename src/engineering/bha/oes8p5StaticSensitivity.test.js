import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fixture from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import capture from '../../../docs/ValidationStudies/OES8p5Stage6C1.source.json';
import { cases, vertical, curved } from '../../../docs/ValidationStudies/OES8p5Stage6C2.reference.cjs';
import { deployDrillstring } from './deployDrillstring';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { calcOffBottomHookloads } from '../forces/calcOffBottomHookloads';
import { solveStaticJarHookload } from '../jar/inverseStaticJarLoads';
import { calcStaticJarLoads } from '../jar/staticJarLoads';
import { surveyGeometry } from '../../Apps/Survey/surveyAssociation';
import { sectionProperties } from './componentDefinition';
import { clearanceRequest } from '../../Apps/JarClearance/clearanceData';
import { calcJarClearanceAcrossRun } from '../jar/jarClearanceAcrossRun';
import { jarLoadingKey } from '../../Apps/JarForces/jarLoadingInputs';

const outputs = [], comparisons = [], frozen = JSON.stringify(fixture), t = fixture.tolerances;
const dir = path.join(process.cwd(), 'docs/ValidationStudies');
function assertUnsupported(result) {
  expect(result.valid).toBe(false); expect(result.status).toBe('unsupported-properties');
}
function assertRelocation(bha) {
  expect(bha.rows.map(r => r.rowId).sort()).toEqual(fixture.workingCopy.rows.map(r => r.rowId).sort());
  expect(bha.rows.filter(r => r.category !== 'JAR')).toEqual(fixture.workingCopy.rows.filter(r => r.category !== 'JAR'));
}
function compare(id, quantity, expected, actual, tolerance, unit = 'lbf') {
  const difference = actual - expected, status = Number.isFinite(actual) && Math.abs(difference) <= tolerance ? 'PASS' : 'FAIL';
  comparisons.push({ id, quantity, independent: expected, drillFrame: actual, absoluteDifference: Math.abs(difference), relativeDifference: expected === 0 ? null : difference / expected, tolerance, unit, status });
  expect({ id, quantity, expected, actual, status }).toMatchObject({ status: 'PASS' });
}
afterAll(() => {
  expect(JSON.stringify(fixture)).toBe(frozen);
  const convergence = comparisons.filter(c => c.quantity.startsWith('independent RK4'));
  fs.writeFileSync(path.join(dir, 'OES8p5Stage6C2.comparison.json'), JSON.stringify({ fixtureSha256: '58add76bc9d46aac3a949725e761a8355ca0d6698da1a1c1604ffe603483bd40', tolerances: t,
    comparisons: comparisons.filter(c => !convergence.includes(c)),
    referenceConvergence: convergence.map(({ independent, drillFrame, ...c }) => ({ ...c, fineReference: independent, coarseReference: drillFrame })), cases: outputs }, null, 2) + '\n');
});
test('versioned frozen fixture retains exact working copy, older saved record and full precision baseline', () => {
  expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'OES8p5Stage6C2.fixture.v1.json'))).digest('hex')).toBe('58add76bc9d46aac3a949725e761a8355ca0d6698da1a1c1604ffe603483bd40');
  expect(fixture.workingCopy).toEqual(capture.workingCopy); expect(fixture.olderSavedRecord).toEqual(capture.savedMatches[0]);
  const r = vertical(fixture.workingCopy), b = fixture.baseline;
  compare('baseline', 'off-bottom', b.totalBuoyedWeightLbf, r.slackoff, t.forceLbf);
  compare('baseline', 'WOB33 support', b.cases[1].surfaceHookloadLbf, r.hookload, t.forceLbf);
  compare('baseline', 'jar force', b.cases[1].jarAxialForceLbf, r.jarForce, t.forceLbf);
  compare('baseline', 'target support', b.jar.requiredSurfaceHookloadLbf, r.targetHookload, t.forceLbf);
  compare('baseline', 'neutral above bit', b.cases[1].neutralPoint.fromBitFt, r.np, t.neutralPointFt, 'ft');
  expect(fs.readFileSync(path.join(dir, 'OES8p5Stage6C2.reference.cjs'), 'utf8')).not.toMatch(/require\(['"].*(?:src\/|engineering\/)/);
});

test.each(cases(fixture.workingCopy).map(c => [c.id, c]))('%s independently verifies static sensitivities', (id, c) => {
  const stations = c.stations || [[0, c.inclination, 0], [9318, c.inclination, 0]];
  const survey = surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n' + stations.map(s => s.join(',')).join('\n') });
  expect(survey.valid).toBe(true);
  const expected = c.stations ? curved(c.bha, stations, c.mud, c.mu, c.wob) : vertical(c.bha, c.mud, c.wob, c.inclination, c.mu);
  const deployed = deployDrillstring(c.bha, 9318, { surfaceMdFt: 0 }); expect(deployed.valid).toBe(true);
  const request = { bha: c.bha, survey, bitMdFt: 9318, surfaceMdFt: 0, mudWeightPpg: c.mud, frictionCoefficient: c.mu, rpm: 120, ropFtHr: 60 };
  const load = calcSurveyAxialLoads({ ...request, bha: deployed.bha, mode: 'slide', wobLbf: c.wob }); expect(load.valid).toBe(true);
  const forceTol = c.stations ? t.curvedForceLbf : t.forceLbf, npTol = c.stations ? t.curvedNeutralPointFt : t.neutralPointFt;
  outputs.push({ ...c, stations, independent: expected, production: { hookload: -load.topOfBhaAxialForce, jarForce: load.jars[0].axialForceLbf, np: load.neutralPoints[0]?.fromBitFt ?? null } });
  compare(id, 'on-bottom support', expected.hookload, -load.topOfBhaAxialForce, forceTol);
  compare(id, 'jar axial force', expected.jarForce, load.jars[0].axialForceLbf, forceTol);
  compare(id, 'jar position', expected.jarFromBit, load.jars[0].centreFromBitFt, t.positionFt, 'ft');
  compare(id, 'jar MD', expected.jarMd, load.jars[0].mdFt, t.positionFt, 'ft');
  expect(load.neutralPoints).toHaveLength(expected.np === null ? 0 : 1);
  if (expected.np !== null) compare(id, 'neutral point', expected.np, load.neutralPoints[0]?.fromBitFt, npTol, 'ft');
  load.components.forEach((p, i) => {
    compare(id, `row ${i + 1} bottom`, expected.profile[i].bottom, p.bottomAxialForce, forceTol);
    compare(id, `row ${i + 1} top`, expected.profile[i].top, p.topAxialForce, forceTol);
  });
  const off = calcOffBottomHookloads({ ...request, rotatingAxialMotion: 'stationary' });
  for (const [name, key] of [['pickup', 'pickupHookload'], ['slackoff', 'slackOffHookload'], ['rotating', 'rotatingHookload']]) {
    expect(off[key].valid).toBe(true); compare(id, `${name} off-bottom`, expected[name], off[key].valueLbf, forceTol);
  }
  const inverse = solveStaticJarHookload({ ...request, jarIndex: 0, jarDirection: 'down', desiredJarForceLbf: 40000 }); expect(inverse.valid).toBe(true);
  compare(id, '40-klbf required support', expected.targetHookload, inverse.requiredSurfaceHookloadLbf, forceTol);
  const forward = calcStaticJarLoads({ ...request, direction: 'slackoff', loadMode: 'absolute', surfaceHookloadLbf: inverse.requiredSurfaceHookloadLbf });
  expect(forward.valid).toBe(true); compare(id, 'inverse forward check', 40000, forward.jarAxialLoadLbf, t.forceLbf);
  if (c.inclination !== 0 || c.stations) {
    const rotating = calcSurveyAxialLoads({ ...request, bha: deployed.bha, mode: 'rotate', wobLbf: c.wob });
    assertUnsupported(rotating);
    outputs[outputs.length - 1].rotatingLowering = { status: 'UNSUPPORTED', diagnostic: rotating.errors };
  }
  if (c.stations) {
    const finer = curved(c.bha, stations, c.mud, c.mu, c.wob, .25);
    for (const key of ['hookload', 'jarForce', 'pickup', 'slackoff', 'rotating', 'targetHookload']) compare(id, `independent RK4 convergence ${key}`, finer[key], expected[key], t.independentConvergenceLbf);
  }
  if (c.group === 'jar') {
    assertRelocation(c.bha);
    compare(id, 'conserved total buoyed weight', fixture.baseline.totalBuoyedWeightLbf, expected.total, t.forceLbf);
  }
});

test('physical trends, boundary traversal and property isolation are independently predicted', () => {
  const all = cases(fixture.workingCopy).map(c => ({ ...c, r: vertical(c.bha, c.mud, c.wob) }));
  const mud = all.filter(c => c.group === 'mud'), wob = all.filter(c => c.group === 'wob');
  for (let i = 1; i < mud.length; i++) {
    expect(mud[i].r.slackoff).toBeLessThan(mud[i - 1].r.slackoff); expect(mud[i].r.np).toBeGreaterThan(mud[i - 1].r.np);
    expect(mud[i].r.jarForce).toBeGreaterThan(mud[i - 1].r.jarForce); expect(mud[i].r.targetHookload).toBeLessThan(mud[i - 1].r.targetHookload);
  }
  for (let i = 1; i < wob.length; i++) {
    expect(wob[i].r.np).toBeGreaterThan(wob[i - 1].r.np);
    expect(wob[i].r.hookload - wob[i - 1].r.hookload).toBeCloseTo(-(wob[i].wob - wob[i - 1].wob), 6);
  }
  const base = vertical(fixture.workingCopy);
  all.filter(c => c.group === 'property' && !c.id.includes('weight')).forEach(c => {
    expect(c.r.hookload).toBe(base.hookload); expect(c.r.jarForce).toBe(base.jarForce); expect(c.r.np).toBe(base.np);
    expect(c.bha.rows.map(r => r.weight)).toEqual(fixture.workingCopy.rows.map(r => r.weight));
    expect(c.bha.rows[0].componentDefinition.sectionModel).toBe('complex');
    expect(c.bha.rows[0].componentDefinition.effectiveProperties).toBeUndefined();
    const props = sectionProperties(c.bha.rows[0].componentDefinition);
    expect(props.calculatedWeightLbFt).toBeNull();
    expect(props).not.toHaveProperty('axialStiffnessLbf');
    expect(props).not.toHaveProperty('waveImpedance');
  });
});

test('survey coverage and explicit-property limitations remain enforced', () => {
  const bha = JSON.parse(JSON.stringify(fixture.workingCopy));
  const survey = surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,0\n9000,30,0' });
  const deployed = deployDrillstring(bha, 9318, { surfaceMdFt: 0 });
  const request = { bha: deployed.bha, survey, bitMdFt: 9318, wobLbf: 33000, mode: 'slide', mudWeightPpg: 15.5, frictionCoefficient: .2 };
  const missing = calcSurveyAxialLoads(request); expect(missing.valid).toBe(false); expect(missing.status).toBe('outside-survey');
  const full = surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,0\n9318,0,0' });
  deployed.bha.rows[0].componentDefinition.geometry.segments[1].weight = '200';
  const segmented = calcSurveyAxialLoads({ ...request, survey: full }); expect(segmented.valid).toBe(false); expect(segmented.errors.join()).toContain('segment-resolved');
  deployed.bha.rows[0].componentDefinition.geometry.segments[1].weight = '';
  deployed.bha.rows[0].componentDefinition.material.densityLbFt3 = '490';
  const density = calcSurveyAxialLoads({ ...request, survey: full }); expect(density.valid).toBe(false); expect(density.errors.join()).toContain('density');
});

test.each([12, 15.5, 19])('Neutral Point Behaviour uses the same piecewise force profile at mud %s', mud => {
  const bha = { ...fixture.workingCopy, mudWeight: String(mud) };
  const survey = surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,0\n9318,0,0' });
  const prepared = clearanceRequest(bha, survey, { start: '9318', end: '9318', increment: '100', modes: 'both', minWob: '10', maxWob: '35', samples: '5', avoidance: '0', surface: '0', mud: String(mud), friction: '0', rpm: '120', rop: '60' }, true);
  expect(prepared.valid).toBe(true); const chart = calcJarClearanceAcrossRun(prepared.request);
  expect(chart.valid).toBe(true); expect(chart.invalidScenarios).toBe(0);
  chart.scenarios.forEach(s => compare(`chart-mud-${mud}-${s.mode}-${s.wobLbf}`, 'NP', vertical(bha, mud, s.wobLbf).np, s.neutralPoints[0].fromBitFt, t.neutralPointFt, 'ft'));
});

test('Hookload result provenance changes with each physically dependent input', () => {
  const bha = JSON.parse(JSON.stringify(fixture.workingCopy));
  const survey = surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,0\n9318,0,0' });
  const request = { bha, survey, bitMdFt: 9318, surfaceMdFt: 0, jarIndex: 0, jarDirection: 'down', targetForceKlbf: 40, available: true, covered: true, rotatingHookloadLbf: 210417.1799236641 };
  const key = jarLoadingKey(request);
  for (const patch of [{ mudWeight: '17' }, { frictionCoefficient: '.2' }, { trajectoryMode: 'directional' }]) expect(jarLoadingKey({ ...request, bha: { ...bha, ...patch } })).not.toBe(key);
  const weight = JSON.parse(JSON.stringify(bha)); weight.rows[5].weight = '110'; expect(jarLoadingKey({ ...request, bha: weight })).not.toBe(key);
  const blade = JSON.parse(JSON.stringify(bha)); blade.rows[0].componentDefinition.geometry.segments[1].od = 8.25; expect(jarLoadingKey({ ...request, bha: blade })).not.toBe(key);
  expect(jarLoadingKey({ ...request, bha: { ...bha, wob: '35' } })).toBe(key);
});
