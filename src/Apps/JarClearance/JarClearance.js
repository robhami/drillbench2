import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';
import { calcJarClearanceAcrossRun } from '../../engineering/jar/jarClearanceAcrossRun';
import { importedGeometry, clearanceBounds, clearanceRequest, clearanceSummary, clearancePlot, selectedClearance, crossingDepthDescription, avoidanceDepthIntervals, comparisonClearances, comparisonPlot, sampledExposure, compressionDepthIntervals } from './clearanceData';
import './JarClearance.css';

const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));
const readSource = () => { try { return JSON.parse(localStorage.getItem(SURVEY_STORAGE_KEY)); } catch { return null; } };
const fmt = (n, digits = 3) => n === null || n === undefined ? 'Unavailable' : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
const text = value => value === undefined || value === null ? '' : String(value);

export default function JarClearance({ bha }) {
  const [source, setSource] = useState(readSource);
  useEffect(() => {
    const changed = event => setSource(event.detail);
    const stored = event => { if (event.key === SURVEY_STORAGE_KEY || event.key === null) setSource(readSource()); };
    window.addEventListener(SURVEY_CHANGED_EVENT, changed); window.addEventListener('storage', stored);
    return () => { window.removeEventListener(SURVEY_CHANGED_EVENT, changed); window.removeEventListener('storage', stored); };
  }, []);
  const survey = useMemo(() => importedGeometry({ originalCsv: source?.originalCsv, confirmed: source?.confirmed }), [source?.originalCsv, source?.confirmed]);
  const initialBounds = useMemo(() => clearanceBounds(bha, survey), [bha, survey]);
  const [fields, setFields] = useState(() => ({ surface: '0', start: text(initialBounds?.covered ? initialBounds.start : ''), end: text(initialBounds?.covered ? initialBounds.end : ''), increment: '100', minWob: text(bha?.wob), maxWob: text(bha?.wob), samples: '5', modes: 'slide', friction: text(bha?.frictionCoefficient), avoidance: text(initialBounds?.defaultAvoidance), mud: text(bha?.mudWeight), rpm: text(bha?.rpm), rop: text(bha?.rop) }));
  const bounds = useMemo(() => clearanceBounds(bha, survey, fields.surface), [bha, survey, fields.surface]);
  const [view, setView] = useState(null), [friction, setFriction] = useState('');
  const compare = view === null ? Number(fields.minWob) !== Number(fields.maxWob) : view === 'compare';
  const [execution, setExecution] = useState(null), [error, setError] = useState(null);
  const [depth, setDepth] = useState(''), [scenarioIndex, setScenarioIndex] = useState('0');
  const [jarIndex, setJarIndex] = useState('0');
  useEffect(() => {
    setExecution(null); setError(null);
    if (initialBounds?.covered) setFields(f => ({ ...f, start: f.start || text(initialBounds.start), end: f.end || text(initialBounds.end), avoidance: f.avoidance || text(initialBounds.defaultAvoidance) }));
  }, [bha, survey, initialBounds]);
  const update = (key, value) => { setFields(f => ({ ...f, [key]: value })); setError(null); };
  const prepared = useMemo(() => clearanceRequest(bha, survey, fields, compare), [bha, survey, fields, compare]);
  const run = event => {
    event.preventDefault();
    if (!prepared.valid) { setError(prepared.error); return; }
    const result = calcJarClearanceAcrossRun(prepared.request);
    if (!result.valid) { setError(result.errors.join(' ')); return; }
    setExecution({ result, request: prepared.request, fields: { ...fields }, compare, revision: (execution?.revision || 0) + 1 });
    setFriction(previous => previous || String(result.frictionCoefficients[0])); setDepth(String(result.depthsFt[0])); setScenarioIndex('0'); setJarIndex('0'); setError(null);
  };
  const summary = useMemo(() => execution ? clearanceSummary(execution.result) : null, [execution]);
  const scenarios = useMemo(() => execution?.result.scenarios.filter(s => s.bitMdFt === Number(depth)) || [], [execution, depth]);
  const selected = scenarios[Number(scenarioIndex)];
  const series = useMemo(() => execution ? selectedClearance(execution.result, selected, Number(jarIndex)) : null, [execution, selected, jarIndex]);
  const comparison = useMemo(() => execution ? comparisonClearances(execution.result, execution.request, Number(friction), Number(jarIndex)) : [], [execution, friction, jarIndex]);
  const mainPlot = useMemo(() => execution ? (compare ? comparisonPlot(execution.result, execution.request, execution.revision, comparison, Number(jarIndex)) : clearancePlot(execution.result, execution.request.avoidanceDistanceFt, execution.revision, selected, Number(jarIndex))) : null, [execution, selected, jarIndex, compare, comparison]);
  const avoidanceIntervals = useMemo(() => series ? avoidanceDepthIntervals(series.samples, fmt) : [], [series]);
  const jars = execution?.result.scenarios.find(s => s.valid)?.jars || [];
  const stale = execution && (JSON.stringify(fields) !== JSON.stringify(execution.fields) || (compare && !execution.compare));
  const numeric = (key, label, extra = {}) => <label key={key}>{label}<input type="number" step="any" value={fields[key]} onChange={e => update(key, e.target.value)} {...extra} /></label>;
  return <section className="jarClearance" aria-label="Jar Clearance Across Run">
    <h5>Jar Clearance Across Run</h5>
    <p className="jarClearanceNotice">Results are based on sampled operating conditions and a preliminary soft-string model, not for operational use. Minimum clearance between samples may be smaller. Avoidance distance is a user-defined planning criterion, not a universal manufacturer limit.</p>
    <p>Current BHA: {bha?.name || 'Unnamed'} · Survey: {source?.filename || 'not imported'}. Analysis inputs below do not change saved BHA or survey data.</p>
    {!survey.valid && <div role="alert">{survey.errors.map((e, i) => <p key={i}>{e.message}</p>)}</div>}
    {survey.valid && <p>{bounds?.deployed ? 'Deployed-string' : 'Complete-BHA'} bit MD coverage: {bounds?.covered ? `${fmt(bounds.start)}–${fmt(bounds.end)} ft` : 'No covered interval'}. No extrapolation.</p>}
    {bounds?.deployed && <p>Depth-dependent drillpipe deployment is active. Saved/manual pipe length is unchanged; coverage and loads use the actual deployed string.</p>}
    <label>Graph view<select value={compare ? 'compare' : 'single'} onChange={e => setView(e.target.value)}><option value="single">Single Scenario</option><option value="compare">Compare Four</option></select></label>
    <form onSubmit={run} noValidate><div className="jarClearanceFields">
      {bounds?.deployed && numeric('surface', 'Surface reference MD (ft)', { min: 0 })}
      {numeric('start', 'Starting bit MD (ft)')}{numeric('end', 'Ending bit MD (ft)')}{numeric('increment', 'Depth increment (ft)', { min: 0 })}
      {numeric('minWob', 'Minimum WOB (klbf)', { min: 0 })}{numeric('maxWob', 'Maximum WOB (klbf)', { min: 0 })}{numeric('samples', 'WOB samples', { min: 1, step: 1 })}
      <label>Analysis modes<select value={fields.modes} onChange={e => update('modes', e.target.value)}><option value="slide">Slide</option><option value="rotate">Rotate</option><option value="both">Both</option></select></label>
      <label>Friction coefficients<input value={fields.friction} placeholder="0.25, 0.30" onChange={e => update('friction', e.target.value)} /></label>
      {numeric('avoidance', 'Avoidance distance (ft)', { min: 0 })}{numeric('mud', 'Mud weight (ppg)', { min: 0 })}
      {(compare || fields.modes !== 'slide') && <>{numeric('rpm', 'BHA RPM', { min: 0 })}{numeric('rop', 'ROP (ft/hr)', { min: 0 })}</>}
    </div><button type="submit">Analyse run</button></form>
    {!prepared.valid && survey.valid && <p role="status">{prepared.error}</p>}
    {error && <p role="alert">{error}</p>}
    {stale && <p role="status">Inputs changed. Results show the previous run; select Analyse run to update.</p>}
    {execution && <>
      <div className="jarClearanceFields">
        <label style={compare ? { display: 'none' } : undefined}>Displayed operating scenario<select value={scenarioIndex} onChange={e => setScenarioIndex(e.target.value)}>{scenarios.map((s, i) => <option value={i} key={i}>WOB {fmt(s.wobLbf / 1000)} klbf | {s.mode} | friction {s.frictionCoefficient}</option>)}</select></label>
        {compare && <label>Comparison friction coefficient<select value={friction} onChange={e => setFriction(e.target.value)}>{!execution.result.frictionCoefficients.includes(Number(friction)) && <option value={friction}>{friction} (not in this run)</option>}{execution.result.frictionCoefficients.map(mu => <option value={mu} key={mu}>{mu}</option>)}</select></label>}
        <label>Displayed jar<select value={jarIndex} onChange={e => setJarIndex(e.target.value)}>{jars.map(j => <option value={j.jarIndex} key={j.jarIndex}>{j.name} ({j.jarIndex + 1})</option>)}</select></label>
      </div>
      <Suspense fallback={<p>Loading clearance graph...</p>}><Plot {...mainPlot} /></Suspense>
      {compare && <>
        {execution.request.minWobLbf === execution.request.maxWobLbf && <p>Minimum and maximum WOB are equal; two distinct mode traces replace four duplicate traces.</p>}
        <div className="jarClearanceTable"><table aria-label="Scenario comparison"><thead><tr>{['WOB and mode', 'NP/jar coincidence / load sign-change bracket (bit MD)', 'Danger-zone entry/exit MD', 'Estimated danger-zone footage', 'Jar compression intervals'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{comparison.map(s => {
          const exposure = sampledExposure(s.samples);
          return <tr key={s.name}><td style={{ color: s.color }}>{s.name} | friction {s.selection.frictionCoefficient}{s.unavailable > 0 && <div role="status">{s.unavailable} unavailable NP/jar samples; inspect diagnostics</div>}{s.missing > 0 && <div role="alert">{s.missing} scenario samples missing; rerun in Compare Four</div>}{s.errors.length > 0 && <div role="alert">Scenario failed: {s.errors.join(' ')}</div>}</td><td>{s.events.map(e => crossingDepthDescription(e, fmt)).join('; ') || 'None detected'}</td><td>{avoidanceDepthIntervals(s.samples, fmt).map(i => i.entry + '. ' + i.exit).join('; ') || 'None detected'}</td><td>{fmt(exposure.estimatedFt)} ft (sample-based estimate; unsampled excursions and transition depths uncertain){exposure.unresolvedFt > 0 && '; ' + fmt(exposure.unresolvedFt) + ' ft unresolved'}</td><td>{compressionDepthIntervals(s.samples, fmt).join('; ') || 'None sampled'}</td></tr>;
        })}</tbody></table></div>
      </>}
      {!compare && <dl className="jarClearanceSummary">
        <div><dt>Closest sampled NP clearance</dt><dd>{series.closest ? fmt(series.closest.jar.absoluteSeparationFt) + ' ft at bit MD ' + fmt(series.closest.bitMdFt) + ' ft' : 'No valid clearance'}</dd></div>
        <div><dt>NP/jar coincidences and load sign changes</dt><dd>{series.events.filter(e => e.kind.startsWith('sampled')).length} sampled coincidences / {series.events.filter(e => e.kind.startsWith('inferred')).length} inferred jar axial-load sign-change brackets</dd></div>
        <div><dt>Coincidence depths / load sign-change brackets (bit MD)</dt><dd>{series.events.length ? series.events.map((event, index) => <div key={index}>{crossingDepthDescription(event, fmt)}</div>) : 'None detected in selected samples'}</dd></div>
        <div><dt>Avoidance-zone entry / exit (bit MD)</dt><dd>{avoidanceIntervals.length ? avoidanceIntervals.map((interval, index) => <div key={index}>{interval.entry}. {interval.exit}.</div>) : 'No inside-zone samples detected'}</dd></div>
        <div><dt>Unavailable depth samples</dt><dd>{series.unavailable} / {series.samples.length}</dd></div>
      </dl>}
      <p>Positive: NP above jar. Negative: NP below jar. Zero: NP at jar. Shading: +/-{fmt(execution.request.avoidanceDistanceFt)} ft avoidance zone.</p>
      <p>{compare ? 'Endpoint WOB scenarios at the selected friction coefficient and jar.' : 'Selected scenario and jar only.'} Samples are not joined because continuous NP branches are not identified. Missing NP is unavailable clearance, not safe. Entry/exit brackets are sampled transitions, not exact boundary depths; unsampled excursions may occur. Jar axial-load sign-change brackets require refinement and do not specify exact NP crossing depths; crossings between WOB scenarios are excluded.</p>
      {execution.result.status === 'no-valid-scenarios' && <p role="alert">No valid scenarios. Inspect scenario errors below.</p>}
      <details><summary>Sample details and run audit</summary>
      <p>All scenarios: {summary.evaluated} evaluated / {summary.invalid} invalid; {summary.violations} within avoidance zone.</p>
      {summary.compression && <p role="alert">Jar compression occurs in at least one analysed scenario.</p>}
      <div className="jarClearanceFields">
        <label>Inspect bit MD (ft)<select value={depth} onChange={e => { setDepth(e.target.value); }}>{execution.result.depthsFt.map(d => <option value={d} key={d}>{fmt(d)}</option>)}</select></label>
      </div>
      {selected && <>
        {selected.deployment?.mode === 'depth-dependent' && <p>Deployed drillpipe: {fmt(selected.deployment.deployedDpLengthFt)} ft · Fixed lower string: {fmt(selected.deployment.fixedLengthFt)} ft · Surface MD: {fmt(selected.deployment.surfaceMdFt)} ft.</p>}
        <p>Selected bit MD {fmt(selected.bitMdFt)} ft · WOB {fmt(selected.wobLbf / 1000)} klbf · {selected.mode} · μ {selected.frictionCoefficient}</p>
        {!selected.valid && <div role="alert">{selected.errors.join(' ')}</div>}
        {selected.valid && <>
          <p>Neutral points (ft above bit / MD): {selected.neutralPoints.length ? selected.neutralPoints.map(n => `${fmt(n.fromBitFt)} / ${fmt(n.mdFt)}`).join('; ') : 'None'}. {selected.neutralIntervals.length > 0 && `Nonunique neutral intervals above bit: ${selected.neutralIntervals.map(n => `${fmt(n.startFromBit)}–${fmt(n.endFromBit)} ft`).join('; ')}`}</p>
          <div className="jarClearanceTable"><table><thead><tr>{['Jar', 'Jar MD (ft)', 'Above bit (ft)', 'Load (lbf)', 'State', 'Nearest NP above bit / MD (ft)', 'Engine separation: positive NP below jar (ft)', 'Absolute clearance (ft)', 'Avoidance status'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{selected.jars.map(j => <tr key={j.jarIndex}><td>{j.name}</td><td>{fmt(j.jarMdFt)}</td><td>{fmt(j.jarFromBitFt)}</td><td>{fmt(j.jarAxialLoadLbf)}</td><td>{j.jarLoadState}</td><td>{j.nearestNeutral ? `${fmt(j.nearestNeutral.fromBitFt)} / ${fmt(j.nearestNeutral.mdFt)}${j.nearestNeutral.kind === 'interval' ? ' (interval projection; not unique)' : ''}` : 'None within BHA'}</td><td>{fmt(j.signedSeparationFt)}</td><td>{fmt(j.absoluteSeparationFt)}</td><td>{j.avoidanceStatus}</td></tr>)}</tbody></table></div>
        </>}
        <details><summary>Selected scenario warnings and crossing audit</summary><ul>{selected.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          {execution.result.crossingEvents.map((e, i) => <p key={i}>{e.kind} · {e.jarName} · {e.kind === 'inferred-between-depth-samples' ? crossingDepthDescription(e, fmt) : `MD ${fmt(e.bitMdFt ?? e.approximateBitMdFt)} ft`} · WOB {fmt((e.wobLbf ?? e.approximateWobLbf) / 1000)} klbf · {e.mode}{e.refinementRequired && ' · refinement required'}</p>)}
        </details>
      </>}
      </details>
    </>}
  </section>;
}
