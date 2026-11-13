import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BHABuilder from './BHABuilder';
import ComponentLibrary from './ComponentLibrary';
import ComponentEditorContext from './ComponentEditorContext';
import { COMPONENT_STORAGE_KEY, loadMyComponents, saveMyComponents, getResolvedStandardComponent } from '../../Apps/BHAEntry/componentStore';
import catalogue from '../../data/components.json';

const original = { rowId: 'original', toolName: 'Existing', category: 'DC', length: 10, od: 5, idSize: 3, weight: 40, quantity: 2, orientation: 'surface-to-bottom', customMetadata: 'retain' };
let current;
function Harness() {
  const [bha, setBha] = React.useState({ name: 'Keep BHA', holeSize: 8.5, rows: [original] }), [open, setOpen] = React.useState(false); current = bha;
  const update = patch => setBha(v => ({ ...v, ...patch }));
  return <ComponentEditorContext.Provider value={() => setOpen(true)}>
    <BHABuilder bha={bha} updateBha={update} updateRow={(id, patch) => setBha(v => ({ ...v, rows: v.rows.map(r => r.rowId === id ? { ...r, ...patch } : r) }))} />
    {open && <ComponentLibrary bha={bha} updateBha={update} onClose={() => setOpen(false)} />}
  </ComponentEditorContext.Provider>;
}
const click = text => fireEvent.click(screen.getByRole('button', { name: text, exact: true }));
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const open = () => click('+ Library Component');
const manage = source => { open(); click('Manage Components'); change('Source', source); };
const advanced = () => fireEvent.click(screen.getByText('Advanced Properties'));
function fill() {
  change('Component name', 'Custom crossover'); change('Component Length (ft)', '10'); change('Component OD (in)', '5');
  change('Component ID (in)', '3'); change('Component Nominal linear weight (lb/ft)', '40'); advanced(); change('Component Material', 'User steel');
}
beforeEach(() => localStorage.clear());

test('BHA entry contains only the Add action and existing controls; no editor or search panel until launched', () => {
  render(<Harness />); expect(screen.queryByLabelText('Component name')).not.toBeInTheDocument();
  expect(screen.queryByText('Component Library')).not.toBeInTheDocument(); expect(screen.queryByLabelText('Search components')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Component 1 type')).toHaveValue('DC'); expect(screen.getByLabelText('Component 1 od')).toHaveValue('5');
});

test('project-only creation closes editor and immediately selects a deep snapshot without losing existing rows', () => {
  render(<Harness />); open(); fill(); click('Use in Current BHA Only');
  expect(current.name).toBe('Keep BHA'); expect(current.rows[0]).toEqual(original);
  expect(current.rows[1].componentDefinition).toEqual(current.projectComponents[0]); expect(loadMyComponents()).toEqual([]);
  expect(screen.queryByLabelText('Component name')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Component 2 tool')).toHaveValue(current.rows[1].selectedToolId);
  manage('project'); click('Save to My Library'); expect(loadMyComponents()[0].name).toBe('Custom crossover');
  expect(loadMyComponents()[0].id).not.toBe(current.projectComponents[0].id);
});

test('library edit leaves snapshots unchanged until explicit row replacement; deletion retains snapshot selector', () => {
  render(<Harness />); open(); fill(); click('Save to My Library');
  const old = JSON.stringify(current.rows[1]); manage('my'); click('Edit definition'); advanced();
  change('Component Nominal linear weight (lb/ft)', '50'); change('Component name', 'Updated crossover'); click('Save to My Library');
  expect(JSON.stringify(current.rows[1])).toBe(old); expect(loadMyComponents()[0].weight).toBe('50');
  expect(within(screen.getByLabelText('Component 2 tool')).getByRole('option', { name: 'Custom crossover' })).toBeInTheDocument();
  manage('my'); change('Component placement', `replace:${current.rows[1].rowId}`); click('Use / explicitly update selected row');
  expect(current.rows[1].weight).toBe('50'); expect(current.rows.map(r => r.rowId)).toEqual(['original', JSON.parse(old).rowId]);
  manage('my'); click('Remove definition'); expect(loadMyComponents()).toEqual([]);
  expect(screen.getByText('Updated crossover (saved snapshot)')).toBeInTheDocument();
});

test('replacement preserves orientation/quantity/metadata; cancel preserves BHA and unsaved row edits', () => {
  render(<Harness />); open(); const before = JSON.stringify(current); click('Cancel'); expect(JSON.stringify(current)).toBe(before);
  open(); fill(); change('Component 1 weight', '41'); change('Component placement', 'replace:original'); click('Use in Current BHA Only');
  expect(current.rows).toHaveLength(1); expect(current.rows[0]).toMatchObject({ rowId: 'original', quantity: 2, orientation: 'surface-to-bottom', customMetadata: 'retain' });
});

test('insert-before preserves latest BHA edits; Type/Tool dropdowns select newly created definitions', () => {
  render(<Harness />); open(); fill(); change('Component placement', 'before:original'); change('Component 1 weight', '41'); click('Save to My Library');
  expect(current.rows[1]).toEqual({ ...original, weight: '41' }); expect(current.rows[0].toolName).toBe('Custom crossover');
  change('Component 2 type', 'OTHER'); change('Component 2 tool', loadMyComponents()[0].id);
  expect(current.rows[1].toolName).toBe('Custom crossover'); expect(current.rows[1].componentDefinition.id).toBe(current.rows[0].componentDefinition.id);
});

test('cross-source copies use independent IDs and leave placed instances unchanged', () => {
  render(<Harness />); open(); fill(); click('Use in Current BHA Only'); const projectId = current.projectComponents[0].id;
  manage('project'); click('Edit definition'); click('Save to My Library');
  expect(loadMyComponents()[0].id).not.toBe(projectId); expect(current.projectComponents[0].id).toBe(projectId); expect(current.rows[1].selectedToolId).toBe(projectId);
});

test('segmented editor retains validation, length tolerance, order and read-only row geometry', () => {
  render(<Harness />); open(); fill(); change('Geometry', 'segmented');
  for (let i = 1; i <= 2; i++) {
    click('Add segment'); change(`Segment ${i} Length (ft)`, i === 1 ? '4' : '5'); change(`Segment ${i} OD (in)`, i === 1 ? '5' : '4'); change(`Segment ${i} ID (in)`, '2');
    fireEvent.change(within(screen.getByRole('group', { name: `Segment ${i} (bit to surface)` })).getByLabelText('Segment label'), { target: { value: i === 1 ? 'Bit end' : 'Surface end' } });
  }
  click('Use in Current BHA Only'); expect(screen.getByLabelText('Geometry')).toHaveAccessibleDescription(/sum/); expect(current.rows).toHaveLength(1);
  change('Segment 2 Length (ft)', '6'); click('Use in Current BHA Only');
  expect(current.rows[1].componentDefinition.geometry.segments.map(s => s.label)).toEqual(['Bit end', 'Surface end']); expect(screen.getByLabelText('Component 2 length')).toHaveAttribute('readonly');
});

test('validation is quiet before Save, then errors are associated with fields and advanced opens', () => {
  render(<Harness />); open(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(document.querySelector('.componentAdvanced')).not.toHaveAttribute('open'); click('Save to My Library');
  expect(screen.getByLabelText('Component name')).toHaveAccessibleDescription('Component name is required.');
  expect(screen.getByLabelText('Component Length (ft)')).toHaveAccessibleDescription(/length must/);
  expect(screen.getByLabelText('Component Material')).toHaveValue('Unspecified'); expect(document.querySelector('.componentAdvanced')).toHaveAttribute('open');
});

test('corrupt library and quota failures preserve stored data, BHA and the editor', () => {
  localStorage.setItem(COMPONENT_STORAGE_KEY, '{bad'); const view = render(<Harness />); open(); fill(); click('Save to My Library');
  expect(screen.getByRole('alert')).toHaveTextContent(/preserved/); expect(localStorage.getItem(COMPONENT_STORAGE_KEY)).toBe('{bad'); expect(current.rows).toHaveLength(1);
  view.unmount(); localStorage.clear(); render(<Harness />); open(); fill();
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
  try { click('Save to My Library'); expect(screen.getByRole('alert')).toHaveTextContent('Quota exceeded'); expect(screen.getByLabelText('Component name')).toHaveValue('Custom crossover'); expect(current.rows).toHaveLength(1); }
  finally { write.mockRestore(); }
});

test('definitions reload and management retains duplicate, search, filtering and read-only standards', () => {
  saveMyComponents([{ id: 'custom-reload', source: 'my', schemaVersion: 1, name: 'Persisted', category: 'DC', length: 10, od: 5, idSize: 3, weight: 40, material: { name: 'User steel' } }]);
  const view = render(<Harness />); expect(screen.getByLabelText('Component 1 tool')).toContainHTML('Persisted'); view.unmount(); render(<Harness />);
  manage('my'); change('Search components', 'Persisted'); click('Duplicate'); expect(screen.getByLabelText('Component name')).toHaveValue('Persisted Copy');
  click('Save to My Library'); expect(loadMyComponents()).toHaveLength(2); expect(new Set(loadMyComponents().map(c => c.id)).size).toBe(2);
  manage('standard'); expect(screen.queryByText('Edit definition')).not.toBeInTheDocument(); expect(screen.queryByText('Remove definition')).not.toBeInTheDocument();
  change('Filter type', 'HWDP'); expect(screen.getAllByText('Duplicate').length).toBeGreaterThan(0);
});

test('standard PDC structural properties are editable, persistent, and reset without changing its catalogue dimensions', () => {
  const original = JSON.stringify(catalogue.components.find(component => component.id === 'bha-187'));
  render(<Harness />); manage('standard'); change('Filter type', 'BIT'); change('Search components', '8.5-inch PDC Drill Bit');
  fireEvent.click(screen.getByRole('button', { name: 'Edit BIT structural properties' }));
  change('Structural body / fishneck OD (in)', '6'); change('Structural bore ID (in)', '2.5');
  change('Material density (kg/m³)', '7850'); change("Young's modulus (GPa)", '200');
  change('Structural-property source', 'illustrative'); change('Notes / provenance reference', 'Illustrative fishneck assumption for testing.');
  click('Save BIT properties');
  expect(getResolvedStandardComponent('bha-187').bitStructuralProperties).toMatchObject({ bodyOdIn: '6', boreIdIn: '2.5', densityKgM3: '7850', youngsModulusGPa: '200', provenanceType: 'illustrative' });
  expect(JSON.stringify(catalogue.components.find(component => component.id === 'bha-187'))).toBe(original);
  manage('standard'); change('Filter type', 'BIT'); change('Search components', '8.5-inch PDC Drill Bit'); click('Reset to standard');
  expect(getResolvedStandardComponent('bha-187').bitStructuralProperties).toBeUndefined();
});
