/* global globalThis */
import { calculateResearchPosition, validateComparison } from './researchComparisonData';
globalThis.onmessage = ({ data }) => {
  const { controls } = data;
  try {
    const error = validateComparison(controls); if (error) throw Error(error);
    for (const position of controls.positions) globalThis.postMessage({ row:calculateResearchPosition(controls, position) });
    globalThis.postMessage({ complete:true });
  } catch (e) { globalThis.postMessage({ error:e.message }); }
};
