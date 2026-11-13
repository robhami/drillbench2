import React from 'react';
import { act, render, screen } from '@testing-library/react';
import App from './App';
import { definitionRowPatch } from './engineering/bha/componentDefinition';

jest.mock('./WorkspaceV2/Workspace', () => () => <div>Workspace</div>);

test('Stage 6A project geometry, snapshots, material, orientation, quantity and metadata survive BHA save and reload', () => {
  localStorage.clear();
  const section = { length: 4, od: 5, idSize: 3, weight: 40, material: { name: 'Explicit material', densityLbFt3: 490, youngsModulusPsi: 29000000 } };
  const definition = { ...section, length: 10, id: 'custom-persist', name: 'Segmented tool', category: 'OTHER', schemaVersion: 1, source: 'project', notes: 'User test fixture', geometry: { kind: 'segmented', segments: [{ ...section, label: 'Bit end' }, { ...section, length: 6, label: 'Surface end' }] } };
  const row = { rowId: 'keep-id', quantity: 2, orientation: 'surface-to-bottom', metadata: { source: 'Field input' }, ...definitionRowPatch(definition) };
  const ref = React.createRef(), first = render(<App ref={ref} />);
  act(() => ref.current.updateBha({ name: 'Stage 6A', rows: [row], projectComponents: [definition], customMetadata: { keep: true } }));
  act(() => ref.current.saveBha()); const expected = ref.current.state.well.currentBha;
  expect(screen.getByRole('alert')).toHaveTextContent('existing load and JarFrame solvers still use overall row properties');
  first.unmount(); const second = React.createRef(); render(<App ref={second} />);
  expect(second.current.state.well.currentBha).toEqual(expected);
  expect(second.current.state.well.savedBhas.at(-1).rows).toEqual([row]);
});
