import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JarClearance from './JarClearance';
import { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';

jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="clearance-plot">{JSON.stringify(props.data)}</div>);
const source = { originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n1000,0,90', confirmed: true, filename: 'vertical.csv' };
const bha = { name: 'Test BHA', wob: 6, mudWeight: 10, frictionCoefficient: 0.25, rpm: 40, rop: 200, rows: [{ category: 'DC', length: 50, weight: 100, od: 8 }, { category: 'JAR', length: 20, weight: 100, od: 8 }, { category: 'DC', length: 130, weight: 100, od: 8 }] };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const run = () => fireEvent.click(screen.getByRole('button', { name: 'Analyse run' }));
beforeEach(() => { localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(source)); });

test('deploys DP per sampled depth, inspection profile uses deployed length, surface edit is explicitly stale', async () => {
  const withPipe = { ...bha, rows: [...bha.rows, { category: 'DP', length: 11035, weight: 20, od: 5 }] };
  const original = JSON.stringify(withPipe);
  render(<JarClearance bha={withPipe} />);
  expect(screen.getByText(/Depth-dependent drillpipe deployment is active/)).toBeInTheDocument();
  expect(screen.getByLabelText('Starting bit MD (ft)')).toHaveValue(200);
  change('Starting bit MD (ft)', '300'); change('Ending bit MD (ft)', '500'); run();
  await screen.findAllByTestId('clearance-plot');
  expect(screen.getByText(/Deployed drillpipe: 100 ft/)).toBeInTheDocument();
  expect(screen.getAllByTestId('clearance-plot')).toHaveLength(1);
  change('Inspect bit MD (ft)', '500');
  expect(screen.getByText(/Deployed drillpipe: 300 ft/)).toBeInTheDocument();
  change('Surface reference MD (ft)', '100');
  expect(screen.getByText(/Results show the previous run/)).toBeInTheDocument();
  expect(JSON.stringify(withPipe)).toBe(original);
});

test('defaults to complete survey-covered interval, executes only on request and displays worst case/compression', async () => {
  render(<JarClearance bha={bha} />);
  expect(screen.getByLabelText('Starting bit MD (ft)')).toHaveValue(200);
  expect(screen.getByLabelText('Ending bit MD (ft)')).toHaveValue(1000);
  expect(screen.queryByText('Closest sampled NP clearance')).not.toBeInTheDocument();
  change('Starting bit MD (ft)', '300'); change('Ending bit MD (ft)', '500');
  change('Minimum WOB (klbf)', '4'); change('Maximum WOB (klbf)', '8'); change('WOB samples', '3'); run();
  await screen.findAllByTestId('clearance-plot');
  expect(screen.getByRole('table', { name: 'Scenario comparison' })).toBeInTheDocument();
  change('Graph view', 'single');
  expect(screen.getByText(/ft at bit MD 300 ft/)).toBeInTheDocument();
  expect(screen.getByText(/18 evaluated \/ 0 invalid/)).toBeInTheDocument();
  expect(screen.getByText(/Jar compression occurs/)).toBeInTheDocument();
  expect(screen.getByText(/Missing NP is unavailable clearance, not safe/)).toBeInTheDocument();
});

test('scenario selection shows actual load profile, and editing fields marks results stale without recalculating', async () => {
  render(<JarClearance bha={bha} />);
  change('Starting bit MD (ft)', '300'); change('Ending bit MD (ft)', '500');
  change('Minimum WOB (klbf)', '4'); change('Maximum WOB (klbf)', '8'); change('WOB samples', '3');
  change('Analysis modes', 'both'); run(); await screen.findAllByTestId('clearance-plot');
  change('Inspect bit MD (ft)', '500'); change('Displayed operating scenario', '3');
  expect(screen.getByText(/Selected bit MD 500 ft · WOB 6 klbf · rotate/)).toBeInTheDocument();
  expect(screen.getAllByTestId('clearance-plot')).toHaveLength(1);
  expect(screen.getByText('compression')).toBeInTheDocument();
  expect(screen.getByText('440')).toBeInTheDocument();
  const before = screen.getAllByTestId('clearance-plot')[0].textContent;
  change('Maximum WOB (klbf)', '9');
  expect(screen.getByText(/Results show the previous run/)).toBeInTheDocument();
  expect(screen.getAllByTestId('clearance-plot')[0].textContent).toBe(before);
});

test('coverage, missing input and scenario-limit errors appear before calculation', () => {
  render(<JarClearance bha={bha} />);
  change('Starting bit MD (ft)', '199'); run();
  expect(screen.getByRole('alert')).toHaveTextContent('No extrapolation');
  change('Starting bit MD (ft)', '300'); change('Minimum WOB (klbf)', ''); run();
  expect(screen.getByRole('alert')).toHaveTextContent('finite values');
  change('Minimum WOB (klbf)', '1'); change('WOB samples', '1000'); run();
  expect(screen.getByRole('alert')).toHaveTextContent('2,000-scenario UI limit');
});

test('missing/unconfirmed survey cannot run and live Survey notification updates without storage mutation', () => {
  localStorage.removeItem(SURVEY_STORAGE_KEY);
  render(<JarClearance bha={bha} />); run();
  expect(screen.getAllByText(/Import a directional survey/).length).toBeGreaterThan(0);
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...source, confirmed: false } }));
  expect(screen.getByText(/Explicitly confirm/)).toBeInTheDocument();
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: source }));
  expect(screen.getByLabelText('Starting bit MD (ft)')).toHaveValue(200);
  expect(screen.getByText(/Complete-BHA bit MD coverage: 200–1,000 ft/)).toBeInTheDocument();
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBeNull();
});

test('no-NP result remains unavailable and invalid BHA errors are inspectable', async () => {
  const { unmount } = render(<JarClearance bha={bha} />);
  change('Minimum WOB (klbf)', '30'); change('Maximum WOB (klbf)', '30'); run();
  await screen.findAllByTestId('clearance-plot');
  expect(screen.getByText('No valid clearance')).toBeInTheDocument();
  expect(screen.getByText('None within BHA')).toBeInTheDocument();
  expect(screen.getByText('no-neutral-within-bha')).toBeInTheDocument();
  unmount();
  render(<JarClearance bha={{ ...bha, rows: bha.rows.map((r, i) => i === 1 ? { ...r, weight: undefined } : r) }} />); run();
  expect(screen.getByText(/No valid scenarios/)).toBeInTheDocument();
  expect(screen.getByText(/BHA row 2:/)).toBeInTheDocument();
});

test('BHA and survey storage are not mutated, and changing BHA clears old results', () => {
  const stored = localStorage.getItem(SURVEY_STORAGE_KEY), original = JSON.stringify(bha), updateBha = jest.fn();
  localStorage.setItem('drillbenchWell', 'unchanged');
  const { rerender } = render(<JarClearance bha={bha} updateBha={updateBha} />); run();
  expect(screen.getByText('Closest sampled NP clearance')).toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(original);
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(stored);
  expect(localStorage.getItem('drillbenchWell')).toBe('unchanged');
  expect(updateBha).not.toHaveBeenCalled();
  rerender(<JarClearance bha={{ ...bha, name: 'Changed BHA' }} />);
  expect(screen.queryByText('Closest sampled NP clearance')).not.toBeInTheDocument();
});


test('four comparison traces use endpoint WOBs and one selected friction, survive reruns and preserve saved data', async () => {
  const saved = localStorage.getItem(SURVEY_STORAGE_KEY), original = JSON.stringify(bha);
  render(<JarClearance bha={bha} />);
  change('Starting bit MD (ft)', '300'); change('Ending bit MD (ft)', '500');
  change('Minimum WOB (klbf)', '4'); change('Maximum WOB (klbf)', '8');
  change('Friction coefficients', '0.25,0.3');
  expect(screen.getByLabelText('Analysis modes')).toHaveValue('slide');
  expect(screen.getByLabelText('Graph view')).toHaveValue('compare');
  run(); await screen.findByTestId('clearance-plot');
  const traces = () => JSON.parse(screen.getByTestId('clearance-plot').textContent).filter(t => t.showlegend);
  expect(traces().map(t => t.name)).toEqual(['Minimum WOB 4 klbf \u2014 Slide', 'Minimum WOB 4 klbf \u2014 Rotate', 'Maximum WOB 8 klbf \u2014 Slide', 'Maximum WOB 8 klbf \u2014 Rotate']);
  change('Comparison friction coefficient', '0.3');
  expect(screen.getByRole('table', { name: 'Scenario comparison' })).toHaveTextContent('friction 0.3');
  const before = screen.getByTestId('clearance-plot').textContent;
  change('Maximum WOB (klbf)', '9');
  expect(screen.getByTestId('clearance-plot').textContent).toBe(before);
  run();
  expect(traces()[2].name).toBe('Maximum WOB 9 klbf \u2014 Slide');
  expect(screen.getByLabelText('Comparison friction coefficient')).toHaveValue('0.3');
  change('Graph view', 'compare'); change('Maximum WOB (klbf)', '4'); run();
  expect(traces()).toHaveLength(2);
  change('Friction coefficients', '0.25'); run();
  expect(screen.getByLabelText('Comparison friction coefficient')).toHaveValue('0.3');
  expect(traces().every(t => t.y.every(y => y === null))).toBe(true);
  expect(screen.getAllByText(/scenario samples missing/)).toHaveLength(2);
  change('Comparison friction coefficient', '0.25');
  expect(traces().every(t => t.y.every(y => y !== null))).toBe(true);
  expect(screen.getByText(/two distinct mode traces/)).toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(original);
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(saved);
});


test('one failed endpoint scenario leaves other traces visible and identifies the failure', async () => {
  const engine = require('../../engineering/jar/jarClearanceAcrossRun');
  const calculate = engine.calcJarClearanceAcrossRun;
  const spy = jest.spyOn(engine, 'calcJarClearanceAcrossRun').mockImplementation(request => {
    const result = calculate(request);
    result.scenarios = result.scenarios.map(s => s.wobLbf === request.maxWobLbf && s.mode === 'rotate' ? { ...s, valid: false, jars: [], errors: ['Rotate endpoint unavailable'] } : s);
    return result;
  });
  try {
    render(<JarClearance bha={bha} />);
    change('Starting bit MD (ft)', '300'); change('Ending bit MD (ft)', '500');
    change('Minimum WOB (klbf)', '4'); change('Maximum WOB (klbf)', '8'); run();
    await screen.findByTestId('clearance-plot');
    const traces = JSON.parse(screen.getByTestId('clearance-plot').textContent).filter(t => t.showlegend);
    expect(traces.slice(0, 3).every(t => t.y.every(y => y !== null))).toBe(true);
    expect(traces[3].y).toEqual([null, null, null]);
    expect(screen.getByText('Scenario failed: Rotate endpoint unavailable')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Scenario comparison' })).toHaveTextContent('200 ft unresolved');
  } finally { spy.mockRestore(); }
});
