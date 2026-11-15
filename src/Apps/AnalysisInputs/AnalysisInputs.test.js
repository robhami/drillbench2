import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalysisInputs from './AnalysisInputs';
import { wobAnalysisInputs } from '../../engineering/bha/wobAnalysisInputs';

const legacyBha = {
  name: 'OES BHA', holeSize: '8.5', mudWeight: '10', inclination: 35,
  frictionCoefficient: 0.25, rpm: 40, rop: 200, wob: '22',
  neutralPointAnalysis: { minWob: '12', maxWob: '30', samples: '7' }
};

test('Parameter Entry groups shared drilling conditions separately from the WOB comparison range', () => {
  render(<AnalysisInputs bha={legacyBha} updateBha={jest.fn()} />);
  ['Controlling WOB (klbf)', 'Mud Weight (ppg)', 'RPM', 'ROP (ft/hr)', 'Baseline friction coefficient (0–1)', 'Low WOB (klbf)', 'High WOB (klbf)']
    .forEach(label => expect(screen.getByLabelText(label)).toBeInTheDocument());
  expect(screen.getByRole('region', { name: 'Drilling Conditions' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'WOB Comparison' })).toBeInTheDocument();
  expect(screen.getByLabelText('Controlling WOB (klbf)')).toHaveValue(22);
  expect(screen.getByLabelText('Baseline friction coefficient (0–1)')).toHaveValue(0.25);
  expect(screen.getByLabelText('Low WOB (klbf)')).toHaveValue(12);
  expect(screen.getByLabelText('High WOB (klbf)')).toHaveValue(30);
  expect(screen.getByLabelText('Mud Weight (ppg)').closest('.parameterEntrySection')).toHaveTextContent('Drilling Conditions');
  ['Inclination', 'Current WOB', 'BHA Name', 'Bit Depth', 'Hole Size',
    'Drilling Mode', 'Additional friction coefficients', 'WOB Samples', 'WOB Analysis', 'Trajectory input']
    .forEach(label => expect(screen.queryByText(new RegExp(label, 'i'))).not.toBeInTheDocument());
  expect(screen.getByRole('group', { name: 'Well Trajectory' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Vertical' })).toHaveAttribute('aria-pressed', 'true');
});

test('trajectory selector changes mode without replacing the imported source and reports missing directional data', () => {
  const imported = { originalCsv: 'MD,Inclination,Azimuth\n0,0,0\n1000,30,90', filename: 'directional.csv', confirmed: true, kind: 'imported' };
  function Harness({ initial }) {
    const [bha, setBha] = React.useState(initial);
    return <><AnalysisInputs bha={bha} updateBha={patch => setBha(current => ({ ...current, ...patch }))} />
      <output data-testid="trajectory-state">{JSON.stringify({ trajectoryMode: bha.trajectoryMode, surveyState: bha.surveyState })}</output></>;
  }
  const view = render(<Harness key="with-survey" initial={{ ...legacyBha, trajectoryMode: 'vertical', surveyState: { active: imported, history: [], reviewRequired: false } }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Directional' }));
  expect(screen.getByRole('button', { name: 'Directional' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByText('Survey required')).not.toBeInTheDocument();
  const directionalState = JSON.parse(screen.getByTestId('trajectory-state').textContent);
  expect(directionalState.trajectoryMode).toBe('directional');
  expect(directionalState.surveyState.active).toEqual(imported);
  fireEvent.click(screen.getByRole('button', { name: 'Vertical' }));
  expect(JSON.parse(screen.getByTestId('trajectory-state').textContent).surveyState.active).toEqual(imported);
  view.rerender(<Harness key="missing-survey" initial={{ ...legacyBha, trajectoryMode: 'directional', surveyState: { active: null, history: [], reviewRequired: false } }} />);
  expect(screen.getByText('Survey required')).toBeInTheDocument();
});

test('Low and High WOB update the shared sweep range and preserve sample count and independent legacy inputs', () => {
  const patches = jest.fn();
  function Harness() {
    const [bha, setBha] = React.useState(legacyBha);
    return <AnalysisInputs bha={bha} updateBha={patch => { patches(patch); setBha(current => ({ ...current, ...patch })); }} />;
  }
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Low WOB (klbf)'), { target: { value: '14' } });
  fireEvent.change(screen.getByLabelText('High WOB (klbf)'), { target: { value: '32' } });
  expect(patches).toHaveBeenNthCalledWith(1, { wobAnalysis: { minWobKlbf: '14', maxWobKlbf: '30', samples: '7', source: 'user' } });
  expect(patches).toHaveBeenNthCalledWith(2, { wobAnalysis: { minWobKlbf: '14', maxWobKlbf: '32', samples: '7', source: 'user' } });
  expect(patches.mock.calls.every(([patch]) => !Object.prototype.hasOwnProperty.call(patch, 'wob'))).toBe(true);
  expect(wobAnalysisInputs({ ...legacyBha, wobAnalysis: { minWobKlbf: '14', maxWobKlbf: '32', samples: '7', source: 'user' } }))
    .toEqual({ minWobKlbf: '14', maxWobKlbf: '32', samples: '7', source: 'user' });
  expect(screen.getByLabelText('Low WOB (klbf)')).toHaveValue(14);
  expect(screen.getByLabelText('High WOB (klbf)')).toHaveValue(32);
});

test('controlling WOB and baseline friction update only their root fields without coercing blanks or invalid values', () => {
  const updateBha = jest.fn();
  function Harness() {
    const [bha, setBha] = React.useState({ ...legacyBha, wob: '', frictionCoefficient: '' });
    return <AnalysisInputs bha={bha} updateBha={patch => { updateBha(patch); setBha(current => ({ ...current, ...patch })); }} />;
  }
  render(<Harness />);
  expect(screen.getByLabelText('Controlling WOB (klbf)')).toHaveValue(null);
  expect(screen.getByLabelText('Baseline friction coefficient (0–1)')).toHaveValue(null);
  fireEvent.change(screen.getByLabelText('Controlling WOB (klbf)'), { target: { value: '24.5' } });
  expect(updateBha).toHaveBeenLastCalledWith({ wob: '24.5' });
  fireEvent.change(screen.getByLabelText('Baseline friction coefficient (0–1)'), { target: { value: '1.2' } });
  expect(updateBha).toHaveBeenLastCalledWith({ frictionCoefficient: '1.2' });
  expect(screen.getByLabelText('Baseline friction coefficient (0–1)')).toHaveValue(1.2);
  expect(screen.getByRole('alert')).toHaveTextContent('Axial friction coefficient must be between 0 and 1.');
  fireEvent.change(screen.getByLabelText('Baseline friction coefficient (0–1)'), { target: { value: '' } });
  expect(updateBha).toHaveBeenLastCalledWith({ frictionCoefficient: '' });
  expect(screen.getByLabelText('Baseline friction coefficient (0–1)')).toHaveValue(null);
  expect(screen.getByRole('alert')).toHaveTextContent('Axial friction coefficient must be explicitly supplied between 0 and 1.');
});

test('baseline friction accepts the existing zero coefficient without a validation warning', () => {
  render(<AnalysisInputs bha={{ ...legacyBha, frictionCoefficient: 0 }} updateBha={jest.fn()} />);
  expect(screen.getByLabelText('Baseline friction coefficient (0–1)')).toHaveValue(0);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('mud weight edits update the shared BHA field while saved BHA fields remain untouched until edited', () => {
  const updateBha = jest.fn();
  render(<AnalysisInputs bha={legacyBha} updateBha={updateBha} />);
  fireEvent.change(screen.getByLabelText('Mud Weight (ppg)'), { target: { value: '12.4' } });
  expect(updateBha).toHaveBeenCalledWith({ mudWeight: '12.4' });
  expect(legacyBha).toMatchObject({ wob: '22', frictionCoefficient: 0.25, inclination: 35, name: 'OES BHA', holeSize: '8.5' });
});

test('invalid Low/High range is reported and saved values load without rewriting other state', () => {
  render(<AnalysisInputs bha={{ ...legacyBha, wobAnalysis: { minWobKlbf: '40', maxWobKlbf: '30', samples: '7' } }} />);
  expect(screen.getByLabelText('Low WOB (klbf)')).toHaveValue(40);
  expect(screen.getByRole('alert')).toHaveTextContent('no greater than Maximum WOB');
});
