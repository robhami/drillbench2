import config from '../../../docs/ValidationStudies/JarPositionStage6D3D/config.v1.json';
import { buildJarPositionCase, assessDistributedStaticContext, firstTensileLobe, compareJarPosition, rankJarPositions } from './jarPositionComparison';
import { simulateCoupledJarImpact } from './coupledJarImpact';

test('Mode A preserves mixed inventory, total length, nominal mass, jar and impact assumptions', () => {
  const before = JSON.stringify(config), masses = [], lengths = [];
  for (const p of config.lowerCollarLengthsM) {
    const c = buildJarPositionCase(config, p);
    expect(c.totalCollarsM).toBe(20); expect(c.totalStringLengthM).toBe(100);
    expect(c.input.hammerMassKg).toBe(20); expect(c.input.contactStiffnessNm).toBe(1e7); expect(c.input.release.relativeVelocityMS).toBe(1);
    expect(c.input.equilibrium.axialForceN).toBe(0);
    expect(c.jarPositionM).toBe(p + .25);
    masses.push(c.components.reduce((s, row) => s + row.nominalWeightNPerM * row.lengthM / config.gravityMS2, 0));
    lengths.push(c.input.upper.sections.reduce((s, row) => s + row.lengthM, 0) + c.input.lower.sections.reduce((s, row) => s + row.lengthM, 0));
    const dynamicMass = [...c.input.upper.sections, ...c.input.lower.sections].reduce((s, row) => s + row.areaM2 * row.densityKgM3 * row.lengthM, 0) + c.input.hammerMassKg;
    expect(Math.abs(dynamicMass - masses.at(-1))).toBeLessThan(1e-9);
    const context = assessDistributedStaticContext(c.staticProfile);
    expect(context.valid).toBe(true); expect(context.supportedDynamically).toBe(false);
    expect(Math.abs(c.staticHookloadN - masses.at(-1) * config.gravityMS2)).toBeLessThan(1e-7);
    const jar = c.components.find(row => row.id === config.jar.id), below = c.components.filter(row => row.startFromBit < jar.startFromBit);
    const expected = -below.reduce((s, row) => s + row.nominalWeightNPerM * row.lengthM, 0) - jar.nominalWeightNPerM * jar.lengthM / 2;
    expect(Math.abs(c.staticJarForceN - expected)).toBeLessThan(1e-8);
  }
  masses.forEach(m => expect(Math.abs(m - masses[0])).toBeLessThan(1e-9)); lengths.forEach(L => expect(L).toBe(100));
  expect(JSON.stringify(config)).toBe(before);
});
test('accepts balanced piecewise static context, rejects imbalances; never claims full preload', () => {
  const c = buildJarPositionCase(config, 9), profile = c.staticProfile.map(row => ({ ...row })); profile[1].topForceN += 1;
  expect(assessDistributedStaticContext(profile).valid).toBe(false);
  for (const change of [{ mode: 'B' }, { mode: 'C' }, { staticTreatment: 'fully-preloaded' }]) expect(compareJarPosition({ ...config, ...change }, 9).valid).toBe(false);
});
test('primary impulse is first tensile excursion only; truncated pulses stay indeterminate', () => {
  const h = [[0,0],[1,-2],[2,0],[3,-10],[4,0]].map(([timeS,stuckDynamicForceN]) => ({timeS,stuckDynamicForceN}));
  const p = firstTensileLobe(h, 0); expect(p.status).toBe('complete-first-tensile-lobe'); expect(p.magnitudeImpulseNs).toBe(2); expect(p.endS).toBe(2);
  expect(firstTensileLobe(h.slice(0,2),0).status).toBe('indeterminate');
  expect(firstTensileLobe([{timeS:0,stuckDynamicForceN:1},{timeS:2,stuckDynamicForceN:-1},{timeS:3,stuckDynamicForceN:0}],0).magnitudeImpulseNs).toBe(1);
});
test('unchanged Stage 6D.3B agrees with independent semi-infinite analytical reference', () => {
  const r = simulateCoupledJarImpact({ model:'research-coupled-linear-contact',units:'SI',equilibrium:'zero-preload',direction:'up',hammerMassKg:1,initialHammerVelocityMS:-1,contactStiffnessNm:1e6,
    initialContact:{gapM:0,compressionM:0},anvil:'rod',sections:[{id:'rod',kind:'uniform-elastic',lengthM:10,areaM2:2.5e-5,densityKgM3:8000,youngsModulusPa:200e9}],rightBoundary:'matched',durationS:.004,numerical:{timeStepS:1e-6} });
  expect(r.valid).toBe(true); expect(Math.abs(r.metrics.maximumContactForceN - 546.2930158736013)).toBeLessThan(.001);
  expect(r.histories.every(row => row.contactForceN >= 0)).toBe(true);
});
test('analogue baseline has complete lobe, correct causal arrival, bounded energy and valid convergence', () => {
  const r = compareJarPosition(config,9); expect(r.valid).toBe(true);
  expect(r.metrics.primaryImpulse.status).toBe('complete-first-tensile-lobe');
  expect(r.numerical.convergence.status).toBe('passed-two-resolution-check'); expect(r.metrics.energyResidualJ).toBeLessThan(3e-4);
  expect(r.trace.every(h => h.contactForceN >= 0)).toBe(true);
  const first = r.trace.find(h => h.stuckDynamicForceN !== 0);
  expect(Math.abs(first.timeS-r.firstArrivalS)).toBeLessThan(.025/1400);
  expect(r.metrics.maximumStuckForceMagnitudeN).toBeGreaterThan(r.metrics.maximumContactForceN);
});
test('equal-impedance subdivision leaves baseline peaks and primary impulse within fixed error bounds', () => {
  const original = compareJarPosition(config,9), b=config.collars[1];
  const split={...config,collars:[config.collars[0],{...b,id:'B1',lengthM:4},{...b,id:'B2',lengthM:4},config.collars[2]]};
  const changed=compareJarPosition(split,9); expect(changed.valid).toBe(true);
  expect(Math.abs(changed.metrics.maximumStuckForceMagnitudeN-original.metrics.maximumStuckForceMagnitudeN)).toBeLessThan(.001*original.metrics.maximumStuckForceMagnitudeN);
  expect(Math.abs(changed.metrics.primaryImpulse.magnitudeImpulseNs-original.metrics.primaryImpulse.magnitudeImpulseNs)).toBeLessThan(.001*original.metrics.primaryImpulse.magnitudeImpulseNs);
});
test('invalid results cannot receive rankings; first-lobe and peak rankings are separate', () => {
  const row=(p,peak,impulse,valid=true)=>({jarPositionM:p,valid,metrics:valid?{maximumStuckForceMagnitudeN:peak,primaryImpulse:{status:'complete-first-tensile-lobe',magnitudeImpulseNs:impulse}}:null});
  const rankings=rankJarPositions([row(1,10,20),row(2,20,10),row(3,100,100,false)],config.rankResolution);
  expect(rankings.peakBestPositionM).toBe(2); expect(rankings.impulseBestPositionM).toBe(1);
  expect(rankJarPositions([],config.rankResolution).peakBestPositionM).toBeNull();
});
