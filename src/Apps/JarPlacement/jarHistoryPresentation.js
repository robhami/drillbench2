// Shared chart styling only. Trace data, ranges, time origins and integrals
// remain supplied by each mode's existing presentation adapter.
export const JAR_HISTORY_HEIGHT = 350;
export function unifiedJarHistoryPlot(plot) {
  const secondary = plot.layout.yaxis2;
  const axis = original => ({ ...original, automargin: true, tickfont: { size: 12 },
    title: { ...original.title, font: { size: 14 }, standoff: 12 }, gridcolor: '#edf0f3' });
  return { ...plot, layout: { ...plot.layout, autosize: true,
    font: { family: 'Arial, sans-serif', size: 12, color: '#334155' },
    paper_bgcolor: 'white', plot_bgcolor: 'white',
    margin: { l: 82, r: secondary && secondary.visible !== false ? 88 : 24, t: 30, b: 60 },
    xaxis: axis(plot.layout.xaxis), yaxis: axis(plot.layout.yaxis),
    ...(secondary ? { yaxis2: { ...axis(secondary), showgrid: false } } : {}) } };
}
