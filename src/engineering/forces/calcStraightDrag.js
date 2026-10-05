// WellBench straight-hole drilling-load model.
//
// PURPOSE
// -------
// This module estimates axial load through a BHA while SLIDE DRILLING.
// It is deliberately kept separate from the React UI so the engineering
// assumptions can be reviewed, tested and explained independently.
//
// SIGN CONVENTION
// ---------------
//   Positive axial force = compression
//   Negative axial force = tension
//   Inclination is measured from vertical (0° vertical, 90° horizontal).
//
// SLIDE-DRILLING PHYSICS USED IN THIS V1 SCREENING MODEL
// ------------------------------------------------------
// 1. The calculation starts at the bit with the user-entered WOB:
//      C_bit = WOB
// 2. Buoyed component weight is resolved along the hole axis:
//      axialWeight = buoyedWeight * cos(inclination)
//    Moving upward through the BHA, this reduces compression.
// 3. In a straight inclined hole, the simplified wall normal force is:
//      normalForce = buoyedWeight * sin(inclination)
// 4. Coulomb sliding drag is:
//      slidingDrag = mu * normalForce
// 5. During slide drilling the BHA progresses downhole. Friction acts uphole,
//    so additional compressive force is required above the component:
//      C_top = C_bottom - axialWeight + slidingDrag
//
// LIMITATIONS
// -----------
// This is a transparent first-pass screening model. It does NOT yet include
// dogleg/curvature contact forces, buckling, tortuosity, dynamic effects,
// rotational friction reduction, or a full torque-and-drag string model.

const stateOf = force => force > 0 ? 'compression' : force < 0 ? 'tension' : 'neutral';

export const calcStraightDrag = (engModel, mode = 'slide', muInput) => {
  const angle = Number(engModel?.bha?.inclination ?? 0);
  const mu = Number(muInput ?? engModel?.bha?.frictionCoefficient ?? 0.25);

  if (!Number.isFinite(angle) || angle < 0 || angle > 90 || !Number.isFinite(mu) || mu < 0 || mu > 1) {
    return { valid: false, error: 'Inclination must be 0–90° and friction coefficient 0–1.' };
  }

  // "reference" is retained as a frictionless comparison. "slide" is the
  // drilling calculation currently exposed to the user. Rotate comes later.
  if (!['reference', 'slide'].includes(mode)) {
    return { valid: false, error: 'Unknown drilling mode.' };
  }

  const rad = angle * Math.PI / 180;
  const axialFactor = Math.cos(rad);
  const normalFactor = Math.sin(rad);
  const wob = Number(engModel?.bha?.wob) * 1000;

  if (!Number.isFinite(wob) || wob < 0) return { valid: false, error: 'Invalid WOB.' };

  // WOB is the lower boundary condition for drilling. This is the key
  // distinction from a free-ended RIH/POOH calculation.
  let force = wob;

  const components = (engModel?.positions?.components || []).map(component => {
    const weight = Number(component.buoyedWeight);
    if (!Number.isFinite(weight) || weight < 0) return null;

    const bottomAxialForce = force;
    const gravityAxial = weight * axialFactor;
    const normalForce = weight * normalFactor;
    const dragForce = mu * normalForce;

    // No drag is added to the frictionless reference profile.
    // For slide drilling, downhole motion means wall friction acts uphole;
    // in the compression-positive convention this adds the drag term here.
    const dragContribution = mode === 'slide' ? dragForce : 0;
    force = bottomAxialForce - gravityAxial + dragContribution;

    return {
      ...component,
      bottomAxialForce,
      topAxialForce: force,
      bottomAxialState: stateOf(bottomAxialForce),
      topAxialState: stateOf(force),
      gravityAxial,
      normalForce,
      dragForce,
      dragContribution
    };
  });

  if (components.includes(null)) return { valid: false, error: 'Invalid component buoyed weight.' };

  return {
    valid: true,
    mode,
    mu,
    inclinationDeg: angle,
    bitAxialForce: wob,
    topOfBhaAxialForce: force,
    components
  };
};

// Find where a calculated axial-load profile crosses zero. Interpolation is
// linear within each constant-weight component, matching the assumptions of
// the straight-hole model above.
export const calcNeutralPointFromLoadProfile = loadResult => {
  if (!loadResult?.valid || !Array.isArray(loadResult.components)) {
    return { neutralPointFound: false, neutralPointFromBit: null, componentIndex: null };
  }

  // WOB = 0 puts the neutral point at the bit by definition.
  if (loadResult.bitAxialForce === 0) {
    return { neutralPointFound: true, neutralPointFromBit: 0, componentIndex: 0 };
  }

  for (let i = 0; i < loadResult.components.length; i += 1) {
    const c = loadResult.components[i];
    const bottom = Number(c.bottomAxialForce);
    const top = Number(c.topAxialForce);
    const length = Number(c.length) || (Number(c.endFromBit) - Number(c.startFromBit));

    if (!Number.isFinite(bottom) || !Number.isFinite(top) || !(length > 0)) continue;
    if (bottom === 0) return { neutralPointFound: true, neutralPointFromBit: c.startFromBit, componentIndex: i };
    if (top === 0) return { neutralPointFound: true, neutralPointFromBit: c.endFromBit, componentIndex: i };

    // A sign change means the neutral point lies inside this component.
    if ((bottom > 0 && top < 0) || (bottom < 0 && top > 0)) {
      const fractionFromBottom = bottom / (bottom - top);
      return {
        neutralPointFound: true,
        neutralPointFromBit: c.startFromBit + fractionFromBottom * length,
        componentIndex: i
      };
    }
  }

  return { neutralPointFound: false, neutralPointFromBit: null, componentIndex: null };
};
