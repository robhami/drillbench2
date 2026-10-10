# Skeem jar configuration sweep - Stage 1

**PRELIMINARY - NOT FOR OPERATIONAL USE.** This module produces numerical
samples only. It does not change a BHA, persist lengths, select a globally
optimal jar position or add a UI/plotting dependency.

## Source and calculation path

The existing [model documentation](SkeemDynamics.md) and original SPE 7521
PDF pages 2-4 (printed pp. 1382-1384) were read before implementing the sweep.
The paper specifies distributed one-dimensional elastic-wave reflections,
Equations 1-3 for pre-impact motion, Equation 4 for incident impact force,
and Equation 5 plus lower-collar weight correction for the primary force.
`calcSkeemPostImpact` remains the sole source of dynamic results. The sweep
calls it separately for every L1/L2 configuration, including invalid ones.
No lumped hammer mass, new wave equation or graph fitting is introduced.

L1 is the collar span from the stuck point to the lower jar face; L2 is the
span from the upper jar face to the pipe interface. Jar-body length is
excluded; total effective collar length is L1+L2. Both spans and all sections
are hypothetical sweep inputs, not an approximation of an existing mixed BHA.

The only new engineering calculation is uniform collar air weight:

```text
Ac = pi/4 * (OD-ID) * (OD+ID)                 [in^2]
weight per foot = Ac * 12 * materialWeightDensityLbfIn3   [lbf/ft]
lower collar air weight W = weight per foot * L1         [lbf]
upper collar air weight = weight per foot * L2           [lbf]
```

The density is **weight density in lbf/in^3**, not mass density. No g or
buoyancy conversion is applied. Lower W is passed to the existing solver;
upper weight is audit metadata, not a rigid hammer mass used in dynamics.
Every L1 independently receives a newly calculated W.

## API

`calcSkeemConfigurationSweep(request, options = {})` is exported from
`src/engineering/jar/skeemConfigurationSweep.js`.

```js
const constants = {
  overpullKlbf: 165, strokeIn: 4,
  collarOdIn: 6.25, collarIdIn: 2.75,
  pipeOdIn: 4.5, pipeIdIn: Math.sqrt(13.95),
  youngsModulusPsi: 30000000, acousticVelocityFtS: 16000,
  freePipeLengthFt: 3000, materialWeightDensityLbfIn3: 0.283
};

// Mode A: total excludes the physical jar body.
calcSkeemConfigurationSweep({
  mode: 'fixed-total', constants, totalCollarLengthFt: 240,
  l1: { minFt: 60, maxFt: 180, samples: 3 }
});

// Mode B: independent Cartesian product, not a fixed-total trajectory.
calcSkeemConfigurationSweep({
  mode: 'independent', constants,
  l1: { minFt: 60, maxFt: 180, samples: 3 },
  l2: { minFt: 60, maxFt: 180, samples: 3 }
});
```

Constants use finite numeric values, without string conversion. Overpull at
the jar is converted from klbf to lbf once. Density is mandatory; none of
the example dimensions/material values are automatic defaults. Optional
`constants.direction` must satisfy the upward-only solver. `options` is
passed to the existing solver, including its `maxReflections` safeguard.

Axes use inclusive endpoints and uniform spacing. A single sample requires
equal bounds; equal bounds require a single sample. Descending, non-finite,
unresolvable or excessive sample requests fail before sampling. There is a
10,000-configuration execution/storage cap, distinct from the solver's
reflection limit. A malformed density or request returns `valid:false`, an
error, empty samples/counts and null maxima.

Finite ranges may include nonpositive lengths or extend beyond a fixed total:
those coordinates are retained as explicitly invalid physical samples. They
are never clamped, omitted or interpolated. Positive L1/L2 are required by
the existing solver. All other geometry, free-pipe, W<FI, finite-pipe timing
and numerical checks likewise remain authoritative. A successfully enumerated
request has `valid:true` even if every sample is physically invalid; inspect
`validCount` and each sample's `valid` before plotting.

## Returned data

- `notice` and `warnings`: preliminary status and assumptions/limitations.
- `mode` and `axes`: sampled L1/L2 coordinates and documented ordering.
  Fixed-total arrays are paired; independent arrays are Cartesian axes.
- `samples`: stable zero-based `index`, `l1Index`, `l2Index` (null for fixed
  total), `l1Ft`, `l2Ft`, `totalCollarLengthFt`, lower/upper air weights in
  lbf, `valid`, `error`, `warnings`, and dynamic metrics below.
- Metrics: `impactVelocityFtS`, `impactForceLbf`, `impactForceKlbf`,
  `averageStuckPointForceLbf`, `averageStuckPointForceKlbf`, `impulseLbfS`,
  `primaryPulseDurationS`, `reflectionCount`.
- `maxima`: label **Maxima within the sampled domain**, plus `impulse`,
  `averageForce` and `impactForce`, each containing the complete winning
  sample, or null when no valid samples exist. Exact ties retain the first
  sample in output order. No tolerance-based global optimization is implied.
- `validCount`, `invalidCount`, `invalidReasons`: grouped exact error reasons,
  counts and corresponding sample indices.

Invalid dynamic metrics are null, with an explicit error. Representable
geometry/weight metadata remains available; overflowing derived coordinates
or weights are null rather than non-finite plotting data. Independent order
is ascending L1 outer loop, ascending L2 inner loop. Fixed-total order is
ascending L1 with L2 calculated directly as total minus L1. Inputs and BHA
objects are never modified; the module has no BHA or storage dependency.

## Validation assumptions and results

For the published 6.25 x 2.75-in collars, Ac = 24.74004214701962 in^2.
The paper gives alpha=5 and 4.5-in nominal, 16.6-lb/ft pipe, but no explicit
pipe ID. Use the existing model's equivalent uniform section:
Ap=Ac/5=4.948008429403924 in^2 and equivalent ID=3.734969879396620 in.
This is not a manufacturer's physical pipe-body specification. Assume air
weight density 0.283 lbf/in^3, giving 84.01718313127864 lbf/ft collars.
E=30 million psi, va=16,000 ft/s and L3=3000 ft are explicit inputs, not
quantities extracted from the paper's plots.

Independent expected values were calculated separately using Python Decimal
at 50-digit precision, the closed-form geometric reflection sums described
in the model documentation and the analytically integrated weight-corrected
force rectangles. Tests compare unrounded references with absolute errors
below 1e-8 in the respective units and additionally compare direct solver
calls. Figures 4/5 are not digitized quantitative benchmarks.

Fixed total 240 ft, F0=165 klbf, stroke=4 in:

| L1 ft | L2 ft | Velocity ft/s | FI klbf | Average force klbf | Impulse lbf*s | T ms | N |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 60 | 180 | 11.461401 | 265.833333 | 546.821091 | 12303.474542 | 22.5 | 2 |
| 120 | 120 | 11.461401 | 265.833333 | 599.931984 | 8998.979767 | 15.0 | 2 |
| 180 | 60 | 14.974475 | 347.314815 | 686.314803 | 5147.361021 | 7.5 | 4 |

Independent L1/L2 = 60, 120, 180 ft: impulse in lbf*s:

| L1 / L2 ft | 60 | 120 | 180 |
|---:|---:|---:|---:|
| 60 | 5298.591951 | 9150.210696 | 12303.474542 |
| 120 | 5222.976486 | 8998.979767 | 12076.628148 |
| 180 | 5147.361021 | 8847.748837 | 11849.781753 |

Both sampled domains have their highest sampled impulse at L1=60 ft,
L2=180 ft: 12303.474542 lbf*s. The independent grid's highest average
force is at L1=60 ft, L2=60 ft: 706.478927 klbf. Its maximum impact
force is 347.314815 klbf at L2=60 ft for all three L1 values; the first
tie is returned. All 3 fixed-total and all 9 independent samples are valid.

The fixed-total trend is consistent with the paper's qualitative tradeoff:
moving the jar up raises force while shortening the primary interval and
reducing impulse. At fixed L2, increasing L1 increases W and reduces primary
impulse by 2*deltaW*T, without changing pre-impact velocity or FI. These
are sampled calculations, not proof of a global optimum or field outcome.

Limits remain those of the existing model: L3>1300 ft plus surface-return
timing, W<FI, rigid sticking, ideal uniform sections, no damping/friction,
no secondary pulses/slip displacement and external elastic/slender-member
qualification. With no jar-body length input, near-top validity cannot be
automatically established. No plotting library or 3D visualization is added.
