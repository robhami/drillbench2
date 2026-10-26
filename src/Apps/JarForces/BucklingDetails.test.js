import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BucklingDetails from './BucklingDetails';
import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';

const bha = { holeSize: 16, rows: [{ rowId: 'jar', category: 'JAR', length: 20, weight: 150, od: 9.5, idSize: 3 },
  { rowId: 'dp', category: 'DP', length: 980, weight: 27.76, od: 5.5, idSize: 4.67 }] };
const props = { bha, survey: calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 60, azimuthDeg: 0 }, { mdFt: 2000, inclinationDeg: 60, azimuthDeg: 0 }]),
  bitMdFt: 1000, surfaceMdFt: 0, jarIndex: 0, jarDirection: 'down', loadingResult: { requiredSurfaceHookloadLbf: 0 } };
const checkbox = () => screen.getByRole('checkbox');
const modulus = () => screen.getByLabelText("Young's Modulus E (psi)");
const configured = () => { fireEvent.change(modulus(), { target: { value: '30000000' } }); fireEvent.click(checkbox()); };

test('no default E or confirmation; explicit configuration enables screening', () => {
  render(<BucklingDetails {...props} bha={{ ...bha, mudWeight: 10, frictionCoefficient: .25 }} />);
  expect(modulus()).toHaveValue(null);
  expect(checkbox()).not.toBeChecked();
  expect(screen.getByText(/Enter an explicit positive finite/)).toBeInTheDocument();
  configured();
  expect(screen.getByText('Partial screening')).toBeInTheDocument();
  expect(screen.getByText('Evaluated compressed length')).toBeInTheDocument();
  expect(screen.queryByText(/safe\/unsafe/i)).not.toBeInTheDocument();
});
test.each(['od', 'idSize', 'length', 'weight', 'rowId', 'selectedToolId'])('selected DP %s change revokes confirmation, even if changed back', key => {
  const { rerender } = render(<BucklingDetails {...props} />);
  configured(); expect(checkbox()).toBeChecked();
  rerender(<BucklingDetails {...props} bha={{ ...bha, rows: [bha.rows[0], { ...bha.rows[1], [key]: key.endsWith('Id') ? 'new' : 10 }] }} />);
  expect(checkbox()).not.toBeChecked();
  rerender(<BucklingDetails {...props} />);
  expect(checkbox()).not.toBeChecked();
});
test('depth and modulus changes require reconfirmation; reload/remount resets session inputs', () => {
  const { rerender, unmount } = render(<BucklingDetails {...props} />);
  configured();
  rerender(<BucklingDetails {...props} bitMdFt={1200} />);
  expect(checkbox()).not.toBeChecked();
  fireEvent.click(checkbox());
  fireEvent.change(modulus(), { target: { value: '31000000' } });
  expect(checkbox()).not.toBeChecked();
  unmount(); render(<BucklingDetails {...props} />);
  expect(modulus()).toHaveValue(null); expect(checkbox()).not.toBeChecked();
});
test('multiple DP selections remain unconfirmed and do not inherit confirmation', () => {
  render(<BucklingDetails {...props} bha={{ ...bha, rows: [...bha.rows, { ...bha.rows[1], rowId: 'dp2' }] }} />);
  expect(checkbox()).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Drillpipe section'), { target: { value: 'dp' } });
  configured(); expect(checkbox()).toBeChecked();
  fireEvent.change(screen.getByLabelText('Drillpipe section'), { target: { value: 'dp2' } });
  expect(checkbox()).not.toBeChecked();
});
test('Jar Up and missing current Jar Down result never display stale screening', () => {
  const { rerender } = render(<BucklingDetails {...props} jarDirection="up" />);
  configured(); expect(screen.getByText('Buckling screening requires Jar Down.')).toBeInTheDocument();
  rerender(<BucklingDetails {...props} loadingResult={null} />);
  expect(screen.getByText('Calculate the current Jar Down surface hookload first.')).toBeInTheDocument();
});

test('invalid modulus and changed Bit Size revoke confirmation', () => {
  const { rerender } = render(<BucklingDetails {...props} />);
  fireEvent.change(modulus(), { target: { value: '-1' } });
  expect(screen.getByRole('alert')).toHaveTextContent('positive and finite');
  configured();
  rerender(<BucklingDetails {...props} bha={{ ...bha, holeSize: 17 }} />);
  expect(checkbox()).not.toBeChecked();
});
