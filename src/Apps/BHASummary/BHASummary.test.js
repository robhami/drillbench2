import React from 'react';
import { render, screen } from '@testing-library/react';
import BHASummary from './BHASummary';

test('legacy neutral point identifies its frictionless constant-inclination model', () => {
  render(<BHASummary bha={{ mudWeight: 10, wob: 10, inclination: 45,
    rows: [{ category: 'DC', length: 1000, weight: 100, od: 6.75 }] }} />);
  expect(screen.getByText('Constant-Inclination NP (Frictionless)')).toBeVisible();
  expect(screen.queryByText('Neutral point')).not.toBeInTheDocument();
});

test('summary does not expose legacy Bit ID metadata or internal component identifiers', () => {
  render(<BHASummary bha={{ mudWeight: 10, wob: 10, inclination: 45, rows: [
    { rowId: 'row-123', selectedToolId: 'tool-456', category: 'BIT', bitId: 'PDC-001', toolName: '8.5 in PDC', length: 1, weight: 50, od: 8.5 }
  ] }} />);
  expect(screen.queryByText('Bit ID')).not.toBeInTheDocument();
  expect(screen.queryByText('PDC-001')).not.toBeInTheDocument();
  expect(screen.queryByText('row-123')).not.toBeInTheDocument();
  expect(screen.queryByText('tool-456')).not.toBeInTheDocument();
});
