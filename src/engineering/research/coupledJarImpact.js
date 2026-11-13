// RESEARCH ONLY. Isolated finite hammer; no production importers or BHA adapter.
import { createAxialWavePortNetwork } from './nonUniformAxialWave';

const notice = 'PRELIMINARY — NOT FOR OPERATIONAL USE';
const finite = x => typeof x === 'number' && Number.isFinite(x);
const positive = x => finite(x) && x > 0;
const fail = (status, error) => ({ valid: false, complete: false, status, error, notice, metrics: null });

export function simulateCoupledJarImpact(input) {
  if (input?.model !== 'research-coupled-linear-contact' || input.units !== 'SI') return fail('invalid-physical-inputs', 'Explicit research model and SI units required.');
  if (input.equilibrium !== 'zero-preload' || (input.staticPreloadN !== undefined && input.staticPreloadN !== 0) ||
    ['upperSections', 'bha', 'jarRelease', 'damping', 'friction', 'initialWaves', 'wob', 'gravity'].some(k => input[k] !== undefined)) {
    return fail('unsupported-model-configuration', 'Only explicitly zero-preload, isolated-hammer, lossless collision states are supported; no release, upper attachment, BHA or initial rod waves.');
  }
  const M = input.hammerMassKg, k = input.contactStiffnessNm, V = input.initialHammerVelocityMS;
  const q = input.direction === 'down' ? 1 : input.direction === 'up' ? -1 : 0;
  const opt = { timeStepS: 1e-6, maxSteps: 200000, maxHistoryCells: 2000000, eventTimeToleranceS: 1e-12,
    energyRelativeTolerance: 2e-5, energyAbsoluteToleranceJ: 1e-10, momentumRelativeTolerance: 2e-5, momentumAbsoluteToleranceNs: 1e-10, ...input.numerical };
  if (![M, k, input.durationS, opt.timeStepS, opt.eventTimeToleranceS, opt.energyRelativeTolerance, opt.energyAbsoluteToleranceJ, opt.momentumRelativeTolerance, opt.momentumAbsoluteToleranceNs].every(positive) || !finite(V) || !q ||
    !Number.isSafeInteger(opt.maxSteps) || opt.maxSteps < 1 || opt.maxSteps > 1000000 || !Number.isSafeInteger(opt.maxHistoryCells) || opt.maxHistoryCells < 10 || opt.maxHistoryCells > 20000000) return fail('invalid-physical-inputs', 'Invalid mass, stiffness, velocity, direction, duration or numerical controls.');
  const initial = input.initialContact;
  if (!initial || !finite(initial.gapM) || initial.gapM < 0 || !finite(initial.compressionM) || initial.compressionM < 0 || (initial.gapM && initial.compressionM)) return fail('invalid-physical-inputs', 'Explicit nonnegative gap/compression required; both cannot be positive.');
  const mode = input.anvil;
  if (!['rod', 'rigid-wall', 'finite-mass'].includes(mode) || (mode === 'finite-mass' && !positive(input.anvilMassKg))) return fail('invalid-physical-inputs', 'Specify rod, rigid-wall or positive finite-mass anvil.');
  if (mode !== 'rod' && ((input.sections?.length ?? 0) || input.probes?.length || input.rightBoundary !== undefined)) return fail('unsupported-model-configuration', 'Rod sections/probes/boundaries cannot be attached to the wall or isolated finite-mass benchmark.');
  let net;
  try { if (mode === 'rod') net = createAxialWavePortNetwork({ sections: input.sections, probes: input.probes, rightBoundary: input.rightBoundary, durationS: input.durationS }); }
  catch (e) { return fail('invalid-physical-inputs', e.message); }
  const Z = net ? net.contactImpedanceNsM : Infinity, Ma = mode === 'finite-mass' ? input.anvilMassKg : Infinity;
  const initialEnergyJ = .5 * M * V * V + .5 * k * initial.compressionM ** 2;
  if (!finite(initialEnergyJ)) return fail('invalid-physical-inputs', 'Initial energy exceeds finite numerical range.');
  let t = 0, w = q * V, u = 0, va = 0, ua = 0, delta = initial.compressionM - initial.gapM, active = delta > 0 || (delta === 0 && w > 0);
  let everContact = active, loading = active;
  let impulse = 0, wallImpulse = 0, steps = 0, maxEnergyResidualJ = 0, maxMomentumResidualNs = 0, incomplete = '', numericalError = '';
  const histories = [], events = [], interfaceHistories = [], probeHistories = [], arrivals = [];
  if (active) events.push({ type: 'contact', timeS: 0 });
  let nodes = net ? net.commit(0, q * k * Math.max(0, delta)) : [];
  const energy = [];
  function save() {
    const N = k * Math.max(0, delta), incoming = net ? net.incoming(t) : 0;
    const anvilV = net ? (q * N - 2 * incoming) / Z : q * va;
    const a = net ? net.accounting() : { energyJ: 0, momentumKgMS: 0, exportedEnergyJ: 0, externalImpulseNs: mode === 'rigid-wall' ? wallImpulse : 0, fixedBoundaryWorkJ: 0 };
    const hammerKineticJ = .5 * M * w * w, anvilKineticJ = Number.isFinite(Ma) ? .5 * Ma * va * va : 0, contactSpringJ = .5 * k * Math.max(0, delta) ** 2;
    const residualJ = hammerKineticJ + anvilKineticJ + contactSpringJ + a.energyJ + a.exportedEnergyJ - initialEnergyJ;
    const momentumResidualNs = q * M * w + (Number.isFinite(Ma) ? q * Ma * va : 0) + a.momentumKgMS - M * V - a.externalImpulseNs;
    maxEnergyResidualJ = Math.max(maxEnergyResidualJ, Math.abs(residualJ)); maxMomentumResidualNs = Math.max(maxMomentumResidualNs, Math.abs(momentumResidualNs));
    histories.push({ timeS: t, contactState: active ? loading ? 'loading' : 'unloading' : 'open', hammerDisplacementM: q * u, hammerVelocityMS: q * w, hammerAccelerationMS2: -q * N / M,
      anvilDisplacementM: q * ua, anvilVelocityMS: anvilV, compressionM: Math.max(0, delta), gapM: Math.max(0, -delta), contactForceN: N, signedStringForceN: q * N });
    energy.push({ timeS: t, initialEnergyJ, hammerKineticJ, anvilKineticJ, contactSpringJ, waveEnergyJ: a.energyJ, exportedEnergyJ: a.exportedEnergyJ,
      externalImpulseNs: a.externalImpulseNs, momentumResidualNs, residualJ, boundaryWorkJ: 0 });
    if (net) { interfaceHistories.push({ timeS: t, nodes }); probeHistories.push({ timeS: t, probes: net.observe() }); }
  }
  save();
  // Implicit midpoint with known causal returning characteristic. Position and
  // spring energy exchange use the same midpoint force; no velocity reset.
  function trial(h) {
    const R = net ? net.incoming(t + h / 2) : 0, beta = net ? -2 * q * R / Z : 0;
    const mobility = 1 / M + 1 / Ma;
    const next = active ? (delta * (1 - h * k / (2 * Z) - h * h * k * mobility / 4) + h * (w - va - beta)) /
      (1 + h * k / (2 * Z) + h * h * k * mobility / 4) : delta + h * (w - va - beta);
    const midN = active ? k * (delta + next) / 2 : 0;
    return { delta: next, w: w - h * midN / M, va: va + h * midN / Ma, midN, beta };
  }
  while (t < input.durationS) {
    if (steps >= opt.maxSteps || (steps + 2) * (2 * (net?.sections.length || 0) + (input.probes?.length || 0) + 12) > opt.maxHistoryCells) { incomplete = 'Step/history budget reached.'; break; }
    let h = Math.min(opt.timeStepS, input.durationS - t, net ? net.minimumDelayS * .5 : Infinity);
    if (h * Math.sqrt(k * (1 / M + 1 / Ma)) > .1 || h * k / Z > .1) { numericalError = 'Time step does not resolve contact/radiation scales; refine timeStepS.'; break; }
    let next = trial(h), crossing = (active && next.delta < 0) || (!active && next.delta > 0 && delta < 0);
    if (crossing) {
      let lo = 0, hi = h;
      for (let i = 0; i < 64 && hi - lo > opt.eventTimeToleranceS; i++) {
        const mid = (hi + lo) / 2, d = trial(mid).delta;
        if ((active && d > 0) || (!active && d < 0)) lo = mid; else hi = mid;
      }
      h = (lo + hi) / 2; next = trial(h); next.delta = 0;
    }
    if (!(h > 0 && t + h > t) || ![next.w, next.delta, next.va, next.midN].every(finite)) { numericalError = 'Unresolvable contact event or nonfinite state.'; break; }
    const priorW = w, priorU = u, priorDelta = delta, oldIncoming = net ? net.incoming(t) : 0;
    impulse += h * next.midN; if (mode === 'rigid-wall') wallImpulse -= q * h * next.midN;
    u += h * (w + next.w) / 2; ua += (u - priorU) - (next.delta - delta);
    w = next.w; va = next.va; delta = next.delta; t += h; steps++;
    if (priorW > 0 && w <= 0) events.push({ type: 'hammer-rebound', timeS: t - h + h * priorW / (priorW - w), timingResolutionS: h });
    if (active && loading && delta < priorDelta) events.push({ type: 'peak-contact-force', timeS: t - h, forceN: k * Math.max(0, priorDelta), timingResolutionS: h });
    loading = active && delta >= priorDelta;
    if (crossing) { active = !active; events.push({ type: active ? everContact ? 'recontact' : 'contact' : 'separation', timeS: t }); if (active) { everContact = true; loading = true; } }
    // At a zero-gap open state, choose the right-sided closing velocity.
    if (!active && delta === 0 && (w - va - next.beta) > 0) { active = true; events.push({ type: everContact ? 'recontact' : 'contact', timeS: t }); everContact = true; loading = true; }
    try { if (net) { nodes = net.commit(t, q * k * Math.max(0, delta)); const incoming = net.incoming(t);
      if (incoming !== oldIncoming && (incoming !== 0 || oldIncoming !== 0)) arrivals.push({ timeS: t, incomingUpForceN: incoming, timingResolutionS: h }); } }
    catch (e) { numericalError = e.message; break; }
    save();
  }
  const energyOk = maxEnergyResidualJ <= opt.energyAbsoluteToleranceJ + opt.energyRelativeTolerance * initialEnergyJ;
  const momentumOk = maxMomentumResidualNs <= opt.momentumAbsoluteToleranceNs + opt.momentumRelativeTolerance * Math.max(Math.abs(M * V), Math.sqrt(2 * M * initialEnergyJ));
  const status = incomplete ? 'incomplete-simulation' : numericalError ? 'numerical-nonconvergence' : !energyOk ? 'energy-accounting-failure' : !momentumOk ? 'momentum-accounting-failure' : 'valid-research-result';
  const valid = status === 'valid-research-result';
  let peak = 0, stuckPeak = 0, stuckImpulse = 0;
  histories.forEach(h => { peak = Math.max(peak, h.contactForceN); });
  if (net && input.rightBoundary === 'fixed') interfaceHistories.forEach((row, i) => {
    const F = row.nodes[row.nodes.length - 1].forceN; stuckPeak = Math.max(stuckPeak, Math.abs(F));
    if (i) { const before = interfaceHistories[i - 1]; stuckImpulse += (row.timeS - before.timeS) * (F + before.nodes[before.nodes.length - 1].forceN) / 2; }
  });
  let primaryStuckImpulse = { status: 'indeterminate', reason: 'No unique physical primary-window terminator is established for a general reflected/contact network.' };
  const firstContact = events.find(e => e.type === 'contact'), firstSeparation = events.find(e => e.type === 'separation');
  if (valid && net?.sections.length === 1 && input.rightBoundary === 'fixed' && firstContact && firstSeparation) {
    const delay = net.sections[0].exactDelayS, startS = firstContact.timeS + delay, endS = firstSeparation.timeS + delay;
    if (firstSeparation.timeS < firstContact.timeS + 2 * delay && t >= endS) {
      let signedImpulseNs = 0;
      for (let i = 1; i < interfaceHistories.length; i++) {
        const a = interfaceHistories[i - 1], b = interfaceHistories[i], lo = Math.max(startS, a.timeS), hi = Math.min(endS, b.timeS);
        if (hi <= lo) continue;
        const f0 = a.nodes[1].forceN, slope = (b.nodes[1].forceN - f0) / (b.timeS - a.timeS);
        signedImpulseNs += (hi - lo) * (2 * f0 + slope * (lo + hi - 2 * a.timeS)) / 2;
      }
      primaryStuckImpulse = { status: 'determinate-first-contact-pulse', startS, endS, signedImpulseNs,
        definition: 'Single uniform rod: complete first contact pulse reaches fixed end before any contact-feedback alteration of that pulse. Not the Skeem primary interval.' };
    }
  }
  return { valid, complete: !incomplete && !numericalError, status, notice, error: incomplete || numericalError || (!energyOk ? 'Physical energy residual exceeds tolerance.' : !momentumOk ? 'Momentum residual exceeds tolerance.' : ''),
    scope: 'Zero-preload isolated finite hammer, unilateral linear contact, ideal elastic wave research; no firing/manufacturer/field validation.',
    histories, interfaces: interfaceHistories, probes: probeHistories, contactEvents: events, reflectedWaveSamples: arrivals, energy,
    metrics: valid ? { maximumContactForceN: peak, maximumAbsoluteStuckForceN: net && input.rightBoundary === 'fixed' ? stuckPeak : null,
      contactImpulseNs: impulse, totalSignedStuckImpulseNs: net && input.rightBoundary === 'fixed' ? stuckImpulse : null,
      primaryStuckImpulse } : null,
    numerical: { steps, requestedTimeStepS: opt.timeStepS, completedThroughS: t, maxEnergyResidualJ, maxMomentumResidualNs, energyOk, momentumOk,
      delayRepresentation: 'Unrounded physical delays; linear history interpolation', eventTimeToleranceS: opt.eventTimeToleranceS,
      convergence: 'Not established by one run; compare refined resolutions.' }, sections: net?.sections || [] };
}
