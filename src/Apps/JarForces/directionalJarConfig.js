const finite = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value));

// Optional BHA-row metadata only; no mechanism is inferred from tool identity.
export function directionSettings(row, direction) {
  const saved = row?.jarDirections?.[direction] || {};
  const mechanism = ['hydraulic', 'mechanical', 'unavailable'].includes(saved.mechanism) ? saved.mechanism : '';
  const tripForceKlbf = saved.tripForceKlbf ?? '';
  const targetForceKlbf = saved.targetForceKlbf !== undefined ? saved.targetForceKlbf : mechanism === 'mechanical' ? tripForceKlbf : '';
  return { mechanism, tripForceKlbf, targetForceKlbf };
}

export function operatingAvailability(settings) {
  if (!settings.mechanism) return { enabled: false, message: 'Select a mechanism for this jar direction; existing records remain unconfigured.' };
  if (settings.mechanism === 'unavailable') return { enabled: false, message: 'This jar does not support the selected direction.' };
  if (settings.mechanism === 'hydraulic') return { enabled: true, message: 'Applied static loading; the target is not a fixed hydraulic firing threshold.' };
  if (!finite(settings.tripForceKlbf) || Number(settings.tripForceKlbf) <= 0) return { enabled: false, message: 'Enter a positive manufacturer-defined mechanical trip force for this direction.' };
  if (!finite(settings.targetForceKlbf) || Number(settings.targetForceKlbf) <= 0) return { enabled: true, message: 'Enter a positive static target; the mechanical trip setting is not a firing guarantee.' };
  return { enabled: true, message: Number(settings.targetForceKlbf) < Number(settings.tripForceKlbf) ?
    'Configured mechanical release setting has not been reached.' :
    'Static force target meets the configured mechanical trip setting; firing is not guaranteed.' };
}
