# Stage 4C.4: explicit drillpipe idealization

## Inputs and state

Jar Forces > Engineering Details now accepts **Young's Modulus E (psi)** with
no default and the unchecked confirmation **Treat selected drillpipe as uniform
tubular for buckling screening**. One DP is selected automatically; multiple DP
rows require selection. Existing deployment restrictions still reject multiple
DP sections; the selector does not create a new deployment policy.

These are session-only engineering inputs, not saved BHA geometry or a new
storage system. Closing/remounting/reloading resets them. A configuration
signature ties confirmation to the selected row identity, all its properties,
BHA identity, Bit Size, modulus, analysis/surface depth and fixed component
lengths. Changes invalidate confirmation, including changing back afterwards.
This deliberately also invalidates conservative cases such as metadata changes
on the selected row. No future, replacement, collar or jar component inherits
confirmation. Existing saved confirmation flags are ignored by this UI adapter.

Modulus must be explicit, positive and finite. The nominal bore is always
`bha.holeSize` (Bit Size), without a separate diameter default or override.
Existing threshold validation checks OD/ID, positive radial clearance, geometry
and stiffness. Missing/invalid inputs and unsupported intervals are Not
Evaluated. User confirmation accepts an idealization; it is not field validation
or proof that actual finite-section boundary conditions satisfy the model.

## Integration and boundaries

`confirmedDpBuckling.js` is a configuration/coverage adapter. It passes explicit
modulus and confirmation only to selected DP, removes confirmation from other
components in an in-memory copy, and calls the existing `calcJarDownBuckling`.
No original BHA is mutated. The surface boundary is the current inverse Jar Down
required hookload; the buckling API obtains a fresh unchanged slack-off profile
at that boundary. Compression sections come from existing `identifyLoadRegions`
on that same returned profile. Coverage sums exact overlaps with continuous
compression regions, including interpolated zero crossings, rather than whole
integration-element counts. Exclusions retain component identities and boundaries.

The existing positive-compression convention, force/friction equations,
inverse solver, buckling thresholds, Skeem dynamics and rig limits are unchanged.
Scope remains surface to selected jar centre. No below-jar reaction is invented;
the existing lower-assembly reaction is assumed.

The compact summary reports status, spatial sinusoidal/helical onset, maximum
sinusoidal utilization and evaluated/unevaluated compressed lengths. It updates
when inputs or the current verified loading result change. No Jar Up result or
stale Jar Down result is reused. No safe/unsafe label is added. A threshold
already exceeded at the first supported element is labelled **Already exceeded
at**, not described as a crossing in unsupported uphole geometry.

## Test 4 reproduction

```text
node docs/ValidationStudies/Test4ConfirmedBucklingStage4C4.cjs
```

The runner imports the documented Stage 4C.3 input artifact, freshly inverts each
target, supplies E=30000000 psi, confirms only DP row 4, and uses Bit Size=16 in.
Its adjacent JSON records full-precision results and differences from the
previous conditional comparison. The original synthetic survey and BHA remain
unchanged: bit 12000 ft, surface 0 ft, jar centre 11680 ft, mud 10 ppg, mu=0.25,
RPM 150. The nonrotating slack-off model does not use RPM; zero torque is a
confirmed idealization for the buckling comparison, not a computed torque state.

| Jar target klbf | Surface hookload klbf | Sinusoidal onset MD ft | Helical onset MD ft | Max C/Fs | Evaluated compression ft | Unevaluated compression ft |
|---:|---:|---|---|---:|---:|---:|
| 10 | 139.854231 | Not reached | Not reached | 0.153607 | 666.421246 | 195.000000 |
| 25 | 127.401543 | Not reached | Not reached | 0.672094 | 2915.873666 | 195.000000 |
| 50 | 102.949371 | 9158.531659 | 10955.593564 | 1.536239 | 6485.000000 | 353.981692 |
| 75 | 73.691254 | 5409.443673 | 7206.505578 | 2.400385 | 6485.000000 | 2060.828129 |
| 100 | 41.237030 | Already exceeded at 5000 | Already exceeded at 5000 | 3.264530 | 6485.000000 | 3441.861472 |

All located onset differences from Stage 4C.3 are exactly zero at stored
precision. Utilization and coverage also match; no equations were adjusted.
The controlling DP location is 11485 ft on the DP side of the upper-DC boundary.
DP tangent thresholds remain 28.930317656/40.913647592 klbf sinusoidal/helical.
All targets satisfy the existing 0.01-lbf forward/inverse residual tolerance.

The unevaluated 195 ft in every case is upper DC (180 ft) and upper jar half
(15 ft). Additional excluded compressed build lengths are 158.981692 ft at
50 klbf, 1865.828129 ft at 75 klbf, and 2000 ft at 100 klbf. The 100-klbf
case also contains 1246.861472 ft of unsupported vertical compression.

## Validation and limitations

Regressions cover missing/invalid modulus, unchecked/checked configuration,
component identity/geometry changes, deployment depth and Bit Size invalidation,
session reset, multiple-DP selection, missing hole/invalid clearance, invalid
OD/ID, unsupported curved/vertical geometry, coverage reconciliation, isolated
DP confirmation and all five Test 4 targets. Existing Jar Forces table tests
recognize the new two-column summary.

Browser validation of the production build reproduced the 50-klbf summary:
9158.5/10955.6 ft onset, utilization 1.5 displayed, and 6485.0/354.0 ft evaluated/
unevaluated compression. Geometry and analysis-depth edits cleared confirmation
and results. Reload left E blank, confirmation unchecked and no saved component
confirmation flags. Panel widths 620/420/300 px had no horizontal overflow.

The model remains the existing long, uniform, initially straight, zero-torque,
frictionless-onset comparison against a pre-buckling frictional soft-string
profile. See [Stage 4C provenance](DrillstringBucklingStage4C.md) and
[Stage 4C.3 limitations](Test4BucklingStudyStage4C3.md). Local integration
elements are not independent finite-length specimens; confirmation does not
resolve end restraint or the complete nonuniform compressed-section stability
problem. Curved/vertical sections and unconfirmed components remain excluded.
No post-buckling redistribution, lock-up, failure, strength, firing, impact,
hydraulic delay or maximum safe Jar Down force is inferred.

## Completion checks

- Complete test suite: 778 tests / 47 suites passed (33 added regressions).
- Production build: passed; existing unrelated lint warnings remain in UnitCon,
  UnitsDrop, NavPill and basicBHACalcs.
- Final production browser checks: passed, including the Bit Size-only adapter.
- Working-tree and new-file whitespace checks: passed.
- Existing force, inverse, friction, threshold, rig-limit and Skeem files were
  not changed. No staging, commit or push was performed.

Changed files for this stage: JarForces.js, JarForces.css, JarForces.test.js;
new BucklingDetails.js and BucklingDetails.test.js; new confirmedDpBuckling.js
and confirmedDpBuckling.test.js; this report and the Stage 4C.4 reproduction
runner/JSON. All other working-tree changes predate this stage and were left
untouched.
