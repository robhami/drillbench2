Jar Analysis Engine

1 Data Model

2 Units

3 Survey

4 BHA

5 Component Properties

6 Mechanical Calculations

7 Neutral Point

### Purpose

Determine where axial force changes from tension to compression and establish whether the jar is in tension, near neutral, or in compression.

### Inputs

- Ordered drillstring and BHA components
- Component lengths and weights
- Mud weight
- Survey trajectory
- Applied WOB
- Jar position
- Friction assumptions
- Pressure-area effects, where applicable

### Outputs

- Axial-force profile by measured depth
- Neutral-point measured depth
- Distance of neutral point above bit
- Distance between neutral point and jar
- Axial load at jar
- Jar status
- WOB range where the neutral point crosses the jar

### Equations

To be documented from the workbook and supporting references.

### Assumptions

- Sign convention for axial load
- Survey interpolation method
- Buoyancy method
- Friction model
- Static or quasi-static calculation
- Treatment of short BHA components

### References

- `BHA Mech`
- `BHA Dims`
- `Surveys`
- Published oilfield references to be added

### Validation

- Vertical hand-calculation case
- Straight inclined-hole case
- Workbook benchmark
- Kecapi case, where applicable
- Zero-WOB case
- Neutral point exactly at jar

8 Buckling

9 Jar Analysis

10 Reports