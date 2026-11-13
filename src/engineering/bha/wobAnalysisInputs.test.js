import { wobAnalysisInputs, validateWobAnalysis, WOB_ANALYSIS_DEFAULTS } from './wobAnalysisInputs';
test('new/legacy BHA defaults are analysis-only and do not derive from current WOB', () => {
  const bha = { wob: 80, rows: [] }, before = JSON.stringify(bha);
  expect(wobAnalysisInputs(bha)).toEqual(WOB_ANALYSIS_DEFAULTS);
  expect(JSON.stringify(bha)).toBe(before);
});
test('explicit saved and legacy range settings retain values, blanks and invalid inputs', () => {
  expect(wobAnalysisInputs({ neutralPointAnalysis: { minWob: '4', maxWob: '9', samples: '3', increment: '50' } })).toMatchObject({ minWobKlbf: '4', maxWobKlbf: '9', samples: '3', source: 'saved' });
  expect(wobAnalysisInputs({ wobAnalysis: { minWobKlbf: '', maxWobKlbf: '-1', samples: '2.5' } })).toMatchObject({ minWobKlbf: '', maxWobKlbf: '-1', samples: '2.5' });
});
test.each([{ minWobKlbf: '' }, { maxWobKlbf: 'bad' }, { minWobKlbf: '-1' }, { minWobKlbf: '40' }, { samples: '0' }, { samples: '1' }, { samples: '2.5' }, { samples: '26' }, { samples: Infinity }])('rejects invalid WOB analysis inputs %j', patch => {
  expect(validateWobAnalysis({ ...WOB_ANALYSIS_DEFAULTS, ...patch })).toEqual(expect.any(String));
});
test('equal endpoints accept one sample; supported sample bounds are inclusive', () => {
  expect(validateWobAnalysis({ minWobKlbf: 0, maxWobKlbf: 0, samples: 1 })).toBeNull();
  expect(validateWobAnalysis({ minWobKlbf: 0, maxWobKlbf: 100, samples: 25 })).toBeNull();
});
