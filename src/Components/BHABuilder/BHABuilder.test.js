import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BHABuilder from './BHABuilder';

const bha = { rows: [{ rowId: 'dc', category: 'DC', length: '965', weight: '100', od: '8', idSize: '3', selectedToolId: '', toolName: '' }, { rowId: 'dp', category: 'DP', length: '11035', weight: '20', od: '5', idSize: '4', selectedToolId: '', toolName: '' }] };
const props = { updateBha: jest.fn(), updateRow: jest.fn(), addRow: jest.fn(), removeRow: jest.fn(), reorderRows: jest.fn() };
beforeEach(() => jest.clearAllMocks());

test('legacy/manual DP stays editable; switching mode stores metadata without replacing manual length', () => {
  render(<BHABuilder bha={bha} {...props} />);
  expect(screen.getByLabelText('Drillpipe length mode 2')).toHaveValue('manual');
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('11035');
  fireEvent.change(screen.getByLabelText('Drillpipe length mode 2'), { target: { value: 'auto' } });
  expect(props.updateRow).toHaveBeenCalledWith('dp', { lengthMode: 'auto' });
  fireEvent.change(screen.getByLabelText('Auto DP reference bit MD (ft)'), { target: { value: '3320' } });
  expect(props.updateBha).toHaveBeenCalledWith({ drillpipeReferenceBitMdFt: '3320' });
  expect(bha.rows[1].length).toBe('11035');
});

test('Auto needs explicit reference, responds to depth/fixed lengths and restores saved Manual value', () => {
  const auto = { ...bha, rows: bha.rows.map(r => r.category === 'DP' ? { ...r, lengthMode: 'auto' } : r) };
  const { rerender } = render(<BHABuilder bha={auto} {...props} />);
  expect(screen.getByText(/Supply an explicit bit MD/)).toHaveTextContent('explicit bit MD');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 3320 }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveTextContent('2,355 ft');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 5000 }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveTextContent('4,035 ft');
  rerender(<BHABuilder bha={{ ...auto, drillpipeReferenceBitMdFt: 5000, rows: [{ ...auto.rows[0], length: 1000 }, auto.rows[1]] }} {...props} />);
  expect(screen.getByLabelText('Calculated drillpipe length 2')).toHaveTextContent('4,000 ft');
  rerender(<BHABuilder bha={bha} {...props} />);
  expect(screen.getByLabelText('Component 2 length')).toHaveValue('11035');
});
