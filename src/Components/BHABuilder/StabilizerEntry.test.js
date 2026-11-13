import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ComponentLibrary from './ComponentLibrary';
import { loadMyComponents, saveMyComponents } from '../../Apps/BHAEntry/componentStore';

let current;
const row = { rowId: 'legacy', category: 'DC', toolName: 'Retained', length: 100, od: 6, idSize: 2, weight: 100, notes: 'Keep' };
function Harness() {
  const [bha, setBha] = React.useState({ rows: [row] }), [open, setOpen] = React.useState(true); current = bha;
  return <><button onClick={() => setOpen(true)}>Reopen</button>{open && <ComponentLibrary bha={bha} updateBha={patch => setBha(v => ({ ...v, ...patch }))} onClose={() => setOpen(false)} />}</>;
}
const click = text => fireEvent.click(screen.getByRole('button', { name: text, exact: true }));
const edit = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const advanced = () => fireEvent.click(screen.getByText('Advanced Properties'));
function fillStabilizer() {
  edit('Component type', 'STB'); edit('Component name', 'User stabilizer'); edit('Total tool length (ft)', '10'); edit('Body OD (in)', '6');
  edit('Blade OD (in)', '8'); edit('Blade length (ft)', '2'); edit('ID (in)', '2'); edit('Nominal linear weight (lb/ft)', '80');
}
beforeEach(() => localStorage.clear());

test('ordinary tubular entry has just six basic fields and saves without opening Advanced Properties', () => {
  render(<Harness />); edit('Component type', 'DC');
  const primary = document.querySelector('.componentEditorGrid'); expect(primary.querySelectorAll('.componentField')).toHaveLength(6);
  expect(screen.getByLabelText('Geometry')).not.toBeVisible(); expect(screen.getByLabelText('Component section idealization')).not.toBeVisible();
  edit('Component name', 'User tubular'); edit('Component Length (ft)', '10'); edit('Component OD (in)', '6'); edit('Component ID (in)', '2'); edit('Component Nominal linear weight (lb/ft)', '80');
  click('Use in Current BHA Only'); expect(current.rows[0]).toEqual(row); expect(current.rows[1].weight).toBe('80');
  expect(current.rows[1].componentDefinition.material).toEqual({ name: 'Unspecified', densityLbFt3: '', youngsModulusPsi: '' });
  expect(current.rows[1].componentDefinition.geometry.kind).toBe('uniform');
});

test('stabilizer primary fields derive 4/2/4 geometry and save the supplied weight and blade envelope', () => {
  render(<Harness />); fillStabilizer();
  const summary = screen.getByLabelText('Derived stabilizer geometry'); expect(within(summary).getAllByRole('row')).toHaveLength(4);
  expect(summary).toHaveTextContent('0–4'); expect(summary).toHaveTextContent('4–6'); expect(summary).toHaveTextContent('6–10');
  expect(screen.queryByLabelText('Geometry')).not.toBeInTheDocument(); expect(document.querySelector('.componentAdvanced')).not.toHaveAttribute('open');
  click('Save to My Library'); const stored = loadMyComponents()[0];
  expect(stored.geometry.segments.map(s => [s.length, s.od])).toEqual([[4, 6], [2, 8], [4, 6]]); expect(stored.maximumOd).toBe('8');
  expect(stored.od).toBe('6'); expect(stored.weight).toBe('80'); expect(stored.geometry.segments.every(s => s.weight === '' && s.sectionModel === 'complex')).toBe(true);
  expect(current.rows[0]).toEqual(row); expect(current.rows[1].selectedToolId).toBe(stored.id);
  click('Reopen'); click('Manage Components'); click('Edit definition'); expect(screen.getByLabelText('Blade length (ft)')).toHaveValue('2');
  expect(screen.getByLabelText('Body OD (in)')).toHaveValue('6');
});

test('stabilizer errors appear by their fields on Save; no invalid geometry is inserted', () => {
  render(<Harness />); fillStabilizer(); edit('Blade length (ft)', '11'); edit('Blade OD (in)', '5'); edit('ID (in)', '6'); edit('Nominal linear weight (lb/ft)', '0');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument(); click('Use in Current BHA Only');
  expect(screen.getByLabelText('Blade length (ft)')).toHaveAccessibleDescription(/no greater/);
  expect(screen.getByLabelText('Blade OD (in)')).toHaveAccessibleDescription(/at least body OD/);
  expect(screen.getByLabelText('ID (in)')).toHaveAccessibleDescription(/body OD > ID/);
  expect(screen.getByLabelText('Nominal linear weight (lb/ft)')).toHaveAccessibleDescription(/positive/); expect(current.rows).toEqual([row]);
});

test('full-length blades are valid with zero end-body preview spans and no zero-length stored segments', () => {
  render(<Harness />); fillStabilizer(); edit('Blade length (ft)', '10'); edit('Blade OD (in)', '6'); edit('ID (in)', '0'); click('Use in Current BHA Only');
  expect(current.projectComponents[0].geometry.segments.map(s => s.length)).toEqual([10]); expect(current.rows[1].weight).toBe('80');
});

test('manual override retains non-standard sections and does not recentre after reload/edit', () => {
  render(<Harness />); fillStabilizer(); advanced(); fireEvent.click(screen.getByLabelText('Override centred blade geometry (manual)'));
  edit('Segment 1 Length (ft)', '3'); edit('Segment 3 Length (ft)', '5');
  expect(screen.getByLabelText('Component section idealization')).toBeDisabled();
  click('Save to My Library'); const before = JSON.stringify(current.rows[1]);
  expect(loadMyComponents()[0].geometry.segments.map(s => Number(s.length))).toEqual([3, 2, 5]);
  click('Reopen'); click('Manage Components'); click('Edit definition'); advanced();
  expect(screen.getByLabelText('Override centred blade geometry (manual)')).toBeChecked(); expect(screen.getByLabelText('Segment 1 Length (ft)')).toHaveValue('3');
  edit('Segment 1 Length (ft)', '2'); edit('Segment 3 Length (ft)', '6'); click('Save to My Library');
  expect(JSON.stringify(current.rows[1])).toBe(before); expect(loadMyComponents()[0].geometry.segments.map(s => Number(s.length))).toEqual([2, 2, 6]);
});

test('legacy stabilizer definitions open in manual mode without inferring body/blade dimensions from legacy OD', () => {
  saveMyComponents([{ id: 'legacy-stb', name: 'Legacy stabilizer', category: 'STB', source: 'my', length: 10, od: 8, idSize: 2, weight: 80, material: { name: 'Unspecified' }, geometry: { kind: 'uniform', segments: [] } }]);
  render(<Harness />); click('Manage Components'); click('Edit definition');
  expect(screen.queryByLabelText('Blade OD (in)')).not.toBeInTheDocument(); advanced(); expect(screen.getByLabelText('Override centred blade geometry (manual)')).toBeChecked();
  click('Save to My Library'); expect(loadMyComponents()[0].od).toBe(8); expect(loadMyComponents()[0].geometry.kind).toBe('uniform'); expect(current.rows).toEqual([row]);
});

test('explicit invalid material/effective properties retain existing validation, with no blade-based calculated weight', () => {
  render(<Harness />); fillStabilizer(); advanced(); edit('Component Material', ''); click('Save to My Library');
  expect(screen.getByLabelText('Component Material')).toHaveAccessibleDescription(/material name/); edit('Component Material', 'User steel'); edit('Component Material density (lb/ft³, optional)', '490');
  expect(screen.queryByText(/Material weight:/)).not.toBeInTheDocument(); expect(screen.queryByText(/nominal weight differs/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Explicit effective properties for a complex tool')); edit('Effective axial rigidity EA (lbf, optional)', '1000'); click('Save to My Library');
  expect(screen.getByLabelText('Effective property provenance')).toHaveAccessibleDescription(/provenance and limitations/); expect(current.rows).toEqual([row]);
});
