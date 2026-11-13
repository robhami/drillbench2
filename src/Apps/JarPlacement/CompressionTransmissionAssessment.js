import React from 'react';
const fmt = n => ['number', 'string'].includes(typeof n) && String(n).trim() !== '' && Number.isFinite(Number(n))
  ? (Math.abs(Number(n)) < .0005 ? 0 : Number(n)).toLocaleString(undefined, { maximumFractionDigits: 3 }) : 'Unavailable';
export default function CompressionTransmissionAssessment({ bha, bridge, adopted, adoptedCurrent, onAdopt, onManual, researchInput, result }) {
  const a = bridge.assessment, s = a.staticResult;
  return <section className="jarCompressionAssessment" aria-label="Compression Transmission Assessment">
    <h6>Compression Transmission Assessment</h6><p className="jarResearchWorkflow">Static assessment → Review applicability → Explicitly adopt candidate → Explore idealised response. Manual input remains available.</p>
    <p><strong>{bridge.pending ? 'Calculation pending' : a.classification}</strong> — static model estimate, not a firing prediction.</p>
    {adopted && <p className="jarResearchCandidate" role="status">{adoptedCurrent ? `Research result based on explicitly adopted static-model candidate: ${fmt(adopted.forceLbf)} lbf. ${adopted.description}` : 'Stale adopted candidate — upstream or research compatibility inputs changed. Dynamic results are suppressed; reassess and deliberately adopt again, or return to manual input.'}</p>}
    <dl className="jarPerformanceResults jarCompressionSummary">
      <div><dt>Calculated static jar compression</dt><dd>{fmt(a.staticCompressionLbf)} lbf</dd></div>
      <div><dt>Current research compression</dt><dd>{adopted && !adoptedCurrent ? 'Stale — unavailable' : `${fmt(researchInput.compressionLbf)} lbf`}</dd></div>
      <div><dt>Source</dt><dd>{adopted ? 'Explicitly adopted static-model candidate' : 'Manual prescribed initial state'}</dd></div>
      <div><dt>Existing buckling screening</dt><dd>{a.bucklingStatus || 'Not Evaluated'}{a.bucklingOnset ? ' — onset exceeded' : ' — no stability conclusion'}</dd></div>
    </dl>
    <p>{a.issues?.[0] || a.limitations?.[0] || 'Static compression does not establish real jar firing.'}</p>

    <button type="button" disabled={!a.canAdopt || bridge.pending} onClick={onAdopt}>Use calculated static jar compression as research input</button>{adopted && <button type="button" onClick={onManual}>Return to manual compression</button>}
    <details><summary>Static boundary input and calculation provenance</summary>
    <dl className="jarPerformanceResults">
      <div><dt>BHA / jar</dt><dd>{bha?.name || bha?.id || 'Unnamed BHA'} / {s?.jarName || 'Unavailable'}</dd></div>
      <div><dt>Jar centre MD / inclination</dt><dd>{fmt(s?.jarMdFt)} ft MD / {fmt(a.inclinationDeg)}°</dd></div>
      <div><dt>Static operating case</dt><dd>{s?.direction || bridge.boundary.direction} — nonrotating, absolute surface support</dd></div>
      <div><dt>Surface boundary</dt><dd>{fmt(s?.surfaceHookloadLbf)} lbf at {fmt(s?.surfaceMdFt)} ft MD</dd></div>
      <div><dt>Calculated static jar axial force</dt><dd>{fmt(a.staticForceLbf)} lbf (compression positive)</dd></div>
      <div><dt>Friction / mud / buoyancy factor</dt><dd>{fmt(s?.frictionCoefficient)} / {fmt(bha?.mudWeight)} ppg / {fmt(s?.buoyancyFactor)}</dd></div>

    </dl>
      <ul>{a.issues?.map(issue => <li key={issue}>{issue}</li>)}</ul>
      <p>Boundary inputs here are session-only for this research assessment. Hookload Calculations keeps its own transient operating fields; they are not silently copied. Shared BHA, survey, mud, friction, bit MD and surface reference are reused.</p>
      <p>Boundary MD: {fmt(bridge.surfaceMdFt)} ft; analysis bit MD: {fmt(bridge.bitMdFt)} ft. Enter net upward axial string support, excluding suspended equipment; an inclined reference requires local axial support, not an uncorrected vertical rig indication. Surface set-down is not jar compression.</p>
      <p>{a.provenance || 'No current static result.'}</p>
      {s?.valid && <p>Static equilibrium residual {fmt(s.equilibriumResidualLbf)} lbf; curved-profile convergence {s.convergence?.checked ? `checked, difference ${fmt(s.convergence.differenceLbf)} lbf` : 'not required'}. Fully mobilised axial Coulomb friction; buoyancy uses steel density 65.5 ppg and equal internal/external fluid. The complete string is deployed/coverage-checked, but equilibrium is integrated only surface to jar centre; lower support is assumed.</p>}
      <ul>{[...(a.limitations || []), ...(a.buckling?.warnings || [])].map((text, i) => <li key={i}>{text}</li>)}</ul>
      <p>Jar-centre static force is adopted as a prescribed scalar initial condition for both ideal faces, despite excluded jar length and different dynamic material/weight assumptions. No force-transmission efficiency or manufacturer threshold is introduced.</p>
    <p>Calculated static compression comes from the existing static axial-load model. Research initial compression is manually prescribed or explicitly adopted as identified above.</p>
    <table aria-label="Static and dynamic research comparison"><thead><tr><th>Quantity</th><th>Value</th><th>Source</th></tr></thead><tbody>
      <tr><th>Idealised first incident contact force</th><td>{fmt(result?.contact?.transitions.find(e => e.type === 'engage')?.contactForceLbf)} lbf</td><td>Stage 5C.9 ideal dynamics; not rated tool performance</td></tr>
      <tr><th>Signed total reaction impulse</th><td>{fmt(result?.observation?.totalLbfS)} lbf·s</td><td>Stage 5C.9, stated observation interval</td></tr>
    </tbody></table>
    </details>
  </section>;
}
