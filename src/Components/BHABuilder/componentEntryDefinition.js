import { deriveCentredStabilizer } from '../../engineering/bha/stabilizerGeometry';

export const isCentredStabilizer = draft => draft?.category === 'STB' && draft.stabilizer?.mode === 'centred';

// Presentation/input adapter into the existing definition contract; not a solver.
export function componentEntryDefinition(draft) {
  if (draft.category !== 'STB') return draft;
  if (!isCentredStabilizer(draft)) return { ...draft, sectionModel: 'complex', geometry: draft.geometry?.kind === 'segmented'
    ? { ...draft.geometry, segments: draft.geometry.segments.map(s => ({ ...s, sectionModel: 'complex' })) } : draft.geometry };
  const derived = deriveCentredStabilizer(draft);
  return { ...draft, sectionModel: 'complex', maximumOd: draft.stabilizer.bladeOd,
    geometry: { kind: 'segmented', order: 'bit-to-surface', segments: derived.sections.filter(s => s.length > 0).map(s => ({
      label: s.label, length: s.length, od: s.od, idSize: draft.idSize, weight: '',
      sectionModel: 'complex', ...(s.externalGeometry ? { externalGeometry: s.externalGeometry } : {}),
      material: { ...draft.material }
    })) } };
}
