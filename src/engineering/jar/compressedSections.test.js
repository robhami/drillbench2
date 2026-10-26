import { identifyCompressedSections, identifyLoadRegions } from './compressedSections';
import { calcStaticJarLoads } from './staticJarLoads';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';

const close = (a, b, tolerance = 1e-7) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance);
const profile = forces => forces.map((axialForceLbf, i) => ({ mdFt: i * 10, axialForceLbf }));
const row = (category, length, extra = {}) => ({ rowId: category, category, toolName: category,
  length, weight: 100, od: 5, idSize: 4, youngsModulusPsi: 30000000, ...extra });
const survey = (inclinationDeg = 0) => calculateSurveyGeometry([
  { mdFt: 0, inclinationDeg, azimuthDeg: 0 }, { mdFt: 2000, inclinationDeg, azimuthDeg: 0 }
]);
const bha = () => ({ holeSize: 8, rows: [row('JAR', 20), row('DC', 980)] });
const base = extra => ({ bha: bha(), survey: survey(), bitMdFt: 1000, buoyancyFactor: 1,
  frictionCoefficient: 0, surfaceHookloadLbf: 50000, ...extra });

test('entire profile in tension retains tension and no compressed section', () => {
  const r = identifyLoadRegions(profile([-10, -20, -30]));
  expect(r.regions).toHaveLength(1); expect(r.regions[0].loadState).toBe('tension');
  expect(r.compressedIntervals).toEqual([]); expect(r.zeroForceEvents).toEqual([]);
});

test('entire positive profile is one section, independent of sample count', () => {
  const r = identifyLoadRegions(profile([10, 30, 20, 10]));
  expect(r.compressedIntervals).toHaveLength(1);
  expect(r.totalCompressedLengthFt).toBe(30);
  expect(r.compressedIntervals[0]).toMatchObject({ topMdFt: 0, bottomMdFt: 30, maximumCompressionLbf: 30, maximumCompressionMdFt: 10 });
});

test('single compressed section interpolates both crossing locations', () => {
  const r = identifyLoadRegions(profile([-10, 30, -10]));
  expect(r.compressedIntervals[0]).toMatchObject({ topMdFt: 2.5, bottomMdFt: 17.5, lengthFt: 15, maximumCompressionLbf: 30 });
  expect(r.zeroForceCrossings.map(e => e.mdFt)).toEqual([2.5, 17.5]);
  expect(r.zeroForceCrossings[0].bracket).toEqual({ topMdFt: 0, bottomMdFt: 10 });
});

test('multiple compressed intervals never bridge tension', () => {
  const r = identifyLoadRegions(profile([-10, 10, -10, 30, -10]));
  expect(r.compressedIntervals).toHaveLength(2);
  expect(r.compressedIntervals.map(i => [i.topMdFt, i.bottomMdFt])).toEqual([[5, 15], [22.5, 37.5]]);
  expect(r.zeroForceCrossings).toHaveLength(4);
});

test('zero touches separate compression without creating sign-change events', () => {
  const r = identifyLoadRegions(profile([10, 0, 10]));
  expect(r.compressedIntervals).toHaveLength(2); expect(r.zeroForceCrossings).toEqual([]);
  expect(r.zeroForceEvents[0].type).toBe('zero-touch');
});

test('zero plateau, isolated sample crossing and zero boundaries stay distinct', () => {
  const plateau = identifyLoadRegions(profile([-10, 0, 0, 10]));
  expect(plateau.regions.map(r => r.loadState)).toEqual(['tension', 'zero', 'compression']);
  expect(plateau.zeroForceCrossings[0]).toMatchObject({ type: 'zero-plateau', mdFt: null, topMdFt: 10, bottomMdFt: 20 });
  expect(identifyLoadRegions(profile([-10, 0, 10])).zeroForceCrossings[0]).toMatchObject({ type: 'sample-crossing', mdFt: 10 });
  const zero = identifyLoadRegions(profile([0, 0, 0]));
  expect(zero.compressedIntervals).toEqual([]); expect(zero.regions[0].loadState).toBe('zero');
  expect(identifyLoadRegions(profile([0, 10])).zeroForceEvents[0].type).toBe('zero-boundary');
});

test('force tolerance is explicit and does not modify original samples', () => {
  const input = profile([1, 1e-10, 1]); const original = JSON.stringify(input);
  expect(identifyLoadRegions(input).compressedIntervals).toHaveLength(2);
  expect(identifyLoadRegions(input).zeroForceEvents[0].numericalZero).toBe(true);
  expect(identifyLoadRegions(input, { forceToleranceLbf: 0 }).compressedIntervals).toHaveLength(1);
  expect(JSON.stringify(input)).toBe(original);
});

test.each([[], [{ mdFt: 0, axialForceLbf: 1 }], profile([1, NaN]), [{ mdFt: 1, axialForceLbf: 1 }, { mdFt: 0, axialForceLbf: 2 }]].map(p => [p]))('malformed profile is rejected', input => {
  expect(identifyLoadRegions(input).valid).toBe(false);
});

test('opposite very large finite loads interpolate without overflow', () => {
  close(identifyLoadRegions(profile([-1e308, 1e308])).zeroForceCrossings[0].mdFt, 5);
});

test('vertical independent force balance, jar-centre scope and component boundary', () => {
  const input = base(), before = JSON.stringify(input), r = identifyCompressedSections(input);
  expect(r.valid).toBe(true); expect(r.evaluatedDepthInterval).toEqual({ topMdFt: 0, bottomMdFt: 990 });
  expect(r.compressedIntervals).toHaveLength(1);
  const c = r.compressedIntervals[0];
  close(c.topMdFt, 500); close(c.lengthFt, 490); close(c.maximumCompressionLbf, 49000);
  expect(c.maximumCompressionMdFt).toBe(990);
  expect(c.componentBoundaries).toEqual([{ mdFt: 980, fromComponentIndex: 1, toComponentIndex: 0, fromComponentId: 'DC', toComponentId: 'JAR' }]);
  expect(c.geometryClassification).toBe('vertical'); expect(c.segments).toHaveLength(2);
  expect(c.segments.every(s => !s.screening.geometricallyEligible && !s.screening.fullyEvaluated)).toBe(true);
  expect(r.staticLoads.profile).toEqual(calcStaticJarLoads({ ...input, direction: 'slackoff' }).profile);
  expect(JSON.stringify(input)).toBe(before);
});

test('entire actual evaluated interval can be compressed below its zero surface boundary', () => {
  const r = identifyCompressedSections(base({ surfaceHookloadLbf: 0 }));
  expect(r.compressedIntervals[0]).toMatchObject({ topMdFt: 0, bottomMdFt: 990, lengthFt: 990 });
  expect(r.zeroForceEvents[0].type).toBe('zero-boundary');
  expect(identifyCompressedSections(base({ surfaceHookloadLbf: 200000 })).compressedIntervals).toEqual([]);
});

test('vertical-build-tangent sequence is one compressed specimen with geometry transitions', () => {
  const geometry = calculateSurveyGeometry([
    { mdFt: 0, inclinationDeg: 0, azimuthDeg: 0 }, { mdFt: 200, inclinationDeg: 0, azimuthDeg: 0 },
    { mdFt: 500, inclinationDeg: 60, azimuthDeg: 0 }, { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 0 }
  ]);
  const r = identifyCompressedSections(base({ survey: geometry, surfaceHookloadLbf: 0 }));
  expect(r.compressedIntervals).toHaveLength(1);
  const c = r.compressedIntervals[0];
  expect(c.geometryTypes).toEqual(['vertical', 'build', 'straight-inclined']);
  expect(c.geometryClassification).toBe('mixed');
  expect(c.geometryTransitions).toEqual([{ mdFt: 200, from: 'vertical', to: 'build' }, { mdFt: 500, from: 'build', to: 'straight-inclined' }]);
  expect(c.segments.find(s => s.geometry.classification === 'build').screening.geometricallyEligible).toBe(false);
  expect(c.segments.find(s => s.geometry.classification === 'straight-inclined').screening.geometricallyEligible).toBe(true);
});

test.each([[60, 0, 30, 0, 'drop'], [60, 0, 60, 30, 'mixed'], [90, 350, 90, 10, 'azimuthal-turn']])('curved geometry %s/%s to %s/%s: %s', (ia, aa, ib, ab, expected) => {
  // The initial build supplies gravity compression before a horizontal turn.
  const geometry = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: aa },
    { mdFt: 100, inclinationDeg: ia, azimuthDeg: aa }, { mdFt: 1000, inclinationDeg: ib, azimuthDeg: ab }]);
  const r = identifyCompressedSections(base({ survey: geometry, surfaceHookloadLbf: 0 }));
  expect(r.compressedIntervals[0].geometryTypes).toContain(expected);
});

test('mixed tubulars report independent EI/clearance and property changes at exact boundary', () => {
  const assembly = bha(); assembly.rows[0] = row('JAR', 20, { od: 6, idSize: 3, wellboreDiameterIn: 9, youngsModulusPsi: 20000000 });
  const r = identifyCompressedSections(base({ bha: assembly })), c = r.compressedIntervals[0];
  const lower = c.segments[1].properties;
  // At EI~1.2e9 a single binary64 ULP is ~2.4e-7; check relative precision.
  expect(lower.bendingStiffnessLbfIn2 / (20000000 * Math.PI * (6 ** 4 - 3 ** 4) / 64)).toBeCloseTo(1, 14);
  close(lower.radialClearanceIn, 1.5);
  expect(c.tubularPropertyTransitions[0].mdFt).toBe(980);
  expect(c.tubularPropertyTransitions[0].changes.map(x => x.property)).toEqual(expect.arrayContaining(['odIn', 'idIn', 'componentLengthFt', 'youngsModulusPsi', 'bendingStiffnessLbfIn2', 'wellboreDiameterIn']));
});

test('missing modulus and hole do not prevent section identification or invent inputs', () => {
  const assembly = bha(); delete assembly.holeSize; assembly.rows.forEach(c => { delete c.youngsModulusPsi; });
  const r = identifyCompressedSections(base({ bha: assembly }));
  expect(r.valid).toBe(true); close(r.totalCompressedLengthFt, 490);
  expect(r.missingInputs.every(m => m.inputs.includes('youngsModulusPsi') && m.inputs.includes('wellboreDiameterIn'))).toBe(true);
  expect(r.compressedIntervals[0].segments.every(s => s.properties.bendingStiffnessLbfIn2 === null && s.properties.radialClearanceIn === null)).toBe(true);
  const supplied = identifyCompressedSections(base({ bha: assembly, youngsModulusPsi: 30000000, wellboreDiameterIn: 8 }));
  expect(supplied.missingInputs).toEqual([]);
  const invalid = identifyCompressedSections(base({ wellboreDiameterIn: 4 }));
  expect(invalid.missingInputs[0].inputs).toContain('positiveRadialClearance');
});

test('geometric eligibility is separate from material availability and actual evaluation', () => {
  const r = identifyCompressedSections(base({ survey: survey(30), surfaceHookloadLbf: 0 }));
  const screening = r.compressedIntervals[0].segments[0].screening;
  expect(screening).toMatchObject({ geometricallyEligible: true, requiredInputsAvailable: true, idealizationConfirmed: false, fullyEvaluated: false, evaluationStatus: 'not-evaluated' });
});

test('within-arc drop/build reversal retains both mixed-geometry features', () => {
  const geometry = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 60, azimuthDeg: 330 },
    { mdFt: 1000, inclinationDeg: 60, azimuthDeg: 30 }]);
  const r = identifyCompressedSections(base({ survey: geometry, surfaceHookloadLbf: 0 }));
  const segments = r.compressedIntervals[0].segments;
  expect(segments[0].geometry.features).toEqual(['drop', 'azimuthal-turn']);
  expect(segments.at(-1).geometry.features).toEqual(['build', 'azimuthal-turn']);
  const reversal = r.compressedIntervals[0].geometryTransitions.find(t => t.fromFeatures);
  close(reversal.mdFt, 500);
});

test('small nonzero curvature may have a straight label but never gains screening eligibility', () => {
  const geometry = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 30, azimuthDeg: 0 },
    { mdFt: 1000, inclinationDeg: 30 + 1e-9, azimuthDeg: 0 }]);
  const r = identifyCompressedSections(base({ survey: geometry, surfaceHookloadLbf: 0 }));
  const segment = r.compressedIntervals[0].segments[0];
  expect(segment.geometry.classification).toBe('straight-inclined');
  expect(segment.geometry.curvatureRadPerFt).toBeGreaterThan(0);
  expect(segment.screening.geometricallyEligible).toBe(false);
});

test('known EI survives missing bore and invalid explicit modulus never falls back', () => {
  const assembly = bha(); delete assembly.holeSize;
  const r = identifyCompressedSections(base({ bha: assembly }));
  expect(r.compressedIntervals[0].segments[0].properties.bendingStiffnessLbfIn2).toBeGreaterThan(0);
  assembly.rows[1].youngsModulusPsi = '';
  const invalid = identifyCompressedSections(base({ bha: assembly, youngsModulusPsi: 30000000 }));
  expect(invalid.compressedIntervals[0].segments[0].properties.bendingStiffnessLbfIn2).toBeNull();
  expect(invalid.missingInputs[0].inputs).toContain('youngsModulusPsi');
});

test('automatic DP and selected jar use shared surface/depth deployment and buoyancy', () => {
  const assembly = { holeSize: 8, rows: [row('JAR', 20), row('DC', 80), row('JAR', 20, { rowId: 'upperJar' }), row('DP', 1)] };
  for (const bitMdFt of [1000, 1500]) {
    const r = identifyCompressedSections(base({ bha: assembly, bitMdFt, surfaceMdFt: 100, jarIndex: 1, surfaceHookloadLbf: 0, buoyancyFactor: 0.8 }));
    expect(r.staticLoads.deployment.deployedDpLengthFt).toBe(bitMdFt - 220);
    expect(r.evaluatedDepthInterval).toEqual({ topMdFt: 100, bottomMdFt: bitMdFt - 110 });
    close(r.totalCompressedLengthFt, bitMdFt - 210);
    expect(r.compressedIntervals[0].segments.every(s => s.componentIndex >= 2)).toBe(true);
    expect(r.compressedIntervals[0].segments[0].properties.buoyedWeightPerFt).toBe(80);
  }
});

test.each([null, { direction: 'pickup' }, { surfaceHookloadLbf: -1 }, { bitMdFt: 2100 }, { tolerances: { forceLbf: -1 } }])('invalid operation is rejected: %j', extra => {
  expect(identifyCompressedSections(extra === null ? null : base(extra)).valid).toBe(false);
});
