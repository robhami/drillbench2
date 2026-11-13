import React from 'react';
import { render, screen, act } from '@testing-library/react';
import CurrentDrillingSummary from './CurrentDrillingSummary';

jest.mock('../EngineeringString/EngineeringStringCard', () => props => <div>Existing summary: {props.bha?.name} {props.drillingMode} {String(props.summaryOnly)}</div>);
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('debounces changes and suppresses stale current-depth summaries immediately', () => {
  const bha = { name: 'original' };
  const view = render(<CurrentDrillingSummary bha={bha} drillingMode="slide" />);
  expect(screen.getByRole('status')).toHaveTextContent('Updating');
  act(() => jest.advanceTimersByTime(300));
  expect(screen.getByText('Existing summary: original slide true')).toBeVisible();
  view.rerender(<CurrentDrillingSummary bha={{ name: 'changed' }} drillingMode="rotate" />);
  expect(screen.queryByText(/original slide/)).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(299));
  expect(screen.queryByText(/Existing summary/)).not.toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));
  expect(screen.getByText('Existing summary: changed rotate true')).toBeVisible();
});

test('unmount cancels pending initial calculation', () => {
  const view = render(<CurrentDrillingSummary bha={{}} />);
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});
