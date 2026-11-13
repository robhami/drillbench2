import React, { useEffect, useMemo, useRef, useState } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js';

const Plot = createPlotlyComponent(Plotly);
// ResizeObserver supplies explicit dimensions; avoid a second Plotly resize path.
const PLOT_CONFIG = { scrollZoom: true, displaylogo: false };
export default function ConfigurationPlot({ data, layout, responsiveHeight = false, plotHeight, onHover, onUnhover, onClick }) {
  const host = useRef(null);
  const graph = useRef(null);
  const [width, setWidth] = useState(undefined);
  const [availableHeight, setAvailableHeight] = useState(380);
  const height = plotHeight || (responsiveHeight ? availableHeight : layout.scene ? 600 : 380);
  const figureLayout = useMemo(() => {
    // Plotly 4's wheel-zoom relayout may omit the camera, leaving its input
    // layout stale. Preserve the live view for size/metric changes in this run.
    const scene = layout.scene && data ? graph.current?._fullLayout?.scene?._scene : null;
    const camera = layout.scene && graph.current?.layout?.uirevision === layout.uirevision
      ? scene?.getCamera?.() : null;
    return { ...layout, width, height,
      ...(layout.scene ? { scene: { ...layout.scene, camera: camera || layout.scene.camera } } : {}) };
  }, [layout, width, height, data]);
  const plotStyle = useMemo(() => ({ width: '100%', height }), [height]);
  useEffect(() => {
    const measure = () => {
      if (host.current?.clientWidth > 0) setWidth(host.current.clientWidth);
      const module = host.current?.closest('.jarClearance');
      if (responsiveHeight && module) setAvailableHeight(Math.max(340, Math.min(650, module.clientHeight - 190)));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer) { observer.observe(host.current); if (responsiveHeight && host.current?.closest('.jarClearance')) observer.observe(host.current.closest('.jarClearance')); }
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [responsiveHeight]);
  return <div ref={host} style={{ width: '100%', minWidth: 0, height }}>
    {width > 0 && <Plot ref={graph} data={data} layout={figureLayout}
      onHover={onHover} onUnhover={onUnhover} onClick={onClick}
      config={PLOT_CONFIG} style={plotStyle} />}
  </div>;
}
