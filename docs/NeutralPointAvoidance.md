# Neutral Point Avoidance Zone

Preliminary engineering screening only; not for operational guidance. The
user-defined band is 0.8–1.2 times each jar's centre distance above the bit.
The 20% criterion is a requested screening rule, not a validated manufacturer
placement limit.

## Calculation provenance

The solver reuses `calcStraightDrag` and its existing additive WOB boundary
condition. With fixed BHA and drilling inputs, `F(x, WOB) = F(x, 0) + WOB`
in lbf. Linear interpolation of the zero-WOB component's calculated bottom
and top forces gives `WOB_required = -F(x, 0)`; divide by 1000 for klbf.
Each solution is checked through `calcStraightDrag` and
`calcNeutralPointFromLoadProfile`. Neither underlying equation is changed.
The band includes both endpoints. Non-negative WOB, a boundary within the
modelled string, and a unique decreasing load profile through the zone are
required. Missing/unreachable boundaries, earlier zero crossings and flat or
non-monotonic bands do not produce a WOB interval. Numerical zero uses 1e-9
lbf to reject trigonometric roundoff in effectively horizontal flat cases;
forward position verification uses 1e-6 ft.

## Validation Test 3

Inputs: 45 degrees inclination from vertical; 10 ppg mud; friction coefficient
0.25; 40 RPM; 200 ft/hr ROP; current WOB 10 klbf. From the bit upward:
DC 160 ft at 200 lb/ft, OD 9.5 in; JAR 30 ft at 150 lb/ft, OD 8 in;
DC 40 ft at 200 lb/ft, OD 8 in. The last two ODs retain the existing fixture
values. Jar centre is 175 ft, so the boundaries are 140 and 210 ft.

Independent arithmetic uses BF = 1 - 10/65.5. At 140 ft, integrated air
weight is 28,000 lbf. At 210 ft, it is 32,000 + 4,500 + 4,000 = 40,500 lbf.
Reference resolves these by BF*cos(45); Slide additionally multiplies by
0.75. Rotate sums each segment separately using its OD, with axial friction
share `200 / sqrt(200^2 + (PI*OD*40*5)^2)`.

| Mode | WOB at NP 140 ft (klbf) | WOB at NP 210 ft (klbf) | NP at current 10 klbf (ft) |
|---|---:|---:|---:|
| Reference | 16.77624333 | 24.26563767 | 83.45134084 |
| Slide | 12.58218250 | 18.19922825 | 111.26845446 |
| Rotate | 16.63579467 | 24.05450607 | 84.15588362 |

Automated tests compare against independent arithmetic and verify each WOB
limit reproduces the requested NP through the production calculation path.
Current 10 klbf WOB is outside the band in all three modes. These checks are
not independent published benchmark or field validation.
