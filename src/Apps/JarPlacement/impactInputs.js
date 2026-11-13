export const impactInputDefaults = {
  up: { strokeIn: '4', overpullKlbf: '', stuckPointFt: '0' },
  down: { strokeIn: '', compressionKlbf: '', stuckPointFt: '', loadBasis: '',
    pressureDropPsi: '', pumpOpenAreaIn2: '', compressionReference: '', manufacturerReference: '' }
};
// BHA-owned input metadata only. No derived results or tool availability stored.
export function readImpactInputs(bha, direction) {
  const defaults = impactInputDefaults[direction], saved = bha?.jarImpactInputs?.[direction];
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
    typeof saved?.[key] === 'string' || (typeof saved?.[key] === 'number' && Number.isFinite(saved[key])) ? String(saved[key]) : fallback]));
}
