import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JarPerformance from './JarPerformance';
import { evaluateJarDownPreparation } from './downPreparationAdapter';
import { readImpactInputs } from './impactInputs';
jest.mock('../JarConfiguration/ConfigurationPlot', () => props => <div data-testid="impact-plot">{JSON.stringify(props)}</div>);
const down = { strokeIn: '6', compressionKlbf: '41.8', stuckPointFt: '5', loadBasis: 'at-jar-before-pump',
  pressureDropPsi: '1000', pumpOpenAreaIn2: '11.8', compressionReference: 'Qualified example, no unresolved drag',
  manufacturerReference: 'OM-HJDA-001 Release 2 p.7' };
const base = require('../../../docs/ValidationStudies/JarPlacementDemoStage5C1.json').storage.drillbenchWell.currentBha;
const up = { strokeIn: '7', overpullKlbf: '300', stuckPointFt: '5' };
const selectDown = () => fireEvent.click(screen.getByRole('tab', { name: 'Jar Down' }));

test('Down uses independent saved values and only shows conditional static results', async () => {
  render(<JarPerformance bha={{ ...base, jarImpactInputs: { up, down } }} />);
  await screen.findByTestId('impact-plot');
  expect(screen.getByText('488.3 klbf')).toBeInTheDocument();
  selectDown();
  expect(screen.queryByTestId('impact-plot')).not.toBeInTheDocument();
  expect(screen.queryByText('488.3 klbf')).not.toBeInTheDocument();
  expect(screen.getByText('30.0 klbf')).toBeInTheDocument();
  expect(screen.getByText('11.8 klbf')).toBeInTheDocument();
  expect(screen.getByText('Idealised research model — Not for operational use')).toHaveClass('jarTargetResearchStatus');
  fireEvent.change(screen.getByLabelText('Compression load basis'), { target: { value: 'surface-slackoff' } });
  expect(screen.queryByText('30.0 klbf')).not.toBeInTheDocument();
  expect(screen.getByText(/Surface slackoff is not compression at the jar/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Jar Up' }));
  await screen.findByTestId('impact-plot');
  expect(screen.getByLabelText('Overpull at jar (klbf)')).toHaveValue(300);
});

test('BHA input metadata persists through updateBha and does not mutate direction availability', () => {
  let latest;
  function Harness() {
    const [bha, setBha] = useState({ ...base, jarImpactInputs: { up, down } }); latest = bha;
    return <JarPerformance bha={bha} updateBha={patch => setBha(old => ({ ...old, ...patch }))} />;
  }
  const { unmount } = render(<Harness />); selectDown();
  fireEvent.change(screen.getByLabelText('Compression estimate at jar (klbf)'), { target: { value: '50' } });
  expect(latest.jarImpactInputs.down.compressionKlbf).toBe('50');
  expect(latest.jarImpactInputs.up).toEqual(up);
  expect(latest.rows).toBe(base.rows);
  const saved = JSON.parse(JSON.stringify(latest)); unmount();
  render(<JarPerformance bha={saved} />); selectDown();
  expect(screen.getByLabelText('Compression estimate at jar (klbf)')).toHaveValue(50);
  expect(screen.getByLabelText('Downward jar stroke (in)')).toHaveValue(6);
});

test('BHA and saved-workspace changes immediately clear or load the correct inputs', () => {
  const { rerender } = render(<JarPerformance bha={{ ...base, jarImpactInputs: { up, down } }} />); selectDown();
  rerender(<JarPerformance bha={{ ...base, id: 'fresh-bha', jarImpactInputs: undefined }} />);
  expect(screen.getByLabelText('Compression estimate at jar (klbf)')).toHaveValue(null);
  expect(screen.queryByText('30.0 klbf')).not.toBeInTheDocument();
  rerender(<JarPerformance bha={{ ...base, id: 'fresh-bha', jarImpactInputs: { down: { ...down, compressionKlbf: '50' } } }} />);
  expect(screen.getByLabelText('Compression estimate at jar (klbf)')).toHaveValue(50);
  expect(screen.getByText('38.2 klbf')).toBeInTheDocument();
});

test('adapter gates sticking location, multiple jars, unavailable direction and missing source', () => {
  expect(evaluateJarDownPreparation(base, { ...down, stuckPointFt: '305' }).valid).toBe(false);
  expect(evaluateJarDownPreparation({ rows: [...base.rows, base.rows[2]] }, down).valid).toBe(false);
  const unavailable = { ...base, rows: base.rows.map(r => r.category === 'JAR' ? { ...r, jarDirections: { down: { mechanism: 'unavailable' } } } : r) };
  expect(evaluateJarDownPreparation(unavailable, down).valid).toBe(false);
  expect(evaluateJarDownPreparation(base, { ...down, compressionReference: '' }).valid).toBe(false);
  expect(evaluateJarDownPreparation(base, { ...down, compressionKlbf: null }).valid).toBe(false);
});

test('input reader does not infer Down values from Up and rejects malformed saved values', () => {
  expect(readImpactInputs({ jarImpactInputs: { up } }, 'down').compressionKlbf).toBe('');
  expect(readImpactInputs({ jarImpactInputs: { down: { compressionKlbf: null, pressureDropPsi: Infinity, strokeIn: 0 } } }, 'down'))
    .toMatchObject({ compressionKlbf: '', pressureDropPsi: '', strokeIn: '0' });
});
