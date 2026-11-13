import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Workspace from './Workspace';
import { FLOAT_KEY } from './floatingLayout';

jest.mock('./Widget', () => props => {
  const Builder = require('../Components/BHABuilder/BHABuilder').default;
  return props.widget.type === 'bhaEntry' ? <Builder {...props} /> : <div>{props.widget.type}</div>;
});
jest.mock('react-rnd', () => ({ Rnd: props => <div style={props.style} data-testid="window-frame" data-size={JSON.stringify(props.size)} data-position={JSON.stringify(props.position)} onMouseDown={props.onMouseDown}>
  {props.children}<button aria-label="Simulate move" onClick={() => props.onDragStop(null, { x: 80, y: 90 })} />
  <button aria-label="Simulate resize" onClick={() => props.onResizeStop(null, 'right', { style: { width: '610px', height: '480px' } }, {}, { x: 80, y: 90 })} />
</div> }));
const bha = { id: 'window-test', holeSize: 8.5, rows: [{ rowId: 'r', category: 'DC', length: 10, weight: 40, od: 5, idSize: 3, toolName: 'Existing' }] };
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
beforeEach(() => {
  localStorage.clear(); window.innerWidth = 1600; window.innerHeight = 1000; global.ResizeObserver = class { observe() {} disconnect() {} };
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
});
afterEach(() => jest.restoreAllMocks());

test('Add uses the existing floating window, with separate content, move/resize/maximise/close and no BHA mutation', () => {
  const update = jest.fn(), initial = JSON.stringify(bha); render(<Workspace bha={bha} updateBha={update} />);
  const layout = localStorage.getItem(FLOAT_KEY);
  click('+ Add Component'); const editor = screen.getByLabelText('Add Component window');
  expect(screen.getByLabelText('BHA Data Entry window')).not.toContainElement(editor);
  const frame = editor.closest('[data-testid="window-frame"]');
  expect(frame).toHaveAttribute('data-size', JSON.stringify({ width: 660, height: 640 }));
  fireEvent.click(within(frame).getByLabelText('Simulate move')); fireEvent.click(within(frame).getByLabelText('Simulate resize'));
  expect(frame).toHaveAttribute('data-size', JSON.stringify({ width: 610, height: 480 }));
  expect(frame).toHaveAttribute('data-position', JSON.stringify({ x: 80, y: 90 }));
  click('Maximise Add Component'); expect(frame).toHaveAttribute('data-size', JSON.stringify({ width: 1000, height: 800 }));
  click('Restore Add Component'); fireEvent.change(screen.getByLabelText('Component name'), { target: { value: 'Discard me' } });
  click('Close Add Component'); expect(screen.queryByLabelText('Add Component window')).not.toBeInTheDocument();
  click('+ Add Component'); expect(screen.getByLabelText('Component name')).toHaveValue('');
  expect(update).not.toHaveBeenCalled(); expect(JSON.stringify(bha)).toBe(initial);
  expect(localStorage.getItem(FLOAT_KEY)).toBe(layout);
});

test('switching BHA closes its transient editor and preserves both BHA data objects', () => {
  const next = { ...bha, id: 'other-bha', rows: bha.rows.map(r => ({ ...r, rowId: 'other' })) }, before = JSON.stringify([bha, next]);
  const view = render(<Workspace bha={bha} />); click('+ Add Component');
  view.rerender(<Workspace bha={next} />); expect(screen.queryByLabelText('Add Component window')).not.toBeInTheDocument();
  expect(JSON.stringify([bha, next])).toBe(before);
});

test('editor height stays inside the visible screen even when its canvas is taller', () => {
  window.innerHeight = 600; render(<Workspace bha={bha} />); click('+ Add Component');
  expect(screen.getByLabelText('Add Component window').closest('[data-testid="window-frame"]')).toHaveAttribute('data-size', JSON.stringify({ width: 660, height: 592 }));
});
