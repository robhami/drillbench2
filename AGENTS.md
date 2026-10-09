\# WellBench Development Agent Instructions



\## Role



You are maintaining WellBench, a drilling-engineering analysis application.



Engineering correctness, traceability and validation take priority over speed or UI convenience.



\## Working Method



Before changing code:



1\. Inspect the relevant existing implementation.

2\. Identify the current source of truth for the calculation or state.

3\. Reuse existing engineering calculations rather than duplicating them.

4\. Make the smallest reasonable change.

5\. Do not refactor unrelated code.



After changing code:



1\. Run the relevant unit tests.

2\. Run the complete test suite.

3\. Inspect the diff.

4\. Report:

&#x20;  - files changed

&#x20;  - calculations changed

&#x20;  - assumptions made

&#x20;  - tests added/changed

&#x20;  - test results

&#x20;  - validation results

5\. Stop for user review before committing engineering-model changes.



\## Axial Load Convention



WellBench uses:



\- Positive axial force = compression

\- Negative axial force = tension

\- Zero axial force = neutral point

\- Inclination is measured from vertical:

&#x20; - 0 degrees = vertical

&#x20; - 90 degrees = horizontal

\- User-entered WOB is the axial-force boundary condition at the bit.



Do not change these conventions without explicit instruction.



\## Drilling Load Modes



WellBench supports:



\### Reference

Frictionless drilling reference.



\### Slide

Axial Coulomb drag acts against axial movement.



\### Rotate

Coulomb friction acts opposite the combined axial and circumferential

surface velocity. Only its axial component contributes to axial drag.



All widgets displaying loads or neutral point must use the SAME selected

drilling mode and load profile.



Do not independently recalculate loads inside UI components.



\## Engineering Architecture



Prefer:



BHA/input data

\-> engineering model

\-> engineering calculation

\-> reusable result/load profile

\-> UI presentation



UI components should display engineering results, not contain independent

engineering physics.



`calcStraightDrag` is currently the authoritative drilling load calculation

for Reference, Slide and Rotate analyses.



`calcAxialLoads` is retained as the legacy/basic frictionless axial-load

calculation and may be required by existing models/tests.



Do not remove or replace it without understanding its dependencies.



\## Neutral Point



Neutral point is determined by a zero crossing of the selected axial-load

profile.



Interpolation within a component must be based on the component's calculated

bottom and top axial forces.



\## Engineering Results



Engineering Results is the detailed engineering audit/troubleshooting view.



It should expose sufficient inputs and intermediate calculations to allow an

engineer to understand and reproduce the result.



Do not simplify it into a dashboard.



\## Validation



Engineering calculations require independent validation.



For every new engineering calculation:



1\. Derive an expected result independently where practical.

2\. Add automated tests.

3\. Test important boundary cases.

4\. Compare calculated and expected values.

5\. Do not change equations merely to make a benchmark match.



Existing validation cases must remain reproducible.



\## Jar Engineering



Develop jar analysis progressively:



1\. Static axial-load foundation

2\. Neutral point

3\. Jar position relative to neutral point

4\. Loads at jar

5\. Jar/tool input data

6\. Analytical jar dynamics

7\. Published analytical validation

8\. External benchmark comparison

9\. Position optimisation



Do not jump directly to dynamic impact predictions without validating the

static foundation.



\## Jar Dynamics and Sources



Future jar dynamics should be independently implemented from legitimate

public engineering literature.



Document equation provenance, assumptions and limitations.



JARPRO may be used as an external benchmark for comparison.



Do NOT:



\- clone JARPRO

\- reverse engineer its proprietary implementation

\- derive algorithms from proprietary documentation

\- copy proprietary constants, implementation details or UI

\- tune equations simply to reproduce JARPRO output



Published analytical literature should be the primary physics source.



\## Safety / Product Positioning



Until appropriately validated, jar-analysis outputs must remain clearly

identified as preliminary engineering analysis and not operational guidance.



Preserve the existing preliminary/not-for-operational-use warning unless

explicitly instructed otherwise.



\## Testing



After changes run:



npm test -- --watch=false --runInBand



All existing tests must pass.



New engineering functionality should normally include new tests.



Never resolve a failing engineering test by weakening tolerances or changing

the expected result without establishing the engineering reason.



\## Git



Current development branch:



feature/workspace-v2



Before committing:



1\. Run tests.

2\. Run `git status --short`.

3\. Inspect `git diff`.

4\. Ensure unrelated files are excluded.



Do not commit engineering-model changes until the user has reviewed the

validation results.



Do not push unless instructed.



\## Scope Control



Do not:



\- perform unrelated refactoring

\- rename large parts of the application unnecessarily

\- replace working architecture simply for stylistic reasons

\- introduce a second source of truth

\- silently alter engineering assumptions

\- remove tests merely because they fail



If a task exposes a larger architectural or engineering problem, report it

before expanding the scope.



\## Completion Report



At the end of a task report:



\### Changed

Files and functionality changed.



\### Engineering

Equations/logic used and important assumptions.



\### Validation

Expected versus calculated results.



\### Tests

Tests run and results.



\### Remaining Issues

Anything uncertain, unvalidated or deliberately deferred.



\### Git

Current status and whether changes are ready for review/commit.

