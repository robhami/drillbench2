# Depth-dependent drillpipe deployment — synthetic validation

This synthetic study is not field data or an operational recommendation.

## Policy and independent expectations

Component rows retain their existing bottom-up order. Exactly one uppermost
`DP` section may have a variable deployed length. All lower components,
including HWDP, stabilisers, collars and jars, remain fixed. Multiple DP sections
or tools above DP are rejected rather than sharing length changes arbitrarily.
Strings without DP retain fixed-length analysis. Fixed tools must be fully below
the surface reference; shallow samples are rejected, not shortened.

Surface reference defaults explicitly to MD 0 ft in the run UI/API. For fixed
lower-string length 965 ft, independently subtracting gives:

| Bit MD (ft) | Fixed lower string (ft) | Deployed DP (ft) | Top MD (ft) |
| --- | --- | --- | --- |
| 3,320 | 965 | 2,355 | 0 |
| 5,000 | 965 | 4,035 | 0 |
| 12,000 | 965 | 11,035 | 0 |

Expected length tolerance: 1e-9 ft. Jar centre in this study is 175 ft above bit
(160-ft lower DC, 30-ft jar, 775-ft upper DC), independent of DP length. Jar MD
must therefore be 3,145, 4,825 and 11,825 ft respectively.

For a vertical survey, BF=1, WOB=10,000 lbf, all fixed components at 100 lbf/ft
and DP at 20 lbf/ft, the independent top loads are -133,600, -167,200 and
-307,200 lbf. Jar load is -7,500 lbf and NP is 100 ft above bit in every case:
positive means compression, negative tension. Clearance is 75 ft. Gravity is
the only contribution in a straight vertical well; normal force/friction are zero.
Expected force tolerance: 1e-6 lbf. Stage 2A and neutral-point equations are reused
unchanged; tests also compare curved-well Slide/Rotate results directly.

## Fixed-length comparison

With a saved 11,035-ft DP, the saved total string is 12,000 ft. Fixed analysis
at MD 3,320 or 5,000 ft requires geometry above MD 0 and is invalid. At MD
12,000 ft it agrees with deployed analysis. Depth-dependent analysis covers all
three depths using the actual downhole string and no survey extrapolation.
At MD 965 ft DP is zero and omitted from the temporary solver string; below
965 ft the fixed tools cannot be fully deployed and the scenario is invalid.
A survey starting below the surface reference genuinely lacks coverage and
remains invalid. An explicit alternate surface MD can be supplied, without
extrapolating the survey above that datum.

## Persistence and other analyses

BHA Builder adds optional `lengthMode` (`auto`/`manual`) on DP rows and optional
`drillpipeReferenceBitMdFt` on the BHA. Legacy rows default to Manual. Auto shows
a responsive reference-depth preview and does not replace `row.length`; switching
back to Manual restores the original editable value. An absent reference is an
error, never an assumed depth. Existing spread/JSON save/load/duplicate paths
preserve these optional fields without migration or layout reset.

Run analysis independently activates depth-dependent DP for conventional strings,
including legacy/manual rows. It never edits BHA rows, imported surveys or storage.
Scenario metadata records actual DP/fixed lengths and surface reference. The
inspection profile reconstructs the same deployed string. Input changes explicitly
mark results stale; BHA/survey changes clear them. Existing drilling, Engineering
String, Skeem and configuration analyses continue using stored lengths, as the
Builder notice states; this feature does not silently reconfigure those models.

This is a geometric deployment adapter, not a pipe inventory, telescoping-tool,
surface-string, multiple-pipe-grade deployment or partial-fixed-tool model.

## Verified results

Automated calculations match all three independent length, jar MD, top-load,
neutral-point and clearance expectations above at the stated tolerances. The
fixed-length comparison is invalid at 3,320 and 5,000 ft and valid at 12,000 ft.
Curved-well Slide and Rotate scenarios exactly match direct Stage 2A calls using
equivalent temporary strings. Non-mutation, fractional-length surface coverage,
zero DP, unsupported ordering, shallow depth, and legacy/Auto/Manual persistence
checks pass. Complete suite: 440 tests across 28 suites.

A production Chrome check confirms responsive reference-depth previews (2,355
and 4,035 ft), restoration of the 11,035-ft manual value, default run start at
965 ft, matching deployed inspection profiles at MD 3,320 and 5,000 ft, explicit
stale results after a surface-reference edit, unchanged storage during run
analysis, and no page errors. Production build and targeted lint pass with only
existing project warnings.
