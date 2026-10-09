import { calcStraightDrag, calcNeutralPointFromLoadProfile } from '../forces/calcStraightDrag.js';

// Numerical zero only (one billionth of a pound), e.g. cos(90 degrees) noise.
const FORCE_ZERO_LBF = 1e-9;

// In the existing straight-hole model, WOB is an additive force boundary:
// F(x, WOB_lbf) = F(x, 0) + WOB_lbf. Use calculated boundary forces,
// not a second gravity/drag equation. Input WOB and returned limits are klbf.
export const calcWobForNeutralPoint = (model, mode, positionFt, zeroProfile) => {
    const fail = error => ({ positionFt, valid: false, wobKlbf: null, error });
    const profile = zeroProfile || calcStraightDrag({ ...model, bha: { ...model.bha, wob: 0 } }, mode);
    if (!profile.valid) return fail(profile.error);
    if (!Number.isFinite(positionFt) || positionFt < 0) return fail('Invalid NP boundary position.');
    const component = profile.components.find(c => c.startFromBit <= positionFt && c.endFromBit >= positionFt);
    if (!component) return fail('NP boundary lies outside the modelled string.');
    const fraction = (positionFt - component.startFromBit) / component.length;
    const zeroForce = component.bottomAxialForce + fraction * (component.topAxialForce - component.bottomAxialForce);
    const wobKlbf = Math.abs(zeroForce) < FORCE_ZERO_LBF ? 0 : -zeroForce / 1000;
    if (!Number.isFinite(wobKlbf) || wobKlbf < 0) return fail('NP boundary cannot be reached with non-negative WOB.');
    const check = calcNeutralPointFromLoadProfile(calcStraightDrag({ ...model, bha: { ...model.bha, wob: wobKlbf } }, mode));
    if (!check.neutralPointFound || Math.abs(check.neutralPointFromBit - positionFt) > 1e-6) {
        return fail('Boundary force can be zero, but the selected NP occurs elsewhere or is not unique.');
    }
    return { positionFt, valid: true, wobKlbf, error: null };
};

export const calcJarAvoidanceZone = (model, mode, jar, neutralPointFt,
    zeroProfile = calcStraightDrag({ ...model, bha: { ...model.bha, wob: 0 } }, mode)) => {
    const lowerFt = 0.8 * jar.centreFromBit;
    const upperFt = 1.2 * jar.centreFromBit;
    const lower = calcWobForNeutralPoint(model, mode, lowerFt, zeroProfile);
    const upper = calcWobForNeutralPoint(model, mode, upperFt, zeroProfile);
    // A single WOB interval requires the load to decrease throughout this zone.
    // Reject flat/non-monotonic sections rather than imply a unique NP range.
    const monotonic = zeroProfile?.valid && zeroProfile.components
        .filter(c => c.endFromBit > lowerFt && c.startFromBit < upperFt)
        .every(c => c.bottomAxialForce - c.topAxialForce > FORCE_ZERO_LBF);
    const valid = lower.valid && upper.valid && monotonic;
    const errors = [lower.error, upper.error];
    if (lower.valid && upper.valid && !monotonic) errors.push('No unique WOB interval: load is flat or non-monotonic within the zone.');
    return {
        lowerFt, upperFt, lower, upper, valid,
        minWobKlbf: valid ? Math.min(lower.wobKlbf, upper.wobKlbf) : null,
        maxWobKlbf: valid ? Math.max(lower.wobKlbf, upper.wobKlbf) : null,
        currentInside: Number.isFinite(neutralPointFt) && neutralPointFt >= lowerFt - 1e-6 && neutralPointFt <= upperFt + 1e-6,
        errors: [...new Set(errors.filter(Boolean))]
    };
};
