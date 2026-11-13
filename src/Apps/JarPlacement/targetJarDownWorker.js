/* global globalThis */
import { calculateTargetStatic, calculateTargetDynamics } from '../../engineering/research/targetJarDownWorkflow';
globalThis.onmessage = e => {
  try {
    const p = e.data;
    globalThis.postMessage(p.kind === 'static' ? calculateTargetStatic(p.input) : calculateTargetDynamics(p.staticOutcome, p.input.survey, p.confirmed));
  } catch (error) { globalThis.postMessage({ valid: false, errors: [error.message], error: error.message }); }
};
