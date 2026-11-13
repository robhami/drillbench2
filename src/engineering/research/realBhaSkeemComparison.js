// Application adapter only: geometry and the verified research calculation remain authoritative.
import { mapRealBhaWaveGeometry } from './realBhaDynamicComparison';
import { calculateNonUniformSkeemUp } from './nonUniformSkeemUp';

export function validateSkeemSettings(s) {
  if (s.acknowledged !== true) throw Error('Acknowledge the Skeem release, equivalent properties and maintained-engagement assumptions before calculating.');
  if (![s.localTensionLbf, s.strokeIn].every(x => Number.isFinite(x) && x > 0)) throw Error('Enter positive applied local tensile load (lbf) and jar stroke (in). Surface hookload is not this input.');
  if (!Number.isFinite(s.stuckFromBitFt) || s.stuckFromBitFt < 0) throw Error('Stuck point must be a finite nonnegative distance above bit (ft).');
  if (s.windowStartS !== 0 || s.windowEndS !== .05 || s.durationS !== .05) throw Error('This verified comparison uses the common 0–50 ms window after impact.');
}

export function runRealBhaSkeem(request) {
  let map;
  try { validateSkeemSettings(request.settings); }
  catch (e) { return { valid: false, status: 'invalid-input', failureCategory: 'invalid-input', error: e.message, metrics: null, solverStarted: false }; }
  try {
    map = mapRealBhaWaveGeometry(request);
    if (map.firstArrivalS >= .05) throw Error('The first stuck-point arrival is outside the supported 50-ms observation window.');
  } catch (e) { return { valid: false, status: 'unsupported-geometry', error: e.message, metrics: null,
    structuralMappingValid: Boolean(map), failureCategory: map ? 'model-applicability' : 'invalid-input', solverStarted: false }; }
  const s = request.settings;
  const result = calculateNonUniformSkeemUp({ acknowledged: s.acknowledged, localTensionN: s.localTensionLbf * 4.4482216152605,
    strokeM: s.strokeIn * .0254, upperSections: map.upper, lowerSections: map.lower, preImpactHorizonS: .1, durationS: .05, computationalRetries: true });
  const summary = { jarCentreFt: map.jarCentreFt, jarToStuckFt: map.jarToStuckFt, firstArrivalS: map.firstArrivalS,
    valid: result.valid, status: result.status, error: result.error, impact: result.impact, maintainedEngagement: result.maintainedEngagement,
    geometryValid: true, structuralMappingValid: true, solverStarted: true, failureCategory: result.failureCategory,
    computation: result.computation, numerical: result.diagnostics, completedThroughS: result.completedThroughS };
  if (!result.valid) return { ...summary, metrics: null };
  return { ...summary, metrics: { peakTensileN: result.metrics.peakTensileN, fixedTensileNs: result.metrics.tensileNs,
    fixedSignedNs: result.metrics.signedNs, energyResidualJ: result.diagnostics.maxEnergyResidualJ },
    trace: result.stuckHistory.map(p => ({ timeS: p.timeS, stuckN: p.forceN })) };
}
