import { calcSkeemPreImpact, calcSkeemPostImpact, SKEEM_PREIMPACT_NOTICE } from './skeemDynamics';

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

// Stage 2 manufactured case uses the unchanged Stage 1 case above.
const postSimple = { ...simple, lowerCollarLengthFt: 40, lowerCollarWeightLbf: 100, freePipeLengthFt: 3000 };

test('Eq. 4 formulations agree independently and distinguish incident from stuck-point force', () => {
    const result = calcSkeemPostImpact(postSimple);
    const F0 = 750 * Math.PI;
    expect(result.valid).toBe(true);
    near(result.impactForceLbf, 1.46 * F0);
    near(result.impactForceKlbf, 1.46 * F0 / 1000);
    expect(Math.abs(result.impactForceLbf - result.impactForceFromOverpullLbf)).toBeLessThanOrEqual(result.forceAgreementToleranceLbf);
    near(result.incidentImpactAfterWeightLbf, 1.46 * F0 - 100);
    near(result.initialStuckPointForceLbf, 2.92 * F0 - 200);
    expect(result.initialStuckPointForceLbf).not.toBe(result.impactForceLbf);
    expect(result.preImpact).toEqual(calcSkeemPreImpact(postSimple));
    expect(result.notice).toBe(SKEEM_PREIMPACT_NOTICE);
});

test('primary interval and impact/interface/residual arrival times follow the wave paths', () => {
    const result = calcSkeemPostImpact(postSimple);
    near(result.primaryPulseDurationS, 0.01);
    near(result.interfaceImpactReflectionTimeS, 0.03);
    near(result.t1S, 0.0275);
    near(result.t2S, 0.0325);
    near(result.t3S, 0.0375);
    const [initial, residual, relief] = result.forceTimeEvents;
    near(initial.relativeTimeS, 0);
    near(initial.absoluteTimeS, 0.0275);
    near(residual.relativeTimeS, 0.005);
    near(residual.absoluteTimeS, 0.0325);
    near(relief.relativeTimeS, 0.01);
    near(relief.absoluteTimeS, 0.0375);
    near(result.t3S - result.t1S, result.primaryPulseDurationS);
});

test('initial rigid reflection, residual addition and interface compression amplitudes follow Eqs. 4–5', () => {
    const result = calcSkeemPostImpact(postSimple);
    const F0 = 750 * Math.PI;
    near(result.residualIncidentForceLbf, 0.6 ** 3 * F0);
    near(result.residualStuckPointIncrementLbf, 2 * 0.6 ** 3 * F0);
    near(result.interfaceReliefIncrementLbf, -2 * 0.6 * 1.46 * F0);
    expect(result.forceHistory).toHaveLength(2);
    near(result.forceHistory[0].tensileForceLbf, 2.92 * F0 - 200);
    near(result.forceHistory[1].tensileForceLbf, (2.92 + 0.432) * F0 - 200);
    result.forceHistory.forEach(interval => {
        near(interval.compressionPositiveForceLbf, -interval.tensileForceLbf);
        near(interval.impactContributionLbf + interval.weightContributionLbf + interval.residualContributionLbf, interval.tensileForceLbf);
        expect(interval.relativeEndS).toBeLessThanOrEqual(result.primaryPulseDurationS);
    });
    expect(result.forceTimeEvents[2].kind).toBe('interface-relief');
    // Relief is audited at the endpoint and does not reduce the primary integral.
    expect(result.forceHistory[result.forceHistory.length - 1].absoluteEndS).toBe(result.t3S);
});

test('integrates piecewise history exactly and average equals impulse over T', () => {
    const result = calcSkeemPostImpact(postSimple);
    const F0 = 750 * Math.PI;
    // Hand integration: two 0.005-s rectangles with different forces.
    const expectedImpulse = ((2.92 * F0 - 200) + (3.352 * F0 - 200)) * 0.005;
    near(result.impulseLbfS, expectedImpulse);
    near(result.averageStuckPointForceLbf, 3.136 * F0 - 200);
    near(result.averageStuckPointForceLbf, result.impulseLbfS / 0.01);
    near(result.averageStuckPointForceKlbf, result.averageStuckPointForceLbf / 1000);
    near(result.forceHistory.reduce((sum, interval) => sum + interval.impulseLbfS, 0), result.impulseLbfS);
});

test('lower-collar correction changes force by -2W and impulse by -2WT without changing timing or FI', () => {
    const weightless = calcSkeemPostImpact({ ...postSimple, lowerCollarWeightLbf: 0 });
    const weighted = calcSkeemPostImpact(postSimple);
    near(weightless.impactForceLbf, weighted.impactForceLbf);
    near(weightless.impulseLbfS - weighted.impulseLbfS, 2 * 100 * 0.01);
    near(weightless.averageStuckPointForceLbf - weighted.averageStuckPointForceLbf, 200);
    expect(weightless.t1S).toBe(weighted.t1S);
    expect(weightless.t2S).toBe(weighted.t2S);
    expect(weightless.t3S).toBe(weighted.t3S);
});

test.each([
    [0.024, 0.01], [0.096, 0.01], // N=0: impact before/after interface reflection.
    [0.1992, 0.02], [0.3048, 0.02] // N=1: same two travelling-front phases.
])('residual timing derives from Stage 1 next return for stroke %s', (strokeIn, jarPassageS) => {
    const result = calcSkeemPostImpact({ ...postSimple, strokeIn });
    expect(result.valid).toBe(true);
    near(result.t2S, jarPassageS + 0.0025);
    expect(result.t2S).toBeGreaterThanOrEqual(result.t1S);
    expect(result.t2S).toBeLessThanOrEqual(result.t3S);
});

test('impact before any completed hammer return uses the N=0 residual amplitude', () => {
    const result = calcSkeemPostImpact({ ...postSimple, strokeIn: 0.06 });
    const F0 = 750 * Math.PI;
    expect(result.preImpact.completedReflections).toBe(0);
    near(result.impactForceLbf, 0.5 * F0);
    near(result.t1S, 0.0075);
    near(result.residualIncidentForceLbf, 0.6 * F0);
    near(result.impulseLbfS, ((F0 - 200) + (2.2 * F0 - 200)) * 0.005);
});

test('coincident impact and residual arrival has no artificial zero-duration interval', () => {
    const result = calcSkeemPostImpact({ ...postSimple, strokeIn: 0.12 });
    expect(result.valid).toBe(true);
    expect(result.preImpact.completedReflections).toBe(0);
    expect(result.t2S).toBe(result.t1S);
    expect(result.forceHistory).toHaveLength(1);
    near(result.forceHistory[0].tensileForceLbf, 2.2 * 750 * Math.PI - 200);
    near(result.impulseLbfS, (2.2 * 750 * Math.PI - 200) * 0.01);
});

test('average and impulse approach the same limit on both sides of a pre-impact reflection event', () => {
    const before = calcSkeemPostImpact({ ...postSimple, strokeIn: 0.12 - 1e-9 });
    const after = calcSkeemPostImpact({ ...postSimple, strokeIn: 0.12 + 1e-9 });
    expect(before.preImpact.completedReflections).toBe(0);
    expect(after.preImpact.completedReflections).toBe(1);
    expect(Math.abs(before.averageStuckPointForceLbf - after.averageStuckPointForceLbf)).toBeLessThan(0.0001);
    expect(Math.abs(before.impulseLbfS - after.impulseLbfS)).toBeLessThan(0.000001);
});

test('changing L1 at fixed W shifts absolute times but not relative forces or the primary integral', () => {
    const base = calcSkeemPostImpact(postSimple);
    const farther = calcSkeemPostImpact({ ...postSimple, lowerCollarLengthFt: 120 });
    near(farther.t1S - base.t1S, 80 / 16000);
    near(farther.t2S - base.t2S, 80 / 16000);
    near(farther.impulseLbfS, base.impulseLbfS);
    expect(farther.forceTimeEvents.map(event => event.relativeTimeS)).toEqual(base.forceTimeEvents.map(event => event.relativeTimeS));
});

// Independent 50-digit Decimal references with the Stage 1 material/area
// assumptions and explicit lower-collar air-weight density 0.283 lb/in³.
const publishedPostCases = [
    [240, 180, 265833.3333333333, 12303.474541984585, 546821.0907548704],
    [240, 120, 265833.3333333333, 8998.979766821606, 599931.9844547738],
    [240, 60, 347314.8148148148, 5147.361020873783, 686314.8027831711],
    [420, 315, 192500, 17880.144142464102, 454098.8988562312],
    [420, 210, 265833.3333333333, 13218.471147589104, 503560.8056224421],
    [420, 105, 314722.2222222222, 7697.811939444057, 586499.9572909758],
    [600, 450, 192500, 22593.23197442625, 401657.4573231333],
    [600, 300, 192500, 16080.456747884236, 428812.1799435796],
    [600, 150, 265833.3333333333, 9498.091315926296, 506564.8701827358]
];
const publishedPostInput = (total, L2) => ({
    ...published, upperCollarLengthFt: L2, lowerCollarLengthFt: total - L2,
    lowerCollarWeightLbf: 31.5 * Math.PI / 4 * 12 * 0.283 * (total - L2),
    freePipeLengthFt: 3000
});

test.each(publishedPostCases)('published configuration total %s ft, L2 %s ft: independent FI, impulse and average', (total, L2, FI, impulse, average) => {
    const input = Object.freeze(publishedPostInput(total, L2));
    const result = calcSkeemPostImpact(input);
    expect(result.valid).toBe(true);
    expect(Math.abs(result.impactForceLbf - FI)).toBeLessThan(1e-8);
    expect(Math.abs(result.impulseLbfS - impulse)).toBeLessThan(1e-8);
    expect(Math.abs(result.averageStuckPointForceLbf - average)).toBeLessThan(1e-8);
    near(result.primaryPulseDurationS, 2 * L2 / 16000);
    near(result.t2S, (result.preImpact.completedReflections + 1) * 2 * L2 / 16000 + (total - L2) / 16000);
});

test.each([240, 420, 600])('qualitative Figures 4–5 trends for %s ft collars: higher average but lower impulse as jar moves up', total => {
    const results = [0.75, 0.5, 0.25].map(fraction => calcSkeemPostImpact(publishedPostInput(total, total * fraction)));
    for (let i = 1; i < results.length; i += 1) {
        expect(results[i].averageStuckPointForceLbf).toBeGreaterThan(results[i - 1].averageStuckPointForceLbf);
        expect(results[i].impulseLbfS).toBeLessThan(results[i - 1].impulseLbfS);
    }
});

test.each(['lowerCollarLengthFt', 'freePipeLengthFt'].flatMap(field => [0, -1, NaN, Infinity, undefined, '3000'].map(value => [field, value])))
('rejects invalid Stage 2 %s = %s', (field, value) => {
    const result = calcSkeemPostImpact({ ...postSimple, [field]: value });
    expect(result.valid).toBe(false);
    expect(result.error).toContain(field);
    expect(result.impulseLbfS).toBeUndefined();
});

test.each([-1, NaN, Infinity, undefined, '100', 100000])('rejects invalid or unsupported lower weight %s', lowerCollarWeightLbf => {
    expect(calcSkeemPostImpact({ ...postSimple, lowerCollarWeightLbf }).valid).toBe(false);
});

test('weight fully expending the incident impact is rejected instead of clamping net force', () => {
    const FI = calcSkeemPostImpact(postSimple).impactForceLbf;
    expect(calcSkeemPostImpact({ ...postSimple, lowerCollarWeightLbf: FI }).valid).toBe(false);
});

test('checks conservative published free-pipe limit and actual surface-return timing', () => {
    expect(calcSkeemPostImpact({ ...postSimple, freePipeLengthFt: 1300 }).valid).toBe(false);
    expect(calcSkeemPostImpact({ ...postSimple, freePipeLengthFt: 1300.01 }).valid).toBe(true);
    const longFlight = calcSkeemPostImpact({ ...postSimple, overpullLbf: simple.overpullLbf / 1000, upperCollarLengthFt: 1000000, lowerCollarWeightLbf: 0 });
    expect(longFlight.valid).toBe(false);
    expect(longFlight.error).toContain('surface-reflected');
    const result = calcSkeemPostImpact(postSimple);
    near(result.surfaceReleaseReturnToJarTimeS, 0.01 + 2 * 3000 / 16000);
    expect(result.surfaceReleaseReturnToStuckTimeS).toBeGreaterThan(result.t3S);
});

test('propagates Stage 1 failure and rejects unresolvable event geometry', () => {
    expect(calcSkeemPostImpact({ ...postSimple, strokeIn: 0 }).valid).toBe(false);
    expect(calcSkeemPostImpact(postSimple, { maxReflections: 1 }).valid).toBe(false);
    expect(calcSkeemPostImpact({ ...postSimple, lowerCollarLengthFt: Number.MIN_VALUE }).valid).toBe(false);
    expect(calcSkeemPostImpact({ ...postSimple, lowerCollarLengthFt: 1e308 }).valid).toBe(false);
});
