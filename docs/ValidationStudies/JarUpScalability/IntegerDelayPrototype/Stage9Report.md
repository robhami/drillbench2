# Integer-delay recurrence: Stage 9 bounded child-process prototype

**PRELIMINARY — NOT FOR OPERATIONAL USE.** The runner and all results remain in the isolated research directory. The recurrence, production code, tests and Stage 4/8 benchmark results were not modified.

## Prototype and result gating

`stage9.cjs` starts one Node child per jar position and awaits its exit before starting the next. Default limits are 60 s per position, a 1,536-MiB sampled child working-set threshold and a 100-ms requested polling interval. Environment variables can set the position list, runtime limit, memory threshold and poll interval. The runner emits JSON progress records at position start, once per second while running and at completion. Records include position, status, elapsed time, sampled memory and remaining positions; `Stage9Progress.jsonl` preserves the stream.

The supervisor reports an engineering result as valid only after a zero child exit, a readable result artifact, a complete valid 50-ms solver result, no observed resource-limit violation and a passing comparison with that position's Stage 8 baseline. Jar/stuck history files are compared byte-for-byte; impact, geometry, energy audits, engagement, metrics, delay mapping, update count and pending peak are also checked. Cancellation, timeout, memory-limit termination, monitor failure, nonzero exit, abrupt termination, missing output and a baseline mismatch all produce `validEngineeringResult: false`. The sweep stops after any such result; later positions are marked not started.

## Full sweep measurement

All 16 Stage 8 positions completed sequentially under the default limits. All 16 passed the Stage 8 equivalence checks. No position was skipped, cancelled, timed out or marked over the configured memory threshold.

| Measure | Stage 8 baseline | Stage 9 child-process sweep |
|---|---:|---:|
| Sum of per-position solver/wrapper runtimes | 29.117 s | 34.833 s |
| Sum of supervisor wall time for positions | — | 40.319 s |
| Maximum single-position wall time | 13.605 s | 16.046 s |
| Maximum child-reported / observed peak RSS | 1,071.1 MiB | 1,048.6 MiB |
| Maximum updates | 19,081,684 | 19,081,684 |
| Results matching baseline | — | 16 / 16 |

The measured supervisor wall overhead summed to 5.486 s across the 16 positions, with a maximum 487 ms for one position. Stage 9's aggregate wall time was 11.202 s higher than the Stage 8 run. This is a single-run comparison: it includes process supervision and PowerShell RSS sampling, while host/runtime variation also affects the child calculation. The memory polling subprocesses are relatively expensive on short cases. The 731.78-ft worst case completed in 16.046 s wall time (15.607 s inside the calculation wrapper) and peaked at 1,048.6 MiB. These measurements support a background-process research workflow, but indicate that polling and process-start overhead should be measured and optimized before interactive product use.

Every Stage 9 force-history file matches its Stage 8 file byte-for-byte. The compact solver's force samples, exact phase arrivals, energy residuals, maintained engagement and numerical diagnostics therefore remain unchanged under child-process execution. The Stage 8 exact-event validation limitations still apply; this runner does not add independent physics validation.

## Failure-path tests

`Stage9TestResults.json` records six passing tests:

| Test | Outcome |
|---|---|
| Normal child completion and Stage 8 baseline comparison | Passed; result accepted only after complete validation |
| Cancellation | Passed; active child terminated and next position not started |
| Runtime limit | Passed; timed-out child terminated and result rejected |
| Sampled memory threshold | Passed as a trigger; child terminated and result rejected |
| Nonzero child exit | Passed; result rejected and remaining position skipped |
| Abrupt child termination (SIGKILL simulation) | Passed; result rejected and remaining position skipped |

Cancellation and termination are effective at the process boundary. The abrupt-exit test simulates a kernel-style kill; it is not a test of an actual operating-system OOM event. Any unrecognized nonzero exit or signal remains invalid, so a genuine OOM kill cannot be accepted as an engineering result.

## Memory-limit reliability

The configured memory threshold is **best-effort sampled enforcement, not a hard OS limit**. In this Windows workspace `tasklist.exe` returned access denied, so the runner uses PowerShell `Get-Process` to sample the child working set. The sample can arrive late: the synthetic test used an 80-MiB limit but the process reached about 286 MiB by the sample that triggered termination. The runner correctly marked it incomplete, but the overshoot shows that this mechanism cannot protect a host that must never exceed a strict memory ceiling.

For constrained or multi-user execution, place the child in a Windows Job Object with a process memory limit and kill-on-job-close, or an equivalent OS/container control. Keep the sampled monitor as an additional diagnostic and status check. Until that hard limit is implemented and tested on the target host, the memory-limit feature must not be described as a guaranteed cap. Runtime limits use a supervisor timer and were exercised with a short forced timeout; limits can overshoot by scheduling/termination latency.

## Artifacts and remaining risks

- `Stage9Results.json` contains all 16 result records, validation comparisons, memory/runtime measurements and structured progress events.
- `Stage9Progress.jsonl` is the chronological progress stream.
- `Stage9TestResults.json` records normal completion and failure-path tests; the individual `Stage9Test*.json` and `.progress.jsonl` files preserve their runs.
- `stage9.cjs` contains the isolated runner and test harness.
- `*-recurrence-x1-stage9.json`, `*-jar.f64` and `*-stuck.f64` preserve the child results.

The prototype demonstrates sequential background execution, cancellation, runtime termination, explicit memory-threshold failure, child-failure rejection and numerical equivalence. It does **not** provide a reliable hard memory cap yet, and actual kernel OOM behavior was not induced. Before any production or constrained-host use, add and test OS-level memory containment, test genuine out-of-memory termination semantics, and assess the measured supervision overhead on the target deployment environment. The existing validation gaps for late stuck-point arrivals remain open. No changes were staged, committed or pushed.
