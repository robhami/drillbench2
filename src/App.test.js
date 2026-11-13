import { render, screen } from '@testing-library/react';
import App from './App';

test('renders DrillFrame application', () => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  render(<App />);
  expect(screen.getByText('Frame').closest('.dbTitle')).toHaveTextContent('DrillFrame');
  expect(screen.getByText('DRILLING ANALYSIS SUITE')).toBeInTheDocument();
  expect(screen.queryByText('WellBench')).not.toBeInTheDocument();
  expect(screen.getByText('JARFRAME')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Impact & Impulse', exact: true })).toBeInTheDocument();
});
