import React from 'react';
import RealBhaComparison from './RealBhaComparison';

/** The Jar Position Analysis has one primary customer workflow: the loaded real BHA. */
export default function JarConfiguration(props) {
  return <section className="jarConfigurationWorkspace" aria-label="Jar Position Analysis">
    <header className="jarConfigurationHeader">
      <div><h1>JarFrame — Jar Position Analysis</h1><p>Loaded assembly, Jar Up configuration comparison and engineering results.</p></div>
      <span className="jarConfigurationNotice">PRELIMINARY — NOT FOR OPERATIONAL USE</span>
    </header>
    <RealBhaComparison {...props} />
  </section>;
}
