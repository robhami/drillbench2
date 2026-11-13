// Chart presentation only. Solver values and sampling remain authoritative.
export const curveKey = trace => `${trace.name.startsWith('Maximum') ? 'max' : 'min'}-${trace.name.includes('Rotate') ? 'rotate' : 'slide'}`;
export const curveLabel = trace => trace.name.replace(/^(Minimum = Maximum|Minimum|Maximum) WOB /, '');

export function visibleAxis(data) {
  const values = data.filter(t => t.visible !== false).flatMap(t => t.y || []).filter(Number.isFinite);
  if (!values.length) return null;
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const span = high - low || Math.max(Math.abs(high) * 0.1, 1);
  const rawStep = span * 1.12 / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find(n => n * magnitude >= rawStep) * magnitude;
  const padding = span * 0.06;
  return { range: [Math.floor((low - padding) / step) * step, Math.ceil((high + padding) / step) * step], dtick: step, tick0: 0 };
}

const signText = y => y > 0 ? 'NP above jar' : y < 0 ? 'NP below jar' : 'NP at jar';
const hoverData = (y, selection, threshold) => [selection.wobLbf / 1000, selection.mode === 'rotate' ? 'Rotate' : 'Slide', signText(y),
  threshold === null ? 'Avoidance zone not displayed' : `${Math.abs(y) <= threshold ? 'Inside' : 'Outside'} user-defined screening tolerance`];
const hovertemplate = 'Measured depth %{x:,.0f} ft MD<br>WOB %{customdata[0]} klbf · %{customdata[1]}<br>Signed NP distance %{y:,.1f} ft<br>%{customdata[2]}<br>%{customdata[3]}<extra></extra>';

export function neutralPointChart(plot, result, request, hidden = {}, jarIndex = 0, selections = []) {
  const threshold = typeof request.avoidanceDistanceFt === 'number' && Number.isFinite(request.avoidanceDistanceFt) && request.avoidanceDistanceFt > 0 ? request.avoidanceDistanceFt : null;
  const data = [];
  const primary = plot.data.filter(t => t.showlegend);
  // Single-scenario plots have no explicit showlegend flag.
  const curves = primary.length ? primary : plot.data.slice(0, 1);
  curves.forEach((trace, index) => {
    const selection = selections[index];
    if (!selection) return;
    const scenarios = result.scenarios.filter(s => s.wobLbf === selection.wobLbf && s.mode === selection.mode && s.frictionCoefficient === selection.frictionCoefficient);
    const samples = trace.x.map(md => scenarios.find(s => s.bitMdFt === md));
    const unique = s => s?.valid && s.neutralPoints.length === 1 && s.neutralIntervals.length === 0;
    const plottedUnique = (s, i) => unique(s) && s.jars.some(j => j.jarIndex === jarIndex) && Number.isFinite(trace.y[i]);
    const x = [], y = [], customdata = [], sizes = [];
    const extraX = [], extraY = [], extraData = [];
    samples.forEach((s, i) => {
      const jar = s?.jars.find(j => j.jarIndex === jarIndex);
      // The nearest interval projection is a clearance metric, not a unique NP.
      // Nonunique results are shown only as returned zeros/interval endpoints.
      const value = plottedUnique(s, i) ? trace.y[i] : null;
      const previous = samples[i - 1];
      // Material interfaces change the force gradient, not the force itself.
      // Guide adjacent valid unique samples across components too; this does
      // not establish branch identity or uniqueness between sampled depths.
      const joins = plottedUnique(s, i) && plottedUnique(previous, i - 1);
      if (i && !joins) { x.push(null); y.push(null); customdata.push(null); sizes.push(0); }
      x.push(trace.x[i]); y.push(value); customdata.push(hoverData(value, selection, threshold));
      const next = samples[i + 1];
      const joinsNext = plottedUnique(s, i) && plottedUnique(next, i + 1);
      sizes.push(Number.isFinite(value) && !joins && !joinsNext ? 5 : 0);
      if (s?.valid && jar && !unique(s)) {
        // Show every returned isolated zero, not just the nearest one; no inferred links.
        s.neutralPoints.forEach(point => {
          const distance = point.fromBitFt - jar.jarFromBitFt;
          extraX.push(s.bitMdFt); extraY.push(distance); extraData.push(hoverData(distance, selection, threshold));
        });
        s.neutralIntervals.forEach(interval => {
          [interval.startFromBit, interval.endFromBit].forEach(end => {
            const distance = end - jar.jarFromBitFt;
            extraX.push(s.bitMdFt); extraY.push(distance); extraData.push(hoverData(distance, selection, threshold));
          });
        });
      }
    });
    const color = trace.marker?.color || '#0072B2';
    const visible = !hidden[curveKey(trace)];
    data.push({ ...trace, x, y, customdata, visible, mode: 'lines+markers', connectgaps: false,
      line: { color, width: 2.25, dash: selection.mode === 'rotate' ? 'dash' : 'solid', shape: 'linear', simplify: false },
      marker: { color, size: sizes }, hovertemplate });
    if (extraX.length) data.push({ type: 'scatter', name: `${trace.name}: nonunique NP samples`, showlegend: false, visible,
      mode: 'markers', x: extraX, y: extraY, customdata: extraData, marker: { color, symbol: 'diamond-open', size: 7 },
      hovertemplate: hovertemplate.replace('<extra>', '<br>Nonunique NP / neutral interval endpoint<extra>') });
  });
  const axis = visibleAxis(data);
  const shapes = [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: '#364859', width: 1.5 }, layer: 'above' }];
  if (threshold !== null) {
    shapes.unshift({ type: 'rect', xref: 'paper', x0: 0, x1: 1, y0: -threshold, y1: threshold, fillcolor: 'rgba(225,166,53,0.10)', line: { width: 0 }, layer: 'below' });
    [-threshold, threshold].forEach(y => shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { color: 'rgba(161,111,24,0.45)', width: 1, dash: 'dot' }, layer: 'below' }));
  }
  return { data, empty: !axis, threshold, layout: { ...plot.layout,
    // Reset a manual Y zoom on visibility/run changes; preserve measured-depth reference.
    uirevision: `${request.startBitMdFt}:${request.endBitMdFt}`,
    font: { family: 'Arial, sans-serif', size: 12, color: '#334155' }, paper_bgcolor: 'white', plot_bgcolor: 'white',
    margin: { l: 95, r: 25, t: 16, b: 65 }, showlegend: false, hovermode: 'closest', hoverlabel: { font: { size: 12 }, namelength: -1 },
    xaxis: { ...plot.layout.xaxis, title: { text: 'Measured Depth (ft MD)', font: { size: 14 }, standoff: 14 }, tickfont: { size: 12 }, tickformat: ',.0f', automargin: true, gridcolor: '#edf0f3' },
    yaxis: { ...plot.layout.yaxis, ...axis, autorange: false, title: { text: 'Signed NP Distance Relative to Jar (ft)', font: { size: 14 }, standoff: 16 }, tickfont: { size: 12 }, tickformat: ',~f', automargin: true, gridcolor: '#edf0f3', zeroline: false,
      uirevision: JSON.stringify([hidden, plot.layout.uirevision]) }, shapes
  } };
}
