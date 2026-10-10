import { calcSkeemPreImpact, SKEEM_PREIMPACT_NOTICE } from './skeemDynamics';

// Independent manufactured case: Ac=3*pi/4, Ap=3*pi/16, alpha=4,
// lambda=0.6, vc=1 ft/s, tau=0.01 s. No production helper sets expectations.
const simple = {
    overpullLbf: 750 * Math.PI, strokeIn: 0.5592, upperCollarLengthFt: 80,
    collarOdIn: 2, collarIdIn: 1, pipeOdIn: 1, pipeIdIn: 0.5,
    youngsModulusPsi: 16000000, acousticVelocityFtS: 16000
};
const published = {
    overpullLbf: 165000, strokeIn: 4, upperCollarLengthFt: 120,
    collarOdIn: 6.25, collarIdIn: 2.75,
    pipeOdIn: 4.5, pipeIdIn: Math.sqrt(13.95), // Paper explicitly gives alpha=5.
    youngsModulusPsi: 30000000, acousticVelocityFtS: 16000 // Assumed, not specified in paper.
};
const near = (actual, expected) => expect(actual).toBeCloseTo(expected, 11);

test('areas, ratio, reflection coefficient, Eq. 1 and units are correct', () => {
    const result = calcSkeemPreImpact(simple);
    expect(result.valid).toBe(true);
    near(result.AcIn2, 3 * Math.PI / 4);
    near(result.ApIn2, 3 * Math.PI / 16);
    near(result.alpha, 4);
    near(result.lambda, 0.6);
    near(result.vcFtS, 1);
    near(result.reflectionPeriodS, 0.01);
    near(result.limitingVelocityFtS, 4);
    expect(result.notice).toBe(SKEEM_PREIMPACT_NOTICE);
});

test.each([
    [0.06, 0, 0.005, 1], // Impact before first return.
    [0.252, 1, 0.015, 2.2],
    [0.5592, 2, 0.025, 2.92]
])('analytically integrates stroke %s in without time steps', (strokeIn, n, time, velocity) => {
    const result = calcSkeemPreImpact({ ...simple, strokeIn });
    expect(result.valid).toBe(true);
    expect(result.completedReflections).toBe(n);
    near(result.impactTimeS, time);
    near(result.hammerVelocityFtS, velocity);
    near(result.impactDisplacementFt * 12, strokeIn);
    expect(result.reflectionHistory).toHaveLength(n + 1);
});

test.each([
    [0.12, 0, 0.01, 1],
    [0.384, 1, 0.02, 2.2]
])('Eq. 3 inclusive endpoint for stroke %s uses pre-return velocity', (strokeIn, n, time, velocity) => {
    const result = calcSkeemPreImpact({ ...simple, strokeIn });
    expect(result.valid).toBe(true);
    expect(result.completedReflections).toBe(n);
    near(result.impactTimeS, time);
    near(result.hammerVelocityFtS, velocity);
});

test('resolves both sides of a reflection event without smoothing the velocity jump', () => {
    const before = calcSkeemPreImpact({ ...simple, strokeIn: 0.384 - 1e-8 });
    const after = calcSkeemPreImpact({ ...simple, strokeIn: 0.384 + 1e-8 });
    expect(before.completedReflections).toBe(1);
    expect(after.completedReflections).toBe(2);
    expect(before.impactTimeS).toBeLessThan(0.02);
    expect(after.impactTimeS).toBeGreaterThan(0.02);
    near(before.hammerVelocityFtS, 2.2);
    near(after.hammerVelocityFtS, 2.92);
});

test('reflection history reproduces Eq. 2 and conserves integrated displacement', () => {
    const frozen = Object.freeze({ ...simple });
    const result = calcSkeemPreImpact(frozen);
    result.reflectionHistory.forEach((interval, n) => {
        // Closed geometric sum, independent of the production event recurrence.
        near(interval.velocityFtS, 4 - 3 * 0.6 ** n);
        near(interval.lambdaPower, 0.6 ** n);
        near(interval.timeStartS, n * 0.01);
        near(interval.nextReflectionTimeS, (n + 1) * 0.01);
        near(interval.endDisplacementFt - interval.startDisplacementFt,
            interval.velocityFtS * (interval.timeEndS - interval.timeStartS));
        if (n > 0) near(interval.startDisplacementFt, result.reflectionHistory[n - 1].endDisplacementFt);
        expect(interval.endsAtImpact).toBe(n === result.completedReflections);
    });
    expect(Math.abs(result.strokeResidualFt)).toBeLessThanOrEqual(result.displacementToleranceFt);
    expect(frozen).toEqual(simple);
});

test('many reflections remain stepwise and bounded by the pipe contraction speed', () => {
    const n = 80;
    // sum(v_0..v_{n-1}) = 4*n - 3*(1-0.6^n)/(1-0.6).
    const startDisplacement = 0.01 * (4 * n - 3 * (1 - 0.6 ** n) / 0.4);
    const velocity = 4 - 3 * 0.6 ** n;
    const strokeIn = 12 * (startDisplacement + velocity * 0.005);
    const result = calcSkeemPreImpact({ ...simple, strokeIn });
    expect(result.valid).toBe(true);
    expect(result.completedReflections).toBe(n);
    near(result.impactTimeS, 0.805);
    near(result.hammerVelocityFtS, velocity);
    expect(result.hammerVelocityFtS).toBeLessThanOrEqual(result.limitingVelocityFtS * (1 + 1e-14));
});

test('increasing overpull reduces time while doubling E and overpull leaves the result unchanged', () => {
    const base = calcSkeemPreImpact(simple);
    const morePull = calcSkeemPreImpact({ ...simple, overpullLbf: simple.overpullLbf * 2 });
    expect(morePull.impactTimeS).toBeLessThan(base.impactTimeS);
    const sameStrain = calcSkeemPreImpact({ ...simple, overpullLbf: simple.overpullLbf * 2, youngsModulusPsi: simple.youngsModulusPsi * 2 });
    near(sameStrain.impactTimeS, base.impactTimeS);
    near(sameStrain.hammerVelocityFtS, base.hammerVelocityFtS);
});

// Independent 50-digit Decimal reference: closed sums of Eq. 2, then linear
// inversion within the Eq. 3 interval. Values are not production snapshots.
const publishedCases = [
    [240, 180, 2, 0.050807259577217424, 11.461401475005768],
    [240, 120, 2, 0.043565880266872596, 11.461401475005768],
    [240, 60, 4, 0.033785028591359964, 14.974474724049681],
    [420, 315, 1, 0.06266240608282406, 8.299635550866246],
    [420, 210, 2, 0.05442794923238984, 11.461401475005768],
    [420, 105, 3, 0.04138574352638753, 13.569245424432116],
    [600, 450, 1, 0.07230526322568120, 8.299635550866246],
    [600, 300, 1, 0.06159097751139549, 8.299635550866246],
    [600, 150, 2, 0.04718656992204501, 11.461401475005768]
];
test.each(publishedCases)('Skeem example: total collars %s ft, L2 %s ft', (total, L2, n, time, velocity) => {
    expect(total - L2).toBeGreaterThan(0); // Lower stationary collars, Figure 1.
    const result = calcSkeemPreImpact({ ...published, upperCollarLengthFt: L2 });
    expect(result.valid).toBe(true);
    near(result.AcIn2, 24.740042147019622);
    near(result.ApIn2, 4.948008429403924);
    near(result.alpha, 5);
    near(result.lambda, 2 / 3);
    near(result.vcFtS, 3.5569866646569624);
    expect(result.completedReflections).toBe(n);
    near(result.impactTimeS, time);
    near(result.hammerVelocityFtS, velocity);
    near(result.impactDisplacementFt, 1 / 3);
});

test('published placement trend raises speed as L2 decreases, with constant-speed plateaus', () => {
    const cases = [450, 315, 210, 180, 120, 105, 60].map(upperCollarLengthFt =>
        calcSkeemPreImpact({ ...published, upperCollarLengthFt }));
    cases.forEach((result, index) => {
        if (!index) return;
        expect(result.impactTimeS).toBeLessThan(cases[index - 1].impactTimeS);
        expect(result.hammerVelocityFtS).toBeGreaterThanOrEqual(cases[index - 1].hammerVelocityFtS);
    });
    near(cases[2].hammerVelocityFtS, cases[4].hammerVelocityFtS);
});

test('nominal-weight area conversion is explicit and distinct from the paper alpha=5 assumption', () => {
    // Treat all 16.6 lb/ft as uniform steel at an assumed 0.283 lb/in³.
    // Tool-joint/upset contributions are not identifiable from nominal weight.
    const assumedArea = 16.6 / (12 * 0.283);
    const equivalentId = Math.sqrt(4.5 ** 2 - 4 * assumedArea / Math.PI);
    const result = calcSkeemPreImpact({ ...published, pipeIdIn: equivalentId });
    expect(result.valid).toBe(true);
    near(result.ApIn2, 4.888103651354535);
    near(equivalentId, 3.7451666361232935);
    near(result.alpha, 5.061276092245701);
    expect(result.alpha).not.toBeCloseTo(5, 2);
});

const positiveFields = ['overpullLbf', 'strokeIn', 'upperCollarLengthFt', 'collarOdIn', 'pipeOdIn', 'youngsModulusPsi', 'acousticVelocityFtS'];
test.each(positiveFields.flatMap(field => [0, -1, NaN, Infinity, undefined, '10'].map(value => [field, value])))
('rejects invalid %s = %s', (field, value) => {
    const result = calcSkeemPreImpact({ ...simple, [field]: value });
    expect(result.valid).toBe(false);
    expect(result.error).toContain(field);
    expect(result.impactTimeS).toBeUndefined();
});

test.each([
    { collarIdIn: -1 }, { pipeIdIn: -1 }, { collarIdIn: 2 }, { pipeIdIn: 1 },
    { collarIdIn: 3 }, { pipeIdIn: 2 }, { collarIdIn: NaN }, { pipeIdIn: Infinity },
    { pipeIdIn: undefined }, { pipeOdIn: 3, pipeIdIn: 0 },
    { pipeOdIn: 2, pipeIdIn: 1 }, { direction: 'down' },
    { collarOdIn: 1e308 }, { overpullLbf: Number.MIN_VALUE },
    { strokeIn: Number.MIN_VALUE }, { pipeOdIn: 1e-150, pipeIdIn: 0 }
])('rejects invalid dimensions, unsupported impedance/direction or numerical extremes: %j', changes => {
    expect(calcSkeemPreImpact({ ...simple, ...changes }).valid).toBe(false);
});

test('zero ID is a supported solid circular section; missing input is rejected', () => {
    expect(calcSkeemPreImpact({ ...simple, collarIdIn: 0, pipeIdIn: 0 }).valid).toBe(true);
    expect(calcSkeemPreImpact(undefined).valid).toBe(false);
    expect(calcSkeemPreImpact(null).valid).toBe(false);
});

test.each([-1, 1.5, Infinity, NaN, 100001])('rejects invalid reflection limit %s', maxReflections => {
    expect(calcSkeemPreImpact(simple, { maxReflections }).valid).toBe(false);
});

test('reflection safeguard returns failure instead of a fabricated impact result', () => {
    const capped = calcSkeemPreImpact(simple, { maxReflections: 1 });
    expect(capped.valid).toBe(false);
    expect(capped.error).toContain('more than 1');
    expect(capped.reflectionHistory).toHaveLength(2);
    expect(capped.impactTimeS).toBeUndefined();
    expect(calcSkeemPreImpact({ ...simple, strokeIn: 0.06 }, { maxReflections: 0 }).valid).toBe(true);
});
