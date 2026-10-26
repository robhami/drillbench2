# Stage 4C: surface-to-jar buckling screening

## Formulation selected before implementation

The implemented idealization is a long, initially straight, uniform, elastic
circular tubular in a straight circular inclined bore, without applied torque.
It is a local, frictionless-onset comparison, not a finite-length eigenvalue
solution. The caller must explicitly confirm this idealization for each component
(`bucklingIdealizationConfirmed: true` on its BHA row). Confirmation is not saved
or inferred by this module. Jar bodies, stabilisers, connections and other
nonuniform tools must not be confirmed without an appropriate equivalent model.

Published formulations:

- Dawson and Paslay, *Drillpipe Buckling in Inclined Holes*, JPT (1984),
  [doi:10.2118/11167-PA](https://doi.org/10.2118/11167-PA):
  sinusoidal onset `Fs = 2 sqrt(E I w sin(theta) / r)`.
- Chen, Lin and Cheatham, *Tubing and Casing Buckling in Horizontal Wells*,
  JPT (1990), [doi:10.2118/19176-PA](https://doi.org/10.2118/19176-PA):
  energy-based helical criterion `Fh = sqrt(2) Fs`.
- The inclined straight-tube forms are also stated in Liang et al.,
  *Critical helical buckling load assessment of coiled tubing under axial force
  by use of the explicit finite-element method* (2018),
  [doi:10.1016/j.petrol.2018.05.053](https://doi.org/10.1016/j.petrol.2018.05.053),
  equations (1)-(2). Only its straight-tube analytical reference is used here,
  not its initially curved coiled-tubing results.

Helical criteria depend on loading and boundary assumptions; this is a named
model comparison, not a universal physical transition. See the independent
boundary-condition study [PLOS ONE (2016)](https://doi.org/10.1371/journal.pone.0162741).
Finite-length, end-restraint, frictional stability and nonuniform loading effects
are not resolved by this asymptotic model. A short integration element is not
treated as an independently pinned beam. Component length is reported, but no
unsupported length cutoff or end condition is invented.

Units: `E` psi, `I = pi (OD^4-ID^4)/64` in^4, `EI` lbf in^2,
`w = buoyedWeightPerFt/12` lbf/in, `r = (holeDiameter-OD)/2` inches;
theta is inclination from vertical, converted from degrees. Thresholds are lbf.
Compression is positive; tension is never converted to compression.

The supported geometric domain is **straight**, `0 < theta <= 90 degrees`,
positive buoyed weight and positive radial clearance. Any nonzero minimum-
curvature dogleg is excluded. Vertical sections are excluded: substituting
`sin(theta)=0` would give a spurious zero threshold rather than a justified
vertical-string solution. Curved/build/drop/turn sections and over-horizontal
sections are Not Evaluated. No interpolation between vertical, inclined and
curved criteria is used. Near-vertical use remains conditional on the caller's
long-tubular idealization; no universal inclination cutoff is asserted.

## Boundary and data contract

`calcJarDownBuckling` calls `calcStaticJarLoads` with slack-off friction and its
existing absolute or reference surface-hookload boundary. Existing force
elements already split at component and survey boundaries. Only surface to
selected jar centre is examined. Below-jar loads are neither computed nor
extrapolated; the existing lower-assembly reaction assumption is retained.
The force profile is the pre-buckling soft-string solution. Friction remains
in that load calculation, but the onset thresholds are frictionless: there is
no post-buckling friction, contact redistribution or coupled stability solution.

Geometry and deployment use the existing deployment and position utilities.
Required row inputs are `od`, `idSize`, `length`, `weight` and explicit
`youngsModulusPsi` (or a caller-supplied `youngsModulusPsi` shared by rows lacking
one). No Skeem modulus is read. Explicit `wellboreDiameterIn` is required; the
existing `bha.holeSize` may supply it. OD is never a hole-diameter fallback.
Invalid explicit values do not fall back. Missing/invalid data produce
Unavailable intervals with named inputs, never acceptable classifications.

Each force element reports both end loads and their maximum compression.
For supported straight homogeneous elements, existing end loads are linearly
interpolated to locate the first threshold exceedance from surface downhole.
These are spatial onsets under the supplied load, not a limiting Jar Down force.
Both sides of each component boundary are retained, including any threshold
jump. Maximum utilizations concern only applicable intervals. Partial coverage
cannot establish stability of the entire string. Tension/zero compression are
reported explicitly; unsupported geometry still remains Not Evaluated.
`mdFt` and `axialForceLbf` are the actual downhole end sample, not an interpolated
curved-section force. Curvature is that of the enclosing one-sided survey
interval. `valid` means the requested screening pass and underlying static
solution completed; consumers must also inspect `status`, each `applicability`
and `summary.completeCoverage`. It never means that the string is stable.

## Independent analytical benchmarks

Use OD=1 in, ID=0 in, E=64/pi psi, buoyed weight=12 lbf/ft and
hole diameter=3 in. Then EI=1 lbf in^2, w=1 lbf/in and r=1 in:

| Case | Expected sinusoidal / helical threshold (lbf) or exclusion |
|---|---|
| Straight 30 degrees | sqrt(2) / 2 |
| Horizontal | 2 / 2 sqrt(2) |
| Vertical | Not Evaluated; no vertical formulation implemented |
| Build or azimuth turn | Not Evaluated; nonzero curvature |
| Zero compression | No compression; no onset |
| Tension | No compression; never absolute-valued |
| Missing hole diameter | Unavailable; wellboreDiameterIn named |
| Missing modulus | Unavailable; youngsModulusPsi named |
| Hole <= OD | Unavailable; no positive radial clearance |
| Double modulus | Both thresholds multiply by sqrt(2) |
| Fourfold radial clearance | Both thresholds halve |
| Different components | Independent EI/clearance; continuous axial force |

The deliberately small benchmark modulus is explicit mathematical test data,
not a material recommendation. Additional tests check psi/in/ft conversions,
buoyancy, deployment, nonzero surface MD, selected jar, and threshold crossing
interpolation against independent straight-well force balances.

Numerical checks (expected and calculated agree within the automated tolerances):

| Quantity | Expected | Calculated |
|---|---:|---:|
| 30-degree sinusoidal threshold, lbf | 1.414213562 | 1.414213562 |
| 30-degree helical threshold, lbf | 2.000000000 | 2.000000000 |
| Horizontal sinusoidal threshold, lbf | 2.000000000 | 2.000000000 |
| Horizontal helical threshold, lbf | 2.828427125 | 2.828427125 |
| 5-in OD / 4-in ID, 30-million-psi E, horizontal Fs, lbf | 46621.769778 | 46621.769778 |
| Same geometry Fh, lbf | 65933.139121 | 65933.139121 |
| First sinusoidal onset MD, ft (case below) | 11.404716249 | 11.404716249 |
| First helical onset MD, ft (case below) | 11.470591908 | 11.470591908 |

The realistic-size geometry uses 12 lbf/ft buoyed weight and a 7-in bore;
the threshold is independently evaluated in SI and converted back to lbf.
The spatial-onset benchmark uses the EI=1 30-degree case, 100-lbf surface
hookload and mu=0.25. Independently, `C(s) = -100 +
12*(cos(30 degrees)-0.25*sin(30 degrees))*s`, so the expected crossing is
`s = (100 + threshold)/8.892304845413264`. These are synthetic analytical
verification values, not a field operating case.

## Execution results

- Full suite: 41 suites / 687 tests passed, including 33 new buckling tests.
- Production build: passed; existing lint warnings in UnitCon, UnitsDrop,
  NavPill and basicBHACalcs remain unrelated to this module.
- Working-tree and new-file whitespace diff checks: passed.
- Existing Stage 4A, Stage 4B, Test 4, inverse-load and Skeem regressions pass.

## Limitations

Analytical regression tests are not field validation. This module does not
predict failure, yield, lockup, post-buckling configuration, firing success,
impact/energy/delay, rig capacity, or a maximum safe Jar Down force. Unsupported
intervals must remain visible to downstream consumers. No UI or saved inputs
are changed in Stage 4C. Preliminary engineering analysis, not operational
guidance.
