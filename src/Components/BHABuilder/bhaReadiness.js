import { componentNominalClearance, nominalHoleDiameter } from '../../engineering/bha/nominalHoleClearance';

const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const finite = value => present(value) && Number.isFinite(Number(value));
export const bhaReadinessKey = bha => JSON.stringify([bha?.id, bha?.rows, bha?.holeSize, bha?.drillpipeReferenceBitMdFt]);

// Editing/completeness adapter only. Model-specific compatibility, deployment
// and calculation validation remain authoritative in their existing engines.
export function assessBhaReadiness(bha) {
  const rows = (bha?.rows || []).map((row, index) => {
    const auto = row.category === 'DP' && row.lengthMode === 'auto';
    const untouched = !['category', 'selectedToolId', 'toolName', 'od', 'idSize', 'weight', 'length'].some(k => present(row[k]));
    const errors = {};
    if (present(row.od) && (!finite(row.od) || Number(row.od) <= 0)) errors.od = 'Enter a positive OD (in).';
    if (!auto && present(row.length) && (!finite(row.length) || Number(row.length) <= 0)) errors.length = 'Enter a positive length (ft).';
    if (present(row.weight) && (!finite(row.weight) || Number(row.weight) < 0)) errors.weight = 'Enter a nonnegative air weight (lb/ft).';
    if (present(row.idSize) && (!finite(row.idSize) || Number(row.idSize) < 0 || (finite(row.od) && Number(row.idSize) >= Number(row.od)))) errors.idSize = 'ID must be nonnegative and smaller than OD (in).';
    const clearance = componentNominalClearance(bha, row);
    if (present(row.od) && !errors.od && ['oversize', 'no-clearance'].includes(clearance.status)) errors.od = clearance.message;
    // Legacy/manual rows need not acquire catalogue IDs to remain usable.
    const manual = present(row.od) && present(row.weight) && (auto || present(row.length));
    const missing = [];
    if (!present(row.category)) missing.push('select a component type');
    const needsTool = !present(row.selectedToolId) && !present(row.toolName) && !manual;
    if (needsTool) missing.push('select a tool');
    if (!needsTool && !present(row.od)) missing.push('enter OD');
    if (!needsTool && !present(row.weight)) missing.push('enter air weight');
    if (!auto && !present(row.length)) missing.push('enter its length');
    const state = Object.keys(errors).length ? 'invalid' : untouched ? 'untouched' : missing.length ? 'incomplete' : 'valid';
    const invalidInstruction = Object.values(errors).join(' ');
    const instruction = [invalidInstruction, missing.length ? `${missing.join(' and ')}.` : ''].filter(Boolean).join(' ');
    const message = instruction ? `Row ${index + 1}: ${instruction.charAt(0).toUpperCase()}${instruction.slice(1)}` : '';
    return { state, errors, message, invalidMessage: invalidInstruction ? `Row ${index + 1}: ${invalidInstruction}` : '' };
  });
  const hole = nominalHoleDiameter(bha);
  const messages = rows.filter(r => r.state !== 'valid').map(r => r.message);
  if (!rows.length) messages.push('Add a component before analysis.');
  if (hole.status === 'invalid-input') messages.push('Enter a positive Bit Size (in).');
  return { valid: messages.length === 0, rows, messages };
}
