# Jar Placement: Skeem performance integration

The Jar Performance section calls the existing `calcSkeemPostImpact` solver.
No wave equations, static loads or placement calculations are changed.

Rows remain ordered bottom-up and positions come from `calcComponentPositions`.
Exactly one JAR is supported. Its displayed position is its centre above bit.
For the ideal zero-length engagement model, L1 is measured from the lower jar
face down to the entered stuck point and L2 from the upper face to the first
DP interface. The finite jar length is excluded rather than treated as collar
metal. This face-based mapping is an explicit idealisation: it does not model
propagation inside the jar. Stuck points inside or above the jar are rejected.

Only DC components in the free span below and above the jar, followed by a
contiguous DP section, are accepted. All collars must have identical entered
OD/ID; all pipe must have identical entered OD/ID. Missing dimensions are
rejected, including blank IDs (an explicitly entered zero ID remains valid).
HWDP, stabilisers, motors, sensors, accelerators, mixed sections and multiple
jars are unsupported. Components wholly below the stuck point are excluded.
Incomplete component lengths/categories block calculation so positions cannot
silently shift by dropping a row.

L3 is the sum of entered free DP lengths; no total-depth extrapolation is used.
W is entered lower-collar air weight per foot multiplied by the collar span
above the stuck point, clipping the intersected collar at that point. Uniform
positive lower-collar weights are required. There is no density inference or
automatic buoyancy correction. This explicitly uses air weight rather than
claiming a unique weight convention from Skeem's plotted examples.

The only operating inputs are stroke in inches, overpull **at the jar** in
klbf (converted to lbf once), and stuck-point height above bit in feet.
Overpull starts blank: drilling WOB and surface overpull are not substituted.
Stroke defaults to 4 in and stuck point to 0 ft. These are editable starting
values, not values inferred from the BHA. Material assumptions are explicitly
E = 30 million psi and acoustic velocity = 16,000 ft/s, consistent with the
existing validation examples. They are not BHA material qualifications.

The solver retains its free-pipe, tensile-weight and numerical validity guards.
Errors suppress the summary/chart. Assumptions and available geometry remain
auditable in collapsible details. Results remain preliminary and not for
operational use, especially when L2 approaches actual jar length.

The compact interface displays impact force, average stuck-point force,
impulse and impact velocity. Impact time and primary pulse duration are in
engineering details, collapsed by default. No axial-load or force-time chart
is rendered in Jar Placement. Solver force-history data remains unchanged.
Positive Skeem force is tensile, distinct from compression-positive drilling
loads in the existing placement calculation.

A demonstration BHA of 60 ft DC / 10 ft JAR / 180 ft DC / 3000 ft DP gives
jar centre 65 ft, L1 = 60 ft and L2 = 180 ft. Using the published example
sections with alpha = 5, 165 klbf overpull and 4 in stroke gives 11.461401
ft/s, FI = 265.833333 klbf, average = 546.821091 klbf, impulse =
12303.474542 lbf*s, duration = 22.5 ms and impact time = 50.807260 ms,
under the documented air-weight/material assumptions.

Validation Test 3 lacks a free drillpipe section and complete tubular IDs in
some rows; it remains a static placement validation, not an automatically
qualified Skeem demonstration. Supply a supported BHA to demonstrate dynamics.
