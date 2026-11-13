import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { DEFAULT_CONTROLS, POSITIONS, validateComparison, metricSummary, metricValue } from './researchComparisonData';
const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));
const colors = ['#0072b2','#009e73','#cc79a7','#d55e00','#6a51a3','#008b8b','#b58900'];
const labels = { peak:'Peak tensile stuck-point force (N)', first:'First-lobe impulse (N·s)', signed:'Fixed-window signed impulse (N·s)', tensile:'Fixed-window tensile-only impulse (N·s)' };
const number = (n, digits=3) => Number.isFinite(n) ? n.toFixed(digits) : '—';
export default function ResearchComparison() {
  const [controls,setControls] = useState({...DEFAULT_CONTROLS}), [rows,setRows] = useState([]), [busy,setBusy] = useState(false), [error,setError] = useState(''), [highlight,setHighlight] = useState(9.25), [hidden,setHidden] = useState([]);
  const worker = useRef(null), generation = useRef(0);
  const stop = () => { generation.current++; worker.current?.terminate(); worker.current=null; };
  useEffect(() => () => { generation.current++; worker.current?.terminate(); }, []);
  function change(key,value) { stop(); setBusy(false); setRows([]); setError(''); setControls(c=>({...c,[key]:value,...(key==='positions'&&!value.includes(c.baseline)?{baseline:value[0]??''}:{})})); }
  async function run() {
    stop(); setRows([]); const invalid=validateComparison(controls); setError(invalid || ''); if(invalid) return;
    setBusy(true);
    const request = generation.current;
    try {
      const {createResearchComparisonWorker}=await import('./createResearchComparisonWorker');
      if (generation.current !== request) return;
      const w=createResearchComparisonWorker(); worker.current=w;
      w.onmessage=({data})=>{ if(worker.current!==w)return; if(data.row)setRows(r=>[...r,data.row]); if(data.error){setError(data.error);setBusy(false);stop();} if(data.complete){setBusy(false);stop();} };
      w.onerror=()=>{if(worker.current===w){setError('Research worker failed. No valid comparison is available.');setRows([]);setBusy(false);stop();}};
      w.postMessage({controls});
    } catch(e) {setError(e.message);setBusy(false);}
  }
  const ready=!busy&&!error&&rows.length>0&&rows.length===controls.positions.length;
  const valid=rows.filter(r=>r.valid), baseline=controls.baseline;
  const selectCurve=value=>{setHighlight(value);setHidden(h=>h.filter(p=>p!==value));};
  const updateBaseline=value=>{setControls(c=>({...c,baseline:value}));selectCurve(value);};
  const summaries=Object.fromEntries(Object.keys(labels).map(k=>[k,ready?metricSummary(rows,baseline,k):null]));
  const shapes=[{type:'rect',xref:'x',yref:'paper',x0:controls.startMs,x1:controls.endMs,y0:0,y1:1,fillcolor:'#b6d6ee',opacity:.12,line:{width:0}}];
  valid.filter(r=>!hidden.includes(r.positionM)).forEach(r=>[r.metrics.primaryStartS,r.metrics.primaryEndS].forEach(t=>shapes.push({type:'line',xref:'x',yref:'paper',x0:t*1000,x1:t*1000,y0:0,y1:1,line:{dash:'dot',width:1,color:'#889'}})));
  const curves=valid.filter(r=>!hidden.includes(r.positionM)).flatMap(r=>[
    {x:r.trace.map(p=>p.timeMs),y:r.trace.map(p=>p.forceKN),type:'scatter',mode:'lines',name:`${r.positionM} m${r.positionM===baseline?' (baseline)':''}`,line:{color:colors[POSITIONS.indexOf(r.positionM)],width:r.positionM===highlight?4:2,dash:r.positionM===baseline?'dash':'solid'}},
    {x:[r.metrics.peakTimeS*1000],y:[-r.metrics.peakTensileForceN/1000],type:'scatter',mode:'markers',name:`${r.positionM} m peak`,showlegend:false,marker:{color:colors[POSITIONS.indexOf(r.positionM)],symbol:'diamond',size:8}}
  ]);
  return <section aria-label="Dynamic Comparison Research">
    <h2>JarFrame — Dynamic Comparison (Research)</h2>
    <p role="note"><strong>PRELIMINARY — NOT FOR OPERATIONAL USE</strong></p>
    <p>Hypothetical 100 m mixed-BHA analogue from Stage 6D.3E. These are not predictions of OES jar performance. Actual BHA dynamics remain unsupported.</p>
    <details><summary>Geometry, boundaries and applicability</summary><p>Mode A preserves 20 m of mixed collars, a 0.5 m jar, 10 m idealised uniform HWDP body and 69.5 m drillpipe body. Position is jar centre above bit; stuck point is fixed at the bit. Upper boundary is matched (no surface reflection). Hypothetical steel: E = 200 GPa, density = 7,850 kg/m³. Effective jar body area = 0.003 m². No actual tool-joint or stabilizer dynamics.</p><p>Zero-increment perturbations about a defined equilibrium; distributed gravitational preload is static context only, not a fully preloaded dynamic simulation. No hydraulic release model. Hammer velocity is prescribed. Mass is fixed at the verified analogue value; velocity and stiffness options are the Stage 6D.3D sensitivity values. Each combination must pass runtime numerical checks.</p></details>
    <fieldset disabled={busy} style={{display:'flex',flexWrap:'wrap',gap:12,margin:'12px 0'}}><legend>Research comparison controls</legend>
      <label>Effective hammer mass (kg)<input type="number" value={controls.massKg} readOnly style={{width:80}}/><small> Verified value: 20 kg</small></label>
      <label>Initial impact velocity (m/s)<select value={controls.velocityMS} onChange={e=>change('velocityMS',+e.target.value)}>{[.5,1,2].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Equivalent contact stiffness (MN/m)<select value={controls.stiffnessNm} onChange={e=>change('stiffnessNm',+e.target.value)}>{[5e6,1e7,2e7].map(v=><option key={v} value={v}>{v/1e6}</option>)}</select></label>
      <label>Window start (ms)<input type="number" min="0" max="25" step="0.1" value={Number.isFinite(controls.startMs)?controls.startMs:''} onChange={e=>change('startMs',e.target.value===''?NaN:+e.target.value)} style={{width:80}}/></label>
      <label>Window end (ms)<input type="number" min="0" max="25" step="0.1" value={Number.isFinite(controls.endMs)?controls.endMs:''} onChange={e=>change('endMs',e.target.value===''?NaN:+e.target.value)} style={{width:80}}/></label>
      <div>Jar centres above bit (m): {POSITIONS.map(p=><label key={p} style={{marginRight:10}}><input type="checkbox" checked={controls.positions.includes(p)} onChange={e=>change('positions',e.target.checked?[...controls.positions,p].sort((a,b)=>a-b):controls.positions.filter(v=>v!==p))}/>{p}</label>)}</div>
      <label><input type="checkbox" checked={controls.acknowledged} onChange={e=>change('acknowledged',e.target.checked)}/> I acknowledge that the geometry and dynamic parameters are hypothetical, not manufacturer specifications.</label>
    </fieldset>
    <label>Baseline position (m)<select value={baseline} disabled={busy} onChange={e=>updateBaseline(+e.target.value)}>{controls.positions.map(p=><option key={p}>{p}</option>)}</select></label>{' '}
    <button type="button" disabled={busy} onClick={run}>Calculate research comparison</button>{busy&&<button onClick={()=>{stop();setBusy(false);setRows([]);setError('Calculation cancelled; partial results discarded.');}}>Cancel calculation</button>}
    <p role="status">{busy?`Calculating ${rows.length}/${controls.positions.length} positions — convergence and conservation checks in worker…`:ready?'Comparison complete. Rankings use only valid results.':'Change calculation inputs, then calculate. Inputs clear previous results.'}</p>
    {error&&<p role="alert">{error}</p>}
    {ready&&<>
      <p>Tension is negative; compression is positive. Peaks below are tensile magnitudes. More-negative signed impulse means more net tensile impulse. Window {controls.startMs}–{controls.endMs} ms uses the same impact clock for every position; default 0–25 ms is the verified simulation horizon. Other windows are exploratory, not an operational criterion.</p>
      <p>Show curves: {valid.map(r=><label key={r.positionM} style={{marginRight:8}}><input type="checkbox" checked={!hidden.includes(r.positionM)} onChange={e=>setHidden(h=>e.target.checked?h.filter(p=>p!==r.positionM):[...h,r.positionM])}/>{r.positionM} m</label>)}</p>
      <Suspense fallback={<p>Loading charts…</p>}><Plot data={curves} layout={{title:{text:'Stuck-point force versus time'},xaxis:{title:{text:'Time since impact (ms)'},range:[0,25]},yaxis:{title:{text:'Dynamic axial force (kN)'}},shapes,legend:{orientation:'h'},margin:{l:65,r:20,t:45,b:90}}}/></Suspense>
      <p>Diamonds mark full-resolution tensile peaks; dotted lines mark first tensile-lobe boundaries; shading marks the common impulse window. Display curves are decimated; metrics use full-resolution histories.</p>
      <div style={{overflowX:'auto'}}><table className="table table-sm"><thead><tr>{['Position (m)','Peak (kN)','First lobe (ms)','First impulse (N·s)','Signed (N·s)','Tensile-only (N·s)','Δ peak / first / signed / tensile (%)','Status'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.positionM} style={{background:r.positionM===highlight?'#e2efff':undefined}} onClick={()=>selectCurve(r.positionM)}><td><button onClick={()=>selectCurve(r.positionM)}>{r.positionM}{r.positionM===baseline?' baseline':''}</button></td>{r.valid?<><td>{number(r.metrics.peakTensileForceN/1000)}</td><td>{number(r.metrics.primaryDurationS*1000)}</td><td>{number(r.metrics.primaryImpulseNs)}</td><td>{number(r.metrics.fixed.signedNs)}</td><td>{number(r.metrics.fixed.tensileOnlyNs)}</td><td>{Object.keys(labels).map(k=>number(summaries[k]?.percent(r),2)).join(' / ')}</td></>:<td colSpan="6">{r.error}</td>}<td>{r.status}{r.valid&&` · ΔE ≤ ${number(r.metrics.energyResidualJ,7)} J`}</td></tr>)}</tbody></table></div>
      {Object.keys(labels).map(key=><div key={key}><p><strong>{labels[key]}:</strong> {summaries[key]?`Best tested ${summaries[key].best} m; indistinguishable within 0.1% / absolute numerical band: ${summaries[key].indistinguishable.join(', ')} m.`:'No ranking: valid baseline and complete calculation required.'}</p><Suspense fallback={<p>Loading chart…</p>}><Plot data={[{x:valid.map(r=>r.positionM),y:valid.map(r=>metricValue(r,key)),type:'scatter',mode:'lines+markers',name:labels[key]},{x:valid.filter(r=>r.positionM===baseline).map(r=>r.positionM),y:valid.filter(r=>r.positionM===baseline).map(r=>metricValue(r,key)),type:'scatter',mode:'markers',name:'Baseline',marker:{size:13,symbol:'diamond'}}]} layout={{title:{text:labels[key]},xaxis:{title:{text:'Jar centre above bit (m)'}},yaxis:{title:{text:key==='peak'?'N':'N·s'}},margin:{l:70,r:20,t:45,b:50}}}/></Suspense></div>)}
    </>}
    <p>Peak force measures maximum transmitted load. First-lobe impulse depends on force and pulse duration. Fixed-window impulses compare equal observation periods. Rankings can differ by metric. The highest numerical result does not necessarily indicate the best operational placement.</p>
  </section>;
}
