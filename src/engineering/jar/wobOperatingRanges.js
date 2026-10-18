import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { deployDrillstring } from '../bha/deployDrillstring';
import { jarResult } from './jarClearanceAcrossRun';

const known = status => status === 'acceptable' || status === 'inside-zone';
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Finite-resolution interval screening, not continuous-domain certification.
 * evaluate(wobLbf) returns { status, marginFt, topology, reason }. The margin is
 * distance to the nearest NP/neutral interval minus the avoidance distance.
 * No monotonicity is assumed; every scan cell is visited, including its midpoint.
 */
export function scanWobIntervals({ minWobLbf, maxWobLbf, evaluate, scanStepLbf = 500,
  wobToleranceLbf = 1, clearanceToleranceFt = 0.01, maxRefinements = 24, maxEvaluations = 2048 }) {
  if (![minWobLbf, maxWobLbf, scanStepLbf, wobToleranceLbf, clearanceToleranceFt].every(finite) ||
      minWobLbf < 0 || maxWobLbf < minWobLbf || scanStepLbf <= 0 || wobToleranceLbf <= 0 || clearanceToleranceFt <= 0 ||
      !Number.isSafeInteger(maxRefinements) || maxRefinements < 0 || maxRefinements > 64 ||
      !Number.isSafeInteger(maxEvaluations) || maxEvaluations < 1 || maxEvaluations > 10000 || typeof evaluate !== 'function') {
    return { valid: false, errors: ['Supply ordered nonnegative WOB limits and positive finite scan/refinement settings.'], regions: [], boundaries: [], samples: [] };
  }
  const cache = new Map(), boundaries = [], pieces = [];
  const sample = wobLbf => {
    if (cache.has(wobLbf)) return cache.get(wobLbf);
    if (cache.size >= maxEvaluations) return { wobLbf, status: 'unknown', reason: 'Evaluation budget exhausted.' };
    let result;
    try { result = evaluate(wobLbf); } catch { result = { status: 'unknown', reason: 'Calculation failed.' }; }
    if (!known(result?.status) || !finite(result.marginFt)) result = { status: 'unknown', reason: result?.reason || 'Missing or invalid neutral-point clearance.' };
    const value = { ...result, wobLbf };
    cache.set(wobLbf, value);
    return value;
  };
  const add = (a, b, status, reason) => pieces.push({ lowerWobLbf: a.wobLbf, upperWobLbf: b.wobLbf, status, reason });
  const topologyMatches = (a, b) => a.topology === b.topology;
  const inspect = (a, b, iteration = 0) => {
    if (!known(a.status) || !known(b.status)) {
      add(a, b, 'unknown', a.reason || b.reason || 'Unavailable clearance.'); return;
    }
    if (!topologyMatches(a, b)) {
      add(a, b, 'unknown', 'Neutral-point topology changed; boundary unresolved.'); return;
    }
    if (a.status === b.status) {
      // Observed support only; a sub-resolution excursion cannot be excluded.
      add(a, b, a.status, 'Sample-supported; unsampled excursions remain possible.'); return;
    }
    const width = b.wobLbf - a.wobLbf;
    const closeToBoundary = Math.min(Math.abs(a.marginFt), Math.abs(b.marginFt)) <= clearanceToleranceFt;
    if (width <= wobToleranceLbf && closeToBoundary) {
      boundaries.push({ lowerWobLbf: a.wobLbf, upperWobLbf: b.wobLbf,
        estimatedWobLbf: (a.wobLbf + b.wobLbf) / 2, lowerStatus: a.status, upperStatus: b.status,
        clearanceResidualFt: Math.min(Math.abs(a.marginFt), Math.abs(b.marginFt)) });
      add(a, b, 'unknown', 'Refined avoidance boundary bracket.');
      return;
    }
    if (iteration >= maxRefinements) { add(a, b, 'unknown', 'Refinement limit reached.'); return; }
    const middle = sample((a.wobLbf + b.wobLbf) / 2);
    if (!known(middle.status) || !topologyMatches(a, middle)) {
      add(a, b, 'unknown', middle.reason || 'Neutral-point topology changed during refinement.'); return;
    }
    inspect(a, middle, iteration + 1); inspect(middle, b, iteration + 1);
  };
  const cells = Math.ceil((maxWobLbf - minWobLbf) / scanStepLbf);
  if (!Number.isSafeInteger(cells) || cells * 2 + 1 > maxEvaluations) {
    return { valid: false, errors: ['WOB scan exceeds the per-depth evaluation budget; increase scan spacing.'], regions: [], boundaries: [], samples: [] };
  }
  if (cells === 0) { const a = sample(minWobLbf); add(a, a, a.status, a.reason || 'Single evaluated WOB only.'); }
  for (let i = 0; i < cells; i += 1) {
    const a = sample(minWobLbf + (maxWobLbf - minWobLbf) * i / cells);
    const b = sample(i === cells - 1 ? maxWobLbf : minWobLbf + (maxWobLbf - minWobLbf) * (i + 1) / cells);
    const middle = sample((a.wobLbf + b.wobLbf) / 2);
    inspect(a, middle); inspect(middle, b);
  }
  const regions = [];
  for (const piece of pieces) {
    const last = regions[regions.length - 1];
    if (last && last.status === piece.status && last.reason === piece.reason && last.upperWobLbf === piece.lowerWobLbf) last.upperWobLbf = piece.upperWobLbf;
    else regions.push({ ...piece });
  }
  regions.forEach(r => {
    r.lowerBoundary = r.lowerWobLbf === minWobLbf ? 'evaluated-range-limit' : 'sample-supported-edge';
    r.upperBoundary = r.upperWobLbf === maxWobLbf ? 'evaluated-range-limit' : 'sample-supported-edge';
    // Known interiors never include a shared unresolved edge. At range limits,
    // inclusion means only the endpoint was evaluated, not an operating limit.
    r.lowerIncluded = known(r.status) && r.lowerWobLbf === minWobLbf;
    r.upperIncluded = known(r.status) && r.upperWobLbf === maxWobLbf;
  });
  return { valid: true, errors: [], regions, boundaries, samples: [...cache.values()].sort((a, b) => a.wobLbf - b.wobLbf),
    evaluatedRangeLbf: [minWobLbf, maxWobLbf], maximumSampleGapLbf: cells ? (maxWobLbf - minWobLbf) / (2 * cells) : 0,
    wobToleranceLbf, clearanceToleranceFt, evaluationCount: cache.size,
    coverage: 'sample-supported', warning: 'No maximum WOB is inferred. Narrow unsampled intervals may exist; nothing is inferred beyond the evaluated range.' };
}

/** Uses the same deployment, survey solver and all-NP clearance as the Run view. */
export function calcWobRangesAtDepth(input, bitMdFt, mode, frictionCoefficient, jarIndex = 0, options = {}) {
  const deployment = deployDrillstring(input.bha, bitMdFt, { surfaceMdFt: input.surfaceMdFt, deploymentMode: input.deploymentMode });
  const result = scanWobIntervals({ ...options, minWobLbf: Number(input.minWobLbf), maxWobLbf: Number(input.maxWobLbf), evaluate: wobLbf => {
    if (!deployment.valid) return { status: 'unknown', reason: deployment.errors.join(' ') };
    const load = calcSurveyAxialLoads({ ...input, bha: deployment.bha, bitMdFt, mode, frictionCoefficient, wobLbf });
    if (!load.valid) return { status: 'unknown', reason: load.errors.join(' ') };
    const jar = load.jars[jarIndex];
    if (!jar) return { status: 'unknown', reason: 'Selected jar is unavailable.' };
    const clearance = jarResult(jar, jarIndex, load, input.avoidanceDistanceFt);
    if (clearance.absoluteSeparationFt === null) return { status: 'unknown', reason: 'No NP within deployed string.' };
    const distance = input.avoidanceDistanceFt === undefined ? 0.2 * jar.centreFromBitFt : Number(input.avoidanceDistanceFt);
    if (!Number.isFinite(distance) || distance < 0) return { status: 'unknown', reason: 'Invalid avoidance distance.' };
    return { status: clearance.avoidanceStatus === 'outside-avoidance-zone' ? 'acceptable' : 'inside-zone',
      marginFt: clearance.absoluteSeparationFt - distance,
      topology: `${load.neutralPoints.length}/${load.neutralIntervals.length}` };
  } });
  return { ...result, bitMdFt, mode, frictionCoefficient, jarIndex, deployment: deployment.metadata || null };
}
