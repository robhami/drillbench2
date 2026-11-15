import React from 'react';
import { render, screen } from '@testing-library/react';
import frozen from '../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import Widget from './Widget';
import WidgetRegistry from './WidgetRegistry';
import JarConfiguration from '../Apps/JarConfiguration/JarConfiguration';

jest.mock('../Apps/JarConfiguration/RealBhaComparison', () => ({
  __esModule: true,
  default: props => require('react').createElement('output', {
    'data-testid': 'real-bha-comparison',
    'data-bha-id': props.bha.id,
    'data-mode': props.drillingMode,
    'data-depth': props.analysisBitMdFt,
    'data-surface-md': props.surfaceReferenceMdFt,
    'data-dp-length': props.bha.rows.find(row => row.category === 'DP')?.length,
    'data-impact-inputs': JSON.stringify(props.bha.jarImpactInputs)
  })
}));

test('active jarConfiguration registry route keeps the raw BHA and forwards shared analysis context', () => {
  const bha = JSON.parse(JSON.stringify(frozen.workingCopy));
  const original = JSON.stringify(bha);
  expect(WidgetRegistry.jarConfiguration.component).toBe(JarConfiguration);

  render(<Widget contentOnly bha={bha} analysisBitMdFt="9318" surfaceReferenceMdFt="12"
    drillingMode="rotate" widget={{ id: 'jarConfiguration1', type: 'jarConfiguration' }} />);

  const comparison = screen.getByTestId('real-bha-comparison');
  expect(comparison).toHaveAttribute('data-bha-id', bha.id);
  expect(comparison).toHaveAttribute('data-mode', 'rotate');
  expect(comparison).toHaveAttribute('data-depth', '9318');
  expect(comparison).toHaveAttribute('data-surface-md', '12');
  // Auto drillpipe length is blank in the input BHA; jarConfiguration is not
  // one of Widget's deployed-BHA modules.
  expect(comparison).toHaveAttribute('data-dp-length', '');
  expect(JSON.parse(comparison.getAttribute('data-impact-inputs'))).toEqual(bha.jarImpactInputs);
  expect(screen.getByRole('region', { name: 'JarFrame V6 performance presentation' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Peak stuck-point tensile force versus jar centre above bit.*point-only/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Primary stuck-point tensile impulse versus jar centre above bit.*point-only/ })).toBeInTheDocument();
  expect(screen.getAllByText('PRELIMINARY — NOT FOR OPERATIONAL USE')).toHaveLength(2);
  expect(screen.getAllByText(/PRELIMINARY/)).toHaveLength(2);
  const existing = screen.getByText(/Existing Jar Position Analysis workflows/).closest('details');
  expect(existing).not.toHaveAttribute('open');
  expect(existing).toContainElement(comparison);
  expect(JSON.stringify(bha)).toBe(original);
});
