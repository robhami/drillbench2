import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EngineeringStringSchematic, { buildSchematicLayout, mapSchematicPosition, schematicToolType } from './EngineeringStringSchematic';

const row = (rowId, category, startFromBit, length, extra = {}) => ({ rowId, category, toolName: `${category} tool`, length,
  startFromBit, endFromBit: startFromBit + length, centreFromBit: startFromBit + length / 2, od: 6.5, idSize: 2.75, ...extra });
const components = [
  row('bit', 'BIT', 0, 1, { toolName: 'PDC bit 8.5 in', od: 8.5 }),
  row('stb', 'STB', 1, 4.9, { toolName: 'Spiral stabilizer', od: 8.5 }),
  row('dc-low', 'DC', 5.9, 90),
  row('jar', 'JAR', 95.9, 33, { toolName: 'Hydraulic drilling jar', centreFromBit: 112.4 }),
  row('dc-high', 'DC', 128.9, 509.77),
  row('dp', 'DP', 638.67, 8296.04, { toolName: '5 in drill pipe', od: 5, idSize: 4.276 })
];

test('BHA view defaults to bit-to-first-DP order, stays label-free and does not render DP', () => {
  render(<EngineeringStringSchematic components={components} neutralPointFt={250} jars={[{ centreFt: 112.4 }]} dcSections={{ above: { lengthFt: 90 }, below: { lengthFt: 509.77 } }} />);
  expect(screen.getByRole('combobox', { name: 'Schematic view' })).toHaveValue('bha');
  expect(screen.queryByRole('button', { name: /Select DP/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Select BIT/ })).toBeInTheDocument();
  expect(screen.queryByText(/^DC$/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Select a component to inspect/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Hydraulic drilling jar/)).not.toBeInTheDocument();
  expect(screen.getByText('DC above jar').parentElement).toHaveTextContent('90.00 ft');
  expect(screen.getByText('DC below jar').parentElement).toHaveTextContent('509.77 ft');
});

test('Full String compresses long DP with a break marker and keeps all real components in sequence', () => {
  const layout = buildSchematicLayout(components, 'full');
  expect(layout.items.map(item => item.component.rowId)).toEqual(['bit', 'stb', 'dc-low', 'jar', 'dc-high', 'dp']);
  expect(layout.items[layout.items.length - 1]).toMatchObject({ type: 'DP', compressed: true });
  expect(layout.items[layout.items.length - 1].height).toBeLessThan(components[components.length - 1].length * 0.28);
  render(<EngineeringStringSchematic components={components} neutralPointFt={250} jars={[{ centreFt: 112.4 }]} dcSections={{}} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Schematic view' }), { target: { value: 'full' } });
  expect(screen.getByRole('button', { name: /Select DP/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Select DP/ })).toHaveAttribute('data-compressed', 'true');
});

test('selected jar and neutral point map through the same compressed-distance transform', () => {
  const layout = buildSchematicLayout(components, 'full');
  const dp = layout.items[layout.items.length - 1];
  const halfway = mapSchematicPosition(layout, (dp.startFt + dp.endFt) / 2);
  expect(halfway).toBeCloseTo(layout.bottomY - dp.bottomY - dp.height / 2, 8);
  const { container } = render(<EngineeringStringSchematic components={components} neutralPointFt={(dp.startFt + dp.endFt) / 2} jars={[{ centreFt: 112.4 }]} dcSections={{}} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Schematic view' }), { target: { value: 'full' } });
  expect(screen.getAllByText('JAR').length).toBeGreaterThan(0);
  expect(screen.getByText('NP')).toBeInTheDocument();
  const npMarker = container.querySelector('.npMarker');
  const jarMarker = container.querySelector('.jarMarker');
  expect(Number(npMarker.getAttribute('data-position-ft'))).toBeCloseTo((dp.startFt + dp.endFt) / 2, 8);
  expect(Number(npMarker.getAttribute('data-schematic-y'))).toBeCloseTo(halfway, 8);
  expect(Number(jarMarker.getAttribute('data-schematic-y'))).toBeCloseTo(mapSchematicPosition(layout, 112.4), 8);
});

test('NP outside the BHA view is identified at its real bit-relative position, not moved onto the drawing', () => {
  render(<EngineeringStringSchematic components={components} neutralPointFt={4000} jars={[{ centreFt: 112.4 }]} dcSections={{}} />);
  expect(screen.getByText(/NP 4,000\.00 ft above bit · outside BHA view/)).toBeInTheDocument();
  expect(screen.queryByText('NP', { selector: 'text' })).not.toBeInTheDocument();
});

test('component selection is keyboard and pointer accessible and displays actual instance properties', () => {
  render(<EngineeringStringSchematic components={components} neutralPointFt={null} jars={[]} dcSections={{}} />);
  const stabilizer = screen.getByRole('button', { name: /Select STB Spiral stabilizer/ });
  expect(screen.queryByText('STB · Spiral stabilizer')).not.toBeInTheDocument();
  fireEvent.click(stabilizer);
  expect(screen.getByText('STB · Spiral stabilizer')).toBeInTheDocument();
  expect(screen.getByText('OD 8.5 in')).toBeInTheDocument();
  expect(screen.getByText('ID 2.75 in')).toBeInTheDocument();
  expect(screen.getByText('Length 4.90 ft')).toBeInTheDocument();
  expect(screen.getByText('Position 1.00–5.90 ft above bit')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Schematic view' }), { target: { value: 'full' } });
  const dp = screen.getByRole('button', { name: /Select DP/ });
  fireEvent.keyDown(dp, { key: 'Enter' });
  expect(screen.getByText('DP · 5 in drill pipe')).toBeInTheDocument();
  expect(buildSchematicLayout(components, 'full').items.some(item => item.component.rowId === 'dp')).toBe(true);
});

test('tool silhouette type recognizes PDC, TCI and unknown bits without inventing an absent bit', () => {
  expect(schematicToolType({ category: 'BIT', toolName: 'PDC 8.5 bit' })).toBe('PDC');
  expect(schematicToolType({ category: 'BIT', toolName: 'TCI roller cone 8.5 bit' })).toBe('TCI');
  expect(schematicToolType({ category: 'BIT', toolName: 'Generic 8.5 bit' })).toBe('BIT');
  const { unmount } = render(<EngineeringStringSchematic components={[
    row('pdc', 'BIT', 0, 1, { toolName: 'PDC bit' }), row('tci', 'BIT', 1, 1, { toolName: 'TCI roller cone bit' })
  ]} neutralPointFt={null} jars={[]} dcSections={{}} />);
  expect(screen.getByRole('button', { name: /Select BIT PDC bit/ })).toHaveAttribute('data-silhouette', 'PDC');
  expect(screen.getByRole('button', { name: /Select BIT TCI roller cone bit/ })).toHaveAttribute('data-silhouette', 'TCI');
  unmount();
  const noBit = components.filter(component => component.category !== 'BIT');
  render(<EngineeringStringSchematic components={noBit} neutralPointFt={null} jars={[]} dcSections={{}} />);
  expect(screen.queryByRole('button', { name: /Select BIT/ })).not.toBeInTheDocument();
  expect(screen.queryByText('BIT END')).not.toBeInTheDocument();
});

test('selected component summary is separate from unchanged engineering results and shared DC values', () => {
  render(<EngineeringStringSchematic components={components} neutralPointFt={112.4} jars={[{ centreFt: 112.4 }]} dcSections={{ above: { lengthFt: 90 }, below: { lengthFt: 509.77 } }} />);
  expect(screen.queryByText('JAR · Hydraulic drilling jar')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Select JAR Hydraulic drilling jar/ }));
  expect(screen.getByText('JAR · Hydraulic drilling jar')).toBeInTheDocument();
  expect(screen.getByText('DC above jar').parentElement).toHaveTextContent('90.00 ft');
  expect(screen.getByText('DC below jar').parentElement).toHaveTextContent('509.77 ft');
});
