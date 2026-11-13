import { defaultLayout, groups, validateLayout, panelState, visibleLayout, compactLayout, reconcileLayout, migrateLegacy, readLayouts, layoutMinimumSize, retainDeveloperPanels, DOCK_KEY } from './dockingLayout';

test('new layout opens only two setup panels and retains stable IDs', () => {
  const wide = defaultLayout(1400), narrow = defaultLayout(900);
  expect(Object.keys(wide.panels)).toEqual(['bhaEntry1', 'analysisInputs1']);
  expect(groups(wide)).toHaveLength(2); expect(groups(narrow)).toHaveLength(1);
  expect(validateLayout(wide)).toEqual(wide);
});
test('legacy migration preserves visible identifiers and float positions without changing the source', () => {
  const original = [{ id: 'saved-pipe', type: 'bhaEntry', visible: true, x: 70, y: 80, width: 760, height: 520 },
    { id: 'hidden', type: 'jarForces', visible: false }];
  const before = JSON.stringify(original), migrated = migrateLegacy(original);
  expect(migrated.floatingGroups[0].position).toMatchObject({ left: 70, top: 80, width: 760, height: 520 });
  expect(Object.keys(migrated.panels)).toEqual(['saved-pipe']);
  expect(JSON.stringify(original)).toBe(before);
});
test('developer filtering preserves source records and supports saved floating diagnostics', () => {
  const original = migrateLegacy([{ id: 'dev', type: 'engineeringResults', visible: true }, { id: 'bha', type: 'bhaEntry', visible: true }]);
  expect(Object.keys(visibleLayout(original, false).panels)).toEqual(['bha']);
  expect(visibleLayout(original, true).panels.dev).toBeDefined();
  expect(original.panels.dev).toBeDefined();
});
test('temporary consolidation and expansion preserve panel membership and desktop proportions', () => {
  const desktop = defaultLayout(1400), compact = compactLayout(desktop);
  expect(groups(compact)).toHaveLength(1);
  compact.panels.jarForces1 = panelState('jarForces'); groups(compact)[0].views.push('jarForces1');
  const expanded = reconcileLayout(desktop, compact);
  expect(groups(expanded)).toHaveLength(2);
  expect(expanded.grid.root.data[0].size).toBe(desktop.grid.root.data[0].size);
  expect(groups(expanded).flatMap(g => g.views).sort()).toEqual(Object.keys(compact.panels).sort());
  expect(validateLayout(expanded)).toEqual(expanded);
});
test('duplicate panels, unknown components and unsupported persistence versions are rejected', () => {
  const duplicate = defaultLayout(); duplicate.panels.duplicate = panelState('bhaEntry', 'duplicate');
  expect(() => validateLayout(duplicate)).toThrow('duplicate');
  const invalid = defaultLayout(); invalid.panels.bhaEntry1.params.type = 'not-a-component';
  expect(() => validateLayout(invalid)).toThrow('Unknown');
  localStorage.setItem(DOCK_KEY, JSON.stringify({ version: 999, workspaces: {} }));
  expect(() => readLayouts(localStorage)).toThrow('Unsupported');
  expect(JSON.parse(localStorage.getItem(DOCK_KEY)).version).toBe(999); localStorage.clear();
});
test('layout serialization excludes engineering data from panel params', () => {
  const layout = defaultLayout(); layout.panels.bhaEntry1.params.bha = { wob: 100 };
  expect(validateLayout(layout).panels.bhaEntry1.params).toEqual({ type: 'bhaEntry' });
});

test('minimum-size screening sums side-by-side widths and stacked heights', () => {
  const layout = defaultLayout(1400);
  expect(layoutMinimumSize(layout)).toEqual({ width: 888, height: 256 });
  layout.grid.orientation = 'VERTICAL';
  expect(layoutMinimumSize(layout)).toEqual({ width: 520, height: 520 });
});

test('nested floating diagnostics cannot bypass normal-mode filtering', () => {
  const layout = defaultLayout();
  layout.panels.dev = panelState('engineeringResults', 'dev');
  layout.floatingGroups = [{ grid: { width: 800, height: 500, orientation: 'HORIZONTAL', root: { type: 'branch', data: [
    { type: 'leaf', data: { id: 'nested-dev', views: ['dev'], activeView: 'dev' } }
  ] } }, position: { left: 0, top: 0, width: 800, height: 500 } }];
  const filtered = visibleLayout(layout, false);
  expect(filtered.floatingGroups).toHaveLength(0);
  expect(filtered.panels.dev).toBeUndefined();
});

test('normal-user saves retain hidden developer floating coordinates', () => {
  const original = migrateLegacy([{ id: 'dev', type: 'engineeringResults', visible: true, x: 80, y: 90, width: 650, height: 450 }]);
  const visible = visibleLayout(original, false), saved = retainDeveloperPanels(visible, original);
  expect(saved.floatingGroups[0].position).toEqual(original.floatingGroups[0].position);
  expect(validateLayout(saved).panels.dev).toBeDefined();
});
