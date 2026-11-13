// RESEARCH ONLY. Not imported by production UI/solvers. Not a tool prediction.
// Newly derived guided-rod, ideal-latch, bilateral-fixed-boundary early-impact
// problem using Skeem's wave method; NOT a published Skeem Jar Down equation.
// See docs/ValidationStudies/SkeemJarDownDerivationStage5C8.md.
export const EARLY_DOWN_NOTICE = 'PRELIMINARY — NOT FOR OPERATIONAL USE';
const fail = error => ({ valid: false, researchOnly: true, productionAvailable: false, notice: EARLY_DOWN_NOTICE, error });
const positive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;

function rod(p) {
  if (!p || !['lengthFt', 'areaIn2', 'youngsModulusPsi', 'densitySlugFt3'].every(k => positive(p[k]))) return null;
  const EA = p.youngsModulusPsi * p.areaIn2;
  const c = Math.sqrt(144 * p.youngsModulusPsi / p.densitySlugFt3);
  const Z = EA / c, mu = p.densitySlugFt3 * p.areaIn2 / 144;
  const travelS = p.lengthFt / c;
  if (![EA, c, Z, mu, travelS].every(positive)) return null;
  return { ...p, EA, waveSpeedFtS: c, impedanceLbfSPerFt: Z, massPerFtSlug: mu, travelS };
}

export function deriveEarlyJarDown(input) {
  if (!input || input.model !== 'ideal-guided-early-impact') return fail('Explicit ideal guided-rod research model identification is required.');
  if (!positive(input.compressionLbf) || !positive(input.strokeIn)) return fail('Positive pre-latch compression and free stroke are required; zero load/travel has no defined impact window here.');
  if (typeof input.gravityFtS2 !== 'number' || !Number.isFinite(input.gravityFtS2) || input.gravityFtS2 < 0) return fail('Specify nonnegative axial gravity explicitly.');
  if (['survey', 'frictionCoefficient', 'lowerCollarWeightLbf', 'pumpOpenForceLbf'].some(k => input[k] !== undefined)) return fail('Survey, friction, catalog-weight and hydraulic corrections are outside this research problem.');
  const upper = rod(input.upper), lower = rod(input.lower), pipe = rod(input.pipe);
  if (!upper || !lower || !pipe) return fail('Every rod needs finite positive length, area, modulus and mass density in the documented units.');
  const P = input.compressionLbf, g = input.gravityFtS2, strokeFt = input.strokeIn / 12;
  const Zu = upper.impedanceLbfSPerFt, Zl = lower.impedanceLbfSPerFt, Zp = pipe.impedanceLbfSPerFt;
  const lambda = (Zu - Zp) / (Zu + Zp);
  if (!(lambda > 0 && lambda < 1)) return fail('This primary-window derivation requires pipe impedance strictly smaller than upper-collar impedance.');
  const hammerVelocityFtS = P / Zu, anvilVelocityFtS = -P / Zl;
  const relativeImpactVelocityFtS = hammerVelocityFtS - anvilVelocityFtS;
  const impactTimeS = strokeFt / relativeImpactVelocityFtS;
  const upperReturnS = 2 * upper.travelS, lowerReturnS = 2 * lower.travelS;
  const surfaceReturnS = upperReturnS + 2 * pipe.travelS;
  const motionHorizonS = impactTimeS + upperReturnS;
  const tolerance = 128 * Number.EPSILON * Math.max(upperReturnS, lowerReturnS, surfaceReturnS);
  if (!(impactTimeS > tolerance && impactTimeS < upperReturnS - tolerance)) return fail('Impact must precede the first upper-interface return; coincident/late impact is outside this derivation.');
  if (!(motionHorizonS < lowerReturnS - tolerance && motionHorizonS < surfaceReturnS - tolerance)) return fail('Lower or surface returns can interfere with the derived primary signal; no result is extrapolated.');
  const incidentCompressionLbf = relativeImpactVelocityFtS / (1 / Zu + 1 / Zl);
  const transmittedReleaseIncrementLbf = 2 * lambda * P * Zl / (Zu + Zl);
  const stuckStepLbf = 2 * transmittedReleaseIncrementLbf;
  const commonVelocityFtS = 2 * lambda * P / (Zu + Zl);
  const weightLbf = lower.massPerFtSlug * lower.lengthFt * g;
  const preReleaseStuckCompressionLbf = P + weightLbf;
  const releasedNoImpactStuckCompressionLbf = weightLbf - P;
  const firstImpactArrivalS = impactTimeS + lower.travelS;
  const releaseReflectionArrivalS = upperReturnS + lower.travelS;
  const impactReliefArrivalS = motionHorizonS + lower.travelS;
  const hammerAtImpactFt = hammerVelocityFtS * impactTimeS;
  const anvilAtImpactFt = anvilVelocityFtS * impactTimeS;
  const intervals = [
    { startS: firstImpactArrivalS, endS: releaseReflectionArrivalS, totalCompressionLbf: preReleaseStuckCompressionLbf },
    { startS: releaseReflectionArrivalS, endS: impactReliefArrivalS, totalCompressionLbf: preReleaseStuckCompressionLbf + stuckStepLbf }
  ];
  const primaryTotalImpulseLbfS = intervals.reduce((sum, i) => sum + (i.endS - i.startS) * i.totalCompressionLbf, 0);
  const motionIntervals = [
    { startS: 0, endS: impactTimeS, hammerStartFt: 0, anvilStartFt: 0, hammerVelocityFtS, anvilVelocityFtS, contactForceLbf: 0 },
    { startS: impactTimeS, endS: upperReturnS, hammerStartFt: hammerAtImpactFt, anvilStartFt: anvilAtImpactFt,
      hammerVelocityFtS: 0, anvilVelocityFtS: 0, contactForceLbf: P },
    { startS: upperReturnS, endS: motionHorizonS, hammerStartFt: hammerAtImpactFt, anvilStartFt: anvilAtImpactFt,
      hammerVelocityFtS: commonVelocityFtS, anvilVelocityFtS: commonVelocityFtS, contactForceLbf: P + transmittedReleaseIncrementLbf }
  ];
  const result = {
    valid: true, researchOnly: true, productionAvailable: false, notice: EARLY_DOWN_NOTICE,
    upper, lower, pipe, lambda, incidentCompressionLbf, hammerVelocityFtS, anvilVelocityFtS, relativeImpactVelocityFtS,
    impactTimeS, hammerAtImpactFt, anvilAtImpactFt, motionHorizonS, motionIntervals,
    firstImpactArrivalS, releaseReflectionArrivalS, impactReliefArrivalS, primaryDurationS: upperReturnS,
    preReleaseStuckCompressionLbf, releasedNoImpactStuckCompressionLbf,
    initialTotalCompressionLbf: preReleaseStuckCompressionLbf, stuckStepLbf,
    peakTotalCompressionLbf: preReleaseStuckCompressionLbf + stuckStepLbf,
    averageTotalCompressionLbf: primaryTotalImpulseLbfS / upperReturnS, primaryTotalImpulseLbfS,
    impactResponseImpulseLbfS: primaryTotalImpulseLbfS - releasedNoImpactStuckCompressionLbf * upperReturnS,
    excessOverPreReleaseImpulseLbfS: primaryTotalImpulseLbfS - preReleaseStuckCompressionLbf * upperReturnS,
    primaryIntervals: intervals,
    reactionIntervals: [
      { startS: 0, endS: lower.travelS, totalCompressionLbf: preReleaseStuckCompressionLbf },
      { startS: lower.travelS, endS: firstImpactArrivalS, totalCompressionLbf: releasedNoImpactStuckCompressionLbf }, ...intervals
    ],
    admissibilityMarginsS: { earlyImpact: upperReturnS - impactTimeS, lowerReturn: lowerReturnS - motionHorizonS, surfaceReturn: surfaceReturnS - motionHorizonS },
    assumptions: ['Initially equilibrated, straight, perfectly guided elastic rods; no bending/buckling or axial friction.',
      'Ideal instantaneous latch release to zero traction; zero internal tool mass; rigid unilateral down-stop engagement.',
      'Fixed surface and bilateral fixed stuck boundary; initial jar-face compression is the same P on both sides.',
      'Density determines mass, gravity and wave speed consistently; no hydraulic, buoyancy or catalog-weight correction.',
      'Motion intervals end at first impact-reflection return to jar; stuck-point intervals end at its later arrival there.',
      'No tool, field, directional-well or post-primary validity is established.']
  };
  const values = [strokeFt, relativeImpactVelocityFtS, impactTimeS, weightLbf, incidentCompressionLbf, stuckStepLbf,
    firstImpactArrivalS, releaseReflectionArrivalS, impactReliefArrivalS, primaryTotalImpulseLbfS,
    result.peakTotalCompressionLbf, result.averageTotalCompressionLbf, result.impactResponseImpulseLbfS];
  return values.every(Number.isFinite) ? result : fail('Derived values exceed numerical range.');
}

export function earlyJarDownMotionAt(result, timeS) {
  if (!result?.valid || !Number.isFinite(timeS) || timeS < 0 || timeS >= result.motionHorizonS) return fail('Requested time is outside the derived half-open motion window.');
  const i = result.motionIntervals.find(interval => timeS >= interval.startS && timeS < interval.endS);
  return { valid: true, timeS, hammerDisplacementFt: i.hammerStartFt + i.hammerVelocityFtS * (timeS - i.startS),
    anvilDisplacementFt: i.anvilStartFt + i.anvilVelocityFtS * (timeS - i.startS),
    hammerVelocityFtS: i.hammerVelocityFtS, anvilVelocityFtS: i.anvilVelocityFtS, contactForceLbf: i.contactForceLbf };
}
