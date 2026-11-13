import Registry from './WidgetRegistry';

export const DOCK_KEY = 'wellbenchDockingLayoutV1';
export const LEGACY_KEY = 'wellbenchWorkspaceV2';
export const MODULES = [
  ['bhaEntry', 'SETUP', 'list-columns'], ['analysisInputs', 'SETUP', 'sliders'],
  ['engineeringString', 'VISUALISATION', 'diagram-3'], ['survey', 'VISUALISATION', 'bezier2'],
  ['jarForces', 'ANALYSIS', 'arrow-down-up'], ['jarClearance', 'ANALYSIS', 'graph-up'],
  ['jarConfiguration', 'JARFRAME', 'distribute-vertical'], ['jarPlacement', 'JARFRAME', 'lightning'],
  ['bhaSummary', 'DEVELOPER', 'list-check'], ['engineeringResults', 'DEVELOPER', 'table']
];
export const isDeveloper = type => ['bhaSummary', 'engineeringResults'].includes(type);
export const family = type => MODULES.find(m => m[0] === type)?.[1] || 'WORKSPACE';
export const minimumWidth = type => type === 'bhaEntry' ? 520 : type === 'analysisInputs' ? 360 : 420;
export const clone = value => JSON.parse(JSON.stringify(value));
export const panelState = (type, id = `${type}1`) => ({ id, contentComponent: 'engineering', title: Registry[type].title,
  params: { type }, renderer: 'always', minimumWidth: minimumWidth(type), minimumHeight: 220 });
const leaf = (id, views, size = 600) => ({ type: 'leaf', size, data: { id, views, activeView: views[0] } });
export function groups(layout) {
  const result = [];
  const walk = node => { if (node?.type === 'leaf') result.push(node.data); else if (node?.type === 'branch') node.data.forEach(walk); };
  walk(layout.grid.root);
  (layout.floatingGroups || []).forEach(f => { if (f.data) result.push(f.data); else walk(f.grid?.root); });
  return result;
}
export function defaultLayout(width = 1400) {
  const wide = width >= 1120;
  return { grid: { width, height: 800, orientation: 'HORIZONTAL', root: { type: 'branch', data: wide ?
    [leaf('setup', ['bhaEntry1'], width * .64), leaf('parameters', ['analysisInputs1'], width * .36)] :
    [leaf('setup', ['bhaEntry1', 'analysisInputs1'], width)] } },
    panels: { bhaEntry1: panelState('bhaEntry'), analysisInputs1: panelState('analysisInputs') }, activeGroup: 'setup' };
}

// No BHA/engineering inputs are accepted in serialized panel params.
export function validateLayout(input) {
  if (!input?.grid?.root || !input.panels || Object.keys(input.panels).length > MODULES.length) throw Error('Invalid docking layout.');
  const layout = clone(input), types = new Set(), used = new Set(), groupIds = new Set();
  for (const [id, panel] of Object.entries(layout.panels)) {
    const type = panel.params?.type;
    if (!Registry[type] || typeof id !== 'string' || id.length > 128 || types.has(type)) throw Error('Unknown or duplicate docking panel.');
    types.add(type); layout.panels[id] = panelState(type, id);
  }
  for (const group of groups(layout)) {
    if (!group.id || groupIds.has(group.id) || !Array.isArray(group.views)) throw Error('Invalid docking group.');
    groupIds.add(group.id);
    group.views.forEach(id => { if (!layout.panels[id] || used.has(id)) throw Error('Invalid or duplicate docking tab.'); used.add(id); });
  }
  if (used.size !== Object.keys(layout.panels).length) throw Error('Unplaced docking panel.');
  return layout;
}

// Preserve tree proportions while changing membership. Used for developer filtering
// and returning from temporary viewport consolidation without discarding new tabs.
export function reconcileLayout(preferred, current) {
  const result = clone(preferred), members = current.panels, seen = new Set();
  result.panels = clone(members);
  result.floatingGroups = clone(current.floatingGroups || []);
  (result.floatingGroups || []).forEach(f => {
    const collect = node => { if (node?.type === 'leaf') node.data.views.forEach(id => seen.add(id)); else node?.data?.forEach(collect); };
    if (f.data) f.data.views.forEach(id => seen.add(id)); else collect(f.grid?.root);
  });
  const prune = node => {
    if (node.type === 'branch') { node.data = node.data.map(prune).filter(Boolean); return node.data.length ? node : null; }
    node.data.views = node.data.views.filter(id => members[id] && !seen.has(id) && seen.add(id));
    if (!node.data.views.length) return null;
    if (!node.data.views.includes(node.data.activeView)) node.data.activeView = node.data.views[0];
    return node;
  };
  result.grid.root = prune(result.grid.root) || { type: 'branch', data: [] };
  for (const id of Object.keys(members).filter(id => !seen.has(id))) {
    const docked = groups({ ...result, floatingGroups: [] });
    const target = docked.find(g => g.views.some(v => family(members[v]?.params.type) === family(members[id].params.type))) || docked[0];
    if (target) target.views.push(id);
    else result.grid.root = { type: 'branch', data: [leaf('setup', [id])] };
  }
  const active = groups(current).find(g => g.id === current.activeGroup)?.activeView;
  const target = groups(result).find(g => g.views.includes(active));
  if (target) { target.activeView = active; result.activeGroup = target.id; }
  return result;
}
export function visibleLayout(layout, developer) {
  const current = clone(layout);
  if (developer) return current;
  Object.keys(current.panels).forEach(id => { if (isDeveloper(current.panels[id].params.type)) delete current.panels[id]; });
  const pruneFloating = node => {
    if (node.type === 'branch') { node.data = node.data.map(pruneFloating).filter(Boolean); return node.data.length ? node : null; }
    node.data.views = node.data.views.filter(id => current.panels[id]);
    if (!node.data.views.includes(node.data.activeView)) node.data.activeView = node.data.views[0];
    return node.data.views.length ? node : null;
  };
  current.floatingGroups = current.floatingGroups?.filter(f => {
    if (f.data) return Boolean(pruneFloating({ type: 'leaf', data: f.data }));
    const root = pruneFloating(f.grid.root); if (!root) return false; f.grid.root = root; return true;
  });
  return reconcileLayout(layout, current);
}
export function compactLayout(layout) {
  const result = clone(layout);
  const docked = groups({ ...result, floatingGroups: [] }), views = docked.flatMap(g => g.views);
  const active = docked.find(g => g.id === result.activeGroup)?.activeView || views[0];
  result.grid.root = { type: 'branch', data: views.length ? [leaf('compact', views, result.grid.width)] : [] };
  if (views.length) { result.grid.root.data[0].data.activeView = active; result.activeGroup = 'compact'; }
  return result;
}
export function layoutMinimumSize(layout) {
  const measure = (node, horizontal) => {
    if (node.type === 'leaf') return {
      width: Math.max(0, ...node.data.views.map(id => minimumWidth(layout.panels[id]?.params.type))), height: 256
    };
    const children = node.data.map(child => measure(child, !horizontal));
    return { width: horizontal ? children.reduce((sum, c) => sum + c.width + 4, 0) : Math.max(0, ...children.map(c => c.width)),
      height: horizontal ? Math.max(0, ...children.map(c => c.height)) : children.reduce((sum, c) => sum + c.height + 4, 0) };
  };
  return measure(layout.grid.root, layout.grid.orientation === 'HORIZONTAL');
}
export function retainDeveloperPanels(current, previous) {
  const hidden = Object.fromEntries(Object.entries(previous?.panels || {}).filter(([id, p]) => isDeveloper(p.params.type) && !current.panels[id]));
  const floating = (previous?.floatingGroups || []).filter(f => {
    const ids = groups({ grid: { root: { type: 'branch', data: [] } }, floatingGroups: [f] }).flatMap(g => g.views);
    return ids.length && ids.every(id => hidden[id]);
  });
  return reconcileLayout(current, { ...current, panels: { ...current.panels, ...hidden }, floatingGroups: [...(current.floatingGroups || []), ...clone(floating)] });
}
export function migrateLegacy(records, width = 1400) {
  if (!Array.isArray(records)) throw Error('Legacy layout is not a window list.');
  const result = { grid: { width, height: 800, orientation: 'HORIZONTAL', root: { type: 'branch', data: [] } }, panels: {}, floatingGroups: [] }, seen = new Set();
  records.filter(w => w.visible && Registry[w.type]).forEach((w, i) => {
    if (seen.has(w.type)) return; seen.add(w.type);
    const id = w.id || `${w.type}1`;
    result.panels[id] = panelState(w.type, id);
    result.floatingGroups.push({ data: { id: `legacy-${i}`, views: [id], activeView: id }, position: {
      left: Number.isFinite(w.x) ? w.x : 20, top: Number.isFinite(w.y) ? w.y : 20,
      width: Math.max(minimumWidth(w.type), Number(w.width) || 620), height: Math.max(220, Number(w.height) || 420) } });
  });
  return result;
}
export function readLayouts(storage) {
  const raw = storage.getItem(DOCK_KEY);
  if (!raw) return { version: 1, workspaces: {} };
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || !saved.workspaces || typeof saved.workspaces !== 'object' || Array.isArray(saved.workspaces)) throw Error('Unsupported docking layout version; saved data was preserved. Reset Layout to start afresh.');
  return saved;
}
