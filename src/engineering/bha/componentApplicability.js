// Applicability checks only: never replace real components or derive effective physics.
const present = v => v != null && String(v).trim() !== '';
export const populatedComponent = r => r && ['category', 'selectedToolId', 'toolName', 'length', 'weight', 'od', 'idSize'].some(k => present(r[k]));
export const rowLabel = (r, i) => `Row ${i + 1}${r.toolName ? ` (${r.toolName})` : ''}`;

// Existing statics distribute entered nominal weight uniformly within each row
// and use the shared 65.5-ppg steel buoyancy reference. Do not silently consume
// independently specified segment weights or override a supplied density.
export function staticPropertyIssue(bha, { rotating = false, vertical = false } = {}) {
  for (const [i, row] of (bha?.rows || []).entries()) {
    const d = row.componentDefinition;
    if (!d) continue;
    const segments = d.geometry?.kind === 'segmented' ? d.geometry.segments || [] : [];
    if ([d, ...segments].some(s => present(s.material?.densityLbFt3) || (present(s.material?.name) && s.material.name.toLowerCase() !== 'unspecified')))
      return `${rowLabel(row, i)}: component-specific material density is not integrated by the current 65.5-ppg steel buoyancy model. Stored material data is preserved.`;
    if (segments.some(s => present(s.weight) && Number(s.weight) !== Number(row.weight)))
      return `${rowLabel(row, i)}: independently specified segment weights require segment-resolved axial loading; no nominal-weight averaging is applied.`;
    if (rotating && !vertical && segments.some(s => Number(s.od) !== Number(row.od)))
      return `${rowLabel(row, i)}: rotating contact on varying OD/blade geometry is not validated. Use a supported nonrotating load case; blade OD is not a solid structural annulus.`;
  }
  return null;
}

export function dynamicSectionIssue(row, i, model) {
  const d = row.componentDefinition;
  if (d?.geometry?.kind === 'segmented') return `${model}: ${rowLabel(row, i)} has segmented geometry. Segment stiffness, mass and wave transmission are not integrated; no equivalent uniform section is substituted.`;
  if (d?.sectionModel === 'complex' || d?.effectiveProperties) return `${model}: ${rowLabel(row, i)} requires a validated effective-property/tool transmission model; OD/ID alone does not establish stiffness or wave impedance.`;
  if (d?.material && (present(d.material.densityLbFt3) || present(d.material.youngsModulusPsi) || (present(d.material.name) && d.material.name.toLowerCase() !== 'unspecified'))) return `${model}: ${rowLabel(row, i)} has explicit material properties that this idealised model does not integrate. Its assumed material constants cannot override the component definition.`;
  return null;
}
