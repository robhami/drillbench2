import React from 'react';
import { act, render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

test('renders DrillFrame application', () => {
  render(<App />);
  expect(screen.getByText('Frame').closest('.dbTitle')).toHaveTextContent('DrillFrame');
  expect(screen.getByText('DRILLING ANALYSIS SUITE')).toBeInTheDocument();
  expect(screen.queryByText('WellBench')).not.toBeInTheDocument();
  expect(screen.getByText('JARFRAME')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Impact & Impulse', exact: true })).toBeInTheDocument();
});

test('new and legacy BHAs default missing baseline friction while preserving saved zero and nonzero values', () => {
  const saved = [
    { id: 'missing', rows: [] },
    { id: 'null', frictionCoefficient: null, rows: [] },
    { id: 'zero', frictionCoefficient: 0, rows: [] },
    { id: 'nonzero', frictionCoefficient: 0.37, rows: [] }
  ];
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: { id: 'current', rows: [] }, savedBhas: saved }));
  const ref = React.createRef();
  render(<App ref={ref} />);
  expect(ref.current.state.well.currentBha.frictionCoefficient).toBe(0.25);
  expect(ref.current.state.well.savedBhas.map(bha => bha.frictionCoefficient)).toEqual([0.25, 0.25, 0, 0.37]);
  for (const [id, expected] of [['missing', 0.25], ['null', 0.25], ['zero', 0], ['nonzero', 0.37]]) {
    act(() => ref.current.loadBha(id));
    expect(ref.current.state.well.currentBha.frictionCoefficient).toBe(expected);
  }
  act(() => ref.current.newBha());
  expect(ref.current.state.well.currentBha.frictionCoefficient).toBe(0.25);
  act(() => ref.current.updateBha({ frictionCoefficient: '' }));
  expect(ref.current.state.well.currentBha.frictionCoefficient).toBe('');
});
