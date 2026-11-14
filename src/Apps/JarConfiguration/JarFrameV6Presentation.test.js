import React from 'react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fireEvent, render, screen } from '@testing-library/react';
import JarFrameV6Presentation from './JarFrameV6Presentation';
import { buildLoadedBhaPresentation, buildLoadedBhaSchematicSections } from './loadedBhaPresentation';
import STAGE8_FIXTURE from './Stage8OesResearchFixture.v1.json';

const stage8Path = path.resolve(__dirname, '../../../docs/ValidationStudies/JarUpScalability/IntegerDelayPrototype/Stage8Results.json');
const byIndex = (selector, index) => document.querySelector(`${selector} [data-sample-index="${index}"]`);
const withLoadedData = bha => <JarFrameV6Presentation bha={bha} loadedData={buildLoadedBhaPresentation({ bha, survey: { valid: false, errors: [{ message: 'No confirmed survey' }] }, drillingMode: 'slide', surfaceReferenceMdFt: 0 })} />;

test('defaults to Loaded BHA with unavailable results and compact full-assembly schematic from current rows', () => {
  const bha = { id: 'loaded-only', drillpipeReferenceBitMdFt: 10000, selectedJarId: 'jar-live', rows: [
    { rowId: 'bit-live', category: 'BIT', toolName: 'Live bit', length: 1, od: 8.5 },
    { rowId: 'jar-live', category: 'JAR', toolName: 'Live jar', length: 33, od: 6.5, idSize: 2.813 },
    { rowId: 'dc-live', category: 'DC', length: 250, od: 6.5, idSize: 2.813 },
    { rowId: 'dp-live', category: 'DP', length: 9000, od: 5, idSize: 4.276, weight: 20 }
  ] };
  render(withLoadedData(bha));
  expect(screen.getByRole('radio', { name: 'Loaded BHA' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Stage 8 OES Research Demo' })).not.toBeChecked();
  expect(document.querySelector('.jarV6Presentation')).toHaveAttribute('data-presentation-mode', 'loaded-bha');
  expect(screen.getByRole('img', { name: /Peak stuck-point tensile impact force.*unavailable for Loaded BHA/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /50 ms tensile impulse.*unavailable for Loaded BHA/ })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Select loaded BHA jar' })).toHaveValue('jar-live');
  expect(screen.getByRole('complementary', { name: 'Loaded BHA schematic' })).toBeInTheDocument();
  const loadedAssembly = screen.getByTestId('loaded-bha-assembly');
  expect(loadedAssembly).toHaveAttribute('viewBox', '0 0 61 208');
  expect(loadedAssembly).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  expect(loadedAssembly).toHaveAccessibleName(/Complete loaded BHA assembly; selected jar Live jar highlighted/);
  expect(screen.getByTestId('loaded-selected-jar-marker')).toBeVisible();
  expect(screen.getByTestId('loaded-selected-jar-marker')).toHaveAttribute('r', '3.8');
  const selectedGuide = loadedAssembly.querySelector('.jarV6CandidateGuide');
  expect(Number(selectedGuide.getAttribute('x2')) - Number(selectedGuide.getAttribute('x1'))).toBe(20);
  expect(screen.getByText(/not to scale/)).toBeVisible();
  expect(loadedAssembly.querySelector('.jarV6Rail')).toHaveAttribute('x1', '31');
  expect(loadedAssembly.querySelector('.jarV6Pipe')).toHaveAttribute('width', '10');
  expect(loadedAssembly.querySelector('.jarV6Dc')).toHaveAttribute('width', '13');
  expect(loadedAssembly.querySelector('.jarV6Jar')).toHaveAttribute('width', '13');
  expect(loadedAssembly.querySelector('.jarV6BitTip').getAttribute('d')).toMatch(/^M22 .*l9 8 9-/);
  const loadedSegments = [...loadedAssembly.querySelectorAll('[data-testid^="loaded-component-"]')];
  const segmentRects = loadedSegments.map(segment => segment.querySelector('rect.jarV6SchematicShape'));
  expect(loadedSegments.map(segment => segment.getAttribute('data-section'))).toEqual(['DP', 'Upper DC', 'Jar', 'Bit']);
  expect(segmentRects.slice(0, -1).every((segment, index) =>
    Math.abs(Number(segment.getAttribute('y')) + Number(segment.getAttribute('height')) - Number(segmentRects[index + 1].getAttribute('y'))) < 1e-8)).toBe(true);
  const conciseLabels = [...screen.getByLabelText('Loaded BHA component labels').querySelectorAll('b')].map(label => label.textContent);
  expect(conciseLabels).toEqual(['DP', 'Upper DC', 'Jar', 'Bit']);
  expect(screen.getByLabelText('Loaded BHA component labels')).not.toHaveTextContent('Live jar');
  expect(screen.getByText('Optional detailed tool illustration')).toBeInTheDocument();
  expect(screen.getByText('Optional detailed tool illustration').closest('details')).not.toHaveAttribute('open');
  expect(screen.getByText('Stage 8 fixture is not displayed')).toBeInTheDocument();
  expect(screen.getByText('Static load and neutral point shown when valid')).toBeInTheDocument();
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
  const { rerender } = render(withLoadedData({ rows }));
  expect(screen.queryByTestId('loaded-selected-jar-marker')).not.toBeInTheDocument();
  expect(document.querySelectorAll('[data-testid="loaded-bha-assembly"] .jarV6SelectedLoadedJar')).toHaveLength(0);
  rerender(withLoadedData({ rows, selectedJarId: 'jar-b' }));
  expect(screen.getByRole('img', { name: /selected jar Lower jar highlighted/ })).toBeInTheDocument();
  expect(screen.getByTestId('loaded-selected-jar-marker')).toBeVisible();
  const highlighted = document.querySelector('[data-testid="loaded-bha-assembly"] [data-row-key="jar-b"]');
  expect(highlighted.querySelector('rect')).toHaveClass('jarV6SelectedLoadedJar');
  expect(document.querySelector('[data-testid="loaded-bha-assembly"] [data-row-key="jar-a"] rect')).not.toHaveClass('jarV6SelectedLoadedJar');
  expect(document.querySelectorAll('[data-testid="loaded-bha-assembly"] .jarV6SelectedLoadedJar')).toHaveLength(1);
  expect(screen.getByText('Selected jar · Lower jar')).toBeInTheDocument();
});

test('draws continuous OD-scaled live components in assembly order with stabilizer detail and compact section specifications', () => {
  const bha = { id: 'continuous-assembly', selectedJarId: 'jar', drillpipeReferenceBitMdFt: 9531, rows: [
    { rowId: 'bit', category: 'BIT', toolName: 'PDC 8.5', length: 1, od: 8.5 },
    { rowId: 'stb-near-bit', category: 'STB', toolName: 'Stabilizer near bit', length: 4, od: 6.5, idSize: 2.813,
      librarySpecification: { geometry: { segments: [{ od: 8.5, externalGeometry: 'blade-envelope' }] } } },
    { rowId: 'lbha-dc', category: 'DC', toolName: 'Lower assembly collar', length: 25, od: 6.5, idSize: 2.813, connectionTop: 'NC38' },
    { rowId: 'stb-upper', category: 'STB', toolName: 'Upper stabilizer', length: 3, od: 6.5, idSize: 2.813,
      librarySpecification: { geometry: { segments: [{ od: 8.5, externalGeometry: 'blade-envelope' }] } } },
    { rowId: 'lower-dc', category: 'DC', toolName: 'Lower collar', length: 100, od: 6.5, idSize: 2.813, connectionBottom: 'NC50' },
    { rowId: 'jar', category: 'JAR', toolName: 'Live jar', length: 33, od: 6.5, idSize: 2.813 },
    { rowId: 'upper-dc', category: 'DC', toolName: 'Upper collar', length: 90, od: 6.5, idSize: 2.813 },
    { rowId: 'hwdp', category: 'HWDP', toolName: 'Heavy weight pipe', length: 275, od: 5, idSize: 3 },
    { rowId: 'dp', category: 'DP', toolName: 'Drillpipe', length: 9000, od: 5, idSize: 4.276, weight: 20 }
  ] };
  const loadedData = buildLoadedBhaPresentation({ bha, survey: { valid: false, errors: [{ message: 'No confirmed survey' }] }, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(loadedData.deployment.valid).toBe(true);
  expect(loadedData.positions.components.map(component => component.rowId)).toContain('jar');
  expect(loadedData.schematicSectionsByJarKey).toHaveProperty('jar');
  expect(loadedData.schematicSectionsByJarKey.jar).toMatchObject({
    upperDcIndices: [6], lowerDcIndices: [4], lowerBhaIndices: [0, 1, 2, 3], lowerBoundaryUnresolved: false
  });
  const sectionView = buildLoadedBhaSchematicSections({
    rows: loadedData.geometryBha.rows, components: loadedData.positions.components,
    selectedJarKey: bha.selectedJarId, sectionData: loadedData.schematicSectionsByJarKey[bha.selectedJarId]
  });
  expect(sectionView.selectedKey).toBe('jar');
  expect(sectionView.groups.map(group => group.label))
    .toEqual(['DP', 'HWDP', 'Upper DC', 'Jar', 'Lower DC', 'Lower BHA', 'Bit']);
  render(<JarFrameV6Presentation bha={bha} loadedData={loadedData} />);
  const svg = screen.getByTestId('loaded-bha-assembly');
  const segments = [...svg.querySelectorAll('[data-testid^="loaded-component-"]')];
  expect(segments.map(segment => segment.getAttribute('data-section')))
    .toEqual(['DP', 'HWDP', 'Upper DC', 'Jar', 'Lower DC', 'Lower BHA', 'Lower BHA', 'Lower BHA', 'Bit']);
  expect(segments.every((segment, index) => index === segments.length - 1 ||
    Math.abs(Number(segment.querySelector('rect').getAttribute('y')) + Number(segment.querySelector('rect').getAttribute('height')) -
      Number(segments[index + 1].querySelector('rect').getAttribute('y'))) < 1e-8)).toBe(true);
  expect(segments.map(segment => segment.querySelector('rect').getAttribute('width')))
    .toEqual(['10', '10', '13', '13', '13', '13', '13', '13', '17']);
  const lowerBhaStabilizers = segments.filter(segment => segment.getAttribute('data-component-category') === 'STB');
  expect(lowerBhaStabilizers).toHaveLength(2);
  expect(lowerBhaStabilizers.every(segment => segment.getAttribute('data-section') === 'Lower BHA')).toBe(true);
  expect(lowerBhaStabilizers.map(segment => segment.getAttribute('data-row-key'))).toEqual(['stb-upper', 'stb-near-bit']);
  expect(lowerBhaStabilizers.every(segment => segment.getAttribute('data-blade-envelope-width') === '14.4')).toBe(true);
  expect(lowerBhaStabilizers.every(segment => {
    const bladeEdges = [...segment.querySelectorAll('path.jarV6Blade')].map(path => path.getAttribute('d'));
    return bladeEdges.length === 2 && bladeEdges.every(path => /L\d+(?:\.\d+)? /.test(path));
  })).toBe(true);
  expect(lowerBhaStabilizers.every(segment => segment.querySelectorAll('path.jarV6Blade').length === 2)).toBe(true);
  expect(lowerBhaStabilizers.every(segment => segment.querySelector('rect.jarV6SchematicShape').getAttribute('width') === '13')).toBe(true);
  expect(lowerBhaStabilizers.every(segment => !segment.querySelector('rect.jarV6Blade'))).toBe(true);
  expect(Math.min(...lowerBhaStabilizers.map(segment => Number(segment.querySelector('rect.jarV6SchematicShape').getAttribute('y')))))
    .toBeGreaterThan(140);
  const bitSegment = segments.find(segment => segment.getAttribute('data-section') === 'Bit');
  expect(Number(bitSegment.querySelector('rect.jarV6SchematicShape').getAttribute('y')) +
    Number(bitSegment.querySelector('rect.jarV6SchematicShape').getAttribute('height'))).toBeCloseTo(189, 8);
  expect(segments.find(segment => segment.getAttribute('data-component-category') === 'JAR'))
    .toHaveAttribute('data-row-key', 'jar');
  expect(segments.find(segment => segment.getAttribute('data-component-category') === 'JAR'))
    .toHaveAttribute('data-selected', 'true');
  expect(screen.getByTestId('loaded-selected-jar-marker')).toBeVisible();
  expect(screen.getByLabelText('Loaded BHA component labels')).toHaveTextContent('OD 6.50 · ID 2.81 in · 33.00 ft');
  expect(screen.getByLabelText('Loaded BHA component labels')).toHaveTextContent(/3 tools.*STB.*DC.*32.00 ft/);
  expect(screen.getByLabelText('Loaded BHA component labels')).not.toHaveTextContent('Lower assembly collar');
  expect(screen.getByRole('note')).toHaveTextContent(/fixed Lower BHA transition cannot be confirmed from connection data/);
  const labels = screen.getByLabelText('Loaded BHA component labels');
  ['Upper DC', 'Jar', 'Lower DC', 'Lower BHA', 'Bit'].forEach(section => {
    const group = segments.filter(segment => segment.getAttribute('data-section') === section);
    const top = Math.min(...group.map(segment => Number(segment.querySelector('rect.jarV6SchematicShape').getAttribute('y'))));
    const bottom = Math.max(...group.map(segment => {
      const rect = segment.querySelector('rect.jarV6SchematicShape');
      return Number(rect.getAttribute('y')) + Number(rect.getAttribute('height'));
    }));
    const center = (top + bottom) / 2;
    const label = labels.querySelector(`[data-section="${section}"]`);
    expect(Number.parseFloat(label.style.top) * 208 / 100).toBeCloseTo(center, 8);
    const labelIndex = [...labels.querySelectorAll('[data-section]')].indexOf(label);
    expect(Number(svg.querySelectorAll('.jarV6SectionGuide')[labelIndex].getAttribute('y1'))).toBeCloseTo(center, 8);
  });
  const jarSegment = segments.find(segment => segment.getAttribute('data-section') === 'Jar');
  const jarRect = jarSegment.querySelector('rect.jarV6SchematicShape');
  expect(jarRect).toHaveClass('jarV6SelectedLoadedJar');
  expect(Number.parseFloat(labels.querySelector('[data-section="Jar"]').style.top) * 208 / 100)
    .toBeCloseTo(Number(jarRect.getAttribute('y')) + Number(jarRect.getAttribute('height')) / 2, 8);
});

test('loaded jar selection is presentation-only and updates the highlighted live jar', () => {
  const bha = { rows: [
    { rowId: 'jar-a', category: 'JAR', toolName: 'Upper jar', length: 30, od: 6.5 },
    { rowId: 'dc', category: 'DC', length: 100, od: 6.5 },
    { rowId: 'jar-b', category: 'JAR', toolName: 'Lower jar', length: 30, od: 6.5 }
  ] };
  const before = JSON.stringify(bha);
  render(withLoadedData(bha));
  const select = screen.getByRole('combobox', { name: 'Select loaded BHA jar' });
  fireEvent.change(select, { target: { value: 'jar-a' } });
  expect(screen.getByText('Selected jar · Upper jar')).toBeInTheDocument();
  fireEvent.change(select, { target: { value: 'jar-b' } });
  expect(screen.getByText('Selected jar · Lower jar')).toBeInTheDocument();
  expect(bha.rows[0].rowId).toBe('jar-a');
  expect(JSON.stringify(bha)).toBe(before);
});

test('refreshes live jar geometry when the active BHA row changes', () => {
  const bha = { id: 'changing-bha', selectedJarId: 'jar', rows: [
    { rowId: 'jar', category: 'JAR', toolName: 'Live jar', length: 30, od: 6.5, idSize: 2.8, weight: 100 },
    { rowId: 'dc', category: 'DC', length: 100, od: 6.5, idSize: 2.8, weight: 100 }
  ] };
  const view = render(withLoadedData(bha));
  const detailsFor = length => [...screen.getByLabelText('Loaded BHA component labels').children]
    .find(label => label.title.includes(`${length}.00 ft`))?.title;
  expect(detailsFor(30)).toContain('OD 6.50 · ID 2.80 in · 30.00 ft');
  const updated = { ...bha, rows: bha.rows.map(row => row.rowId === 'jar' ? { ...row, length: 45, od: 7 } : row) };
  view.rerender(withLoadedData(updated));
  expect(detailsFor(45)).toMatch(/OD 7\.00 · ID 2\.80 in · 45\.00 ft/);
  expect(screen.getByTestId('loaded-selected-jar-marker')).toBeVisible();
});

test('keeps concise section labels and states when the Lower DC boundary is unresolved', () => {
  const bha = { rows: [
    { rowId: 'bit', category: 'BIT', toolName: 'PDC bit', length: 1, od: 8.5, weight: 40 },
    { rowId: 'dc-unknown', category: 'DC', toolName: 'Undimensioned collar', length: 20, weight: 100 },
    { rowId: 'jar', category: 'JAR', toolName: 'Selected jar', length: 30, od: 6.5, idSize: 2.813, weight: 100 }
  ] };
  render(withLoadedData(bha));
  expect(screen.getByRole('note')).toHaveTextContent(/Lower DC \/ fixed Lower BHA boundary unavailable/);
  expect([...screen.getByLabelText('Loaded BHA component labels').querySelectorAll('b')].map(label => label.textContent))
    .toEqual(['Jar', 'Section unavailable', 'Bit']);
  expect(screen.getByLabelText('Loaded BHA component labels')).not.toHaveTextContent('Undimensioned collar');
  const unavailableDc = document.querySelector('[data-testid="loaded-bha-assembly"] [data-component-category="DC"] rect.jarV6UnknownOd');
  expect(unavailableDc).toHaveAttribute('width', '11');
  expect(screen.getByLabelText('Loaded BHA component labels')).toHaveTextContent('OD — · ID — in · 20.00 ft');
});

test('opt-in Stage 8 demo shows two populated charts and keeps fixture reference separate from selected position', () => {
  const bha = { id: 'unchanged-bha', rows: [{ category: 'JAR', length: 33, od: 6.5 }], jarImpactInputs: { stroke: '12' } };
  const before = JSON.stringify(bha);
  render(withLoadedData(bha));
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
  render(withLoadedData({ rows: [] }));
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
  render(withLoadedData(bha));
  fireEvent.click(screen.getByRole('radio', { name: 'Stage 8 OES Research Demo' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Select hypothetical jar centre' }), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Loaded BHA' }));
  expect(document.querySelector('.jarV6Presentation')).toHaveAttribute('data-presentation-mode', 'loaded-bha');
  expect(document.querySelectorAll('.jarV6SampleMarker')).toHaveLength(0);
  expect(screen.getByRole('combobox', { name: 'Select loaded BHA jar' })).toHaveValue('j1');
  expect(screen.getByText('Stage 8 fixture is not displayed')).toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(before);
});
