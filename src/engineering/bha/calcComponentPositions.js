
import {
  calcBuoyancyFactor,
  calcBuoyedWeight
} from '../forces/calcBuoyancy.js';



export const calcComponentPositions = (bha) => {
  const rows = bha?.rows || [];

  let cumulativeLength = 0;

  const mudWeight = Number(bha?.mudWeight) || 0;
  const DEFAULT_STEEL_DENSITY = 65.5;

  const buoyancyFactor = calcBuoyancyFactor(bha.mudWeight);

  const components = rows.map((row, index) => {
    const length = Number(row.length) || 0;
    const weightPerFoot = Number(row.weight) || 0;

    const startFromBit = cumulativeLength;
    const centreFromBit = startFromBit + length / 2;
    const endFromBit = startFromBit + length;

    const airWeight = weightPerFoot * length;

    const buoyedWeight =
      buoyancyFactor === null
        ? null
        : airWeight * buoyancyFactor;

    cumulativeLength = endFromBit;

    return {
      ...row,
      position: index + 1,
      startFromBit,
      centreFromBit,
      endFromBit,
      weightPerFoot,
      airWeight,
      buoyancyFactor,
      buoyedWeight
    };
  });

  return {
    totalLength: cumulativeLength,
    buoyancyFactor,
    components
  };
};