import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './Workspace.css';
import './FloatingWindows.css';
import Registry from './WidgetRegistry';
import FloatingWindow from './FloatingWindow';
import ComponentLibrary from '../Components/BHABuilder/ComponentLibrary';
import ComponentEditorContext from '../Components/BHABuilder/ComponentEditorContext';
import useWorkspaceAnalysis from './useWorkspaceAnalysis';
import { MODULES, isDeveloper, defaultWindows, arrangeWindows, loadFloating, saveFloating, visibleWorkspaceViewport, recoverFloatingWindow } from './floatingLayout';

// Layout operations never write BHA data or calculate engineering results.
export default function Workspace(props) {
  const { bha, developerPanels = false } = props;
  const analysis = useWorkspaceAnalysis(bha), canvas = useRef(null);
  const [viewport, setViewport] = useState({ width: Math.max(320, window.innerWidth - 224), height: Math.max(240, window.innerHeight - 72) });
  const [initial] = useState(() => loadFloating(localStorage, bha?.id || 'draft', viewport.width, viewport.height));
  const [windows, setWindows] = useState(initial.windows), [message, setMessage] = useState(initial.message || '');
  const [collapsed, setCollapsed] = useState(false), [menu, setMenu] = useState(false);
  const [mountEpoch, setMountEpoch] = useState(0);
  const [editor, setEditor] = useState(null);
  const closeEditor = () => setEditor(null);
  const openEditor = () => setEditor({ id: 'componentEditor', type: 'componentEditor', x: 40, y: 24,
    width: 660, height: 640, z: Math.max(editor?.z || 0, ...current.current.map(w => w.z)) + 1, visible: true });
  const current = useRef(windows), owner = useRef(bha?.id || 'draft'), previous = useRef(bha);
  const [mounted, setMounted] = useState(() => new Set(initial.windows.filter(w => w.visible).map(w => w.type)));
  const persist = (next, key = owner.current) => {
    try { saveFloating(localStorage, key, next); } catch (e) { setMessage(`Layout not saved: ${e.message}`); }
  };
  const update = transform => {
    const next = transform(current.current); current.current = next; setWindows(next); persist(next);
  };
  // Canvas size alone does not change when banners/page scrolling move its
  // visible origin. Measure after commits as well as browser geometry events.
  const measureViewport = () => {
    const next = visibleWorkspaceViewport(canvas.current?.getBoundingClientRect(), window.innerWidth, window.innerHeight,
      { width: canvas.current?.clientWidth || 320, height: canvas.current?.clientHeight || 240 });
    setViewport(previous => Object.keys(next).every(k => previous[k] === next[k]) ? previous : next);
  };
  useLayoutEffect(measureViewport);
  useEffect(() => {
    const observer = new ResizeObserver(measureViewport); observer.observe(canvas.current);
    window.addEventListener('resize', measureViewport); window.addEventListener('scroll', measureViewport, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', measureViewport); window.removeEventListener('scroll', measureViewport, true); };
    // The callback reads live DOM bounds and only writes viewport state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const key = bha?.id || 'draft';
    if (key !== owner.current) {
      const firstSave = !previous.current?.id && key !== 'draft' && JSON.stringify(previous.current?.rows) === JSON.stringify(bha?.rows);
      owner.current = key;
      if (firstSave) persist(current.current, key);
      else {
        setEditor(null);
        const restored = loadFloating(localStorage, key, viewport.width, viewport.height);
        current.current = restored.windows; setWindows(restored.windows); setMessage(restored.message || '');
        setMounted(new Set(restored.windows.filter(w => w.visible).map(w => w.type)));
        setMountEpoch(n => n + 1);
      }
    }
    previous.current = bha;
    // Geometry adaptation is display-only; switching ownership does not rewrite saved positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bha]);
  const focus = type => update(list => {
    const w = list.find(p => p.type === type), top = Math.max(editor?.z || 0, ...list.map(p => p.z));
    return !w || w.z === top ? list : list.map(p => p.type === type ? { ...p, z: top + 1 } : p);
  });
  const open = type => {
    if (isDeveloper(type) && !developerPanels) return;
    setMounted(set => new Set([...set, type]));
    update(list => {
      const top = Math.max(editor?.z || 0, ...list.map(p => p.z)), existing = list.find(p => p.type === type);
      const item = existing || { ...defaultWindows(viewport.width, viewport.height).find(p => p.type === type), x: 30 + list.filter(p => p.visible).length * 24, y: 30 + list.filter(p => p.visible).length * 24 };
      const visible = visibleWorkspaceViewport(canvas.current?.getBoundingClientRect(), window.innerWidth, window.innerHeight, viewport);
      const targetWidth = Math.max(1, Math.min(1260, visible.width - 24));
      const presentationItem = type === 'jarConfiguration' && item.width < Math.min(1050, targetWidth)
        ? { ...item, x: visible.minX + 12, width: targetWidth }
        : item;
      return [...list.filter(p => p.type !== type), { ...recoverFloatingWindow(presentationItem, visible), visible: true, minimized: false, z: top + 1 }];
    });
  };
  const arrange = mode => {
    const visible = visibleWorkspaceViewport(canvas.current?.getBoundingClientRect(), window.innerWidth, window.innerHeight, viewport);
    update(list => mode === 'reset' ? (() => {
      const defaults = defaultWindows(viewport.width, viewport.height);
      return [...list.map(w => ({ ...w, ...(defaults.find(d => d.type === w.type) || {}), id: w.id })),
        ...defaults.filter(d => !list.some(w => w.type === d.type))];
    })() : arrangeWindows(list, mode, visible.width, visible.height, developerPanels, visible.minX, visible.minY));
    if (mode === 'reset') setMounted(set => new Set([...set, 'bhaEntry', 'analysisInputs']));
    setMenu(false);
  };
  const top = Math.max(0, ...windows.filter(w => w.visible && !w.minimized && (developerPanels || !isDeveloper(w.type))).map(w => w.z));
  const visibleViewport = visibleWorkspaceViewport(canvas.current?.getBoundingClientRect(), window.innerWidth, window.innerHeight, viewport);
  const editorViewport = visibleWorkspaceViewport(canvas.current?.getBoundingClientRect(), window.innerWidth, window.innerHeight - 8, viewport);
  return <ComponentEditorContext.Provider value={openEditor}><div className={`wb2 wbFloating ${collapsed ? 'wbRailCollapsed' : ''}`}>
    <aside className="wb2Sidebar" aria-label="Engineering modules">
      <button type="button" className="wbRailToggle" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(v => !v)}><i className="bi bi-layout-sidebar" aria-hidden="true" /><span>Modules</span></button>
      {['SETUP', 'VISUALISATION', 'ANALYSIS', 'JARFRAME', ...(developerPanels ? ['DEVELOPER'] : [])].map(group => <React.Fragment key={group}>
        <div className="wbFloatingNavLabel">{group}</div>
        {MODULES.filter(([, category]) => category === group).map(([type, , icon]) => {
          const w = windows.find(p => p.type === type), active = w?.visible;
          return <button key={type} type="button" title={Registry[type].title} aria-label={Registry[type].title} aria-pressed={!!active}
            className={`${active ? 'open' : ''} ${active && !w.minimized && w.z === top ? 'selected' : ''}`} onClick={() => open(type)}>
            <i className={`bi bi-${icon}`} aria-hidden="true" /><span>{Registry[type].title}{w?.minimized && active ? ' (minimised)' : ''}</span>{active && <span className="wb2OpenIndicator" aria-hidden="true" />}
          </button>;
        })}
      </React.Fragment>)}
      <div className="wbFloatingNavFooter">
        <button type="button" aria-label="Arrange Windows" title="Arrange Windows" aria-expanded={menu} onClick={() => setMenu(v => !v)}><i className="bi bi-grid" aria-hidden="true" /><span>Arrange Windows</span></button>
        {menu && <div className="wbArrangeMenu" aria-label="Window arrangements">
          <button type="button" onClick={() => arrange('side')}>Side by Side</button>
          <button type="button" onClick={() => arrange('grid')}>Grid</button>
          <button type="button" onClick={() => arrange('reset')}>Reset Layout</button>
        </div>}
        <button type="button" aria-label="Save layout" title="Save layout" onClick={() => { persist(current.current); setMessage('Layout saved.'); }}><i className="bi bi-floppy" aria-hidden="true" /><span>Save layout</span></button>
      </div>
    </aside>
    <main className="wbFloatingMain">
      {message && <div role="status" className="wbFloatingMessage">{message}<button type="button" aria-label="Dismiss layout message" onClick={() => setMessage('')}>×</button></div>}
      <div className="wbFloatingCanvas" ref={canvas} aria-label="Floating workspace">
        {windows.filter(w => mounted.has(w.type)).map(w => <FloatingWindow key={`${mountEpoch}:${w.type}`} window={w} viewport={visibleViewport}
          hidden={!w.visible || w.minimized || (isDeveloper(w.type) && !developerPanels)} onFocus={() => focus(w.type)}
          onChange={patch => update(list => list.map(p => p.type === w.type ? { ...p, ...patch } : p))} inputs={{ ...props, ...analysis }} />)}
        {editor && <FloatingWindow window={editor} viewport={editorViewport} title="Add Component" minimizable={false}
          onFocus={() => setEditor(w => w ? { ...w, z: Math.max(w.z, ...current.current.map(p => p.z)) + 1 } : w)}
          onChange={patch => patch.visible === false ? closeEditor() : setEditor(w => ({ ...w, ...patch }))}>
          <ComponentLibrary bha={bha} updateBha={props.updateBha} onClose={closeEditor} />
        </FloatingWindow>}
      </div>
    </main>
  </div></ComponentEditorContext.Provider>;
}
