// Presentation only. All force/impulse values come from the verified research adapter.
const N_PER_KIP = 4448.2216152605;
export function candidateOutcome(row) {
  if (row.valid) return 'successful';
  if (row.geometryValid === false || row.status === 'geometry-excluded') return 'geometry exclusion';
  if (row.status === 'incomplete' || row.status === 'stroke-closure-unresolved') return 'incomplete computational result';
  if (row.structuralMappingValid === false || row.failureCategory === 'invalid-input' || row.status === 'invalid-input') return 'invalid input';
  return 'model / numerical failure';
}
export function candidateCounts(rows, rejected) {
  const all = [...rows.filter(r => r.scenario === 'Base'), ...rejected];
  const alternatives = all.filter(r => !r.isReference && r.movementFt !== 0);
  return { reference: all.find(r => r.isReference || r.movementFt === 0), alternatives: alternatives.length,
    successfulAlternatives: alternatives.filter(r => r.valid).length,
    outcomes: all.reduce((counts, r) => { const key = candidateOutcome(r); counts[key] = (counts[key] || 0) + 1; return counts; }, {}) };
}
export function comparisonAxisRange(minimum, maximum, reference) {
  const values = [Number(minimum), Number(maximum), reference].filter(Number.isFinite);
  return [Math.min(...values), Math.max(...values)];
}
export function iterationUnits(system = 'oilfield') {
  if (!['oilfield', 'si'].includes(system)) throw Error('Unsupported display units.');
  const si = system === 'si';
  return {
    lengthUnit: si ? 'm' : 'ft', forceUnit: si ? 'kN' : 'kip', impulseUnit: si ? 'N·s' : 'kip·s',
    length: ft => ft * (si ? .3048 : 1), toFeet: value => value / (si ? .3048 : 1),
    force: n => n / (si ? 1000 : N_PER_KIP), impulse: ns => ns / (si ? 1 : N_PER_KIP)
  };
}
export function defaultIterationRange(geometry) {
  if (!geometry.valid) return { min: '', max: '', increment: '30' };
  const text = n => String(Number(n.toFixed(6)));
  return {
    min: text(Math.max(geometry.currentCentreFt - 30, geometry.minCentreFt + 1e-5)),
    max: text(Math.min(geometry.currentCentreFt + 30, geometry.maxCentreFt - 1e-5)),
    increment: '30'
  };
}
export function iterationRows(rows, sort = 'position') {
  const valid = rows.filter(r => r.scenario === 'Base' && r.valid && [r.jarCentreFt, r.jarToStuckFt, r.metrics?.peakTensileN, r.metrics?.fixedTensileNs].every(Number.isFinite));
  return [...valid].sort((a, b) => (sort === 'force' ? b.metrics.peakTensileN - a.metrics.peakTensileN : sort === 'impulse' ? b.metrics.fixedTensileNs - a.metrics.fixedTensileNs : 0) || a.jarCentreFt - b.jarCentreFt);
}
export function iterationCsv(rows, sort = 'position', system = 'oilfield', skeem = false, inputs = {}) {
  const u = iterationUnits(system);
  const header = skeem ? [`Jar above bit (${u.lengthUnit})`, 'Candidate ID', `Total deployed BHA length (${u.lengthUnit})`, 'Upper DP length change (ft)', 'Calculated nominal weight (lbf)', 'Calculated weight change (lbf)', 'Engineering position comparison — rig handling not verified', 'Impact velocity (m/s)', `Initial impact (${u.forceUnit})`, `Peak stuck-point tensile force (${u.forceUnit})`, `Tensile impulse (${u.impulseUnit})`, 'Status'] : [`Jar centre above bit (${u.lengthUnit})`, `Jar-to-stuck-point distance (${u.lengthUnit})`, `Maximum stuck-point tensile force (${u.forceUnit})`, `Stuck-point tensile-only impulse (${u.impulseUnit})`];
  const values = iterationRows(rows, sort).map(r => skeem ? [u.length(r.jarCentreFt), r.candidateId, u.length(r.totalBhaLengthFt), r.drillpipeLengthChangeFt, r.totalCalculatedWeightLbf, r.changeInCalculatedWeightLbf, 'Engineering position comparison — rig handling not verified', r.impact?.impactVelocityMS, u.force(r.impact?.initialImpactForceN), u.force(r.metrics.peakTensileN), u.impulse(r.metrics.fixedTensileNs), 'Valid*'] : [u.length(r.jarCentreFt), u.length(r.jarToStuckFt), u.force(r.metrics.peakTensileN), u.impulse(r.metrics.fixedTensileNs)]);
  const quote = value => `"${String(value).replace(/"/g, '""')}"`;
  const metadata = skeem ? [
    ['Input', 'Value', 'Units'],
    ['Applied tensile load at jar', inputs.loadLbf, 'lbf'], ['Jar stroke', inputs.strokeIn, 'in'],
    ['Stuck point above bit', inputs.stuckAboveBit, inputs.lengthUnit],
    ['Minimum jar position', inputs.minimum, inputs.lengthUnit], ['Maximum jar position', inputs.maximum, inputs.lengthUnit], ['Position increment', inputs.increment, inputs.lengthUnit],
    ['Status note', '* Engineering position comparison — rig handling not verified. Preliminary results, not operational guidance.', ''],
    ['Display units', system, ''],
    ['Impulse window start after impact', 0, 'ms'], ['Impulse window end after impact', inputs.windowEndMs, 'ms'],
    [], header
  ] : [];
  return '\uFEFF' + [...(skeem ? metadata : [header]), ...values].map(row => row.map(quote).join(',')).join('\r\n');
}
