import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { calcSkeemConfigurationSweep } from '../../engineering/jar/skeemConfigurationSweep';
import { configurationGeometry, configurationRequest, configurationPlot, METRICS } from './configurationData';
import './JarConfiguration.css';

const ConfigurationPlot = lazy(() => import('./ConfigurationPlot'));
const fmt = n => n.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function JarConfiguration({ bha }) {
  const geometry = useMemo(() => configurationGeometry(bha), [bha]);
  const [fields, setFields] = useState(() => {
    const total = geometry.valid ? geometry.l1Ft + geometry.l2Ft : null;
    return { mode: 'fixed-total', total: total == null ? '' : String(total),
      l1Min: total == null ? '' : String(total * 0.25), l1Max: total == null ? '' : String(total * 0.75),
      l2Min: total == null ? '' : String(total * 0.25), l2Max: total == null ? '' : String(total * 0.75),
      samples2d: '50', samplesL1: '20', samplesL2: '20', overpull: '165', stroke: '4' };
  });
  const [metric, setMetric] = useState('impulse');
  const [execution, setExecution] = useState(null);
  const [error, setError] = useState(null);
  const rangesInitialized = useRef(geometry.valid);
  useEffect(() => {
    if (!rangesInitialized.current && geometry.valid) {
      const total = geometry.l1Ft + geometry.l2Ft;
      setFields(current => ({ ...current,
        total: current.total || String(total),
        l1Min: current.l1Min || String(total * 0.25), l1Max: current.l1Max || String(total * 0.75),
        l2Min: current.l2Min || String(total * 0.25), l2Max: current.l2Max || String(total * 0.75)
      }));
      rangesInitialized.current = true;
    }
  }, [geometry]);
  useEffect(() => { setExecution(null); setError(null); }, [bha]);
  const update = (key, value) => { setFields(current => ({ ...current, [key]: value })); setError(null); };
  const run = event => {
    event.preventDefault();
    const prepared = configurationRequest(geometry, fields);
    if (!prepared.valid) { setError(prepared.error); setExecution(null); return; }
    const result = calcSkeemConfigurationSweep(prepared.request);
    if (!result.valid) { setError(result.error); setExecution(null); return; }
    const actual = calcSkeemConfigurationSweep({ mode: 'independent', constants: prepared.request.constants,
      l1: { minFt: geometry.l1Ft, maxFt: geometry.l1Ft, samples: 1 },
      l2: { minFt: geometry.l2Ft, maxFt: geometry.l2Ft, samples: 1 } }).samples[0];
    setError(null);
    setExecution({ result, actual, fields: { ...fields }, revision: (execution?.revision || 0) + 1 });
  };
  const plot = useMemo(() => execution ? configurationPlot(execution.result, metric, execution.actual, execution.revision) : null, [execution, metric]);
  const stale = execution && JSON.stringify(execution.fields) !== JSON.stringify(fields);
  const numeric = (key, label, extra = {}) => <label key={key}>{label}
    <input type="number" step="any" value={fields[key]} onChange={e => update(key, e.target.value)} {...extra} />
  </label>;
  return <section className="jarConfiguration" aria-label="Jar Configuration Analysis">
    <h5>Jar Configuration Analysis</h5>
    <p className="jarConfigurationNotice"><strong>Preliminary — Idealised Skeem Model (1979)</strong> · Not for operational use.</p>
    <p>Impulse is the primary stuck-point force integral, not internal jar hammer momentum. Overpull is entered at the jar, independently of WOB or surface overpull.</p>
    {!geometry.valid && <p role="alert">BHA not applicable: {geometry.error}</p>}
    <form onSubmit={run} noValidate>
      <div className="jarConfigurationFields">
        <label>Sweep mode<select value={fields.mode} onChange={e => update('mode', e.target.value)}>
          <option value="fixed-total">Fixed total collars (2D)</option><option value="independent">Independent L1/L2 (3D)</option>
        </select></label>
        {numeric('l1Min', 'Minimum L1 (ft)')}{numeric('l1Max', 'Maximum L1 (ft)')}
        {fields.mode === 'fixed-total' ? <>
          {numeric('total', 'Total effective collars (ft)')}{numeric('samples2d', 'Positions', { step: 1, min: 1, max: 500 })}
        </> : <>
          {numeric('l2Min', 'Minimum L2 (ft)')}{numeric('l2Max', 'Maximum L2 (ft)')}
          {numeric('samplesL1', 'L1 samples', { step: 1, min: 1, max: 50 })}{numeric('samplesL2', 'L2 samples', { step: 1, min: 1, max: 50 })}
        </>}
        {numeric('overpull', 'Overpull at jar (klbf)', { min: 0 })}{numeric('stroke', 'Jar stroke (in)', { min: 0 })}
        <label>Result metric<select value={metric} onChange={e => setMetric(e.target.value)}>
          {Object.entries(METRICS).map(([key, value]) => <option key={key} value={key}>{value.label} ({value.unit})</option>)}
        </select></label>
      </div>
      <button type="submit" disabled={!geometry.valid}>Run sweep</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {stale && <p role="status">Inputs changed. Plot and maxima show the previous run; select Run sweep to update.</p>}
    {execution && <>
      <p><strong>{execution.result.validCount} valid · {execution.result.invalidCount} invalid configurations</strong></p>
      <p>Maxima within the sampled domain — not global or operational optima.</p>
      <dl className="jarConfigurationMaxima">
        {Object.entries(METRICS).map(([key, value]) => {
          const sample = execution.result.maxima[key];
          return <div key={key}><dt title={`Maximum sampled ${value.label.toLowerCase()}`}>{ { impulse: 'Impulse', averageForce: 'Average stuck-point force', impactForce: 'Initial impact force' }[key] }</dt><dd>{sample
            ? <><strong>{fmt(sample[value.field])} {value.unit}</strong><span>L1 {fmt(sample.l1Ft)} ft · L2 {fmt(sample.l2Ft)} ft</span></>
            : 'No valid samples'}</dd></div>;
        })}
      </dl>
      {execution.actual?.valid && execution.result.mode === 'fixed-total' && Math.abs(execution.actual.totalCollarLengthFt - execution.result.samples[0]?.totalCollarLengthFt) > 1e-6 && <p>Actual BHA marker omitted: its effective total differs from the plotted fixed-total configuration.</p>}
      {!execution.actual?.valid && <p>Actual BHA configuration is invalid at these operating conditions: {execution.actual?.error}</p>}
      {execution.result.mode === 'independent' && <p>X: L1, collars below jar (ft). Y: L2, collars above jar (ft). Z: {METRICS[metric].label.toLowerCase()} ({METRICS[metric].unit}).</p>}
      {execution.result.validCount > 0 && <Suspense fallback={<p>Loading interactive plot…</p>}><ConfigurationPlot {...plot} /></Suspense>}
    </>}
    <details><summary>Engineering inputs, assumptions and applicability</summary>
      {geometry.valid && <p>Actual L1 {fmt(geometry.l1Ft)} ft · L2 {fmt(geometry.l2Ft)} ft · L3 {fmt(geometry.constants.freePipeLengthFt)} ft.<br />
        Collars {geometry.constants.collarOdIn} × {geometry.constants.collarIdIn} in; pipe {geometry.constants.pipeOdIn} × {geometry.constants.pipeIdIn} in.<br />
        Material weight density {geometry.constants.materialWeightDensityLbfIn3.toPrecision(6)} lbf/in³.</p>}
      <ul>{[...(geometry.warnings || []), ...(execution?.result.warnings || [])].map((warning, i) => <li key={i}>{warning}</li>)}</ul>
      <p>Assumes one-dimensional elastic waves in uniform collar and pipe sections, a rigid stuck point, no damping or wellbore friction, no detailed jar internal mechanics, and the primary impact interval only.</p>
      <p>Free pipe and lower-weight limits are enforced by the existing solver. Invalid results remain gaps; mesh cells require four valid adjacent samples. Hover displays sampled values. Use drag to rotate, wheel to zoom and the plot toolbar to pan.</p>
      {execution?.result.invalidReasons.map(group => <p key={group.reason}>{group.count} invalid: {group.reason}</p>)}
    </details>
  </section>;
}
