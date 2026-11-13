/* global globalThis */
import { simulateExtendedJarDown } from '../../engineering/research/jarDownExtendedDynamics';
globalThis.onmessage = e => {
  try {
    const result = simulateExtendedJarDown(e.data);
    globalThis.postMessage(result.valid && result.contact.motion.length + result.noContact.motion.length > 10000
      ? { valid: false, error: 'History exceeds the research visualization event limit. Shorten the horizon; no partial results are displayed.' } : result);
  }
  catch (error) { globalThis.postMessage({ valid: false, error: error.message }); }
};
