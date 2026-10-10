import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Workspace from './Workspace';
import WidgetRegistry from './WidgetRegistry';
import EngineeringStringCard from '../Apps/EngineeringString/EngineeringStringCard';

jest.mock('./Widget', () => {
  const AnalysisInputs = require('../Apps/AnalysisInputs/AnalysisInputs').default;
  return props => <div data-testid={props.widget.type}>
  <span data-testid={`${props.widget.type}-mode`}>{props.drillingMode}</span>
  {props.widget.type === 'analysisInputs' && <AnalysisInputs bha={{ name: '', holeSize: '', mudWeight: '', wob: '' }} updateBha={() => {}} drillingMode={props.drillingMode} setDrillingMode={props.setDrillingMode} />}
  <button onClick={() => props.onClose(props.widget.id)}>Close {props.widget.type}</button>
</div>;
});

const key = 'wellbenchWorkspaceV2';
const savedString = { id: 'custom-string', type: 'engineeringString', x: 90, y: 30, width: 520, height: 400, visible: false, minimized: true, z: 4 };
const other = { id: 'jarPlacement1', type: 'jarPlacement', x: 11, y: 12, width: 580, height: 430, visible: true, minimized: false, z: 8 };
const saved = () => JSON.parse(localStorage.getItem(key));
const open = () => fireEvent.click(screen.getByRole('button', { name: 'String' }));

beforeEach(() => localStorage.clear());

test('only Analysis Inputs controls the shared mode for String and Results', () => {
  render(<Workspace />);
  open();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Analysis' }));
  expect(screen.getAllByRole('combobox')).toHaveLength(1);
  fireEvent.change(screen.getByRole('combobox', { name: 'Drilling Mode' }), { target: { value: 'rotate' } });
  expect(screen.getByTestId('engineeringString-mode')).toHaveTextContent('rotate');
  expect(screen.getByTestId('engineeringResults-mode')).toHaveTextContent('rotate');
  fireEvent.change(screen.getByRole('combobox', { name: 'Drilling Mode' }), { target: { value: 'reference' } });
  expect(screen.getByTestId('engineeringString-mode')).toHaveTextContent('reference');
});

test('Analysis Inputs defaults to 470 px but retains manually saved dimensions', () => {
  const first = render(<Workspace />);
  expect(saved().find(w => w.type === 'analysisInputs').width).toBe(470);
  first.unmount();
  const layout = saved().map(w => w.type === 'analysisInputs' ? { ...w, width: 650, height: 530 } : w);
  localStorage.setItem(key, JSON.stringify(layout));
  render(<Workspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Analysis' }));
  expect(saved().find(w => w.type === 'analysisInputs')).toMatchObject({ width: 650, height: 530 });
});

test('String registry still renders the separate Engineering String component', () => {
  expect(WidgetRegistry.engineeringString.component).toBe(EngineeringStringCard);
  expect(WidgetRegistry.engineeringString.title).toBe('Engineering String');
});

test('Configuration window registers and opens independently without resetting saved layout', () => {
  localStorage.setItem(key, JSON.stringify([other]));
  render(<Workspace />);
  expect(WidgetRegistry.jarConfiguration.title).toBe('Jar Configuration Analysis');
  expect(saved().find(w => w.id === other.id)).toEqual(other);
  expect(screen.queryByTestId('jarConfiguration')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Config' }));
  expect(screen.getByTestId('jarConfiguration')).toBeInTheDocument();
  expect(screen.getByTestId('jarPlacement')).toBeInTheDocument();
  expect(saved().find(w => w.id === other.id)).toEqual(other);
  expect(saved().filter(w => w.type === 'jarConfiguration')).toHaveLength(1);
});

test('adds missing String to an older layout without resetting existing windows', () => {
  localStorage.setItem(key, JSON.stringify([other]));
  render(<Workspace />);
  expect(saved().find(w => w.id === other.id)).toEqual(other);
  expect(saved().filter(w => w.type === 'engineeringString')).toHaveLength(1);
  expect(screen.queryByTestId('engineeringString')).not.toBeInTheDocument();
  open();
  expect(screen.getByTestId('engineeringString')).toBeInTheDocument();
  expect(screen.getByTestId('jarPlacement')).toBeInTheDocument();
  expect(saved().find(w => w.id === other.id)).toEqual(other);
});

test('String navigation restores hidden/minimized window and preserves reachable geometry', () => {
  localStorage.setItem(key, JSON.stringify([other, savedString]));
  render(<Workspace />);
  open();
  const restored = saved().find(w => w.type === 'engineeringString');
  expect(restored).toEqual({ ...savedString, visible: true, minimized: false, z: 9 });
  expect(screen.getByRole('button', { name: 'String' })).toHaveClass('open');
  fireEvent.click(screen.getByRole('button', { name: 'Close engineeringString' }));
  expect(screen.queryByTestId('engineeringString')).not.toBeInTheDocument();
  open();
  expect(screen.getByTestId('engineeringString')).toBeInTheDocument();
  expect(saved().filter(w => w.type === 'engineeringString')).toHaveLength(1);
});

test.each([[5000, 3000], [-400, -200]])('opening an off-canvas String at (%s,%s) recovers it without changing size or other windows', (x, y) => {
  const entry = { ...savedString, x, y, visible: true };
  localStorage.setItem(key, JSON.stringify([other, entry]));
  const { container } = render(<Workspace />);
  const canvas = container.querySelector('.wb2Canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 800 });
  Object.defineProperty(canvas, 'clientHeight', { value: 600 });
  expect(saved().find(w => w.id === entry.id)).toEqual(entry); // No automatic layout reset.
  open();
  const restored = saved().find(w => w.id === entry.id);
  expect(restored.x).toBeGreaterThanOrEqual(0);
  expect(restored.x + restored.width).toBeLessThanOrEqual(800);
  expect(restored.y).toBeGreaterThanOrEqual(0);
  expect(restored.y + restored.height).toBeLessThanOrEqual(600);
  expect(restored.width).toBe(entry.width);
  expect(restored.height).toBe(entry.height);
  expect(saved().find(w => w.id === other.id)).toEqual(other);
});

test('default String is recovered on a small canvas without shrinking its saved size', () => {
  const { container } = render(<Workspace />);
  const canvas = container.querySelector('.wb2Canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 400 });
  Object.defineProperty(canvas, 'clientHeight', { value: 500 });
  open();
  expect(saved().find(w => w.type === 'engineeringString')).toMatchObject({ x: 0, y: 0, width: 520, height: 620, visible: true, minimized: false });
});
