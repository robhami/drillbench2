# DrillFrame JarFrame V6 integration - Stage 0 baseline

**Scope:** regression protection and source-of-truth documentation before UI integration. No production code, engineering equations, solver behavior, or frozen fixture was changed.

## Calculation boundary

`src/engineering/forces/calcStraightDrag.js` is the straight-hole drilling calculation used by `engineering/jar/jarAnalysis.js` and `src/Apps/EngineeringResults/EngineeringResults.js`. It applies the selected Reference, Slide, or Rotate mode, uses bit WOB as the axial boundary condition, and returns the axial load profile used for its neutral point. Its convention is positive compression and negative tension.

`src/engineering/forces/calcSurveyAxialLoads.js` is a separate survey-based soft-string calculation used by `calculateRealBhaStatic` in `src/engineering/jar/realBhaComparison.js`, the neutral-point-across-run analysis, and the survey-based Engineering String view. It integrates curved survey geometry with buoyancy and axial wall friction; Rotate resolves friction using RPM, ROP, and OD. It accepts Slide and Rotate and rejects Reference with "Mode must be slide or rotate (downward drilling)." It is not a drop-in implementation of `calcStraightDrag` and does not currently share a single calculated profile with every widget.

The static Jar Position Analysis currently supplies `bha`, survey, bit MD, surface MD, selected `drillingMode`, and selected jar to `calculateRealBhaStatic`. The active `jarConfiguration` Widget receives the raw BHA; unlike `jarPlacement`, it is not given the deployed BHA by `Widget.js`. Keep this distinction and the selected jar's row identity explicit in any later integration.

## Recorded baselines and tolerances

The read-only Stage 0 replay used the working-copy fixture `OES8p5Stage6C2.fixture.v1.json` and the independent static reference `OES8p5Stage6C1.reference.json`. Conditions are the documented vertical survey, 9,318-ft bit MD, zero surface reference, 15.5-ppg mud, 33-klbf WOB, zero friction, selected jar index 0, and a 40-klbf target jar compression.

| Quantity | Independent reference | Replayed value | Existing reference tolerance |
|---|---:|---:|---:|
| Jar centre above bit | 640.83 ft | 640.8299999999999 ft | 0.000001 ft |
| Jar axial force | -16,068.616717557252 lbf | -16,068.616717557226 lbf | 0.1 lbf |
| Surface hookload | 177,417.1799236641 lbf | 177,417.17992366245 lbf | 0.1 lbf |
| Neutral point above bit | 427.6787214975605 ft | 427.67872149756033 ft | 0.0001 ft |
| Surface hookload for 40-klbf jar compression | 121,348.56320610688 lbf | 121,348.57177734375 lbf | 0.1 lbf |

The last value has a replay residual of +0.0085712369 lbf and remains within the existing tolerance. It is recorded as calculated; no tolerance was changed.

The existing independently generated Skeem Test 4 reference remains: 488.3 klbf incident force, 1,090.6 klbf peak stuck-point tensile force, 23,155 lbf*s primary impulse, 15.3 ft/s impact velocity, 59.96 ms impact time, and 22.50 ms primary pulse. These outputs are for that test's idealized assumptions and are not the Stage 8 fixed-window results.

Stage 8 is a different reconstructed geometry: the idealized OES BHA includes a 1-ft diagnostic bit, so its selected fixture sample is 641.83 ft while the captured static BHA jar is at 640.83 ft. The Stage 8 compact recurrence produced 16/16 complete 50-ms outputs and is byte-identical to saved Stage 4 recurrence histories. Only six positions have full-window exact-event comparisons; ten exact-event runs are incomplete, including two that stop before the first stuck-point arrival. The 641.83-ft Stage 8 row is 3,194.433623376509 kN peak tensile magnitude, 32.82009655473309 kN*s tensile-only fixed-window impulse, and 4.3047914809231544 m/s impact velocity. This is fixture data, not a static OES baseline or a live-BHA prediction.

## Test write audit

Before execution, the Stage 0 Jest targets were searched for `writeFile`, `writeFileSync`, append, mkdir, removal, copy, rename, and snapshot-output calls. The selected Workspace, Jar Up input, dynamic comparison, and iteration-table tests contain no research-file writes. `src/Apps/JarConfiguration/RealBhaComparison.test.js` has an unconditional `afterAll` that writes `docs/ValidationStudies/RealBHAJarStage6E2/static-comparisons.json`; it was deliberately excluded from execution to preserve that research artifact. Other known artifact-writing tests include `src/engineering/jar/realBhaComparison.test.js`, `src/engineering/bha/oes8p5IndependentValidation.test.js`, `oes8p5StaticSensitivity.test.js`, and solver validation tests gated by environment variables; do not run them as part of this read-only baseline without first redirecting output or explicitly protecting the target artifacts.

## Regression coverage added

- Active Widget registry route renders `JarConfiguration`, forwards mode/depth/surface context, and keeps the raw BHA including auto-drillpipe metadata and `jarImpactInputs`.
- Floating Workspace Jar Position Analysis retains `jarConfiguration1` identity and saved visibility/maximized state over close/reopen/reload.
- Static jar comparison replays the independent OES baseline, selects the requested jar row, rejects missing survey coverage and records Reference-mode rejection in the survey pathway.
- Static UI draft alternatives are cleared when drilling mode, analysis bit depth, or associated survey geometry changes.
- Jar Up input changes go through the existing BHA update callback and reload from persisted metadata.
- Dynamic worker results from an invalidated BHA request are ignored after termination.
- Candidate CSV export retains `JarUpPositions.csv`, oilfield units, field labels, MIME type, and object-URL cleanup.

## Execution record

The audited non-writing target set was run with the React Scripts Jest runner, `--watch=false --runInBand --no-cache --runTestsByPath`, covering seven test files:

| Test suite | Result |
|---|---|
| `src/WorkspaceV2/JarConfigurationRoute.test.js` | PASS |
| `src/WorkspaceV2/FloatingWindows.test.js` | PASS |
| `src/engineering/jar/realBhaComparisonStage0.test.js` | PASS |
| `src/Apps/JarConfiguration/RealBhaComparisonStage0.test.js` | PASS |
| `src/Apps/JarPlacement/JarPerformance.test.js` | PASS |
| `src/Apps/JarConfiguration/RealBhaDynamicComparison.test.js` | PASS |
| `src/Apps/JarConfiguration/JarUpIterationTable.test.js` | PASS after correcting a pre-existing fixture index error in the test: the sole jar is index 0 in the filtered jar list, but the test passed index 1 (the inserted bit's row position). Its direct solver call had the same error. Expected values and tolerances were unchanged. |

Overall final run: 7 suites passed; 32 tests passed, 0 failed. The runner was invoked directly through `react-scripts/scripts/test.js` with an in-memory Node `realpathSync` shim because the ordinary `npm test` launcher was denied while resolving the restricted `C:/coding` parent (`EPERM`). The shim did not write files. The full test suite was not run because it includes tests that overwrite engineering validation artifacts. `src/Apps/JarConfiguration/RealBhaComparison.test.js` was excluded because its unconditional `afterAll` writes `docs/ValidationStudies/RealBHAJarStage6E2/static-comparisons.json`.
