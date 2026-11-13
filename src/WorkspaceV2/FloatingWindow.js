import React from 'react';
import { Rnd } from 'react-rnd';
import Registry from './WidgetRegistry';
import Widget from './Widget';
import { projectWindow } from './floatingLayout';

export default function FloatingWindow({ window: w, viewport, hidden, onChange, onFocus, inputs, title: titleOverride, children, minimizable = true }) {
  const rect = projectWindow(w, viewport.width, viewport.height, viewport.minX, viewport.minY), title = titleOverride || Registry[w.type].title;
  return <Rnd bounds="parent" position={{ x: rect.x, y: rect.y }} size={{ width: rect.width, height: rect.height }}
    minWidth={Math.min(300, rect.width)} minHeight={Math.min(180, rect.height)}
    style={{ zIndex: w.z, visibility: hidden ? 'hidden' : undefined, pointerEvents: hidden ? 'none' : undefined }}
    dragHandleClassName="wbFloatingTitlebar" cancel=".wbFloatingActions" disableDragging={w.maximized} enableResizing={!w.maximized}
    onMouseDown={onFocus} onDragStart={onFocus} onResizeStart={onFocus}
    onDragStop={(e, d) => onChange({ x: d.x, y: d.y })}
    onResizeStop={(e, direction, ref, delta, position) => onChange({ width: parseFloat(ref.style.width), height: parseFloat(ref.style.height), ...position })}>
    <section className={`wbFloatingWindow ${w.maximized ? 'maximized' : ''}`} aria-label={`${title} window`} aria-hidden={hidden || undefined} data-window-type={w.type}>
      <header className="wbFloatingTitlebar" onDoubleClick={e => { if (!e.target.closest('button')) onChange({ maximized: !w.maximized }); }}>
        <span>{['jarConfiguration', 'jarPlacement'].includes(w.type) && <small style={{ marginRight: 8, color: '#526778' }}>JarFrame ·</small>}{title}</span><div className="wbFloatingActions">
          {minimizable && <button type="button" title={`Minimise ${title}`} aria-label={`Minimise ${title}`} onClick={() => onChange({ minimized: true })}><i className="bi bi-dash" aria-hidden="true" /></button>}
          <button type="button" title={`${w.maximized ? 'Restore' : 'Maximise'} ${title}`} aria-label={`${w.maximized ? 'Restore' : 'Maximise'} ${title}`} onClick={() => onChange({ maximized: !w.maximized })}><i className={`bi bi-${w.maximized ? 'back' : 'square'}`} aria-hidden="true" /></button>
          <button type="button" title={`Close ${title}`} aria-label={`Close ${title}`} onClick={() => onChange({ visible: false })}><i className="bi bi-x-lg" aria-hidden="true" /></button>
        </div>
      </header>
      <div className="wbFloatingContent">{children || <Widget {...inputs} widget={w} contentOnly />}</div>
    </section>
  </Rnd>;
}
