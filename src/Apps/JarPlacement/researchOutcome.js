// Presentation only: contact status and signed area are independent facts.
export function researchOutcome(result, phase, stale = false) {
  if (stale) return 'Stale adopted compression';
  if (result?.valid) return result.contact.transitions.some(e => e.type === 'engage')
    ? 'Valid impact/contact response' : 'No contact during the simulated interval';
  return ({ failed: 'Calculation failed', unsupported: 'Unsupported research configuration',
    changed: 'Input changed — calculation required' })[phase] || 'Calculating research response';
}
