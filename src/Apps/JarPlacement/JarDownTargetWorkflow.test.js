import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import Workflow from './JarDownTargetWorkflow';
import JarPerformance from './JarPerformance';
let mockPending = false;
let mockFailure = '';
let mockRequests = [];
let mockWorkers = [];
const mockPreventDefault = jest.fn();
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="target-plot">{JSON.stringify(props)}</div>);
jest.mock('./createTargetJarDownWorker', () => ({ createTargetJarDownWorker: () => {
  const worker = {
    postMessage(p) { mockRequests.push(p.kind); if (!mockPending) Promise.resolve().then(() => { if (mockFailure === p.kind) { this.onerror?.({ preventDefault: mockPreventDefault }); return; } const m = require('../../engineering/research/targetJarDownWorkflow'); this.lastResponse = p.kind === 'static' ? m.calculateTargetStatic(p.input) : m.calculateTargetDynamics(p.staticOutcome, p.input.survey, p.confirmed); this.onmessage?.({ data: this.lastResponse }); }); },
    terminate: jest.fn(function () { this.onmessage = null; })
  };
  mockWorkers.push(worker); return worker;
} }));
// Compile the real adapter outside the first UI assertion's clock.
beforeAll(() => import('../../engineering/research/targetJarDownWorkflow'));
const bha = { id: 'target-ui', name: 'Independent target BHA', holeSize: 8, mudWeight: 32.75, frictionCoefficient: .25,
  rows: [{ category: 'DC', length: 40, weight: 20, od: 6, idSize: 2 }, { category: 'JAR', toolName: 'Jar A', length: 20, weight: 30, od: 6, idSize: 2 },
    { category: 'DC', length: 80, weight: 20, od: 6, idSize: 2 }, { category: 'DP', lengthMode: 'defined', length: 100, weight: 10, od: 4, idSize: 2 }] };
const values = { strokeIn: '.12', stuckPointFt: '0' };
const props = { bha, values, analysisBitMdFt: 240, surfaceReferenceMdFt: 0 };
beforeEach(() => { mockWorkers = []; mockRequests = []; mockPending = false; mockFailure = ''; mockPreventDefault.mockClear(); localStorage.clear(); localStorage.setItem('wellbenchSurveyV1', JSON.stringify({ originalCsv: 'MD,Inc,Azi\n0,0,0\n240,0,0', confirmed: true })); });
async function calculate() {
  if (screen.getByLabelText('Downward jar stroke (in)').value === '') fireEvent.change(screen.getByLabelText('Downward jar stroke (in)'), { target: { value: '.12' } });
  if (screen.getByRole('spinbutton', { name: 'Stuck-point position (ft above bit)' }).value === '') fireEvent.change(screen.getByRole('spinbutton', { name: 'Stuck-point position (ft above bit)' }), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Target compression at jar (klbf)'), { target: { value: '.45' } });
  fireEvent.click(screen.getByText('Calculate Jar Down'));
  await waitFor(() => expect(screen.getByText('Calculated static jar compression').nextElementSibling).not.toHaveTextContent('—'));
}
const confirm = () => { const box = screen.getByLabelText('Use target as prescribed research initial compression'); if (!box.checked) fireEvent.click(box); fireEvent.click(screen.getByText('Calculate Jar Down')); };
const expectEmptyResults = (region = document.querySelector('.jarDownTarget')) => expect([...region.querySelectorAll('.jarTargetResults dd')].map(e => e.textContent)).toEqual(['—', '—', '—', '—']);

const tab = mode => fireEvent.click(screen.getByRole('tab', { name: `Jar ${mode}` }));
const tabBha = { ...bha, jarImpactInputs: { down: values } };
const resetDown = () => fireEvent.click(screen.getByRole('button', { name: 'Reset Jar Down calculation' }));

test('switching selected trajectory invalidates hidden confirmed Jar Down results even for equivalent vertical stations', async () => {
  const source = { originalCsv: 'MD,Inc,Azi\n0,0,0\n240,0,0', confirmed: true, kind: 'imported', filename: 'Associated.csv' };
  const initial = { ...tabBha, trajectoryMode: 'vertical', surveyState: { version: 1, active: source, history: [] } };
  const view = render(<JarPerformance bha={initial} />); tab('Down'); await calculate(); confirm(); await screen.findByTestId('target-plot');
  tab('Up'); view.rerender(<JarPerformance bha={{ ...initial, trajectoryMode: 'directional' }} />); tab('Down');
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument(); expectEmptyResults();
  expect(screen.getByRole('status')).toHaveTextContent('stale'); expect(mockRequests).toEqual(['static', 'dynamic']);
  expect(initial.surveyState.active).toBe(source);
});

test('empty, invalid and reset states retain four nonnumerical result placeholders', async () => {
  render(<Workflow {...props} />); expectEmptyResults();
  expect(screen.getByRole('status')).toHaveTextContent('Enter target compression to calculate');
  fireEvent.change(screen.getByLabelText('Target compression at jar (klbf)'), { target: { value: '-1' } });
  fireEvent.click(screen.getByText('Calculate Jar Down')); await screen.findByText(/Desired jar force must be an explicit positive/);
  resetDown(); expectEmptyResults();
  expect(screen.getByRole('status')).not.toHaveTextContent('Desired jar force');
  expect(screen.getByLabelText('Target compression at jar (klbf)')).toHaveValue(null);
});

test('confirmation is explicit and the same single Calculate action starts dynamics', async () => {
  render(<Workflow {...props} />); await calculate();
  expect(screen.getAllByRole('button', { name: 'Calculate Jar Down' })).toHaveLength(1);
  const box = screen.getByLabelText('Use target as prescribed research initial compression');
  expect(box).not.toBeChecked();
  fireEvent.click(box); expect(mockRequests).toEqual(['static']);
  fireEvent.click(screen.getByText('Calculate Jar Down')); await screen.findByTestId('target-plot');
  expect(mockRequests).toEqual(['static', 'dynamic']);
});

test('reset clears confirmed input, reference, chart settings and session research controls', async () => {
  const onReset = jest.fn(); render(<Workflow {...props} onReset={onReset} />);
  fireEvent.change(screen.getByLabelText('Workflow simulation horizon (s)'), { target: { value: '.13' } });
  await calculate(); confirm(); await screen.findByTestId('target-plot');
  fireEvent.change(screen.getByLabelText('Reference hookload source'), { target: { value: 'calculated-slackoff' } });
  resetDown(); expectEmptyResults();
  expect(screen.getByLabelText('Downward jar stroke (in)')).toHaveValue(null);
  expect(screen.getByRole('spinbutton', { name: 'Stuck-point position (ft above bit)' })).toHaveValue(null);
  expect(onReset).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Target compression at jar (klbf)')).toHaveValue(null);
  expect(screen.getByLabelText('Reference surface hookload (klbf)')).toHaveValue(null);
  expect(screen.getByLabelText('Reference hookload source')).toHaveValue('');
  expect(screen.getByLabelText('Workflow simulation horizon (s)')).toHaveValue(.12);
  expect(document.querySelector('.jarTargetAdvanced')).not.toHaveAttribute('open');
  expect(mockRequests).toEqual(['static', 'dynamic']);
  await calculate(); expect(screen.getByLabelText('Use target as prescribed research initial compression')).not.toBeChecked();
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
});

test.each(['Downward jar stroke (in)', 'Stuck-point position (ft above bit)'])('%s edits clear confirmed results and restoring input cannot revive them', async label => {
  render(<Workflow {...props} />); await calculate(); confirm(); await screen.findByTestId('target-plot');
  const field = screen.getByLabelText(label), original = field.value;
  fireEvent.change(field, { target: { value: label.startsWith('Downward') ? '.24' : '20' } });
  expectEmptyResults(); expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  fireEvent.change(field, { target: { value: original } });
  expectEmptyResults(); expect(screen.queryByLabelText('Use target as prescribed research initial compression')).not.toBeInTheDocument();
  expect(mockRequests).toEqual(['static', 'dynamic']);
});

test.each(['static', 'dynamic'])('reset during %s request blocks a valid late response before effect cleanup', async kind => {
  render(<Workflow {...props} />); await calculate(); confirm(); await screen.findByTestId('target-plot');
  const oldResponse = mockWorkers[kind === 'static' ? 0 : 1].lastResponse;
  if (kind === 'dynamic') {
    fireEvent.click(screen.getByText('Calculate Jar Down'));
    await waitFor(() => expect(screen.getByLabelText('Use target as prescribed research initial compression')).not.toBeChecked());
  }
  mockPending = true;
  if (kind === 'static') fireEvent.click(screen.getByText('Calculate Jar Down')); else confirm();
  await waitFor(() => expect(screen.getByText('Calculate Jar Down')).toBeDisabled());
  const worker = mockWorkers[mockWorkers.length - 1], late = worker.onmessage, lateError = worker.onerror;
  act(() => {
    // Native dispatch batches reset and the queued callback in the same turn.
    screen.getByRole('button', { name: 'Reset Jar Down calculation' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    late({ data: oldResponse });
    lateError({ preventDefault() {} });
  });
  expect(worker.terminate).toHaveBeenCalled();
  expectEmptyResults(); expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  expect(screen.getByText('Calculate Jar Down')).not.toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Enter target compression to calculate');
});

test('immediate reset prevents even a deferred worker launch', async () => {
  render(<Workflow {...props} />);
  fireEvent.change(screen.getByLabelText('Target compression at jar (klbf)'), { target: { value: '.45' } });
  act(() => {
    screen.getByText('Calculate Jar Down').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    screen.getByRole('button', { name: 'Reset Jar Down calculation' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await act(async () => { await Promise.resolve(); });
  expect(mockRequests).toEqual([]); expectEmptyResults();
  expect(screen.getByText('Calculate Jar Down')).not.toBeDisabled();
});

test('Up reset preserves confirmed Down; Down reset preserves the Up session and BHA', async () => {
  const original = JSON.stringify(tabBha), updateBha = jest.fn();
  render(<JarPerformance bha={tabBha} updateBha={updateBha} />); tab('Down'); await calculate(); confirm();
  const graph = await screen.findByTestId('target-plot'); tab('Up');
  fireEvent.click(screen.getByRole('button', { name: 'Reset Jar Up calculation' }));
  expect(screen.getByLabelText('Jar stroke (in)')).toHaveValue(4);
  expect(screen.getByLabelText('Overpull at jar (klbf)')).toHaveValue(null);
  expect(screen.getByRole('spinbutton', { name: 'Stuck-point position (ft above bit)' })).toHaveValue(0);
  tab('Down'); expect(graph).toBeVisible(); expect(mockRequests).toEqual(['static', 'dynamic']);
  resetDown(); tab('Up');
  expect(screen.getByLabelText('Jar stroke (in)')).toHaveValue(4);
  expect(updateBha).not.toHaveBeenCalled(); expect(JSON.stringify(tabBha)).toBe(original);
});
test('tab return preserves manual inputs and confirmed result without another request', async () => {
  render(<JarPerformance bha={tabBha} />); tab('Down');
  expect(screen.getByRole('region', { name: 'Signed stuck-point reaction versus time' })).toHaveTextContent('Enter target compression');
  await calculate();
  fireEvent.change(screen.getByLabelText('Reference surface hookload (klbf)'), { target: { value: '2' } });
  confirm(); const graph = await screen.findByTestId('target-plot');
  expect(mockRequests).toEqual(['static', 'dynamic']);
  tab('Up'); expect(graph).not.toBeVisible();
  tab('Down'); expect(graph).toBeVisible();
  expect(screen.getByLabelText('Target compression at jar (klbf)')).toHaveValue(.45);
  expect(screen.getByLabelText('Reference surface hookload (klbf)')).toHaveValue(2);
  expect(mockRequests).toEqual(['static', 'dynamic']);
});

test.each(['bha', 'survey'])('upstream %s edit while Down is hidden invalidates confirmation without recalculation', async kind => {
  const view = render(<JarPerformance bha={tabBha} />); tab('Down'); await calculate(); confirm(); await screen.findByTestId('target-plot');
  tab('Up');
  if (kind === 'bha') { view.rerender(<JarPerformance bha={{ ...tabBha, mudWeight: 30 }} />); view.rerender(<JarPerformance bha={tabBha} />); }
  else fireEvent(window, new CustomEvent('wellbench-survey-changed', { detail: { originalCsv: 'MD,Inc,Azi\n0,0,0\n240,0,0', confirmed: true, filename: 'replacement.csv' } }));
  tab('Down');
  expect(screen.getByLabelText('Target compression at jar (klbf)')).toHaveValue(.45);
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  expectEmptyResults();
  expect(screen.getByRole('status')).toHaveTextContent('stale');
  expect(mockRequests).toEqual(['static', 'dynamic']);
});
test('default has only target input; inverse works without reference and dynamics require explicit confirmation', async () => {
  render(<Workflow {...props} />);
  expect(document.querySelector('.jarTargetAdvanced')).not.toHaveAttribute('open');
  expect(document.querySelectorAll('.jarTargetControls input')).toHaveLength(3);
  expect(document.querySelector('.jarTargetControls select')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Reference surface hookload (klbf)')).not.toBeVisible();
  expect(screen.getByText('Engineering Details').closest('details')).not.toHaveAttribute('open');
  await calculate();
  expect(screen.getByText('Calculated static jar compression')).toBeVisible();
  expect(screen.getByText('Slackoff: Select reference hookload')).toBeInTheDocument();
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Reference surface hookload (klbf)'), { target: { value: '2' } });
  expect(document.querySelector('.jarTargetResults')).toHaveTextContent('1.0 klbf');
  confirm(); await screen.findByTestId('target-plot');
  expect(screen.getByText(/explicitly confirmed initial compression 0.45 klbf/)).toBeInTheDocument();
  expect(screen.getByText('Signed reaction impulse')).toBeInTheDocument();
  expect(screen.getByTestId('target-plot').compareDocumentPosition(document.querySelector('.jarTargetResults')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText('Unavailable — no contact')).toBeInTheDocument();
});
test('upstream or settings change clears confirmed results; changing back does not revive them', async () => {
  const view = render(<Workflow {...props} />); await calculate(); confirm(); await screen.findByTestId('target-plot');
  view.rerender(<Workflow {...props} bha={{ ...bha, mudWeight: 30 }} />);
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  view.rerender(<Workflow {...props} />);
  expectEmptyResults();
  await calculate(); confirm(); await screen.findByTestId('target-plot');
  fireEvent.change(screen.getByLabelText('Workflow simulation horizon (s)'), { target: { value: '.13' } });
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('stale');
});
test('unsupported BHA span retains static-only result; target zero is rejected; pending cannot display prior result', async () => {
  const view = render(<Workflow {...props} bha={{ ...bha, rows: bha.rows.map((r, i) => i === 2 ? { ...r, category: 'HWDP' } : r) }} />);
  await calculate();
  expect(screen.getByText(/Static-only result:/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Use target as prescribed research initial compression')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Target compression at jar (klbf)'), { target: { value: '0' } });
  fireEvent.click(screen.getByText('Calculate Jar Down'));
  await screen.findByText(/Desired jar force must be an explicit positive/);
  expectEmptyResults();
  view.rerender(<Workflow {...props} />); mockPending = true;
  fireEvent.change(screen.getByLabelText('Target compression at jar (klbf)'), { target: { value: '.45' } });
  fireEvent.click(screen.getByText('Calculate Jar Down'));
  await waitFor(() => expect(screen.getByText('Calculate Jar Down')).toBeDisabled());
  expectEmptyResults();
});
test('new survey provenance invalidates confirmation even with identical station geometry', async () => {
  render(<Workflow {...props} />); await calculate(); confirm(); await screen.findByTestId('target-plot');
  fireEvent(window, new CustomEvent('wellbench-survey-changed', { detail: { originalCsv: 'MD,Inc,Azi\n0,0,0\n240,0,0', confirmed: true, filename: 'new-survey.csv' } }));
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
  expectEmptyResults();
});
test('two workflow instances keep target, reference and calculation state independent', async () => {
  const view = render(<><Workflow {...props} /><Workflow {...props} /></>);
  const regions = view.container.querySelectorAll('.jarDownTarget'), a = within(regions[0]), b = within(regions[1]);
  fireEvent.change(a.getByLabelText('Target compression at jar (klbf)'), { target: { value: '.45' } });
  fireEvent.change(a.getByLabelText('Reference surface hookload (klbf)'), { target: { value: '2' } });
  fireEvent.click(a.getByText('Calculate Jar Down')); await waitFor(() => expect(a.getByText('Calculated static jar compression').nextElementSibling).not.toHaveTextContent('—'));
  expect(b.getByLabelText('Target compression at jar (klbf)')).toHaveValue(null);
  expect(b.getByLabelText('Reference surface hookload (klbf)')).toHaveValue(null);
  expectEmptyResults(regions[1]);
});
test('invalid optional reference does not block required-hookload calculation or fabricate slackoff', async () => {
  render(<Workflow {...props} />);
  fireEvent.change(screen.getByLabelText('Reference surface hookload (klbf)'), { target: { value: '-1' } });
  await calculate();
  expect(document.querySelector('.jarTargetControls')).toHaveAttribute('novalidate');
  expect(screen.getByText('Slackoff: Select reference hookload')).toBeInTheDocument();
  expect(screen.getByText('Required surface support')).toBeInTheDocument();
});
test('worker startup errors are handled without an uncaught overlay or fabricated results; retry preserves static output', async () => {
  render(<Workflow {...props} />); mockFailure = 'static';
  fireEvent.change(screen.getByLabelText('Target compression at jar (klbf)'), { target: { value: '.45' } });
  fireEvent.click(screen.getByText('Calculate Jar Down'));
  await screen.findByText(/Calculation failed; no new results/);
  expect(mockPreventDefault).toHaveBeenCalledTimes(1);
  expectEmptyResults();
  mockFailure = ''; await calculate(); mockFailure = 'dynamic'; confirm();
  await screen.findByText(/Calculation failed; no new results/);
  expect(mockPreventDefault).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Required surface support')).toBeInTheDocument();
  expect(screen.queryByTestId('target-plot')).not.toBeInTheDocument();
});
test('calculated nonrotating reference is offered but never selected implicitly', async () => {
  render(<Workflow {...props} />); await calculate();
  const selector = screen.getByLabelText('Reference hookload source');
  expect(selector).toHaveValue('');
  expect(screen.getByText('Slackoff: Select reference hookload')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Hookload Calculations/ })).toHaveTextContent('2.0 klbf');
  fireEvent.change(selector, { target: { value: 'calculated-slackoff' } });
  expect(screen.getByText('Slackoff: 1.0 klbf')).not.toBeVisible();
  expect(screen.getByText(/Selected reference: Hookload Calculations/)).toHaveTextContent('Independent target BHA');
  expect(document.querySelectorAll('.jarTargetResearchStatus')).toHaveLength(1);
  expect(document.querySelector('.jarTargetWhy')).not.toHaveAttribute('open');
});
test.each(['bha', 'survey', 'target'])('calculated reference cannot survive or silently revive after %s changes', async kind => {
  const view = render(<Workflow {...props} />); await calculate();
  fireEvent.change(screen.getByLabelText('Reference hookload source'), { target: { value: 'calculated-slackoff' } });
  if (kind === 'bha') { view.rerender(<Workflow {...props} bha={{ ...bha, mudWeight: 30 }} />); view.rerender(<Workflow {...props} />); }
  if (kind === 'survey') fireEvent(window, new CustomEvent('wellbench-survey-changed', { detail: { originalCsv: 'MD,Inc,Azi\n0,0,0\n240,0,0', filename: 'reimport.csv', confirmed: true } }));
  if (kind === 'target') fireEvent.change(screen.getByLabelText('Target compression at jar (klbf)'), { target: { value: '.4' } });
  expect(screen.getByLabelText('Reference hookload source')).toHaveValue('');
  expect(screen.queryByText('Slackoff: 1.0 klbf')).not.toBeInTheDocument();
  await calculate(); expect(screen.getByLabelText('Reference hookload source')).toHaveValue('');
});
test('negative signed manual difference is labelled as support increase', async () => {
  render(<Workflow {...props} />); await calculate();
  fireEvent.change(screen.getByLabelText('Reference surface hookload (klbf)'), { target: { value: '.5' } });
  expect(screen.getByText('Surface support increase: 0.5 klbf')).toBeInTheDocument();
});
