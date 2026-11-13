import React from 'react';
import { render, act, screen } from '@testing-library/react';
import App from './App';
import Workspace from './WorkspaceV2/Workspace';
import { analysisDepth } from './engineering/bha/analysisDepth';

jest.mock('./WorkspaceV2/Workspace', () => jest.fn(() => <div>Workspace</div>));

test('Save and Save As preserve incomplete drafts and report row-specific readiness without persisting validation state', () => {
  localStorage.clear(); const ref = React.createRef(); render(<App ref={ref} />);
  const rows = [{ rowId: 'draft', category: 'DC', od: '', weight: '', length: '', selectedToolId: '' }];
  act(() => ref.current.updateBha({ rows })); act(() => ref.current.saveBha());
  expect(ref.current.state.well.savedBhas.at(-1).rows).toEqual(rows);
  expect(screen.getByRole('status')).toHaveTextContent('Draft saved');
  expect(screen.getByRole('status')).toHaveTextContent('Row 1: Select a tool and enter its length.');
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue('Draft copy');
  act(() => ref.current.saveBhaAs()); prompt.mockRestore();
  expect(ref.current.state.well.savedBhas.at(-1).rows).toEqual(rows);
  expect(JSON.parse(localStorage.getItem('drillbenchWell'))).not.toHaveProperty('bhaSaveFeedback');
  act(() => ref.current.updateRow('draft', { od: 6.5, weight: 92, length: 300 }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  act(() => ref.current.saveBha()); expect(ref.current.state.bhaSaveFeedback).toBeNull();
});

test('shared WOB analysis and advanced settings survive Save, Save As, Duplicate and reload independently of current WOB', () => {
  localStorage.clear(); const first = React.createRef(), view = render(<App ref={first} />);
  expect(first.current.state.well.currentBha.wobAnalysis).toMatchObject({ minWobKlbf: '10', maxWobKlbf: '35', samples: '5' });
  const range = { minWobKlbf: '8', maxWobKlbf: '30', samples: '4', source: 'user' }, settings = { increment: '50', avoidance: '64', view: 'compare' };
  act(() => first.current.updateBha({ wob: '12', wobAnalysis: range, neutralPointAnalysis: settings }));
  act(() => first.current.saveBha());
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue('WOB copy');
  act(() => first.current.saveBhaAs()); prompt.mockRestore();
  act(() => first.current.duplicateBha());
  expect(first.current.state.well.savedBhas.every(b => b.wob === '12' && JSON.stringify(b.wobAnalysis) === JSON.stringify(range) && JSON.stringify(b.neutralPointAnalysis) === JSON.stringify(settings))).toBe(true);
  view.unmount(); const second = React.createRef(); render(<App ref={second} />);
  expect(second.current.state.well.currentBha.wobAnalysis).toEqual(range);
  expect(second.current.state.well.currentBha.neutralPointAnalysis).toEqual(settings);
  expect(second.current.state.well.currentBha.wob).toBe('12');
});

test('authoritative Auto MD and Defined depth survive existing workspace save/reload without a second depth field', () => {
  localStorage.clear();
  const bha = { id: 'depth', name: 'Depth', drillpipeReferenceBitMdFt: 12000, rows: [
    { rowId: 'jar', category: 'JAR', length: 20 }, { rowId: 'dp', category: 'DP', length: 8000, lengthMode: 'auto' }
  ] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: bha, savedBhas: [] }));
  const first = React.createRef(); const view = render(<App ref={first} />);
  expect(analysisDepth(first.current.state.well.currentBha).bitMdFt).toBe(12000);
  act(() => first.current.updateRow('dp', { lengthMode: 'manual' }));
  expect(analysisDepth(first.current.state.well.currentBha).bitMdFt).toBe(8020);
  act(() => first.current.saveBha()); view.unmount();
  const second = React.createRef(); render(<App ref={second} />);
  expect(analysisDepth(second.current.state.well.currentBha).bitMdFt).toBe(8020);
  act(() => second.current.updateRow('dp', { lengthMode: 'auto' }));
  expect(analysisDepth(second.current.state.well.currentBha).bitMdFt).toBe(12000);
  expect(second.current.state.well.currentBha.rows[1].length).toBe(8000);
});

test('manufacturer limits persist per jar without changing legacy records or directional settings', () => {
  localStorage.clear();
  const bha = { id: 'manufacturer', name: 'Limits', rows: [
    { rowId: 'one', category: 'JAR', length: 30, weight: 150, jarDirections: { up: { mechanism: 'hydraulic' } } },
    { rowId: 'two', category: 'JAR', length: 30, weight: 150 }
  ] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: bha, savedBhas: [] }));
  const first = React.createRef(); const view = render(<App ref={first} />);
  expect(first.current.state.well.currentBha.rows[1]).not.toHaveProperty('jarManufacturerLimits');
  const limits = { maximumUpwardLoadLbf: '30000', maximumDownwardLoadLbf: '12000', maximumTensileLoadLbf: '90000', tensileLoadBasis: 'jar-centre' };
  act(() => first.current.updateRow('one', { jarManufacturerLimits: limits }));
  act(() => first.current.updateRow('two', { jarManufacturerLimits: { maximumUpwardLoadLbf: '-1' } }));
  act(() => first.current.saveBha()); act(() => first.current.duplicateBha());
  view.unmount();
  const second = React.createRef(); render(<App ref={second} />);
  act(() => second.current.loadBha('manufacturer'));
  expect(second.current.state.well.currentBha.rows[0].jarManufacturerLimits).toEqual(limits);
  expect(second.current.state.well.currentBha.rows[1].jarManufacturerLimits.maximumUpwardLoadLbf).toBe('-1');
  expect(second.current.state.well.currentBha.rows[0].jarDirections).toEqual(bha.rows[0].jarDirections);
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).currentBha.rows[0].jarManufacturerLimits).toEqual(limits);
});

test('Bit Size persists through save, duplicate, reload and loading a legacy BHA', () => {
  localStorage.clear();
  const legacy = { id: 'legacy', name: 'Legacy BHA', rows: [] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: legacy, savedBhas: [legacy] }));
  const first = React.createRef(); const view = render(<App ref={first} />);
  expect(first.current.state.well.currentBha.holeSize).toBe('');
  act(() => first.current.updateBha({ holeSize: '12.25' }));
  act(() => first.current.saveBha());
  act(() => first.current.duplicateBha());
  expect(first.current.state.well.currentBha.holeSize).toBe('12.25');
  view.unmount();
  const second = React.createRef(); render(<App ref={second} />);
  expect(second.current.state.well.currentBha.holeSize).toBe('12.25');
  act(() => second.current.loadBha('legacy'));
  expect(second.current.state.well.currentBha.holeSize).toBe('12.25');
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).savedBhas.find(b => b.id === 'legacy').holeSize).toBe('12.25');
});

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
  expect(second.current.state.well.currentBha).toEqual({ ...bha, surveyState: { version: 1, active: null, history: [], reviewRequired: false } });
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).currentBha).toEqual({ ...bha, surveyState: { version: 1, active: null, history: [], reviewRequired: false } });
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
  expect(first.current.state.well.savedBhas[0]).toEqual({ ...bha, surveyState: { version: 1, active: null, history: [], reviewRequired: false } });
  view.unmount();
  const second = React.createRef(); render(<App ref={second} />);
  expect(second.current.state.well.rigLimits.maximumAllowableHookloadKlbf).toBe('350.123456');
  act(() => second.current.updateRigLimits({ maximumAllowableHookloadKlbf: '' }));
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).rigLimits.maximumAllowableHookloadKlbf).toBe('');
});

test('optional Bit ID survives BHA save, load, duplicate and reload; legacy row without it remains compatible', () => {
  localStorage.clear();
  const bitRow = { rowId: 'bit-row', category: 'BIT', bitId: 'PDC-001', toolName: '8.5 in PDC', selectedToolId: 'spec-8p5', length: '1', od: '8.5', idSize: '.5', weight: '50' };
  const legacy = { id: 'legacy-no-bit-id', name: 'Legacy', rows: [{ rowId: 'dc', category: 'DC', length: '10', od: '6', idSize: '2', weight: '100' }] };
  const current = { id: 'bit-bha', name: 'Bit ID BHA', holeSize: '8.5', rows: [bitRow] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: current, savedBhas: [legacy] }));
  const first = React.createRef(); const view = render(<App ref={first} />);
  expect(first.current.state.well.currentBha.rows[0].bitId).toBe('PDC-001');
  expect(first.current.state.well.savedBhas[0].rows[0]).not.toHaveProperty('bitId');
  act(() => first.current.saveBha());
  expect(first.current.state.well.savedBhas.find(b => b.id === 'bit-bha').rows[0].bitId).toBe('PDC-001');
  act(() => first.current.duplicateBha());
  expect(first.current.state.well.currentBha.rows[0].bitId).toBe('PDC-001');
  view.unmount();
  const second = React.createRef(); render(<App ref={second} />);
  act(() => second.current.loadBha('bit-bha'));
  expect(second.current.state.well.currentBha.rows[0].bitId).toBe('PDC-001');
  act(() => second.current.loadBha('legacy-no-bit-id'));
  expect(second.current.state.well.currentBha.rows[0]).not.toHaveProperty('bitId');
});

test('edited library stabilizer instance properties and original specification survive BHA save/load', () => {
  localStorage.clear();
  const stb = { rowId: 'stb-row', category: 'STB', selectedToolId: 'stb-library-1', toolName: 'Library STB',
    od: '6.25', idSize: '2.25', weight: '82.5', length: '10.5',
    librarySpecification: { od: '6', idSize: '2', weight: '80', length: '10' },
    componentDefinition: { od: '6.25', idSize: '2.25', weight: '82.5', length: '10.5', geometry: { kind: 'uniform', segments: [] } } };
  const current = { id: 'stb-bha', name: 'Edited stabilizer BHA', rows: [stb] };
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: current, savedBhas: [] }));
  const first = React.createRef(); const view = render(<App ref={first} />);
  act(() => first.current.saveBha());
  expect(first.current.state.well.savedBhas[0].rows[0]).toMatchObject({ od: '6.25', idSize: '2.25', weight: '82.5', length: '10.5', librarySpecification: { od: '6', idSize: '2', weight: '80', length: '10' } });
  view.unmount();
  const second = React.createRef(); render(<App ref={second} />);
  act(() => second.current.loadBha('stb-bha'));
  expect(second.current.state.well.currentBha.rows[0]).toMatchObject({ od: '6.25', idSize: '2.25', weight: '82.5', length: '10.5', librarySpecification: { od: '6', idSize: '2', weight: '80', length: '10' } });
});
