import { simulateCoupledJarImpact } from './coupledJarImpact';
import { simulateNonUniformAxialWave } from './nonUniformAxialWave';
import independent from '../../../docs/ValidationStudies/CoupledJarImpactStage6D3B/independent.json';

// Predetermined tolerances; no expected values come from the coupled/network API.
const section = (id = 'rod', lengthM = 10, factor = 1) => ({ id, kind: 'uniform-elastic', lengthM, areaM2: 2.5e-5 * factor, densityKgM3: 8000, youngsModulusPa: 200e9 });
const base = overrides => ({ model: 'research-coupled-linear-contact', units: 'SI', equilibrium: 'zero-preload', direction: 'down',
  hammerMassKg: 1, contactStiffnessNm: 1e6, initialHammerVelocityMS: 1, initialContact: { gapM: 0, compressionM: 0 },
  anvil: 'rod', sections: [section()], rightBoundary: 'matched', durationS: .004, numerical: { timeStepS: 1e-6 }, ...overrides });
const analytical = (t, M = 1, V = 1, k = 1e6, Z = 1000) => {
  const a = k / (2 * Z), w = Math.sqrt(k / M - a * a);
  return { force: k * V / w * Math.exp(-a * t) * Math.sin(w * t),
    velocity: V * Math.exp(-a * t) * (Math.cos(w * t) + a / w * Math.sin(w * t)), separation: Math.PI / w };
};
const records = [], convergence = [], examples = [], comparisons = [], traces = [];
function valid(r) { expect({ status: r.status, error: r.error }).toEqual({ status: 'valid-research-result', error: '' }); }
function near(a, b, abs = 1e-3, rel = 2e-5) { comparisons.push({ test: expect.getState().currentTestName, actual: a, independent: b, absoluteDifference: Math.abs(a - b), relativeDifference: b ? Math.abs((a - b) / b) : null, limit: abs + rel * Math.abs(b) }); expect(Math.abs(a - b)).toBeLessThanOrEqual(abs + rel * Math.abs(b)); }
function record(name, r) { records.push({ name, status: r.status, numerical: r.numerical, metrics: r.metrics, events: r.contactEvents, lastState: r.histories.at(-1) });
  if (['wall', 'semi-infinite', 'recontact 0.000001'].includes(name)) traces.push({ name, history: r.histories.filter((_, i) => i % 10 === 0),
    interfaces: r.interfaces.filter((_, i) => i % 10 === 0), energy: r.energy.filter((_, i) => i % 10 === 0) }); }

test('1: rigid wall, exact force, energy, rebound and impulse', () => {
  const r = simulateCoupledJarImpact(base({ anvil: 'rigid-wall', sections: [], rightBoundary: undefined })); valid(r);
  for (const h of r.histories.filter((_, i) => i % 97 === 0)) {
    near(h.contactForceN, h.timeS < Math.PI / 1000 ? 1000 * Math.sin(1000 * h.timeS) : 0);
    expect(h.compressionM).toBeGreaterThanOrEqual(0);
  }
  near(r.contactEvents.find(e => e.type === 'separation').timeS, Math.PI / 1000, 1e-8, 0);
  near(r.histories.at(-1).hammerVelocityMS, -1, 1e-8, 0); near(r.metrics.contactImpulseNs, 2, 1e-8, 0);
  expect(r.numerical.maxEnergyResidualJ).toBeLessThan(1e-9); record('wall', r);
});
test('2,8: semi-infinite rod closed form, momentum and wave energy', () => {
  const r = simulateCoupledJarImpact(base()); valid(r);
  for (const h of r.histories.filter((_, i) => i % 137 === 0 && i * 1e-6 < .0035)) {
    const a = analytical(h.timeS); near(h.contactForceN, a.force); near(h.hammerVelocityMS, a.velocity, 2e-6, 0);
  }
  near(r.contactEvents.find(e => e.type === 'separation').timeS, analytical(0).separation, 1e-8, 0);
  near(r.histories.at(-1).hammerVelocityMS, -Math.exp(-Math.PI / Math.sqrt(3)), 2e-7, 0);
  record('semi-infinite', r);
});
test('3: finite rod before first return, fixed doubling, interior probe', () => {
  const r = simulateCoupledJarImpact(base({ rightBoundary: 'fixed', durationS: .0038, probes: [{ id: 'mid', sectionId: 'rod', positionM: 5 }] })); valid(r);
  for (const row of r.interfaces.filter((_, i) => i % 191 === 0)) {
    const expected = row.timeS <= .002 ? 0 : 2 * analytical(row.timeS - .002).force;
    near(row.nodes[1].forceN, expected);
  }
  expect(r.probes.some(row => row.probes[0].forceN > 0)).toBe(true); record('finite before return', r);
});
test('4: finite isolated anvil collision and separation', () => {
  const r = simulateCoupledJarImpact(base({ anvil: 'finite-mass', anvilMassKg: 3, sections: [], rightBoundary: undefined })); valid(r);
  near(r.histories.at(-1).hammerVelocityMS, -.5, 1e-8, 0); near(r.histories.at(-1).anvilVelocityMS, .5, 1e-8, 0);
  near(r.metrics.contactImpulseNs, 1.5, 1e-8, 0); record('two finite masses', r);
});
test.each([[1 / 3, 2], [-1 / 3, .5], [1, null], [-1, null]])('5,10: independently calculated first-return reference r=%s', (r, factor) => {
  // Stage 6D.3A convolution values, unchanged; a separate high-precision
  // reference is also generated under docs, without solver imports.
  const ref = independent.references.find(row => row.r === r);
  const out = simulateCoupledJarImpact(base({ sections: factor ? [section('first', 1), section('second', 10, factor)] : [section('first', 1)],
    rightBoundary: factor ? 'matched' : r > 0 ? 'fixed' : 'free', durationS: .0008, numerical: { timeStepS: 1e-7 } })); valid(out);
  const last = out.histories.at(-1); near(last.contactForceN, Number(ref.forceN), 1e-6, 1e-8); near(last.hammerVelocityMS, Number(ref.velocityMS), 1e-9, 1e-8); record(`first return ${r}`, out);
});
test('6: equal-impedance subdivision, incommensurate delays', () => {
  const one = simulateCoupledJarImpact(base({ sections: [section('one', 1.013)], rightBoundary: 'fixed', durationS: .002 }));
  const many = simulateCoupledJarImpact(base({ sections: [section('a', .337), section('b', .676)], rightBoundary: 'fixed', durationS: .002 }));
  valid(one); valid(many); near(one.metrics.maximumContactForceN, many.metrics.maximumContactForceN, .02, 0);
  near(one.histories.at(-1).hammerVelocityMS, many.histories.at(-1).hammerVelocityMS, 2e-5, 0); record('subdivided noninteger delays', many);
});
test('7: true zero excitation, no artificial contact or separation', () => {
  const r = simulateCoupledJarImpact(base({ initialHammerVelocityMS: 0 })); valid(r);
  expect(r.metrics.maximumContactForceN).toBe(0); expect(r.contactEvents).toEqual([]); expect(r.numerical.maxEnergyResidualJ).toBe(0); record('zero', r);
});
test.each([[.5, 1, 1e6], [2, 1, 1e6], [1, .5, 1e6], [1, 2, 1e6], [1, 1, .5e6], [1, 1, 2e6]])('9: physical sensitivity M=%s V=%s k=%s', (M, V, k) => {
  const a = analytical(0, M, V, k), r = simulateCoupledJarImpact(base({ hammerMassKg: M, initialHammerVelocityMS: V, contactStiffnessNm: k, durationS: a.separation + .0001 })); valid(r);
  const w = Math.sqrt(k / M - (k / 2000) ** 2), tp = Math.atan(w / (k / 2000)) / w;
  near(r.metrics.maximumContactForceN, analytical(tp, M, V, k).force); record(`sensitivity ${M}/${V}/${k}`, r);
});
test('resolution convergence includes energy, impulse, peak, events and noninteger delays', () => {
  for (const h of [8e-6, 4e-6, 2e-6, 1e-6]) {
    const r = simulateCoupledJarImpact(base({ sections: [section('a', 1.013), section('b', .733, 2), section('c', 1.127, .6)], rightBoundary: 'fixed', durationS: .008,
      numerical: { timeStepS: h, energyRelativeTolerance: .002, momentumRelativeTolerance: .002 } })); valid(r);
    const expectedArrivalS = (1.013 + .733 + 1.127) / 5000;
    const firstArrivalS = r.interfaces.find(row => row.nodes.at(-1).forceN !== 0)?.timeS;
    const firstReflectedSampleS = r.reflectedWaveSamples.find(row => row.incomingUpForceN !== 0)?.timeS;
    expect(Math.abs(firstArrivalS - expectedArrivalS)).toBeLessThanOrEqual(3 * h);
    convergence.push({ h, ...r.numerical, ...r.metrics, events: r.contactEvents, firstArrivalS, expectedArrivalS,
      arrivalErrorS: Math.abs(firstArrivalS - expectedArrivalS), firstReflectedSampleS,
      finalHammerVelocityMS: r.histories.at(-1).hammerVelocityMS });
  }
  expect(convergence.at(-1).maxEnergyResidualJ).toBeLessThan(convergence[0].maxEnergyResidualJ / 8);
  expect(convergence.at(-1).maxEnergyResidualJ).toBeLessThan(1e-5);
});
test('genuine recontact and gap closure remain stable under refinement', () => {
  const sequences = [];
  for (const h of [2e-6, 1e-6]) {
    const r = simulateCoupledJarImpact(base({ sections: [section('finite', 10)], rightBoundary: 'fixed', durationS: .02, numerical: { timeStepS: h, energyRelativeTolerance: .001 } }));
    valid(r); record(`recontact ${h}`, r);
    expect(r.histories.every(x => x.contactForceN >= 0 && x.compressionM >= 0 && x.gapM >= 0)).toBe(true);
    expect(r.contactEvents.filter(e => e.type === 'recontact').length).toBeGreaterThan(0);
    sequences.push(r.contactEvents.filter(e => ['contact', 'separation', 'recontact'].includes(e.type)));
    expect(r.metrics.primaryStuckImpulse.status).toBe('determinate-first-contact-pulse');
    near(r.metrics.primaryStuckImpulse.signedImpulseNs, 2 * (1 + Math.exp(-Math.PI / Math.sqrt(3))), 2e-5, 0);
  }
  expect(sequences[0].map(e => e.type)).toEqual(sequences[1].map(e => e.type));
  sequences[0].forEach((e, i) => near(e.timeS, sequences[1][i].timeS, 5e-8, 0));
});
test('idealised tubular research examples, not manufacturer tool models', () => {
  const definitions = [ ['uniform collars', [1]], ['different collars', [1, 2]], ['collar to uniform HWDP body', [2, .8]],
    ['uniform HWDP body to drillpipe body', [.8, .4]], ['crossovers and multiple changes', [2, .7, 1.4, .4]] ];
  for (const [name, factors] of definitions) {
    const r = simulateCoupledJarImpact(base({ sections: factors.map((f, i) => section(String(i), .731 + i * .213, f)), rightBoundary: 'fixed', durationS: .006,
      numerical: { timeStepS: 1e-6, energyRelativeTolerance: .0001 } })); valid(r);
    examples.push({ name, hypothetical: true, metrics: r.metrics, numerical: r.numerical });
  }
});
test('up/down signs, isolated initial gap and spring storage', () => {
  const down = simulateCoupledJarImpact(base()), up = simulateCoupledJarImpact(base({ direction: 'up', initialHammerVelocityMS: -1 })); valid(up);
  near(up.metrics.maximumContactForceN, down.metrics.maximumContactForceN, 1e-9, 0);
  expect(up.histories[100].signedStringForceN).toBeLessThan(0);
  const g = simulateCoupledJarImpact(base({ anvil: 'rigid-wall', sections: [], rightBoundary: undefined, initialContact: { gapM: .001, compressionM: 0 } })); valid(g);
  near(g.contactEvents.find(e => e.type === 'contact').timeS, .001, 2e-9, 0);
  const s = simulateCoupledJarImpact(base({ anvil: 'rigid-wall', sections: [], rightBoundary: undefined, initialHammerVelocityMS: 0, initialContact: { gapM: 0, compressionM: .001 } })); valid(s);
  expect(s.energy[0].initialEnergyJ).toBe(.5);
});
test('invalid/unsupported, computational limit and conservation failure suppress metrics', () => {
  for (const changes of [{ hammerMassKg: 0 }, { contactStiffnessNm: NaN }, { equilibrium: 'prestressed' }, { staticPreloadN: 1 }, { damping: 0 }, { upperSections: [] }, { sections: [section('a', -1)] }]) {
    const r = simulateCoupledJarImpact(base(changes)); expect(r.valid).toBe(false); expect(r.metrics).toBeNull();
  }
  const limited = simulateCoupledJarImpact(base({ numerical: { timeStepS: 1e-6, maxSteps: 10 } }));
  expect(limited.status).toBe('incomplete-simulation'); expect(limited.metrics).toBeNull();
  const stiff = simulateCoupledJarImpact(base({ numerical: { timeStepS: .001 } })); expect(stiff.status).toBe('numerical-nonconvergence');
  const energy = simulateCoupledJarImpact(base({ numerical: { timeStepS: 8e-6, energyRelativeTolerance: 1e-12 } }));
  expect(energy.status).toBe('energy-accounting-failure'); expect(energy.metrics).toBeNull();
});
test('original exact-event Stage 6D.2 API remains available unchanged', () => {
  const r = simulateNonUniformAxialWave({ model: 'research-linear-axial-waves', units: 'SI', sections: [section()], durationS: .001,
    boundaries: { left: 'free', right: 'fixed' }, initialWaves: [] }); expect(r.valid).toBe(true);
});
test('Skeem restricted wave timing comparison, no tuned contact equivalence', () => {
  const r = simulateCoupledJarImpact(base({ direction: 'up', initialHammerVelocityMS: -53 / 2700,
    sections: [section('collar', 20, 80)], rightBoundary: 'fixed', durationS: .0075 })); valid(r);
  near(r.sections[0].impedanceNsM, 80000, 1e-9, 0);
  expect(r.interfaces.filter(x => x.timeS < .004).every(x => x.nodes[1].forceN === 0)).toBe(true);
  expect(r.metrics.primaryStuckImpulse.status).toBe('determinate-first-contact-pulse');
  // Equal prescribed collision velocity and lower travel time do not identify a
  // finite M/k collision with the existing distributed Skeem engagement model.
  expect(r.metrics.maximumContactForceN).toBeLessThan(21200 / 27 / 10); record('Skeem propagation comparison only', r);
});
test('very short sections, extreme ratios, many sections and explicit budgets', () => {
  for (const factors of [[.01, 100], Array.from({ length: 30 }, (_, i) => i % 2 ? 1.1 : .9)]) {
    const r = simulateCoupledJarImpact(base({ sections: factors.map((factor, i) => section(String(i), .0007 + .0001 * i, factor)), durationS: .00001,
      numerical: { timeStepS: 1e-8, energyRelativeTolerance: .001, momentumRelativeTolerance: .001 } }));
    valid(r); expect(r.histories.every(x => Number.isFinite(x.contactForceN))).toBe(true);
  }
});
afterAll(() => {
  // Evidence only; test expectations above are fixed and never read this output.
  if (process.env.STAGE6D3B_EVIDENCE === '1') {
    const fs = require('fs');
    fs.writeFileSync('docs/ValidationStudies/CoupledJarImpactStage6D3B/verification.json', JSON.stringify({ tolerances: { forceN: .001, relative: 2e-5, velocityMS: 2e-6, eventTimeS: 1e-8, refinedFirstReturn: 'Stage 6D.3A absolute + 1e-8 relative' }, records, convergence, examples, comparisons }, null, 2));
    fs.writeFileSync('docs/ValidationStudies/CoupledJarImpactStage6D3B/traces.json', JSON.stringify(traces));
  }
});
