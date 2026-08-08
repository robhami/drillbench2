import { basicBHACalcs } from '../bha/basicBHACalcs.js';
import { calcComponentPositions } from '../bha/calcComponentPositions.js';
import { calcCentreOfGravity } from '../bha/calcCentreOfGravity.js';

export const buildEngModel = (bha) => {
    const basics = basicBHACalcs(bha);
    const positions = calcComponentPositions(bha);
    const centreOfGravity = calcCentreOfGravity(bha);

    return {
        bha,
        basics,
        positions,
        centreOfGravity
    };
};