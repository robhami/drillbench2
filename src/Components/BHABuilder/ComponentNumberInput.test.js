import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ComponentNumberInput from './ComponentNumberInput';
import BHABuilder from './BHABuilder';
import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';

test('formatting and focus/blur never write back rounded values', () => {
  const onChange = jest.fn();
  render(<ComponentNumberInput aria-label="Length" value="8435.83202" maximumFractionDigits={1} onChange={onChange} />);
  const input = screen.getByLabelText('Length');
  expect(input).toHaveValue('8,435.8');
  fireEvent.focus(input); expect(input).toHaveValue('8435.83202');
  fireEvent.blur(input); expect(input).toHaveValue('8,435.8');
  expect(onChange).not.toHaveBeenCalled();
});

test('typing partial, invalid and precise values passes through untouched; rounding only on blur', () => {
  const changes = [];
  function Editor() {
    const [value, setValue] = React.useState('31.16798');
    return <ComponentNumberInput aria-label="Length" value={value} maximumFractionDigits={1}
      onChange={e => { changes.push(e.target.value); setValue(e.target.value); }} />;
  }
  render(<Editor />); const input = screen.getByLabelText('Length'); fireEvent.focus(input);
  for (const value of ['', '-', '.', '1.', '1.000000001', 'abc', 'Infinity', '31.167980001']) {
    fireEvent.change(input, { target: { value } }); expect(input).toHaveValue(value);
  }
  expect(changes.at(-1)).toBe('31.167980001');
  fireEvent.blur(input); expect(input).toHaveValue('31.2');
  fireEvent.focus(input); expect(input).toHaveValue('31.167980001');
});

test('empty/invalid data remains visible and external/read-only values use current precision', () => {
  const onChange = jest.fn();
  const view = render(<ComponentNumberInput aria-label="Weight" value="abc" maximumFractionDigits={2} readOnly onChange={onChange} />);
  const input = screen.getByLabelText('Weight'); expect(input).toHaveValue('abc');
  view.rerender(<ComponentNumberInput aria-label="Weight" value={98.99903683203084} maximumFractionDigits={2} readOnly onChange={onChange} />);
  expect(input).toHaveValue('99'); fireEvent.focus(input); expect(input).toHaveValue('99');
  fireEvent.change(input, { target: { value: '12' } }); expect(onChange).not.toHaveBeenCalled();
  fireEvent.blur(input);
  view.rerender(<ComponentNumberInput aria-label="Weight" value="22.326789" maximumFractionDigits={2} readOnly />);
  expect(input).toHaveValue('22.33');
  view.rerender(<ComponentNumberInput aria-label="Weight" value="" maximumFractionDigits={2} readOnly />);
  expect(input).toHaveValue('');
});

test('minimum precision is presentation-only and never changes the stored value', () => {
  const onChange = jest.fn();
  render(<ComponentNumberInput aria-label="Cumulative length" value={10.8} minimumFractionDigits={2} maximumFractionDigits={2} readOnly onChange={onChange} />);
  expect(screen.getByLabelText('Cumulative length')).toHaveValue('10.80');
  expect(onChange).not.toHaveBeenCalled();
});

test('BHA fields format motor and deployed auto DP without changing source, callbacks or OD/ID', () => {
  const before = JSON.stringify(live.bha), updateRow = jest.fn(), updateBha = jest.fn();
  render(<BHABuilder bha={live.bha} updateRow={updateRow} updateBha={updateBha} />);
  const length = screen.getByLabelText('Component 1 length'), dp = screen.getByLabelText('Calculated drillpipe length 5');
  expect(length).toHaveValue('31.2'); expect(dp).toHaveValue('8,435.8');
  expect(screen.getByLabelText('Component 1 weight')).toHaveValue('99');
  expect(screen.getByLabelText('Component 5 weight')).toHaveValue('22.32');
  expect(screen.getByLabelText('Component 1 od')).toHaveValue('6.75');
  expect(screen.getByLabelText('Component 2 idSize')).toHaveValue('2.813');
  fireEvent.focus(length); expect(length).toHaveValue('31.16798'); fireEvent.blur(length);
  fireEvent.focus(dp); expect(dp).toHaveValue('8,435.8'); fireEvent.blur(dp);
  expect(dp).toHaveAttribute('readonly'); expect(dp).toHaveValue('8,435.8');
  expect(updateRow).not.toHaveBeenCalled(); expect(updateBha).not.toHaveBeenCalled();
  expect(JSON.stringify(live.bha)).toBe(before);
});
