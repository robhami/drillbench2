import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WobOperatingRanges from './WobOperatingRanges';
import { calcWobRangesAtDepth } from '../../engineering/jar/wobOperatingRanges';

jest.mock('../../engineering/jar/wobOperatingRanges', () => ({ calcWobRangesAtDepth: jest.fn() }));
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="wob-plot">{JSON.stringify(props)}</div>);
const request = { minWobLbf: 10000, maxWobLbf: 35000, frictionCoefficients: [0.25, 0.3], rpm: 150, ropFtHr: 60 };
const depthsFt = [4000, 5000];
const props = { request, depthsFt, frictionCoefficient: 0.25, jarIndex: 0, revision: 1 };
beforeEach(() => {
  jest.clearAllMocks();
  calcWobRangesAtDepth.mockImplementation((input, bitMdFt, mode) => ({ valid: true, bitMdFt, mode, evaluationCount: 101, boundaries: [],
    regions: [{ status: 'acceptable', lowerWobLbf: input.minWobLbf, upperWobLbf: input.maxWobLbf, reason: 'Sample-supported', lowerBoundary: 'evaluated-range-limit' }] }));
});

test('calculates on request for both modes at the selected friction/jar; changing selection clears results', async () => {
  const { rerender } = render(<WobOperatingRanges {...props} />);
  expect(calcWobRangesAtDepth).not.toHaveBeenCalled();
  expect(screen.getByText(/Evaluated WOB: 10–35 klbf/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate WOB ranges' }));
  await screen.findByTestId('wob-plot');
  expect(calcWobRangesAtDepth.mock.calls.map(c => c.slice(1, 5))).toEqual([[4000, 'slide', 0.25, 0], [4000, 'rotate', 0.25, 0], [5000, 'slide', 0.25, 0], [5000, 'rotate', 0.25, 0]]);
  expect(screen.getByText(/No maximum WOB is inferred/)).toBeInTheDocument();
  rerender(<WobOperatingRanges {...props} frictionCoefficient={0.3} jarIndex={1} />);
  await waitFor(() => expect(screen.queryByTestId('wob-plot')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Calculate WOB ranges' }));
  await screen.findByTestId('wob-plot');
  expect(calcWobRangesAtDepth.mock.calls.slice(-4).every(c => c[3] === 0.3 && c[4] === 1)).toBe(true);
});

test('invalid spacing and friction selections fail before calculating', () => {
  const { rerender } = render(<WobOperatingRanges {...props} />);
  fireEvent.change(screen.getByLabelText('WOB scan spacing (klbf)'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Calculate WOB ranges' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Increase WOB scan spacing');
  expect(calcWobRangesAtDepth).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('WOB scan spacing (klbf)'), { target: { value: '0.5' } });
  rerender(<WobOperatingRanges {...props} frictionCoefficient={0.9} />);
  fireEvent.click(screen.getByRole('button', { name: 'Calculate WOB ranges' }));
  expect(screen.getByRole('alert')).toHaveTextContent('included in this run');
});

test('cancel discards partial calculations and changing run inputs clears the graph', async () => {
  const { rerender } = render(<WobOperatingRanges {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Calculate WOB ranges' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel WOB calculation' }));
  await waitFor(() => expect(screen.queryByText(/Evaluated 0/)).not.toBeInTheDocument());
  expect(screen.queryByTestId('wob-plot')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate WOB ranges' }));
  await screen.findByTestId('wob-plot');
  rerender(<WobOperatingRanges {...props} request={{ ...request, maxWobLbf: 30000 }} />);
  expect(screen.queryByTestId('wob-plot')).not.toBeInTheDocument();
});
