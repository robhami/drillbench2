import React from 'react';
import { render, screen } from '@testing-library/react';
import EngineeringResults from './EngineeringResults';

const bha = { mudWeight: 10, wob: 10, inclination: 45, frictionCoefficient: .25, rpm: 150, rop: 60,
  rows: [{ category: 'DC', length: 100, weight: 100, od: 6.75 }] };

test.each([
  ['out-of-range friction', { frictionCoefficient: 1.1 }, 'friction coefficient'],
  ['negative WOB', { wob: -1 }, 'Invalid WOB'],
  ['missing Rotate ROP', { rop: '' }, 'ROP > 0']
])('%s remains an explicit unavailable result without crashing neighbouring panels', (_, patch, error) => {
  const panel = value => <><p>Other workspace panel</p><EngineeringResults bha={value} drillingMode="rotate" /></>;
  const view = render(panel({ ...bha, ...patch }));
  expect(screen.getByRole('alert')).toHaveTextContent(error);
  expect(screen.getByText('Other workspace panel')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  view.rerender(panel(bha));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBeVisible();
});

test('valid selected-mode loads remain in the engineering audit table', () => {
  const view = render(<EngineeringResults bha={bha} drillingMode="slide" />);
  expect(screen.getByText('Constant-Inclination Drilling Reference — Slide')).toBeVisible();
  expect(screen.getByRole('table')).toHaveTextContent('10,000');
  const slide = screen.getByRole('table').textContent;
  view.rerender(<EngineeringResults bha={bha} drillingMode="rotate" />);
  expect(screen.getByRole('table').textContent).not.toBe(slide);
});
