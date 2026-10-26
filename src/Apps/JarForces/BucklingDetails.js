import React, { useEffect, useMemo, useState } from 'react';
import { evaluateConfirmedDpBuckling } from '../../engineering/jar/confirmedDpBuckling';

const display = value => value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function BucklingDetails({ bha, survey, bitMdFt, surfaceMdFt, jarIndex, jarDirection, loadingResult }) {
  const pipes = (bha?.rows || []).map((row, index) => ({ row, index })).filter(({ row }) => row.category === 'DP');
  const [selection, setSelection] = useState('');
  const selected = pipes.length === 1 ? pipes[0] : pipes.find(({ row, index }) => String(row.rowId ?? index) === selection);
  const [modulus, setModulus] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  // Include deployment-sensitive depth and all selected-component geometry/data.
  // Any change requires a fresh explicit confirmation, including changing back.
  const signature = JSON.stringify([bha?.id, bha?.name, selected?.index, selected?.row, bha?.holeSize,
    bitMdFt, surfaceMdFt, modulus, bha?.rows?.filter(r => r.category !== 'DP').map(r => [r.rowId, r.category, r.length])]);
  useEffect(() => { setConfirmation(null); }, [signature]);
  const confirmed = confirmation === signature;
  const result = useMemo(() => {
    if (jarDirection !== 'down') return { valid: false, status: 'Not Evaluated', reason: 'Buckling screening requires Jar Down.' };
    if (!loadingResult) return { valid: false, status: 'Not Evaluated', reason: 'Calculate the current Jar Down surface hookload first.' };
    return evaluateConfirmedDpBuckling({ bha, survey, bitMdFt, surfaceMdFt, jarIndex,
      direction: 'slackoff', surfaceHookloadLbf: loadingResult.requiredSurfaceHookloadLbf,
      mudWeightPpg: bha?.mudWeight, frictionCoefficient: bha?.frictionCoefficient,
      selectedDpIndex: selected?.index, youngsModulusPsi: modulus, confirmed });
  }, [bha, survey, bitMdFt, surfaceMdFt, jarIndex, jarDirection, loadingResult, selected?.index, modulus, confirmed]);
  const onset = key => {
    if (!result.valid || !result.summary.applicableIntervalCount) return 'Not Evaluated';
    const value = result.summary[key];
    if (!value) return 'Not reached in evaluated intervals';
    return `${value.atIntervalTop ? 'Already exceeded at ' : ''}${display(value.mdFt)} ft MD`;
  };
  return <section aria-label="Buckling screening">
    <h6>Drillpipe Buckling Screening</h6>
    <div className="jarForcesFields">
      {pipes.length > 1 && <label>Drillpipe section<select value={selection} onChange={e => setSelection(e.target.value)}>
        <option value="">Select drillpipe</option>{pipes.map(({ row, index }) => <option key={row.rowId ?? index} value={row.rowId ?? index}>{row.toolName || 'DP'} (row {index + 1})</option>)}
      </select></label>}
      <label>Young's Modulus E (psi)<input type="number" min="0" step="any" value={modulus} onChange={e => setModulus(e.target.value)} /></label>
    </div>
    {modulus !== '' && (!Number.isFinite(Number(modulus)) || Number(modulus) <= 0) && <p role="alert">Young's modulus must be positive and finite.</p>}
    {!pipes.length && <p role="status">No drillpipe section exists.</p>}
    {selected && <p>Selected drillpipe: {selected.row.toolName || 'DP'} (row {selected.index + 1}).</p>}
    <label className="jarForcesBucklingConfirmation"><input type="checkbox" checked={confirmed} disabled={!selected}
      onChange={e => setConfirmation(e.target.checked ? signature : null)} /> Treat selected drillpipe as uniform tubular for buckling screening</label>
    <p>Session-only inputs; closing or reloading requires reconfirmation. Geometry, deployment, Bit Size or modulus changes invalidate confirmation.</p>
    <table className="jarForcesTable" aria-label="Buckling summary"><caption>Buckling Summary</caption><tbody>
      <tr><th scope="row">Evaluation status</th><td>{result.status}</td></tr>
      <tr><th scope="row">First sinusoidal onset MD</th><td>{onset('firstSinusoidalOnset')}</td></tr>
      <tr><th scope="row">First helical onset MD</th><td>{onset('firstHelicalOnset')}</td></tr>
      <tr><th scope="row">Maximum sinusoidal utilization</th><td>{result.valid && result.summary.maximumSinusoidalUtilization !== null ? display(result.summary.maximumSinusoidalUtilization) : 'Not Evaluated'}</td></tr>
      <tr><th scope="row">Evaluated compressed length</th><td>{result.valid ? display(result.evaluatedCompressedLengthFt) + ' ft' : 'Not Evaluated'}</td></tr>
      <tr><th scope="row">Unevaluated compressed length</th><td>{result.valid ? display(result.unevaluatedCompressedLengthFt) + ' ft' : 'Not Evaluated'}</td></tr>
    </tbody></table>
    {result.reason && <p role="status">{result.reason}</p>}
    {result.valid && <>
      <p>Evaluated depth interval: {display(result.calculated.evaluatedDepthInterval.topMdFt)} to {display(result.calculated.evaluatedDepthInterval.bottomMdFt)} ft MD (surface to jar centre).</p>
      <ul>{result.exclusions.map((e, i) => <li key={i}>{e.componentId}: {display(e.topMdFt)}–{display(e.bottomMdFt)} ft MD: {e.reasons}</li>)}</ul>
    </>}
    <p>Confirmation accepts the long, uniform, initially straight, zero-torque, frictionless-onset idealization for the selected DP only. Short integration samples are not independent buckling specimens. Finite-length/end-restraint validity is not established. Straight inclined criteria exclude vertical and curved sections; no criteria extend across component boundaries.</p>
    <p>The unchanged nonrotating slack-off pre-buckling load profile is used. No post-buckling redistribution, lock-up, failure, firing or safe Jar Down force is predicted. Already exceeded at an interval entry is not a located crossing in an unsupported uphole section.</p>
  </section>;
}
