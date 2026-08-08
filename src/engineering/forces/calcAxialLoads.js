export const calcAxialLoads = (engModel) => {
    const components =
        engModel.positions.components || [];

    const wobKlbf =
        Number(engModel?.bha?.wob) || 0;

    const wob = wobKlbf * 1000;

    // Positive = compression
    // Negative = tension
    let runningForce = wob;

    const axialComponents = components.map((component) => {
        const bottomAxialForce = runningForce;

        const buoyedWeight =
            Number(component.buoyedWeight) || 0;

        const topAxialForce =
            bottomAxialForce - buoyedWeight;

        runningForce = topAxialForce;

        const getState = (force) => {
            if (force > 0) return 'compression';
            if (force < 0) return 'tension';
            return 'neutral';
        };

        return {
            ...component,
            bottomAxialForce,
            topAxialForce,
            bottomAxialState: getState(bottomAxialForce),
            topAxialState: getState(topAxialForce)
        };
    });

    return {
        bitAxialForce: wob,
        topOfBhaAxialForce: runningForce,
        components: axialComponents
    };
};