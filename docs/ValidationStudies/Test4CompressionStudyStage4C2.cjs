/* Reproduce Stage 4C.2 with unchanged engineering modules. Run from repo root:
 * node docs/ValidationStudies/Test4CompressionStudyStage4C2.cjs
 * Writes only the adjacent numerical JSON artifact. */
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
const { calcStaticJarLoads } = require('../../src/engineering/jar/staticJarLoads');
const { calculateSurveyGeometry } = require('../../src/engineering/survey/surveyGeometry');
const { parseSurveyCsv } = require('../../src/engineering/survey/surveyImport');

const surveyPath = 'docs/ValidationStudies/SyntheticDirectionalWell.csv';
const survey = calculateSurveyGeometry(parseSurveyCsv(fs.readFileSync(surveyPath, 'utf8'), { mdUnit: 'ft', angleUnit: 'deg' }).stations);
const row = (rowId, category, length, weight, od, idSize) => ({ rowId, category, toolName: rowId, length, weight, od, idSize });
const bha = { rows: [row('stabiliser', 'STAB', 5, 111.25, 6.75, 2), row('lowerDC', 'DC', 300, 116, 6.75, 1.5),
  row('jar', 'JAR', 30, 150, 9.5, 3), row('upperDC', 'DC', 180, 116, 6.75, 1.5), row('DP', 'DP', 0, 27.76, 5.5, 4.67)] };
const base = { bha, survey, bitMdFt: 12000, surfaceMdFt: 0, mudWeightPpg: 10, frictionCoefficient: 0.25, rpm: 150, jarIndex: 0, jarDirection: 'down' };
const zeroHook = calcStaticJarLoads({ ...base, direction: 'slackoff', surfaceHookloadLbf: 0 });
if (!zeroHook.valid) throw new Error(JSON.stringify(zeroHook.errors));

function sampleAt(profile, mdFt) {
  const exact = profile.find(p => p.mdFt === mdFt);
  if (exact) return exact.axialForceLbf;
  const j = profile.findIndex(p => p.mdFt > mdFt), a = profile[j - 1], b = profile[j];
  if (!a || !b) throw new Error('Study attempted profile extrapolation.');
  return a.axialForceLbf + (b.axialForceLbf - a.axialForceLbf) * (mdFt - a.mdFt) / (b.mdFt - a.mdFt);
}

function run(targetKlbf, maxStepFt = 5) {
  const input = { ...base, desiredJarForceLbf: targetKlbf * 1000, maxStepFt };
  const inv = solveStaticJarHookload(input);
  if (!inv.valid) return { targetKlbf, maxStepFt, valid: false, status: inv.status, errors: inv.errors };
  const r = identifyCompressedSections({ ...input, surfaceHookloadLbf: inv.requiredSurfaceHookloadLbf });
  if (!r.valid || r.evaluatedDepthInterval.bottomMdFt !== 11680 || r.staticLoads.deployment.deployedDpLengthFt !== 11485) throw new Error('Invalid study scope/deployment.');
  const residualLbf = r.staticLoads.jarAxialLoadLbf - targetKlbf * 1000;
  if (Math.abs(residualLbf) > inv.residualToleranceLbf) throw new Error('Independent forward verification failed.');
  const parts = [];
  for (const interval of r.compressedIntervals) for (const s of interval.segments) {
    const values = [{ mdFt: s.topMdFt, axialForceLbf: sampleAt(r.staticLoads.profile, s.topMdFt) },
      ...r.staticLoads.profile.filter(p => p.mdFt > s.topMdFt && p.mdFt < s.bottomMdFt),
      { mdFt: s.bottomMdFt, axialForceLbf: sampleAt(r.staticLoads.profile, s.bottomMdFt) }];
    const max = values.reduce((a, b) => b.axialForceLbf > a.axialForceLbf ? b : a);
    parts.push({ topMdFt: s.topMdFt, bottomMdFt: s.bottomMdFt, lengthFt: s.lengthFt, geometry: s.geometry.classification,
      componentId: s.componentId, geometricallyEligible: s.screening.geometricallyEligible,
      requiredInputsAvailable: s.screening.requiredInputsAvailable, fullyEvaluated: s.screening.fullyEvaluated,
      maximumCompressionLbf: max.axialForceLbf, maximumCompressionMdFt: max.mdFt });
  }
  const geometrySummary = {};
  for (const type of ['vertical', 'build', 'straight-inclined']) {
    const group = parts.filter(p => p.geometry === type);
    const max = group.reduce((a, b) => !a || b.maximumCompressionLbf > a.maximumCompressionLbf ? b : a, null);
    geometrySummary[type] = { compressedLengthFt: group.reduce((n, p) => n + p.lengthFt, 0),
      maximumCompressionLbf: max?.maximumCompressionLbf ?? null, maximumCompressionMdFt: max?.maximumCompressionMdFt ?? null };
  }
  // Independent straight-component balances; never extend the tangent into the build.
  const bf = 1 - 10 / 65.5, projection = 0.5 - 0.25 * Math.sqrt(3) / 2;
  const expectedJarTopForce = r.staticLoads.jarAxialLoadLbf - 15 * 150 * bf * projection;
  const expectedDcTopForce = expectedJarTopForce - 180 * 116 * bf * projection;
  const analyticalChecks = {
    jarTopForceDifferenceLbf: sampleAt(r.staticLoads.profile, 11665) - expectedJarTopForce,
    upperDcTopForceDifferenceLbf: sampleAt(r.staticLoads.profile, 11485) - expectedDcTopForce
  };
  if (Math.abs(analyticalChecks.jarTopForceDifferenceLbf) > 1e-6 || Math.abs(analyticalChecks.upperDcTopForceDifferenceLbf) > 1e-6) throw new Error('Straight-component analytical balance failed.');
  const onset = r.compressedIntervals[0]?.topMdFt;
  if (onset >= 5000) analyticalChecks.independentOnsetMdFt = 11485 - expectedDcTopForce / (27.76 * bf * projection);
  else if (onset < 3000) analyticalChecks.independentOnsetMdFt = inv.requiredSurfaceHookloadLbf / (27.76 * bf);
  if (analyticalChecks.independentOnsetMdFt !== undefined) {
    analyticalChecks.onsetDifferenceFt = onset - analyticalChecks.independentOnsetMdFt;
    if (Math.abs(analyticalChecks.onsetDifferenceFt) > 1e-6) throw new Error('Independent straight onset check failed.');
  }
  return { targetKlbf, maxStepFt, valid: true, status: inv.status,
    requiredSurfaceHookloadLbf: inv.requiredSurfaceHookloadLbf, jarAxialLoadLbf: r.staticLoads.jarAxialLoadLbf,
    residualLbf, inverseResidualLbf: inv.residualLbf, inverseEvaluations: inv.evaluations, inverseIterations: inv.iterations,
    convergence: r.staticLoads.convergence, profileSampleCount: r.staticLoads.profile.length,
    totalCompressedLengthFt: r.totalCompressedLengthFt,
    maximumCompression: r.compressedIntervals.reduce((a, b) => !a || b.maximumCompressionLbf > a.maximumCompressionLbf
      ? { maximumCompressionLbf: b.maximumCompressionLbf, mdFt: b.maximumCompressionMdFt } : a, null),
    compressedIntervals: r.compressedIntervals.map(i => ({ topMdFt: i.topMdFt, bottomMdFt: i.bottomMdFt, lengthFt: i.lengthFt,
      maximumCompressionLbf: i.maximumCompressionLbf, maximumCompressionMdFt: i.maximumCompressionMdFt,
      componentBoundaries: i.componentBoundaries, geometryTransitions: i.geometryTransitions, geometryTypes: i.geometryTypes })),
    geometrySummary, analyticalChecks, parts, zeroForceCrossings: r.zeroForceCrossings, missingInputs: r.missingInputs };
}

const scenarios = [], sensitivity = [];
for (const target of [0, 10, 25, 50, 75, 100]) {
  const result = run(target); scenarios.push(result);
  console.log(JSON.stringify({ target, valid: result.valid, status: result.status, hookloadLbf: result.requiredSurfaceHookloadLbf,
    lengthFt: result.totalCompressedLengthFt, max: result.maximumCompression, intervals: result.compressedIntervals, geometry: result.geometrySummary }));
}
for (const target of [10, 50, 100]) for (const step of [2.5, 1.25]) {
  const result = run(target, step); sensitivity.push(result);
  console.log(JSON.stringify({ sensitivity: true, target, step, valid: result.valid, hookloadLbf: result.requiredSurfaceHookloadLbf,
    lengthFt: result.totalCompressedLengthFt, max: result.maximumCompression, intervals: result.compressedIntervals }));
}
const output = { configuration: { surveyPath, bitMdFt: 12000, jarMdFt: 11680, surfaceMdFt: 0, mudWeightPpg: 10,
  frictionCoefficient: 0.25, rpm: 150, bha, forceSign: 'compression-positive', modulusSupplied: false, wellboreDiameterSupplied: false },
  solverControls: { defaultMaxStepFt: 5, defaultConvergenceToleranceLbf: 0.1, inverseResidualToleranceLbf: 0.01, nonnegativeSurfaceHookload: true },
  zeroSurfaceHookload: { valid: zeroHook.valid, jarAxialLoadLbf: zeroHook.jarAxialLoadLbf, convergence: zeroHook.convergence }, scenarios, sensitivity };
fs.writeFileSync(path.join(__dirname, 'Test4CompressionStudyStage4C2.json'), JSON.stringify(output, null, 2) + '\n');
