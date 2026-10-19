const finite = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value));

export function readMaximumHookload(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return { valid: true, configured: false, valueLbf: null };
  if (!finite(value) || Number(value) <= 0 || !Number.isFinite(Number(value) * 1000)) return { valid: false, configured: false, valueLbf: null, reason: 'Maximum Allowable Hookload must be a finite, positive value in klbf, or empty.' };
  return { valid: true, configured: true, valueLbf: Number(value) * 1000 };
}

/** Surface-only comparison of existing predictions; no force equations are solved here. */
export function calcHookloadLimits({ jarDirection, maximumHookloadKlbf, pickupHookloadLbf, requiredHookloadLbf } = {}) {
  if (jarDirection === 'down') return { applicable: false, status: null, reason: 'Jar Down: compression and buckling limits are not yet evaluated. No minimum hookload limit is applied.' };
  if (jarDirection !== 'up') return { applicable: false, status: null, reason: 'Select Jar Up or Jar Down.' };
  const maximum = readMaximumHookload(maximumHookloadKlbf);
  const pickupValid = finite(pickupHookloadLbf) && Number(pickupHookloadLbf) >= 0;
  const requiredValid = finite(requiredHookloadLbf) && Number(requiredHookloadLbf) >= 0;
  const requiredOverpullLbf = pickupValid && requiredValid ? Number(requiredHookloadLbf) - Number(pickupHookloadLbf) : null;
  const availableOverpullLbf = maximum.configured && pickupValid ? maximum.valueLbf - Number(pickupHookloadLbf) : null;
  const remainingMarginLbf = maximum.configured && requiredValid ? maximum.valueLbf - Number(requiredHookloadLbf) : null;
  const result = { applicable: true, requiredOverpullLbf, availableOverpullLbf, remainingMarginLbf,
    insufficientPickupCapacity: maximum.configured && pickupValid ? maximum.valueLbf < Number(pickupHookloadLbf) : null };
  if (!maximum.valid) return { ...result, status: null, reason: maximum.reason };
  if (!maximum.configured) return { ...result, status: 'Not Configured' };
  if (!pickupValid || !requiredValid) return { ...result, status: null, reason: 'A valid pickup prediction and inverse hookload solution are required for the surface limit check.' };
  // One micro-lbf roundoff allowance only; displayed rounding never sets the status.
  return { ...result, status: Math.abs(remainingMarginLbf) <= 1e-6 ? 'At Limit' : remainingMarginLbf > 0 ? 'Within Limit' : 'Exceeds Limit' };
}
