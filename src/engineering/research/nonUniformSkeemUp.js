// RESEARCH ONLY. Skeem ideal release, stationary anvil, then maintained elastic engagement.
// No lumped mass, contact spring, pulse-width assumption, or production integration.
import { simulateNonUniformAxialWave } from './nonUniformAxialWave';

const need = (ok, message) => { if (!ok) throw Error(message); };
const positive = x => Number.isFinite(x) && x > 0;
// Histories are time ordered. Preserve the last <= sample (including repeated
// times), without allocating/scanning the entire history for every interval.
const at = (h, t) => {
  let lo = 0, hi = h.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (h[mid].timeS <= t) lo = mid + 1; else hi = mid; }
  return h[lo - 1];
};

// Exact representation change only: remove a boundary across which the initial
// travelling force is identical. Never merge different forces, gaps, directions
// or physical sections, and never round an event time or discard a small wave.
export function compactInitialWaves(waves) {
  return waves.reduce((out, wave) => {
    const last = out.at(-1);
    if (last && last.sectionId === wave.sectionId && last.direction === wave.direction &&
        last.forceN === wave.forceN && last.toM === wave.fromM) last.toM = wave.toM;
    else out.push({ ...wave });
    return out;
  }, []);
}
const eventCutoff = result => result.status === 'incomplete' && [
  'Processed event budget reached; no complete-result claim.',
  'INCOMPLETE: pending event budget reached.'
].includes(result.error);

// Restart only the affected wave phase from its original input. No histories or
// impact events from the abandoned attempt are carried into its replacement.
export function runSkeemWavePhase(input, phase, attempts, retryEnabled = false) {
  let result;
  for (const limit of retryEnabled ? [250000, 500000] : [250000]) {
    const retryReason = result?.error || null;
    result = simulateNonUniformAxialWave({ ...input, numerical: { ...input.numerical, maxEvents: limit, maxPendingEvents: limit } });
    attempts.push({ phase, durationS: input.durationS, eventLimit: limit, pendingEventLimit: limit,
      processedEvents: result.numerical?.processedEvents ?? null, pendingEventPeak: result.numerical?.maxQueue ?? null,
      completedThroughS: result.completedThroughS ?? null, retryReason, status: result.status, error: result.error || null });
    if (!eventCutoff(result)) break;
  }
  return result;
}
// Exact representation normalisation, never averaging unequal physical properties.
// Retain provenance while eliminating redundant zero-reflection section cuts.
function coalesce(sections) {
  return sections.reduce((out, s) => {
    const last = out.at(-1);
    if (last && ['areaM2', 'densityKgM3', 'youngsModulusPa'].every(k => last[k] === s[k])) {
      last.lengthM += s.lengthM; last.sourceSections.push({ id: s.id, lengthM: s.lengthM });
    } else out.push({ ...s, sourceSections: [{ id: s.id, lengthM: s.lengthM }] });
    return out;
  }, []);
}
function integrate(h, start, end) {
  const cuts = [start, ...h.map(x => x.timeS).filter(t => t > start && t < end), end];
  let signedNs = 0, tensileNs = 0;
  for (let i = 1; i < cuts.length; i++) {
    const F = at(h, (cuts[i] + cuts[i - 1]) / 2)?.forceN || 0, dt = cuts[i] - cuts[i - 1];
    signedNs += F * dt; tensileNs += Math.max(0, -F) * dt;
  }
  return { signedNs, tensileNs };
}
function snapshot(sections, interfaces, timeS, initialForceN) {
  return sections.flatMap((s, i) => ['down', 'up'].flatMap(direction => {
    const down = direction === 'down', c = Math.sqrt(s.youngsModulusPa / s.densityKgM3);
    const h = interfaces[down ? i : i + 1].history, key = down ? 'outgoingDownN' : 'outgoingUpN';
    const cuts = [...new Set([0, s.lengthM, ...h.map(e => down ? c * (timeS - e.timeS) : s.lengthM - c * (timeS - e.timeS)).filter(x => x > 0 && x < s.lengthM)])].sort((a, b) => a - b);
    return cuts.slice(1).flatMap((end, n) => {
      const fromM = cuts[n], x = (fromM + end) / 2, emitted = timeS - (down ? x : s.lengthM - x) / c;
      const forceN = emitted < 0 ? initialForceN : (at(h, emitted)?.[key] ?? initialForceN);
      return forceN === 0 ? [] : [{ sectionId: s.id, direction, fromM, toM: end, forceN }];
    });
  }));
}
export function calculateNonUniformSkeemUp(request) {
  const notice = 'PRELIMINARY — NOT FOR OPERATIONAL USE';
  const computation = { phaseAttempts: [], strokeSearches: [], preImpactHorizonS: null,
    strokeTravelAtCutoffM: null, strokeCutoffHorizonS: null, impactOccurred: false, impactTimeS: null };
  const audit = () => {
    const retryReasons = [...computation.phaseAttempts, ...computation.strokeSearches].map(a => a.retryReason).filter(Boolean);
    return { ...computation, retried: retryReasons.length > 0, retryReasons,
      processedEvents: computation.phaseAttempts.reduce((total, a) => total + (a.processedEvents || 0), 0),
      pendingEventPeak: computation.phaseAttempts.length ? Math.max(...computation.phaseAttempts.map(a => a.pendingEventPeak || 0)) : null };
  };
  const fail = (status, error, extra = {}) => ({ researchOnly: true, valid: false, status, error, metrics: null, notice, ...extra, computation: audit() });
  let physicalInputsValidated = false;
  try {
    const { localTensionN: F0, strokeM, upperSections, lowerSections, durationS, acknowledged } = request;
    need(acknowledged === true, 'Acknowledge the ideal release, stationary anvil and maintained-engagement assumptions.');
    need([F0, strokeM, durationS].every(positive) && durationS <= .2, 'Positive local tensile magnitude, stroke and duration <= 0.2 s required.');
    need(upperSections?.length && lowerSections?.length, 'Actual upper and lower elastic sections required, ordered from jar outward.');
    const raw = [...upperSections, ...lowerSections];
    need(new Set(raw.map(s => s.id)).size === raw.length && raw.every(s => typeof s.id === 'string' && s.id.trim() && s.kind === 'uniform-elastic' && ['lengthM', 'areaM2', 'densityKgM3', 'youngsModulusPa'].every(k => positive(s[k])) && !s.componentDefinition && !s.effectiveProperties && !s.geometry && !s.sectionModel), 'Unique IDs and positive explicit uniform elastic properties required; complex tools need the validated geometry adapter.');
    const upper = coalesce([...upperSections].reverse()), lower = coalesce(lowerSections), Z = s => s.areaM2 * Math.sqrt(s.youngsModulusPa * s.densityKgM3);
    need(Math.abs(Z(upper.at(-1)) - Z(lower[0])) <= 1e-10 * Z(lower[0]), 'Skeem Equation 4 requires equal local engagement impedances.');
    need(new Set([...upper, ...lower].map(s => s.id)).size === upper.length + lower.length, 'Section IDs must be unique.');
    let horizon = request.preImpactHorizonS ?? .2;
    need(positive(horizon) && horizon <= .2, 'Pre-impact search horizon must be <= 0.2 s.');
    physicalInputsValidated = true;
    const runPhase = (input, phase) => runSkeemWavePhase(input, phase, computation.phaseAttempts, request.computationalRetries === true);
    const initialWaves = upper.flatMap(s => ['down', 'up'].map(direction => ({ sectionId: s.id, direction, fromM: 0, toM: s.lengthM, forceN: -F0 / 2 })));
    const preInput = { model: 'research-linear-axial-waves', units: 'SI', sections: upper, durationS: horizon,
      boundaries: { left: 'matched', right: 'free' }, initialWaves, numerical: { delayPrecisionBits: request.delayPrecisionBits ?? 53 },
      boundaryExcitations: [{ boundary: 'left', history: [{ timeS: 0, forceN: -F0 / 2 }] }] };
    let motion;
    let displacementM = 0, impactTimeS = null, impactVelocityMS = null;
    // At most one horizon extension, only after a completed 100-ms search has
    // explicitly failed to close the stroke. The post-impact window is unchanged.
    const horizons = request.computationalRetries === true && horizon === .1 ? [.1, .2] : [horizon];
    for (const searchHorizon of horizons) {
      horizon = searchHorizon;
      computation.preImpactHorizonS = horizon;
      const search = { horizonS: horizon, strokeTravelM: null, impactOccurred: false, impactTimeS: null,
        retryReason: computation.strokeSearches.length ? 'Stroke closure unresolved within 100 ms' : null };
      computation.strokeSearches.push(search);
      const pre = runPhase({ ...preInput, durationS: horizon }, 'stroke-search');
      if (!pre.valid) return fail(pre.status, pre.error);
      motion = pre.interfaces.at(-1).history;
      displacementM = 0;
      for (let i = 0; i < motion.length; i++) {
        const a = motion[i], end = motion[i + 1]?.timeS ?? horizon, speed = -a.velocityMS;
        const travel = speed * (end - a.timeS);
        if (speed > 0 && displacementM + travel >= strokeM) {
          impactTimeS = a.timeS + (strokeM - displacementM) / speed; impactVelocityMS = speed;
          need(Math.abs(impactTimeS - end) > 1e-12 || end === horizon, 'Simultaneous impact and wave arrival needs explicit left-limit resolution.');
          break;
        }
        displacementM += travel;
      }
      Object.assign(search, { strokeTravelM: impactTimeS === null ? displacementM : strokeM,
        impactOccurred: impactTimeS !== null, impactTimeS });
      if (impactTimeS !== null) break;
      computation.strokeTravelAtCutoffM = displacementM;
      computation.strokeCutoffHorizonS = horizon;
    }
    if (impactTimeS === null) return fail('stroke-closure-unresolved', `Stroke closure unresolved within ${Math.round(horizon * 1000)} ms`);
    computation.impactOccurred = true; computation.impactTimeS = impactTimeS;
    const preAtImpact = runPhase({ ...preInput, durationS: impactTimeS }, 'impact-state');
    if (!preAtImpact.valid) return fail(preAtImpact.status, preAtImpact.error);
    const rawWaves = snapshot(upper, preAtImpact.interfaces, impactTimeS, -F0 / 2), waves = compactInitialWaves(rawWaves);
    computation.initialWaveIntervals = { raw: rawWaves.length, compacted: waves.length };
    const sections = [...upper, ...lower], impact = { impactTimeS, impactVelocityMS, initialImpactForceN: Z(lower[0]) * impactVelocityMS / 2, initialReleaseSpeedMS: F0 / Z(lower[0]) };
    const postInput = { model: 'research-linear-axial-waves', units: 'SI', sections, durationS,
      boundaries: { left: 'matched', right: 'fixed' }, initialWaves: waves, numerical: { delayPrecisionBits: request.delayPrecisionBits ?? 53 },
      boundaryExcitations: [{ boundary: 'left', history: [{ timeS: 0, forceN: -F0 / 2 }] }] };
    const post = runPhase(postInput, 'post-impact');
    if (!post.valid) return fail(post.status, post.error, { impact, completedThroughS: post.completedThroughS, diagnostics: post.numerical });
    const handoffResidualJ = post.energy[0].initialPhysicalJ - preAtImpact.energy.at(-1).physicalStoredJ;
    const energyLimitJ = 1e-12 + 1e-9 * Math.abs(preAtImpact.energy.at(-1).physicalStoredJ);
    need(Math.abs(handoffResidualJ) <= energyLimitJ, 'Pre/post impact wave-state energy does not reconcile.');
    const jar = post.interfaces[upper.length].history, stuck = post.interfaces.at(-1).history;
    need(Math.abs(jar[0].forceN + impact.initialImpactForceN) <= .01 + 1e-9 * impact.initialImpactForceN, 'Initial engagement does not reproduce Skeem Equation 4.');
    const violation = jar.find(p => p.forceN > 1e-8 + 1e-10 * F0);
    const diagnostics = { handoffResidualJ, energyLimitJ, pre: preAtImpact.numerical, post: post.numerical,
      maxEnergyResidualJ: Math.max(...preAtImpact.energy.map(e => Math.abs(e.residualJ)), ...post.energy.map(e => Math.abs(e.residualJ))) };
    const common = { researchOnly: true, notice, impact, diagnostics, motion, jarHistory: jar, stuckHistory: stuck, window: { startS: 0, endS: durationS },
      maintainedEngagement: { admissible: !violation, firstViolationS: violation?.timeS ?? null, compressionN: violation?.forceN ?? null } };
    if (violation) return fail('inadmissible-maintained-engagement', 'Bilateral engagement requires a force opposite to a compression-only Jar Up stop; force/impulse metrics suppressed.', common);
    return { ...common, valid: true, status: 'valid-idealised-research', computation: audit(), metrics: { peakTensileN: stuck.reduce((p, x) => Math.max(p, -x.forceN), 0), ...integrate(stuck, 0, durationS) } };
  } catch (e) { return fail('unsupported-or-invalid-input', e.message, { failureCategory: physicalInputsValidated ? 'numerical-failure' : 'invalid-input' }); }
}
