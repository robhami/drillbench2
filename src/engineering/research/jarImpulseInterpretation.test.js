import { integrateImpulseWindow, extractImpulseMetrics, geometryWavePaths } from './jarImpulseInterpretation';
import { firstTensileLobe, buildJarPositionCase } from './jarPositionComparison';
import config from '../../../docs/ValidationStudies/JarPositionStage6D3D/config.v1.json';
import evidence from '../../../docs/ValidationStudies/JarImpulseStage6D3E/analysis.json';
const history = pairs => pairs.map(([timeS,stuckDynamicForceN]) => ({timeS,stuckDynamicForceN,contactForceN:0,hammerVelocityMS:0}));

test('analytical sign-crossing ramp separates signed, tensile-only and compressive impulses', () => {
  const r=integrateImpulseWindow(history([[0,-2],[2,2]]),0,2);
  expect(r.signedNs).toBe(0); expect(r.tensileOnlyNs).toBe(1); expect(r.compressiveOnlyNs).toBe(1); expect(r.identityResidualNs).toBe(0);
});
test('window clipping and linear zero crossing use exact piecewise-linear integrals', () => {
  const r=integrateImpulseWindow(history([[0,-4],[4,4]]),1,3);
  // Each clipped triangle has base 1 s and height 2 N: area 1 N s.
  expect(r.signedNs).toBe(0); expect(r.tensileOnlyNs).toBe(1); expect(r.compressiveOnlyNs).toBe(1);
  const t=integrateImpulseWindow(history([[0,-4],[4,4]]),0,1);
  expect(t.signedNs).toBe(-3); expect(t.tensileOnlyNs).toBe(3);
});
test('no extrapolation, nonfinite forces or unordered histories', () => {
  for(const [h,a,b] of [[history([[0,0],[1,0]]),0,2],[history([[0,NaN],[1,0]]),0,1],[history([[0,0],[0,1],[1,0]]),0,1]]) expect(()=>integrateImpulseWindow(h,a,b)).toThrow();
});
test('original lobe detector preserved; distinct signed lobes are not merged', () => {
  const h=history([[0,0],[1,-2],[2,0],[3,-6],[4,0]]),primary=firstTensileLobe(h,0);
  const r=extractImpulseMetrics({valid:true,histories:h,events:[],numerical:{maxIncrementalEnergyResidualJ:0}},primary,{startS:0,endS:4});
  expect(primary.magnitudeImpulseNs).toBe(2); expect(r.fixed.tensileOnlyNs).toBe(8); expect(r.primaryDurationS).toBe(2); expect(r.meanPrimaryTensileForceN).toBe(1);
  expect(r.nonTensileInteriorSamples).toBe(0); expect(r.lobeAgreementResidualNs).toBe(0);
});
test('return times and reflection signs follow explicit lengths and impedances', () => {
  const c=buildJarPositionCase(config,9),paths=geometryWavePaths(c),speed=Math.sqrt(200e9/7850);
  expect(Math.abs(c.firstArrivalS-9.25/speed)).toBeLessThan(1e-15);
  expect(Math.abs(paths.find(p=>p.kind==='fixed-bit-return-to-jar').timeS-18.5/speed)).toBeLessThan(1e-15);
  const fromB=paths.find(p=>p.side==='lower'&&p.kind==='first-interface-return-to-jar'&&p.from==='DC-B-below');
  expect(Math.abs(fromB.timeS-6.5/speed)).toBeLessThan(1e-15); expect(fromB.forceReflectionCoefficient).toBeGreaterThan(0);
  expect(paths.find(p=>p.kind==='hypothetical-surface-return').supported).toBe(false);
});
test('preserved seven inputs, independent integration and finer metric checks all pass', () => {
  expect(evidence.results).toHaveLength(7); expect(evidence.refined).toHaveLength(7); expect(evidence.window).toMatchObject({startS:0,endS:.025});
  expect(evidence.checks).toHaveLength(119); expect(evidence.checks.every(c=>c.pass)).toBe(true);
  for(const r of evidence.refined){expect(r.geometry.totalLengthM).toBe(100);expect(r.metrics.fixed.tensileOnlyNs).toBeGreaterThanOrEqual(r.metrics.primaryImpulseNs);expect(r.metrics.nonTensileInteriorSamples).toBe(0);}
});
