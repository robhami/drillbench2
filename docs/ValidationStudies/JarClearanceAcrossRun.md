# Jar clearance across a drilling run — Stage 2B

Standalone preliminary sampled analysis; no production Jar Placement integration.
The unchanged Stage 2A solver is the force/NP source of truth. One BHA is used
throughout: no component, survey or saved-data mutation, no survey extension.

## API and references

`calcJarClearanceAcrossRun({ bha, survey, startBitMdFt, endBitMdFt,
depthIncrementFt, minWobLbf, maxWobLbf, wobSamples, modes,
frictionCoefficients, frictionCoefficient, mudWeightPpg, buoyancyFactor,
rpm, ropFtHr, maxStepFt, avoidanceDistanceFt, maxScenarios })`.
Survey is an existing minimum-curvature geometry result. Operating inputs and
units follow Stage 2A: WOB lbf, MD/distances ft, RPM rev/min, ROP ft/hr, mud ppg.
Specify frictionCoefficients (array), or one frictionCoefficient, not both.
Other missing physical inputs are reported by the Stage 2A solver, not invented.
Modes may be `slide`, `rotate`, `both`, or an array; default is Slide only.
Default numerical sampling: 100-ft depth increments, 5 WOB samples, 2000-scenario
cap (configurable downwards/up to hard cap 5000). No large grid is allocated
or evaluated before checking its complete depth×WOB×mode×friction size.

Depth sampling includes both ends, using the requested increment and a shorter
final interval if needed. WOB is uniformly sampled including both limits;
a nonzero WOB range needs at least two samples. Equal limits collapse to one
sample. Modes/friction values are deduplicated and ordered Slide then Rotate,
and ascending friction. Output ordering is depth, WOB, mode, friction, with jars
in original bottom-up component order. Exact clearance ties choose the first
configuration in this order. No interpolation of invalid samples.

Positive axial load means compression; negative means tension. Distances above
bit follow the existing component-position utility. Jar position means **centre**;
jar MD = bit MD − centre above bit. For each isolated NP, signed separation
is J − NPaboveBit, positive when jar is above NP. Nearest selection uses absolute
separation and retains all crossings, not just the first. Zero-force tolerance
is 1e-8 lbf; coincidence/distance tolerance is 1e-6 ft.

The default avoidance band is the existing **[0.8J, 1.2J]** convention in distance
above bit. An explicit avoidanceDistanceFt instead defines [J−d, J+d], clipped
to zero at the bit. Bands are not clipped at BHA top; only actual neutral sets
inside the BHA are considered. Boundaries are inclusive with 1e-6-ft tolerance.
This only checks geometry against calculated neutral positions; it does not
reuse the straight-hole WOB inversion or assume WOB is additive in curved loads.

Neutral intervals are retained as intervals, not invented unique crossings.
Their nearest position is the geometric projection of jar centre onto that set.
The result identifies `kind: interval`, its bounds and zero isolated-point count.
Band intersection is checked for the whole interval. No NP/interval means
`no-neutral-within-bha`, null clearance, and a separately reported jar load state;
it is **not automatically safe**. Unsupported/out-of-coverage scenarios are
invalid with original solver errors. The complete BHA must fit within coverage.

## Outputs and crossing interpretation

Each scenario includes bit MD, WOB, mode, friction, validity/errors/warnings,
all neutral points/intervals, and all jars with centre MD/above-bit distance,
axial load/state, nearest neutral set, signed/absolute clearance and avoidance
status. Return valid/invalid scenario counts, minimum sampled valid clearance,
worstCase (including jar/mode/WOB/depth/friction), depth-by-depth minimum-clearance
envelope, and crossingEvents. No-NP scenarios remain valid calculations but do
not contribute a fictitious clearance to the minimum.

Sampled coincidence events use calculated NP positions at an evaluated scenario;
sampled neutral intervals containing a jar are separately labelled. Inferences
between adjacent valid depth samples at fixed WOB/mode/friction, and adjacent
WOB samples at fixed depth/mode/friction, are based on a **jar axial-load sign
change**, never a jump in which NP happens to be nearest. Approximate crossing
coordinates use linear interpolation of jar load and are labelled inferred,
with `refinementRequired: true`. Invalid samples break inference chains.
No inference across different modes/friction coefficients, no promise to catch
multiple crossings between samples, and no continuous-run safety claim.

## Independent validation references established before tests

Vertical 200-ft BHA at air weight 100 lbf/ft, explicit BF=1, jar centre J=60 ft:
NP = WOB/100. WOB 4000/6000/8000 lbf gives NP 40/60/80 ft; signed separations
+20/0/−20 ft and jar loads −2000/0/+2000 lbf. Default band is 48–72 ft:
only the middle sample is inside. Minimum sampled clearance is exactly zero;
ties across vertical depths choose the first depth (300 ft in the test run).
WOB 30000 lbf has no NP in this BHA, jar compression +24000 lbf and null
clearance, not a safe classification. WOB=0 yields a bit NP and jar tension.

Constant 60°: same weight/BF and J=60, μ=0.25. Slide net axial reduction per ft
is q=100(cos60−0.25sin60)=28.349364905389 lbf/ft.
With WOB 3000 lbf, NP=105.822476447425 ft, separation −45.822476447425 ft,
jar compression 1299.03810567666 lbf. Rotate uses the independently evaluated
existing OD/RPM/ROP fraction in q. Acceptance: 1e-7 lbf load, 1e-7 ft distance.

Synthetic 12,000-ft well from Stage 1: compare each sampled build/tangent scenario
against direct Stage 2A calls. Independent tangent cases use the same constant-60°
formula; vertical depths use WOB/w. This validates sweep mapping without
claiming new field validation of the soft-string equations. Additional tests
cover multiple NPs, neutral intervals, invalid coverage, inferred crossings,
scenario caps, deterministic minima/envelope and frozen input non-mutation.

## Calculated results

The vertical reference produces 9 valid scenarios (3 depths × 3 WOB values),
0 invalid, 3 sampled coincidence events, and minimum clearance 0 ft at bit
MD 300 ft / WOB 6000 lbf / Slide. Its depth envelope is [0,0,0] ft.
The two-WOB variant (4000/8000 lbf only) has minimum sampled clearance 20 ft,
with an **inferred** WOB crossing at approximately 6000 lbf; it does not claim
that 0-ft clearance was actually sampled. The constant-60° Slide result agrees
with the independent reference within 1e-7 ft/lbf; Rotate agrees with its
independently calculated velocity fraction and direct Stage 2A calls.

Synthetic directional run: same 200-ft BHA at 100 air lbf/ft, explicit BF=1,
jar centre 60 ft, OD 8 in, μ=0.25, Rotate RPM 40 and ROP 200 ft/hr.
Bit MD 4900/5100/5300 ft, WOB 4000/6000/8000 lbf, both modes: 18 valid,
0 invalid scenarios, no detected sampled or inferred jar/NP coincidences.
Minimum sampled clearance = **12.451090249 ft**, at MD **4900 ft**, WOB
**4000 lbf**, **Rotate**. NP is 72.451090249 ft above bit, signed separation
−12.451090249 ft, jar MD 4840 ft, jar compression +703.901984125 lbf.
The NP lies just outside the default 48–72-ft band; this is not a safety claim.
The depth envelope is [12.451090249, 21.401357429, 21.401357429] ft.
The 5300-ft / 4000-lbf Slide tangent result has NP 141.096635263 ft above bit,
agreeing with the independent constant-60° formula. Every scenario also agrees
exactly with a direct call to the unchanged Stage 2A solver.

The sampled worst case is only the minimum in this declared grid; finer depth,
WOB or element-size sampling may reveal smaller clearance. Negative WOB (an
entirely tensioned bit boundary) remains unsupported by Stage 2A and is rejected;
the analysis does not invent a neutral point for unsupported inputs.

## Applicability

All Stage 2A limitations apply: quasi-static imposed-centreline soft string;
no buckling, bending stiffness, clearance/contact redistribution, hydraulics,
dynamics or survey uncertainty. A sampled clearance is an engineering-screening
metric, not field-placement guidance. Refine depth, WOB and solver element size
where proximity or inferred crossings warrant investigation.
