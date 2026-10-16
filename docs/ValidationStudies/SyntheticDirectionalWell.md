# Synthetic directional well — survey Stage 1

This is reproducible **synthetic data, not field data**. Import
`SyntheticDirectionalWell.csv`, explicitly confirming feet and degrees.
Azimuth is 90° throughout. Inclination is measured from vertical.
Stations are 500 ft apart in the vertical/tangent sections and 100 ft apart
in the build section; all section boundaries are included (41 stations).

## Independent reference values established before the implementation tests

The build is a circular arc with curvature k = (3π/180)/100 = π/6000 rad/ft
and radius R = 6000/π ft. Let θ = k(MD − 3000) in the build section.
TVD = 3000 + R sin θ and Easting = R(1 − cos θ).
For MD ≥ 5000, add (MD − 5000)cos60° to TVD and
(MD − 5000)sin60° to Easting. Northing is zero.

| MD (ft) | Analytical TVD (ft) | DLS in preceding section (°/100 ft) |
| --- | --- | --- |
| 3000 | 3000.000000000 | 0 |
| 5000 | 4653.986686265 | 3 |
| 12000 | 8153.986686265 | 0 |

Acceptance tolerances, chosen before tests: absolute coordinate error ≤ 1e-7 ft;
DLS error ≤ 1e-9 °/100 ft. These tight tolerances test numerical geometry
against an exact synthetic arc; they do not imply field-survey accuracy.
The same analytical expressions validate intermediate depths and section boundaries.

## Geometry and interpolation convention

For unit tangent u = (sinI cosA, sinI sinA, cosI), in North/East/Down order,
β = atan2(|u0 × u1|, u0 · u1). DLS = β(180/π)100/ΔMD.
Minimum-curvature station displacement is ΔMD(u0 + u1)RF/2,
where RF = tan(β/2)/(β/2), with RF = 1 at zero dogleg.
This is the conventional arc correction described in
[Petra's minimum-curvature documentation](https://onlinehelp.ihs.com/Energy/Petra/2022/Content/main_locations_Computes_MinimumCurvature.htm),
which cites Taylor et al., SPE 2262 (1971).

Within an interval, the tangent rotates along the shortest great-circle arc at
constant angular rate per MD. The position integrates that tangent analytically;
it is not linear interpolation of TVD or wrapped azimuth angles. Zero-dogleg
intervals are straight. Azimuth wraparound is handled through unit vectors.
At a vertical interpolated point, azimuth is undefined physically and the
preceding station's azimuth is reported. Exact station queries retain the
imported inclination and azimuth (including 360°).

Coordinates start at (0,0,0) at the first station. If its MD is not zero,
TVD/N/E are relative to that station, and a warning identifies the unknown
unsurveyed interval. There is no extrapolation or assumed vertical tie-in.
Antipodal tangents (180° dogleg) are rejected because they do not define a
unique arc plane. Near-antipodal intervals are also rejected within 1e-8 rad
to avoid ill-conditioned geometry. Minimum curvature assumes a smooth arc
between stations and cannot recover unmeasured tortuosity, survey uncertainty,
datum/grid corrections or azimuth reference. Local Cartesian coordinates only.

## Import and separation from existing engineering

`parseSurveyCsv(text, { mdUnit: 'ft', angleUnit: 'deg' })` requires explicit
units. Supported header aliases include MD/Measured Depth, Inc/Inclination,
and Azi/Azimuth, optionally labelled with ft/feet and deg/degrees/°.
Explicit incompatible unit labels are rejected. Original CSV text and decoded
CSV field strings are retained separately from validated numeric stations.
Blank lines are ignored; diagnostics use physical source line numbers.

`calculateSurveyGeometry(stations)` returns stations, interval geometry and a
summary; `evaluateSurveyAtMd(geometry, mdFt)` evaluates within coverage or
returns a structured error. Neither API mutates input stations.
The independent Survey window persists source CSV under `wellbenchSurveyV1`,
separate from BHA data and workspace layouts. It does not feed survey geometry
into existing axial-load, jar or neutral-point calculations. No torque/drag
or jar optimisation is implemented. This is preliminary geometry validation,
not operational guidance.

## Validation outcome

The automated minimum-curvature results are 3000.000000000,
4653.986686265 and 8153.986686265 ft TVD at MD 3000, 5000 and 12000 ft,
respectively, agreeing with the independent reference within 1e-7 ft.
All 20 build intervals have DLS 3°/100 ft within 1e-9; vertical and tangent
intervals have zero DLS. End Easting is 7017.107485042 ft and Northing is zero
within coordinate tolerance. Intermediate and near-boundary queries also match
the independent arc/straight-line expressions. Summary maximum inclination is
the maximum imported station inclination, not an estimate of unmeasured peaks.

The production UI was checked in Chrome: explicit unit confirmation, import
of all 41 stations, resize from 720 to 362 px, close/reopen and reload retained
the source survey. Existing BHA storage was unchanged and no page errors occurred.
Files above 2 MB are explicitly rejected by the UI; the standalone parser has
no file-size restriction. No survey uncertainty or field-data validation is claimed.
