# Survey axial loads — Stage 2A (preliminary)

Independent engineering engine only. It is not wired into Jar Placement,
Engineering String, existing drilling loads or saved BHA data. No torque,
survey-based jar optimisation or Skeem changes are included.

## Force balance and provenance

The soft-string approach resolves buoyed weight, axial force through curvature,
and Coulomb friction. A publicly accessible engineering derivation is
[Stress-Based Torque and Drag Model, Texas A&M, pp. 5–7 (PDF pp. 15–17)](https://oaktrust.library.tamu.edu/server/api/core/bitstreams/3fab200c-435c-448a-a9de-51c902a02be3/content),
which presents the Johancsik normal-force/friction relationships. The implementation
below expresses that balance in Cartesian vectors to avoid singular azimuth
derivatives near vertical. It is an engineering approximation, not an assertion
that WellBench's existing straight-drag model is a validated torque-and-drag model.

Let s be MD increasing downhole, x = bitMD − s increasing upwards from the bit,
t the downhole unit tangent, k = dt/ds (1/ft), z the downward vertical unit vector,
w the buoyed weight per foot (lbf/ft), and C compression-positive axial load (lbf).
Tension is T = −C. The transverse resultant per foot is

`r = w(z − (z·t)t) − C k`; `n = |r|`.

The wall reaction is −r. Gravity normal magnitude is w sin I; curvature normal
magnitude is |C| |k|. **Do not add their magnitudes**: their directions matter.
In a planar build (I increasing downhole), n = |w sin I + C dI/ds|.
The signed force follows equilibrium of upper/lower end forces and gravity.
For downward drilling, friction is upward: `dC/dx = −w cos I + μ f n`.
Slide f = 1. Rotate f = ROP/hypot(ROP, π OD RPM × 5), with OD inches,
ROP ft/hr, RPM rev/min, matching the existing straight-drag velocity convention.
There is no pickup/tripping or static-friction mode.

Within each minimum-curvature interval, k comes from its analytic rotating
tangent. Gravity is integrated exactly as w times the interval's TVD difference.
Normal force is midpoint quadrature using the mean of bottom/top C; solve the
implicit midpoint balance by bounded fixed-point iteration. Subdivide at every
survey boundary, component boundary and jar centre, plus maximum step length.
Limit each step to 0.05 rad dogleg, so μ f |k| h/2 ≤ 0.025 for μ ≤ 1;
this bounds the midpoint iteration's contraction. Maximum 100,000 elements and
40 iterations/element prevent unbounded work. Convergence tolerance is
1e-9 + 1e-12 max(|Cbottom|,|Ctop|) lbf. Results should be checked by step refinement.

## API, inputs and outputs

`calcSurveyAxialLoads({ bha, survey, bitMdFt, wobLbf, mudWeightPpg,
buoyancyFactor, mode, frictionCoefficient, rpm, ropFtHr, maxStepFt })`.
`survey` is a valid `calculateSurveyGeometry()` result. BHA rows are bottom-up,
using existing `calcComponentPositions()`; length is ft and weight is air lbf/ft.
All populated rows require identity, positive length and explicit nonnegative
weight. Rotate also requires OD > 0. No tubular dimensions or weights are guessed.
WOB (lbf), bit MD, mode and friction coefficient are explicit operating inputs;
the solver does not silently read drilling inputs from BHA fields.
Specify exactly one of mudWeightPpg or buoyancyFactor. Mud uses the existing
65.5-ppg steel-density buoyancy calculation; explicit BF supports other declared
material assumptions. Require 0 < BF ≤ 1. Rotate requires RPM ≥ 0 and ROP > 0.
Default maxStepFt = 5 is a numerical setting, not a physical input assumption.
The entire BHA must be inside survey coverage; no extrapolation or partial BHA.

Return `valid/status/errors/warnings`, nodal `profile`, interval `elements`,
component endpoint loads, all interpolated `neutralPoints`, `neutralIntervals`,
`neutralStatus`, `jars`, total normal contact and axial friction forces, buoyancy
factor and bit/top loads. Forces are lbf; distances/MD are ft. Each element audits
gravity, gravity-normal and curvature-normal magnitudes, actual contact magnitude,
wall-reaction vector and axial friction (magnitude and signed downhole value).
Station/element endpoint zero crossings are linearly interpolated in calculated
axial force, deduplicated at shared boundaries. An identically neutral element is
reported as an interval, not a unique NP. `neutralStatus = none-within-bha` is
explicit when there is no crossing. Jar positions use the existing component
**centre** and have one separation for each NP, positive when jar is above NP.
Separations are null when no isolated NP exists; neutral intervals are retained.
Loads within 1e-8 lbf are treated as zero for crossing classification only;
reported force values are not rounded or changed by that tolerance.

## Independent references defined before implementation tests

1. Vertical: 200 ft at 200 lbf/ft, mud 10 ppg, WOB 10,000 lbf. BF = 111/131;
   w = 169.465648854962 lbf/ft. Top C = −23893.1297709924 lbf;
   NP = 59.009009009009 ft above bit. Straight vertical n = friction = 0.
2. Constant 60°: 100 ft at same weight/mud, WOB 30,000 lbf, μ = 0.25.
   Gravity = w×100×0.5; normal = w×100×√3/2; friction = 0.25×normal;
   Ctop = WOB − gravity + friction. Rotate multiplies friction by the independently
   calculated velocity fraction. Straight results must match the existing solver.
3. Massless circular arc: explicit zero weight, 1000 ft, 30° dogleg, WOB
   10,000 lbf, μ = 0.25. Positive C gives dC/dx = μκC, so
   Ctop = 10000 exp(π/24) = 11398.534413238314 lbf. This is an analytic numerical
   limit for validation, not a physical massless-BHA recommendation.
4. Weighted planar build: length 1000 ft, κ = π/6000 rad/ft, Ibit = 60°,
   w = 100 lbf/ft (explicit BF = 1), WOB = 200,000 lbf, μ = 0.25.
   Compression remains positive. With I(x) = Ibit − κx, define
   P(I) = w/[κ(1+μ²)] [2μ cos I + (1−μ²) sin I].
   Exact solution: C(x) = P(I(x)) + [Cbit − P(Ibit)] exp(μκx).
   Validate at 1000 ft and demonstrate second-order step-size convergence.
5. Curved frictionless case: Ctop = WOB − w ΔTVD exactly regardless of step size;
   midpoint curvature remains nonzero where C ≠ 0. Test signed reinforcement/
   cancellation, three-dimensional turns and azimuth wraparound.

Tolerances established before tests: straight loads 1e-7 lbf, straight NP 1e-8 ft;
massless/weighted curved top-load errors at 5-ft steps < 0.01/< 0.1 lbf;
halving a uniform step should reduce smooth-arc load error by about four
(test ratio 3.5–4.5). Continuity is exact at stored shared nodes.

## Calculated validation results

Vertical top load: −23893.129770992 lbf; NP 59.009009009 ft above bit;
normal and friction forces exactly zero. Constant-60° Slide: gravity
8473.282442748 lbf, normal contact 14676.155697721 lbf, axial friction
3669.038924430 lbf, top load 25195.756481682 lbf, within 1e-7 lbf of
the independent reference. Slide/Rotate straight surveys also agree with
the existing straight-drag solver within 1e-7 lbf.

| Max step (ft) | Weighted build top C (lbf) | Absolute error (lbf) | Massless arc top C (lbf) | Absolute error (lbf) |
| --- | --- | --- | --- | --- |
| 20 | 172490.915733769 | 0.144675508 | 11398.535265443 | 0.000852205 |
| 10 | 172491.024240443 | 0.036168835 | 11398.534626289 | 0.000213051 |
| 5 | 172491.051367074 | 0.009042204 | 11398.534466501 | 0.000053263 |
| 2.5 | 172491.058148727 | 0.002260551 | 11398.534426554 | 0.000013316 |

Expected weighted build top C = 172491.06040927785 lbf. Both sequences reduce
error by approximately four on each halving, consistent with second order.
The 5-ft weighted run has 200 elements, summed normal contact
169587.016553900 lbf and axial friction 42396.754138475 lbf. These are integrals
of contact-force magnitudes, not net Cartesian reaction. Shared-node loads are
continuous exactly. Frictionless curved total axial gravity is independent of
step size within 1e-7 lbf; signed curvature/gravity cancellation and orthogonal
contact contributions in a horizontal azimuth turn are separately tested.

## Limitations

Quasi-static imposed-centreline soft string, no bending stiffness, buckling,
clearance/contact redistribution, stabiliser mechanics, dynamic effects,
hydraulics/pressure-end loads or survey uncertainty. Uniform weight per component;
no undocumented approximation to missing geometry. Compression is propagated
on the imposed centreline, so it is not a physically validated prediction of a
buckled compressed BHA. Contact side may switch through cancellation. Midpoint
normal-force quadrature and linear NP interpolation require refinement studies,
especially at side switches/zero crossings. Mud-based buoyancy assumes steel
65.5 ppg and identical internal/external fluid. Preliminary, not operational guidance.
