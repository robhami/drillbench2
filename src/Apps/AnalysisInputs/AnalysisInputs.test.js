import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalysisInputs from './AnalysisInputs';

const bha = { name: 'Test BHA', holeSize: '8.5', mudWeight: '10', inclination: 45, frictionCoefficient: 0.25, rpm: 40, rop: 200, wob: '10' };

test('compact fields retain values, units, validation and BHA updates', () => {
  const updateBha = jest.fn();
  render(<AnalysisInputs bha={bha} updateBha={updateBha} />);
  const fields = [['BHA Name', 'name', 'Updated BHA'], ['Hole Size', 'holeSize', '9.5'], ['Mud Weight', 'mudWeight', '12'], ['Inclination (°)', 'inclination', '50'], ['Friction coefficient', 'frictionCoefficient', '0.3'], ['RPM', 'rpm', '60'], ['ROP', 'rop', '250'], ['WOB', 'wob', '15']];
  fields.forEach(([label, key, value]) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(updateBha).toHaveBeenLastCalledWith({ [key]: value });
  });
  expect(screen.getByLabelText('Inclination (°)')).toHaveAttribute('max', '90');
  expect(screen.getByLabelText('Friction coefficient')).toHaveAttribute('max', '1');
  expect(screen.getByLabelText('RPM')).toHaveAttribute('min', '0');
  [['Hole Size', 'in'], ['Mud Weight', 'ppg'], ['Inclination (°)', '°'], ['Friction coefficient', 'μ'], ['RPM', 'rpm'], ['ROP', 'ft/hr'], ['WOB', 'klbf']].forEach(([label, unit]) => {
    expect(screen.getByLabelText(label).nextElementSibling).toHaveTextContent(unit);
  });
  expect(screen.getByLabelText('BHA Name').closest('.analysisNameField')).toBeInTheDocument();
  expect(screen.getByLabelText('ROP').closest('.analysisWideNumber')).toBeInTheDocument();
  expect(screen.getByLabelText('WOB').closest('.analysisWideNumber')).toBeInTheDocument();
});

test('drilling mode uses existing shared state without writing BHA data', () => {
  const setDrillingMode = jest.fn();
  const updateBha = jest.fn();
  const { rerender } = render(<AnalysisInputs bha={bha} updateBha={updateBha} drillingMode="rotate" setDrillingMode={setDrillingMode} />);
  expect(screen.getByLabelText('Drilling Mode')).toHaveValue('rotate');
  fireEvent.change(screen.getByLabelText('Drilling Mode'), { target: { value: 'reference' } });
  expect(setDrillingMode).toHaveBeenCalledWith('reference');
  expect(updateBha).not.toHaveBeenCalled();
  rerender(<AnalysisInputs bha={bha} updateBha={updateBha} drillingMode="reference" setDrillingMode={setDrillingMode} />);
  expect(screen.getByLabelText('Drilling Mode')).toHaveValue('reference');
});
