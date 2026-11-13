import request from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.after.json';
import before from '../../../docs/ValidationStudies/NeutralPointComponentTransitions.before.json';
import evidence from '../../../docs/ValidationStudies/NeutralPointComponentTransitions.after.json';
import { comparisonClearances, comparisonPlot } from './clearanceData';
import { neutralPointChart } from './neutralPointChart';
import { calcSurveyAxialLoads } from '../../engineering/forces/calcSurveyAxialLoads';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';

test('exact live four-curve chart joins continuous material crossings without changing or adding NP samples', () => {
  const result = { scenarios: live.scenarios, depthsFt: [...new Set(live.scenarios.map(s => s.bitMdFt))], crossingEvents: [] };
  const series = comparisonClearances(result, request, .25);
  const plot = neutralPointChart(comparisonPlot(result, request, 1, series), result, request, {}, 0, series.map(s => s.selection));
  const trace = plot.data.find(t => t.name.includes('Maximum') && t.name.includes('Slide'));
  expect(before.trace.x.filter(x => x === null)).toHaveLength(2);
  expect(trace.x).toEqual(before.trace.x.filter(Number.isFinite));
  expect(trace.y).toEqual(before.trace.y.filter(Number.isFinite));
  expect(trace.x).toHaveLength(86);
  expect(trace.line).toMatchObject({ shape: 'linear', simplify: false });
  expect(trace.connectgaps).toBe(false);
  for (const [from, to] of [[4964.16798, 5064.16798], [6364.16798, 6464.16798]]) {
    const i = trace.x.indexOf(from); expect(trace.x[i + 1]).toBe(to);
    expect(Number.isFinite(trace.y[i]) && Number.isFinite(trace.y[i + 1])).toBe(true);
  }
  expect(plot.data.filter(t => t.showlegend).every(t => t.y.length === 86 && t.y.every(Number.isFinite))).toBe(true);
});

test('live face transitions retain unique roots and exact axial-force continuity; independent RK4 supports the same crossing', () => {
  expect(evidence.fine).toHaveLength(402);
  expect(evidence.fine.every(s => s.valid && s.roots.length === 1 && !s.intervals.length && s.faceForceJumps.every(f => f === 0))).toBe(true);
  for (const transition of evidence.transitions) {
    expect(Math.abs(transition.md - transition.independentTransition.lo)).toBeLessThan(.001);
    const reference = transition.independentAtOwnTransition.atTargets;
    const forceAt = x => reference.find(p => Math.abs(p.x - x) < 1e-8).force;
    const wideJump = forceAt(transition.boundary - .01) - forceAt(transition.boundary + .01);
    const narrowJump = forceAt(transition.boundary - .001) - forceAt(transition.boundary + .001);
    expect(narrowJump / wideJump).toBeGreaterThan(.099);
    expect(narrowJump / wideJump).toBeLessThan(.101);
    for (const delta of [-.001, .001]) {
      const md = transition.md + delta;
      const load = calcSurveyAxialLoads({ ...request, bha: deployDrillstring(request.bha, md).bha,
        bitMdFt: md, wobLbf: 35000, mode: 'slide', frictionCoefficient: .25 });
      expect(load.valid).toBe(true); expect(load.neutralPoints).toHaveLength(1); expect(load.neutralIntervals).toEqual([]);
      expect(load.components[transition.component].topAxialForce).toBe(load.components[transition.component + 1].bottomAxialForce);
      expect(Math.abs(load.neutralPoints[0].fromBitFt - transition.boundary)).toBeLessThan(.001);
    }
  }
});
