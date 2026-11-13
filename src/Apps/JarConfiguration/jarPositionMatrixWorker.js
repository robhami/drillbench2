/* global globalThis */
import { calculatePositionMatrix } from '../../engineering/jar/jarPositionMatrix';
globalThis.onmessage = event => {
  try { globalThis.postMessage(calculatePositionMatrix(event.data)); }
  catch (error) { globalThis.postMessage({ valid: false, error: error.message }); }
};
