# Vertical axial-load model: implemented baseline (2026-10-04)

**Status:** preliminary engineering screening, not a field-operational jar-placement method. This document describes the implementation inspected in the uploaded project, not a validated industry-standard model.

## Units and sign convention

- BHA rows are ordered **from bit upward**. Length and distance above bit: ft; row `weight`: air weight in lb/ft; mud weight: ppg; `bha.wob`: klbf.
- **Positive (+) = compression; negative (−) = tension.** Neutral point is the zero crossing.
- The implementation assumes a vertical static string, uniform mud density and uniform buoyed weight along each component.

## Implemented equations

With mud weight `MW` (ppg), assumed steel density `65.5 ppg`, air weight per foot `w` and component length `L`:

- `BF = 1 − MW / 65.5`
- `W_air = w × L` (lb)
- `W_buoyed = W_air × BF` (lbf)
- `F_bit = 1000 × WOB_klbf` (lbf; positive compression)
- `F_top,i = F_bottom,i − W_buoyed,i`; `F_bottom,i+1 = F_top,i`
- Within a uniform component, `F(z) = F_bottom − (z − z_bottom) × w × BF`.
- A neutral point exists inside a component when cumulative buoyed weight reaches WOB: `z_NP = z_bottom + (WOB_lbf − cumulative_buoyed_below) / (w × BF)`.

At a boundary where force is exactly zero, the point is at that boundary. If total buoyed weight is insufficient to balance WOB, the implementation reports no neutral point in the entered BHA. The code does not currently model zero-WOB neutral-point-at-bit as a found point.

## Jar screening

A jar is identified by category `JAR`. Its interval is `[startFromBit, endFromBit]`, and centre is the interval midpoint. A warning is raised if the calculated neutral point lies **inside or at either end** of the jar interval. The reported centre offset is `jar_centre − neutral_point`; a negative offset means the centre is below the neutral point. Jar interval entirely below neutral point is in calculated compression for this simplified model. This is **not** proof that the jar is suitable for operation.

## Exclusions and validation limits

Not evaluated: inclination, friction/drag, buckling, pressure-area effects, temperature, dynamic loads, jar firing force, accelerator compatibility, manufacturer operating envelope, or real survey interpolation. Hand-calculation regression tests verify implementation consistency; independent published benchmarks and engineering review remain outstanding.

Relevant source: `src/engineering/forces/calcBuoyancy.js`, `calcAxialLoads.js`, `calcNeutralPoint.js`, `src/engineering/jar/jarAnalysis.js`. Automated tests: `src/engineering/forces/verticalModel.test.js`.
