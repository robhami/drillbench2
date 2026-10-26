import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BHABuilder from './BHABuilder';
import AnalysisInputs from '../../Apps/AnalysisInputs/AnalysisInputs';

const bha = { rows: [{ rowId: 'dc', category: 'DC', length: '965', weight: '100', od: '8', idSize: '3', selectedToolId: '', toolName: '' }, { rowId: 'dp', category: 'DP', length: '11035', weight: '20', od: '5', idSize: '4', selectedToolId: '', toolName: '' }] };
const props = { updateBha: jest.fn(), updateRow: jest.fn(), addRow: jest.fn(), removeRow: jest.fn(), reorderRows: jest.fn() };
beforeEach(() => jest.clearAllMocks());

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
  fireEvent.click(screen.getByLabelText('Delete component 1')); expect(props.removeRow).toHaveBeenCalledWith('dc');
  expect(screen.getByLabelText('Move component 1')).toHaveAttribute('tabindex', '0');
});

test('Bit Size primary editor synchronizes the read-only Analysis Inputs value', () => {
  function Shared() {
    const [value, setValue] = React.useState({ ...bha, name: '', holeSize: '8.5', mudWeight: '', wob: '' });
    const update = changes => setValue(old => ({ ...old, ...changes }));
    return <><BHABuilder {...props} bha={value} updateBha={update} /><AnalysisInputs bha={value} updateBha={update} /></>;
  }
  render(<Shared />);
  fireEvent.change(screen.getByLabelText('Bit Size (in)'), { target: { value: '12.25' } });
  expect(screen.getByLabelText('Hole Size')).toHaveValue('12.25');
  expect(screen.getByLabelText('Hole Size')).toHaveAttribute('readonly');
  fireEvent.change(screen.getByLabelText('Bit Size (in)'), { target: { value: '' } });
  expect(screen.getByLabelText('Hole Size')).toHaveValue('');
  expect(screen.getByLabelText('Hole Size')).toHaveAttribute('placeholder', 'Not Configured');
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
  expect(screen.getByText('Component OD exceeds nominal hole.')).toBeInTheDocument();
  rerender(<BHABuilder bha={{ ...bha, holeSize: '-1' }} {...props} />);
  expect(screen.getByLabelText('Bit Size (in)')).toHaveAttribute('aria-invalid', 'true');
});

test('legacy/manual DP stays editable; switching mode stores metadata without replacing manual length', () => {
  render(<BHABuilder bha={bha} {...props} />);
  expect(screen.getByRole('button', { name: 'Defined' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('11035');
  fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
  expect(props.updateRow).toHaveBeenCalledWith('dp', { lengthMode: 'auto' });
  expect(screen.getByLabelText('MD (ft)')).toHaveAttribute('readonly');
  expect(bha.rows[1].length).toBe('11035');
});

test('Auto needs explicit reference, responds to depth/fixed lengths and restores saved Manual value', () => {
  const auto = { ...bha, rows: bha.rows.map(r => r.category === 'DP' ? { ...r, lengthMode: 'auto' } : r) };
  const { rerender } = render(<BHABuilder bha={auto} {...props} />);
  expect(screen.getByText(/Supply an explicit bit MD/)).toHaveTextContent('explicit bit MD');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 3320 }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('2355');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 5000 }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('4035');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 5000, rows: [{ ...auto.rows[0], length: 1000 }, auto.rows[1]] }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('4000');
  rerender(<BHABuilder bha={bha} {...props} />);
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('11035');
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
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('11485');
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveAttribute('readonly');
  fireEvent.change(screen.getByLabelText('MD (ft)'), { target: { value: '10000' } });
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('9485');
  fireEvent.click(screen.getByRole('button', { name: 'Defined' }));
  expect(screen.getByRole('button', { name: 'Defined' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('MD (ft)')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('10,000');
  fireEvent.change(screen.getByLabelText('MD (ft)'), { target: { value: '7000' } });
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('10,000');
  expect(screen.getByLabelText('Component 2 length')).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('9000');
  fireEvent.change(screen.getByLabelText('Component 2 length'), { target: { value: '8000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
  expect(screen.getByLabelText('MD (ft)')).not.toHaveAttribute('readonly');
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('10,000');
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveValue('9485');
  fireEvent.click(screen.getByRole('button', { name: 'Defined' }));
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('8000');
  expect(screen.queryByText(/Defined Bit MD/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('MD (ft)')).toHaveValue('10,000');
});
