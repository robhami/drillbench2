export const calculateCentreOfGravity = (bha) => {
  const rows = bha?.rows || [];

  let cumulativeLength = 0;
  let totalWeight = 0;
  let totalMoment = 0;

  const components = rows
    .filter((row) => Number(row.length) > 0)
    .map((row) => {
      const length = Number(row.length) || 0;
      const weightPerFoot = Number(row.weight) || 0;
      const componentWeight = weightPerFoot * length;

      const startDistanceFromBit = cumulativeLength;
      const centreDistanceFromBit =
        startDistanceFromBit + length / 2;
      const endDistanceFromBit =
        startDistanceFromBit + length;

      cumulativeLength = endDistanceFromBit;

      totalWeight += componentWeight;
      totalMoment +=
        componentWeight * centreDistanceFromBit;

      return {
        ...row,
        componentWeight,
        startDistanceFromBit,
        centreDistanceFromBit,
        endDistanceFromBit
      };
    });

  const centreOfGravityFromBit =
    totalWeight > 0
      ? totalMoment / totalWeight
      : null;

  return {
    totalLength: cumulativeLength,
    totalWeight,
    centreOfGravityFromBit,
    components
  };
};