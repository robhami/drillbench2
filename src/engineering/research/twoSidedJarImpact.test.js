import { simulateTwoSidedJarImpact } from './twoSidedJarImpact';
import { simulateCoupledJarImpact } from './coupledJarImpact';
import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import oesReference from '../../../docs/ValidationStudies/OES8p5Stage6C1.reference.json';
import independent from '../../../docs/ValidationStudies/TwoSidedJarStage6D3C/independent.json';

const section = (id = 's', lengthM = 10, factor = 1) => ({ id, kind: 'uniform-elastic', lengthM, areaM2: 2.5e-5 * factor, densityKgM3: 8000, youngsModulusPa: 200e9 });
const network = (length = 10, factor = 1, farBoundary = 'matched') => ({ sections: [section('s', length, factor)], farBoundary });
const base = changes => ({ model: 'research-two-sided-rigid-housing', units: 'SI', mechanism: 'ideal-rigid-through-housing', direction: 'down',
  equilibrium: { kind: 'uniform-self-equilibrated', axialForceN: 0 }, hammerMassKg: 1, contactStiffnessNm: 1e6, strokeM: 0,
  release: { timeS: 0, relativeVelocityMS: 1 }, upper: network(), lower: network(), durationS: .004,
  numerical: { timeStepS: 1e-6 }, ...changes });
const records = [], comparisons = [], convergence = [], traces = [];
const valid = r => expect({ status: r.status, error: r.error }).toEqual({ status: 'valid-research-result', error: '' });
function near(actual, independent, absolute = .002, relative = 2e-5) {
  const error = Math.abs(actual - independent), limit = absolute + relative * Math.abs(independent);
  comparisons.push({ test: expect.getState().currentTestName, actual, independent, absoluteDifference: error, relativeDifference: independent ? error / Math.abs(independent) : null, limit });
  expect(error).toBeLessThanOrEqual(limit);
}
function record(name, r) { records.push({ name, status: r.status, metrics: r.metrics, numerical: r.numerical, events: r.events, last: r.histories.at(-1), energy: r.energy.at(-1) });
  if (['release and free travel', 'release with incoming waves', 'preload work', 'two-sided recontact'].includes(name)) {
    const hop = Math.max(1, Math.ceil(r.histories.length / 800));
    traces.push({ name, histories: r.histories.filter((_, i) => i % hop === 0), energy: r.energy.filter((_, i) => i % hop === 0) });
  }
}
function analytic(t, Z = 2000) { const a = 1e6 / (2 * Z), w = Math.sqrt(1e6 - a * a); return { N: 1e6 / w * Math.exp(-a * t) * Math.sin(w * t), v: Math.exp(-a * t) * (Math.cos(w * t) + a / w * Math.sin(w * t)), tc: Math.PI / w }; }
const pulse = [{ timeS: 0, forceN: 0 }, { timeS: .0001, forceN: 100 }, { timeS: .0002, forceN: 0 }];
const incident = t => t < 0 || t > .0002 ? 0 : t <= .0001 ? t * 1e6 : (.0002 - t) * 1e6;

test('1: unloaded rigid connection and zero excitation remain exactly stationary', () => {
  const r = simulateTwoSidedJarImpact(base({ release: { timeS: null, relativeVelocityMS: 0 } })); valid(r);
  expect(r.metrics.peakContactForceN).toBe(0); expect(r.histories.every(h => h.hammerVelocityMS === 0 && h.housingVelocityMS === 0)).toBe(true); record('unloaded latch', r);
});
test.each([1, 2, .5])('2/3: upper incident wave scatters through rigid housing, Zlower factor %s', factor => {
  const r = simulateTwoSidedJarImpact(base({ upper: { ...network(1), incidentHistory: pulse }, lower: network(10, factor), strokeM: 1,
    release: { timeS: 0, relativeVelocityMS: 0 }, durationS: .0006 })); valid(r);
  for (const h of r.histories.filter((_, i) => i % 17 === 0)) {
    const F = incident(h.timeS - .0002), C = 2 * factor / (1 + factor) * F;
    near(h.lowerDynamicForceN, C, 1e-6, 1e-7); near(h.upperDynamicForceN, C, 1e-6, 1e-7);
    near(h.housingVelocityMS, 2 * F / (1000 * (1 + factor)), 1e-9, 1e-7);
    expect(h.contactForceN).toBe(0);
  }
  record(`rigid scattering ${factor}`, r);
});
test.each([-200, 300])('4: nonzero signed preload %s, no release/excitation', P => {
  const r = simulateTwoSidedJarImpact(base({ upper: network(1, 1, 'fixed'), lower: network(2, 2, 'fixed'), equilibrium: { kind: 'uniform-self-equilibrated', axialForceN: P }, release: { timeS: null, relativeVelocityMS: 0 } })); valid(r);
  expect(r.histories.every(h => h.upperTotalForceN === P && h.lowerTotalForceN === P && h.hammerVelocityMS === 0)).toBe(true);
  near(r.initialPreloadEnergyJ, P * P / 2 * (1 / 5e6 + 2 / 1e7), 1e-12, 0); record(`equilibrium ${P}`, r);
});
test('5: prescribed release, finite stroke, independent free travel', () => {
  const r = simulateTwoSidedJarImpact(base({ strokeM: .0005, release: { timeS: .001, relativeVelocityMS: 1 }, durationS: .003 })); valid(r);
  near(r.events.find(e => e.type === 'contact').timeS, .0015, 2e-9, 0);
  const travel = r.histories.find(h => h.timeS > .0012 && h.timeS < .0014);
  near(travel.hammerVelocityMS, 1, 1e-12, 0); expect(travel.housingVelocityMS).toBe(0); expect(travel.contactForceN).toBe(0);
  near(r.events[0].workJ, .5, 1e-12, 0); record('release and free travel', r);
});
test('latched finite hammer responds to incident ramp by independent closed-form ODE', () => {
  const r = simulateTwoSidedJarImpact(base({ upper: { ...network(1), incidentHistory: pulse }, lower: network(10), release: { timeS: null, relativeVelocityMS: 0 }, durationS: .00029, numerical: { timeStepS: 2e-7 } })); valid(r);
  const t = r.histories.at(-1).timeS - .0002;
  const expected = 1000 * (t - .0005 * (1 - Math.exp(-2000 * t)));
  near(r.histories.at(-1).hammerVelocityMS, expected, 1e-9, 1e-6); record('latched ramp', r);
});
test('6/7: two-sided hammer impact has analytical effective radiation impedance Zu+Zl', () => {
  const r = simulateTwoSidedJarImpact(base()); valid(r);
  for (const h of r.histories.filter((_, i) => i % 113 === 0 && r.histories[i].timeS < .003)) {
    const a = analytic(h.timeS); near(h.contactForceN, a.N); near(h.hammerVelocityMS, a.v, 2e-6, 0);
    near(h.upperDynamicForceN, -h.contactForceN / 2, 1e-9, 0); near(h.lowerDynamicForceN, h.contactForceN / 2, 1e-9, 0);
  }
  near(r.events.find(e => e.type === 'separation').timeS, analytic(0).tc, 1e-8, 0);
  expect(r.histories.at(-1).hammerVelocityMS).toBeLessThan(0); record('two-sided contact', r);
  traces.push({ name: 'two-sided contact', histories: r.histories.filter((_, i) => i % 10 === 0), energy: r.energy.filter((_, i) => i % 10 === 0) });
});
test('8: both upper and lower reflections influence contact, bounded and convergent', () => {
  const r = simulateTwoSidedJarImpact(base({ upper: network(1, 1, 'fixed'), lower: network(1.3, 1, 'fixed'), durationS: .003 })); valid(r);
  record('both reflected networks', r);
  expect(r.metrics.peakContactForceN).toBeGreaterThan(analytic(.001).N);
  expect(r.histories.every(h => h.contactForceN >= 0 && h.compressionM >= 0)).toBe(true);
});
test.each(independent.references)('8: independent 40-place two-return reference $name', ref => {
  const r = simulateTwoSidedJarImpact(base({ upper: network(1, 1, 'fixed'), lower: network(1.3, 1, ref.name === 'both-fixed' ? 'fixed' : 'free'), durationS: .0007,
    numerical: { timeStepS: 2e-7 } })); valid(r);
  near(r.histories.at(-1).contactForceN, Number(ref.forceN), 1e-6, 1e-8);
  near(r.histories.at(-1).hammerVelocityMS, Number(ref.velocityMS), 1e-9, 1e-8); record(ref.name, r);
});
test('nonzero preload is retained during impact; preload alone does not fire hammer', () => {
  const r = simulateTwoSidedJarImpact(base({ equilibrium: { kind: 'uniform-self-equilibrated', axialForceN: -200 } })); valid(r);
  for (const h of r.histories.filter((_, i) => i % 311 === 0)) near(h.upperTotalForceN - h.upperDynamicForceN, -200, 1e-10, 0);
  const stationary = simulateTwoSidedJarImpact(base({ equilibrium: { kind: 'uniform-self-equilibrated', axialForceN: 200 }, strokeM: .001, release: { timeS: .001, relativeVelocityMS: 0 } })); valid(stationary);
  expect(stationary.metrics.peakContactForceN).toBe(0); expect(stationary.histories.every(h => h.hammerVelocityMS === 0)).toBe(true); record('preloaded impact', r);
});
test('release under incoming waves preserves a real velocity discontinuity at the connection', () => {
  const r = simulateTwoSidedJarImpact(base({ upper: { ...network(1), incidentHistory: pulse }, lower: network(1), strokeM: .01,
    release: { timeS: .0003, relativeVelocityMS: 0 }, durationS: .0006, numerical: { timeStepS: 2e-7 } }));
  if (!r.valid && process.env.STAGE6D3C_EVIDENCE === '1') require('fs').writeFileSync('docs/ValidationStudies/TwoSidedJarStage6D3C/release-failure.json', JSON.stringify({ status: r.status, numerical: r.numerical, energy: r.energy.filter((_, i) => i % 100 === 0) }, null, 2));
  valid(r);
  near(r.events.find(e => e.type === 'release').workJ, 0, 1e-12, 0);
  const after = r.histories.find(h => h.timeS > .0003 && h.state === 'free-travel');
  expect(Math.abs(after.housingVelocityMS - after.hammerVelocityMS)).toBeGreaterThan(.001); record('release with incoming waves', r);
});
test('9: physical preload cross energy and external maintained-preload work', () => {
  const r = simulateTwoSidedJarImpact(base({ equilibrium: { kind: 'uniform-self-equilibrated', axialForceN: 200 }, upper: { ...network(1), incidentHistory: pulse },
    lower: network(1), strokeM: 1, release: { timeS: 0, relativeVelocityMS: 0 }, durationS: .001 })); valid(r);
  expect(Math.max(...r.energy.map(e => Math.abs(e.preloadBoundaryWorkJ)))).toBeGreaterThan(.001);
  for (const e of r.energy.filter((_, i) => i % 37 === 0)) near(e.preloadCrossEnergyJ, e.preloadBoundaryWorkJ, 1e-9, 1e-6); record('preload work', r);
});
test('10: absent upper branch and zero preload reproduce unchanged Stage 6D.3B', () => {
  const r = simulateTwoSidedJarImpact(base({ upper: null })); valid(r);
  const b = simulateCoupledJarImpact({ model: 'research-coupled-linear-contact', units: 'SI', equilibrium: 'zero-preload', direction: 'down', hammerMassKg: 1,
    initialHammerVelocityMS: 1, contactStiffnessNm: 1e6, initialContact: { gapM: 0, compressionM: 0 }, anvil: 'rod', sections: [section()], rightBoundary: 'matched', durationS: .004, numerical: { timeStepS: .5e-6 } }); valid(b);
  near(r.metrics.peakContactForceN, b.metrics.maximumContactForceN, 1e-7, 0); near(r.histories.at(-1).hammerVelocityMS, b.histories.at(-1).hammerVelocityMS, 1e-8, 0); record('3B reduction', r);
});
test('11: equal impedance subdivisions preserve two-sided response', () => {
  const one = simulateTwoSidedJarImpact(base({ upper: network(1.013, 1, 'fixed'), lower: network(1.277, 1, 'fixed'), durationS: .002 })); valid(one);
  const split = simulateTwoSidedJarImpact(base({ upper: { sections: [section('a', .337), section('b', .676)], farBoundary: 'fixed' }, lower: network(1.277, 1, 'fixed'), durationS: .002 })); valid(split);
  near(one.metrics.peakContactForceN, split.metrics.peakContactForceN, .01, 0); record('subdivision', split);
});
test('12: noncommensurate travel-time refinement', () => {
  for (const h of [4e-6, 2e-6, 1e-6]) {
    const r = simulateTwoSidedJarImpact(base({ upper: { sections: [section('a', 1.013), section('b', .537, 2)], farBoundary: 'fixed' },
      lower: { sections: [section('c', .733, .8), section('d', 1.127, 1.4)], farBoundary: 'fixed' }, durationS: .006, numerical: { timeStepS: h } })); valid(r);
    convergence.push({ h, ...r.metrics, ...r.numerical, events: r.events, finalHammerVelocityMS: r.histories.at(-1).hammerVelocityMS });
  }
  expect(convergence.at(-1).maxIncrementalEnergyResidualJ).toBeLessThan(convergence[0].maxIncrementalEnergyResidualJ / 3);
});
test('two-sided reflected recontact remains stable with a real separating gap', () => {
  // Return just AFTER the analytically known first separation (3.2446 ms).
  const r = simulateTwoSidedJarImpact(base({ upper: network(8.2, 1, 'fixed'), lower: network(8.2, 1, 'fixed'), durationS: .02 })); valid(r);
  expect(r.events.filter(e => e.type === 'recontact').length).toBeGreaterThan(0); record('two-sided recontact', r);
});
test('OES static values from actual frozen working copy, no dynamic adapter', () => {
  const rows = frozen.workingCopy.rows, BF = 1 - Number(frozen.workingCopy.mudWeight) / 65.5, MD = Number(frozen.workingCopy.drillpipeReferenceBitMdFt);
  const fixed = rows.reduce((s, row) => s + Number(row.length || 0), 0);
  let weight = 0, jarBelow = 0, x = 0, neutral = null;
  rows.forEach(row => {
    const L = row.length === '' ? MD - fixed : Number(row.length), w = Number(row.weight) * BF;
    if (row.category === 'JAR') jarBelow = weight + w * L / 2;
    if (neutral === null && weight <= 33000 && weight + w * L >= 33000) neutral = x + (33000 - weight) / w;
    weight += L * w; x += L;
  });
  const primary = oesReference.cases.find(c => c.wobLbf === 33000);
  near(weight, oesReference.totalBuoyedWeightLbf, 1e-8, 0); near(weight - 33000, primary.surfaceHookloadLbf, 1e-8, 0);
  near(33000 - jarBelow, primary.jarAxialForceLbf, 1e-8, 0); near(weight - jarBelow - 40000, oesReference.jar.requiredSurfaceHookloadLbf, 1e-8, 0);
  near(neutral, primary.neutralPoint.fromBitFt, 1e-9, 0); near(x, MD, 1e-9, 0);
});
test('invalid, unsupported, incomplete and failed convergence suppress all metrics', () => {
  for (const change of [{ hammerMassKg: 0 }, { strokeM: -1 }, { staticProfile: [] }, { mechanism: 'hydraulic' }, { equilibrium: { kind: 'arbitrary-profile', axialForceN: 1 } },
    { upper: null, equilibrium: { kind: 'uniform-self-equilibrated', axialForceN: 1 } }]) { const r = simulateTwoSidedJarImpact(base(change)); expect(r.valid).toBe(false); expect(r.metrics).toBeNull(); }
  const incomplete = simulateTwoSidedJarImpact(base({ numerical: { maxSteps: 2 } })); expect(incomplete.status).toBe('incomplete-simulation'); expect(incomplete.metrics).toBeNull();
  const energy = simulateTwoSidedJarImpact(base({ numerical: { timeStepS: 4e-6, energyRelativeTolerance: 1e-14 } })); expect(energy.status).toBe('energy-accounting-failure'); expect(energy.metrics).toBeNull();
  const nonconverged = simulateTwoSidedJarImpact(base({ convergence: { forceAbsoluteN: 1e-14, relative: 1e-14, impulseAbsoluteNs: 1e-14, eventTimeS: 1e-14 } })); expect(nonconverged.status).toBe('numerical-nonconvergence'); expect(nonconverged.metrics).toBeNull();
});
afterAll(() => {
  if (process.env.STAGE6D3C_EVIDENCE === '1') {
    const fs = require('fs'); fs.writeFileSync('docs/ValidationStudies/TwoSidedJarStage6D3C/verification.json', JSON.stringify({ records, comparisons, convergence }, null, 2));
    fs.writeFileSync('docs/ValidationStudies/TwoSidedJarStage6D3C/traces.json', JSON.stringify(traces));
  }
});
