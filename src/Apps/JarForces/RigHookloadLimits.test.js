import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import JarForces from './JarForces';
import { SURVEY_STORAGE_KEY } from '../Survey/Survey';
const jar = id => ({ rowId: id, category: 'JAR', length: 20, weight: 100, od: 6.75,
  jarDirections: { up: { mechanism: 'hydraulic', targetForceKlbf: '20' }, down: { mechanism: 'hydraulic', targetForceKlbf: '5' } } });
const bha = { mudWeight: 10, frictionCoefficient: 0.25, rpm: 150, rows: [jar('one'), { rowId: 'dp', category: 'DP', length: 9999, weight: 100, od: 5.5 }] };
function Fixture({ maximum = '', multiple = false }) {
  const [rigLimits, setLimits] = React.useState({ maximumAllowableHookloadKlbf: maximum });
  return <JarForces bha={multiple ? { ...bha, rows: [jar('one'), jar('two'), bha.rows[1]] } : bha}
    analysisBitMdFt={1010} rigLimits={rigLimits} updateRigLimits={changes => setLimits(r => ({ ...r, ...changes }))} />;
}
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const solve = () => fireEvent.click(screen.getByRole('button', { name: 'Calculate required hookload' }));
const value = label => within(screen.getByRole('table', { name: 'Overpull & Hookload Limit' })).getByText(label).closest('tr').querySelector('td').textContent;
beforeEach(() => { localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n20000,0,90' })); });

test('one optional rig input is collapsed and missing maximum is Not Configured', () => {
  render(<Fixture />);
  expect(screen.getByText('Rig Limits').closest('details')).not.toHaveAttribute('open');
  expect(screen.queryByLabelText('Maximum Overpull Above Pickup')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Minimum Allowable Hookload')).not.toBeInTheDocument();
  solve(); expect(value('Surface limit status')).toBe('Not Configured');
  expect(value('Required overpull')).toBe('19.2 klbf'); expect(value('Remaining margin')).toBe('Unavailable');
});

test('configured limit updates signed overpull and margin without rerunning or repeating inverse hookload', () => {
  render(<Fixture maximum="120" />); solve();
  expect(value('Surface limit status')).toBe('Within Limit');
  expect(value('Available overpull')).toBe('34.4 klbf'); expect(value('Remaining margin')).toBe('15.3 klbf');
  fireEvent.click(screen.getByText('Rig Limits'));
  change('Maximum Allowable Hookload (klbf)', '100');
  expect(value('Surface limit status')).toBe('Exceeds Limit'); expect(value('Remaining margin')).toBe('-4.7 klbf');
  expect(screen.getAllByText('Required surface hookload')).toHaveLength(1);
  change('Maximum Allowable Hookload (klbf)', '80');
  expect(screen.getByRole('alert')).toHaveTextContent('Insufficient pickup capacity');
  expect(value('Available overpull')).toBe('-5.6 klbf');
  change('Maximum Allowable Hookload (klbf)', '0');
  expect(screen.getByRole('alert')).toHaveTextContent('finite, positive');
  expect(value('Surface limit status')).toContain('Unavailable');
});

test('inclined overpull uses pickup rather than rotating hookload', () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,60,90\n20000,60,90' }));
  render(<Fixture maximum="100" />); solve();
  const bf = 1 - 10 / 65.5, pickup = 101000 * bf * (0.5 + 0.25 * Math.sin(Math.PI / 3));
  const required = 100000 * bf * (0.5 + 0.25 * Math.sin(Math.PI / 3)) + 20000;
  expect(value('Required overpull')).toBe(((required - pickup) / 1000).toFixed(1) + ' klbf');
  expect(value('Available overpull')).toBe(((100000 - pickup) / 1000).toFixed(1) + ' klbf');
});

test('all jars share the same rig limit and Jar Down gets no safety status', () => {
  render(<Fixture maximum="120" multiple />); solve();
  expect(value('Surface limit status')).toBe('Within Limit');
  change('Selected jar', '1');
  expect(screen.getByLabelText('Maximum Allowable Hookload (klbf)')).toHaveValue(120);
  solve(); expect(value('Surface limit status')).toBe('Within Limit');
  change('Jar direction', 'down'); solve();
  expect(screen.getByText('Required surface hookload')).toBeInTheDocument();
  expect(screen.queryByRole('table', { name: 'Overpull & Hookload Limit' })).not.toBeInTheDocument();
  expect(screen.getByText(/Jar Down: compression and buckling limits are not yet evaluated/)).toBeInTheDocument();
});
