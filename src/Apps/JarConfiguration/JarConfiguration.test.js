import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JarConfiguration from './JarConfiguration';
import { calcSkeemConfigurationSweep } from '../../engineering/jar/skeemConfigurationSweep';

jest.mock('../../engineering/jar/skeemConfigurationSweep', () => ({
  ...jest.requireActual('../../engineering/jar/skeemConfigurationSweep'),
  calcSkeemConfigurationSweep: jest.fn(jest.requireActual('../../engineering/jar/skeemConfigurationSweep').calcSkeemConfigurationSweep)
}));
jest.mock('./ConfigurationPlot', () => props => <div data-testid="configuration-plot" data-traces={props.data.map(t => t.type).join(',')} data-ytitle={props.layout.yaxis?.title.text} />);

const bha = { rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'JAR', length: 10 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95) }
] };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const run = () => fireEvent.click(screen.getByRole('button', { name: 'Run sweep' }));
beforeEach(() => {
  calcSkeemConfigurationSweep.mockImplementation(jest.requireActual('../../engineering/jar/skeemConfigurationSweep').calcSkeemConfigurationSweep);
  calcSkeemConfigurationSweep.mockClear();
});

test('initializes ranges when a saved BHA loads without replacing edited fields', () => {
  const { rerender } = render(<JarConfiguration bha={{ rows: [] }} />);
  change('Overpull at jar (klbf)', '170');
  change('Minimum L1 (ft)', '40');
  rerender(<JarConfiguration bha={bha} />);
  expect(screen.getByLabelText('Total effective collars (ft)')).toHaveValue(240);
  expect(screen.getByLabelText('Minimum L1 (ft)')).toHaveValue(40);
  expect(screen.getByLabelText('Maximum L1 (ft)')).toHaveValue(180);
  expect(screen.getByLabelText('Overpull at jar (klbf)')).toHaveValue(170);
  expect(calcSkeemConfigurationSweep).not.toHaveBeenCalled();
});

test('runs explicitly, defaults to 50 positions and displays all sampled maxima', async () => {
  const before = JSON.stringify(bha);
  render(<JarConfiguration bha={bha} />);
  expect(calcSkeemConfigurationSweep).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Positions')).toHaveValue(50);
  expect(screen.getByText(/Engineering inputs, assumptions/).closest('details')).not.toHaveAttribute('open');
  change('Positions', '3');
  expect(calcSkeemConfigurationSweep).not.toHaveBeenCalled();
  run();
  await waitFor(() => expect(screen.getByTestId('configuration-plot')).toBeInTheDocument());
  expect(screen.getByText('3 valid · 0 invalid configurations')).toBeInTheDocument();
  expect(screen.getByText('Impulse')).toBeInTheDocument();
  expect(screen.getByText('12,303.475 lbf·s')).toBeInTheDocument();
  expect(screen.getByText('L1 60 ft · L2 180 ft')).toBeInTheDocument();
  expect(screen.getByText('Average stuck-point force')).toBeInTheDocument();
  expect(screen.getByText('Initial impact force')).toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(before);
});
test('metric switching and draft input changes do not rerun the grid', async () => {
  render(<JarConfiguration bha={bha} />);
  change('Positions', '3'); run();
  await screen.findByTestId('configuration-plot');
  expect(calcSkeemConfigurationSweep).toHaveBeenCalledTimes(2); // Grid and one actual configuration.
  change('Result metric', 'impactForce');
  expect(screen.getByTestId('configuration-plot')).toHaveAttribute('data-ytitle', 'Initial impact force (klbf)');
  change('Overpull at jar (klbf)', '170');
  expect(screen.getByRole('status')).toHaveTextContent('previous run');
  expect(calcSkeemConfigurationSweep).toHaveBeenCalledTimes(2);
});
test('independent mode defaults to 20 by 20 and returns a 3D mesh', async () => {
  render(<JarConfiguration bha={bha} />);
  change('Sweep mode', 'independent');
  expect(screen.getByLabelText('L1 samples')).toHaveValue(20);
  expect(screen.getByLabelText('L2 samples')).toHaveValue(20);
  expect(screen.queryByLabelText('Total effective collars (ft)')).not.toBeInTheDocument();
  change('L1 samples', '3'); change('L2 samples', '3'); run();
  await screen.findByTestId('configuration-plot');
  expect(screen.getByTestId('configuration-plot').getAttribute('data-traces')).toContain('mesh3d');
  expect(screen.getByText('9 valid · 0 invalid configurations')).toBeInTheDocument();
});
test('unsupported BHA blocks calculation and BHA changes invalidate stale results', async () => {
  const { rerender } = render(<JarConfiguration bha={bha} />);
  change('Positions', '3'); run(); await screen.findByTestId('configuration-plot');
  rerender(<JarConfiguration bha={{ rows: bha.rows.map((r, i) => i === 2 ? { ...r, category: 'HWDP' } : r) }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Unsupported geometry');
  expect(screen.getByRole('button', { name: 'Run sweep' })).toBeDisabled();
  expect(screen.queryByTestId('configuration-plot')).not.toBeInTheDocument();
});
test('invalid requests and all-invalid grids produce explanations, not zero surfaces', () => {
  render(<JarConfiguration bha={bha} />);
  change('Positions', '10000'); run();
  expect(screen.getByRole('alert')).toHaveTextContent('1–500');
  expect(calcSkeemConfigurationSweep).not.toHaveBeenCalled();
  change('Positions', '3'); change('Minimum L1 (ft)', '300'); change('Maximum L1 (ft)', '400'); run();
  expect(screen.getByText('0 valid · 3 invalid configurations')).toBeInTheDocument();
  expect(screen.getAllByText('No valid samples')).toHaveLength(3);
  expect(screen.queryByTestId('configuration-plot')).not.toBeInTheDocument();
  expect(screen.getByText(/3 invalid:/)).toHaveTextContent('upperCollarLengthFt');
});
