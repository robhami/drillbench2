# Vertical model regression cases (2026-10-04)

These are **independent arithmetic/hand-calculation checks** of the simplified equations, **not** published third-party engineering benchmarks or operational validation. Automated cases are in `src/engineering/forces/verticalModel.test.js`. Expected figures below use `BF = 1 − 10/65.5` and are rounded.

| Case | BHA from bit upward | WOB | Expected neutral point | Key check |
|---|---|---:|---:|---|
| 1: Single collar | DC 200 ft × 200 lb/ft | 30 klbf | ~177.03 ft | Top force ~−3,893 lbf |
| 2: Jar below neutral | DC 100 ft × 200; JAR 30 ft × 150; DC 100 ft × 200 | 30 klbf | ~184.53 ft | Jar 100–130 ft entirely compression; top force ~−7,705 lbf |
| 3: Neutral inside jar | DC 160 ft × 200; JAR 30 ft × 150; DC 40 ft × 200 | 30 klbf | ~182.70 ft | Jar 160–190 ft straddles zero; placement warning |

Inputs common to all cases: 10 ppg mud, positive compression/negative tension. Case 1 and case 2 numerical results were checked in the WellBench UI against hand calculations; case 3's neutral point and placement warning were visually checked. The automated tests independently check numerical boundary forces, neutral-point position, and the jar warning.

Run: `CI=true npm test -- --watch=false --runInBand` (from the project root after installing dependencies). Do not treat passing these tests as field validation.

**Further validation needed:** independent published examples; zero WOB and invalid-input behaviour; component boundary cases; directional surveys and drag; manufacturer-specific jar placement requirements.
