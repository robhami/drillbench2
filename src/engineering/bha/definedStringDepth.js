import { drillstringDeploymentStructure } from './deployDrillstring';

// Defined length is a surface-zero string extent, not the saved Auto design MD.
export function definedStringDepth(bha) {
  const pipe = bha?.rows?.find(row => row.category === 'DP');
  if (!pipe || pipe.lengthMode === 'auto') return { active: false };
  const structure = drillstringDeploymentStructure(bha);
  if (!structure.valid) return { active: true, valid: false, error: structure.errors.join(' ') };
  if (String(pipe.length ?? '').trim() === '' || !Number.isFinite(Number(pipe.length)) || Number(pipe.length) <= 0) {
    return { active: true, valid: false, error: 'Enter a positive Defined DP length (ft).' };
  }
  const bitMdFt = structure.fixedLengthFt + Number(pipe.length);
  return Number.isFinite(bitMdFt)
    ? { active: true, valid: true, bitMdFt }
    : { active: true, valid: false, error: 'Defined string length exceeds numerical range.' };
}
