import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalysisInputs from './AnalysisInputs';
import { wobAnalysisInputs } from '../../engineering/bha/wobAnalysisInputs';

const legacyBha = {
  name: 'OES BHA', holeSize: '8.5', mudWeight: '10', inclination: 35,
  frictionCoefficient: 0.25, rpm: 40, rop: 200, wob: '22',
  neutralPointAnalysis: { minWob: '12', maxWob: '30', samples: '7' }
};

test('Parameter Entry exposes only the five requested controls in a compact grid', () => {
  render(<AnalysisInputs bha={legacyBha} updateBha={jest.fn()} />);
  ['Mud Weight (ppg)', 'Low WOB (klbf)', 'High WOB (klbf)', 'RPM', 'ROP (ft/hr)']
    .forEach(label => expect(screen.getByLabelText(label)).toBeInTheDocument());
  expect(screen.getByLabelText('Low WOB (klbf)')).toHaveValue(12);
  expect(screen.getByLabelText('High WOB (klbf)')).toHaveValue(30);
  expect(screen.getByLabelText('Mud Weight (ppg)').closest('.parameterEntryGrid')).toBeInTheDocument();
  ['Inclination', 'Current WOB', 'BHA Name', 'Bit Depth', 'Hole Size',
    'Drilling Mode', 'Friction coefficient', 'WOB Samples', 'WOB Analysis', 'Trajectory input']
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
  expect(wobAnalysisInputs({ ...legacyBha, wobAnalysis: { minWobKlbf: '14', maxWobKlbf: '32', samples: '7', source: 'user' } }))
    .toEqual({ minWobKlbf: '14', maxWobKlbf: '32', samples: '7', source: 'user' });
  expect(screen.getByLabelText('Low WOB (klbf)')).toHaveValue(14);
  expect(screen.getByLabelText('High WOB (klbf)')).toHaveValue(32);
  expect(screen.queryByLabelText('Analysis WOB (klbf)')).not.toBeInTheDocument();
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
