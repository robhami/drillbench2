import { calcSkeemPostImpact } from './skeemDynamics';

export const MATRIX_METRICS = {
  peak: { field: 'peakStuckPointForceKlbf', label: 'Peak stuck-point force', unit: 'klbf' },
  impulse: { field: 'impulseLbfS', label: 'Primary stuck-point impulse', unit: 'lbf·s' },
  incident: { field: 'impactForceKlbf', label: 'Incident impact force FI', unit: 'klbf' },
  average: { field: 'averageStuckPointForceKlbf', label: 'Average stuck-point force', unit: 'klbf' },
  velocity: { field: 'impactVelocityFtS', label: 'Impact velocity', unit: 'ft/s' }
};
export const MATRIX_MODES = {
  A: 'A — Relocate within existing collars', B: 'B — Fixed L1, variable L2', C: 'C — Move upward and add collars'
};
const numeric = value => value === '' || value == null ? NaN : Number(value);
const fail = error => ({ valid: false, error });
export function matrixDefaults(geometry) {
  const l1 = geometry.valid ? geometry.l1Ft : null, l2 = geometry.valid ? geometry.l2Ft : null;
  const total = l1 + l2;
  const text = n => geometry.valid ? String(n) : '';
  return { mode: 'A', policy: 'replace-pipe', aMin: text(total * .25), aMax: text(total * .75), aSamples: '20',
    bMin: text(l2 * .5), bMax: text(l2 * 1.5), bSamples: '20',
    c1Min: text(l1), c1Max: text(l1 + total * .5), c2Min: text(l2), c2Max: text(l2 + total * .5), c1Samples: '20', c2Samples: '20',
    overpull: '165', stroke: '4' };
}
function axis(min, max, count, limit) {
  const a = numeric(min), b = numeric(max), n = numeric(count);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return fail('Use finite ascending range bounds.');
  if (!Number.isSafeInteger(n) || n < 1 || n > limit || (n === 1) !== (a === b)) return fail(`Use 1–${limit} samples; one sample requires equal bounds.`);
  const values = Array.from({ length: n }, (_, i) => i === 0 ? a : i === n - 1 ? b : (1 - i / (n - 1)) * a + i / (n - 1) * b);
  if (values.some((v, i) => !Number.isFinite(v) || (i && v <= values[i - 1]))) return fail('Sampling intervals cannot be resolved numerically.');
  return { valid: true, values };
}
export function preparePositionMatrix(geometry, fields) {
  if (!geometry?.valid || geometry.relocation?.kind !== 'fixed-endpoint-uniform-collar') return fail(geometry?.error || 'Supported actual BHA geometry is required; no fixture is substituted.');
  if (!MATRIX_MODES[fields.mode]) return fail('Select study A, B or C.');
  if (fields.mode !== 'A' && !['replace-pipe', 'extend-string'].includes(fields.policy)) return fail('Explicitly select whether collars replace pipe or change total string length.');
  if (!(numeric(fields.overpull) > 0) || !(numeric(fields.stroke) > 0) || !Number.isFinite(numeric(fields.overpull)) || !Number.isFinite(numeric(fields.stroke))) return fail('Positive finite overpull at jar and stroke are required.');
  const first = fields.mode === 'A' ? axis(fields.aMin, fields.aMax, fields.aSamples, 500)
    : fields.mode === 'B' ? { valid: true, values: [geometry.l1Ft] } : axis(fields.c1Min, fields.c1Max, fields.c1Samples, 50);
  if (!first.valid) return first;
  const second = fields.mode === 'B' ? axis(fields.bMin, fields.bMax, fields.bSamples, 500)
    : fields.mode === 'C' ? axis(fields.c2Min, fields.c2Max, fields.c2Samples, 50) : null;
  if (second && !second.valid) return second;
  const pairs = first.values.flatMap(l1 => (second ? second.values : [geometry.relocation.collarInventoryFt - l1]).map(l2 => [l1, l2]));
  return { valid: true, pairs };
}
function candidate(geometry, fields, l1Ft, l2Ft, index, baseline = false) {
  const p = geometry.relocation, c = geometry.constants;
  const totalCollarLengthFt = !baseline && fields.mode === 'A' ? p.collarInventoryFt : l1Ft + l2Ft;
  const delta = totalCollarLengthFt - p.collarInventoryFt;
  const l3Ft = baseline || fields.mode === 'A' || fields.policy === 'extend-string' ? p.l3Ft : p.l3Ft - delta;
  const jarCentreAboveBitFt = l1Ft + p.jarLengthFt / 2;
  const transitionAboveBitFt = totalCollarLengthFt + p.jarLengthFt;
  const totalStringLengthFt = transitionAboveBitFt + l3Ft;
  const demo = geometry.demoMotorApproximation;
  // Demo-only accounting: motor stays fixed; only real DC footage changes.
  // The solver still receives one explicitly homogeneous equivalent section.
  const physicalCollarLengthFt = demo ? totalCollarLengthFt - demo.motorLengthFt : null;
  const physicalCollarAirWeightLbf = demo ? physicalCollarLengthFt * demo.collarAirWeightPerFootLbf : null;
  const w = demo ? (demo.motorWeightLbf + physicalCollarAirWeightLbf) / totalCollarLengthFt : geometry.collarAirWeightPerFootLbf;
  const lowerCollarAirWeightLbf = l1Ft > 0 ? l1Ft * w : null;
  const upperCollarAirWeightLbf = l2Ft > 0 ? l2Ft * w : null;
  const collarAirWeightLbf = totalCollarLengthFt > 0 ? totalCollarLengthFt * w : null;
  const pipeAirWeightLbf = Number.isFinite(geometry.pipeAirWeightPerFootLbf) && l3Ft > 0 ? geometry.pipeAirWeightPerFootLbf * l3Ft : null;
  const totalAirWeightLbf = pipeAirWeightLbf !== null && Number.isFinite(geometry.jarAirWeightLbf) && collarAirWeightLbf !== null ? pipeAirWeightLbf + geometry.jarAirWeightLbf + collarAirWeightLbf : null;
  let error = ![l1Ft, l2Ft, l3Ft, totalStringLengthFt, lowerCollarAirWeightLbf, upperCollarAirWeightLbf].every(Number.isFinite) || l1Ft <= 0 || l2Ft <= 0 || l3Ft <= 0
    ? 'Positive finite L1, L2 and free-pipe length are required; no length is clamped.' : null;
  if (!baseline && fields.mode === 'C' && (l1Ft < geometry.l1Ft || l2Ft < geometry.l2Ft)) error = 'Mode C requires L1 and L2 at or above the actual BHA: downward movement or collar removal is outside this study.';
  if (demo && (!(l1Ft > demo.motorLengthFt) || ![demo.motorWeightLbf, demo.motorLengthFt, demo.collarAirWeightPerFootLbf].every(v => Number.isFinite(v) && v > 0))) error = 'Demo candidate requires positive collars below the jar above the unchanged motor interval and explicit motor/collar weights.';
  const input = { ...c, freePipeLengthFt: l3Ft, overpullLbf: numeric(fields.overpull) * 1000, strokeIn: numeric(fields.stroke),
    lowerCollarLengthFt: l1Ft, upperCollarLengthFt: l2Ft, lowerCollarWeightLbf: lowerCollarAirWeightLbf };
  if (demo) input.materialWeightDensityLbfIn3 = w / (Math.PI / 4 * (c.collarOdIn ** 2 - c.collarIdIn ** 2) * 12);
  const r = error ? null : calcSkeemPostImpact(input);
  const valid = !error && r.valid;
  const classification = error ? 'unsupported' : valid ? 'valid' : 'solver-invalid';
  error = error || (r && !r.valid ? r.error : null);
  const atBaseline = l1Ft === geometry.l1Ft && l2Ft === geometry.l2Ft && l3Ft === p.l3Ft;
  // Keep the exact authoritative primary intervals. Large pre-impact iteration
  // arrays are unnecessary for the existing sampler and are not transferred.
  const solverResult = valid ? { ...r, preImpact: { ...r.preImpact, reflectionHistory: undefined } } : null;
  return { index, l1Ft, l2Ft, l3Ft, totalCollarLengthFt, totalStringLengthFt, jarCentreAboveBitFt, transitionAboveBitFt,
    additionalCollarLengthFt: Math.max(0, delta), removedCollarLengthFt: Math.max(0, -delta), pipeLengthChangeFt: l3Ft - p.l3Ft,
    lowerCollarAirWeightLbf, upperCollarAirWeightLbf, collarAirWeightLbf, pipeAirWeightLbf, totalAirWeightLbf,
    ...(demo ? { demoAccounting: { motorLengthFt: demo.motorLengthFt, motorWeightLbf: demo.motorWeightLbf,
      physicalLowerCollarFt: l1Ft - demo.motorLengthFt, physicalUpperCollarFt: l2Ft,
      physicalCollarLengthFt, physicalCollarAirWeightLbf, uniformAirWeightPerFootLbf: w,
      sourceBitMdFt: demo.sourceBitMdFt, surfaceMdFt: demo.surfaceMdFt,
      impliedBitMdFt: demo.surfaceMdFt + totalStringLengthFt,
      jarMdFt: demo.surfaceMdFt + totalStringLengthFt - jarCentreAboveBitFt,
      inventoryChangeFt: delta, deployment: baseline || fields.mode === 'A' || fields.policy === 'replace-pipe'
        ? 'Fixed source deployment; collars replace pipe when inventory changes.' : 'Hypothetical changed bit MD/free-string length; not the source deployment.' } } : {}),
    feasibility: atBaseline ? 'Actual BHA geometry; prescribed operating inputs' : fields.mode === 'A' ? 'Continuous-inventory relocation; joint-level assembly unverified'
      : `Hypothetical collar/pipe configuration; assembly and deployment unverified (${fields.policy})`,
    valid, classification, error, input, solverResult,
    impactForceKlbf: valid ? r.impactForceKlbf : null,
    peakStuckPointForceKlbf: valid ? Math.max(...r.forceHistory.map(interval => interval.tensileForceLbf)) / 1000 : null,
    averageStuckPointForceKlbf: valid ? r.averageStuckPointForceKlbf : null,
    impulseLbfS: valid ? r.impulseLbfS : null, impactVelocityFtS: valid ? r.preImpact.hammerVelocityFtS : null };
}
export function calculatePositionMatrix({ geometry, fields }) {
  const prepared = preparePositionMatrix(geometry, fields);
  if (!prepared.valid) return prepared;
  const samples = prepared.pairs.map(([l1, l2], i) => candidate(geometry, fields, l1, l2, i));
  const actual = candidate(geometry, fields, geometry.l1Ft, geometry.l2Ft, 'baseline', true);
  const maxima = Object.fromEntries(Object.entries(MATRIX_METRICS).map(([key, info]) => [key,
    samples.filter(s => s.valid).reduce((best, s) => !best || s[info.field] > best[info.field] ? s : best, null)]));
  return { valid: true, mode: fields.mode, policy: fields.mode === 'A' ? 'fixed-inventory' : fields.policy,
    samples, actual, maxima, validCount: samples.filter(s => s.valid).length,
    invalidCount: samples.filter(s => !s.valid).length, unsupportedCount: samples.filter(s => s.classification === 'unsupported').length };
}
export function matrixPercent(value, baseline) {
  return Number.isFinite(value) && Number.isFinite(baseline) && baseline !== 0 ? (value - baseline) / Math.abs(baseline) * 100 : null;
}
