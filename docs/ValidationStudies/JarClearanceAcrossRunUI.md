# Stage 2C — Jar Clearance Across Run UI

Separate Workspace V2 window, opened with **Run** in the sidebar. It uses the
current BHA and the confirmed CSV owned by the Survey window. Existing windows,
saved layouts, survey source values and BHA data are preserved. Older layouts
receive one hidden clearance window; opening it brings it into reachable bounds.
No Stage 2A/2B, Skeem, straight-drag or production jar equations are changed.

Survey publishes a small in-tab change notification after its existing save
attempt, including the source state. The analysis reads that notification and
cross-tab storage events; it never writes survey storage. In-session data still
works if browser storage fails. Survey/BHA changes clear old analysis results.

Initial bit interval is first survey MD + complete BHA length through last
survey MD. No extrapolation. WOB/mud/friction/RPM/ROP initially copy explicitly
present current-BHA inputs; missing physical inputs stay blank. Fields are local
analysis inputs and do not write BHA state. Default avoidance distance is 20%
of the first jar centre's distance above bit, editable as a single common
planning distance for all jars. With no jar the provisional field is 20 ft,
but calculations remain invalid until a jar exists. This is a user planning
criterion, not a manufacturer limit or a new engineering equation.

Input WOB is klbf and converted to lbf. Axial loads are displayed in lbf;
distances/MD in ft. Maximum grid is 2000 scenarios, below the Stage 2B hard cap.
Analysis runs only on **Analyse run**; field edits mark displayed results stale.
Changing the inspected depth/scenario makes one direct Stage 2A profile call,
not another entire grid sweep. Computation is synchronous and large grids/BHAs
may take time; moderate sampling is recommended.

The main line uses actual depth-envelope minima across all requested WOB, mode,
friction and jar combinations. Null clearances stay null with no line bridging.
Within-zone scenario markers retain actual calculated clearances, including
nonminimum scenarios. Sampled jar/NP coincidences are distinct from inferred
sign-change events. Invalid, missing-NP and inferred event markers are on a
categorical status strip, not on the clearance axis. The horizontal threshold
uses the execution's explicit avoidance distance, including for a one-depth run.
No-NP scenarios are not labelled safe. Violation count means number of scenarios
with at least one jar inside the avoidance zone, not number of individual jars.

Scenario inspection includes all jars and all NP/neutral intervals; a nearest
interval projection is explicitly nonunique. The secondary graph uses the exact
returned Stage 2A nodal axial profile. Its X axis is **distance above bit**;
the primary graph X axis is **bit wellbore MD**. Positive load is compression,
negative load tension. Current compression triggers a visible warning.

Existing Plotly dependency and responsive ConfigurationPlot wrapper are reused;
no new dependencies. Plot hover/zoom and floating-window resizing remain available.
Crossings are audited with sampled/inferred labels and refinement requirements.
All Stage 2A/B applicability and sampling limitations remain. This panel is
preliminary engineering inspection, not a certified jar-placement recommendation.

## UI validation

423 tests pass across 25 suites, including 27 new integration/data-mapping tests.
Production build succeeds with the existing unrelated lint/Browserslist warnings.
Targeted lint passes for new panel code/tests and changed production integration
files. The separately checked existing Workspace.test.js retains seven pre-existing
Testing Library lint errors (render-result naming and canvas DOM access); these
are outside this feature and were not refactored. `git diff --check` passes.

Chrome production-browser verification: both Plotly charts render, depth/WOB/mode
inspection works, and resizing the floating window narrows both plots to 324 px.
A no-NP run preserves three null envelope values instead of plotting zeros.
Live Survey import clears old results. Analysis leaves BHA and survey storage
unchanged, and no page errors were recorded. No new charting dependencies.
