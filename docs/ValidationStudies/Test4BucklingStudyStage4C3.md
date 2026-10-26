# Stage 4C.3: Test 4 buckling screening study

Preliminary analytical study, not operational guidance. **The documented Test 4
assembly does not establish the buckling API's required tubular-idealization
confirmation. Its strict result is Not Evaluated for every target.** A separate
conditional DP-only comparison below reports the existing named criterion's
numerical output, not validated buckling of the actual complete compressed string.

## Reproduction and assumptions

From repository root run:

```text
node docs/ValidationStudies/Test4BucklingStudyStage4C3.cjs
```

The runner writes `Test4BucklingStudyStage4C3.json`. It imports the unchanged
inverse solver, Stage 4C buckling and Stage 4C.1 compression modules. Its Node
Babel loader only adapts module syntax. It reads no saved workspace, changes no
BHA record and writes no engineering/UI code. Branch: feature/workspace-v2;
HEAD: 0a9ec13dffb6498e0a31632c9469c4209ef92e58, plus existing working-tree modules.

- Original 41-station SyntheticDirectionalWell.csv, minimum-curvature geometry:
  vertical 0-3000 ft MD, build 3000-5000 ft, straight 60-degree tangent thereafter.
- Bit MD 12000 ft, surface reference 0 ft, jar centre 11680 ft.
- Mud 10 ppg; buoyancy factor 1-10/65.5; friction coefficient 0.25.
- RPM 150 is recorded, but the existing Jar Down model is **nonrotating,
  fully mobilised slack-off**. It does not use RPM or compute torque. This study
  does not apply a rotating stability criterion or infer downhole zero torque
  from the recorded RPM.
- E = 30000000 psi is an explicit illustrative assumption, not a verified
  component material property or a value copied from Skeem.
- Uniform nominal hole = 16 in, supplied through **bha.holeSize = 16**, the
  existing Bit Size field. No explicit wellbore override is used, so study Bit
  Size and buckling diameter are identical. No claim is made about the user's
  current saved Bit Size or actual bore/caliper dimensions.

| Bottom-up component | Length ft | Air weight lbf/ft | OD / ID in | Radial clearance in |
|---|---:|---:|---:|---:|
| Stabiliser | 5 | 111.25 | 6.75 / 2 | 4.625 |
| Lower DC | 300 | 116 | 6.75 / 1.5 | 4.625 |
| Jar | 30 | 150 | 9.5 / 3 | 3.25 |
| Upper DC | 180 | 116 | 6.75 / 1.5 | 4.625 |
| Auto DP | 11485 deployed | 27.76 | 5.5 / 4.67 | 5.25 |

Only **0-11680 ft MD** is loaded/evaluated. DP ends at 11485 ft; upper DC spans
11485-11665 ft; the upper jar half spans 11665-11680 ft. No lower-jar, lower-DC
or stabiliser load is extrapolated. The existing lower-assembly reaction is
assumed, not independently established.

## Static loads and continuous compression

Positive force is compression; positive surface hookload is tensile support.
Each scenario has one continuous compressed section ending at the jar centre.
All maxima below occur there. Values are rounded for reporting; JSON preserves
full precision.

| Jar target klbf | Surface hookload klbf | Forward jar load klbf | Compression MD interval ft | Compressed length ft | Forward residual lbf |
|---:|---:|---:|---|---:|---:|
| 10 | 139.854231 | 9.999998 | 10818.578754-11680 | 861.421246 | -0.002240 |
| 25 | 127.401543 | 24.999999 | 8569.126334-11680 | 3110.873666 | -0.001156 |
| 50 | 102.949371 | 49.999991 | 4841.018308-11680 | 6838.981692 | -0.009131 |
| 75 | 73.691254 | 74.999997 | 3134.171871-11680 | 8545.828129 | -0.003193 |
| 100 | 41.237030 | 99.999997 | 1753.138528-11680 | 9926.861472 | -0.002526 |

Inverse targets are all numerically achieved; none required forced convergence
or a substituted hookload. Each fresh forward calculation agrees within the
existing 0.01-lbf inverse residual tolerance. The compression and buckling API
forward loads agree exactly. These are solver checks, not physical accuracy or
proof that the requested loading can be maintained.

## Strict applicability and conditional comparison

The existing API requires `bucklingIdealizationConfirmed: true` on a component
before applying its long, uniform, initially straight, zero-torque,
frictionless-onset idealization. E and hole diameter alone do not satisfy this
contract. In the **strict pass**, no such flags are supplied: zero compressed
length is evaluated, all compressed length is unevaluated, onsets/utilizations
and controlling location are null. No dimensional inputs are missing; the
remaining incompatibility is the unconfirmed model idealization plus unsupported
vertical/curved geometry.

The **conditional pass** explicitly enables that flag only on DP in an in-memory
copy. This asks what the implemented local asymptotic formula would predict if
the uniform long-DP idealization were accepted. It does not certify that
idealization for this nonuniform, friction-loaded, finite compressed section.
No collar or jar is confirmed: OD/ID are insufficient to establish a jar's
equivalent bending model, and no finite-length/end-restraint justification is
available for the 180-ft upper DC. Neither is classified by borrowing DP limits.

The existing formulas and provenance are documented in
[DrillstringBucklingStage4C.md](DrillstringBucklingStage4C.md): Dawson-Paslay
sinusoidal and the implemented Chen-Lin-Cheatham helical comparison,
`Fs = 2 sqrt(E I w sin(theta)/r)`, `Fh = sqrt(2) Fs`, with consistent inch/lbf
units and w in lbf/in. This study does not extend their published domain.
Conditional 60-degree DP thresholds are **Fs = 28.930317656 klbf** and
**Fh = 40.913647592 klbf**. Independent SI calculation gives Fs =
28.930317656 klbf, within 1e-6 lbf of the implementation.

| Target klbf | Conditional first Fs location MD ft | Conditional first Fh location MD ft | Max C/Fs | Max C/Fh | Controlling component / MD ft |
|---:|---|---|---:|---:|---|
| 10 | Not reached | Not reached | 0.153607 | 0.108616 | DP / 11485 |
| 25 | Not reached | Not reached | 0.672094 | 0.475242 | DP / 11485 |
| 50 | 9158.531659 | 10955.593564 | 1.536239 | 1.086285 | DP / 11485 |
| 75 | 5409.443673 | 7206.505578 | 2.400385 | 1.697328 | DP / 11485 |
| 100 | Already exceeded at 5000 | Already exceeded at 5000 | 3.264530 | 2.308371 | DP / 11485 |

These are conditional spatial threshold comparisons, not first buckling in the
full well or a time/load-onset calculation. At 100 klbf the API returns 5000 ft
with `atIntervalTop: true`: this is the first supported tangent location, **not
an interpolated crossing**. Any prior onset in the build/vertical region remains
unknown. The controlling local integration bracket is 11482.5-11485 ft in the
DP tangent, on the uphole side of the DP/DC boundary. No threshold is extended
across that boundary. Maxima refer only to the conditional DP coverage, not the
larger jar-centre compression.

## Coverage and unsupported compression

Lengths below are actual overlaps with continuous compressed sections, not
counts of solver samples. The 6485-ft DP tangent is MD 5000-11485 ft. The
conditional pass does not solve a separate beam eigenproblem for this portion
or assume its ends are pinned, fixed or isolated from the build.

| Target klbf | Conditional DP compressed length evaluated ft | Conditional compressed length unevaluated ft | Unsupported build compression ft | Unsupported vertical compression ft | Unconfirmed upper DC + jar ft |
|---:|---:|---:|---:|---:|---:|
| 10 | 666.421246 | 195.000000 | 0 | 0 | 195 |
| 25 | 2915.873666 | 195.000000 | 0 | 0 | 195 |
| 50 | 6485.000000 | 353.981692 | 158.981692 | 0 | 195 |
| 75 | 6485.000000 | 2060.828129 | 1865.828129 | 0 | 195 |
| 100 | 6485.000000 | 3441.861472 | 2000.000000 | 1246.861472 | 195 |

Strict unevaluated lengths are the **entire compressed lengths** in the first
table, rather than the conditional unevaluated lengths in this table.

Build compression occupies 4841.018308-5000 ft at 50 klbf,
3134.171871-5000 ft at 75 klbf, and 3000-5000 ft at 100 klbf. Vertical
compression occupies 1753.138528-3000 ft only at 100 klbf. These are Not
Evaluated: no straight-well threshold is substituted there, including at the
vertical/build and build/tangent boundaries. All remaining compressed length
is in the 60-degree tangent; its geometry alone does not establish stability.
Stage 4C.1 continues to report `fullyEvaluated: false` because it identifies
geometry/load sections without running a buckling model.

## Verification and interpretation

The runner checks jar centre, deployed DP length, supported geometry, strict
non-applicability, coverage reconciliation, and inverse/forward residuals.
An independent straight-tangent balance uses
`C_DPbottom = C_jar - (15*150 + 180*116)*BF*(cos60 - mu*sin60)` and
`dC/dMD = 27.76*BF*(cos60 - mu*sin60)` to verify the conditional spatial
crossings to within 1e-6 ft, bounded to the supported tangent. It never extends
this relation into the curved build. Existing Stage 4C.2 integration sensitivity
results remain relevant; no extra survey curvature or stations are invented.
JSON sample-classification brackets use end-force maxima and can start before
an interpolated crossing; the onset table uses the API's interpolated values.

Conditionally, the DP tangent is below both named thresholds at 10/25 klbf and
exceeds both over part of its length at 50/75/100 klbf. The actual buckling state
of the full compressed section remains unestablished. Increasing the target
moves compression into progressively unsupported geometry. Neither onset nor
a utilization above one predicts mechanical failure, lock-up or firing.

No post-buckling friction, force redistribution, deformation, tensile yielding,
rig limits, hydraulic delay, impact/energy or maximum safe Jar Down force is
calculated. The local frictionless criteria are compared to the unchanged
pre-buckling frictional soft-string profile; this is not a coupled frictional
stability solution. Analytical checks are not field validation.

## Execution results and changed files

The study runner completed all five scenarios and its independent assertions.
Full regression suite: 745 tests passed across 45 suites, including existing
static/inverse, buckling and compression-section tests. Production build passed;
existing unrelated lint warnings remain in UnitCon, UnitsDrop, NavPill and
basicBHACalcs. Working-tree and new-study whitespace checks passed.

Only three new files were created for this task: this report, the adjacent
`Test4BucklingStudyStage4C3.cjs` runner, and its `.json` numerical artifact.
Existing equations, UI, saved BHA/workspace and unrelated working-tree files
were not modified. Nothing was staged, committed or pushed.
