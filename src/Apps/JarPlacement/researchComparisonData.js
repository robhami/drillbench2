// Browser adapter only: established research physics and original analogue inputs.
import reference from './researchAnalogue.v1.json';
import { buildJarPositionCase, firstTensileLobe } from '../../engineering/research/jarPositionComparison';
import { simulateTwoSidedJarImpact } from '../../engineering/research/twoSidedJarImpact';
import { extractImpulseMetrics } from '../../engineering/research/jarImpulseInterpretation';

export const POSITIONS = reference.lowerCollarLengthsM.map(p => p + .25);
export const DEFAULT_CONTROLS = { source: 'verified-analogue', positions: POSITIONS, baseline: 9.25, massKg: 20, velocityMS: 1, stiffnessNm: 1e7, startMs: 0, endMs: 25, acknowledged: false };
export function validateComparison(c) {
  if (c.source !== 'verified-analogue') return 'Actual BHA dynamics, including OES, are unsupported. Use the verified hypothetical analogue.';
  if (!c.acknowledged) return 'Acknowledge the hypothetical dynamic parameters before calculating.';
  if (!Array.isArray(c.positions) || !c.positions.length || c.positions.some(p => !POSITIONS.includes(p)) || new Set(c.positions).size !== c.positions.length || !c.positions.includes(c.baseline)) return 'Select supported positions and include the baseline.';
  if (c.massKg !== 20 || ![.5, 1, 2].includes(c.velocityMS) || ![5e6, 1e7, 2e7].includes(c.stiffnessNm)) return 'Use tested analogue parameters: mass 20 kg, velocity 0.5/1/2 m/s, stiffness 5/10/20 MN/m.';
  if (![c.startMs,c.endMs].every(Number.isFinite) || c.startMs < 0 || c.endMs > 25 || c.endMs <= c.startMs) return 'Impulse window must satisfy 0 <= start < end <= 25 ms.';
  return null;
}
export function calculateResearchPosition(controls, positionM) {
  const error = validateComparison(controls); if (error) throw Error(error);
  if (!controls.positions.includes(positionM)) throw Error('Unselected position.');
  const config = JSON.parse(JSON.stringify(reference));
  Object.assign(config.jar, { hammerMassKg: controls.massKg, impactVelocityMS: controls.velocityMS, contactStiffnessNm: controls.stiffnessNm });
  config.numerical.timeStepS = .5e-6; // Existing coarse/fine test returns 0.25 microsecond histories.
  const data = buildJarPositionCase(config, positionM - .25);
  const result = simulateTwoSidedJarImpact(data.input);
  if (!result.valid) return { positionM, valid: false, status: result.status, error: result.error || result.reason || 'Research numerical safeguards failed.' };
  try {
    const metrics = extractImpulseMetrics(result, firstTensileLobe(result.histories, data.firstArrivalS), { startS: controls.startMs / 1000, endS: controls.endMs / 1000 });
    if (metrics.minContactForceN < 0 || !Object.values(metrics.fixed).every(Number.isFinite)) throw Error('Invalid contact or impulse history.');
    // Full-resolution integration precedes display-only decimation. Preserve peaks and lobe limits separately.
    const stride = Math.max(1, Math.ceil(result.histories.length / 2500));
    const trace = result.histories.filter((r,i) => i % stride === 0 || i === result.histories.length-1).map(r => ({ timeMs:r.timeS*1000, forceKN:r.stuckDynamicForceN/1000 }));
    return { positionM, valid:true, status:'Converged research analogue', metrics, trace, firstArrivalS:data.firstArrivalS, numerical:result.numerical };
  } catch (e) { return { positionM, valid:false, status:'Indeterminate / invalid history', error:e.message }; }
}
export const metricValue = (row, key) => key === 'peak' ? row.metrics.peakTensileForceN : key === 'first' ? row.metrics.primaryImpulseNs : key === 'signed' ? row.metrics.fixed.signedNs : row.metrics.fixed.tensileOnlyNs;
export function metricSummary(rows, baselinePosition, key) {
  const valid = rows.filter(r => r.valid), baseline = valid.find(r => r.positionM === baselinePosition);
  if (!baseline || !valid.length) return null;
  const sorted = [...valid].sort((a,b) => key === 'signed' ? metricValue(a,key)-metricValue(b,key) : metricValue(b,key)-metricValue(a,key));
  const best = sorted[0], value = metricValue(best,key), band = Math.max(Math.abs(value)*.001,key === 'peak' ? .1 : .0001);
  return { best:best.positionM, indistinguishable:valid.filter(r => Math.abs(metricValue(r,key)-value)<=band).map(r=>r.positionM), percent: r => Math.abs(metricValue(baseline,key)) < 1e-12 ? null : (key === 'signed' ? -1 : 1)*(metricValue(r,key)-metricValue(baseline,key))/Math.abs(metricValue(baseline,key))*100 };
}
