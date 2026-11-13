import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DemoPresentationContext, componentDisplayLabel } from './DemoPresentation';
import BHABuilder from './BHABuilder/BHABuilder';
import AnalysisInputs from '../Apps/AnalysisInputs/AnalysisInputs';
import Navbar from '../Navbar';
import live from '../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import library from '../data/components.json';

const csv = 'MD,Inclination,Azimuth\n' + live.survey.stations.map(s => [s.mdFt, s.inclinationDeg, s.azimuthDeg].join(',')).join('\n');
const bha = { ...live.bha, surveyState: { version: 1, active: { filename: 'SyntheticDirectionalWell.csv', confirmed: true, originalCsv: csv, origin: 'Imported demo survey' }, history: [] } };
const wrap = (enabled, children) => <DemoPresentationContext.Provider value={enabled}>{children}</DemoPresentationContext.Provider>;

test('display aliases require exact original name/category/id; catalogue and BHA remain unchanged', () => {
  const before = JSON.stringify({ bha, library });
  expect(componentDisplayLabel(bha.rows[0], true)).toBe('6.75" Downhole Motor');
  expect(componentDisplayLabel(bha.rows[2], true)).toBe('6.5" Hydraulic Drilling Jar');
  expect(componentDisplayLabel(bha.rows[0], false)).toBe('MOTOR 6.75 SLB VORTEX');
  for (const changes of [{ selectedToolId: 'another-product' }, { category: 'DC' }, { toolName: 'Another motor' }]) {
    const row = { ...bha.rows[0], ...changes };
    expect(componentDisplayLabel(row, true)).toBe(row.toolName);
  }
  expect(JSON.stringify({ bha, library })).toBe(before);
});

test('Data Entry changes only selected display labels and retains provenance, numbers and selection IDs', () => {
  const updateRow = jest.fn(), updateBha = jest.fn();
  const view = render(wrap(false, <BHABuilder bha={bha} updateRow={updateRow} updateBha={updateBha} />));
  const motor = screen.getByLabelText('Component 1 tool'), jar = screen.getByLabelText('Component 3 tool');
  expect(motor.selectedOptions[0]).toHaveTextContent('MOTOR 6.75 SLB VORTEX');
  view.rerender(wrap(true, <BHABuilder bha={bha} updateRow={updateRow} updateBha={updateBha} />));
  expect(motor).toHaveValue('bha-108'); expect(jar).toHaveValue('bha-86');
  expect(motor.selectedOptions[0]).toHaveTextContent('6.75" Downhole Motor');
  expect(jar.selectedOptions[0]).toHaveTextContent('6.5" Hydraulic Drilling Jar');
  expect(screen.getByText(/not verified generic product specifications/)).toBeInTheDocument();
  expect(motor).toHaveAttribute('title', expect.stringContaining('MOTOR 6.75 SLB VORTEX'));
  expect(screen.getByText(/MOTOR 6.75 SLB VORTEX Â· ID bha-108/)).toBeInTheDocument();
  expect(screen.getByLabelText('Component 1 od')).toHaveValue('6.75');
  expect(screen.getByLabelText('Component 1 length')).toHaveValue('31.2');
  expect(screen.getByLabelText('Calculated drillpipe length 5')).toHaveValue('8,435.8');
  expect(updateRow).not.toHaveBeenCalled(); expect(updateBha).not.toHaveBeenCalled();
  view.rerender(wrap(false, <BHABuilder bha={bha} updateRow={updateRow} updateBha={updateBha} />));
  expect(motor.selectedOptions[0]).toHaveTextContent('MOTOR 6.75 SLB VORTEX');
});

test('Parameter Entry exposes the five shared controls in both presentation modes', () => {
  const updateBha = jest.fn(), original = JSON.stringify(bha);
  const inputs = <AnalysisInputs bha={bha} updateBha={updateBha} />;
  const view = render(wrap(false, inputs));
  expect(screen.getByLabelText('Mud Weight (ppg)')).toHaveValue('10.2');
  expect(screen.getByLabelText('Low WOB (klbf)')).toBeInTheDocument();
  expect(screen.getByLabelText('High WOB (klbf)')).toBeInTheDocument();
  expect(screen.getByLabelText('RPM')).toHaveValue(120);
  expect(screen.getByLabelText('ROP (ft/hr)')).toHaveValue(60);
  view.rerender(wrap(true, inputs));
  expect(screen.queryByLabelText('Current WOB')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Drilling Mode')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Inclination')).not.toBeInTheDocument();
  expect(updateBha).not.toHaveBeenCalled();
  expect(JSON.stringify(bha)).toBe(original);
});

test('Settings explicitly selects presentation view while retaining the standard subtitle', () => {
  function Shell() {
    const [enabled, setEnabled] = React.useState(false);
    return wrap(enabled, <Navbar currentBha={bha} onDemoPresentationChange={setEnabled} />);
  }
  render(<Shell />); fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  const settings = screen.getByRole('group', { name: 'Workspace settings' });
  const toggle = within(settings).getByLabelText('Demo Presentation View');
  expect(toggle).not.toBeChecked(); fireEvent.click(toggle); expect(toggle).toBeChecked();
  expect(screen.getByText('DRILLING ANALYSIS SUITE')).toBeInTheDocument();
  fireEvent.click(toggle); expect(screen.getByText('DRILLING ANALYSIS SUITE')).toBeInTheDocument();
});
