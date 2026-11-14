import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import RealBhaDynamicComparison from './RealBhaDynamicComparison';
import JarUpIterationTable from './JarUpIterationTable';
import { createRealBhaDynamicWorker } from './createRealBhaDynamicWorker';
import { runRealBhaSkeem } from '../../engineering/research/realBhaSkeemComparison';
import { standardComponents } from '../BHAEntry/componentStore';

jest.mock('./createRealBhaDynamicWorker', () => ({ createRealBhaDynamicWorker: jest.fn() }));
jest.mock('./ConfigurationPlot', () => function MockPlot(props) {
  return require('react').createElement('div', { 'data-testid': 'performance-plot', 'data-title': props.layout.title?.text || '', 'data-x-range': JSON.stringify(props.layout.xaxis?.range || []), 'data-series': JSON.stringify(props.data) });
});

const referenceRows = [610.83, 640.83, 670.83].map((position, index) => ({
  scenario: 'Base', movementFt: position - 640.83, jarCentreFt: position, jarToStuckFt: position,
  valid: true, status: 'valid-idealised-research',
  impact: { impactVelocityMS: [4.026028923906896, 4.3047914809231544, 4.3599189896978015][index], initialImpactForceN: [797621.2598553874, 852848.6181606153, 863770.266721166][index] },
  metrics: { peakTensileN: [3228419.6112442403, 3195413.421260871, 3331170.5932215815][index], fixedTensileNs: [37199.97233845926, 33067.63352688327, 28197.943812521688][index] },
  trace: [{ timeS: 0, stuckN: 0 }, { timeS: .04, stuckN: -1000 }]
}));

function acknowledge() {
  fireEvent.click(screen.getByLabelText(/I reviewed the illustrative property assumptions/));
}

test('reference stays visible outside the requested range; incomplete candidates break the curve and are not successes', async () => {
  const rows = [...referenceRows, { scenario: 'Base', candidateId: 'cutoff', movementFt: 19.17,
    jarCentreFt: 660, valid: false, status: 'incomplete', error: 'Processed event budget reached; no complete-result claim.' }];
  render(<JarUpIterationTable fields={{ load: 185000, stroke: 7.5 }} stuck={0} ack rows={rows} complete
    rejected={[]} geometry={{ currentCentreFt: 640.83 }} sweep={{ min: 650, max: 700, increment: 30 }} />);
  expect(screen.getByLabelText('Candidate completion summary')).toHaveTextContent('Original BHA reference: successful');
  expect(screen.getByLabelText('Candidate completion summary')).toHaveTextContent('Successful alternatives: 2/3');
  expect(screen.getByLabelText('Candidate completion summary')).toHaveTextContent('incomplete computational results: 1');
  const plot = await screen.findByTestId('performance-plot');
  expect(JSON.parse(plot.getAttribute('data-x-range'))).toEqual([640.83, 700]);
  const series = JSON.parse(plot.getAttribute('data-series'));
  expect(series.find(s => s.name === 'Current BHA').x).toEqual([640.83]);
  expect(series[0].y[series[0].x.indexOf(660)]).toBeNull();
  expect(series[0].connectgaps).toBe(false);
});

test('simple Mode A sweep submits geometry candidates and preserves the OES reference calculation', async () => {
  const originalBha = JSON.stringify(frozen.workingCopy);
  const worker = { postMessage: jest.fn(), terminate: jest.fn() };
  createRealBhaDynamicWorker.mockReturnValue(worker);
  render(<RealBhaDynamicComparison iterationTable bha={frozen.workingCopy} jarIndex={0} bitMdFt={9318} />);
  expect(screen.getByLabelText('Applied load at jar (lbf)')).toHaveValue(185000);
  expect(screen.getByLabelText('Jar stroke (in)')).toHaveValue(7.5);
  expect(screen.queryByLabelText('Assumed hammer mass (kg)')).not.toBeInTheDocument();
  expect(screen.getByText(/same 0–50 ms post-impact window/)).toBeVisible();
  expect(screen.getByLabelText('Minimum jar position above bit (ft)')).toHaveValue(610.83);
  expect(screen.getByLabelText('Maximum jar position above bit (ft)')).toHaveValue(670.83);
  expect(screen.getByLabelText('Position increment (ft)')).toHaveValue(30);
  expect(screen.queryByLabelText('Stand type')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Engineering Settings / Diagnostics' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load previously reviewed illustrative OES properties' }));
  fireEvent.click(screen.getByRole('button', { name: /Back to Jar Position Analysis/ }));
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(1));
  const request = worker.postMessage.mock.calls[0][0];
  expect(request.model).toBe('non-uniform-skeem');
  expect(request.cases.map(c => c.movementFt)).toEqual([-30, 0, 30]);
  expect(request.settings.localTensionLbf).toBe(185000);
  expect(request.settings.strokeIn).toBe(7.5);
  expect(request.settings.durationS).toBe(.05);
  expect(request.settings.densityKgM3).toBe(7850);
  expect(request.settings.youngsModulusPa).toBe(200e9);
  expect(Object.values(request.settings.equivalents)).toHaveLength(5);
  const areas = Object.values(request.settings.equivalents).map(property => property.areaM2);
  expect(areas.some(area => Math.abs(area - .01871524074046608) < 1e-10)).toBe(true);
  expect(areas).toContain(.01);
  expect(areas.some(area => Math.abs(area - .008107319665559963) < 1e-10)).toBe(true);
  expect(request.cases.filter(candidate => candidate.movementFt !== 0).every(candidate => candidate.bha.rows.length === frozen.workingCopy.rows.length)).toBe(true);
  const current = runRealBhaSkeem({ bha: request.cases.find(candidate => candidate.movementFt === 0).bha, bitMdFt: 9318, jarIndex: 0, settings: request.settings });
  expect(current.valid).toBe(true);
  expect(current.maintainedEngagement.admissible).toBe(true);
  expect(current.impact.impactVelocityMS).toBeCloseTo(4.3047914809231544, 10);
  expect(current.impact.initialImpactForceN).toBeCloseTo(852848.6181606153, 5);
  expect(current.metrics.peakTensileN).toBeCloseTo(3195413.421260871, 5);
  expect(current.metrics.fixedTensileNs).toBeCloseTo(33067.63352688327, 5);
  expect(JSON.stringify(frozen.workingCopy)).toBe(originalBha);
  act(() => { referenceRows.forEach(row => worker.onmessage({ data: { row } })); worker.onmessage({ data: { complete: true } }); });
  const table = screen.getByRole('table', { name: 'Jar Up candidate comparison' });
  expect(within(table).getAllByRole('row')).toHaveLength(4);
  expect(within(table).getByText('725.778')).toBeInTheDocument();
  expect(within(table).getByText('8.36289')).toBeInTheDocument();
  expect(await screen.findAllByTestId('performance-plot')).toHaveLength(1);
  expect(screen.getByTestId('performance-plot')).toHaveAttribute('data-x-range', '[610.83,670.83]');
  fireEvent.change(screen.getByLabelText('Performance metric'), { target: { value: 'impulse' } });
  expect(screen.getByTestId('performance-plot')).toHaveAttribute('data-title', expect.stringContaining('Tensile-only impulse'));
  const maxima = screen.getByRole('group', { name: 'Calculated maxima' });
  expect(maxima).toHaveTextContent('670.830');
  expect(maxima).toHaveTextContent('610.830');
  fireEvent.click(screen.getByRole('button', { name: 'Engineering Settings / Diagnostics' }));
  expect(screen.getByRole('region', { name: 'Engineering settings and diagnostics' })).toBeInTheDocument();
});

test('legacy OES rows without IDs receive calculation-only override keys and keep the loaded BHA unchanged', async () => {
  const worker = { postMessage: jest.fn(), terminate: jest.fn() };
  createRealBhaDynamicWorker.mockReturnValue(worker);
  const legacyBha = JSON.parse(JSON.stringify(frozen.workingCopy));
  legacyBha.rows.forEach(row => { delete row.rowId; });
  const original = JSON.stringify(legacyBha);
  render(<RealBhaDynamicComparison iterationTable bha={legacyBha} jarIndex={0} bitMdFt={9318} />);
  fireEvent.click(screen.getByRole('button', { name: 'Engineering Settings / Diagnostics' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load previously reviewed illustrative OES properties' }));
  fireEvent.click(screen.getByRole('button', { name: /Back to Jar Position Analysis/ }));
  acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(1));
  const request = worker.postMessage.mock.calls[0][0];
  expect(Object.keys(request.settings.equivalents)).toHaveLength(5);
  expect(new Set(Object.keys(request.settings.equivalents)).size).toBe(5);
  expect(request.cases.map(candidate => candidate.bha.rows.filter(row => row.category).every(row => !!row.rowId))).toEqual([true, true, true]);
  expect(JSON.stringify(legacyBha)).toBe(original);
});

test('reviewed OES property loader supplies explicit hypothetical structural area for the 8.5-inch PDC bit', async () => {
  const worker = { postMessage: jest.fn(), terminate: jest.fn() };
  createRealBhaDynamicWorker.mockReturnValue(worker);
  const pdc = standardComponents.find(component => component.id === 'bha-187');
  const bit = { rowId: 'oes-pdc-row', category: 'BIT', selectedToolId: pdc.id, toolName: pdc.name, od: '8.5', idSize: '', weight: '', length: '1', componentDefinition: pdc };
  const bha = { ...frozen.workingCopy, rows: [bit, ...frozen.workingCopy.rows] };
  // jarIndex addresses the filtered jar list, not the BHA row index of the
  // inserted bit. This fixture contains one jar, so its selected index is 0.
  render(<RealBhaDynamicComparison iterationTable bha={bha} jarIndex={0} bitMdFt={9318} />);
  fireEvent.click(screen.getByRole('button', { name: 'Engineering Settings / Diagnostics' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load previously reviewed illustrative OES properties' }));
  expect(screen.getByLabelText(/Row 1 BIT: 8.5-inch PDC Drill Bit — equivalent structural area/)).toHaveValue(Math.PI / 4 * (6 ** 2 - 2.5 ** 2));
  fireEvent.click(screen.getByRole('button', { name: /Back to Jar Position Analysis/ })); acknowledge();
  fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(1));
  const payload = worker.postMessage.mock.calls[0][0], prop = payload.settings.equivalents['oes-pdc-row'];
  expect(prop.areaM2).toBeCloseTo((Math.PI / 4 * (6 ** 2 - 2.5 ** 2)) * .00064516, 12);
  expect(prop.densityKgM3).toBe(7850); expect(prop.youngsModulusPa).toBe(200e9);
  expect(prop.provenance).toBe('Illustrative equivalent PDC bit body based on assumed 6.0-in fishneck OD and 2.5-in bore ID. Not manufacturer specifications or validated dynamic properties.');
  const base = payload.cases.find(candidate => candidate.movementFt === 0);
  const result = runRealBhaSkeem({ bha: base.bha, bitMdFt: 9318, jarIndex: 0, settings: payload.settings });
  expect(result.valid).toBe(true); expect(Number.isFinite(result.metrics.peakTensileN)).toBe(true);
});

test('normal V1 controls contain only position range and preserve the current BHA reference', () => {
  render(<RealBhaDynamicComparison iterationTable bha={frozen.workingCopy} jarIndex={0} bitMdFt={9318} />);
  expect(screen.getByLabelText('Minimum jar position above bit (ft)')).toBeInTheDocument();
  expect(screen.getByLabelText('Maximum jar position above bit (ft)')).toBeInTheDocument();
  expect(screen.getByLabelText('Position increment (ft)')).toBeInTheDocument();
  expect(screen.queryByText(/Stand makeup/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/inventory handling/i)).not.toBeInTheDocument();
  const positioningMethod = screen.getByLabelText('Positioning method');
  expect(within(positioningMethod).getByRole('option', { name: /Mode 2/ })).toBeEnabled();
  expect(within(positioningMethod).getByRole('option', { name: /Mode 1/ })).toBeDisabled();
  expect(within(positioningMethod).getByRole('option', { name: /Mode 3/ })).toBeDisabled();
});

test('CSV export retains the existing filename, schema and declared units', () => {
  const row = { scenario: 'Base', candidateId: 'stage0-current', movementFt: 0, jarCentreFt: 640.83,
    jarToStuckFt: 640.83, totalBhaLengthFt: 9318, drillpipeLengthChangeFt: 0, totalCalculatedWeightLbf: 200000,
    changeInCalculatedWeightLbf: 0, valid: true, impact: { impactVelocityMS: 4.3, initialImpactForceN: 852848 },
    metrics: { peakTensileN: 3195413, fixedTensileNs: 33067 } };
  const NativeBlob = global.Blob;
  const nativeCreate = URL.createObjectURL, nativeRevoke = URL.revokeObjectURL;
  const blobFactory = jest.fn((parts, options) => ({ parts, options }));
  const createUrl = jest.fn(() => 'blob:stage0');
  const revokeUrl = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    expect(this.download).toBe('JarUpPositions.csv');
  });
  jest.useFakeTimers();
  global.Blob = blobFactory;
  URL.createObjectURL = createUrl;
  URL.revokeObjectURL = revokeUrl;
  try {
    render(<JarUpIterationTable fields={{ load: '185000', stroke: '7.5' }} stuck={0} ack rows={[row]} complete
      rejected={[]} planned={1} geometry={{ currentCentreFt: 640.83 }} sweep={{ min: 610.83, max: 670.83, increment: 30 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(blobFactory).toHaveBeenCalledTimes(1);
    expect(blobFactory.mock.calls[0][1]).toEqual({ type: 'text/csv;charset=utf-8' });
    expect(blobFactory.mock.calls[0][0][0]).toContain('Impact velocity (m/s)');
    expect(blobFactory.mock.calls[0][0][0]).toContain('Peak stuck-point tensile force (kip)');
    expect(blobFactory.mock.calls[0][0][0]).toContain('Tensile impulse (kip·s)');
    expect(createUrl).toHaveBeenCalledWith(blobFactory.mock.results[0].value);
    expect(click).toHaveBeenCalledTimes(1);
    jest.runOnlyPendingTimers();
    expect(revokeUrl).toHaveBeenCalledWith('blob:stage0');
  } finally {
    click.mockRestore();
    global.Blob = NativeBlob;
    if (nativeCreate === undefined) delete URL.createObjectURL; else URL.createObjectURL = nativeCreate;
    if (nativeRevoke === undefined) delete URL.revokeObjectURL; else URL.revokeObjectURL = nativeRevoke;
    jest.useRealTimers();
  }
});
