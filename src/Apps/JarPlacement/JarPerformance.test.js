import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import JarPerformance from './JarPerformance';
import * as performance from './skeemPerformance';
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="impact-plot">{JSON.stringify(props)}</div>);

const bha = { rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'JAR', length: 10 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95) }
] };
const enterOverpull = () => fireEvent.change(screen.getByLabelText('Overpull at jar (klbf)'), { target: { value: '165' } });

test('floating-window tab instances have unique relationships and independent selection', () => {
  render(<><JarPerformance bha={bha} /><JarPerformance bha={bha} /></>);
  const [first, second] = screen.getAllByRole('region', { name: 'Jar Performance' });
  const tabs = screen.getAllByRole('tab');
  expect(new Set(tabs.map(t => t.id)).size).toBe(4);
  tabs.forEach(t => expect(document.getElementById(t.getAttribute('aria-controls'))).toHaveAttribute('aria-labelledby', t.id));
  fireEvent.click(within(first).getByRole('tab', { name: 'Jar Down' }));
  expect(within(first).getByRole('tab', { name: 'Jar Down' })).toHaveAttribute('aria-selected', 'true');
  expect(within(second).getByRole('tab', { name: 'Jar Up' })).toHaveAttribute('aria-selected', 'true');
});

test('unified Jar Up layout retains the published-task Test 4 regression values', async () => {
  const test4 = require('../../../docs/ValidationStudies/JarPlacementDemoStage5C1.json').storage.drillbenchWell.currentBha;
  render(<JarPerformance bha={{ ...test4, jarImpactInputs: { up: { strokeIn: '7', overpullKlbf: '300', stuckPointFt: '5' } } }} />);
  await screen.findByTestId('impact-plot');
  expect(screen.getByText('488.3 klbf')).toBeInTheDocument();
  expect(screen.getByText('1,090.6 klbf')).toBeInTheDocument();
  expect(screen.getByText('23,155.0 lbf·s')).toBeInTheDocument();
  expect(screen.getByText('Primary impulse')).toBeInTheDocument();
});

test('Up reset restores UI defaults, removes old results and does not change saved BHA inputs', async () => {
  const test4 = require('../../../docs/ValidationStudies/JarPlacementDemoStage5C1.json').storage.drillbenchWell.currentBha;
  const saved = { ...test4, jarImpactInputs: { up: { strokeIn: '7', overpullKlbf: '300', stuckPointFt: '5' } } };
  const before = JSON.stringify(saved), updateBha = jest.fn();
  const view = render(<JarPerformance bha={saved} updateBha={updateBha} />); await screen.findByTestId('impact-plot');
  fireEvent.click(screen.getByRole('button', { name: 'Reset Jar Up calculation' }));
  expect(screen.getByLabelText('Jar stroke (in)')).toHaveValue(4);
  expect(screen.getByLabelText('Overpull at jar (klbf)')).toHaveValue(null);
  expect(screen.getByLabelText('Stuck-point position (ft above bit)')).toHaveValue(0);
  expect(screen.queryByTestId('impact-plot')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.jarUnifiedResults .jarResultPlaceholder')).toHaveLength(6);
  expect(document.querySelector('.jarEngineeringDetails')).not.toHaveAttribute('open');
  expect(JSON.stringify(saved)).toBe(before); expect(updateBha).not.toHaveBeenCalled();
  view.unmount(); render(<JarPerformance bha={saved} />); await screen.findByTestId('impact-plot');
  expect(screen.getByLabelText('Overpull at jar (klbf)')).toHaveValue(300);
  expect(screen.getByText('488.3 klbf')).toBeInTheDocument();
});

test('inputs precede graph and six primary results; engineering details stay collapsed', async () => {
  render(<JarPerformance bha={bha} />);
  expect(screen.getByText('Idealised research model — Not for operational use')).toHaveClass('jarModelNotice');
  expect(screen.getByRole('status')).toHaveTextContent('Enter overpull at jar to calculate');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  enterOverpull();
  await screen.findByTestId('impact-plot');
  expect(document.querySelector('.jarPrimaryInputs').compareDocumentPosition(document.querySelector('.jarImpactGraph')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText('Engineering Details').closest('details')).not.toHaveAttribute('open');
  expect(screen.getByLabelText('Show cumulative impulse')).not.toBeVisible();
  expect(JSON.parse(screen.getByTestId('impact-plot').textContent).plotHeight).toBe(350);
  ['11.5 ft/s', '265.8 klbf', '546.8 klbf', '12,303.5 lbf·s'].forEach(value => expect(screen.getByText(value)).toBeInTheDocument());
  expect(screen.getByRole('region', { name: 'Primary stuck-point force versus time' }).compareDocumentPosition(document.querySelector('.jarPerformanceResults')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText(/Jar centre:/)).not.toBeInTheDocument();
  const timing = screen.getByText(/Impact time: 50.81 ms/);
  expect(timing).toHaveTextContent('Primary pulse duration: 22.50 ms');
  expect(timing.closest('details')).not.toHaveAttribute('open');
  expect(document.querySelectorAll('.jarUnifiedResults dt')).toHaveLength(6);
  expect(screen.getByText('619.4 klbf')).toBeInTheDocument();
  expect(screen.getByText('22.50 ms')).toBeInTheDocument();
  expect(screen.getByText('Stuck-Point Force vs Time — Jar Up')).toBeInTheDocument();
  expect(screen.getByLabelText('Jar stroke (in)').closest('.jarPerformanceInputs')).toBe(screen.getByLabelText('Overpull at jar (klbf)').closest('.jarPerformanceInputs'));
  expect(screen.getByLabelText('Stuck-point position (ft above bit)').closest('label')).toHaveClass('jarPerformanceStuckPoint');
  expect(screen.getByText('265.8 klbf').closest('dl')).toHaveClass('jarPerformanceResults');
  expect(screen.getByText(/L1: 60.00 ft/)).toHaveTextContent('L2: 180.00 ft · L3: 3,000.00 ft');
  expect(screen.getByText(/Lower-collar air weight W/)).toHaveTextContent('5,041.03 lbf');
  expect(screen.getByText(/Completed reflections/)).toHaveTextContent('Completed reflections: 2');
});

test('material assumptions are collapsed, read-only and use current model inputs', () => {
  const { rerender } = render(<JarPerformance bha={bha} />);
  enterOverpull();
  const section = screen.getByText('Material Assumptions').closest('details');
  expect(section).not.toHaveAttribute('open');
  expect(section).toHaveTextContent('30,000,000 psi');
  expect(section).toHaveTextContent('16,000 ft/s');
  expect(section).toHaveTextContent('84.02 lbf/ft');
  expect(section).toHaveTextContent('5,041.03 lbf over 60.00 ft');
  expect(section).toHaveTextContent('material-density consistency has not been established');
  expect(section.querySelectorAll('input,select')).toHaveLength(0);
  rerender(<JarPerformance bha={{ ...bha, rows: bha.rows.map((r, i) => i === 0 ? { ...r, weight: 100 } : r) }} />);
  expect(screen.queryByText('Material Assumptions')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Mixed collar linear weights');
  fireEvent.click(screen.getByRole('tab', { name: 'Jar Down' }));
  expect(screen.queryByText('Material Assumptions')).not.toBeInTheDocument();
});
test('edits operating conditions and reacts to BHA changes without stale results', () => {
  const { rerender } = render(<JarPerformance bha={bha} />);
  enterOverpull();
  fireEvent.change(screen.getByLabelText('Stuck-point position (ft above bit)'), { target: { value: '65' } });
  expect(screen.getByRole('status')).toHaveTextContent('below the jar lower face');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Stuck-point position (ft above bit)'), { target: { value: '0' } });
  rerender(<JarPerformance bha={{ rows: bha.rows.map((r, i) => i === 2 ? { ...r, category: 'HWDP' } : r) }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Unsupported geometry');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
test('shows calculation validity failure and assumptions without fabricated results', () => {
  render(<JarPerformance bha={{ rows: bha.rows.map((r, i) => i === 3 ? { ...r, length: 1000 } : r) }} />);
  enterOverpull();
  expect(screen.getByRole('status')).toHaveTextContent('1300 ft');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByText(/W uses entered lower-collar air weight/)).toBeInTheDocument();
});

test('direction switch suppresses downward prediction without invoking or sign-reversing the upward solver', async () => {
  const spy = jest.spyOn(performance, 'calculateJarPerformance'), original = JSON.stringify(bha);
  try {
    render(<JarPerformance bha={bha} />); enterOverpull(); await screen.findByTestId('impact-plot');
    const calls = spy.mock.calls.length;
    fireEvent.click(screen.getByLabelText('Show cumulative impulse'));
    expect(JSON.parse(screen.getByTestId('impact-plot').textContent).data[2].yaxis).toBe('y2');
    expect(spy).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole('tab', { name: 'Jar Down' }));
    expect(document.querySelector('.jarTargetAdvanced')).toHaveTextContent('Static feasibility: Not established');
    expect(document.querySelector('.jarTargetResearchStatus')).toHaveTextContent('Idealised research model — Not for operational use');
    expect(screen.queryByTestId('impact-plot')).not.toBeInTheDocument();
    expect(screen.queryByText('12,303.5 lbf·s')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Overpull at jar (klbf)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Compression estimate at jar (klbf)')).toHaveValue(null);
    expect(spy).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole('tab', { name: 'Jar Up' }));
    await screen.findByTestId('impact-plot');
    expect(screen.getByText('12,303.5 lbf·s')).toBeInTheDocument();
    expect(screen.getByLabelText('Overpull at jar (klbf)')).toHaveValue(165);
    expect(JSON.stringify(bha)).toBe(original);
  } finally { spy.mockRestore(); }
});

test('scalar-only result retains analytical display without fabricating a force history', () => {
  // Presentation fallback only. Actual Test 4 physics is independently verified
  // in skeemIndependentVerification.test.js; this mock is NOT solver validation.
  const baseline = performance.calculateJarPerformance(bha, { strokeIn: '4', overpullKlbf: '165', stuckPointFt: '0' });
  const spy = jest.spyOn(performance, 'calculateJarPerformance').mockReturnValue({ ...baseline,
    impactForceKlbf: 488.3, impulseLbfS: 23155, primaryPulseDurationS: .0225,
    averageStuckPointForceKlbf: 23155 / .0225 / 1000,
    preImpact: { ...baseline.preImpact, impactTimeS: .05996 }, forceHistory: [] });
  try {
    render(<JarPerformance bha={bha} />);
    expect(screen.getByText('488.3 klbf')).toBeInTheDocument();
    expect(screen.getByText('23,155.0 lbf·s')).toBeInTheDocument();
    expect(screen.getByText(/Impact time: 59.96 ms/)).toHaveTextContent('Primary pulse duration: 22.50 ms');
    expect(screen.getByRole('status')).toHaveTextContent('force history is not available');
    expect(screen.queryByTestId('impact-plot')).not.toBeInTheDocument();
  } finally { spy.mockRestore(); }
});
