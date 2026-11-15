import React from 'react';
import { Rnd } from 'react-rnd';
import Registry from './WidgetRegistry';
import Widget from './Widget';
import { projectWindow, JAR_CONFIGURATION_MIN_WIDTH, JAR_CONFIGURATION_MIN_HEIGHT, STRING_FRAME_MIN_WIDTH, STRING_FRAME_MIN_HEIGHT } from './floatingLayout';

export default function FloatingWindow({ window: w, viewport, hidden, onChange, onFocus, inputs, title: titleOverride, children, minimizable = true }) {
  const rect = projectWindow(w, viewport.width, viewport.height, viewport.minX, viewport.minY), entry = Registry[w.type], title = titleOverride || entry?.title || '', brand = entry?.brand || 'drillframe';
  const minWidth = Math.min(w.type === 'jarConfiguration' ? JAR_CONFIGURATION_MIN_WIDTH : w.type === 'stringFrame' ? STRING_FRAME_MIN_WIDTH : 300, rect.width);
  const minHeight = Math.min(w.type === 'jarConfiguration' ? JAR_CONFIGURATION_MIN_HEIGHT : w.type === 'stringFrame' ? STRING_FRAME_MIN_HEIGHT : 180, rect.height);
  const brandName = brand === 'jarframe' ? 'JARFRAME' : 'DRILLFRAME';
  return <Rnd bounds="parent" position={{ x: rect.x, y: rect.y }} size={{ width: rect.width, height: rect.height }}
    minWidth={minWidth} minHeight={minHeight}
    style={{ zIndex: w.z, visibility: hidden ? 'hidden' : undefined, pointerEvents: hidden ? 'none' : undefined }}
    dragHandleClassName="wbFloatingTitlebar" cancel=".wbFloatingActions" disableDragging={w.maximized} enableResizing={!w.maximized}
    onMouseDown={onFocus} onDragStart={onFocus} onResizeStart={onFocus}
    onDragStop={(e, d) => onChange({ x: d.x, y: d.y })}
    onResizeStop={(e, direction, ref, delta, position) => onChange({ width: Math.max(minWidth, parseFloat(ref.style.width)), height: Math.max(minHeight, parseFloat(ref.style.height)), ...position })}>
    <section className={`wbFloatingWindow ${w.maximized ? 'maximized' : ''}`} aria-label={`${title} window`} aria-hidden={hidden || undefined} data-window-type={w.type}>
      <header className="wbFloatingTitlebar" onDoubleClick={e => { if (!e.target.closest('button')) onChange({ maximized: !w.maximized }); }}>
        <div className="wbFloatingTitlebarIdentity">
          <span className="wbFloatingBrand" aria-label={`${brandName} brand`} data-brand={brand}>
            <span className="wbFloatingBrandPrimary">{brand === 'jarframe' ? 'JAR' : 'DRILL'}</span><span className="wbFloatingBrandAccent">FRAME</span>
          </span>
          <span className="wbFloatingTitlebarSeparator" aria-hidden="true" />
          <span className="wbFloatingWindowTitle">{title}</span>
        </div><div className="wbFloatingActions">
          {minimizable && <button type="button" title={`Minimise ${title}`} aria-label={`Minimise ${title}`} onClick={() => onChange({ minimized: true })}><i className="bi bi-dash" aria-hidden="true" /></button>}
          <button type="button" title={`${w.maximized ? 'Restore' : 'Maximise'} ${title}`} aria-label={`${w.maximized ? 'Restore' : 'Maximise'} ${title}`} onClick={() => onChange({ maximized: !w.maximized })}><i className={`bi bi-${w.maximized ? 'back' : 'square'}`} aria-hidden="true" /></button>
          <button type="button" title={`Close ${title}`} aria-label={`Close ${title}`} onClick={() => onChange({ visible: false })}><i className="bi bi-x-lg" aria-hidden="true" /></button>
        </div>
      </header>
      <div className="wbFloatingContent">{children || <Widget {...inputs} widget={w} contentOnly />}</div>
    </section>
  </Rnd>;
}
