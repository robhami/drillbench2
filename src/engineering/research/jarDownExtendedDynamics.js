// RESEARCH ONLY: ideal guided rods, massless unilateral stop, bilateral fixed ends.
// No production imports. See SkeemJarDownExtendedDynamicsStage5C9.md.
const notice = 'PRELIMINARY — NOT FOR OPERATIONAL USE';
const fail = error => ({ valid: false, researchOnly: true, productionAvailable: false, notice, error });
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const nonnegative = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;

class Events {
  constructor() { this.heap = []; this.serial = 0; }
  less(a, b) { return a.time < b.time || (a.time === b.time && a.serial < b.serial); }
  push(e) {
    e.serial = this.serial++;
    const h = this.heap; h.push(e);
    let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(h[i], h[p])) break; [h[i], h[p]] = [h[p], h[i]]; i = p; }
  }
  pop() {
    const h = this.heap, first = h[0], last = h.pop();
    if (h.length) {
      h[0] = last; let i = 0;
      while (true) { let j = i, l = 2 * i + 1, r = l + 1;
        if (l < h.length && this.less(h[l], h[j])) j = l;
        if (r < h.length && this.less(h[r], h[j])) j = r;
        if (j === i) break; [h[i], h[j]] = [h[j], h[i]]; i = j;
      }
    }
    return first;
  }
  get nextTime() { return this.heap[0]?.time ?? Infinity; }
}

export function stepValue(history, time) {
  let lo = 0, hi = history.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (history[m].timeS <= time) lo = m + 1; else hi = m; }
  return lo ? history[lo - 1].value : 0;
}

export function integrateSteps(history, startS, endS) {
  if (!Array.isArray(history) || !Number.isFinite(startS) || !Number.isFinite(endS) || endS < startS) throw new Error('Invalid step integration interval.');
  let sum = 0, t = startS, v = stepValue(history, startS);
  history.forEach(row => { if (row.timeS > startS && row.timeS < endS) { sum += v * (row.timeS - t); t = row.timeS; v = row.value; } });
  return sum + v * (endS - t);
}

function prepare(p) {
  if (!p || p.model !== 'ideal-guided-extended-contact') throw new Error('Explicit extended research model identification required.');
  if (!nonnegative(p.compressionLbf) || !positive(p.strokeIn) || !nonnegative(p.gravityFtS2) || !positive(p.horizonS)) throw new Error('Finite nonnegative local compression/gravity, positive free stroke and finite horizon required.');
  if (['survey', 'frictionCoefficient', 'lowerCollarWeightLbf', 'pumpOpenForceLbf'].some(k => p[k] !== undefined)) throw new Error('Survey, friction, catalog-weight and hydraulic corrections are unsupported.');
  if (![p.upperRods, p.lowerRods].every(a => Array.isArray(a) && a.length > 0) || p.upperRods.length + p.lowerRods.length > 64) throw new Error('Specify 1–64 piecewise-uniform rods with at least one on either side of the jar.');
  const rods = [...p.upperRods, ...p.lowerRods].map(r => {
    if (!r || !['lengthFt', 'areaIn2', 'youngsModulusPsi', 'densitySlugFt3'].every(k => positive(r[k]))) throw new Error('Invalid rod geometry/material properties.');
    const EA = r.areaIn2 * r.youngsModulusPsi, mu = r.densitySlugFt3 * r.areaIn2 / 144;
    const c = Math.sqrt(EA / mu), Z = EA / c, tau = r.lengthFt / c;
    if (![EA, mu, c, Z, tau].every(positive)) throw new Error('Rod quantities outside numerical range.');
    return { ...r, EA, mu, c, Z, tau };
  });
  const jar = p.upperRods.length, P = p.compressionLbf, s = p.strokeIn / 12;
  const timeToleranceS = (p.coincidenceUlps ?? 64) * Number.EPSILON * p.horizonS;
  if (!positive(s) || !positive(timeToleranceS) || ![16, 32, 64, 128].includes(p.coincidenceUlps ?? 64) || rods.some(r => r.tau <= 1024 * timeToleranceS)) throw new Error('Propagation delays are not resolved at this horizon/tolerance.');
  if (![...rods.map(r => P / r.Z), ...rods.map(r => r.mu * p.gravityFtS2 * r.lengthFt),
    P + rods.reduce((sum, r) => sum + r.mu * p.gravityFtS2 * r.lengthFt, 0)].every(Number.isFinite)) throw new Error('Initial equilibrium exceeds numerical range.');
  const window = p.observation ?? { startS: 0, endS: p.horizonS };
  if (!nonnegative(window.startS) || !positive(window.endS) || window.endS <= window.startS || window.endS > p.horizonS) throw new Error('Observation interval must lie inside the simulation horizon.');
  return { rods, jar, P, s, timeToleranceS, window };
}

function propagate(p, q, noContact) {
  const { rods, jar, P, s, timeToleranceS: eps } = q, count = rods.length;
  const a = Array(count + 1).fill(0), b = Array(count + 1).fill(0), queue = new Events();
  const waveHistories = rods.map(() => ({ a: [{ timeS: 0, value: 0 }], b: [{ timeS: 0, value: 0 }] }));
  const baselineLbf = P + rods.slice(jar).reduce((sum, r) => sum + r.mu * p.gravityFtS2 * r.lengthFt, 0);
  const reaction = [{ timeS: 0, value: baselineLbf }], top = [{ timeS: 0, value: 0 }];
  let t = 0, uh = 0, ua = 0, vh = 0, va = 0, N = 0, engaged = false, batches = 0, arrivals = 0;
  const motion = [], transitions = [], nodeHistory = [], coincidenceBatches = [];
  const record = (h, value) => { if (!Number.isFinite(value)) throw new Error('Nonfinite wave/contact result.'); if (h[h.length - 1].value !== value) h.push({ timeS: t, value }); };
  function emit(i, direction, value) {
    const h = waveHistories[i][direction];
    if (!Number.isFinite(value)) throw new Error('Nonfinite emitted wave.');
    if (h[h.length - 1].value === value) return;
    h.push({ timeS: t, value });
    const time = t + rods[i].tau;
    if (time <= p.horizonS + eps) queue.push({ time, node: direction === 'a' ? i + 1 : i, direction, value });
  }
  function solve(node) {
    if (node === 0) { record(top, -rods[0].Z * b[0]); emit(0, 'a', -b[0]); return; }
    if (node === count) { record(reaction, baselineLbf + rods[count - 1].Z * a[count]); emit(count - 1, 'b', -a[count]); return; }
    const Zu = rods[node - 1].Z, Zl = rods[node].Z;
    if (node !== jar) {
      const n = (a[node] - b[node]) / (1 / Zu + 1 / Zl), v = a[node] - n / Zu;
      emit(node - 1, 'b', v - n / Zu); emit(node, 'a', v + n / Zl);
      nodeHistory.push({ timeS: t, node, velocityFtS: v, incrementalCompressionLbf: n }); return;
    }
    const old = engaged, gap = s - (uh - ua), trial = P + (a[node] - b[node]) / (1 / Zu + 1 / Zl);
    const freeH = a[node] + P / Zu, freeA = b[node] - P / Zl;
    const positionTol = 512 * Number.EPSILON * Math.max(s, Math.abs(uh), Math.abs(ua), Number.MIN_VALUE);
    if (!noContact && gap < -positionTol) throw new Error('Contact penetration exceeds roundoff.');
    if (noContact) engaged = false;
    else if (engaged) engaged = trial >= 0;
    else engaged = gap <= positionTol && freeH > freeA;
    N = engaged ? Math.max(0, trial) : 0;
    const n = N - P;
    vh = a[node] - n / Zu; va = b[node] + n / Zl;
    if (engaged) { const v = (Zu * a[node] + Zl * b[node]) / (Zu + Zl); vh = v; va = v; }
    if (engaged !== old) transitions.push({ timeS: t, type: engaged ? 'engage' : 'open', gapFt: gap, contactForceLbf: N,
      hammerDisplacementFt: uh, anvilDisplacementFt: ua, freeHammerVelocityFtS: freeH, freeAnvilVelocityFtS: freeA,
      freeRelativeVelocityFtS: freeH - freeA, leftHammerVelocityFtS: motion[motion.length - 1]?.hammerVelocityFtS ?? 0,
      leftAnvilVelocityFtS: motion[motion.length - 1]?.anvilVelocityFtS ?? 0 });
    emit(node - 1, 'b', vh - n / Zu); emit(node, 'a', va + n / Zl);
  }
  function snapshot() {
    if (![t, uh, ua, vh, va, N, s - (uh - ua)].every(Number.isFinite)) throw new Error('Motion exceeds numerical range.');
    motion.push({ timeS: t, hammerDisplacementFt: uh, anvilDisplacementFt: ua, hammerVelocityFtS: vh,
      anvilVelocityFtS: va, gapFt: s - (uh - ua), contactForceLbf: N, state: engaged ? 'engaged-stop' : 'released-faces' });
  }
  solve(jar); snapshot();
  while (t < p.horizonS) {
    if (++batches > 100000 || arrivals > 500000) throw new Error('Event budget exceeded; no partial prediction returned.');
    const closing = vh - va, gap = s - (uh - ua);
    const collision = !noContact && !engaged && closing > 0 ? t + Math.max(0, gap) / closing : Infinity;
    const next = Math.min(queue.nextTime, collision, p.horizonS);
    if (!(next > t)) throw new Error('Unresolved zero-time event; no partial prediction returned.');
    const dt = next - t; uh += vh * dt; ua += va * dt; t = next;
    const changed = new Set(); let groupSize = 0;
    while (queue.nextTime <= t + eps && queue.nextTime <= p.horizonS) {
      const e = queue.pop(); (e.direction === 'a' ? a : b)[e.node] = e.value;
      changed.add(e.node); arrivals++; groupSize++;
    }
    if (groupSize > 1) coincidenceBatches.push({ timeS: t, arrivals: groupSize });
    if (Math.abs(collision - t) <= eps) changed.add(jar);
    [...changed].sort((x, y) => x - y).forEach(solve);
    snapshot();
  }
  return { baselineLbf, motion, transitions, reaction, top, waveHistories, nodeHistory, batches, arrivals, coincidenceBatches,
    impactStatus: transitions.some(e => e.type === 'engage') ? 'impact-resolved' : 'no-impact-within-horizon' };
}

export function simulateExtendedJarDown(input) {
  try {
    const q = prepare(input), contact = propagate(input, q, false), noContact = propagate(input, q, true);
    // Requested decimal endpoints may represent the same wave time one ULP
    // apart. Apply the declared coincidence convention to observation bounds
    // too, so a roundoff-width sliver cannot invent a different reported peak.
    const boundaries = [...contact.reaction, ...noContact.reaction].map(e => e.timeS);
    const snap = t => {
      const candidates = boundaries.filter(v => Math.abs(v - t) <= q.timeToleranceS);
      return candidates.length ? candidates.reduce((best, v) => Math.abs(v - t) < Math.abs(best - t) ? v : best) : t;
    };
    const startS = snap(q.window.startS), endS = snap(q.window.endS);
    if (!(endS > startS)) throw new Error('Observation interval collapses at the reported time resolution.');
    const totalLbfS = integrateSteps(contact.reaction, startS, endS);
    const noContactLbfS = integrateSteps(noContact.reaction, startS, endS);
    const levels = [stepValue(contact.reaction, startS), ...contact.reaction.filter(e => e.timeS > startS && e.timeS < endS).map(e => e.value)];
    const incrementalLbfS = totalLbfS - contact.baselineLbf * (endS - startS);
    if (![totalLbfS, noContactLbfS, incrementalLbfS, totalLbfS - noContactLbfS, totalLbfS / (endS - startS)].every(Number.isFinite)) throw new Error('Observation integrals exceed numerical range.');
    return { valid: true, researchOnly: true, productionAvailable: false, notice, rods: q.rods, jarNode: q.jar,
      horizonS: input.horizonS, timeToleranceS: q.timeToleranceS, contact, noContact,
      compressionLbf: input.compressionLbf, gravityFtS2: input.gravityFtS2, strokeFt: input.strokeIn / 12,
      requestedObservation: q.window,
      observation: { startS, endS, totalLbfS, incrementalLbfS,
        noContactLbfS, impactAttributableLbfS: totalLbfS - noContactLbfS,
        peakTotalCompressionLbf: Math.max(...levels), minimumTotalCompressionLbf: Math.min(...levels), averageTotalCompressionLbf: totalLbfS / (endS - startS) },
      primaryInterval: null };
  } catch (e) { return fail(e.message); }
}

// Full spatial conservation check, independently of reaction peak/impulse summaries.
export function auditExtendedState(result, timeS, counterfactual = false) {
  if (!result?.valid || !nonnegative(timeS) || timeS > result.horizonS) throw new Error('Audit time outside completed simulation.');
  const run = counterfactual ? result.noContact : result.contact;
  let kinetic = 0, elasticChange = 0, gravityChange = 0, momentum = 0, waveEnergy = 0;
  const weights = result.rods.map(r => r.mu * result.gravityFtS2 * r.lengthFt);
  const jarWeight = weights.slice(0, result.jarNode).reduce((s, w) => s + w, 0);
  let precedingWeight = 0;
  result.rods.forEach((r, i) => {
    const h = run.waveHistories[i], c0top = result.compressionLbf + precedingWeight - jarWeight;
    precedingWeight += weights[i];
    const cuts = [0, r.lengthFt];
    h.a.forEach(e => { const x = r.c * (timeS - e.timeS); if (x > 0 && x < r.lengthFt) cuts.push(x); });
    h.b.forEach(e => { const x = r.lengthFt - r.c * (timeS - e.timeS); if (x > 0 && x < r.lengthFt) cuts.push(x); });
    cuts.sort((x, y) => x - y);
    for (let k = 1; k < cuts.length; k++) {
      const left = cuts[k - 1], right = cuts[k], width = (right - left) / 2;
      if (!width) continue;
      [-1, 1].forEach(sign => {
        const x = (left + right) / 2 + sign * width / Math.sqrt(3);
        const ta = timeS - x / r.c, tb = timeS - (r.lengthFt - x) / r.c;
        const a = stepValue(h.a, ta), b = stepValue(h.b, tb), v = (a + b) / 2, n = r.Z * (a - b) / 2;
        const u = ((ta > 0 ? integrateSteps(h.a, 0, ta) : 0) + (tb > 0 ? integrateSteps(h.b, 0, tb) : 0)) / 2;
        const c0 = c0top + r.mu * result.gravityFtS2 * x, ke = r.mu * v * v / 2;
        kinetic += width * ke;
        elasticChange += width * (2 * c0 * n + n * n) / (2 * r.EA);
        gravityChange -= width * r.mu * result.gravityFtS2 * u;
        waveEnergy += width * (ke + n * n / (2 * r.EA));
        momentum += width * r.mu * v;
      });
    }
  });
  const supportImpulse = integrateSteps(run.top, 0, timeS) - integrateSteps(run.reaction, 0, timeS) + run.baselineLbf * timeS;
  return { timeS, kineticEnergyFtLbf: kinetic, elasticEnergyChangeFtLbf: elasticChange, gravityEnergyChangeFtLbf: gravityChange,
    energyResidualFtLbf: kinetic + elasticChange + gravityChange, waveEnergyFtLbf: waveEnergy,
    momentumSlugFtS: momentum, supportImpulseLbfS: supportImpulse, momentumResidualLbfS: momentum - supportImpulse };
}
