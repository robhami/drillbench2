import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SurveyTrajectory from './SurveyTrajectory';
import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';
jest.mock('./Survey3DPlot', () => require('../JarConfiguration/ConfigurationPlot'));
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => {
  const view = props.layout.scene ? '3d' : props.layout.yaxis.title.text === 'TVD (ft)' ? 'vertical' : 'plan';
  return <div data-testid={`plot-${view}`}>
    <button onMouseOver={() => props.onHover({ points: [{ customdata: [1] }] })} onMouseOut={props.onUnhover} onClick={() => props.onClick({ points: [{ customdata: [2] }] })}>Station in {view}</button>
    <output data-testid={`data-${view}`}>{JSON.stringify(props)}</output>
  </div>;
});
const g = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 1000, inclinationDeg: 30, azimuthDeg: 90 }, { mdFt: 2000, inclinationDeg: 60, azimuthDeg: 90 }]);
const read = view => JSON.parse(screen.getByTestId(`data-${view}`).textContent);
test('three views share hover, pinned click and accessible station selection', async () => {
  render(<SurveyTrajectory geometry={g} workspaceId="a" />);
  await screen.findByTestId('plot-3d');
  fireEvent.mouseOver(screen.getByText('Station in vertical'));
  ['3d', 'vertical', 'plan'].forEach(view => expect(read(view).data.at(-1).name).toBe('Selected station'));
  expect(screen.getByLabelText('Select survey station')).toHaveValue('1');
  fireEvent.click(screen.getByText('Station in plan'));
  fireEvent.mouseOut(screen.getByText('Station in vertical'));
  expect(screen.getByLabelText('Select survey station')).toHaveValue('2');
  fireEvent.change(screen.getByLabelText('Select survey station'), { target: { value: '0' } });
  ['3d', 'vertical', 'plan'].forEach(view => expect(read(view).data.at(-1).customdata[0][1]).toBe(0));
});
test('invalid/changed survey and workspace changes cannot retain stale highlights or paths', async () => {
  const view = render(<SurveyTrajectory geometry={g} workspaceId="a" />); await screen.findByTestId('plot-3d');
  fireEvent.change(screen.getByLabelText('Select survey station'), { target: { value: '1' } });
  view.rerender(<SurveyTrajectory geometry={g} workspaceId="b" />);
  expect(screen.getByLabelText('Select survey station')).toHaveValue('');
  view.rerender(<SurveyTrajectory geometry={null} workspaceId="b" />);
  expect(screen.queryByTestId('plot-3d')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('No valid trajectory');
  view.rerender(<SurveyTrajectory workspaceId="b" />);
  expect(screen.getByRole('status')).toHaveTextContent('No valid trajectory');
});
test('section azimuth, reset, fit and enlarge affect presentation only', async () => {
  render(<SurveyTrajectory geometry={g} />); await screen.findByTestId('plot-3d');
  const original = JSON.stringify(g), before = read('3d').layout.uirevision;
  fireEvent.click(screen.getByText('Reset View'));
  expect(read('3d').layout.uirevision).not.toBe(before);
  fireEvent.click(screen.getByText('Fit Trajectory'));
  fireEvent.change(screen.getByLabelText('Section azimuth (° from North)'), { target: { value: '0' } });
  expect(read('vertical').data[0].x.every(x => Math.abs(x) < 1e-8)).toBe(true);
  fireEvent.click(screen.getByText('Enlarge 3D'));
  expect(screen.getByText('Show Three Views')).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.stringify(g)).toBe(original);
});
