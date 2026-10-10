import { calculateJarPerformance } from '../JarPlacement/skeemPerformance';

export const METRICS = {
  impulse: { field: 'impulseLbfS', label: 'Primary stuck-point impulse', unit: 'lbf·s' },
  averageForce: { field: 'averageStuckPointForceKlbf', label: 'Average stuck-point force', unit: 'klbf' },
  impactForce: { field: 'impactForceKlbf', label: 'Initial impact force', unit: 'klbf' }
};
export const metricTitle = key => `${METRICS[key].label} (${METRICS[key].unit})`;

// Reuse the existing structural adapter; bit is explicitly the stuck point.
// Its post-impact validity is separate from structural sweep applicability.
export function configurationGeometry(bha) {
  const source = calculateJarPerformance(bha, { strokeIn: 4, overpullKlbf: 165, stuckPointFt: 0 });
  if (!source.input) return { valid: false, error: source.error };
  const collars = bha.rows.filter(r => String(r.category || '').toUpperCase() === 'DC');
  const weight = Number(collars[0]?.weight);
  if (collars.some(r => r.weight === '' || r.weight == null || !Number.isFinite(Number(r.weight)) || Number(r.weight) !== weight)) {
    return { valid: false, error: 'Configuration analysis requires identical entered air weight per foot for all uniform collars, including upper collars.' };
  }
  const input = source.input;
  const area = Math.PI / 4 * (input.collarOdIn - input.collarIdIn) * (input.collarOdIn + input.collarIdIn);
  const density = weight / (area * 12);
  if (!(Number.isFinite(density) && density > 0)) return { valid: false, error: 'Collar material weight density cannot be established from entered air weight and dimensions.' };
  return {
    valid: true, error: null,
    l1Ft: input.lowerCollarLengthFt, l2Ft: input.upperCollarLengthFt,
    constants: {
      collarOdIn: input.collarOdIn, collarIdIn: input.collarIdIn,
      pipeOdIn: input.pipeOdIn, pipeIdIn: input.pipeIdIn,
      youngsModulusPsi: input.youngsModulusPsi, acousticVelocityFtS: input.acousticVelocityFtS,
      freePipeLengthFt: input.freePipeLengthFt, materialWeightDensityLbfIn3: density
    },
    warnings: [
      'Stuck point is assumed at the bit (0 ft). L1/L2 start at lower/upper jar faces; jar body length is excluded.',
      'Uniform material weight density is derived from entered collar air weight per foot and metal area; no buoyancy correction.',
      'E = 30 million psi and acoustic velocity = 16,000 ft/s are the existing material assumptions.',
      ...(source.warnings || []).filter(w => w.startsWith('Near-top'))
    ]
  };
}

const number = value => value === '' || value == null ? NaN : Number(value);
export function configurationRequest(geometry, fields) {
  if (!geometry.valid) return { valid: false, error: geometry.error };
  const independent = fields.mode === 'independent';
  const count1 = number(independent ? fields.samplesL1 : fields.samples2d);
  const count2 = number(fields.samplesL2);
  if (!Number.isSafeInteger(count1) || count1 < 1 || count1 > (independent ? 50 : 500) ||
      (independent && (!Number.isSafeInteger(count2) || count2 < 1 || count2 > 50))) {
    return { valid: false, error: 'Use 1–500 fixed-total positions or 1–50 samples per independent axis. Sweeps run only when requested.' };
  }
  return { valid: true, request: {
    mode: fields.mode,
    constants: { ...geometry.constants, overpullKlbf: number(fields.overpull), strokeIn: number(fields.stroke) },
    totalCollarLengthFt: number(fields.total),
    l1: { minFt: number(fields.l1Min), maxFt: number(fields.l1Max), samples: count1 },
    ...(independent ? { l2: { minFt: number(fields.l2Min), maxFt: number(fields.l2Max), samples: count2 } } : {})
  } };
}

export function configurationPlot(result, metric, actual = null, revision = 0) {
  const selected = METRICS[metric];
  const hover = `L1: %{x:.2f} ft<br>L2: %{customdata:.2f} ft<br>Total effective collars: %{text:.2f} ft<br>${selected.label}: %{y:.3f} ${selected.unit}<extra>%{fullData.name}</extra>`;
  const data = [];
  const common = { autosize: true, uirevision: revision, margin: { l: 65, r: 20, t: 25, b: 65 }, font: { size: 12 }, legend: { orientation: 'h', y: 1.15 } };
  if (result.mode === 'fixed-total') {
    data.push({ type: 'scatter', mode: 'lines+markers', name: 'Calculated samples',
      x: result.samples.map(s => s.l1Ft), y: result.samples.map(s => s.valid ? s[selected.field] : null),
      customdata: result.samples.map(s => s.l2Ft), text: result.samples.map(s => s.totalCollarLengthFt), connectgaps: false, hovertemplate: hover,
      line: { color: '#0f766e' }, marker: { size: 4 } });
    const maximum = result.maxima[metric];
    if (maximum) data.push({ type: 'scatter', mode: 'markers', name: 'Maximum sampled value',
      x: [maximum.l1Ft], y: [maximum[selected.field]], customdata: [maximum.l2Ft], text: [maximum.totalCollarLengthFt],
      marker: { color: '#b45309', size: 10, symbol: 'diamond' }, hovertemplate: hover });
    const total = result.samples[0]?.totalCollarLengthFt;
    if (actual?.valid && Math.abs(actual.totalCollarLengthFt - total) <= 1e-6) data.push({ type: 'scatter', mode: 'markers', name: 'Actual BHA',
      x: [actual.l1Ft], y: [actual[selected.field]], customdata: [actual.l2Ft], text: [actual.totalCollarLengthFt],
      marker: { color: '#7c3aed', size: 11, symbol: 'cross' }, hovertemplate: hover });
    return { data, layout: { ...common, xaxis: { title: { text: 'L1 — collars below jar (ft)' } }, yaxis: { title: { text: metricTitle(metric) } } } };
  }
  const valid = result.samples.filter(s => s.valid);
  const vertex = new Map(valid.map((s, i) => [`${s.l1Index},${s.l2Index}`, i]));
  const i = [], j = [], k = [];
  for (let a = 0; a < result.axes.l1Ft.length - 1; a += 1) {
    for (let b = 0; b < result.axes.l2Ft.length - 1; b += 1) {
      const corners = [[a, b], [a + 1, b], [a, b + 1], [a + 1, b + 1]].map(([x, y]) => vertex.get(`${x},${y}`));
      // Explicit adjacent topology: never triangulate across an invalid node.
      if (corners.every(v => v !== undefined)) {
        i.push(corners[0], corners[1]); j.push(corners[1], corners[3]); k.push(corners[2], corners[2]);
      }
    }
  }
  const coordinates = { x: valid.map(s => s.l1Ft), y: valid.map(s => s.l2Ft), z: valid.map(s => s[selected.field]), customdata: valid.map(s => s.totalCollarLengthFt) };
  const hover3d = `L1: %{x:.2f} ft<br>L2: %{y:.2f} ft<br>Total effective collars: %{customdata:.2f} ft<br>${selected.label}: %{z:.3f} ${selected.unit}<extra>%{fullData.name}</extra>`;
  if (i.length) data.push({ type: 'mesh3d', name: 'Valid adjacent sample cells', ...coordinates, i, j, k,
    intensity: [...coordinates.z], colorscale: 'Viridis', colorbar: { title: { text: selected.unit }, thickness: 16, len: 0.8, x: 1.02, tickfont: { size: 12 } },
    flatshading: true, hovertemplate: hover3d });
  // Isolated valid samples remain visible even when no surrounding cell exists.
  data.push({ type: 'scatter3d', mode: 'markers', name: 'Calculated samples', ...coordinates,
    marker: { size: 2, color: [...coordinates.z], colorscale: 'Viridis' }, hovertemplate: hover3d });
  const maximum = result.maxima[metric];
  if (maximum) data.push({ type: 'scatter3d', mode: 'markers', name: 'Maximum sampled value',
    x: [maximum.l1Ft], y: [maximum.l2Ft], z: [maximum[selected.field]],
    customdata: [maximum.totalCollarLengthFt],
    marker: { color: '#b45309', size: 6, symbol: 'diamond' }, hovertemplate: hover3d });
  const axis = { nticks: 5, tickfont: { size: 12 }, tickformat: '.4~g' };
  return { data, layout: { ...common, margin: { l: 5, r: 70, t: 35, b: 20 }, legend: { orientation: 'h', y: 1.04 }, scene: {
    xaxis: { ...axis, title: { text: 'L1 (ft)', font: { size: 14 } } },
    yaxis: { ...axis, title: { text: 'L2 (ft)', font: { size: 14 } } },
    zaxis: { ...axis, title: { text: `${{ impulse: 'Impulse', averageForce: 'Average force', impactForce: 'Impact force' }[metric]} (${selected.unit})`, font: { size: 14 } } },
    aspectmode: 'manual', aspectratio: { x: 1.15, y: 1.15, z: 0.85 },
    camera: { eye: { x: 1.45, y: -1.65, z: 1.1 } }, dragmode: 'orbit'
  } } };
}
