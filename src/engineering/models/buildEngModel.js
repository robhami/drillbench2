import { basicBHACalcs } from '../bha/basicBHACalcs.js';
import { calcComponentPositions } from '../bha/calcComponentPositions.js';
import { calcCentreOfGravity } from '../bha/calcCentreOfGravity.js';
import { calcAxialLoads } from '../forces/calcAxialLoads.js';

export const buildEngModel = (bha) => {
    const basics = basicBHACalcs(bha);
    const positions = calcComponentPositions(bha);
    const centreOfGravity = calcCentreOfGravity(bha);

    const baseModel = {
        bha,
        basics,
        positions,
        centreOfGravity
    };


    const axialLoads = calcAxialLoads(baseModel);

    return {
        bha,
        basics,
        positions,
        centreOfGravity,
        axialLoads
    };
};