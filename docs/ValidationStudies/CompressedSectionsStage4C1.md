# Stage 4C.1: continuous compressed sections

## Scope and source of truth

`identifyCompressedSections` in `src/engineering/jar/compressedSections.js` calls
the unchanged `calcStaticJarLoads` slack-off branch. It uses that solver's
surface hookload boundary, converged samples, selected jar centre and component
indices. Absolute and reference hookload modes are preserved. The evaluated
interval is explicitly surface reference MD to jar-centre MD; no below-jar
reaction or force is invented. Geometry and component positions come from the
existing minimum-curvature survey and depth-dependent deployment utilities.

This is a sampled load-profile and geometry analysis, not a buckling model.
Existing Stage 4C calculations, inverse solver and all force equations are
unchanged. No UI or saved BHA/survey inputs are modified.

## Load topology

The reusable `identifyLoadRegions(profile, options)` helper accepts finite,
strictly increasing `{mdFt, axialForceLbf}` samples. Positive force is compression,
negative force tension. Its default numerical zero band is +/-1e-8 lbf, matching
the existing static solver's displayed load-state convention. The tolerance is
reported and may be set to zero. Raw loads are never rounded or overwritten.

Opposite nonzero signs produce a piecewise-linear zero at
`MDa + (MDb-MDa)*abs(Ca)/(abs(Ca)+abs(Cb))`; scaled arithmetic avoids force-sum
overflow. Results retain the original sample bracket. Straight homogeneous
elements have linear force under the existing balance. Curved-section zeros
are estimates between calculated samples, not independently refined roots.
Unresolved crossings are rejected rather than merged.

Adjacent positive pieces merge across solver samples, component boundaries and
survey stations. A zero touch separates strictly compressed sections even when
both sides are compressed. A zero plateau has an MD range, not an invented
unique crossing depth. Events distinguish interpolated crossings, sampled
crossings, zero touches, zero boundaries and zero plateaus; numerical-zero
events are identified. All-tension and all-zero profiles return no compression.
Maxima are maxima of the sampled, piecewise-linear profile; unsampled curved
force extrema or additional crossings cannot be established by this pass.

Each interval contains top/bottom MD, compressed length, sampled maximum force
and its MD, relevant zero events, and property/geometry subdivisions. Subdivisions
are not independent buckling specimens. Global output also retains tension and
zero regions and the original static calculation for audit.

## Geometry and tolerances

Labels use 1e-8 degrees for vertical/horizontal proximity and 1e-12 rad/ft for
curvature and build/turn-rate significance. These are explicit numerical
classification tolerances, not applicability limits for a stability equation.
An MD tolerance of 1e-8 ft prevents analytic inclination extrema from creating
roundoff-sized subdivisions beside existing element boundaries. It does not
merge load regions or relocate zero-force crossings.
For the analytic minimum-curvature tangent `t` and derivative `t'`:

- Inclination rate is `-t'z / sin(inclination)`.
- Signed azimuthal curvature is `(tx*t'y - ty*t'x)/sin(inclination)`.
- These avoid subtracting wrapped azimuth angles; azimuth is indeterminate on
  the vertical axis and is not used there to infer a turn.

Curved geometry is build/drop, azimuthal turn, or mixed when both contributions
are significant. Mixed segments retain their individual features. Analytic
inclination extrema split an arc before classification so build/drop reversals
within a station pair are not hidden. Survey stations and component boundaries
remain explicit; same-property solver steps are consolidated. Geometry values
include their representative sample MD, not a claim of constant inclination
throughout a curved section.

`screening.geometricallyEligible` reports the existing Stage 4C geometric domain:
exactly zero curvature and inclination strictly above zero through 90 degrees.
A tolerant straight label never converts nonzero curvature into eligibility.
Material availability and `bucklingIdealizationConfirmed` are separate flags.
Every segment and interval has `fullyEvaluated: false` and
`evaluationStatus: 'not-evaluated'`. Geometry does not establish long-column
assumptions, end conditions, valid wavelength or a safe load. No thresholds are
computed by this module.

## Properties and missing inputs

Properties retain component index, row/tool identifier, full deployed component
length and component MD extent, plus the portion within compression. OD and ID
come from `od` and `idSize`; `I=pi*(OD^4-ID^4)/64`, in^4. EI is lbf in^2 only
when positive explicit modulus is available. Row `youngsModulusPsi` takes
precedence over the optional caller value; no Skeem modulus is read.

Bore diameter precedence is explicit row `wellboreDiameterIn`, caller
`wellboreDiameterIn`, then existing `bha.holeSize`. This permits explicit local
component-associated bore data without creating saved inputs. It is not an
independent wellbore-section model; a bore change inside a component is not
represented. Radial clearance is `(bore-OD)/2`, inches. No bore is inferred from
OD. Invalid explicit values do not fall back; insufficient clearance is named.

Missing/invalid properties do not prevent identification of valid load regions.
They are reported against affected compressed component segments, with null
unknown properties and false input-availability flags. Known EI remains available
when the bore is missing. Transitions report changed values, including changes
to/from unavailable data. Buoyed distributed weight uses the static solver's
buoyancy factor and existing row air weight.

## Independent validation

| Benchmark | Expected |
|---|---|
| Samples -10, +30, -10 lbf at MD 0,10,20 ft | One compressed interval 2.5-17.5 ft; maximum 30 lbf at 10 ft |
| Samples -10,+10,-10,+30,-10 at 10-ft spacing | Two intervals: 5-15 and 22.5-37.5 ft |
| Samples +10,0,+10 | Two positive intervals, zero touch; no sign change |
| Samples -10,0,0,+10 | Zero plateau 10-20 ft; no unique root MD |
| Uniform vertical 100 lbf/ft, 50,000-lbf surface hookload | C(MD)=-50,000+100*MD |
| Same string, jar centre 990 ft MD | Compression starts 500 ft; length 490 ft; maximum 49,000 lbf at jar |
| Vertical/build/tangent stations at MD 200 and 500 ft | One continuous compressed section; geometry transitions at both station depths |
| Missing modulus/bore | Same compressed intervals; missing data remain explicit |
| Auto DP, surface MD 100 ft, fixed BHA 120 ft | Deployed DP = bit MD - 220 ft |

Other regressions cover tension, zero compression, fully compressed synthetic
profiles, component transitions, mixed tubular sizes, horizontal turns across
azimuth wrap, curved build/drop reversals, tolerances, selected jar, buoyancy,
invalid inputs and exact equality with the existing forward-solver profile.
An EI comparison around 1.2e9 lbf in^2 uses relative precision because a binary64
unit in the last place is approximately 2.4e-7 at that magnitude.

These are analytical/software checks, not field validation. Finite-length
stability, vertical/curved buckling criteria, post-buckling redistribution,
lock-up, firing and safe operating limits remain outside Stage 4C.1.

## Execution results

- 30 compressed-section regression tests passed.
- Complete suite: 42 suites / 717 tests passed, including existing Stage 4C,
  Stage 4A/4B, Test 4, inverse solver and Skeem regressions.
- Production build passed with existing unrelated lint warnings in UnitCon,
  UnitsDrop, NavPill and basicBHACalcs.
- Working-tree and new-file whitespace checks passed.
- No files staged, committed or pushed.
