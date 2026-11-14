import React, { useMemo, useState } from 'react';
import RealBhaComparison from './RealBhaComparison';
import JarFrameV6Presentation from './JarFrameV6Presentation';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { importedGeometry } from '../JarClearance/clearanceData';
import { buildLoadedBhaPresentation } from './loadedBhaPresentation';

/** The Jar Position Analysis has one primary customer workflow: the loaded real BHA. */
export default function JarConfiguration(props) {
  const [mode, setMode] = useState('loaded');
  const source = useActiveSurvey(props.bha);
  const survey = useMemo(() => mode === 'loaded' ? importedGeometry(source) : null, [source, mode]);
  const loadedData = useMemo(() => mode === 'loaded' ? buildLoadedBhaPresentation({
    bha: props.bha, survey, drillingMode: props.drillingMode,
    surfaceReferenceMdFt: props.surfaceReferenceMdFt
  }) : null, [mode, props.bha, survey, props.drillingMode, props.surfaceReferenceMdFt]);
  return <section className="jarConfigurationWorkspace" aria-label="Jar Position Analysis">
    <JarFrameV6Presentation bha={props.bha} loadedData={loadedData} mode={mode} onModeChange={setMode} />
    <details className="jarV6ExistingWorkflows">
      <summary>Existing Jar Position Analysis workflows · static comparison, Jar Up, Jar Down and research</summary>
      <div className="jarV6WorkflowBody">
        <header className="jarConfigurationHeader">
          <div><h1>JarFrame — Jar Position Analysis</h1><p>Loaded assembly, Jar Up configuration comparison and engineering results.</p></div>
          <span className="jarConfigurationNotice">PRELIMINARY — NOT FOR OPERATIONAL USE</span>
        </header>
        <RealBhaComparison {...props} />
      </div>
    </details>
  </section>;
}
