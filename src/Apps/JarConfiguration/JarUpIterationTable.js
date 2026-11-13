import React, { lazy, Suspense, useEffect, useState } from 'react';
import { iterationCsv, iterationRows, iterationUnits, candidateCounts, candidateOutcome, comparisonAxisRange } from './iterationTablePresentation';
import { MAX_SWEEP_POSITIONS } from '../../engineering/research/jarUpSweep';
import './JarPositionAnalysis.css';

const Plot = lazy(() => import('./ConfigurationPlot'));
const fmt = n => Number.isFinite(n) ? n.toFixed(3) : 'Unavailable';
const fmtImpulse = (n, system) => Number.isFinite(n) ? n.toFixed(system === 'oilfield' ? 5 : 3) : 'Unavailable';

export default function JarUpIterationTable({ fields, setField, stuck, setStuck, ack, setAck, rows, busy, complete, error, rejected, planned, calculate, cancel, reset, geometry, jarSelected = true, sweep, setSweep, onOpenDiagnostics = () => {} }) {
  const [sort, setSort] = useState('position');
  const [metric, setMetric] = useState('force');
  const [focus, setFocus] = useState(null);
  const [system, setSystem] = useState('oilfield');
  const [positioningMode, setPositioningMode] = useState('mode2');
  useEffect(() => { if (!complete) setFocus(null); }, [complete]);
  const u = iterationUnits(system);
  const valid = complete ? iterationRows(rows, sort) : [];
  const selected = valid.find(r => r.candidateId === focus || r.movementFt === focus);
  const current = valid.find(r => r.movementFt === 0);
  const counts = candidateCounts(rows, rejected);
  const axisRange = comparisonAxisRange(sweep?.min, sweep?.max, geometry.currentCentreFt);
  const failures = complete ? rows.filter(r => r.scenario === 'Base' && !r.valid) : [];
  const missingPropertiesExcluded = [...rejected, ...failures].some(r => /explicit equivalent|structural area|density|modulus|provenance/i.test(`${r.error || ''} ${r.status || ''}`));
  const peak = valid.length ? Math.max(...valid.map(r => r.metrics.peakTensileN)) : null;
  const impulse = valid.length ? Math.max(...valid.map(r => r.metrics.fixedTensileNs)) : null;
  const lengthInput = value => value === '' || !Number.isFinite(Number(value)) ? '' : Number(u.length(Number(value)).toFixed(9));
  const feetInput = value => value === '' ? '' : String(u.toFeet(Number(value)));
  const chartX = r => u.length(r.jarCentreFt);
  const xTitle = `Jar position above bit (${u.lengthUnit})`;
  const candidateLabel = r => `${fmt(u.length(r.jarCentreFt))} ${u.lengthUnit}`;
  const peakLocations = valid.filter(r => peak != null && Math.abs(r.metrics.peakTensileN - peak) <= Math.max(.1, .001 * peak)).map(candidateLabel).join(', ');
  const impulseLocations = valid.filter(r => impulse != null && Math.abs(r.metrics.fixedTensileNs - impulse) <= Math.max(.0001, .001 * impulse)).map(candidateLabel).join(', ');
  const estimate = () => {
    const min=Number(sweep?.min),max=Number(sweep?.max),step=Number(sweep?.increment);
    if (![min,max,step].every(Number.isFinite)||max<min||step<=0) return 0;
    const gridCount = Math.floor((max-min)/step+1e-10)+1;
    const index = Math.round((geometry.currentCentreFt-min)/step);
    const onGrid = index >= 0 && index < gridCount && Math.abs(min+index*step-geometry.currentCentreFt)<1e-7;
    return Math.min(MAX_SWEEP_POSITIONS+1,gridCount+(onGrid?0:1));
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([iterationCsv(valid, sort, system, true, { loadLbf: fields.load, strokeIn: fields.stroke, stuckAboveBit: u.length(stuck), lengthUnit: u.lengthUnit, windowEndMs: 50, minimum: sweep.min, maximum: sweep.max, increment: sweep.increment })], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'JarUpPositions.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const changeSweep = (key, value) => setSweep({ ...sweep, [key]: value });
  const input = (key, label) => <label key={key}>{label}<input type="number" step="any" value={fields[key] ?? ''} disabled={busy} onChange={e => setField(key, e.target.value)} /></label>;
  return <section className="jarUpAnalysis" aria-label="Jar position analysis">
    <p className="jarUpLead">Compare supported jar positions using the same local loading and stroke inputs.</p>
    <label>Positioning method<select value={positioningMode} onChange={e => setPositioningMode(e.target.value)}><option value="mode2">Mode 2 — Move Within Existing Collars</option><option value="mode1" disabled>Mode 1 — Fixed Anvil (requires a configured DC inventory and explicit DP accounting rule)</option><option value="mode3" disabled>Mode 3 — Move and Add Collars (requires explicit added-collar inventory and properties)</option></select></label>
    <div className="jarUpCustomerGrid">
      <section aria-labelledby="jar-conditions-title">
        <h3 id="jar-conditions-title" className="jarUpSectionTitle">Jarring Conditions</h3>
        <div className="jarUpFields">
          {input('load', 'Applied load at jar (lbf)')}
          {input('stroke', 'Jar stroke (in)')}
          <label>Jarring direction<select value="up" disabled><option value="up">Jar Up</option><option value="down" disabled>Jar Down (not implemented and verified)</option></select></label>
          <label>Stuck point above bit ({u.lengthUnit})<input type="number" step="any" disabled={busy} value={lengthInput(Number.isFinite(stuck) ? stuck : '')} onChange={e => setStuck(feetInput(e.target.value))} /></label>
        </div>
      </section>
      <section aria-labelledby="jar-position-title">
        <h3 id="jar-position-title" className="jarUpSectionTitle">Jar Positioning</h3>
        <div className="jarUpFields">
          {[['min','Minimum jar position above bit (ft)'],['max','Maximum jar position above bit (ft)'],['increment','Position increment (ft)']].map(([key,label]) => <label key={key}>{label}<input type="number" step="any" value={sweep?.[key] ?? ''} disabled={busy} onChange={e => changeSweep(key,e.target.value)} /></label>)}
        </div>
        <p className="jarUpCompactNote">The current jar is always included. Engineering position comparison — rig handling not verified.</p>
      </section>
    </div>
    <div className="jarUpActions">
      <button disabled={busy || !jarSelected || !ack || estimate() > MAX_SWEEP_POSITIONS} onClick={calculate}>Run Analysis</button>
      <button disabled={busy} onClick={reset}>Reset</button>
      <span>Current jar: {fmt(u.length(geometry.currentCentreFt))} {u.lengthUnit} · Estimated candidates: {estimate()} · Maximum {MAX_SWEEP_POSITIONS}</span>
      <button className="textButton" onClick={onOpenDiagnostics}>Engineering Settings / Diagnostics</button>
    </div>
    <div className="jarUpAcknowledgement"><label><input type="checkbox" checked={ack} disabled={busy} onChange={e => setAck(e.target.checked)} /> I reviewed the illustrative property assumptions and understand these results are preliminary.</label><span>Load is applied locally at the jar, not at surface; the 185,000-lbf starting value is illustrative.</span></div>
    <h3 className="jarUpSectionTitle jarUpResultsTitle">Analysis Results</h3>
    <p className="jarUpCompactNote">Tensile-only impulse uses the same 0–50 ms post-impact window for every candidate.</p>
    <div className="jarUpResultActions"><label>Display units<select value={system} onChange={e => setSystem(e.target.value)}><option value="oilfield">Oilfield — ft / kip / kip·s</option><option value="si">SI — m / kN / N·s</option></select></label><label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="position">Jar position</option><option value="force">Peak tensile force</option><option value="impulse">Tensile impulse</option></select></label><button onClick={exportCsv} disabled={!valid.length}>Export CSV</button>{busy && <button onClick={cancel}>Cancel</button>}</div>
    {error && <p role="alert">{error}{/Engineering Settings/.test(error) && <> <button className="textButton" onClick={onOpenDiagnostics}>Open Engineering Settings</button></>}</p>}
    {busy && <p role="status">Calculating {rows.length}/{planned} configurations. Numerical convergence and energy checks remain active.</p>}
    {rejected.length > 0 && <p role="status">{missingPropertiesExcluded ? 'Missing engineering properties — open Engineering Settings.' : `Some requested positions were excluded by component geometry or solver validation. ${rejected.length} candidate${rejected.length === 1 ? '' : 's'} excluded.`}</p>}
    {failures.length > 0 && <p role="status">{missingPropertiesExcluded ? 'Missing engineering properties â€” open Engineering Settings.' : `${failures.length} calculation${failures.length === 1 ? '' : 's'} unavailable; details are in Engineering Diagnostics.`}</p>}
    {(complete || rejected.length > 0) && <p role="status" aria-label="Candidate completion summary">Original BHA reference: {counts.reference ? candidateOutcome(counts.reference) : 'unavailable'} at {fmt(u.length(geometry.currentCentreFt))} {u.lengthUnit}. Successful alternatives: {counts.successfulAlternatives}/{counts.alternatives}. Geometry exclusions: {counts.outcomes['geometry exclusion'] || 0}; incomplete computational results: {counts.outcomes['incomplete computational result'] || 0}; invalid inputs: {counts.outcomes['invalid input'] || 0}; model / numerical failures: {counts.outcomes['model / numerical failure'] || 0}.</p>}
    {valid.length > 0 && <>
      <div className="jarUpHighlights" role="group" aria-label="Calculated maxima"><div>Highest calculated peak tensile force<strong>{fmt(u.force(peak))} {u.forceUnit}</strong><small>{peakLocations}</small></div><div>Highest calculated tensile impulse<strong>{fmtImpulse(u.impulse(impulse), system)} {u.impulseUnit}</strong><small>{impulseLocations}</small></div></div>
      <section className="jarUpCharts" aria-label="Jar position performance chart">
        <label>Performance metric<select value={metric} onChange={e => setMetric(e.target.value)}><option value="force">Peak stuck-point tensile force ({u.forceUnit})</option><option value="impulse">Tensile-only impulse ({u.impulseUnit})</option></select></label>
        {(() => {
          const chart = metric === 'force'
            ? { title: `Peak stuck-point tensile force (${u.forceUnit})`, y: r => u.force(r.metrics.peakTensileN) }
            : { title: `Tensile-only impulse (${u.impulseUnit})`, y: r => u.impulse(r.metrics.fixedTensileNs) };
          const [low, high] = axisRange;
          const excludedInRange = [...rejected, ...failures].filter(r => Number.isFinite(r.jarCentreFt) && r.jarCentreFt >= low - 1e-8 && r.jarCentreFt <= high + 1e-8);
          const positions = [...valid.filter(r => r.movementFt !== 0), ...excludedInRange].sort((a, b) => a.jarCentreFt - b.jarCentreFt);
          const lineX = [], lineY = [], lineCustomdata = [];
          positions.forEach(r => {
            const invalid = !r.valid;
            lineX.push(chartX(r)); lineY.push(invalid ? null : chart.y(r)); lineCustomdata.push(invalid ? null : (r.candidateId ?? r.movementFt));
          });
          const exclusionShapes = excludedInRange.map(r => ({ type: 'line', xref: 'x', yref: 'paper', x0: chartX(r), x1: chartX(r), y0: 0, y1: 1, line: { color: '#a22', width: 1, dash: 'dot' } }));
          return <div className="jarUpPerformance">
            <Suspense fallback={<p>Loading chart...</p>}><Plot plotHeight={300} data={[{ type: 'scatter', mode: 'lines+markers', name: chart.title, x: lineX, y: lineY, customdata: lineCustomdata, connectgaps: false }, ...(current ? [{ type: 'scatter', mode: 'markers', name: 'Current BHA', x: [chartX(current)], y: [chart.y(current)], customdata: [current.candidateId ?? current.movementFt], marker: { size: 12, symbol: 'diamond', color: '#bc6300' } }] : [])]} layout={{ title: { text: chart.title }, xaxis: { title: { text: xTitle }, range: axisRange.map(u.length) }, yaxis: { title: { text: chart.title } }, shapes: exclusionShapes, margin: { l: 70, r: 15, t: 45, b: 60 }, showlegend: true }} onClick={e => { const key = e.points?.[0]?.customdata; if (key != null) setFocus(key); }} /></Suspense>
            {excludedInRange.length > 0 && <details><summary>{excludedInRange.length} excluded requested position(s); no performance value assigned</summary><ul aria-label="Excluded candidate positions">{excludedInRange.map((r, i) => <li key={`${r.jarCentreFt}-${i}`}>{fmt(u.length(r.jarCentreFt))} {u.lengthUnit}: {r.error || r.status || 'unavailable; see Engineering Diagnostics'}</li>)}</ul></details>}
          </div>;
        })()}
      </section>
      <div className="jarUpTableWrap"><table className="table table-sm" aria-label="Jar Up candidate comparison"><thead><tr><th>Jar above bit ({u.lengthUnit})</th><th>Jar-to-stuck point ({u.lengthUnit})</th><th>Impact velocity (m/s)</th><th>Initial impact ({u.forceUnit})</th><th>Peak stuck-point force ({u.forceUnit})</th><th>Tensile impulse ({u.impulseUnit})</th><th>Configuration</th></tr></thead><tbody>{valid.map(r => { const isCurrent = r.movementFt === 0; return <tr key={r.candidateId || r.movementFt} className={isCurrent ? 'currentCandidate' : ''} onClick={() => setFocus(r.candidateId ?? r.movementFt)}><td>{fmt(u.length(r.jarCentreFt))}{isCurrent ? ' · current' : ''}</td><td>{fmt(u.length(r.jarToStuckFt))}</td><td>{fmt(r.impact?.impactVelocityMS)}</td><td>{fmt(u.force(r.impact?.initialImpactForceN))}</td><td>{fmt(u.force(r.metrics.peakTensileN))}</td><td>{fmtImpulse(u.impulse(r.metrics.fixedTensileNs), system)}</td><td>Engineering position comparison — rig handling not verified</td></tr>;})}{failures.map((r, i) => <tr key={`failure-${i}`}><td>{fmt(u.length(r.jarCentreFt ?? geometry.currentCentreFt + r.movementFt))}</td><td colSpan="6">{r.movementFt === 0 ? 'Original BHA reference: ' : 'Alternative: '}{candidateOutcome(r)} ({r.status}); details are in Engineering Diagnostics.</td></tr>)}</tbody></table></div>
      <p className="jarUpCompactNote">Results use the acknowledged preliminary model assumptions. Engineering position comparison — rig handling not verified. Highest values are sampled comparisons, not an operational recommendation.</p>
    </>}
    {!valid.length && !busy && <p className="jarUpCompactNote">No calculated results yet. Enter a valid position range and run the comparison.</p>}
    {selected && <section aria-label="Selected candidate details"><h4>{candidateLabel(selected)} configuration</h4><p>Deployed length: {fmt(u.length(selected.totalBhaLengthFt))} {u.lengthUnit}; calculated nominal weight: {fmt(selected.totalCalculatedWeightLbf)} lbf; DC above jar: {fmt(u.length(selected.drillCollarLengthAboveJarFt))} {u.lengthUnit}; DC below jar: {fmt(u.length(selected.drillCollarLengthBelowJarFt))} {u.lengthUnit}; impact velocity: {fmt(selected.impact?.impactVelocityMS)} m/s; peak tensile force: {fmt(u.force(selected.metrics.peakTensileN))} {u.forceUnit}; tensile-only impulse: {fmtImpulse(u.impulse(selected.metrics.fixedTensileNs), system)} {u.impulseUnit}. {selected.configurationWarnings?.join(' ')}</p><button onClick={() => setFocus(null)}>Close candidate details</button><Suspense fallback={<p>Loading force history...</p>}><Plot data={[{ type: 'scatter', mode: 'lines', name: candidateLabel(selected), x: selected.trace.map(p => p.timeS * 1000), y: selected.trace.map(p => u.force(p.stuckN)) }]} layout={{ title: { text: 'Stuck-point dynamic force history' }, xaxis: { title: { text: 'Time after impact (ms)' } }, yaxis: { title: { text: `Compression-positive force (${u.forceUnit})` } } }} /></Suspense></section>}
    <details className="jarUpHow"><summary>How JarFrame calculates jarring performance</summary><p>Local tensile load and jar stroke set the Skeem initial condition. Returning waves in the actual upper BHA affect jar-face velocity during the stroke. The impact launches elastic waves through the candidate string; waves reflect and transmit at impedance changes. JarFrame reports peak stuck-point tensile force and tensile-only impulse over a common 0â€“50 ms window.</p><p><code>vâ‚€ = Fâ‚€ / Zc</code> Â· <code>FI = Zc Ã— vimpact / 2</code>. Load is local to the jar, not surface hookload. Dynamic results exclude gravity and depth-dependent static preload.</p></details>
  </section>;
}
