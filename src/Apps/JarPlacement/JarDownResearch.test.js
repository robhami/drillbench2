import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JarPerformance from './JarPerformance';
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="research-plot">{JSON.stringify(props)}</div>);
jest.mock('./createJarDownResearchWorker', () => ({ createJarDownResearchWorker: () => ({
  postMessage(input) { Promise.resolve().then(() => this.onmessage?.({ data: require('../../engineering/research/jarDownExtendedDynamics').simulateExtendedJarDown(input) })); }, terminate() { this.onmessage = null; }
}) }));
// Load the isolated lazy module before starting assertions; CPU contention in
// the full suite must not turn module compilation time into a UI assertion.
beforeAll(() => import('./JarDownResearch'));
jest.mock('./createCompressionAssessmentWorker', () => ({ createCompressionAssessmentWorker: () => ({ postMessage() {}, terminate() {} }) }));
async function enter() {
  fireEvent.click(screen.getByRole('tab', { name: 'Jar Down' }));
  fireEvent.click(screen.getByText('Explore Idealised Jar Down Dynamics'));
  await screen.findByTestId('research-plot');
}
test('explicit advanced entry, graph-first, traces and selected event; exit restores target workflow', async () => {
  const update = jest.fn(); render(<JarPerformance bha={{ id: 'a', rows: [] }} updateBha={update} />);
  await enter();
  expect(screen.getByText('IDEALISED RESEARCH MODEL — NOT FOR OPERATIONAL USE')).toBeInTheDocument();
  expect(document.querySelector('.jarResearchGraph').compareDocumentPosition(document.querySelector('.jarResearchInputs')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Cumulative signed total impulse'));
  expect(screen.getByTestId('research-plot')).toHaveTextContent('Signed total impulse (lbf·s)');
  fireEvent.click(screen.getByText('5 ms · First impact'));
  expect(screen.getByTestId('research-plot')).toHaveTextContent('First impact · 5.000 ms');
  fireEvent.click(screen.getByText('Compare with Stage 5C.8 restricted early-impact model'));
  expect(screen.getByText(/Same restricted interval: 15–25 ms/)).toBeInTheDocument();
  expect(update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Exit research mode'));
  expect(screen.getByText('Calculate Jar Down')).toBeInTheDocument();
  expect(document.querySelector('.jarTargetResearchStatus')).toHaveTextContent('Idealised research model — Not for operational use');
  expect(screen.queryByTestId('research-plot')).not.toBeInTheDocument();
});
test('edits clear stale results; invalid inputs suppress outputs; mode switches and BHA reset safely', async () => {
  const { rerender } = render(<JarPerformance bha={{ id: 'a', rows: [] }} />); await enter();
  fireEvent.change(screen.getByLabelText('Prescribed initial compression at jar (lbf)'), { target: { value: '-1' } });
  expect(screen.queryByTestId('research-plot')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Run research model'));
  await screen.findByText(/Research results unavailable:/);
  expect(screen.queryByText('Signed total / net reaction impulse')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Verified mathematical example'), { target: { value: 'surface' } });
  await screen.findByTestId('research-plot');
  expect(document.querySelectorAll('.jarResearchEvents button')).toHaveLength(12);
  fireEvent.change(screen.getByLabelText('Verified mathematical example'), { target: { value: 'none' } });
  await screen.findByText('No impact within simulation horizon');
  rerender(<JarPerformance bha={{ id: 'b', rows: [] }} />);
  await waitFor(() => expect(screen.getByLabelText('Verified mathematical example')).toHaveValue('early'));
  fireEvent.click(screen.getByRole('tab', { name: 'Jar Up' }));
  expect(screen.queryByRole('region', { name: 'Idealised Jar Down research' })).not.toBeInTheDocument();
});

test('compact hierarchy and collapsed provenance retain explicit no-contact and zero-result meanings', async () => {
  render(<JarPerformance bha={{ id: 'presentation', rows: [] }} />); await enter();
  expect(screen.getByText('Valid impact/contact response')).toBeInTheDocument();
  const before = (a, b) => expect(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  before('.jarResearchResults', '.jarResearchGraph');
  before('.jarResearchGraph', '.jarResearchToggles');
  before('.jarResearchToggles', '.jarCompressionAssessment');
  expect(document.querySelector('.jarCompressionAssessment details')).not.toHaveAttribute('open');
  expect(document.querySelector('.jarResearchWarnings')).not.toHaveAttribute('open');
  fireEvent.change(screen.getByLabelText('Verified mathematical example'), { target: { value: 'none' } });
  await screen.findByText('No contact during the simulated interval');
  expect(screen.getByText(/Incident impact force is unavailable;/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Prescribed initial compression at jar (lbf)'), { target: { value: '0' } });
  expect(screen.getByText('Input changed — calculation required')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Run research model'));
  await screen.findByText(/Valid zero signed impulse/);
  expect(screen.getByText('No contact during the simulated interval')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Prescribed initial compression at jar (lbf)'), { target: { value: '-1' } });
  fireEvent.click(screen.getByText('Run research model'));
  await screen.findByText('Unsupported research configuration');
  expect(document.querySelector('.jarResearchResults')).toBeNull();
});
