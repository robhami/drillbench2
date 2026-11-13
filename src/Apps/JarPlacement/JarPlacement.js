import React, { lazy, Suspense, useState } from 'react';
import JarPerformance from './JarPerformance.js';
const ResearchComparison = lazy(() => import('./ResearchComparison'));

export default function JarPlacement({ bha, updateBha, analysisBitMdFt, surfaceReferenceMdFt }) {
  const [research, setResearch] = useState(false);
  return <section style={{ padding: 8, overflow: 'auto', height: '100%', fontSize: 14 }}>
    <button type="button" onClick={() => setResearch(v => !v)}>{research ? 'Return to Impact & Impulse' : 'Open Dynamic Comparison (Research)'}</button>
    <div hidden={research}><JarPerformance bha={bha} updateBha={updateBha} analysisBitMdFt={analysisBitMdFt} surfaceReferenceMdFt={surfaceReferenceMdFt} /></div>
    {research && <Suspense fallback={<p>Loading research comparison…</p>}><ResearchComparison key={bha?.id} /></Suspense>}
  </section>;
}
