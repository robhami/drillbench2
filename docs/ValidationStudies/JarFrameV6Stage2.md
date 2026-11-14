# JarFrame V6 Stage 2 - frozen Stage 8 OES research viewer

The Stage 8 demo is an explicitly selected presentation mode. The presentation opens in **Loaded BHA** mode with all dynamic-result charts unavailable. Demo mode renders only the 16 runs whose status is `recorded` in `docs/ValidationStudies/JarUpScalability/IntegerDelayPrototype/Stage8Results.json`.

The small immutable display fixture is `src/Apps/JarConfiguration/Stage8OesResearchFixture.v1.json`, version `stage8-oes-research-v1`. Its source SHA-256 is `4badaf85e9507c06ef00a7b9c8972ae922be73d7defff7ec45c2f05a61cfbf84`; the canonical JSON array of its 16 `samples` has SHA-256 `877156a518b42399bcfd7ce64efb9952fd768bfd84625af0f296a4aec77a824e`.

Each fixture row contains only position (`positionFt`), peak tensile impact magnitude (`peakTensileImpactForceKN`), fixed 50 ms tensile impulse (`tensileImpulse50msKNs`), and impact velocity (`impactVelocityMS`). The force and impulse source metrics are in N and N·s and are divided by 1000 to present kN and kN·s. Velocity is copied unchanged in m/s. Sample values remain full precision in the fixture; the chart readouts use the V6 prototype's 2-decimal force/impulse and 3-decimal velocity formatting. A connected chart stroke is a visual guide between discrete points and does not supply intermediate results.

The React bundle imports this reduced fixture only. It does not import or execute the Stage 8 recurrence solver, worker, or numerical histories. Tests compare all 16 reduced rows exactly with the recorded source rows, verify the source hash, and pin the canonical reduced-sample hash. They do not rewrite or otherwise modify research artifacts.

The fixture reference position remains 641.83 ft. Demo selection moves only the hypothetical fixture marker and the synchronized chart selection. The selected fixture position is not the loaded BHA jar position. In Loaded BHA mode, the schematic is built only from the current BHA rows and fixture charts/data are not rendered. Neither mode writes BHA rows, selected-jar inputs, saved inputs, or engineering results. Neutral point and mode/WOB remain unavailable for the frozen demo.

Both views retain **PRELIMINARY — NOT FOR OPERATIONAL USE**. The Stage 8 values are historical research outputs for this reconstructed fixture, not predictions for a loaded assembly and not operational guidance.
