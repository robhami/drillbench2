import React from 'react';
import { act, render, screen } from '@testing-library/react';
import StringFrame, { calculateStringFrameLabelLayout, compressedLengthWeight } from './StringFrame';
import { buildLoadedBhaPresentation, buildLoadedBhaSchematicSections } from '../JarConfiguration/loadedBhaPresentation';

const bha = { id: 'string-frame-fixture', selectedJarId: 'jar', drillpipeReferenceBitMdFt: 9531, rows: [
  { rowId: 'bit', category: 'BIT', toolName: 'PDC bit', length: 1, od: 8.5 },
  { rowId: 'stb-1', category: 'STB', toolName: 'Near-bit stabilizer with long description', length: 4, od: 6.5, idSize: 2.813, maximumOd: 8.5 },
  { rowId: 'fixed-dc', category: 'DC', toolName: 'Fixed assembly collar', length: 25, od: 6.5, idSize: 2.813 },
  { rowId: 'stb-2', category: 'STB', toolName: 'Upper stabilizer', length: 3, od: 6.5, idSize: 2.813, maximumOd: 8.5 },
  { rowId: 'lower-dc', category: 'DC', toolName: 'Lower drill collar', length: 100, od: 6.5, idSize: 2.813 },
  { rowId: 'jar', category: 'JAR', toolName: 'Selected hydraulic jar', length: 33, od: 6.5, idSize: 2.813 },
  { rowId: 'upper-dc', category: 'DC', toolName: 'Upper drill collar', length: 90, od: 6.5, idSize: 2.813 },
  { rowId: 'hwdp', category: 'HWDP', toolName: 'Heavy weight pipe', length: 275, od: 5, idSize: 3 },
  { rowId: 'dp', category: 'DP', toolName: 'Drillpipe', length: 9000, od: 5, idSize: 4.276, weight: 20 }
] };

test('BHA Schematic follows Stage 8 label styling and aligns concise labels to the live continuous assembly', () => {
  const loadedData = buildLoadedBhaPresentation({ bha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  render(<StringFrame bha={bha} loadedData={loadedData} selectedLoadedJarKey="jar" />);
  const svg = screen.getByTestId('loaded-bha-assembly');
  expect(screen.getByRole('complementary', { name: 'BHA Schematic loaded assembly' })).toBeInTheDocument();
  const viewHeight = Number(svg.getAttribute('viewBox').split(' ')[3]);
  // At 1366 x 768, this keeps the full default overview (including header and
  // collapsed static-results summary) inside the StringFrame content viewport.
  expect(viewHeight + 97).toBeLessThanOrEqual(768 - 24 - 36);
  expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
  const segments = [...svg.querySelectorAll('[data-testid^="loaded-component-"]')];
  expect(segments.map(segment => segment.getAttribute('data-row-key'))).toEqual([
    'dp', 'hwdp', 'upper-dc', 'jar', 'lower-dc', 'stb-2', 'fixed-dc', 'stb-1', 'bit'
  ]);
  expect(segments.find(segment => segment.getAttribute('data-row-key') === 'jar')).toHaveAttribute('data-selected', 'true');
  expect(segments.filter(segment => segment.getAttribute('data-component-category') === 'STB')
    .every(segment => segment.getAttribute('data-section') === 'Lower BHA')).toBe(true);
  const labels = screen.getByLabelText('BHA Schematic component labels');
  expect([...labels.querySelectorAll('[data-section]')].map(label => label.getAttribute('data-section')))
    .toEqual(['DP', 'HWDP', 'Upper DC', 'Jar', 'Lower DC', 'Lower BHA', 'Bit']);
  expect(labels).toHaveTextContent('Lower BHA · stack order');
  expect(labels).toHaveTextContent('STB → DC 25.00ft → STB → bit');
  expect(labels).toHaveTextContent('STB specifications vary · hover each stabilizer for dimensions');
  expect(labels).not.toHaveTextContent('Near-bit stabilizer with long description');
  const groups = buildLoadedBhaSchematicSections({ rows: loadedData.geometryBha.rows,
    components: loadedData.positions.components, selectedJarKey: 'jar',
    sectionData: loadedData.schematicSectionsByJarKey.jar }).groups;
  const expectedLayout = calculateStringFrameLabelLayout(groups, 42, true, 399);
  const renderedRows = [...labels.querySelectorAll('[data-section]')];
  expect(labels).toHaveClass('stringFrameLabels');
  expect(labels.closest('.stringFrameTall')).toBeInTheDocument();
  // Label flow is established by the tall flex-column CSS rule. jsdom may
  // normalize omitted/default inline declarations differently, so verify the
  // class contract and reject only inline positioning that would take rows
  // out of flow or apply a real top offset.
  expect(renderedRows.every(row => row.classList.contains('stringFrameLabelRow') &&
    ['', 'static', 'relative'].includes(row.style.position) && ['', 'auto'].includes(row.style.top) &&
    !row.style.left && !row.style.transform)).toBe(true);
  expect(renderedRows.map(row => Number.parseFloat(row.style.height)))
    .toEqual(expectedLayout.map(row => row.height));
  expect(expectedLayout.every((row, index) => index === 0 || Math.abs(row.top - expectedLayout[index - 1].bottom) < 1e-8)).toBe(true);
  expect(svg.closest('.jarV6SchematicGrid')).toBe(labels.closest('.jarV6SchematicGrid'));
  expect(renderedRows.find(row => row.dataset.section === 'Lower DC')).toHaveTextContent('Lower DC · 6.50in');
  expect(renderedRows.find(row => row.dataset.section === 'Lower DC')).toHaveTextContent('ID 2.81in · 100.00ft');
  const loadedDpLength = loadedData.geometryBha.rows.filter(row => row.category === 'DP').reduce((sum, row) => sum + Number(row.length), 0);
  expect(renderedRows.find(row => row.dataset.section === 'DP')).toHaveTextContent(
    `${loadedDpLength.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}ft loaded`);
  expect(renderedRows.find(row => row.dataset.section === 'Lower DC')).toHaveTextContent(/boundary inferred from entered geometry; connection verification unavailable/);
  expect(renderedRows.find(row => row.dataset.section === 'Lower DC').getAttribute('title'))
    .toContain('fixed Lower BHA transition cannot be confirmed from connection data');
  expect(screen.getByText(/not to scale/i)).toBeVisible();
  expect(screen.getByText('Static calculations and boundary details').closest('details')).not.toHaveAttribute('open');
  expect(screen.getByText(/Straight-hole calcStraightDrag/).closest('details')).toBeTruthy();
  const heights = Object.fromEntries(segments.map(segment => [segment.dataset.rowKey, Number(segment.querySelector('rect').getAttribute('height'))]));
  expect(heights.hwdp).toBeGreaterThan(heights.dp);
  expect(heights.hwdp).toBeGreaterThan(heights['upper-dc']);
  expect(heights['upper-dc']).toBeGreaterThan(heights.jar);
  const collarWidth = Number(segments.find(segment => segment.dataset.rowKey === 'lower-dc').querySelector('rect').getAttribute('width'));
  const stabilizer = segments.find(segment => segment.dataset.rowKey === 'stb-2');
  expect(Number(stabilizer.dataset.bladeEnvelopeWidth)).toBeGreaterThan(collarWidth);
  expect(Number(stabilizer.dataset.bladeEnvelopeWidth)).toBe(17);
  expect(stabilizer.getAttribute('title')).toContain('body OD 6.50in · gauge OD 8.50in');
  expect(new Set(expectedLayout.map(row => row.height)).size).toBeGreaterThan(1);
  expect(Number(segments.find(segment => segment.dataset.rowKey === 'bit').querySelector('rect').getAttribute('width'))).toBeGreaterThan(collarWidth);
  const dp = segments.find(segment => segment.dataset.rowKey === 'dp');
  expect(svg.querySelectorAll('[data-discontinuity="true"]')).toHaveLength(1);
  expect(svg.querySelector('.jarV6Discontinuity')).toBeInTheDocument();
  expect(dp.getAttribute('title')).toContain('9,000.00ft');
  expect(svg.querySelectorAll('.jarV6SectionGuide')).toHaveLength(0);
  renderedRows.forEach(label => {
    const index = renderedRows.indexOf(label);
    const layoutRow = expectedLayout[index];
    const groupSegments = segments.filter(segment => segment.dataset.section === label.dataset.section);
    const firstRect = groupSegments[0].querySelector('rect'), lastRect = groupSegments.at(-1).querySelector('rect');
    if (label.dataset.section === 'Bit') {
      expect(Number(firstRect.getAttribute('y'))).toBeCloseTo(layoutRow.top + 10, 4);
      return;
    }
    const bitTip = groupSegments.at(-1).querySelector('[data-testid="loaded-compact-bit-tip"]');
    const geometryBottom = bitTip ? Number(bitTip.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).at(-1)) :
      Number(lastRect.getAttribute('y')) + Number(lastRect.getAttribute('height'));
    const geometryCenter = (Number(firstRect.getAttribute('y')) + geometryBottom) / 2;
    expect(geometryCenter).toBeCloseTo(layoutRow.center + 10, 4);
  });
  const bitHeight = Number(segments.find(segment => segment.dataset.rowKey === 'bit').querySelector('rect').getAttribute('height'));
  expect(bitHeight).toBeGreaterThanOrEqual(6);
  expect(bitHeight).toBeLessThanOrEqual(12);
  const bitRect = segments.find(segment => segment.dataset.rowKey === 'bit').querySelector('rect');
  const bitTip = screen.getByTestId('loaded-compact-bit-tip');
  const triangle = bitTip.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  const bitX = Number(bitRect.getAttribute('x')), bitY = Number(bitRect.getAttribute('y'));
  const bitWidth = Number(bitRect.getAttribute('width')), bitBottom = bitY + bitHeight;
  expect(bitWidth).toBe(17);
  expect(triangle[0]).toBeCloseTo(bitX, 6);
  expect(triangle[2]).toBeCloseTo(bitX + bitWidth, 6);
  expect(triangle[1]).toBeCloseTo(bitBottom, 6);
  expect(triangle[3]).toBeCloseTo(bitBottom, 6);
  expect(triangle[5]).toBeGreaterThan(bitBottom);
  expect(segments.find(segment => segment.dataset.rowKey === 'bit').querySelectorAll('rect')).toHaveLength(1);
});

test('loaded bit renders one compact OD-width body joined directly to its cutting profile', () => {
  const loadedData = buildLoadedBhaPresentation({ bha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  render(<StringFrame bha={bha} loadedData={loadedData} selectedLoadedJarKey="jar" />);
  const bit = screen.getByTestId('loaded-component-8');
  const body = screen.getByTestId('loaded-compact-bit-body');
  const tip = screen.getByTestId('loaded-compact-bit-tip');
  const bodyX = Number(body.getAttribute('x'));
  const bodyY = Number(body.getAttribute('y'));
  const bodyWidth = Number(body.getAttribute('width'));
  const bodyHeight = Number(body.getAttribute('height'));
  const points = tip.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  expect(bit.querySelectorAll('rect')).toHaveLength(1);
  expect(bit.querySelectorAll('path.jarV6BitTip')).toHaveLength(1);
  expect(body).toHaveClass('jarV6Bit');
  expect(bodyWidth).toBe(17); // entered 8.5 in OD at the existing 2 SVG units/in scale
  expect(bodyHeight).toBe(8);
  expect(points[0]).toBeCloseTo(bodyX, 6);
  expect(points[2]).toBeCloseTo(bodyX + bodyWidth, 6);
  expect(points[1]).toBeCloseTo(bodyY + bodyHeight, 6);
  expect(points[3]).toBeCloseTo(bodyY + bodyHeight, 6);
  expect(points[5] - bodyY).toBe(14);
  const rail = bit.ownerSVGElement.querySelector('.jarV6Rail');
  expect(Number(rail.getAttribute('y2'))).toBeCloseTo(bodyY, 6);
  expect(Number(rail.getAttribute('y2'))).toBeLessThan(points[5]);
  const lowerBhaSegments = [...bit.ownerSVGElement.querySelectorAll('[data-section="Lower BHA"]')];
  const finalLowerBhaRect = lowerBhaSegments.at(-1).querySelector('rect');
  const finalLowerBhaBottom = Number(finalLowerBhaRect.getAttribute('y')) + Number(finalLowerBhaRect.getAttribute('height'));
  expect(bodyY).toBeCloseTo(finalLowerBhaBottom, 6);
  expect(bit.querySelectorAll('rect')).toHaveLength(1);
  expect(bit.querySelectorAll('line, path:not(.jarV6BitTip)')).toHaveLength(0);
  expect(bodyHeight).toBeLessThan(Number(screen.getByTestId('loaded-component-7').querySelector('rect').getAttribute('height')));
});

test('label tracks avoid overlaps and preserve loaded Lower BHA tool geometry and order', () => {
  const components = bha.rows.map((row, index) => ({ ...row, row, index, startFt: index * 10, endFt: (index + 1) * 10, length: row.length }));
  const data = buildLoadedBhaPresentation({ bha, survey: null, surfaceReferenceMdFt: 0 }).schematicSectionsByJarKey.jar;
  const groups = buildLoadedBhaSchematicSections({ rows: bha.rows, components, selectedJarKey: 'jar', sectionData: data }).groups;
  const labels = calculateStringFrameLabelLayout(groups);
  expect(labels.every((row, index) => index === 0 || row.top >= labels[index - 1].bottom)).toBe(true);
  const lower = labels.find(row => row.group.label === 'Lower BHA');
  expect(lower.height).toBeGreaterThanOrEqual(52);
  expect(lower.details).toHaveLength(3);
  expect(lower.secondary).toBe('STB → DC 25.00ft → STB → bit');
  expect(compressedLengthWeight(9000)).toBeGreaterThan(compressedLengthWeight(4));
});

test('identically dimensioned stabilizers share one Lower BHA specification line', () => {
  const identicalBha = { ...bha, rows: bha.rows.map(row => row.category === 'STB' ? { ...row, length: 4 } : row) };
  const loadedData = buildLoadedBhaPresentation({ bha: identicalBha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  render(<StringFrame bha={identicalBha} loadedData={loadedData} selectedLoadedJarKey="jar" />);
  const labels = screen.getByLabelText('BHA Schematic component labels');
  expect(labels).toHaveTextContent('Each STB · 4.00ft body · OD 6.50in · gauge OD 8.50in');
  expect(labels).not.toHaveTextContent('STB specifications vary');
  expect(labels.querySelectorAll('[data-section="Lower BHA"]')).toHaveLength(1);
});

test('section and tool dimensions use compact units and show available uniform loaded weights', () => {
  const weights = { dp: 19.5, hwdp: 49.3, 'upper-dc': 92, 'lower-dc': 88.5, jar: 78.8 };
  const weightedBha = { ...bha, rows: bha.rows.map(row => ({ ...row, weight: weights[row.rowId] ?? row.weight })) };
  const loadedData = buildLoadedBhaPresentation({ bha: weightedBha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  render(<StringFrame bha={weightedBha} loadedData={loadedData} selectedLoadedJarKey="jar" />);
  const labels = screen.getByLabelText('BHA Schematic component labels');
  expect(labels.querySelector('[data-section="DP"]')).toHaveTextContent('DP · 5.00in · 19.5#');
  expect(labels.querySelector('[data-section="HWDP"]')).toHaveTextContent('HWDP · 5.00in · 49.3#');
  expect(labels.querySelector('[data-section="Upper DC"]')).toHaveTextContent('Upper DC · 6.50in · 92.0#');
  expect(labels.querySelector('[data-section="Lower DC"]')).toHaveTextContent('Lower DC · 6.50in · 88.5#');
  expect(labels.querySelector('[data-section="Jar"]')).toHaveTextContent('OD 6.50in · ID 2.81in · 33.00ft · 78.8#');
  expect(labels.textContent).not.toMatch(/ppf|lb\/ft|#\/ft/);
  expect(labels.querySelector('[data-section="DP"]')).toHaveTextContent('ID 4.28in · 9,000.00ft loaded');
  expect(labels.querySelector('[data-section="Bit"]')).toHaveTextContent('Bit · 8.50in');
  expect(labels).toHaveTextContent('STB specifications vary · hover each stabilizer for dimensions');
  expect(screen.getByTestId('loaded-component-0').getAttribute('title')).toContain('19.5#');
  expect(screen.getByTestId('loaded-component-5').getAttribute('title')).toContain('OD 6.50in · ID 2.81in · 3.00ft');
  expect(screen.getByTestId('loaded-component-8').getAttribute('title')).toContain('OD 8.50in · ID —in · 1.00ft');
});

test('mixed or unavailable section weights are not presented as uniform', () => {
  const weightedBha = { ...bha, rows: bha.rows.map(row => ({ ...row,
    weight: row.rowId === 'upper-dc' ? 92 : row.weight })) };
  const extraUpperDc = { rowId: 'upper-dc-2', category: 'DC', toolName: 'Second upper collar', length: 20,
    od: 6.5, idSize: 2.813, weight: 95 };
  const rowIndex = weightedBha.rows.findIndex(row => row.rowId === 'upper-dc');
  weightedBha.rows.splice(rowIndex + 1, 0, extraUpperDc);
  const loadedData = buildLoadedBhaPresentation({ bha: weightedBha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  render(<StringFrame bha={weightedBha} loadedData={loadedData} selectedLoadedJarKey="jar" />);
  const labels = screen.getByLabelText('BHA Schematic component labels');
  const upperDc = labels.querySelector('[data-section="Upper DC"]');
  expect(upperDc).toHaveTextContent('Upper DC · 6.50in');
  expect(upperDc).not.toHaveTextContent('#');
  expect(upperDc.getAttribute('title')).toContain('92.0#');
  expect(upperDc.getAttribute('title')).toContain('95.0#');
  const hwdp = labels.querySelector('[data-section="HWDP"]');
  expect(hwdp).not.toHaveTextContent('#');
});

test('resizing BHA Schematic expands long sections while compact sections and the bit stay fixed', () => {
  const OriginalResizeObserver = global.ResizeObserver;
  const observers = [];
  global.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() {}
  };
  try {
    const loadedData = buildLoadedBhaPresentation({ bha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
    render(<StringFrame bha={bha} loadedData={loadedData} selectedLoadedJarKey="jar" />);
    const content = screen.getByLabelText('BHA Schematic');
    let contentHeight = 700;
    Object.defineProperty(content, 'clientHeight', { configurable: true, get: () => contentHeight });
    const observer = observers[0];
    act(() => observer.callback()); // establish the initial floating-window height
    const svg = screen.getByTestId('loaded-bha-assembly');
    const viewHeight = () => Number(svg.getAttribute('viewBox').split(' ')[3]);
    const sectionHeight = section => {
      const rects = [...svg.querySelectorAll(`[data-section="${section}"] rect`)];
      const first = Number(rects[0].getAttribute('y'));
      const last = rects.at(-1);
      return Number(last.getAttribute('y')) + Number(last.getAttribute('height')) - first;
    };
    const compact = Object.fromEntries(['DP', 'Jar', 'Lower BHA', 'Bit'].map(section => [section, sectionHeight(section)]));
    const longSections = Object.fromEntries(['HWDP', 'Upper DC', 'Lower DC'].map(section => [section, sectionHeight(section)]));
    contentHeight = 920;
    act(() => observer.callback());
    expect(viewHeight()).toBeGreaterThan(420);
    for (const section of ['HWDP', 'Upper DC', 'Lower DC']) expect(sectionHeight(section)).toBeGreaterThan(longSections[section]);
    for (const section of ['DP', 'Jar', 'Lower BHA', 'Bit']) expect(sectionHeight(section)).toBeCloseTo(compact[section], 4);
    expect(Number(svg.querySelector('[data-row-key="bit"] rect').getAttribute('height'))).toBeLessThanOrEqual(12);
    const labels = [...screen.getByLabelText('BHA Schematic component labels').querySelectorAll('[data-section]')];
    for (const label of labels) {
      const groupRects = [...svg.querySelectorAll(`[data-section="${label.dataset.section}"] rect`)];
      const first = Number(groupRects[0].getAttribute('y'));
      const last = groupRects.at(-1);
      if (label.dataset.section === 'Bit') {
        const lowerRects = [...svg.querySelectorAll('[data-section="Lower BHA"] rect')];
        const finalLowerBhaRect = lowerRects.at(-1);
        expect(Number(groupRects[0].getAttribute('y'))).toBeCloseTo(
          Number(finalLowerBhaRect.getAttribute('y')) + Number(finalLowerBhaRect.getAttribute('height')), 4);
        return;
      }
      const bitTip = label.dataset.section === 'Bit'
        ? svg.querySelector('[data-testid="loaded-compact-bit-tip"]') : null;
      const geometryBottom = bitTip ? Number(bitTip.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).at(-1))
        : Number(last.getAttribute('y')) + Number(last.getAttribute('height'));
      const center = (first + geometryBottom) / 2;
      const labelTop = labels.slice(0, labels.indexOf(label)).reduce((sum, row) => sum + Number.parseFloat(row.style.height), 0);
      expect(center).toBeCloseTo(labelTop + Number.parseFloat(label.style.height) / 2 + 10, 4);
    }
    contentHeight = 600;
    act(() => observer.callback());
    expect(viewHeight()).toBe(420);
  } finally {
    if (OriginalResizeObserver === undefined) delete global.ResizeObserver;
    else global.ResizeObserver = OriginalResizeObserver;
  }
});
