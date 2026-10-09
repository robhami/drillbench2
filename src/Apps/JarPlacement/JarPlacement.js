import React from 'react';
import AxialLoadChart from './AxialLoadChart.js';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis.js';

const fmt = (n, digits = 1) => n === null ? 'Not determined' : `${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ft`;
export default function JarPlacement({ bha, drillingMode, setDrillingMode }) {
  const mode = drillingMode || 'slide';
  const result = analyzeJarPlacement(bha, mode);
  const neutralDigits = mode === 'rotate' ? 2 : 1;
  return <section style={{ padding: '12px', overflow: 'auto', height: '100%', fontSize: 14 }}>
    <div style={{ background: '#fff3cd', padding: 10, marginBottom: 12, border: '1px solid #e6cc76' }}>
      <strong>PRELIMINARY — NOT FOR OPERATIONAL USE</strong>
    </div>
    <h5 style={{ margin: '0 0 8px' }}>Jar Placement — Drilling</h5>
    <label htmlFor="drillingMode">Mode: </label>
    <select
      id="drillingMode"
      value={mode}
      onChange={e => setDrillingMode(e.target.value)}
    >
      <option value="slide">Slide</option>
      <option value="rotate">Rotate</option>
      <option value="reference">Frictionless reference</option>
    </select>
    <p style={{ margin: '10px 0' }}><strong>Neutral point: {fmt(result.neutralPointFt, neutralDigits)} above bit</strong></p>
    <AxialLoadChart bha={bha} neutralPointFt={result.neutralPointFt} mode={mode} />
    {result.warnings.map((w, i) => <p key={i} style={{ color: '#995000' }}>⚠ {w}</p>)}
    {result.jars.map((jar, i) => <div key={i} style={{ border: '1px solid #cbd5e1', padding: 12, marginBottom: 10 }}>
      <strong>{jar.name}</strong>
      <div>{fmt(jar.startFt)} – {fmt(jar.endFt)} above bit · centre {fmt(jar.centreFt)}</div>
      {jar.distanceFromNeutralFt !== null && <div>{Math.abs(jar.distanceFromNeutralFt).toFixed(1)} ft {jar.distanceFromNeutralFt >= 0 ? 'above' : 'below'} neutral point</div>}
      {jar.issues.map((issue, j) => <div key={j} style={{ color: '#9a3412' }}>⚠ {issue}</div>)}
    </div>)}
  </section>;
}
