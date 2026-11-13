// RESEARCH ONLY. Mode A analogue adapter; production dynamics/fixtures untouched.
import { simulateTwoSidedJarImpact } from './twoSidedJarImpact';
import { calcStraightDrag } from '../forces/calcStraightDrag';

const LBF = 4.4482216152605, FT = .3048;
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const need = (ok, message) => { if (!ok) throw Error(message); };
function material(c) {
  need(c && typeof c.id === 'string' && ['lengthM', 'densityKgM3', 'youngsModulusPa', 'odM'].every(k => positive(c[k])) && Number.isFinite(c.idM) && c.idM >= 0 && c.odM > c.idM, 'Explicit valid hypothetical geometry/material required.');
  return { ...c, areaM2: c.effectiveBodyAreaM2 ?? Math.PI / 4 * (c.odM ** 2 - c.idM ** 2) };
}
export function buildJarPositionCase(config, lowerLengthM) {
  need(config.mode === 'A', 'Only Mode A relocation is implemented; B/C must not be relabelled as relocation.');
  need(config.staticTreatment === 'perturbation-only-with-static-context', 'Distributed prestressed dynamics are unsupported; explicitly declare perturbation-only static context.');
  need(Array.isArray(config.collars) && config.collars.length && Array.isArray(config.aboveCollars), 'Ordered collar and upper-body inventory required.');
  const inventory = config.collars.map(material), above = config.aboveCollars.map(material), jar = material(config.jar);
  need([jar.areaM2, jar.hammerMassKg, jar.impactVelocityMS, jar.contactStiffnessNm, config.gravityMS2, config.durationS].every(positive), 'Positive impact, effective-area and operating inputs required.');
  need(Number.isFinite(config.wobN) && config.wobN >= 0, 'Nonnegative explicit static WOB required.');
  const totalCollars = inventory.reduce((a, c) => a + c.lengthM, 0);
  need(positive(lowerLengthM) && lowerLengthM < totalCollars, 'Position must leave positive collar inventory on both sides.');
  const below = [], upper = []; let remaining = lowerLengthM;
  inventory.forEach(c => {
    const take = Math.min(Math.max(remaining, 0), c.lengthM);
    if (take > 1e-10) below.push({ ...c, id: c.id + '-below', lengthM: take });
    if (c.lengthM - take > 1e-10) upper.push({ ...c, id: c.id + '-above', lengthM: c.lengthM - take });
    remaining -= take;
  });
  const components = [...below, jar, ...upper, ...above];
  let x = 0;
  const positions = components.map(c => {
    const kgPerM = c.areaM2 * c.densityKgM3 + (c.id === jar.id ? jar.hammerMassKg / jar.lengthM : 0);
    const row = { ...c, length: c.lengthM / FT, startFromBit: x / FT, endFromBit: (x + c.lengthM) / FT, od: c.odM / .0254,
      nominalWeightNPerM: kgPerM * config.gravityMS2, buoyedWeight: kgPerM * config.gravityMS2 * c.lengthM / LBF };
    x += c.lengthM; return row;
  });
  const staticResult = calcStraightDrag({ bha: { inclination: 0, wob: config.wobN / (1000 * LBF), frictionCoefficient: 0 }, positions: { components: positions } }, 'reference', 0);
  need(staticResult.valid, staticResult.error || 'Static calculation failed.');
  const profile = staticResult.components.map(c => ({ id: c.id, fromBitM: c.startFromBit * FT, lengthM: c.lengthM,
    bottomForceN: c.bottomAxialForce * LBF, topForceN: c.topAxialForce * LBF, axialWeightN: c.gravityAxial * LBF,
    referenceStrainEnergyJ: c.lengthM * ((c.bottomAxialForce * LBF) ** 2 + c.bottomAxialForce * c.topAxialForce * LBF ** 2 + (c.topAxialForce * LBF) ** 2) / (6 * c.areaM2 * c.youngsModulusPa) }));
  const j = profile.find(c => c.id === jar.id), jarPositionM = lowerLengthM + jar.lengthM / 2;
  const elastic = c => ({ id: c.id, kind: 'uniform-elastic', lengthM: c.lengthM, areaM2: c.areaM2, densityKgM3: c.densityKgM3, youngsModulusPa: c.youngsModulusPa });
  const lowerSections = [elastic({ ...jar, id: 'jar-lower-effective-body', lengthM: jar.lengthM / 2 }), ...below.slice().reverse().map(elastic)];
  const upperSections = [elastic({ ...jar, id: 'jar-upper-effective-body', lengthM: jar.lengthM / 2 }), ...upper.map(elastic), ...above.map(elastic)];
  const firstArrivalS = lowerSections.reduce((s, c) => s + c.lengthM / Math.sqrt(c.youngsModulusPa / c.densityKgM3), 0);
  return { config, lowerLengthM, jarPositionM, totalCollarsM: totalCollars, totalStringLengthM: x, components: positions, staticProfile: profile,
    staticJarForceN: (j.bottomForceN + j.topForceN) / 2, staticHookloadN: -staticResult.topOfBhaAxialForce * LBF,
    firstArrivalS, input: { model: 'research-two-sided-rigid-housing', units: 'SI', mechanism: 'ideal-rigid-through-housing', direction: 'up',
      equilibrium: { kind: 'uniform-self-equilibrated', axialForceN: 0 }, hammerMassKg: jar.hammerMassKg, contactStiffnessNm: jar.contactStiffnessNm, strokeM: 0,
      release: { timeS: 0, relativeVelocityMS: jar.impactVelocityMS }, upper: { sections: upperSections, farBoundary: 'matched' },
      lower: { sections: lowerSections, farBoundary: 'fixed' }, durationS: config.durationS, numerical: config.numerical, convergence: config.convergence } };
}

export function assessDistributedStaticContext(profile) {
  if (!Array.isArray(profile) || !profile.length) return { valid: false, error: 'Nonempty piecewise static profile required.' };
  let end = 0, previous = null, residualN = 0;
  for (const r of profile) {
    if (![r.fromBitM, r.lengthM, r.bottomForceN, r.topForceN, r.axialWeightN, r.referenceStrainEnergyJ].every(Number.isFinite) || r.lengthM <= 0 || r.referenceStrainEnergyJ < 0 || Math.abs(r.fromBitM - end) > 1e-8) return { valid: false, error: 'Invalid/discontinuous static geometry or properties.' };
    residualN = Math.max(residualN, Math.abs(r.bottomForceN - r.topForceN - r.axialWeightN), previous === null ? 0 : Math.abs(r.bottomForceN - previous));
    previous = r.topForceN; end = r.fromBitM + r.lengthM;
  }
  return { valid: residualN <= 1e-6, equilibriumResidualN: residualN, source: 'calcStraightDrag, vertical reference, dry nominal weights',
    supportedDynamically: false, treatment: 'Static context only; wave simulation has zero preload and zero initial increments. No preload-energy release/body-force coupling claimed.',
    initialReferenceStrainEnergyJ: profile.reduce((s, c) => s + c.referenceStrainEnergyJ, 0), bitForceN: profile[0].bottomForceN, surfaceForceN: profile.at(-1).topForceN };
}

export function firstTensileLobe(histories, arrivalS) {
  let start = null, impulseNs = 0, peakN = 0;
  for (let i = 1; i < histories.length; i++) {
    const a = histories[i - 1], b = histories[i], fa = a.stuckDynamicForceN, fb = b.stuckDynamicForceN;
    if (b.timeS < arrivalS || fa === null || fb === null) continue;
    if (start === null && fb < 0) start = Math.max(arrivalS, fa > 0 ? a.timeS - fa * (b.timeS - a.timeS) / (fb - fa) : a.timeS);
    if (start === null) continue;
    let lo = Math.max(start, a.timeS), hi = b.timeS;
    if (hi <= lo) continue;
    const slope = (fb - fa) / (b.timeS - a.timeS), flo = fa + slope * (lo - a.timeS);
    if (fb >= 0 && fa < 0) hi = a.timeS - fa / slope;
    const fhi = fa + slope * (hi - a.timeS);
    impulseNs -= (hi - lo) * (flo + fhi) / 2; peakN = Math.max(peakN, -flo, -fhi);
    if (fb >= 0 && fa < 0) return { status: 'complete-first-tensile-lobe', startS: start, endS: hi, magnitudeImpulseNs: impulseNs, peakTensileN: peakN,
      definition: 'First contiguous tensile force excursion from causal first arrival to first zero crossing; not the Skeem primary window.' };
  }
  return { status: 'indeterminate', reason: 'First tensile lobe not closed inside the simulated interval; no impulse ranking permitted.' };
}

export function compareJarPosition(config, lowerLengthM) {
  let c;
  try { c = buildJarPositionCase(config, lowerLengthM); } catch (e) { return { valid: false, status: 'invalid-input', error: e.message, metrics: null }; }
  const context = assessDistributedStaticContext(c.staticProfile);
  if (!context.valid) return { valid: false, status: 'invalid-static-context', error: context.error || 'Static force balance fails.', metrics: null };
  const r = simulateTwoSidedJarImpact(c.input);
  if (!r.valid) return { valid: false, status: r.status, error: r.error, metrics: null, numerical: r.numerical, jarPositionM: c.jarPositionM };
  const primary = firstTensileLobe(r.histories, c.firstArrivalS), separation = r.events.find(e => e.type === 'separation'), contact = r.events.find(e => e.type === 'contact');
  const rebound = separation ? r.histories.find(h => h.timeS >= separation.timeS) : null;
  return { valid: true, status: 'valid-research-comparison', analogue: true, mode: 'A', jarPositionM: c.jarPositionM, lowerCollarLengthM: lowerLengthM,
    baseline: lowerLengthM === config.baselineLowerCollarLengthM, totalStringLengthM: c.totalStringLengthM, totalCollarsM: c.totalCollarsM,
    lowerStringLengthM: c.input.lower.sections.reduce((s, row) => s + row.lengthM, 0), upperStringLengthM: c.input.upper.sections.reduce((s, row) => s + row.lengthM, 0),
    components: c.components, staticProfile: c.staticProfile, staticContext: context, staticJarForceN: c.staticJarForceN, staticHookloadN: c.staticHookloadN,
    impactVelocityMS: config.jar.impactVelocityMS, hammerMassKg: config.jar.hammerMassKg, contactStiffnessNm: config.jar.contactStiffnessNm,
    metrics: { maximumContactForceN: r.metrics.peakContactForceN, maximumStuckForceMagnitudeN: r.metrics.peakAbsoluteDynamicStuckForceN,
      primaryImpulse: primary, totalSignedStuckImpulseNs: r.metrics.dynamicSignedStuckImpulseNs, contactDurationS: separation && contact ? separation.timeS - contact.timeS : null,
      hammerReboundGlobalVelocityMS: rebound?.hammerVelocityMS ?? null, energyResidualJ: r.numerical.maxIncrementalEnergyResidualJ },
    numerical: r.numerical, firstArrivalS: c.firstArrivalS, contactEvents: r.events,
    trace: r.histories.filter((_, i) => i % Math.max(1, Math.ceil(r.histories.length / 1600)) === 0) };
}

export function rankJarPositions(results, limits) {
  const valid = results.filter(r => r.valid && r.metrics);
  const peak = valid.slice().sort((a, b) => b.metrics.maximumStuckForceMagnitudeN - a.metrics.maximumStuckForceMagnitudeN);
  const impulse = valid.filter(r => r.metrics.primaryImpulse.status === 'complete-first-tensile-lobe').sort((a, b) => b.metrics.primaryImpulse.magnitudeImpulseNs - a.metrics.primaryImpulse.magnitudeImpulseNs);
  const ties = (rows, get, abs) => rows.length ? rows.filter(r => get(rows[0]) - get(r) <= abs + limits.relative * get(rows[0])).map(r => r.jarPositionM) : [];
  return { peakBestPositionM: peak[0]?.jarPositionM ?? null, impulseBestPositionM: impulse[0]?.jarPositionM ?? null,
    peakIndistinguishablePositionsM: ties(peak, r => r.metrics.maximumStuckForceMagnitudeN, limits.absoluteForceN), impulseIndistinguishablePositionsM: ties(impulse, r => r.metrics.primaryImpulse.magnitudeImpulseNs, limits.absoluteImpulseNs),
    scope: 'Only tested valid positions, fixed hypothetical impact assumptions; no operational optimum.' };
}
