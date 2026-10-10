// Skeem, Friedman & Walker, SPE 7521 (JPT, November 1979), pp. 1382–1383.
// Stage 1: published pre-impact Equations 1–3 only. See docs/SkeemDynamics.md.
// F0 is a POSITIVE tensile-overpull magnitude at the jar, not signed drilling
// axial force or surface hookload. The stationary anvil is approached upward.

export const SKEEM_PREIMPACT_NOTICE = 'PRELIMINARY — NOT FOR OPERATIONAL USE';
const DEFAULT_MAX_REFLECTIONS = 10000;
const HARD_MAX_REFLECTIONS = 100000;
const ROUND_OFF_FACTOR = 64 * Number.EPSILON;

const failure = (error, reflectionHistory = []) => ({
    valid: false, error, notice: SKEEM_PREIMPACT_NOTICE, reflectionHistory
});

/**
 * Units are explicit in field names. Lengths/velocities/time are ft, ft/s, s;
 * OD/ID and stroke are in inches; E is psi; overpull is lbf; areas are in².
 * Assumes equal E and acoustic velocity in uniform collars and uniform pipe,
 * Ac > Ap, an ideal release, stationary anvil, and no surface-wave return.
 * options.maxReflections bounds completed hammer reflections (including zero).
 */
export const calcSkeemPreImpact = (input, options = {}) => {
    if (!input || typeof input !== 'object' || !options || typeof options !== 'object') {
        return failure('Provide input and options objects.');
    }
    const positiveFields = [
        'overpullLbf', 'strokeIn', 'upperCollarLengthFt', 'collarOdIn',
        'pipeOdIn', 'youngsModulusPsi', 'acousticVelocityFtS'
    ];
    for (const field of positiveFields) {
        if (!Number.isFinite(input[field]) || input[field] <= 0) {
            return failure(`${field} must be a finite positive number.`);
        }
    }
    for (const [id, od] of [['collarIdIn', 'collarOdIn'], ['pipeIdIn', 'pipeOdIn']]) {
        if (!Number.isFinite(input[id]) || input[id] < 0 || input[id] >= input[od]) {
            return failure(`${id} must be finite, non-negative and smaller than ${od}.`);
        }
    }
    if (input.direction !== undefined && input.direction !== 'up') {
        return failure('Only upward jarring is supported.');
    }
    const maxReflections = options.maxReflections ?? DEFAULT_MAX_REFLECTIONS;
    if (!Number.isSafeInteger(maxReflections) || maxReflections < 0 || maxReflections > HARD_MAX_REFLECTIONS) {
        return failure(`maxReflections must be an integer from 0 to ${HARD_MAX_REFLECTIONS}.`);
    }

    // Difference-of-squares form avoids subtracting two nearly equal squares.
    const metalArea = (od, id) => Math.PI / 4 * (od - id) * (od + id);
    const AcIn2 = metalArea(input.collarOdIn, input.collarIdIn);
    const ApIn2 = metalArea(input.pipeOdIn, input.pipeIdIn);
    const alpha = AcIn2 / ApIn2;
    const lambda = (alpha - 1) / (alpha + 1);
    // Published accelerating-wave configuration (p. 1383): alpha > 1,
    // 0 < lambda < 1. Equal/reversed impedance is outside this implementation.
    if (![AcIn2, ApIn2, alpha, lambda].every(Number.isFinite) || !(AcIn2 > ApIn2 && ApIn2 > 0 && lambda > 0 && lambda < 1)) {
        return failure('The published model requires finite collar area greater than pipe area and 0 < lambda < 1.');
    }

    // Equation 1. F0/(Ac*E) is dimensionless: va can remain in ft/s.
    const vcFtS = input.overpullLbf / AcIn2 / input.youngsModulusPsi * input.acousticVelocityFtS;
    const reflectionPeriodS = 2 * (input.upperCollarLengthFt / input.acousticVelocityFtS);
    const strokeFt = input.strokeIn / 12;
    const limitingVelocityFtS = alpha * vcFtS;
    if (![vcFtS, reflectionPeriodS, strokeFt, limitingVelocityFtS].every(value => Number.isFinite(value) && value > 0)) {
        return failure('Derived velocity, reflection period or stroke is outside numerical representability.');
    }

    let displacementFt = 0;
    let velocityFtS = vcFtS;
    let lambdaPower = 1;
    let velocityIncrementFtS = 0;
    const reflectionHistory = [];

    for (let n = 0; n <= maxReflections; n += 1) {
        const timeStartS = n * reflectionPeriodS;
        const nextReflectionTimeS = (n + 1) * reflectionPeriodS;
        const intervalDisplacementFt = velocityFtS * reflectionPeriodS;
        const fullEndDisplacementFt = displacementFt + intervalDisplacementFt;
        if (![timeStartS, nextReflectionTimeS, fullEndDisplacementFt].every(Number.isFinite) ||
            !(nextReflectionTimeS > timeStartS && fullEndDisplacementFt > displacementFt)) {
            return failure('Reflection interval cannot be resolved numerically.', reflectionHistory);
        }

        // Equation 3 is strict at the lower bound and inclusive at the upper:
        // tau*sum(v_0..v_{N-1}) < s <= tau*sum(v_0..v_N).
        // Impact exactly at a return uses the pre-return (left-limit) velocity;
        // the coincident return is not counted as completed BEFORE impact.
        const displacementToleranceFt = ROUND_OFF_FACTOR * Math.max(strokeFt, fullEndDisplacementFt);
        const endsAtImpact = strokeFt <= fullEndDisplacementFt + displacementToleranceFt;
        const durationS = endsAtImpact
            ? Math.min(reflectionPeriodS, Math.max(0, (strokeFt - displacementFt) / velocityFtS))
            : reflectionPeriodS;
        const timeEndS = endsAtImpact ? timeStartS + durationS : nextReflectionTimeS;
        const endDisplacementFt = displacementFt + velocityFtS * durationS;
        if (!(timeEndS > timeStartS)) {
            return failure('Impact interval cannot be resolved numerically.', reflectionHistory);
        }
        reflectionHistory.push({
            completedReflections: n, timeStartS, timeEndS, nextReflectionTimeS,
            velocityFtS, velocityIncrementFtS, lambdaPower,
            startDisplacementFt: displacementFt, endDisplacementFt, endsAtImpact
        });
        if (endsAtImpact) {
            return {
                valid: true, error: null, notice: SKEEM_PREIMPACT_NOTICE,
                AcIn2, ApIn2, alpha, lambda, vcFtS, reflectionPeriodS,
                limitingVelocityFtS, completedReflections: n,
                impactTimeS: timeEndS, hammerVelocityFtS: velocityFtS,
                impactDisplacementFt: endDisplacementFt,
                strokeResidualFt: endDisplacementFt - strokeFt,
                displacementToleranceFt, reflectionHistory
            };
        }
        displacementFt = fullEndDisplacementFt;
        // Equation 2, evaluated as an event recurrence, not a time-step model:
        // v_n = vc*(1 + 2*sum(lambda^k, k=1..n)).
        lambdaPower *= lambda;
        velocityIncrementFtS = 2 * vcFtS * lambdaPower;
        velocityFtS += velocityIncrementFtS;
        if (!(Number.isFinite(velocityFtS) && velocityFtS > 0)) {
            return failure('Reflected velocity is outside numerical representability.', reflectionHistory);
        }
    }
    return failure(`Impact requires more than ${maxReflections} completed reflections; no prediction returned.`, reflectionHistory);
};
