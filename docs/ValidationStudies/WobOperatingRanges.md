# Stage 2E — WOB intervals versus bit depth

Preliminary jar-placement screening, not operational guidance or a
manufacturer-approved operating limit. No jar-force or dynamics work is included.

## Sources of truth

`calcWobRangesAtDepth` deploys the string with `deployDrillstring`, evaluates
each WOB with `calcSurveyAxialLoads`, and uses the existing `jarResult` clearance
classification from `jarClearanceAcrossRun`. The existing force equations,
compression-positive convention, all-NP search, neutral intervals and
four-scenario comparison are unchanged. Exporting `jarResult` allows reuse
without maintaining a second clearance rule in the UI.

The requested jar is classified outside only when an NP/neutral interval exists
and the shared clearance result is outside the configured avoidance zone.
Missing NP, missing jar, invalid deployment and solver failures are unknown.

## Sampling and bounded refinement

Every configured WOB scan cell is evaluated at its endpoints and midpoint.
Default scan spacing is 500 lbf (0.5 klbf), giving a maximum initial sample gap
of 250 lbf. Every detected inside/outside change is refined independently by
bisection; there is no global monotonicity assumption or first-crossing exit.
All observed disconnected intervals are retained.

A transition is reported only with a WOB bracket no wider than 1 lbf and at
least one bracket endpoint within 0.01 ft of the avoidance boundary. The residual
is nearest NP/neutral-interval distance minus avoidance distance. Both endpoints
and refinement samples must have valid clearance and matching counts of isolated
NPs and neutral intervals. A topology change, invalid intermediate sample,
discontinuous margin, evaluation cap or iteration limit leaves an unknown span.
Refinement has at most 24 subdivisions per transition. Each depth/mode has at
most 2,048 evaluations; the UI additionally limits a run to 100,000 actual
evaluations. Budget exhaustion is shown as unavailable, never acceptable.

Refined boundary brackets are retained as unknown strips, excluded from known
interval interiors. Range endpoints are labelled evaluated-range limits;
neither an interval touching a range endpoint nor a disconnected set becomes
a maximum WOB. No maximum WOB field or inferred extension is produced.

**Finite sampling is not continuous-domain certification.** Matching sample
states (including midpoint checks) support a sampled interval but cannot exclude
a narrower excursion, tangential boundary contact, multiple transitions within
a sample gap, or changes of NP identity that keep the same NP count. The output
explicitly labels coverage `sample-supported`. Refine the scan spacing when
more resolution is required. The graph draws intervals only at evaluated depths
and does not interpolate boundaries across depth or between modes.

## Run panel

The existing Run analysis and Compare Four remain independent. An explicit
Calculate WOB ranges action scans the saved run request at every sampled bit MD,
for the selected jar and friction coefficient, independently for Slide/Rotate.
Rotate with missing operating inputs is unavailable; it does not inherit Slide.
Changing the run, friction selection, jar or scan spacing clears WOB results.
Progress is yielded between depths, and cancellation discards partial results.

A compact graph has separate Slide and Rotate panels, WOB in klbf versus bit MD
in feet. Green denotes sample-supported outside intervals, red inside intervals,
grey unresolved regions, and open diamonds refined boundary brackets. Dotted
lines mark the configured evaluated WOB range. Hover text retains interval and
bracket bounds. No additional large summary table is introduced.

## Validation definition

Use `SyntheticDirectionalWell.csv` and the supplied Test 4 BHA, bottom-up:

| Component | Length ft | Air lbf/ft | OD in | ID in |
| --- | ---: | ---: | ---: | ---: |
| Stabiliser | 5 | 111.25 | 6.75 | 2 |
| Lower DC | 300 | 116 | 6.75 | 1.5 |
| Jar | 30 | 150 | 9.5 | 3 |
| Upper DC | 180 | 116 | 6.75 | 1.5 |
| DP | depth-dependent | 27.76 | 5.5 | 4.67 |

Mud 10 ppg, mu 0.25, RPM 150, ROP 60 ft/hr, WOB 10–35 klbf, surface MD 0.
For this validation the avoidance half-width is explicitly **64 ft**, the
existing 20% default for a jar centre 320 ft above bit. The NP boundaries are
therefore 256 and 384 ft above bit. Other configured avoidance distances require
their own thresholds. Exact evaluation depths are 515, 4000, 5000, 7000 and
12000 ft; those round depths are not all on the 515 + n*100 run grid.

For a straight segment the independent boundary WOB is the sum up to x of
`length * airWeightPerFt * (1 - 10/65.5) * (cos(I) - mu*f*sin(I))`, with
`f = 1` for Slide and `f = 60/hypot(60, pi*OD*150*5)` for Rotate.
At MD 515 all relevant segments are vertical; at MD 12000 they lie in the
60-degree tangent. These provide independent arithmetic expectations at
x = 256 and 384 ft. Curved-depth interval interiors and boundary-adjacent WOBs
are checked with separately constructed calls to the existing run engine.

Automated tests also cover a single threshold, four transitions producing
three disconnected outside intervals, an island discovered by midpoint
sampling, no outside interval, the entire evaluated range outside, zero-width
range, missing/invalid/thrown results, topology changes, discontinuity, failed
refinement and evaluation limits. UI tests cover mode/jar/friction isolation,
explicit execution, cancellation, invalid settings and stale-result clearing.

## Numerical results

The default scan finds the following transition brackets (klbf). Each bracket
is unknown and excluded from outside/inside interval interiors. Endpoints shown
here are rounded; the returned data retains full precision.

| Bit MD ft | Deployed DP ft | Slide boundary brackets klbf | Rotate boundary brackets klbf |
| ---: | ---: | --- | --- |
| 515 | 0 | 25.141602–25.142578 | 25.141602–25.142578 |
| 4000 | 3485 | 19.447266–19.448242; 30.406250–30.407227 | 22.538086–22.539063 |
| 5000 | 4485 | 14.353516–14.354492 | 13.970703–13.971680; 22.529297–22.530273 |
| 7000 | 6485 | 10.938477–10.939453 | 12.549805–12.550781; 19.262695–19.263672 |
| 12000 | 11485 | 10.938477–10.939453 | 12.549805–12.550781; 19.262695–19.263672 |

At 515 ft both modes are outside below the bracket, inside above it. At 4000 ft
Slide is outside below its first bracket and above its second; Rotate is outside
below its bracket. At 5000 ft Slide is inside below its bracket and outside above;
Rotate is outside below its first bracket and above its second. The 7000/12000-ft
classifications follow that same Slide/Rotate pattern. These preserve disconnected
outside regions rather than turning them into one maximum-WOB limit.

Independent vertical thresholds are 25.142135496 and 38.587540076 klbf; the latter
lies beyond the evaluated 35-klbf ceiling and is not reported as an in-range
transition. At 60 degrees, Slide thresholds are 7.127635737 and 10.939322544 klbf;
the former is below the evaluated floor. Rotate thresholds are 12.550532212 and
19.263154110 klbf. All in-range analytic values fall inside calculated brackets.

Across the ten depth/mode cases, 28 separately evaluated WOB cases (5 lbf outside
each bracket endpoint) all match their expected neighbouring classifications.
Halving the solver maximum step from 5 to 2.5 ft leaves every reported 1-lbf
transition bracket unchanged; it does not imply exact agreement below bracket
resolution. Maximum observed endpoint clearance residual is 0.009351 ft. Each
depth/mode needed 109 or 117 full solver evaluations for this WOB range.
