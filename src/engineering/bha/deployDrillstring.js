const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const populated = row => row && ['category', 'toolName', 'selectedToolId', 'length', 'weight', 'od', 'idSize'].some(k => row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '');
const fail = message => ({ valid: false, status: 'invalid-deployment', errors: [message], warnings: [] });

/** Rows are bottom-up. Only one uppermost DP section can be length-variable.
 * Stored lengths and optional Auto metadata are never rewritten here.
 */
export function drillstringDeploymentStructure(bha) {
  if (!Array.isArray(bha?.rows)) return fail('BHA component rows are required.');
  const rows = bha.rows.filter(populated);
  if (!rows.length) return fail('At least one populated BHA component is required.');
  const pipes = rows.filter(r => String(r.category).toUpperCase() === 'DP');
  if (pipes.length > 1) return fail('Depth-dependent deployment supports only one drillpipe section; multiple DP sections require an explicit deployment policy.');
  if (pipes.length && rows[rows.length - 1] !== pipes[0]) return fail('Drillpipe must be the uppermost component for depth-dependent deployment; tools above DP are unsupported.');
  const fixedRows = rows.filter(r => r !== pipes[0]);
  if (fixedRows.some(r => !finite(r.length) || Number(r.length) <= 0)) return fail('Every fixed component must have a positive length (ft); fixed tools cannot be shortened for deployment.');
  const fixedLengthFt = fixedRows.reduce((sum, r) => sum + Number(r.length), 0);
  if (!Number.isFinite(fixedLengthFt)) return fail('Fixed-string length exceeds numerical range.');
  return { valid: true, rows, pipe: pipes[0] || null, fixedLengthFt };
}

export function deployDrillstring(bha, bitMdFt, { surfaceMdFt = 0, deploymentMode = 'depth-dependent' } = {}) {
  if (!finite(bitMdFt) || !finite(surfaceMdFt) || Number(surfaceMdFt) < 0 || Number(bitMdFt) < Number(surfaceMdFt)) return fail('Supply an explicit bit MD at or below a nonnegative surface reference MD (ft).');
  if (!['depth-dependent', 'fixed'].includes(deploymentMode)) return fail('Deployment mode must be depth-dependent or fixed.');
  if (deploymentMode === 'fixed') return { valid: true, bha, metadata: { mode: 'fixed', surfaceMdFt: Number(surfaceMdFt), deployedDpLengthFt: null }, warnings: [] };
  const structure = drillstringDeploymentStructure(bha);
  if (!structure.valid) return structure;
  const { rows, pipe, fixedLengthFt } = structure;
  if (!pipe) return { valid: true, bha, metadata: { mode: 'fixed-no-drillpipe', fixedLengthFt, deployedDpLengthFt: 0, surfaceMdFt: Number(surfaceMdFt) }, warnings: [] };
  const available = Number(bitMdFt) - Number(surfaceMdFt);
  if (available < fixedLengthFt) return fail(`Bit MD ${bitMdFt} ft is insufficient for the ${fixedLengthFt}-ft fixed BHA below surface MD ${surfaceMdFt} ft. Fixed downhole tools are not shortened.`);
  if (!finite(pipe.weight) || Number(pipe.weight) < 0) return fail('Drillpipe requires an explicit nonnegative air weight (lbf/ft).');
  const deployedDpLengthFt = Math.max(0, available - fixedLengthFt);
  const temporaryRows = rows.flatMap(r => r === pipe ? deployedDpLengthFt > 0 ? [{ ...r, length: deployedDpLengthFt }] : [] : [{ ...r }]);
  // Correct floating subtraction at the surface without extrapolating geometry.
  const total = temporaryRows.reduce((sum, r) => sum + Number(r.length), 0);
  if (Number(bitMdFt) - total < Number(surfaceMdFt) && deployedDpLengthFt > 0) temporaryRows[temporaryRows.length - 1].length -= total - available;
  return { valid: true, bha: { ...bha, rows: temporaryRows }, warnings: [], metadata: { mode: deploymentMode, surfaceMdFt: Number(surfaceMdFt), fixedLengthFt, deployedDpLengthFt: temporaryRows.find(r => String(r.category).toUpperCase() === 'DP')?.length || 0, totalDeployedLengthFt: available } };
}
