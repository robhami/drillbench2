import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Plotly from 'plotly.js';
import Survey3DPlot from './Survey3DPlot';
jest.mock('plotly.js', () => ({ react: jest.fn(), purge: jest.fn() }));
let width, resize;
const props = { data: [], layout: { scene: { camera: {} }, uirevision: 'a' } };
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
beforeEach(() => {
  width = 700;
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width, height: width ? 600 : 0 }));
  global.ResizeObserver = class { constructor(cb) { resize = cb; } observe() {} disconnect() {} };
  Plotly.react.mockImplementation(async node => {
    node._fullLayout = { scene: { _scene: { glplot: { gl: { isContextLost: () => false } }, getCamera: () => ({}) } } };
    node.on = jest.fn(); node.removeAllListeners = jest.fn();
  });
});
afterEach(() => jest.restoreAllMocks());
test('waits for nonzero visible size, disposes when hidden and initializes on restore', async () => {
  width = 0;
  render(<Survey3DPlot {...props} />); await settle();
  expect(Plotly.react).not.toHaveBeenCalled();
  width = 700; act(() => resize()); await settle();
  expect(Plotly.react).toHaveBeenCalledTimes(1);
  width = 0; act(() => resize()); await settle();
  expect(Plotly.purge).toHaveBeenCalledTimes(1);
  width = 500; act(() => resize()); await settle();
  expect(Plotly.react).toHaveBeenCalledTimes(2);
});
test('failed context initialization and context loss provide an explicit retry fallback', async () => {
  Plotly.react.mockRejectedValueOnce(new TypeError("Cannot read properties of null (reading 'gl')"));
  const view = render(<Survey3DPlot {...props} />); await settle();
  expect(screen.getByRole('status')).toHaveTextContent('3D trajectory unavailable');
  fireEvent.click(screen.getByText('Retry 3D View')); await settle();
  const node = view.container.firstChild.firstChild;
  fireEvent(node, new Event('webglcontextlost', { bubbles: false, cancelable: true })); await settle();
  expect(screen.getByRole('status')).toHaveTextContent('lost the 3D graphics context');
});
test('serializes unmount disposal after pending initialization; ordinary renders do not recreate a scene', async () => {
  let complete;
  Plotly.react.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const view = render(<StrictMode><Survey3DPlot {...props} /></StrictMode>); await settle();
  expect(Plotly.react).toHaveBeenCalledTimes(1);
  view.rerender(<StrictMode><Survey3DPlot {...props} /></StrictMode>); await settle();
  expect(Plotly.react).toHaveBeenCalledTimes(1);
  Plotly.purge.mockClear(); view.unmount();
  expect(Plotly.purge).not.toHaveBeenCalled();
  await act(async () => complete()); await settle();
  expect(Plotly.purge).toHaveBeenCalledTimes(1);
});
test('replaces Plotly polling recovery before a lost scene can be purged', async () => {
  const view = render(<Survey3DPlot {...props} />); await settle();
  const scene = view.container.firstChild.firstChild._fullLayout.scene._scene;
  act(() => scene.recoverContext()); await settle();
  expect(screen.getByRole('status')).toHaveTextContent('lost the 3D graphics context');
  // An already-held callback cannot schedule recovery after disposal.
  act(() => scene.recoverContext());
  expect(Plotly.purge).toHaveBeenCalledTimes(1);
});
