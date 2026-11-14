import Registry from './WidgetRegistry';

export const FLOAT_KEY = 'wellbenchFloatingLayoutV1';
export const JAR_CONFIGURATION_MIN_WIDTH = 700;
export const JAR_CONFIGURATION_MIN_HEIGHT = 440;
export const MODULES = [
  ['bhaEntry', 'SETUP', 'list-columns'], ['analysisInputs', 'SETUP', 'sliders'],
  ['engineeringString', 'VISUALISATION', 'diagram-3'], ['survey', 'VISUALISATION', 'bezier2'],
  ['jarForces', 'ANALYSIS', 'arrow-down-up'], ['jarClearance', 'ANALYSIS', 'graph-up'],
  ['jarConfiguration', 'JARFRAME', 'distribute-vertical'], ['jarPlacement', 'JARFRAME', 'lightning'],
  ['bhaSummary', 'DEVELOPER', 'list-check'], ['engineeringResults', 'DEVELOPER', 'table']
];
export const isDeveloper = type => ['bhaSummary', 'engineeringResults'].includes(type);
export function defaultWindows(width = 1400, height = 800) {
  const side = width >= 1000, first = side ? Math.min(820, width * .63) : width - 24;
  return MODULES.map(([type], i) => ({ id: `${type}1`, type, x: 12 + i * 24, y: 12 + i * 24,
    width: type === 'bhaEntry' ? first : type === 'jarConfiguration' ? Math.min(1260, width - 24) : type === 'engineeringString' ? 820 : 720, height: Math.min(640, height - 24),
    visible: i < 2, minimized: false, maximized: false, z: i + 1,
    ...(i === 1 ? { x: side ? first + 24 : 24, y: side ? 12 : 76, width: side ? width - first - 36 : width - 48 } : {}) }));
}
export function projectWindow(w, width, height, minX = 0, minY = 0) {
  const availableWidth = Math.max(1, width - minX), availableHeight = Math.max(1, height - minY);
  if (w.maximized) return { x: minX, y: minY, width: availableWidth, height: availableHeight };
  // Arrangements may use compact tiles: keep each titlebar reachable instead
  // of expanding every tile to 180 px and stacking the last rows on top of it.
  const minWidth = w.type === 'jarConfiguration' ? JAR_CONFIGURATION_MIN_WIDTH : 280;
  const minHeight = w.type === 'jarConfiguration' ? JAR_CONFIGURATION_MIN_HEIGHT : 44;
  const result = { width: Math.min(Math.max(minWidth, w.width), availableWidth), height: Math.min(Math.max(minHeight, w.height), availableHeight) };
  return { ...result, x: Math.max(minX, Math.min(w.x, width - result.width)), y: Math.max(minY, Math.min(w.y, height - result.height)) };
}
// Bounds in canvas coordinates, including clipping caused by global notices or page scrolling.
export function visibleWorkspaceViewport(rect, screenWidth, screenHeight, fallback) {
  const left = rect?.left || 0, top = rect?.top || 0;
  return { width: Math.max(1, Math.min(rect?.width || fallback.width, screenWidth - left)),
    height: Math.max(1, Math.min(rect?.height || fallback.height, screenHeight - top)),
    minX: Math.max(0, -left), minY: Math.max(0, -top) };
}
export function recoverFloatingWindow(w, viewport) {
  return { ...w, ...projectWindow({ ...w, maximized: false }, viewport.width, viewport.height, viewport.minX, viewport.minY) };
}
export function arrangeWindows(windows, mode, width, height, developer = false, minX = 0, minY = 0) {
  const visible = windows.filter(w => w.visible && (developer || !isDeveloper(w.type)));
  const availableWidth = Math.max(1, width - minX), availableHeight = Math.max(1, height - minY);
  // Narrow workspaces use rows instead of unusably narrow columns.
  const columns = mode === 'grid' ? Math.min(Math.ceil(Math.sqrt(visible.length)), Math.max(1, Math.floor(availableWidth / 420))) : Math.min(visible.length, Math.max(1, Math.floor(availableWidth / 420)));
  const rows = Math.ceil(visible.length / (columns || 1));
  return windows.map(w => {
    const i = visible.indexOf(w); if (i < 0) return w;
    return { ...w, minimized: false, maximized: false, x: minX + 8 + (i % columns) * availableWidth / columns, y: minY + 8 + Math.floor(i / columns) * availableHeight / rows,
      width: Math.max(1, availableWidth / columns - 16), height: Math.max(1, availableHeight / rows - 16) };
  });
}
function sanitize(records, width, height) {
  if (!Array.isArray(records)) throw Error('Invalid window list');
  const seen = new Set();
  return records.filter(w => Registry[w.type] && !seen.has(w.type) && seen.add(w.type)).map((w, i) => {
    const base = defaultWindows(width, height).find(d => d.type === w.type);
    const value = { ...base, id: typeof w.id === 'string' ? w.id : base.id, visible: w.visible !== false,
      minimized: w.minimized === true, maximized: w.maximized === true };
    ['x', 'y', 'width', 'height', 'z'].forEach(k => { if (Number.isFinite(w[k]) && (k === 'x' || k === 'y' || w[k] > 0)) value[k] = w[k]; });
    const restored = { ...value, z: Number.isFinite(value.z) ? value.z : i + 1 };
    return restored.type === 'jarConfiguration' && !restored.maximized
      ? { ...restored, ...projectWindow(restored, width, height) }
      : restored;
  });
}
export function migrateDocking(layout, width, height) {
  if (!layout?.panels || !layout?.grid?.root) throw Error('Invalid previous layout');
  const positions = new Map();
  const visit = (node, rect) => {
    if (node?.views) node.views.forEach(id => positions.set(id, rect));
    if (node?.data?.views) visit(node.data, rect);
    if (Array.isArray(node?.data)) node.data.forEach(n => visit(n, rect));
  };
  (layout.floatingGroups || []).forEach(g => { const p = g.position || {}; const rect = { x: p.left ?? p.x, y: p.top ?? p.y, width: p.width, height: p.height }; visit(g.data, rect); visit(g.grid?.root, rect); });
  return sanitize(Object.values(layout.panels).map((p, i) => ({ ...defaultWindows(width, height)[0], id: p.id, type: p.params?.type,
    x: 20 + i * 28, y: 20 + i * 28, width: p.params?.type === 'bhaEntry' ? 820 : 720, visible: true, z: i + 1, ...positions.get(p.id) })), width, height);
}
export function loadFloating(storage, key, width, height) {
  try {
    const raw = storage.getItem(FLOAT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw); if (parsed.version !== 1 || !parsed.workspaces) throw Error('Unsupported floating layout version');
      if (parsed.workspaces[key]) return { windows: sanitize(parsed.workspaces[key], width, height) };
    }
    const dock = JSON.parse(storage.getItem('wellbenchDockingLayoutV1') || 'null');
    const entry = dock?.version === 1 && dock.workspaces?.[key];
    if (entry) return { windows: migrateDocking(entry.desktop || entry.compact, width, height), message: 'Previous layout restored as floating windows. Original layout storage preserved.' };
    const legacy = storage.getItem('wellbenchWorkspaceV2');
    if (legacy) return { windows: sanitize(JSON.parse(legacy), width, height) };
  } catch (error) { return { windows: defaultWindows(width, height), message: `Layout unavailable; defaults shown. Original storage preserved. ${error.message}` }; }
  return { windows: defaultWindows(width, height) };
}
export function saveFloating(storage, key, windows) {
  const raw = storage.getItem(FLOAT_KEY), saved = raw ? JSON.parse(raw) : { version: 1, workspaces: {} };
  if (saved.version !== 1 || !saved.workspaces) throw Error('Unsupported saved layout; original storage retained');
  saved.workspaces[key] = windows;
  storage.setItem(FLOAT_KEY, JSON.stringify(saved));
}
