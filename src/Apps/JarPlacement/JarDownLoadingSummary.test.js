import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Summary, { surfaceSlackoff } from './JarDownLoadingSummary';
const bridge = { referenceContext: 'a', surfaceMdFt: 0, pending: false, boundary: { direction: 'slackoff', hookloadKlbf: '1' }, setBoundary: jest.fn(), calculate: jest.fn(),
  assessment: { staticResult: { valid: true, surfaceHookloadLbf: 1000, direction: 'slackoff', jarName: 'Jar A', jarMdFt: 190 }, staticForceLbf: 450, staticCompressionLbf: 450, inclinationDeg: 0 } };
const props = { bridge, result: { valid: true }, request: { compressionLbf: 1000 }, geometrySource: 'BHA-derived tubular shapes (A)', adopted: null };
test.each([[2, 1, true, 1], [1, 2, true, -1], [0, 0, true, 0], ['', 1, true, null], [2, 1, false, null], [-1, 1, true, null]])('surface difference %s / %s compatible %s', (a, b, compatible, expected) => expect(surfaceSlackoff(a, b, compatible)).toBe(expected));
test('reference is explicit; current boundary and solver-used compression stay distinct; context cannot revive a reference', () => {
  const view = render(<Summary {...props} />);
  expect(screen.getAllByText('Not defined — reference hookload required')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Reference surface hookload (klbf)'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Reference operating condition'), { target: { value: 'pickup' } });
  expect(screen.getByText('1 klbf')).toBeInTheDocument();
  expect(screen.getByText('1,000 lbf')).toBeInTheDocument();
  expect(screen.getByText(/450 \/ 450 lbf/)).toBeInTheDocument();
  view.rerender(<Summary {...props} bridge={{ ...bridge, referenceContext: 'b' }} />);
  view.rerender(<Summary {...props} />);
  expect(screen.getAllByText('Not defined — reference hookload required')).toHaveLength(2);
});
test('standalone fixture has no inferred slackoff; stale and uncalculated solver inputs are unavailable', () => {
  const view = render(<Summary {...props} geometrySource="Independent research fixture" adopted={{}} adoptedCurrent={false} />);
  expect(screen.getByText(/Independent idealised research fixture — results are not calculated/)).toBeInTheDocument();
  expect(screen.getByText('Stale — unavailable')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Reference surface hookload (klbf)'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Reference operating condition'), { target: { value: 'pickup' } });
  expect(screen.getByText('Not applicable — independent research geometry')).toBeInTheDocument();
  view.rerender(<Summary {...props} result={null} request={null} />);
  expect(screen.getByText('Unavailable — calculation required')).toBeInTheDocument();
});
