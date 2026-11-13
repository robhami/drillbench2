# Integer-delay prototype: Stage 4, 16-position scalability

**PRELIMINARY — NOT FOR OPERATIONAL USE.** This was an isolated research sweep. Production code, the existing benchmark files and UI were not modified.

## Setup and safety limits

The sweep used the exact 16 jar centres and TCI-inclusive reconstructed OES 8.5-in BHA fixture from `scripts/benchmarkJarUpScalability.cjs`, with its frozen inputs, geometry mapping, local tensile load, 7.5-in stroke and 50-ms post-impact window. Each position ran in its own sequential process: existing exact-event solver first, integer-delay recurrence second. The runner checked each impact state against `after.json`, retained section geometry and force histories, and preserved the wrapper's geometry, structural mapping, energy handoff and maintained-engagement checks.

Per-run wall-time safety limit was 60 s. Recurrence RSS safety limit was 1.5 GiB, sampled during tick processing. Existing solver limits were left unchanged: 20 million recurrence updates, 3 million pending recurrence buckets, the exact solver's 500,000-event limit, and existing energy tolerances. None of the 32 solver runs exceeded its applicable safety limit. Every recurrence run completed 50 ms. The heaviest case used 19,081,684 updates, 1,868,436 pending buckets and 1,404.0 MiB peak process RSS.

## Recurrence results

All force values below are tensile magnitudes. Runtime includes the pre-impact calculation and 50-ms post-impact solve. Each case had 12 sections; geometry and structural mapping were valid. Maintained engagement was admissible at all 16 positions.

| Jar centre (ft) | Runtime (s) | Peak RSS (MiB) | Updates | Impact time (s) | Impact velocity (m/s) | Peak tensile (kN) | 50-ms tensile impulse (kN·s) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 132.07 | 9.886 | 532.9 | 7,882,198 | 0.118034 | 2.9068 | 2,422.090 | 82.8784 |
| 133.06 | 3.081 | 229.8 | 1,992,276 | 0.117963 | 2.9068 | 2,417.038 | 82.7909 |
| 193.06 | 0.871 | 138.9 | 557,153 | 0.113691 | 2.9105 | 2,239.915 | 76.8026 |
| 253.06 | 0.678 | 125.5 | 400,981 | 0.109417 | 2.9097 | 2,416.987 | 71.1325 |
| 313.06 | 0.603 | 111.6 | 325,566 | 0.105053 | 3.0476 | 2,349.486 | 67.3433 |
| 373.06 | 0.444 | 94.3 | 199,527 | 0.099700 | 3.2366 | 2,713.104 | 61.3156 |
| 433.06 | 0.442 | 91.6 | 142,978 | 0.094422 | 3.2264 | 2,752.217 | 56.3821 |
| 493.06 | 0.359 | 93.5 | 146,554 | 0.089142 | 3.2400 | 3,008.237 | 52.0311 |
| 553.06 | 0.279 | 93.4 | 98,624 | 0.082522 | 3.6957 | 2,864.727 | 44.1976 |
| 611.83 | 0.271 | 93.7 | 79,774 | 0.075414 | 4.0260 | 3,226.243 | 36.9591 |
| 613.06 | 0.300 | 93.1 | 79,658 | 0.075261 | 4.0260 | 3,230.273 | 36.8074 |
| 641.83 | 0.315 | 93.8 | 73,539 | 0.071512 | 4.3048 | 3,194.434 | 32.8201 |
| 671.83 | 0.316 | 93.4 | 84,280 | 0.067099 | 4.3599 | 3,330.796 | 28.0067 |
| 673.06 | 0.296 | 94.3 | 85,232 | 0.066919 | 4.3618 | 3,332.464 | 27.7681 |
| 730.79 | 2.429 | 351.2 | 1,676,316 | 0.057347 | 4.6558 | 3,010.196 | 13.2911 |
| 731.78 | 20.779 | 1,404.0 | 19,081,684 | 0.057176 | 4.6557 | 2,993.503 | 13.0092 |

Runtime ranged from 0.271 s to 20.779 s; RSS ranged from 91.6 MiB to 1,404.0 MiB. The recurrence runs took 41.35 s total when executed sequentially. The largest audited energy residual was 2.19×10⁻⁶ J across the 11 audit points; maximum impact handoff residual was 1.17×10⁻⁹ J. All energy and engagement gates passed.

## Exact-event comparison

The exact-event solver completed 50 ms at six positions: 553.06, 611.83, 613.06, 641.83, 671.83 and 673.06 ft. Relative to those complete references, the largest peak-force difference was 0.00150 N (at 671.83 ft); the largest tensile-impulse difference was 4.33×10⁻⁹ N·s. Across the six full-window stuck-force histories, the largest post-event force difference was 5.69×10⁻⁸ N.

At the eight positions from 132.07 through 493.06 ft, exact-event runs stopped at their existing 500,000-event budget between 12.182 and 48.301 ms. On those shared intervals, the largest post-event stuck-force difference was 5.36×10⁻⁸ N. The comparison groups timestamps within 10 ps solely to compare the same post-arrival force state; it does not merge or alter solver events. At 730.79 and 731.78 ft, the exact run stopped at 21.829 and 8.892 ms, respectively, before the stuck-point first arrival (44.129 and 44.189 ms). Both stuck-point histories remain at zero over those shared intervals, so no post-arrival exact comparison is available there.

## Assessment

The recurrence completed the entire specified sweep within the per-run limits, and its completed exact-event comparisons agree closely. That establishes useful research scalability across these 16 positions. It is **not yet practical for a user-facing sweep**: the hardest position takes about 21 s and peaks near 1.4 GiB, while reaching 95% of the unchanged update budget. The exact solver also lacks complete references for ten positions, limiting independent validation there. A user-facing recommendation requires lower worst-case resource use and additional validation before integration; no production integration is recommended from this sweep alone.

## Artifacts and validation

- [Stage4Results.json](Stage4Results.json) contains all 32 exact/recurrence runs, per-position comparisons, geometry, impact/handoff results, energy audits and numerical diagnostics.
- `*-stage4-jar.f64` and `*-stage4-stuck.f64` preserve each run's force histories; `stage4.cjs` reruns the sweep sequentially or finalizes saved results.
- The two runner scripts pass `node --check`. No solver physics, grid resolution, event budgets or tolerances were changed. Nothing was staged, committed or pushed.
