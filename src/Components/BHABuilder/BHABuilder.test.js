import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BHABuilder from './BHABuilder';
import AnalysisInputs from '../../Apps/AnalysisInputs/AnalysisInputs';
import ComponentEditorContext from './ComponentEditorContext';
import { bhaReadinessKey } from './bhaReadiness';

const bha = { rows: [{ rowId: 'dc', category: 'DC', length: '965', weight: '100', od: '8', idSize: '3', selectedToolId: '', toolName: '' }, { rowId: 'dp', category: 'DP', length: '11035', weight: '20', od: '5', idSize: '4', selectedToolId: '', toolName: '' }] };
const props = { updateBha: jest.fn(), updateRow: jest.fn(), addRow: jest.fn(), removeRow: jest.fn(), reorderRows: jest.fn() };
beforeEach(() => jest.clearAllMocks());

test('incomplete editing stays quiet, explicit invalid edits validate automatically, and final validation is available to Run Analysis', () => {
  const partial = { ...bha, holeSize: 8.5, rows: [{ ...bha.rows[0], selectedToolId: '', od: '', idSize: '', length: '', weight: '' }, bha.rows[1]] };
  const view = render(<BHABuilder bha={partial} {...props} />);
  expect(screen.queryByText(/Every fixed component/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Row 1:/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Component 1 od').closest('tr')).toHaveAttribute('data-row-state', 'incomplete');
  view.rerender(<BHABuilder bha={{ ...partial, rows: [{ ...partial.rows[0], selectedToolId: 'dc', od: 6.5, weight: 92 }, bha.rows[1]] }} {...props} />);
  expect(screen.queryByText(/Row 1:/)).not.toBeInTheDocument();
  const incompleteBha = { ...partial, rows: [{ ...partial.rows[0], selectedToolId: 'dc', od: 6.5, weight: 92 }, bha.rows[1]] };
  view.rerender(<BHABuilder bha={incompleteBha} bhaValidationRequest={bhaReadinessKey(incompleteBha)} {...props} />);
  expect(screen.getByText('Row 1: Enter its length.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Check BHA' })).not.toBeInTheDocument();
});

test('Library Component button below the table opens the existing library flow', () => {
  const openLibrary = jest.fn();
  render(<ComponentEditorContext.Provider value={openLibrary}><BHABuilder bha={bha} {...props} /></ComponentEditorContext.Provider>);
  const button = screen.getByRole('button', { name: '+ Library Component' });
  expect(button.closest('.bhaTableActions')).not.toBeNull();
  expect(within(button.parentElement).getAllByRole('button').map(action => action.textContent.trim())).toEqual(['Insert Row', '+ Library Component']);
  fireEvent.click(button);
  expect(openLibrary).toHaveBeenCalledTimes(1);
});

test('explicit invalid length has a compact accessible input indication and concise summary outside the table', () => {
  render(<BHABuilder bha={{ ...bha, rows: [{ ...bha.rows[0], length: -1 }] }} {...props} />);
  const input = screen.getByLabelText('Component 1 length');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Enter a positive length (ft).');
  expect(input.closest('td').children).toHaveLength(1);
  expect(screen.getByText('Row 1: Enter a positive length (ft).').closest('td')).toBeNull();
});

test('defers row errors while a numeric field is focused and restores validation on blur', () => {
  render(<BHABuilder bha={{ ...bha, rows: [{ ...bha.rows[0], length: '-' }] }} {...props} />);
  const input = screen.getByLabelText('Component 1 length');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('Row 1: Enter a positive length (ft).')).toBeInTheDocument();
  fireEvent.focus(input);
  expect(input).not.toHaveAttribute('aria-invalid');
  expect(screen.queryByText('Row 1: Enter a positive length (ft).')).not.toBeInTheDocument();
  fireEvent.blur(input);
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('Row 1: Enter a positive length (ft).')).toBeInTheDocument();
});

test('compact layout retains editing/actions and contains Auto controls inside Length', () => {
  const longName = 'A long descriptive tool name that must remain available without widening its column';
  render(<BHABuilder bha={{ ...bha, holeSize: 8.5, drillpipeReferenceBitMdFt: 5000,
    rows: [{ ...bha.rows[0], toolName: longName }, { ...bha.rows[1], lengthMode: 'auto' }] }} {...props} />);
  expect(screen.queryByText('Editing help')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Bit Size (in)').closest('.bhaTopInputs')).toBe(screen.getByLabelText('MD (ft)').closest('.bhaTopInputs'));
  expect(screen.getByLabelText('Component 1 tool')).not.toHaveAttribute('title');
  expect(screen.queryByLabelText('Component 1 nominal radial clearance')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Drillpipe length mode 2').closest('.bhaDepthMode')).toBe(screen.getByLabelText('MD (ft)').closest('.bhaDepthMode'));
  expect(screen.getByLabelText('Drillpipe length mode 2').closest('tr')).toBeNull();
  fireEvent.change(screen.getByLabelText('Component 1 od'), { target: { value: '7.75' } });
  expect(props.updateRow).toHaveBeenCalledWith('dc', { od: '7.75' });
  fireEvent.click(screen.getByText('Insert Row')); expect(props.addRow).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '+ Library Component' })).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Delete component 1')); expect(props.removeRow).toHaveBeenCalledWith('dc');
  expect(screen.getByLabelText('Move component 1')).toHaveAttribute('tabindex', '0');
});

test('Bit Size stays authoritative without duplicating Hole Size in Parameter Entry', () => {
  function Shared() {
    const [value, setValue] = React.useState({ ...bha, name: '', holeSize: '8.5', mudWeight: '', wob: '' });
    const update = changes => setValue(old => ({ ...old, ...changes }));
    return <><BHABuilder {...props} bha={value} updateBha={update} /><AnalysisInputs bha={value} updateBha={update} /></>;
  }
  render(<Shared />);
  expect(screen.queryByLabelText('Hole Size')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Bit Size (in)'), { target: { value: '12.25' } });
  expect(screen.queryByLabelText('Hole Size')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Bit Size (in)')).toHaveValue('12.25');
  fireEvent.change(screen.getByLabelText('Bit Size (in)'), { target: { value: '' } });
  expect(screen.queryByLabelText('Hole Size')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Bit Size (in)')).toHaveValue(null);
});

test('Bit Size edits the persistent shared hole diameter and reports clearance/oversize', () => {
  const { rerender } = render(<BHABuilder bha={bha} {...props} />);
  expect(screen.getByLabelText('Bit Size (in)')).toHaveValue('');
  expect(screen.getAllByText('Not Configured').length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Bit Size (in)'), { target: { value: '8.5' } });
  expect(props.updateBha).toHaveBeenCalledWith({ holeSize: '8.5' });
  rerender(<BHABuilder bha={{ ...bha, holeSize: '8.5' }} {...props} />);
  expect(screen.getByLabelText('Bit Size (in)')).toHaveValue('8.5');
  expect(screen.queryByText('0.250 in radial')).not.toBeInTheDocument();
  rerender(<BHABuilder bha={{ ...bha, holeSize: '7' }} {...props} />);
  expect(screen.getByLabelText('Component 1 od')).toHaveAttribute('title', 'Component OD exceeds nominal hole.');
  expect(screen.getByLabelText('Component 1 od')).toHaveAttribute('aria-invalid', 'true');
  rerender(<BHABuilder bha={{ ...bha, holeSize: '-1' }} {...props} />);
  expect(screen.getByLabelText('Bit Size (in)')).toHaveAttribute('aria-invalid', 'true');
});

test('gauge bit passes readiness, hides legacy Bit ID metadata, and displays read-only cumulative length', () => {
  const bit = { rowId: 'bit', category: 'BIT', bitId: 'PDC-001', toolName: '8.5 in PDC', selectedToolId: '', od: '8.5', idSize: '0.5', weight: '50', length: '1' };
  const makeBha = (rows) => ({ ...bha, holeSize: '8.5', rows });
  const { rerender } = render(<BHABuilder bha={makeBha([bit, { ...bha.rows[0], rowId: 'dc', category: 'DC', length: '9.8' }])} {...props} />);
  expect(screen.getByLabelText('Component 1 od')).not.toHaveAttribute('aria-invalid');
  expect(screen.getByLabelText('Cumulative length 1')).toHaveValue('1.00');
  expect(screen.getByLabelText('Cumulative length 2')).toHaveValue('10.80');
  expect(screen.getByLabelText('Cumulative length 1')).toHaveAttribute('readonly');
  expect(screen.queryByLabelText('Bit ID component 1')).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Optional identifier')).not.toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: /CUM/ })).toBeInTheDocument();
  rerender(<BHABuilder bha={makeBha([{ ...bit, length: '1.25' }, { ...bha.rows[0], rowId: 'dc', category: 'DC', length: '9.8' }])} {...props} />);
  expect(screen.getByLabelText('Cumulative length 2')).toHaveValue('11.05');
  rerender(<BHABuilder bha={makeBha([{ ...bha.rows[0], rowId: 'dc', category: 'DC', length: '9.8' }, bit])} {...props} />);
  expect(screen.getByLabelText('Cumulative length 1')).toHaveValue('9.80');
  expect(screen.getByLabelText('Cumulative length 2')).toHaveValue('10.80');
});

test('legacy bit metadata is hidden while component ID (in) remains the inner diameter', () => {
  const bit = { ...bha.rows[0], category: 'BIT', selectedToolId: 'saved-bit-spec', toolName: 'Existing generic bit specification', bitId: 'PDC-001', length: '1', od: '8.5' };
  render(<BHABuilder bha={{ ...bha, holeSize: '8.5', rows: [bit] }} {...props} />);
  const type = screen.getByLabelText('Component 1 type');
  expect(within(type).getByRole('option', { name: 'BIT' })).toBeInTheDocument();
  const tool = screen.getByLabelText('Component 1 tool');
  expect(tool).toHaveValue('saved-bit-spec');
  expect(screen.queryByLabelText('Bit ID component 1')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Component 1 idSize')).toHaveValue('0.5');
});

test('changing a BIT row type does not rewrite an existing legacy identifier', () => {
  const bit = { ...bha.rows[0], rowId: 'new-bit', category: 'DC', selectedToolId: '', toolName: '' };
  const { rerender } = render(<BHABuilder bha={{ ...bha, rows: [bit] }} {...props} />);
  fireEvent.change(screen.getByLabelText('Component 1 type'), { target: { value: 'BIT' } });
  expect(props.updateRow).toHaveBeenCalledWith('new-bit', expect.not.objectContaining({ bitId: expect.anything() }));
  const existing = { ...bit, category: 'BIT', bitId: 'MY-BIT-7', selectedToolId: 'old', toolName: 'Old bit' };
  rerender(<BHABuilder bha={{ ...bha, holeSize: 8.5, rows: [existing] }} {...props} />);
  fireEvent.change(screen.getByLabelText('Component 1 tool'), { target: { value: 'bha-2' } });
  expect(props.updateRow.mock.calls.at(-1)[1]).not.toHaveProperty('bitId');
  expect(existing.bitId).toBe('MY-BIT-7');
});

test('switching the OES-sized TCI row to the matching PDC library bit preserves its instance geometry and entered weight', () => {
  const bit = { rowId: 'oes-bit', category: 'BIT', selectedToolId: 'bha-9', toolName: 'BIT TCI Smith 8.5in - 95 #',
    od: '8.5', idSize: '', weight: '95', length: '1' };
  render(<BHABuilder bha={{ ...bha, holeSize: '8.5', rows: [bit] }} {...props} />);
  fireEvent.change(screen.getByLabelText('Component 1 tool'), { target: { value: 'bha-187' } });
  expect(props.updateRow).toHaveBeenCalledWith('oes-bit', expect.objectContaining({
    selectedToolId: 'bha-187', toolName: '8.5-inch PDC Drill Bit', od: '8.5', idSize: '', weight: '95', length: '1'
  }));
});

test('segmented STB properties are editable on the row, keep the library snapshot, and show an override notice', () => {
  const stb = { rowId: 'stb', category: 'STB', selectedToolId: 'custom-stb', toolName: 'Library STB', od: '6', idSize: '2', weight: '80', length: '10',
    componentDefinition: { id: 'custom-stb', name: 'Library STB', category: 'STB', od: '6', idSize: '2', weight: '80', length: '10', geometry: { kind: 'segmented', segments: [{ length: 4 }, { length: 2 }, { length: 4 }] } },
    librarySpecification: { od: '6', idSize: '2', weight: '80', length: '10' } };
  const { rerender } = render(<BHABuilder bha={{ ...bha, rows: [stb] }} {...props} />);
  fireEvent.change(screen.getByLabelText('Component 1 od'), { target: { value: '6.25' } });
  expect(props.updateRow).toHaveBeenCalledWith('stb', expect.objectContaining({ od: '6.25', componentDefinition: expect.objectContaining({ od: '6.25' }) }));
  expect(screen.getByLabelText('Component 1 od')).not.toHaveAttribute('readonly');
  for (const field of ['idSize', 'weight', 'length']) expect(screen.getByLabelText(`Component 1 ${field}`)).not.toHaveAttribute('readonly');
  rerender(<BHABuilder bha={{ ...bha, rows: [{ ...stb, od: '6.25', componentDefinition: { ...stb.componentDefinition, od: '6.25' } }] }} {...props} />);
  expect(screen.getByText(/Edited from library specification/)).toBeInTheDocument();
  expect(stb.componentDefinition.od).toBe('6');
  expect(screen.getByLabelText('Cumulative length 1')).toHaveClass('bhaCumulativeInput');
});

test('engineering summary uses component geometry, excludes DP, displays two decimals, and sits in the top input area', () => {
  const rows = [
    { ...bha.rows[0], rowId: 'bit', category: 'BIT', length: '1', weight: '20' },
    { ...bha.rows[0], rowId: 'stb', category: 'STB', length: '114.53', weight: '20' },
    { ...bha.rows[0], rowId: 'lower-dc', category: 'DC', length: '509.77', weight: '100' },
    { ...bha.rows[0], rowId: 'jar', category: 'JAR', length: '33', weight: '100' },
    { ...bha.rows[0], rowId: 'upper-dc', category: 'DC', length: '89.96', weight: '100' },
    { ...bha.rows[0], rowId: 'hwdp', category: 'HWDP', length: '274.63', weight: '50' },
    { ...bha.rows[1], rowId: 'dp', category: 'DP', length: '200', weight: '20' }
  ];
  render(<BHABuilder bha={{ ...bha, rows }} {...props} />);
  const panel = screen.getByRole('region', { name: 'BHA engineering summary' });
  expect(panel.parentElement).toHaveClass('bhaTopInputs');
  expect(panel.querySelector('.bhaEngineeringSummaryGrid')).toHaveClass('bhaEngineeringSummaryGrid');
    expect(within(panel).getByRole('table')).toBeInTheDocument();
    expect(within(panel).getByRole('columnheader', { name: 'Length (ft)' })).toBeInTheDocument();
    expect(within(panel).getByRole('columnheader', { name: /Buoyed \(klbf\)/ })).toBeInTheDocument();
    expect(within(panel).getByRole('columnheader', { name: /Axial \(klbf\)/ })).toBeInTheDocument();
  expect(panel).toHaveTextContent('1,022.89');
  expect(panel).toHaveTextContent('625.30');
  expect(panel).toHaveTextContent('509.77');
  expect(panel).toHaveTextContent('89.96');
  expect(screen.getByLabelText('Component 3 length')).toHaveValue('509.77');
  expect(screen.getByLabelText('Component 5 length')).toHaveValue('89.96');
  expect(panel).not.toHaveTextContent('Jar bottom above bit');
  expect(panel).not.toHaveTextContent('Jar top above bit');
  expect(screen.getByLabelText('Cumulative length 1')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('Cumulative length 1')).not.toBeDisabled();
  expect(screen.getByLabelText('Cumulative length 1')).toHaveClass('bhaCumulativeInput');
    expect(screen.getByLabelText('Buoyed weight information').title).toMatch(/nominal steel buoyancy/);
    expect(screen.queryByText('First jar')).not.toBeInTheDocument();
});

test('BHA Summary starts expanded and collapses from its heading', () => {
  render(<BHABuilder bha={{ ...bha, rows: [{ ...bha.rows[0], category: 'JAR', length: '10' }] }} {...props} />);
  const heading = screen.getByRole('button', { name: /BHA Summary/ });
  expect(heading).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Length (ft)')).toBeInTheDocument();
  expect(screen.queryByText('GEOMETRY')).not.toBeInTheDocument();
  expect(screen.queryByText('WEIGHTS')).not.toBeInTheDocument();
  fireEvent.click(heading);
  expect(heading).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Length (ft)')).not.toBeVisible();
  fireEvent.click(heading);
  expect(heading).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Length (ft)')).toBeVisible();
});

test('engineering summary formats weight values to two decimals and shows survey-projected axial weights', () => {
  const component = (rowId, category, length) => ({ rowId, category, toolName: category, length: String(length), weight: '100',
    componentDefinition: { material: { name: 'Explicit steel', densityLbFt3: '490' } } });
  const weightBha = { mudWeight: '10', trajectoryMode: 'directional', surveyState: { active: { confirmed: true,
    originalCsv: 'MD,Inclination,Azimuth\n0,60,0\n100,60,0\n200,60,0\n500,60,0' }, history: [], reviewRequired: false },
    rows: [component('bit', 'BIT', 1), component('dc', 'DC', 9), component('jar', 'JAR', 10)] };
  render(<BHABuilder bha={weightBha} {...props} />);
  const panel = screen.getByRole('region', { name: 'BHA engineering summary' });
  expect(panel).toHaveTextContent('1.69 klbf');
  expect(panel).toHaveTextContent('0.85 klbf');
});

test.each(['', '   ', undefined, null])('unfinished OD %s has no technical message or error styling', od => {
  render(<BHABuilder bha={{ holeSize: 8.5, rows: [{ ...bha.rows[0], od: od ?? '', length: '', idSize: '', weight: '', selectedToolId: '' }] }} {...props} />);
  const input = screen.getByLabelText('Component 1 od');
  expect(input).not.toHaveAttribute('aria-invalid'); expect(input).not.toHaveAttribute('title');
  expect(input.closest('td').children).toHaveLength(1);
  expect(screen.queryByText('Component OD must be a finite positive diameter.')).not.toBeInTheDocument();
});

test.each(['0', '-1', 'abc', 'Infinity', '8.5', '9'])('entered invalid/unclear OD %s uses a tooltip without adding cell content', od => {
  render(<BHABuilder bha={{ holeSize: 8.5, rows: [{ ...bha.rows[0], od }] }} {...props} />);
  const input = screen.getByLabelText('Component 1 od');
  expect(input).toHaveAttribute('aria-invalid', 'true'); expect(input.title).not.toBe('');
  expect(input).toHaveAccessibleDescription(input.title);
  expect(input.closest('td').children).toHaveLength(1);
  expect(input.closest('td').textContent).toBe('');
});

test('correcting or clearing OD removes its tooltip and invalid indication', () => {
  const data = od => ({ holeSize: 8.5, rows: [{ ...bha.rows[0], od }] });
  const view = render(<BHABuilder bha={data('abc')} {...props} />);
  expect(screen.getByLabelText('Component 1 od')).toHaveAttribute('aria-invalid', 'true');
  for (const od of ['6.5', '']) {
    view.rerender(<BHABuilder bha={data(od)} {...props} />);
    expect(screen.getByLabelText('Component 1 od')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Component 1 od')).not.toHaveAttribute('title');
  }
});

test('legacy/manual DP stays editable; switching mode stores metadata without replacing manual length', () => {
  render(<BHABuilder bha={bha} {...props} />);
  expect(screen.getByRole('button', { name: 'Defined' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('11,035');
  fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
  expect(props.updateRow).toHaveBeenCalledWith('dp', { lengthMode: 'auto' });
  expect(screen.getByLabelText('MD (ft)')).toHaveAttribute('readonly');
  expect(bha.rows[1].length).toBe('11035');
});

test('Auto needs explicit reference, responds to depth/fixed lengths and restores saved Manual value', () => {
  const auto = { ...bha, rows: bha.rows.map(r => r.category === 'DP' ? { ...r, lengthMode: 'auto' } : r) };
  const { rerender } = render(<BHABuilder bha={auto} {...props} />);
  expect(screen.queryByText(/Supply an explicit bit MD/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Supply an explicit bit MD/)).not.toBeInTheDocument();
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 3320 }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('2,355');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 5000 }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('4,035');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 5000, rows: [{ ...auto.rows[0], length: 1000 }, auto.rows[1]] }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('4,000');
  rerender(<BHABuilder bha={bha} {...props} />);
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('11,035');
});

test('segmented DP switch preserves Defined length and recalculates locked Auto field from renamed reference', () => {
  function Editor() {
    const [value, setValue] = React.useState({ ...bha, holeSize: 12.25, drillpipeReferenceBitMdFt: 12000,
      rows: [{ ...bha.rows[0], length: '515' }, { ...bha.rows[1], length: '9000', lengthMode: 'auto' }] });
    return <BHABuilder {...props} bha={value} updateBha={changes => setValue(old => ({ ...old, ...changes }))}
      updateRow={(id, changes) => setValue(old => ({ ...old, rows: old.rows.map(r => r.rowId === id ? { ...r, ...changes } : r) }))} />;
  }
  render(<Editor />);
  expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('MD (ft)')).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('11,485');
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveAttribute('readonly');
  fireEvent.change(screen.getByLabelText('MD (ft)'), { target: { value: '10000' } });
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('9,485');
  fireEvent.click(screen.getByRole('button', { name: 'Defined' }));
  expect(screen.getByRole('button', { name: 'Defined' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('MD (ft)')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('9,515');
  fireEvent.change(screen.getByLabelText('MD (ft)'), { target: { value: '7000' } });
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('9,515');
  expect(screen.getByLabelText('Component 2 length')).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('9,000');
  fireEvent.change(screen.getByLabelText('Component 2 length'), { target: { value: '8000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
  expect(screen.getByLabelText('MD (ft)')).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('10,000');
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('9,485');
  fireEvent.click(screen.getByRole('button', { name: 'Defined' }));
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('8,000');
  expect(screen.queryByText(/Defined Bit MD/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('8,515');
});
