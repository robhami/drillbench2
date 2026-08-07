# Neutral Point

## 1. Purpose

Calculate the position in the drill string where axial force changes from compression to tension.

The calculation will support:

- BHA design
- Jar placement
- Buckling analysis
- Evaluation of available weight at the jar
- Comparison of different BHA configurations

## 2. Inputs

Initial inputs expected:

- BHA component list
- Component length
- Component weight
- Component OD
- Component ID
- Mud weight
- Weight on bit (WOB)
- Well inclination / survey data

Additional inputs may be required as the model develops.

## 3. Outputs

Expected outputs:

- Neutral point distance above bit
- Component containing the neutral point
- Position within that component
- Axial load along the BHA
- Indication of components in compression
- Indication of components in tension

## 4. Units

Initial engineering units:

- Length: ft
- OD / ID: in
- Weight: lb/ft
- Force: lbf or klbf
- Mud weight: ppg
- Inclination: degrees

Internal calculation units must be consistent.

## 5. Assumptions

To be defined from the existing Excel model and references.

Possible assumptions to review:

- Steel density
- Buoyancy calculation
- Treatment of tool total weight versus weight per foot
- Effect of inclination
- Friction assumptions
- Whether the first version assumes static conditions
- Treatment of stabilizers and tool joints

## 6. Equations

Do not code this section until the equations have been confirmed.

Equations should be taken from:

- Existing validated Excel calculations
- Published drilling engineering references
- Jar placement papers
- Other accepted engineering references

Each equation should include:

- Equation
- Definition of variables
- Units
- Reference

## 7. Algorithm

Initial expected sequence:

1. Build component positions from the bit upward.
2. Calculate component air weight.
3. Calculate buoyancy.
4. Determine buoyed component weight.
5. Apply inclination effects.
6. Calculate cumulative axial load from the bit upward.
7. Apply WOB.
8. Identify where axial force crosses zero.
9. Interpolate neutral point position within the relevant component.
10. Return neutral point and load distribution.

This sequence must be validated before implementation.

## 8. Validation

The neutral point calculation should be checked against:

- Existing Excel workbook examples
- Simple vertical BHA hand calculations
- Deviated well examples
- Published examples where available

### Validation Case 1

To be added.

### Validation Case 2

To be added.

## 9. Known Limitations

To be defined.

Potential first-version limitations may include:

- No dynamic effects
- Simplified friction
- No torque coupling
- Simplified survey interpolation

## 10. References

To be added.