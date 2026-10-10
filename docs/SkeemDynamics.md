# Skeem jar dynamics — Stage 1

**PRELIMINARY — NOT FOR OPERATIONAL USE.** This standalone calculation has no
UI integration and does not predict impact force, impulse, fish movement or
an optimum placement. It implements pre-impact Equations 1–3 only.

## Source read and equation provenance

Skeem, M. R., Friedman, M. B., and Walker, B. H., *Drillstring Dynamics During
Jar Operation*, SPE 7521, Journal of Petroleum Technology, November **1979**,
pp. 1381–1386. Local source:
[original PDF](<references/SPE-7521-PA_Drilling Dynamics during jar operation_Skeem (1987).pdf>).
The filename says 1987; the actual article is dated November 1979. PDF pages
2–4 were extracted and visually read before implementation; the equations
were verified against the page images, not reconstructed from OCR or memory.

- PDF page 2 / printed p. 1382: modelling assumptions, Figure 1 and Equation 1.
- PDF page 3 / printed p. 1383: reflection method and Equations 2–3.
- PDF page 4 / printed p. 1384: post-impact context and example inputs.

Figure 1 defines L1 as lower collars from the stuck point to the jar, L2 as
upper collars from the jar to the collar/pipe interface, and L3 as drillpipe.
The lower anvil is treated as stationary before impact. Thus **L2, not total
collar length or jar distance above the bit**, drives this pre-impact solver.

### Published equations

Using collar area Ac, pipe area Ap, overpull magnitude F0, acoustic velocity va
and Young's modulus E:

```text
Ac = pi/4 * (collar_OD² - collar_ID²)
Ap = pi/4 * (pipe_OD² - pipe_ID²)
alpha = Ac / Ap
lambda = (alpha - 1) / (alpha + 1)

(1) vc = F0 * va / (Ac * E)

(2) v_N = vc * (1 + 2 * sum(lambda^n, n=1..N))

tau = 2 * L2 / va
(3) tau * sum(v_n, n=0..N-1) < s <= tau * sum(v_n, n=0..N)
```

The initial interval has N=0 and velocity vc. An interface reflection occurs
at L2/va; it does not change the hammer velocity until returning at 2*L2/va.
At that return, the free hammer-end reflection doubles the velocity increment
to 2*vc*lambda. Each subsequent hammer return adds 2*vc*lambda^N. There is no
continuous acceleration approximation or lumped mass.

Within the identified interval, let x_N be the sum of completed interval
displacements. Analytic integration gives:

```text
t_impact = N*tau + (s - x_N)/v_N
```

Equation 3 is inclusive at its upper bound. Impact exactly at a return uses
the **pre-return velocity**, and that coincident return is not counted as a
completed reflection before impact. Output `completedReflections` counts
returns reflected at the hammer, as in the paper's N, not every reflection at
both boundaries. `reflectionHistory` records the hammer-velocity intervals,
including initial N=0 and the final full/partial interval, rather than every
wave's spatial trajectory.

## API and units

`calcSkeemPreImpact(input, options)` in
`src/engineering/jar/skeemDynamics.js` returns `{ valid: true, ... }` or
`{ valid: false, error, notice, reflectionHistory }`. Failure never returns a
fabricated impact time or velocity. No existing static calculation is changed.

| Required input | Units / meaning |
|---|---|
| `overpullLbf` | Positive tensile overpull magnitude **at the jar**, lbf |
| `strokeIn` | Jar stroke, in |
| `upperCollarLengthFt` | L2, ft |
| `collarOdIn`, `collarIdIn` | Upper collar OD/ID, in |
| `pipeOdIn`, `pipeIdIn` | Uniform equivalent pipe OD/ID, in |
| `youngsModulusPsi` | Common E, psi |
| `acousticVelocityFtS` | Common va, ft/s |

Optional `input.direction` may only be `'up'`. Overpull is not surface
hookload, entered drilling WOB, or WellBench's signed axial force. Existing
positive-compression/negative-tension conventions are unchanged.

| Output | Units / meaning |
|---|---|
| `AcIn2`, `ApIn2` | Metal areas, in² |
| `alpha`, `lambda` | Dimensionless area ratio and reflection coefficient |
| `vcFtS` | Initial release velocity, ft/s |
| `reflectionPeriodS` | Hammer return period, s |
| `completedReflections` | N at impact |
| `impactTimeS` | Time from release to first impact, s |
| `hammerVelocityFtS` | Upward hammer velocity immediately before impact, ft/s |
| `limitingVelocityFtS` | alpha*vc, ft/s; reference bound, not an approximation |
| `impactDisplacementFt` | Integrated hammer displacement, ft |
| `strokeResidualFt`, `displacementToleranceFt` | Numerical audit, ft |
| `reflectionHistory` | Each interval's times, velocity, increment, lambda power and displacement endpoints |

Stroke is divided by 12 exactly once to get feet. F0/(Ac*E) is dimensionless,
so Equation 1 accepts va in ft/s directly. L2 and va are already in consistent
feet/seconds. No g conversion is used in the wave equations.

## Supported domain, assumptions and numerical safeguards

- Ideal one-dimensional, uniform, linearly elastic collars and uniform pipe
  with **common E and va**; collar area must exceed pipe area. Equal/reversed
  impedance is rejected because it is outside the accelerating configuration
  specified on p. 1383. Downward jarring is not implemented.
- Ideal instantaneous jar release/catch; stationary lower anvil. Jar mass,
  finite jar compliance, tool joints, upsets, accelerators and stabilizers do
  not form separate dynamic sections. Zero ID is allowed as a solid circular
  section of the idealized elastic model; real tool qualification is external.
- No friction, damping, borehole curvature, gravity acceleration during the
  flight, dispersion, or post-impact Equations 4 onward. F0 is supplied after
  establishing static load at the jar; it is not inferred here.
- Members must be sufficiently slender for the paper's longitudinal-wave
  approximation, and stress must stay in the elastic regime. Yield strength,
  jar length and physical release characteristics are not inputs, so this
  module cannot establish those conditions from positive E/F0 alone.
- Pipe is assumed sufficiently long that no surface reflection returns before
  impact. L3 is not a required input, so this condition is **not checked**. For
  a finite pipe, the earliest release-wave round trip would take
  `2*(L2+L3)/va`; it must exceed impact time. Page 4's 750/1300 ft conditions
  concern the broader model's force/impulse interval, not a fixed substitute
  for this pre-impact check. Near-top placement with L2 comparable to actual
  jar length remains outside the paper's physical validity assumptions.
- Inputs must be finite numeric values, with F0, s, L2, ODs, E and va > 0 and
  0 <= ID < OD. Non-finite/zero derived areas, velocities or return times and
  numerically unresolved intervals return errors.
- Default maximum: 10,000 completed hammer reflections. Optional
  `options.maxReflections` is an integer from 0 to 100,000. Exceeding it
  returns failure and audit history, not an asymptotic-speed estimate.
- Equality uses only a floating-point displacement allowance of
  `64*Number.EPSILON*max(strokeFt, intervalEndDisplacementFt)`. This resolves
  arithmetic roundoff at an event, not a chosen physical time step. The
  residual is returned for inspection. Inputs on either side outside that
  allowance retain the published discontinuous velocity change.

## Published example: pipe area and equivalent ID

Page 4 specifies 6.25 in OD × 2.75 in ID collars, 4.5 in nominal pipe OD,
16.6 lbm/ft pipe, **alpha=5**, F0=165,000 lbf, s=4 in and total collar lengths
240/420/600 ft. It does not supply the pipe ID or the example's E and va.

Primary reproduction uses the paper's explicit area ratio:

```text
Ac = 24.74004214701962 in²
Ap = Ac/5 = 4.948008429403924 in²
equivalent pipe ID = sqrt(4.5² - 4*Ap/pi) = 3.734969879396620 in
lambda = 2/3
```

This is an **equivalent uniform section**, not an assertion about a catalog
pipe's actual body ID. The published nominal weight alone does not uniquely
identify body area: steel density and inclusion of upsets/joints are unstated,
and the idealized paper ignores tool joints. Do not infer an exact physical
pipe specification or tune an ID to plotted output.

As a separately labelled sensitivity check, assigning the full nominal
16.6 lb/ft to a uniform section at an **assumed** steel weight density of
0.283 lb/in³ gives `Ap=16.6/(12*0.283)=4.888103651354535 in²`, equivalent
ID=3.745166636123293 in, and alpha=5.061276092245701. This differs from the
paper's stated alpha=5 and is tested as a distinct assumption.

For numerical checks below, **assume E=30,000,000 psi and va=16,000 ft/s**.
These are explicit calculation inputs, not material values extracted from
the paper. Equation 1 gives vc=3.556986664656962 ft/s. No equations are tuned
to figures or to proprietary benchmarks.

## Independent numerical validation

Expected values were computed separately with Python Decimal at 50-digit
precision, using the closed-form geometric sum rather than the production
event recurrence:

```text
v_N = vc * (alpha - (alpha-1)*lambda^N)
x_N = tau*vc * [alpha*N - (alpha-1)*(1-lambda^N)/(1-lambda)]
find N such that x_N < s <= x_(N+1)
t_impact = N*tau + (s-x_N)/v_N
```

| Total collars ft | L1 / jar position above stuck point ft | L2 ft | N | Expected and calculated impact time s | Expected and calculated velocity ft/s |
|---:|---:|---:|---:|---:|---:|
| 240 | 60 | 180 | 2 | 0.050807259577 | 11.461401475006 |
| 240 | 120 | 120 | 2 | 0.043565880267 | 11.461401475006 |
| 240 | 180 | 60 | 4 | 0.033785028591 | 14.974474724050 |
| 420 | 105 | 315 | 1 | 0.062662406083 | 8.299635550866 |
| 420 | 210 | 210 | 2 | 0.054427949232 | 11.461401475006 |
| 420 | 315 | 105 | 3 | 0.041385743526 | 13.569245424432 |
| 600 | 150 | 450 | 1 | 0.072305263226 | 8.299635550866 |
| 600 | 300 | 300 | 1 | 0.061590977511 | 8.299635550866 |
| 600 | 450 | 150 | 2 | 0.047186569922 | 11.461401475006 |

Tests compare unrounded expected values to the solver at 11 decimal places.
Displacement is 1/3 ft (4 in) at impact. Moving the jar upward reduces L2 and
generally raises impact speed in discrete plateaus; time changes continuously
within a plateau. Total collar length/L1 does not independently enter these
pre-impact equations under the stationary-anvil assumption.

An independent manufactured case has alpha=4, lambda=0.6, vc=1 ft/s and
tau=0.01 s. Hand checks cover impact at 0.005 s before any hammer return,
0.015 s after one return (2.2 ft/s), and 0.025 s after two returns (2.92 ft/s),
plus exact event times, immediately adjacent strokes and 80 returns.

The example checks establish arithmetic consistency with the published
equations **under the declared material/area assumptions**. The paper does
not tabulate pre-impact times/velocities for these nine placements, so these
are independently derived references, not exact measured/published output
matches. Figure 2's normalized alpha=5 steps are also recovered by Equation 2.
Post-impact graphs, impact force, impulse and optimum placement are deliberately
not reproduced or interpreted as validated predictions in Stage 1.

Run `npm test -- --watch=false --runInBand` for all regression tests, or append
`src/engineering/jar/skeemDynamics.test.js` for the focused suite.
