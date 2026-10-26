# Stage 4C.2: Test 4 Jar Down compression study

These are synthetic study scenarios, not recommended operating loads. This study
identifies compression using existing calculations; it does not calculate
buckling onset, firing success or a safe Jar Down operating limit.

## Reproduction and configuration

Run from the repository root:

```text
node docs/ValidationStudies/Test4CompressionStudyStage4C2.cjs
```

The runner imports the unchanged inverse solver, forward static solver and
Stage 4C.1 compressed-section module. It writes the adjacent
`Test4CompressionStudyStage4C2.json`, containing full-precision numerical results,
input properties, residuals, zero brackets, component/geometry subdivisions and
refinement diagnostics. The runner's Babel adapter only loads existing ES
modules in Node; it does not change engineering code or equations.

- Base HEAD: `0a9ec13dffb6498e0a31632c9469c4209ef92e58`, branch
  `feature/workspace-v2`, with the existing uncommitted Stage 4C/4C.1 modules.
- Survey: unchanged `SyntheticDirectionalWell.csv`, 41 original stations.
- Vertical: MD 0-3000 ft; circular build: MD 3000-5000 ft, 3 degrees/100 ft;
  straight 60-degree tangent: MD 5000-12000 ft. Azimuth is 90 degrees throughout.
- Bit MD 12000 ft; surface MD 0 ft; selected jar centre MD 11680 ft.
- Mud 10 ppg; buoyancy factor `1-10/65.5`; friction coefficient 0.25.
- RPM 150 is recorded as requested. The existing Jar Down static model uses
  fully mobilised **nonrotating** slack-off friction: RPM does not enter that
  model. This is not a simulation of simultaneous rotation and lowering.
- No modulus, hole diameter or tubular-idealization confirmation is invented.

Bottom-up BHA, as documented in `WobOperatingRanges.md`:

| Component | Deployed length ft | Air weight lbf/ft | OD in | ID in |
|---|---:|---:|---:|---:|
| Stabiliser | 5 | 111.25 | 6.75 | 2 |
| Lower DC | 300 | 116 | 6.75 | 1.5 |
| Jar | 30 | 150 | 9.5 | 3 |
| Upper DC | 180 | 116 | 6.75 | 1.5 |
| Auto DP | 11485 | 27.76 | 5.5 | 4.67 |

The runner gives Auto DP a zero placeholder length; the existing deployment
utility supplies 11485 ft from the analysis depth. No saved BHA is altered.
Only surface to jar centre is evaluated. The lower jar half, lower DC and
stabiliser are outside the evaluated load interval.

## Primary numerical results

Compression-positive axial force; surface hookload is positive tensile support.
Each successful scenario contains **one continuous compressed interval**.
Interval boundaries include the interpolated zero-force start as the closure of
the positive interval. All successful global maxima occur at MD 11680 ft.

| Target jar compression klbf | Required surface hookload klbf | Forward jar compression klbf | Compressed interval MD ft | Compressed length ft | Maximum compression klbf @ MD ft |
|---:|---:|---:|---|---:|---|
| 0 | Unavailable | Unavailable | Not established | Not established | Not established |
| 10 | 139.854231 | 9.999998 | 10818.578754-11680 | 861.421246 | 9.999998 @ 11680 |
| 25 | 127.401543 | 24.999999 | 8569.126334-11680 | 3110.873666 | 24.999999 @ 11680 |
| 50 | 102.949371 | 49.999991 | 4841.018308-11680 | 6838.981692 | 49.999991 @ 11680 |
| 75 | 73.691254 | 74.999997 | 3134.171871-11680 | 8545.828129 | 74.999997 @ 11680 |
| 100 | 41.237030 | 99.999997 | 1753.138528-11680 | 9926.861472 | 99.999997 @ 11680 |

The **0-klbf inverse request returns `invalid-input`**: the existing API requires
`desiredJarForceLbf > 0`. This is an API-domain restriction, not evidence that a
zero jar force is physically unreachable. No epsilon target, alternative root
solver, guessed hookload or substituted profile is used. Consequently that row
cannot support compression, component or geometry conclusions.

All five positive targets were achieved numerically. No positive target returned
`unreachable-target`, `unbracketed-target` or nonconvergence. As a branch-boundary
check, the unchanged forward solver at zero surface hookload returns
131.738713 klbf jar compression. This is a model calculation at one boundary,
not a rig rating or a maximum safe compression.

## Compression by well section

Each cell is **compressed length ft / sampled maximum compression klbf**.
A dash denotes no compressed portion, not missing survey coverage.

| Target klbf | 60-degree tangent, MD 5000-11680 | Build, MD 3000-5000 | Vertical, MD 0-3000 |
|---:|---:|---:|---:|
| 0 | Not established | Not established | Not established |
| 10 | 861.421246 / 9.999998 | 0 / - | 0 / - |
| 25 | 3110.873666 / 24.999999 | 0 / - | 0 / - |
| 50 | 6680.000000 / 49.999991 | 158.981692 / 1.200023 | 0 / - |
| 75 | 6680.000000 / 74.999997 | 1865.828129 / 26.200029 | 0 / - |
| 100 | 6680.000000 / 99.999997 | 2000.000000 / 51.200075 | 1246.861472 / 29.328466 |

Tangent maxima are at the jar centre. Build maxima are sampled at MD 5000 ft
for 50 and 75 klbf, and MD 4997.5 ft for 100 klbf. The last is a small local
sampled peak near the end of the build; the static model's curvature-dependent
contact/friction means axial force need not increase monotonically throughout
the build. The compressed vertical portion in the 100-klbf case peaks at
MD 3000 ft. These are sampled-profile maxima, not independently solved interior
extrema or post-buckling equilibria.

Geometry transitions **inside compression** are absent for 10/25 klbf, at
MD 5000 ft for 50/75 klbf, and at MD 3000 and 5000 ft for 100 klbf. Compression
remains continuous across these transitions; survey subdivisions are not
independent buckling specimens.

## Tubular components in compression

All five successful cases contain DP, the entire upper DC, and the upper half
of the selected jar. Component boundaries inside compression are always
MD 11485 ft (DP/upper DC) and MD 11665 ft (upper DC/jar).

| Target klbf | Compressed DP length ft | Compressed upper DC length ft | Compressed jar length ft |
|---:|---:|---:|---:|
| 0 | Not established | Not established | Not established |
| 10 | 666.421246 | 180 | 15 |
| 25 | 2915.873666 | 180 | 15 |
| 50 | 6643.981692 | 180 | 15 |
| 75 | 8350.828129 | 180 | 15 |
| 100 | 9731.861472 | 180 | 15 |

The compressed DP extends from each scenario's onset MD to MD 11485 ft;
upper DC spans 11485-11665 ft and the evaluated jar portion 11665-11680 ft.
Each row reconciles to the primary table's total compressed length.

## Geometric eligibility versus actual buckling evaluation

| Target klbf | Geometrically eligible compressed tangent length ft | Percentage of total compressed length | Compressed geometry excluded by existing criteria |
|---:|---:|---:|---|
| 0 | Not established | Not established | Not established |
| 10 | 861.421246 | 100.000% | None geometrically |
| 25 | 3110.873666 | 100.000% | None geometrically |
| 50 | 6680 | 97.675% | Build |
| 75 | 6680 | 78.167% | Build |
| 100 | 6680 | 67.292% | Build and vertical |

These percentages describe **geometry only**. The documented BHA does not supply
explicit elastic modulus or wellbore diameter, and no component idealization
has been confirmed. Stage 4C.1 reports missing `youngsModulusPsi` and
`wellboreDiameterIn`; all segments have `fullyEvaluated: false`. No buckling
thresholds or utilization values are computed in this study. A jar's OD/ID also
does not establish that it is a uniform elastic tubular suitable for a long-pipe
criterion. Thus none of these scenarios is an actual completed buckling
evaluation, even when its entire compressed length has straight inclined geometry.

## Sampling sensitivity

The original survey is retained, including its exact MD 3000/5000 section
boundaries. Only the existing solver's integration-step input is refined;
no new curvature, synthetic tortuosity or interpolated survey stations are added.
Each finer case is independently inverted and freshly forward-verified.

The requested maximum steps 5, 2.5 and 1.25 ft are automatically halved once
by the existing curved-section convergence check, giving **accepted steps
2.5, 1.25 and 0.625 ft**, respectively. Profile sample counts are 4673, 9345
and 18689. Convergence tolerance remains 0.1 lbf; inverse residual tolerance
remains 0.01 lbf. These controls are unchanged across the comparison.

| Target klbf | Accepted maximum step ft | Compression onset MD ft | Compressed length ft | Maximum compression klbf |
|---:|---:|---:|---:|---:|
| 10 | 2.5 | 10818.578754 | 861.421246 | 9.999998 |
| 10 | 1.25 | 10818.576930 | 861.423070 | 10.000010 |
| 10 | 0.625 | 10818.577075 | 861.422925 | 10.000009 |
| 50 | 2.5 | 4841.018308 | 6838.981692 | 49.999991 |
| 50 | 1.25 | 4841.017413 | 6838.982587 | 49.999990 |
| 50 | 0.625 | 4841.017320 | 6838.982680 | 49.999990 |
| 100 | 2.5 | 1753.138528 | 9926.861472 | 99.999997 |
| 100 | 1.25 | 1753.138528 | 9926.861472 | 99.999997 |
| 100 | 0.625 | 1753.138528 | 9926.861472 | 99.999997 |

Relative to baseline, largest onset/length change is 0.001824484 ft at 10 klbf,
largest global maximum-compression change is 0.012166183 lbf, and the maximum
MD stays 11680 ft. All geometry transition locations are unchanged.
The 10-klbf finer inversions select a hookload 0.009536743 lbf lower than
baseline; therefore these comparisons include inverse stopping/quantization
effects as well as integration refinement. They do not establish monotonic
convergence or absolute physical accuracy to the printed decimal places.
For 50 klbf the largest onset shift is 0.000987804 ft. For 100 klbf it is
less than 1e-9 ft, consistent with the vertical analytical relation below.

## Forward/inverse and independent checks

The inverse solver performs its own fresh forward check. The study then calls
Stage 4C.1, which independently repeats the forward calculation at the returned
hookload; both residuals are retained in JSON and agree.

| Target klbf | Fresh forward jar force minus target, lbf |
|---:|---:|
| 0 | Not evaluated: inverse input rejected |
| 10 | -0.002239531 |
| 25 | -0.001155542 |
| 50 | -0.009130921 |
| 75 | -0.003193329 |
| 100 | -0.002526155 |

Every positive baseline and finer case satisfies absolute residual <=0.01 lbf.
The largest baseline profile-refinement difference is 0.015400062 lbf, below
the existing 0.1-lbf convergence tolerance. Residual agreement is a numerical
consistency check, not proof that integration or physical error is below the
inverse residual tolerance.

In the vertical DP, gravity acts axially and the existing contact model gives
zero axial friction. Independently, `C(MD)=-H+27.76*(1-10/65.5)*MD`.
For the 100-klbf case, the returned H gives onset MD
1753.138527740313 ft, matching the module's 1753.138527740300 ft to roundoff.
In each straight 60-degree component, the independent compression gradient is
`airWeightPerFt*(1-10/65.5)*(cos(60)-0.25*sin(60))`; component forces remain
continuous while that gradient changes with distributed weight.
The runner verifies the forces at MD 11485 and 11665 ft against the independent
upper-DC and half-jar balances to within 1e-6 lbf (baseline differences are below
3.3e-10 lbf). Independent tangent onsets at 10 and 25 klbf agree with the module
within 6e-11 ft; that tangent calculation is never extrapolated into the build.

## Interpretation and validation status

Reducing the surface tensile support increases the calculated compression at
the jar and moves its zero crossing uphole. At 50 klbf compression has entered
the build; at 100 klbf it extends into the vertical DP. Consequently the
existing straight-only screening has progressively less geometric coverage of
the compressed string. Missing material/bore inputs prevent actual evaluation
even in the eligible tangent portions.

The model retains the assumed lower-assembly reaction and pre-buckling
soft-string centreline. It does not establish that the compressed configuration
is physically maintainable. No post-buckling redistribution, failure, firing,
lock-up, impact, energy or safe operating envelope is inferred.

Relevant regression tests: 126 passed across static loads, inverse static loads,
Stage 4C buckling and Stage 4C.1 compressed sections (four suites). Production
build passed with existing unrelated lint warnings in UnitCon, UnitsDrop,
NavPill and basicBHACalcs. The complete suite also passed: 717 tests across
42 suites. Working-tree and new-artifact whitespace diff checks passed. No
engineering equation or UI code was changed. Nothing was staged, committed
or pushed; unrelated working-tree files were left untouched.
