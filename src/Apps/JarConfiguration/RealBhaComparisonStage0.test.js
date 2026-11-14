import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import RealBhaComparison from './RealBhaComparison';

async function addDraftAlternative() {
  fireEvent.click(screen.getByRole('button', { name: 'Engineering Settings / Diagnostics' }));
  const field = await screen.findByLabelText('Movement from current jar (ft)');
  fireEvent.change(field, { target: { value: '10' } });
  fireEvent.click(screen.getByText('Add alternative'));
  expect(screen.getByText(/Alternative 1: movement \+10 ft/)).toBeInTheDocument();
}

test('mode, analysis-depth and survey changes clear non-destructive static alternatives', async () => {
  const bha = JSON.parse(JSON.stringify(frozen.workingCopy));
  const view = render(<RealBhaComparison bha={bha} analysisBitMdFt="9318" surfaceReferenceMdFt="0" drillingMode="slide" />);

  await addDraftAlternative();
  view.rerender(<RealBhaComparison bha={bha} analysisBitMdFt="9318" surfaceReferenceMdFt="0" drillingMode="rotate" />);
  expect(screen.queryByText(/Alternative 1: movement/)).not.toBeInTheDocument();

  await addDraftAlternative();
  view.rerender(<RealBhaComparison bha={bha} analysisBitMdFt="9000" surfaceReferenceMdFt="0" drillingMode="rotate" />);
  expect(screen.queryByText(/Alternative 1: movement/)).not.toBeInTheDocument();

  await addDraftAlternative();
  const changedSurvey = JSON.parse(JSON.stringify(bha));
  changedSurvey.trajectoryMode = 'directional';
  changedSurvey.surveyState.active = { ...changedSurvey.surveyState.active,
    originalCsv: 'MD,Inclination,Azimuth\n0,0,0\n9318,45,0', filename: 'stage0-changed.csv', kind: 'imported' };
  view.rerender(<RealBhaComparison bha={changedSurvey} analysisBitMdFt="9000" surfaceReferenceMdFt="0" drillingMode="rotate" />);
  expect(screen.queryByText(/Alternative 1: movement/)).not.toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(JSON.stringify(frozen.workingCopy));
});
