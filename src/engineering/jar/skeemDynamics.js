// Skeem, Friedman & Walker, SPE 7521 (JPT, November 1979), pp. 1382–1383.
// Stages 1–2: pre-impact Equations 1–3 and primary post-impact Equations 4–5.
// See docs/SkeemDynamics.md for assumptions and derived event timing.
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

/**
 * Primary post-impact wave history (SPE 7521, pp. 1383–1385).
 * Adds lowerCollarLengthFt (L1), lowerCollarWeightLbf (W, weight force),
 * and freePipeLengthFt (L3) to Stage 1 inputs. Tensile force is positive here;
 * compressionPositiveForceLbf exposes the equivalent WellBench sign.
 * Stage 1's implementation and public interface are unchanged.
 */
export const calcSkeemPostImpact = (input, options = {}) => {
    const preImpact = calcSkeemPreImpact(input, options);
    const fail = error => ({ ...failure(error, preImpact.reflectionHistory), preImpact });
    if (!preImpact.valid) return fail(preImpact.error);
    for (const field of ['lowerCollarLengthFt', 'freePipeLengthFt']) {
        if (!Number.isFinite(input[field]) || input[field] <= 0) {
            return fail(`${field} must be a finite positive number.`);
        }
    }
    if (!Number.isFinite(input.lowerCollarWeightLbf) || input.lowerCollarWeightLbf < 0) {
        return fail('lowerCollarWeightLbf must be a finite non-negative weight force.');
    }
    // WellBench domain restriction, not a new wave equation: use the stricter
    // published 1300-ft bound because the paper does not classify short/long.
    if (input.freePipeLengthFt <= 1300) {
        return fail('Stage 2 conservatively requires freePipeLengthFt > 1300 ft (paper short/long thresholds are not classified).');
    }

    const { AcIn2, vcFtS, lambda, hammerVelocityFtS, impactTimeS, reflectionPeriodS } = preImpact;
    // Equation 4; E*Ac/va converts particle velocity (ft/s) directly to lbf.
    const impactForceLbf = AcIn2 * (input.youngsModulusPsi / input.acousticVelocityFtS) * (hammerVelocityFtS / 2);
    const impactForceFromOverpullLbf = 0.5 * (hammerVelocityFtS / vcFtS) * input.overpullLbf;
    const forceAgreementToleranceLbf = 128 * Number.EPSILON * Math.max(impactForceLbf, impactForceFromOverpullLbf);
    if (![impactForceLbf, impactForceFromOverpullLbf].every(value => Number.isFinite(value) && value > 0) ||
        Math.abs(impactForceLbf - impactForceFromOverpullLbf) > forceAgreementToleranceLbf) {
        return fail('Equation 4 formulations are non-finite or disagree beyond numerical tolerance.');
    }
    // Do not invent a clipping/contact rule for a fully expended impact wave.
    if (input.lowerCollarWeightLbf >= impactForceLbf) {
        return fail('Lower-collar weight must be less than FI for the paper\'s tensile transmitted-impact approximation.');
    }

    const lowerTravelTimeS = input.lowerCollarLengthFt / input.acousticVelocityFtS;
    const t1S = impactTimeS + lowerTravelTimeS;
    const t3S = t1S + reflectionPeriodS;
    const interfaceImpactReflectionTimeS = impactTimeS + reflectionPeriodS / 2;
    const surfaceReleaseReturnToJarTimeS = reflectionPeriodS + 2 * (input.freePipeLengthFt / input.acousticVelocityFtS);
    const surfaceReleaseReturnToStuckTimeS = surfaceReleaseReturnToJarTimeS + lowerTravelTimeS;
    const timeToleranceS = ROUND_OFF_FACTOR * Math.max(t3S, surfaceReleaseReturnToStuckTimeS);
    if (![lowerTravelTimeS, t1S, t3S, interfaceImpactReflectionTimeS, surfaceReleaseReturnToStuckTimeS].every(Number.isFinite) ||
        !(lowerTravelTimeS > 0 && t1S > impactTimeS && t3S > t1S) ||
        surfaceReleaseReturnToStuckTimeS <= t3S + timeToleranceS) {
        return fail('Primary interval is numerically unresolved or a surface-reflected release wave can return before it ends.');
    }

    // At impact there is one residual travelling front. Its next jar passage
    // remains the next scheduled Stage 1 hammer return; after engagement the
    // equal-area collar joint transmits it to the lower collars. This derives
    // t2=(N+1)*T+L1/va from the paper's wave path, not an assumed delay.
    const lastInterval = preImpact.reflectionHistory[preImpact.reflectionHistory.length - 1];
    let residualDelayS = lastInterval.nextReflectionTimeS - impactTimeS;
    const eventToleranceS = ROUND_OFF_FACTOR * Math.max(impactTimeS, reflectionPeriodS);
    if (residualDelayS < -eventToleranceS || residualDelayS > reflectionPeriodS + eventToleranceS) {
        return fail('Residual-wave arrival does not lie in the primary interval.');
    }
    if (Math.abs(residualDelayS) <= eventToleranceS) residualDelayS = 0;
    if (Math.abs(residualDelayS - reflectionPeriodS) <= eventToleranceS) residualDelayS = reflectionPeriodS;
    const t2S = t1S + residualDelayS;
    const residualIncidentForceLbf = lastInterval.lambdaPower * lambda * input.overpullLbf;
    const initialStuckPointForceLbf = 2 * (impactForceLbf - input.lowerCollarWeightLbf);
    const residualStuckPointIncrementLbf = 2 * residualIncidentForceLbf;
    const interfaceReliefIncrementLbf = -2 * lambda * impactForceLbf;
    if (![t2S, residualIncidentForceLbf, initialStuckPointForceLbf, residualStuckPointIncrementLbf, interfaceReliefIncrementLbf].every(Number.isFinite)) {
        return fail('Post-impact force or event time is outside numerical representability.');
    }

    // Force is right-continuous at arrivals. Events at T mark the end and
    // contribute no area to the primary integral [0,T). No post-T history.
    const forceTimeEvents = [
        { kind: 'initial-impact', relativeTimeS: 0, absoluteTimeS: t1S, deltaTensileForceLbf: initialStuckPointForceLbf },
        { kind: 'residual-wave', relativeTimeS: residualDelayS, absoluteTimeS: t2S, deltaTensileForceLbf: residualStuckPointIncrementLbf },
        { kind: 'interface-relief', relativeTimeS: reflectionPeriodS, absoluteTimeS: t3S, deltaTensileForceLbf: interfaceReliefIncrementLbf }
    ];
    const forceHistory = [];
    const addInterval = (startS, endS, residualForceLbf) => {
        if (!(endS > startS)) return;
        const tensileForceLbf = initialStuckPointForceLbf + residualForceLbf;
        forceHistory.push({
            relativeStartS: startS, relativeEndS: endS,
            absoluteStartS: t1S + startS, absoluteEndS: t1S + endS,
            impactContributionLbf: 2 * impactForceLbf,
            weightContributionLbf: -2 * input.lowerCollarWeightLbf,
            residualContributionLbf: residualForceLbf,
            tensileForceLbf, compressionPositiveForceLbf: -tensileForceLbf,
            impulseLbfS: tensileForceLbf * (endS - startS)
        });
    };
    addInterval(0, residualDelayS, 0);
    addInterval(residualDelayS, reflectionPeriodS, residualStuckPointIncrementLbf);
    const impulseLbfS = forceHistory.reduce((sum, interval) => sum + interval.impulseLbfS, 0);
    const averageStuckPointForceLbf = impulseLbfS / reflectionPeriodS;
    if (![impulseLbfS, averageStuckPointForceLbf].every(value => Number.isFinite(value) && value > 0)) {
        return fail('Primary impulse or average force is outside numerical representability.');
    }
    return {
        valid: true, error: null, notice: SKEEM_PREIMPACT_NOTICE, preImpact,
        impactForceLbf, impactForceKlbf: impactForceLbf / 1000,
        impactForceFromOverpullLbf, forceAgreementToleranceLbf,
        incidentImpactAfterWeightLbf: impactForceLbf - input.lowerCollarWeightLbf,
        initialStuckPointForceLbf, residualIncidentForceLbf, residualStuckPointIncrementLbf,
        interfaceImpactReflectionTimeS, interfaceReliefIncrementLbf,
        primaryPulseDurationS: reflectionPeriodS, t1S, t2S, t3S,
        surfaceReleaseReturnToJarTimeS, surfaceReleaseReturnToStuckTimeS,
        forceTimeEvents, forceHistory, impulseLbfS, averageStuckPointForceLbf,
        averageStuckPointForceKlbf: averageStuckPointForceLbf / 1000
    };
};
