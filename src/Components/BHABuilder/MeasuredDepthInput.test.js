import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MeasuredDepthInput from './MeasuredDepthInput';

function Editor({ readOnly = false, initial = 12000 }) {
  const [value, setValue] = React.useState(initial);
  return <><label>MD (ft)<MeasuredDepthInput value={value} readOnly={readOnly} onChange={setValue} /></label>
    <output data-testid="stored">{JSON.stringify(value)}</output></>;
}

test.each(['15500.25', '15,500.25'])('parses %s to numeric storage and formats on blur', text => {
  render(<Editor />);
  const input = screen.getByLabelText('MD (ft)');
  expect(input).toHaveValue('12,000');
  fireEvent.focus(input);
  expect(input).toHaveValue('12000');
  fireEvent.change(input, { target: { value: text } });
  expect(screen.getByTestId('stored')).toHaveTextContent('15500.25');
  fireEvent.blur(input);
  expect(input).toHaveValue('15,500.25');
});

test('partial decimal editing, deletion and invalid text do not store formatted strings', () => {
  render(<Editor />);
  const input = screen.getByLabelText('MD (ft)');
  fireEvent.focus(input);
  for (const text of ['1', '12.', '12.0', '12.05']) {
    fireEvent.change(input, { target: { value: text } });
    expect(input).toHaveValue(text);
  }
  fireEvent.change(input, { target: { value: 'bad' } });
  expect(screen.getByTestId('stored')).toHaveTextContent('12.05');
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByTestId('stored')).toHaveTextContent('""');
  fireEvent.change(input, { target: { value: '.' } });
  expect(input).toHaveValue('.');
  fireEvent.change(input, { target: { value: '.5' } });
  fireEvent.blur(input);
  expect(input).toHaveValue('0.5');
});

test('Defined locks formatted MD and switching back preserves the numeric reference', () => {
  const { rerender } = render(<Editor initial="15500.125" />);
  const input = screen.getByLabelText('MD (ft)');
  fireEvent.focus(input);
  rerender(<Editor readOnly />);
  expect(input).toHaveAttribute('readonly');
  expect(input).toHaveValue('15,500.125');
  fireEvent.change(input, { target: { value: '20000' } });
  expect(screen.getByTestId('stored')).toHaveTextContent('"15500.125"');
  rerender(<Editor />);
  expect(input).not.toHaveAttribute('readonly');
  expect(input).toHaveValue('15,500.125');
});
