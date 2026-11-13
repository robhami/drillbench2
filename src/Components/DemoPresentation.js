import React, { createContext, useContext } from 'react';

// Session/view state only. Never project these labels back into engineering data.
export const DemoPresentationContext = createContext(false);
export const useDemoPresentation = () => useContext(DemoPresentationContext);
const aliases = [
  { id: 'bha-108', category: 'RSS_MTR', source: 'MOTOR 6.75 SLB VORTEX', display: '6.75" Downhole Motor' },
  { id: 'bha-86', category: 'JAR', source: 'JAR OSC HQ 6.5in - 78.8 #', display: '6.5" Hydraulic Drilling Jar' }
];
export function componentDisplayLabel(component, enabled) {
  const source = component?.toolName || component?.name || component?.category || 'Component';
  const alias = enabled && aliases.find(a => String(component?.selectedToolId ?? component?.id) === a.id && component?.category === a.category && source === a.source);
  return alias ? alias.display : source;
}
export function ComponentLabel({ component }) {
  const enabled = useDemoPresentation();
  const label = componentDisplayLabel(component, enabled);
  return <span title={enabled && label !== componentDisplayLabel(component, false) ? component?.toolName || component?.name : undefined}>{label}</span>;
}
export function DemoProvenance({ bha }) {
  const enabled = useDemoPresentation();
  if (!enabled) return null;
  const rows = (bha?.rows || []).filter(r => componentDisplayLabel(r, true) !== componentDisplayLabel(r, false));
  return <div style={{ fontSize: 12, marginBottom: 8 }}>
    <p style={{ margin: '4px 0' }}>Demo Presentation View: display aliases only. Entered specifications retain their original catalogue provenance; they are not verified generic product specifications.</p>
    {rows.length > 0 && <details><summary>Original catalogue identities</summary>{rows.map((r, i) => <p key={r.rowId || i}>{r.toolName} · ID {r.selectedToolId}{r.manufacturer ? ` · Manufacturer: ${r.manufacturer}` : ''}</p>)}</details>}
  </div>;
}
