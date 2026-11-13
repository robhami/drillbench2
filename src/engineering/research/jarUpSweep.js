// Research geometry orchestration only: no static, wave or impact equations.
import { comparisonGeometry } from '../jar/realBhaComparison';
import { JAR_POSITIONING_METHODS, buildFixedAnvilCandidates, makeRepositionCandidate, makeStandRepositionCandidate } from '../jar/jarCandidateConfigurations';
import { mapRealBhaWaves, mapRealBhaWaveGeometry } from './realBhaDynamicComparison';
import { standChangePositions } from '../jar/standAwareConfiguration';

export const MAX_SWEEP_POSITIONS = 25;
export const MAX_DYNAMIC_CASE_JOBS = 50;
export function stuckCoordinate(bitMdFt, valueFt, coordinate = 'above-bit') {
  if (!Number.isFinite(bitMdFt) || !Number.isFinite(valueFt) || !['above-bit', 'md'].includes(coordinate)) throw Error('Enter a finite stuck-point coordinate in ft.');
  const aboveBitFt = coordinate === 'md' ? bitMdFt - valueFt : valueFt;
  return { aboveBitFt, mdFt: bitMdFt - aboveBitFt };
}
export function prepareJarUpSweep({ bha, jarIndex, bitMdFt, surfaceMdFt = 0, settings, minimumFt, maximumFt, incrementFt, model,
  positioningMethod = JAR_POSITIONING_METHODS.REPOSITION, jointLengthFt = 30, minimumJoints = 0, maximumJoints = 2, jointIncrement = 1,
  inventoryAction = 'add-remove', inventoryMode = 'both', sourceRowIndex = null, standConfiguration = null,
  minimumStandChange = -1, maximumStandChange = 1, standIncrement = 1 }) {
  if (positioningMethod === JAR_POSITIONING_METHODS.FIXED_ANVIL) {
    if (standConfiguration && !standConfiguration.valid) throw Error(standConfiguration.errors.join(' '));
    const standMode = Boolean(standConfiguration);
    const plan = buildFixedAnvilCandidates({ bha, jarIndex, jointLengthFt: standMode ? standConfiguration.standLengthFt : jointLengthFt,
      minimumJoints: standMode ? minimumStandChange : minimumJoints, maximumJoints: standMode ? maximumStandChange : maximumJoints,
      jointIncrement: standMode ? standIncrement : jointIncrement, inventoryAction, inventoryMode, sourceRowIndex, bitMdFt, surfaceMdFt,
      standMakeupFt: standMode ? standConfiguration.jointLengthsFt : null, countUnit: standMode ? 'stand' : 'joint' });
    const cases = [], rejected = [...plan.rejected];
    for (const candidate of plan.candidates) {
      try {
        const map = (model === 'non-uniform-skeem' ? mapRealBhaWaveGeometry : mapRealBhaWaves)({ bha: candidate.bha, jarIndex, bitMdFt, surfaceMdFt, settings });
        cases.push({ ...candidate, jarCentreFt: map.jarCentreFt, candidateId: candidate.candidateId });
      } catch (e) { rejected.push({ candidateId: candidate.candidateId, jarCentreFt: candidate.jarLocationAboveBitFt, error: e.message }); }
    }
    return { cases, rejected, geometry: plan.geometry, positioningMethod };
  }
  if (positioningMethod !== JAR_POSITIONING_METHODS.REPOSITION) throw Error('This positioning method is planned but is not implemented yet.');
  const geometry = comparisonGeometry(bha, jarIndex);
  if (!geometry.valid) throw Error(geometry.error);
  if (standConfiguration) {
    const cases = [], rejected = [];
    // The loaded assembly is the reference calculation, independent of whether
    // the operator has supplied a constructible stand makeup. Stand feasibility
    // only governs alternatives; it is not a prerequisite for calculating the
    // existing jar position.
    const baseline = makeRepositionCandidate({ bha, jarIndex, movementFt: 0,
      candidateId: 'mode-a-stand-current', bitMdFt, surfaceMdFt });
    if (!baseline.valid) throw Error(baseline.error);
    const baselineMap = (model === 'non-uniform-skeem' ? mapRealBhaWaveGeometry : mapRealBhaWaves)({ bha: baseline.bha, bitMdFt, surfaceMdFt, jarIndex, settings });
    cases.push({ ...baseline, movementFt: 0, standChange: 0, requestedStandChange: 0, positioningUnit: 'stand',
      standLengthFt: standConfiguration.standLengthFt, rigHandlingStatus: standConfiguration.handlingStatus,
      rigHandlingReasons: standConfiguration.handlingReasons, jarCentreFt: baselineMap.jarCentreFt });
    if (!standConfiguration.valid) {
      rejected.push({ standChange: null, jarCentreFt: geometry.currentCentreFt,
        error: `Stand alternatives unavailable: ${standConfiguration.errors.join(' ')}` });
      return { cases, rejected, geometry, positioningMethod, standConfiguration };
    }
    const positions = standChangePositions(standConfiguration, minimumStandChange, maximumStandChange, standIncrement);
    for (const { standChange, movementFt } of positions) {
      if (standChange === 0) continue;
      try {
        const candidate = makeStandRepositionCandidate({ bha, jarIndex, standChange, standMakeupFt: standConfiguration.jointLengthsFt,
          candidateId: `mode-a-stand-${standChange >= 0 ? 'plus-' : 'minus-'}${Math.abs(standChange)}`, bitMdFt, surfaceMdFt });
        if (!candidate.valid) throw Error(candidate.error);
        const map = (model === 'non-uniform-skeem' ? mapRealBhaWaveGeometry : mapRealBhaWaves)({ bha: candidate.bha, bitMdFt, surfaceMdFt, jarIndex, settings });
        cases.push({ ...candidate, movementFt, standChange, requestedStandChange: standChange, positioningUnit: 'stand', standLengthFt: standConfiguration.standLengthFt,
          rigHandlingStatus: standConfiguration.handlingStatus, rigHandlingReasons: standConfiguration.handlingReasons, jarCentreFt: map.jarCentreFt });
      } catch (e) { rejected.push({ standChange, jarCentreFt: geometry.currentCentreFt + movementFt, error: e.message }); }
    }
    return { cases, rejected, geometry, positioningMethod, standConfiguration };
  }
  if (![minimumFt, maximumFt, incrementFt].every(Number.isFinite) || incrementFt < 1e-6 || maximumFt < minimumFt) throw Error('Use finite minimum <= maximum and position increment at least 0.000001 ft.');
  const count = Math.floor((maximumFt - minimumFt) / incrementFt + 1e-10) + 1;
  if (count > MAX_SWEEP_POSITIONS) throw Error(`Limit sweep to ${MAX_SWEEP_POSITIONS} positions including the baseline.`);
  const positions = Array.from({ length: count }, (_, i) => {
    const p = minimumFt + i * incrementFt;
    return Math.abs(p - geometry.currentCentreFt) < 1e-7 ? geometry.currentCentreFt : p;
  });
  // The current assembly is a required comparison reference even if it sits outside
  // the requested position sweep; it consumes one of the bounded candidate slots.
  const includeBaseline = true;
  if (includeBaseline && !positions.some(p => Math.abs(p - geometry.currentCentreFt) < 1e-7)) positions.push(geometry.currentCentreFt);
  if (positions.length > MAX_SWEEP_POSITIONS) throw Error(`Limit sweep to ${MAX_SWEEP_POSITIONS} positions including the baseline.`);
  const cases = [], rejected = [];
  for (const centreFt of positions.sort((a, b) => a - b)) {
    // Feet-scale input identity: remove floating-point subtraction noise only.
    const movementFt = Number((centreFt - geometry.currentCentreFt).toFixed(9));
    const candidateId = `mode-a-${positions.indexOf(centreFt)+1}`;
    let geometryValid = false;
    try {
      const candidate = makeRepositionCandidate({ bha, jarIndex, movementFt, candidateId, bitMdFt, surfaceMdFt });
      if (!candidate.valid) throw Error(candidate.error);
      geometryValid = true;
      const map = (model === 'non-uniform-skeem' ? mapRealBhaWaveGeometry : mapRealBhaWaves)({ bha: candidate.bha, jarIndex, bitMdFt, surfaceMdFt, settings });
      cases.push({ ...candidate, movementFt, jarCentreFt: map.jarCentreFt, isReference: movementFt === 0, geometryValid: true, structuralMappingValid: true });
    } catch (e) { rejected.push({ candidateId, jarCentreFt: centreFt, movementFt, isReference: movementFt === 0, geometryValid,
      structuralMappingValid: geometryValid ? false : null, solverStarted: false, valid: false,
      status: geometryValid ? 'invalid-input' : 'geometry-excluded', error: e.message }); }
  }
  return { cases, rejected, geometry };
}
