import React, { useEffect, useState } from 'react';
import EngineeringStringCard from '../EngineeringString/EngineeringStringCard';

// Reuse the validated String summary; debounce edits and never label an old summary current.
export default function CurrentDrillingSummary(props) {
  const [snapshot, setSnapshot] = useState(null);
  const { bha, drillingMode, analysisBitMdFt, surfaceReferenceMdFt, surveyCoverage } = props;
  useEffect(() => {
    const timer = setTimeout(() => setSnapshot({ bha, drillingMode, analysisBitMdFt, surfaceReferenceMdFt, surveyCoverage }), 300);
    return () => clearTimeout(timer);
  }, [bha, drillingMode, analysisBitMdFt, surfaceReferenceMdFt, surveyCoverage]);
  const current = snapshot && Object.keys(snapshot).every(key => snapshot[key] === props[key]);
  return <section className="wbCurrentNP" aria-label="Current-depth drilling summary">
    {current ? <EngineeringStringCard {...snapshot} summaryOnly collapsible /> : <p role="status">Updating current-depth summary…</p>}
  </section>;
}
