/* Run from repository root: node docs/ValidationStudies/Test4BucklingStudyStage4C3.cjs
 * Writes only the adjacent JSON artifact. No saved workspace/BHA is accessed. */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const originalLoader = Module._extensions['.js'];
const root = path.resolve('src/engineering') + path.sep;
Module._extensions['.js'] = (m, filename) => filename.startsWith(root)
  ? m._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code, filename) : originalLoader(m, filename);
const { solveStaticJarHookload } = require('../../src/engineering/jar/inverseStaticJarLoads');
const { identifyCompressedSections } = require('../../src/engineering/jar/compressedSections');
const { calcJarDownBuckling } = require('../../src/engineering/jar/drillstringBuckling');
const { calculateSurveyGeometry } = require('../../src/engineering/survey/surveyGeometry');
const { parseSurveyCsv } = require('../../src/engineering/survey/surveyImport');
const surveyPath = 'docs/ValidationStudies/SyntheticDirectionalWell.csv';
const survey = calculateSurveyGeometry(parseSurveyCsv(fs.readFileSync(surveyPath, 'utf8'), { mdUnit: 'ft', angleUnit: 'deg' }).stations);
const row = (rowId, category, length, weight, od, idSize) => ({ rowId, category, toolName: rowId, length, weight, od, idSize });
const bha = { holeSize: 16, drillpipeReferenceBitMdFt: 12000, rows: [
  row('stabiliser', 'STAB', 5, 111.25, 6.75, 2), row('lowerDC', 'DC', 300, 116, 6.75, 1.5),
  row('jar', 'JAR', 30, 150, 9.5, 3), row('upperDC', 'DC', 180, 116, 6.75, 1.5),
  { ...row('DP', 'DP', 0, 27.76, 5.5, 4.67), lengthMode: 'auto' }
] };
const base = { bha, survey, bitMdFt: 12000, surfaceMdFt: 0, mudWeightPpg: 10,
  frictionCoefficient: 0.25, rpm: 150, jarIndex: 0, jarDirection: 'down', youngsModulusPsi: 30000000, maxStepFt: 5 };
const assert = (condition, message) => { if (!condition) throw Error(message); };
const overlap = (a, b) => Math.max(0, Math.min(a.bottomMdFt, b.bottomMdFt) - Math.max(a.topMdFt, b.topMdFt));

function run(targetKlbf) {
  const inverse = solveStaticJarHookload({ ...base, desiredJarForceLbf: targetKlbf * 1000 });
  if (!inverse.valid) return { targetKlbf, valid: false, status: inverse.status, errors: inverse.errors };
  const input = { ...base, surfaceHookloadLbf: inverse.requiredSurfaceHookloadLbf };
  const compressed = identifyCompressedSections(input);
  const strict = calcJarDownBuckling(input);
  // Explicit hypothetical local long-pipe comparison ONLY. Not a validated
  // stability assertion for the actual finite/nonuniform compressed section.
  const conditional = calcJarDownBuckling({ ...input, bha: { ...bha,
    rows: bha.rows.map(r => r.rowId === 'DP' ? { ...r, bucklingIdealizationConfirmed: true } : r) } });
  assert(compressed.valid && strict.valid && conditional.valid, 'Forward analysis failed.');
  assert(compressed.evaluatedDepthInterval.bottomMdFt === 11680, 'Wrong jar centre.');
  assert(strict.staticLoads.deployment.deployedDpLengthFt === 11485, 'Wrong deployment.');
  const residualLbf = compressed.staticLoads.jarAxialLoadLbf - targetKlbf * 1000;
  assert(Math.abs(residualLbf) <= inverse.residualToleranceLbf, 'Forward/inverse residual failed.');
  assert(strict.staticLoads.jarAxialLoadLbf === conditional.staticLoads.jarAxialLoadLbf &&
    strict.staticLoads.jarAxialLoadLbf === compressed.staticLoads.jarAxialLoadLbf, 'Comparison changed loads.');
  assert(strict.summary.applicableIntervalCount === 0, 'Unconfirmed model unexpectedly applied.');
  assert(conditional.intervals.filter(i => i.applicability === 'applicable').every(i =>
    i.componentId === 'DP' && i.curvatureRadPerFt === 0 && Math.abs(i.inclinationDeg - 60) < 1e-8 && i.topMdFt >= 5000 && i.bottomMdFt <= 11485), 'Unsupported interval evaluated.');
  const eligibleElements = conditional.intervals.filter(i => i.applicability === 'applicable');
  const coveredLengthFt = compressed.compressedIntervals.reduce((n, c) =>
    n + eligibleElements.reduce((sum, e) => sum + overlap(c, e), 0), 0);
  const parts = compressed.compressedIntervals.flatMap(c => c.segments.map(s => ({ topMdFt: s.topMdFt,
    bottomMdFt: s.bottomMdFt, lengthFt: s.lengthFt, geometry: s.geometry.classification, componentId: s.componentId,
    geometricallyEligible: s.screening.geometricallyEligible, properties: s.properties })));
  const geometry = {};
  for (const type of ['vertical', 'build', 'straight-inclined']) geometry[type] = {
    compressedLengthFt: parts.filter(s => s.geometry === type).reduce((n, s) => n + s.lengthFt, 0)
  };
  assert(Math.abs(Object.values(geometry).reduce((n, g) => n + g.compressedLengthFt, 0) - compressed.totalCompressedLengthFt) < 1e-7, 'Geometry coverage mismatch.');
  const e = eligibleElements[0];
  // Independent SI dimensional check of the named criterion; no engineering API
  // is used in this check. SI E, I, w and radius, then convert N back to lbf.
  const inertiaM4 = Math.PI / 64 * ((5.5 * .0254) ** 4 - (4.67 * .0254) ** 4);
  const siFs = 2 * Math.sqrt(30000000 * 6894.757293168 * inertiaM4 *
    (27.76 * (1 - 10 / 65.5) * 4.4482216152605 / .3048) * Math.sin(Math.PI / 3) / ((16 - 5.5) / 2 * .0254)) / 4.4482216152605;
  assert(Math.abs(siFs - e.sinusoidalThresholdLbf) < 1e-6, 'Independent SI threshold mismatch.');
  const bf = 1 - 10 / 65.5;
  const projection = Math.cos(Math.PI / 3) - .25 * Math.sin(Math.PI / 3);
  const dpBottomCompressionLbf = compressed.staticLoads.jarAxialLoadLbf - (15 * 150 + 180 * 116) * bf * projection;
  const gradientLbfPerFt = 27.76 * bf * projection;
  const expectedOnset = threshold => dpBottomCompressionLbf < threshold ? null
    : Math.max(5000, 11485 - (dpBottomCompressionLbf - threshold) / gradientLbfPerFt);
  for (const [key, threshold] of [['firstSinusoidalOnset', siFs], ['firstHelicalOnset', Math.SQRT2 * siFs]]) {
    const expected = expectedOnset(threshold), actual = conditional.summary[key]?.mdFt ?? null;
    assert(expected === null ? actual === null : actual !== null && Math.abs(actual - expected) < 1e-6, 'Independent tangent threshold location mismatch.');
  }
  const ranges = [];
  for (const i of conditional.intervals) {
    if (i.applicability !== 'applicable' || i.maximumCompressionLbf <= 0) continue;
    const previous = ranges[ranges.length - 1];
    if (previous && previous.bottomMdFt === i.topMdFt && previous.classification === i.classification) previous.bottomMdFt = i.bottomMdFt;
    else ranges.push({ topMdFt: i.topMdFt, bottomMdFt: i.bottomMdFt, classification: i.classification });
  }
  return { targetKlbf, valid: true, requiredSurfaceHookloadLbf: inverse.requiredSurfaceHookloadLbf,
    jarAxialLoadLbf: compressed.staticLoads.jarAxialLoadLbf, residualLbf,
    evaluatedDepthInterval: compressed.evaluatedDepthInterval, totalCompressedLengthFt: compressed.totalCompressedLengthFt,
    compressedIntervals: compressed.compressedIntervals.map(c => ({ topMdFt: c.topMdFt, bottomMdFt: c.bottomMdFt,
      lengthFt: c.lengthFt, maximumCompressionLbf: c.maximumCompressionLbf, maximumCompressionMdFt: c.maximumCompressionMdFt,
      componentBoundaries: c.componentBoundaries, geometryTransitions: c.geometryTransitions })),
    geometry, parts, strict: { status: strict.status, summary: strict.summary, evaluatedCompressedLengthFt: 0,
      unevaluatedCompressedLengthFt: compressed.totalCompressedLengthFt, missingInputs: strict.missingInputs,
      reasons: [...new Set(strict.intervals.flatMap(i => i.warnings))] },
    conditionalDpOnly: { status: conditional.status, summary: conditional.summary,
      evaluatedCompressedLengthFt: coveredLengthFt, unevaluatedCompressedLengthFt: compressed.totalCompressedLengthFt - coveredLengthFt,
      sinusoidalThresholdLbf: e.sinusoidalThresholdLbf, helicalThresholdLbf: e.helicalThresholdLbf,
      independentSiSinusoidalThresholdLbf: siFs, radialClearanceIn: e.radialClearanceIn,
      dpBottomCompressionLbf, independentSinusoidalOnsetMdFt: expectedOnset(siFs),
      independentHelicalOnsetMdFt: expectedOnset(Math.SQRT2 * siFs),
      compressionClassificationSampleBrackets: ranges },
    convergence: compressed.staticLoads.convergence, warnings: strict.warnings };
}
const scenarios = [10, 25, 50, 75, 100].map(run);
const output = { configuration: { ...base, survey: undefined, surveyPath,
  nominalHoleSource: 'bha.holeSize = 16 in (study Bit Size; no explicit bore override)',
  conditionalAssumption: 'DP only: hypothetical long uniform initially straight zero-torque frictionless-onset local comparison. Not confirmation of actual compressed-section stability.' }, scenarios };
fs.writeFileSync(path.join(__dirname, 'Test4BucklingStudyStage4C3.json'), JSON.stringify(output, null, 2) + '\n');
for (const r of scenarios) console.log(JSON.stringify({ target: r.targetKlbf, valid: r.valid,
  hookloadKlbf: r.requiredSurfaceHookloadLbf / 1000, totalCompressedLengthFt: r.totalCompressedLengthFt,
  strict: r.strict, conditional: r.conditionalDpOnly, geometry: r.geometry }));
