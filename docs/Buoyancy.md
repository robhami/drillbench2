# Buoyancy

## 1. Purpose

Calculate the reduction in apparent drillstring weight caused by the drilling fluid.

The buoyancy calculation is used by:

- BHA summary
- Centre of gravity
- Neutral point
- Buckling
- Jar placement
- Axial load calculations

## 2. Inputs

- Mud weight
- Component air weight
- Steel density or equivalent buoyancy constant
- Component length where weight per foot is used

## 3. Outputs

For the BHA:

- Buoyancy factor
- Total buoyed weight

For each component, where required:

- Air weight
- Buoyed weight

## 4. Units

Initial units:

- Mud weight: ppg
- Component weight: lb or lb/ft
- Length: ft
- Force / apparent weight: lbf

All calculations must use consistent units.

## 5. Assumptions

Initial assumptions to validate:

- Components are treated as steel unless otherwise specified.
- A single mud weight is applied across the BHA.
- Hydrostatic density variation with depth is not included in the first version.
- Temperature and pressure effects on mud density are not included in the first version.
- Tool internal fluid effects must be reviewed separately if relevant.
- The treatment of total tool weight versus weight per foot must be consistent with the component database.

## 6. Equations

The exact buoyancy equation used by WellBench must be confirmed against:

- Existing Excel workbook
- Accepted drilling engineering references
- Existing validated calculations

The implementation must define:

- Buoyancy factor equation
- Density constant used
- Variable definitions
- Units
- Reference

Do not change the existing calculation until the equation has been checked against the Excel workbook.

## 7. Algorithm

Expected calculation sequence:

1. Read mud weight.
2. Calculate the buoyancy factor.
3. Determine each component air weight.
4. Apply the buoyancy factor to each applicable component.
5. Sum component buoyed weights.
6. Return buoyancy factor and total buoyed weight.

## 8. Component Air Weight

Component air weight may be calculated differently depending on component type.

Examples:

### Distributed weight component

For components stored as weight per foot:

airWeight = weightPerFoot × length

Examples:

- Drill pipe
- HWDP
- Drill collar

### Fixed total weight component

For components stored using total tool weight:

airWeight = totalWeight

Examples may include:

- Bit
- Jar
- Motor
- MWD/LWD tool

The component database must define which weight basis applies.

## 9. Validation

### Case 1 - Simple vertical component

Input:

- Component weight per foot: TBD
- Component length: TBD
- Mud weight: TBD

Expected:

- Air weight: TBD
- Buoyancy factor: TBD
- Buoyed weight: TBD

Values to be taken from the existing Excel workbook.

### Case 2 - Complete BHA

Use one existing BHA from the Excel model.

Compare:

- Total air weight
- Buoyancy factor
- Total buoyed weight

WellBench result must match the validated workbook within an agreed tolerance.

## 10. Validation Tolerance

Initial tolerance:

TBD

Potential approach:

- Exact match for simple deterministic calculations where practical.
- Small numerical tolerance for floating-point calculations.

## 11. Known Limitations

Initial version may not include:

- Variable mud density with depth
- Temperature correction
- Pressure correction
- Multiphase fluid effects
- Different fluid densities inside and outside components
- Non-steel material density unless explicitly defined

## 12. References

To be added.