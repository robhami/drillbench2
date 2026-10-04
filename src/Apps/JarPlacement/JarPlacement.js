import React from 'react';
import AxialLoadChart from './AxialLoadChart.js';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis.js';

const fmt = n => n === null ? 'Not determined' : `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft`;
export default function JarPlacement({ bha }) {
  const result = analyzeJarPlacement(bha);
  return <section style={{padding: '12px', overflow: 'auto', height: '100%', fontSize: 14}}>
    <div style={{background:'#fff3cd',padding:10,marginBottom:12,border:'1px solid #e6cc76'}}>
      <strong>PRELIMINARY — NOT FOR OPERATIONAL USE</strong><br/>{result.disclaimer}
    </div>
    <h5>Jar placement screening</h5>
    <p>Calculated neutral point: <strong>{fmt(result.neutralPointFt)} above bit</strong></p>
    <AxialLoadChart bha={bha} neutralPointFt={result.neutralPointFt} />
    {result.warnings.map((w,i)=><p key={i} style={{color:'#995000'}}>⚠ {w}</p>)}
    {result.jars.map((jar,i)=><div key={i} style={{border:'1px solid #cbd5e1',padding:12,marginBottom:10}}>
      <strong>{jar.name}</strong>
      <div>Jar interval: {fmt(jar.startFt)} – {fmt(jar.endFt)} above bit</div>
      <div>Jar centre: {fmt(jar.centreFt)} above bit</div>
      <div>Centre relative to neutral point: {jar.distanceFromNeutralFt === null ? 'Not determined' : `${Math.abs(jar.distanceFromNeutralFt).toFixed(1)} ft ${jar.distanceFromNeutralFt >= 0 ? 'above' : 'below'}`}</div>
      {jar.issues.map((issue,j)=><div key={j} style={{color:'#9a3412'}}>⚠ {issue}</div>)}
    </div>)}
    <p style={{fontSize:12,color:'#526477'}}>Next phase: add manufacturer jar operating envelope, inclination/drag model and verified firing-force calculations.</p>
  </section>;
}
