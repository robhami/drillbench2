import React, {useState} from 'react';
import AxialLoadChart from './AxialLoadChart.js';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis.js';

const fmt = n => n === null ? 'Not determined' : `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft`;
export default function JarPlacement({ bha }) {
  const [mode, setMode] = useState('slide');
  const result = analyzeJarPlacement(bha, mode);
  return <section style={{padding: '12px', overflow: 'auto', height: '100%', fontSize: 14}}>
    <div style={{background:'#fff3cd',padding:10,marginBottom:12,border:'1px solid #e6cc76'}}>
      <strong>PRELIMINARY — NOT FOR OPERATIONAL USE</strong><br/>{result.disclaimer}
    </div>
    <h5>Jar placement — drilling load</h5>
    <p>Constant inclination: <strong>{bha.inclination ?? 0}° from vertical</strong> · WOB: <strong>{bha.wob || 0} klbf</strong></p>
    <label htmlFor="drillingMode">Drilling mode: </label>
    <select id="drillingMode" value={mode} onChange={e=>setMode(e.target.value)}>
      <option value="slide">Slide</option>
      <option value="reference">Frictionless reference</option>
      <option value="rotate" disabled>Rotate (coming next)</option>
    </select>
    {mode === 'slide' && <p style={{color:'#475569'}}>Slide model includes drilling WOB and straight-hole Coulomb drag using μ = <strong>{bha.frictionCoefficient ?? 0.25}</strong>.</p>}
    <p>Calculated {mode === 'slide' ? 'slide drilling' : 'frictionless'} neutral point: <strong>{fmt(result.neutralPointFt)} above bit</strong></p>
    <AxialLoadChart bha={bha} neutralPointFt={result.neutralPointFt} mode={mode} />
    {result.warnings.map((w,i)=><p key={i} style={{color:'#995000'}}>⚠ {w}</p>)}
    {result.jars.map((jar,i)=><div key={i} style={{border:'1px solid #cbd5e1',padding:12,marginBottom:10}}>
      <strong>{jar.name}</strong>
      <div>Jar interval: {fmt(jar.startFt)} – {fmt(jar.endFt)} above bit</div>
      <div>Jar centre: {fmt(jar.centreFt)} above bit</div>
      <div>Centre relative to neutral point: {jar.distanceFromNeutralFt === null ? 'Not determined' : `${Math.abs(jar.distanceFromNeutralFt).toFixed(1)} ft ${jar.distanceFromNeutralFt >= 0 ? 'above' : 'below'}`}</div>
      {jar.issues.map((issue,j)=><div key={j} style={{color:'#9a3412'}}>⚠ {issue}</div>)}
    </div>)}
    <p style={{fontSize:12,color:'#526477'}}>Rotate drilling will be added as a separate output after the Slide model is validated.</p>
  </section>;
}
