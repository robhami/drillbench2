import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js';

// A WebGL scene owns asynchronous resources. Serialize updates and disposal,
// including StrictMode effect replay, rather than purging an in-flight plot.
function Scene({ data, layout, width, height, onHover, onUnhover, onClick, onFailure }) {
  const element = useRef(null), queue = useRef(Promise.resolve()), generation = useRef(null);
  const callbacks = useRef({ onHover, onUnhover, onClick, onFailure });
  callbacks.current = { onHover, onUnhover, onClick, onFailure };
  useEffect(() => {
    const node = element.current;
    const run = { active: true };
    generation.current = run;
    const lost = event => {
      event.preventDefault();
      callbacks.current.onFailure('The browser lost the 3D graphics context.');
    };
    node.addEventListener('webglcontextlost', lost, true);
    return () => {
      run.active = false;
      node.removeEventListener('webglcontextlost', lost, true);
      queue.current = queue.current.then(() => Plotly.purge(node)).catch(() => {});
    };
  }, []);
  useEffect(() => {
    const node = element.current, run = generation.current;
    queue.current = queue.current.then(async () => {
      if (!run.active || !node.isConnected || node.getBoundingClientRect().width <= 0) return;
      const scene = node._fullLayout?.scene?._scene;
      if (scene && (!scene.glplot?.gl || scene.glplot.gl.isContextLost()))
        throw new Error('The 3D graphics context is no longer available.');
      // Read the live camera only from an initialized, still-live scene.
      const camera = node.layout?.uirevision === layout.uirevision && scene?.glplot?.gl
        ? scene.getCamera() : layout.scene.camera;
      await Plotly.react(node, data, { ...layout, width, height, scene: { ...layout.scene, camera } },
        { scrollZoom: true, displaylogo: false });
      if (!run.active) return;
      const gl = node._fullLayout?.scene?._scene?.glplot?.gl;
      if (!gl || gl.isContextLost()) throw new Error('WebGL could not initialize the 3D trajectory.');
      // Plotly gl3d 4.1.2 recoverContext queues an uncancellable RAF which reads
      // scene.glplot.gl after purge has set glplot=null. Own recovery here:
      // stop using this scene and let Retry create a fresh one. Do not start
      // Plotly's polling recovery loop on a scene that React may dispose.
      node._fullLayout.scene._scene.recoverContext = () => {
        if (run.active) callbacks.current.onFailure('The browser lost the 3D graphics context.');
      };
      ['hover', 'unhover', 'click'].forEach((name, i) => {
        const event = `plotly_${name}`;
        node.removeAllListeners(event);
        node.on(event, value => callbacks.current[['onHover', 'onUnhover', 'onClick'][i]]?.(value));
      });
    }).catch(error => {
      if (run.active) callbacks.current.onFailure(error.message);
    });
  }, [data, layout, width, height]);
  return <div ref={element} style={{ width, height }} />;
}

export default function Survey3DPlot({ data, layout, plotHeight = 600, ...events }) {
  const host = useRef(null);
  const [width, setWidth] = useState(0), [failure, setFailure] = useState(null);
  useEffect(() => {
    const node = host.current;
    const measure = () => setWidth(node.isConnected && node.getBoundingClientRect().height > 0
      ? Math.floor(node.getBoundingClientRect().width) : 0);
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(node);
    // Floating windows hide their mounted children; visibility is not a React unmount.
    const visibility = new MutationObserver(measure);
    for (let parent = node.parentElement; parent; parent = parent.parentElement)
      visibility.observe(parent, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    window.addEventListener('resize', measure);
    measure();
    return () => { resize?.disconnect(); visibility.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return <div ref={host} style={{ width: '100%', minWidth: 0, height: plotHeight }}>
    {failure ? <div role="status" style={{ padding: 20 }}>
      <p>3D trajectory unavailable. {failure} The 2D views and survey data remain available.</p>
      <button type="button" onClick={() => setFailure(null)}>Retry 3D View</button>
    </div> : width > 0 ? <Scene {...events} data={data} layout={layout} width={width} height={plotHeight} onFailure={setFailure} />
      : <span role="status">Waiting for a visible 3D plot area…</span>}
  </div>;
}
