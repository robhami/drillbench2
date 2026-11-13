import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { configurationGeometry } from './configurationData';
import { matrixDefaults, MATRIX_METRICS, MATRIX_MODES, matrixPercent } from '../../engineering/jar/jarPositionMatrix';
import { positionMatrixPlot, upperCollarPlot } from './positionMatrixPresentation';
import { samplePrimaryForceHistory, primaryForcePlot } from '../JarPlacement/primaryForceHistory';
import './JarConfiguration.css';
import { labelDemoPlot, DEMO_MOTOR_NOTICE } from './demoMotorCollar';
const Plot = lazy(() => import('./ConfigurationPlot'));
const LegacyResearch = lazy(() => import('./LegacyJarConfigurationResearch'));
const fmt = (n, digits = 2) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : 'Unavailable';
const percent = n => Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${fmt(n)}%` : 'Unavailable';

export default function JarPositionMatrix({ bha, demo = null }) {
  const geometry = useMemo(() => demo ? demo.geometry : configurationGeometry(bha), [bha, demo]);
  const defaults = () => ({ ...matrixDefaults(geometry), ...(demo ? { mode: 'C' } : {}) });
  const [fields, setFields] = useState(defaults);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [metric, setMetric] = useState('peak'), [snapshot, setSnapshot] = useState(null);
  const [request, setRequest] = useState(null), [selection, setSelection] = useState('baseline');
  const [notice, setNotice] = useState('Choose a study and run analysis.');
  const [cumulative, setCumulative] = useState(false), [legacy, setLegacy] = useState(false), [epoch, setEpoch] = useState(0);
  const sequence = useRef(0), workerRef = useRef(null), previousBha = useRef(bha), previousValid = useRef(geometry.valid), previousGeometry = useRef(geometry);
  const key = JSON.stringify({ bha, fields, ...(demo ? { demoGeometry: geometry } : {}) });
  const result = snapshot?.bha === bha && snapshot.key === key ? snapshot.result : null;
  const pending = Boolean(request && request.key === key);
  const clear = message => {
    sequence.current += 1; workerRef.current?.terminate(); workerRef.current = null;
    setRequest(null); setSnapshot(null); setSelection('baseline'); setMatrixOpen(false); setNotice(message);
  };
  useEffect(() => {
    if (previousBha.current !== bha || (demo && previousGeometry.current !== geometry)) {
      const old = previousBha.current, wasValid = previousValid.current; previousBha.current = bha; previousValid.current = geometry.valid;
      previousGeometry.current = geometry;
      sequence.current += 1; workerRef.current?.terminate(); workerRef.current = null;
      setRequest(null); setSnapshot(null); setSelection('baseline'); setNotice('BHA changed — run analysis again.');
      if (old?.id !== bha?.id) setFields({ ...matrixDefaults(geometry), ...(demo ? { mode: 'C' } : {}) });
      else if (!wasValid && geometry.valid) {
        const defaults = matrixDefaults(geometry);
        setFields(previous => ({ ...previous, ...Object.fromEntries(['aMin', 'aMax', 'bMin', 'bMax', 'c1Min', 'c1Max', 'c2Min', 'c2Max'].map(name => [name, previous[name] === '' ? defaults[name] : previous[name]])) }));
      }
    }
  }, [bha, geometry, demo]);
  useEffect(() => {
    if (!request || request.key !== key) return undefined;
    let active = true, worker;
    (async () => { try {
      const factory = await import('./createJarPositionMatrixWorker');
      if (!active || request.id !== sequence.current) return;
      worker = factory.createJarPositionMatrixWorker(); workerRef.current = worker;
      worker.onmessage = event => {
        if (!active || request.id !== sequence.current) return;
        setRequest(null);
        if (event.data.valid) { setSnapshot({ key: request.key, bha: request.bha, result: event.data }); setNotice('Analysis calculated. Click a sample to inspect its force history.'); }
        else { setSnapshot(null); setNotice(`Analysis unavailable: ${event.data.error}`); }
      };
      worker.onerror = event => { event?.preventDefault?.(); if (active && request.id === sequence.current) { setRequest(null); setSnapshot(null); setNotice('Calculation failed; no results are available.'); } };
      worker.postMessage({ geometry: request.geometry, fields: request.fields });
    } catch (error) { if (active && request.id === sequence.current) { setRequest(null); setNotice(`Calculation unavailable: ${error.message}`); } } })();
    return () => { active = false; worker?.terminate(); if (workerRef.current === worker) workerRef.current = null; };
  }, [request, key]);
  const update = (name, value) => { clear('Inputs changed — previous results cleared. Run analysis again.'); setFields(previous => ({ ...previous, [name]: value })); };
  function run(event) {
    event.preventDefault(); if (pending || !geometry.valid) return;
    clear('Calculating configuration matrix…');
    setRequest({ id: sequence.current, key, bha, geometry, fields: { ...fields } });
  }
  function reset() {
    clear('Choose a study and run analysis.'); setFields({ ...matrixDefaults(geometry), mode: demo ? 'C' : fields.mode === 'B' ? 'B' : 'A' }); setMetric('peak');
    setCumulative(false); setLegacy(false); setEpoch(value => value + 1);
  }
  const selected = result ? selection === 'baseline' ? result.actual : result.samples[Number(selection)] : null;
  const matrix = useMemo(() => labelDemoPlot(result ? positionMatrixPlot(result, metric, selected) : null, demo), [result, metric, selected, demo]);
  const upper = useMemo(() => labelDemoPlot(result && fields.mode === 'B' ? upperCollarPlot(result, metric, selected) : null, demo), [result, fields.mode, metric, selected, demo]);
  const history = useMemo(() => selected?.valid ? samplePrimaryForceHistory(selected.solverResult) : null, [selected]);
  const force = useMemo(() => labelDemoPlot(history?.valid ? primaryForcePlot(history, cumulative) : null, demo), [history, cumulative, demo]);
  const choose = event => { const index = event.points?.[0]?.customdata?.[0]; if (index !== undefined) setSelection(String(index)); };
  const number = (name, label, attributes = {}) => <label key={name}>{label}<input type="number" step="any" value={fields[name]} onChange={event => update(name, event.target.value)} {...attributes} /></label>;
  return <section className="jarConfiguration jarMatrix" aria-label="Jar Position Analysis">
    {demo && <p role="alert" className="jarConfigurationNotice"><strong>{DEMO_MOTOR_NOTICE}</strong> · All baselines and outputs below describe the temporary surrogate, not validated motor dynamics.</p>}
    <p className="jarConfigurationNotice"><strong>PRELIMINARY — NOT FOR OPERATIONAL USE</strong> · Idealised Skeem Jar Up analysis.</p>
    {fields.mode === 'B' && <h3>Upper Collar Length Analysis — Fixed L1</h3>}
    <form onSubmit={run} noValidate>
      <label className="matrixStudy">Study mode<select value={fields.mode} onChange={event => update('mode', event.target.value)}>{Object.entries(MATRIX_MODES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <div className="jarConfigurationFields matrixRanges">
        {fields.mode === 'A' ? <>{number('aMin', 'Minimum L1 (ft)')}{number('aMax', 'Maximum L1 (ft)')}</> : fields.mode === 'B' ? <><label>Fixed L1 (ft)<input type="number" readOnly value={geometry.valid ? geometry.l1Ft : ''} /></label>{number('bMin', 'Minimum L2 (ft)')}{number('bMax', 'Maximum L2 (ft)')}</> : <>
          {number('c1Min', 'Minimum L1 (ft)')}{number('c1Max', 'Maximum L1 (ft)')}{number('c2Min', 'Minimum L2 (ft)')}{number('c2Max', 'Maximum L2 (ft)')}</>}
        {fields.mode !== 'A' && <label className="matrixPolicy">Upper-collar change<select value={fields.policy} onChange={event => update('policy', event.target.value)}><option value="replace-pipe">Replace free pipe — fixed string length</option><option value="extend-string">Extend string — fixed pipe length</option></select></label>}
      </div>
      <div className="matrixActions"><button type="submit" disabled={pending || !geometry.valid}>Run Analysis</button><button type="button" onClick={reset}>Reset</button>{pending && <button type="button" onClick={() => clear('Calculation cancelled. Run analysis when ready.')}>Cancel analysis</button>}</div>
    </form>
    <p className="matrixConstraint">{fields.mode === 'A' ? `Fixed-inventory path: L2 = ${fmt(geometry.relocation?.collarInventoryFt)} − L1; jar body excluded. L3 fixed. Joint-level assembly unverified.` : fields.mode === 'B' ? `Fixed L1: ${fmt(geometry.l1Ft)} ft. Upper-collar changes are hypothetical.` : 'Independent upward/add-collar region. Additional collars, reassembly and deployment are hypothetical.'} Overpull {fields.overpull || '—'} klbf; stroke {fields.stroke || '—'} in.</p>
    {fields.mode !== 'A' && <p className="matrixConstraint">{fields.policy === 'replace-pipe' ? 'Collars replace free pipe; modeled string length stays fixed.' : 'Free pipe stays fixed; modeled string length changes.'}</p>}
    {!geometry.valid && <p role="alert">Jar Position Analysis unavailable: {geometry.error} This does not invalidate the BHA for Hookload or Neutral Point calculations.</p>}
    <p role="status" className="matrixStatus">{notice}</p>
    <label className="jarPositionMetric">Metric<select value={metric} onChange={event => setMetric(event.target.value)}>{Object.entries(MATRIX_METRICS).filter(([id]) => fields.mode !== 'B' || ['peak', 'impulse', metric].includes(id)).map(([id, info]) => <option key={id} value={id}>{info.label} ({info.unit})</option>)}</select></label>
    {result ? <>
      <p className="matrixCounts">{result.validCount} valid · {result.invalidCount} invalid ({result.unsupportedCount} unsupported geometry). Blank locations are not proposed configurations.</p>
      <div className={`matrixWorkspace ${upper ? 'upperCollarWorkspace' : ''}`}>
        <div className="matrixOverview"><div className="matrixLegend" aria-label="Matrix legend"><span>{upper ? '— Sampled response' : '■ Samples (colour = metric)'}</span><span style={{ color: '#d97706' }}>◆ Highest sampled</span><span style={{ color: '#dc2626' }}>✚ {demo ? 'Demo surrogate baseline' : 'Current BHA'}</span><span>○ Selected</span>{result.invalidCount > 0 && <span>Invalid candidates are gaps; no interpolated response</span>}</div><Suspense fallback={<p>Loading response graph...</p>}><Plot {...(upper || matrix)} plotHeight={upper ? 380 : 340} onClick={choose} /></Suspense>
          {upper && <p>Current L2: {fmt(result.actual.l2Ft)} ft. Lines connect sampled values only; no intervening configuration is calculated.</p>}
          {demo && <p><strong>DEMO surrogate baseline — not the actual motor's dynamic response.</strong></p>}
          <dl className="jarConfigurationMaxima matrixResults">
            <div><dt>{demo ? 'Demo surrogate' : 'Current BHA'} peak stuck-point force</dt><dd>{fmt(result.actual.peakStuckPointForceKlbf)} klbf</dd></div><div><dt>{demo ? 'Demo surrogate' : 'Current BHA'} primary impulse</dt><dd>{fmt(result.actual.impulseLbfS, 1)} lbf·s</dd></div>
            {['peak', 'impulse'].map(name => { const best = result.maxima[name], info = MATRIX_METRICS[name]; return <div key={name}><dt>Highest sampled {name === 'peak' ? 'peak force' : 'primary impulse'}</dt><dd>{best ? <><strong>{fmt(best[info.field], name === 'peak' ? 2 : 1)} {info.unit}</strong><span>{!upper && <>L1 {fmt(best.l1Ft)} / </>}L2 {fmt(best.l2Ft)} ft · {percent(matrixPercent(best[info.field], result.actual[info.field]))} vs current</span></> : 'No valid candidates'}</dd></div>; })}
          </dl><p className="matrixQualification">Highest sampled values are not effectiveness scores or placement recommendations. {result.mode === 'A' ? 'Continuous-inventory geometry only.' : 'Changed inventory is hypothetical.'}</p>
        </div>
        <section className="matrixSelected" aria-label="Selected configuration details">
          <label>Selected configuration<select value={selection} onChange={event => setSelection(event.target.value)}><option value="baseline">{demo ? 'Demo surrogate baseline' : 'Current BHA baseline'}</option>{result.samples.map(s => <option key={s.index} value={String(s.index)}>L1 {fmt(s.l1Ft)} / L2 {fmt(s.l2Ft)} ft{s.valid ? '' : ' — invalid'}</option>)}</select></label>
          {selected && <>
            <p className="matrixFeasibility">{demo ? selected.feasibility.replace('Actual BHA geometry', 'Demo surrogate geometry') : selected.feasibility}</p><p>L1 / L2 / L3: {fmt(selected.l1Ft)} / {fmt(selected.l2Ft)} / {fmt(selected.l3Ft)} ft. Collars {fmt(selected.totalCollarLengthFt)} ft; modeled string {fmt(selected.totalStringLengthFt)} ft.</p>
            {upper && <p>Upper collar footage change: {fmt(selected.l2Ft - result.actual.l2Ft)} ft vs current BHA. Selected {MATRIX_METRICS[metric].label}: {percent(matrixPercent(selected[MATRIX_METRICS[metric].field], result.actual[MATRIX_METRICS[metric].field]))} vs current.</p>}
            <p>Additional collars: {fmt(selected.additionalCollarLengthFt)} ft; removed collars: {fmt(selected.removedCollarLengthFt)} ft. Pipe change: {fmt(selected.pipeLengthChangeFt)} ft.</p>
            {selected.demoAccounting && <p className="demoCandidateAccounting">Fixed motor: {fmt(selected.demoAccounting.motorWeightLbf, 4)} lbf / {fmt(selected.demoAccounting.motorLengthFt, 5)} ft. Actual DC below/above jar: {fmt(selected.demoAccounting.physicalLowerCollarFt)} / {fmt(selected.demoAccounting.physicalUpperCollarFt)} ft; DC air weight {fmt(selected.demoAccounting.physicalCollarAirWeightLbf)} lbf. Candidate uniform surrogate: {fmt(selected.demoAccounting.uniformAirWeightPerFootLbf, 8)} lbf/ft. Source bit MD {fmt(selected.demoAccounting.sourceBitMdFt)} ft; candidate bit MD {fmt(selected.demoAccounting.impliedBitMdFt)} ft; jar MD {fmt(selected.demoAccounting.jarMdFt)} ft. {selected.demoAccounting.deployment}</p>}
            {!selected.valid ? <p role="alert">No force-time history: {selected.error}</p> : <>
              <dl className="jarConfigurationMaxima matrixResults"><div><dt>Selected peak stuck-point force</dt><dd>{fmt(selected.peakStuckPointForceKlbf)} klbf · {percent(matrixPercent(selected.peakStuckPointForceKlbf, result.actual.peakStuckPointForceKlbf))}</dd></div><div><dt>Selected primary impulse</dt><dd>{fmt(selected.impulseLbfS, 1)} lbf·s · {percent(matrixPercent(selected.impulseLbfS, result.actual.impulseLbfS))}</dd></div></dl>
              {upper ? <><p>Impact velocity {fmt(selected.impactVelocityFtS, 3)} ft/s; Incident FI {fmt(selected.impactForceKlbf)} klbf; Average stuck-point force {fmt(selected.averageStuckPointForceKlbf)} klbf.</p><details className="upperCollarHistory"><summary>Selected force-time history</summary>{force ? <Suspense fallback={<p>Loading primary force history…</p>}><Plot {...force} plotHeight={280} /></Suspense> : <p role="alert">{history?.error}</p>}
              <p>Time zero: first stuck-point wave arrival. Positive tensile reaction magnitude; primary interval only.</p></details></> : <>{force ? <Suspense fallback={<p>Loading primary force history…</p>}><Plot {...force} plotHeight={280} /></Suspense> : <p role="alert">{history?.error}</p>}
              <p>Time zero: first stuck-point wave arrival. Positive tensile reaction magnitude; primary interval only.</p></>}
            </>}
            <details><summary>Selected geometry, weights and solver provenance</summary><p>Incident FI {fmt(selected.impactForceKlbf)} klbf; average stuck force {fmt(selected.averageStuckPointForceKlbf)} klbf; velocity {fmt(selected.impactVelocityFtS, 3)} ft/s.</p><p>Collar/pipe transition {fmt(selected.transitionAboveBitFt)} ft above bit; jar centre {fmt(selected.jarCentreAboveBitFt)} ft above bit.</p><p>Lower / upper / total collar air weight: {fmt(selected.lowerCollarAirWeightLbf)} / {fmt(selected.upperCollarAirWeightLbf)} / {fmt(selected.collarAirWeightLbf)} lbf. Pipe air weight {fmt(selected.pipeAirWeightLbf)} lbf; modeled string air weight {fmt(selected.totalAirWeightLbf)} lbf. Missing nominal weights are not inferred.</p>{history?.valid && <p>Sampler integral {fmt(history.numericalImpulseLbfS, 6)} lbf·s; solver integral {fmt(selected.impulseLbfS, 6)} lbf·s.</p>}</details>
          </>}
        </section>
      </div>
    </> : <div className="matrixEmpty" aria-label="Configuration matrix area">{pending ? 'Calculating candidate geometries and wave responses…' : 'Run Analysis to display sampled responses and select a force-time history.'}</div>}
    {upper && <details className="upperCollarAdvancedAnalysis" open={matrixOpen} onToggle={event => setMatrixOpen(event.currentTarget.open)}><summary>Advanced Analysis — full L1/L2 matrix</summary><p>Fixed-L1 samples shown in matrix coordinates for advanced inspection.</p>{matrixOpen && <Suspense fallback={<p>Loading matrix...</p>}><Plot {...matrix} plotHeight={340} onClick={choose} /></Suspense>}</details>}
    <details className="matrixAdvanced" key={epoch}><summary>{fields.mode === 'B' ? 'Engineering Details' : 'Advanced Settings'}</summary>
      {fields.mode === 'B' && <label>Engineering response metric<select value={metric} onChange={event => setMetric(event.target.value)}>{Object.entries(MATRIX_METRICS).map(([id, info]) => <option key={id} value={id}>{info.label} ({info.unit})</option>)}</select></label>}
      <div className="jarConfigurationFields">{fields.mode === 'A' ? number('aSamples', 'Position samples', { step: 1, min: 1, max: 500 }) : fields.mode === 'B' ? number('bSamples', 'Upper-collar samples', { step: 1, min: 1, max: 500 }) : <>{number('c1Samples', 'L1 samples', { step: 1, min: 1, max: 50 })}{number('c2Samples', 'L2 samples', { step: 1, min: 1, max: 50 })}</>}{number('overpull', 'Overpull at jar (klbf)')}{number('stroke', 'Jar stroke (in)')}</div>
      <label><input type="checkbox" checked={cumulative} onChange={event => setCumulative(event.target.checked)} /> Show selected cumulative impulse</label>
      <p>BHA: {bha?.name || bha?.id || 'Unnamed'}. Stuck point fixed at bit. Jar body {fmt(geometry.relocation?.jarLengthFt)} ft. Actual collar inventory {fmt(geometry.relocation?.collarInventoryFt)} ft; free pipe {fmt(geometry.constants?.freePipeLengthFt)} ft.</p>
      <p>All studies use the existing Jar Up solver with {demo ? 'assumed demo surrogate' : 'actual uniform section'} dimensions, E = 30 million psi and acoustic velocity = 16,000 ft/s. FI is incident wave force, not peak stuck-point force. Positive plotted tensile magnitudes differ from compression-positive static axial loads. No Jar Down extension is made.</p>
      <p>Mode A alone holds collar endpoints/inventory fixed. In B/C, replacing pipe conserves modeled string length; extending string holds pipe length and changes modeled length. Neither policy proves joint compatibility or deployment feasibility. No friction, buckling, damping, manufacturer release mechanism or field validation is added.</p>
      {!demo && <><button type="button" onClick={() => setLegacy(value => !value)}>{legacy ? 'Close independent research tools' : 'Open independent research tools'}</button>{legacy && <Suspense fallback={<p>Loading research tools…</p>}><LegacyResearch bha={bha} /></Suspense>}</>}
    </details>
  </section>;
}
