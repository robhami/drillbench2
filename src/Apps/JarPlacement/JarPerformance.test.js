import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JarPerformance from './JarPerformance';

const bha = { rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'JAR', length: 10 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95) }
] };
const enterOverpull = () => fireEvent.change(screen.getByLabelText('Overpull at jar (klbf)'), { target: { value: '165' } });

test('shows four primary results without charts and keeps timing in collapsed engineering details', () => {
  render(<JarPerformance bha={bha} />);
  expect(screen.getByText('Preliminary — Idealised Skeem Model (1979)')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Overpull at jar must be greater than zero');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  enterOverpull();
  ['11.46 ft/s', '265.83 klbf', '546.82 klbf', '12,303.47 lbf·s'].forEach(value => expect(screen.getByText(value)).toBeInTheDocument());
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByText(/Jar centre:/)).not.toBeInTheDocument();
  const timing = screen.getByText(/Impact time: 50.81 ms/);
  expect(timing).toHaveTextContent('Primary pulse duration: 22.50 ms');
  expect(timing.closest('details')).not.toHaveAttribute('open');
  expect(document.querySelectorAll('dt')).toHaveLength(4);
  expect(screen.getByLabelText('Jar stroke (in)').closest('.jarPerformanceInputs')).toBe(screen.getByLabelText('Overpull at jar (klbf)').closest('.jarPerformanceInputs'));
  expect(screen.getByLabelText('Stuck-point position (ft above bit)').closest('label')).toHaveClass('jarPerformanceStuckPoint');
  expect(screen.getByText('265.83 klbf').closest('dl')).toHaveClass('jarPerformanceResults');
  expect(screen.getByText(/L1: 60.00 ft/)).toHaveTextContent('L2: 180.00 ft · L3: 3,000.00 ft');
  expect(screen.getByText(/Lower-collar air weight W/)).toHaveTextContent('5,041.03 lbf');
  expect(screen.getByText(/Completed reflections/)).toHaveTextContent('Completed reflections: 2');
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
