/* global globalThis */
import { calcJarClearanceAcrossRun } from '../../engineering/jar/jarClearanceAcrossRun';

// Scheduling boundary only: the validated engineering solver is unchanged.
globalThis.onmessage = event => {
  try { globalThis.postMessage({ result: calcJarClearanceAcrossRun(event.data.request) }); }
  catch (error) { globalThis.postMessage({ error: error.message }); }
};
