import { MATRIX_METRICS } from '../../engineering/jar/jarPositionMatrix';
const row = sample => [sample.index, sample.l1Ft, sample.l2Ft, sample.impactForceKlbf, sample.peakStuckPointForceKlbf,
  sample.averageStuckPointForceKlbf, sample.impulseLbfS, sample.impactVelocityFtS, sample.l3Ft, sample.error || sample.feasibility];
const hover = 'L1 %{customdata[1]:.2f} ft<br>L2 %{customdata[2]:.2f} ft<br>L3 %{customdata[8]:.2f} ft<br>Incident FI %{customdata[3]:,.3f} klbf<br>Peak stuck force %{customdata[4]:,.3f} klbf<br>Average stuck force %{customdata[5]:,.3f} klbf<br>Primary impulse %{customdata[6]:,.1f} lbf·s<br>Impact velocity %{customdata[7]:.3f} ft/s<br>%{customdata[9]}<extra>%{fullData.name}</extra>';
export function upperCollarPlot(result, metric, selected) {
  const info = MATRIX_METRICS[metric];
  const data = [{ type: 'scatter', mode: 'lines+markers', name: 'Sampled upper-collar response',
    x: result.samples.map(s => s.l2Ft), y: result.samples.map(s => s.valid ? s[info.field] : null),
    customdata: result.samples.map(row), hovertemplate: hover, connectgaps: false,
    line: { color: '#2563eb', width: 2.3, shape: 'linear' }, marker: { size: 6 } }];
  const marker = (sample, name, symbol, color, size) => {
    if (sample?.valid) data.push({ type: 'scatter', mode: 'markers', name,
      x: [sample.l2Ft], y: [sample[info.field]], customdata: [row(sample)], hovertemplate: hover,
      marker: { symbol, color, size, line: { width: 2, color: symbol === 'circle-open' ? color : 'white' } } });
  };
  marker(result.maxima[metric], 'Highest sampled response', 'diamond', '#d97706', 13);
  marker(result.actual, 'Current BHA L2', 'cross', '#dc2626', 14);
  marker(selected, 'Selected candidate', 'circle-open', '#0f172a', 20);
  return { data, layout: { autosize: true, showlegend: false, margin: { l: 76, r: 20, t: 18, b: 62 },
    font: { size: 12 }, uirevision: `upper-collar:${metric}`,
    xaxis: { title: { text: 'L2 — collars above jar (ft)', font: { size: 13 } }, automargin: true, tickformat: '.5~g' },
    yaxis: { title: { text: `${info.label} (${info.unit})`, font: { size: 13 } }, autorange: true, automargin: true, tickformat: '.5~g' },
    shapes: [{ type: 'line', x0: result.actual.l2Ft, x1: result.actual.l2Ft, y0: 0, y1: 1, yref: 'paper',
      line: { color: '#dc2626', width: 1, dash: 'dot' } }] } };
}

export function positionMatrixPlot(result, metric, selected) {
  const info = MATRIX_METRICS[metric], valid = result.samples.filter(s => s.valid);
  const rows = new Set(result.samples.map(s => s.l1Ft)).size, cols = new Set(result.samples.map(s => s.l2Ft)).size;
  const size = Math.max(5, Math.min(25, 220 / Math.max(rows, cols)));
  const data = [{ type: 'scatter', mode: 'markers', name: 'Valid sampled configurations',
    x: valid.map(s => s.l2Ft), y: valid.map(s => s.l1Ft), customdata: valid.map(row), hovertemplate: hover,
    marker: { symbol: 'square', size, color: valid.map(s => s[info.field]), colorscale: 'Viridis', showscale: valid.length > 0,
      colorbar: { title: { text: info.unit }, thickness: 12, len: .85 } } }];
  for (const [kind, name, color] of [['unsupported', 'Unsupported geometry', '#94a3b8'], ['solver-invalid', 'Solver applicability failed', '#b91c1c']]) {
    const samples = result.samples.filter(s => s.classification === kind);
    if (samples.length) data.push({ type: 'scatter', mode: 'markers', name, x: samples.map(s => s.l2Ft), y: samples.map(s => s.l1Ft), customdata: samples.map(row),
      marker: { symbol: 'x', color, size: Math.max(7, size) },
      hovertemplate: 'L1 %{customdata[1]:.2f} ft<br>L2 %{customdata[2]:.2f} ft<br>L3 %{customdata[8]:.2f} ft<br>%{customdata[9]}<extra>%{fullData.name}</extra>' });
  }
  const path = result.samples.filter(s => s.classification !== 'unsupported');
  if (result.mode === 'A' || result.mode === 'B') data.push({ type: 'scatter', mode: 'lines', name: result.mode === 'A' ? 'Fixed-inventory path' : 'Fixed-L1 row',
    x: path.map(s => s.l2Ft), y: path.map(s => s.l1Ft), hoverinfo: 'skip',
    line: { color: '#64748b', width: 1, dash: 'dot' } });
  const maximum = result.maxima[metric];
  if (maximum) data.push({ type: 'scatter', mode: 'markers', name: 'Highest valid sampled response', x: [maximum.l2Ft], y: [maximum.l1Ft], customdata: [row(maximum)], hovertemplate: hover,
    marker: { color: '#d97706', symbol: 'diamond', size: 11, line: { color: 'white', width: 1 } } });
  const actual = result.actual;
  data.push({ type: 'scatter', mode: 'markers', name: 'Current BHA', x: [actual.l2Ft], y: [actual.l1Ft], customdata: [row(actual)],
    marker: { color: '#dc2626', symbol: 'cross', size: 13, line: { color: 'white', width: 1 } },
    hovertemplate: actual.valid ? hover : 'Current BHA L1 %{customdata[1]} ft<br>L2 %{customdata[2]} ft<br>%{customdata[9]}<extra>Current response unavailable</extra>' });
  if (selected?.valid && selected.index !== 'baseline') data.push({ type: 'scatter', mode: 'markers', name: 'Selected configuration',
    x: [selected.l2Ft], y: [selected.l1Ft], customdata: [row(selected)], hovertemplate: hover,
    marker: { color: '#0f172a', symbol: 'circle-open', size: 18, line: { width: 2 } } });
  return { data, layout: { autosize: true, showlegend: false, uirevision: `matrix:${result.mode}:${metric}`, margin: { l: 70, r: 62, t: 14, b: 55 },
    font: { size: 12 }, legend: { orientation: 'h', y: 1.22, font: { size: 11 } },
    xaxis: { title: { text: 'L2 — upper collars (ft), columns', font: { size: 13 } }, automargin: true, tickformat: '.5~g' },
    yaxis: { title: { text: 'L1 — lower collars (ft), rows', font: { size: 13 } }, autorange: 'reversed', automargin: true, tickformat: '.5~g',
      ...(result.mode === 'B' ? { tickmode: 'array', tickvals: [actual.l1Ft] } : {}) } } };
}
