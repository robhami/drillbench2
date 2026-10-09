// Presentation range only. Consume existing positions and selected-mode loads;
// never modify component geometry or interpolate a new neutral point.
export const getStringDisplayExtent = (components, neutralPointFt) => {
    const totalLength = Math.max(0, ...components.map(c => Number(c.endFromBit)));
    const bhaEnd = Math.max(0, ...components
        .filter(c => String(c.category || '').toUpperCase() !== 'DP')
        .map(c => Number(c.endFromBit)));

    // A DP-only string or missing load data has no reliable BHA-focused range.
    if (!bhaEnd || bhaEnd === totalLength) return totalLength;
    const trailingDp = components.filter(c => Number(c.endFromBit) > bhaEnd);
    if (trailingDp.some(c => !Number.isFinite(c.bottomAxialForce) || !Number.isFinite(c.topAxialForce))) {
        return totalLength;
    }

    // Retain DP with compression at its top, including all-compression strings.
    const compressionEnd = Math.max(bhaEnd, ...trailingDp
        .filter(c => c.topAxialForce > 0)
        .map(c => Number(c.endFromBit)));
    const neutralEnd = Number.isFinite(neutralPointFt) ? neutralPointFt : 0;
    const contextFt = Math.max(20, bhaEnd * 0.1);
    return Math.min(totalLength, Math.max(compressionEnd, neutralEnd) + contextFt);
};
