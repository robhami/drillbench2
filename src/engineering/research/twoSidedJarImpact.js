// RESEARCH ONLY: rigid through-housing + releasable internal hammer. No BHA/UI adapter.
import { createAxialWavePortNetwork } from './nonUniformAxialWave';

const notice = 'PRELIMINARY — NOT FOR OPERATIONAL USE';
const finite = x => typeof x === 'number' && Number.isFinite(x);
const positive = x => finite(x) && x > 0;
const bad = (status, error) => ({ valid: false, complete: false, status, error, metrics: null, notice });
const zero = () => ({ energyJ: 0, momentumKgMS: 0, exportedEnergyJ: 0, injectedEnergyJ: 0, externalImpulseNs: 0, integratedComplianceM: 0, farDisplacementM: 0 });

function run(input) {
  if (input?.model !== 'research-two-sided-rigid-housing' || input.units !== 'SI') return bad('invalid-physical-inputs', 'Explicit research model and SI units required.');
  if (input.mechanism !== 'ideal-rigid-through-housing' || input.equilibrium?.kind !== 'uniform-self-equilibrated' ||
    ['bha', 'hydraulics', 'friction', 'damping', 'gravity', 'staticProfile', 'initialWaves', 'movingHousingMassKg', 'staticPreloadN', 'initialContact', 'releaseThresholdN'].some(k => input[k] !== undefined) ||
    Object.keys(input.equilibrium).some(key => !['kind', 'axialForceN'].includes(key))) return bad('unsupported-model-configuration', 'Only the ideal massless rigid through-housing, uniform preload, and declared release state are supported.');
  const M = input.hammerMassKg, k = input.contactStiffnessNm, stroke = input.strokeM, P = input.equilibrium.axialForceN;
  const q = input.direction === 'down' ? 1 : input.direction === 'up' ? -1 : 0, release = input.release;
  const opt = { timeStepS: 1e-6, maxSteps: 100000, maxHistoryCells: 2000000, eventTimeToleranceS: 1e-12,
    energyRelativeTolerance: 3e-5, energyAbsoluteToleranceJ: 1e-10, momentumRelativeTolerance: 3e-5, momentumAbsoluteToleranceNs: 1e-10, ...input.numerical };
  if (![M, k, input.durationS, opt.timeStepS, opt.eventTimeToleranceS, opt.energyRelativeTolerance, opt.energyAbsoluteToleranceJ, opt.momentumRelativeTolerance, opt.momentumAbsoluteToleranceNs].every(positive) || !finite(stroke) || stroke < 0 || !finite(P) || !q || !release ||
    !(release.timeS === null || (finite(release.timeS) && release.timeS >= 0 && release.timeS <= input.durationS)) || !finite(release.relativeVelocityMS) || release.relativeVelocityMS < 0 ||
    !Number.isSafeInteger(opt.maxSteps) || opt.maxSteps < 1 || opt.maxSteps > 1000000 || !Number.isSafeInteger(opt.maxHistoryCells) || opt.maxHistoryCells < 10 || opt.maxHistoryCells > 20000000) return bad('invalid-physical-inputs', 'Invalid mass, stiffness, stroke, preload, release state or numerical controls.');
  if (release.timeS === null && release.relativeVelocityMS !== 0) return bad('invalid-physical-inputs', 'Unreleased latch cannot have a release velocity.');
  if (!input.upper && P !== 0) return bad('unsupported-model-configuration', 'Nonzero through-preload requires both connections.');
  const source = (config, t) => {
    const h = config?.incidentHistory || [];
    if (!h.length || t < h[0].timeS) return 0;
    let lo = 0, hi = h.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (h[m].timeS <= t) lo = m + 1; else hi = m; }
    const a = h[lo - 1], b = h[lo]; return b ? a.forceN + (b.forceN - a.forceN) * (t - a.timeS) / (b.timeS - a.timeS) : a.forceN;
  };
  let upper, lower;
  try {
    for (const config of [input.upper, input.lower].filter(Boolean)) {
      const h = config.incidentHistory || [];
      if (!Array.isArray(h) || h.length > 4096 || h.some((x, i) => !finite(x.timeS) || x.timeS < 0 || x.timeS > input.durationS || !finite(x.forceN) || (i && x.timeS <= h[i - 1].timeS)) ||
        (h.length && (config.farBoundary !== 'matched' || h[0].timeS !== 0 || h[0].forceN !== 0))) throw Error('Incident history requires a matched far boundary, increasing finite times and initially zero excitation.');
    }
    const make = config => createAxialWavePortNetwork({ sections: config.sections, probes: config.probes, rightBoundary: config.farBoundary, durationS: input.durationS });
    lower = make(input.lower); if (input.upper) upper = make(input.upper);
  } catch (e) { return bad('invalid-physical-inputs', e.message); }
  const Zu = upper?.contactImpedanceNsM || 0, Zl = lower.contactImpedanceNsM, Z = Zu + Zl;
  const preloadEnergyJ = [upper, lower].filter(Boolean).flatMap(n => n.sections).reduce((sum, s) => sum + P * P * s.lengthM / (2 * s.rigidityN), 0);
  if (![Z, preloadEnergyJ].every(finite)) return bad('invalid-physical-inputs', 'Derived energy/impedance exceeds numerical range.');
  let t = 0, xh = 0, vh = 0, X = 0, V = 0, delta = -stroke, latched = true, active = false, everContact = false;
  let releaseWorkJ = 0, releaseImpulseNs = 0, contactImpulseNs = 0, step = 0, maxStepS = 0, maxEnergy = 0, maxPhysical = 0, maxMomentum = 0;
  let incomplete = '', numerical = '', nodesU = [], nodesL = [], energyScale = 0, momentumScale = 0;
  const histories = [], energy = [], events = [], waves = [];
  function incoming(time, left = false) { const ru = upper ? upper.incoming(time, left) : 0, rl = lower.incoming(time, left); return { ru, rl, B: 2 * (ru - rl) }; }
  function commit(jump = false) {
    const N = active ? k * Math.max(0, delta) : 0, { ru, rl, B } = incoming(t);
    V = latched ? vh : (B + q * N) / Z;
    const Cu = 2 * ru - Zu * V, Cl = 2 * rl + Zl * V;
    const left = incoming(t, true), leftV = latched ? vh : (left.B + q * N) / Z;
    if (upper) nodesU = upper.commit(t, Cu, source(input.upper, t), jump, 2 * left.ru - Zu * leftV);
    nodesL = lower.commit(t, Cl, source(input.lower, t), jump, 2 * left.rl + Zl * leftV);
    return { N, Cu, Cl };
  }
  function save() {
    const a = upper ? upper.accounting() : zero(), b = lower.accounting(), N = active ? k * Math.max(0, delta) : 0;
    const waveJ = a.energyJ + b.energyJ, injected = a.injectedEnergyJ + b.injectedEnergyJ, exported = a.exportedEnergyJ + b.exportedEnergyJ;
    const kinetic = M * vh * vh / 2, spring = k * Math.max(0, delta) ** 2 / 2;
    const cross = P * (a.integratedComplianceM + b.integratedComplianceM), preloadWork = -P * (a.farDisplacementM + b.farDisplacementM);
    const residual = kinetic + spring + waveJ + exported - injected - releaseWorkJ;
    const physicalResidual = residual + cross - preloadWork;
    const externalImpulse = b.externalImpulseNs - a.externalImpulseNs + releaseImpulseNs;
    const momentumResidual = M * vh + b.momentumKgMS - a.momentumKgMS - externalImpulse;
    energyScale = Math.max(energyScale, Math.abs(releaseWorkJ) + injected);
    momentumScale = Math.max(momentumScale, Math.abs(releaseImpulseNs) + Math.abs(a.externalImpulseNs) + Math.abs(b.externalImpulseNs));
    maxEnergy = Math.max(maxEnergy, Math.abs(residual)); maxPhysical = Math.max(maxPhysical, Math.abs(physicalResidual)); maxMomentum = Math.max(maxMomentum, Math.abs(momentumResidual));
    const Cu = upper ? nodesU[0].forceN : 0, Cl = nodesL[0].forceN;
    histories.push({ timeS: t, state: latched ? 'latched' : active ? 'contact' : everContact ? 'separated' : 'free-travel',
      housingDisplacementM: X, housingVelocityMS: V, hammerDisplacementM: xh, hammerVelocityMS: vh, strokePositionM: q * (xh - X),
      compressionM: Math.max(0, delta), gapM: Math.max(0, -delta), contactForceN: N, upperDynamicForceN: Cu, lowerDynamicForceN: Cl,
      upperTotalForceN: P + Cu, lowerTotalForceN: P + Cl, stuckDynamicForceN: input.lower.farBoundary === 'fixed' ? nodesL.at(-1).forceN : null,
      stuckTotalForceN: input.lower.farBoundary === 'fixed' ? P + nodesL.at(-1).forceN : null });
    energy.push({ timeS: t, hammerKineticJ: kinetic, contactSpringJ: spring, upperWaveJ: a.energyJ, lowerWaveJ: b.energyJ, exportedEnergyJ: exported, incidentEnergyJ: injected,
      initialPreloadEnergyJ: preloadEnergyJ, preloadCrossEnergyJ: cross, preloadBoundaryWorkJ: preloadWork, releaseWorkJ, releaseImpulseNs, residualJ: residual, physicalResidualJ: physicalResidual, momentumResidualNs: momentumResidual });
    waves.push({ timeS: t, upper: nodesU, lower: nodesL, upperProbes: upper ? upper.observe() : [], lowerProbes: lower.observe() });
  }
  function doRelease() {
    const before = vh, beforeHousing = V; vh = V + q * release.relativeVelocityMS;
    releaseWorkJ += M * (vh * vh - before * before) / 2; releaseImpulseNs += M * (vh - before);
    latched = false; active = delta === 0 && q * (vh - V) > 0;
    events.push({ type: 'release', timeS: t, workJ: releaseWorkJ, externalImpulseNs: releaseImpulseNs });
    if (active) { everContact = true; events.push({ type: 'contact', timeS: t }); }
    commit(true);
    Object.assign(events.find(e => e.type === 'release'), { hammerVelocityBeforeMS: before, hammerVelocityAfterMS: vh, housingVelocityBeforeMS: beforeHousing, housingVelocityAfterMS: V });
  }
  commit(); if (release.timeS === 0) doRelease(); save();
  function trial(h) {
    const { B } = incoming(t + h / 2);
    if (latched) {
      const v = (vh * (1 - h * Z / (2 * M)) + h * B / M) / (1 + h * Z / (2 * M));
      return { v, d: -stroke, dx: h * (vh + v) / 2, jointDx: h * (vh + v) / 2, Nmid: 0 };
    }
    const w = q * vh, beta = q * B / Z;
    const d = active ? (delta * (1 - h * k / (2 * Z) - h * h * k / (4 * M)) + h * (w - beta)) /
      (1 + h * k / (2 * Z) + h * h * k / (4 * M)) : delta + h * (w - beta);
    const Nmid = active ? k * (delta + d) / 2 : 0, v = vh - q * h * Nmid / M, dx = h * (vh + v) / 2;
    return { v, d, dx, jointDx: dx - q * (d - delta), Nmid };
  }
  const shortest = Math.min(upper?.minimumDelayS || Infinity, lower.minimumDelayS);
  while (t < input.durationS) {
    if (step >= opt.maxSteps || (step + 2) * (16 + (input.upper?.probes?.length || 0) + (input.lower?.probes?.length || 0) + 2 * ((upper?.sections.length || 0) + lower.sections.length)) > opt.maxHistoryCells) { incomplete = 'Step/history budget reached.'; break; }
    let h = Math.min(opt.timeStepS, shortest / 2, input.durationS - t);
    h = Math.min(h, (upper?.nextDiscontinuityTimeS() ?? Infinity) - t, lower.nextDiscontinuityTimeS() - t);
    if (latched && release.timeS !== null) h = Math.min(h, release.timeS - t);
    for (const config of [input.upper, input.lower].filter(Boolean)) for (const point of config.incidentHistory || []) if (point.timeS > t) { h = Math.min(h, point.timeS - t); break; }
    if ((latched ? h * Z / M : Math.max(h * Math.sqrt(k / M), h * k / Z)) > .1) { numerical = 'Time step does not resolve latch/contact scales.'; break; }
    let next = trial(h), crossing = !latched && ((active && next.d < 0) || (!active && delta < 0 && next.d > 0));
    if (crossing) {
      let lo = 0, hi = h;
      for (let i = 0; i < 64 && hi - lo > opt.eventTimeToleranceS; i++) { const mid = (lo + hi) / 2, d = trial(mid).d;
        if (active ? d > 0 : d < 0) lo = mid; else hi = mid; }
      h = (lo + hi) / 2; next = trial(h); next.d = 0; next.jointDx = next.dx - q * (next.d - delta);
    }
    if (!(h > 0 && t + h > t) || ![next.v, next.d, next.dx, next.jointDx].every(finite)) { numerical = 'Nonfinite state or unresolved event.'; break; }
    xh += next.dx; X += next.jointDx; vh = next.v; delta = next.d; t += h; step++; maxStepS = Math.max(maxStepS, h); contactImpulseNs += h * next.Nmid;
    if (crossing) { active = !active; events.push({ type: active ? everContact ? 'recontact' : 'contact' : 'separation', timeS: t }); if (active) everContact = true; }
    try { commit();
      if (latched && release.timeS !== null && Math.abs(t - release.timeS) < 1e-15 * Math.max(1, t)) doRelease();
    } catch (e) { if (e.message.includes('budget')) incomplete = e.message; else numerical = e.message; break; }
    save();
  }
  const energyOk = maxEnergy <= opt.energyAbsoluteToleranceJ + opt.energyRelativeTolerance * energyScale;
  const physicalOk = maxPhysical <= opt.energyAbsoluteToleranceJ + opt.energyRelativeTolerance * energyScale;
  const momentumOk = maxMomentum <= opt.momentumAbsoluteToleranceNs + opt.momentumRelativeTolerance * momentumScale;
  const status = incomplete ? 'incomplete-simulation' : numerical ? 'numerical-nonconvergence' : !(energyOk && physicalOk) ? 'energy-accounting-failure' : !momentumOk ? 'momentum-accounting-failure' : 'valid-research-result';
  const valid = status === 'valid-research-result';
  let peak = 0, stuckPeak = 0, stuckImpulse = 0;
  histories.forEach((row, i) => { peak = Math.max(peak, row.contactForceN); stuckPeak = Math.max(stuckPeak, Math.abs(row.stuckDynamicForceN || 0));
    if (i && row.stuckTotalForceN !== null) stuckImpulse += (row.timeS - histories[i - 1].timeS) * (row.stuckTotalForceN + histories[i - 1].stuckTotalForceN) / 2; });
  return { valid, complete: !incomplete && !numerical, status, error: incomplete || numerical || (!energyOk || !physicalOk ? 'Incremental/physical energy residual exceeds tolerance.' : !momentumOk ? 'Momentum residual exceeds tolerance.' : ''), notice,
    histories, waves, energy, events, metrics: valid ? { peakContactForceN: peak, peakAbsoluteDynamicStuckForceN: input.lower.farBoundary === 'fixed' ? stuckPeak : null, contactImpulseNs,
      totalSignedStuckImpulseNs: input.lower.farBoundary === 'fixed' ? stuckImpulse : null, dynamicSignedStuckImpulseNs: input.lower.farBoundary === 'fixed' ? stuckImpulse - P * t : null,
      impulseIntervalS: [0, input.durationS], primaryImpulse: { status: 'indeterminate', reason: 'No unique primary terminator in this two-sided network.' } } : null,
    numerical: { steps: step, maxStepS, completedThroughS: t, maxIncrementalEnergyResidualJ: maxEnergy, maxPhysicalEnergyResidualJ: maxPhysical, maxMomentumResidualNs: maxMomentum, energyScaleJ: energyScale },
    initialPreloadEnergyJ: preloadEnergyJ, staticReference: { axialForceN: P, housingForceBalanceN: 0,
      sections: [upper, lower].filter(Boolean).map(net => net.sections.map(s => ({ id: s.id, strain: -P / s.rigidityN, storedElasticEnergyJ: P * P * s.lengthM / (2 * s.rigidityN) }))) },
    coordinateConvention: 'Global x positive down; upper network local coordinate points from jar toward surface; lower local coordinate points down toward stuck boundary.',
    scope: 'Ideal massless rigid through-housing with releasable internal hammer; no real jar release prediction.' };
}

export function simulateTwoSidedJarImpact(input) {
  const coarse = run(input);
  if (!coarse.valid) return coarse;
  const numerical = input.numerical || {};
  const limits = { forceAbsoluteN: .01, impulseAbsoluteNs: 1e-5, relative: .001, eventTimeS: 1e-6, ...input.convergence };
  if (!Object.values(limits).every(positive)) return bad('invalid-physical-inputs', 'Convergence tolerances must be finite positive values.');
  const fine = run({ ...input, numerical: { ...numerical, timeStepS: coarse.numerical.maxStepS / 2 } });
  if (!fine.valid) return { ...fine, numerical: { ...fine.numerical, convergence: { status: 'failed-refined-run' } } };
  const differences = ['peakContactForceN', 'peakAbsoluteDynamicStuckForceN', 'contactImpulseNs', 'dynamicSignedStuckImpulseNs'].map(key => ({ key,
    difference: Math.abs((fine.metrics[key] || 0) - (coarse.metrics[key] || 0)), limit: (/Impulse/.test(key) ? limits.impulseAbsoluteNs : limits.forceAbsoluteN) + limits.relative * Math.abs(fine.metrics[key] || 0) }));
  const sameEvents = coarse.events.length === fine.events.length && coarse.events.every((e, i) => e.type === fine.events[i].type && Math.abs(e.timeS - fine.events[i].timeS) <= limits.eventTimeS);
  const converged = sameEvents && differences.every(d => d.difference <= d.limit);
  return { ...fine, valid: converged, status: converged ? fine.status : 'numerical-nonconvergence', error: converged ? '' : 'Refinement metrics/events exceed declared tolerances.', metrics: converged ? fine.metrics : null,
    numerical: { ...fine.numerical, requestedCoarseTimeStepS: numerical.timeStepS || 1e-6, convergence: { status: converged ? 'passed-two-resolution-check' : 'failed', differences, sameEvents, limits } } };
}
