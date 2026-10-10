import React from 'react';
import { render, screen } from '@testing-library/react';
import JarPlacement from './JarPlacement';

const bha = {
  rows: [
    { category: 'DC', toolName: 'Lower DC', length: 160, weight: 200, od: 9.5, idSize: 3.75 },
    { category: 'JAR', toolName: 'Test Jar', length: 30, weight: 150, od: 9.5 },
    { category: 'DC', toolName: 'Upper DC', length: 40, weight: 200, od: 9.5 }
  ], wob: 10, mudWeight: 10, inclination: 45, frictionCoefficient: 0.25,
  rpm: 40, rop: 200, holeSize: 12.25
};

test('Jar Placement shows only compact performance, independent of shared drilling mode', () => {
  const setDrillingMode = jest.fn();
  const { rerender } = render(<JarPlacement bha={bha} drillingMode="slide" setDrillingMode={setDrillingMode} />);
  expect(screen.getByRole('heading', { name: 'Jar Performance' })).toBeInTheDocument();
  expect(screen.queryByText('Jar Placement — Drilling')).not.toBeInTheDocument();
  expect(screen.queryByText('PRELIMINARY — NOT FOR OPERATIONAL USE')).not.toBeInTheDocument();
  expect(screen.getAllByText('Preliminary — Idealised Skeem Model (1979)')).toHaveLength(1);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.queryByText('Test Jar')).not.toBeInTheDocument();
  expect(screen.queryByText(/^Neutral point:|^Jar centre:|above neutral point|jar avoidance zone/)).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  const performance = screen.getByRole('region', { name: 'Jar Performance' });
  expect(performance.style.margin).toBe('0px');
  expect(performance.style.borderTop).toBe('');
  rerender(<JarPlacement bha={bha} drillingMode="rotate" setDrillingMode={setDrillingMode} />);
  expect(setDrillingMode).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Jar stroke (in)')).toHaveValue(4);
  expect(screen.getByLabelText('Overpull at jar (klbf)')).toBeInTheDocument();
  expect(screen.getByLabelText('Stuck-point position (ft above bit)')).toHaveValue(0);
});

test('details stay collapsed and no static-placement warnings leak into performance', () => {
  render(<JarPlacement bha={{ ...bha, wob: 1000 }} drillingMode="slide" />);
  expect(screen.queryByText(/^Neutral point:|Avoidance status/)).not.toBeInTheDocument();
  expect(screen.getByText('Engineering details and applicability').closest('details')).not.toHaveAttribute('open');
});
