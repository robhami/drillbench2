import JarDownLoadingSummary from './JarDownLoadingSummary';
import { researchOutcome } from './researchOutcome';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { researchExample, researchEvents, researchPlot, earlyResearchComparison, copyResearchGeometry } from './jarDownResearchData';
import { createJarDownResearchWorker } from './createJarDownResearchWorker';
import useCompressionTransmission, { normalizedResearchInput } from './useCompressionTransmission';
import CompressionTransmissionAssessment from './CompressionTransmissionAssessment';
const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));
const fmt = (n, d = 3) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : 'Unavailable';
const restrictions = ['Straight, perfectly guided elastic rods; buckling is suppressed by assumption.',
  'Fixed surface and rigid bilateral stuck boundary; signed tensile reactions are retained.',
  'Massless stop, instantaneous elastic engagement; no internal jar mass or hydraulic damping.',
  'No validated manufacturer firing mechanism or tool operating-cycle prediction.',
  'No demonstrated deviated-well compression transmission or validated post-buckling dynamics.',
  'No instrumented-tool, experimental or field validation.'];

export default function JarDownResearch({ bha, onExit, analysisBitMdFt, surfaceReferenceMdFt }) {
  const [fields, setFields] = useState(() => researchExample()), [request, setRequest] = useState(() => researchExample());
  const [geometrySource, setGeometrySource] = useState('Independent research fixture');
  const [phase, setPhase] = useState('calculating');
  const [computedResult, setResult] = useState(null), [message, setMessage] = useState('Calculating verified mathematical example…');
  const [selected, setSelected] = useState('release'), [example, setExample] = useState('early'), [stuck, setStuck] = useState('');
  const [visible, setVisible] = useState({ total: true, free: false, incremental: false, cumulative: false });
  const [annotations, setAnnotations] = useState({ contact: true, wave: true }), [compare, setCompare] = useState(false);
  const [origin, setOrigin] = useState('Verified mathematical example; no BHA loads or tool settings used.');
  const [adopted, setAdopted] = useState(null), manual = useRef(null), adoptedRef = useRef(null);
  adoptedRef.current = adopted;
  const bridge = useCompressionTransmission({ bha, fields, stuck, analysisBitMdFt, surfaceReferenceMdFt });
  const adoptedCurrent = Boolean(adopted && !adopted.invalidated && adopted.token === bridge.token && bridge.assessment.canAdopt && !bridge.pending);
  // Gate in render, not just an effect: stale/pending candidates never reach a graph.
  const result = adopted && !adoptedCurrent ? null : computedResult;
  useEffect(() => {
    if (adopted && !adoptedCurrent) {
      setRequest(null); setResult(null); setMessage('Adopted candidate is stale. Reassess and explicitly adopt again, or return to manual compression.');
      if (!adopted.invalidated) setAdopted({ ...adopted, invalidated: true });
    }
  }, [adopted, adoptedCurrent]);
  useEffect(() => {
    if (adoptedRef.current) { setRequest(null); setResult(null); return; }
    const p = researchExample(); setGeometrySource('Independent research fixture'); setFields(p); setRequest(p); setResult(null); setSelected('release'); setExample('early'); setOrigin('Verified mathematical example; no BHA loads or tool settings used.');
  }, [bha]);
  useEffect(() => {
    if (!request) return undefined;
    let active = true, worker;
    setResult(null); setPhase('calculating'); setMessage('Calculating event-driven research history…');
    try {
      worker = createJarDownResearchWorker();
      worker.onmessage = e => { if (active) { setResult(e.data); setPhase(e.data.valid ? 'ready' : 'unsupported'); setMessage(e.data.valid ? '' : `Research results unavailable: ${e.data.error}`); } };
      worker.onerror = event => { event?.preventDefault?.(); if (active) { setResult(null); setPhase('failed'); setMessage('Research worker failed; results unavailable. Reload the page and calculate again if the worker could not load.'); } };
      worker.postMessage(request);
    } catch (e) { setPhase('failed'); setMessage(`Research worker unavailable: ${e.message}`); }
    return () => { active = false; worker?.terminate(); };
  }, [request]);
  const edit = change => { if (['upperRods', 'lowerRods'].some(side => change[side] && JSON.stringify(change[side].map(r => [r.lengthFt, r.areaIn2])) !== JSON.stringify(fields[side].map(r => [r.lengthFt, r.areaIn2])))) setGeometrySource('Custom research rods'); setFields(f => ({ ...f, ...change })); setRequest(null); setResult(null); setSelected('release'); setExample('custom'); setPhase('changed'); setMessage('Inputs changed. Run research model to calculate a new history.'); };
  const plot = useMemo(() => result?.valid ? researchPlot(result, visible, annotations, selected) : null, [result, visible, annotations, selected]);
  const events = useMemo(() => researchEvents(result), [result]);
  const comparison = useMemo(() => compare && result?.valid ? earlyResearchComparison(request, result) : null, [compare, request, result]);
  const o = result?.valid ? result.observation : null, first = result?.valid ? result.contact.transitions.find(e => e.type === 'engage') : null;
  function run(e) {
    e.preventDefault(); setSelected('release');
    if (adopted && !adoptedCurrent) return;
    setResult(null); setRequest(normalizedResearchInput(fields));
  }
  function adoptCandidate() {
    if (!bridge.assessment.canAdopt || bridge.pending) return;
    if (!adopted) manual.current = { fields, geometrySource };
    const s = bridge.assessment.staticResult, next = { ...fields, compressionLbf: bridge.assessment.staticCompressionLbf };
    setAdopted({ token: bridge.token, forceLbf: bridge.assessment.staticCompressionLbf, description: `${s.jarName} at ${fmt(s.jarMdFt)} ft MD; ${s.direction}; surface support ${fmt(s.surfaceHookloadLbf)} lbf.` });
    setFields(next); setRequest(normalizedResearchInput(next)); setResult(null); setOrigin('Static-model candidate explicitly adopted for idealised research; not a firing prediction.');
  }
  function returnManual() {
    const next = manual.current?.fields || { ...fields, compressionLbf: '' };
    setGeometrySource(manual.current?.geometrySource || 'Custom research rods');
    setAdopted(null); setFields(next); setRequest(normalizedResearchInput(next)); setResult(null); setOrigin('Manual research initial state restored; no static candidate adopted.');
  }
  return <section className="jarDownResearch" aria-label="Idealised Jar Down research">
    <div className="jarResearchBanner"><strong>IDEALISED RESEARCH MODEL — NOT FOR OPERATIONAL USE</strong><button type="button" onClick={onExit}>Exit research mode</button></div>
    <h6>Idealised Jar Down — Stuck-Point Force vs Time</h6>
    <div className="jarResearchStatus" role="status"><strong>{researchOutcome(result, phase, Boolean(adopted && !adoptedCurrent))}</strong>
      {o?.totalLbfS === 0 && <span> · Valid zero signed impulse</span>}
      {result?.valid && !first && <p>No engagement was resolved before the simulation horizon. Incident impact force is unavailable; signed stuck-point reaction and its integral remain defined.</p>}
    </div>
    <p><strong>Time zero = ideal latch release.</strong> Downward motion and compression positive; negative reaction is tension. This is not a manufacturer-rated impact prediction.</p>
    {o && <>
      <dl className="jarPerformanceResults jarResearchResults">
        {[
          ['Signed total / net reaction impulse', `${fmt(o.totalLbfS)} lbf·s`],
          ['Peak total compression in interval', `${fmt(Math.max(0, o.peakTotalCompressionLbf) / 1000)} klbf`],
          ['Average signed total force in interval', `${fmt(o.averageTotalCompressionLbf / 1000)} klbf`],
          ['First impact after release', first ? `${fmt(first.timeS * 1000)} ms` : 'No impact within simulation horizon'],
          ['Contact transitions in full horizon', String(result.contact.transitions.length)],
          ['Observation interval (end excluded)', `${fmt(o.startS * 1000)}–${fmt(o.endS * 1000)} ms`]
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </>}
    <JarDownLoadingSummary bridge={bridge} result={result} request={request} adopted={adopted} adoptedCurrent={adoptedCurrent} geometrySource={geometrySource} />
    <div className="jarResearchGraph" aria-label="Research force graph">
      {!plot ? <div className="jarImpactEmpty" role="status">{message}</div> : !Object.values(visible).some(Boolean) ? <div className="jarImpactEmpty" role="status">All research traces are hidden. Enable a trace to view the calculated history.</div> : <Suspense fallback={<div className="jarImpactEmpty">Loading research graph…</div>}><Plot {...plot} plotHeight={440} /></Suspense>}
    </div>
    <div className="jarResearchToggles" aria-label="Research traces">
      {[['total', 'Signed total reaction'], ['free', 'Matched no-contact reaction'], ['incremental', 'Increment from equilibrium'], ['cumulative', 'Cumulative signed total impulse']].map(([key, label]) => <label key={key} className={!visible[key] ? 'muted' : ''}><input type="checkbox" checked={visible[key]} onChange={e => setVisible({ ...visible, [key]: e.target.checked })} />{label}</label>)}
      {[['contact', 'Contact annotations'], ['wave', 'Major reaction-front annotations']].map(([key, label]) => <label key={key}><input type="checkbox" checked={annotations[key]} onChange={e => setAnnotations({ ...annotations, [key]: e.target.checked })} />{label}</label>)}
    </div>
    {o && <>
      <p className="jarImpactCaption">Shaded area = signed total reaction impulse over {fmt(o.startS * 1000)}–{fmt(o.endS * 1000)} ms, end excluded. Compression contributes positively; tension negatively. Cumulative impulse starts at zero at the interval start. No unique primary interval is assigned.</p>
      <details className="jarResearchImpulseDetails"><summary>Impulse definitions and comparison quantities</summary><dl className="jarPerformanceResults">{[
          ['Incremental impulse vs initial equilibrium', `${fmt(o.incrementalLbfS)} lbf·s`],
          ['Matched impact-attributable impulse', `${fmt(o.impactAttributableLbfS)} lbf·s`],
          ['Matched no-contact impulse', `${fmt(o.noContactLbfS)} lbf·s`],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Incremental impulse subtracts initial equilibrium. Impact-attributable impulse subtracts the matched no-contact simulation over the same interval.</p></details>
      <p className="jarImpactCaption">Net means the signed time integral here. A separate positive-only compressive impulse is not calculated. Matched impact-attributable impulse subtracts a full no-contact simulation, not a constant force baseline.</p>
      <section className="jarResearchTimeline" aria-label="Contact-event timeline"><h6>Contact and reaction-front timeline</h6>
        <label>Highlight solver event<select value={selected} onChange={e => setSelected(e.target.value)}>{events.map(e => <option key={e.id} value={e.id}>{fmt(e.timeS * 1000)} ms — {e.label}{e.kind === 'wave' ? ` (${fmt(e.valueLbf / 1000)} klbf)` : ''}</option>)}</select></label>
        <p>Reaction-front times are at the stuck boundary; contact and returning-wave times are at the jar. Propagation delay is preserved. Wave annotations mark the first upper/lower returns and largest reaction change. Detailed reflection paths are not inferred. “Rejoin” marks re-engagement.</p>
        <div className="jarResearchEvents">{events.filter(e => e.kind === 'release' || e.kind === 'contact').map(e => <button type="button" key={e.id} aria-pressed={selected === e.id} onClick={() => setSelected(e.id)}>{fmt(e.timeS * 1000)} ms · {e.label}</button>)}</div>
      </section>
      <label className="jarImpactToggle"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Compare with Stage 5C.8 restricted early-impact model</label>
      {compare && <div className="jarResearchComparison">{comparison?.valid ? <><p>Same restricted interval: {fmt(comparison.startS * 1000)}–{fmt(comparison.endS * 1000)} ms. Mathematical comparison only; neither model is experimentally validated.</p><table><thead><tr><th>Quantity</th><th>Restricted</th><th>Extended</th><th>Difference</th></tr></thead><tbody>{comparison.rows.map(([label, a, b]) => <tr key={label}><th>{label}</th><td>{fmt(a)}</td><td>{fmt(b)}</td><td>{fmt(b - a, 8)}</td></tr>)}</tbody></table><p>{comparison.contactDescription}</p></> : <p role="status">Restricted comparison unavailable: {comparison?.error}</p>}</div>}
    </>}
    <CompressionTransmissionAssessment bha={bha} bridge={bridge} adopted={adopted} adoptedCurrent={adoptedCurrent} onAdopt={adoptCandidate} onManual={returnManual} researchInput={fields} result={result} />
    <form onSubmit={run} className="jarResearchInputs"><h6>Research inputs — prescribed ideal initial conditions</h6>
      <label>Verified mathematical example<select disabled={Boolean(adopted)} value={example} onChange={e => { const p = researchExample(e.target.value); setGeometrySource('Independent research fixture'); setExample(e.target.value); setFields(p); setRequest(p); setResult(null); setSelected('release'); setOrigin('Verified mathematical example; no BHA loads or tool settings used.'); }}>{example === 'custom' && <option value="custom">Custom research inputs</option>}<option value="early">Early impact</option><option value="late">Late impact after upper return</option><option value="multiple">Multiple reflections and re-engagement</option><option value="surface">Surface returns and repeated contacts</option><option value="none">No impact within horizon</option></select></label>
      <div className="jarPerformanceInputs">{[['compressionLbf', 'Prescribed initial compression at jar (lbf)'], ['strokeIn', 'Ideal free downward stroke (in)'], ['gravityFtS2', 'Axial gravity (ft/s²)'], ['horizonS', 'Simulation horizon (s)']].map(([key, label]) => <label key={key}>{label}<input type="number" step="any" disabled={key === 'compressionLbf' && Boolean(adopted)} value={fields[key]} onChange={e => edit({ [key]: e.target.value })} /></label>)}
        {[['startS', 'Observation start (s)', 0], ['endS', 'Observation end (s)', fields.horizonS]].map(([key, label, initial]) => <label key={key}>{label}<input type="number" step="any" value={fields.observation?.[key] ?? initial} onChange={e => edit({ observation: { startS: 0, endS: fields.horizonS, ...fields.observation, [key]: e.target.value } })} /></label>)}
        {[['youngsModulusPsi', "Research Young's modulus (psi)"], ['densitySlugFt3', 'Research material density (slug/ft³)']].map(([key, label]) => <label key={key}>{label}<input type="number" step="any" value={fields.upperRods[0][key]} onChange={e => edit({ upperRods: fields.upperRods.map(r => ({ ...r, [key]: e.target.value })), lowerRods: fields.lowerRods.map(r => ({ ...r, [key]: e.target.value })) })} /></label>)}
      </div>
      <p>Compression is prescribed locally before latch release. Surface slackoff, static preparation values and manufacturer firing settings are not transferred. Material values above apply uniformly to all research rods; wave speed and weight follow from density and modulus.</p>
      {['upperRods', 'lowerRods'].map(side => <fieldset key={side}><legend>{side === 'upperRods' ? 'Above jar — surface to hammer' : 'Below jar — anvil to stuck point'}</legend><div className="jarResearchRods">{fields[side].map((r, i) => <div key={i}>{[['lengthFt', 'Length (ft)'], ['areaIn2', 'Area (in²)']].map(([key, label]) => <label key={key}>{side === 'upperRods' ? 'Upper' : 'Lower'} rod {i + 1} {label}<input type="number" step="any" value={r[key]} onChange={e => edit({ [side]: fields[side].map((v, j) => j === i ? { ...v, [key]: e.target.value } : v) })} /></label>)}</div>)}</div></fieldset>)}
      <button type="submit" disabled={Boolean(adopted && !adoptedCurrent)}>Run research model</button>
      <details><summary>Copy compatible BHA shapes into research inputs</summary><label>Research stuck point (ft above bit)<input type="number" step="any" value={stuck} onChange={e => setStuck(e.target.value)} /></label><button type="button" onClick={() => { const shape = copyResearchGeometry(bha, stuck); if (shape.error) { setRequest(null); setResult(null); setPhase('unsupported'); setMessage(shape.error); } else { const material = fields.upperRods[0]; edit({ upperRods: shape.upperRods.map(r => ({ ...material, ...r })), lowerRods: shape.lowerRods.map(r => ({ ...material, ...r })) }); setGeometrySource(`BHA-derived tubular shapes (${bha?.name || bha?.id || 'current BHA'}); jar span excluded`); setOrigin('BHA tubular shapes copied into an ideal straight, guided string. Jar length excluded; research material and prescribed compression retained.'); } }}>Copy shapes only</button><p>Only explicit DP/DC sections are supported. No survey trajectory, friction, catalogue weight, jar mass or operational load is imported. Copying shapes does not validate compression transmission.</p></details>
    </form>
    <details className="jarResearchWarnings"><summary>Engineering assumptions and research provenance</summary><p>{origin}</p><ul>{restrictions.map(s => <li key={s}>{s}</li>)}</ul><p>Research results stay local to this view. They are not saved to the BHA or written into Jar Position Analysis or operational outputs.</p></details>
  </section>;
}
