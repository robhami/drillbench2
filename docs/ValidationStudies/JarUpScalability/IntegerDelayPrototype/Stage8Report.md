# Integer-delay recurrence: Stage 8 full-position compact-store validation

**PRELIMINARY — NOT FOR OPERATIONAL USE.** This was a sequential research validation of the existing Stage 6 compact solver. No solver physics, production code, tests or Stage 4 results were modified.

## Result

**PASS — 16/16 positions** completed the full 50-ms post-impact window using the compact slab-backed recurrence. All existing geometry, structural mapping, impact handoff, energy and maintained-engagement checks passed. No Stage 8 recurrence position exceeded the existing 60-s runtime, 1.5-GiB sampled-RSS, 20-million-update or 3-million pending-cell limits.

The 16 Stage 8 jar and stuck force-history files are byte-for-byte identical to their Stage 4 recurrence counterparts. Every position also matches Stage 4 for impact state, initial wave-state handoff hash, geometry, section delay mapping, update/phase/pending counters, energy audits, maintained engagement and reported peak/impulse metrics. This confirms that compact cell IDs and slabs did not change arrival times, lose contributions or alter accumulated numerical results.

## Per-position recurrence results

Runtime is the isolated wrapper runtime including pre-impact work and the 50-ms post-impact calculation. Peak tensile force and impulse are reported as magnitudes. All positions completed and passed maintained engagement.

| Jar centre (ft) | Runtime (s) | Peak RSS (MiB) | Updates | Peak tensile (kN) | 50-ms tensile impulse (kN·s) | Max energy residual (J) |
|---:|---:|---:|---:|---:|---:|---:|
| 132.07 | 6.998 | 559.5 | 7,882,198 | 2,422.090 | 82.8784 | 2.191×10⁻⁶ |
| 133.06 | 2.205 | 203.8 | 1,992,276 | 2,417.038 | 82.7909 | 1.131×10⁻⁶ |
| 193.06 | 0.760 | 125.5 | 557,153 | 2,239.915 | 76.8026 | 2.743×10⁻⁷ |
| 253.06 | 0.565 | 115.1 | 400,981 | 2,416.987 | 71.1325 | 3.770×10⁻⁷ |
| 313.06 | 0.506 | 106.6 | 325,566 | 2,349.486 | 67.3433 | 2.452×10⁻⁷ |
| 373.06 | 0.390 | 90.7 | 199,527 | 2,713.104 | 61.3156 | 1.963×10⁻⁷ |
| 433.06 | 0.309 | 83.5 | 142,978 | 2,752.217 | 56.3821 | 1.171×10⁻⁷ |
| 493.06 | 0.281 | 86.5 | 146,554 | 3,008.237 | 52.0311 | 2.359×10⁻⁷ |
| 553.06 | 0.223 | 90.0 | 98,624 | 2,864.727 | 44.1976 | 1.343×10⁻⁷ |
| 611.83 | 0.209 | 88.4 | 79,774 | 3,226.243 | 36.9591 | 1.383×10⁻⁷ |
| 613.06 | 0.265 | 89.9 | 79,658 | 3,230.273 | 36.8074 | 1.353×10⁻⁷ |
| 641.83 | 0.210 | 88.2 | 73,539 | 3,194.434 | 32.8201 | 7.055×10⁻⁸ |
| 671.83 | 0.225 | 80.3 | 84,280 | 3,330.796 | 28.0067 | 1.560×10⁻⁷ |
| 673.06 | 0.275 | 80.7 | 85,232 | 3,332.464 | 27.7681 | 1.180×10⁻⁷ |
| 730.79 | 2.088 | 329.9 | 1,676,316 | 3,010.196 | 13.2911 | 1.111×10⁻⁷ |
| 731.78 | 13.605 | 1,071.1 | 19,081,684 | 2,993.503 | 13.0092 | 1.972×10⁻⁶ |

Sequential worker runtime totaled 29.12 s. The worst case remains 731.78 ft: 13.61 s, 1,071.1 MiB RSS, 19,081,684 updates and 1,868,436 pending cells. This is 95.4% of the unchanged update limit. These figures are the resource envelope to carry into the separate-process background-work design; retain headroom for process and host memory rather than setting deployment limits at the observed peak.

## Exact-event reference comparison

The saved Stage 4 exact-event runs were used as references; they were not rerun. Six references completed the full 50 ms. For each, Stage 8 recurrence histories were compared over the full window using the existing 10-ps timestamp grouping solely to align representationally adjacent event times. This grouping does not modify either solver's event history.

| Position (ft) | Peak tensile difference (N) | 50-ms impulse difference (N·s) | Max stuck-force history difference (N) |
|---:|---:|---:|---:|
| 553.06 | 1.304×10⁻⁸ | −4.329×10⁻⁹ | 5.681×10⁻⁸ |
| 611.83 | 2.794×10⁻⁹ | −9.386×10⁻¹⁰ | 2.421×10⁻⁸ |
| 613.06 | 2.794×10⁻⁹ | −1.011×10⁻⁹ | 2.561×10⁻⁸ |
| 641.83 | 5.588×10⁻⁹ | −6.767×10⁻¹⁰ | 1.537×10⁻⁸ |
| 671.83 | −1.497×10⁻³ | 1.157×10⁻⁹ | 2.049×10⁻⁸ |
| 673.06 | 6.659×10⁻⁸ | 8.549×10⁻¹⁰ | 1.397×10⁻⁸ |

All six reproduce the Stage 4 results within its recorded comparison bounds: peak-force difference at most 0.00150 N, impulse difference at most 4.33×10⁻⁹ N·s, and stuck-history difference at most 5.69×10⁻⁸ N.

The other ten exact-event runs are incomplete and are used only through their saved cutoff:

- At 132.07–493.06 ft, exact-event cutoffs span 12.182–48.301 ms. The maximum aligned post-event stuck-force difference over those shared intervals is 5.355×10⁻⁸ N. No full-window exact peak or impulse comparison is claimed for these positions.
- At 730.79 and 731.78 ft, the exact-event runs stop at 21.829 ms and 8.892 ms, respectively, before the first stuck-point arrival. The stuck histories are zero in both solvers over those shared intervals, so these checks do not validate the later stuck-point response, peak or impulse against an exact-event reference.

## Half-grid refinement and limitations

The validated 641.83-ft half-grid run (refinement ×2) remains byte-for-byte identical to the saved Stage 3 validated jar and stuck histories. Its impact and force/impulse metrics also match; it completes 50 ms, passes engagement, and has a maximum energy residual of 7.055×10⁻⁸ J. This refinement case was carried forward and rechecked by artifact comparison, not rerun as part of the 16-position ×1 sweep.

The compact solver has now been directly exercised at all 16 frozen benchmark positions. The principal independent validation gap remains the late stuck-point response at 730.79 and 731.78 ft; the exact-event reference does not reach those arrivals. Stage 8 confirms representation equivalence to Stage 4, but does not close that physics/reference gap. Broader refinement and additional geometries/materials also remain necessary before production feasibility can be claimed.

## Artifacts

- `Stage8Results.json` contains per-position runtime, RSS, updates, pending counts, impact/force/impulse/energy/engagement results, Stage 4 binary-history and diagnostic comparisons, and exact-event overlap comparisons.
- `*-recurrence-x1-stage8.json`, `*-jar.f64` and `*-stuck.f64` preserve each Stage 8 run.
- `stage8.cjs` is the sequential research runner. The 641.83-ft half-grid artifacts remain tagged `stage6slab` and are linked in the machine-readable validation result.

The Stage 8 runner passed Node syntax checking. Its overall machine-readable assessment is **pass** for compact-storage equivalence and full 16-position completion, subject to the explicit independent-reference limitations above. No solver or production files, existing tests or Stage 4 benchmark results were modified. Nothing was staged, committed or pushed.
