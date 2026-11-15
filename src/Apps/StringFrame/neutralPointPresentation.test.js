import React from 'react';
import { render, screen } from '@testing-library/react';
import { buildNeutralPointPresentation } from './neutralPointPresentation';
import V6ContinuousAssemblyDrawing from './v6Drawing';

const positions = { components: [
  { rowId: 'dc', category: 'DC', startFromBit: 0, endFromBit: 100, length: 100 },
  { rowId: 'dp', category: 'DP', startFromBit: 100, endFromBit: 1000, length: 900 }
] };
const segments = [
  { componentIndex: 1, key: 'dp', row: { rowId: 'dp', category: 'DP' }, section: 'DP', y1: 10, y2: 30 },
  { componentIndex: 0, key: 'dc', row: { rowId: 'dc', category: 'DC' }, section: 'Lower DC', y1: 30, y2: 130 }
];
const straight = (mode = 'slide', crossing = 25) => ({ drillingMode: mode, neutralPointFt: crossing,
  loadProfile: { valid: true, bitAxialForce: 100, components: [
    // This force pair crosses zero at the fixture's declared bit-relative depth.
    { startFromBit: 0, endFromBit: 100, bottomAxialForce: crossing, topAxialForce: crossing - 100 }
  ] } });
const resolve = (overrides = {}) => buildNeutralPointPresentation({ straight: straight(), surveyLoads: null,
  drillingMode: 'slide', positions, segments, totalLength: 1000, jarCentreFromBitFt: 40, ...overrides });

test.each(['reference', 'slide', 'rotate'])('maps the existing %s straight-hole result through its component geometry', mode => {
  const data = resolve({ drillingMode: mode, straight: straight(mode) });
  const marker = data.markers.find(item => item.key === 'neutral-straight');
  expect(marker.y).toBe(105); // 25% from bit-side y2=130 toward top-side y1=30.
  expect(marker.guideClass).toBe('stringFrameNeutralGuide');
  expect(marker.fullWidth).toBe(true);
  expect(data.outputs[0].label).toBe(`Straight-hole · ${mode}`);
  expect(data.outputs[0].jarDistanceLabel).toBe('NP — 15.00ft below jar');
});

test('renders the neutral point as a red dashed full-width horizontal SVG line', () => {
  const data = resolve();
  render(<V6ContinuousAssemblyDrawing viewWidth={166} viewHeight={140} yTop={10} yBottom={130} segments={[]}
    markers={data.markers} ariaLabel="Neutral point rendering" />);
  const line = screen.getByTestId('neutral-point-straight-line');
  const marker = line.closest('g');
  const label = screen.getByTestId('neutral-point-straight-label');
  expect(line).toHaveClass('stringFrameNeutralGuide');
  expect(line).toHaveAttribute('x1', '0.5');
  expect(line).toHaveAttribute('x2', '60.5');
  expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
  expect(marker.querySelectorAll('line')).toHaveLength(1); // No vertical connector accompanies the horizontal NP line.
  expect(marker.querySelectorAll('path')).toHaveLength(0);
  expect(label).toHaveTextContent('NP −15.00ft');
  expect(label).not.toHaveTextContent(/above jar|below jar/);
  expect(Number(label.getAttribute('x')) + Number(label.getAttribute('textLength'))).toBeLessThanOrEqual(166);
  expect(data.markers[0].label).toBe('NP −15.00ft');
  expect(screen.queryByTestId('neutral-point-straight')).not.toBeInTheDocument();
});

test('preserves survey from-bit and MD datums and only accepts the selected Slide/Rotate mode', () => {
  const surveyLoads = { valid: true, mode: 'slide', bitMdFt: 2000, neutralPoints: [{ fromBitFt: 25, mdFt: 1975, componentIndex: 0 }], neutralIntervals: [] };
  const data = resolve({ surveyLoads, surveyMode: true });
  expect(data.outputs[0].point).toEqual({ fromBitFt: 25, mdFt: 1975, componentIndex: 0 });
  expect(data.outputs[0].jarSeparationFt).toBe(-15);
  expect(data.outputs[0].jarDistanceLabel).toBe('NP — 15.00ft below jar');
  expect(data.outputs[0].label).toBe('Survey · slide');
  expect(data.markers).toHaveLength(1);
  expect(data.markers[0].key).toBe('neutral-survey');
  expect(data.markers[0].y).toBe(105);
  expect(resolve({ drillingMode: 'reference', surveyLoads, surveyMode: true }).outputs[0].reason).toMatch(/Survey Reference is unavailable/);
  expect(resolve({ drillingMode: 'rotate', surveyLoads, surveyMode: true }).outputs[0].reason).toMatch(/matching drilling-mode/);
  const rotateSurvey = { ...surveyLoads, mode: 'rotate', neutralPoints: [{ fromBitFt: 55, mdFt: 1945, componentIndex: 0 }] };
  const rotate = resolve({ drillingMode: 'rotate', straight: straight('rotate'), surveyLoads: rotateSurvey, surveyMode: true });
  expect(rotate.outputs[0].point).toEqual({ fromBitFt: 55, mdFt: 1945, componentIndex: 0 });
  expect(rotate.outputs[0].jarDistanceLabel).toBe('NP — 15.00ft above jar');
  expect(rotate.markers.map(marker => marker.key)).toEqual(['neutral-survey']);
});

test('labels NP above, below and coincident with jar using signed deployed distances and ft units', () => {
  const above = resolve({ jarCentreFromBitFt: 10 }).outputs[0];
  expect(above.jarSeparationFt).toBe(15);
  expect(above.jarDistanceLabel).toBe('NP — 15.00ft above jar');
  expect(resolve({ jarCentreFromBitFt: 10 }).markers[0].label).toBe('NP +15.00ft');

  const below = resolve({ jarCentreFromBitFt: 40 }).outputs[0];
  expect(below.jarSeparationFt).toBe(-15);
  expect(below.jarDistanceLabel).toBe('NP — 15.00ft below jar');
  expect(resolve({ jarCentreFromBitFt: 40 }).markers[0].label).toBe('NP −15.00ft');

  const atJar = resolve({ jarCentreFromBitFt: 25 }).outputs[0];
  expect(atJar.jarSeparationFt).toBe(0);
  expect(atJar.jarDistanceLabel).toBe('NP — At jar');
  expect(resolve({ jarCentreFromBitFt: 25 }).markers[0].label).toBe('NP 0.00ft');

  const precise = resolve({ jarCentreFromBitFt: 25, straight: { drillingMode: 'slide', neutralPointFt: 75.06,
    loadProfile: { valid: true, bitAxialForce: 300.24, components: [
      { startFromBit: 0, endFromBit: 100, bottomAxialForce: 300.24, topAxialForce: -99.76 }
    ] } } }).outputs[0];
  expect(precise.jarDistanceLabel).toBe('NP — 50.06ft above jar');
});

test('does not invent a jar-relative distance when selected jar geometry is missing or invalid', () => {
  for (const jarCentreFromBitFt of [null, NaN, -1, 1001]) {
    const data = resolve({ jarCentreFromBitFt });
    expect(data.markers).toHaveLength(1); // Existing NP validity and marker placement are unchanged.
    expect(data.outputs[0].jarDistanceLabel).toBeUndefined();
    expect(data.outputs[0].jarDistanceReason).toMatch(/jar centre geometry is unavailable/);
  }
});

test('suppresses markers for invalid straight inputs and reports the solver reason', () => {
  const data = resolve({ straight: { drillingMode: 'slide', neutralPointFt: null,
    loadProfile: { valid: false, error: 'Rotate mode requires RPM.' } } });
  expect(data.markers).toHaveLength(0);
  expect(data.outputs[0].reason).toBe('Rotate mode requires RPM.');
});

test('reports a valid profile with no zero crossing without placing a marker', () => {
  const data = resolve({ straight: { drillingMode: 'slide', neutralPointFt: null, loadProfile: { valid: true, bitAxialForce: 10, components: [
    { startFromBit: 0, endFromBit: 100, bottomAxialForce: 10, topAxialForce: 2 }
  ] } } });
  expect(data.markers).toHaveLength(0);
  expect(data.outputs[0].reason).toMatch(/No straight-hole neutral point/);
});

test('does not mistake the straight solver first root for a unique crossing', () => {
  const multiple = { ...straight(), neutralPointFt: 25, loadProfile: { valid: true, bitAxialForce: 100, components: [
    { startFromBit: 0, endFromBit: 100, bottomAxialForce: 100, topAxialForce: -100 },
    { startFromBit: 100, endFromBit: 200, bottomAxialForce: -100, topAxialForce: 100 }
  ] } };
  const data = resolve({ straight: multiple });
  expect(data.markers).toHaveLength(0);
  expect(data.outputs[0].reason).toMatch(/Multiple straight-hole crossings/);
});

test('suppresses survey markers for multiple crossings, neutral intervals and uncovered survey', () => {
  const multiple = { valid: true, mode: 'slide', bitMdFt: 1000,
    neutralPoints: [{ fromBitFt: 20, mdFt: 980 }, { fromBitFt: 40, mdFt: 960 }], neutralIntervals: [] };
  expect(resolve({ surveyLoads: multiple, surveyMode: true }).outputs[0].reason).toMatch(/Multiple survey crossings/);
  expect(resolve({ surveyLoads: { ...multiple, neutralPoints: [], neutralIntervals: [{ startFromBit: 20, endFromBit: 40 }] }, surveyMode: true }).outputs[0].reason)
    .toMatch(/neutral interval/);
  expect(resolve({ surveyLoads: { valid: false, mode: 'slide', errors: ['Survey coverage missing 0–50 ft; no extrapolation is permitted.'] }, surveyMode: true }).outputs[0].reason)
    .toMatch(/no extrapolation is permitted/);
});

test('shows only the selected mode marker and uses the signed jar-relative label', () => {
  const data = resolve({ drillingMode: 'rotate', straight: straight('rotate', 70), jarCentreFromBitFt: 40 });
  expect(data.markers).toHaveLength(1);
  expect(data.markers[0].key).toBe('neutral-straight');
  expect(data.markers[0].label).toBe('NP +30.00ft');

  const inconsistent = resolve({ drillingMode: 'rotate', straight: { ...straight('rotate', 70), neutralPointFt: 60 } });
  expect(inconsistent.markers).toHaveLength(0);
  expect(inconsistent.outputs[0].reason).toMatch(/inconsistent with its load profile/);
});

test('uses a section-level approximate marker for a neutral point in discontinuous DP', () => {
  const data = resolve({ straight: { drillingMode: 'slide', neutralPointFt: 550,
    loadProfile: { valid: true, bitAxialForce: 2, components: [
      { startFromBit: 0, endFromBit: 100, bottomAxialForce: 2, topAxialForce: 1 },
      { startFromBit: 100, endFromBit: 1000, bottomAxialForce: 1, topAxialForce: -1 }
    ] } } });
  const marker = data.markers.find(item => item.key === 'neutral-straight');
  expect(marker.y).toBe(20);
  expect(marker.approximate).toBe(true);
  expect(data.outputs[0].reason).toMatch(/section only/);
  expect(data.outputs[0].jarDistanceLabel).toBe('NP — 510.00ft above jar');
});

test('reports a valid point outside the deployed drawing instead of clamping it', () => {
  const data = resolve({ straight: { drillingMode: 'slide', neutralPointFt: 25,
    loadProfile: { valid: true, bitAxialForce: 1, components: [
      { startFromBit: 0, endFromBit: 100, bottomAxialForce: 1, topAxialForce: -3 }
    ] } }, totalLength: 20 });
  expect(data.markers).toHaveLength(0);
  expect(data.outputs[0].reason).toMatch(/above the deployed BHA/);
  expect(data.outputs[0].point.fromBitFt).toBe(25);
  expect(data.outputs[0].jarDistanceLabel).toBeUndefined();
});
