import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { deployDrillstring } from '../bha/deployDrillstring';

const DISTANCE_TOL = 1e-6;
const FORCE_TOL = 1e-8;
const HARD_CAP = 5000;
const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const failure = message => ({ valid: false, status: 'invalid-analysis', errors: [message], scenarios: [], crossingEvents: [] });
const loadState = force => Math.abs(force) <= FORCE_TOL ? 'neutral' : force > 0 ? 'compression' : 'tension';

function jarResult(jar, index, load, avoidanceDistance) {
  const centre = jar.centreFromBitFt;
  const lower = avoidanceDistance === undefined ? 0.8 * centre : Math.max(0, centre - avoidanceDistance);
  const upper = avoidanceDistance === undefined ? 1.2 * centre : centre + avoidanceDistance;
  const candidates = [
    ...load.neutralPoints.map(n => ({ kind: 'point', fromBitFt: n.fromBitFt, mdFt: n.mdFt })),
    ...load.neutralIntervals.map(n => {
      const fromBitFt = Math.max(n.startFromBit, Math.min(centre, n.endFromBit));
      return { kind: 'interval', ...n, fromBitFt, mdFt: load.bitMdFt - fromBitFt };
    })
  ];
  let nearest = null;
  candidates.forEach(n => { if (!nearest || Math.abs(centre - n.fromBitFt) < Math.abs(centre - nearest.fromBitFt)) nearest = n; });
  const inside = load.neutralPoints.some(n => n.fromBitFt >= lower - DISTANCE_TOL && n.fromBitFt <= upper + DISTANCE_TOL) || load.neutralIntervals.some(n => n.endFromBit >= lower - DISTANCE_TOL && n.startFromBit <= upper + DISTANCE_TOL);
  const separation = nearest ? centre - nearest.fromBitFt : null;
  return { jarIndex: index, name: jar.name, jarMdFt: jar.mdFt, jarFromBitFt: centre, jarAxialLoadLbf: jar.axialForceLbf, jarLoadState: loadState(jar.axialForceLbf), neutralPointCount: load.neutralPoints.length, neutralIntervalCount: load.neutralIntervals.length, nearestNeutral: nearest, signedSeparationFt: separation, absoluteSeparationFt: separation === null ? null : Math.abs(separation), avoidanceLowerFt: lower, avoidanceUpperFt: upper, avoidanceStatus: !nearest ? 'no-neutral-within-bha' : inside ? 'inside-avoidance-zone' : 'outside-avoidance-zone' };
}

export function calcJarClearanceAcrossRun(input = {}) {
  if (!input || typeof input !== 'object') return failure('Analysis inputs must be an object.');
  const { startBitMdFt, endBitMdFt, minWobLbf, maxWobLbf } = input;
  if (![startBitMdFt, endBitMdFt, minWobLbf, maxWobLbf].every(finite) || Number(startBitMdFt) < 0 || Number(endBitMdFt) < Number(startBitMdFt) || Number(minWobLbf) < 0 || Number(maxWobLbf) < Number(minWobLbf)) return failure('Supply ordered, nonnegative start/end bit MD (ft) and minimum/maximum WOB (lbf).');
  const increment = input.depthIncrementFt === undefined ? 100 : Number(input.depthIncrementFt);
  const samples = input.wobSamples === undefined ? 5 : Number(input.wobSamples);
  const cap = input.maxScenarios === undefined ? 2000 : Number(input.maxScenarios);
  if (!Number.isFinite(increment) || increment <= 0 || !Number.isSafeInteger(samples) || samples < 1 || (Number(maxWobLbf) > Number(minWobLbf) && samples < 2)) return failure('Depth increment must be positive; WOB samples must be a positive integer (at least two for a nonzero range).');
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > HARD_CAP) return failure(`Scenario cap must be an integer from 1 to ${HARD_CAP}.`);
  let modes = input.modes ?? 'slide';
  if (modes === 'both') modes = ['slide', 'rotate'];
  else if (typeof modes === 'string') modes = [modes];
  if (!Array.isArray(modes) || !modes.length || modes.some(m => !['slide', 'rotate'].includes(m))) return failure('Modes must be Slide, Rotate or both (slide/rotate identifiers).');
  modes = ['slide', 'rotate'].filter(m => modes.includes(m));
  if (input.frictionCoefficients !== undefined && input.frictionCoefficient !== undefined) return failure('Specify frictionCoefficients or frictionCoefficient, not both.');
  let mus = input.frictionCoefficients ?? [input.frictionCoefficient];
  if (!Array.isArray(mus) || !mus.length || mus.some(mu => !finite(mu) || Number(mu) < 0 || Number(mu) > 1)) return failure('Explicit friction coefficient(s) between 0 and 1 are required.');
  mus = [...new Set(mus.map(Number))].sort((a, b) => a - b);
  if (input.avoidanceDistanceFt !== undefined && (!finite(input.avoidanceDistanceFt) || Number(input.avoidanceDistanceFt) < 0)) return failure('Avoidance distance must be explicitly nonnegative in feet.');
  const distance = input.avoidanceDistanceFt === undefined ? undefined : Number(input.avoidanceDistanceFt);
  const start = Number(startBitMdFt), end = Number(endBitMdFt), minWob = Number(minWobLbf), maxWob = Number(maxWobLbf);
  const depthRatio = (end - start) / increment, rounded = Math.round(depthRatio);
  const intervals = Math.abs(depthRatio - rounded) <= 16 * Number.EPSILON * Math.max(1, Math.abs(depthRatio)) ? rounded : Math.ceil(depthRatio);
  const depthCount = (end === start ? 0 : Math.max(1, intervals)) + 1, wobCount = minWob === maxWob ? 1 : samples;
  const total = depthCount * wobCount * modes.length * mus.length;
  if (!Number.isSafeInteger(total) || total > cap) return failure(`Requested grid has ${total} scenarios, exceeding the ${cap}-scenario cap; reduce sampling.`);
  const depths = Array.from({ length: depthCount }, (_, i) => i === depthCount - 1 ? end : start + i * increment);
  const wobs = Array.from({ length: wobCount }, (_, i) => i === wobCount - 1 ? maxWob : minWob + (maxWob - minWob) * i / (wobCount - 1));
  if (depths.some((d, i) => !Number.isFinite(d) || (i && d <= depths[i - 1])) || wobs.some((w, i) => !Number.isFinite(w) || (i && w <= wobs[i - 1]))) return failure('Requested depth/WOB increment cannot be resolved numerically.');
  const scenarios = [], envelope = [], crossingEvents = [];
  const depthPrevious = new Map();
  let worstCase = null, validCount = 0, invalidCount = 0;
  const descriptor = (scenario, jar) => ({ bitMdFt: scenario.bitMdFt, wobLbf: scenario.wobLbf, mode: scenario.mode, frictionCoefficient: scenario.frictionCoefficient, jarIndex: jar.jarIndex, jarName: jar.name, absoluteSeparationFt: jar.absoluteSeparationFt, signedSeparationFt: jar.signedSeparationFt, nearestNeutral: jar.nearestNeutral });
  const infer = (previous, current, jar, axis) => {
    if (!previous?.valid || !current.valid) return;
    const oldJar = previous.jars[jar.jarIndex];
    if (!oldJar || Math.abs(oldJar.jarAxialLoadLbf) <= FORCE_TOL || Math.abs(jar.jarAxialLoadLbf) <= FORCE_TOL || Math.sign(oldJar.jarAxialLoadLbf) === Math.sign(jar.jarAxialLoadLbf)) return;
    const fraction = oldJar.jarAxialLoadLbf / (oldJar.jarAxialLoadLbf - jar.jarAxialLoadLbf);
    crossingEvents.push({ kind: `inferred-between-${axis}-samples`, refinementRequired: true, jarIndex: jar.jarIndex, jarName: jar.name, mode: current.mode, frictionCoefficient: current.frictionCoefficient, from: descriptor(previous, oldJar), to: descriptor(current, jar), approximateBitMdFt: previous.bitMdFt + fraction * (current.bitMdFt - previous.bitMdFt), approximateWobLbf: previous.wobLbf + fraction * (current.wobLbf - previous.wobLbf) });
  };
  for (const bitMdFt of depths) {
    const deployment = deployDrillstring(input.bha, bitMdFt, { surfaceMdFt: input.surfaceMdFt, deploymentMode: input.deploymentMode });
    const wobPrevious = new Map();
    let depthWorst = null, depthValid = 0, depthInvalid = 0, withNeutral = 0;
    for (const wobLbf of wobs) for (const mode of modes) for (const frictionCoefficient of mus) {
      const load = deployment.valid ? calcSurveyAxialLoads({ bha: deployment.bha, survey: input.survey, bitMdFt, wobLbf, mode, frictionCoefficient, mudWeightPpg: input.mudWeightPpg, buoyancyFactor: input.buoyancyFactor, rpm: input.rpm, ropFtHr: input.ropFtHr, maxStepFt: input.maxStepFt }) : deployment;
      const valid = load.valid && load.jars.length > 0;
      const scenario = { bitMdFt, wobLbf, mode, frictionCoefficient, valid, status: !load.valid ? load.status : valid ? 'calculated' : 'no-jar', errors: !load.valid ? load.errors : valid ? [] : ['At least one JAR component is required.'], warnings: [...load.warnings], neutralPointCount: valid ? load.neutralPoints.length : null, neutralPoints: valid ? load.neutralPoints : [], neutralIntervals: valid ? load.neutralIntervals : [], neutralStatus: valid ? load.neutralStatus : 'invalid', jars: valid ? load.jars.map((j, i) => jarResult(j, i, load, distance)) : [] };
      scenarios.push(scenario);
      scenario.deployment = deployment.metadata || null;
      if (valid) {
        validCount += 1; depthValid += 1;
        if (load.neutralPoints.length || load.neutralIntervals.length) withNeutral += 1;
        else scenario.warnings.push('No neutral point within the BHA; missing clearance is not a safe classification. Review jar load state separately.');
      } else { invalidCount += 1; depthInvalid += 1; }
      const depthKey = JSON.stringify([wobLbf, mode, frictionCoefficient]), wobKey = JSON.stringify([mode, frictionCoefficient]);
      for (const jar of scenario.jars) {
        if (jar.absoluteSeparationFt !== null) {
          const candidate = descriptor(scenario, jar);
          if (!worstCase || candidate.absoluteSeparationFt < worstCase.absoluteSeparationFt) worstCase = candidate;
          if (!depthWorst || candidate.absoluteSeparationFt < depthWorst.absoluteSeparationFt) depthWorst = candidate;
        }
        const coincident = [...scenario.neutralPoints.filter(n => Math.abs(n.fromBitFt - jar.jarFromBitFt) <= DISTANCE_TOL).map(n => ({ kind: 'sampled-crossing', neutral: n })), ...scenario.neutralIntervals.filter(n => jar.jarFromBitFt >= n.startFromBit - DISTANCE_TOL && jar.jarFromBitFt <= n.endFromBit + DISTANCE_TOL).map(n => ({ kind: 'sampled-neutral-interval', neutral: n }))];
        coincident.forEach(event => crossingEvents.push({ ...event, ...descriptor(scenario, jar), refinementRequired: false }));
        infer(depthPrevious.get(depthKey), scenario, jar, 'depth');
        infer(wobPrevious.get(wobKey), scenario, jar, 'wob');
      }
      // Invalid samples are deliberately stored to break inference chains.
      depthPrevious.set(depthKey, scenario); wobPrevious.set(wobKey, scenario);
    }
    envelope.push({ bitMdFt, minimumClearanceFt: depthWorst?.absoluteSeparationFt ?? null, worstCase: depthWorst, validScenarios: depthValid, invalidScenarios: depthInvalid, scenariosWithNeutral: withNeutral, status: !depthValid ? 'invalid' : withNeutral ? 'sampled-clearance' : 'no-neutral-within-bha' });
  }
  return { valid: true, status: validCount ? 'sampled-analysis' : 'no-valid-scenarios', errors: [], warnings: ['Preliminary sampled-domain clearance only; not continuous-run coverage or operational guidance. Refine near proximity and inferred crossings.'], depthsFt: depths, wobsLbf: wobs, modes, frictionCoefficients: mus, scenarios, validScenarios: validCount, invalidScenarios: invalidCount, minimumValidClearanceFt: worstCase?.absoluteSeparationFt ?? null, worstCase, depthEnvelope: envelope, crossingEvents };
}
