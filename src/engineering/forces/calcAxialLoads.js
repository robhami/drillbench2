export const calcAxialLoads = (engModel) => {
  const components = engModel.positions.components || [];
  const wob = (Number(engModel?.bha?.wob) || 0) * 1000;
  // WellBench convention: positive = compression; negative = tension.
  // Vertical static buoyed-weight approximation only.
  let runningForce = wob;
  const axialComponents = components.map(component => {
    const bottomAxialForce = runningForce;
    const topAxialForce = bottomAxialForce - (Number(component.buoyedWeight) || 0);
    runningForce = topAxialForce;
    const getState = force => force > 0 ? 'compression' : force < 0 ? 'tension' : 'neutral';
    return { ...component, bottomAxialForce, topAxialForce,
      bottomAxialState: getState(bottomAxialForce), topAxialState: getState(topAxialForce) };
  });
  return { bitAxialForce: wob, topOfBhaAxialForce: runningForce, components: axialComponents };
};
