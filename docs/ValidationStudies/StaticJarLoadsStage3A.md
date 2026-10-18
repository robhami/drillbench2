# Stage 3A — calculated static jar axial loads

Preliminary quasi-static soft-string screening, not operational guidance,
manufacturer operating limits or firing-force prediction. Implementation follows
the [reviewed proposal](Stage3AStaticJarLoadsProposal.md), with the approved
addition of absolute surface hookload independent of a reference state.

## Implementation and inputs

`calcStaticJarLoads` is a separate engineering calculation. Existing drilling
axial-load and Skeem equations are unchanged. Reused sources are
`deployDrillstring`, `calcComponentPositions`, `calcBuoyancyFactor`, calculated
minimum-curvature survey segments and `evaluateSurveyAtMd`. Neither saved BHA
nor survey data is modified.

The engine accepts bit MD, optional surface reference MD (default 0), selected
jar index, mud weight or explicit buoyancy factor, friction coefficient, direction
(`pickup`/`slackoff`) and one load-input mode:

- Absolute: an explicit nonnegative `surfaceHookloadLbf`. Reference values are
  unnecessary and do not enter this calculation. No reference jar load or
  incremental transferred load is inferred.
- Reference: explicit nonnegative `referenceHookloadLbf` and `appliedLoadLbf`.
  Pickup adds the applied overpull; slack-off subtracts the applied set-down.
  Negative resulting hookload is unsupported because it requires surface push.
  The reference jar load is an **assumed frictionless baseline**, not an actual
  measured parked load, even if the entered reference hookload was measured.

Hookload means net string support after removing non-string suspended equipment.
At an inclined surface reference the input must be the local axial tensile
support; a vertical hookload reading is not converted automatically.

The complete string is deployed at the selected bit MD. Exactly one uppermost
DP section is length-variable under the existing policy. A fixed string without
DP must actually extend from surface reference to bit. Survey coverage must
include the complete deployed string; extrapolation is rejected. Transfer is
integrated only over surface to selected jar centre, including the jar's upper
half. The lower assembly is assumed to provide the necessary reaction; no
second WOB/jar-force boundary is simultaneously imposed.

## Equations and numerical controls

With s increasing downhole, compression-positive C, tangent t, curvature k=dt/ds,
downward vertical vector z, buoyed weight per foot w, and d=+1 pickup/-1 slack-off:

```
n = |w*(z - (z dot t)*t) - C*k|
dC/ds = w*cos(I) + d*mu*n
C_surface = -H
C_jar = -H + G + d*D
```

G is integrated buoyed axial gravity above jar; D is nonnegative integrated
axial friction resistance. Weight and curvature vectors combine before taking
their magnitude. Normal contact is recalculated with each operation's own force
profile; pickup and slack-off can have different D in a curved well.

Use fully mobilised, nonrotating axial friction, opposing the specified movement.
No drilling RPM/ROP friction fraction is used. Actual stationary/pre-slip friction
is history dependent and is not identified by these directional branches.

Gravity uses exact component weight times survey TVD differences. Normal force
uses implicit midpoint contact balance, with maximum 40 iterations per element.
Iteration tolerance is `1e-9 + 1e-12*max(abs(C_shallow),abs(C_deep))` lbf.
Split at every component and survey boundary and at the jar centre. Default
maximum step is 5 ft, with additional curvature cap 0.05 rad per step. For mu<=1
the implicit contact iteration has contraction bound <=0.025 under that cap.
Each integration pass is limited to 100,000 elements.

Curved cases with nonzero friction are rerun with half steps. Compare jar force
and forces at shared profile nodes (including component/survey boundaries),
requiring maximum difference <=0.1 lbf by default. Up to six halvings are allowed
by default (configurable 1–10). Return the finer profile. Failure of iteration,
step refinement, numerical limits or coverage returns unavailable with no jar
load. Step comparison is a numerical consistency check, not a formal error bound
or physical validation of compressed configurations. Global force-balance
residuals are independently accumulated and checked.

## Reported loads and panel

The small Jar Forces panel opens with **Forces** in Workspace. It calculates
only on request, provides direction and absolute/reference controls, and has no
charts. Editing inputs or changing BHA/survey clears results. BHA/survey storage
is read only. Display klbf; the engine works in lbf and ft.

- Signed calculated jar-centre axial load and tension/compression state.
- Actual surface hookload used as the boundary condition.
- Friction resistance, its physical direction, and buoyed axial gravity.
- Net tensile magnitude `max(0,-C_jar)` and compressive magnitude `max(0,C_jar)`.
- Reference mode only: `C_jar_0=-H0+G`, with signed upward change
  `C_jar_0-C_jar_up=P-D_up`, or downward change `C_jar_down-C_jar_0=S-D_down`.
  Negative increments remain negative rather than being clipped to success.
- Actual deployed DP, physical jar MD, assumptions and convergence/balance audit.

An operation label does not guarantee the jar load sign. A fully mobilised
pickup branch can remain compressive under insufficient surface support, and
a slack-off branch can remain tensile. With zero applied reference change,
the directional branch can differ from the frictionless reference because the
assumed friction state has changed. Neither result predicts actual motion.

## Independent analytical validation

Tolerances were specified in the reviewed proposal before implementation:
straight load error <=1e-6 lbf; curved reference error <=0.1 lbf, with step-size
convergence checked. The 1000-ft test string has **buoyed** weight 100 lbf/ft.

| Case | Surface H klbf | Expected C_jar lbf | Calculated C_jar lbf | Absolute error lbf |
| --- | ---: | ---: | ---: | ---: |
| Vertical pickup, H0=100/P=20 klbf | 120 | -20000 | -20000.000000000033 | 3.3e-11 |
| Vertical slack-off, H0=100/S=20 klbf | 80 | 20000 | 20000.000000000004 | 3.7e-12 |
| Straight 60-degree pickup, H0=50/P=30 | 80 | -8349.364905389037 | -8349.364905389131 | 9.5e-11 |
| Straight 60-degree slack-off, H0=50/S=30 | 20 | 8349.364905389037 | 8349.364905389030 | 7.3e-12 |
| Weighted 30–60-degree arc pickup | 10 | 82281.37436727455 | 82281.37459369568 | 0.000227 |
| Weighted 30–60-degree arc slack-off | 10 | 39899.53989406582 | 39899.54206428816 | 0.002171 |

Straight 60-degree G=50000 lbf, D=21650.635094611 lbf. At the same H, reversing
direction gives `C_down-C_up=-2D=-43301.270189222` lbf. At mu=0 the branches
coincide. Separate tests apply actual 10-ppg buoyancy and nonuniform weights,
including the selected jar's upper half.

For the weighted arc, kappa=pi/6000, I(s)=pi/6+kappa*s, w=100 lbf/ft,
mu=0.25, C(0)=-10000 lbf. In this test `w*sin(I)+C*kappa` stays positive.
An independent closed form is:

```
P(I) = w/[kappa*(1+mu^2)] * [-2*d*mu*cos(I)+(1-mu^2)*sin(I)]
C(s) = P(I(s)) + [C(0)-P(I(0))]*exp(d*mu*kappa*s)
```

At the final 2.5-ft bound, maximum shared-profile step differences are
0.000825 lbf pickup and 0.006511 lbf slack-off. The 20/10-ft runs demonstrate
approximately fourfold error reduction on halving the step. Independent
zero-weight tensile arc tests also match the capstan limits
`T_jar=H*exp(-mu*kappa*L)` pickup and `H*exp(+mu*kappa*L)` slack-off.

## Test 4 directional audit and deployment

Use the supplied Test 4 BHA and SyntheticDirectionalWell.csv, mud 10 ppg,
mu=0.25. For illustration **absolute H=200 klbf** in each direction; these are
two independent imposed-boundary cases, not a recommended loading sequence.

| Bit MD ft | Deployed DP ft | G klbf | Pickup C_jar klbf | Pickup D klbf | Slack-off C_jar klbf | Slack-off D klbf |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4000 | 3485 | 100.531038 | -91.108780 | 8.360182 | -108.741823 | 9.272861 |
| 5000 | 4485 | 115.306707 | -66.144470 | 18.548822 | -106.304302 | 21.611010 |
| 7000 | 6485 | 136.734605 | -31.924233 | 31.341163 | -101.486737 | 38.221342 |
| 12000 | 11485 | 195.539185 | +52.343478 | 56.804293 | -68.145287 | 63.684472 |

All final step bounds are 2.5 ft; maximum shared-profile refinement difference
is 0.003356 lbf. Maximum absolute global balance residual in these cases is
1.5e-8 lbf. TD pickup is **compression**, and TD slack-off remains **tension**;
these signs follow the imposed boundary, gravity and direction-specific drag.
They do not establish a physically maintainable compressed shape or firing.

Independent vertical deployment checks use
`G=BF*(15*150 + 180*116 + deployedDP*27.76)` for the weight above jar centre.
They verify absolute-force changes with actual DP length and invariant vertical
reference transfers when H0 increases with added buoyed DP weight. Tests check
exact force continuity at shared element/component boundaries, multiple jar
selection, invalid inputs, missing coverage, convergence failures, explicit
negative-increment behaviour and unchanged BHA/survey inputs.

## Limitations and Stage 3B boundary

The lower reaction is assumed; its capacity and resulting movement are not
computed. Static friction history, elasticity/compatibility before sliding,
pressure-end loads, buckling, lockup and contact stiffness are outside this
model. Compression is propagated on the imposed survey centreline only.
There is no firing threshold, manufacturer mandrel-force conversion, impact,
impulse, wave, energy, stroke or delay prediction. Skeem remains independent.
No Stage 3B work is included.

## Verification outcome

The targeted static engineering, Jar Forces UI and workspace checks pass
(57 tests). The complete suite passes: 518 tests across 33 suites. Production
build succeeds with existing unrelated lint warnings. `git diff --check` passes;
new files were separately checked because they remain untracked. Existing
drilling axial-load, Skeem and survey source files have no Stage 3A changes.
