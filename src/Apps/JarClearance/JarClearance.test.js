import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import JarClearance from './JarClearance';
import AnalysisInputs from '../AnalysisInputs/AnalysisInputs';
import { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';
import { calcJarClearanceAcrossRun } from '../../engineering/jar/jarClearanceAcrossRun';
import { createClearanceWorker } from './createClearanceWorker';
import * as npDiagnostics from './npDiagnostics';
jest.mock('./createClearanceWorker', () => ({ createClearanceWorker: jest.fn() }));
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="clearance-plot">{JSON.stringify(props)}</div>);
jest.mock('../../engineering/jar/jarClearanceAcrossRun', () => ({ ...jest.requireActual('../../engineering/jar/jarClearanceAcrossRun'), calcJarClearanceAcrossRun: jest.fn(jest.requireActual('../../engineering/jar/jarClearanceAcrossRun').calcJarClearanceAcrossRun) }));
const source = { originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n1000,0,90', confirmed: true, filename: 'vertical.csv' };
const bha = { name: 'Test BHA', wob: 6, mudWeight: 10, frictionCoefficient: 0.25, rpm: 40, rop: 200, drillpipeReferenceBitMdFt: 1000,
  wobAnalysis: { minWobKlbf: '4', maxWobKlbf: '8', samples: '3' },
  rows: [{ category: 'DC', length: 50, weight: 100, od: 8 }, { category: 'JAR', length: 20, weight: 100, od: 8 }, { category: 'DC', length: 130, weight: 100, od: 8 }, { category: 'DP', length: 800, lengthMode: 'auto', weight: 20, od: 5 }] };
function Harness({ initial = bha }) {
  const [current, setCurrent] = React.useState(initial), updateBha = patch => setCurrent(b => ({ ...b, ...patch }));
  return <><AnalysisInputs bha={current} updateBha={updateBha} /><JarClearance bha={current} updateBha={updateBha} /></>;
}
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const settle = async () => { await act(async () => { jest.advanceTimersByTime(500); }); };
const traces = () => JSON.parse(screen.getByTestId('clearance-plot').textContent).data.filter(t => t.showlegend);
const advanced = () => fireEvent.click(screen.getByText('Advanced Analysis Settings'));

test('diagnostic export uses captured graph inputs/results, never recomputes, and excludes stale or another BHA results', async () => {
  const download = jest.spyOn(npDiagnostics, 'downloadNpDiagnostics').mockReturnValue('diagnostics.json');
  try {
    const initial = { ...bha, name: 'Export A', surveyState: { version: 1, active: source, history: [] } };
    const view = render(<JarClearance bha={initial} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export NP Diagnostics' }));
    expect(download.mock.calls.at(-1)[0]).toMatchObject({ state: 'no-results', analysis: null });
    await settle();
    const calls = calcJarClearanceAcrossRun.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '4 klbf â€” Rotate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export NP Diagnostics' }));
    const value = download.mock.calls.at(-1)[0];
    expect(value.state).toBe('current');
    expect(value.analysis.requestMessage.request.survey.stations).toHaveLength(2);
    expect(value.analysis.responseMessage.result).toEqual(calcJarClearanceAcrossRun.mock.results[0].value);
    expect(value.view.hiddenCurves['min-rotate']).toBe(true);
    const rendered = JSON.parse(screen.getByTestId('clearance-plot').textContent);
    expect(value.view.plot.data).toEqual(rendered.data);
    expect(value.view.plot.layout).toEqual(rendered.layout);
    expect(value.totals.reconciled).toBe(true);
    expect(calcJarClearanceAcrossRun.mock.calls).toHaveLength(calls);
    // Current WOB does not govern the sweep: show current and captured values separately.
    view.rerender(<JarClearance bha={{ ...initial, wob: 9 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export NP Diagnostics' }));
    expect(download.mock.calls.at(-1)[0].currentSelection.bha.wob).toBe(9);
    expect(download.mock.calls.at(-1)[0].analysis.inputContext.bha.wob).toBe(6);
    view.rerender(<JarClearance bha={{ ...initial, mudWeight: 12 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export NP Diagnostics' }));
    expect(download.mock.calls.at(-1)[0]).toMatchObject({ state: 'stale-results-excluded', analysis: null });
    view.rerender(<JarClearance bha={{ ...initial, id: 'export-b', name: 'Export B' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export NP Diagnostics' }));
    expect(download.mock.calls.at(-1)[0].analysis).toBeNull();
    expect(npDiagnostics.serializeNpDiagnostics(download.mock.calls.at(-1)[0])).not.toContain('Export A');
  } finally { download.mockRestore(); }
});

test('motor insertion/removal and associated survey switching clear previous graph and reject stale worker replies', async () => {
  const originalWorker = global.Worker, workers = [];
  global.Worker = function Worker() {};
  createClearanceWorker.mockImplementation(() => {
    const worker = { terminate: jest.fn(), postMessage: jest.fn() }; workers.push(worker); return worker;
  });
  const calculate = jest.requireActual('../../engineering/jar/jarClearanceAcrossRun').calcJarClearanceAcrossRun;
  const publish = async worker => act(async () => worker.onmessage({ data: { result: calculate(worker.postMessage.mock.calls[0][0].request) } }));
  try {
    const initial = { ...bha, surveyState: { version: 1, active: source, history: [] } };
    const view = render(<JarClearance bha={initial} />); await settle(); await publish(workers[0]);
    expect(screen.getByTestId('clearance-plot')).toBeInTheDocument();
    const motor = { category: 'RSS_MTR', toolName: 'Illustrative motor', length: 30, weight: 100, od: 6.75 };
    const inserted = { ...initial, rows: [motor, ...initial.rows] };
    view.rerender(<JarClearance bha={inserted} />);
    expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument(); await settle();
    await publish(workers[0]); expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
    await publish(workers[1]); expect(screen.getByTestId('clearance-plot')).toBeInTheDocument();
    const directional = { ...source, filename: 'directional.csv', originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n500,30,90\n1000,60,90' };
    view.rerender(<JarClearance bha={{ ...inserted, surveyState: { ...initial.surveyState, active: directional } }} />);
    expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument(); await settle(); await publish(workers[1]);
    expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument(); await publish(workers[2]);
    view.rerender(<JarClearance bha={initial} />); await settle(); await publish(workers[3]);
    expect(workers[3].postMessage.mock.calls[0][0].request.bha.rows).toEqual(initial.rows);
    expect(workers[3].postMessage.mock.calls[0][0].request.survey.stations.every(s => s.inclinationDeg === 0)).toBe(true);
    expect(screen.getByTestId('clearance-plot')).toBeInTheDocument();
  } finally { global.Worker = originalWorker; }
});
beforeEach(() => { jest.useFakeTimers(); localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(source)); calcJarClearanceAcrossRun.mockReset().mockImplementation(jest.requireActual('../../engineering/jar/jarClearanceAcrossRun').calcJarClearanceAcrossRun); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
test('opening automatically produces four endpoint traces, existing axes, zero line and collapsed settings', async () => {
  render(<Harness />);
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
  expect(screen.getByText('Advanced Analysis Settings').parentElement).not.toHaveAttribute('open');
  await settle();
  expect(traces().map(t => t.name)).toEqual(['Minimum WOB 4 klbf â€” Slide', 'Minimum WOB 4 klbf â€” Rotate', 'Maximum WOB 8 klbf â€” Slide', 'Maximum WOB 8 klbf â€” Rotate']);
  const plot = JSON.parse(screen.getByTestId('clearance-plot').textContent);
  expect(plot.layout.xaxis.title.text).toBe('Measured Depth (ft MD)');
  expect(plot.layout.yaxis.title.text).toBe('Signed NP Distance Relative to Jar (ft)');
  expect(plot.layout.shapes.some(s => s.type === 'line' && s.y0 === 0 && s.y1 === 0)).toBe(true);
  expect(traces().every(t => t.mode === 'lines+markers' && t.connectgaps === false)).toBe(true);
  expect(calcJarClearanceAcrossRun).toHaveBeenCalledTimes(1);
});
test('range edits hide the old graph immediately and debounce rapid changes; current WOB is independent', async () => {
  render(<Harness />); await settle();
  change('Maximum WOB (klbf)', '9'); expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
  change('Maximum WOB (klbf)', '10'); change('Maximum WOB (klbf)', '11'); await settle();
  expect(calcJarClearanceAcrossRun).toHaveBeenCalledTimes(2);
  expect(traces()[2].name).toBe('Maximum WOB 11 klbf â€” Slide');
  expect(screen.queryByLabelText('WOB')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Minimum WOB (klbf)')).toHaveValue(4);
});
test('unmount cancels pending work and invalid changes cannot publish an old graph', async () => {
  const view = render(<Harness />); change('Maximum WOB (klbf)', '12'); view.unmount(); await settle();
  expect(calcJarClearanceAcrossRun).not.toHaveBeenCalled();
  render(<Harness />); await settle(); change('Minimum WOB (klbf)', ''); await settle();
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
  expect(screen.getAllByText(/Enter finite minimum\/maximum WOB/).length).toBeGreaterThan(0);
  expect(calcJarClearanceAcrossRun).toHaveBeenCalledTimes(1);
});
test('shared physical inputs automatically refresh the sweep without editing saved pipe length', async () => {
  const original = JSON.stringify(bha); render(<Harness />); await settle();
  change('Mud Weight', '12'); change('Friction coefficient', '0.3'); change('RPM', '50'); change('ROP', '210'); await settle();
  expect(calcJarClearanceAcrossRun.mock.calls.at(-1)[0]).toMatchObject({ mudWeightPpg: 12, frictionCoefficients: [0.3], rpm: 50, ropFtHr: 210 });
  expect(JSON.stringify(bha)).toBe(original);
});
test('BHA/survey changes invalidate immediately, default endpoint follows bit depth', async () => {
  const view = render(<JarClearance bha={bha} />); await settle();
  view.rerender(<JarClearance bha={{ ...bha, drillpipeReferenceBitMdFt: 800, rows: bha.rows.map((r, i) => i ? r : { ...r, weight: 110 }) }} />);
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument(); await settle();
  expect(calcJarClearanceAcrossRun.mock.calls.at(-1)[0].endBitMdFt).toBe(800);
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...source, originalCsv: 'MD,Inclination,Azimuth\n0,20,90\n1000,20,90' } }));
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument(); await settle();
  expect(calcJarClearanceAcrossRun.mock.calls.at(-1)[0].survey.stations[0].inclinationDeg).toBe(20);
});
test('missing/unconfirmed survey and incomplete coverage never generate extrapolated results', async () => {
  localStorage.removeItem(SURVEY_STORAGE_KEY); render(<Harness />); await settle();
  expect(calcJarClearanceAcrossRun).not.toHaveBeenCalled();
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...source, confirmed: false } })); await settle();
  expect(screen.getAllByText(/Explicitly confirm/).length).toBeGreaterThan(0);
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...source, originalCsv: 'MD,Inclination,Azimuth\n100,0,90\n900,0,90' } })); await settle();
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
  expect(calcJarClearanceAcrossRun).not.toHaveBeenCalled();
});
test('single-scenario inspection, deployed DP and manual rerun remain in advanced settings', async () => {
  render(<Harness />); await settle(); advanced();
  change('Starting bit MD (ft)', '300'); change('Ending bit MD (ft)', '500');
  change('Graph view', 'single'); change('Analysis modes', 'both'); await settle();
  expect(screen.getByText(/Deployed drillpipe: 100 ft/)).toBeInTheDocument();
  change('Inspect bit MD (ft)', '500'); change('Displayed operating scenario', '3');
  expect(screen.getByText(/Selected bit MD 500 ft/)).toHaveTextContent('WOB 6 klbf');
  expect(screen.getByText(/Deployed drillpipe: 300 ft/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Analyse run' }));
  expect(screen.getByText(/18 evaluated \/ 0 invalid/)).toBeInTheDocument();
  expect(screen.getByLabelText('Mud weight (ppg)')).toHaveAttribute('readonly');
});
test('scenario cap and field validation occur before calculation', async () => {
  render(<Harness />); advanced(); change('Starting bit MD (ft)', '199'); await settle();
  expect(screen.getByText(/Complete-BHA survey coverage requires/)).toHaveTextContent('No extrapolation');
  change('Starting bit MD (ft)', '200'); change('WOB Samples', '25'); change('Depth increment (ft)', '1'); await settle();
  expect(screen.getByText(/Requested grid exceeds/)).toHaveTextContent('2,000-scenario UI limit');
  expect(calcJarClearanceAcrossRun).not.toHaveBeenCalled();
});
test('equal endpoints retain two mode traces; missing NP remains unavailable', async () => {
  render(<Harness initial={{ ...bha, wobAnalysis: { minWobKlbf: '300', maxWobKlbf: '300', samples: '1' } }} />); await settle();
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument(); expect(screen.getByText(/No NP data available for these scenarios/)).toBeInTheDocument();
  advanced(); expect(screen.getByText(/two distinct mode traces/)).toBeInTheDocument();
  expect(screen.getByText(/Missing NP is unavailable clearance, not safe/)).toBeInTheDocument();
});
test('failed endpoint leaves other traces visible with unavailable diagnostics', async () => {
  const calculate = jest.requireActual('../../engineering/jar/jarClearanceAcrossRun').calcJarClearanceAcrossRun;
  calcJarClearanceAcrossRun.mockImplementationOnce(request => {
    const result = calculate(request); result.scenarios = result.scenarios.map(s => s.wobLbf === request.maxWobLbf && s.mode === 'rotate' ? { ...s, valid: false, jars: [], errors: ['Rotate endpoint unavailable'] } : s); return result;
  });
  render(<Harness />); await settle();
  expect(traces()[3].y.every(y => y === null)).toBe(true);
  expect(traces().slice(0, 3).some(t => t.y.some(y => y !== null))).toBe(true);
  advanced(); expect(screen.getByText('Scenario failed: Rotate endpoint unavailable')).toBeInTheDocument();
});
test('shared friction remains the default comparison when advanced additional coefficients exist', async () => {
  render(<Harness initial={{ ...bha, neutralPointAnalysis: { friction: '0.3' } }} />); await settle();
  change('Friction coefficient', '0.4'); await settle();
  expect(calcJarClearanceAcrossRun.mock.calls.at(-1)[0].frictionCoefficients).toEqual([0.4, 0.3]);
  advanced(); expect(screen.getByLabelText('Comparison friction coefficient')).toHaveValue('0.4');
});
test('all-invalid scenarios produce an unavailable state, not a manufactured graph', async () => {
  render(<Harness initial={{ ...bha, rows: bha.rows.map((r, i) => i === 1 ? { ...r, weight: '' } : r) }} />); await settle();
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
  expect(screen.getByText(/Graph unavailable; inspect scenario errors/)).toBeInTheDocument();
});
test('Test 4 default automatic sweep preserves Slide/Rotate NP and jar separation regressions', async () => {
  const demo = require('../../../docs/ValidationStudies/JarPlacementDemoStage5C1.json').storage;
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(demo.wellbenchSurveyV1));
  // Coarse run sampling keeps this endpoint regression small; browser validation
  // also exercises the full default 100-ft sweep in the background worker.
  render(<JarClearance bha={{ ...demo.drillbenchWell.currentBha, neutralPointAnalysis: { increment: '12000' }, wobAnalysis: { minWobKlbf: '10', maxWobKlbf: '35', samples: '2' } }} />); await settle();
  const trace = traces();
  expect(trace).toHaveLength(4);
  expect(trace[2].x.at(-1)).toBe(12000);
  expect(trace[2].y.at(-1)).toBeCloseTo(3255.816674, 5);
  expect(trace[3].y.at(-1)).toBeCloseTo(988.140917, 5);
  const last = calcJarClearanceAcrossRun.mock.results.at(-1).value.scenarios.filter(s => s.bitMdFt === 12000 && s.wobLbf === 35000);
  expect(last[0].neutralPoints[0].mdFt).toBeCloseTo(8424.183326, 5);
  expect(last[1].neutralPoints[0].mdFt).toBeCloseTo(10691.859083, 5);
}, 20000);
test('superseded workers are terminated and late asynchronous replies cannot replace the current result', async () => {
  const originalWorker = global.Worker, workers = [];
  global.Worker = function Worker() {};
  createClearanceWorker.mockImplementation(() => { const w = { terminate: jest.fn(), postMessage: jest.fn() }; workers.push(w); return w; });
  try {
    const view = render(<Harness />); await settle();
    expect(workers).toHaveLength(1);
    const oldRequest = workers[0].postMessage.mock.calls[0][0].request;
    change('Maximum WOB (klbf)', '12'); expect(workers[0].terminate).toHaveBeenCalled(); await settle();
    const currentRequest = workers[1].postMessage.mock.calls[0][0].request;
    const calculate = jest.requireActual('../../engineering/jar/jarClearanceAcrossRun').calcJarClearanceAcrossRun;
    await act(async () => workers[0].onmessage({ data: { result: calculate(oldRequest) } }));
    expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
    await act(async () => workers[1].onmessage({ data: { result: calculate(currentRequest) } }));
    expect(traces()[2].name).toBe('Maximum WOB 12 klbf â€” Slide');
    change('Maximum WOB (klbf)', '13'); await settle();
    await act(async () => workers[2].onerror({ message: 'Worker unavailable' }));
    expect(screen.getByText('Run calculation unavailable: Worker unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
    view.unmount(); expect(workers[2].terminate).toHaveBeenCalled();
  } finally { global.Worker = originalWorker; }
});

test('graph precedes collapsed current summary and legend visibility survives recalculation', async () => {
  render(<Harness />); await settle();
  const graph = screen.getByRole('region', { name: 'Depth-dependent neutral point graph' });
  const summary = screen.getByText(/^Current-Depth NP/).parentElement;
  expect(graph.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(summary).not.toHaveAttribute('open');
  fireEvent.click(screen.getByText(/^Current-Depth NP/)); expect(summary).toHaveAttribute('open');
  fireEvent.click(screen.getByText(/^Current-Depth NP/)); expect(summary).not.toHaveAttribute('open');
  const labels = ['4 klbf â€” Slide', '4 klbf â€” Rotate', '8 klbf â€” Slide', '8 klbf â€” Rotate'];
  labels.forEach(label => expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true'));
  for (const label of labels) {
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false');
  }
  expect(screen.queryByTestId('clearance-plot')).not.toBeInTheDocument();
  expect(screen.getByText(/No visible NP data/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: labels[0] }));
  expect(traces().map(t => t.visible)).toEqual([true, false, false, false]);
  change('Maximum WOB (klbf)', '9'); await settle();
  expect(traces().map(t => t.visible)).toEqual([true, false, false, false]);
  fireEvent.click(screen.getByRole('button', { name: 'Show All Curves' }));
  expect(traces().every(t => t.visible)).toBe(true);
  expect(calcJarClearanceAcrossRun).toHaveBeenCalledTimes(2);
});
