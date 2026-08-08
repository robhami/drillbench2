
export const calcNeutralPoint = (engModel) => {
    const wobKlbf = Number(engModel.bha.wob) || 0;
    const wob = wobKlbf * 1000;

    const components = engModel.positions.components || [];

    if (wob <= 0 || components.length === 0) {
        return {
            neutralPointFound: false,
            neutralPointFromBit: null,
            componentIndex: null
        };
    }

    let cumulativeBuoyedWeight = 0;

    for (let i = 0; i < components.length; i += 1) {
        const component = components[i];

        const buoyedWeight =
            Number(component.buoyedWeight) || 0;

        const length =
            Number(component.length) || 0;

        const weightPerFootBuoyed =
            length > 0
                ? buoyedWeight / length
                : 0;

        const previousWeight = cumulativeBuoyedWeight;
        cumulativeBuoyedWeight += buoyedWeight;

        if (cumulativeBuoyedWeight >= wob) {
            const remainingWeight =
                wob - previousWeight;

            const distanceIntoComponent =
                weightPerFootBuoyed > 0
                    ? remainingWeight / weightPerFootBuoyed
                    : 0;

            return {
                neutralPointFound: true,
                neutralPointFromBit:
                    component.startFromBit + distanceIntoComponent,
                componentIndex: i
            };
        }
    }

    return {
        neutralPointFound: false,
        neutralPointFromBit: null,
        componentIndex: null
    };
};