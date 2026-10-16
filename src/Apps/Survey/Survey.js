import React from 'react';
import { parseSurveyCsv } from '../../engineering/survey/surveyImport';
import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';
import './Survey.css';

export const SURVEY_STORAGE_KEY = 'wellbenchSurveyV1';
export const SURVEY_CHANGED_EVENT = 'wellbench-survey-changed';
const units = { mdUnit: 'ft', angleUnit: 'deg' };
const empty = { originalCsv: '', filename: '', confirmed: false };
const readSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SURVEY_STORAGE_KEY));
    return typeof saved?.originalCsv === 'string' ? { originalCsv: saved.originalCsv, filename: typeof saved.filename === 'string' ? saved.filename : '', confirmed: saved.confirmed === true } : empty;
  } catch { return empty; }
};

export default function Survey() {
  const [source, setSource] = React.useState(readSaved);
  const [fileError, setFileError] = React.useState('');
  const request = React.useRef(0);
  React.useEffect(() => () => { request.current += 1; }, []);
  const parsed = React.useMemo(() => source.originalCsv ? parseSurveyCsv(source.originalCsv, source.confirmed ? units : undefined) : null, [source.originalCsv, source.confirmed]);
  const geometry = React.useMemo(() => parsed?.valid ? calculateSurveyGeometry(parsed.stations) : null, [parsed]);
  const errors = [...(parsed?.errors || []), ...(geometry?.errors || [])];
  const [storageError, setStorageError] = React.useState('');
  React.useEffect(() => {
    try { localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(source)); setStorageError(''); }
    catch { setStorageError('Survey is available for this session, but browser storage could not save it.'); }
    window.dispatchEvent(new CustomEvent(SURVEY_CHANGED_EVENT, { detail: source }));
  }, [source]);
  const upload = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const token = ++request.current;
    setFileError('');
    if (file.size > 2 * 1024 * 1024) { setFileError('CSV must be 2 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (token === request.current) setSource(current => ({ ...current, originalCsv: String(reader.result), filename: file.name }));
    };
    reader.onerror = () => { if (token === request.current) setFileError('Unable to read the CSV file.'); };
    reader.readAsText(file);
  };
  const summary = geometry?.valid ? geometry.summary : null;
  return <section className="surveyPanel" aria-label="Survey import and validation">
    <h5>Survey</h5>
    <p className="surveyNotice">Preliminary — survey geometry only; not operational guidance.</p>
    <label className="surveyUnits"><input type="checkbox" checked={source.confirmed} onChange={event => setSource(current => ({ ...current, confirmed: event.target.checked }))} /> MD is in feet; inclination and azimuth are in degrees.</label>
    <label className="surveyUpload">Survey CSV <input type="file" accept=".csv,text/csv" onChange={upload} /></label>
    <p>Headers: MD, Inclination, Azimuth. Original imported values are retained.</p>
    {source.filename && <p>Source: {source.filename}</p>}
    {fileError && <p role="alert">{fileError}</p>}
    {storageError && <p role="alert">{storageError}</p>}
    {errors.length > 0 && <div role="alert"><strong>Survey validation failed</strong><ul>{errors.map((error, index) => <li key={index}>{error.message}</li>)}</ul></div>}
    {geometry?.warnings.map((warning, index) => <p role="status" key={index}>{warning}</p>)}
    {summary && <><p role="status">Valid survey · {summary.stationCount} stations</p><dl className="surveySummary">
      <div><dt>MD coverage (ft)</dt><dd>{summary.startMdFt.toFixed(1)}–{summary.endMdFt.toFixed(1)}</dd></div>
      <div><dt>{summary.startMdFt ? 'Relative TVD (ft)' : 'TVD (ft)'}</dt><dd>{summary.tvdFt.toFixed(3)}</dd></div>
      <div><dt>Maximum inclination (°)</dt><dd>{summary.maxInclinationDeg.toFixed(2)}</dd></div>
      <div><dt>Maximum DLS (°/100 ft)</dt><dd>{summary.maxDlsDegPer100Ft.toFixed(3)}</dd></div>
    </dl></>}
    {parsed?.rawStations.length > 0 && <div className="surveyTable"><table><caption>Imported survey stations · MD ft / angles degrees</caption><thead><tr><th>Row</th><th>MD (ft)</th><th>Inclination (°)</th><th>Azimuth (°)</th>{summary && <><th>TVD (ft)</th><th>DLS (°/100 ft)</th></>}</tr></thead><tbody>{parsed.rawStations.map((station, index) => <tr key={index}><td>{station.sourceRow}</td><td>{station.mdFt}</td><td>{station.inclinationDeg}</td><td>{station.azimuthDeg}</td>{summary && <><td>{geometry.stations[index].tvdFt.toFixed(3)}</td><td>{geometry.stations[index].dlsDegPer100Ft.toFixed(3)}</td></>}</tr>)}</tbody></table></div>}
    <details><summary>Geometry assumptions</summary><p>Minimum-curvature arcs between survey stations. Coordinates are relative to the first station; no extrapolation, datum corrections or uncertainty model. Vertical azimuth is indeterminate. Antipodal tangents are unsupported. Survey geometry does not change existing BHA or drilling-load calculations.</p></details>
  </section>;
}
