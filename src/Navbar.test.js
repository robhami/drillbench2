import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Navbar from './Navbar';

test('logo retains its text and subtitle with a separate Frame colour hook', () => {
  render(<Navbar currentBha={{}} />);
  const frame = screen.getByText('Frame');
  expect(frame).toHaveClass('dbTitleFrame');
  expect(frame.closest('.dbTitle')).toHaveTextContent('DrillFrame');
  expect(frame.closest('.dbTitle')).not.toHaveAttribute('style');
  expect(screen.getByText('DRILLING ANALYSIS SUITE')).toBeInTheDocument();
});

test('developer panels require explicit opt-in through compact settings', () => {
  const change = jest.fn();
  const view = render(<Navbar currentBha={{}} onDeveloperPanelsChange={change} />);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  expect(screen.getByRole('checkbox', { name: 'Show developer panels' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show developer panels' }));
  expect(change).toHaveBeenCalledWith(true);
  view.rerender(<Navbar currentBha={{}} developerPanels onDeveloperPanelsChange={change} />);
  expect(screen.getByRole('checkbox')).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(change).toHaveBeenLastCalledWith(false);
});
