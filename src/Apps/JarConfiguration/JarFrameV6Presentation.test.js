import React from 'react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fireEvent, render, screen } from '@testing-library/react';
import JarFrameV6Presentation from './JarFrameV6Presentation';
import STAGE8_FIXTURE from './Stage8OesResearchFixture.v1.json';

const stage8Path = path.resolve(__dirname, '../../../docs/ValidationStudies/JarUpScalability/IntegerDelayPrototype/Stage8Results.json');
const byIndex = (selector, index) => document.querySelector(`${selector} [data-sample-index="${index}"]`);

test('defaults to Loaded BHA with unavailable results and compact full-assembly schematic from current rows', () => {
  const bha = { id: 'loaded-only', selectedJarId: 'jar-live', rows: [
    { rowId: 'bit-live', category: 'BIT', toolName: 'Live bit', length: 1, od: 8.5 },
    { rowId: 'jar-live', category: 'JAR', toolName: 'Live jar', length: 33, od: 6.5, idSize: 2.813 },
    { rowId: 'dc-live', category: 'DC', length: 250, od: 6.5, idSize: 2.813 },
    { rowId: 'dp-live', category: 'DP', length: 9000, od: 5, idSize: 4.276 }
  ] };
  render(<JarFrameV6Presentation bha={bha} />);
  expect(screen.getByRole('radio', { name: 'Loaded BHA' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Stage 8 OES Research Demo' })).not.toBeChecked();
  expect(document.querySelector('.jarV6Presentation')).toHaveAttribute('data-presentation-mode', 'loaded-bha');
  expect(screen.getByRole('img', { name: /Peak stuck-point tensile impact force.*unavailable for Loaded BHA/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /50 ms tensile impulse.*unavailable for Loaded BHA/ })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Select hypothetical jar centre' })).toBeDisabled();
  expect(screen.getByRole('complementary', { name: 'Loaded BHA schematic' })).toBeInTheDocument();
  const loadedAssembly = screen.getByTestId('loaded-bha-assembly');
  expect(loadedAssembly).toHaveAttribute('viewBox', '0 0 61 208');
  expect(loadedAssembly).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  expect(loadedAssembly).toHaveAccessibleName(/Complete loaded BHA assembly; selected jar Live jar highlighted/);
  expect(screen.getByTestId('loaded-selected-jar-marker')).toBeVisible();
  expect(screen.getByLabelText('Loaded BHA component labels')).toHaveTextContent('BIT');
  expect(screen.getByLabelText('Loaded BHA component labels')).toHaveTextContent('JAR');
  expect(screen.getByLabelText('Loaded BHA component labels')).toHaveTextContent('DC');
  expect(screen.getByLabelText('Loaded BHA component labels')).toHaveTextContent('DP');
  expect(screen.getByText('Optional detailed tool illustration')).toBeInTheDocument();
  expect(screen.getByText('Optional detailed tool illustration').closest('details')).not.toHaveAttribute('open');
  expect(screen.getByText('Stage 8 fixture is not displayed')).toBeInTheDocument();
  expect(screen.getByText(/NP unavailable · mode \/ WOB unavailable/)).toBeInTheDocument();
  expect(screen.getByText('PRELIMINARY — NOT FOR OPERATIONAL USE')).toBeVisible();
  expect(document.querySelectorAll('.jarV6SampleMarker')).toHaveLength(0);
  expect(document.querySelector('[aria-label="Stage 8 OES research fixture BHA schematic"]')).not.toBeInTheDocument();
  expect(screen.queryByText('3,194.43')).not.toBeInTheDocument();
});

test('frozen versioned display fixture exactly matches all 16 recorded Stage 8 source rows and integrity hashes', () => {
  const source = JSON.parse(fs.readFileSync(stage8Path, 'utf8'));
  const recordedRows = source.runs.filter(run => run.status === 'recorded').map(run => ({
    positionFt: run.position,
    peakTensileImpactForceKN: run.worker.result.metrics.peakTensileN / 1000,
    tensileImpulse50msKNs: run.worker.result.metrics.fixedTensileNs / 1000,
    impactVelocityMS: run.worker.result.impact.impactVelocityMS
  }));
  const sourceSha256 = crypto.createHash('sha256').update(fs.readFileSync(stage8Path)).digest('hex');
  const samplesSha256 = crypto.createHash('sha256').update(JSON.stringify(STAGE8_FIXTURE.samples)).digest('hex');
  expect(STAGE8_FIXTURE.version).toBe('stage8-oes-research-v1');
  expect(STAGE8_FIXTURE.fixtureIdentity).toBe('Reconstructed OES 8.5 in BHA with diagnostic TCI bit');
  expect(STAGE8_FIXTURE.sourceSha256).toBe('4badaf85e9507c06ef00a7b9c8972ae922be73d7defff7ec45c2f05a61cfbf84');
  expect(STAGE8_FIXTURE.samplesSha256).toBe('877156a518b42399bcfd7ce64efb9952fd768bfd84625af0f296a4aec77a824e');
  expect(sourceSha256).toBe(STAGE8_FIXTURE.sourceSha256);
  expect(samplesSha256).toBe(STAGE8_FIXTURE.samplesSha256);
  expect(source.runs.filter(run => run.status === 'recorded')).toHaveLength(16);
  expect(STAGE8_FIXTURE.samples).toHaveLength(16);
  expect(recordedRows).toEqual(STAGE8_FIXTURE.samples);
  expect(STAGE8_FIXTURE.units).toEqual({
    position: 'ft above bit', peakTensileImpactForce: 'kN', tensileImpulse: 'kN·s', impactVelocity: 'm/s'
  });
  expect(STAGE8_FIXTURE.windowSeconds).toBe(0.05);
});

test('loaded assembly highlights only the explicitly selected jar when the BHA has multiple jars', () => {
  const rows = [
    { rowId: 'jar-a', category: 'JAR', toolName: 'Upper jar', length: 30, od: 6.5 },
    { rowId: 'dc', category: 'DC', length: 100, od: 6.5 },
    { rowId: 'jar-b', category: 'JAR', toolName: 'Lower jar', length: 30, od: 6.5 }
  ];
  const { rerender } = render(<JarFrameV6Presentation bha={{ rows }} />);
  expect(screen.queryByTestId('loaded-selected-jar-marker')).not.toBeInTheDocument();
  rerender(<JarFrameV6Presentation bha={{ rows, selectedJarId: 'jar-b' }} />);
  expect(screen.getByRole('img', { name: /selected jar Lower jar highlighted/ })).toBeInTheDocument();
  expect(screen.getByTestId('loaded-selected-jar-marker')).toBeVisible();
  expect(screen.getByText('Selected jar · Lower jar')).toBeInTheDocument();
});

test('opt-in Stage 8 demo shows two populated charts and keeps fixture reference separate from selected position', () => {
  const bha = { id: 'unchanged-bha', rows: [{ category: 'JAR', length: 33, od: 6.5 }], jarImpactInputs: { stroke: '12' } };
  const before = JSON.stringify(bha);
  render(<JarFrameV6Presentation bha={bha} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Stage 8 OES Research Demo' }));
  expect(screen.getByTestId('stage8-fixture-assembly')).toHaveAttribute('viewBox', '0 0 61 208');
  expect(screen.getByTestId('hypothetical-position-marker')).toBeVisible();
  expect(screen.getByTestId('fixture-reference-marker')).toBeVisible();
  expect(document.querySelector('.jarV6Presentation')).toHaveAttribute('data-presentation-mode', 'stage8-research-demo');
  expect(screen.getAllByRole('img', { name: /16 frozen Stage 8 samples/ })).toHaveLength(2);
  expect(document.querySelectorAll('.jarV6SampleMarker')).toHaveLength(32);
  expect(screen.getByRole('combobox', { name: 'Select hypothetical jar centre' }).options).toHaveLength(16);
  expect(screen.getByText(/Reconstructed OES 8.5 in BHA with diagnostic TCI bit/)).toBeInTheDocument();
  expect(screen.getByText(/source: Stage8Results.json/)).toBeInTheDocument();
  expect(screen.getByText(/mode \/ WOB unavailable/)).toBeInTheDocument();
  expect(screen.getAllByText('NP unavailable')).not.toHaveLength(0);
  expect(screen.getByText(/Fixture data only · not loaded-BHA results/)).toBeInTheDocument();

  const select = screen.getByRole('combobox', { name: 'Select hypothetical jar centre' });
  const fixtureMarker = screen.getByTestId('fixture-reference-marker');
  const fixtureY = fixtureMarker.getAttribute('cy');
  expect(select).toHaveValue('11');
  expect(screen.getByTestId('peakTensileImpactForceKN-readout')).toHaveTextContent('3,194.43');
  expect(screen.getByTestId('tensileImpulse50msKNs-readout')).toHaveTextContent('32.82');
  expect(screen.getByTestId('impact-velocity-readout')).toHaveTextContent('4.305 m/s');
  expect(fixtureMarker).toHaveAttribute('cy', fixtureY);
  expect(document.querySelector('.jarV6SchematicSvg')).toHaveAttribute('viewBox', '0 0 61 208');
  expect(document.querySelector('.jarV6SchematicSvg')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  expect(Number(screen.getByTestId('hypothetical-position-marker').getAttribute('cy'))).toBeCloseTo(Number(fixtureY), 12);

  fireEvent.change(select, { target: { value: '0' } });
  expect(screen.getByTestId('peakTensileImpactForceKN-chart')).toHaveAttribute('data-selected-index', '0');
  expect(screen.getByTestId('tensileImpulse50msKNs-chart')).toHaveAttribute('data-selected-index', '0');
  expect(screen.getByTestId('peakTensileImpactForceKN-readout')).toHaveTextContent('2,422.09');
  expect(screen.getByTestId('tensileImpulse50msKNs-readout')).toHaveTextContent('82.88');
  expect(screen.getByTestId('impact-velocity-readout')).toHaveTextContent('2.907 m/s');
  expect(screen.getByTestId('fixture-reference-marker')).toHaveAttribute('cy', fixtureY);
  expect(screen.getByTestId('hypothetical-position-marker')).not.toHaveAttribute('cy', fixtureY);

  fireEvent.click(byIndex('[data-testid="peakTensileImpactForceKN-chart"]', 12));
  expect(select).toHaveValue('12');
  expect(screen.getByTestId('peakTensileImpactForceKN-chart')).toHaveAttribute('data-selected-index', '12');
  expect(screen.getByTestId('tensileImpulse50msKNs-chart')).toHaveAttribute('data-selected-index', '12');
  fireEvent.keyDown(byIndex('[data-testid="tensileImpulse50msKNs-chart"]', 12), { key: 'ArrowRight' });
  expect(select).toHaveValue('13');
  expect(screen.getByTestId('peakTensileImpactForceKN-chart')).toHaveAttribute('data-selected-index', '13');
  expect(screen.getByTestId('tensileImpulse50msKNs-chart')).toHaveAttribute('data-selected-index', '13');
  expect(JSON.stringify(bha)).toBe(before);
});

test('optional velocity chart follows the same selected Stage 8 sample', () => {
  render(<JarFrameV6Presentation bha={{ rows: [] }} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Stage 8 OES Research Demo' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show velocity plot' }));
  expect(screen.getByRole('img', { name: /Impact velocity at jar versus hypothetical jar centre.*16 frozen Stage 8 samples/ })).toBeInTheDocument();
  expect(document.querySelectorAll('[data-testid="impactVelocityMS-chart"] [data-sample-index]')).toHaveLength(16);
  fireEvent.change(screen.getByRole('combobox', { name: 'Select hypothetical jar centre' }), { target: { value: '15' } });
  expect(screen.getByTestId('impactVelocityMS-chart')).toHaveAttribute('data-selected-index', '15');
  expect(screen.getByTestId('impact-velocity-readout')).toHaveTextContent('4.656 m/s');
});

test('switching back to Loaded BHA hides research data and does not mutate BHA rows or saved inputs', () => {
  const bha = { id: 'mode-isolation', rows: [{ rowId: 'j1', category: 'JAR', length: 33, od: 6.5 }], jarImpactInputs: { stroke: '14' }, selectedJarId: 'j1' };
  const before = JSON.stringify(bha);
  render(<JarFrameV6Presentation bha={bha} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Stage 8 OES Research Demo' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Select hypothetical jar centre' }), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Loaded BHA' }));
  expect(document.querySelector('.jarV6Presentation')).toHaveAttribute('data-presentation-mode', 'loaded-bha');
  expect(document.querySelectorAll('.jarV6SampleMarker')).toHaveLength(0);
  expect(screen.getByRole('combobox', { name: 'Select hypothetical jar centre' })).toBeDisabled();
  expect(screen.getByText('Stage 8 fixture is not displayed')).toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(before);
});
