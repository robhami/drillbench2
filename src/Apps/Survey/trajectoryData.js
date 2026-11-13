import { evaluateSurveyAtMd } from '../../engineering/survey/surveyGeometry';

// Display projection, clockwise from North. No MD substitution or coordinate scaling.
export const verticalSection = (station, azimuth) => station.northingFt * Math.cos(azimuth * Math.PI / 180) + station.eastingFt * Math.sin(azimuth * Math.PI / 180);
export function defaultSectionAzimuth(geometry) {
  const bottom = geometry.stations.at(-1);
  return Math.hypot(bottom.northingFt, bottom.eastingFt) < 1e-8 ? 0 : (Math.atan2(bottom.eastingFt, bottom.northingFt) * 180 / Math.PI + 360) % 360;
}

// Render existing minimum-curvature arcs rather than straight chords between sparse stations.
// Always retain every imported station. Bound extra display samples for large surveys.
export function trajectoryPath(geometry) {
  if (!geometry?.valid) return [];
  const maxPieces = Math.max(1, Math.floor(2000 / geometry.segments.length));
  const points = [geometry.stations[0]];
  geometry.segments.forEach((segment, index) => {
    const pieces = Math.min(maxPieces, Math.max(1, Math.ceil(segment.doglegDeg / 2), Math.ceil(segment.lengthFt / 250)));
    for (let i = 1; i < pieces; i += 1) points.push(evaluateSurveyAtMd(geometry, segment.fromMdFt + segment.lengthFt * i / pieces));
    points.push(geometry.stations[index + 1]);
  });
  return points;
}

const axis = text => ({ title: { text, font: { size: 13 }, standoff: 10 }, tickfont: { size: 11 }, tickformat: ',~f', automargin: true, gridcolor: '#e5ebf0', zerolinecolor: '#9caebd' });
export const INITIAL_CAMERA = { eye: { x: 1.45, y: 1.45, z: 1.1 }, up: { x: 0, y: 0, z: 1 }, center: { x: 0, y: 0, z: 0 } };
const coordinatesFor = (points, view, azimuth) => view === '3d' ? { x: points.map(p => p.eastingFt), y: points.map(p => p.northingFt), z: points.map(p => p.tvdFt) }
  : view === 'plan' ? { x: points.map(p => p.eastingFt), y: points.map(p => p.northingFt) }
    : { x: points.map(p => verticalSection(p, azimuth)), y: points.map(p => p.tvdFt) };
const metadata = (s, index, azimuth) => [index, s.mdFt, s.tvdFt, s.inclinationDeg, s.azimuthDeg, s.northingFt, s.eastingFt, verticalSection(s, azimuth)];

export function withTrajectorySelection(figure, geometry, index, view, azimuth) {
  if (!Number.isInteger(index) || !geometry.stations[index]) return figure;
  const s = geometry.stations[index];
  const trace = { ...figure.data[1], name: 'Selected station', ...coordinatesFor([s], view, azimuth), customdata: [metadata(s, index, azimuth)], marker: { color: '#e4a21b', size: view === '3d' ? 8 : 11 } };
  return { ...figure, data: [...figure.data, trace] };
}

export function trajectoryFigure(geometry, path, sectionAzimuth, activeIndex, view, revision, cameraRevision = 0) {
  const stations = geometry.stations;
  const is3d = view === '3d';
  const coordinates = points => coordinatesFor(points, view, sectionAzimuth);
  const customdata = (points, indices) => points.map((s, i) => metadata(s, indices[i], sectionAzimuth));
  const hovertemplate = 'MD %{customdata[1]:,.1f} ft<br>TVD %{customdata[2]:,.1f} ft<br>Inclination %{customdata[3]:.1f}° · Azimuth %{customdata[4]:.1f}°<br>North %{customdata[5]:,.1f} ft · East %{customdata[6]:,.1f} ft<br>Vertical section %{customdata[7]:,.1f} ft<extra></extra>';
  const type = is3d ? 'scatter3d' : 'scatter';
  const markerTrace = (points, indices, name, color, size) => ({ type, mode: 'markers', name, ...coordinates(points),
    customdata: customdata(points, indices), marker: { color, size }, hovertemplate });
  const stride = Math.max(1, Math.ceil(stations.length / 2000));
  const indices = stations.map((_, i) => i).filter(i => i % stride === 0);
  const data = [
    { type, mode: 'lines', name: 'Minimum-curvature trajectory', ...coordinates(path), line: { color: '#087b9b', width: is3d ? 5 : 2.25, ...(is3d ? {} : { shape: 'linear', simplify: false }) }, hoverinfo: 'skip' },
    markerTrace(indices.map(i => stations[i]), indices, 'Survey stations', '#087b9b', is3d ? 3 : 4),
    markerTrace([stations[0]], [0], geometry.summary.startMdFt === 0 ? 'Surface' : 'Survey origin (not surface)', '#27845a', is3d ? 6 : 8),
    markerTrace([stations.at(-1)], [stations.length - 1], 'Bottomhole / survey end', '#b44b33', is3d ? 6 : 8)
  ];
  const layout = { autosize: true, showlegend: false, uirevision: revision, paper_bgcolor: 'white', plot_bgcolor: 'white',
    margin: { l: is3d ? 0 : 65, r: is3d ? 0 : 18, t: is3d ? 0 : 12, b: is3d ? 0 : 55 },
    font: { family: 'Arial, sans-serif', color: '#334155', size: 12 }, hovermode: 'closest', hoverlabel: { font: { size: 12 } } };
  if (is3d) {
    const extents = ['eastingFt', 'northingFt', 'tvdFt'].map(key => path.reduce(([min, max], p) => [Math.min(min, p[key]), Math.max(max, p[key])], [Infinity, -Infinity]));
    const spans = extents.map(([min, max]) => max - min);
    const padding = Math.max(1, ...spans) * 0.035;
    const ranges = extents.map(([min, max]) => [min - padding, max + padding]);
    // Explicit equal-units aspect avoids Plotly's data-aspect singularity for
    // planar/vertical wells whose near-zero extent is floating-point noise.
    const rangeSpans = ranges.map(([min, max]) => max - min), largest = Math.max(...rangeSpans);
    layout.scene = { xaxis: { ...axis('East (ft)'), range: ranges[0], autorange: false }, yaxis: { ...axis('North (ft)'), range: ranges[1], autorange: false },
      zaxis: { ...axis('TVD (ft)'), range: ranges[2].slice().reverse(), autorange: false },
      aspectmode: 'manual', aspectratio: { x: rangeSpans[0] / largest, y: rangeSpans[1] / largest, z: rangeSpans[2] / largest },
      camera: INITIAL_CAMERA, uirevision: `${revision}:${cameraRevision}`, dragmode: 'orbit' };
    // Shared wrapper preserves a live camera only within this view revision.
    layout.uirevision = `${revision}:${cameraRevision}`;
  } else {
    layout.xaxis = axis(view === 'plan' ? 'Easting (ft)' : 'Vertical Section (ft)');
    layout.yaxis = { ...axis(view === 'plan' ? 'Northing (ft)' : 'TVD (ft)'), scaleanchor: 'x', scaleratio: 1, ...(view === 'plan' ? {} : { autorange: 'reversed' }) };
    if (view === 'plan') layout.annotations = [{ x: 0.94, y: 0.97, xref: 'paper', yref: 'paper', ax: 0, ay: 32, text: 'N', showarrow: true, arrowhead: 2, font: { size: 13 } }];
  }
  return withTrajectorySelection({ data, layout }, geometry, activeIndex, view, sectionAzimuth);
}
