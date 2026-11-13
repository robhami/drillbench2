import { JAR_HISTORY_HEIGHT, unifiedJarHistoryPlot } from './jarHistoryPresentation';
test.each([false, true])('common chart style preserves values, ranges and mode-specific titles (secondary %s)', secondary => {
  const plot = { data: [{ x: [0, 5, 5, 10], y: [1, 1, -1, -1] }], layout: {
    xaxis: { title: { text: 'Time (ms)' }, range: [0, 10] },
    yaxis: { title: { text: 'Stuck-Point Force (klbf)' }, range: [-2, 2] },
    ...(secondary ? { yaxis2: { visible: true, title: { text: 'Signed total impulse (lbf·s)' }, range: [-10, 5], overlaying: 'y', side: 'right' } } : {}) } };
  const before = JSON.stringify(plot), styled = unifiedJarHistoryPlot(plot);
  expect(JSON.stringify(plot)).toBe(before);
  expect(styled.data).toBe(plot.data);
  expect(styled.layout.yaxis.range).toEqual([-2, 2]);
  expect(styled.layout.yaxis.title.text).toBe('Stuck-Point Force (klbf)');
  expect(styled.layout.xaxis.tickfont.size).toBe(12);
  expect(styled.layout.margin).toEqual({ l: 82, r: secondary ? 88 : 24, t: 30, b: 60 });
  expect(JAR_HISTORY_HEIGHT).toBe(350);
  if (secondary) expect(styled.layout.yaxis2.title.text).toBe('Signed total impulse (lbf·s)');
});
