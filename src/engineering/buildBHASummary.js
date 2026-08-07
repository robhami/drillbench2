export const buildBHASummary = (bha) => {
  const rows = bha?.rows || [];

  const completedRows = rows.filter(
    (row) =>
      row.category ||
      row.selectedToolId ||
      row.length ||
      row.weight
  );

  const totalLength = completedRows.reduce(
    (total, row) => total + (Number(row.length) || 0),
    0
  );

  /*
   * Weight is currently treated as weight per unit length in lb/ft.
   * Therefore:
   *
   * component air weight = weight per foot × length
   */
  const totalAirWeight = completedRows.reduce(
    (total, row) => {
      const weightPerFoot = Number(row.weight) || 0;
      const length = Number(row.length) || 0;

      return total + weightPerFoot * length;
    },
    0
  );

  /*
   * Standard steel buoyancy approximation:
   * BF = 1 - mud weight / steel density
   *
   * Steel density is approximated as 65.5 ppg.
   */
  const mudWeight = Number(bha?.mudWeight) || 0;
  const steelDensity = 65.5;

  const buoyancyFactor =
    mudWeight > 0
      ? 1 - mudWeight / steelDensity
      : null;

  const totalBuoyedWeight =
    buoyancyFactor === null
      ? null
      : totalAirWeight * buoyancyFactor;

  const categories = completedRows.map((row) =>
    String(row.category || '').toUpperCase()
  );

  const toolNames = completedRows.map((row) =>
    String(row.toolName || '').toUpperCase()
  );

  const containsText = (searchTerms) =>
    [...categories, ...toolNames].some((value) =>
      searchTerms.some((term) => value.includes(term))
    );

  return {
    componentCount: completedRows.length,
    totalLength,
    totalAirWeight,
    buoyancyFactor,
    totalBuoyedWeight,
    hasJar: containsText(['JAR']),
    hasAccelerator: containsText([
      'ACCELERATOR',
      'INTENSIFIER'
    ]),
    hasMotor: containsText(['MOTOR', 'MTR']),
    hasRss: containsText(['RSS']),
    hasMwdLwd: containsText(['MWD', 'LWD', 'M_LWD'])
  };
};

export default buildBHASummary;