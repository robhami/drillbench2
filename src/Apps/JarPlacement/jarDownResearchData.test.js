import fixtures from '../../../docs/ValidationStudies/SkeemJarDownExtendedDynamicsStage5C9.json';
import { simulateExtendedJarDown, stepValue, auditExtendedState } from '../../engineering/research/jarDownExtendedDynamics';
import { researchPlot, researchEvents, earlyResearchComparison, copyResearchGeometry } from './jarDownResearchData';
const visible = { total: true, free: true, incremental: true, cumulative: true };
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1e-7 * Math.max(1, Math.abs(b)));

test('independent release-wave tensile reaction is preserved and only the selected event is labelled', () => {
  const f = fixtures.cases.baseline_equalRodsZeroGravity, r = simulateExtendedJarDown(f.input);
  expect(stepValue(r.contact.reaction, .0125)).toBe(-1000);
  expect(stepValue(r.contact.reaction, .015001)).toBe(1000);
  expect(r.contact.transitions).toHaveLength(1);
  expect(r.contact.transitions[0].type).toBe('engage');
  const plot = researchPlot(r, visible, { contact: true, wave: true }, 'contact-0');
  expect(plot.layout.annotations).toHaveLength(1);
  expect(plot.layout.annotations[0].textangle).toBeUndefined();
  const audit = auditExtendedState(r, .0125);
  expect(Math.abs(audit.energyResidualFtLbf)).toBeLessThan(1e-7);
  expect(Math.abs(audit.momentumResidualLbfS)).toBeLessThan(1e-7);
});
test.each(Object.entries(fixtures.cases))('%s renders actual signed steps and cumulative independent impulse', (name, f) => {
  const r = simulateExtendedJarDown(f.input), p = researchPlot(r, visible, { contact: true, wave: true }, 'release');
  const area = p.data.find(t => t.name === 'Signed total integration area');
  let integral = 0;
  for (let i = 1; i < area.x.length; i++) integral += (area.x[i] - area.x[i - 1]) * (area.y[i] + area.y[i - 1]) / 2;
  near(integral, f.observation.totalLbfS); // ms × klbf = lbf s
  const cumulative = p.data.find(t => t.yaxis === 'y2');
  expect(cumulative.y[0]).toBe(0); near(cumulative.y.at(-1), f.observation.totalLbfS);
  expect(area.fill).toBe('tozeroy'); expect(p.data[0].line.shape).toBe('linear');
  const events = researchEvents(r);
  r.contact.transitions.forEach(e => expect(events.some(row => row.timeS === e.timeS && row.kind === 'contact')).toBe(true));
  const selected = events.find(e => e.kind === 'contact');
  if (selected) expect(researchPlot(r, visible, {}, selected.id).layout.shapes.some(s => s.x0 === selected.timeS * 1000 && s.line.width === 2)).toBe(true);
});
test('axes rescale from selected traces; comparison is gated and uses its own window', () => {
  const f = fixtures.cases.baseline_equalRodsZeroGravity, r = simulateExtendedJarDown(f.input);
  const p = researchPlot(r, { cumulative: true }, {}, '');
  expect(p.layout.xaxis.range).toEqual([15, 25]); expect(p.layout.yaxis.visible).toBe(false);
  expect(researchPlot(r, { cumulative: true }, {}, 'release').layout.xaxis.range).toEqual([0, 25]);
  const c = earlyResearchComparison(f.input, r); expect(c.valid).toBe(true); c.rows.forEach(([, a, b]) => near(a, b));
  expect(researchEvents(r).some(e => e.kind === 'return' && e.timeS === .01 && e.label.startsWith('Upper'))).toBe(true);
  expect(researchEvents(r).some(e => e.kind === 'return' && e.timeS === .02 && e.label.startsWith('Lower'))).toBe(true);
  expect(earlyResearchComparison(fixtures.cases.multipleReturns.input, simulateExtendedJarDown(fixtures.cases.multipleReturns.input)).valid).toBe(false);
  expect(researchPlot(r, {}, {}, '').data).toEqual([]);
});
test('BHA copy imports only valid ordered tubular shapes, excluding jar span', () => {
  const bha = { rows: [{ category: 'DC', length: 100, od: 6, idSize: 2 }, { category: 'JAR', length: 10 }, { category: 'DC', length: 80, od: 6, idSize: 2 }, { category: 'DP', length: 1000, od: 5, idSize: 4 }] };
  const g = copyResearchGeometry(bha, 5); expect(g.upperRods.map(r => r.lengthFt)).toEqual([1000, 80]); expect(g.lowerRods[0].lengthFt).toBe(95);
  expect(g.upperRods[0].compressionLbf).toBeUndefined();
  expect(copyResearchGeometry(bha, '').error).toBeTruthy();
  expect(copyResearchGeometry({ rows: bha.rows.map((r, i) => i === 0 ? { ...r, category: 'STB' } : r) }, 5).error).toBeTruthy();
});
