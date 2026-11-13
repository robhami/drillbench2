import React from 'react';
import { validateDefinition } from '../../engineering/bha/componentDefinition';

export default function ComponentSupportNotice({ bha }) {
  const custom = (bha?.rows || []).some(r => r.componentDefinition && (r.componentDefinition.geometry?.kind === 'segmented' || r.componentDefinition.effectiveProperties || r.componentDefinition.material));
  const warnings = (bha?.rows || []).flatMap((r, i) => r.componentDefinition?.geometry ? validateDefinition(r.componentDefinition).warnings.map(w => `Row ${i + 1}: ${w}`) : []);
  return custom ? <div><p role="alert" style={{ padding: '4px 12px', fontSize: 12 }}>Stage 6A geometry/material foundation: existing load and JarFrame solvers still use overall row properties and their existing material assumptions. Segments, custom materials and explicit effective properties are stored for future solver integration; these results do not validate non-uniform tool behaviour. PRELIMINARY — NOT FOR OPERATIONAL USE.</p>{warnings.length > 0 && <details style={{ padding: '4px 12px', fontSize: 12 }}><summary>Component weight consistency warnings ({warnings.length})</summary>{warnings.map(w => <p key={w}>{w}</p>)}</details>}</div> : null;
}
