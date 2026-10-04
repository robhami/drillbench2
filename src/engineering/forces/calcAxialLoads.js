export const calcAxialLoads = (engModel) => {
  const components = engModel.positions.components || [];
  const wob = (Number(engModel?.bha?.wob) || 0) * 1000;
  // WellBench convention: positive = compression; negative = tension.
  // Vertical static buoyed-weight approximation only.
  // Straight, constant inclination only; measured from vertical in degrees.
  // Gravity's axial projection is buoyed weight * cos(inclination).
  const inclination = Number(engModel?.bha?.inclination ?? 0);
  const validInclination = Number.isFinite(inclination) && inclination >= 0 && inclination <= 90;
  const axialGravityFactor = validInclination ? Math.cos(inclination * Math.PI / 180) : NaN;
  let runningForce = wob;
  const axialComponents = components.map(component => {
    const bottomAxialForce = runningForce;
    const topAxialForce = bottomAxialForce - (Number(component.buoyedWeight) || 0) * axialGravityFactor;
    runningForce = topAxialForce;
    const getState = force => force > 0 ? 'compression' : force < 0 ? 'tension' : 'neutral';
    return { ...component, bottomAxialForce, topAxialForce,
      bottomAxialState: getState(bottomAxialForce), topAxialState: getState(topAxialForce) };
  });
  return { bitAxialForce: wob, topOfBhaAxialForce: runningForce, components: axialComponents, inclinationDeg: inclination, validInclination };
};
