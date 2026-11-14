import React from 'react';
import RealBhaComparison from './RealBhaComparison';
import JarFrameV6Presentation from './JarFrameV6Presentation';

/** The Jar Position Analysis has one primary customer workflow: the loaded real BHA. */
export default function JarConfiguration(props) {
  return <section className="jarConfigurationWorkspace" aria-label="Jar Position Analysis">
    <JarFrameV6Presentation bha={props.bha} />
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
