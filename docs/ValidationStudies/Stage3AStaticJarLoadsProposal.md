# Stage 3A proposal — quasi-static jar force transfer

**Reviewed proposal; implemented with approved absolute/reference input modes.**
See [implementation and validation](StaticJarLoadsStage3A.md). Preliminary engineering screening,
not operational guidance or a manufacturer firing-load prediction. The scope
excludes impact, impulse, stress waves, jar stroke, time delay and jar-force
development beyond quasi-static axial equilibrium.

## Inspection and reuse

- `calcSurveyAxialLoads` is a bottom-up, bit-WOB-boundary solver for downward
  drilling. It supports Slide/Rotate, not pickup or static-friction equilibrium.
  Its signed axial force is compression positive. Do not pass negative friction,
  reverse its drilling result, or reuse drilling ROP/RPM to represent jarring.
- Reuse `deployDrillstring`, `calcComponentPositions`, `calcBuoyancyFactor` and
  the minimum-curvature geometry/MD evaluator. Preserve their existing equations.
  Use calculated survey segments as the source of tangent and curvature, with
  the same exact TVD gravity differences and geometry subdivision principles.
- `JarPlacement` currently renders `JarPerformance`; the separate placement
  analysis uses straight-drilling loads. Neither supplies surface-to-jar pickup.
- `skeemPerformance` supplies an explicitly entered positive tensile overpull
  magnitude **at the jar** to `skeemDynamics`. Skeem is upward-only and its
  wave calculations are outside this proposal. No automatic connection,
  reinterpretation of F0, or change to Skeem is proposed.
- A separate static-transfer integrator is necessary because movement direction
  and the surface boundary differ from the drilling solver. Keep force physics
  in engineering code and leave existing survey-load calculations untouched.

## Physical domain and assumptions for approval

Deploy the complete entered string at the selected bit MD and explicit surface
reference MD. Integrate over every deployed component from the surface reference
to the selected jar **centre**, consistent with existing jar-load reporting.
This includes the upper half of the jar. Report the physical section used;
this axial cross-section load is not the manufacturer's internal firing load.

Assume the assembly below that section supplies the required reaction. During
the load-transfer calculation do not simultaneously impose bit WOB or a second
jar force. A specified reaction location below the jar can document this
assumption, but no lower-assembly movement, stuck-point strength or support
capacity is predicted. Loads from below the jar are not added a second time.

The two operating branches assume quasi-static purely axial relative movement,
or a fully mobilized directional sliding limit, in the upper string. Friction
is fully axial: no simultaneous rotation, no drilling ROP/RPM friction fraction,
and no claim that every contact reaches this branch before a jar fires. The
same explicit mu can be used for both directions initially; actual static and
sliding coefficients need not be equal and will not be inferred from one another.

At rest the friction law is a bound, `|f_axial| <= mu_static*n`, not a fixed
signed force. Without friction history, a specified static-friction model or
independent reference-load information, parked jar load is not uniquely known.
Therefore the proposed baseline below is an **assumption for review**, not an
estimate of the unique actual parked state.

## Coordinates and signs

- s: MD increasing downhole, ft; t: downhole unit tangent.
- k = dt/ds: curvature vector, 1/ft; z: downward vertical unit vector.
- I: inclination from vertical, so z dot t = cos(I).
- C: axial force, lbf; positive compression, negative tension.
- T = -C: tension-positive alternative used only to check derivations.
- H: net upward axial tensile support at the surface reference, lbf; `C(s0)=-H`.
  H corresponds to hookload when the surface string is vertical and non-string
  suspended equipment has been removed. An inclined reference requires an
  explicitly supplied local axial force, not an unexamined vertical hook reading.
- w: buoyed weight per foot. Retain steel BF = 1 - mudPpg/65.5 and the current
  equal-internal/external-fluid assumption; hydraulic pressure-end forces are
  excluded. C uses the existing buoyancy-based axial-load convention and is not
  a pressure-corrected manufacturer mandrel load.

## Proposed equilibrium equations

Use the existing vector normal-contact relationship in compression-positive form:

```
r = w * (z - (z dot t)*t) - C*k
n = |r|                              [lbf/ft]
```

The gravity and curvature vectors combine before taking their magnitude. Do not
add their scalar magnitudes, and recompute n using each operation's own C.

Let d=+1 for pickup and d=-1 for slack-off. Along increasing downhole MD:

```
dC/ds = w*cos(I) + d*mu*n
```

Pickup motion is uphole; friction acts downhole. Slack-off motion is downhole;
friction acts uphole. In tension-positive notation the checks are
`dT/ds = -w*cos(I) - mu*n` for pickup and
`dT/ds = -w*cos(I) + mu*n` for slack-off.

For an element from a shallower to a deeper station:

```
G_element = w * (TVD_deep - TVD_shallow)
D_element = mu * n(C_mean, geometry_midpoint) * deltaMD
C_deep = C_shallow + G_element + d*D_element
C_mean = (C_shallow + C_deep)/2
```

Use bounded implicit midpoint iteration, split at component/survey boundaries
and the jar centre, control curvature step, and test step refinement. Failed
convergence or uncovered geometry produces unavailable output, not zero force.

For the entire surface-to-jar segment, define
`G = integral(w*cos(I) ds)` and operation-specific nonnegative
`D_up/down = integral(mu*n_up/down ds)`. Then:

```
C_jar_up   = -H_up   + G + D_up
C_jar_down = -H_down + G - D_down
```

These are also independent global equilibrium audit checks against the
integrated profile. In curved geometry D_up and D_down generally differ because
normal force depends on axial load. Friction reversal alone does not establish
equal friction magnitudes in two different load profiles.

## Proposed reference state and applied-load definitions

Recommended initial scope: require an explicit reference surface support H0,
with an acknowledged **frictionless pre-operation reference**:

```
C_jar_0 = -H0 + G
H_up = H0 + P                  P >= 0: applied surface overpull
H_down = H0 - S                S >= 0: applied surface slack-off/set-down
```

There is no default H0 invented from saved WOB or Skeem's jar overpull. A
measured H0 does not remove the frictionless-reference assumption at the jar.
Display this assumption with the baseline result. Existing selected drilling
loads can be compared separately in future, but are not a stationary baseline.

Ordinary hookload must satisfy H0,H_up,H_down >= 0. If S>H0 the requested
boundary requires a downward surface push; return unsupported for this stage
rather than label a negative hookload as available set-down. A future applied
push capability would require an explicit distinct boundary condition.

Keep the operation loads absolute and their changes separate:

| Output | Definition |
| --- | --- |
| Reference jar axial load | C_jar_0, explicitly frictionless assumed reference |
| Applied surface boundary | H_up and H_down, plus H0, P and S |
| Pickup jar axial load | C_jar_up, signed compression positive |
| Slack-off jar axial load | C_jar_down, signed compression positive |
| Net upward tensile load at jar | max(0, -C_jar_up) |
| Net downward compressive load at jar | max(0, C_jar_down) |
| Signed incremental upward transfer | C_jar_0 - C_jar_up = P - D_up |
| Signed incremental downward transfer | C_jar_down - C_jar_0 = S - D_down |
| Axial friction resistance | D_up and D_down, with physical direction |

Show signed increments even if negative; do not silently clip a negative
transfer to a successful operation. Positive magnitude outputs describe the
net tension/compression obtained under the imposed boundary, not capacity,
firing force or a guarantee of movement. Neither a tensile change nor a
compressive change alone proves net tension or compression at the jar.

With P=S=0 the mobilized directional branches generally differ from the
frictionless baseline. This is a friction-state change, not a claim that an
unmoved system develops a new force with no operation. Actual pre-slip loading
requires history and elastic compatibility not present in this stage.

## Independent analytical validation proposed before implementation

The examples below specify **buoyed** w=100 lbf/ft (for example explicit BF=1
in a numerical test), L=1000 ft above the selected section and mu=0.25.

1. Vertical: G=100,000 lbf, n=D=0. Set H0=100,000, P=S=20,000 lbf.
   Expected C0=0, H_up=120,000, H_down=80,000,
   C_jar_up=-20,000 and C_jar_down=+20,000 lbf. Identical results for any mu
   in a straight vertical string; test actual 10-ppg buoyancy independently too.
2. Straight 60 degrees: G=50,000 lbf; n=w*sin(60); D=21,650.635094611 lbf.
   Set H0=50,000, P=S=30,000 lbf, so H_up=80,000 and H_down=20,000.
   Expected C0=0, C_jar_up=-8,349.364905389 and
   C_jar_down=+8,349.364905389 lbf; signed transfer is
   +8,349.364905389 lbf in both operations.
3. Direction reversal at the **same H** in that straight inclined section:
   C_down - C_up = -2*D = -43,301.270189222 lbf. At mu=0 the branches
   coincide. Test friction direction explicitly; do not require equal D for
   curved cases or identical force signs after different boundary changes.
4. Deployment: Test 4 fixed string=515 ft, jar centre=320 ft. DP must be
   3485,4485,6485,11485 ft at bit MD 4000,5000,7000,12000 ft. For a separate
   vertical survey, fixed absolute H gives delta C_jar = BF*w_DP*delta DP.
   If H0 is instead increased by the added buoyed DP weight, fixed P/S must
   leave the vertical jar reference/operation loads unchanged. Both checks
   detect using stored TD pipe length at shallow depth.
5. Additional curved check: a zero-weight circular arc remaining in tension
   gives T_jar_up=H_up*exp(-mu*kappa*L) and
   T_jar_down=H_down*exp(+mu*kappa*L). Use it to validate curvature/contact
   sign and numerical convergence, not as a physical massless-string case.

Establish tolerances before tests: straight cases <=1e-6 lbf absolute error;
initial curved reference <=0.1 lbf at 5-ft steps with a demonstrated reduction
on halving the step. Retain global force-balance residuals. Also cover zero
friction, zero overpull/set-down, tension-to-compression transitions, unknown
survey coverage, invalid inputs, solver limits and non-mutation of saved data.
The existing full test suite, production build and diff check will run after
implementation is authorized, not as evidence that this proposal is validated.

## Minimal UI and exclusions

Propose a dedicated small Jar Forces panel: selected bit MD/jar, explicit
reference hookload, surface overpull/set-down, friction and mud inputs; a
compact signed-load comparison and gravity/friction balance audit. Show
deployment length and baseline assumption. Keep WOB-range graphs and Skeem
independent. Do not write saved BHA or survey data.

No impact, impulse, waves, energy, stroke, time delay, firing thresholds,
buckling/contact stiffness, lockup or safety prediction. Compressive results
are imposed-centreline soft-string estimates and do not establish that the
compressed configuration can physically be maintained. Unknown support,
friction mobilization and pressure effects must remain explicit limitations.

## Public source and derivation provenance

The sliding-friction foundation and distinction between up/down motion and
static/dynamic friction are described in Mansouri, *Stress-Based Torque and
Drag Model* (Texas A&M, 2017), printed pp. 3–9, particularly pp. 5–7:
[university-hosted thesis](https://oaktrust.library.tamu.edu/server/api/core/bitstreams/3fab200c-435c-448a-a9de-51c902a02be3/content).
This proposal retains the current WellBench vector normal-force expression;
the top-down compression-positive equations, reference definitions and
analytical examples above are explicit equilibrium derivations for review.
They are not claims that the thesis validates jar firing or this implementation.

## Review gate

Review the reference-state assumption, fully mobilized nonrotating directional
friction, jar-centre reporting section and surface boundary definitions before
authorizing implementation. This review gate was satisfied by the user's Stage
3A implementation approval; the original proposal remains recorded above.
