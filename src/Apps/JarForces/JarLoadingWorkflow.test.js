import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import JarForces from './JarForces';
import { solveStaticJarHookload } from '../../engineering/jar/inverseStaticJarLoads';
import { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';

jest.mock('../../engineering/jar/inverseStaticJarLoads', () => {
  const actual = jest.requireActual('../../engineering/jar/inverseStaticJarLoads');
  return { ...actual, solveStaticJarHookload: jest.fn(actual.solveStaticJarHookload) };
});
const jar = id => ({ rowId: id, category: 'JAR', length: 20, weight: 100, od: 6.75,
  jarDirections: { up: { mechanism: 'hydraulic', targetForceKlbf: '20' }, down: { mechanism: 'hydraulic', targetForceKlbf: '5' } } });
const base = { mudWeight: 10, frictionCoefficient: .25, rpm: 150, wob: 10, rop: 60, inclination: 0,
  rows: [jar('one'), { rowId: 'dp', category: 'DP', length: 9999, lengthMode: 'auto', weight: 100, od: 5.5 }] };
const surveySource = angle => ({ confirmed: true, originalCsv: `MD,Inclination,Azimuth\n0,${angle},90\n20000,${angle},90` });
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const solve = () => fireEvent.click(screen.getByRole('button', { name: 'Calculate required hookload' }));
const pending = 'Enter a target force and calculate the required surface hookload.';
const stale = 'Inputs changed — recalculate required hookload.';
const results = () => screen.queryByRole('table', { name: 'Jar Loading Results' });

test('selected trajectory switch invalidates confirmed Jar Loading results', () => {
  const initial = { ...base, trajectoryMode: 'vertical', drillpipeReferenceBitMdFt: 1010,
    surveyState: { version: 1, active: { ...surveySource(0), kind: 'imported' }, history: [] } };
  const view = mount(initial); solve(); expect(results()).toBeInTheDocument();
  view.patch({ trajectoryMode: 'directional' }); expect(results()).not.toBeInTheDocument();
  expect(screen.getByText(stale)).toBeInTheDocument(); expect(initial.surveyState.active.originalCsv).toContain('20000,0,90');
});
function mount(initial = base, extra = {}) {
  let bha = initial, props = { analysisBitMdFt: 1010, rigLimits: { maximumAllowableHookloadKlbf: 120 }, ...extra }, view;
  const panel = () => <JarForces {...props} bha={bha} updateRow={(id, patch) => {
    bha = { ...bha, rows: bha.rows.map(row => row.rowId === id ? { ...row, ...patch } : row) }; view.rerender(panel());
  }} updateRigLimits={patch => { props = { ...props, rigLimits: { ...props.rigLimits, ...patch } }; view.rerender(panel()); }} />;
  view = render(panel());
  return { ...view, patch: (patch, nextProps = {}) => { bha = { ...bha, ...patch }; props = { ...props, ...nextProps }; view.rerender(panel()); } };
}
beforeEach(() => {
  localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(surveySource(0)));
  solveStaticJarHookload.mockClear();
  // CRA resets mock implementations between tests; retain the real engineering calculation.
  solveStaticJarHookload.mockImplementation(jest.requireActual('../../engineering/jar/inverseStaticJarLoads').solveStaticJarHookload);
});

test('initial, explicit successful calculation, changed target, and reload have distinct workflow states', () => {
  const view = mount();
  expect(screen.getByText(pending)).toBeVisible(); expect(results()).toBeNull();
  const button = screen.getByRole('button', { name: 'Calculate required hookload' });
  expect(button).toHaveClass('jarForcesCalculate'); expect(button.closest('form').lastElementChild).toBe(button);
  change('Target Force at Jar (klbf)', '21');
  expect(solveStaticJarHookload).not.toHaveBeenCalled(); expect(screen.getByText(pending)).toBeVisible();
  solve(); expect(within(results()).getByText('105.7 klbf')).toBeVisible();
  expect(solveStaticJarHookload).toHaveBeenCalledTimes(1);
  change('Target Force at Jar (klbf)', '22');
  expect(results()).toBeNull(); expect(screen.getByText(stale)).toBeVisible();
  expect(screen.queryByRole('table', { name: 'Jar Loading Diagnostics' })).not.toBeInTheDocument();
  expect(solveStaticJarHookload).toHaveBeenCalledTimes(1);
  solve(); expect(within(results()).getByText('106.7 klbf')).toBeVisible();
  view.unmount(); mount(); expect(results()).toBeNull(); expect(screen.getByText(pending)).toBeVisible();
});

test.each([
  ['mud', { mudWeight: 12 }, {}], ['friction', { frictionCoefficient: .3 }, {}],
  ['component weight', { rows: [base.rows[0], { ...base.rows[1], weight: 110 }] }, {}],
  ['component length', { rows: [{ ...base.rows[0], length: 30 }, base.rows[1]] }, {}],
  ['depth / deployment', {}, { analysisBitMdFt: 1100 }],
  ['surface reference', {}, { surfaceReferenceMdFt: 10 }],
  ['rotating diagnostic unavailable', { rpm: '' }, {}]
])('%s changes hide stale inverse results without automatically running the solver', (_, patch, props) => {
  const view = mount(); solve(); view.patch(patch, props);
  expect(results()).toBeNull(); expect(screen.getByText(stale)).toBeVisible();
  expect(solveStaticJarHookload).toHaveBeenCalledTimes(1);
});

test('selected direction and selected jar invalidate even for equal targets', () => {
  mount({ ...base, rows: [jar('one'), jar('two'), base.rows[1]] }); solve();
  change('Selected jar', '1'); expect(results()).toBeNull(); expect(screen.getByText(stale)).toBeVisible();
  solve(); change('Jar direction', 'down'); expect(results()).toBeNull(); expect(screen.getByText(stale)).toBeVisible();
  solve(); expect(within(results()).getByText(/Jar Down \(compression\)/)).toBeVisible();
});

test('survey geometry and coverage changes invalidate and never restore an old result on reversal', () => {
  const view = mount(); solve();
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: surveySource(30) }));
  expect(results()).toBeNull(); expect(screen.getByText(stale)).toBeVisible();
  solve(); view.patch({}, { surveyCoverage: { covered: false, message: 'Survey coverage warning: study gap.' } });
  expect(results()).toBeNull(); expect(screen.getByText(/study gap/)).toBeVisible();
  view.patch({}, { surveyCoverage: undefined });
  expect(results()).toBeNull(); expect(screen.getByText(stale)).toBeVisible();
  expect(solveStaticJarHookload).toHaveBeenCalledTimes(2);
});

test('rig and manufacturer limits update comparisons while preserving the existing solved hookload', () => {
  mount(); solve(); const prior = results().textContent;
  change('Maximum Allowable Rig Hookload (klbf)', '100');
  expect(results()).toHaveTextContent(prior); expect(screen.getByText('Exceeds Limit')).toBeVisible();
  change('Maximum upward jar-centre load (lbf)', '18000');
  expect(results()).toHaveTextContent(prior);
  expect(within(screen.getByRole('table', { name: 'Manufacturer Operating Status' })).getByText('Exceeds entered limit')).toBeVisible();
  change('Maximum upward jar-centre load (lbf)', '25000');
  expect(within(screen.getByRole('table', { name: 'Manufacturer Operating Status' })).getByText('Within entered limits')).toBeVisible();
  expect(solveStaticJarHookload).toHaveBeenCalledTimes(1);
});

test('unrelated drilling, name, buckling and Advanced inputs preserve the inverse result', () => {
  const view = mount(); solve(); const prior = results().textContent;
  view.patch({ name: 'Renamed', wob: 35, rop: 90, inclination: 60, holeSize: 16, rpm: 300 });
  expect(results()).toHaveTextContent(prior);
  // A changed saved Auto DP length is not a changed deployed DP length.
  view.patch({ rows: [base.rows[0], { ...base.rows[1], length: 5000 }] });
  expect(results()).toHaveTextContent(prior);
  change('Surface hookload / axial support (klbf)', '150'); change('Operation', 'slackoff');
  expect(results()).toHaveTextContent(prior); expect(solveStaticJarHookload).toHaveBeenCalledTimes(1);
});

test('shared surface changes reach the next inverse call and the Advanced display', () => {
  const view = mount(base, { surfaceReferenceMdFt: 0 }); solve();
  view.patch({}, { surfaceReferenceMdFt: 10 });
  expect(screen.getByLabelText('Surface reference MD (ft)')).toHaveValue(10);
  expect(screen.getByText(/Analysis bit MD:/)).toHaveTextContent('Surface reference: 10.0 ft');
  solve(); expect(solveStaticJarHookload.mock.calls[1][0].surfaceMdFt).toBe(10);
});

test('component snapshot/property edits invalidate an existing inverse result', () => {
  const view = mount(); solve();
  view.patch({ rows: base.rows.map((row, i) => i ? row : { ...row, componentDefinition: { material: { name: 'Titanium', densityLbFt3: 170 } } }) });
  expect(results()).toBeNull(); expect(screen.getByText(stale)).toBeVisible();
  expect(solveStaticJarHookload).toHaveBeenCalledTimes(1);
});
