// Analysis sampling inputs only; never derive or overwrite the current drilling WOB.
export const WOB_ANALYSIS_DEFAULTS = { minWobKlbf: '10', maxWobKlbf: '35', samples: '5', source: 'defaults' };
export const MAX_WOB_SAMPLES = 25;
export function wobAnalysisInputs(bha) {
  // Earlier run settings were window-local. Accept explicitly saved legacy fields,
  // if present, while preserving deliberate blanks and invalid entries for validation.
  const legacy = bha?.neutralPointAnalysis || {};
  const saved = bha?.wobAnalysis || {};
  return { minWobKlbf: saved.minWobKlbf ?? legacy.minWob ?? WOB_ANALYSIS_DEFAULTS.minWobKlbf,
    maxWobKlbf: saved.maxWobKlbf ?? legacy.maxWob ?? WOB_ANALYSIS_DEFAULTS.maxWobKlbf,
    samples: saved.samples ?? legacy.samples ?? WOB_ANALYSIS_DEFAULTS.samples,
    source: saved.source ?? (Object.keys(saved).length || ['minWob', 'maxWob', 'samples'].some(k => legacy[k] !== undefined) ? 'saved' : 'defaults') };
}
export function validateWobAnalysis(values) {
  const finite = v => ['string', 'number'].includes(typeof v) && String(v).trim() !== '' && Number.isFinite(Number(v));
  if (![values.minWobKlbf, values.maxWobKlbf, values.samples].every(finite)) return 'Enter finite minimum/maximum WOB and WOB Samples.';
  const min = Number(values.minWobKlbf), max = Number(values.maxWobKlbf), count = Number(values.samples);
  if (min < 0 || max < min) return 'Minimum WOB must be nonnegative and no greater than Maximum WOB.';
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_WOB_SAMPLES || (max > min && count < 2)) return `WOB Samples must be an integer from 1 to ${MAX_WOB_SAMPLES}, with at least 2 for a nonzero range.`;
  return null;
}
