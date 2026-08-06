export const calculateComponentPositions = (bha) => {
  const rows = bha?.rows || [];

  let cumulativeLength = 0;

  const components = rows.map((row, index) => {
    const length = Number(row.length) || 0;

    const startFromBit = cumulativeLength;
    const centreFromBit = startFromBit + length / 2;
    const endFromBit = startFromBit + length;

    cumulativeLength = endFromBit;

    return {
      ...row,
      position: index + 1,
      startFromBit,
      centreFromBit,
      endFromBit
    };
  });

  return {
    totalLength: cumulativeLength,
    components
  };
};