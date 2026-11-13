import { deployDrillstring } from '../../engineering/bha/deployDrillstring';

const value = v => ['number', 'string'].includes(typeof v) && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v ?? null;

// UI result identity only. Reuse deployment; never recalculate force here.
// Exclude WOB, ROP, simplified inclination, ratings, labels and buckling inputs.
export function jarLoadingKey({ bha, survey, bitMdFt, surfaceMdFt, jarIndex, jarDirection, targetForceKlbf, available, covered, rotatingHookloadLbf }) {
  const deployment = deployDrillstring(bha, bitMdFt, { surfaceMdFt });
  return JSON.stringify({
    trajectoryMode: bha?.trajectoryMode,
    depth: value(bitMdFt), surface: value(surfaceMdFt), jarIndex, jarDirection,
    target: value(targetForceKlbf), available, covered,
    mud: value(bha?.mudWeight), friction: value(bha?.frictionCoefficient), rotatingHookloadLbf,
    deployment: deployment.valid ? deployment.bha.rows.map(row => ({
      id: row.rowId, category: row.category,
      identityPresent: Boolean(row.category || row.toolName || row.selectedToolId),
      length: value(row.length), weight: value(row.weight), componentDefinition: row.componentDefinition
    })) : deployment.errors,
    survey: { valid: survey.valid,
      stations: survey.stations?.map(s => [s.mdFt, s.inclinationDeg, s.azimuthDeg, s.tvdFt, s.northingFt, s.eastingFt, s.dlsDegPer100Ft]),
      segments: survey.segments?.map(s => [s.fromMdFt, s.toMdFt, s.lengthFt, s.doglegRad, s.tangent0, s.turn, s.start]),
      range: [survey.summary?.startMdFt, survey.summary?.endMdFt] }
  });
}
