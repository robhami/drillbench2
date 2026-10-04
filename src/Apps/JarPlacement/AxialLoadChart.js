import React from 'react';
import { buildEngModel } from '../../engineering/models/buildEngModel.js';

const fmt = n => Number(n).toLocaleString(undefined, {maximumFractionDigits: 1});
export default function AxialLoadChart({bha, neutralPointFt}) {
  const model = buildEngModel(bha);
  const components = model.axialLoads.components || [];
  if (!components.length) return <p>Add BHA components to display the axial-load profile.</p>;
  const total = model.positions.totalLength || 1;
  const points = [{depth:0, load:model.axialLoads.bitAxialForce / 1000}, ...components.map(c => ({depth:c.endFromBit,load:c.topAxialForce / 1000}))];
  const jars = components.filter(c => String(c.category || '').toUpperCase() === 'JAR');
  const loads = points.map(p=>p.load);
  const limit = Math.max(1, ...loads.map(Math.abs)) * 1.15;
  const W=720,H=340,left=75,right=22,top=24,bottom=56;
  const x = f => left + (f + limit) / (2*limit) * (W-left-right);
  const y = d => H-bottom - d/total*(H-top-bottom);
  const ticks=[-limit,-limit/2,0,limit/2,limit];
  const path=points.map((p,i)=>`${i?'L':'M'} ${x(p.load)} ${y(p.depth)}`).join(' ');
  return <div style={{margin:'12px 0'}}>
    <strong>Axial load profile — straight-hole static screening</strong>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Axial load in thousands of pounds against distance above bit, with jar intervals and neutral point" style={{display:'block',width:'100%',maxWidth:820,marginTop:8,background:'#fff',border:'1px solid #d5dce4'}}>
      {jars.map((j,i)=><rect key={i} x={left} y={y(j.endFromBit)} width={W-left-right} height={Math.max(2,y(j.startFromBit)-y(j.endFromBit))} fill="#e0c67b" opacity="0.45"/>)}
      {ticks.map((t,i)=><g key={i}><line x1={x(t)} x2={x(t)} y1={top} y2={H-bottom} stroke={t===0?'#475569':'#e2e8f0'} strokeDasharray={t===0?'5 4':'2 3'}/><text x={x(t)} y={H-bottom+17} fontSize="11" fill="#334155" textAnchor="middle">{fmt(t)}</text></g>)}
      {[0,total/4,total/2,total*3/4,total].map((d,i)=><g key={i}><line x1={left} x2={W-right} y1={y(d)} y2={y(d)} stroke="#e2e8f0"/><text x={left-9} y={y(d)+4} fontSize="11" fill="#334155" textAnchor="end">{fmt(d)}</text></g>)}
      {neutralPointFt !== null && Number.isFinite(neutralPointFt) && <g><line x1={left} x2={W-right} y1={y(neutralPointFt)} y2={y(neutralPointFt)} stroke="#d97706" strokeWidth="1.5" strokeDasharray="6 4"/><text x={W-right-5} y={y(neutralPointFt)-5} textAnchor="end" fontSize="11" fill="#92400e">Neutral point: {fmt(neutralPointFt)} ft</text></g>}
      <path d={path} stroke="#2563eb" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
      <text x={W/2} y={H-12} textAnchor="middle" fontSize="12" fill="#334155">Axial load (klbf): − tension / + compression</text>
      <text transform={`translate(16 ${H/2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="#334155">Distance above bit (ft)</text>
    </svg>
    <small style={{color:'#475569'}}>Blue: calculated axial load · Gold: jar interval · Orange dashed: neutral point. Not for operational use.</small>
  </div>;
}
