import { calcSkeemPostImpact, SKEEM_PREIMPACT_NOTICE } from './skeemDynamics';

// Bounds execution/storage; not a physical limit or a numerical time step.
export const MAX_SWEEP_SAMPLES = 10000;
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const warnings = [
  'Sampled-domain maxima only; not globally optimal or operational jar configurations.',
  'Uniform elastic collars and pipe, rigid stuck point, ideal release/catch, no friction or damping; primary interval only.',
  'Jar body length is excluded. Very short collars, near-top placement and elastic-stress limits require external qualification.',
  'Weights are air weights from the supplied material weight density; no buoyancy or BHA geometry substitution.'
];
const empty = error => ({
  valid: false, error, notice: SKEEM_PREIMPACT_NOTICE, warnings: [...warnings],
  samples: [], axes: null, validCount: 0, invalidCount: 0, invalidReasons: [],
  maxima: { label: 'Maxima within the sampled domain', impulse: null, averageForce: null, impactForce: null }
});

function sampleAxis(axis, name) {
  if (!isObject(axis) || !Number.isFinite(axis.minFt) || !Number.isFinite(axis.maxFt) || axis.maxFt < axis.minFt) {
    return { error: `${name} requires finite ascending minFt/maxFt bounds.` };
  }
  if (!Number.isSafeInteger(axis.samples) || axis.samples < 1 || axis.samples > MAX_SWEEP_SAMPLES) {
    return { error: `${name}.samples must be an integer from 1 to ${MAX_SWEEP_SAMPLES}.` };
  }
  if (axis.samples === 1 && axis.minFt !== axis.maxFt) return { error: `${name} requires equal bounds for a single sample.` };
  if (axis.samples > 1 && axis.minFt === axis.maxFt) return { error: `${name} requires one sample for equal bounds.` };
  const values = Array.from({ length: axis.samples }, (_, i) => {
    if (i === 0) return axis.minFt;
    if (i === axis.samples - 1) return axis.maxFt;
    const fraction = i / (axis.samples - 1);
    // Convex interpolation avoids overflowing max-min for finite extremes.
    return (1 - fraction) * axis.minFt + fraction * axis.maxFt;
  });
  if (values.some((value, i) => !Number.isFinite(value) || (i > 0 && value <= values[i - 1]))) {
    return { error: `${name} spacing cannot be resolved numerically; reduce sample count or widen bounds.` };
  }
  return { values };
}

/**
 * Pure sweep of the existing Skeem solver; no BHA or persistence dependency.
 * mode: 'fixed-total' or 'independent'; axes: { minFt, maxFt, samples }.
 * constants: explicit uniform tubular/material inputs, overpullKlbf and strokeIn.
 * valid means the request was sampled, not that every physical sample is valid.
 */
export function calcSkeemConfigurationSweep(request, options = {}) {
  if (!isObject(request) || !isObject(request.constants) || !isObject(options)) return empty('Provide request, constants and options objects.');
  if (!['fixed-total', 'independent'].includes(request.mode)) return empty('mode must be fixed-total or independent.');
  const constants = request.constants;
  if (!(Number.isFinite(constants.materialWeightDensityLbfIn3) && constants.materialWeightDensityLbfIn3 > 0)) {
    return empty('materialWeightDensityLbfIn3 must be finite and positive; no default density is assumed.');
  }
  const l1 = sampleAxis(request.l1, 'L1');
  if (l1.error) return empty(l1.error);
  let l2;
  if (request.mode === 'independent') {
    l2 = sampleAxis(request.l2, 'L2');
    if (l2.error) return empty(l2.error);
    if (l1.values.length * l2.values.length > MAX_SWEEP_SAMPLES) return empty(`Sweep exceeds ${MAX_SWEEP_SAMPLES} configurations.`);
  } else {
    if (!(Number.isFinite(request.totalCollarLengthFt) && request.totalCollarLengthFt > 0)) return empty('totalCollarLengthFt must be finite and positive, excluding the jar body.');
    l2 = { values: l1.values.map(value => request.totalCollarLengthFt - value) };
  }

  // Geometry is validated by the authoritative solver. Area is needed solely
  // to convert uniform collar volume to weight, not to calculate wave physics.
  const { collarOdIn: od, collarIdIn: id } = constants;
  const area = Number.isFinite(od) && od > 0 && Number.isFinite(id) && id >= 0 && id < od
    ? Math.PI / 4 * (od - id) * (od + id) : NaN;
  const weightPerFootLbf = area * 12 * constants.materialWeightDensityLbfIn3;
  const solverConstants = {
    // Convert only finite numeric input; never coerce other input types.
    overpullLbf: Number.isFinite(constants.overpullKlbf) ? constants.overpullKlbf * 1000 : NaN,
    strokeIn: constants.strokeIn,
    collarOdIn: od, collarIdIn: id,
    pipeOdIn: constants.pipeOdIn, pipeIdIn: constants.pipeIdIn,
    youngsModulusPsi: constants.youngsModulusPsi,
    acousticVelocityFtS: constants.acousticVelocityFtS,
    freePipeLengthFt: constants.freePipeLengthFt,
    direction: constants.direction
  };
  const samples = [];
  const add = (l1Ft, l2Ft, l1Index, l2Index) => {
    const lowerWeight = weightPerFootLbf * l1Ft;
    const upperWeight = weightPerFootLbf * l2Ft;
    const total = l1Ft + l2Ft;
    const result = calcSkeemPostImpact({ ...solverConstants,
      lowerCollarLengthFt: l1Ft, upperCollarLengthFt: l2Ft,
      lowerCollarWeightLbf: lowerWeight
    }, options);
    const error = !result.valid ? result.error
      : !Number.isFinite(total) || !Number.isFinite(upperWeight) || upperWeight <= 0 || lowerWeight <= 0
        ? 'Collar total length or air weight is outside numerical representability.' : null;
    const valid = error === null;
    samples.push({
      index: samples.length, l1Index, l2Index, l1Ft,
      l2Ft: Number.isFinite(l2Ft) ? l2Ft : null,
      totalCollarLengthFt: Number.isFinite(total) ? total : null,
      lowerCollarAirWeightLbf: Number.isFinite(lowerWeight) && lowerWeight >= 0 ? lowerWeight : null,
      upperCollarAirWeightLbf: Number.isFinite(upperWeight) && upperWeight >= 0 ? upperWeight : null,
      valid, error, warnings: [...warnings, ...(valid ? [] : [error])],
      impactVelocityFtS: valid ? result.preImpact.hammerVelocityFtS : null,
      impactForceLbf: valid ? result.impactForceLbf : null,
      impactForceKlbf: valid ? result.impactForceKlbf : null,
      averageStuckPointForceLbf: valid ? result.averageStuckPointForceLbf : null,
      averageStuckPointForceKlbf: valid ? result.averageStuckPointForceKlbf : null,
      impulseLbfS: valid ? result.impulseLbfS : null,
      primaryPulseDurationS: valid ? result.primaryPulseDurationS : null,
      reflectionCount: valid ? result.preImpact.completedReflections : null
    });
  };
  l1.values.forEach((value, i) => {
    if (request.mode === 'fixed-total') add(value, l2.values[i], i, null);
    else l2.values.forEach((upper, j) => add(value, upper, i, j));
  });
  const maxima = { label: 'Maxima within the sampled domain', impulse: null, averageForce: null, impactForce: null };
  const invalidReasons = [];
  let validCount = 0;
  for (const sample of samples) {
    if (sample.valid) {
      validCount += 1;
      for (const [name, metric] of [['impulse', 'impulseLbfS'], ['averageForce', 'averageStuckPointForceLbf'], ['impactForce', 'impactForceLbf']]) {
        // Exact ties retain the first sample in the documented output order.
        if (!maxima[name] || sample[metric] > maxima[name][metric]) maxima[name] = sample;
      }
    } else {
      let group = invalidReasons.find(item => item.reason === sample.error);
      if (!group) { group = { reason: sample.error, count: 0, sampleIndices: [] }; invalidReasons.push(group); }
      group.count += 1;
      group.sampleIndices.push(sample.index);
    }
  }
  return {
    valid: true, error: null, notice: SKEEM_PREIMPACT_NOTICE, warnings: [...warnings], mode: request.mode,
    axes: { l1Ft: l1.values, l2Ft: l2.values.map(value => Number.isFinite(value) ? value : null), ordering: request.mode === 'fixed-total' ? 'ascending L1, paired L2' : 'ascending L1 outer, ascending L2 inner' },
    samples, maxima, validCount, invalidCount: samples.length - validCount, invalidReasons
  };
}
