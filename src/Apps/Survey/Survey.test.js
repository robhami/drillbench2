import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import Survey, { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from './Survey';
import { readSurveyArchive } from './surveyAssociation';
jest.mock('../JarConfiguration/ConfigurationPlot', () => () => <div data-testid="trajectory-plot" />);

const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
const upload = text => fireEvent.change(screen.getByLabelText('Survey CSV'), { target: { files: [new File([text], 'synthetic.csv', { type: 'text/csv' })] } });
const confirm = () => fireEvent.click(screen.getByRole('checkbox'));
beforeEach(() => localStorage.clear());

test('uploads synthetic survey with explicit units and displays geometry summary and stations', async () => {
  const updateBha = jest.fn();
  localStorage.setItem('drillbenchWell', '{"unchanged":true}');
  render(<Survey updateBha={updateBha} />);
  confirm(); upload(csv);
  await screen.findByText('Valid survey · 41 stations');
  await screen.findAllByTestId('trajectory-plot');
  expect(screen.getByText('0.0–12000.0')).toBeInTheDocument();
  expect(screen.getAllByText('8153.987')).toHaveLength(2);
  expect(screen.getByText('60.00')).toBeInTheDocument();
  expect(screen.getAllByText('3.000').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('row')).toHaveLength(42);
  expect(readSurveyArchive().some(record => record.source.originalCsv === csv)).toBe(true);
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBeNull();
  expect(localStorage.getItem('drillbenchWell')).toBe('{"unchanged":true}');
  expect(updateBha).not.toHaveBeenCalled();
});

test('plots precede import information; external workspace survey updates clear invalid trajectories', async () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ originalCsv: csv, confirmed: true }));
  const view = render(<Survey bha={{ id: 'first' }} />);
  await screen.findAllByTestId('trajectory-plot');
  expect(screen.getByRole('region', { name: 'Survey trajectory visualisations' }).compareDocumentPosition(screen.getByRole('region', { name: 'Survey information and import' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { originalCsv: 'MD,Inclination,Azimuth\n0,wrong,90', confirmed: true } }));
  expect(screen.queryByTestId('trajectory-plot')).not.toBeInTheDocument();
  expect(screen.getByText(/No valid trajectory/)).toBeInTheDocument();
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ originalCsv: csv, confirmed: true }));
  view.rerender(<Survey bha={{ id: 'second' }} />);
  await screen.findAllByTestId('trajectory-plot');
  expect(screen.getByText('Valid survey · 41 stations')).toBeInTheDocument();
});

test('supplied coordinate columns remain in original CSV and are explicitly unreconciled', async () => {
  render(<Survey />); confirm();
  const text = 'MD,Inclination,Azimuth,TVD,Easting,Northing\n0,0,90,500,100,200\n100,0,90,600,100,200';
  upload(text);
  await screen.findByText(/Imported TVD\/coordinate columns/);
  await screen.findAllByTestId('trajectory-plot');
  expect(readSurveyArchive().some(record => record.source.originalCsv === text)).toBe(true);
  expect(screen.getAllByText('100.000').length).toBeGreaterThan(0);
});

test('units must be confirmed and changing confirmation removes calculated summary', async () => {
  render(<Survey />); upload(csv);
  await screen.findByText(/Explicitly confirm/);
  expect(screen.queryByText('Valid survey · 41 stations')).not.toBeInTheDocument();
  confirm();
  expect(screen.getByText('Valid survey · 41 stations')).toBeInTheDocument();
  confirm();
  expect(screen.queryByText('Valid survey · 41 stations')).not.toBeInTheDocument();
});

test('invalid rows remain visible with row-specific errors and no misleading result', async () => {
  render(<Survey />); confirm(); upload('MD,Inclination,Azimuth\n000.0,0,90\n100,wrong,90');
  await screen.findByText(/Row 3: inclinationDeg must be a finite number/);
  expect(screen.getByText('000.0')).toBeInTheDocument();
  expect(screen.getByText('wrong')).toBeInTheDocument();
  expect(screen.queryByText('TVD (ft)')).not.toBeInTheDocument();
});

test('survey persists independently across close/reopen and warns about nonzero tie-in MD', () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ originalCsv: 'MD,Inclination,Azimuth\n100,0,90\n200,0,90', filename: 'relative.csv', confirmed: true }));
  const first = render(<Survey />);
  expect(screen.getByText(/unsurveyed interval/)).toBeInTheDocument();
  expect(screen.getByText('Relative TVD (ft)')).toBeInTheDocument();
  first.unmount(); render(<Survey />);
  expect(screen.getByText('Source: relative.csv')).toBeInTheDocument();
  expect(screen.getByText('Valid survey · 2 stations')).toBeInTheDocument();
});

test('corrupt saved survey is ignored and oversized file gives an explicit error', async () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, 'invalid json');
  render(<Survey />);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Survey CSV'), { target: { files: [{ size: 2097153 }] } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('2 MB'));
});
