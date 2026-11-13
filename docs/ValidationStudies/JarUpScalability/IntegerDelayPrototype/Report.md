# Integer-delay recurrence prototype

**PRELIMINARY — NOT FOR OPERATIONAL USE.** Research-only two-position experiment; no production solver or UI changes.

## Result

The prototype completed the 50-ms post-impact window at both 641.830 ft and 132.070 ft. It reuses the existing OES geometry mapper and exact-event pre-impact stage, then propagates the unchanged impact snapshot with integer section delays. Off-grid snapshot fronts retain exact dyadic tick residues; arrivals are accumulated by `(integer tick, phase, interface)`. The existing wrapper still checks initial jar force, maintained engagement, energy handoff and its admissibility gates.

The endpoint timing fix resolved the reported reference peak discrepancy. A full-section snapshot edge was initially assigned a Float64-rounded end time while its first recurrence arrived at the exact integer delay. This left a sub-ULP gap, inserted a false force-history sample, and made the peak finder report 3,225.58 kN. The full-section endpoint now uses its exact integer delay tick. The recurrence peak becomes 3,194.433623376509 kN, matching the exact-event value 3,194.433623376503 kN. No peaks or amplitudes are removed.

## Measured results

| Jar centre | Method | Runtime | Peak process RSS | Post-impact coverage | Peak stuck-point tension | Tensile impulse | Maximum audited energy residual |
|---:|---|---:|---:|---:|---:|---:|---:|
| 641.830 ft | Integer recurrence | 0.266 s | 91.9 MiB | 50 ms | 3,194.433623 kN | 32.82009655 kN·s | 7.05×10⁻⁸ J |
| 641.830 ft | Exact event | 1.234 s | 252.3 MiB | 50 ms | 3,194.433623 kN | 32.82009655 kN·s | 2.33×10⁻¹⁰ J |
| 132.070 ft | Integer recurrence | 11.284 s | 1,280.5 MiB | 50 ms | 2,422.089546 kN | 82.87837696 kN·s | 2.19×10⁻⁶ J |
| 132.070 ft | Exact event | 4.570 s | 674.7 MiB | 12.182 ms, then event budget cutoff | — | — | — |

At 641.830 ft, signed impulse is −32.82009655 kN·s for both methods. Their reported tensile impulses differ by 5.5×10⁻¹⁰ N·s. At 132.070 ft, the recurrence’s full 50-ms results are complete but have no full-window exact-event comparator. Over the exact solver’s shared 12.1816266-ms prefix, peak tension is 2,044.326339 kN for both; tensile impulse is 7.136671110 kN·s for the recurrence and 7.136671110 kN·s for the exact solver (difference about 2.4×10⁻⁹ N·s).

The exact pre-impact stage gave identical impact states in both methods. At 641.830 ft, impact is at 71.51226994 ms, velocity 4.304791481 m/s and initial impact-force magnitude 852.8486182 kN. At 132.070 ft, these are 118.0336363 ms, 2.906786355 m/s and 575.8812564 kN. The handoff snapshot hashes match between each position’s exact and recurrence runs. Handoff energy residuals are 0 J and −2.33×10⁻¹⁰ J respectively; initial jar-force errors are below 8.2×10⁻¹⁰ N. No positive jar compression was found. The recurrence’s ten post-impact energy audits passed the existing 1e−12 J + 1e−9 relative tolerance.

## The 45.901-ms force history

At the stuck interface (node 12), the exact-event solver records three downward arrivals in the ±2-µs inspection window:

| Exact arrival time after impact | Downward force increment | Exact tick |
|---:|---:|---:|
| 45.90005961278657 ms | +8.82971496×10⁻¹⁰ N | 6773653221160687181 |
| 45.90105487082558 ms | +2.51659769×10⁻¹¹ N | 6773800095323350031 |
| 45.90126732870018 ms | −1.15509516×10⁻¹³ N | 6773831448571663395 |

Each recurrence update at the corresponding time has one accumulated incoming contribution. The tick/phase pairs are `(76011, 2006607892159994)`, `(76013, 0)` and `(76013, 2006607892071932)`; the grouped resultant force and exact-event history agree to within 2 nN. The arrivals are distinct, not simultaneous, and no large force increment is hidden by grouping. Both histories hold approximately −3,134,055.071428 N through these samples. The earlier 3,225.58-kN peak was a force-history timing artefact from the unmatched full-section endpoint, not a physical reflection or a missed scattering contribution.

## Delay approximation and limits

The base grid is Δt = 0.01 ft / c = 6.038579568077248×10⁻⁷ s. It maps each of the 12 coalesced physical sections independently to its nearest positive integer delay. Across these cases the largest one-way section-delay error is 1.11×10⁻¹⁶ s; the largest initial-front timing shift is also 1.11×10⁻¹⁶ s. Exact pre-impact closure and impact are not quantized. Refining the reference grid by 2 (Δt = 3.019289784038624×10⁻⁷ s) returned identical peak, impulse, energy and timing results to the reported digits.

The prototype uses sparse JavaScript maps and retains jar/stuck force histories. It is integer-indexed but not a compact fixed-size circular-buffer implementation. At the lower edge, 144 phases generated 7.88 million interface updates, 4.93 million merged contributions and a 515,704-entry peak pending store. That run took 11.3 s and reached 1.25 GiB RSS, so it is slower and uses more memory than the incomplete exact-event run. Memory/runtime need redesign before considering broader sweeps; that work is outside this experiment.

The lower-edge exact-event reference ends at its existing 500,000-event cutoff, so full-window equivalence there remains unverified. Only the reference position received a half-grid refinement. The geometry’s common wave speed makes these two cases unusually favourable; incommensurate section speeds and recurrence behavior at other OES positions were not tested. No production integration is recommended from this two-position result alone.

## Artifacts and validation

- `experiment.cjs` reconstructs the frozen TCI-inclusive fixture, runs one allowed position and mode, captures handoff and force histories, and checks source/benchmark hashes before saving.
- `recurrence.cjs` contains the isolated sparse integer-delay propagation experiment.
- Position/mode JSON and binary Float64 histories preserve measurements for independent inspection. `*-exact-x1.json` contains exact arrival ticks and force-history samples for the reference window.
- Both scripts executed successfully for the two positions; the reference refinement and exact-event comparisons also completed. `npm test -- --watch=false --runInBand` could not start because Node received Windows `EPERM` while resolving `C:\Users\robha`. No production tests or benchmark results were edited. The workspace already contained unrelated uncommitted changes; nothing was staged, committed or pushed.

## Stage 2

The allocation profile, accepted isolated storage/history changes, before/after measurements and remaining limitations are recorded in [Stage2Report.md](Stage2Report.md).
