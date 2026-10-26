import { calcJarDownBuckling } from './drillstringBuckling';
import { identifyLoadRegions } from './compressedSections';

const finitePositive = value => String(value ?? '').trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
const notEvaluated = reason => ({ valid: false, status: 'Not Evaluated', reason });

// Configuration/coverage adapter only. No force or buckling equations here.
export function evaluateConfirmedDpBuckling({ selectedDpIndex, youngsModulusPsi, confirmed, ...input }) {
  if (!Number.isInteger(selectedDpIndex) || input.bha?.rows?.[selectedDpIndex]?.category !== 'DP') return notEvaluated('Select a drillpipe section.');
  if (!finitePositive(youngsModulusPsi)) return notEvaluated('Enter an explicit positive finite Young\'s modulus (psi).');
  if (!confirmed) return notEvaluated('Uniform tubular idealization is not confirmed for the selected drillpipe.');
  if (!finitePositive(input.bha.holeSize)) return notEvaluated('Configure a positive nominal hole diameter using Bit Size.');
  const bha = { ...input.bha, rows: input.bha.rows.map((row, index) => ({ ...row,
    // Never inherit confirmation from another component or stale saved flags.
    bucklingIdealizationConfirmed: index === selectedDpIndex,
    ...(index === selectedDpIndex ? { youngsModulusPsi: Number(youngsModulusPsi) } : {})
  })) };
  const calculated = calcJarDownBuckling({ ...input, bha, wellboreDiameterIn: bha.holeSize });
  if (!calculated.valid) return notEvaluated(calculated.errors.join(' '));
  const compression = identifyLoadRegions(calculated.staticLoads.profile);
  if (!compression.valid) return notEvaluated(compression.errors.join(' '));
  const applicable = calculated.intervals.filter(i => i.applicability === 'applicable');
  const evaluatedCompressedLengthFt = applicable.reduce((sum, element) => sum + compression.compressedIntervals.reduce((n, interval) =>
    n + Math.max(0, Math.min(element.bottomMdFt, interval.bottomMdFt) - Math.max(element.topMdFt, interval.topMdFt)), 0), 0);
  const exclusions = [];
  for (const interval of compression.compressedIntervals) for (const element of calculated.intervals) {
    const topMdFt = Math.max(interval.topMdFt, element.topMdFt), bottomMdFt = Math.min(interval.bottomMdFt, element.bottomMdFt);
    if (bottomMdFt <= topMdFt || element.applicability === 'applicable') continue;
    const reasons = [...element.missingInputs, ...element.warnings].join(' ');
    const previous = exclusions[exclusions.length - 1];
    if (previous && previous.bottomMdFt === topMdFt && previous.componentId === element.componentId && previous.reasons === reasons) previous.bottomMdFt = bottomMdFt;
    else exclusions.push({ topMdFt, bottomMdFt, componentId: element.componentId, reasons });
  }
  return { valid: true, status: applicable.length ? 'Partial screening' : 'Not Evaluated', calculated,
    summary: calculated.summary, totalCompressedLengthFt: compression.totalCompressedLengthFt,
    evaluatedCompressedLengthFt, unevaluatedCompressedLengthFt: compression.totalCompressedLengthFt - evaluatedCompressedLengthFt,
    exclusions, reason: applicable.length ? '' : 'No intervals satisfy the existing model applicability requirements.' };
}
