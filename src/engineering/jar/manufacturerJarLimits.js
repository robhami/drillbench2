// Comparisons only. No ratings, force calculations or buckling assumptions.
export const manufacturerLimitFields = ['maximumUpwardLoadLbf', 'maximumDownwardLoadLbf', 'maximumTensileLoadLbf'];
const finite = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value));
export function readManufacturerLimit(value) {
  if (value === undefined || value === null || value === '') return { configured: false, valid: true, valueLbf: null };
  if (!finite(value) || Number(value) <= 0) return { configured: true, valid: false, valueLbf: null, reason: 'Enter a finite, positive manufacturer limit in lbf, or leave it empty.' };
  return { configured: true, valid: true, valueLbf: Number(value) };
}
function compare(limit, load, reason, toleranceLbf = 0) {
  if (!limit.valid) return { ...limit, loadLbf: null, status: 'Invalid limit' };
  if (!limit.configured) return { ...limit, loadLbf: null, status: 'Limit not provided' };
  if (reason || !Number.isFinite(load)) return { ...limit, loadLbf: null, status: 'Calculation unavailable', reason: reason || 'Run a valid static jar calculation.' };
  const differenceLbf = load - limit.valueLbf;
  const near = differenceLbf !== 0 && Math.abs(differenceLbf) <= toleranceLbf;
  return { ...limit, loadLbf: load, differenceLbf, toleranceLbf,
    status: differenceLbf === 0 ? 'At entered limit' : near ? 'Near entered limit — unresolved' : differenceLbf > 0 ? 'Exceeds entered limit' : 'Within entered limits',
    ...(near ? { reason: `Calculated load differs from the limit by ${differenceLbf.toPrecision(6)} lbf, within the inverse residual tolerance of ${toleranceLbf} lbf. Compliance is unresolved; no rating allowance is applied.` } : {}) };
}
export function compareManufacturerJarLimits({ limits = {}, direction, targetForceLbf, calculatedJarAxialLoadLbf, operationAvailable = true, calculationToleranceLbf = 0 }) {
  const tolerance = Number.isFinite(calculationToleranceLbf) && calculationToleranceLbf > 0 ? calculationToleranceLbf : 0;
  const unavailable = !operationAvailable ? 'The selected jar direction is unavailable or unconfigured.' : '';
  const axial = Number.isFinite(calculatedJarAxialLoadLbf) ? calculatedJarAxialLoadLbf : null;
  const target = Number.isFinite(targetForceLbf) && targetForceLbf > 0 ? targetForceLbf : null;
  const operatingKey = direction === 'up' ? 'maximumUpwardLoadLbf' : 'maximumDownwardLoadLbf';
  const load = direction === 'up' ? axial !== null && axial < 0 ? -axial : null : target;
  return {
    operating: compare(readManufacturerLimit(limits[operatingKey]), load,
      unavailable || (!['up', 'down'].includes(direction) ? 'Select a jar direction.' : '') ||
      (direction === 'up' && load === null ? 'A forward-verified tensile jar-centre load is required.' : '') ||
      (direction === 'down' && target === null ? 'Enter a positive compression target.' : ''), direction === 'up' ? tolerance : 0),
    tensile: compare(readManufacturerLimit(limits.maximumTensileLoadLbf), axial === null ? null : Math.max(0, -axial),
      unavailable || (limits.tensileLoadBasis !== 'jar-centre' ? 'Through-jar tensile load definition is unresolved. Compare only if the manufacturer explicitly specifies the jar-centre cross-section; the full jar load profile is not evaluated.' : ''), tolerance)
  };
}
