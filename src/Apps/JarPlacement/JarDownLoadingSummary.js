import React, { useEffect, useState } from 'react';
const number = v => String(v ?? '').trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
const fmt = n => n === null || !Number.isFinite(n) ? 'Unavailable' : n.toLocaleString(undefined, { maximumFractionDigits: 20 });
export function surfaceSlackoff(reference, current, compatible) {
  const a = number(reference), b = number(current);
  return compatible && a !== null && b !== null && a >= 0 && b >= 0 ? a - b : null;
}

export default function JarDownLoadingSummary({ bridge, result, request, adopted, adoptedCurrent, geometrySource }) {
  const [reference, setReference] = useState(null);
  useEffect(() => { setReference(previous => previous?.context === bridge.referenceContext ? previous : null); }, [bridge.referenceContext]);
  const current = bridge.assessment.staticResult;
  const associated = geometrySource.startsWith('BHA-derived');
  const validReference = reference?.context === bridge.referenceContext && reference.condition && number(reference.klbf) !== null && number(reference.klbf) >= 0;
  // Both explicit inputs are net upward local axial support at the same MD.
  // This difference is a surface load change, never a jar-force calculation.
  const delta = surfaceSlackoff(reference?.klbf, current?.surfaceHookloadLbf / 1000, Boolean(associated && validReference && current?.valid && !bridge.pending));
  const stale = adopted && !adoptedCurrent;
  const used = result?.valid && !stale ? request?.compressionLbf : null;
  const update = change => setReference({ klbf: '', condition: '', ...(reference?.context === bridge.referenceContext ? reference : {}), ...change, context: bridge.referenceContext });
  return <section className="jarDownLoadingSummary" aria-label="Jar Down Loading Summary">
    <h6>Jar Down Loading Summary</h6>
    {!associated && <p><strong>Independent idealised research fixture — results are not calculated from the currently displayed BHA.</strong></p>}
    <p><strong>Graph geometry: {geometrySource}.</strong> Ideal guided rods, not the actual surveyed trajectory.</p>
    {associated && <p>{adopted ? 'BHA-derived geometry with a separately adopted static-model initial condition.' : 'Mixed-source research: BHA-derived geometry with manually prescribed initial conditions.'} Jar: {current?.jarName || 'Static assessment required'}; MD {fmt(current?.jarMdFt)} ft; inclination {fmt(bridge.assessment.inclinationDeg)}°. Adopted compression: {adopted ? adoptedCurrent ? 'current' : 'stale' : 'not adopted'}.</p>}
    <dl className="jarPerformanceResults jarLoadingGrid">
      <div><dt>Reference surface hookload</dt><dd>{validReference ? `${fmt(number(reference.klbf))} klbf — ${reference.condition}; explicitly entered study reference` : 'Not defined — reference hookload required'}</dd></div>
      <div><dt>Current surface hookload</dt><dd>{current?.valid && !bridge.pending ? `${fmt(current.surfaceHookloadLbf / 1000)} klbf — ${current.direction}; explicitly entered study boundary` : 'Unavailable — current static calculation required'}</dd></div>
      <div><dt>Weight slacked off</dt><dd>{delta === null ? validReference && !associated ? 'Not applicable — independent research geometry' : validReference ? 'Unavailable — current static calculation required' : 'Not defined — reference hookload required' : `${fmt(delta)} klbf${delta < 0 ? ' (support increased)' : ''}`}</dd></div>
      <div><dt>Static jar force / compressive component</dt><dd>{current?.valid && !bridge.pending ? `${fmt(bridge.assessment.staticForceLbf)} / ${fmt(bridge.assessment.staticCompressionLbf)} lbf — model estimate` : 'Unavailable — current static calculation required'}</dd></div>
      <div><dt>Research initial compression used</dt><dd>{stale ? 'Stale — unavailable' : used === null || used === undefined ? 'Unavailable — calculation required' : `${fmt(used)} lbf`}</dd><small>{adopted ? 'Adopted static-model candidate' : 'Manual prescribed input'}</small></div>
    </dl>
    <details><summary>Surface Loading</summary>
      <label>Research static load case<select value={bridge.boundary.direction} onChange={e => bridge.setBoundary({ ...bridge.boundary, direction: e.target.value })}><option value="slackoff">Nonrotating slack-off</option><option value="pickup">Pickup (ineligible for adoption)</option></select></label>
      <label>Research static surface hookload (klbf)<input type="number" step="any" value={bridge.boundary.hookloadKlbf} onChange={e => bridge.setBoundary({ ...bridge.boundary, hookloadKlbf: e.target.value })} /></label>
      <button type="button" onClick={bridge.calculate}>Calculate static compression assessment</button>
      <label>Reference surface hookload (klbf)<input type="number" min="0" step="any" value={reference?.context === bridge.referenceContext ? reference.klbf : ''} onChange={e => update({ klbf: e.target.value })} /></label>
      <label>Reference operating condition<select value={reference?.context === bridge.referenceContext ? reference.condition : ''} onChange={e => update({ condition: e.target.value })}><option value="">Select explicit reference condition</option><option value="stationary study">Stationary study reference</option><option value="pickup">Pickup reference</option><option value="pure rotation">Pure-rotation reference</option><option value="slackoff">Slack-off reference</option></select></label>
      <p>Session-only study values: net upward local axial string support at {fmt(number(bridge.surfaceMdFt))} ft MD, excluding suspended equipment. These are not rig measurements. An inclined reference requires local axial support. Operating conditions are distinct; their surface-load difference does not establish the change in jar force. No reference is copied from Hookload Calculations. BHA, survey or depth changes invalidate this reference.</p>
    </details>
    <details><summary>Why can the stuck-point reaction be negative?</summary><p>Positive force is compression; negative is tension. The rigid bilateral stuck boundary can transmit tension. Release/unloading and reflected elastic waves can make its total reaction tensile before impact-generated compression arrives. This is not proof of jar contact opening: opening and re-engagement are separate solver events at the jar. The signed total includes initial equilibrium; the incremental trace subtracts that equilibrium. Step discontinuities are retained, not smoothed. Contact traction and stuck-point reaction are different quantities.</p></details>
  </section>;
}
