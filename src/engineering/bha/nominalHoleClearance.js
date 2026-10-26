import { deployDrillstring } from './deployDrillstring';
import { calcComponentPositions } from './calcComponentPositions';

const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));

// Persisted holeSize is also the Bit Size field: one source for nominal open hole.
export function nominalHoleDiameter(bha) {
  const value = bha?.holeSize;
  if (value === undefined || value === null || String(value).trim() === '') return { valid: false, status: 'not-configured', diameterIn: null, message: 'Not Configured' };
  if (!finite(value) || Number(value) <= 0) return { valid: false, status: 'invalid-input', diameterIn: null, message: 'Bit Size must be a finite positive diameter.' };
  return { valid: true, status: 'configured', diameterIn: Number(value), message: 'Uniform nominal open hole equals Bit Size.' };
}

export function componentNominalClearance(bha, component) {
  const hole = nominalHoleDiameter(bha);
  if (!hole.valid) return { ...hole, radialClearanceIn: null };
  if (!finite(component?.od) || Number(component.od) <= 0) return { valid: false, status: 'invalid-input', radialClearanceIn: null, diameterIn: hole.diameterIn, message: 'Component OD must be a finite positive diameter.' };
  const radialClearanceIn = (hole.diameterIn - Number(component.od)) / 2;
  return { valid: radialClearanceIn > 0, diameterIn: hole.diameterIn, radialClearanceIn,
    status: radialClearanceIn > 0 ? 'calculated' : radialClearanceIn < 0 ? 'oversize' : 'no-clearance',
    message: radialClearanceIn < 0 ? 'Component OD exceeds nominal hole.' : radialClearanceIn === 0 ? 'No positive radial clearance.' : 'Nominal radial clearance; not a passability or safety check.' };
}

export function calcDeployedNominalClearances(bha, bitMdFt, { surfaceMdFt = 0 } = {}) {
  const deployment = deployDrillstring(bha, bitMdFt, { surfaceMdFt, deploymentMode: 'depth-dependent' });
  if (!deployment.valid) return { ...deployment, components: [] };
  const hole = nominalHoleDiameter(bha);
  const components = calcComponentPositions(deployment.bha).components.map((c, componentIndex) => ({
    componentIndex, componentId: c.rowId ?? c.selectedToolId ?? `component-${componentIndex}`, lengthFt: Number(c.length),
    topMdFt: Number(bitMdFt) - c.endFromBit, bottomMdFt: Number(bitMdFt) - c.startFromBit,
    ...componentNominalClearance(bha, c)
  }));
  return { valid: hole.valid && components.every(c => c.valid), status: !hole.valid ? hole.status : components.every(c => c.valid) ? 'calculated' : 'invalid-component',
    nominalHoleDiameterIn: hole.diameterIn, deployment: deployment.metadata, components };
}
