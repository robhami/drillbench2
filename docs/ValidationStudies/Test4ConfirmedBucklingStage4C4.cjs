// Run from repo root; writes only adjacent Stage 4C.4 JSON.
const fs = require('fs'), path = require('path'), Module = require('module'), babel = require('@babel/core');
const original = Module._extensions['.js'], root = path.resolve('src/engineering') + path.sep;
Module._extensions['.js'] = (m, filename) => filename.startsWith(root) ? m._compile(babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs']
}).code, filename) : original(m, filename);
const { evaluateConfirmedDpBuckling } = require('../../src/engineering/jar/confirmedDpBuckling');
const { solveStaticJarHookload } = require('../../src/engineering/jar/inverseStaticJarLoads');
const { calculateSurveyGeometry } = require('../../src/engineering/survey/surveyGeometry');
const { parseSurveyCsv } = require('../../src/engineering/survey/surveyImport');
const reference = JSON.parse(fs.readFileSync(path.join(__dirname, 'Test4BucklingStudyStage4C3.json'), 'utf8'));
const config = reference.configuration;
const survey = calculateSurveyGeometry(parseSurveyCsv(fs.readFileSync(config.surveyPath, 'utf8'), { mdUnit: 'ft', angleUnit: 'deg' }).stations);
const scenarios = reference.scenarios.map(previous => {
  const input = { ...config, survey, desiredJarForceLbf: previous.targetKlbf * 1000 };
  const inverse = solveStaticJarHookload(input);
  if (!inverse.valid) throw Error(JSON.stringify(inverse.errors));
  const result = evaluateConfirmedDpBuckling({ ...input, surfaceHookloadLbf: inverse.requiredSurfaceHookloadLbf,
    selectedDpIndex: 4, youngsModulusPsi: 30000000, confirmed: true });
  if (!result.valid) throw Error(result.reason);
  const differences = {};
  for (const key of ['firstSinusoidalOnset', 'firstHelicalOnset']) {
    const actual = result.summary[key], expected = previous.conditionalDpOnly.summary[key];
    if (Boolean(actual) !== Boolean(expected)) throw Error('Onset availability changed.');
    differences[key] = actual ? actual.mdFt - expected.mdFt : null;
    if (actual && (Math.abs(differences[key]) > 1e-6 || actual.atIntervalTop !== expected.atIntervalTop)) throw Error('Onset differs.');
  }
  if (Math.abs(result.summary.maximumSinusoidalUtilization - previous.conditionalDpOnly.summary.maximumSinusoidalUtilization) > 1e-10 ||
    Math.abs(result.evaluatedCompressedLengthFt - previous.conditionalDpOnly.evaluatedCompressedLengthFt) > 1e-6) throw Error('Coverage/utilization differs.');
  return { targetKlbf: previous.targetKlbf, requiredSurfaceHookloadLbf: inverse.requiredSurfaceHookloadLbf,
    residualLbf: inverse.residualLbf, summary: result.summary, evaluatedDepthInterval: result.calculated.evaluatedDepthInterval,
    evaluatedCompressedLengthFt: result.evaluatedCompressedLengthFt, unevaluatedCompressedLengthFt: result.unevaluatedCompressedLengthFt,
    exclusions: result.exclusions, differencesFromStage4C3Ft: differences };
});
fs.writeFileSync(path.join(__dirname, 'Test4ConfirmedBucklingStage4C4.json'), JSON.stringify({
  assumptions: { youngsModulusPsi: 30000000, nominalHoleDiameterIn: 16, selectedDpIndex: 4, confirmed: true,
    note: 'Explicit user confirmation of the existing long uniform DP idealization; no field validation or complete compressed-section stability solution.' }, scenarios
}, null, 2) + '\n');
console.log(JSON.stringify(scenarios.map(({ exclusions, ...result }) => result), null, 2));
