import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Workspace from './Workspace';
import FloatingWindow from './FloatingWindow';
import { FLOAT_KEY } from './floatingLayout';
jest.mock('./Widget', () => props => {
  const React = require('react'); const [draft, setDraft] = React.useState('');
  return <div data-testid={props.widget.type}><input aria-label={`Draft ${props.widget.type}`} value={draft} onChange={e => setDraft(e.target.value)} /><span>{props.analysisBitMdFt}</span></div>;
});
jest.mock('react-rnd', () => ({ Rnd: props => <div style={props.style} data-testid="window-frame" data-window-type={props.children?.props?.['data-window-type']} data-position={JSON.stringify(props.position)} data-size={JSON.stringify(props.size)} data-min-width={props.minWidth} data-min-height={props.minHeight} onMouseDown={props.onMouseDown}>
  {props.children}<button aria-label="Simulate move" onClick={() => props.onDragStop(null, { x: 80, y: 90 })} />
  <button aria-label="Simulate resize" onClick={() => props.onResizeStop(null, 'right', { style: { width: '750px', height: '550px' } }, {}, { x: 80, y: 90 })} />
  <button aria-label="Simulate undersized resize" onClick={() => props.onResizeStop(null, 'right', { style: { width: '650px', height: '400px' } }, {}, { x: 80, y: 90 })} />
  </div> }));
beforeEach(() => { localStorage.clear(); global.ResizeObserver = class { observe() {} disconnect() {} }; });
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const saved = key => JSON.parse(localStorage.getItem(FLOAT_KEY)).workspaces[key || 'draft'];

test('FloatingWindow applies and enforces JarFrame-only resize minimums without changing other windows', () => {
  const onChange = jest.fn();
  const { rerender } = render(<FloatingWindow window={{ id: 'jarConfiguration1', type: 'jarConfiguration', x: 0, y: 0, width: 900, height: 600, z: 1 }}
    viewport={{ width: 1200, height: 800 }} onChange={onChange}><div>Jar content</div></FloatingWindow>);
  const jarFrame = screen.getByTestId('window-frame');
  expect(jarFrame).toHaveAttribute('data-min-width', '700');
  expect(jarFrame).toHaveAttribute('data-min-height', '440');
  fireEvent.click(screen.getByLabelText('Simulate undersized resize'));
  expect(onChange).toHaveBeenCalledWith({ width: 700, height: 440, x: 80, y: 90 });
  rerender(<FloatingWindow window={{ id: 'jarForces1', type: 'jarForces', x: 0, y: 0, width: 900, height: 600, z: 1 }}
    viewport={{ width: 1200, height: 800 }} onChange={onChange}><div>General content</div></FloatingWindow>);
  expect(screen.getByTestId('window-frame')).toHaveAttribute('data-min-width', '300');
  expect(screen.getByTestId('window-frame')).toHaveAttribute('data-min-height', '180');
});

test('JarFrame launchers preserve legacy module types and saved layout keys', () => {
  expect(FLOAT_KEY).toBe('wellbenchFloatingLayoutV1');
  render(<Workspace bha={{ id: 'legacy-bha', rows: [] }} />);
  expect(screen.getByText('JARFRAME')).toBeInTheDocument();
  click('Jar Position Analysis'); click('Impact & Impulse');
  const jarPositionWindow = screen.getByLabelText('Jar Position Analysis window');
  const impactWindow = screen.getByLabelText('Impact & Impulse window');
  expect(jarPositionWindow).toHaveTextContent('Jar Position Analysis');
  expect(impactWindow).toHaveTextContent('Impact & Impulse');
  [jarPositionWindow.querySelector('.wbFloatingBrand'), impactWindow.querySelector('.wbFloatingBrand')].forEach(brand => {
    expect(brand).toHaveAttribute('data-brand', 'jarframe');
    expect(brand).toHaveTextContent('JARFRAME');
  });
  expect(saved('legacy-bha').map(w => w.type)).toEqual(expect.arrayContaining(['jarConfiguration', 'jarPlacement']));
});

test('general Workspace V2 windows use the DrillFrame brand and retain title controls', () => {
  render(<Workspace bha={{ rows: [] }} />);
  click('Hookload Calculations');
  expect(screen.getAllByTestId('window-frame').at(-1)).toHaveAttribute('data-min-width', '300');
  expect(screen.getAllByTestId('window-frame').at(-1)).toHaveAttribute('data-min-height', '180');
  const window = screen.getByLabelText('Hookload Calculations window');
  const brand = window.querySelector('.wbFloatingBrand');
  expect(brand).toHaveAttribute('data-brand', 'drillframe');
  expect(brand).toHaveTextContent('DRILLFRAME');
  expect(screen.getByRole('button', { name: 'Minimise Hookload Calculations' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Maximise Hookload Calculations' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Close Hookload Calculations' })).toBeInTheDocument();
});

test('Jar Position Analysis keeps its per-BHA window identity through close, reopen and saved-layout restore', () => {
  const bha = { id: 'jar-route-bha', rows: [] };
  const view = render(<Workspace bha={bha} />);
  click('Jar Position Analysis');
  const original = saved(bha.id).find(w => w.type === 'jarConfiguration');
  expect(original.id).toBe('jarConfiguration1');
  // The mock Rnd controls are sibling harness controls. Jar Configuration is
  // appended as the last floating window opened by this test.
  fireEvent.click(screen.getAllByLabelText('Simulate resize').at(-1));
  expect(saved(bha.id).find(w => w.type === 'jarConfiguration')).toMatchObject({ id: original.id, width: 750, height: 550 });

  fireEvent.click(screen.getByRole('button', { name: 'Minimise Jar Position Analysis' }));
  expect(saved(bha.id).find(w => w.type === 'jarConfiguration')).toMatchObject({ id: original.id, minimized: true });
  click('Jar Position Analysis');
  fireEvent.click(screen.getByRole('button', { name: 'Maximise Jar Position Analysis' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close Jar Position Analysis' }));
  expect(saved(bha.id).find(w => w.type === 'jarConfiguration')).toMatchObject({ id: original.id, maximized: true, visible: false });

  view.unmount();
  render(<Workspace bha={bha} />);
  click('Jar Position Analysis');
  expect(saved(bha.id).filter(w => w.type === 'jarConfiguration')).toHaveLength(1);
  expect(saved(bha.id).find(w => w.type === 'jarConfiguration').id).toBe(original.id);
});
test('multiple windows, focus, no duplicates and all window controls preserve module state', () => {
  render(<Workspace bha={{ rows: [] }} />); click('Hookload Calculations');
  fireEvent.change(screen.getByLabelText('Draft jarForces'), { target: { value: '100' } });
  click('Engineering String'); click('Hookload Calculations');
  expect(screen.getAllByTestId('jarForces')).toHaveLength(1);
  const top = Math.max(...saved().map(w => w.z)); expect(saved().find(w => w.type === 'jarForces').z).toBe(top);
  click('Minimise Hookload Calculations'); expect(screen.getByLabelText('Draft jarForces')).not.toBeVisible();
  click('Hookload Calculations'); expect(screen.getByLabelText('Draft jarForces')).toHaveValue('100');
  click('Maximise Hookload Calculations'); expect(saved().find(w => w.type === 'jarForces').maximized).toBe(true);
  click('Restore Hookload Calculations'); click('Close Hookload Calculations'); click('Hookload Calculations');
  expect(screen.getByLabelText('Draft jarForces')).toHaveValue('100');
});
test('move and resize persist, arrangements and reset do not clear engineering drafts', () => {
  render(<Workspace bha={{ rows: [] }} />);
  fireEvent.click(screen.getAllByLabelText('Simulate move')[0]); fireEvent.click(screen.getAllByLabelText('Simulate resize')[0]);
  expect(saved()[0]).toMatchObject({ x: 80, y: 90, width: 750, height: 550 });
  click('Hookload Calculations'); fireEvent.change(screen.getByLabelText('Draft jarForces'), { target: { value: 'retained' } });
  ['Grid', 'Side by Side', 'Reset Layout'].forEach(mode => { click('Arrange Windows'); click(mode); });
  click('Hookload Calculations'); expect(screen.getByLabelText('Draft jarForces')).toHaveValue('retained');
});
test('saved layouts reload and multiple BHAs retain independent windows with no BHA mutation', () => {
  const a = { id: 'a', rows: [] }, b = { id: 'b', rows: [] }, before = JSON.stringify([a, b]);
  const view = render(<Workspace bha={a} />); click('Hookload Calculations'); click('Minimise Hookload Calculations');
  view.rerender(<Workspace bha={b} />); click('Survey');
  view.rerender(<Workspace bha={a} />); expect(screen.getByLabelText('Draft jarForces')).not.toBeVisible();
  click('Hookload Calculations'); expect(screen.getByLabelText('Draft jarForces')).toBeVisible();
  view.unmount(); render(<Workspace bha={a} />); expect(screen.getByLabelText('Draft jarForces')).toBeVisible();
  expect(JSON.stringify([a, b])).toBe(before);
});
test('developer windows cannot appear from saved layout until explicitly enabled', () => {
  localStorage.setItem(FLOAT_KEY, JSON.stringify({ version: 1, workspaces: { a: [{ type: 'bhaSummary', visible: true }] } }));
  const view = render(<Workspace bha={{ id: 'a' }} />);
  expect(screen.queryByRole('button', { name: 'BHA Summary', exact: true })).not.toBeInTheDocument();
  expect(screen.getByTestId('bhaSummary')).not.toBeVisible();
  view.rerender(<Workspace bha={{ id: 'a' }} developerPanels />); click('BHA Summary'); expect(screen.getByTestId('bhaSummary')).toBeVisible();
});
test('first save carries the draft layout and shared depth changes reach mounted modules', () => {
  const rows = [{ category: 'DP', lengthMode: 'auto', length: 1000, weight: 20, od: 5.5 }];
  const view = render(<Workspace bha={{ rows, drillpipeReferenceBitMdFt: 12000 }} />);
  click('Hookload Calculations');
  fireEvent.change(screen.getByLabelText('Draft jarForces'), { target: { value: 'preserved on save' } });
  expect(screen.getByTestId('jarForces')).toHaveTextContent('12000');
  view.rerender(<Workspace bha={{ id: 'first-save', rows, drillpipeReferenceBitMdFt: 12000 }} />);
  expect(saved('first-save').find(w => w.type === 'jarForces').visible).toBe(true);
  click('Hookload Calculations');
  expect(screen.getByLabelText('Draft jarForces')).toHaveValue('preserved on save');
  view.rerender(<Workspace bha={{ id: 'first-save', rows, drillpipeReferenceBitMdFt: 9000 }} />);
  expect(screen.getByTestId('jarForces')).toHaveTextContent('9000');
});
