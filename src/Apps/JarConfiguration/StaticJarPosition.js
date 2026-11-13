import React, { useMemo, useState } from 'react';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { importedGeometry } from '../JarClearance/clearanceData';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { calculateStaticJarPositions, staticJarPositionGeometry } from '../../engineering/jar/staticJarPosition';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { calcSurveyAxialLoads } from '../../engineering/forces/calcSurveyAxialLoads';

const fmt = n => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : 'Unavailable';
export default function StaticJarPosition({ bha, drillingMode = 'slide', analysisBitMdFt, surfaceReferenceMdFt = 0 }) {
  const source = useActiveSurvey(bha);
  const trajectoryDescription = source?.kind === 'generated-vertical'
    ? 'Generated vertical fallback (0° inclination; not a measured survey)'
    : source?.originalCsv ? `Associated survey: ${source.filename || source.origin || 'unnamed survey'}`
      : 'No confirmed survey or explicit vertical fallback is available';
  const survey = useMemo(() => importedGeometry(source), [source]);
  const geometry = useMemo(() => staticJarPositionGeometry(bha), [bha]);
  const [fields, setFields] = useState({ min: null, max: null, count: '5' });
  const [snapshot, setSnapshot] = useState(null);
  const depth = analysisDepth(bha), bitMdFt = analysisBitMdFt ?? (depth.valid ? depth.bitMdFt : null);
  const currentLoad = useMemo(() => {
    if (geometry.valid) return null; // Existing relocation workflow remains unchanged.
    const deployment = deployDrillstring(bha, bitMdFt, { surfaceMdFt: surfaceReferenceMdFt });
    return deployment.valid ? calcSurveyAxialLoads({ bha: deployment.bha, survey, bitMdFt, mode: drillingMode,
      wobLbf: String(bha?.wob ?? '').trim() === '' ? '' : Number(bha.wob) * 1000,
      mudWeightPpg: bha?.mudWeight, frictionCoefficient: bha?.frictionCoefficient, rpm: bha?.rpm, ropFtHr: bha?.rop }) : deployment;
  }, [bha, survey, geometry.valid, bitMdFt, surfaceReferenceMdFt, drillingMode]);
  const values = { min: fields.min ?? (geometry.valid ? String(geometry.collarInventoryFt * .25) : ''), max: fields.max ?? (geometry.valid ? String(geometry.collarInventoryFt * .75) : ''), count: fields.count };
  const key = JSON.stringify({ bha, survey, bitMdFt, surfaceReferenceMdFt, drillingMode, values });
  const result = snapshot?.key === key ? snapshot.result : null;
  const run = event => { event.preventDefault(); setSnapshot({ key, result: calculateStaticJarPositions({ bha, survey, bitMdFt,
    surfaceMdFt: surfaceReferenceMdFt, mode: drillingMode, minLowerCollarFt: values.min, maxLowerCollarFt: values.max, samples: values.count }) }); };
  const rows = result?.valid ? [{ ...result.actual, label: 'Current BHA' }, ...result.candidates.map((c, i) => ({ ...c, label: `Candidate ${i + 1}` }))] : [];
  return <section aria-label="Stage 1 static jar placement">
    <p><strong>PRELIMINARY — NOT FOR OPERATIONAL USE</strong></p>
    <h5>Static jar placement screening — Stage 1</h5>
    <p>Current drilling WOB only; this is not a fired-jar or stuck-point impact calculation. No force, impulse or stiffness prediction is supplied for motor dynamics.</p>
    <p>Trajectory: {trajectoryDescription} · Mode: {drillingMode} · Bit MD: {fmt(bitMdFt == null ? NaN : Number(bitMdFt))} ft · Current WOB: {bha?.wob ?? 'Unavailable'} klbf.</p>
    <p>Motor/tool remains fixed below the lower collars, with its actual entered length, OD, ID and distributed air weight. Buoyancy uses the existing steel-density (65.5 ppg), equal internal/external fluid approximation. Nominal motor OD/ID do not establish effective stiffness or as-built displacement; sealed volumes, non-steel internals and hydraulic pressure forces are not modelled.</p>
    {!geometry.valid && <>
      <section aria-label="Current mixed BHA static loads">
        <h6>Current BHA static loads</h6>
        {currentLoad?.valid ? <><p role="status">Current component sequence retained. Static axial loads available independently of relocation and dynamic applicability.</p>
          <p>Neutral point above bit: {currentLoad.neutralPoints.length ? currentLoad.neutralPoints.map(p => `${fmt(p.fromBitFt)} ft`).join('; ') : currentLoad.neutralStatus}.</p>
          {currentLoad.jars.map((jar, i) => <p key={i}>Jar {i + 1}: {fmt(jar.axialForceLbf)} lbf (+ compression); {fmt(jar.centreFromBitFt)} ft above bit.</p>)}</> : <p role="status">Current static loads unavailable: {currentLoad?.errors?.join(' ')}</p>}
      </section>
      <p role="alert">Static relocation sweep unavailable: {geometry.error} This restriction concerns redistribution of uniform collar inventory, not validity of the current mixed BHA. Hookload and Neutral Point calculations remain independently assessed.</p>
    </>}
    {!survey.valid && <p role="alert">{survey.errors.map(e => e.message).join(' ')}</p>}
    {!['slide', 'rotate'].includes(drillingMode) && <p role="alert">Select the shared Slide or Rotate drilling mode for static survey screening. Reference mode is unsupported in this view.</p>}
    <form onSubmit={run}>
      <p>Redistribute the existing {fmt(geometry.collarInventoryFt)} ft of identical collars around the unchanged jar. Motor position, total collar inventory, collar/DP transition and deployed bit depth remain fixed. Continuous lengths are hypothetical; joint lengths and connections are unverified.</p>
      {[['min', 'Minimum lower collar length (ft)'], ['max', 'Maximum lower collar length (ft)'], ['count', 'Static position samples']].map(([field, label]) => <label key={field}>{label}<input type="number" step="any" value={values[field]} onChange={event => setFields(old => ({ ...old, [field]: event.target.value }))} /></label>)}
      <button type="submit" disabled={!geometry.valid || !survey.valid || !['slide', 'rotate'].includes(drillingMode)}>Run Static Screening</button>
    </form>
    {result && !result.valid && <p role="alert">{result.error}</p>}
    {result?.valid && <><p role="status">{result.validCount} valid / {result.invalidCount} invalid static candidates. No optimum or operational placement is inferred.</p>
      <table aria-label="Static jar position results"><thead><tr>{['Configuration', 'Lower / upper collars (ft)', 'Jar above bit (ft)', 'Jar MD (ft)', 'Jar axial load (lbf; + compression)', 'NP above bit (ft)', 'NP relative to jar (ft; + above)', 'Load / NP state'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, i) => {
        const jar = row.load?.jars[0], points = row.load?.neutralPoints || [], intervals = row.load?.neutralIntervals || [];
        return <tr key={i}><td>{row.label}</td><td>{fmt(row.lowerCollarLengthFt)} / {fmt(row.upperCollarLengthFt)}</td><td>{fmt(jar?.centreFromBitFt)}</td><td>{fmt(jar?.mdFt)}</td><td>{fmt(jar?.axialForceLbf)}</td><td>{!row.valid ? 'Unavailable' : points.length ? points.map(p => fmt(p.fromBitFt)).join('; ') : intervals.length ? 'Neutral interval (nonunique)' : 'None within deployed string'}</td><td>{jar && points.length ? points.map(p => fmt(p.fromBitFt - jar.centreFromBitFt)).join('; ') : 'Undefined'}</td><td>{!row.valid ? row.errors.join(' ') : intervals.length ? `${row.jarLoadState}; nonunique neutral interval(s): ${intervals.map(n => `${fmt(n.startFromBit)}–${fmt(n.endFromBit)} ft above bit`).join('; ')}` : `${row.jarLoadState}; ${row.load.neutralStatus}`}</td></tr>;
      })}</tbody></table>
      <details><summary>Static input and load audit</summary><p>{result.scope}</p><p>Motor offset: {fmt(result.geometry.motorLengthFt)} ft. Lower-collar length excludes motor and jar. Computed jar centre includes both.</p><pre>{JSON.stringify(rows.map(row => ({ label: row.label, deployment: row.deployment, status: row.status, errors: row.errors,
        components: row.load?.components, jars: row.load?.jars, neutralPoints: row.load?.neutralPoints, neutralIntervals: row.load?.neutralIntervals,
        normalContactLbf: row.load?.totalNormalContactForceLbf, frictionLbf: row.load?.totalFrictionForceLbf, warnings: row.load?.warnings })), null, 2)}</pre></details>
    </>}
    <p>Results use the existing survey axial-load solver, without bending stiffness, buckling/contact redistribution, motor bend/rotor behaviour or survey uncertainty. A missing NP is undefined clearance, not safe placement. Static drilling load does not establish jar firing or dynamic effectiveness.</p>
  </section>;
}
