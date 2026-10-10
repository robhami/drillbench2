# Jar Configuration Analysis workspace

Open **Config** in Workspace V2. This separate window calls
`calcSkeemConfigurationSweep()`; no Skeem equations, sweep calculations, drilling
loads, saved BHA lengths, Jar Performance or Engineering String are changed.
Results remain preliminary engineering analysis, not operational guidance.

## BHA mapping and assumptions

The existing Jar Performance geometry adapter is authoritative for applicability:
exactly one jar, contiguous uniform drill collars below and above it, followed by
uniform free drillpipe. HWDP, stabilisers, mixed dimensions, missing tubular OD/ID
and incomplete components block calculation. No equivalent geometry is invented.

For this analysis the stuck point is explicitly assumed at the bit (0 ft).
Actual L1 runs from the bit to the lower jar face; L2 runs from the upper jar face
to the pipe interface. The physical jar body is excluded. L3 is the entered free
pipe length. Operating overpull is entered **at the jar**, independently of drilling
WOB or surface overpull; defaults are 165 klbf and a 4-in stroke, editable by users.

All collars must also have the same positive entered air weight per foot. Material
weight density is derived as `weightPerFoot / (12 * collarMetalArea)` in lbf/in³.
The sweep engine recalculates each lower/upper collar air weight from that density
and the sampled length. No buoyancy correction is applied. E = 30 million psi and
acoustic velocity = 16,000 ft/s reuse the existing adapter's material assumptions.
The existing solver enforces free-pipe and lower-weight validity limits per sample.

The idealisation assumes one-dimensional elastic waves, uniform tubular sections,
a rigid stuck point, no damping or borehole friction, no detailed jar internals,
and the primary impact interval only. See `SkeemDynamics.md` and
`SkeemConfigurationSweep.md` for provenance and unresolved model limitations.

## Runs and plot mapping

Only **Run sweep** evaluates configurations. Initial bounds use 25–75% of the
actual effective collar total. Fixed-total defaults to 50 positions; independent
defaults to 20 × 20. Controls limit fixed-total runs to 500 and independent runs to
50 × 50, below the engine's 10,000-sample guard. Edited inputs explicitly mark an
existing plot as the previous run. Changing BHA clears results; later edits do not
overwrite entered bounds. Changing the displayed metric reuses stored results.

- Fixed total: X = L1 (ft), L2 = total − L1; Y is impulse (lbf·s), average force
  (klbf) or initial impact force (klbf). Invalid Y values are `null` with
  `connectgaps: false`. A separate actual-BHA calculation uses the same operating
  conditions; its marker is shown only if valid and its total matches the curve.
- Independent: X = L1, Y = L2, Z = selected metric. Explicit mesh triangles join
  adjacent cells only when all four corners are valid. No automatic triangulation
  crosses invalid samples. Isolated valid nodes remain visible as points. Facets
  visually join calculated samples; no additional engineering results are inferred.
- Hover shows sampled lengths and performance. Drag rotates, wheel zooms and the
  toolbar enables pan. `ResizeObserver` updates plot width on widget resizing.
  Independent plots are 600 px high; fixed-total plots retain their 380-px height.
  A closer default camera, five-tick axes and compact colour bar improve readability.
  Hover includes total effective collar length for curves, meshes and markers.
  Camera state persists across metric switches within a run.
- All three maxima and valid/invalid counts come directly from the sweep results.
  Maxima are labelled **within the sampled domain**, never global or operational
  optima. Plotted impulse is the primary stuck-point force integral, not internal
  jar hammer momentum. Invalid reasons and assumptions remain in collapsed details.

## Dependencies and validation

`react-plotly.js` 4.1.0 uses a `plotly.js` npm alias targeting
`plotly.js-gl3d-dist-min` 4.1.2. This bundle supports both scatter and explicit 3D
meshes; it is lazy-loaded only after a successful plot run. The plotting chunk is
approximately 533 kB gzipped. 3D requires browser WebGL support.

Tests cover units, geometry rejection, material density, input mapping, invalid
gaps, mesh topology and axis orientation, metric caching, actual markers, all
maxima, explicit-run limits, saved-BHA loading, immutable BHA data and responsive
width updates. A production-browser check additionally exercised a 400-node,
722-triangle mesh, camera rotation, metric switching, invalid-grid gaps and a
460-px widget resized to a 422-px plot, with no JavaScript errors or BHA changes.

The reference geometry (6.25 × 2.75-in collars, alpha 5, 165-klbf overpull, 4-in
stroke, L3 3,000 ft and density 0.283 lbf/in³) reproduces the existing sweep results:
for a 240-ft total sampled at L1 = 60, 120 and 180 ft, the maximum sampled impulse
is 12,303.474542 lbf·s at L1 = 60 ft, L2 = 180 ft. Geometry and physics remain
limited to the existing model; this visualisation adds no validation against
external field measurements or published figure digitisation.

## 65-ft / 65-ft average-force verification

**Resolved: the actual BHA reproduces 1,148.429 klbf.** On 2026-10-10 the persisted
`drillbenchWell.currentBha` named **Validation test 3** was recovered read-only
from Edge's `http://localhost:3000` local storage. No browser data was changed.
The operating settings and sweep coordinates below are those specified in the
reported case; the analysis window does not persist its operating controls.

The saved rows contain 160 ft of lower collars, a 30-ft jar, 100 ft of upper
collars and 3,000 ft of drillpipe. The sampled L1/L2 values are independent
hypothetical lengths; they do not replace those saved component lengths.
The jar body is excluded from effective collar lengths and weights.

| Input | Exact value used |
|---|---:|
| Collar OD / ID | 9.5 / 3.75 in |
| Collar entered air weight per foot | 203 lbf/ft |
| Saved lower / upper collar air weights | 32,480 / 20,300 lbf |
| Sampled lower / upper collar air weights | 13,195 / 13,195 lbf |
| Drillpipe OD / ID | 5.5 / 4.67 in |
| Free drillpipe length L3 | 3,000 ft |
| Drillpipe entered weight per foot | 27.76 lbf/ft (not an independent solver input) |
| Material weight density | 0.2827100110267849 lbf/in³ |
| Young's modulus | 30,000,000 psi |
| Acoustic velocity | 16,000 ft/s |
| Overpull at jar | 165 klbf → 165,000 lbf |
| Stroke | 4 in → 1/3 ft within the solver |
| Sampled L1 / L2 | 65 / 65 ft |
| Total effective collar length | 130 ft |

The geometry adapter derives density from `203 / (12 * Ac)`, where
`Ac = 59.83752257384309 in²`. It does not substitute 200 lbf/ft or a default
steel density. E and acoustic velocity retain the existing material assumptions.
The resulting area ratio is **9.025778630747176**, rather than the published
reference example's alpha = 5; lambda is **0.8005142469567026**.

`configurationGeometry()` and `configurationRequest()` were used to reconstruct
the one-sample independent request. A separate direct `calcSkeemPostImpact()`
call supplied the explicit tubular dimensions, material properties, L3,
F0 = 165,000 lbf, stroke = 4 in, L1 = L2 = 65 ft and W = 203 × 65 = 13,195 lbf.
Its input and expected weight were not copied from a sweep result.

| Output | Independent sweep | Direct solver | Difference |
|---|---:|---:|---:|
| Impact velocity (ft/s) | 10.16768771153553 | 10.16768771153553 | 0 |
| Initial impact force (klbf) | 570.3836652776196 | 570.3836652776196 | 0 |
| Average stuck-point force (klbf) | 1,148.4291642045384 | 1,148.4291642045384 | 0 |
| Primary impulse (lbf·s) | 9,330.986959161874 | 9,330.986959161874 | 0 |
| Primary pulse duration (s) | 0.008125 | 0.008125 | 0 |

### Independent arithmetic check

Python Decimal at 60-digit precision independently evaluated the documented
closed-form reflection sum and force rectangles, without calling the JS solver:

```text
v_n = vc * [alpha - (alpha - 1) * lambda^n]
D_N = vc*T * [N*alpha - (alpha-1)*(1-lambda^N)/(1-lambda)]
tImpact = N*T + (strokeFt - D_N)/v_N
FI = F0*v_N/(2*vc)
R = F0*lambda^(N+1)
d = (N+1)*T - tImpact
J = 2*(FI-W)*d + [2*(FI-W)+2*R]*(T-d)
F_average = J/T
```

N = 6 is verified by `D_6 = 0.292867482828 ft < 1/3 ft` and
`D_7 = 0.375479945484 ft >= 1/3 ft`. Impact occurs at
0.05272984789205102 s. The weight-corrected force is
1,114,377.3305552393 lbf for 0.004145152107948981 s, then rises by
69,518.02076485183 lbf for the remaining 0.003979847892051019 s.
Their exact integral is 9,330.98695916187375 lbf·s, giving
1,148.42916420453831 klbf. The `-2*W = -26,390 lbf` correction is retained
throughout both intervals.

The earlier **695.717190015-klbf** comparison used 6.25 × 2.75-in collars,
4.5 × 3.7349698794-in pipe, alpha = 5 and 0.283-lbf/in³ density. It remains
correct for that separate reference configuration. Its difference from the
actual BHA arises from input geometry and air-weight density, not unit
conversion, sweep mapping or solver behaviour. No equations or UI were changed.

`actualBhaVerification.test.js` preserves the recovered dimensions, weights,
lengths and entered string/number types without private row identifiers. It
checks mapping, all five outputs against the direct solver and independent
expected values, the weight-corrected impulse, and non-mutation of the BHA.
This is verification of the implemented idealised model, not independent
validation of field impact loads or operational suitability.

## Rendering lifecycle investigation

An instrumented 20 × 20 run with the recovered supported BHA was checked in
Chrome and Edge, including the development server and production build. Before
the correction, the wrapper mounted Plotly with an undefined width, invoked
`Plots.resize`, then queued a second `Plotly.react` with the measured width.
An unrelated workspace focus/drag-stop update sent two further `Plotly.react`
calls with unchanged data but newly allocated layout and config objects.

The wrapper now reserves the plot's height, waits for a positive measured width
before mounting Plotly, memoizes its sized layout/style, and uses one stable
config. ResizeObserver and the fallback window listener update explicit width;
the competing Plotly automatic resize handlers are no longer enabled. Existing
data memoization, mesh topology, camera settings and `uirevision` are preserved.

The post-change trace shows one measured initial `Plotly.react`, no automatic
`Plots.resize`, and no Plotly update on unchanged workspace focus. Real size or
metric changes still update the same mounted graph. Regression tests cover
initial measurement, stable references, single-path resizing and camera retention.

Interaction testing also reproduced a camera-state defect: wheel zoom changed
the live scene but could emit an empty relayout payload, leaving the input
camera stale. A later resize reverted the zoom, and a metric change could restore
the default camera despite unchanged `uirevision`. The sized-layout memo now
reads the live scene camera before a required resize/metric update, only when
the mounted graph has the same run revision. A new run keeps its default view.
This guarded read uses Plotly 4.1.2's internal scene `getCamera()` because the
public event/input layout did not contain the observed zoom state; if unavailable,
the supplied camera remains the fallback. The regression and browser checks
must be retained when upgrading Plotly.

Final production validation used native-headless Edge with 400 mesh nodes and
722 triangles. The surface and colour scale were inspected initially, after
11 seconds without interaction, after a real workspace resize, and after metric
switching with another 11-second observation at each stage. Mouse rotation and
wheel zoom changed the live camera; its orientation and zoom survived resize
and metric changes within 1e-9. The graph remained the same DOM node with zero
purges, zero automatic `Plots.resize` calls and zero lost contexts. Console
output contained no React/WebGL errors; the existing Canvas2D readback-performance
warning was also present before the correction.

The reported spontaneous disappearance itself was **not reproduced** in the
isolated headless browser checks, either before or after this correction. The
surface remained visible after more than 10 seconds without interaction and
after resizing and metric switching. Camera values stayed finite, the graph
remained mounted, and no WebGL context-loss or React errors were observed.
The correction addresses the confirmed redundant rendering lifecycle; it does
not establish that this was the cause of the user's specific blank-mesh event.
The user's desktop browser/GPU context would need to be captured if it persists.
