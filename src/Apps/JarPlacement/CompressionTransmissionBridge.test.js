import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import JarDownResearch from './JarDownResearch';
import JarPerformance from './JarPerformance';
import { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';
let mockPending = false;
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="bridge-plot">{JSON.stringify(props.data)}</div>);
jest.mock('./createJarDownResearchWorker', () => ({ createJarDownResearchWorker: () => ({
  postMessage(input) { Promise.resolve().then(() => this.onmessage?.({ data: require('../../engineering/research/jarDownExtendedDynamics').simulateExtendedJarDown(input) })); }, terminate() { this.onmessage = null; }
}) }));
jest.mock('./createCompressionAssessmentWorker', () => ({ createCompressionAssessmentWorker: () => ({
  postMessage(input) { if (!mockPending) Promise.resolve().then(() => this.onmessage?.({ data: require('../../engineering/research/jarDownCompressionAssessment').calculateCompressionAssessment(input) })); }, terminate() { this.onmessage = null; }
}) }));
const bha = { id: 'independent-bridge', name: 'Independent vertical fixture', mudWeight: 32.75, frictionCoefficient: .25, holeSize: 8,
  rows: [{ category: 'DC', length: 40, weight: 20, od: 6, idSize: 2 }, { category: 'JAR', length: 20, weight: 30 },
    { category: 'DC', length: 80, weight: 20, od: 6, idSize: 2 }, { category: 'DP', length: 100, weight: 10, od: 4, idSize: 2 }] };
const source = { originalCsv: 'MD,Inc,Azi\n0,0,0\n240,0,0', confirmed: true, filename: 'independent.csv' };
const adoptText = 'Use calculated static jar compression as research input';
beforeAll(() => import('../JarConfiguration/ConfigurationPlot'));
beforeEach(() => { mockPending = false; localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(source)); });
async function prepare(scope = screen) {
  fireEvent.change(scope.getByLabelText('Research stuck point (ft above bit)'), { target: { value: '0' } });
  fireEvent.click(scope.getByText('Copy shapes only'));
  fireEvent.change(scope.getByLabelText('Research static surface hookload (klbf)'), { target: { value: '1' } });
  fireEvent.click(scope.getByText('Calculate static compression assessment'));
  await waitFor(() => expect(scope.getByText(adoptText)).toBeEnabled());
}
async function adopt(scope = screen) { await prepare(scope); fireEvent.click(scope.getByText(adoptText)); await scope.findByTestId('bridge-plot'); }
const renderBridge = (b = bha) => render(<JarDownResearch bha={b} analysisBitMdFt="240" surfaceReferenceMdFt="0" onExit={() => {}} />);

test('main Down reset discards an advanced adopted candidate without BHA or survey writes', async () => {
  const saved = JSON.stringify(bha), storage = localStorage.getItem(SURVEY_STORAGE_KEY), updateBha = jest.fn();
  render(<JarPerformance bha={bha} updateBha={updateBha} analysisBitMdFt="240" surfaceReferenceMdFt="0" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Jar Down' }));
  fireEvent.click(screen.getByText('Explore Idealised Jar Down Dynamics')); await screen.findByTestId('bridge-plot');
  await adopt();
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(450);
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Jar Down calculation' }));
  expect(screen.queryByRole('region', { name: 'Idealised Jar Down research' })).not.toBeInTheDocument();
  expect(screen.queryByText('Return to manual compression')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.jarTargetResults .jarResultPlaceholder')).toHaveLength(4);
  expect(updateBha).not.toHaveBeenCalled(); expect(JSON.stringify(bha)).toBe(saved);
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(storage);
  fireEvent.click(screen.getByText('Explore Idealised Jar Down Dynamics')); await screen.findByTestId('bridge-plot');
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(1000);
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).not.toBeDisabled();
});

test('read-only assessment, deliberate adoption, source comparison and manual restoration', async () => {
  renderBridge({ ...bha, mudWeight: '32.75' }); await prepare();
  expect(screen.getByText('Compatible for idealised research')).toBeInTheDocument();
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(1000);
  expect(document.querySelector('.jarCompressionAssessment')).toHaveTextContent('450 lbf');
  expect(document.querySelector('.jarCompressionAssessment')).toHaveTextContent('calcStaticJarLoads');
  expect(document.querySelector('.jarCompressionAssessment')).toHaveTextContent('32.75 ppg');
  fireEvent.click(screen.getByText(adoptText)); await screen.findByTestId('bridge-plot');
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(450);
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toBeDisabled();
  expect(document.querySelector('.jarResearchCandidate')).toHaveTextContent('explicitly adopted');
  fireEvent.click(screen.getByText('Return to manual compression')); await screen.findByTestId('bridge-plot');
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(1000);
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toBeEnabled();
});
test.each([['2', 'tensile'], ['1.45', 'exactly zero'], ['', 'nonnegative surface hookload'], ['-1', 'nonnegative surface hookload']])('boundary %s cannot be adopted: %s', async (value, reason) => {
  renderBridge(); await prepare();
  fireEvent.change(screen.getByLabelText('Research static surface hookload (klbf)'), { target: { value } });
  expect(screen.getByText(adoptText)).toBeDisabled();
  fireEvent.click(screen.getByText('Calculate static compression assessment'));
  await waitFor(() => expect(document.querySelector('.jarCompressionAssessment')).toHaveTextContent(reason));
  expect(screen.getByText(adoptText)).toBeDisabled();
});
test.each(['mud', 'geometry', 'friction', 'surface', 'survey', 'boundary', 'load-case', 'dynamic'])('adopted input is suppressed synchronously after %s change', async kind => {
  const view = renderBridge(); await adopt();
  if (kind === 'mud') view.rerender(<JarDownResearch bha={{ ...bha, mudWeight: 11 }} analysisBitMdFt="240" surfaceReferenceMdFt="0" onExit={() => {}} />);
  if (kind === 'geometry') view.rerender(<JarDownResearch bha={{ ...bha, rows: bha.rows.map((r, i) => i === 2 ? { ...r, length: 81 } : r) }} analysisBitMdFt="240" surfaceReferenceMdFt="0" onExit={() => {}} />);
  if (kind === 'friction') view.rerender(<JarDownResearch bha={{ ...bha, frictionCoefficient: .3 }} analysisBitMdFt="240" surfaceReferenceMdFt="0" onExit={() => {}} />);
  if (kind === 'surface') view.rerender(<JarDownResearch bha={bha} analysisBitMdFt="240" surfaceReferenceMdFt="1" onExit={() => {}} />);
  if (kind === 'survey') fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...source, originalCsv: 'MD,Inc,Azi\n0,1,0\n240,1,0' } }));
  if (kind === 'boundary') fireEvent.change(screen.getByLabelText('Research static surface hookload (klbf)'), { target: { value: '1.1' } });
  if (kind === 'load-case') fireEvent.change(screen.getByLabelText('Research static load case'), { target: { value: 'pickup' } });
  if (kind === 'dynamic') fireEvent.change(screen.getByLabelText('Ideal free downward stroke (in)'), { target: { value: '0' } });
  expect(screen.queryByTestId('bridge-plot')).not.toBeInTheDocument();
  expect(screen.getByText(adoptText)).toBeDisabled();
  expect(document.querySelector('.jarResearchCandidate')).toHaveTextContent('Stale adopted candidate');
});
test('pending reassessment cannot use the previous result or silently update adopted compression', async () => {
  renderBridge(); await adopt(); mockPending = true;
  fireEvent.click(screen.getByText('Calculate static compression assessment'));
  expect(screen.queryByTestId('bridge-plot')).not.toBeInTheDocument(); expect(screen.getByText(adoptText)).toBeDisabled();
  expect(document.querySelector('.jarCompressionAssessment')).toHaveTextContent('Calculation pending');
  mockPending = false;
  fireEvent.change(screen.getByLabelText('Research static surface hookload (klbf)'), { target: { value: '.9' } });
  fireEvent.click(screen.getByText('Calculate static compression assessment'));
  await waitFor(() => expect(screen.getByText(adoptText)).toBeEnabled());
  expect(screen.queryByTestId('bridge-plot')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(450);
  fireEvent.click(screen.getByText(adoptText)); await screen.findByTestId('bridge-plot');
  expect(screen.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(550);
});
test('changing inputs back does not resurrect an adopted candidate or old assessment', async () => {
  renderBridge(); await adopt();
  const field = screen.getByLabelText('Research static surface hookload (klbf)');
  fireEvent.change(field, { target: { value: '1.1' } });
  fireEvent.change(field, { target: { value: '1' } });
  expect(screen.getByText(adoptText)).toBeDisabled();
  expect(document.querySelector('.jarResearchCandidate')).toHaveTextContent('Stale');
  fireEvent.click(screen.getByText('Calculate static compression assessment'));
  await waitFor(() => expect(screen.getByText(adoptText)).toBeEnabled());
  expect(screen.queryByTestId('bridge-plot')).not.toBeInTheDocument();
  expect(document.querySelector('.jarResearchCandidate')).toHaveTextContent('Stale');
  fireEvent.click(screen.getByText(adoptText)); await screen.findByTestId('bridge-plot');
  expect(document.querySelector('.jarResearchCandidate')).toHaveTextContent('explicitly adopted');
});
test('floating instances are independent and closing/reloading restores no candidate or boundary', async () => {
  const saved = JSON.stringify(bha), storage = localStorage.getItem(SURVEY_STORAGE_KEY);
  const first = renderBridge(), second = renderBridge();
  const one = within(first.container), two = within(second.container);
  await adopt(one); expect(two.getByLabelText('Prescribed initial compression at jar (lbf)')).toHaveValue(1000);
  expect(two.getByText(adoptText)).toBeDisabled(); expect(two.queryByText('Return to manual compression')).not.toBeInTheDocument();
  first.unmount(); second.unmount(); renderBridge();
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByLabelText('Research static surface hookload (klbf)')).toHaveValue(null);
  expect(screen.queryByText('Return to manual compression')).not.toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(saved); expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(storage);
});
