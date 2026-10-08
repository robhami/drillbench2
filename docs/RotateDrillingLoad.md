# Rotate Drilling Load — v1 screening model

## Purpose
WellBench Rotate estimates the **axial drilling-load profile and neutral point while rotating on bottom with WOB applied**. It is intentionally a transparent first-pass model that can be explained and independently checked.

## Boundary condition
The bit starts in compression at the entered weight on bit:

`C_bit = WOB`

Positive axial force is compression; negative axial force is tension.

## Straight-hole force resolution
For each BHA component at constant inclination θ from vertical:

- axial buoyed weight = `Wb cos(θ)`
- wall normal force = `Wb sin(θ)`
- Coulomb friction magnitude = `μ Wb sin(θ)`

## Why rotation reduces axial drag
During rotary drilling the outside surface of a BHA component has two velocity components relative to the borehole wall:

- axial velocity = ROP
- circumferential velocity = `π × OD × RPM × 5` ft/hr when OD is in inches

Friction acts opposite the resultant relative velocity. The fraction of the friction vector acting axially is therefore:

`axialFraction = ROP / sqrt(ROP² + tangentialSpeed²)`

The axial drag used in the drilling-load balance is:

`axialDrag = μN × axialFraction`

and, moving upward through the BHA:

`C_top = C_bottom - Wb cos(θ) + axialDrag`

At zero RPM this reduces to the Slide equation. As rotational surface speed becomes large compared with ROP, the axial component of friction approaches zero.

## Neutral point and jar placement
WellBench calculates the load from the bit upward and linearly interpolates within the component where axial force crosses zero. That location is the Rotate neutral point. Jar position is then compared with that neutral point using the same compression-positive convention as Slide.

## Inputs
Rotate requires WOB, mud weight, inclination, friction coefficient, RPM, ROP and a valid OD for each BHA component.

## Limitations
This is **not a full torque-and-drag model**. It assumes a straight, constant-inclination well section and simple Coulomb contact. It does not include dogleg/curvature contact forces, buckling, tortuosity, bit torque, dynamic effects, whirl, detailed stabilizer contact mechanics, static-friction history or distributed drillstring torque. It is a screening calculation and should not be presented as an operational field prediction.
