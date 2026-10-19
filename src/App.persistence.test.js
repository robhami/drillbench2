import React from 'react';
import { render, act } from '@testing-library/react';
import App from './App';
import Workspace from './WorkspaceV2/Workspace';

jest.mock('./WorkspaceV2/Workspace', () => jest.fn(() => <div>Workspace</div>));

test.each([undefined, 'auto', 'manual'])('legacy and %s drillpipe metadata survives save, duplicate, reload and load', lengthMode => {
  localStorage.clear();
  const bha = { id: 'original', name: 'DP persistence', holeSize: '', inclination: 0, mudWeight: '', wob: '', drillpipeReferenceBitMdFt: '3320', rows: [{ rowId: 'dp', category: 'DP', length: '11035', weight: '20', ...(lengthMode ? { lengthMode } : {}) }] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: bha, savedBhas: [bha] }));
  const ref = React.createRef();
  const { unmount } = render(<App ref={ref} />);
  expect(ref.current.state.well.currentBha.rows[0]).toEqual(bha.rows[0]);
  act(() => ref.current.saveBha());
  act(() => ref.current.duplicateBha());
  expect(ref.current.state.well.currentBha).toMatchObject({ drillpipeReferenceBitMdFt: '3320', rows: [{ length: '11035', ...(lengthMode ? { lengthMode } : {}) }] });
  unmount();
  const second = React.createRef();
  render(<App ref={second} />);
  act(() => second.current.loadBha('original'));
  expect(second.current.state.well.currentBha).toEqual(bha);
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).currentBha).toEqual(bha);
});


test('directional jar mechanisms, independent trip settings and overridden targets persist through existing save/load', () => {
  localStorage.clear();
  const row = { rowId: 'jar', category: 'JAR', length: 30, weight: 150 };
  const bha = { id: 'directional', name: 'Directional Jar', rows: [row] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: bha, savedBhas: [] }));
  const ref = React.createRef();
  const first = render(<App ref={ref} />);
  const jarDirections = { up: { mechanism: 'mechanical', tripForceKlbf: '30', targetForceKlbf: '25' }, down: { mechanism: 'hydraulic', targetForceKlbf: '8' } };
  act(() => ref.current.updateRow('jar', { jarDirections }));
  act(() => ref.current.saveBha());
  act(() => ref.current.duplicateBha());
  expect(ref.current.state.well.currentBha.rows[0].jarDirections).toEqual(jarDirections);
  first.unmount();
  const second = React.createRef();
  render(<App ref={second} />);
  act(() => second.current.loadBha('directional'));
  expect(second.current.state.well.currentBha.rows[0].jarDirections).toEqual(jarDirections);
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).currentBha.rows[0].jarDirections).toEqual(jarDirections);
  expect(row).not.toHaveProperty('jarDirections');
});


test('rig maximum persists outside BHA and is shared through loading, new BHA and reload', () => {
  localStorage.clear();
  const bha = { id: 'one', name: 'One', rows: [] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: bha, savedBhas: [bha] }));
  const first = React.createRef(); const view = render(<App ref={first} />);
  expect(first.current.state.well.rigLimits.maximumAllowableHookloadKlbf).toBe('');
  act(() => first.current.updateRigLimits({ maximumAllowableHookloadKlbf: '350.123456' }));
  const lastProps = Workspace.mock.calls[Workspace.mock.calls.length - 1][0];
  expect(lastProps.rigLimits.maximumAllowableHookloadKlbf).toBe('350.123456');
  expect(lastProps.updateRigLimits).toBe(first.current.updateRigLimits);
  expect(first.current.state.well.currentBha).not.toHaveProperty('rigLimits');
  act(() => first.current.newBha()); act(() => first.current.loadBha('one'));
  expect(first.current.state.well.rigLimits.maximumAllowableHookloadKlbf).toBe('350.123456');
  expect(first.current.state.well.savedBhas[0]).toEqual(bha);
  view.unmount();
  const second = React.createRef(); render(<App ref={second} />);
  expect(second.current.state.well.rigLimits.maximumAllowableHookloadKlbf).toBe('350.123456');
  act(() => second.current.updateRigLimits({ maximumAllowableHookloadKlbf: '' }));
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).rigLimits.maximumAllowableHookloadKlbf).toBe('');
});
