import React from 'react';
import { parseSurveyCsv } from '../../engineering/survey/surveyImport';
import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';
import SurveyTrajectory from './SurveyTrajectory';
import './Survey.css';
import ActiveSurvey from './ActiveSurvey';
import SurveyManagement from './SurveyManagement';
import { useActiveSurvey, hasSurveyAssociation, replaceSurvey, archiveSurveys, trajectorySelectionPatch } from './surveyAssociation';

export { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from './surveyAssociation';
const units = { mdUnit: 'ft', angleUnit: 'deg' };
const empty = { originalCsv: '', filename: '', confirmed: false };

export default function Survey({ bha, updateBha }) {
  const active = useActiveSurvey(bha);
  const [draft, setDraft] = React.useState(null);
  // A pending ownership review must remain inspectable here, while the shared
  // accessor withholds it from calculations until association is confirmed.
  const reviewSource = bha?.trajectoryMode === 'directional' && bha?.surveyState?.reviewRequired ? bha.surveyState.active : null;
  const source = hasSurveyAssociation(bha) ? reviewSource || active || empty : draft || active || empty;
  const [fileError, setFileError] = React.useState('');
  const request = React.useRef(0);
  const owner = React.useRef(null);
  owner.current = { id: bha?.id, association: bha?.surveyState, trajectoryMode: bha?.trajectoryMode };
  React.useEffect(() => { ++request.current; setDraft(null); setFileError(''); }, [bha?.id]);
  React.useEffect(() => () => { request.current += 1; }, [bha?.surveyState, bha?.trajectoryMode]);
  const setSource = value => {
    const next = typeof value === 'function' ? value(source) : value;
    try {
      archiveSurveys([source, bha?.surveyState?.active, next], bha);
      if (hasSurveyAssociation(bha)) {
        if (!updateBha) throw new Error('Survey association is read-only.');
        if (bha.trajectoryMode && next.kind === 'generated-vertical') updateBha(trajectorySelectionPatch('vertical'));
        else updateBha({ ...(bha.trajectoryMode ? trajectorySelectionPatch('directional') : {}),
          surveyState: { ...replaceSurvey(bha.surveyState, next),
          reviewRequired: Boolean(bha.surveyState?.reviewRequired && next.originalCsv === source.originalCsv && next.filename === source.filename) } });
      } else setDraft(next);
      setFileError('');
    } catch { setFileError('Survey replacement was not applied: unable to preserve its recovery copy in browser storage. Export or free browser storage and retry.'); }
  };
  const parsed = React.useMemo(() => source.originalCsv ? parseSurveyCsv(source.originalCsv, source.confirmed === true ? units : undefined) : null, [source.originalCsv, source.confirmed]);
  const geometry = React.useMemo(() => parsed?.valid ? calculateSurveyGeometry(parsed.stations) : null, [parsed]);
  const errors = [...(parsed?.errors || []), ...(geometry?.errors || [])];
  const upload = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const token = ++request.current;
    const startedFor = owner.current;
    setFileError('');
    if (file.size > 2 * 1024 * 1024) { setFileError('CSV must be 2 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (token === request.current && owner.current.id === startedFor.id && owner.current.association === startedFor.association && owner.current.trajectoryMode === startedFor.trajectoryMode) setSource({ originalCsv: String(reader.result), filename: file.name,
        confirmed: bha?.trajectoryMode === 'vertical' ? false : source.confirmed, kind: 'imported', origin: 'CSV import' });
    };
    reader.onerror = () => { if (token === request.current) setFileError('Unable to read the CSV file.'); };
    reader.readAsText(file);
  };
  const summary = geometry?.valid ? geometry.summary : null;
  return <section className="surveyPanel" aria-label="Survey import and validation">
    <ActiveSurvey bha={hasSurveyAssociation(bha) ? bha : { surveyState: { active: source } }} />
    <SurveyManagement bha={bha} source={source} geometry={geometry} updateBha={updateBha} onReplace={setSource} />
    <SurveyTrajectory geometry={geometry} workspaceId={bha?.id} key={bha?.id || 'global-survey'} />
    <section className="surveyInformation" aria-label="Survey information and import">
    <h6>Survey Information &amp; Import</h6>
    <p className="surveyNotice">Preliminary — survey geometry only; not operational guidance.</p>
    {summary && <><p role="status">Valid survey · {summary.stationCount} stations</p><dl className="surveySummary">
      <div><dt>MD coverage (ft)</dt><dd>{summary.startMdFt.toFixed(1)}–{summary.endMdFt.toFixed(1)}</dd></div>
      <div><dt>{summary.startMdFt ? 'Relative TVD (ft)' : 'TVD (ft)'}</dt><dd>{summary.tvdFt.toFixed(3)}</dd></div>
      <div><dt>Maximum inclination (°)</dt><dd>{summary.maxInclinationDeg.toFixed(2)}</dd></div>
      <div><dt>Maximum DLS (°/100 ft)</dt><dd>{summary.maxDlsDegPer100Ft.toFixed(3)}</dd></div>
    </dl></>}
    <label className="surveyUnits"><input type="checkbox" checked={source.confirmed === true} disabled={bha?.trajectoryMode === 'vertical'} onChange={event => setSource(current => ({ ...current, confirmed: event.target.checked }))} /> MD is in feet; inclination and azimuth are in degrees.</label>
    <label className="surveyUpload">Survey CSV <input type="file" accept=".csv,text/csv" onChange={upload} /></label>

    {source.filename && <p>Source: {source.filename}</p>}
    {/\b(tvd|northing|easting|north|east)\b/i.test(source.originalCsv.split(/\r?\n/)[0]) && <p role="status">Imported TVD/coordinate columns are retained in the original CSV but are not used by the existing MD/inclination/azimuth geometry model. Plots and the calculated table use minimum curvature relative to the first station; supplied datums and coordinates have not been reconciled.</p>}
    {fileError && <p role="alert">{fileError}</p>}
    {errors.length > 0 && <div role="alert"><strong>Survey validation failed</strong><ul>{errors.map((error, index) => <li key={index}>{error.message}</li>)}</ul></div>}
    {geometry?.warnings.map((warning, index) => <p role="status" key={index}>{warning}</p>)}
    {parsed?.rawStations.length > 0 && <div className="surveyTable"><table><caption>{source.kind === 'generated-vertical' ? 'Generated vertical stations' : 'Imported survey stations'} · MD ft / angles degrees</caption><thead><tr><th>Row</th><th>MD (ft)</th><th>Inclination (°)</th><th>Azimuth (°)</th>{summary && <><th>TVD (ft)</th><th>DLS (°/100 ft)</th></>}</tr></thead><tbody>{parsed.rawStations.map((station, index) => <tr key={index}><td>{station.sourceRow}</td><td>{station.mdFt}</td><td>{station.inclinationDeg}</td><td>{station.azimuthDeg}</td>{summary && <><td>{geometry.stations[index].tvdFt.toFixed(3)}</td><td>{geometry.stations[index].dlsDegPer100Ft.toFixed(3)}</td></>}</tr>)}</tbody></table></div>}
    <details><summary>Geometry assumptions</summary><p>Headers: MD, Inclination, Azimuth. Original imported values are retained.</p><p>Minimum-curvature arcs between survey stations. Coordinates are relative to the first station; no extrapolation, datum corrections or uncertainty model. Vertical azimuth is indeterminate. Antipodal tangents are unsupported. Survey management does not change engineering equations. Survey-based analyses use the active stations; the simplified inclination is only a constant-inclination reference.</p></details>
    </section>
  </section>;
}
