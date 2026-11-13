const finitePositive = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) > 0;

/** Cumulative upper-end distances in the displayed, bit-to-surface row order. */
export function cumulativeBhaLengths(rows = [], autoDrillpipeLengthFt = null) {
  let totalFt = 0;
  let known = true;
  return rows.map(row => {
    const length = row?.category === 'DP' && row?.lengthMode === 'auto' ? autoDrillpipeLengthFt : row?.length;
    if (!known || !finitePositive(length)) {
      known = false;
      return null;
    }
    totalFt += Number(length);
    return totalFt;
  });
}
