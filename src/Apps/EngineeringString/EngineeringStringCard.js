import React, { useMemo, useState } from 'react';

import EngineeringString3D from './EngineeringString3D.js';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis.js';
import { buildEngModel } from '../../engineering/models/buildEngModel.js';
import { calcSurveyAxialLoads } from '../../engineering/forces/calcSurveyAxialLoads';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { validateSurveyCoverage } from '../../engineering/survey/surveyCoverage';
import { importedGeometry } from '../JarClearance/clearanceData';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { calculateBhaEngineeringSummary } from '../../Components/BHABuilder/bhaEngineeringSummary';
import './EngineeringStringCard.css';

export const ConstantInclinationReference = ({ bha, engModel, drillingMode }) => {
    const mode = drillingMode || 'slide';
    const result = analyzeJarPlacement(bha || engModel?.bha, mode);
    const components = result.loadProfile.valid
        ? result.loadProfile.components
        : buildEngModel(bha || engModel?.bha).positions.components;
    // Match the display's BHA boundary, excluding the DP above the assembly.
    const bhaLengthFt = Math.max(0, ...components
        .filter(component => String(component.category || '').toUpperCase() !== 'DP')
        .map(component => Number(component.endFromBit)));
    return (
        <div className="engineeringStringCard" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '4px 8px', fontSize: 12, flexShrink: 0 }}>
                <strong>{mode === 'reference' ? 'Reference' : mode === 'rotate' ? 'Rotate' : 'Slide'} · NP {result.neutralPointFt === null ? 'not determined' : `${result.neutralPointFt.toFixed(1)} ft`}</strong>
                <div>NP and component positions: distance above bit (ft), not surface MD.</div>
                <div>Straight constant-inclination drilling model; WOB at bit. Not the Jar Down static-load profile.</div>
                <div style={{ color: '#1f2937' }}>BHA length · {bhaLengthFt.toFixed(1)} ft</div>
                {result.jars.map((jar, index) => <React.Fragment key={index}><div style={{ color: '#00695c', fontWeight: 600 }}>
                    JAR · {jar.centreFt.toFixed(1)} ft · {jar.distanceFromNeutralFt === null
                        ? 'NP not determined'
                        : `${jar.distanceFromNeutralFt >= 0 ? '+' : ''}${jar.distanceFromNeutralFt.toFixed(1)} ft ${jar.distanceFromNeutralFt >= 0 ? 'above' : 'below'} NP`}
                </div>
                    <div style={{ color: '#9a3412', fontWeight: 600 }}>
                        NP avoidance zone · {jar.avoidanceZone.lowerFt.toFixed(1)}–{jar.avoidanceZone.upperFt.toFixed(1)} ft · WOB {jar.avoidanceZone.valid
                            ? `${jar.avoidanceZone.minWobKlbf.toFixed(2)}–${jar.avoidanceZone.maxWobKlbf.toFixed(2)} klbf`
                            : 'not determined'}
                    </div>
                    {jar.avoidanceZone.currentInside && <div role="alert" style={{ color: '#9a3412', fontWeight: 700 }}>Current WOB places NP inside the jar NP avoidance zone.</div>}
                    {jar.avoidanceZone.errors.map(error => <div key={error} style={{ color: '#9a3412' }}>{error}</div>)}
                </React.Fragment>)}
                {!result.loadProfile.valid && <div role="alert">{result.loadProfile.error}</div>}
                <div style={{ fontSize: 10, color: '#855800' }}>PRELIMINARY — NOT FOR OPERATIONAL USE</div>
            </div>
        </div>
    );
};

const finite = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value));
const ft = value => value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function neutralPointRelativeToJar(neutralPointFt, jarCentreFt) {
    if (!finite(neutralPointFt) || !finite(jarCentreFt)) return null;
    const distanceFt = Number(neutralPointFt) - Number(jarCentreFt);
    if (Math.abs(distanceFt) < 1e-8) return { distanceFt: 0, direction: 'at' };
    return { distanceFt: Math.abs(distanceFt), direction: distanceFt > 0 ? 'above' : 'below' };
}

// Describe the returned samples, without calculating or moving a solver zero.
function crossingDirection(load, point) {
    const bitSide = [...load.profile].reverse().find(p => p.fromBitFt < point.fromBitFt && Math.abs(p.axialForceLbf) > 1e-8);
    const surfaceSide = load.profile.find(p => p.fromBitFt > point.fromBitFt && Math.abs(p.axialForceLbf) > 1e-8);
    if (!bitSide || !surfaceSide) return 'Boundary zero; one-sided';
    if (Math.sign(bitSide.axialForceLbf) === Math.sign(surfaceSide.axialForceLbf)) return 'Zero touch; no sign reversal';
    return bitSide.axialForceLbf > 0 ? 'Compression → tension toward surface' : 'Tension → compression toward surface';
}

const EngineeringStringCard = ({ bha: inputBha, engModel, drillingMode = 'slide', setDrillingMode, updateBha, analysisBitMdFt, surfaceReferenceMdFt = 0, surveyCoverage, summaryOnly = false, collapsible = false }) => {
    const [stringView, setStringView] = useState('bha');
    const bha = inputBha || engModel?.bha;
    const source = useActiveSurvey(bha);
    const survey = useMemo(() => importedGeometry(source), [source]);
    const derivedDepth = analysisDepth(bha);
    const depth = analysisBitMdFt === undefined ? derivedDepth.valid ? derivedDepth.bitMdFt : NaN : finite(analysisBitMdFt) ? Number(analysisBitMdFt) : NaN;
    const surface = finite(surfaceReferenceMdFt) ? Number(surfaceReferenceMdFt) : NaN;
    const deployment = useMemo(() => deployDrillstring(bha, depth, { surfaceMdFt: surface }), [bha, depth, surface]);
    const coverage = useMemo(() => surveyCoverage || validateSurveyCoverage(survey, {
        startMdFt: surface, endMdFt: depth, calculations: ['survey-based drilling neutral points']
    }), [surveyCoverage, survey, surface, depth]);
    const load = useMemo(() => {
        if (!deployment.valid) return { valid: false, errors: deployment.errors };
        if (!coverage.covered) return { valid: false, errors: [coverage.message] };
        if (!finite(bha?.wob)) return { valid: false, errors: ['Enter a specific nonnegative WOB in the Analysis WOB control. Low and High WOB define the Neutral Point Behaviour sweep only.'] };
        return calcSurveyAxialLoads({ bha: deployment.bha, survey, bitMdFt: depth, mode: drillingMode,
            wobLbf: Number(bha.wob) * 1000, mudWeightPpg: bha?.mudWeight,
            frictionCoefficient: bha?.frictionCoefficient, rpm: bha?.rpm, ropFtHr: bha?.rop });
    }, [deployment, coverage, bha, survey, depth, drillingMode]);
    const points = load.valid ? load.neutralPoints : [];
    const intervals = load.valid ? load.neutralIntervals : [];
    // A unique marker is meaningful only for exactly one isolated zero and no plateau.
    const single = points.length === 1 && intervals.length === 0 ? points[0] : null;
    const components = useMemo(() => load.valid ? load.components : buildEngModel(deployment.valid ? deployment.bha : bha).positions.components, [load, deployment, bha]);
    const jars = load.valid ? load.jars.map(jar => ({ ...jar, centreFt: jar.centreFromBitFt,
        distanceFromNeutralFt: single ? jar.centreFromBitFt - single.fromBitFt : null })) : [];
    const trajectoryDescription = source?.kind === 'generated-vertical'
        ? 'Generated vertical fallback (0° inclination; not a measured survey).'
        : source?.originalCsv ? `Associated survey: ${source.filename || source.origin || 'unnamed survey'}.`
            : 'No confirmed survey or explicit vertical fallback is available.';
    const bhaSummary = useMemo(() => calculateBhaEngineeringSummary(bha), [bha]);
    const bhaLength = Math.max(0, ...components.filter(c => String(c.category).toUpperCase() !== 'DP').map(c => c.endFromBit));
    const dcSections = useMemo(() => ({
        above: { lengthFt: bhaSummary.geometry.availableDcAboveJarLengthFt, startFt: bhaSummary.geometry.availableDcAboveJarStartFt, endFt: bhaSummary.geometry.availableDcAboveJarEndFt },
        below: { lengthFt: bhaSummary.geometry.availableDcBelowJarLengthFt, startFt: bhaSummary.geometry.availableDcBelowJarStartFt, endFt: bhaSummary.geometry.availableDcBelowJarEndFt }
    }), [bhaSummary.geometry]);
    const content = <div className="engineeringStringCard engineeringStringSurveyCard">
        <div className="engineeringStringSummary">
            {(setDrillingMode || updateBha) && <div className="engineeringStringControls">
                {setDrillingMode && <label>Mode<select aria-label="Drilling Mode" value={drillingMode} onChange={event => setDrillingMode(event.target.value)}>
                    <option value="slide">Slide</option><option value="rotate">Rotate</option><option value="reference">Reference</option>
                </select></label>}
                {updateBha && <label title="Specific bit WOB for drilling-load analyses; this value is not inferred from Low or High WOB.">WOB<input aria-label="Analysis WOB (klbf)" type="number" min="0" step="any" value={bha?.wob ?? ''}
                    onChange={event => updateBha({ wob: event.target.value })} /></label>}
            </div>}
            {!load.valid && <div className="engineeringStringUnavailable" role="alert">Drilling Neutral Point unavailable. {load.errors.join(' ')}</div>}
            {load.valid && !jars.length && <div role="status">No jar is available for the drilling load comparison.</div>}
            {jars.length > 0 && (() => {
                const jar = jars[0];
                const relation = single ? neutralPointRelativeToJar(single.fromBitFt, jar.centreFt) : null;
                const npLabel = !single ? 'Unavailable — no unique neutral point' : relation.direction === 'at' ? 'At jar' : `${ft(relation.distanceFt)} ft ${relation.direction}`;
                return <section className="engineeringStringJarLoad" aria-label={`Drilling load at ${jar.name || 'jar'}`}>
                    {jars.length > 1 && <span className="engineeringStringJarHeading">{jar.name || 'First jar'}</span>}
                    <div className="engineeringStringPrimaryResult"><span>NP relative to jar</span><strong>{npLabel}</strong></div>
                    <div className="engineeringStringSecondaryResult"><span>NP above bit</span><strong>{single ? `${ft(single.fromBitFt)} ft` : 'Unavailable'}</strong></div>
                </section>;
            })()}
            {load.valid && (!points.length || points.length > 1 || intervals.length > 0) && <div className="engineeringStringNpStatus" role="status">
                {!points.length && !intervals.length ? 'No neutral point within the deployed string.' : `${points.length} isolated zero crossing(s) and ${intervals.length} neutral interval(s); no unique neutral point can be selected.`}
            </div>}
            <details className="engineeringStringDetails"><summary>Engineering Details</summary>
                {jars.map((jar, index) => <div key={`jar-${index}`}>Jar {index + 1} axial load: {ft(jar.axialForceLbf / 1000)} klbf · {jar.axialForceLbf > 0 ? 'compression' : jar.axialForceLbf < 0 ? 'tension' : 'neutral'} · MD {ft(jar.mdFt)} ft</div>)}
                <div>Bit MD: {Number.isFinite(depth) ? ft(depth) + ' ft' : 'Unavailable'} · BHA length: {ft(bhaLength)} ft</div>
                {points.map((point, index) => <div key={index}>NP {index + 1}: MD {ft(point.mdFt)} ft · {ft(point.fromBitFt)} ft above bit · {crossingDirection(load, point)}</div>)}
                {intervals.map((interval, index) => <div key={index}>Neutral interval {index + 1}: MD {ft(depth - interval.endFromBit)}–{ft(depth - interval.startFromBit)} ft · {ft(interval.startFromBit)}–{ft(interval.endFromBit)} ft above bit.</div>)}
                <div>Trajectory input: {trajectoryDescription}</div>
                <div>NP MD = current bit MD − distance above bit. Crossing directions are reported toward surface; multiple zeros are not tracked physical branches.</div>
                <div>Diagram is a straight string schematic, not the well trajectory. Component colours show endpoint drilling-load state.</div>
                <div>Drilling condition only; this is not a jar-firing or buckling assessment.</div>
                {(load.warnings || []).map(warning => <div key={warning}>{warning}</div>)}
                {(!load.warnings || !load.warnings.length) && !load.valid && <div>Calculation diagnostics: {load.errors.join(' ')}</div>}
            <div className="engineeringStringReferenceDetails"><strong>Constant-Inclination Reference</strong>
                <ConstantInclinationReference bha={deployment.valid ? deployment.bha : bha} drillingMode={drillingMode} />
            </div>
            </details>
            <div className="engineeringStringDisclaimer">PRELIMINARY — NOT FOR OPERATIONAL USE</div>
        </div>
        {!summaryOnly && <>
            <div className="engineeringString3DToolbar">
                <label>View<select aria-label="Engineering string view" value={stringView} onChange={event => setStringView(event.target.value)}>
                    <option value="bha">BHA</option><option value="full">Full String</option>
                </select></label>
            </div>
            <EngineeringString3D components={components} neutralPointFt={single?.fromBitFt ?? null} jars={jars}
                dcSections={dcSections} fullString={stringView === 'full'} />
            <div className="engineeringStringDcReadouts" aria-label="Available drill collar sections">
                <span><b>DC above jar</b><strong>{finite(dcSections.above?.lengthFt) ? `${ft(dcSections.above.lengthFt)} ft` : 'Unavailable'}</strong></span>
                <span><b>DC below jar</b><strong>{finite(dcSections.below?.lengthFt) ? `${ft(dcSections.below.lengthFt)} ft` : 'Unavailable'}</strong></span>
            </div>
        </>}
    </div>;
    return collapsible ? <details className="wbCurrentNPDetails"><summary>Current-Depth NP — {single ? `${Math.round(single.mdFt).toLocaleString('en-US')} ft MD` : 'No unique NP'}</summary>{content}</details> : content;
};

export default EngineeringStringCard;
