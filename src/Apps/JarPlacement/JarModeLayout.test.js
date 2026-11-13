import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JarModeLayout, { JarDirectionTabs } from './JarModeLayout';

test('shared mode layout owns warning, inputs, graph, results and collapsed Details order', () => {
  render(<JarModeLayout inputs={<input aria-label="Primary" />} graph={<p>History</p>}
    results={<dl><dt>Force</dt></dl>} details={<p>Model definitions</p>} />);
  const root = document.querySelector('.jarModeLayout');
  expect([...root.children].map(e => e.tagName)).toEqual(['P', 'INPUT', 'SECTION', 'DL', 'DETAILS']);
  expect(root.querySelector('details')).not.toHaveAttribute('open');
  expect(screen.getByText('Model definitions')).not.toBeVisible();
});

test('tabs implement roving focus, automatic arrow activation and Home/End', () => {
  function Harness() { const [mode, setMode] = React.useState('up'); return <JarDirectionTabs value={mode} onChange={setMode} idPrefix="test-jar" />; }
  render(<Harness />);
  const up = screen.getByRole('tab', { name: 'Jar Up' }), down = screen.getByRole('tab', { name: 'Jar Down' });
  expect(up).toHaveAttribute('tabindex', '0'); expect(down).toHaveAttribute('tabindex', '-1');
  fireEvent.keyDown(up, { key: 'ArrowRight' });
  expect(down).toHaveFocus(); expect(down).toHaveAttribute('aria-selected', 'true');
  expect(down).toHaveAttribute('aria-controls', 'test-jar-panel-down');
  fireEvent.keyDown(down, { key: 'Home' }); expect(up).toHaveFocus();
  fireEvent.keyDown(up, { key: 'End' }); expect(down).toHaveFocus();
  fireEvent.keyDown(down, { key: 'ArrowLeft' }); expect(up).toHaveFocus();
});
