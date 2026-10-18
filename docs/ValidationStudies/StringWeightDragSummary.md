# String Weight & Drag Summary

The Jar Forces summary retains the validated string-weight and inclination
calculation in `calcStringWeightSummary` unchanged. New off-bottom predictions
are calculated by `calcOffBottomRotatingSummary`, which reuses `calcOffBottomHookloads` with pure rotation. Definitions appear as tooltips on
the dotted output labels. The compact layout retains the jar-centre weight split
and adds pickup, slack-off, rotating hookloads and the two defined drag values.

## Terminology

- **String Weight in Air:** deployed drillstring weight before buoyancy correction.
- **Buoyed String Weight:** deployed gravitational weight corrected for mud
  buoyancy, without inclination projection or frictional drag.
- **Inclination-Corrected Hookload (No Frictional Drag):** theoretical local axial
  surface support with buoyancy, survey inclination, zero bit load, no friction
  and no other applied axial load. Its existing calculation is unchanged.
- **Pickup Hookload:** predicted off-bottom surface support with upward axial
  sliding and calculated frictional drag.
- **Slack-Off Hookload:** predicted off-bottom surface support with downward
  axial sliding and calculated frictional drag.
- **Rotating Hookload (Off Bottom):** model-predicted support at selected positive RPM, zero bit load, fixed bit depth and zero axial movement. The existing pure-rotation model gives zero axial frictional drag. This is not a measured rig hookload.
- **Pickup Drag:** pickup hookload minus rotating hookload (off bottom).
- **Slack-Off Drag:** rotating hookload (off bottom) minus slack-off hookload.

The operating outputs appear in Pickup, Rotating, Slack-Off order. The theoretical inclination-corrected reference retains its existing definition and calculation.

These are model predictions, not measured rig hookloads. The entered operating
surface hookload or reference/overpull/set-down is never a prediction boundary.
It remains independent and is used only by the separate static jar-load action.

## Calculation and reuse

Each operation deploys the full current string using the existing deployment
policy. The off-bottom axial boundary is **C_bit=0**, regardless of saved or
entered WOB. Compression-positive C is retained, and predicted hookload is
`H=-C_surface`.

Slack-off reuses `calcSurveyAxialLoads` in Slide mode at zero WOB. Rotating
while lowering reuses its Rotate mode at zero WOB. For pickup the existing
`localGeometry` and `integrateElement` helpers are exported without changing
their equations or the existing drilling paths. The pickup pass uses the same
element subdivision/gravity values and signed axial coefficient `-mu`:

```
pickup:   C_top = C_bottom - G_element - mu*N_pickup
slackoff: C_top = C_bottom - G_element + mu*N_slackoff
```

Normal contact is independently resolved from each operation's mean axial force
using the existing vector gravity/curvature expression. Thus pickup and slack-off
drag are not assumed equal in a curved string. Only the mathematical element
helper receives a signed coefficient; user-entered friction remains 0–1.

Both nonrotating operations assume fully mobilised axial sliding. Rotating
retains two engineering API cases, with positive RPM and positive deployed component OD:

1. **Lowering while rotating:** positive axial speed is required. The existing
   ROP parameter is explicitly interpreted as off-bottom downhole axial speed
   in ft/hr, not actual penetration. The existing axial friction fraction is
   `speed/hypot(speed, pi*OD*RPM*5)`, with OD inches and RPM rev/min.
2. **Pure rotation:** axial speed is explicitly zero and RPM is positive, so
   the velocity projection gives zero axial friction. Re-evaluate the existing
   force solver with zero axial friction; do not simply substitute the stored
   no-drag number. Here equality with no-drag support is physically justified
   within this model. Circumferential friction/torque is not predicted.

RPM=0 is not presented as a rotating operation: use the separately supported
nonrotating slack-off result. Upward axial motion while rotating is unsupported
by the general API. The summary always selects pure rotation; it has no axial-motion or ROP control. ROP is not used. Missing/invalid RPM or OD makes the rotary prediction and both rotating-reference drag outputs unavailable, with reasons. Pickup and slack-off hookloads remain independently available. Invalid friction
leaves existing weight results available but makes operating predictions unknown.
Negative predicted hookload requires downward surface push and is unavailable,
not a clipped zero. The associated drag is unavailable too.

## Numerical checks

The existing element maximum step defaults to 5 ft with a 0.05-rad curvature
cap. Curved friction cases are repeated at half steps, checking surface force
and shared profile nodes to <=0.1 lbf difference, with at most six halvings by
default. The initial bound respects the active curvature cap, ensuring that
halving actually changes the mesh even for an oversized requested step.
Iteration/element limits remain those of the reused solver. Unresolved refinement
or force balance returns unavailable. This is a numerical consistency check,
not a formal error bound or a physically validated buckling/contact model.

Audit identities use integrated axial gravity G and independently accumulated
nonnegative axial friction D:

```
H_pickup = G + D_pickup
H_slackoff = G - D_slackoff
H_rotating_lowering = G - D_rotating_axial
```

The two displayed drag definitions use hookload differences exactly. Floating
roundoff can produce negligible nonzero drag in a vertical case; the UI suppresses
minus-zero only below half of its last displayed klbf digit. Raw loads and
equilibrium residuals are unchanged.

## Independent analytical regression cases

Uniform 1000-ft string, air weight 100 lbf/ft, mud 10 ppg, mu=0.25, OD=6.75 in,
RPM=150, off-bottom axial speed=60 ft/hr. BF=111/131.

| Case | No-drag support klbf | Pickup klbf | Slack-off klbf | Rotating while lowering klbf |
| --- | ---: | ---: | ---: | ---: |
| Vertical | 84.732824 | 84.732824 | 84.732824 | 84.732824 |
| Straight 60 degrees | 42.366412 | 60.711607 | 24.021218 | 42.297204 |
| Circular build 30–60 degrees | 59.233076 | 69.638455 | 47.009458 | 59.190542 |

Straight expectations use `G=W_b*cos(I)` and `D=mu*W_b*sin(I)`, with the rotary
velocity fraction applied only to axial drag. Straight comparisons pass at
1e-6 lbf absolute tolerance. Zero-friction and pure-rotation cases separately
justify matching the no-drag result; increasing RPM and increasing axial speed
have distinct effects on rotating drag.

For the weighted circular build kappa=pi/6000 and I(s)=pi/6+kappa*s. On the
tested contact branch, `n=w*sin(I)+C*kappa` remains nonnegative. An independent
closed form with d=+1 pickup/-1 slack-off and effective axial mu is

```
P(I) = w/[kappa*(1+mu^2)] * [-2*d*mu*cos(I)+(1-mu^2)*sin(I)]
H = -P(I_surface) + P(I_bit)*exp(-d*mu*kappa*L)
```

This imposes C_bit=0 and differs from Stage 3A's surface-hookload boundary.
Calculated curved hookloads agree within 0.1 lbf. Maximum shared-profile step
differences in the three curved cases are 0.000291, 0.006424 and 0.000013 lbf.

## Test 4 audit

SyntheticDirectionalWell.csv, supplied Test 4 BHA, bit MD=12000 ft, surface MD=0,
mud=10 ppg, mu=0.25, RPM=150, zero axial speed, fixed bit depth. One uppermost DP row is auto-deployed to 11485 ft. Multiple DP rows remain explicitly unsupported by the existing deployment policy.

| Output | Calculated klbf |
| --- | ---: |
| String Weight in Air | 379.559850 |
| Buoyed String Weight | 321.611781 |
| Inclination-Corrected Hookload (No Frictional Drag) | 211.471604 |
| Pickup Hookload | 297.672099 |
| Rotating Hookload (Off Bottom) | 211.471604 |
| Slack-Off Hookload | 154.503686 |
| Pickup Drag | 86.200495 |
| Slack-Off Drag | 56.967918 |

All five requested operating/drag values agree with the supplied targets within 0.0000005 klbf. Displayed drag differences use the calculated rotating support, not the theoretical reference. The retained general rotating-while-lowering API still gives 211.159067 klbf for axial speed 60 ft/hr; that output is not displayed in this summary.

The existing weight/inclination results are preserved exactly. Slide/Rotate
predictions are checked against separately constructed zero-WOB calls to the
existing solver at the returned step bound. Final curved step bounds are 2.5 ft;
maximum profile difference is 0.005045 lbf. Global balance residuals are below
2e-8 lbf. Pickup/slack-off drag differ because their axial forces and therefore
curvature contact differ. A user-entered 200-klbf hookload would not replace any
of these predicted values.

Regression coverage also includes deployed DP, invalid conditions, zero weights,
blank component placeholders, negative slack-off support, failed convergence,
non-mutation, definition tooltips, automatic rotary-setting updates and complete
independence from entered surface/reference loads.

## Limitations

Predictions follow the imposed-centreline soft-string model, without bending,
buckling, hydraulic pressure-end forces, static-friction history or suspended
equipment weight. Hookloads at an inclined surface reference are local axial
support. Predictions are not measured rig loads or manufacturer limits. No
jar-force or Skeem equations are changed, and no firing or impact is inferred.

## Verification

Current verification results are recorded in the task completion report. Regression coverage includes the five Test 4 targets, forced pure rotation despite lowering inputs, displayed order, definitions, unavailable rotating-reference drags and preservation of the general lowering calculation. Existing string-weight calculations, drilling solver paths and jar-force
and Skeem equations are preserved; the shared survey element helpers are only
exported for reuse.
