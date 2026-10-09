import React from 'react';

import EngineeringString3D from './EngineeringString3D.js';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis.js';
import { buildEngModel } from '../../engineering/models/buildEngModel.js';

const EngineeringStringCard = ({ bha, engModel, drillingMode }) => {
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
            <EngineeringString3D
                components={components}
                neutralPointFt={result.neutralPointFt}
                jars={result.jars}
            />
        </div>
    );
};

export default EngineeringStringCard;
