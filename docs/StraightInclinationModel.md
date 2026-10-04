# Straight-hole inclination screening (preliminary)

This release extends the existing vertical static model to a **straight, constant-inclination** hole, with inclination measured in degrees **from vertical** (0–90). The existing positive-compression / negative-tension convention is unchanged.

For each component, the projected axial gravity is `G_axial = W_air × (1 − MW/65.5) × cos(I)`. Starting at the bit with `F_bit = +WOB`, the axial force at the top of each component is `F_top = F_bottom − G_axial`. The neutral point is the first distance above the bit where accumulated projected buoyed weight equals WOB. At 90° with positive WOB, this simplified gravity-only model has no neutral point.

## Validation references (arithmetic, not field data)

- 0°: the same three-component BHA and outputs as the existing vertical regression suite.
- 60°: 400 ft of 200 lb/ft collars, 10 ppg mud, 30 klbf WOB. Buoyancy factor = `1 − 10/65.5`. Projected buoyed weight = `80,000 × BF × 0.5`; top load = `30,000 − 80,000 × BF × 0.5` lbf; neutral point = `30,000/(200 × BF × 0.5)` ft.
- 90°: same BHA and WOB, projected axial gravity is zero; top load remains +30,000 lbf; no neutral point within this model.
- 60° jar warning: 320 ft of 200 lb/ft collar, 60 ft of 150 lb/ft jar, 100 ft of 200 lb/ft collar; expected neutral point inside the jar.

## Critical limitations

**Not for operational use.** This is NOT a torque-and-drag or jar-firing model. No distributed borehole contact forces, static/sliding friction, doglegs, tortuosity, buckling, hydrodynamic loads, dynamic effects, manufacturer firing-force envelopes or temperature corrections are modelled. Constant inclination is applied to the entire BHA, not an actual survey. WOB is assumed to be the specified axial bit boundary force, not a surface hookload-derived quantity. Results must not be used to select field jar placement.
