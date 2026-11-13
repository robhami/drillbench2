import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import JarForces from './JarForces';
import { SURVEY_STORAGE_KEY } from '../Survey/Survey';
const jar = rowId => ({ rowId, category: 'JAR', length: 20, weight: 100, od: 6.75,
  jarDirections: { up: { mechanism: 'hydraulic', targetForceKlbf: '20' }, down: { mechanism: 'mechanical', tripForceKlbf: '5' } } });
function Fixture({ multiple = false, limits = {} }) {
  const [bha, setBha] = React.useState({ mudWeight: 10, frictionCoefficient: 0.25, rpm: 150,
    rows: [{ ...jar('one'), jarManufacturerLimits: limits }, ...(multiple ? [jar('two')] : []), { rowId: 'dp', category: 'DP', length: 9999, weight: 100, od: 5.5 }] });
  return <JarForces bha={bha} analysisBitMdFt={1010} rigLimits={{ maximumAllowableHookloadKlbf: '80' }}
    updateRow={(id, changes) => setBha(b => ({ ...b, rows: b.rows.map(r => r.rowId === id ? { ...r, ...changes } : r) }))} />;
}
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const solve = () => fireEvent.click(screen.getByRole('button', { name: 'Calculate required hookload' }));
const comparisons = () => {
  const summary = screen.getByText('Manufacturer Comparison Details');
  if (!summary.closest('details').open) fireEvent.click(summary);
  return within(screen.getByRole('table', { name: 'Manufacturer Limit Comparisons' }));
};
beforeEach(() => { localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n20000,0,90' })); });
test('optional limits collapsed, missing limits unset and surface capacity distinct from jar limits', () => {
  render(<Fixture limits={{ maximumUpwardLoadLbf: '25000' }} />);
  expect(screen.getByText('Manufacturer Limits').closest('details')).not.toHaveAttribute('open');
  expect(comparisons().getByText('Calculation unavailable')).toBeInTheDocument();
  solve();
  expect(comparisons().getByText('Within entered limits')).toBeInTheDocument();
  expect(screen.getByText('Exceeds Limit')).toBeInTheDocument();
  expect(comparisons().getByText('20.0')).toBeInTheDocument();
});
test('per-jar fields and direction mechanisms remain independent', () => {
  render(<Fixture multiple />);
  change('Maximum upward jar-centre load (lbf)', '18000');
  change('Maximum downward jar-centre compression (lbf)', '4000');
  change('Selected jar', '1');
  expect(screen.getByLabelText('Maximum upward jar-centre load (lbf)')).toHaveValue(null);
  change('Maximum upward jar-centre load (lbf)', '30000');
  change('Selected jar', '0');
  expect(screen.getByLabelText('Maximum upward jar-centre load (lbf)')).toHaveValue(18000);
  solve(); expect(comparisons().getByText('Exceeds entered limit')).toBeInTheDocument();
  change('Jar direction', 'down');
  expect(screen.getByLabelText('Target Force at Jar (klbf)')).toHaveValue(5);
  expect(comparisons().getByText('Exceeds entered limit')).toBeInTheDocument();
  expect(screen.getByText(/Jar Down: no minimum hookload limit/)).toBeInTheDocument();
  expect(screen.getByText(/does not establish force transmission or buckling stability/)).toBeInTheDocument();
});
test('ambiguous tensile limit unavailable; compatible jar-centre limit uses calculated tension', () => {
  render(<Fixture limits={{ maximumTensileLoadLbf: '15000' }} />); solve();
  expect(comparisons().getByText(/Through-jar tensile load definition is unresolved/)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Manufacturer tensile limit explicitly applies at jar centre'));
  solve();
  expect(comparisons().getByText('Exceeds entered limit')).toBeInTheDocument();
  change('Maximum upward jar-centre load (lbf)', '0');
  expect(screen.getByText(/maximumUpwardLoadLbf: Enter a finite, positive/)).toBeInTheDocument();
});
