import React from 'react';
import JarPerformance from './JarPerformance.js';

export default function JarPlacement({ bha }) {
  return <section style={{ padding: 8, overflow: 'auto', height: '100%', fontSize: 14 }}>
    <JarPerformance bha={bha} />
  </section>;
}
