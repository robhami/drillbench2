const styles = [
  { status: 'acceptable', name: 'Outside zone (sample-supported)', color: '#16836b' },
  { status: 'inside-zone', name: 'Inside avoidance zone', color: '#c24135' },
  { status: 'unknown', name: 'Unresolved / unavailable', color: '#737d8c' }
];

export function wobRangesPlot(rows, rangeLbf, revision) {
  const data = [], annotations = [], shapes = [];
  ['slide', 'rotate'].forEach((mode, index) => {
    const axis = index ? '2' : '', selected = rows.filter(r => r.mode === mode);
    styles.forEach(({ status, name, color }) => {
      const x = [], y = [], text = [];
      selected.forEach(row => {
        const regions = row.valid ? row.regions : [{ status: 'unknown', lowerWobLbf: rangeLbf[0], upperWobLbf: rangeLbf[1], reason: row.errors.join(' ') }];
        regions.filter(r => r.status === status).forEach(r => {
          const description = `${name}<br>Evaluated interval: ${(r.lowerWobLbf / 1000).toFixed(4)}–${(r.upperWobLbf / 1000).toFixed(4)} klbf<br>${r.reason}<br>${r.lowerBoundary === 'evaluated-range-limit' || r.upperBoundary === 'evaluated-range-limit' ? 'Clipped to evaluated range; no operating maximum.' : 'Interval edges exclude unresolved boundary brackets.'}`;
          x.push(row.bitMdFt, row.bitMdFt, null); y.push(r.lowerWobLbf / 1000, r.upperWobLbf / 1000, null);
          text.push(description, description, '');
        });
      });
      data.push({ type: 'scatter', mode: 'lines+markers', x, y, text, name, legendgroup: status, showlegend: index === 0,
        xaxis: `x${axis}`, yaxis: `y${axis}`, connectgaps: false, line: { color, width: 5 }, marker: { color, size: 3 },
        hovertemplate: 'Bit MD %{x:.1f} ft<br>%{text}<extra></extra>' });
    });
    const boundaries = selected.flatMap(row => row.boundaries.map(b => ({ ...b, bitMdFt: row.bitMdFt })));
    data.push({ type: 'scatter', mode: 'markers', name: 'Refined boundary (bracketed)', legendgroup: 'boundary', showlegend: index === 0,
      xaxis: `x${axis}`, yaxis: `y${axis}`, x: boundaries.map(b => b.bitMdFt), y: boundaries.map(b => b.estimatedWobLbf / 1000),
      text: boundaries.map(b => `WOB bracket: ${(b.lowerWobLbf / 1000).toFixed(4)}–${(b.upperWobLbf / 1000).toFixed(4)} klbf`),
      marker: { color: '#222', symbol: 'diamond-open', size: 7 },
      hovertemplate: 'Bit MD %{x:.1f} ft<br>%{text}<extra></extra>' });
    annotations.push({ xref: 'paper', yref: 'paper', x: 0, y: index ? 0.43 : 1, yanchor: 'bottom',
      text: mode === 'slide' ? 'Slide' : 'Rotate', showarrow: false });
    rangeLbf.forEach(wob => shapes.push({ type: 'line', xref: `x${axis} domain`, x0: 0, x1: 1, yref: `y${axis}`,
      y0: wob / 1000, y1: wob / 1000, line: { color: '#555', width: 1, dash: 'dot' } }));
  });
  const low = rangeLbf[0] / 1000, high = rangeLbf[1] / 1000, padding = Math.max(0.1, (high - low) * 0.04);
  return { data, layout: { autosize: true, uirevision: revision, margin: { l: 65, r: 15, t: 75, b: 45 },
    legend: { orientation: 'h', y: 1.25, font: { size: 10 } }, annotations, shapes,
    xaxis: { anchor: 'y', showticklabels: false }, xaxis2: { anchor: 'y2', matches: 'x', title: { text: 'Bit MD (ft)' } },
    yaxis: { domain: [0.57, 1], title: { text: 'WOB (klbf)' }, range: [low - padding, high + padding] },
    yaxis2: { domain: [0, 0.40], title: { text: 'WOB (klbf)' }, range: [low - padding, high + padding] }
  } };
}
