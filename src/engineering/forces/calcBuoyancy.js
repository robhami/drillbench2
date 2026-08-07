export const calcBuoyancyFactor = (
    mudWeight,
    steelDensity = 65.5
) => {
    const mw = Number(mudWeight);

    if (!mw || mw <= 0) return null;

    return 1 - mw / steelDensity;
};

export const calcBuoyedWeight = (
    airWeight,
    mudWeight,
    steelDensity = 65.5
) => {
    const bf = calcBuoyancyFactor(
        mudWeight,
        steelDensity
    );

    if (bf === null) return null;

    return Number(airWeight) * bf;
};