import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { calcJarClearanceAcrossRun } from '../../engineering/jar/jarClearanceAcrossRun';
import { importedGeometry, clearanceBounds, clearanceRequest, clearanceSummary, clearancePlot, selectedClearance, crossingDepthDescription, avoidanceDepthIntervals, comparisonClearances, comparisonPlot, sampledExposure, compressionDepthIntervals } from './clearanceData';
import './JarClearance.css';
import { curveKey, curveLabel, neutralPointChart } from './neutralPointChart';
import WobOperatingRanges from './WobOperatingRanges';
import CurrentDrillingSummary from './CurrentDrillingSummary';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { wobAnalysisInputs, validateWobAnalysis } from '../../engineering/bha/wobAnalysisInputs';
import { npInputContext, captureNpRequest, buildNpDiagnostics, downloadNpDiagnostics } from './npDiagnostics';

const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));
const fmt = (n, digits = 3) => n === null || n === undefined ? 'Unavailable' : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
const text = value => value === undefined || value === null ? '' : String(value);

export default function JarClearance({ bha, updateBha, drillingMode = 'slide', analysisBitMdFt, surfaceReferenceMdFt = 0, surveyCoverage }) {
  const [hiddenCurves, setHiddenCurves] = useState({});
  useEffect(() => { setHiddenCurves({}); }, [bha?.id]);
  const source = useActiveSurvey(bha);
  const trajectoryDescription = source?.kind === 'generated-vertical'
    ? 'Generated vertical fallback (0° inclination; not a measured survey).'
    : source?.originalCsv ? `Associated survey: ${source.filename || source.origin || 'unnamed survey'}.`
      : 'No confirmed survey or explicit vertical fallback is available.';
  const survey = useMemo(() => importedGeometry({ originalCsv: source?.originalCsv, confirmed: source?.confirmed }), [source?.originalCsv, source?.confirmed]);
  const initialBounds = useMemo(() => clearanceBounds(bha, survey, surfaceReferenceMdFt), [bha, survey, surfaceReferenceMdFt]);
  const [localSettings, setLocalSettings] = useState({});
  const settings = bha?.neutralPointAnalysis || localSettings;
  const sharedWob = wobAnalysisInputs(bha), wobError = validateWobAnalysis(sharedWob);
  const derivedDepth = analysisDepth(bha);
  const bitDepth = analysisBitMdFt === undefined ? (derivedDepth.valid ? derivedDepth.bitMdFt : '') : analysisBitMdFt;
  const fields = { start: text(initialBounds?.covered ? initialBounds.start : ''), end: text(bitDepth), increment: '100',
    modes: 'both', avoidance: text(initialBounds?.defaultAvoidance), ...settings,
    surface: text(surfaceReferenceMdFt), minWob: text(sharedWob.minWobKlbf), maxWob: text(sharedWob.maxWobKlbf), samples: text(sharedWob.samples),
    friction: text(bha?.frictionCoefficient) + (text(settings.friction).trim() ? `,${settings.friction}` : ''), mud: text(bha?.mudWeight), rpm: text(bha?.rpm), rop: text(bha?.rop) };
  const bounds = useMemo(() => clearanceBounds(bha, survey, fields.surface), [bha, survey, fields.surface]);
  const [friction, setFriction] = useState('');
  const compare = settings.view !== 'single';
  const [savedExecution, setExecution] = useState(null), [error, setError] = useState(null), [calculating, setCalculating] = useState(false);
  const generation = useRef(0), revision = useRef(0), activeWorker = useRef(null), pending = useRef([]);
  const [depth, setDepth] = useState(''), [scenarioIndex, setScenarioIndex] = useState('0');
  const [jarIndex, setJarIndex] = useState('0');
  const diagnosticRun = useRef(null);
  const [exportStatus, setExportStatus] = useState('');
  useEffect(() => { setFriction(text(bha?.frictionCoefficient)); }, [bha?.frictionCoefficient]);
  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    if (updateBha) updateBha({ neutralPointAnalysis: next }); else setLocalSettings(next);
  };
  const basePrepared = clearanceRequest(bha, survey, fields, compare);
  const prepared = wobError ? { valid: false, error: wobError } : String(bitDepth).trim() === '' || !Number.isFinite(Number(bitDepth)) || Number(bitDepth) <= 0
    ? { valid: false, error: 'Enter a valid deployed bit depth in BHA Data Entry.' } : basePrepared;
  // Exclude current drilling WOB and display metadata: neither changes the sweep.
  // Full survey geometry and deployed-component properties remain in the identity.
  const requestKey = JSON.stringify(prepared.valid ? { ...prepared.request, bha: { rows: bha?.rows, drillpipeReferenceBitMdFt: bha?.drillpipeReferenceBitMdFt }, compare, bitDepth, trajectoryMode: bha?.trajectoryMode } : { error: prepared.error, fields, bitDepth, trajectoryMode: bha?.trajectoryMode });
  const execution = savedExecution?.key === requestKey ? savedExecution : null;
  const calculate = () => {
    if (!prepared.valid) { setError({ key: requestKey, message: prepared.error }); return; }
    const token = ++generation.current;
    activeWorker.current?.terminate(); activeWorker.current = null;
    pending.current.forEach(clearTimeout); pending.current = [];
    setCalculating(true);
    const runDiagnostics = { key: requestKey, ownerId: bha?.id,
      capture: captureNpRequest(prepared.request, npInputContext(bha, source, survey, fields, drillingMode), typeof Worker !== 'undefined' ? 'worker' : 'main-thread-fallback'),
      state: 'running', response: null, error: null };
    diagnosticRun.current = runDiagnostics;
    const fail = message => {
      if (token !== generation.current) return;
      runDiagnostics.state = 'failed'; runDiagnostics.error = message;
      setError({ key: requestKey, message: `Run calculation unavailable: ${message}` }); setCalculating(false);
      activeWorker.current?.terminate(); activeWorker.current = null;
    };
    const publish = result => {
      if (token !== generation.current) return;
      runDiagnostics.response = result; runDiagnostics.state = 'completed';
      if (!result?.valid) { fail(result?.errors?.join(' ') || 'No valid solver response.'); return; }
      setExecution({ key: requestKey, result, request: prepared.request, compare, revision: ++revision.current, diagnostics: runDiagnostics });
      setFriction(previous => result.frictionCoefficients.includes(Number(previous)) && previous !== '' ? previous : String(result.frictionCoefficients[0]));
      setDepth(previous => result.depthsFt.includes(Number(previous)) ? previous : String(result.depthsFt[0])); setScenarioIndex('0'); setError(null);
      setJarIndex(previous => result.scenarios.find(s => s.valid)?.jars.some(j => j.jarIndex === Number(previous)) ? previous : '0');
      setCalculating(false); activeWorker.current?.terminate(); activeWorker.current = null;
    };
    try {
      if (typeof Worker !== 'undefined') {
        const worker = require('./createClearanceWorker').createClearanceWorker();
        activeWorker.current = worker;
        worker.onmessage = event => event.data.error ? fail(event.data.error) : publish(event.data.result);
        worker.onerror = event => fail(event.message || 'Background worker failed.');
        worker.postMessage({ request: prepared.request });
      } else publish(calcJarClearanceAcrossRun(prepared.request));
    } catch (e) { fail(e.message); }
  };
  useEffect(() => {
    generation.current += 1; setError(null); setCalculating(false);
    if (!prepared.valid) return;
    let work;
    const timer = setTimeout(() => {
      setCalculating(true);
      // Paint the indicator before starting a worker (or the non-worker fallback).
      work = setTimeout(calculate, 0);
      pending.current.push(work);
    }, 450);
    pending.current = [timer];
    return () => { generation.current += 1; clearTimeout(timer); clearTimeout(work); activeWorker.current?.terminate(); activeWorker.current = null; };
    // The serialized engineering request, not window resizing or current WOB, schedules runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);
  const run = event => { event.preventDefault(); calculate(); };
  const summary = useMemo(() => execution ? clearanceSummary(execution.result) : null, [execution]);
  const scenarios = useMemo(() => execution?.result.scenarios.filter(s => s.bitMdFt === Number(depth)) || [], [execution, depth]);
  const selected = scenarios[Number(scenarioIndex)];
  const series = useMemo(() => execution ? selectedClearance(execution.result, selected, Number(jarIndex)) : null, [execution, selected, jarIndex]);
  const comparison = useMemo(() => execution ? comparisonClearances(execution.result, execution.request, Number(friction), Number(jarIndex)) : [], [execution, friction, jarIndex]);
  const mainPlot = useMemo(() => execution ? (compare ? comparisonPlot(execution.result, execution.request, execution.revision, comparison, Number(jarIndex)) : clearancePlot(execution.result, execution.request.avoidanceDistanceFt, execution.revision, selected, Number(jarIndex))) : null, [execution, selected, jarIndex, compare, comparison]);
  const displayedPlot = useMemo(() => mainPlot ? neutralPointChart(mainPlot, execution.result, execution.request, compare ? hiddenCurves : {}, Number(jarIndex), compare ? comparison.map(s => s.selection) : [selected]) : null,
    [mainPlot, execution, hiddenCurves, jarIndex, compare, comparison, selected]);
  const avoidanceIntervals = useMemo(() => series ? avoidanceDepthIntervals(series.samples, fmt) : [], [series]);
  const jars = execution?.result.scenarios.find(s => s.valid)?.jars || [];
  const numeric = (key, label, extra = {}) => <label key={key}>{label}<input type="number" step="any" value={fields[key]} onChange={e => update(key, e.target.value)} {...extra} /></label>;
  const exportDiagnostics = () => {
    try {
      // A mismatched run is never exported with the new selection (or another BHA).
      const completed = execution?.diagnostics && execution.diagnostics.ownerId === bha?.id ? execution.diagnostics : null;
      const latest = diagnosticRun.current?.key === requestKey && diagnosticRun.current?.ownerId === bha?.id ? diagnosticRun.current : null;
      const run = completed || latest;
      const state = completed ? 'current' : run?.state || (savedExecution || diagnosticRun.current ? 'stale-results-excluded' : 'no-results');
      const diagnostics = buildNpDiagnostics({ current: npInputContext(bha, source, survey, fields, drillingMode),
        capture: run?.capture, response: completed ? execution.result : run?.response, state,
        error: prepared.valid ? run?.error || null : prepared.error,
        plot: completed ? displayedPlot : null, selections: completed ? (compare ? comparison.map(s => s.selection) : [selected]) : [],
        jarIndex: Number(jarIndex), compare, hiddenCurves: compare ? hiddenCurves : {} });
      const filename = downloadNpDiagnostics(diagnostics);
      setExportStatus(`Exported ${filename} (${state}).`);
    } catch (e) { setExportStatus(`NP diagnostics export failed: ${e.message}`); }
  };
  return <section className="jarClearance" aria-label="Neutral Point Behaviour">
    <h5>Neutral Point Behaviour</h5>
    <p className="jarClearanceGraphCaption" role="status">Trajectory input: {trajectoryDescription}</p>
    <section className="jarClearanceGraphArea" aria-label="Automatic neutral point analysis">
    {!survey.valid && <div role="alert">{survey.errors.map((e, i) => <p key={i}>{e.message}</p>)}</div>}
    {!prepared.valid && survey.valid && <p role="alert">{prepared.error}</p>}
    {error?.key === requestKey && <p role="alert">{error.message}</p>}
    {prepared.valid && !execution && !error && <p role="status">{calculating ? 'Calculating neutral point sweep…' : 'Updating neutral point sweep…'}</p>}
    {execution && compare && <div className="jarClearanceLegend" role="group" aria-label="Graph curve visibility">
      {mainPlot.data.filter(trace => trace.showlegend).map(trace => {
        const key = curveKey(trace);
        const label = curveLabel(trace);
        return <button key={key} type="button" aria-pressed={!hiddenCurves[key]} title={trace.name} onClick={() => setHiddenCurves(previous => ({ ...previous, [key]: !previous[key] }))}>
          <span className="jarClearanceLineKey" aria-hidden="true" style={{ borderColor: trace.marker.color, borderTopStyle: key.endsWith('rotate') ? 'dashed' : 'solid' }} /> {label}
        </button>;
      })}
      <button type="button" onClick={() => setHiddenCurves({})}>Show All Curves</button>
    </div>}
    {execution && <section className="jarClearanceGraph" aria-label="Depth-dependent neutral point graph">
      {execution.result.status === 'no-valid-scenarios' ? <p role="alert">No valid scenarios. Graph unavailable; inspect scenario errors in Advanced Analysis Settings.</p> : displayedPlot.empty ? <div className="jarClearanceEmpty" role="status">{Object.values(hiddenCurves).some(Boolean) ? 'No visible NP data. Enable a curve or select Show All Curves.' : 'No NP data available for these scenarios. Inspect Advanced Analysis Settings.'}</div> : <Suspense fallback={<p>Loading clearance graph...</p>}><Plot data={displayedPlot.data} layout={displayedPlot.layout} responsiveHeight /></Suspense>}
      {displayedPlot.threshold !== null && <p className="jarClearanceZoneLabel"><span aria-hidden="true" />NP Avoidance Zone (±{fmt(displayedPlot.threshold)} ft) <small>— user-defined screening tolerance</small></p>}
      <p className="jarClearanceGraphCaption">Bit MD sweep · {fmt(execution.request.minWobLbf / 1000)}–{fmt(execution.request.maxWobLbf / 1000)} klbf · {execution.request.wobSamples} WOB samples · positive: NP above jar; negative: NP below jar; zero: NP at jar.</p>
      <p className="jarClearanceGraphCaption">Sampled drilling conditions only — NP branches are not tracked. Missing NP means unavailable clearance, not safe. Not operational guidance.</p>
      <p className="jarClearanceGraphCaption">Line guides connect adjacent valid unique NP samples, including component crossings. Gaps mark missing, invalid or nonunique results. Open diamonds show nonunique zeros or neutral-interval endpoints. Flat sections can occur when the bit-to-NP string remains in a constant-inclination survey section.</p>
      {execution.result.invalidScenarios > 0 && <p role="alert">{execution.result.invalidScenarios} invalid scenario samples; inspect Advanced Analysis Settings for diagnostics.</p>}
      {summary.compression && <p className="jarClearanceNotice">Jar compression occurs in at least one analysed drilling scenario.</p>}
    </section>}
    </section>
    <CurrentDrillingSummary bha={bha} drillingMode={drillingMode} analysisBitMdFt={analysisBitMdFt} surfaceReferenceMdFt={surfaceReferenceMdFt} surveyCoverage={surveyCoverage} />
    <details className="jarClearanceAdvanced"><summary>Advanced Analysis Settings</summary>
    <button type="button" onClick={exportDiagnostics}>Export NP Diagnostics</button>
    <p>Downloads the selected analysis inputs and captured results, including hidden scenarios. Stale results are excluded and identified; exporting does not run a calculation.</p>
    {exportStatus && <p role="status">{exportStatus}</p>}
    <details><summary>Run model and coverage</summary>
    <p>Current BHA: {bha?.name || 'Unnamed'} · Survey: {source?.filename || 'not imported'}. Run settings are saved with this BHA; component lengths and survey data are unchanged.</p>
    <p>Results are based on sampled operating conditions and a preliminary soft-string model, not for operational use. Minimum clearance between samples may be smaller. Avoidance distance is a user-defined planning criterion, not a universal manufacturer limit.</p>
    {survey.valid && <p>{bounds?.deployed ? 'Deployed-string' : 'Complete-BHA'} bit MD coverage: {bounds?.covered ? `${fmt(bounds.start)}–${fmt(bounds.end)} ft` : 'No covered interval'}. No extrapolation.</p>}
    {bounds?.deployed && <p>Depth-dependent drillpipe deployment is active. Saved/manual pipe length is unchanged; coverage and loads use the actual deployed string.</p>}
    </details>
    <label>Graph view<select value={compare ? 'compare' : 'single'} onChange={e => update('view', e.target.value)}><option value="single">Single Scenario</option><option value="compare">Compare Four</option></select></label>
    <form onSubmit={run} noValidate><div className="jarClearanceFields">
      {bounds?.deployed && numeric('surface', 'Surface reference MD (ft)', { readOnly: true, min: 0 })}
      {numeric('start', 'Starting bit MD (ft)')}{numeric('end', 'Ending bit MD (ft)')}{numeric('increment', 'Depth increment (ft)', { min: 0 })}
      <p>WOB range and samples are controlled in Parameter Entry.</p>
      <label>Analysis modes<select value={fields.modes} onChange={e => update('modes', e.target.value)}><option value="slide">Slide</option><option value="rotate">Rotate</option><option value="both">Both</option></select></label>
      <label>Additional friction coefficients<input value={settings.friction ?? ''} placeholder="Optional: 0.30, 0.35" onChange={e => update('friction', e.target.value)} /></label>
      {numeric('avoidance', 'Avoidance distance (ft)', { min: 0 })}{numeric('mud', 'Mud weight (ppg)', { readOnly: true, min: 0 })}
      {(compare || fields.modes !== 'slide') && <>{numeric('rpm', 'BHA RPM', { readOnly: true, min: 0 })}{numeric('rop', 'ROP (ft/hr)', { readOnly: true, min: 0 })}</>}
    </div><button type="submit">Analyse run</button></form>
    {execution && <>
      <div className="jarClearanceFields">
        <label style={compare ? { display: 'none' } : undefined}>Displayed operating scenario<select value={scenarioIndex} onChange={e => setScenarioIndex(e.target.value)}>{scenarios.map((s, i) => <option value={i} key={i}>WOB {fmt(s.wobLbf / 1000)} klbf | {s.mode} | friction {s.frictionCoefficient}</option>)}</select></label>
        {compare && <label>Comparison friction coefficient<select value={friction} onChange={e => setFriction(e.target.value)}>{!execution.result.frictionCoefficients.includes(Number(friction)) && <option value={friction}>{friction} (not in this run)</option>}{execution.result.frictionCoefficients.map(mu => <option value={mu} key={mu}>{mu}</option>)}</select></label>}
        <label>Displayed jar<select value={jarIndex} onChange={e => setJarIndex(e.target.value)}>{jars.map(j => <option value={j.jarIndex} key={j.jarIndex}>{j.name} ({j.jarIndex + 1})</option>)}</select></label>
      </div>
      <WobOperatingRanges request={execution.request} depthsFt={execution.result.depthsFt} frictionCoefficient={compare ? Number(friction) : selected?.frictionCoefficient} jarIndex={Number(jarIndex)} revision={execution.revision} />
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
      <p>{compare ? 'Endpoint WOB scenarios at the selected friction coefficient and jar.' : 'Selected scenario and jar only.'} Straight segments guide the eye between adjacent valid unique NP samples, including component crossings; gaps mark missing, invalid or nonunique samples. Segments do not establish continuous physical NP branches or uniqueness between samples. Missing NP is unavailable clearance, not safe. Entry/exit brackets are sampled transitions, not exact boundary depths; unsampled excursions may occur. Jar axial-load sign-change brackets require refinement and do not specify exact NP crossing depths; crossings between WOB scenarios are excluded.</p>
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
    </details>
  </section>;
}
