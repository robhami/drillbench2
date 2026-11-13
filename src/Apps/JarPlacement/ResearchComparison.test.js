import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import ResearchComparison from './ResearchComparison';
test('hypothetical acknowledgement is required; controls use explicit bounds and fixed mass',()=>{
 render(<ResearchComparison/>);
 expect(screen.getByText('PRELIMINARY — NOT FOR OPERATIONAL USE')).toBeInTheDocument();
 fireEvent.click(screen.getByText('Calculate research comparison'));
 expect(screen.getByRole('alert')).toHaveTextContent('Acknowledge');
 expect(screen.getByLabelText(/Effective hammer mass/)).toHaveAttribute('readonly');
 fireEvent.change(screen.getByLabelText('Baseline position (m)'),{target:{value:'7.25'}});
 expect(screen.getByLabelText('Baseline position (m)')).toHaveValue('7.25');
 fireEvent.change(screen.getByLabelText('Window end (ms)'),{target:{value:'26'}});
 fireEvent.click(screen.getByLabelText(/I acknowledge/));
 fireEvent.click(screen.getByText('Calculate research comparison'));
 expect(screen.getByRole('alert')).toHaveTextContent('0 <= start < end <= 25');
});
test('deselecting every position does not present an empty comparison as complete',()=>{
 render(<ResearchComparison/>);
 fireEvent.click(screen.getAllByRole('checkbox')[3]);
 expect(screen.getByLabelText('Baseline position (m)')).toHaveValue('3.25');
 screen.getAllByRole('checkbox').filter(e=>e.checked).forEach(e=>fireEvent.click(e));
 expect(screen.queryByText(/Comparison complete/)).not.toBeInTheDocument();
});
