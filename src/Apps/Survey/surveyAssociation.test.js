import React from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import App from '../../App';
import Survey from './Survey';
import AnalysisInputs from '../AnalysisInputs/AnalysisInputs';
import JarClearance from '../JarClearance/JarClearance';
import { createClearanceWorker } from '../JarClearance/createClearanceWorker';
import { archiveSurveys, emptySurveyState, inferTrajectoryMode, migrateSurveyAssociations, readSurveyArchive, replaceSurvey, SURVEY_ARCHIVE_KEY, SURVEY_CHANGED_EVENT, SURVEY_STORAGE_KEY, useActiveSurvey, verticalSurvey, surveyGeometry } from './surveyAssociation';
import demo from '../../../docs/ValidationStudies/JarPlacementDemoStage5C1.json';

jest.mock('../../WorkspaceV2/Workspace', () => () => null);
jest.mock('./SurveyTrajectory', () => () => <div>Trajectory</div>);
jest.mock('../JarClearance/CurrentDrillingSummary', () => () => null);
jest.mock('../JarConfiguration/ConfigurationPlot', () => () => null);
jest.mock('../JarClearance/createClearanceWorker', () => ({ createClearanceWorker: jest.fn() }));
const directional = demo.storage.wellbenchSurveyV1;
const vertical = verticalSurvey(10000);
const state = active => ({ ...emptySurveyState(), active });
const bha = { ...demo.storage.drillbenchWell.currentBha, id: 'association-test', inclination: 0, drillpipeReferenceBitMdFt: 10000,
  wobAnalysis: { minWobKlbf: '35', maxWobKlbf: '35', samples: '1' }, neutralPointAnalysis: { increment: '1000', avoidance: '64' }, surveyState: state(directional) };
beforeEach(() => localStorage.clear());

test('migration preserves every existing record and labels uncertain legacy ownership; repeat migration does not overwrite associations', () => {
  const well = { currentBha: { id: 'a', rows: [] }, savedBhas: [{ id: 'a' }, { id: 'b', surveyState: state(vertical) }, { id: 'c' }] };
  const original = JSON.stringify(well);
  const migrated = migrateSurveyAssociations(well, directional);
  expect(JSON.stringify(well)).toBe(original);
  expect(migrated.currentBha.surveyState.active.originalCsv).toBe(directional.originalCsv);
  expect(migrated.savedBhas[0].surveyState.reviewRequired).toBe(true);
  expect(migrated.savedBhas[1].surveyState.active).toEqual(vertical);
  expect(migrated.savedBhas[0].trajectoryMode).toBe('directional');
  expect(migrated.savedBhas[1].trajectoryMode).toBe('vertical');
  expect(migrated.savedBhas[2].trajectoryMode).toBe('directional');
  expect(migrated.savedBhas[2].surveyState.active.originalCsv).toBe(directional.originalCsv);
  expect(migrateSurveyAssociations(migrated, vertical)).toEqual(migrated);
  expect(migrateSurveyAssociations(well, null).currentBha.surveyState.active).toBeNull();
  expect(surveyGeometry({ ...directional, confirmed: 'true' })).toBeNull(); // Match the worker's strict units gate.
});

test('older BHA trajectory inference honors explicit mode and source provenance', () => {
  expect(inferTrajectoryMode({ trajectoryMode: 'directional', surveyState: state(vertical) })).toBe('directional');
  expect(inferTrajectoryMode({ surveyState: state(vertical) })).toBe('vertical');
  expect(inferTrajectoryMode({ surveyState: state(directional) })).toBe('directional');
  expect(inferTrajectoryMode({ surveyState: { active: { ...vertical, kind: undefined }, history: [], reviewRequired: false } })).toBe('vertical');
  expect(inferTrajectoryMode({ surveyState: emptySurveyState() })).toBe('vertical');
});

test('New, Save, Save As, duplicate, rename, switching and reload preserve separate survey associations and immutable legacy data', () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(directional));
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: { ...bha, surveyState: undefined }, savedBhas: [{ ...bha, surveyState: undefined }] }));
  const ref = React.createRef(), view = render(<App ref={ref} />);
  expect(ref.current.state.well.currentBha.surveyState.reviewRequired).toBe(true);
  act(() => ref.current.updateBha({ surveyState: replaceSurvey(ref.current.state.well.currentBha.surveyState, vertical) }));
  act(() => ref.current.saveBha());
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue('Vertical copy');
  act(() => ref.current.saveBhaAs());
  const copyId = ref.current.state.well.currentBha.id;
  prompt.mockReturnValue('Renamed vertical copy'); act(() => ref.current.renameBha()); prompt.mockRestore();
  expect(ref.current.state.well.savedBhas.find(b => b.id === copyId).surveyState.active).toEqual(vertical);
  act(() => ref.current.updateBha({ surveyState: replaceSurvey(ref.current.state.well.currentBha.surveyState, directional) }));
  act(() => ref.current.saveBha());
  act(() => ref.current.newBha());
  expect(ref.current.state.well.currentBha.surveyState.active).toBeNull();
  act(() => ref.current.loadBha(bha.id));
  expect(ref.current.state.well.currentBha.surveyState.active).toEqual(vertical);
  act(() => ref.current.duplicateBha());
  expect(ref.current.state.well.currentBha.surveyState.active).toEqual(vertical);
  act(() => ref.current.loadBha(copyId));
  expect(ref.current.state.well.currentBha.surveyState.active).toEqual(directional);
  view.unmount(); const next = React.createRef(); render(<App ref={next} />);
  expect(next.current.state.well.currentBha.surveyState.active).toEqual(directional);
  act(() => next.current.loadBha(bha.id));
  expect(next.current.state.well.currentBha.surveyState.active).toEqual(vertical);
  expect(JSON.parse(localStorage.getItem(SURVEY_STORAGE_KEY))).toEqual(directional);
});

test('managed empty and associated surveys ignore global survey events; BHA switch changes the source synchronously', () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(directional));
  const Probe = ({ value }) => <output>{useActiveSurvey(value)?.filename || 'None'}</output>;
  const view = render(<Probe value={{ surveyState: emptySurveyState() }} />);
  expect(screen.getByText('None')).toBeInTheDocument();
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: directional }));
  expect(screen.getByText('None')).toBeInTheDocument();
  view.rerender(<Probe value={{ surveyState: state(vertical) }} />);
  expect(screen.getByText(vertical.filename)).toBeInTheDocument();
});

test('unit confirmation alone does not confirm uncertain legacy survey ownership', () => {
  const update = jest.fn();
  render(<Survey bha={{ ...bha, surveyState: { ...state(directional), reviewRequired: true } }} updateBha={update} />);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(update.mock.calls[0][0].surveyState.reviewRequired).toBe(true);
  fireEvent.click(screen.getByText('Confirm survey association'));
  expect(update.mock.calls[1][0].surveyState.reviewRequired).toBe(false);
});

test('vertical source covers the exact current bit MD without rounding and rejects invalid extents', () => {
  expect(verticalSurvey(10000.125).originalCsv).toBe('MD,Inclination,Azimuth\n0,0,0\n10000.125,0,0');
  [0, -1, NaN, Infinity, '10000'].forEach(value => expect(() => verticalSurvey(value)).toThrow());
});

test('archive retains original CSV/units and previous surveys; quota or corrupt archive cannot silently replace recovery data', () => {
  archiveSurveys([directional, vertical], bha); archiveSurveys([directional], bha);
  expect(readSurveyArchive().map(r => r.source)).toEqual([directional, vertical]);
  localStorage.setItem(SURVEY_ARCHIVE_KEY, '{broken');
  expect(() => archiveSurveys([vertical], bha)).toThrow();
  expect(localStorage.getItem(SURVEY_ARCHIVE_KEY)).toBe('{broken');
});

test('directional replacement requires confirmation, updates all UI and worker stations, and supports explicit restoration', async () => {
  jest.useFakeTimers(); const oldWorker = global.Worker; global.Worker = jest.fn();
  const requests = []; createClearanceWorker.mockImplementation(() => ({ postMessage: p => requests.push(p.request), terminate() {} }));
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  function Harness() {
    const [value, set] = React.useState(bha);
    return <><AnalysisInputs bha={value} updateBha={patch => set(old => ({ ...old, ...patch }))} />
      <Survey bha={value} updateBha={patch => set(old => ({ ...old, ...patch }))} /><JarClearance bha={value} /></>;
  }
  try {
    render(<Harness />); await act(async () => { jest.advanceTimersByTime(500); });
    expect(requests).toHaveLength(1);
    expect(requests[0].survey.stations.find(s => s.mdFt === 5000).inclinationDeg).toBe(60);
    fireEvent.click(screen.getByText('Replace with Vertical Survey'));
    expect(requests).toHaveLength(1); expect(confirm).toHaveBeenCalled();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByText('Replace with Vertical Survey'));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(requests).toHaveLength(2);
    expect(requests[1].survey.stations.map(s => [s.mdFt, s.inclinationDeg, s.azimuthDeg])).toEqual([[0, 0, 0], [10000, 0, 0]]);
    expect(screen.getAllByLabelText('Active survey').every(node => node.textContent.includes('Type: Vertical'))).toBe(true);
    const table = document.querySelector('.surveyTable');
    expect([...table.querySelectorAll('tbody tr')].map(r => [1, 2, 3].map(i => Number(r.cells[i].textContent)))).toEqual([[0, 0, 0], [10000, 0, 0]]);
    expect(screen.queryByLabelText('Inclination (°)')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Preserved survey'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Restore selected survey'));
    await act(async () => { jest.advanceTimersByTime(500); }); expect(requests).toHaveLength(3);
    expect(requests[2].survey.stations.find(s => s.mdFt === 5000).inclinationDeg).toBe(60);
    expect(readSurveyArchive().some(r => r.source.originalCsv === directional.originalCsv)).toBe(true);
  } finally { confirm.mockRestore(); global.Worker = oldWorker; jest.useRealTimers(); }
});

test('failed recovery storage blocks replacement and retains the active directional source', () => {
  localStorage.setItem(SURVEY_ARCHIVE_KEY, 'not valid JSON');
  const update = jest.fn(), confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<Survey bha={bha} updateBha={update} />);
  fireEvent.click(screen.getByText('Replace with Vertical Survey'));
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('replacement was not applied');
  expect(within(screen.getByLabelText('Active survey')).getByText(/Type: Directional/)).toBeInTheDocument();
  confirm.mockRestore();
});

test('a workspace storage failure is visible without overwriting stored BHA/survey data and Save can retry', () => {
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: bha, savedBhas: [bha] }));
  const original = localStorage.getItem('drillbenchWell');
  const set = Storage.prototype.setItem;
  const fail = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
    if (key === 'drillbenchWell') throw new Error('Quota exceeded');
    return set.call(this, key, value);
  });
  const ref = React.createRef(); render(<App ref={ref} />);
  expect(screen.getByRole('alert')).toHaveTextContent('session-only');
  expect(localStorage.getItem('drillbenchWell')).toBe(original);
  fail.mockRestore(); act(() => ref.current.saveBha());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('drillbenchWell')).currentBha.surveyState.active).toEqual(directional);
});

test('a CSV import updates only its owning BHA and is retained in the recovery archive', async () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(directional));
  function Harness() {
    const [value, set] = React.useState({ ...bha, surveyState: emptySurveyState() });
    return <><Survey bha={value} updateBha={patch => set(old => ({ ...old, ...patch }))} />
      <output data-testid="association">{JSON.stringify(value.surveyState)}</output></>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Survey CSV'), { target: { files: [new File([vertical.originalCsv], 'my-vertical.csv')] } });
  await waitFor(() => expect(JSON.parse(screen.getByTestId('association').textContent).active.filename).toBe('my-vertical.csv'));
  expect(screen.getByLabelText('Active survey')).toHaveTextContent('Type: Vertical');
  expect(readSurveyArchive().some(record => record.source.filename === 'my-vertical.csv')).toBe(true);
  expect(JSON.parse(localStorage.getItem(SURVEY_STORAGE_KEY))).toEqual(directional);
});

test('a delayed CSV read cannot replace the survey after switching BHA', () => {
  const Original = global.FileReader;
  let reader;
  global.FileReader = class { constructor() { reader = this; } readAsText() {} };
  try {
    const update = jest.fn();
    const view = render(<Survey bha={bha} updateBha={update} />);
    fireEvent.change(screen.getByLabelText('Survey CSV'), { target: { files: [{ name: 'late.csv', size: 1 }] } });
    view.rerender(<Survey bha={{ ...bha, id: 'other', surveyState: state(vertical) }} updateBha={update} />);
    act(() => { reader.result = directional.originalCsv; reader.onload(); });
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Active survey')).toHaveTextContent('Type: Vertical');
  } finally { global.FileReader = Original; }
});
