import React, { useMemo } from 'react';
import { readImpactInputs } from '../JarPlacement/impactInputs';
import { calculateJarUpPositionComparison } from './jarUpPositionComparisonModel';
import './JarFrameV6Presentation.css';

const number = (value, digits = 2) => Number.isFinite(value)
  ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';

function ComparisonChart({ title, unit, field, candidates, testId }) {
  const width = 460, height = 190, left = 58, right = 12, top = 12, bottom = 37;
  const valid = candidates.filter(candidate => candidate.valid && Number.isFinite(candidate.jarCentreFt) && Number.isFinite(candidate[field]));
  const positions = candidates.map(candidate => candidate.jarCentreFt).filter(Number.isFinite);
  const values = valid.map(candidate => candidate[field]);
  const xMin = positions.length ? Math.min(...positions) : 0;
  const xMax = positions.length ? Math.max(...positions) : 1;
  const rawYMin = values.length ? Math.min(...values) : 0;
  const rawYMax = values.length ? Math.max(...values) : 1;
  const pad = rawYMax === rawYMin ? Math.max(Math.abs(rawYMax) * 0.08, 1) : (rawYMax - rawYMin) * 0.12;
  const yMin = rawYMin - pad, yMax = rawYMax + pad;
  const x = value => left + (xMax === xMin ? 0.5 : (value - xMin) / (xMax - xMin)) * (width - left - right);
  const y = value => top + (yMax - value) / (yMax - yMin) * (height - top - bottom);
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const xTicks = [xMin, (xMin + xMax) / 2, xMax];
  return <article className="jarV6Panel jarV6Chart jarUpComparisonChart" aria-label={title}>
    <header className="jarV6ChartHeader"><div className="jarV6ChartTitle">{title}<small>{unit} · discrete candidate calculations</small></div>
      <div className="jarV6ChartValue" aria-label={`${title}: ${valid.length ? 'calculated candidates' : 'unavailable'}`}>
        {valid.length}<small>valid points</small>
      </div>
    </header>
    <svg className="jarV6ChartSvg" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`${title} versus jar centre above bit in feet; point-only supported candidate results`} data-testid={testId} data-series-type="points-only">
      <line x1={left} y1={top} x2={left} y2={height - bottom} className="jarV6Axis" />
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="jarV6Axis" />
      {yTicks.map(value => <g key={`y-${value}`}><line x1={left - 3} y1={y(value)} x2={left} y2={y(value)} className="jarV6Axis" />
        <text x={left - 5} y={y(value) + 3} textAnchor="end" className="jarV6Tick">{number(value, 1)}</text></g>)}
      {xTicks.map((value, index) => <g key={`x-${index}`}><line x1={x(value)} y1={height - bottom} x2={x(value)} y2={height - bottom + 3} className="jarV6Axis" />
        <text x={x(value)} y={height - bottom + 13} textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'} className="jarV6Tick">{number(value, 1)}</text></g>)}
      {valid.map((candidate, index) => <circle key={`${candidate.movementFt}-${index}`} cx={x(candidate.jarCentreFt)} cy={y(candidate[field])} r="4.5"
        className="jarUpComparisonPoint" data-testid={`${testId}-point`} data-candidate-movement={candidate.movementFt}
        aria-label={`${number(candidate.jarCentreFt)} ft; ${number(candidate[field])} ${unit}`}>
        <title>{number(candidate.jarCentreFt)} ft above bit · {number(candidate[field])} {unit}</title>
      </circle>)}
      <text x={width / 2} y={height - 5} textAnchor="middle" className="jarV6AxisLabel">Jar centre above bit (ft)</text>
      {!valid.length && <text x={width / 2} y={(top + height - bottom) / 2} textAnchor="middle" className="jarV6NoData">Dynamic result unavailable</text>}
    </svg>
  </article>;
}

export default function JarUpPositionComparison({ bha, selectedJarKey = '' }) {
  const operating = useMemo(() => readImpactInputs(bha, 'up'), [bha]);
  const comparison = useMemo(() => calculateJarUpPositionComparison(bha, selectedJarKey, operating), [bha, selectedJarKey, operating]);
  const candidates = comparison.candidates;
  return <section className="jarUpPositionComparison" aria-label="Jar Up dynamic position comparison">
    <header className="jarUpComparisonHeader">
      <div><h2>Jar Up dynamic position comparison</h2><p>Preliminary idealized Jar Up prediction · Jar Down dynamic prediction unavailable.</p></div>
    </header>
    <p className="jarUpComparisonInputs">Compared at constant entered jar overpull and stroke. Existing Impact &amp; Impulse inputs: stroke {operating.strokeIn || 'unavailable'} in · overpull at jar {operating.overpullKlbf || 'unavailable'} klbf · stuck point {operating.stuckPointFt || 'unavailable'} ft above bit.</p>
    <p className="jarUpComparisonQualification">Peak stuck-point tensile force and primary stuck-point tensile impulse are shown. Incident impact-wave force FI is a separate jar quantity and is not plotted as stuck-point force. Candidate positions are discrete calculations; no values are interpolated.</p>
    {comparison.geometryError && <p className="jarUpComparisonQualification" role="status">Relocated alternatives unavailable: {comparison.geometryError} The current position is evaluated separately when its dynamic inputs and geometry are eligible.</p>}
    <div className="jarUpComparisonCharts">
      <ComparisonChart title="Peak stuck-point tensile force" unit="klbf" field="peakStuckPointForceKlbf" candidates={candidates} testId="jar-up-force-chart" />
      <ComparisonChart title="Primary stuck-point tensile impulse" unit="lbf·s" field="impulseLbfS" candidates={candidates} testId="jar-up-impulse-chart" />
    </div>
    <div className="jarUpCandidateTableWrap">
      <table className="jarUpCandidateTable" aria-label="Jar Up candidate results">
        <thead><tr><th>Jar centre above bit (ft)</th><th>Movement (ft)</th><th>Peak stuck-point tensile force (klbf)</th><th>Primary tensile impulse (lbf·s)</th><th>Impact velocity (ft/s)</th><th>Primary pulse duration (ms)</th><th>Status / reason</th></tr></thead>
        <tbody>{candidates.map((candidate, index) => <tr key={`${candidate.movementFt}-${index}`} data-testid="jar-up-candidate-row">
          <td>{number(candidate.jarCentreFt)}</td><td>{candidate.movementFt > 0 ? '+' : ''}{number(candidate.movementFt)}</td>
          {candidate.valid ? <><td>{number(candidate.peakStuckPointForceKlbf)}</td><td>{number(candidate.impulseLbfS)}</td><td>{number(candidate.impactVelocityFtS)}</td><td>{number(candidate.primaryPulseDurationS * 1000)}</td><td>Calculated{candidate.movementFt === 0 ? ' · current position' : ''}</td></>
            : <td colSpan="5">Dynamic result unavailable: {candidate.error}</td>}
        </tr>)}</tbody>
      </table>
    </div>
    {candidates.some(candidate => candidate.valid) && <p className="jarUpComparisonSolverNote">Incident impact-wave force FI is retained separately from the peak stuck-point force shown above.</p>}
  </section>;
}
