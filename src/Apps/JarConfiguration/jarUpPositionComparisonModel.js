import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions';
import { comparisonGeometry, listComparisonJars, MIN_RELOCATED_COLLAR_LENGTH_FT, relocateComparisonJar } from '../../engineering/jar/realBhaComparison';
import { populatedComponent } from '../../engineering/bha/componentApplicability';
import { calculateJarPerformance } from '../JarPlacement/skeemPerformance';
import { readImpactInputs } from '../JarPlacement/impactInputs';
import { loadedJarRowKey } from './loadedBhaPresentation';

const SAMPLE_FRACTIONS = [0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75];
const category = row => String(row?.category || '').toUpperCase();

function selectedJarIndex(bha, selectedJarKey) {
  const sourceRows = bha?.rows || [];
  const rawIndex = sourceRows.findIndex((row, index) => loadedJarRowKey(row, index) === selectedJarKey);
  const selectedRow = rawIndex >= 0 ? sourceRows[rawIndex] : null;
  const populatedRows = sourceRows.filter(populatedComponent);
  const filteredIndex = selectedRow ? populatedRows.indexOf(selectedRow) : -1;
  const jars = listComparisonJars(bha);
  if (filteredIndex >= 0) return jars.findIndex(item => item.rowIndex === filteredIndex);
  return jars.length === 1 ? 0 : -1;
}

function actualJarCentre(bha, jarOrdinal) {
  const jars = (calcComponentPositions(bha).components || []).filter(row => category(row) === 'JAR');
  const centre = Number(jars[jarOrdinal]?.centreFromBit);
  return Number.isFinite(centre) ? centre : null;
}

function evaluateCandidate(candidateBha, operating, movementFt, jarOrdinal, geometryError = null) {
  const calculation = geometryError
    ? { valid: false, error: geometryError }
    : calculateJarPerformance(candidateBha, operating);
  const jar = (calcComponentPositions(candidateBha).components || []).filter(row => category(row) === 'JAR')[jarOrdinal];
  const history = calculation.forceHistory;
  const finiteForceValues = Array.isArray(history)
    ? history.map(interval => interval?.tensileForceLbf).filter(value => value !== '' && value != null && Number.isFinite(Number(value))).map(Number)
    : [];
  const peakStuckPointForceLbf = finiteForceValues.length ? Math.max(0, ...finiteForceValues) : null;
  const finiteResult = value => value !== '' && value != null && Number.isFinite(Number(value));
  let error = calculation.error || null;
  if (calculation.valid && !finiteForceValues.length) error = 'Dynamic result unavailable: solver returned no finite stuck-point tensile-force history.';
  else if (calculation.valid && !finiteResult(calculation.impulseLbfS)) error = 'Dynamic result unavailable: solver returned no finite primary stuck-point impulse.';
  else if (calculation.valid && !finiteResult(calculation.preImpact?.hammerVelocityFtS)) error = 'Dynamic result unavailable: solver returned no finite impact velocity.';
  else if (calculation.valid && !finiteResult(calculation.primaryPulseDurationS)) error = 'Dynamic result unavailable: solver returned no finite primary pulse duration.';
  const valid = Boolean(calculation.valid && finiteForceValues.length && Number.isFinite(peakStuckPointForceLbf) &&
    finiteResult(calculation.impulseLbfS) && finiteResult(calculation.preImpact?.hammerVelocityFtS) &&
    finiteResult(calculation.primaryPulseDurationS));
  return {
    movementFt,
    jarCentreFt: Number.isFinite(Number(jar?.centreFromBit)) ? Number(jar.centreFromBit) : null,
    valid,
    error: valid ? null : error || 'Dynamic result unavailable: solver outputs were incomplete.',
    peakStuckPointForceLbf: valid ? peakStuckPointForceLbf : null,
    peakStuckPointForceKlbf: valid ? peakStuckPointForceLbf / 1000 : null,
    impulseLbfS: valid ? calculation.impulseLbfS : null,
    impactVelocityFtS: valid ? calculation.preImpact.hammerVelocityFtS : null,
    primaryPulseDurationS: valid ? calculation.primaryPulseDurationS : null,
    incidentImpactForceLbf: valid ? calculation.impactForceLbf : null,
    input: calculation.input || null,
    geometry: calculation.jar ? { startFromBit: calculation.jar.startFromBit, endFromBit: calculation.jar.endFromBit } : null
  };
}

function sampleMovements(geometry) {
  const upperTransferFt = Number(geometry.upper.length) - MIN_RELOCATED_COLLAR_LENGTH_FT;
  const lowerTransferFt = Number(geometry.lower.length) - MIN_RELOCATED_COLLAR_LENGTH_FT;
  const proposed = SAMPLE_FRACTIONS.map(fraction => {
    if (fraction === 0) return 0;
    if (fraction > 0) return upperTransferFt > 0 ? fraction * upperTransferFt : null;
    return lowerTransferFt > 0 ? fraction * lowerTransferFt : null;
  }).filter(Number.isFinite);
  return [...new Set(proposed)];
}

function uniqueCandidatePositions(candidates) {
  const byPosition = new Map();
  candidates.forEach(candidate => {
    const key = Number.isFinite(candidate.jarCentreFt) ? candidate.jarCentreFt : 'unlocated';
    const previous = byPosition.get(key);
    if (!previous || (candidate.movementFt === 0 && previous.movementFt !== 0)) byPosition.set(key, candidate);
  });
  return [...byPosition.values()].sort((a, b) => {
    const positionDelta = (Number.isFinite(a.jarCentreFt) ? a.jarCentreFt : Infinity) -
      (Number.isFinite(b.jarCentreFt) ? b.jarCentreFt : Infinity);
    return positionDelta || a.movementFt - b.movementFt;
  });
}

/** Build physical candidate BHAs through relocationComparisonJar, then independently run the existing Jar Up adapter. */
export function calculateJarUpPositionComparison(bha, selectedJarKey = '', operating = readImpactInputs(bha, 'up')) {
  const jarIndex = selectedJarIndex(bha, selectedJarKey);
  if (jarIndex < 0) return { validGeometry: false, jarIndex, candidates: [{
    movementFt: 0, jarCentreFt: null, valid: false,
    error: 'Select one jar explicitly; a comparison requires an unambiguous loaded jar.'
  }] };

  const geometry = comparisonGeometry(bha, jarIndex);
  if (!geometry.valid) {
    const candidate = evaluateCandidate(bha, operating, 0, jarIndex);
    candidate.jarCentreFt = actualJarCentre(bha, jarIndex);
    return { validGeometry: false, jarIndex, candidates: [candidate], geometryError: geometry.error };
  }

  // Sample continuous footage-transfer positions accepted by the relocation adapter.
  // The current position is included; all other rows are 25/50/75% of each side's
  // transferable adjacent-collar footage. These are discrete comparison points.
  const movements = sampleMovements(geometry);
  const candidates = movements.flatMap(movementFt => {
    const relocated = relocateComparisonJar(bha, jarIndex, movementFt, 'A');
    if (!relocated.valid && movementFt !== 0) return [];
    const candidateBha = relocated.valid ? relocated.bha : bha;
    return [evaluateCandidate(candidateBha, operating, movementFt, jarIndex, relocated.valid ? null : relocated.error)];
  });
  return { validGeometry: true, jarIndex, geometry, candidates: uniqueCandidatePositions(candidates) };
}
