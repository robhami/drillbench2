import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import JarForces from './JarForces';
import { SURVEY_STORAGE_KEY } from '../Survey/Survey';
const jar = id => ({ rowId: id, category: 'JAR', toolName: `Study jar ${id}`, length: 20, weight: 100, od: 6.75,
  jarDirections: { up: { mechanism: 'hydraulic', targetForceKlbf: '20' }, down: { mechanism: 'hydraulic', targetForceKlbf: '5' } } });
function Fixture({ multiple = false, limit = '120', manufacturer = {} }) {
  const [bha, setBha] = React.useState({ holeSize: 16, mudWeight: 10, frictionCoefficient: .25, rpm: 150,
    rows: [{ ...jar('one'), jarManufacturerLimits: manufacturer }, ...(multiple ? [jar('two')] : []),
      { rowId: 'dp', category: 'DP', lengthMode: 'auto', length: 9000, weight: 100, od: 5.5, idSize: 4.67 }] });
  return <JarForces bha={bha} analysisBitMdFt={1010} rigLimits={{ maximumAllowableHookloadKlbf: limit }}
    updateRow={(id, changes) => setBha(b => ({ ...b, rows: b.rows.map(r => r.rowId === id ? { ...r, ...changes } : r) }))} />;
}
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const solve = () => fireEvent.click(screen.getByRole('button', { name: 'Calculate required hookload' }));
beforeEach(() => { localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n20000,0,90' })); });

test('main inputs precede supported results; missing results and limits are explicit and supporting details collapsed', () => {
  render(<Fixture />);
  expect(screen.getByText('Enter a target force and calculate the required surface hookload.')).toBeVisible();
  expect(within(screen.getByRole('table', { name: 'Manufacturer Operating Status' })).getAllByText('Limit not provided')).toHaveLength(2);
  for (const title of ['String Weight & Operating Hookloads', 'Manufacturer Comparison Details', 'Engineering Details', 'Calculation Details']) {
    expect(screen.getByText(title).closest('details')).not.toHaveAttribute('open');
  }
  expect(screen.getByRole('table', { name: 'String Weight' })).not.toBeVisible();
  expect(screen.getByLabelText('Target Force at Jar (klbf)')).toBeVisible();
  expect(screen.getByRole('region', { name: 'Jar Loading' }).compareDocumentPosition(screen.getByRole('region', { name: 'Jar Configuration' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  solve();
  const results = screen.getByRole('table', { name: 'Jar Loading Results' });
  expect(within(results).getByText('104.7 klbf')).toBeVisible();
  expect(within(results).getByText(/20.0 klbf Jar Up/)).toBeVisible();
  expect(screen.getByText('Required overpull')).toBeVisible();
  expect(screen.getByText('Available overpull')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Calculate required hookload' }).compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByText('String Weight & Operating Hookloads'));
  expect(screen.getByRole('table', { name: 'String Weight' })).toBeVisible();
  expect(screen.getByRole('table', { name: 'Operating Hookloads' })).toBeVisible();
  fireEvent.click(screen.getByText('String Weight & Operating Hookloads'));
  expect(screen.getByRole('table', { name: 'String Weight' })).not.toBeVisible();
});

test('rig and manufacturer exceedances remain distinct and detailed comparison is expandable', () => {
  render(<Fixture limit="100" manufacturer={{ maximumUpwardLoadLbf: 18000 }} />); solve();
  expect(screen.getByText('Required surface hookload exceeds the entered rig maximum.')).toBeVisible();
  expect(screen.getByText(/Calculated jar load or requested target exceeds/)).toBeVisible();
  expect(within(screen.getByRole('table', { name: 'Manufacturer Operating Status' })).getByText('Exceeds entered limit')).toBeVisible();
  expect(screen.getByRole('table', { name: 'Manufacturer Limit Comparisons' })).not.toBeVisible();
  fireEvent.click(screen.getByText('Manufacturer Comparison Details'));
  expect(screen.getByRole('table', { name: 'Manufacturer Limit Comparisons' })).toBeVisible();
});

test('Jar Down shows unsupported buckling explicitly and retains detailed screening controls', () => {
  render(<Fixture />); change('Jar direction', 'down'); solve();
  expect(screen.getByText('Buckling evaluation: Not Evaluated')).toBeVisible();
  expect(screen.queryByRole('table', { name: 'Overpull & Hookload Limit' })).not.toBeInTheDocument();
  expect(screen.getByText(/does not establish force transmission or buckling stability/)).toBeVisible();
  fireEvent.click(screen.getByText('Engineering Details'));
  fireEvent.change(screen.getByLabelText("Young's Modulus E (psi)"), { target: { value: '30000000' } });
  fireEvent.click(screen.getByLabelText('Treat selected drillpipe as uniform tubular for buckling screening'));
  expect(screen.getByText('Buckling evaluation: Not Evaluated')).toBeVisible();
  expect(screen.getByText(/Evaluated compressed length: 0.0 ft; unevaluated:/)).toBeVisible();
});

test('main buckling coverage reflects the existing partial inclined screening result', () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,60,90\n20000,60,90' }));
  render(<Fixture />); change('Jar direction', 'down'); solve();
  fireEvent.click(screen.getByText('Engineering Details'));
  fireEvent.change(screen.getByLabelText("Young's Modulus E (psi)"), { target: { value: '30000000' } });
  fireEvent.click(screen.getByLabelText('Treat selected drillpipe as uniform tubular for buckling screening'));
  expect(screen.getByText('Buckling evaluation: Partial screening')).toBeVisible();
  expect(screen.getByText(/Evaluated compressed length: .*; unevaluated:/)).toBeVisible();
});

test('multiple-jar selection and unsupported survey show current identity without invented results', () => {
  const view = render(<Fixture multiple />);
  change('Selected jar', '1');
  expect(screen.getByLabelText('Selected jar')).toHaveDisplayValue('Study jar two 2');
  solve(); expect(screen.getByRole('table', { name: 'Jar Loading Results' })).toBeVisible();
  view.unmount();
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n500,0,90' }));
  render(<Fixture />); solve();
  expect(screen.getAllByText(/Survey coverage warning:/)).toHaveLength(1);
  expect(screen.queryByRole('table', { name: 'Jar Loading Results' })).not.toBeInTheDocument();
});
