import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { DockviewReact, themeLight } from 'dockview-react';
import 'dockview-react/dist/styles/dockview.css';
import './Workspace.css';
import './DockingWorkspace.css';
import Widget from './Widget';
import Registry from './WidgetRegistry';
import useWorkspaceAnalysis from './useWorkspaceAnalysis';
import { DOCK_KEY, LEGACY_KEY, MODULES, family, isDeveloper, minimumWidth,
  defaultLayout, readLayouts, validateLayout, visibleLayout, compactLayout, reconcileLayout, migrateLegacy, layoutMinimumSize, retainDeveloperPanels, clone } from './dockingLayout';

const Context = createContext(null);
function EngineeringPanel({ params, api }) {
  const context = useContext(Context);
  return <Widget {...context.inputs} widget={{ id: api.id, type: params.type }} contentOnly />;
}
const components = { engineering: EngineeringPanel };
function GroupLabel({ panels }) {
  const labels = [...new Set(panels.map(p => family(p.params?.type)))];
  return <span className="wbDockGroupLabel">{labels.length === 1 ? labels[0] : 'WORKSPACE'}</span>;
}
function GroupActions({ activePanel }) {
  const context = useContext(Context);
  if (!activePanel) return null;
  const floating = activePanel.api.location.type === 'floating';
  return <div className="wbDockActions">
    <button type="button" title={floating ? 'Dock Back' : 'Pop Out'} aria-label={`${floating ? 'Dock Back' : 'Pop Out'} ${activePanel.title}`}
      onClick={() => context.move(activePanel, floating ? 'back' : 'float')}><i className={`bi bi-${floating ? 'box-arrow-in-down-left' : 'window-stack'}`} aria-hidden="true" /></button>
    <select aria-label={`Move ${activePanel.title}`} value="" onChange={e => context.move(activePanel, e.target.value)}>
      <option value="">Dock…</option>
      {['SETUP', 'VISUALISATION', 'ANALYSIS', 'JARFRAME'].map(label => <option key={label} value={label}>{label}</option>)}
      {['left', 'right', 'top', 'bottom'].map(side => <option key={side} value={side}>Split {side}</option>)}
    </select>
  </div>;
}
export default function Workspace(props) {
  const { bha, developerPanels = false } = props;
  const analysis = useWorkspaceAnalysis(bha);
  const host = useRef(null), dock = useRef(null), changing = useRef(false), gestures = useRef(false), dirty = useRef(false);
  const previousBha = useRef(bha), subscriptions = useRef([]), alive = useRef(true);
  const canonical = useRef(null), preferred = useRef(null), compact = useRef(false), workspace = useRef(bha?.id || 'draft');
  const [ready, setReady] = useState(false), [revision, setRevision] = useState(0), [message, setMessage] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const developerRef = useRef(developerPanels); developerRef.current = developerPanels;
  const width = () => host.current?.clientWidth || Math.max(320, window.innerWidth - 224);
  const needsCompact = layout => { const min = layoutMinimumSize(layout); return width() < Math.max(1120, min.width + 16) || (host.current?.clientHeight > 0 && host.current.clientHeight < min.height + 16); };
  const refresh = () => { if (alive.current) setRevision(n => n + 1); };
  const persist = useCallback(() => {
    if (!dock.current || changing.current) return;
    try {
      const saved = readLayouts(localStorage), current = dock.current.toJSON();
      canonical.current = developerRef.current ? current : retainDeveloperPanels(current, canonical.current);
      if (!compact.current) preferred.current = clone(canonical.current);
      const entry = saved.workspaces[workspace.current] || {};
      saved.workspaces[workspace.current] = { ...entry, [compact.current ? 'compact' : 'desktop']: canonical.current };
      localStorage.setItem(DOCK_KEY, JSON.stringify(saved)); dirty.current = false;
    } catch (error) { setMessage(`Layout not saved: ${error.message}`); }
  }, []);
  const apply = layout => {
    changing.current = true;
    try {
      const safe = validateLayout(layout); canonical.current = safe; preferred.current = clone(safe);
      compact.current = needsCompact(safe);
      const visible = visibleLayout(safe, developerRef.current);
      dock.current.fromJSON(compact.current ? compactLayout(visible) : visible, { reuseExistingPanels: true });
      refresh();
    } finally { changing.current = false; }
  };
  const load = () => {
    try {
      const saved = readLayouts(localStorage), entry = saved.workspaces[workspace.current];
      if (entry?.desktop || entry?.compact) {
        apply(entry.desktop || entry.compact);
        if (compact.current && entry.desktop && entry.compact) {
          const small = validateLayout(entry.compact);
          changing.current = true;
          dock.current.fromJSON(compactLayout(visibleLayout(small, developerRef.current)), { reuseExistingPanels: true });
          canonical.current = small; changing.current = false;
        }
      }
      else {
        const legacy = localStorage.getItem(LEGACY_KEY);
        apply(legacy ? migrateLegacy(JSON.parse(legacy), width()) : defaultLayout(width()));
        if (legacy) setMessage('Previous floating layout imported. Reset Layout creates docked defaults; the original remains recoverable.');
      }
    } catch (error) { setMessage(`Saved layout could not be restored; original data was preserved. ${error.message}`); apply(defaultLayout(width())); }
  };
  const adapt = () => {
    if (!dock.current || changing.current) return;
    const narrow = needsCompact(preferred.current || dock.current.toJSON());
    if (narrow === compact.current) return;
    changing.current = true;
    try {
      const current = dock.current.toJSON();
      if (narrow) { preferred.current = clone(current); dock.current.fromJSON(compactLayout(current), { reuseExistingPanels: true }); }
      else dock.current.fromJSON(reconcileLayout(preferred.current || current, current), { reuseExistingPanels: true });
      compact.current = narrow; refresh();
    } finally { changing.current = false; }
  };
  useEffect(() => {
    if (!ready) return;
    const observer = new ResizeObserver(adapt); observer.observe(host.current); return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    const key = bha?.id || 'draft';
    if (ready && key !== workspace.current) {
      const firstSave = !previousBha.current?.id && key !== 'draft' && JSON.stringify(previousBha.current?.rows) === JSON.stringify(bha?.rows);
      persist(); workspace.current = key;
      try { if (firstSave && !readLayouts(localStorage).workspaces[key]) persist(); else load(); }
      catch { load(); }
    }
    previousBha.current = bha;
    // Layout ownership follows saved BHA identity, not changing numerical inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bha, ready]);
  useEffect(() => {
    if (!ready || !canonical.current) return;
    const current = dock.current.toJSON();
    const all = developerPanels ? retainDeveloperPanels(current, canonical.current) : current;
    const visible = visibleLayout(all, developerPanels);
    changing.current = true; dock.current.fromJSON(compact.current ? compactLayout(visible) : visible, { reuseExistingPanels: true });
    changing.current = false; refresh();
    // Developer visibility is transient and never deletes saved diagnostics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developerPanels]);
  const idFor = type => Object.values(canonical.current?.panels || {}).find(p => p.params.type === type)?.id ||
    (() => { try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]').find(w => w.type === type)?.id; } catch { return null; } })() || `${type}1`;
  const targetFor = (label, exclude) => dock.current.groups.find(g => g !== exclude && g.api.location.type === 'grid' && g.panels.some(p => family(p.params.type) === label));
  const open = type => {
    if (isDeveloper(type) && !developerPanels) return;
    const api = dock.current, existing = api.panels.find(p => p.params.type === type);
    if (existing) existing.api.setActive();
    else {
      const target = compact.current ? api.groups.find(g => g.api.location.type === 'grid') : targetFor(family(type));
      const reference = target || api.groups.find(g => g.api.location.type === 'grid');
      api.addPanel({ id: idFor(type), component: 'engineering', params: { type }, title: Registry[type].title, renderer: 'always', minimumWidth: minimumWidth(type), minimumHeight: 220,
        ...(reference ? { position: { referenceGroup: reference, direction: target ? 'within' : 'below' } } : {}) });
    }
    refresh(); persist(); adapt();
  };
  const move = (panel, direction) => {
    const api = dock.current;
    if (direction === 'float') api.addFloatingGroup(panel, { x: 32, y: 40, width: Math.min(760, width() - 40), height: 580 });
    else if (['left', 'right', 'top', 'bottom'].includes(direction)) {
      const target = panel.api.location.type === 'grid' ? panel.group : api.groups.find(g => g.api.location.type === 'grid');
      const targetMin = Math.max(0, ...(target?.panels || []).map(p => minimumWidth(p.params.type)));
      if (!target || compact.current || (['left', 'right'].includes(direction) && target.width < minimumWidth(panel.params.type) + targetMin + 4) || (['top', 'bottom'].includes(direction) && target.height < 516)) {
        setMessage('Not enough space for another region. Use tabs or Pop Out instead.'); return;
      }
      panel.api.moveTo({ group: target, position: direction });
    } else {
      const target = (compact.current ? api.groups.find(g => g.api.location.type === 'grid') : targetFor(direction === 'back' ? family(panel.params.type) : direction)) || api.groups.find(g => g !== panel.group && g.api.location.type === 'grid');
      panel.api.moveTo({ group: target || api.addGroup(), position: 'center' });
    }
    refresh(); persist(); adapt();
  };
  const guardDrop = event => {
    if (event.position === 'center') return;
    const dragged = event.api.getPanel(event.getData()?.panelId);
    const targetMin = Math.max(0, ...(event.group?.panels || []).map(p => minimumWidth(p.params.type)));
    if (compact.current || !event.group || (['left', 'right'].includes(event.position) && event.group.width < targetMin + (dragged ? minimumWidth(dragged.params.type) : 520) + 4) || (['top', 'bottom'].includes(event.position) && event.group.height < 516)) {
      event.preventDefault(); setMessage('Insufficient room for this split. Drop on the tab bar to group panels.');
    }
  };
  const onReady = ({ api }) => {
    dock.current = api; load(); setReady(true);
    subscriptions.current.push(api.onDidActivePanelChange(refresh),
      api.onDidLayoutChange(() => { dirty.current = true; }),
      api.onDidMutateLayout(event => { if (event.origin === 'user' && !changing.current) { refresh(); queueMicrotask(() => { if (alive.current) persist(); }); } }));
    props.onDockReady?.(api);
  };
  const endGesture = () => {
    if (!gestures.current) return; gestures.current = false;
    setTimeout(() => { if (alive.current && dirty.current) persist(); }, 80);
  };
  useEffect(() => {
    alive.current = true;
    window.addEventListener('pointerup', endGesture); return () => window.removeEventListener('pointerup', endGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { alive.current = false; subscriptions.current.forEach(s => s.dispose()); }, []);
  const active = dock.current?.activePanel, openTypes = new Set(dock.current?.panels.map(p => p.params.type));
  return <Context.Provider value={{ inputs: { ...props, ...analysis }, move }}>
    <div className={`wb2 wbHybrid ${collapsed ? 'wbRailCollapsed' : ''}`} data-layout-revision={revision}>
      <aside className="wb2Sidebar" aria-label="Engineering modules">
        <button type="button" className="wbRailToggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(v => !v)}><i className="bi bi-layout-sidebar" aria-hidden="true" /><span>Modules</span></button>
        {['SETUP', 'VISUALISATION', 'ANALYSIS', 'JARFRAME', ...(developerPanels ? ['DEVELOPER'] : [])].map(label => <React.Fragment key={label}>
          <div className="wbDockNavLabel">{label}</div>
          {MODULES.filter(([, group]) => group === label).map(([type, , icon]) => <button key={type} type="button" aria-label={Registry[type].title} title={Registry[type].title}
            disabled={!ready} aria-pressed={openTypes.has(type)} className={`${openTypes.has(type) ? 'open' : ''} ${active?.params.type === type ? 'selected' : ''}`} onClick={() => open(type)}>
            <i className={`bi bi-${icon}`} aria-hidden="true" /><span>{Registry[type].title}</span>{openTypes.has(type) && <span className="wb2OpenIndicator" aria-hidden="true" />}
          </button>)}
        </React.Fragment>)}
        <div className="wbDockNavFooter">
          <button type="button" aria-label="Save layout" title="Save layout" onClick={() => { persist(); setMessage('Layout saved.'); }}><i className="bi bi-floppy" aria-hidden="true" /><span>Save layout</span></button>
          <button type="button" aria-label="Reset layout" title="Reset layout" onClick={() => {
            try { readLayouts(localStorage); } catch { localStorage.setItem(`${DOCK_KEY}.recovery`, localStorage.getItem(DOCK_KEY)); localStorage.setItem(DOCK_KEY, JSON.stringify({ version: 1, workspaces: {} })); }
            apply(defaultLayout(width())); persist(); setMessage('Docked defaults restored.');
          }}><i className="bi bi-layout-wtf" aria-hidden="true" /><span>Reset layout</span></button>
          {localStorage.getItem(LEGACY_KEY) && <button type="button" aria-label="Recover legacy floating layout" title="Recover legacy floating layout" onClick={() => { try { apply(migrateLegacy(JSON.parse(localStorage.getItem(LEGACY_KEY)), width())); persist(); } catch (e) { setMessage(e.message); } }}><i className="bi bi-clock-history" aria-hidden="true" /><span>Recover floating layout</span></button>}
        </div>
      </aside>
      <main className="wbDockMain">
        {message && <div className="wbDockMessage" role="status">{message}<button type="button" aria-label="Dismiss layout message" onClick={() => setMessage('')}>×</button></div>}
        <div ref={host} className="wbDockHost" onPointerDownCapture={() => { gestures.current = true; dirty.current = false; }}>
          <DockviewReact components={components} theme={themeLight} onReady={onReady} prefixHeaderActionsComponent={GroupLabel} rightHeaderActionsComponent={GroupActions}
            onWillDrop={guardDrop} onDidDrop={() => { refresh(); persist(); adapt(); }} floatingGroupBounds="boundedWithinViewport" />
        </div>
      </main>
    </div>
  </Context.Provider>;
}
