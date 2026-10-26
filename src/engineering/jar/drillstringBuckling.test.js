import { calcBucklingThresholds, calcJarDownBuckling } from './drillstringBuckling';
import { calcStaticJarLoads } from './staticJarLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';

const thresholdInput = extra => ({ odIn: 1, idIn: 0, youngsModulusPsi: 64 / Math.PI,
  wellboreDiameterIn: 3, componentLengthFt: 1000, buoyedWeightPerFt: 12,
  inclinationDeg: 90, curvatureRadPerFt: 0, bucklingIdealizationConfirmed: true, ...extra });
const close = (a, b, tolerance = 1e-8) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);
const geometry = (inclinationDeg = 30) => calculateSurveyGeometry([
  { mdFt: 0, inclinationDeg, azimuthDeg: 0 }, { mdFt: 2000, inclinationDeg, azimuthDeg: 0 }
]);
const row = (category, length, extra = {}) => ({ category, toolName: category, rowId: category,
  length, weight: 12, od: 1, idSize: 0, youngsModulusPsi: 64 / Math.PI,
  bucklingIdealizationConfirmed: true, ...extra });
const assembly = () => ({ holeSize: 3, rows: [row('JAR', 20), row('DC', 980)] });
const base = extra => ({ bha: assembly(), survey: geometry(), bitMdFt: 1000,
  frictionCoefficient: 0, buoyancyFactor: 1, surfaceHookloadLbf: 0, ...extra });

test.each([[30, Math.SQRT2, 2], [90, 2, 2 * Math.SQRT2]])('independent EI=1 benchmark at %s degrees', (inclinationDeg, sinusoidal, helical) => {
  const r = calcBucklingThresholds(thresholdInput({ inclinationDeg }));
  expect(r.applicability).toBe('applicable');
  close(r.bendingStiffnessLbfIn2, 1); close(r.radialClearanceIn, 1);
  close(r.sinusoidalThresholdLbf, sinusoidal); close(r.helicalThresholdLbf, helical);
});

test('threshold scaling and independent SI conversion check inch/foot/psi units', () => {
  const r = calcBucklingThresholds(thresholdInput({ odIn: 5, idIn: 4, youngsModulusPsi: 30000000 }));
  // Independent SI evaluation: E Pa, I m^4, w N/m, radial clearance m.
  const od = 5 * 0.0254, id = 4 * 0.0254, hole = 7 * 0.0254;
  const siLbf = 2 * Math.sqrt((30000000 * 6894.757293168) * (Math.PI / 64 * (od ** 4 - id ** 4)) *
    (12 * 4.4482216152605 / 0.3048) / ((hole - od) / 2)) / 4.4482216152605;
  // The initial hole=3 is intentionally invalid for OD=5.
  expect(r.applicability).toBe('unavailable');
  const actual = calcBucklingThresholds(thresholdInput({ odIn: 5, idIn: 4, wellboreDiameterIn: 7, youngsModulusPsi: 30000000 }));
  close(actual.sinusoidalThresholdLbf, siLbf, 1e-6);
  close(calcBucklingThresholds(thresholdInput({ youngsModulusPsi: 128 / Math.PI })).sinusoidalThresholdLbf, 2 * Math.SQRT2);
  close(calcBucklingThresholds(thresholdInput({ wellboreDiameterIn: 9 })).sinusoidalThresholdLbf, 1);
});

test.each([
  [{ inclinationDeg: 0 }, 'Vertical'], [{ curvatureRadPerFt: 1e-12 }, 'Curved'],
  [{ inclinationDeg: 91 }, 'over-horizontal'], [{ buoyedWeightPerFt: 0 }, 'Zero buoyed'],
  [{ bucklingIdealizationConfirmed: false }, 'not been confirmed']
])('unsupported idealization is Not Evaluated: %j', (extra, reason) => {
  const r = calcBucklingThresholds(thresholdInput(extra));
  expect(r.applicability).toBe('not-evaluated');
  expect(r.warnings.join(' ')).toContain(reason); expect(r.sinusoidalThresholdLbf).toBeNull();
  expect(r.helicalThresholdLbf).toBeNull();
});

test.each([
  ['youngsModulusPsi', undefined], ['youngsModulusPsi', ''], ['youngsModulusPsi', -1],
  ['wellboreDiameterIn', undefined], ['wellboreDiameterIn', NaN], ['idIn', undefined],
  ['odIn', 0], ['idIn', 1], ['componentLengthFt', 0], ['buoyedWeightPerFt', -1]
])('missing/invalid %s=%s is Unavailable', (key, value) => {
  const r = calcBucklingThresholds(thresholdInput({ [key]: value }));
  expect(r.applicability).toBe('unavailable'); expect(r.missingInputs).toContain(key);
});

test.each([1, 0.5])('hole diameter %s has insufficient radial clearance', wellboreDiameterIn => {
  const r = calcBucklingThresholds(thresholdInput({ wellboreDiameterIn }));
  expect(r.applicability).toBe('unavailable'); expect(r.missingInputs).toContain('positiveRadialClearance');
});

test('surface-to-jar scope and first onsets agree with independent straight-well force balance', () => {
  const input = base({ surfaceHookloadLbf: 100, frictionCoefficient: 0.25 });
  const original = JSON.stringify(input);
  const r = calcJarDownBuckling(input);
  const slope = 12 * (Math.sqrt(3) / 2 - 0.25 / 2);
  expect(r.status).toBe('calculated'); expect(r.evaluatedDepthInterval).toEqual({ topMdFt: 0, bottomMdFt: 990 });
  close(r.summary.firstSinusoidalOnset.mdFt, (100 + Math.SQRT2) / slope);
  close(r.summary.firstHelicalOnset.mdFt, 102 / slope);
  close(r.staticLoads.jarAxialLoadLbf, -100 + 990 * slope);
  expect(r.intervals.at(-1).bottomMdFt).toBe(990);
  expect(r.intervals.at(-1).classification).toBe('helical-onset-reached');
  expect(r.summary.controllingMdFt).toBe(990);
  expect(JSON.stringify(input)).toBe(original);
  const forward = calcStaticJarLoads({ ...input, direction: 'slackoff' });
  expect(r.staticLoads.profile).toEqual(forward.profile);
});

test('sinusoidal-only interval and an exact threshold endpoint are distinguished', () => {
  const r = calcJarDownBuckling(base({ bitMdFt: 20, bha: { holeSize: 3, rows: [row('JAR', 20)] },
    surfaceHookloadLbf: 12 * 10 * Math.sqrt(3) / 2 - 1.7 }));
  expect(r.intervals.at(-1).classification).toBe('sinusoidal-onset-reached');
  expect(r.summary.firstHelicalOnset).toBeNull();
  const exact = calcJarDownBuckling(base({ bitMdFt: 20, bha: { holeSize: 3, rows: [row('JAR', 20)] },
    surfaceHookloadLbf: 12 * 10 * Math.sqrt(3) / 2 - 2 }));
  close(exact.intervals.at(-1).maximumCompressionLbf, 2);
});

test('exact zero compression at the jar and tension above it do not produce an onset', () => {
  // Same independent arithmetic as the straight vertical-projection balance.
  const survey = geometry(60);
  const trial = calcStaticJarLoads(base({ survey, direction: 'slackoff', surfaceHookloadLbf: 0 }));
  const r = calcJarDownBuckling(base({ survey, surfaceHookloadLbf: trial.gravityAxialLbf }));
  close(r.intervals.at(-1).axialForceLbf, 0);
  expect(r.summary.firstSinusoidalOnset).toBeNull();
  expect(r.summary.firstHelicalOnset).toBeNull();
  expect(r.intervals.every(i => i.maximumCompressionLbf < 1e-8)).toBe(true);
});

test.each([0, 1000])('horizontal zero/tension profile is not compression (hookload=%s)', surfaceHookloadLbf => {
  const r = calcJarDownBuckling(base({ survey: geometry(90), surfaceHookloadLbf, frictionCoefficient: 0.25 }));
  expect(r.summary.firstSinusoidalOnset).toBeNull(); expect(r.summary.firstHelicalOnset).toBeNull();
  expect(r.intervals.every(i => i.classification === 'no-compression')).toBe(true);
});

test('vertical and curved/build/turn sections are explicitly Not Evaluated', () => {
  const vertical = calcJarDownBuckling(base({ survey: geometry(0) }));
  expect(vertical.status).toBe('not-evaluated'); expect(vertical.summary.maximumSinusoidalUtilization).toBeNull();
  const survey = calculateSurveyGeometry([
    { mdFt: 0, inclinationDeg: 30, azimuthDeg: 0 }, { mdFt: 500, inclinationDeg: 60, azimuthDeg: 0 },
    { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 30 }
  ]);
  const curved = calcJarDownBuckling(base({ survey, frictionCoefficient: 0.25 }));
  expect(curved.status).toBe('not-evaluated');
  expect(curved.intervals.every(i => i.curvatureRadPerFt > 0 && i.sinusoidalThresholdLbf === null)).toBe(true);
  expect(curved.staticLoads.convergence.checked).toBe(true);
});

test('partial applicability, missing inputs and invalid explicit overrides never imply stability', () => {
  const bha = assembly(); delete bha.rows[0].youngsModulusPsi;
  const r = calcJarDownBuckling(base({ bha }));
  expect(r.status).toBe('partial'); expect(r.missingInputs).toContain('youngsModulusPsi');
  expect(r.summary.completeCoverage).toBe(false);
  expect(calcJarDownBuckling(base({ bha, youngsModulusPsi: 64 / Math.PI })).status).toBe('calculated');
  bha.rows.forEach(c => { delete c.youngsModulusPsi; });
  expect(calcJarDownBuckling(base({ bha })).status).toBe('unavailable');
  delete bha.holeSize;
  expect(calcJarDownBuckling(base({ bha })).missingInputs).toContain('wellboreDiameterIn');
  expect(calcJarDownBuckling(base({ wellboreDiameterIn: '' })).status).toBe('unavailable');
});

test('curved-to-straight survey transition preserves unknown coverage and exact force samples', () => {
  const survey = calculateSurveyGeometry([
    { mdFt: 0, inclinationDeg: 30, azimuthDeg: 0 },
    { mdFt: 500, inclinationDeg: 60, azimuthDeg: 0 },
    { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 0 }
  ]);
  const r = calcJarDownBuckling(base({ survey }));
  expect(r.status).toBe('partial');
  expect(r.intervals.filter(i => i.bottomMdFt <= 500).every(i => i.applicability === 'not-evaluated')).toBe(true);
  expect(r.intervals.filter(i => i.topMdFt >= 500).every(i => i.applicability === 'applicable')).toBe(true);
  r.intervals.forEach(i => {
    expect(i.mdFt).toBe(i.bottomMdFt); expect(i.axialForceLbf).toBe(i.bottomAxialForceLbf);
  });
});

test('no modulus or idealization is inferred from Skeem, names or other rows', () => {
  const bha = assembly();
  delete bha.rows[0].youngsModulusPsi; delete bha.rows[1].bucklingIdealizationConfirmed;
  bha.skeem = { youngsModulusPsi: 30000000 }; bha.rows[0].toolName = 'Steel hydraulic jar';
  const r = calcJarDownBuckling(base({ bha }));
  expect(r.status).toBe('unavailable');
  expect(r.intervals.filter(i => i.componentIndex === 0).every(i => i.missingInputs.includes('youngsModulusPsi'))).toBe(true);
  expect(r.intervals.filter(i => i.componentIndex === 1).every(i => i.applicability === 'not-evaluated')).toBe(true);
});

test('numerical overflow and malformed threshold inputs return Unavailable', () => {
  expect(calcBucklingThresholds(null).applicability).toBe('unavailable');
  const r = calcBucklingThresholds(thresholdInput({ odIn: 1e100, wellboreDiameterIn: 2e100 }));
  expect(r.applicability).toBe('unavailable'); expect(r.sinusoidalThresholdLbf).toBeNull();
  expect(r.bendingStiffnessLbfIn2).toBeNull();
});

test('component transitions preserve force continuity and use distinct tubular EI and clearance', () => {
  const bha = assembly(); bha.rows[0].od = 2; bha.rows[0].idSize = 1;
  const r = calcJarDownBuckling(base({ bha, surfaceHookloadLbf: 1 }));
  const boundary = r.intervals.findIndex(i => i.componentIndex === 0);
  expect(r.intervals[boundary].topMdFt).toBe(980);
  expect(r.intervals[boundary].topAxialForceLbf).toBe(r.intervals[boundary - 1].bottomAxialForceLbf);
  close(r.intervals[boundary].bendingStiffnessLbfIn2, 15);
  close(r.intervals[boundary].radialClearanceIn, 0.5);
  close(r.intervals[boundary].sinusoidalThresholdLbf / r.intervals[boundary - 1].sinusoidalThresholdLbf, Math.sqrt(30));
});

test('deployment, buoyancy, selected jar and nonzero surface reference use existing geometry', () => {
  const bha = { holeSize: 3, rows: [row('JAR', 20), row('DC', 80), row('JAR', 20, { rowId: 'upper' }), row('DP', 1)] };
  for (const bitMdFt of [1000, 1500]) {
    const r = calcJarDownBuckling(base({ bha, bitMdFt, surfaceMdFt: 100, jarIndex: 1, buoyancyFactor: 0.8 }));
    expect(r.staticLoads.deployment.deployedDpLengthFt).toBe(bitMdFt - 220);
    expect(r.evaluatedDepthInterval).toEqual({ topMdFt: 100, bottomMdFt: bitMdFt - 110 });
    close(r.intervals[0].buoyedWeightPerFt, 9.6);
    close(r.staticLoads.jarAxialLoadLbf, (bitMdFt - 210) * 9.6 * Math.sqrt(3) / 2);
    expect(r.intervals.every(i => i.componentIndex >= 2)).toBe(true);
  }
});

test('reference boundary is reused; wrong branch, invalid loads and incomplete surveys are rejected', () => {
  const input = base({ loadMode: 'reference', referenceHookloadLbf: 100, appliedLoadLbf: 20 });
  expect(calcJarDownBuckling(input).staticLoads.surfaceHookloadLbf).toBe(80);
  for (const bad of [null, { direction: 'pickup' }, { surfaceHookloadLbf: -1 }, { bitMdFt: 2100 }]) {
    expect(calcJarDownBuckling(bad === null ? null : base(bad)).valid).toBe(false);
  }
});
