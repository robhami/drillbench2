/* global globalThis */
import { calculateCompressionAssessment } from '../../engineering/research/jarDownCompressionAssessment';
globalThis.onmessage = e => {
  try { globalThis.postMessage(calculateCompressionAssessment(e.data)); }
  catch (error) { globalThis.postMessage({ classification: 'Unsupported', canAdopt: false, issues: [error.message], limitations: [] }); }
};
