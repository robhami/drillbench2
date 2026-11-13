import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Workspace from './DockingWorkspace';
import { DOCK_KEY, LEGACY_KEY } from './dockingLayout';

jest.mock('./Widget', () => props => {
  const React = require('react');
  const [draft, setDraft] = React.useState('');
  return <div data-testid={props.widget.type}><span>{props.bha?.name}</span>
    <input aria-label={`Draft ${props.widget.type}`} value={draft} onChange={e => setDraft(e.target.value)} />
    <span data-testid={`depth-${props.widget.type}`}>{props.analysisBitMdFt}</span>
  </div>;
});
class Observer { observe() {} unobserve() {} disconnect() {} }
beforeEach(() => { localStorage.clear(); global.ResizeObserver = Observer; window.innerWidth = 1600; });
afterEach(async () => { await act(async () => { await Promise.resolve(); }); });
const open = title => fireEvent.click(screen.getByRole('button', { name: title, exact: true }));
const saved = id => JSON.parse(localStorage.getItem(DOCK_KEY)).workspaces[id || 'draft'];

test('opens tabs without duplicates and preserves local state through floating and docking', () => {
  render(<Workspace bha={{ rows: [] }} />);
  open('Hookload Calculations');
  fireEvent.change(screen.getByLabelText('Draft jarForces'), { target: { value: 'retained target' } });
  open('Hookload Calculations');
  expect(screen.getAllByTestId('jarForces')).toHaveLength(1);
  open('Pop Out Hookload Calculations');
  expect(saved().desktop.floatingGroups).toHaveLength(1);
  expect(screen.getByLabelText('Draft jarForces')).toHaveValue('retained target');
  open('Dock Back Hookload Calculations');
  expect(saved().desktop.floatingGroups || []).toHaveLength(0);
  expect(screen.getByLabelText('Draft jarForces')).toHaveValue('retained target');
});

test('saved layouts restore IDs and each BHA workspace keeps its own open tabs and engineering data', () => {
  const a = { id: 'A', name: 'Well A', rows: [] }, b = { id: 'B', name: 'Well B', rows: [] };
  const before = JSON.stringify([a, b]);
  const view = render(<Workspace bha={a} />);
  open('Hookload Calculations');
  view.rerender(<Workspace bha={b} />);
  open('Survey');
  expect(saved('B').desktop.panels.survey1).toBeDefined();
  view.rerender(<Workspace bha={a} />);
  expect(screen.getByTestId('jarForces')).toBeInTheDocument();
  expect(screen.queryByTestId('survey')).not.toBeInTheDocument();
  expect(JSON.stringify([a, b])).toBe(before);
  view.unmount(); render(<Workspace bha={a} />);
  expect(screen.getByTestId('jarForces')).toBeInTheDocument();
});

test('legacy floating records are migrated without overwriting legacy data; developer panels stay gated', () => {
  const legacy = JSON.stringify([{ id: 'custom-bha', type: 'bhaEntry', visible: true, x: 45, y: 55, width: 760, height: 520 },
    { id: 'custom-dev', type: 'engineeringResults', visible: true, x: 80, y: 90, width: 620, height: 430 }]);
  localStorage.setItem(LEGACY_KEY, legacy);
  const view = render(<Workspace bha={{ rows: [] }} />);
  expect(screen.queryByTestId('engineeringResults')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Engineering Results' })).not.toBeInTheDocument();
  view.rerender(<Workspace bha={{ rows: [] }} developerPanels />);
  expect(screen.getByTestId('engineeringResults')).toBeInTheDocument();
  open('Save layout');
  expect(saved().desktop.panels['custom-bha']).toBeDefined();
  expect(localStorage.getItem(LEGACY_KEY)).toBe(legacy);
});

test('panel context tracks shared depth without modifying BHA lengths', () => {
  const rows = [{ category: 'DC', length: 300 }, { category: 'DP', length: 9000, lengthMode: 'auto' }];
  const view = render(<Workspace bha={{ rows, drillpipeReferenceBitMdFt: 12000 }} />);
  expect(screen.getByTestId('depth-analysisInputs')).toHaveTextContent('12000');
  view.rerender(<Workspace bha={{ rows, drillpipeReferenceBitMdFt: 10000 }} />);
  expect(screen.getByTestId('depth-analysisInputs')).toHaveTextContent('10000');
  expect(rows[1].length).toBe(9000);
});

test('sidebar collapses with accessible labels and reset never opens all analyses', () => {
  render(<Workspace bha={{ rows: [] }} />);
  open('Collapse sidebar'); expect(document.querySelector('.wbHybrid')).toHaveClass('wbRailCollapsed');
  open('Engineering String'); open('Reset layout');
  expect(screen.queryByTestId('engineeringString')).not.toBeInTheDocument();
  expect(Object.keys(saved().desktop.panels)).toHaveLength(2);
  act(() => open('Expand sidebar'));
});

test('tab reordering, docked resize and floating size round-trip through the real library', () => {
  let api;
  render(<Workspace bha={{ rows: [] }} onDockReady={value => { api = value; }} />);
  act(() => api.layout(1400, 850));
  const bha = api.getPanel('bhaEntry1'), parameters = api.getPanel('analysisInputs1');
  act(() => parameters.api.moveTo({ group: bha.group, position: 'center', index: 0 }));
  open('Save layout');
  expect(saved().desktop.grid.root.data[0].data.views).toEqual(['analysisInputs1', 'bhaEntry1']);
  act(() => parameters.api.moveTo({ group: bha.group, position: 'right' }));
  act(() => bha.group.api.setSize({ width: 700 }));
  expect(bha.group.width).toBe(700);
  open('Save layout');
  const docked = saved().desktop;
  expect(docked.grid.root.data).toHaveLength(2);
  act(() => api.addFloatingGroup(bha, { x: 40, y: 70, width: 700, height: 500 }));
  act(() => bha.group.api.setSize({ width: 750, height: 550 }));
  open('Save layout');
  // JSDOM has no floating getBoundingClientRect geometry. Actual pixel movement/
  // resize is checked in Chrome; this verifies placement identity and round-trip.
  expect(saved().desktop.floatingGroups[0].data.views).toEqual(['bhaEntry1']);
});

test('saving a draft BHA retains its current layout under the new saved identity', () => {
  const rows = [{ category: 'DC', length: 300 }];
  const view = render(<Workspace bha={{ name: 'Draft', rows }} />);
  open('Hookload Calculations');
  view.rerender(<Workspace bha={{ id: 'first-save', name: 'Draft', rows }} />);
  expect(saved('first-save').desktop.panels.jarForces1).toBeDefined();
  expect(screen.getByTestId('jarForces')).toBeInTheDocument();
});

test('compact profile reload preserves its own floating placement and the desktop profile', () => {
  const first = render(<Workspace bha={{ id: 'profiles', rows: [] }} />);
  open('Hookload Calculations'); const desktop = saved('profiles').desktop;
  first.unmount(); window.innerWidth = 1024;
  const narrow = render(<Workspace bha={{ id: 'profiles', rows: [] }} />);
  open('Hookload Calculations'); open('Pop Out Hookload Calculations');
  expect(saved('profiles').desktop).toEqual(desktop);
  expect(saved('profiles').compact.floatingGroups).toHaveLength(1);
  narrow.unmount(); render(<Workspace bha={{ id: 'profiles', rows: [] }} />);
  expect(screen.getByRole('button', { name: 'Dock Back Hookload Calculations' })).toBeInTheDocument();
});

test('unsupported layout versions remain recoverable when explicitly reset', () => {
  const raw = JSON.stringify({ version: 99, workspaces: {} });
  localStorage.setItem(DOCK_KEY, raw);
  render(<Workspace bha={{ rows: [] }} />);
  expect(localStorage.getItem(DOCK_KEY)).toBe(raw);
  open('Reset layout');
  expect(localStorage.getItem(`${DOCK_KEY}.recovery`)).toBe(raw);
  expect(JSON.parse(localStorage.getItem(DOCK_KEY)).version).toBe(1);
});

test('Dock Back works when a legacy workspace contains only a floating panel', () => {
  localStorage.setItem(LEGACY_KEY, JSON.stringify([{ id: 'solo', type: 'bhaEntry', visible: true, width: 760, height: 500 }]));
  render(<Workspace bha={{ rows: [] }} />);
  fireEvent.change(screen.getByLabelText('Draft bhaEntry'), { target: { value: 'keep draft' } });
  open('Dock Back BHA Data Entry');
  expect(saved().desktop.floatingGroups || []).toHaveLength(0);
  expect(screen.getByLabelText('Draft bhaEntry')).toHaveValue('keep draft');
});
