// WellBench straight-hole drilling-load model.
//
// PURPOSE
// -------
// Estimate axial load through a BHA while DRILLING. The model supports:
//   reference = frictionless drilling reference
//   slide     = slide drilling with full axial Coulomb drag
//   rotate    = rotary drilling with the axial share of Coulomb friction
//
// Keeping this engineering calculation separate from the React UI makes the
// assumptions reviewable, testable and straightforward to explain to clients.
//
// SIGN CONVENTION
// ---------------
//   Positive axial force = compression
//   Negative axial force = tension
//   Inclination is measured from vertical (0° vertical, 90° horizontal).
//
// COMMON DRILLING PHYSICS
// -----------------------
// The calculation starts at the bit with the user-entered WOB:
//      C_bit = WOB
//
// For each component, buoyed weight is resolved into:
//      axialWeight = buoyedWeight * cos(inclination)
//      normalForce = buoyedWeight * sin(inclination)
//
// Coulomb wall friction magnitude is:
//      totalFriction = mu * normalForce
//
// SLIDE DRILLING
// --------------
// During slide drilling, axial movement is the only modelled relative motion,
// so all Coulomb friction opposes the downhole axial movement:
//      axialDrag = totalFriction
//      C_top = C_bottom - axialWeight + axialDrag
//
// ROTARY DRILLING
// ---------------
// During rotary drilling the tool surface moves both axially (ROP) and
// circumferentially (rotation). Coulomb friction acts opposite that combined
// sliding-velocity vector. Only its AXIAL component contributes to axial drag.
//
// For a component of outside diameter OD:
//      axialSpeed      = ROP
//      tangentialSpeed = PI * OD * RPM * 5     [ft/hr, OD in inches]
//      axialFraction   = axialSpeed / sqrt(axialSpeed^2 + tangentialSpeed^2)
//      axialDrag       = totalFriction * axialFraction
//
// This gives useful limiting behaviour:
//   RPM = 0  -> axialFraction = 1 -> rotary equation becomes the slide case.
//   High RPM -> axialFraction approaches 0 -> axial drag is strongly reduced.
//
// LIMITATIONS
// -----------
// This is a transparent straight-hole screening model, not a full torque-and-
// drag simulator. It does not include dogleg/curvature contact forces,
// buckling, tortuosity, bit torque, dynamic effects, whirl, stabilizer-specific
// contact mechanics or static-friction history. RPM is treated as the BHA RPM
// and ROP as instantaneous axial drilling speed.

const stateOf = force => force > 0 ? 'compression' : force < 0 ? 'tension' : 'neutral';

export const calcStraightDrag = (engModel, mode = 'slide', muInput) => {
  const angle = Number(engModel?.bha?.inclination ?? 0);
  const mu = Number(muInput ?? engModel?.bha?.frictionCoefficient ?? 0.25);

  if (!Number.isFinite(angle) || angle < 0 || angle > 90 || !Number.isFinite(mu) || mu < 0 || mu > 1) {
    return { valid: false, error: 'Inclination must be 0–90° and friction coefficient 0–1.' };
  }
  if (!['reference', 'slide', 'rotate'].includes(mode)) {
    return { valid: false, error: 'Unknown drilling mode.' };
  }

  const rad = angle * Math.PI / 180;
  const axialFactor = Math.cos(rad);
  const normalFactor = Math.sin(rad);
  const wob = Number(engModel?.bha?.wob) * 1000;
  if (!Number.isFinite(wob) || wob < 0) return { valid: false, error: 'Invalid WOB.' };

  // Rotate needs RPM and ROP because their ratio controls how much of the
  // friction vector acts axially. ROP is entered in ft/hr and RPM in rev/min.
  const rpm = Number(engModel?.bha?.rpm);
  const rop = Number(engModel?.bha?.rop);
  if (mode === 'rotate' && (!Number.isFinite(rpm) || rpm < 0 || !Number.isFinite(rop) || rop <= 0)) {
    return { valid: false, error: 'Rotate mode requires RPM ≥ 0 and ROP > 0 ft/hr.' };
  }

  // WOB remains the bit boundary condition for every drilling mode.
  let force = wob;

  const components = (engModel?.positions?.components || []).map(component => {
    const weight = Number(component.buoyedWeight);
    const od = Number(component.od);
    if (!Number.isFinite(weight) || weight < 0) return null;
    if (mode === 'rotate' && (!Number.isFinite(od) || od <= 0)) return null;

    const bottomAxialForce = force;
    const gravityAxial = weight * axialFactor;
    const normalForce = weight * normalFactor;
    const dragForce = mu * normalForce; // full Coulomb friction magnitude

    let axialDragFraction = mode === 'reference' ? 0 : 1;
    let tangentialSpeedFtHr = 0;

    if (mode === 'rotate') {
      // Circumference = PI*OD/12 ft. Multiply by RPM and 60 min/hr.
      tangentialSpeedFtHr = Math.PI * od / 12 * rpm * 60;
      const resultantSpeed = Math.hypot(rop, tangentialSpeedFtHr);
      axialDragFraction = resultantSpeed > 0 ? rop / resultantSpeed : 0;
    }

    // Only the axial share of friction belongs in the axial-load balance.
    const dragContribution = dragForce * axialDragFraction;
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
      dragContribution,
      axialDragFraction,
      tangentialSpeedFtHr
    };
  });

  if (components.includes(null)) {
    return { valid: false, error: mode === 'rotate' ? 'Rotate mode requires valid buoyed weight and OD for every component.' : 'Invalid component buoyed weight.' };
  }

  return {
    valid: true,
    mode,
    mu,
    rpm: mode === 'rotate' ? rpm : null,
    rop: mode === 'rotate' ? rop : null,
    inclinationDeg: angle,
    bitAxialForce: wob,
    topOfBhaAxialForce: force,
    components
  };
};

// Find where the axial-load profile crosses zero. Linear interpolation within
// each constant-weight component is consistent with this straight-hole model.
export const calcNeutralPointFromLoadProfile = loadResult => {
  if (!loadResult?.valid || !Array.isArray(loadResult.components)) {
    return { neutralPointFound: false, neutralPointFromBit: null, componentIndex: null };
  }
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
