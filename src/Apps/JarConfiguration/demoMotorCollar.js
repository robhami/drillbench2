import { staticJarPositionGeometry } from '../../engineering/jar/staticJarPosition';
import { configurationGeometry } from './configurationData';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';

export const DEMO_MOTOR_NOTICE = 'DEMO ONLY — MOTOR AS COLLAR APPROXIMATION — NOT FOR OPERATIONAL USE';

// Session-only geometry adapter. Never return a replacement BHA for persistence.
// Homogenise entered total motor+DC air weight across the entire surrogate
// collar inventory, because the unchanged matrix requires one uniform weight.
export function demoMotorCollarGeometry(bha, { bitMdFt, surfaceMdFt = 0 } = {}) {
  const source = staticJarPositionGeometry(bha);
  if (!source.valid || !source.hasMotor) return { valid: false, error: source.error || 'A single bottom motor followed by DC / jar / DC / DP is required.' };
  const depth = analysisDepth(bha);
  const deployment = deployDrillstring(bha, bitMdFt ?? (depth.valid ? depth.bitMdFt : null), { surfaceMdFt });
  if (!deployment.valid) return { valid: false, error: deployment.errors.join(' ') };
  const [motor, lower, jar, upper, pipe] = deployment.bha.rows;
  if (!pipe) return { valid: false, error: 'Positive deployed free drillpipe is required for the demo matrix.' };
  const motorLengthFt = Number(motor.length), motorWeightLbf = motorLengthFt * Number(motor.weight);
  const effectiveInventoryFt = source.collarInventoryFt + motorLengthFt;
  const totalAirWeightLbf = source.collarInventoryFt * Number(lower.weight) + motorWeightLbf;
  const uniformAirWeightPerFt = totalAirWeightLbf / effectiveInventoryFt;
  const surrogate = { ...bha, rows: [
    { ...lower, length: Number(lower.length) + motorLengthFt, weight: uniformAirWeightPerFt },
    { ...jar }, { ...upper, weight: uniformAirWeightPerFt }, { ...pipe, lengthMode: 'manual' }
  ] };
  const geometry = configurationGeometry(surrogate);
  if (!geometry.valid) return geometry;
  geometry.demoMotorApproximation = { motorLengthFt, motorWeightLbf, collarAirWeightPerFootLbf: Number(lower.weight),
    sourceBitMdFt: Number(bitMdFt ?? depth.bitMdFt), surfaceMdFt: Number(surfaceMdFt) };
  return { valid: true, geometry, motor: { ...motor }, motorLengthFt, motorWeightLbf,
    uniformAirWeightPerFt, totalAirWeightLbf, actualCollarInventoryFt: source.collarInventoryFt,
    rigidityLbf: Math.PI / 4 * (Number(lower.od) ** 2 - Number(lower.idSize) ** 2) * 30000000 };
}

export function labelDemoPlot(plot, demo) {
  return !plot || !demo ? plot : { ...plot,
    data: plot.data.map(trace => ({ ...trace,
      name: trace.name?.replace('Current BHA', 'Demo surrogate baseline'),
      customdata: trace.customdata?.map(row => Array.isArray(row) ? row.map(value => typeof value === 'string' ? value.replace('Actual BHA geometry', 'Demo surrogate geometry') : value) : row)
    })), layout: { ...plot.layout,
    title: { text: DEMO_MOTOR_NOTICE, font: { size: 10 } },
    margin: { ...plot.layout.margin, t: Math.max(65, plot.layout.margin?.t || 0) } } };
}
