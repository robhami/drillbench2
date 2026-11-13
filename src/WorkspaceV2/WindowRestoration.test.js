import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Workspace from './Workspace';
import Registry from './WidgetRegistry';
import { FLOAT_KEY, MODULES, arrangeWindows, projectWindow } from './floatingLayout';

jest.mock('./Widget', () => props => {
  const React = require('react'), [draft, setDraft] = React.useState('');
  return <input aria-label={`Draft ${props.widget.type}`} value={draft} onChange={e => setDraft(e.target.value)} />;
});
jest.mock('react-rnd', () => ({ Rnd: props => <div style={props.style} data-testid="frame" data-position={JSON.stringify(props.position)} data-size={JSON.stringify(props.size)} onMouseDown={props.onMouseDown}>{props.children}</div> }));
const record = (type, patch = {}) => ({ id: `${type}1`, type, x: 9000, y: -9000, width: 720, height: 500, visible: true, minimized: true, maximized: false, z: 2, ...patch });
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
const frameFor = title => screen.getAllByTestId('frame').find(frame => within(frame).queryByLabelText(`${title} window`));
const saved = key => JSON.parse(localStorage.getItem(FLOAT_KEY)).workspaces[key];
const seed = workspaces => localStorage.setItem(FLOAT_KEY, JSON.stringify({ version: 1, workspaces }));
let rect;
beforeEach(() => {
  localStorage.clear(); window.innerWidth = 1224; window.innerHeight = 700;
  rect = { left: 224, top: 200, width: 1000, height: 800 };
  global.ResizeObserver = class { observe() {} disconnect() {} };
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList.contains('wbFloatingCanvas') ? rect : { left: 0, top: 0, width: 0, height: 0 };
  });
});
afterEach(() => jest.restoreAllMocks());

test.each(MODULES.map(([type]) => [type, Registry[type].title]))('%s restores from a minimized-on-load record and survives every window operation', (type, title) => {
  const otherType = type === 'analysisInputs' ? 'bhaEntry' : 'analysisInputs';
  const other = record(otherType, { x: 0, y: 0, minimized: false, z: 1000 });
  seed({ a: [record(type), other], untouched: [other] });
  render(<Workspace bha={{ id: 'a', rows: [] }} developerPanels />);
  const window = screen.getByLabelText(`${title} window`), frame = frameFor(title);
  expect(window).not.toBeVisible(); expect(frame).not.toHaveStyle('display: none');
  expect(window).toHaveAttribute('aria-hidden', 'true');
  click(title);
  expect(window).toBeVisible(); expect(window).not.toHaveAttribute('aria-hidden');
  expect(saved('a').find(w => w.type === type)).toMatchObject({ visible: true, minimized: false, x: 280, y: 0 });
  expect(saved('a').find(w => w.type === type).z).toBeGreaterThan(1000);
  fireEvent.change(screen.getByLabelText(`Draft ${type}`), { target: { value: 'unsaved contents' } });
  click(`Minimise ${title}`); expect(window).not.toBeVisible(); click(title); expect(window).toBeVisible();
  click(`Maximise ${title}`); click(`Restore ${title}`);
  click(`Close ${title}`); expect(window).not.toBeVisible(); click(title);
  expect(screen.getAllByLabelText(`${title} window`)).toHaveLength(1);
  expect(screen.getByLabelText(`Draft ${type}`)).toHaveValue('unsaved contents');
  click(Registry[otherType].title); click(title);
  expect(saved('a').find(w => w.type === type).z).toBe(Math.max(...saved('a').map(w => w.z)));
  expect(saved('untouched')).toEqual([other]);
});

test.each(['Grid', 'Side by Side'])('%s recovers every open minimized/offscreen window without clearing drafts or opening closed ones', mode => {
  const list = MODULES.map(([type], i) => record(type, { visible: i !== 9 }));
  seed({ a: list }); render(<Workspace bha={{ id: 'a', rows: [] }} developerPanels />);
  click('Hookload Calculations'); fireEvent.change(screen.getByLabelText('Draft jarForces'), { target: { value: 'retained' } });
  click('Minimise Hookload Calculations'); click('Arrange Windows'); click(mode);
  const open = saved('a').filter(w => w.visible);
  expect(open).toHaveLength(9); expect(open.every(w => !w.minimized && !w.maximized)).toBe(true);
  for (const w of open) {
    const window = screen.getByLabelText(`${Registry[w.type].title} window`);
    expect(window).toBeVisible();
    const position = JSON.parse(frameFor(Registry[w.type].title).getAttribute('data-position'));
    const size = JSON.parse(frameFor(Registry[w.type].title).getAttribute('data-size'));
    expect(position.x).toBeGreaterThanOrEqual(0); expect(position.y).toBeGreaterThanOrEqual(0);
    expect(position.x + size.width).toBeLessThanOrEqual(1000); expect(position.y + size.height).toBeLessThanOrEqual(500);
  }
  expect(screen.getByLabelText('Draft jarForces')).toHaveValue('retained');
  expect(saved('a').find(w => w.type === 'engineeringResults')).toEqual(list[9]);
});

test('BHA switching preserves independent layout flags; minimized records remain restorable after reload', () => {
  seed({ a: [record('jarForces')], b: [record('survey', { minimized: false })] });
  const a = { id: 'a', rows: [] }, b = { id: 'b', rows: [] }, before = JSON.stringify([a, b]);
  const view = render(<Workspace bha={a} />); click('Hookload Calculations'); click('Minimise Hookload Calculations');
  view.rerender(<Workspace bha={b} />); expect(screen.queryByLabelText('Hookload Calculations window')).not.toBeInTheDocument();
  click('Survey'); view.rerender(<Workspace bha={a} />);
  expect(screen.getByLabelText('Hookload Calculations window')).not.toBeVisible(); click('Hookload Calculations');
  expect(screen.getByLabelText('Hookload Calculations window')).toBeVisible();
  click('Minimise Hookload Calculations'); view.unmount(); render(<Workspace bha={a} />); click('Hookload Calculations');
  expect(screen.getByLabelText('Hookload Calculations window')).toBeVisible(); expect(JSON.stringify([a, b])).toBe(before);
});

test('browser resize and scroll-origin changes reproject windows without rewriting saved geometry', () => {
  seed({ a: [record('jarForces', { x: 700, y: 450, minimized: false })] });
  render(<Workspace bha={{ id: 'a', rows: [] }} />);
  rect = { left: 224, top: -100, width: 1000, height: 800 }; window.innerWidth = 824; window.innerHeight = 400;
  fireEvent(window, new Event('resize')); fireEvent(window, new Event('scroll'));
  const frame = frameFor('Hookload Calculations');
  expect(JSON.parse(frame.getAttribute('data-position'))).toEqual({ x: 0, y: 100 });
  expect(JSON.parse(frame.getAttribute('data-size'))).toEqual({ width: 600, height: 400 });
  expect(localStorage.getItem(FLOAT_KEY)).toContain('"x":700');
  click('Hookload Calculations'); expect(saved('a')[0]).toMatchObject({ x: 0, y: 100, width: 600, height: 400 });
});

test('legacy duplicate IDs do not alias modules; registry types and render keys remain distinct', () => {
  const list = MODULES.map(([type]) => record(type, { id: 'legacy-shared-id' }));
  seed({ a: list }); render(<Workspace bha={{ id: 'a', rows: [] }} developerPanels />);
  for (const [type] of MODULES) { click(Registry[type].title); expect(screen.getByLabelText(`${Registry[type].title} window`)).toBeVisible(); }
  expect(screen.getAllByTestId('frame')).toHaveLength(MODULES.length);
  expect(new Set(saved('a').map(w => w.type)).size).toBe(MODULES.length);
});

test('compact narrow arrangements keep distinct reachable titlebars instead of expanding tiles to overlapping rows', () => {
  const list = MODULES.map(([type]) => record(type));
  const arranged = arrangeWindows(list, 'grid', 350, 700, true);
  const projected = arranged.map(w => projectWindow(w, 350, 700));
  expect(new Set(projected.map(w => `${w.x}:${w.y}`)).size).toBe(10);
  expect(projected.every(w => w.height >= 44 && w.y + w.height <= 700)).toBe(true);
});
