import React, { useEffect, useMemo, useRef, useState } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js';

const Plot = createPlotlyComponent(Plotly);
// ResizeObserver supplies explicit dimensions; avoid a second Plotly resize path.
const PLOT_CONFIG = { scrollZoom: true, displaylogo: false };
export default function ConfigurationPlot({ data, layout }) {
  const host = useRef(null);
  const graph = useRef(null);
  const [width, setWidth] = useState(undefined);
  const height = layout.scene ? 600 : 380;
  const figureLayout = useMemo(() => {
    // Plotly 4's wheel-zoom relayout may omit the camera, leaving its input
    // layout stale. Preserve the live view for size/metric changes in this run.
    const scene = graph.current?._fullLayout?.scene?._scene;
    const camera = layout.scene && graph.current?.layout?.uirevision === layout.uirevision
      ? scene?.getCamera?.() : null;
    return { ...layout, width, height,
      ...(layout.scene ? { scene: { ...layout.scene, camera: camera || layout.scene.camera } } : {}) };
  }, [layout, width, height]);
  const plotStyle = useMemo(() => ({ width: '100%', height }), [height]);
  useEffect(() => {
    const measure = () => { if (host.current?.clientWidth > 0) setWidth(host.current.clientWidth); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer) observer.observe(host.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return <div ref={host} style={{ width: '100%', minWidth: 0, height }}>
    {width > 0 && <Plot ref={graph} data={data} layout={figureLayout}
      config={PLOT_CONFIG} style={plotStyle} />}
  </div>;
}
