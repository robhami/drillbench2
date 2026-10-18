# String Weight Summary — Jar Forces

The summary updates automatically above the hookload controls in Jar Forces.
It uses the currently selected bit MD, surface reference, jar and panel mud
weight, plus the current BHA and confirmed survey. No hookload, friction input
or separate analysis action is required. It does not run the jar-force solver.

## Sources and definitions

`calcStringWeightSummary` reuses `deployDrillstring` for actual DP length,
`calcComponentPositions` for component positions/air and buoyed weights, and
`evaluateSurveyAtMd` for minimum-curvature TVD. The panel mud value overrides
only a temporary BHA copy; saved rows, stored DP length and saved mud/survey
data are unchanged. Existing axial-load, jar-force and Skeem equations are
unchanged.

All engine results are in lbf; UI values are in klbf. For component i with
uniform air weight per foot q_i and length L_i:

```
BF = 1 - mudPpg/65.5                (existing steel buoyancy calculation)
W_air = sum(q_i * L_i)
W_buoyed = sum(q_i * L_i * BF)
W_below_jar = sum(q_i * BF * clamp(x_jar - x_i_start, 0, L_i))
W_above_jar = sum(W_i_buoyed - W_i_below_jar)
H_frictionless = sum(q_i * BF * (TVD_i_bottom - TVD_i_top))
```

Distances x are measured above bit; x_jar is the selected jar centre. Half the
selected jar weight belongs to each side. Other jars are treated as ordinary
components relative to the selected centre. Above plus below conserves the
total gravitational buoyed weight, independent of inclination.

The hookload expression exactly integrates `integral(q_i*BF*cos(I) ds)` for
each uniform component using the existing survey geometry. It therefore
accounts for curvature even when a component spans several survey intervals;
there is no average-inclination approximation or numerical step setting.

**Total buoyed weight is gravitational magnitude before directional projection.**
**Frictionless free-hanging hookload is axial support along the trajectory**,
assuming zero bit/end load and no wall friction. At an inclined surface
reference it represents local axial support rather than an unconverted vertical
hook reading. **Actual operating hookload is entered or reference-adjusted in
the controls below** and may differ because of friction and operating conditions.
The summary does not select that boundary or replace the Jar Forces assumed
frictionless reference state.

Deployment must extend from the surface reference to the bit and have full
survey coverage. Missing/invalid mud, weights, jar, depth or survey coverage
returns unavailable rather than zero or stale values. The existing single
uppermost-DP deployment policy applies; fixed components are not shortened.

## Independent validation

The small test fixture has 100 ft of DC at 200 lbf/ft, a 20-ft jar at 150,
80 ft of upper DC at 100, and actual deployed DP at 20 lbf/ft. At MD 1000
and surface MD 0, fixed length is 200 ft and DP is 800 ft, regardless of the
saved 99999-ft DP length. Independent air weight is 47000 lbf; air-equivalent
weight below jar centre is 21500 lbf and above is 25500 lbf. Multiply by
BF=111/131 at mud 10 ppg for the gravitational buoyed weights.

- Vertical hookload equals total buoyed magnitude.
- Straight 30/60/90-degree hookloads equal the total buoyed weight times cos(I),
  while above/below gravitational magnitudes stay unchanged. DP is based on MD.
- A nonuniform-weight circular build 0–60 degrees over 1000 ft is checked using
  independently derived `TVD(s)=sin(k*s)/k`, k=pi/3000. Weight contributions
  are calculated separately over DP 0–800, upper DC 800–880, jar 880–900 and
  lower DC 900–1000 ft MD.
- Actual DP is checked at bit MD 200,1000,2000,12000 ft, including zero DP.
- Multiple selected jars verify half-jar weight splits and conservation.
- Nonzero surface reference, invalid coverage/weights, non-mutation and valid
  zero component weights are tested explicitly.

## Test 4 numerical check

At MD 12000 ft using SyntheticDirectionalWell.csv, surface MD 0, mud 10 ppg
and the supplied Test 4 BHA:

| Quantity | Expected and calculated klbf (rounded) |
| --- | ---: |
| Total deployed air weight | 379.559850 |
| Total gravitational buoyed weight | 321.611781 |
| Gravitational buoyed weight above jar centre | 289.746944 |
| Gravitational buoyed weight below jar centre | 31.864838 |
| Frictionless free-hanging axial hookload | 211.471604 |

Independent expectations use fixed air weight 60736.25 lbf and DP air weight
`11485*27.76` lbf. Weight below jar centre is `37606.25*BF` lbf. The DP spans
MD 0–11485, so its exact TVD difference is
`3000 + (6000/pi)*sin60 + 6485*cos60` ft. The fixed lower string lies in the
60-degree tangent. Hence the expected full-string hookload is
`BF*(27.76*DP_deltaTVD + 60736.25*cos60)` lbf.

Tests compare calculated and independent expected weights/hookloads to
1e-7 lbf absolute tolerance and verify full-precision conservation. Display
rounding can affect the last shown digit when summing the two displayed parts.
UI tests confirm immediate changes without calculation clicks and independence
from operating hookload/friction. These arithmetic/geometry checks are not
field validation or operating guidance.

Verification: targeted engineering/UI checks pass (36 tests); the complete
suite passes (549 tests across 34 suites). Production build succeeds with
existing unrelated lint warnings. Diff whitespace checks pass, including
separate checks of the new/untracked files.


## Four-column weight and operating summary

The Jar Forces tables use the compact BHA Data Entry palette and row density.
All calculated UI results show one decimal place; the following audit values
retain six decimals. No intermediate calculations are rounded.

### Input authority and unresolved shared state

| Value | Authoritative source used by Jar Forces |
| --- | --- |
| Mud weight | bha.mudWeight, edited in Analysis Inputs |
| Friction coefficient | bha.frictionCoefficient, edited in Analysis Inputs |
| RPM | bha.rpm, edited in Analysis Inputs; required for rotating prediction only |
| Analysis bit MD | Explicit local Jar Force Input; no shared analysis-depth state exists |
| Selected jar | Local Jar Force Input; Run has a separate local selection |
| Surface reference MD | Explicit local Jar Force Input, initially zero |

Auto DP reference bit MD (bha.drillpipeReferenceBitMdFt) configures the BHA
Data Entry reference deployment. Its existing help distinguishes that reference
from run-analysis depths. It is not silently reused as analysis bit MD. Jar
Forces now starts with analysis depth unset and displays a read-only depth/status
indicator. Mud/friction/RPM are read directly from shared BHA props each render;
there are no stale local copies or invented defaults. Missing shared inputs
produce unavailable results and reasons. Static force transfer needs no RPM.
No shared depth/jar infrastructure or saved-data schema was introduced.

### Partition method

Existing total weights and frictionless hookload calculations are unchanged.
Each component is split at the selected jar centre using its existing measured
length, air weight per foot, buoyancy factor and interpolated survey TVD.
For each partition, air weight = w_air * length, buoyed weight = air weight * BF,
and inclination-corrected axial weight = w_air * BF * deltaTVD.
This is gravitational axial weight, not frictional drag. No friction enters
these partition columns. Above/below rows include half the selected jar each.
Fixed BHA above jar is the subset of the above-jar row excluding category DP;
it includes the selected jar's upper half and any other fixed tools above it.
It is not an additional partition to add to the above/below totals.

At Test 4 TD (MD 12000 ft, surface zero, mud 10 ppg, one DP deployed to
11485 ft), independent arithmetic and calculation agree:

| Component | Air klbf | Buoyed klbf | Axial klbf |
| --- | ---: | ---: | ---: |
| Total deployed string | 379.559850 | 321.611781 | 211.471604 |
| Entire string above jar centre | 341.953600 | 289.746944 | 195.539185 |
| Entire string below jar centre | 37.606250 | 31.864838 | 15.932419 |
| Fixed BHA above jar, excluding DP | 23.130000 | 19.598702 | 9.799351 |

The fixed-above air weight is 180*116 + 15*150 = 23130 lbf. Its axial
projection and the below-jar projection are cos(60 degrees) times buoyed weight.
The above-jar axial value adds the independently integrated DP contribution.
Full-precision above/below sums reconcile with the totals; separately rounded
UI values can differ by 0.1 klbf when added.

The four-column operating table preserves zero-bit-load off-bottom predictions:
pickup 297.672099, rotating 211.471604, slack-off 154.503686 klbf; pickup drag
86.200495 and slack-off drag 56.967918 klbf. Rotating axial drag is zero under
the existing pure-rotation model assumption. Direction denotes motion, with
opposing friction direction documented in each mode tooltip. Surface-hookload
boundary calculations in the separate Jar Force Results table remain unchanged.

Regression checks cover vertical and 60-degree partitions, Auto DP at multiple
depths including zero deployed pipe, curved analytical TVD integrals split at
the jar centre, all-column reconciliation, fixed-BHA DP exclusion, shared-input
updates, missing values, explicit analysis depth, jar selection, non-mutation,
conditional reference inputs and the unchanged Test 4 predictions. Engineering
partition tests compare against independent arithmetic at 1e-7 lbf tolerance.
Current full-suite/build results are reported with this task's completion.


## Final output refinement

String Weight now presents Total Deployed String, Total BHA, Above Jar Centre,
Below Jar Centre and Fixed BHA Above Jar. Total BHA sums all fixed components
and excludes depth-deployed DP. It uses the existing component air/buoyed weights
and exact interpolated TVD contributions; no survey or force equation changes.
At Test 4 TD its air weight is 60.736250 klbf, buoyed weight is
60.736250*(1-10/65.5) klbf and inclination-corrected weight is half that buoyed
weight because all fixed components lie in the 60-degree tangent. The displayed
row is 60.7 / 51.5 / 25.7 klbf. Above/below partitions continue to reconcile in
all three columns at full precision. Fixed BHA Above Jar is a subset, not an
additional contribution to add to the total deployed string.

Inclination Corrected is defined as: Buoyed weight corrected for well inclination,
excluding frictional drag. Represents the axial component of weight along the
wellbore. The operating table distinguishes predicted hookload from frictional
drag relative to pure-rotation off-bottom hookload. Wellbore normal contact force
is used to calculate frictional drag; it is not added separately as axial drag.
Pure rotation retains zero axial frictional drag as a model assumption.

The main Jar Loading output is limited to desired force/direction and required
surface hookload. Forward-calculated jar-centre load, inverse residual, rotating
comparison, solver status, iteration/evaluation counts and forward integration
step are retained under collapsed Calculation Details. Errors and important
warnings stay visible. The inverse solver and existing survey, friction, static
jar-force and Skeem equations are unchanged. All result formatting uses one
decimal place; internal precision is retained. Existing full-precision Test 4
hookload/drag regressions remain in calcOffBottomHookloads.test.js.
