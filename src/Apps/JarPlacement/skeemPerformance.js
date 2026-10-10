import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions';
import { calcSkeemPostImpact } from '../../engineering/jar/skeemDynamics';

const numeric = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const category = row => String(row.category || '').toUpperCase();
const dimensions = row => numeric(row.od) && Number(row.od) > 0 && numeric(row.idSize) && Number(row.idSize) >= 0 && Number(row.idSize) < Number(row.od);
const sameSection = (a, b) => Number(a.od) === Number(b.od) && Number(a.idSize) === Number(b.idSize);

// Geometry adapter only: wave equations remain exclusively in skeemDynamics.
export function calculateJarPerformance(bha, operating) {
  const fail = error => ({ valid: false, error });
  if (!numeric(operating.strokeIn) || Number(operating.strokeIn) <= 0) return fail('Jar stroke must be greater than zero.');
  if (!numeric(operating.overpullKlbf) || Number(operating.overpullKlbf) <= 0) return fail('Overpull at jar must be greater than zero.');
  if (!numeric(operating.stuckPointFt) || Number(operating.stuckPointFt) < 0) return fail('Stuck-point position must be zero or greater.');
  const activeRows = (bha?.rows || []).filter(r => r.category || r.selectedToolId || r.toolName || r.length);
  if (activeRows.some(r => !numeric(r.length) || Number(r.length) <= 0 || !r.category)) return fail('Complete component categories and positive lengths before calculating.');
  const { components } = calcComponentPositions(bha);
  const jars = components.filter(r => category(r) === 'JAR');
  if (jars.length !== 1) return fail('Skeem integration requires exactly one jar.');
  const jar = jars[0];
  const stuck = Number(operating.stuckPointFt);
  if (stuck >= jar.startFromBit) return fail('The stuck point must be below the jar lower face for upward jarring.');
  const lower = components.filter(r => r.endFromBit > stuck && r.startFromBit < jar.startFromBit);
  const above = components.slice(components.indexOf(jar) + 1);
  const firstPipe = above.findIndex(r => category(r) === 'DP');
  if (!lower.length || firstPipe <= 0) return fail('Uniform drill collars are required below and above the jar, followed by free drillpipe.');
  const upper = above.slice(0, firstPipe);
  const pipes = above.slice(firstPipe);
  const collars = [...lower, ...upper];
  if (collars.some(r => category(r) !== 'DC') || pipes.some(r => category(r) !== 'DP')) return fail('Unsupported geometry: only uniform DC sections and a contiguous uniform DP section are supported; HWDP, stabilisers and other tools cannot be approximated.');
  if ([...collars, ...pipes].some(r => !dimensions(r))) return fail('Missing or invalid tubular OD/ID; dimensions will not be invented.');
  if (collars.some(r => !sameSection(r, collars[0])) || pipes.some(r => !sameSection(r, pipes[0]))) return fail('Mixed collar or drillpipe dimensions are unsupported by the uniform-section Skeem model.');
  if (lower.some(r => !numeric(r.weight) || Number(r.weight) <= 0)) return fail('Enter a positive lower-collar air weight per foot; weight will not be inferred from dimensions.');
  if (lower.some(r => Number(r.weight) !== Number(lower[0].weight))) return fail('Mixed lower-collar weights are unsupported by the uniform-section model.');
  const input = {
    overpullLbf: Number(operating.overpullKlbf) * 1000,
    strokeIn: Number(operating.strokeIn),
    lowerCollarLengthFt: jar.startFromBit - stuck,
    upperCollarLengthFt: upper[upper.length - 1].endFromBit - jar.endFromBit,
    lowerCollarWeightLbf: lower.reduce((sum, r) => sum + Number(r.weight) * (r.endFromBit - Math.max(stuck, r.startFromBit)), 0),
    freePipeLengthFt: pipes.reduce((sum, r) => sum + Number(r.length), 0),
    collarOdIn: Number(collars[0].od), collarIdIn: Number(collars[0].idSize),
    pipeOdIn: Number(pipes[0].od), pipeIdIn: Number(pipes[0].idSize),
    youngsModulusPsi: 30000000, acousticVelocityFtS: 16000
  };
  const warnings = [
    'Jar position is its centre. L1 starts at the lower jar face; L2 starts at the upper face. Jar length is excluded and engagement is idealised.',
    'W uses entered lower-collar air weight, without buoyancy correction. E = 30 million psi and acoustic velocity = 16,000 ft/s are assumed.',
    'Near-top placement can overpredict force and impulse when upper collars are comparable in length to the jar.'
  ];
  return { ...calcSkeemPostImpact(input), input, jar, warnings };
}

// Duplicate event coordinates make vertical jumps, not interpolated curves.
export const primaryChartPoints = history => history.flatMap(interval => [
  { timeMs: interval.relativeStartS * 1000, forceKlbf: interval.tensileForceLbf / 1000 },
  { timeMs: interval.relativeEndS * 1000, forceKlbf: interval.tensileForceLbf / 1000 }
]);
