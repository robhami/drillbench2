import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { importedGeometry } from '../JarClearance/clearanceData';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { listComparisonJars, comparisonGeometry, relocateComparisonJar, calculateRealBhaStatic, DYNAMIC_UNAVAILABLE } from '../../engineering/jar/realBhaComparison';
import RealBhaDynamicComparison from './RealBhaDynamicComparison';
const ResearchComparison=lazy(()=>import('../JarPlacement/ResearchComparison'));

const fmt=n=>Number.isFinite(n)?n.toLocaleString(undefined,{minimumFractionDigits:3,maximumFractionDigits:3}):'Unavailable';
const force=n=>!Number.isFinite(n)?'Unavailable':`${fmt(Math.abs(n)/1000)} klbf ${n>0?'compression':n<0?'tension':'neutral'}`;
const fields=[['jarCentreFt','Jar solver reference (centre above bit)','ft'],['jarMdFt','Jar solver reference MD (centre)','ft'],['jarBottomFt','Jar bottom above bit','ft'],['jarTopFt','Jar top above bit','ft'],['jarForceLbf','Jar axial force (+ compression)','lbf'],['neutralFt','Neutral point above bit','ft'],['neutralMdFt','Neutral point MD','ft'],['jarMinusNeutralFt','Jar minus neutral point (+ above)','ft'],['hookloadLbf','Surface hookload at current WOB','lbf'],['buoyedWeightLbf','Total buoyed string weight','lbf'],['totalAirWeightLbf','Total air string weight','lbf'],['requiredHookloadLbf','Surface support for target jar compression','lbf'],['totalLengthFt','Total deployed string length','ft'],['fixedBhaLengthFt','Fixed BHA length excluding DP','ft'],['fixedBhaAirWeightLbf','Fixed BHA air weight excluding DP','lbf']];
export default function RealBhaComparison(props) {
  // Reset all non-destructive drafts when geometry, loading, trajectory or selected mode changes.
  const source=useActiveSurvey(props.bha);
  return <ComparisonSession key={JSON.stringify([props.bha,source,props.analysisBitMdFt,props.surfaceReferenceMdFt,props.drillingMode])} {...props} source={source}/>;
}
function ComparisonSession({bha,source,analysisBitMdFt,surfaceReferenceMdFt=0,drillingMode='slide'}) {
  const jars=listComparisonJars(bha), [jarIndex,setJarIndex]=useState(jars.length===1?0:null), [mode,setMode]=useState('A'), [movement,setMovement]=useState(''), [target,setTarget]=useState('40'), [alternatives,setAlternatives]=useState([]), [snapshot,setSnapshot]=useState(null), [error,setError]=useState(''), [zoom,setZoom]=useState('bha'), [research,setResearch]=useState(false);
  const survey=useMemo(()=>importedGeometry(source),[source]), depth=analysisDepth(bha), bitMdFt=analysisBitMdFt ?? (depth.valid ? depth.bitMdFt : null);
  const request=useMemo(()=>({bha,survey,bitMdFt,surfaceMdFt:surfaceReferenceMdFt,mode:drillingMode,jarIndex,targetCompressionKlbf:target}),[bha,survey,bitMdFt,surfaceReferenceMdFt,drillingMode,jarIndex,target]);
  const current=useMemo(()=>calculateRealBhaStatic(request),[request]), geometry=comparisonGeometry(bha,jarIndex);
  const invalidate=()=>{setSnapshot(null);setError('');};
  const reset=()=>{setAlternatives([]);setSnapshot(null);setMovement('');setError('');};
  function add() {
    const candidate=relocateComparisonJar(bha,jarIndex,movement,mode);
    if(!candidate.valid){setError(candidate.error);return;}
    if(alternatives.length>=8){setError('Compare at most eight alternatives at a time.');return;}
    if(Number(movement)===0||alternatives.some(a=>a.movementFt===Number(movement))){setError('Enter a distinct nonzero movement from the original BHA.');return;}
    setAlternatives(a=>[...a,candidate]);invalidate();
  }
  function run() {
    if(!current.valid){setError(current.error);return;}
    setSnapshot(alternatives.map((a,i)=>({...a,label:`Alternative ${i+1}`,result:calculateRealBhaStatic({...request,bha:a.bha})})));setError('');
  }
  const shown=[{label:'Current BHA',result:current},...(snapshot||[])];
  const focus=current.valid?(zoom==='full'?[0,current.values.totalLengthFt]:zoom==='jar'?[Math.max(0,current.values.jarCentreFt-150),Math.min(current.values.totalLengthFt,current.values.jarCentreFt+150)]:[0,Math.min(current.values.totalLengthFt,current.deployment.fixedLengthFt+50)]):[0,1];
  return <section className="realBhaJarWorkspace" aria-label="Real BHA jar comparison">
    <h2 className="realBhaJarTitle">Loaded BHA and selected jar</h2>
    <div className="realBhaJarSummary"><div><span>LOADED BHA</span><strong>{bha?.name||'Loaded BHA'}</strong></div><div><span>SELECTED JAR</span><strong>{jarIndex==null?'Select a jar':jars[jarIndex]?.name||'Jar'}</strong></div><div><span>CURRENT POSITION</span><strong>{current.valid?`${fmt(current.values.jarCentreFt)} ft above bit`:'Unavailable'}</strong></div></div>
    <label>Selected jar<select value={jarIndex ?? ''} onChange={e=>{setJarIndex(e.target.value===''?null:Number(e.target.value));reset();}}><option value="">Select a jar</option>{jars.map((j,i)=><option key={i} value={i}>{i+1}: {j.name}</option>)}</select></label>
    <RealBhaDynamicComparison iterationTable bha={bha} jarIndex={jarIndex} alternatives={alternatives} bitMdFt={bitMdFt} surfaceMdFt={surfaceReferenceMdFt} advancedContent={<section aria-label="Advanced static analysis">
    <h4>Static loads, neutral point and geometry</h4><p>Native static audit units: bit MD {fmt(Number(bitMdFt))} ft; WOB {bha?.wob} klbf; mud {bha?.mudWeight} ppg; shared drilling mode {drillingMode}; friction coefficient {bha?.frictionCoefficient}. Survey: {source?.origin||source?.filename||'not associated'}.</p>
    {current.valid?<section aria-label="Current jar position"><p>{current.jar.name}: length {fmt(Number(current.component.length))} ft; OD {fmt(Number(current.component.od))} in; ID {fmt(Number(current.component.idSize))} in. Solver reference is the jar centre at {fmt(current.values.jarCentreFt)} ft above bit / MD {fmt(current.values.jarMdFt)} ft. Bottom {fmt(current.values.jarBottomFt)} ft above bit / MD {fmt(current.values.jarBottomMdFt)} ft; top {fmt(current.values.jarTopFt)} ft above bit / MD {fmt(current.values.jarTopMdFt)} ft.</p><p>Below: {geometry.lower?.toolName||'Bit / none'}. Above: {geometry.upper?.toolName||'None'}. Current jar: {force(current.values.jarForceLbf)}; {Number.isFinite(current.values.jarMinusNeutralFt)?`${fmt(Math.abs(current.values.jarMinusNeutralFt))} ft ${current.values.jarMinusNeutralFt>=0?'above':'below'} the neutral point`:`neutral point ${current.load.neutralStatus}; unique separation unavailable`}.</p></section>:<p role="alert">Current calculation unavailable: {current.error}</p>}
    <fieldset><legend>Non-destructive alternatives</legend>
      <label>Movement mode<select value={mode} onChange={e=>{setMode(e.target.value);reset();}}><option value="A">A — Relocate within existing collars</option><option value="B">B — Fixed L1, variable L2 (unsupported here)</option><option value="C">C — Add collars (unsupported here)</option></select></label>
      {mode==='A'?<><p>Positive movement is toward surface (higher above bit); negative is toward bit. All movements are relative to the original BHA. Only the two adjacent matching uniform collar rows exchange footage. No stabilizer, HWDP or other component is crossed.</p>{geometry.valid?<p>Jar centre bounds: strictly between {fmt(geometry.minCentreFt)} and {fmt(geometry.maxCentreFt)} ft above bit; movement strictly between {fmt(-Number(geometry.lower.length))} and +{fmt(Number(geometry.upper.length))} ft, with a 0.000001-ft minimum remaining collar. Continuous-length screening only; joints and connections require separate assembly checks.</p>:<p role="alert">Mode A unavailable: {geometry.error}</p>}</>:<p role="alert">Mode {mode} is unsupported in the real mixed-BHA comparison. The existing workflow is retained separately. No collar addition, removal or DP substitution is performed here.</p>}
      <label>Movement from current jar (ft)<input type="number" step="any" value={movement} onChange={e=>setMovement(e.target.value)}/></label>{' '}
      <button onClick={add} disabled={mode!=='A'||!geometry.valid||!current.valid}>Add alternative</button>{' '}
      <label>Target jar compression (klbf)<input type="number" min="0" step="any" value={target} onChange={e=>{setTarget(e.target.value);invalidate();}}/></label>
      <p>1 klbf = 1,000 lbf. Target surface support is a separate quasi-static Jar Down slackoff calculation, not a firing threshold.</p>
      <ul>{alternatives.map((a,i)=><li key={a.movementFt}>Alternative {i+1}: movement {a.movementFt>0?'+':''}{a.movementFt} ft; jar centre {fmt(geometry.currentCentreFt+a.movementFt)} ft; added collars 0 ft; redistributed {fmt(a.redistributedCollarFt)} ft. <button onClick={()=>{setAlternatives(old=>old.filter((_,n)=>n!==i));invalidate();}}>Remove alternative {i+1}</button></li>)}</ul>
      <button disabled={!current.valid||!alternatives.length} onClick={run}>Calculate alternatives</button>{' '}<button onClick={reset}>Reset comparison</button>
    </fieldset>
    {error&&<p role="alert">{error}</p>}
    <p role="status">{snapshot?'Comparison calculated. Original BHA unchanged.':alternatives.length?'Alternatives changed; calculate to see current results.':'Add alternatives to compare with the original BHA. No saved data is modified.'}</p>
    {current.valid&&<>
      {shown.filter(s=>!s.result.inverse?.valid).map((s,i)=><p role="status" key={i}>{s.label}: target compression support unavailable — {s.result.inverse?.errors?.join(' ')||s.result.error}</p>)}
      <div style={{overflowX:'auto'}}><table className="table table-sm" aria-label="Real BHA static comparison"><thead><tr><th>Parameter</th>{shown.map((s,i)=><th key={i}>{s.label}{i>0?' / difference from current':''}</th>)}</tr></thead><tbody>{fields.map(([key,label,unit])=><tr key={key}><th>{label} ({unit})</th>{shown.map((s,i)=>{const value=s.result.values?.[key], original=current.values[key];return <td key={i}>{s.result.valid?`${fmt(value)}${i>0?` / Δ ${fmt(Number.isFinite(value)&&Number.isFinite(original)?value-original:null)}`:''}`:`Unavailable: ${s.result.error}`}{key==='jarForceLbf'&&Number.isFinite(value)?` (${value>0?'compression':value<0?'tension':'neutral'})`:''}</td>;})}</tr>)}</tbody></table></div>
      <label>Geometry view<select value={zoom} onChange={e=>setZoom(e.target.value)}><option value="bha">Fixed BHA and first 50 ft of DP</option><option value="jar">Jar vicinity (±150 ft)</option><option value="full">Full deployed string</option></select></label>
      <p>Scaled axial geometry, bit to surface. Common scale across assemblies. Solid width shows nominal body OD; dashed stabilizer envelopes are blade/contact geometry, not solid steel. Neutral point shown only when unique. Colours: orange jar, grey collars, green stabilizers, purple HWDP, blue DP.</p>
      <div style={{display:'flex',gap:14,overflowX:'auto'}}>{shown.filter(s=>s.result.valid).map((s,i)=><StringDiagram key={i} result={s.result} label={s.label} focus={focus} currentJarFt={current.values.jarCentreFt}/>)}</div>
      {snapshot?.map((s,i)=><p key={i}>{s.label}: {s.result.valid?`${force(s.result.values.jarForceLbf)}; surface hookload change ${fmt(s.result.values.hookloadLbf-current.values.hookloadLbf)} lbf. Total string length and collar inventory retained; no collars added. Jar ${Number.isFinite(s.result.values.jarMinusNeutralFt)?`${fmt(Math.abs(s.result.values.jarMinusNeutralFt))} ft ${s.result.values.jarMinusNeutralFt>=0?'above':'below'} NP`:'relationship to NP unavailable'}.`:s.result.error}</p>)}
      <details><summary>Static assumptions, warnings and calculation audit</summary><p>All loads use the existing survey soft-string calculation and nominal component weights with the 65.5-ppg steel buoyancy reference, equal internal/external fluid. Unknown as-built displacement and independent segment weights are not invented. Target support uses the existing inverse static Jar Down slackoff branch, not the selected rotating drilling branch; it does not establish jar firing.</p>{shown.map((s,i)=><div key={i}><strong>{s.label}</strong><ul>{s.result.warnings?.map((w,n)=><li key={n}>{w}</li>)}</ul><pre>{JSON.stringify({deployment:s.result.deployment,components:s.result.load?.components,neutralPoints:s.result.load?.neutralPoints,neutralIntervals:s.result.load?.neutralIntervals,inverseStatus:s.result.inverse?.status,inverseResidualLbf:s.result.inverse?.residualLbf},null,2)}</pre></div>)}</details>
    </>}
    <p>Static load, clearance from a neutral point and required support are separate mechanical quantities. None identifies an overall best jar placement or predicts jarring performance.</p>
    <p>Production dynamic capability:</p><p role="note"><strong>{DYNAMIC_UNAVAILABLE}</strong></p>
    <button onClick={()=>setResearch(v=>!v)}>{research?'Close research demonstration':'Open separate idealised research demonstration'}</button>
    {research&&<Suspense fallback={<p>Loading separate research demonstration…</p>}><ResearchComparison/></Suspense>}
    </section>} onPrepare={()=>{
      const prepared=[-30,30].map(move=>relocateComparisonJar(bha,jarIndex,move,'A'));
      if(prepared.some(r=>!r.valid)){setError(prepared.find(r=>!r.valid).error);return;}
      setMode('A');setAlternatives(prepared);invalidate();
    }}/>
  </section>;
}

function StringDiagram({result,label,focus,currentJarFt}) {
  const [low,high]=focus, height=510, y=x=>height-(x-low)/(high-low)*height+30;
  const colors={JAR:'#c97900',DC:'#78818b',STB:'#16865c',HWDP:'#7751a8',DP:'#1976ad'};
  return <figure style={{minWidth:300,margin:0}}><figcaption><strong>{label}</strong></figcaption><svg width="300" height="565" role="img" aria-label={`${label} scaled BHA geometry`}>
    <defs><clipPath id={`clip-${label.replace(/\s/g,'')}`}><rect x="0" y="30" width="300" height={height}/></clipPath></defs>
    <text x="2" y="20">{fmt(high)} ft above bit</text><g clipPath={`url(#clip-${label.replace(/\s/g,'')})`}>
      {result.positions.components.filter(c=>c.endFromBit>low&&c.startFromBit<high).map((c,i)=>{const width=Number(c.od)*5, top=y(c.endFromBit), h=Number(c.length)/(high-low)*height;
        let offset=Number(c.startFromBit);
        return <g key={i}><title>{c.category}: {c.toolName}; {fmt(c.startFromBit)}–{fmt(c.endFromBit)} ft above bit; OD/ID {c.od}/{c.idSize} in</title><rect x={95-width/2} y={top} width={width} height={h} fill={colors[c.category]||'#888'} stroke="white" strokeWidth="0.6"/>
          {(c.componentDefinition?.geometry?.segments||[]).map((segment,n)=>{const start=offset;offset+=Number(segment.length);const w=Number(segment.od)*5;return Number(segment.od)>Number(c.od)?<rect key={n} x={95-w/2} y={y(offset)} width={w} height={(offset-start)/(high-low)*height} fill="none" stroke="#16865c" strokeDasharray="2 1"/>:null;})}
          {h>10&&<text x="130" y={top+Math.max(10,h/2)} fontSize="11">{c.category} {fmt(Number(c.length))} ft</text>}</g>;})}
      <line x1="35" x2="125" y1={y(currentJarFt)} y2={y(currentJarFt)} stroke="#777" strokeDasharray="3 2"/>
      <line x1="25" x2="130" y1={y(result.values.jarCentreFt)} y2={y(result.values.jarCentreFt)} stroke="#a65300"/><text x="5" y={y(result.values.jarCentreFt)-4} fontSize="10">Jar centre</text>
      {Number.isFinite(result.values.neutralFt)&&<><line x1="10" x2="260" y1={y(result.values.neutralFt)} y2={y(result.values.neutralFt)} stroke="#bd2939" strokeDasharray="5 3"/><text x="140" y={y(result.values.neutralFt)-3} fontSize="11">NP {fmt(result.values.neutralFt)} ft</text></>}
      {low===0&&<><path d={`M75 ${y(0)-8} L115 ${y(0)-8} L95 ${y(0)} Z`} fill="#222"/><text x="135" y={y(0)-4}>Bit</text></>}
    </g><text x="2" y="560">{fmt(low)} ft above bit · grey dashed: original jar</text>
  </svg></figure>;
}
