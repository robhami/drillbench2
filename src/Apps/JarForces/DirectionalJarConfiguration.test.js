import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import JarForces from './JarForces';
import { SURVEY_STORAGE_KEY } from '../Survey/Survey';

const jar = (rowId, jarDirections) => ({ rowId, category: 'JAR', toolName: 'No inferred mechanism', length: 20, weight: 100, od: 6.75, ...(jarDirections ? { jarDirections } : {}) });
const assembly = rows => ({ id: 'bha', mudWeight: 10, frictionCoefficient: 0.25, rpm: 150,
  rows: [...rows, { rowId: 'dp', category: 'DP', length: 10000, weight: 20, od: 5.5 }] });
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function Fixture({ initial }) {
  const [bha, setBha] = React.useState(initial);
  const updateRow = (rowId, changes) => setBha(b => ({ ...b, rows: b.rows.map(r => r.rowId === rowId ? { ...r, ...changes } : r) }));
  return <JarForces bha={bha} analysisBitMdFt={1000} updateRow={updateRow} />;
}
const target = () => screen.getByLabelText('Target Force at Jar (klbf)');
const solveButton = () => screen.getByRole('button', { name: 'Calculate required hookload' });
beforeEach(() => { localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n20000,0,90' })); });

test('legacy rows are not inferred or mutated and require explicit directional configuration', () => {
  const bha = assembly([jar('one')]), before = JSON.stringify(bha);
  render(<Fixture initial={bha} />);
  expect(screen.getByLabelText('Jar Up mechanism')).toHaveValue('');
  expect(screen.getByLabelText('Jar Down mechanism')).toHaveValue('');
  expect(solveButton()).toBeDisabled();
  expect(screen.queryByLabelText(/mechanical trip force/)).not.toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(before);
});

test('hydraulic/hydraulic needs no trip forces and keeps separate manual targets', () => {
  render(<Fixture initial={assembly([jar('one')])} />);
  change('Jar Up mechanism', 'hydraulic'); change('Jar Down mechanism', 'hydraulic');
  expect(screen.queryByLabelText(/mechanical trip force/)).not.toBeInTheDocument();
  change('Target Force at Jar (klbf)', '15');
  fireEvent.click(solveButton());
  expect(screen.getByText('Required surface hookload')).toBeInTheDocument();
  change('Jar direction', 'down'); expect(target()).toHaveValue(null);
  change('Target Force at Jar (klbf)', '5'); fireEvent.click(solveButton());
  expect(screen.getByText('Required surface hookload')).toBeInTheDocument();
  change('Jar direction', 'up'); expect(target()).toHaveValue(15);
  expect(screen.getByText(/target is not a fixed hydraulic firing threshold/)).toBeInTheDocument();
});

test('mechanical/mechanical trip settings and overridden targets are independent in both directions', () => {
  render(<Fixture initial={assembly([jar('one')])} />);
  change('Jar Up mechanism', 'mechanical'); change('Jar Down mechanism', 'mechanical');
  expect(solveButton()).toBeDisabled();
  change('Jar Up mechanical trip force (klbf)', '20');
  change('Jar Down mechanical trip force (klbf)', '8');
  expect(target()).toHaveValue(20);
  change('Target Force at Jar (klbf)', '10');
  expect(screen.getByText(/Configured mechanical release setting has not been reached/)).toBeInTheDocument();
  fireEvent.click(solveButton()); // below-trip static loading remains calculable
  expect(screen.getByText('Required surface hookload')).toBeInTheDocument();
  change('Target Force at Jar (klbf)', '20');
  expect(screen.getByText(/Static force target meets the configured mechanical trip setting; firing is not guaranteed/)).toBeInTheDocument();
  change('Target Force at Jar (klbf)', '25');
  change('Jar Up mechanical trip force (klbf)', '30');
  expect(target()).toHaveValue(25); // manual target is not overwritten
  change('Jar direction', 'down'); expect(target()).toHaveValue(8);
  change('Target Force at Jar (klbf)', '6');
  change('Jar direction', 'up'); expect(target()).toHaveValue(25);
  expect(screen.getByLabelText('Jar Down mechanical trip force (klbf)')).toHaveValue(8);
});

test.each([['hydraulic', 'mechanical'], ['mechanical', 'hydraulic']])('mixed %s/%s uses direction-specific requirements', (up, down) => {
  render(<Fixture initial={assembly([jar('one', { up: { mechanism: up, tripForceKlbf: 20 }, down: { mechanism: down, tripForceKlbf: 5 } })])} />);
  expect(Boolean(screen.queryByLabelText('Jar Up mechanical trip force (klbf)'))).toBe(up === 'mechanical');
  expect(Boolean(screen.queryByLabelText('Jar Down mechanical trip force (klbf)'))).toBe(down === 'mechanical');
  expect(target()).toHaveValue(up === 'mechanical' ? 20 : null);
  change('Jar direction', 'down'); expect(target()).toHaveValue(down === 'mechanical' ? 5 : null);
});

test('single-direction jar blocks unavailable operation and preserves targets through mechanism changes', () => {
  render(<Fixture initial={assembly([jar('one', { up: { mechanism: 'hydraulic', targetForceKlbf: '12' }, down: { mechanism: 'unavailable' } })])} />);
  change('Jar direction', 'down'); expect(solveButton()).toBeDisabled();
  expect(target()).toBeDisabled();
  expect(screen.getByText(/does not support the selected direction/)).toBeInTheDocument();
  change('Jar direction', 'up'); expect(target()).toHaveValue(12);
  change('Jar Up mechanism', 'mechanical'); change('Jar Up mechanical trip force (klbf)', '10');
  expect(target()).toHaveValue(12);
});

test('multiple jars keep configurations, trip settings and manually cleared targets independently', () => {
  render(<Fixture initial={assembly([jar('one'), jar('two')])} />);
  change('Jar Up mechanism', 'mechanical'); change('Jar Up mechanical trip force (klbf)', '20');
  change('Target Force at Jar (klbf)', '17');
  change('Selected jar', '1'); expect(screen.getByLabelText('Jar Up mechanism')).toHaveValue('');
  change('Jar Up mechanism', 'hydraulic'); change('Target Force at Jar (klbf)', '11');
  change('Jar Down mechanism', 'mechanical'); change('Jar Down mechanical trip force (klbf)', '4');
  change('Selected jar', '0'); expect(target()).toHaveValue(17);
  expect(screen.getByLabelText('Jar Up mechanical trip force (klbf)')).toHaveValue(20);
  expect(screen.getByLabelText('Jar Down mechanism')).toHaveValue('');
  change('Target Force at Jar (klbf)', '');
  change('Selected jar', '1'); expect(target()).toHaveValue(11);
  change('Selected jar', '0'); expect(target()).toHaveValue(null);
  expect(within(screen.getByRole('region', { name: 'Jar Configuration' })).getAllByRole('combobox')).toHaveLength(2);
});
