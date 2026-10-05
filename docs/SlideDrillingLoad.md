# Slide Drilling Load — V1 Screening Model

## Purpose

WellBench uses this model to estimate the BHA axial-load profile and neutral point **while slide drilling with WOB applied at the bit**. It is intentionally transparent and limited so the calculation can be reviewed and independently validated before more advanced torque-and-drag behaviour is added.

## Sign convention

- Positive axial force = compression
- Negative axial force = tension
- Inclination is measured from vertical: 0° vertical, 90° horizontal

## Boundary condition

The calculation begins at the bit with the entered drilling WOB:

`C_bit = WOB`

This is a drilling-load calculation. It is not a free-ended RIH/POOH hookload model.

## Straight-hole force model

For each BHA component, using buoyed component weight `Wb` and inclination `theta`:

- Axial gravity component: `W_axial = Wb cos(theta)`
- Simplified normal contact force: `N = Wb sin(theta)`
- Coulomb sliding drag: `F_drag = mu N`

During slide drilling the BHA progresses downhole, so friction acts uphole. With WellBench's compression-positive convention, moving upward through the BHA:

`C_top = C_bottom - W_axial + F_drag`

The neutral point is where the calculated axial load crosses zero. WellBench linearly interpolates the crossing within a constant-weight component.

## Interpretation

Below the neutral point the modelled BHA is in compression. Above it the modelled BHA is in tension. Increasing slide drag reduces the rate at which compression falls when moving upward, so in this simple model the neutral point generally moves farther from the bit.

## Current limitations

This V1 model assumes a straight, constant-inclination hole and a single Coulomb friction coefficient. It does not yet model dogleg/curvature contact force, tortuosity, buckling, dynamic effects, detailed bit/formation interaction, or rotational friction reduction. Rotate drilling will be implemented and validated separately.

The result is a screening calculation and is not intended as a field torque-and-drag or jar operating model.
