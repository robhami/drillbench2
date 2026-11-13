import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StaticJarPosition from './StaticJarPosition';
import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';

const source = { confirmed: true, filename: 'Actual directional stations.csv', originalCsv: 'MD,Inclination,Azimuth\n' + live.survey.stations.map(s => [s.mdFt, s.inclinationDeg, s.azimuthDeg].join(',')).join('\n') };
const bha = { ...live.bha, surveyState: { version: 1, active: source, history: [] } };

test('retained static placement component reports static-only candidate results without mutating the BHA', () => {
  const original = JSON.stringify(bha), updateBha = jest.fn();
  render(<StaticJarPosition bha={bha} updateBha={updateBha} drillingMode="slide" />);
  expect(screen.getByRole('button', { name: 'Run Static Screening' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Run Static Screening' }));
  expect(screen.getByRole('table', { name: 'Static jar position results' })).toBeInTheDocument();
  expect(screen.getByText(/Static drilling load does not establish jar firing/)).toBeInTheDocument();
  expect(updateBha).not.toHaveBeenCalled();
  expect(JSON.stringify(bha)).toBe(original);
});

test('retained static placement component blocks unsupported reference mode and missing survey', () => {
  const { rerender } = render(<StaticJarPosition bha={bha} drillingMode="reference" />);
  expect(screen.getByRole('button', { name: 'Run Static Screening' })).toBeDisabled();
  expect(screen.getByText(/Select the shared Slide or Rotate/)).toBeInTheDocument();
  rerender(<StaticJarPosition bha={{ ...bha, surveyState: { version: 1, active: null, history: [] } }} drillingMode="slide" />);
  expect(screen.getByRole('button', { name: 'Run Static Screening' })).toBeDisabled();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
