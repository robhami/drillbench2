import JarModeLayout, { JarDirectionTabs, JarCalculationResults, JarResetButton } from './JarModeLayout';
import JarDownTargetWorkflow from './JarDownTargetWorkflow';
import React, { lazy, Suspense, useId, useMemo, useState } from 'react';
import { calculateJarPerformance } from './skeemPerformance';
import { samplePrimaryForceHistory, primaryForcePlot } from './primaryForceHistory';
import { JAR_HISTORY_HEIGHT, unifiedJarHistoryPlot } from './jarHistoryPresentation';
import JarDownPreparation from './JarDownPreparation';
import { readImpactInputs, impactInputDefaults } from './impactInputs';
import './JarPerformance.css';

const fmt = (value, digits = 2) => value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));
const JarDownResearch = lazy(() => import('./JarDownResearch'));

export default function JarPerformance({ bha, updateBha, analysisBitMdFt, surfaceReferenceMdFt }) {
  const read = () => ({ bhaId: bha?.id, source: bha?.jarImpactInputs, up: readImpactInputs(bha, 'up'), down: readImpactInputs(bha, 'down') });
  const [inputs, setInputs] = useState(read);
  // Reset during render so switching/loading BHAs cannot expose another BHA's inputs.
  if (inputs.bhaId !== bha?.id || inputs.source !== bha?.jarImpactInputs) setInputs(read());
  const current = inputs.bhaId === bha?.id && inputs.source === bha?.jarImpactInputs ? inputs : read();
  const operating = current.up;
  const changeInput = (which, key, value) => {
    const next = { ...current[which], [key]: value };
    setInputs({ ...current, [which]: next });
    updateBha?.({ jarImpactInputs: { ...bha?.jarImpactInputs, version: 1, [which]: next } });
  };
  const [direction, setDirection] = useState('up'), [showCumulative, setShowCumulative] = useState(false);
  const [research, setResearch] = useState(false);
  const [visitedDown, setVisitedDown] = useState(false);
  const tabId = useId();
  const selectDirection = mode => { if (mode === 'down') setVisitedDown(true); setDirection(mode); };
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [upResetEpoch, setUpResetEpoch] = useState(0);
  function resetUp() {
    // Calculation UI only: do not write defaults into saved BHA metadata.
    setInputs({ ...current, up: { ...impactInputDefaults.up } });
    setShowCumulative(false); setShowAnnotations(false);
    setUpResetEpoch(value => value + 1);
  }
  const result = useMemo(() => direction === 'up' ? calculateJarPerformance(bha, operating) : { valid: false, error: 'Jar Down impact prediction is not yet validated.' }, [bha, operating, direction]);
  const history = useMemo(() => samplePrimaryForceHistory(result), [result]);
  const plot = useMemo(() => {
    if (!history.valid) return null;
    const p = unifiedJarHistoryPlot(primaryForcePlot(history, showCumulative));
    return { ...p, layout: { ...p.layout, annotations: showAnnotations ? p.layout.annotations : [] } };
  }, [history, showCumulative, showAnnotations]);
  const fields = [['strokeIn', 'Jar stroke (in)'], ['overpullKlbf', 'Overpull at jar (klbf)'], ['stuckPointFt', 'Stuck-point position (ft above bit)']];
  return <section aria-label="Jar Performance" className="jarPerformance" style={{ margin: 0 }}>
    <JarDirectionTabs value={direction} onChange={selectDirection} idPrefix={tabId} />
    <div role="tabpanel" id={`${tabId}-panel-down`} aria-labelledby={`${tabId}-tab-down`} hidden={direction !== 'down'}>
      {visitedDown && <JarDownTargetWorkflow key={bha?.id} bha={bha} values={current.down} analysisBitMdFt={analysisBitMdFt} surfaceReferenceMdFt={surfaceReferenceMdFt} onChange={(key, value) => changeInput('down', key, value)} onReset={() => { setInputs({ ...current, down: { ...impactInputDefaults.down } }); setResearch(false); }}>
      <button type="button" onClick={() => setResearch(true)}>Explore Idealised Jar Down Dynamics</button>
      {research ? <Suspense fallback={<div role="status">Loading isolated research view...</div>}><JarDownResearch key={bha?.id} bha={bha} analysisBitMdFt={analysisBitMdFt} surfaceReferenceMdFt={surfaceReferenceMdFt} onExit={() => setResearch(false)} /></Suspense> : <JarDownPreparation primaryGeometry bha={bha} values={current.down} onChange={(key, value) => changeInput('down', key, value)} />}
    </JarDownTargetWorkflow>}
    </div>
    <div role="tabpanel" id={`${tabId}-panel-up`} aria-labelledby={`${tabId}-tab-up`} hidden={direction !== 'up'}>
      {direction === 'up' && <JarModeLayout graphClassName="jarImpactGraph" graphLabel="Primary stuck-point force versus time" detailsResetKey={upResetEpoch}
        inputs={<div className="jarPerformanceInputs jarPrimaryInputs">
      {fields.map(([key, label]) => <label key={key} className={key === 'stuckPointFt' ? 'jarPerformanceStuckPoint' : undefined}>
        {label}<input type="number" min="0" step="any" value={operating[key]} onChange={e => changeInput('up', key, e.target.value)} />
      </label>)}
      <JarResetButton mode="Up" onClick={resetUp} />
    </div>}
        graph={<>{!result.valid ? <div className="jarGraphInstruction" role="status">{String(operating.overpullKlbf).trim() === '' ? 'Enter overpull at jar to calculate' : `Calculation unavailable: ${result.error}`}</div> : !history.valid ? <div className="jarGraphInstruction" role="status">{history.error} Analytical results below are retained.</div> : <>
      <Suspense fallback={<div className="jarImpactEmpty" role="status">Loading primary force history…</div>}><Plot {...plot} plotHeight={JAR_HISTORY_HEIGHT} /></Suspense>
      <p className="jarImpactCaption"><strong>Time zero = first stuck-point arrival (t1), not jar release.</strong> Positive tensile force; shaded area = primary impulse over 0–{fmt(history.durationS * 1000)} ms (end excluded).</p>
    </>}</>}
        results={<JarCalculationResults rows={[
          ['Incident impact force (FI)', result.valid ? `${fmt(result.impactForceKlbf, 1)} klbf` : '—'],
          ['Peak stuck-point force', result.valid && history.valid ? `${fmt(history.peakForceLbf / 1000, 1)} klbf` : '—'],
          ['Average stuck-point force', result.valid ? `${fmt(result.averageStuckPointForceKlbf, 1)} klbf` : '—'],
          ['Primary impulse', result.valid ? `${fmt(result.impulseLbfS, 1)} lbf·s` : '—'],
          ['Impact velocity', result.valid ? `${fmt(result.preImpact.hammerVelocityFtS, 1)} ft/s` : '—'],
          ['Primary pulse duration', result.valid ? `${fmt(result.primaryPulseDurationS * 1000, 2)} ms` : '—']
        ]} />}
        details={<><p>Stuck-Point Force vs Time — Jar Up</p>
    <p>Preliminary — Idealised Skeem Model (1979)</p>
    <label className="jarImpactToggle"><input type="checkbox" checked={showCumulative} onChange={e => setShowCumulative(e.target.checked)} /> Show cumulative impulse</label>
    <label className="jarImpactToggle"><input type="checkbox" checked={showAnnotations} onChange={e => setShowAnnotations(e.target.checked)} /> Show event annotations</label>
    {result.input && <details className="jarMaterialAssumptions" style={{ marginTop: 8 }}>
      <summary>Material Assumptions</summary>
      <p>Read-only assumptions for the current Jar Up calculation. Material properties are not calibrated to match the entered component weight.</p>
      <dl className="jarPerformanceResults">
        <div><dt>Young's modulus</dt><dd>{fmt(result.input.youngsModulusPsi, 0)} psi</dd></div>
        <div><dt>Acoustic velocity</dt><dd>{fmt(result.input.acousticVelocityFtS, 0)} ft/s</dd></div>
        <div><dt>Lower-collar air weight per foot</dt><dd>{fmt(result.input.lowerCollarWeightLbf / result.input.lowerCollarLengthFt)} lbf/ft</dd></div>
        <div><dt>Lower-collar weight used (W)</dt><dd>{fmt(result.input.lowerCollarWeightLbf)} lbf over {fmt(result.input.lowerCollarLengthFt)} ft</dd></div>
      </dl>
      <p>For an ideal uniform rod, acoustic velocity squared equals Young's modulus divided by mass density, using consistent units. These modulus and velocity assumptions are independent; material-density consistency has not been established from nominal component weight.</p>
      <p>Nominal air weight is not an exact material-density measurement. Connections and other section details can affect component weight. W uses entered air weight; no buoyancy, inclination or friction correction is applied here.</p>
    </details>}
    {direction === 'up' && <details style={{ marginTop: 8 }}><summary>Model verification and applicability</summary>
      <p>Enter operating overpull at the jar independently of drilling WOB. Surface overpull is not converted automatically.</p>
      <p>FI is the incident wave magnitude at the jar, not the peak of the plotted stuck-point force. Impulse and average force refer to the primary stuck-point interval only. The plot uses positive tensile magnitudes; compression-positive DrillFrame force is the negative of that magnitude.</p>
      <p>The plotted force is the paper's weight-corrected tensile reaction after release and re-engagement, not an increment to add to the pre-release overpull. Static overpull must not be added again. This idealised history does not resolve the complete static weight/buoyancy field or contact rise time. No response beyond the primary interval is predicted.</p>
      {history.valid && <>
        <p>Numerical impulse: {fmt(history.numericalImpulseLbfS, 1)} lbf·s · Closed-form analytical check: {fmt(history.analyticalImpulseLbfS, 1)} lbf·s.</p>
        <p>Integration error vs closed form: {history.errorLbfS.toExponential(3)} lbf·s ({history.relativeErrorPercent?.toExponential(3)}%) · vs solver impulse: {history.solverErrorLbfS.toExponential(3)} lbf·s. Event-aligned trapezoidal quadrature, 32 subdivisions per constant-force interval; duplicate times at jumps contribute zero area.</p>
        <p>First stuck-point arrival t1: {fmt(result.t1S * 1000, 3)} ms after release · residual arrival t2: {fmt(result.t2S * 1000, 3)} ms · primary end t3: {fmt(result.t3S * 1000, 3)} ms. The t3 relief event and subsequent response are not plotted or integrated.</p>
      </>}
      {direction === 'down' && <p>Downward prediction requires separate compressive loading, release/engagement and boundary-condition derivations, including weight, buckling, wall contact, friction and force transmission. Existing static Jar Down capability does not validate impact dynamics.</p>}
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
    </details>}</>}
      />}
    </div>
  </section>;
}
