/* eslint-env es2020 */
// RESEARCH ONLY. SI, compression-positive, x down-string. No jar/contact or BHA adapter.
// See docs/ValidationStudies/NonUniformAxialWaveSolverStage6D2.md.
const NOTICE = 'PRELIMINARY — NOT FOR OPERATIONAL USE';
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const nonnegative = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const need = (ok, message) => { if (!ok) throw Error(message); };
const sum = xs => { let total = 0, correction = 0; for (const x of xs) { const y = x - correction, next = total + y; correction = (next - total) - y; total = next; } return total; };

// Additional RESEARCH port API; the established exact-event API below is unchanged.
// Continuous boundary emissions use piecewise-linear histories and exact physical
// delays. The caller must refine time steps and audit physical energy, not a
// rounded-delay energy. No prescribed source is used at the controlled port.
export function createAxialWavePortNetwork(input) {
  const prepared = prepare({ model: 'research-linear-axial-waves', units: 'SI',
    sections: input.sections, durationS: input.durationS, probes: input.probes,
    boundaries: { left: 'matched', right: input.rightBoundary } });
  const s = prepared.sections, count = s.length;
  const history = () => [{ timeS: 0, value: 0, integral: 0, square: 0 }];
  const down = s.map(history), up = s.map(history), rightForce = history(), rightIncident = history(), rightOutgoing = history(), rightVelocity = history();
  const jumps = new Heap(); let jumpCount = 0, lastArrivals = [], lastArrivalTime = -1;
  const coincident = (a, b) => Math.abs(a - b) <= 8 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  let timeS = 0, committed = false;
  function locate(h, t) {
    let lo = 0, hi = h.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (h[m].timeS <= t) lo = m + 1; else hi = m; }
    return Math.max(0, lo - 1);
  }
  function value(h, t, left = false) {
    if (t < 0) return 0;
    need(t <= timeS + 1e-14 * Math.max(1, timeS), 'Port query requires future state.');
    let i = locate(h, t);
    if (left) while (i > 0 && h[i].timeS === t) i--;
    const a = h[i], b = h[i + 1];
    return b ? a.value + (b.value - a.value) * (t - a.timeS) / (b.timeS - a.timeS) : a.value;
  }
  function append(h, t, v) {
    need(finite(v), 'Nonfinite port amplitude.');
    if (h[h.length - 1].timeS === t && t === 0) { h[0].value = v; return; }
    const a = h[h.length - 1], dt = t - a.timeS;
    h.push({ timeS: t, value: v, integral: a.integral + dt * (a.value + v) / 2,
      square: a.square + dt * (a.value * a.value + a.value * v + v * v) / 3 });
  }
  function primitive(h, t, squared) {
    if (t <= 0) return 0;
    const a = h[locate(h, t)], v = value(h, t), dt = t - a.timeS;
    return squared ? a.square + dt * (a.value * a.value + a.value * v + v * v) / 3
      : a.integral + dt * (a.value + v) / 2;
  }
  const span = (h, lo, hi, squared) => primitive(h, hi, squared) - primitive(h, lo, squared);
  const arrivalsAt = t => [...(coincident(t, lastArrivalTime) ? lastArrivals : []), ...jumps.items.filter(e => coincident(e.tick, t))];
  function incoming(t, left = false) {
    const arrival = arrivalsAt(t).find(e => e.section === 0 && e.direction === 'up');
    return arrival ? left ? arrival.before : arrival.after : value(up[0], t - s[0].exactDelayS, left);
  }
  function commit(t, contactForceN, farIncomingForceN = 0, discontinuity = false, leftContactForceN = contactForceN) {
    need(nonnegative(t) && (t > timeS || (!committed && t === 0) || (discontinuity === true && t === timeS)), 'Port times must strictly increase except explicit right-limit jumps.');
    need(finite(farIncomingForceN) && (input.rightBoundary === 'matched' || farIncomingForceN === 0), 'Far incident source requires a matched boundary.');
    need(t - timeS <= Math.min(...s.map(x => x.exactDelayS)) * (1 + 1e-12), 'Step exceeds causal section delay.');
    const arrivals = [];
    while (jumps.items.length && (jumps.items[0].tick < t || coincident(jumps.items[0].tick, t))) {
      const event = jumps.pop(); need(coincident(event.tick, t), 'Caller skipped a discontinuity arrival; split the step.'); arrivals.push(event);
    }
    const p = s.map((x, i) => value(down[i], t - x.exactDelayS)), r = s.map((x, i) => value(up[i], t - x.exactDelayS));
    const pl = [...p], rl = [...r];
    arrivals.forEach(e => { (e.direction === 'down' ? p : r)[e.section] = e.after; (e.direction === 'down' ? pl : rl)[e.section] = e.before; });
    function scatter(p, r, force) {
    const outP = [], outR = [], nodes = [{ forceN: force, velocityMS: (force - 2 * r[0]) / s[0].impedanceNsM }];
    outP[0] = force - r[0];
    for (let i = 1; i < count; i++) {
      const zl = s[i - 1].impedanceNsM, zr = s[i].impedanceNsM, scale = Math.max(zl, zr), l = zl / scale, z = zr / scale;
      const refl = (z - l) / (z + l), tr = 2 * z / (z + l), tl = 2 * l / (z + l);
      outR[i - 1] = refl * p[i - 1] + tl * r[i]; outP[i] = tr * p[i - 1] - refl * r[i];
      nodes.push({ forceN: tr * p[i - 1] + tl * r[i], velocityMS: 2 * (p[i - 1] - r[i]) / scale / (z + l) });
    }
    const reflect = input.rightBoundary === 'fixed' ? 1 : input.rightBoundary === 'free' ? -1 : 0;
    outR[count - 1] = reflect * p[count - 1] + farIncomingForceN;
    nodes.push({ forceN: p[count - 1] + outR[count - 1], velocityMS: (p[count - 1] - outR[count - 1]) / s[count - 1].impedanceNsM });
    return { outP, outR, nodes };
    }
    const { outP, outR, nodes } = scatter(p, r, contactForceN), before = scatter(pl, rl, leftContactForceN);
    const controlJump = leftContactForceN !== contactForceN;
    if ((arrivals.length || controlJump) && t > timeS) {
      for (let i = 0; i < count; i++) { append(down[i], t, before.outP[i]); append(up[i], t, before.outR[i]); }
      append(rightForce, t, before.nodes[count].forceN); append(rightIncident, t, pl[count - 1]);
      append(rightOutgoing, t, before.outR[count - 1]); append(rightVelocity, t, before.nodes[count].velocityMS);
    }
    if (arrivals.length || controlJump || discontinuity) for (let i = 0; i < count; i++) {
      for (const [direction, h, amplitude] of [['down', down[i], outP[i]], ['up', up[i], outR[i]]]) {
        const prior = h[h.length - 1].value;
        if (prior !== amplitude) { need(++jumpCount <= 200000, 'Discontinuity event budget reached.'); jumps.push({ tick: t + s[i].exactDelayS, section: i, direction, before: prior, after: amplitude }); }
      }
    }
    for (let i = 0; i < count; i++) { append(down[i], t, outP[i]); append(up[i], t, outR[i]); }
    append(rightForce, t, nodes[count].forceN); append(rightIncident, t, p[count - 1]);
    append(rightOutgoing, t, outR[count - 1]); append(rightVelocity, t, nodes[count].velocityMS);
    timeS = t; committed = true; lastArrivalTime = t; lastArrivals = arrivals;
    return nodes;
  }
  function accounting() {
    let energyJ = 0, momentumKgMS = 0, integratedComplianceM = 0;
    s.forEach((sec, i) => {
      const lo = timeS - sec.exactDelayS;
      energyJ += (span(down[i], lo, timeS, true) + span(up[i], lo, timeS, true)) / sec.impedanceNsM;
      momentumKgMS += span(down[i], lo, timeS, false) - span(up[i], lo, timeS, false);
      integratedComplianceM += (span(down[i], lo, timeS, false) + span(up[i], lo, timeS, false)) / sec.impedanceNsM;
    });
    return { energyJ, momentumKgMS, exportedEnergyJ: input.rightBoundary === 'matched' ? primitive(rightIncident, timeS, true) / s[count - 1].impedanceNsM : 0,
      injectedEnergyJ: input.rightBoundary === 'matched' ? primitive(rightOutgoing, timeS, true) / s[count - 1].impedanceNsM : 0,
      integratedComplianceM, farDisplacementM: primitive(rightVelocity, timeS, false),
      externalImpulseNs: -primitive(rightForce, timeS, false), fixedBoundaryWorkJ: 0 };
  }
  function observe() {
    return prepared.probes.map(pr => {
      const i = prepared.index(pr.sectionId), sec = s[i];
      const p = value(down[i], timeS - pr.positionM / sec.waveSpeedMS), r = value(up[i], timeS - (sec.lengthM - pr.positionM) / sec.waveSpeedMS);
      return { id: pr.id, forceN: p + r, velocityMS: (p - r) / sec.impedanceNsM };
    });
  }
  return { sections: s, incoming, commit, accounting, observe, minimumDelayS: Math.min(...s.map(x => x.exactDelayS)),
    nextDiscontinuityTimeS: () => jumps.items[0]?.tick ?? Infinity,
    contactImpedanceNsM: s[0].impedanceNsM, scheme: 'causal piecewise-linear characteristic port, unrounded physical delays' };
}

// Every positive Float64 is an exact dyadic integer * 2^exponent.
function dyadic(x) {
  if (x === 0) return { integer: 0n, exponent: 0 };
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x);
  const high = view.getUint32(0), low = view.getUint32(4), biased = (high >>> 20) & 2047;
  let integer = (BigInt(high & 1048575) << 32n) + BigInt(low), exponent = biased ? biased - 1075 : -1074;
  if (biased) integer += 1n << 52n;
  while ((integer & 1n) === 0n) { integer >>= 1n; exponent++; }
  return { integer, exponent };
}
function quantize(x, bits) {
  if (!x || bits === 53) return x;
  const d = dyadic(x), count = d.integer.toString(2).length, shift = Math.max(0, count - bits);
  if (!shift) return x;
  const unit = 1n << BigInt(shift), rounded = (d.integer + unit / 2n) / unit;
  return Number(rounded) * 2 ** (d.exponent + shift);
}
function clock(values) {
  const nonzero = values.filter(x => x > 0).map(dyadic), exponent = nonzero.reduce((e, d) => Math.min(e, d.exponent), 0);
  const ticks = x => { const d = dyadic(x); return d.integer ? d.integer << BigInt(d.exponent - exponent) : 0n; };
  const seconds = n => {
    if (!n) return 0;
    const shift = Math.max(0, n.toString(2).length - 53);
    return Number(n >> BigInt(shift)) * 2 ** (exponent + shift);
  };
  return { ticks, seconds, exponent };
}
class Heap {
  constructor() { this.items = []; this.serial = 0; }
  less(a, b) { return a.tick < b.tick || (a.tick === b.tick && a.serial < b.serial); }
  push(e) {
    e.serial = this.serial++; const a = this.items; a.push(e); let i = a.length - 1;
    while (i) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0;
      while (true) { let j = i, l = i * 2 + 1, r = l + 1; if (l < a.length && this.less(a[l], a[j])) j = l; if (r < a.length && this.less(a[r], a[j])) j = r; if (j === i) break; [a[i], a[j]] = [a[j], a[i]]; i = j; }
    } return first;
  }
}
function record(history, tick, value) {
  need(finite(value), 'Wave amplitude exceeds Float64 range.');
  const last = history[history.length - 1];
  if (last.tick === tick) last.value = value;
  else if (last.value !== value) history.push({ tick, value });
}
function integral(history, lo, hi, time) {
  if (hi <= lo) return 0;
  let a = 0, b = history.length;
  while (a < b) { const m = (a + b) >> 1; if (history[m].tick <= lo) a = m + 1; else b = m; }
  let i = Math.max(0, a - 1), at = lo; const parts = [];
  while (at < hi) { const end = i + 1 < history.length && history[i + 1].tick < hi ? history[i + 1].tick : hi;
    parts.push(history[i].value ** 2 * time.seconds(end - at)); at = end; i++;
  } return sum(parts);
}
function initialIntegral(waves, direction, lo, hi) {
  if (hi <= lo) return 0;
  const active = waves.filter(w => w.direction === direction), cuts = [...new Set([lo, hi, ...active.flatMap(w => [w.fromM, w.toM]).filter(x => x > lo && x < hi)])].sort((a, b) => a - b);
  return sum(cuts.slice(1).map((end, i) => { const mid = (cuts[i] + end) / 2, F = sum(active.filter(w => mid > w.fromM && mid < w.toM).map(w => w.forceN)); return F * F * (end - cuts[i]); }));
}

function prepare(input) {
  need(input?.model === 'research-linear-axial-waves' && input.units === 'SI', 'Explicit research model and SI units required.');
  need(positive(input.durationS), 'Positive finite durationS required.');
  need(!['jar', 'contact', 'gravity', 'damping', 'frictionCoefficient', 'bha', 'survey'].some(k => input[k] !== undefined), 'Jar/contact, BHA, gravity, damping and friction inputs are outside this incremental wave model.');
  const options = { delayPrecisionBits: 53, maxEvents: 250000, maxPendingEvents: 250000, energyRelativeTolerance: 1e-9, energyAbsoluteToleranceJ: 1e-12, ...input.numerical };
  need(Number.isInteger(options.delayPrecisionBits) && options.delayPrecisionBits >= 16 && options.delayPrecisionBits <= 53, 'delayPrecisionBits must be 16–53.');
  for (const key of ['maxEvents', 'maxPendingEvents']) need(Number.isSafeInteger(options[key]) && options[key] > 0 && options[key] <= 2000000, `${key} must be 1–2000000.`);
  need(positive(options.energyRelativeTolerance) && positive(options.energyAbsoluteToleranceJ), 'Positive finite energy tolerances required.');
  need(Array.isArray(input.sections) && input.sections.length > 0 && input.sections.length <= 2048, 'Specify 1–2048 ordered uniform elastic sections.');
  const ids = new Set(), sections = input.sections.map(s => {
    need(s?.kind === 'uniform-elastic' && typeof s.id === 'string' && s.id.trim() && !ids.has(s.id), 'Unique nonempty section id and explicit uniform-elastic kind required.'); ids.add(s.id);
    need(['lengthM', 'areaM2', 'densityKgM3', 'youngsModulusPa'].every(k => positive(s[k])), `Section ${s.id}: positive finite L, A, density and E required.`);
    need(!s.componentDefinition && !s.effectiveProperties && !s.geometry && !s.sectionModel, `Section ${s.id}: complex/segmented tool inputs require an independently validated adapter.`);
    const rigidityN = s.areaM2 * s.youngsModulusPa, massKgM = s.areaM2 * s.densityKgM3;
    const waveSpeedMS = Math.sqrt(s.youngsModulusPa / s.densityKgM3), impedanceNsM = s.areaM2 * Math.sqrt(s.youngsModulusPa) * Math.sqrt(s.densityKgM3), exactDelayS = s.lengthM / waveSpeedMS;
    need([rigidityN, massKgM, waveSpeedMS, impedanceNsM, exactDelayS].every(positive), `Section ${s.id}: derived quantities outside Float64 range.`);
    for (const [key, value] of [['waveSpeedMS', waveSpeedMS], ['impedanceNsM', impedanceNsM]]) if (s[key] !== undefined) need(positive(s[key]) && Math.abs(s[key] - value) <= 1e-10 * value, `Section ${s.id}: supplied ${key} contradicts A, density or E.`);
    const delayS = quantize(exactDelayS, options.delayPrecisionBits); need(positive(delayS), 'Delay is not numerically representable.');
    return { ...s, rigidityN, massKgM, waveSpeedMS, impedanceNsM, exactDelayS, delayS, delayErrorS: delayS - exactDelayS };
  });
  need(input.boundaries && ['left', 'right'].every(k => ['free', 'fixed', 'matched'].includes(input.boundaries[k])), 'Each boundary must be free, fixed or matched continuation.');
  const waves = input.initialWaves ?? [], excitations = input.boundaryExcitations ?? [], probes = input.probes ?? [];
  need(Array.isArray(waves) && Array.isArray(excitations) && Array.isArray(probes), 'Wave, excitation and probe lists must be arrays.');
  need(waves.length <= 4096 && probes.length <= 256 && excitations.length <= 2, 'Input wave/probe/source budget exceeded.');
  need(waves.length * (probes.length + 1) <= 250000, 'Initial wave/probe expansion budget exceeded.');
  const index = id => sections.findIndex(s => s.id === id);
  waves.forEach(w => { const s = sections[index(w.sectionId)]; need(s && ['down', 'up'].includes(w.direction) && finite(w.forceN) && nonnegative(w.fromM) && positive(w.toM) && w.toM <= s.lengthM && w.fromM < w.toM, 'Invalid initial travelling pulse geometry/direction/force.'); });
  const ports = new Set(); let sourceCount = 0;
  excitations.forEach(e => {
    need(['left', 'right'].includes(e.boundary) && input.boundaries[e.boundary] === 'matched' && !ports.has(e.boundary), 'Excitation requires one explicit matched incident-wave port per boundary.'); ports.add(e.boundary);
    need(Array.isArray(e.history) && e.history.length > 0, 'Nonempty source history required.');
    e.history.forEach((h, i) => { need(nonnegative(h.timeS) && h.timeS <= input.durationS && finite(h.forceN) && (!i || h.timeS > e.history[i - 1].timeS), 'Source times must increase in [0,duration], with finite force levels.'); }); sourceCount += e.history.length;
  }); need(sourceCount <= 10000, 'Source history budget exceeded.');
  const probeIds = new Set(); probes.forEach(p => { const s = sections[index(p.sectionId)]; need(s && typeof p.id === 'string' && p.id.trim() && !probeIds.has(p.id) && nonnegative(p.positionM) && p.positionM <= s.lengthM, 'Invalid/duplicate probe or position.'); probeIds.add(p.id); });
  const energyTimesS = input.energyTimesS ?? [0, input.durationS];
  need(Array.isArray(energyTimesS) && energyTimesS.length <= 1000 && energyTimesS.every(t => nonnegative(t) && t <= input.durationS), 'Energy times must lie in the simulated interval (maximum 1000).');
  return { sections, options, waves, excitations, probes, index, energyTimesS: [...new Set([0, ...energyTimesS, input.durationS])].sort((a, b) => a - b) };
}

/** Pure research API: prescribed pulses only, initially zero elsewhere, zero incremental equilibrium. */
export function simulateNonUniformAxialWave(input) {
  const base = { researchOnly: true, productionAvailable: false, notice: NOTICE };
  let q;
  try { q = prepare(input); } catch (e) { return { ...base, valid: false, complete: false, status: 'invalid-input', error: e.message }; }
  const { sections: s, options, waves, excitations, probes, index } = q, count = s.length;
  const offsets = probes.map(p => { const sec = s[index(p.sectionId)]; return { down: quantize(sec.delayS * (p.positionM / sec.lengthM), options.delayPrecisionBits), up: quantize(sec.delayS * ((sec.lengthM - p.positionM) / sec.lengthM), options.delayPrecisionBits) }; });
  const initialTimes = [];
  const waveTiming = (w, positionM) => {
    const sec = s[index(w.sectionId)], speed = sec.lengthM / sec.delayS;
    return w.direction === 'down' ? [(positionM - w.toM) / speed, (positionM - w.fromM) / speed] : [(w.fromM - positionM) / speed, (w.toM - positionM) / speed];
  };
  waves.forEach(w => { const sec = s[index(w.sectionId)]; initialTimes.push(...waveTiming(w, w.direction === 'down' ? sec.lengthM : 0).filter(t => t >= 0)); probes.filter(p => p.sectionId === w.sectionId).forEach(p => initialTimes.push(...waveTiming(w, p.positionM).filter(t => t >= 0))); });
  const time = clock([input.durationS, ...s.map(x => x.delayS), ...offsets.flatMap(x => [x.down, x.up]), ...initialTimes, ...excitations.flatMap(e => e.history.map(h => h.timeS)), ...q.energyTimesS]);
  const H = time.ticks(input.durationS), heap = new Heap(), ticks = s.map(sec => time.ticks(sec.delayS));
  const p = Array(count + 1).fill(0), r = Array(count + 1).fill(0), drive = { left: 0, right: 0 };
  const histories = s.map(() => ({ down: [{ tick: 0n, value: 0 }], up: [{ tick: 0n, value: 0 }] }));
  const nodes = Array.from({ length: count + 1 }, () => []), probeState = probes.map(() => ({ down: 0, up: 0 })), probeHistories = probes.map(() => []);
  const boundaryHistories = { left: { incoming: [{ tick: 0n, value: 0 }], outgoing: [{ tick: 0n, value: 0 }] }, right: { incoming: [{ tick: 0n, value: 0 }], outgoing: [{ tick: 0n, value: 0 }] } };
  const arrivals = [], diagnostics = { processedEvents: 0, batches: 0, coincidentBatches: 0, maxQueue: 0, maxPathDelayErrorS: 0, maxInterfacePowerResidualW: 0, delayPrecisionBits: options.delayPrecisionBits, clockExponent: time.exponent, interpolation: 'none', timeGrid: 'none' };
  let at = 0n, completedTick = 0n, incomplete = '', numericalError = '';
  function enqueue(e) {
    if (e.tick > H) return;
    if (heap.items.length >= options.maxPendingEvents) throw Error('INCOMPLETE: pending event budget reached.');
    heap.push(e); diagnostics.maxQueue = Math.max(diagnostics.maxQueue, heap.items.length);
  }
  const schedulePulse = (lead, trail, target) => {
    if (trail <= 0) return;
    if (lead < 0 && target.type === 'probe') probeState[target.probe][target.direction] += target.delta;
    else enqueue({ ...target, tick: time.ticks(Math.max(0, lead)), errorS: 0 });
    enqueue({ ...target, delta: -target.delta, tick: time.ticks(trail), errorS: 0 });
  };
  const emit = (section, direction, delta, errorS) => {
    if (delta === 0) return;
    const history = histories[section][direction]; record(history, at, history[history.length - 1].value + delta);
    enqueue({ tick: at + ticks[section], type: 'node', node: direction === 'down' ? section + 1 : section, direction, delta, errorS: errorS + Math.abs(s[section].delayErrorS) });
    probes.forEach((pr, i) => { if (pr.sectionId !== s[section].id) return; const delay = time.ticks(offsets[i][direction]);
      if (delay === 0n) probeState[i][direction] += delta;
      else enqueue({ tick: at + delay, type: 'probe', probe: i, direction, delta, errorS });
    });
  };
  function solve(node, deltaP, deltaR, errorS) {
    p[node] += deltaP; r[node] += deltaR;
    let outLeft = 0, outRight = 0, force, velocity;
    if (node === 0 || node === count) {
      const side = node === 0 ? 'left' : 'right', incoming = node === 0 ? r[node] : p[node], Z = node === 0 ? s[0].impedanceNsM : s[count - 1].impedanceNsM;
      const reflection = input.boundaries[side] === 'fixed' ? 1 : input.boundaries[side] === 'free' ? -1 : 0;
      const outgoing = reflection * incoming + drive[side], history = boundaryHistories[side]; record(history.incoming, at, incoming); record(history.outgoing, at, outgoing);
      const prior = nodes[node].length ? nodes[node][nodes[node].length - 1].outgoingN : 0, delta = outgoing - prior;
      force = incoming + outgoing; velocity = (node === 0 ? outgoing - incoming : incoming - outgoing) / Z;
      if (node === 0) { outRight = outgoing; emit(0, 'down', delta, errorS); } else { outLeft = outgoing; emit(count - 1, 'up', delta, errorS); }
      nodes[node].push({ tick: at, incomingDownN: p[node], incomingUpN: r[node], outgoingDownN: outRight, outgoingUpN: outLeft, outgoingN: outgoing, forceN: force, velocityMS: velocity });
    } else {
      const ZL = s[node - 1].impedanceNsM, ZR = s[node].impedanceNsM, scale = Math.max(ZL, ZR), l = ZL / scale, z = ZR / scale;
      const reflect = (z - l) / (l + z), transmitRight = 2 * z / (l + z), transmitLeft = 2 * l / (l + z);
      const leftDelta = reflect * deltaP + transmitLeft * deltaR, rightDelta = transmitRight * deltaP - reflect * deltaR;
      outLeft = reflect * p[node] + transmitLeft * r[node]; outRight = transmitRight * p[node] - reflect * r[node];
      force = transmitRight * p[node] + transmitLeft * r[node]; velocity = (2 * ((p[node] - r[node]) / scale)) / (l + z);
      const residual = p[node] ** 2 / ZL + r[node] ** 2 / ZR - outLeft ** 2 / ZL - outRight ** 2 / ZR;
      diagnostics.maxInterfacePowerResidualW = Math.max(diagnostics.maxInterfacePowerResidualW, Math.abs(residual));
      need([force, velocity, residual, leftDelta, rightDelta].every(finite), 'Interface result exceeds Float64 range.');
      nodes[node].push({ tick: at, incomingDownN: p[node], incomingUpN: r[node], reflectedFromDownN: reflect * p[node], transmittedFromDownN: transmitRight * p[node], reflectedFromUpN: -reflect * r[node], transmittedFromUpN: transmitLeft * r[node], outgoingDownN: outRight, outgoingUpN: outLeft, forceN: force, velocityMS: velocity, powerResidualW: residual });
      emit(node - 1, 'up', leftDelta, errorS); emit(node, 'down', rightDelta, errorS);
    }
  }
  const snapshotProbes = () => probes.forEach((pr, i) => {
    const Z = s[index(pr.sectionId)].impedanceNsM, state = probeState[i], forceN = state.down + state.up, velocityMS = (state.down - state.up) / Z, history = probeHistories[i], last = history[history.length - 1];
    need(finite(forceN) && finite(velocityMS), 'Probe result outside Float64 range.');
    const row = { tick: at, forceN, velocityMS, downForceN: state.down, upForceN: state.up };
    if (last?.tick === at) history[history.length - 1] = row;
    else if (!last || last.forceN !== forceN || last.velocityMS !== velocityMS) history.push(row);
  });
  try {
    waves.forEach(w => { const section = index(w.sectionId), sec = s[section], [lead, trail] = waveTiming(w, w.direction === 'down' ? sec.lengthM : 0);
      schedulePulse(lead, trail, { type: 'node', node: w.direction === 'down' ? section + 1 : section, direction: w.direction, delta: w.forceN });
      probes.forEach((pr, i) => { if (pr.sectionId === w.sectionId) schedulePulse(...waveTiming(w, pr.positionM), { type: 'probe', probe: i, direction: w.direction, delta: w.forceN }); });
    });
    excitations.forEach(e => e.history.forEach(h => enqueue({ tick: time.ticks(h.timeS), type: 'source', side: e.boundary, value: h.forceN, errorS: 0 })));
    snapshotProbes();
    while (heap.items.length) {
      at = heap.items[0].tick; const batch = [], changes = new Map(); let errorS = 0;
      while (heap.items.length && heap.items[0].tick === at) batch.push(heap.pop());
      if (diagnostics.processedEvents + batch.length > options.maxEvents) { incomplete = 'Processed event budget reached; no complete-result claim.'; break; }
      diagnostics.processedEvents += batch.length; diagnostics.batches++; if (batch.length > 1) diagnostics.coincidentBatches++;
      for (const e of batch) {
        errorS = Math.max(errorS, e.errorS); diagnostics.maxPathDelayErrorS = Math.max(diagnostics.maxPathDelayErrorS, e.errorS);
        if (e.type === 'probe') probeState[e.probe][e.direction] += e.delta;
        else { const node = e.type === 'source' ? (e.side === 'left' ? 0 : count) : e.node;
          if (!changes.has(node)) changes.set(node, { down: [], up: [] });
          if (e.type === 'source') drive[e.side] = e.value; else { changes.get(node)[e.direction].push(e.delta); arrivals.push({ tick: at, node, direction: e.direction, deltaForceN: e.delta, pathDelayErrorS: e.errorS }); }
        }
      }
      for (const [node, change] of [...changes].sort((a, b) => a[0] - b[0])) solve(node, sum(change.down), sum(change.up), errorS);
      snapshotProbes();
      completedTick = at;
    }
  } catch (e) { if (e.message.startsWith('INCOMPLETE:')) incomplete = e.message; else numericalError = e.message; }
  const stop = incomplete || numericalError ? completedTick : H;
  const energy = q.energyTimesS.map(time.ticks).filter(t => t <= stop).map(t => {
    let physicalStoredJ = 0, delayStoredJ = 0, initialPhysicalJ = 0, initialDelayJ = 0;
    s.forEach((sec, i) => {
      const localWaves = waves.filter(w => w.sectionId === sec.id), speed = sec.lengthM / sec.delayS, elapsed = time.seconds(t), travel = Math.min(sec.lengthM, elapsed * speed), K = sec.rigidityN, Z = sec.impedanceNsM;
      const initialSquared = initialIntegral(localWaves, 'down', 0, sec.lengthM) + initialIntegral(localWaves, 'up', 0, sec.lengthM);
      const remainingSquared = initialIntegral(localWaves, 'down', 0, sec.lengthM - travel) + initialIntegral(localWaves, 'up', travel, sec.lengthM);
      const lo = t > ticks[i] ? t - ticks[i] : 0n, emittedSquared = integral(histories[i].down, lo, t, time) + integral(histories[i].up, lo, t, time);
      initialPhysicalJ += initialSquared / K; initialDelayJ += initialSquared / (Z * speed);
      physicalStoredJ += remainingSquared / K + emittedSquared * speed / K; delayStoredJ += remainingSquared / (Z * speed) + emittedSquared / Z;
    });
    let injectedJ = 0, escapedJ = 0;
    for (const [side, section] of [['left', 0], ['right', count - 1]]) if (input.boundaries[side] === 'matched') {
      injectedJ += integral(boundaryHistories[side].outgoing, 0n, t, time) / s[section].impedanceNsM;
      escapedJ += integral(boundaryHistories[side].incoming, 0n, t, time) / s[section].impedanceNsM;
    }
    const residualJ = initialPhysicalJ + injectedJ - escapedJ - physicalStoredJ, delayResidualJ = initialDelayJ + injectedJ - escapedJ - delayStoredJ;
    return { timeS: time.seconds(t), initialPhysicalJ, injectedJ, escapedJ, physicalStoredJ, residualJ, delayStoredJ, delayResidualJ };
  });
  const energyOk = energy.every(e => Object.values(e).every(finite) && Math.abs(e.residualJ) <= options.energyAbsoluteToleranceJ + options.energyRelativeTolerance * (e.initialPhysicalJ + e.injectedJ));
  const expose = h => h.map(({ tick, ...row }) => ({ timeS: time.seconds(tick), exactTick: tick.toString(), ...row }));
  return { ...base, valid: !incomplete && !numericalError && energyOk, complete: !incomplete && !numericalError, status: incomplete ? 'incomplete' : numericalError ? 'numerical-failure' : !energyOk ? 'energy-tolerance-not-met' : 'complete', error: incomplete || numericalError || (!energyOk ? 'Physical energy residual exceeds requested tolerance.' : ''),
    durationS: input.durationS, completedThroughS: time.seconds(stop), sections: s, boundaries: { ...input.boundaries }, numerical: diagnostics,
    probes: probes.map((pr, i) => ({ ...pr, history: expose(probeHistories[i]) })), interfaces: nodes.map((h, node) => ({ node, history: expose(h) })), arrivalEvents: expose(arrivals), energy,
    scope: 'Incremental prescribed elastic waves only. No jar firing, hammer/anvil impact, contact, prestress release or OES dynamic validation.' };
}
