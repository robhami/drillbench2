import React, { useEffect, useMemo, useState } from 'react';
import { useDemoPresentation, componentDisplayLabel } from '../../Components/DemoPresentation';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { importedGeometry } from '../JarClearance/clearanceData';
import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions';
import { solveStaticJarHookload } from '../../engineering/jar/inverseStaticJarLoads';
import { calcStaticJarLoads } from '../../engineering/jar/staticJarLoads';
import { calcOffBottomRotatingSummary } from '../../engineering/forces/calcOffBottomHookloads';
import { directionSettings, operatingAvailability } from './directionalJarConfig';
import { calcHookloadLimits, readMaximumHookload } from '../../engineering/jar/hookloadLimits';
import './JarForces.css';
import BucklingDetails from './BucklingDetails';
import { manufacturerLimitFields, readManufacturerLimit, compareManufacturerJarLimits } from '../../engineering/jar/manufacturerJarLimits';
import { validateSurveyCoverage } from '../../engineering/survey/surveyCoverage';
import { jarLoadingKey } from './jarLoadingInputs';

const text = v => v === undefined || v === null ? '' : String(v);
const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
// Suppress a displayed minus-zero below half the final klbf digit; raw loads stay unchanged.
const decimal = v => (Math.abs(v) < 0.05 ? 0 : v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const klbf = v => decimal(v / 1000);
const weightRows = [
  ['Total Deployed String', 'total', 'Entire deployed drillstring, including actual deployed DP and all fixed downhole components.'],
  ['Total BHA', 'totalBha', 'All fixed BHA components, including the complete jar, excluding automatically deployed drillpipe.'],
  ['Above Jar Centre', 'aboveJar', 'Entire deployed string above the selected jar centre, including deployed DP and the upper half of the selected jar.'],
  ['Below Jar Centre', 'belowJar', 'Entire string below the selected jar centre, including the lower half of the selected jar.'],
  ['Fixed BHA Above Jar', 'fixedAboveJar', 'Fixed assembly above the selected jar centre, including the upper half of the selected jar, excluding all deployed drillpipe. This is a subset of the above-jar row.']
];
const weightColumns = [
  ['Air Weight', 'Total weight before buoyancy correction.'],
  ['Buoyed Weight', 'Gravitational weight magnitude corrected for mud buoyancy, without inclination projection or frictional drag.'],
  ['Inclination Corrected', 'Buoyed weight corrected for well inclination, excluding frictional drag. Represents the axial component of weight along the wellbore.']
];
const operatingRows = [
  ['Pickup', 'pickupHookload', 'pickupDrag', 'Upward', 'Nonrotating off-bottom pickup with fully mobilised axial friction. Pickup drag equals pickup minus rotating hookload; resistance acts downhole.'],
  ['Rotating Off Bottom', 'rotatingHookload', null, 'Rotation only', 'Rotation at fixed depth with zero axial movement. The current model assumes zero axial frictional drag during pure rotation.'],
  ['Slack-Off', 'slackOffHookload', 'slackOffDrag', 'Downward', 'Nonrotating off-bottom lowering with fully mobilised axial friction. Slack-off drag equals rotating minus slack-off hookload; resistance acts uphole.']
];
const outputValue = output => output.valid ? klbf(output.valueLbf) : 'Unavailable';

function Parameter({ label, definition }) {
  return <th scope="row"><span>{label}</span>{' '}<span className="jarForcesInfo" tabIndex="0" role="note" aria-label={label + ': ' + definition} title={definition}>i</span></th>;
}

function ResultsTable({ title, children, columns = ['Parameter', 'Value (klbf)'] }) {
  return <table className={`jarForcesTable ${columns.length === 4 ? 'jarForcesFourColumns' : ''}`} aria-label={title}>
    <caption>{title}</caption>
    <thead><tr>{columns.map((column, i) => <th scope="col" key={i}>{column}</th>)}</tr></thead>
    <tbody>{children}</tbody>
  </table>;
}

export default function JarForces({ bha, analysisBitMdFt, updateRow, updateBha, rigLimits, updateRigLimits, surveyCoverage, surfaceReferenceMdFt, setSurfaceReferenceMdFt }) {
  const demoPresentation = useDemoPresentation();
  const source = useActiveSurvey(bha);
  const trajectoryDescription = source?.kind === 'generated-vertical'
    ? 'Generated vertical fallback (0° inclination; not a measured survey).'
    : source?.originalCsv ? `Associated survey: ${source.filename || source.origin || 'unnamed survey'}.`
      : 'No confirmed survey or explicit vertical fallback is available.';
  const survey = useMemo(() => importedGeometry(source), [source]);
  const jars = useMemo(() => calcComponentPositions(bha).components.filter(c => String(c.category).toUpperCase() === 'JAR'), [bha]);
  const [fields, setFields] = useState(() => ({ surface: surfaceReferenceMdFt ?? '0', jar: '0',
    direction: 'pickup', loadMode: 'absolute', hookload: '', reference: '', applied: '', jarDirection: 'up' }));
  const surface = surfaceReferenceMdFt === undefined ? fields.surface : surfaceReferenceMdFt;
  const jarRows = (bha?.rows || []).map((row, index) => ({ row, index })).filter(({ row }) => String(row.category).toUpperCase() === 'JAR' && Number(row.length) > 0);
  const selectedRow = jarRows[Number(fields.jar)];
  const settings = directionSettings(selectedRow?.row, fields.jarDirection);
  const availability = operatingAvailability(settings);
  const manufacturerLimits = selectedRow?.row.jarManufacturerLimits || {};
  const editable = Boolean(selectedRow && ((selectedRow.row.rowId != null && updateRow) || updateBha));
  const changeConfiguration = (direction, changes) => {
    if (!editable) return;
    const row = selectedRow.row;
    const jarDirections = { ...row.jarDirections, [direction]: { ...row.jarDirections?.[direction], ...changes } };
    if (row.rowId != null && updateRow) updateRow(row.rowId, { jarDirections });
    else updateBha({ rows: bha.rows.map((r, index) => index === selectedRow.index ? { ...r, jarDirections } : r) });
    setResult(null); setError('');
  };
  const [result, setResult] = useState(null), [error, setError] = useState('');
  const [loadingSnapshot, setLoadingSnapshot] = useState(null);
  const [bucklingSummary, setBucklingSummary] = useState(null);
  const changeManufacturerLimits = changes => {
    if (!editable) return;
    const patch = { jarManufacturerLimits: { ...manufacturerLimits, ...changes } };
    if (selectedRow.row.rowId != null && updateRow) updateRow(selectedRow.row.rowId, patch);
    else updateBha({ rows: bha.rows.map((row, index) => index === selectedRow.index ? { ...row, ...patch } : row) });
  };
  const coverage = useMemo(() => surveyCoverage || validateSurveyCoverage(survey, {
    startMdFt: finite(surface) ? Number(surface) : NaN,
    endMdFt: finite(analysisBitMdFt) ? Number(analysisBitMdFt) : NaN,
    calculations: ['string-weight projection', 'off-bottom hookloads', 'static/inverse jar loads', 'buckling screening']
  }), [surveyCoverage, survey, surface, analysisBitMdFt]);
  const dragSummary = useMemo(() => !coverage.covered ? {
    weights: { valid: false, errors: [] }, ...Object.fromEntries(['pickupHookload', 'rotatingHookload', 'slackOffHookload', 'pickupDrag', 'slackOffDrag'].map(key => [key, { valid: false }]))
  } : calcOffBottomRotatingSummary({ bha, survey, bitMdFt: analysisBitMdFt, surfaceMdFt: surface,
    mudWeightPpg: bha?.mudWeight, jarIndex: Number(fields.jar), frictionCoefficient: bha?.frictionCoefficient,
    rpm: bha?.rpm }),
  [bha, survey, analysisBitMdFt, surface, fields.jar, coverage]);
  const loadingKey = jarLoadingKey({ bha, survey, bitMdFt: analysisBitMdFt, surfaceMdFt: surface,
    jarIndex: Number(fields.jar), jarDirection: fields.jarDirection, targetForceKlbf: settings.targetForceKlbf,
    available: availability.enabled, covered: coverage.covered,
    rotatingHookloadLbf: dragSummary.rotatingHookload.valid ? dragSummary.rotatingHookload.valueLbf : null });
  // Gate results during render, before any effect: stale loads must never reach comparisons or buckling.
  const loadingCurrent = loadingSnapshot?.key === loadingKey;
  const loadingResult = loadingCurrent ? loadingSnapshot.result : null;
  const loadingError = loadingCurrent ? loadingSnapshot.error : '';
  const loadingDirty = Boolean(loadingSnapshot && (!loadingCurrent || loadingSnapshot.dirty));
  useEffect(() => {
    setLoadingSnapshot(previous => previous && previous.key !== loadingKey ? { key: loadingKey, result: null, error: '', dirty: true } : previous);
  }, [loadingKey]);
  const manufacturerChecks = compareManufacturerJarLimits({ limits: manufacturerLimits, direction: fields.jarDirection,
    targetForceLbf: finite(settings.targetForceKlbf) ? Number(settings.targetForceKlbf) * 1000 : null,
    calculatedJarAxialLoadLbf: loadingResult?.jarAxialLoadLbf, calculationToleranceLbf: loadingResult?.residualToleranceLbf, operationAvailable: availability.enabled });
  const weightSummary = dragSummary.weights;
  const supportingIssues = [...new Set([...(weightSummary.errors || []), ...['pickupHookload', 'rotatingHookload', 'slackOffHookload', 'pickupDrag', 'slackOffDrag'].map(key => dragSummary[key].reason).filter(Boolean)])];
  const maximumHookload = readMaximumHookload(rigLimits?.maximumAllowableHookloadKlbf);
  const limitCheck = calcHookloadLimits({ jarDirection: fields.jarDirection,
    maximumHookloadKlbf: rigLimits?.maximumAllowableHookloadKlbf,
    pickupHookloadLbf: dragSummary.pickupHookload.valid ? dragSummary.pickupHookload.valueLbf : null,
    requiredHookloadLbf: loadingResult?.requiredSurfaceHookloadLbf });
  useEffect(() => { setResult(null); setError(''); }, [bha, survey, analysisBitMdFt, coverage, surface]);
  useEffect(() => { if (jars.length === 1 || Number(fields.jar) >= jars.length) setFields(f => ({ ...f, jar: '0' })); }, [jars, fields.jar]);
  const update = (key, value) => { if (key === 'surface' && setSurfaceReferenceMdFt) setSurfaceReferenceMdFt(value); setFields(f => ({ ...f, [key]: value })); setResult(null); setError(''); };
  const numeric = (key, label) => <label>{label}<input type="number" min="0" step="any" value={key === 'surface' ? surface : fields[key]}
    readOnly={key === 'surface' && surfaceReferenceMdFt !== undefined && !setSurfaceReferenceMdFt} onChange={e => update(key, e.target.value)} /></label>;
  const calculate = e => {
    e.preventDefault();
    if (!coverage.covered) { setResult(null); setError(''); return; }
    if (!survey.valid) { setError(survey.errors.map(v => v.message).join(' ')); return; }
    const required = ['surface', ...(fields.loadMode === 'absolute' ? ['hookload'] : ['reference', 'applied'])];
    if (!finite(analysisBitMdFt) || required.some(key => !finite(key === 'surface' ? surface : fields[key])) || !finite(bha?.mudWeight) || !finite(bha?.frictionCoefficient)) { setError('Enter explicit finite values for all selected inputs; blank loads are not zero.'); return; }
    const calculated = calcStaticJarLoads({ bha, survey, bitMdFt: Number(analysisBitMdFt), surfaceMdFt: Number(surface), jarIndex: Number(fields.jar),
      mudWeightPpg: Number(bha?.mudWeight), frictionCoefficient: Number(bha?.frictionCoefficient), direction: fields.direction, loadMode: fields.loadMode,
      ...(fields.loadMode === 'absolute' ? { surfaceHookloadLbf: Number(fields.hookload) * 1000 } :
        { referenceHookloadLbf: Number(fields.reference) * 1000, appliedLoadLbf: Number(fields.applied) * 1000 }) });
    if (!calculated.valid) { setResult(null); setError(calculated.errors.join(' ')); return; }
    setResult(calculated); setError('');
  };
  const calculateLoading = e => {
    e.preventDefault();
    if (!coverage.covered) { setLoadingSnapshot({ key: loadingKey, result: null, error: '', dirty: loadingDirty }); return; }
    if (!availability.enabled) { setLoadingSnapshot({ key: loadingKey, result: null, error: availability.message, dirty: false }); return; }
    const solved = solveStaticJarHookload({ bha, survey, bitMdFt: analysisBitMdFt, surfaceMdFt: surface,
      mudWeightPpg: bha?.mudWeight, frictionCoefficient: bha?.frictionCoefficient, jarIndex: Number(fields.jar),
      jarDirection: fields.jarDirection, desiredJarForceLbf: finite(settings.targetForceKlbf) ? Number(settings.targetForceKlbf) * 1000 : settings.targetForceKlbf,
      rotatingHookloadLbf: dragSummary.rotatingHookload.valid ? dragSummary.rotatingHookload.valueLbf : null });
    setLoadingSnapshot({ key: loadingKey, result: solved.valid ? solved : null, error: solved.valid ? '' : solved.errors.join(' '), dirty: false });
  };
  return <section className="jarForces" aria-label="Hookload Calculations">
    {!coverage.covered && <p role="alert">{coverage.message}</p>}
    <h5>Hookload Calculations</h5>
    <p className="jarForcesNotice">Preliminary quasi-static screening, not operational guidance. Calculated static axial loads are not jar firing forces or manufacturer operating limits.</p>
    <p className="jarForcesDepthStatus" aria-live="polite">Analysis bit MD: {finite(analysisBitMdFt) ? decimal(Number(analysisBitMdFt)) + ' ft' : 'Required in Parameter Entry'} | Surface reference: {finite(surface) ? decimal(Number(surface)) + ' ft' : 'Unavailable'} | {weightSummary.valid ? 'Deployed string ready' : 'Incomplete / invalid inputs'}</p>
    <p className="jarForcesSharedStatus" role="status">Trajectory input: {trajectoryDescription}</p>

    {!jars.length && <p role="alert">No jar exists in the BHA. Add a jar before calculating jar loads.</p>}
    {jars.length === 1 && <p className="jarForcesSharedStatus">Selected jar: {componentDisplayLabel(jars[0], demoPresentation) || 'JAR'} (only jar in BHA).</p>}
    {jars.length > 1 && <label className="jarForcesJarSelect">Selected jar<select value={fields.jar} onChange={e => update('jar', e.target.value)}>{jars.map((jar, i) => <option key={i} value={i}>{componentDisplayLabel(jar, demoPresentation) || 'JAR'} {i + 1}</option>)}</select></label>}
    {!maximumHookload.valid && <p role="alert">{maximumHookload.reason}</p>}
    {limitCheck.insufficientPickupCapacity && <p role="alert">Insufficient pickup capacity: Maximum Allowable Hookload is below calculated Pickup Hookload.</p>}
    {fields.jarDirection === 'up' && maximumHookload.valid && !maximumHookload.configured && <p className="jarForcesSharedStatus">Rig hookload limit: Not Configured.</p>}
    <section aria-label="Jar Loading">
      <h6>Jar Operation</h6>
      <form onSubmit={calculateLoading} noValidate>
        <div className="jarForcesFields">
          <label>Target Force at Jar (klbf)<input type="number" min="0" step="any" value={settings.targetForceKlbf} disabled={!editable || settings.mechanism === 'unavailable'}
            onChange={e => changeConfiguration(fields.jarDirection, { targetForceKlbf: e.target.value })} /></label>
          <label>Jar direction<select value={fields.jarDirection} onChange={e => update('jarDirection', e.target.value)}><option value="up">Jar Up (tension)</option><option value="down">Jar Down (compression)</option></select></label>
        </div>
        <button className="jarForcesCalculate" type="submit" disabled={!finite(analysisBitMdFt) || !jars.length || !availability.enabled}>Calculate required hookload</button>
      </form>
      <p className="jarForcesSharedStatus" aria-live="polite">{availability.message}</p>
      {loadingError && <p role="alert">{loadingError}</p>}
      {!loadingResult && !loadingError && <p className="jarForcesPending" role="status">{loadingDirty ? 'Inputs changed — recalculate required hookload.' : 'Enter a target force and calculate the required surface hookload.'}</p>}
      {loadingResult && <ResultsTable title="Jar Loading Results" columns={['Parameter', 'Value']}>
        <tr><Parameter label="Desired jar force" definition="User-requested positive static force magnitude and direction, not a manufacturer firing threshold." /><td>{klbf(Math.abs(loadingResult.targetJarAxialLoadLbf))} klbf {loadingResult.jarDirection === 'up' ? 'Jar Up (tension)' : 'Jar Down (compression)'}</td></tr>
        <tr className="jarForcesPrimaryLoad"><Parameter label="Required surface hookload" definition="Nonnegative surface support verified through the forward static model; not a firing or equipment limit." /><td>{klbf(loadingResult.requiredSurfaceHookloadLbf)} klbf</td></tr>
      </ResultsTable>}
      <div className="jarForcesFields"><label>Maximum Allowable Rig Hookload (klbf)<input type="number" min="0" step="any"
        title="User-defined rig-level surface limit, separate from manufacturer jar limits; no rig rating is inferred."
        value={rigLimits?.maximumAllowableHookloadKlbf ?? ''} disabled={!updateRigLimits}
        onChange={e => updateRigLimits({ maximumAllowableHookloadKlbf: e.target.value })} /></label></div>
      {loadingResult && fields.jarDirection === 'up' && <ResultsTable title="Overpull & Hookload Limit" columns={['Parameter', 'Value']}>
        <tr><Parameter label="Required overpull" definition="Required surface hookload minus calculated pickup hookload; negative values are retained." /><td>{limitCheck.requiredOverpullLbf === null ? 'Unavailable' : klbf(limitCheck.requiredOverpullLbf) + ' klbf'}</td></tr>
        {maximumHookload.valid && maximumHookload.configured && <tr><Parameter label="Available overpull" definition="Maximum Allowable Hookload minus calculated pickup hookload." /><td>{limitCheck.availableOverpullLbf === null ? 'Unavailable' : klbf(limitCheck.availableOverpullLbf) + ' klbf'}</td></tr>}
        <tr><Parameter label="Remaining margin" definition="Maximum Allowable Hookload minus required surface hookload; negative means the surface limit is exceeded." /><td>{limitCheck.remainingMarginLbf === null ? 'Unavailable' : klbf(limitCheck.remainingMarginLbf) + ' klbf'}</td></tr>
        <tr><Parameter label="Surface limit status" definition="Comparison to the user-defined surface hookload limit only, not drillstring tensile safety or jar firing success." /><td>{limitCheck.status || 'Unavailable'}{limitCheck.reason && <small className="jarForcesUnavailable">{limitCheck.reason}</small>}</td></tr>
      </ResultsTable>}
      {fields.jarDirection === 'down' && <p className="jarForcesSharedStatus">Jar Down: no minimum hookload limit is applied. Buckling screening does not evaluate post-buckling force transmission.</p>}
      <ResultsTable title="Manufacturer Operating Status" columns={['Entered limit', 'Comparison']}>
        <tr><th scope="row">{fields.jarDirection === 'up' ? 'Upward jar load' : 'Requested compression'}</th><td>{manufacturerChecks.operating.status}</td></tr>
        <tr><th scope="row">Tensile through-load</th><td>{manufacturerChecks.tensile.status}</td></tr>
      </ResultsTable>
      {(manufacturerChecks.operating.status === 'Exceeds entered limit' || manufacturerChecks.tensile.status === 'Exceeds entered limit') && <p role="alert">Calculated jar load or requested target exceeds an entered manufacturer limit. Review Manufacturer Comparison Details.</p>}
      {[manufacturerChecks.operating, manufacturerChecks.tensile].some(check => check.status === 'Near entered limit — unresolved') && <p role="alert">Manufacturer-limit comparison is within numerical resolution; compliance is unresolved. No rating allowance is applied. Review Manufacturer Comparison Details.</p>}
      {loadingResult && fields.jarDirection === 'up' && limitCheck.status === 'Exceeds Limit' && !limitCheck.insufficientPickupCapacity && <p role="alert">Required surface hookload exceeds the entered rig maximum.</p>}
      {fields.jarDirection === 'down' && <div className="jarForcesBucklingStatus" role="status">
        <strong>Buckling evaluation: {bucklingSummary?.source === loadingResult ? bucklingSummary.status : 'Not Evaluated'}</strong>
        {bucklingSummary?.source === loadingResult && bucklingSummary.evaluatedLengthFt !== null && <span>Evaluated compressed length: {decimal(bucklingSummary.evaluatedLengthFt)} ft; unevaluated: {decimal(bucklingSummary.unevaluatedLengthFt)} ft.</span>}
        <span>Review Engineering Details for supported intervals, assumptions and exclusions. A target comparison does not establish transmission or stability.</span>
      </div>}
      <details><summary>Manufacturer Comparison Details</summary>
      <ResultsTable title="Manufacturer Limit Comparisons" columns={['Check', 'Load (klbf)', 'Limit (klbf)', 'Comparison']}>
        {[[fields.jarDirection === 'up' ? 'Upward jar load' : 'Requested compression', manufacturerChecks.operating], ['Tensile load at jar centre', manufacturerChecks.tensile]].map(([label, check]) =>
          <tr key={label}><th scope="row">{label}</th><td>{check.loadLbf === null ? 'Unavailable' : klbf(check.loadLbf)}</td><td>{check.valueLbf === null ? check.configured ? 'Invalid' : 'Not provided' : klbf(check.valueLbf)}</td><td>{check.status}{check.reason && <small className="jarForcesUnavailable">{check.reason}</small>}</td></tr>)}
      </ResultsTable>
      </details>
      <p className="jarForcesSharedStatus">Entered manufacturer limits only; no overall safety or firing assessment. A compression target comparison does not establish force transmission or buckling stability.</p>
      {loadingResult && <ul className="jarForcesWarnings">{loadingResult.warnings.filter(w => w.startsWith('The surface reference is inclined') || w.startsWith('Compression is propagated')).map(w => <li key={w}>{w}</li>)}</ul>}
    </section>
    <section aria-label="Jar Configuration">
      {coverage.covered && supportingIssues.length > 0 && <p role="status">Supporting calculations unavailable: {supportingIssues.join(' ')}</p>}
      <h6>Jar Configuration</h6>
      <div className="jarForcesFields">
        {['up', 'down'].map(direction => {
          const config = directionSettings(selectedRow?.row, direction), label = direction === 'up' ? 'Jar Up' : 'Jar Down';
          return <div className="jarForcesDirectionConfig" key={direction}>
            <label>{label} mechanism<select value={config.mechanism} disabled={!editable} onChange={e => changeConfiguration(direction, { mechanism: e.target.value })}>
              <option value="">Unconfigured</option><option value="hydraulic">Hydraulic</option><option value="mechanical">Mechanical</option><option value="unavailable">Not Available</option>
            </select></label>
            {config.mechanism === 'mechanical' && <label>{label} mechanical trip force (klbf)<input type="number" min="0" step="any" value={config.tripForceKlbf} disabled={!editable}
              title="Manufacturer-defined release setting for this direction; not a guaranteed firing force."
              onChange={e => changeConfiguration(direction, { tripForceKlbf: e.target.value })} /></label>}
          </div>;
        })}
      </div>
      <details><summary>Manufacturer Limits</summary>
        <div className="jarForcesFields">
          {manufacturerLimitFields.map((key, index) => <label key={key}>{[
            'Maximum upward jar-centre load (lbf)', 'Maximum downward jar-centre compression (lbf)', 'Maximum tensile load through jar (lbf)'
          ][index]}<input type="number" min="0" step="any" value={manufacturerLimits[key] ?? ''} disabled={!editable}
            onChange={e => changeManufacturerLimits({ [key]: e.target.value })} /></label>)}
        </div>
        {manufacturerLimits.maximumTensileLoadLbf !== undefined && manufacturerLimits.maximumTensileLoadLbf !== '' && <label>
          <input type="checkbox" checked={manufacturerLimits.tensileLoadBasis === 'jar-centre'} disabled={!editable}
            onChange={e => changeManufacturerLimits({ tensileLoadBasis: e.target.checked ? 'jar-centre' : '' })} />
          Manufacturer tensile limit explicitly applies at jar centre
        </label>}
        <p>Optional documented values for this jar only. Upward limit means total tensile axial load at jar centre, not an incremental surface overpull. Enter downward compression only when explicitly documented. Trip settings and rig hookload limits are separate.</p>
        <p>For a tensile rating covering the whole tool or an unspecified cross-section, leave the confirmation unchecked: the full through-jar load profile is unavailable.</p>
      </details>
      {manufacturerLimitFields.map(key => { const limit = readManufacturerLimit(manufacturerLimits[key]);
        return !limit.valid && <p role="alert" key={key}>{key}: {limit.reason}</p>;
      })}
      {selectedRow && !editable && <p role="status">Configuration is read-only: BHA update controls are unavailable.</p>}
    </section>
    <details className="jarForcesWeights"><summary>String Weight &amp; Operating Hookloads</summary>
    <section aria-label="String Weight & Drag Summary">
      <ResultsTable title="String Weight" columns={['Component', ...weightColumns.map(([label, definition]) => <span title={definition}>{label}<small>(klbf)</small></span>)]}>
        {weightRows.map(([label, key, definition]) => <tr key={key}><Parameter label={label} definition={definition} />
          {['airWeightLbf', 'buoyedWeightLbf', 'axialWeightLbf'].map(field => <td key={field}>{weightSummary.valid ? klbf(weightSummary.weightPartitions[key][field]) : 'Unavailable'}</td>)}
        </tr>)}
      </ResultsTable>
      <ResultsTable title="Operating Hookloads" columns={['Operation', <span title="Predicted surface load accounting for buoyancy, well inclination and frictional resistance under the selected operating condition.">Hookload<small>(klbf)</small></span>, <span title="Additional axial resistance generated by friction acting at wellbore contact points. Calculated relative to rotating off-bottom hookload.">Drag<small>(klbf)</small></span>, 'Direction']}>
        {operatingRows.map(([label, key, dragKey, direction, definition]) => {
          const load = dragSummary[key];
          const drag = dragKey ? dragSummary[dragKey] : load.valid ? { valid: true, valueLbf: load.axialDragLbf } : load;
          return <tr key={key}><Parameter label={label} definition={definition} /><td>{outputValue(load)}</td><td>{outputValue(drag)}</td><td>{direction}</td></tr>;
        })}
      </ResultsTable>
      {!weightSummary.valid && <p role="status">{weightSummary.errors.join(' ')}</p>}
      <p>Model predictions, not measured rig hookloads. Definitions: focus or hover over an information icon.</p>
    </section></details>
    <details><summary>Advanced - forward static calculator</summary>
    <form onSubmit={calculate} noValidate>
      <h6>Forward Static Inputs</h6>
      <div className="jarForcesFields">
        {numeric('surface', 'Surface reference MD (ft)')}
        <small>Surface reference defines the boundary for weights and both static calculators.</small>
        <label>Operation<select value={fields.direction} onChange={e => update('direction', e.target.value)}><option value="pickup">Pickup (upward)</option><option value="slackoff">Slack-off (downward)</option></select></label>
        <label>Load input<select value={fields.loadMode} onChange={e => update('loadMode', e.target.value)}><option value="absolute">Absolute surface hookload</option><option value="reference">Reference + applied change</option></select></label>
        {fields.loadMode === 'absolute' ? numeric('hookload', 'Surface hookload / axial support (klbf)') : <>
          {numeric('reference', 'Reference hookload (klbf)')}
          {numeric('applied', fields.direction === 'pickup' ? 'Applied surface overpull (klbf)' : 'Applied surface set-down (klbf)')}
        </>}
      </div>
      <button type="submit" disabled={!finite(analysisBitMdFt)}>Calculate static jar load</button>
    </form>
    {result && <section aria-label="Jar Force Results">
      <ResultsTable title="Jar Force Results">
        <tr className="jarForcesPrimaryLoad"><Parameter label="Jar-centre axial load" definition="Static model load at the jar centre: positive compression, negative tension." /><td>{klbf(result.jarAxialLoadLbf)} · {result.jarLoadState}</td></tr>
        <tr><Parameter label="Surface hookload" definition="Entered or reference-adjusted net upward string support." /><td>{klbf(result.surfaceHookloadLbf)} · {result.direction === 'pickup' ? 'pickup' : 'slack-off'}</td></tr>
        <tr><Parameter label="Friction resistance" definition="Calculated axial friction between surface and jar centre." /><td>{klbf(result.frictionResistanceLbf)} · acts {result.direction === 'pickup' ? 'downhole' : 'uphole'}</td></tr>
        <tr><Parameter label="Axial gravity above jar" definition="Inclination-projected buoyed gravity from surface to jar centre." /><td>{klbf(result.gravityAxialLbf)}</td></tr>
        <tr><Parameter label="Tensile / compressive load" definition="Magnitudes of the calculated tensile and compressive load components." /><td>{klbf(result.netUpwardTensileLoadLbf)} / {klbf(result.netDownwardCompressiveLoadLbf)}</td></tr>
        {result.loadMode === 'reference' && <>
          <tr><Parameter label="Reference jar load" definition="Jar load under the assumed frictionless reference hookload." /><td>{klbf(result.referenceJarAxialLoadLbf)}</td></tr>
          <tr><Parameter label="Incremental transferred load" definition="Change from the assumed reference jar load in the selected direction." /><td>{klbf(result.incrementalTransferredLoadLbf)} · {result.direction === 'pickup' ? 'upward tensile change' : 'downward compressive change'}</td></tr>
        </>}
      </ResultsTable>
      <p>Jar centre MD {decimal(result.jarMdFt)} ft · Deployed DP {decimal(result.deployment.deployedDpLengthFt)} ft · Surface-to-jar length {decimal(result.jarMdFt - result.surfaceMdFt)} ft.</p>

    </section>}
    </details>
    {error && <p role="alert">{error}</p>}
    {result && <ul className="jarForcesWarnings">{result.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
    <details><summary>Engineering Assumptions</summary>
    <p className="jarForcesSharedStatus">Shared Parameter Entry: mud {finite(bha?.mudWeight) ? text(bha.mudWeight) + ' ppg' : 'Unavailable'}, friction {finite(bha?.frictionCoefficient) ? text(bha.frictionCoefficient) : 'Unavailable'}, RPM {finite(bha?.rpm) ? text(bha.rpm) : 'Unavailable'}.</p>
      {loadingResult && <ul className="jarForcesWarnings">{loadingResult.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      <p>The rig limit check compares calculated surface hookload with a user-defined maximum only. Within Limit or At Limit does not establish drillstring tensile safety, component capacity, buckling stability, a safe operating envelope or jar firing success. Overpull is referenced to calculated pickup hookload, never rotating hookload. Negative overpull and margin are retained. Jar Down has no lower surface-load check.</p>
      <p>Directional mechanisms and mechanical trip settings are user-supplied manufacturer data. Meeting a static mechanical setting does not guarantee release. Hydraulic targets are applied loads, not fixed activation thresholds.</p>
      <p>Stage 4A does not predict hydraulic delay, impact force or energy, guaranteed release, rig maximum overpull, component tensile yield, sinusoidal or helical buckling limits, or a safe operating envelope.</p>
      <p>Off-bottom assumptions: zero bit/end load; friction coefficient μ = {finite(bha?.frictionCoefficient) ? text(bha.frictionCoefficient) : 'Unavailable'}. Pickup/slack-off use fully mobilised nonrotating axial friction. Rotation: {finite(bha?.rpm) ? text(bha.rpm) : 'Unavailable'} RPM, zero axial motion (0 ft/hr), fixed bit depth; ROP is not used. Pure rotation has zero axial friction; torque is not predicted. At an inclined surface reference, hookloads are local axial support.</p>
      <p>Soft-string predictions follow the imposed survey centreline and exclude bending/buckling, hydraulic pressure-end forces and non-string suspended equipment.</p>
      <p>The lower assembly is assumed to provide the necessary reaction.</p>
    </details>
    <details><summary>Calculation Details</summary>
      <p>Wellbore normal contact force is used to calculate frictional drag. Normal force is not added separately as an axial drag force.</p>
      {loadingResult && <ResultsTable title="Jar Loading Diagnostics" columns={['Parameter', 'Value']}>
        <tr><Parameter label="Jar-centre axial load" definition="Forward-verified static force: negative tension, positive compression." /><td>{klbf(loadingResult.jarAxialLoadLbf)} {'\u00b7'} {loadingResult.jarLoadState} (klbf)</td></tr>
        <tr><Parameter label="Difference from rotating" definition="Required hookload minus predicted pure-rotation off-bottom hookload; positive means more upward support." /><td>{loadingResult.differenceFromRotatingLbf === null ? 'Unavailable (rotating prediction unavailable)' : klbf(loadingResult.differenceFromRotatingLbf) + ' klbf'}</td></tr>
        <tr><Parameter label="Solver residual (lbf)" definition="Forward jar force minus signed target. Numerical residual, not a physical accuracy estimate." /><td>{decimal(loadingResult.residualLbf)}</td></tr>
        <tr><Parameter label="Solver status" definition="Status of the bounded inverse calculation and fresh forward verification." /><td>Forward verified</td></tr>
        <tr><Parameter label="Solver iterations / evaluations" definition="Bisection iterations and total forward model evaluations, including fresh verification." /><td>{decimal(loadingResult.iterations)} / {decimal(loadingResult.evaluations)}</td></tr>
        <tr><Parameter label="Integration step (ft)" definition="Final forward solver step bound; existing curved-section convergence checks remain active." /><td>{decimal(loadingResult.forwardResult.convergence.maxStepFt)}</td></tr>
      </ResultsTable>}
      <p>Jar Up targets negative jar force on pickup; Jar Down targets positive force on slack-off. Required hookload is found by bounded search over nonnegative surface support, then verified with a fresh forward calculation. Default force residual tolerance: 0.01 lbf. This is a numerical consistency check, not a physical accuracy estimate or firing threshold.</p>
      <p>Positive axial load = compression; negative = tension. Zero axial load is the neutral point.</p>
      <p>For an element integrated uphole: pickup C_top = C_bottom - G - mu*N; slack-off C_top = C_bottom - G + mu*N. Normal contact is resolved separately for each direction. Static jar-force calculations use the entered surface-hookload boundary.</p>
      <p>Focus or hover over an information icon for its full definition. Model predictions are not measured rig hookloads. Actual hookload is the entered or reference-adjusted surface load in Advanced; it is not used to calculate predicted hookloads.</p>
      {fields.loadMode === 'reference' && <p>Reference jar load uses an assumed frictionless baseline, not an actual measured parked state. A measured reference hookload does not determine parked jar load uniquely.</p>}
      <p>Hookload is net upward support of the string, excluding suspended equipment. At an inclined surface reference enter local axial tensile support.</p>
      <p>Calculated static loads do not predict firing, impact, impulse, stroke or time delay. No manufacturer firing thresholds are assumed.</p>
      {result && <>
        <p>Force-balance residual: {decimal(result.equilibriumResidualLbf)} lbf. {result.convergence.checked ? `Curved step refinement difference: ${decimal(result.convergence.differenceLbf)} lbf; tolerance ${decimal(result.convergence.toleranceLbf)} lbf; final step bound ${decimal(result.convergence.maxStepFt)} ft.` : 'No curved friction refinement required.'}</p>
</>}
    </details>
    <details><summary>Engineering Details</summary>
      <BucklingDetails bha={bha} survey={survey} bitMdFt={analysisBitMdFt} surfaceMdFt={surface}
        jarIndex={Number(fields.jar)} jarDirection={fields.jarDirection} loadingResult={loadingResult} onSummary={setBucklingSummary} />
    </details>
  </section>;
}
