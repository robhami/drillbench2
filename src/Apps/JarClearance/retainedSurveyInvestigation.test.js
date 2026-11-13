import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../../App';
import Survey, { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';
import AnalysisInputs from '../AnalysisInputs/AnalysisInputs';
import JarClearance from './JarClearance';
import { importedGeometry, clearanceRequest, comparisonClearances, comparisonPlot } from './clearanceData';
import { neutralPointChart } from './neutralPointChart';
import { calcJarClearanceAcrossRun } from '../../engineering/jar/jarClearanceAcrossRun';
import demo from '../../../docs/ValidationStudies/JarPlacementDemoStage5C1.json';
import { createClearanceWorker } from './createClearanceWorker';

jest.mock('../../WorkspaceV2/Workspace', () => () => <div>Workspace</div>);
jest.mock('../Survey/SurveyTrajectory', () => () => <div>Trajectory presentation</div>);
jest.mock('./CurrentDrillingSummary', () => () => null);
jest.mock('../JarConfiguration/ConfigurationPlot', () => () => <div>Plot</div>);
jest.mock('./createClearanceWorker', () => ({ createClearanceWorker: jest.fn() }));

const directional = demo.storage.wellbenchSurveyV1;
const vertical = { originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n10000,0,90', confirmed: true, filename: 'ExplicitVertical10000ft.csv' };
const bha = { ...demo.storage.drillbenchWell.currentBha, id: 'survey-audit', inclination: 0, drillpipeReferenceBitMdFt: 10000,
  wobAnalysis: { minWobKlbf: '35', maxWobKlbf: '35', samples: '1' }, neutralPointAnalysis: { increment: '1000', avoidance: '64' } };
const fields = { start: '1000', end: '10000', increment: '1000', minWob: '35', maxWob: '35', samples: '1', avoidance: '64', mud: '10', friction: '.25', rpm: '150', rop: '60', modes: 'both', surface: '0' };
const request = (source, patch = {}) => clearanceRequest({ ...bha, ...patch }, importedGeometry(source), fields, true).request;
beforeEach(() => { localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(directional)); });

test('New, Save, Save As, workspace switching and scalar inclination edits retain the browser-global survey', () => {
  const ref = React.createRef(); render(<App ref={ref} />);
  const original = localStorage.getItem(SURVEY_STORAGE_KEY);
  act(() => ref.current.updateBha(bha)); act(() => ref.current.saveBha());
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(original);
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue('Survey audit copy');
  act(() => ref.current.saveBhaAs()); prompt.mockRestore();
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(original);
  act(() => ref.current.newBha()); expect(ref.current.state.well.currentBha.inclination).toBe(0);
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(original);
  act(() => ref.current.loadBha('survey-audit'));
  act(() => ref.current.updateBha({ inclination: 60 }));
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(original);
  expect(ref.current.state.well.savedBhas.every(b => !Object.hasOwn(b, 'survey'))).toBe(true);
});

test('UI survey stations and actual worker request agree despite the scalar inclination reading zero; replacement updates both', async () => {
  jest.useFakeTimers(); const previousWorker = global.Worker; global.Worker = jest.fn();
  const requests = []; createClearanceWorker.mockImplementation(() => ({ postMessage: p => requests.push(p.request), terminate() {} }));
  function Harness() {
    const [value, update] = React.useState(bha);
    return <><AnalysisInputs bha={value} updateBha={patch => update(old => ({ ...old, ...patch }))} /><Survey bha={value} /><JarClearance bha={value} /></>;
  }
  try {
    render(<Harness />); await act(async () => { jest.advanceTimersByTime(500); });
    expect(screen.queryByLabelText('Inclination (°)')).not.toBeInTheDocument();
    expect(screen.getByText('Maximum inclination (Â°)').nextElementSibling).toHaveTextContent('60.00');
    expect(requests).toHaveLength(1);
    expect(requests[0].survey.stations.find(s => s.mdFt === 5000).inclinationDeg).toBe(60);
    expect(requests[0].survey.stations.map(s => s.mdFt)).toEqual(importedGeometry(directional).stations.map(s => s.mdFt));
    fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: vertical }));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(requests).toHaveLength(2);
    expect(requests[1].survey.stations).toHaveLength(2);
    expect(requests[1].survey.stations.every(s => s.inclinationDeg === 0)).toBe(true);
    expect(screen.getByText('Maximum inclination (Â°)').nextElementSibling).toHaveTextContent('0.00');
    // Legacy data is now a read-only recovery source; compatibility events do
    // not overwrite it. Managed BHA survey/worker provenance is tested separately.
    expect(JSON.parse(localStorage.getItem(SURVEY_STORAGE_KEY)).originalCsv).toBe(directional.originalCsv);
    fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...vertical, confirmed: false } }));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(requests).toHaveLength(2); // Invalid replacement cannot launch a solver with old geometry.
  } finally { global.Worker = previousWorker; jest.useRealTimers(); }
});

test('full-depth vertical survey gives depth-independent NP and identical Slide/Rotate at fixed WOB against independent statics', () => {
  const result = calcJarClearanceAcrossRun(request(vertical));
  expect(result.invalidScenarios).toBe(0); expect(result.scenarios).toHaveLength(20);
  // Independent piecewise vertical statics: BF=1-10/65.5; 35 klbf exceeds
  // lower STB/DC/jar buoyed weight and crosses in the upper 116-lbf/ft DC.
  const expectedNp = 347.500485399192295744;
  const expectedJarForce = 3135.162213740458;
  for (const scenario of result.scenarios) {
    expect(scenario.neutralPoints).toHaveLength(1);
    expect(scenario.neutralPoints[0].fromBitFt).toBeCloseTo(expectedNp, 7);
    expect(scenario.neutralPoints[0].mdFt).toBeCloseTo(scenario.bitMdFt - expectedNp, 7);
    expect(scenario.jars[0].jarAxialLoadLbf).toBeCloseTo(expectedJarForce, 6);
    expect(scenario.jars[0].signedSeparationFt).toBeCloseTo(320 - expectedNp, 7);
  }
  const series = comparisonClearances(result, request(vertical), .25);
  const plot = neutralPointChart(comparisonPlot(result, request(vertical), 1, series), result, request(vertical), {}, 0, series.map(s => s.selection));
  for (const curve of plot.data.filter(t => t.showlegend)) for (const y of curve.y.filter(Number.isFinite)) expect(y).toBeCloseTo(expectedNp - 320, 7);
});

test('retained directional survey creates depth and mode differences that changing scalar inclination does not remove', () => {
  const zero = calcJarClearanceAcrossRun(request(directional));
  const sixty = calcJarClearanceAcrossRun(request(directional, { inclination: 60 }));
  expect(zero.scenarios.map(s => s.neutralPoints)).toEqual(sixty.scenarios.map(s => s.neutralPoints));
  const point = (depth, mode) => zero.scenarios.find(s => s.bitMdFt === depth && s.mode === mode).neutralPoints[0].fromBitFt;
  expect(point(1000, 'slide')).toBeCloseTo(347.5004853991923, 7);
  expect(point(10000, 'slide')).toBeGreaterThan(point(10000, 'rotate'));
  expect(point(10000, 'rotate')).toBeGreaterThan(point(1000, 'rotate'));
});
