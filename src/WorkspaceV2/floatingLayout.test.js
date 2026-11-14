import { FLOAT_KEY, JAR_CONFIGURATION_MIN_WIDTH, JAR_CONFIGURATION_MIN_HEIGHT, defaultWindows, projectWindow, arrangeWindows, loadFloating, saveFloating, migrateDocking, recoverFloatingWindow } from './floatingLayout';
import { defaultLayout } from './dockingLayout';
beforeEach(() => localStorage.clear());
test('fresh desktop opens only setup windows side by side', () => {
  const visible = defaultWindows(1400, 800).filter(w => w.visible);
  expect(visible.map(w => w.type)).toEqual(['bhaEntry', 'analysisInputs']);
  expect(visible[0].x + visible[0].width).toBeLessThan(visible[1].x);
});
test('viewport adaptation and maximize preserve preferred geometry', () => {
  const w = { x: 1600, y: 900, width: 820, height: 600 };
  expect(projectWindow(w, 700, 500)).toEqual({ x: 0, y: 0, width: 700, height: 500 });
  expect(w.x).toBe(1600);
  expect(projectWindow({ ...w, maximized: true }, 1000, 700)).toEqual({ x: 0, y: 0, width: 1000, height: 700 });
});
test('Jar Position Analysis enforces its minimum through save, restore, reload and narrow-screen projection', () => {
  expect([JAR_CONFIGURATION_MIN_WIDTH, JAR_CONFIGURATION_MIN_HEIGHT]).toEqual([700, 440]);
  const smallSaved = { id: 'jarConfiguration1', type: 'jarConfiguration', x: 800, y: 500, width: 480, height: 300,
    visible: true, minimized: false, maximized: false, z: 1 };
  const key = 'jar-minimum';
  saveFloating(localStorage, key, [smallSaved]);
  const loaded = loadFloating(localStorage, key, 1200, 800).windows[0];
  expect(loaded).toMatchObject({ id: 'jarConfiguration1', width: 700, height: 440, x: 500, y: 360 });
  const restored = recoverFloatingWindow({ ...loaded, maximized: true }, { width: 1000, height: 700 });
  expect(restored).toMatchObject({ width: 700, height: 440, maximized: true });
  saveFloating(localStorage, key, [loaded]);
  expect(loadFloating(localStorage, key, 1200, 800).windows[0]).toMatchObject({ width: 700, height: 440 });
  expect(projectWindow(loaded, 650, 400)).toMatchObject({ x: 0, y: 0, width: 650, height: 400 });
  expect(projectWindow({ type: 'jarForces', x: 0, y: 0, width: 100, height: 100 }, 1000, 800)).toMatchObject({ width: 280, height: 100 });
});
test.each(['side', 'grid'])('%s arrangement restores open minimized windows and changes only open geometry', mode => {
  const list = defaultWindows(1400, 800).map((w, i) => ({ ...w, visible: i < 4, minimized: i === 3 }));
  const result = arrangeWindows(list, mode, 1400, 800);
  expect(result[3].minimized).toBe(false);
  expect(result[4]).toBe(list[4]);
  expect(result.map(w => [w.id, w.visible, w.z])).toEqual(list.map(w => [w.id, w.visible, w.z]));
  expect(result[0].x + result[0].width).toBeLessThan(result[1].x);
});
test('per-BHA persistence preserves minimized, stacking, maximized and old storage verbatim', () => {
  const old = JSON.stringify(defaultLayout(1400)); localStorage.setItem('wellbenchDockingLayoutV1', old);
  const a = defaultWindows().map(w => ({ ...w, minimized: true, maximized: true, z: 42 }));
  saveFloating(localStorage, 'a', a); saveFloating(localStorage, 'b', defaultWindows());
  expect(loadFloating(localStorage, 'a').windows).toEqual(a);
  expect(loadFloating(localStorage, 'b').windows[0].minimized).toBe(false);
  expect(localStorage.getItem('wellbenchDockingLayoutV1')).toBe(old);
});
test('Dockview migration retains module IDs, all open tabs and floating bounds', () => {
  const layout = defaultLayout(1400);
  layout.floatingGroups = [{ data: { views: ['bhaEntry1'] }, position: { left: 74, top: 82, width: 790, height: 600 } }];
  const windows = migrateDocking(layout, 1400, 800);
  expect(windows.find(w => w.type === 'bhaEntry')).toMatchObject({ id: 'bhaEntry1', x: 74, y: 82, width: 790, visible: true });
  expect(windows).toHaveLength(Object.keys(layout.panels).length);
});
test('legacy floating layouts preserve closed and minimized state without modifying source', () => {
  const old = JSON.stringify([{ id: 'old', type: 'survey', x: 45, y: 75, width: 900, height: 600, visible: false, minimized: true, z: 7 }]);
  localStorage.setItem('wellbenchWorkspaceV2', old);
  expect(loadFloating(localStorage, 'a').windows[0]).toMatchObject({ id: 'old', visible: false, minimized: true, x: 45 });
  expect(localStorage.getItem('wellbenchWorkspaceV2')).toBe(old);
});
test('Jar Position Analysis opens with a wide desktop workspace default', () => {
  expect(defaultWindows(1440, 900).find(w => w.type === 'jarConfiguration').width).toBe(1260);
  expect(defaultWindows(900, 700).find(w => w.type === 'jarConfiguration').width).toBe(876);
  expect(defaultWindows(1440, 900).find(w => w.type === 'engineeringString').width).toBe(820);
});
test('corrupt or future layout falls back without overwriting original', () => {
  localStorage.setItem(FLOAT_KEY, '{"version":99}');
  expect(loadFloating(localStorage, 'a').message).toMatch(/preserved/);
  expect(() => saveFloating(localStorage, 'a', [])).toThrow();
  expect(localStorage.getItem(FLOAT_KEY)).toBe('{"version":99}');
});
