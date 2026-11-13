import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// This suite verifies the retained legacy research matrix directly. The main
// JarConfiguration entry now hosts the single customer-facing Jar Up workflow.
import Matrix from './JarPositionMatrix';
let mockHold = false, mockFailure = false, mockWorkers = [], mockInputs = [];
jest.mock('./ConfigurationPlot', () => props => <div data-testid={props.layout.xaxis.title.text === 'Time (ms)' ? 'history' : 'matrix'} data-plot={JSON.stringify({ data: props.data, layout: props.layout })}>{props.onClick && <button type="button" onClick={() => props.onClick({ points: [{ customdata: [0] }] })}>Click matrix cell zero</button>}</div>);
jest.mock('./createJarPositionMatrixWorker', () => ({ createJarPositionMatrixWorker: () => {
  const worker = { postMessage(input) { mockInputs.push(input); this.input = input; if (!mockHold) Promise.resolve().then(() => {
    if (mockFailure) this.onerror?.({ preventDefault() {} });
    else this.onmessage?.({ data: require('../../engineering/jar/jarPositionMatrix').calculatePositionMatrix(input) });
  }); }, terminate: jest.fn() };
  mockWorkers.push(worker); return worker;
} }));
const bha = { id: 'matrix-ui', name: 'Independent matrix BHA', rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 }, { category: 'JAR', length: 10, weight: 150 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 }, { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95), weight: 20 }
] };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const plot = id => JSON.parse(screen.getByTestId(id).getAttribute('data-plot'));
async function run() { fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' })); await screen.findByTestId('matrix'); }
beforeEach(() => { mockHold = false; mockFailure = false; mockWorkers = []; mockInputs = []; });
beforeAll(() => import('../../engineering/jar/jarPositionMatrix'));

test('B line analysis keeps L1 fixed, reports independent maxima and selects exact retained history', async () => {
  render(<Matrix bha={bha} />); change('Study mode', 'B');
  expect(screen.getByRole('heading', { name: 'Upper Collar Length Analysis — Fixed L1' })).toBeInTheDocument();
  expect(screen.getByLabelText('Fixed L1 (ft)')).toHaveValue(60);
  expect(screen.getByLabelText('Fixed L1 (ft)')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Metric').options).toHaveLength(2);
  change('Minimum L2 (ft)', '60'); change('Maximum L2 (ft)', '180'); change('Upper-collar samples', '3'); await run();
  expect(plot('matrix').data[0].mode).toBe('lines+markers');
  expect(plot('matrix').data[0].y[0]).toBeCloseTo(728.004357777, 8);
  expect(plot('matrix').data[0].customdata.map(row => row[1])).toEqual([60, 60, 60]);
  expect(plot('matrix').data[0].customdata.map(row => row[8])).toEqual([3120, 3060, 3000]);
  expect(screen.getByText('Highest sampled peak force').nextElementSibling).toHaveTextContent('L2 60 ft');
  expect(screen.getByText('Highest sampled primary impulse').nextElementSibling).toHaveTextContent('L2 180 ft');
  fireEvent.click(screen.getByText('Click matrix cell zero'));
  expect(screen.getByLabelText('Selected configuration')).toHaveValue('0');
  expect(plot('history').data[0].y.at(-1)).toBeCloseTo(728.004357777, 8);
  expect(screen.getByText('Selected force-time history').closest('details')).not.toHaveAttribute('open');
  change('Metric', 'impulse'); expect(plot('matrix').data[0].y[0]).toBeCloseTo(5298.591950510, 8);
  change('Engineering response metric', 'velocity'); expect(plot('matrix').data[0].y[0]).toBeCloseTo(14.974474724, 8);
  expect(mockInputs).toHaveLength(1);
  expect(screen.getByText('Advanced Analysis — full L1/L2 matrix').closest('details')).not.toHaveAttribute('open');
});

test('B Reset keeps the study active, restores documented values, clears pending work and rejects late replies', async () => {
  mockHold = true; render(<Matrix bha={bha} />); change('Study mode', 'B'); change('Maximum L2 (ft)', '500');
  fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' })); await waitFor(() => expect(mockWorkers).toHaveLength(1));
  const worker = mockWorkers[0], handler = worker.onmessage;
  const response = require('../../engineering/jar/jarPositionMatrix').calculatePositionMatrix(worker.input);
  act(() => { screen.getByRole('button', { name: 'Reset' }).click(); handler({ data: response }); });
  expect(screen.getByLabelText('Study mode')).toHaveValue('B');
  expect(screen.getByLabelText('Minimum L2 (ft)')).toHaveValue(90);
  expect(screen.getByLabelText('Maximum L2 (ft)')).toHaveValue(270);
  expect(screen.getByLabelText('Upper-collar samples')).toHaveValue(20);
  expect(screen.queryByTestId('matrix')).not.toBeInTheDocument(); expect(worker.terminate).toHaveBeenCalled();
  expect(mockInputs).toHaveLength(1);
});

test('minimal default, five metrics, hidden sample controls and uncalculated placeholder', () => {
  render(<Matrix bha={bha} />);
  expect(screen.getByLabelText('Study mode')).toHaveValue('A');
  expect(screen.getByLabelText('Metric').options).toHaveLength(5);
  expect(screen.getByLabelText('Metric')).toHaveValue('peak');
  expect(screen.getByLabelText('Minimum L1 (ft)')).toHaveValue(60);
  expect(screen.getByText('Advanced Settings').closest('details')).not.toHaveAttribute('open');
  expect(screen.queryByTestId('matrix')).not.toBeInTheDocument(); expect(mockInputs).toHaveLength(0);
});

test('cell click uses retained exact history; metric and keyboard selection never rerun a calculation', async () => {
  const before = JSON.stringify(bha); render(<Matrix bha={bha} />); change('Position samples', '3'); await run();
  expect(screen.getByText('Current BHA peak stuck-point force').nextElementSibling).toHaveTextContent('619.36 klbf');
  expect(screen.getByText('Highest sampled peak force').nextElementSibling).toHaveTextContent('707.84');
  expect(plot('matrix').layout.yaxis.autorange).toBe('reversed');
  expect(plot('matrix').layout.xaxis.title.text).toContain('L2');
  fireEvent.click(screen.getByText('Click matrix cell zero')); expect(screen.getByLabelText('Selected configuration')).toHaveValue('0');
  change('Selected configuration', '2');
  expect(screen.getByText('Selected peak stuck-point force').nextElementSibling).toHaveTextContent('707.84');
  expect(plot('history').data[0].y.at(-1)).toBeCloseTo(707.8402338258261, 8);
  change('Metric', 'impulse'); expect(plot('matrix').data[0].marker.color[0]).toBeCloseTo(12303.474541984584, 8);
  change('Metric', 'velocity'); expect(plot('matrix').data[0].marker.color[2]).toBeCloseTo(14.974474724049681, 9);
  fireEvent.click(screen.getByLabelText('Show selected cumulative impulse'));
  expect(plot('history').data[2].y.at(-1)).toBeCloseTo(5147.361020873783, 8);
  expect(mockInputs).toHaveLength(1); expect(JSON.stringify(bha)).toBe(before);
});

test.each(['B', 'C'])('%s exposes the correct ranges and explicit pipe policy', async mode => {
  render(<Matrix bha={bha} />); change('Study mode', mode);
  expect(screen.getByLabelText('Upper-collar change')).toHaveValue('replace-pipe');
  expect(screen.getByLabelText('Minimum L2 (ft)')).toBeInTheDocument();
  if (mode === 'B') { expect(screen.queryByLabelText('Minimum L1 (ft)')).not.toBeInTheDocument(); change('Upper-collar samples', '3'); }
  else { change('L1 samples', '3'); change('L2 samples', '3'); }
  change('Upper-collar change', 'extend-string'); await run();
  expect(mockInputs[0].fields.policy).toBe('extend-string');
  expect(document.querySelector('.matrixConstraint')).toHaveTextContent(/hypothetical/);
});

test('unsupported cells clear the selected history and show a reason', async () => {
  render(<Matrix bha={bha} />); change('Study mode', 'C'); change('Minimum L1 (ft)', '0'); change('L1 samples', '3'); change('L2 samples', '3'); await run();
  expect(plot('matrix').data.some(trace => trace.name === 'Unsupported geometry')).toBe(true);
  change('Selected configuration', '0'); expect(screen.queryByTestId('history')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('No force-time history');
});

test('editing and restoring an input cannot restore stale graphs or results', async () => {
  render(<Matrix bha={bha} />); await run(); change('Maximum L1 (ft)', '170');
  expect(screen.queryByTestId('matrix')).not.toBeInTheDocument(); change('Maximum L1 (ft)', '180');
  expect(screen.queryByText('Current BHA primary impulse')).not.toBeInTheDocument();
  expect(mockInputs).toHaveLength(1); expect(screen.getByRole('status')).toHaveTextContent('Inputs changed');
});

test('reset restores documented session defaults and clears results without BHA writes or automatic analysis', async () => {
  const updateBha = jest.fn(); render(<Matrix bha={bha} updateBha={updateBha} />); await run();
  change('Study mode', 'C'); change('Upper-collar change', 'extend-string'); change('Jar stroke (in)', '7'); change('Metric', 'impulse');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByLabelText('Study mode')).toHaveValue('A'); expect(screen.getByLabelText('Metric')).toHaveValue('peak');
  expect(screen.getByLabelText('Jar stroke (in)')).toHaveValue(4); expect(screen.getByLabelText('Position samples')).toHaveValue(20);
  expect(screen.queryByTestId('matrix')).not.toBeInTheDocument(); expect(updateBha).not.toHaveBeenCalled(); expect(mockInputs).toHaveLength(1);
});

test.each(['Reset', 'Cancel analysis'])('%s invalidates pending work and late worker responses', async action => {
  mockHold = true; render(<Matrix bha={bha} />); fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await waitFor(() => expect(mockWorkers).toHaveLength(1));
  const worker = mockWorkers[0], handler = worker.onmessage;
  const response = require('../../engineering/jar/jarPositionMatrix').calculatePositionMatrix(worker.input);
  act(() => { screen.getByRole('button', { name: action }).click(); handler({ data: response }); });
  expect(worker.terminate).toHaveBeenCalled(); expect(screen.queryByTestId('matrix')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run Analysis' })).toBeEnabled();
});

test('invalid requests and worker failures display unavailable states', async () => {
  render(<Matrix bha={bha} />); change('Position samples', '0'); fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Analysis unavailable'));
  change('Position samples', '3'); mockFailure = true; fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Calculation failed'));
  expect(screen.queryByTestId('matrix')).not.toBeInTheDocument();
});

test('upstream BHA changes suppress results immediately; restored inputs do not revive them', async () => {
  const view = render(<Matrix bha={bha} />); await run();
  view.rerender(<Matrix bha={{ ...bha, rows: bha.rows.map((r, i) => i === 2 ? { ...r, category: 'HWDP' } : r) }} />);
  expect(screen.getByRole('button', { name: 'Run Analysis' })).toBeDisabled(); expect(screen.queryByTestId('matrix')).not.toBeInTheDocument();
  view.rerender(<Matrix bha={bha} />); expect(screen.queryByTestId('matrix')).not.toBeInTheDocument();
});

test('same-workspace geometry loading fills blank ranges without overwriting user edits', () => {
  const view = render(<Matrix bha={{ id: bha.id, rows: [] }} />); change('Minimum L1 (ft)', '40');
  view.rerender(<Matrix bha={bha} />); expect(screen.getByLabelText('Minimum L1 (ft)')).toHaveValue(40);
  expect(screen.getByLabelText('Maximum L1 (ft)')).toHaveValue(180);
});

test('unmount cancels a pending worker', async () => {
  mockHold = true; const view = render(<Matrix bha={bha} />); fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await waitFor(() => expect(mockWorkers).toHaveLength(1)); view.unmount(); expect(mockWorkers[0].terminate).toHaveBeenCalled();
});

test('immediate reset prevents a deferred worker launch', async () => {
  render(<Matrix bha={bha} />);
  act(() => { screen.getByRole('button', { name: 'Run Analysis' }).click(); screen.getByRole('button', { name: 'Reset' }).click(); });
  await act(async () => { await Promise.resolve(); });
  expect(mockInputs).toHaveLength(0); expect(screen.queryByTestId('matrix')).not.toBeInTheDocument();
});
