import { definedStringDepth } from './definedStringDepth';
import { drillstringDeploymentStructure } from './deployDrillstring';

// Derived from persisted BHA data only; no separately editable analysis depth.
export function analysisDepth(bha) {
  const defined = definedStringDepth(bha);
  if (defined.active) return { ...defined, mode: 'defined' };
  const structure = drillstringDeploymentStructure(bha);
  if (!structure.valid) return { valid: false, error: structure.errors.join(' ') };
  if (!structure.pipe) return { valid: true, mode: 'defined', bitMdFt: structure.fixedLengthFt };
  const value = bha.drillpipeReferenceBitMdFt;
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    return { valid: false, mode: 'auto', error: 'Enter a positive BHA MD (ft) in DP Auto mode.' };
  }
  if (Number(value) < structure.fixedLengthFt) return { valid: false, mode: 'auto', error: 'BHA MD is shorter than the fixed BHA length; fixed components cannot be shortened.' };
  return { valid: true, mode: 'auto', bitMdFt: Number(value) };
}
