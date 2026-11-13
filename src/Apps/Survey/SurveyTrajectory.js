import React, { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { defaultSectionAzimuth, trajectoryPath, trajectoryFigure, verticalSection, withTrajectorySelection } from './trajectoryData';
const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));
const Plot3D = lazy(() => import('./Survey3DPlot'));
const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

export default function SurveyTrajectory({ geometry, workspaceId }) {
  const [section, setSection] = useState('');
  const [hover, setHover] = useState(null), [selected, setSelected] = useState(null);
  const [fit, setFit] = useState(0), [camera, setCamera] = useState(0), [enlarged, setEnlarged] = useState(false);
  const path = useMemo(() => trajectoryPath(geometry), [geometry]);
  const defaultAzimuth = useMemo(() => geometry?.valid ? defaultSectionAzimuth(geometry) : 0, [geometry]);
  const azimuth = section === '' ? defaultAzimuth : Number(section);
  const validSection = Number.isFinite(azimuth) && azimuth >= 0 && azimuth <= 360;
  const current = record => Boolean(record && record.geometry === geometry && record.workspaceId === workspaceId);
  const activeIndex = current(hover) ? hover.index : current(selected) ? selected.index : null;
  const serial = useRef(0);
  const revision = useMemo(() => ({ geometry, workspaceId, id: ++serial.current }), [geometry, workspaceId]);
  const version = `${revision.id}:${fit}`;
  // Geometry changes replace this subtree via the parent key; selection records also reject stale geometry synchronously.
  const baseFigures = useMemo(() => geometry?.valid && validSection ? Object.fromEntries(['3d', 'vertical', 'plan'].map(view => [view,
    trajectoryFigure(geometry, path, azimuth, null, view, view === 'vertical' ? `${version}:${azimuth}` : version, camera)])) : null,
    [geometry, path, azimuth, version, camera, validSection]);
  const figures = useMemo(() => baseFigures ? Object.fromEntries(['3d', 'vertical', 'plan'].map(view => [view,
    withTrajectorySelection(baseFigures[view], geometry, activeIndex, view, azimuth)])) : null, [baseFigures, geometry, activeIndex, azimuth]);
  const record = index => ({ geometry, workspaceId, index });
  const stationEvent = setter => event => {
    const index = event.points?.[0]?.customdata?.[0];
    if (Number.isInteger(index) && geometry.stations[index]) setter(previous => current(previous) && previous.index === index ? previous : record(index));
  };
  const station = geometry?.stations?.[activeIndex];
  const reset = () => setCamera(v => v + 1);
  return <section className={`surveyTrajectory ${enlarged ? 'surveyTrajectoryEnlarged' : ''}`} aria-label="Survey trajectory visualisations">
    {!geometry?.valid ? <div className="surveyTrajectoryEmpty" role="status">No valid trajectory. Import a survey and confirm its units below. Invalid or incomplete stations are not plotted.</div> : <>
      <div className="surveyTrajectoryControls">
        <button type="button" onClick={reset}>Reset View</button>
        <button type="button" onClick={() => { setFit(v => v + 1); reset(); }}>Fit Trajectory</button>
        <button type="button" aria-pressed={enlarged} onClick={() => setEnlarged(v => !v)}>{enlarged ? 'Show Three Views' : 'Enlarge 3D'}</button>
        <label>Section azimuth (° from North)<input type="number" min="0" max="360" step="any" value={section} placeholder={fmt(defaultAzimuth)} onChange={e => setSection(e.target.value)} /></label>
        <span>{section === '' ? 'Default: bottomhole bearing (0° for a vertical well)' : 'User-defined section azimuth'}</span>
      </div>
      <p className="surveyTrajectoryConvention">Feet · TVD positive down · equal physical scale; no horizontal exaggeration. Green: {geometry.summary.startMdFt === 0 ? 'surface' : 'first survey station'} · rust: survey end. 3D: drag to rotate · wheel to zoom · right-drag to pan.</p>
      {geometry.stations.length > 2000 && <p className="surveyTrajectoryConvention">Station markers are sampled for display. Every station is retained in the trajectory and table; use the station selector for any station.</p>}
      {!validSection ? <p role="alert">Section azimuth must be between 0 and 360 degrees.</p> : <Suspense fallback={<p role="status">Loading trajectory plots…</p>}>
        <div className="surveyTrajectoryGrid">
          {['3d', 'vertical', 'plan'].map(view => <section className={`surveyTrajectoryView surveyTrajectory-${view}`} aria-label={view === '3d' ? '3D well trajectory' : view === 'vertical' ? 'Vertical section trajectory' : 'Plan view trajectory'} key={view}>
            <h6>{view === '3d' ? '3D Well Trajectory' : view === 'vertical' ? `Vertical Section · ${fmt(azimuth)}°` : 'Plan View · North Up'}</h6>
            {view === '3d' ? <Plot3D {...figures[view]} plotHeight={enlarged ? 700 : 600}
              onHover={stationEvent(setHover)} onUnhover={() => setHover(null)} onClick={stationEvent(setSelected)} /> :
              <Plot key={`${view}:${revision.id}:${fit}`} {...figures[view]} plotHeight={280}
                onHover={stationEvent(setHover)} onUnhover={() => setHover(null)} onClick={stationEvent(setSelected)} />}
          </section>)}
        </div>
      </Suspense>}
      <div className="surveyStationReadout" aria-label="Selected survey station">
        <label>Survey station<select aria-label="Select survey station" value={activeIndex ?? ''} onChange={e => { setHover(null); setSelected(e.target.value === '' ? null : record(Number(e.target.value))); }}><option value="">Hover or select a station</option>{geometry.stations.map((s, i) => <option value={i} key={i}>MD {fmt(s.mdFt)} ft</option>)}</select></label>
        {station ? <dl>{[['MD', station.mdFt, 'ft'], ['TVD', station.tvdFt, 'ft'], ['Inclination', station.inclinationDeg, '°'], ['Azimuth', station.azimuthDeg, '°'], ['North', station.northingFt, 'ft'], ['East', station.eastingFt, 'ft'], ['Vertical section', verticalSection(station, azimuth), 'ft']].map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{fmt(value)} {unit}</dd></div>)}</dl> : <span>Hover highlights all views. Click or use the station selector to retain a station.</span>}
      </div>
      {geometry.summary.startMdFt !== 0 && <p className="surveyNotice">Origin is the first station at MD {fmt(geometry.summary.startMdFt)} ft, not the surface. TVD and displacements are relative; no missing interval is invented.</p>}
    </>}
  </section>;
}
