import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JarConfiguration from './JarConfiguration';
import fixture from '../../../docs/ValidationStudies/DrillFrameMixedBHAStage6B1.fixture.json';

test('mixed BHA remains visible while dynamic analysis stays gated on explicit properties and stand makeup', () => {
  const before = JSON.stringify(fixture);
  render(<JarConfiguration bha={fixture} drillingMode="slide" />);
  expect(screen.getByText(fixture.name)).toBeInTheDocument();
  expect(screen.getByText(/PRELIMINARY — NOT FOR OPERATIONAL USE/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run Analysis' })).toBeDisabled();
  expect(screen.getByText(/Enter each measured DC joint length/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Engineering Settings / Diagnostics' }));
  expect(screen.getByLabelText(/Assumed density/)).toHaveValue(null);
  expect(screen.getByLabelText(/Young/)).toHaveValue(null);
  expect(screen.getByText(/Required before calculation/)).toBeInTheDocument();
  expect(JSON.stringify(fixture)).toBe(before);
});
