import { impactInputDefaults } from './impactInputs';
import JarModeLayout, { JarCalculationResults, JarResetButton } from './JarModeLayout';
import { compatibleTargetReference } from '../../engineering/research/targetJarDownReferences';
import { displayNumber, displayJarCompression, displayEventTime, surfaceDifferenceLabel, targetBucklingStatus, targetTimings, targetForcePlot } from './targetJarDownPresentation';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { importedGeometry } from '../JarClearance/clearanceData';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { researchExample, researchEvents } from './jarDownResearchData';
import { JAR_HISTORY_HEIGHT, unifiedJarHistoryPlot } from './jarHistoryPresentation';
const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));
const fmt = (n, digits = 3) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : 'Unavailable';
const initialNotice = 'Enter target compression to calculate';
const researchDefaults = () => {
  const p = researchExample();
  return { youngsModulusPsi: p.upperRods[0].youngsModulusPsi, densitySlugFt3: p.upperRods[0].densitySlugFt3,
    gravityFtS2: p.gravityFtS2, horizonS: p.horizonS };
};

export default function JarDownTargetWorkflow({ bha, values, analysisBitMdFt, surfaceReferenceMdFt, children, onReset, onChange }) {
  const [localValues, setLocalValues] = useState(values);
  const [valuesSource, setValuesSource] = useState(values);
  if (valuesSource !== values) { setValuesSource(values); setLocalValues(values); }
  const operating = onChange ? values : localValues;
  const changeGeometry = (key, value) => onChange ? onChange(key, value) : setLocalValues(previous => ({ ...previous, [key]: value }));
  const [target, setTarget] = useState(''), [reference, setReference] = useState('');
  const source = useActiveSurvey(bha);
  const [referenceChoice, setReferenceChoice] = useState({ id: '' });
  const [settings, setSettings] = useState(researchDefaults);
  const [request, setRequest] = useState(null), [staticSnapshot, setStatic] = useState(null), [dynamicSnapshot, setDynamic] = useState(null);
  const [notice, setNotice] = useState(initialNotice);
  const [acceptedInitial, setAcceptedInitial] = useState(false), [resetEpoch, setResetEpoch] = useState(0);
  const [visible, setVisible] = useState({ total: true, cumulative: false, free: false, incremental: false });
  const [selected, setSelected] = useState('');
  const sequence = useRef(0);
  const activeWorker = useRef(null), hasCalculated = useRef(false);
  const survey = useMemo(() => importedGeometry(source), [source]), depth = analysisDepth(bha);
  const bitMdFt = analysisBitMdFt ?? (depth.valid ? depth.bitMdFt : '');
  const surfaceMdFt = surfaceReferenceMdFt ?? '0';
  const input = { bha, survey, bitMdFt, surfaceMdFt, targetKlbf: target, settings: { ...settings, strokeIn: operating.strokeIn, stuckPointFt: operating.stuckPointFt } };
  const key = JSON.stringify({ input, source }), upstream = JSON.stringify({ bha, source, bitMdFt, surfaceMdFt });
  const previousKey = useRef(key), previousUpstream = useRef(upstream);
  const current = staticSnapshot?.key === key ? staticSnapshot : null;
  const dynamic = current && dynamicSnapshot?.key === key && dynamicSnapshot.staticId === current.id ? dynamicSnapshot.result : null;
  const pending = request?.key === key;
  useEffect(() => {
    if (previousKey.current !== key) {
      previousKey.current = key; setReferenceChoice(previous => previous.id === 'manual' ? previous : { id: '' }); setStatic(null); setDynamic(null); setRequest(null); setAcceptedInitial(false);
      setNotice(hasCalculated.current ? 'Inputs changed — calculate again. Previous static and confirmed research results are stale.' : initialNotice);
    }
    if (previousUpstream.current !== upstream) { previousUpstream.current = upstream; setReference(''); setReferenceChoice({ id: '' }); }
  }, [key, upstream]);
  useEffect(() => {
    if (!request || request.key !== key) return undefined;
    let active = true, worker;
    (async () => { try {
      const { createTargetJarDownWorker } = await import('./createTargetJarDownWorker');
      if (!active || request.id !== sequence.current) return;
      worker = createTargetJarDownWorker();
      activeWorker.current = worker;
      worker.onmessage = e => {
        if (!active || request.id !== sequence.current) return;
        if (request.kind === 'static') setStatic({ key: request.key, id: request.id, result: e.data });
        else setDynamic({ key: request.key, staticId: request.staticId, result: e.data });
        setRequest(null); setNotice(e.data.valid ? '' : (e.data.errors || [e.data.error]).join(' '));
      };
      worker.onerror = event => { event?.preventDefault?.(); if (active && request.id === sequence.current) { setRequest(null); setNotice('Calculation failed; no new results are available. Reload the page and calculate again if the worker could not load.'); } };
      worker.postMessage(request);
    } catch (error) { if (active && request.id === sequence.current) { setRequest(null); setNotice(`Calculation unavailable: ${error.message}`); } } })();
    return () => { active = false; worker?.terminate(); if (activeWorker.current === worker) activeWorker.current = null; };
  }, [request, key]);
  function calculate(e) {
    e.preventDefault(); if (pending) return;
    if (current?.result.valid && current.result.dynamicInput && acceptedInitial && !dynamic?.valid) { confirm(); return; }
    hasCalculated.current = true; setAcceptedInitial(false);
    if (referenceChoice.id !== 'manual') setReferenceChoice({ id: '' }); setStatic(null); setDynamic(null); setSelected(''); setNotice('Calculating required surface loading…');
    setRequest({ key, id: ++sequence.current, kind: 'static', input });
  }
  function confirm() {
    if (!current?.result.valid || !current.result.dynamicInput || !acceptedInitial || pending) return;
    setDynamic(null); setSelected(''); setNotice('Calculating explicitly confirmed idealised response…');
    setRequest({ key, id: ++sequence.current, staticId: current.id, kind: 'dynamic', staticOutcome: current.result, input, confirmed: true });
  }
  function reset() {
    // Bump synchronously before state updates: even an already queued worker
    // callback cannot restore a pre-reset snapshot.
    sequence.current += 1; activeWorker.current?.terminate(); activeWorker.current = null;
    hasCalculated.current = false;
    const defaults = researchDefaults();
    previousKey.current = JSON.stringify({ input: { ...input, targetKlbf: '', settings: { ...defaults, strokeIn: impactInputDefaults.down.strokeIn, stuckPointFt: impactInputDefaults.down.stuckPointFt } }, source });
    setLocalValues({ ...impactInputDefaults.down });
    setTarget(''); setReference(''); setReferenceChoice({ id: '' }); setSettings(defaults);
    setStatic(null); setDynamic(null); setRequest(null); setAcceptedInitial(false); setNotice(initialNotice);
    setVisible({ total: true, cumulative: false, free: false, incremental: false }); setSelected('');
    setResetEpoch(value => value + 1); onReset?.();
  }
  const s = current?.result, inverse = s?.valid ? s.inverse : null;
  const candidates = (s?.referenceCandidates || []).filter(r => compatibleTargetReference(r, input));
  const chosen = referenceChoice.staticId === current?.id ? candidates.find(r => r.id === referenceChoice.id) : null;
  const manualReference = referenceChoice.id === 'manual' && String(reference).trim() !== '' && Number.isFinite(Number(reference)) && Number(reference) >= 0 ? Number(reference) * 1000 : null;
  const referenceLbf = chosen?.valueLbf ?? manualReference;
  const slackoffLbf = inverse && referenceLbf !== null ? referenceLbf - inverse.requiredSurfaceHookloadLbf : null;
  const plot = useMemo(() => dynamic?.valid ? unifiedJarHistoryPlot(targetForcePlot(dynamic, visible, selected)) : null, [dynamic, visible, selected]);
  const events = useMemo(() => researchEvents(dynamic), [dynamic]);
  const timings = targetTimings(dynamic), buckling = targetBucklingStatus(s);
  const hasContact = dynamic?.valid && dynamic.contact.transitions.some(e => e.type === 'engage');
  const restrictions = [...new Set([...(s?.limitations || []), ...(inverse?.forwardResult?.warnings || []), ...(dynamic?.assessment?.limitations || []), ...(s?.buckling?.warnings || []),
    'Ideal straight, axially guided elastic rods; static directional friction does not establish dynamic compression transfer.',
    'Jar span and internal mass are excluded; scalar initial compression does not transfer the complete static stress state.',
    'Rigid bilateral stuck boundary can transmit tension; no compliant stuck-point response is established.',
    'No validated manufacturer firing characteristics, hydraulic damping or real tool release mechanism.',
    'No instrumented-tool, experimental or field validation.'])];
  return <JarModeLayout className="jarDownTarget" label="Target compression Jar Down workflow"
    warningClassName="jarTargetResearchStatus" graphClassName="jarTargetGraph" graphLabel="Signed stuck-point reaction versus time"
    detailsClassName="jarTargetAdvanced" detailsResetKey={resetEpoch}
    inputs={<form noValidate onSubmit={calculate} className="jarTargetControls jarPrimaryInputs">
      <label>Downward jar stroke (in)<input type="number" min="0" step="any" value={operating.strokeIn} onChange={e => changeGeometry('strokeIn', e.target.value)} /></label>
      <label>Target compression at jar (klbf)<input type="number" step="any" value={target} onChange={e => setTarget(e.target.value)} /></label>

      <label>Stuck-point position (ft above bit)<input type="number" min="0" step="any" value={operating.stuckPointFt} onChange={e => changeGeometry('stuckPointFt', e.target.value)} /></label>
      <span className="jarDownActions"><button type="submit" disabled={Boolean(pending)}>Calculate Jar Down</button>
      <JarResetButton mode="Down" onClick={reset} /></span>
    </form>}
    graph={<><div className={`jarTargetStatus ${!plot ? 'jarGraphInstruction' : ''}`} role="status">
      {notice && notice !== initialNotice && <p>{notice}</p>}
      {!plot && !s?.valid && !pending && <p>{initialNotice}</p>}
      {s?.valid && <>
        {!s.dynamicInput && <p>Static-only result: {s.dynamicErrors.join(' ')}</p>}
        {s.dynamicInput && !dynamic?.valid && <><label className="jarInitialConfirmation"><input type="checkbox" disabled={Boolean(pending)} checked={acceptedInitial} onChange={event => setAcceptedInitial(event.target.checked)} />Use target as prescribed research initial compression</label><p>Confirm, then select Calculate Jar Down. This does not establish jar firing.</p></>}
      </>}
    </div>
    {plot && <>
      <div className="jarTargetPlot">{Object.values(visible).some(Boolean) ? <Suspense fallback={<p>Loading force history…</p>}><Plot {...plot} plotHeight={JAR_HISTORY_HEIGHT} /></Suspense> : <p>All target-run traces are hidden. Enable a trace in Engineering Details.</p>}</div>
      <p className="jarImpactCaption">Time zero: ideal latch release · Compression positive · Impulse: signed total reaction.</p>
    </>}</>}
    results={<JarCalculationResults className="jarTargetResults" rows={[
      ['Required surface support', inverse ? `${displayNumber(inverse.requiredSurfaceHookloadLbf / 1000)} klbf` : '—'],
      ['Calculated static jar compression', inverse ? `${displayJarCompression(inverse.jarAxialLoadLbf)} klbf` : '—'],
      ['Peak stuck-point force', hasContact ? `${displayNumber(Math.max(0, dynamic.observation.peakTotalCompressionLbf) / 1000)} klbf` : dynamic?.valid ? 'Unavailable — no contact' : '—'],
      ['Signed reaction impulse', dynamic?.valid ? `${displayNumber(dynamic.observation.totalLbfS, 0)} lbf·s` : '—']
    ]} />}
    details={<><p>PRELIMINARY — NOT FOR OPERATIONAL USE</p>
      <p className="jarImpactCaption">{bha?.name || bha?.id || 'Current BHA'} · Nonrotating slack-off. Net upward local axial support at {surfaceMdFt} ft MD, excluding suspended equipment; model boundary, not a rig measurement.</p>
      <label>Reference surface hookload (klbf)<input type="number" min="0" step="any" placeholder="Optional" title={`Net upward local axial support at ${surfaceMdFt} ft MD, excluding suspended equipment; see Engineering Details for compatible reference sources.`} value={chosen ? chosen.valueLbf / 1000 : reference} onChange={e => { setReference(e.target.value); setReferenceChoice({ id: 'manual' }); }} /></label>
      <label>Reference hookload source<select value={referenceChoice.id} onChange={e => setReferenceChoice({ id: e.target.value, staticId: current?.id })}><option value="">Select reference hookload</option><option value="manual">Manually entered reference</option>{candidates.map(r => <option key={r.id} value={r.id} title={`${r.bhaName}; ${source?.filename || 'current confirmed survey'}; ${r.boundaryDefinition}; ${r.surfaceMdFt} ft MD`}>{displayNumber(r.valueLbf / 1000)} klbf — {r.sourceModule} — {r.condition}</option>)}</select></label>
      {chosen && <p className="jarImpactCaption">Selected reference: {chosen.sourceModule}, {displayNumber(chosen.valueLbf / 1000)} klbf; {chosen.condition}; {chosen.bhaName}; {source?.filename || 'current confirmed survey'}; net upward local axial support at {chosen.surfaceMdFt} ft MD.</p>}
      {inverse && <dl className="jarPerformanceResults"><div><dt>Target jar compression</dt><dd>{displayJarCompression(inverse.targetJarAxialLoadLbf)} klbf</dd></div></dl>}
      {inverse && <p>{Number.isFinite(slackoffLbf) ? surfaceDifferenceLabel(slackoffLbf) : 'Slackoff: Select reference hookload'}</p>}
      <p><strong>Static feasibility:</strong> {inverse ? 'Target established' : pending ? 'Calculating' : 'Not established'} · <strong>Buckling:</strong> {buckling}.</p>
      {s?.valid && <p>Jar {inverse.forwardResult.jarName}, {fmt(inverse.forwardResult.jarMdFt)} ft MD. Absence of a warning does not prove stability.</p>}
      <details className="jarTargetWhy"><summary>Why this result is limited</summary><ul>{restrictions.map(t => <li key={t}>{t}</li>)}</ul></details>
      {dynamic?.valid && <>
        <p>Stage 5C.9 dynamics · BHA-derived rods · explicitly confirmed initial compression {fmt(s.dynamicInput.compressionLbf / 1000, 6)} klbf. The displayed peak and average are total stuck-boundary reactions, including the prescribed baseline, not jar impact forces or manufacturer ratings.</p>
        <div className="jarTargetTimings"><span>First hammer/anvil impact: {Number.isFinite(timings.impactS) ? displayEventTime(timings.impactS) : 'No impact within horizon'}</span><span>First stuck-point reaction arrival: {displayEventTime(timings.reactionS)}</span></div>
        <p>Average signed stuck-point reaction: {displayNumber(dynamic.observation.averageTotalCompressionLbf / 1000)} klbf.</p>
        <p>Signed reaction integrated over [{fmt(dynamic.observation.startS * 1000)}, {fmt(dynamic.observation.endS * 1000)}) ms; no unique primary interval. {hasContact ? 'Contact resolved in the simulation horizon.' : 'No contact within the simulation horizon; this reaction is not an impact-force prediction.'} Negative reaction represents tension at the idealised fixed stuck boundary, not negative jar compression.</p>
      </>}
      <p>Normal results: inverse static jar-load calculation → existing forward static BHA verification; confirmed dynamics → Stage 5C.9 idealised solver. Surface-load difference is not compression delivered to the jar.</p>
      {dynamic?.valid && <details><summary>Target-run traces and event timeline</summary>
        <div className="jarResearchToggles">{[['total', 'Signed total reaction'], ['cumulative', 'Cumulative signed total impulse'], ['free', 'Matched no-contact reaction'], ['incremental', 'Increment from equilibrium']].map(([k, label]) => <label key={k}><input type="checkbox" checked={visible[k]} onChange={e => setVisible({ ...visible, [k]: e.target.checked })} />Target trace: {label}</label>)}</div>
        <label>Target-run solver event<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">No event highlight</option>{events.map(e => <option key={e.id} value={e.id}>{fmt(e.timeS * 1000)} ms — {e.label}</option>)}</select></label>
        <p>Jar contact and returning waves occur at the jar; reaction fronts occur at the stuck boundary. All times come from this target-run solver result. Impulse is signed total reaction, not positive-only area or proof of contact.</p>
      </details>}
      <fieldset><legend>Target-workflow ideal research assumptions</legend><p>Material/gravity/time assumptions below retain the existing independent research defaults; they are not inferred steel properties or tool performance. Geometry comes only from the current deployed BHA. Review stroke and stuck point in static preparation below. Changes invalidate the target workflow.</p>
        <div className="jarPerformanceInputs">{[['youngsModulusPsi', "Workflow Young's modulus (psi)"], ['densitySlugFt3', 'Workflow material density (slug/ft³)'], ['gravityFtS2', 'Workflow axial gravity (ft/s²)'], ['horizonS', 'Workflow simulation horizon (s)']].map(([k, label]) => <label key={k}>{label}<input type="number" step="any" value={settings[k]} onChange={e => setSettings({ ...settings, [k]: e.target.value })} /></label>)}</div>
      </fieldset>
      {s?.valid && <details><summary>Static boundary provenance and applicability</summary><p>solveStaticJarHookload → calcStaticJarLoads; residual {fmt(inverse.residualLbf, 6)} lbf; tolerance {fmt(inverse.residualToleranceLbf)} lbf. Nonnegative absolute local axial support, slack-off branch. BHA {bha?.name || bha?.id}; bit {bitMdFt} ft MD; surface {surfaceMdFt} ft MD.</p><p>Optional calculated reference: calcOffBottomRotatingSummary, the Hookload Calculations engine, recalculated for this BHA, survey and depth. Only its nonrotating, zero-end-load slack-off branch is offered; pickup and rotating conditions are not substituted.</p>{!candidates.length && <p>No compatible calculated reference: {s.referenceUnavailable || 'The current boundary or context is incompatible.'} Manual reference entry remains available.</p>}<p>Full assumptions and screening warnings are in Why this result is limited above.</p></details>}
      {children}</>}
  />;
}
