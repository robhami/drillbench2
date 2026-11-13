import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Widget from './Widget';

jest.mock('react-rnd', () => ({ Rnd: ({ children }) => <div>{children}</div> }));
jest.mock('../Apps/EngineeringString/EngineeringStringSchematic', () => props => <div data-testid="string-dp-length">{props.components.find(c => c.category === 'DP')?.length}</div>);
const bha = { name: '', holeSize: '', mudWeight: 10, wob: '', frictionCoefficient: 0.25, rpm: 150, drillpipeReferenceBitMdFt: 12000,
  rows: [{ category: 'JAR', length: 20, weight: 100, od: 6.75 }, { category: 'DP', length: 10000, weight: 20, od: 5.5 }] };

test.each(['engineeringString', 'jarClearance'])('%s shows one compact directional-survey request instead of mounting repeated errors/stale plots', type => {
  render(<Widget contentOnly bha={{ ...bha, trajectoryMode: 'directional', surveyState: { version: 1, active: null, history: [] } }} surveyCoverage={{ covered: false, status: 'invalid-survey' }} widget={{ id: 'survey-required', type }} />);
  expect(screen.getAllByRole('status')).toHaveLength(1); expect(screen.getByRole('status')).toHaveTextContent('Directional survey required');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.queryByTestId('string-dp-length')).not.toBeInTheDocument();
});

test.each(['jarConfiguration', 'jarPlacement', 'jarClearance', 'jarForces', 'engineeringString'])('%s blocks incomplete rows before mounting its calculation interface', type => {
  render(<Widget contentOnly bha={{ ...bha, rows: [{ category: 'DC', length: '', od: '', weight: '' }, bha.rows[1]] }} widget={{ id: 'blocked', type }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Row 1: Select a tool and enter its length.');
  expect(screen.queryByRole('button', { name: 'Run Analysis' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('string-dp-length')).not.toBeInTheDocument();
});

test('editing a complete BHA to invalid suppresses existing analysis output immediately', () => {
  const view = render(<Widget contentOnly bha={bha} widget={{ id: 'string', type: 'engineeringString' }} />);
  expect(screen.getByTestId('string-dp-length')).toBeInTheDocument();
  view.rerender(<Widget contentOnly bha={{ ...bha, rows: [{ ...bha.rows[0], length: 0 }, bha.rows[1]] }} widget={{ id: 'string', type: 'engineeringString' }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Row 1: Enter a positive length');
  expect(screen.queryByTestId('string-dp-length')).not.toBeInTheDocument();
});

test('Engineering String receives deployed Auto pipe length at BHA MD without rewriting saved length', () => {
  const auto = { ...bha, rows: [bha.rows[0], { ...bha.rows[1], lengthMode: 'auto' }] };
  const { rerender } = render(<Widget bha={auto} widget={{ id: 'string', type: 'engineeringString' }} />);
  expect(screen.getByTestId('string-dp-length')).toHaveTextContent('11980');
  rerender(<Widget bha={{ ...auto, drillpipeReferenceBitMdFt: 1000 }} widget={{ id: 'string', type: 'engineeringString' }} />);
  expect(screen.getByTestId('string-dp-length')).toHaveTextContent('980');
  expect(auto.rows[1].length).toBe(10000);
});

test('Parameter Entry omits the BHA-controlled depth while Jar Forces reads shared analysis depth', () => {
  const setAnalysisBitMdFt = jest.fn();
  const props = { bha, analysisBitMdFt: '1000', setAnalysisBitMdFt, widget: { id: 'test', type: 'analysisInputs' } };
  const { rerender } = render(<Widget {...props} />);
  expect(screen.queryByLabelText('Bit Depth (ft MD)')).not.toBeInTheDocument();
  expect(setAnalysisBitMdFt).not.toHaveBeenCalled();
  rerender(<Widget {...props} analysisBitMdFt="2000" widget={{ id: 'forces', type: 'jarForces' }} />);
  expect(screen.queryByLabelText('Bit Depth (ft MD)')).not.toBeInTheDocument();
  expect(screen.getByText(/Analysis bit MD:/)).toHaveTextContent('2,000.0 ft');
});

test('real Widget forwards the shared rig limit and update callback to Jar Forces', () => {
  const updateRigLimits = jest.fn();
  render(<Widget bha={bha} analysisBitMdFt="1000" rigLimits={{ maximumAllowableHookloadKlbf: '350' }} updateRigLimits={updateRigLimits} widget={{ id: 'forces', type: 'jarForces' }} />);

  expect(screen.getByLabelText('Maximum Allowable Rig Hookload (klbf)')).toHaveValue(350);
  fireEvent.change(screen.getByLabelText('Maximum Allowable Rig Hookload (klbf)'), { target: { value: '360' } });
  expect(updateRigLimits).toHaveBeenCalledWith({ maximumAllowableHookloadKlbf: '360' });
});
