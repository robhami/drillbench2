import React, { useMemo } from 'react';
import { evaluateJarDownPreparation } from './downPreparationAdapter';
const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function JarDownPreparation({ bha, values, onChange, primaryGeometry = false }) {
  const result = useMemo(() => evaluateJarDownPreparation(bha, values), [bha, values]);
  const net = values.loadBasis === 'at-jar-net';
  const fields = [['compressionKlbf', 'Compression estimate at jar (klbf)'], ['strokeIn', 'Free downward stroke (in)'],
    ['stuckPointFt', 'Down stuck-point position (ft above bit)'], ['pressureDropPsi', 'Manufacturer-defined pressure differential (psi)'],
    ['pumpOpenAreaIn2', 'Manufacturer pump-open area (in²)']];
  return <section className="jarDownPreparation" aria-label="Jar Down static preparation">
    <h6>Static preparation — not an impact prediction</h6>
    <p>Compression positive; tension negative. Surface slackoff, compression at the jar, latch setting and dynamic impact are different quantities.</p>
    {result.valid && <>
      <p><strong>{result.status}</strong></p>
      <dl className="jarPerformanceResults jarDownStaticResults">
        <div><dt>Entered at-jar estimate</dt><dd>{fmt(Number(values.compressionKlbf))} klbf</dd></div>
        <div><dt>Opposing pump-open force</dt><dd>{result.pumpOpenForceLbf === null ? 'Included in net input; not independently known' : `${fmt(result.pumpOpenForceLbf / 1000)} klbf`}</dd></div>
        <div><dt>Conditional net static compression</dt><dd>{fmt(result.netCompressionLbf / 1000)} klbf</dd></div>
      </dl>
    </>}
    <div className="jarPerformanceInputs">
      <label className="jarPerformanceStuckPoint">Compression load basis<select value={values.loadBasis} onChange={e => onChange('loadBasis', e.target.value)}>
        <option value="">Select load basis</option>
        <option value="at-jar-before-pump">At-jar estimate before pump-open force</option>
        <option value="at-jar-net">At-jar net estimate, already pressure-corrected</option>
        <option value="soft-string-before-pump">Conditional soft-string estimate before pump-open force</option>
        <option value="surface-slackoff">Surface slackoff only — transmission unresolved</option>
      </select></label>
      {fields.filter(([key]) => !primaryGeometry || !['strokeIn', 'stuckPointFt'].includes(key)).map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="any" value={values[key]} disabled={net && ['pressureDropPsi', 'pumpOpenAreaIn2'].includes(key)} onChange={e => onChange(key, e.target.value)} /></label>)}
      <label className="jarPerformanceStuckPoint">Compression estimate reference<input value={values.compressionReference} onChange={e => onChange('compressionReference', e.target.value)} /></label>
      <label className="jarPerformanceStuckPoint">Manufacturer pressure/area reference<input value={values.manufacturerReference} onChange={e => onChange('manufacturerReference', e.target.value)} /></label>
    </div>
    {result.issues.length > 0 && <ul aria-label="Jar Down missing requirements">{result.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
    <p>Transmission and buckling have not been verified. Use the existing Jar Loading assessment for static slack-off and buckling screening; it does not establish post-buckling transmission or dynamic validity.</p>
    {result.settings && <p>Configured Down mechanism: {result.settings.mechanism || 'Not configured'} · {result.settings.mechanism === 'mechanical'
      ? `Mechanical trip setting: ${result.settings.tripForceKlbf || 'Not provided'} klbf. Its force basis is not verified here; no firing inference is made.`
      : 'A hydraulic static target is not a fixed firing threshold.'} Configure tool availability and release settings in Jar Loading.</p>}
    <details><summary>Jar Down engineering limitations</summary>
      <p>Peak and incident impact force, average stuck-point force, impulse, velocity, impact time and primary duration are unavailable. No integration interval or reflected-wave history is inferred.</p>
      <p>Missing dynamics: tool-specific hammer/anvil geometry, actual moving mass, gravity and elastic energy, hydraulic force over free travel, contact/rebound law, initial stress field and upper/lower boundary conditions. A survey does not qualify directional impact predictions.</p>
      <ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      <p>Pressure × area is a static pump-open calculation, not the force delivered to the stuck point. The entered free stroke is retained for future tool-specific modelling; it is not substituted into Jar Up equations. Input references record user provenance, not independent validation.</p>
    </details>
  </section>;
}
