import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ConfigurationPlot from './ConfigurationPlot';

const mockPlotProps = [];
let mockGraph = null;
jest.mock('plotly.js', () => ({}));
jest.mock('react-plotly.js/factory', () => () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => mockGraph);
    mockPlotProps.push(props);
    return <div data-testid="plot" data-width={props.layout.width} data-height={props.layout.height} data-scroll={props.config.scrollZoom} />;
  });
}, { virtual: true });
beforeEach(() => { mockPlotProps.length = 0; mockGraph = null; });

test('observes parent window resizing and releases observer when closed', () => {
  let resize;
  const disconnect = jest.fn();
  const previous = global.ResizeObserver;
  global.ResizeObserver = jest.fn(callback => { resize = callback; return { observe: jest.fn(), disconnect }; });
  const { unmount, container } = render(<ConfigurationPlot data={[]} layout={{ autosize: true }} />);
  const host = container.firstChild;
  expect(screen.queryByTestId('plot')).not.toBeInTheDocument();
  Object.defineProperty(host, 'clientWidth', { value: 700, configurable: true });
  act(() => resize());
  expect(screen.getByTestId('plot')).toHaveAttribute('data-width', '700');
  Object.defineProperty(host, 'clientWidth', { value: 320, configurable: true });
  act(() => resize());
  expect(screen.getByTestId('plot')).toHaveAttribute('data-width', '320');
  expect(screen.getByTestId('plot')).toHaveAttribute('data-height', '380');
  expect(screen.getByTestId('plot')).toHaveAttribute('data-scroll', 'true');
  unmount();
  expect(disconnect).toHaveBeenCalled();
  global.ResizeObserver = previous;
});

test('3D uses a 600-px plot while preserving width resizing and zoom', () => {
  const { container } = render(<ConfigurationPlot data={[]} layout={{ scene: { xaxis: {} } }} />);
  Object.defineProperty(container.firstChild, 'clientWidth', { value: 700 });
  act(() => window.dispatchEvent(new Event('resize')));
  expect(screen.getByTestId('plot')).toHaveAttribute('data-height', '600');
  expect(screen.getByTestId('plot')).toHaveAttribute('data-scroll', 'true');
});

test('workspace rerenders keep figure references stable and use one resize path', () => {
  const data = [{ type: 'mesh3d', x: [1, 2, 3] }];
  const layout = { scene: { camera: { eye: { x: 1, y: -1, z: 1 } } }, uirevision: 1 };
  const { container, rerender } = render(<ConfigurationPlot data={data} layout={layout} />);
  Object.defineProperty(container.firstChild, 'clientWidth', { value: 700, configurable: true });
  act(() => window.dispatchEvent(new Event('resize')));
  const first = mockPlotProps[mockPlotProps.length - 1];
  expect(first.layout.width).toBe(700);
  expect(first.useResizeHandler).toBeUndefined();
  expect(first.config.responsive).toBeUndefined();
  // Plotly can mutate the camera after rotation; unrelated parent renders
  // must not replace the figure or reset it to the default view.
  first.layout.scene.camera.eye = { x: 2, y: -2, z: 2 };
  rerender(<ConfigurationPlot data={data} layout={layout} />);
  const unchanged = mockPlotProps[mockPlotProps.length - 1];
  expect(unchanged.data).toBe(first.data);
  expect(unchanged.layout).toBe(first.layout);
  expect(unchanged.config).toBe(first.config);
  expect(unchanged.style).toBe(first.style);
  Object.defineProperty(container.firstChild, 'clientWidth', { value: 500, configurable: true });
  act(() => window.dispatchEvent(new Event('resize')));
  const resized = mockPlotProps[mockPlotProps.length - 1];
  expect(resized.layout.width).toBe(500);
  expect(resized.layout).not.toBe(first.layout);
  expect(resized.layout.scene.camera).toBe(first.layout.scene.camera);
  expect(resized.layout.uirevision).toBe(1);
  expect(resized.config).toBe(first.config);
});

test('metric and size updates preserve live camera including wheel zoom; a new run resets it', () => {
  const liveCamera = { eye: { x: 0.4, y: -1.4, z: 0.98 }, up: { x: 0, y: 0, z: 1 }, center: { x: 0, y: 0, z: 0 } };
  mockGraph = { layout: { uirevision: 1 }, _fullLayout: { scene: { _scene: { getCamera: () => liveCamera } } } };
  const data = [];
  const initial = { scene: { camera: { eye: { x: 1, y: -1, z: 1 } } }, uirevision: 1 };
  const { container, rerender } = render(<ConfigurationPlot data={data} layout={initial} />);
  Object.defineProperty(container.firstChild, 'clientWidth', { value: 700, configurable: true });
  act(() => window.dispatchEvent(new Event('resize')));
  rerender(<ConfigurationPlot data={data} layout={{ ...initial, scene: { ...initial.scene, zaxis: { title: 'Force' } } }} />);
  expect(mockPlotProps[mockPlotProps.length - 1].layout.scene.camera).toEqual(liveCamera);
  Object.defineProperty(container.firstChild, 'clientWidth', { value: 500, configurable: true });
  act(() => window.dispatchEvent(new Event('resize')));
  expect(mockPlotProps[mockPlotProps.length - 1].layout.scene.camera).toEqual(liveCamera);
  rerender(<ConfigurationPlot data={data} layout={{ ...initial, uirevision: 2 }} />);
  expect(mockPlotProps[mockPlotProps.length - 1].layout.scene.camera).toEqual(initial.scene.camera);
});
