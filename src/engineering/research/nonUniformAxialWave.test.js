/* eslint-env es2020 */
// Research-specific tests. Expected values never come from a production JarFrame solver.
import fs from 'fs';
import path from 'path';
import { simulateNonUniformAxialWave as simulate } from './nonUniformAxialWave';
import benchmark from '../../../docs/ValidationStudies/NonUniformJarDynamicsStage6D1/benchmarks.v1.json';
import { q, slabPaths } from '../../../docs/ValidationStudies/NonUniformJarDynamicsStage6D1/reference.cjs';

const directory = path.join(process.cwd(), 'docs/ValidationStudies/NonUniformAxialWaveStage6D2');
const comparisons = [], cases = [], performance = [], convergence = [], histories = [];
// Fixed before execution: same analytical tolerance basis as Stage 6D.1.
const tolerance = { forceN: 1e-9, velocityMS: 1e-12, timeS: 1e-12, energyJ: 1e-12, relative: 1e-12 };
const section = (id, lengthM = 10, areaM2 = .001, material = {}) => ({ id, kind: 'uniform-elastic', lengthM, areaM2, densityKgM3: 8000, youngsModulusPa: 200e9, ...material });
const source = (boundary = 'left', forceN = 400, start = 0, end = .0001) => ({ boundary, history: [{ timeS: start, forceN }, { timeS: end, forceN: 0 }] });
const input = (sections = [section('one')], patch = {}) => ({ model: 'research-linear-axial-waves', units: 'SI', sections, durationS: .006, boundaries: { left: 'matched', right: 'matched' }, initialWaves: [], boundaryExcitations: [source()], ...patch });
function compare(name, actual, expected, absolute = tolerance.forceN, unit = 'N') {
  expected = typeof expected === 'string' ? q(expected).value() : expected;
  const difference = Math.abs(actual - expected), limit = absolute + tolerance.relative * Math.abs(expected), status = Number.isFinite(actual) && difference <= limit ? 'PASS' : 'FAIL';
  comparisons.push({ name, actual, independent: expected, absoluteDifference: difference, tolerance: limit, unit, status });
  expect({ name, actual, expected, status }).toMatchObject({ status: 'PASS' });
}
const at = (history, t) => history.filter(h => h.timeS <= t).slice(-1)[0];
function run(id, request, requireValid = true) {
  const start = Date.now(), result = simulate(request); performance.push({ id, elapsedMs: Date.now() - start, sections: request.sections.length, events: result.numerical?.processedEvents, status: result.status });
  cases.push({ id, input: request, status: result.status, numerical: result.numerical, energy: result.energy });
  if (['A-uniform', 'D-three-section', 'G-closed-initial-wave', 'G-simultaneous'].includes(id)) histories.push({ id, probes: result.probes, interfaces: result.interfaces, arrivalEvents: result.arrivalEvents, energy: result.energy });
  expect(result.researchOnly).toBe(true); expect(result.productionAvailable).toBe(false);
  expect(requireValid ? result.valid : true).toBe(true);
  return result;
}
afterAll(() => {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'verification.json'), JSON.stringify({ notice: 'PRELIMINARY — NOT FOR OPERATIONAL USE', tolerance, comparisons, cases, convergence, performance, histories }, null, 2) + '\n');
});

test('A: uniform pulse propagation, velocity and energy match frozen analytical values', () => {
  const result = run('A-uniform', input(undefined, { probes: [{ id: 'end', sectionId: 'one', positionM: 10 }], energyTimesS: [.001, .00205, .004] }));
  const pulse = result.probes[0].history.find(h => h.forceN > 0);
  compare('A first arrival', pulse.timeS, benchmark.uniform.oneWayS, tolerance.timeS, 's');
  compare('A force', pulse.forceN, 400); compare('A particle velocity', pulse.velocityMS, '.01', tolerance.velocityMS, 'm/s');
  compare('A speed', result.sections[0].waveSpeedMS, 5000, 1e-9, 'm/s');
  compare('A input energy', result.energy.slice(-1)[0].injectedJ, benchmark.uniform.energyJ, tolerance.energyJ, 'J');
  result.energy.forEach(e => compare(`A energy residual ${e.timeS}`, e.residualJ, 0, tolerance.energyJ, 'J'));
});

test.each(benchmark.interfaces)('B/C/G: $id interface, directions, signs and flux', fixture => {
  const areas = [fixture.leftZ / 40000000, fixture.rightZ / 40000000];
  for (const direction of ['left', 'right']) for (const sign of [-1, 1]) {
    const request = input([section('left', 5, areas[0]), section('right', 5, areas[1])], { durationS: .0015, boundaryExcitations: [source(direction, 400 * sign)] });
    const result = run(`${fixture.id}-${direction}-${sign}`, request), node = result.interfaces[1].history.find(h => Math.abs(h.forceN) > 1);
    const reflected = direction === 'left' ? node.outgoingUpN : node.outgoingDownN, transmitted = direction === 'left' ? node.outgoingDownN : node.outgoingUpN;
    const R = q(fixture.rForce).value() * (direction === 'left' ? 1 : -1), T = direction === 'left' ? q(fixture.tForce).value() : 2 - q(fixture.tForce).value();
    compare(`${fixture.id} ${direction} ${sign} reflection`, reflected, 400 * sign * R);
    compare(`${fixture.id} ${direction} ${sign} transmission`, transmitted, 400 * sign * T);
    compare(`${fixture.id} ${direction} ${sign} arrival`, node.timeS, .001, tolerance.timeS, 's');
    compare(`${fixture.id} ${direction} ${sign} flux`, node.powerResidualW, 0, tolerance.energyJ, 'W');
    compare(`${fixture.id} ${direction} ${sign} velocity continuity`, node.velocityMS, (node.outgoingDownN - node.incomingUpN) / fixture.rightZ, tolerance.velocityMS, 'm/s');
  }
  if (fixture.id === 'equal') {
    const differentSpeed = run('equal-Z-unequal-speed', input([section('fast', 5), section('slow', 5, .002, { youngsModulusPa: 50e9 })], { durationS: .004 }));
    compare('Equal Z unequal c no reflection', differentSpeed.interfaces[1].history[0].outgoingUpN, 0);
    compare('Equal Z unequal c transmitted amplitude', differentSpeed.interfaces[2].history[0].incomingDownN, 400);
    compare('Equal Z unequal c accumulated arrival', differentSpeed.interfaces[2].history[0].timeS, .003, tolerance.timeS, 's');
  }
});

test('D: three-section echoes and amplitudes agree with independent exact path tree', () => {
  const result = run('D-three-section', input([section('left', 5), section('slab', 5, .002), section('right', 50)], { durationS: .008 }));
  const expected = slabPaths(benchmark.threeSection);
  expected.transmitted.forEach((e, i) => {
    const time = .001 + e.time.value(), row = at(result.interfaces[2].history, time + .00001);
    compare(`D transmitted echo ${i}`, row.outgoingDownN, e.force.value());
    const arrival = result.interfaces[2].history.find(h => Math.abs(h.timeS - time) < 1e-10);
    compare(`D transmitted time ${i}`, arrival.timeS, time, tolerance.timeS, 's');
  });
  expected.reflected.forEach((e, i) => compare(`D reflected echo ${i}`, at(result.interfaces[1].history, .001 + e.time.value() + .00001).outgoingUpN, e.force.value()));
  result.energy.forEach(e => compare(`D remaining plus escaped energy ${e.timeS}`, e.residualJ, 0, tolerance.energyJ, 'J'));
});

test.each(['free', 'fixed'])('E/F: %s reflection at both ends', boundary => {
  for (const end of ['left', 'right']) {
    const other = end === 'left' ? 'right' : 'left', boundaries = { [end]: boundary, [other]: 'matched' };
    const result = run(`${boundary}-${end}`, input(undefined, { boundaries, boundaryExcitations: [source(other)], durationS: .005 })), node = result.interfaces[end === 'left' ? 0 : 1].history.find(h => Math.abs(h.incomingDownN || h.incomingUpN) > 1);
    compare(`${boundary}-${end} reflection`, node.outgoingN, benchmark.endReflections[boundary].reflectedN);
    compare(`${boundary}-${end} force`, node.forceN, benchmark.endReflections[boundary].endForceN);
    compare(`${boundary}-${end} velocity`, node.velocityMS, boundary === 'fixed' ? 0 : (end === 'right' ? .02 : -.02), tolerance.velocityMS, 'm/s');
    compare(`${boundary}-${end} return energy`, result.energy.slice(-1)[0].escapedJ, .0004, tolerance.energyJ, 'J');
  }
});

test('G: finite free/fixed system retains energy over many reflections', () => {
  const result = run('G-closed-initial-wave', input(undefined, { durationS: .1, boundaries: { left: 'fixed', right: 'free' }, boundaryExcitations: [], initialWaves: [{ sectionId: 'one', direction: 'down', fromM: 2, toM: 2.5, forceN: 400 }], energyTimesS: [0, .0002, .00157, .0024, .01, .05, .1] }));
  result.energy.forEach(e => { compare(`G closed stored ${e.timeS}`, e.physicalStoredJ, .0004, tolerance.energyJ, 'J'); compare(`G closed residual ${e.timeS}`, e.residualJ, 0, tolerance.energyJ, 'J'); });
  expect(result.numerical.processedEvents).toBeGreaterThan(50);
});

test('G: overlapping prescribed inputs conserve energy and superpose linearly', () => {
  const both = input([section('l', 5), section('r', 5, .002)], { durationS: .0015, boundaryExcitations: [source('left', 400), source('right', -250)], probes: [{ id: 'joint', sectionId: 'l', positionM: 5 }] });
  const a = run('G-superposition-left', { ...both, boundaryExcitations: [source('left', 400)] }), b = run('G-superposition-right', { ...both, boundaryExcitations: [source('right', -250)] }), combined = run('G-simultaneous', both);
  for (const t of [.00101, .00111]) { compare(`G superposition force ${t}`, at(combined.probes[0].history, t).forceN, at(a.probes[0].history, t).forceN + at(b.probes[0].history, t).forceN); compare(`G superposition velocity ${t}`, at(combined.probes[0].history, t).velocityMS, at(a.probes[0].history, t).velocityMS + at(b.probes[0].history, t).velocityMS, tolerance.velocityMS, 'm/s'); }
  combined.energy.forEach(e => compare(`G overlap energy ${e.timeS}`, e.residualJ, 0, tolerance.energyJ, 'J'));
  // A purely mathematical time-ordering stress test: distinct fronts one input ULP apart.
  const start = .001, width = 2 ** -62, narrowInput = input(undefined, { durationS: .004, boundaryExcitations: [source('left', 400, start, start + width)], energyTimesS: [.0015], numerical: { energyAbsoluteToleranceJ: 1e-28 } });
  const before = JSON.stringify(narrowInput), narrow = run('G-distinct-near-arrivals', narrowInput);
  const fronts = narrow.interfaces[1].history;
  expect(fronts).toHaveLength(2); expect(fronts[0].exactTick).not.toBe(fronts[1].exactTick);
  compare('G one-ULP pulse energy retained', narrow.energy.slice(-1)[0].escapedJ, 4 * width, 1e-28, 'J');
  expect(simulate(narrowInput)).toEqual(narrow); expect(JSON.stringify(narrowInput)).toBe(before);
});

test('H: uniform rod subdivision changes no observable amplitudes or delays', () => {
  const reference = run('H-unsplit', input(undefined, { boundaries: { left: 'matched', right: 'fixed' } }));
  for (const n of [2, 7, 64, 256]) {
    const result = run(`H-split-${n}`, input(Array.from({ length: n }, (_, i) => section(`s${i}`, 10 / n)), { boundaries: { left: 'matched', right: 'fixed' } }));
    const actual = result.interfaces[n].history.find(h => h.forceN > 1), expected = reference.interfaces[1].history.find(h => h.forceN > 1);
    compare(`H ${n} peak`, actual.forceN, expected.forceN); compare(`H ${n} arrival`, actual.timeS, expected.timeS, tolerance.timeS, 's');
    compare(`H ${n} energy`, result.energy.slice(-1)[0].escapedJ, .0004, tolerance.energyJ, 'J');
  }
});

test('H: Skeem propagation coefficient and free-hammer return increment, without impact', () => {
  const F0 = 800, result = run('H-Skeem-propagation-only', input([section('pipe', 50), section('collar', 5, .002)], { durationS: .0025, boundaries: { left: 'matched', right: 'free' }, boundaryExcitations: [], initialWaves: [{ sectionId: 'collar', direction: 'up', fromM: 0, toM: 5, forceN: F0 }] }));
  const first = result.interfaces[1].history[0]; compare('Skeem force reflection = -lambda', first.reflectedFromUpN / F0, -1 / 3, 1e-12, '1');
  const hammer = at(result.interfaces[2].history, .00101);
  compare('Skeem doubled return velocity increment magnitude', Math.abs(hammer.velocityMS), 2 * F0 / 80000 / 3, tolerance.velocityMS, 'm/s');
});

test.each([
  ['missing sections', x => ({ ...x, sections: [] })],
  ['negative E', x => ({ ...x, sections: [section('x', 1, .001, { youngsModulusPa: -1 })] })],
  ['zero length', x => ({ ...x, sections: [section('x', 0)] })],
  ['negative area', x => ({ ...x, sections: [section('x', 1, -.001)] })],
  ['infinite material', x => ({ ...x, sections: [section('x', 1, .001, { densityKgM3: Infinity })] })],
  ['nonfinite excitation', x => ({ ...x, boundaryExcitations: [source('left', NaN)] })],
  ['duplicate probe', x => ({ ...x, probes: [{ id: 'p', sectionId: 'one', positionM: 1 }, { id: 'p', sectionId: 'one', positionM: 2 }] })],
  ['unrepresentable material', x => ({ ...x, sections: [section('x', 1, 1e308)] })],
  ['zero density', x => ({ ...x, sections: [section('x', 1, .001, { densityKgM3: 0 })] })],
  ['speed conflict', x => ({ ...x, sections: [section('x', 1, .001, { waveSpeedMS: 16000 })] })],
  ['impedance conflict', x => ({ ...x, sections: [section('x', 1, .001, { impedanceNsM: 1 })] })],
  ['complex tool', x => ({ ...x, sections: [section('x', 1, .001, { effectiveProperties: {} })] })],
  ['duplicate id', x => ({ ...x, sections: [section('x'), section('x')] })],
  ['arbitrary reflection', x => ({ ...x, boundaries: { left: '.5', right: 'fixed' } })],
  ['jar impact', x => ({ ...x, contact: {} })],
  ['negative duration', x => ({ ...x, durationS: -1 })],
  ['bad resolution', x => ({ ...x, numerical: { delayPrecisionBits: 4 } })],
  ['unsorted excitation', x => ({ ...x, boundaryExcitations: [{ boundary: 'left', history: [{ timeS: .001, forceN: 1 }, { timeS: 0, forceN: 0 }] }] })]
])('Robustness rejects %s', (id, change) => {
  const result = simulate(change(input())); expect(result.valid).toBe(false); expect(result.status).toBe('invalid-input'); expect(result.complete).toBe(false);
});

test('computational limits return explicitly incomplete histories', () => {
  const result = run('event-limit', input(undefined, { boundaries: { left: 'fixed', right: 'free' }, boundaryExcitations: [], durationS: 100, initialWaves: [{ sectionId: 'one', direction: 'down', fromM: 2, toM: 2.5, forceN: 400 }], numerical: { maxEvents: 10 } }), false);
  expect(result.valid).toBe(false); expect(result.complete).toBe(false); expect(result.status).toBe('incomplete'); expect(result.completedThroughS).toBeLessThan(100);
});

// High-precision independent square root via integer Newton iteration (36 decimal places).
function sqrtRatio(numerator, denominator) {
  const scale = 10n ** 36n, value = BigInt(numerator) * scale * scale / BigInt(denominator);
  let x = value, next = (x + 1n) / 2n;
  while (next < x) { x = next; next = (x + value / x) / 2n; }
  return q(`${x}/${scale}`);
}
test('Convergence: unequal, incommensurate delays, repeated echoes and physical energy', () => {
  const material = { densityKgM3: 8500, youngsModulusPa: 190e9 };
  const sections = [section('left', Math.SQRT2), section('middle', Math.PI, .002, material), section('right', 20)];
  const speed = sqrtRatio(190000000000, 8500), tau1 = q(String(Math.SQRT2)).div(5000), tau2 = q(String(Math.PI)).div(speed);
  // Last of three right-going echoes: direct left delay + five middle transits.
  const expectedTime = tau1.add(tau2.mul(5)).value();
  const Z1 = 40000, Z2 = q('.002').mul(8500).mul(speed).value(), expectedForce = 400 * (2 * Z2 / (Z1 + Z2)) * (2 * Z1 / (Z1 + Z2)) * ((Z1 - Z2) / (Z1 + Z2)) ** 4;
  const rows = [];
  for (const bits of [16, 24, 36, 53]) {
    const result = run(`convergence-${bits}`, input(sections, { durationS: .007, numerical: { delayPrecisionBits: bits }, energyTimesS: [.0003, .0009, .002, .004, .0065] }), false);
    expect(result.complete).toBe(true);
    const approximate = result.sections[0].delayS + 5 * result.sections[1].delayS;
    const event = result.interfaces[2].history.find(h => Math.abs(h.timeS - approximate) < 1e-10 && h.outgoingDownN > 1);
    const error = Math.abs(event.timeS - expectedTime), bound = Math.abs(result.sections[0].delayErrorS) + 5 * Math.abs(result.sections[1].delayErrorS);
    compare(`convergence ${bits} time bound`, error, 0, bound + 1e-15, 's');
    compare(`convergence ${bits} echo amplitude`, event.outgoingDownN, expectedForce);
    const independentPeak = 400 * (2 * Z2 / (Z1 + Z2)) * (2 * Z1 / (Z1 + Z2));
    const peak = Math.max(...result.interfaces[2].history.map(h => h.forceN));
    const firstInterface = result.interfaces[1].history.find(h => h.incomingDownN > 1);
    const transmission = firstInterface.transmittedFromDownN / firstInterface.incomingDownN, independentTransmission = 2 * Z2 / (Z1 + Z2);
    compare(`convergence ${bits} peak force`, peak, independentPeak);
    compare(`convergence ${bits} transmission coefficient`, transmission, independentTransmission, 1e-12, '1');
    const energyError = Math.max(...result.energy.map(e => Math.abs(e.residualJ))), delayEnergyError = Math.max(...result.energy.map(e => Math.abs(e.delayResidualJ)));
    const maxRelativeDelayError = Math.max(...result.sections.map(sec => Math.abs(sec.delayErrorS / sec.delayS)));
    const available = Math.max(...result.energy.map(e => e.initialPhysicalJ + e.injectedJ));
    compare(`convergence ${bits} physical energy bound`, energyError, 0, 2 * maxRelativeDelayError * available + tolerance.energyJ, 'J');
    compare(`convergence ${bits} lossless delay-line energy`, delayEnergyError, 0, tolerance.energyJ, 'J');
    const row = { bits, arrivalTimeS: event.timeS, independentTimeS: expectedTime, arrivalErrorS: error, pathQuantizationBoundS: bound, echoForceN: event.outgoingDownN, independentForceN: expectedForce, forceErrorN: Math.abs(event.outgoingDownN - expectedForce), peakForceN: peak, peakErrorN: Math.abs(peak - independentPeak), transmissionError: Math.abs(transmission - independentTransmission), energyErrorJ: energyError, delayEnergyErrorJ: delayEnergyError, status: result.status, events: result.numerical.processedEvents };
    rows.push(row); convergence.push(row);
  }
  expect(rows[3].arrivalErrorS).toBeLessThan(tolerance.timeS); expect(rows[3].energyErrorJ).toBeLessThan(tolerance.energyJ);
});

test('Robustness: extreme positive impedance ratios retain small transmissions', () => {
  const result = run('extreme-impedance-1e6', input([section('thin', 5, 1e-8), section('large', 5, .01)], { durationS: .0016, boundaryExcitations: [source('left', .1, 0, .0005)] }));
  const row = result.interfaces[1].history.find(h => h.incomingDownN > 0);
  compare('extreme reflected', row.outgoingUpN, .1 * 999999 / 1000001, 1e-15);
  compare('extreme transmitted', row.outgoingDownN, .1 * 2000000 / 1000001, 1e-15);
  const reversed = run('extreme-impedance-reversed', input([section('large', 5, .01), section('thin', 5, 1e-8)], { durationS: .0016, boundaryExcitations: [source('left', .1, 0, .0005)] }));
  compare('extreme small transmission', reversed.interfaces[1].history.find(h => h.incomingDownN > 0).outgoingDownN, .1 * 2 / 1000001, 1e-18);
});

test('Robustness: short positive delays and a bounded queue', () => {
  const result = run('short-section', input([section('short', .0001, 1e-12)], { durationS: 1e-7, boundaryExcitations: [source('left', 1e-6, 0, 2e-9)], numerical: { energyAbsoluteToleranceJ: 1e-27 } }));
  compare('short-section arrival', result.interfaces[1].history.find(h => h.incomingDownN > 0).timeS, 2e-8, 1e-20, 's');
  compare('short-section transmitted force', result.interfaces[1].history.find(h => h.incomingDownN > 0).incomingDownN, 1e-6, 1e-18);
  const limited = run('queue-limit', input(undefined, { numerical: { maxPendingEvents: 1 } }), false);
  expect(limited.valid).toBe(false); expect(limited.status).toBe('incomplete');
});

test('Idealised tubular examples use declared properties, not manufacturer or OES values', () => {
  const annulus = (od, id) => Math.PI * (od ** 2 - id ** 2) / 4;
  const collar = annulus(.1651, .07145), hwdp = annulus(.127, .0762), dp = annulus(.127, .10861);
  const examples = [
    ['uniform-collars', [section('collar', 30, collar)]],
    ['mixed-collars', [section('collar-a', 30, collar), section('collar-b', 20, annulus(.17145, .0508))]],
    ['collar-to-HWDP-body', [section('collar', 30, collar), section('HWDP-body-only', 20, hwdp)]],
    ['HWDP-body-to-DP-body', [section('HWDP-body-only', 20, hwdp), section('DP-body-only', 40, dp)]],
    ['crossovers', [section('collar-a', 15, collar), section('crossover-a', 1, annulus(.15, .06)), section('collar-b', 20, annulus(.14, .05)), section('crossover-b', .8, annulus(.13, .06)), section('collar-c', 10, collar)]],
    ['HWDP-detailed-hypothetical', [section('joint-lower', .4, annulus(.1651, .079375)), section('upset-lower', .6, annulus(.14, .0762)), section('body', 8, hwdp), section('upset-upper', .6, annulus(.14, .0762)), section('joint-upper', .4, annulus(.1651, .079375))]]
  ];
  for (const [id, sections] of examples) {
    const request = input(sections, { durationS: .025, boundaryExcitations: [source('left', 400, 0, .002)] });
    run(`idealised-${id}`, request);
  }
});

test('Overlapping initial waves include same-direction energy cross terms', () => {
  const result = run('overlapping-initial-waves', input(undefined, { durationS: .008, boundaryExcitations: [], boundaries: { left: 'fixed', right: 'free' },
    initialWaves: [{ sectionId: 'one', direction: 'down', fromM: 0, toM: 4, forceN: 400 }, { sectionId: 'one', direction: 'down', fromM: 2, toM: 6, forceN: -250 }, { sectionId: 'one', direction: 'up', fromM: 1, toM: 3, forceN: 100 }],
    probes: [{ id: 'overlap', sectionId: 'one', positionM: 2.5 }], energyTimesS: [.00001, .0005, .0025, .007] }));
  compare('Initial overlap force', result.probes[0].history[0].forceN, 250);
  compare('Initial overlap velocity', result.probes[0].history[0].velocityMS, .00125, tolerance.velocityMS, 'm/s');
  result.energy.forEach(e => compare(`Overlapping initial stored energy ${e.timeS}`, e.physicalStoredJ, .00255, tolerance.energyJ, 'J'));
});

test('Many-section mixed network remains practical without losing reflected energy', () => {
  const areas = [.001, .002, .0012, .0005];
  const result = run('64-section-mixed-network', input(Array.from({ length: 64 }, (_, i) => section(`mixed-${i}`, 1 / 16, areas[Math.floor(i / 16)])), { durationS: .002 }));
  expect(result.sections).toHaveLength(64); expect(result.numerical.processedEvents).toBeLessThan(250000);
  compare('64-section mixed energy balance', result.energy.slice(-1)[0].residualJ, 0, tolerance.energyJ, 'J');
});
