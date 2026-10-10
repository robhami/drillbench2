import React, { useState } from 'react';
import { calculateJarPerformance } from './skeemPerformance';
import './JarPerformance.css';

const fmt = (value, digits = 2) => value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function JarPerformance({ bha }) {
  const [operating, setOperating] = useState({ strokeIn: '4', overpullKlbf: '', stuckPointFt: '0' });
  const result = calculateJarPerformance(bha, operating);
  const fields = [['strokeIn', 'Jar stroke (in)'], ['overpullKlbf', 'Overpull at jar (klbf)'], ['stuckPointFt', 'Stuck-point position (ft above bit)']];
  return <section aria-label="Jar Performance" className="jarPerformance" style={{ margin: 0 }}>
    <h5 style={{ margin: '0 0 8px' }}>Jar Performance</h5>
    <p style={{ background: '#fff3cd', padding: '4px 8px', fontSize: 12 }}><strong>Preliminary — Idealised Skeem Model (1979)</strong> · Not for operational use.</p>
    <p>Enter operating overpull at the jar independently of drilling WOB. Surface overpull is not converted automatically.</p>
    <div className="jarPerformanceInputs">
      {fields.map(([key, label]) => <label key={key} className={key === 'stuckPointFt' ? 'jarPerformanceStuckPoint' : undefined}>
        {label}<input type="number" min="0" step="any" value={operating[key]} onChange={e => setOperating({ ...operating, [key]: e.target.value })} />
      </label>)}
    </div>
    {!result.valid && <p role="status" style={{ color: '#9a3412' }}>Calculation unavailable: {result.error}</p>}
    {result.valid && <>
      <dl className="jarPerformanceResults">
        {[
          ['Impact force', result.impactForceKlbf, 'klbf'],
          ['Average stuck-point force', result.averageStuckPointForceKlbf, 'klbf'],
          ['Impulse', result.impulseLbfS, 'lbf·s'],
          ['Impact velocity', result.preImpact.hammerVelocityFtS, 'ft/s']
        ].map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{fmt(value)} {unit}</dd></div>)}
      </dl>
    </>}
    <details style={{ marginTop: 8 }}><summary>Engineering details and applicability</summary>
      {result.valid && <p>Impact time: {fmt(result.preImpact.impactTimeS * 1000)} ms · Primary pulse duration: {fmt(result.primaryPulseDurationS * 1000)} ms</p>}
      {result.input && <>
        <p>L1: {fmt(result.input.lowerCollarLengthFt)} ft · L2: {fmt(result.input.upperCollarLengthFt)} ft · L3: {fmt(result.input.freePipeLengthFt)} ft</p>
        <p>Overpull at jar: {fmt(result.input.overpullLbf / 1000)} klbf · Stroke: {fmt(result.input.strokeIn)} in</p>
        <p>Lower-collar air weight W: {fmt(result.input.lowerCollarWeightLbf)} lbf · Weight correction: −2W = {fmt(-2 * result.input.lowerCollarWeightLbf)} lbf</p>
      </>}
      {result.preImpact?.valid && <>
        <p>Collar area: {fmt(result.preImpact.AcIn2, 4)} in² · Pipe area: {fmt(result.preImpact.ApIn2, 4)} in²</p>
        <p>Area ratio: {fmt(result.preImpact.alpha, 4)} · Reflection coefficient: {fmt(result.preImpact.lambda, 4)} · Completed reflections: {result.preImpact.completedReflections}</p>
      </>}
      <ul>{(result.warnings || []).map(w => <li key={w}>{w}</li>)}
        <li>One-dimensional elastic waves; uniform collars and drillpipe; rigid stuck point; no damping or wellbore friction; no detailed jar internal mechanics; primary impact interval only.</li>
        <li>Exactly one jar is supported. Free pipe must exceed 1,300 ft and pass the solver's surface-reflection check. W must be less than the initial impact force.</li>
        <li>Components below the entered stuck point are outside the modelled free span. Mixed sections, HWDP and other tools inside that span are unsupported.</li>
      </ul>
    </details>
  </section>;
}
