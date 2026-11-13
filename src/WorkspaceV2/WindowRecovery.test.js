import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Workspace from './Workspace';
import { FLOAT_KEY, projectWindow, recoverFloatingWindow, visibleWorkspaceViewport } from './floatingLayout';
jest.mock('./Widget', () => props => <div data-testid={props.widget.type}>{props.widget.type}</div>);
jest.mock('react-rnd', () => ({ Rnd: props => <div style={props.style} data-testid="window-frame" data-position={JSON.stringify(props.position)} data-size={JSON.stringify(props.size)} onMouseDown={props.onMouseDown}>{props.children}</div> }));

const other = { id: 'analysisInputs1', type: 'analysisInputs', x: 10, y: 20, width: 400, height: 300, visible: true, minimized: false, maximized: false, z: 3000 };
const bad = type => ({ id: `saved-${type}`, type, x: 9000, y: 9000, width: 720, height: 500, visible: false, minimized: true, maximized: false, z: 2 });
const seed = windows => localStorage.setItem(FLOAT_KEY, JSON.stringify({ version: 1, workspaces: { recovery: windows, untouched: [other] } }));
const saved = () => JSON.parse(localStorage.getItem(FLOAT_KEY));
const click = name => fireEvent.click(screen.getByRole('button', { name, exact: true }));
beforeEach(() => {
  localStorage.clear(); window.innerWidth = 1224; window.innerHeight = 700;
  global.ResizeObserver = class { observe() {} disconnect() {} };
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList.contains('wbFloatingCanvas') ? { left: 224, top: 200, width: 1000, height: 800 } : { left: 0, top: 0, width: 0, height: 0 };
  });
});
afterEach(() => jest.restoreAllMocks());

test.each([['survey', 'Survey'], ['engineeringString', 'Engineering String'], ['jarForces', 'Hookload Calculations'], ['jarPlacement', 'Impact & Impulse']])('sidebar restores/focuses off-screen %s without changing any unrelated layout record', (type, title) => {
  const source = bad(type); seed([other, source]); const originalOtherWorkspace = JSON.stringify(saved().workspaces.untouched);
  render(<Workspace bha={{ id: 'recovery', rows: [] }} />); expect(saved().workspaces.recovery.find(w => w.type === type)).toEqual(source);
  click(title); const w = saved().workspaces.recovery.find(w => w.type === type);
  expect(w).toMatchObject({ id: source.id, visible: true, minimized: false, x: 280, y: 0, width: 720, height: 500 });
  expect(w.z).toBeGreaterThan(other.z); expect(screen.getAllByLabelText(`${title} window`)).toHaveLength(1);
  expect(screen.getByLabelText(`${title} window`)).toBeVisible();
  expect(saved().workspaces.recovery.find(w => w.type === other.type)).toEqual(other); expect(JSON.stringify(saved().workspaces.untouched)).toBe(originalOtherWorkspace);
  click(`Minimise ${title}`); expect(screen.getByLabelText(`${title} window`)).not.toBeVisible();
  click(title); expect(screen.getByLabelText(`${title} window`)).toBeVisible(); expect(saved().workspaces.recovery.find(w => w.type === type).minimized).toBe(false);
  click(`Close ${title}`); click(title); expect(screen.getAllByLabelText(`${title} window`)).toHaveLength(1);
});

test('Survey registration is launchable when absent from a partial restored layout', () => {
  seed([other]); render(<Workspace bha={{ id: 'recovery', rows: [] }} />); click('Survey');
  expect(screen.getByTestId('survey')).toBeVisible(); expect(saved().workspaces.recovery.find(w => w.type === 'survey').visible).toBe(true);
  expect(saved().workspaces.recovery.find(w => w.type === other.type)).toEqual(other);
});

test('visible bounds account for canvas clipping and page scrolling, preserving preferred geometry until an explicit recovery', () => {
  const viewport = visibleWorkspaceViewport({ left: -50, top: -100, width: 1000, height: 800 }, 900, 600, { width: 1000, height: 800 });
  expect(viewport).toEqual({ width: 950, height: 700, minX: 50, minY: 100 });
  const original = { ...bad('survey'), x: -999, y: -999, width: 500, height: 400 };
  expect(recoverFloatingWindow(original, viewport)).toMatchObject({ x: 50, y: 100, width: 500, height: 400 }); expect(original.x).toBe(-999);
  expect(projectWindow({ ...original, maximized: true }, viewport.width, viewport.height, viewport.minX, viewport.minY)).toEqual({ x: 50, y: 100, width: 900, height: 600 });
});
