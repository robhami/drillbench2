import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Widget from './Widget';

jest.mock('react-rnd', () => ({ Rnd: ({ children }) => <div>{children}</div> }));
const bha = { name: '', holeSize: '', mudWeight: 10, wob: '', frictionCoefficient: 0.25, rpm: 150, drillpipeReferenceBitMdFt: 12000,
  rows: [{ category: 'JAR', length: 20, weight: 100, od: 6.75 }, { category: 'DP', length: 10000, weight: 20, od: 5.5 }] };

test('real Widget forwards shared depth and its setter to Analysis, and read-only depth to Forces', () => {
  const setAnalysisBitMdFt = jest.fn();
  const props = { bha, analysisBitMdFt: '1000', setAnalysisBitMdFt, widget: { id: 'test', type: 'analysisInputs' } };
  const { rerender } = render(<Widget {...props} />);
  expect(screen.getByLabelText('Bit Depth (ft MD)')).toHaveValue(1000);
  fireEvent.change(screen.getByLabelText('Bit Depth (ft MD)'), { target: { value: '2000' } });
  expect(setAnalysisBitMdFt).toHaveBeenCalledWith('2000');
  rerender(<Widget {...props} analysisBitMdFt="2000" widget={{ id: 'forces', type: 'jarForces' }} />);
  expect(screen.queryByLabelText('Bit Depth (ft MD)')).not.toBeInTheDocument();
  expect(screen.getByText(/Analysis bit MD:/)).toHaveTextContent('2,000.0 ft');
});
