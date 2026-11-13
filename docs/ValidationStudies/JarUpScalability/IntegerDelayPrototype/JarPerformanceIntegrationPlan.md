# Jar Performance Analysis — Production Integration Plan

**Status:** investigation and design plan only. No production files or prototypes were changed.

## Executive summary

JarFrame already has the right host for this feature: the active application uses the resizable, movable floating windows in `WorkspaceV2`. The safest route is to replace the content registered as `jarConfiguration` (currently titled **Jar Position Analysis**) and retain that module type and window id. That preserves existing per-BHA window geometry and saved visibility. The new window should compose existing BHA/static-analysis functions and positioning controls; its charts should display either clearly bounded research-fixture data or, only after separate validation and implementation, results returned by a future background calculation service.

The current **Impact & Impulse** window (`jarPlacement`) is not just another view of the Jar Position Analysis code. It owns its own input workflow and saved `bha.jarImpactInputs`. Retiring its navigation entry must therefore be a separate migration phase: retain a legacy loader/hidden registration long enough to migrate its layout, and preserve or explicitly migrate saved input data and any supported workflow. **Neutral Point Behaviour** remains an independent window using its existing shared BHA, survey, drilling-mode, and load-analysis path. BHA Data Entry remains the only editor/source of truth for the installed assembly.

## Current architecture and source map

The active path is `src/App.js` → `src/WorkspaceV2/Workspace.js` → `FloatingWindow` → `Widget` → `WidgetRegistry`. `App` owns `well.currentBha` and supplies the shared `bha`, mutation callbacks, saved-BHA actions, and validation context. `Workspace` owns the per-BHA window list, focus/z-order, viewport adaptation, mounting, and the common analysis settings. It does not own BHA engineering data.

| Concern | Current source of truth / implementation |
|---|---|
| Active application entry | `src/App.js`; sets `USE_WORKSPACE_V2 = true` and passes BHA and update callbacks into `WorkspaceV2/Workspace.js`. |
| Shared BHA state and edits | `src/App.js` (`well.currentBha`, `updateBha`, row callbacks, load/save actions); `src/Apps/BHAEntry/BHAEntry.js` wraps `Components/BHABuilder/BHABuilder.js`, which edits through those callbacks. |
| Workspace navigation and window creation | `src/WorkspaceV2/Workspace.js`; `MODULES` sidebar entries from `src/WorkspaceV2/floatingLayout.js`; component/title lookup in `src/WorkspaceV2/WidgetRegistry.js`. Opening a module creates or re-shows one window per module type. |
| Drag, resize, maximize, minimize, close | `src/WorkspaceV2/FloatingWindow.js` uses `react-rnd`; header is the drag handle, resize/move/visibility/maximized changes are reported to `Workspace` and persisted. `src/WorkspaceV2/FloatingWindows.css` and `Workspace.css` style the host. |
| Saved layout and defaults | `src/WorkspaceV2/floatingLayout.js`: `wellbenchFloatingLayoutV1`, keyed by BHA id (or `draft`); `defaultWindows`, `projectWindow`, `arrangeWindows`, `sanitize`, and legacy Docking/Workspace migration. |
| Widget validation and shared calculation context | `src/WorkspaceV2/Widget.js` gates most analysis modules on `assessBhaReadiness`, deployment and survey coverage; passes BHA, deployed BHA where configured, `updateBha`/row callbacks, `analysisBitMdFt`, shared `drillingMode`, survey and other context. `useWorkspaceAnalysis.js` owns workspace-level drilling mode and surface-reference MD. |
| Current Jar Position Analysis | `src/Apps/JarConfiguration/JarConfiguration.js` → `RealBhaComparison.js`. It selects a jar, calculates actual-BHA static results, shows jar/neutral-point relationships and non-destructive candidate alternatives. `src/engineering/jar/realBhaComparison.js` supplies `listComparisonJars`, `comparisonGeometry`, `relocateComparisonJar`, and `calculateRealBhaStatic`. |
| Current dynamic comparison inside Jar Position Analysis | `src/Apps/JarConfiguration/RealBhaDynamicComparison.js`, `JarUpIterationTable.js`, `iterationTablePresentation.js`; preparation/geometry in `src/engineering/research/jarUpSweep.js`, dynamic mapping/settings in `realBhaDynamicComparison.js` and `realBhaSkeemComparison.js`; `createRealBhaDynamicWorker.js` and `realBhaDynamicWorker.js` form a Web Worker boundary. This is the current research/Skeem workflow and must not be conflated with the frozen Stage 8 recurrence fixture. |
| Existing Impact & Impulse window | `src/Apps/JarPlacement/JarPlacement.js` → `JarPerformance.js`; current Jar Up/Down preparation and impact inputs, force chart and preliminary analytical outputs. It stores `jarImpactInputs` through BHA updates. Its optional `ResearchComparison.js` is another research workflow, not the Stage 8 compact recurrence. |
| Neutral Point Behaviour | `src/Apps/JarClearance/JarClearance.js`, `CurrentDrillingSummary.js`, `clearanceData.js`, `neutralPointChart.js`; engineering calculation in `src/engineering/jar/jarClearanceAcrossRun.js` and supporting load/trajectory code. It is separately registered as `jarClearance`, receives the shared BHA/survey/mode/depth, and manages its own study settings and worker requests. |
| Static jar/neutral-point analysis | `src/engineering/jar/jarAnalysis.js` and `src/engineering/forces/calcStraightDrag.js` are relevant to the Reference/Slide/Rotate load-profile pathway; `jarAnalysis.js` calculates placement relative to a zero crossing. `calculateRealBhaStatic` currently uses `calcSurveyAxialLoads` and deployment. Preserve existing outputs first, then explicitly reconcile the load-profile source with the application’s authoritative selected-mode profile before unifying displays; do not create a UI-local load calculation. |
| Engineering String 3D | `src/Apps/EngineeringString/EngineeringStringCard.js` and `EngineeringString3D.js`; derives deployed component positions, survey/load/neutral-point information and renders Three.js geometry. It is a separate registered visualisation, not the owner of the BHA or jar calculation. |
| Engineering inputs/results conventions | `src/Apps/AnalysisInputs/AnalysisInputs.js`, `src/Apps/EngineeringResults/EngineeringResults.js`, `src/Components/BHABuilder/bhaReadiness.js`, `src/engineering/bha/deployDrillstring.js`, and the engineering modules above. Keep detailed calculation audit in Engineering Results and use existing readiness/deployment/validation APIs. |

There is also `src/WorkspaceV2/DockingWorkspace.js`/`dockingLayout.js` using Dockview, but `App.js` currently selects the floating `Workspace.js`. The new feature should not import a prototype window frame or build its own draggable/resizable shell.

### Existing behaviors to preserve

- BHA readiness, deployment, survey-coverage and component-property errors remain visible and block unsupported analyses.
- Jar selection is explicit; no jar is silently substituted. Current real-BHA relocation is constrained to its supported adjacent uniform collar case, preserves row order and metadata, transfers footage without adding collar inventory, and rejects unsupported geometry instead of inventing it.
- Static neutral-point and jar loads remain derived from the existing engineering pathway and selected drilling mode. Do not independently recompute a second “UI neutral point.”
- Existing Jar Up/Down input semantics, acknowledgements, provenance, reset behavior, dynamic limitations, and saved `jarImpactInputs` must be reviewed and either carried forward or deliberately migrated before retiring Impact & Impulse.
- Keep the preliminary/not-for-operational-use status and the detailed Engineering Results audit; the new performance presentation must not turn into an unqualified recommendation dashboard.
- Keep Neutral Point Behaviour independently openable beside the new window. Keep Engineering String available as an optional 3D view during initial integration.

## Design reference findings

`JarPerformanceAnalysisPrototype.html` supplies the preferred dark-navy/blue/orange visual language and slim BHA schematic. `FullRangePlacementDemo.html` supplies the preferred simultaneous three-chart treatment. `JarPerformanceUnifiedWindowPrototype.html` demonstrates one unified window and synchronised selected-position state. `JarPerformanceUnifiedWindowPrototypeV2.html` was **not present** at inspection. These files are standalone design references only; the prototype draggable frame, placeholder calculations, and fixed research data are not production components.

`Stage8Results.json` contains 16 reconstructed OES BHA placement records for one frozen geometry/settings fixture. Its position-to-metric fields are the recorded jar-centre position, `result.metrics.peakTensileN`, `result.metrics.fixedTensileNs`, and `result.impact.impactVelocityMS` (render with the source units/definitions in the fixture and its Stage 8 report). Treat each row as a discrete datum. Do not interpolate, extend to other BHAs, or label the greatest/smallest row a recommended optimum. Stage 8’s agreement with its saved recurrence baseline and available exact-event comparisons is not independent validation for arbitrary user assemblies.

## Proposed component and data flow

Retain the manager’s `jarConfiguration` module type and replace its registered content with a `JarPerformanceAnalysis` composition. Keep state and physics in the existing owning layers; the new component coordinates presentation and candidate selection.

```text
App.well.currentBha (actual installed BHA; sole persisted assembly)
  ├── BHA Data Entry → App update callbacks → currentBha
  └── Workspace (per-BHA window layout + shared analysis settings)
        ├── Jar Performance Analysis [jarConfiguration]
        │     ├── existing static placement/load services → actual static results/limits
        │     ├── candidate-position state → selected chart point + schematic overlay
        │     ├── frozen Stage 8 fixture adapter → research-only dynamic metrics, when explicitly in fixture demo
        │     └── future validated dynamic request/result adapter → background worker/process (not Stage 8 solver)
        ├── Neutral Point Behaviour [jarClearance] → existing survey/load/trajectory analysis
        └── Engineering String [engineeringString] → optional existing 3D view
```

Suggested boundaries (names are proposed, not existing files):

1. `JarPerformanceAnalysis` container under `src/Apps/JarConfiguration/` owns view-only selection state, composes sections, and does not calculate force or mutate BHA when a point is clicked.
2. `JarPerformanceControls` wraps/reuses current validated jar selection, placement constraints, conditions, warning and result sections from `RealBhaComparison`/`RealBhaDynamicComparison`. Extract only as needed; do not fork their input/validation logic.
3. `JarPerformanceCharts` receives an explicit discrete series/result object with units, provenance, applicability, validation status, and position id. It draws peak force, 50 ms tensile impulse, and impact velocity together. Click/keyboard selection emits a candidate position id/value to the container.
4. `JarSchematic` receives actual deployed section geometry plus separate actual-jar and candidate-jar markers. Use existing `calcComponentPositions`/`comparisonGeometry` and validated mapping; do not infer BHA sections from chart ranges or approximate OD when actual geometry is unavailable.
5. `SelectedPositionSummary` formats the selected datum and reports static constraints/warnings separately from dynamic outputs.
6. `DynamicAnalysisService` (future boundary) accepts an immutable, validated input snapshot and returns progress, status and a complete result envelope. It owns worker/process lifecycle, cancellation and hard resource containment. The UI only renders progress and accepted terminal results. Never import `IntegerDelayPrototype/recurrence.cjs` into production.

## State ownership and update rules

| State | Owner | Required behavior |
|---|---|---|
| **Actual BHA configuration** (rows, geometry, component selections and persisted inputs) | `App` / saved BHA model; edited through BHA Data Entry callbacks | Read-only to chart and schematic interactions. Persist only through existing BHA save/update flow. |
| **Selected jar and installed position** | Derived from the actual BHA row selection and existing deployed geometry | Label as “installed/current”. Changing selected tool uses explicit existing selection and does not silently select another jar. The schematic shows this marker independently of a hypothetical candidate. |
| **Hypothetical assessed position** | Local Jar Performance Analysis presentation/request state; keyed by discrete candidate/result id | Selecting a plot point synchronises all three highlighted points, selected metrics, and candidate schematic marker. It does not call `updateBha`, alter row lengths, or change static results for the installed BHA. Clearly label “candidate / not applied.” |
| **Neutral point and placement limits** | Derived from existing load profile, survey, depth, selected drilling mode and existing constraints | Display the source mode, load profile/depth and applicability. Constraints may mark a candidate as unsupported/infeasible; do not silently remove or interpolate it. Neutral Point Behaviour continues its own independent settings and full behaviour. |
| **Dynamic force/impulse/velocity results** | For current design review, frozen named Stage 8 research fixture only. Future production owner: validated calculation service response | Every result carries input/geometry identity, units, metric definition, model/version, provenance, completion status, validation state and applicable warnings. Incomplete, cancelled, stale or resource-limited runs cannot be represented as valid. |

An **Apply selected position** action is a separate, deliberate operation. Before enabling it, construct a candidate through supported relocation logic (currently `relocateComparisonJar` Mode A has narrow adjacent-collar constraints), pass BHA readiness, deployment, structural mapping, survey and engineering validation, and present the exact row-length changes for review. Only confirmed Apply calls the established App mutation callback; rejection leaves the actual BHA and saved state unchanged. If the selected jar geometry cannot be safely relocated, Apply is unavailable with the validation reason. Do not apply merely because a user clicked a chart marker.

## Responsive window specification

### Existing manager sizing and persistence

- `floatingLayout.defaultWindows()` currently gives `jarConfiguration` a default width of `min(1260, workspace width - 24)` and height of `min(640, workspace height - 24)`. `Workspace.open()` expands a too-narrow saved `jarConfiguration` window to near the available workspace width (up to 1260 px) on opening. This makes it a natural large analysis window.
- `FloatingWindow` provides move, resize, maximize/restore, minimize and close. The generic hard minimum is currently approximately 300×180 px (clamped to the current rectangle); that is a shell minimum, not a usable size for three charts.
- `arrangeWindows()` uses approximately 420 px per tile column and switches to rows in narrow workspaces. At this width, all three charts cannot be simultaneously legible side by side; use a stacked/reflowed view with vertical scrolling rather than compressing labels/text.
- Layouts are saved under `wellbenchFloatingLayoutV1` by BHA id. `sanitize()` merges saved geometry into current defaults for known module types and discards unregistered types. Older Docking and legacy layouts are migrated by `loadFloating()`; original source storage is described as preserved by that migration.

### Recommended behavior

- **Default:** open near full available workspace width, capped at 1260 px; target about 1100–1200×760 px where viewport allows. Keep charts above the fold as much as practical.
- **Comfortable desktop minimum:** target roughly 900×600 px for a two-column chart area plus schematic. Treat this as a reflow breakpoint, not a reason to prevent shrinking or tile placement.
- **Compact/tiled:** at widths below about 900 px, show the two primary plots together in a two-column row only while each has adequate plotting width; otherwise stack them. Move the slim schematic and selected metric summary below/alongside the plots. Keep the third impact-velocity plot visible in the same page flow, not behind a tab or collapsed panel. At 420 px tiles and below, stack all plots and allow horizontal scrolling only for genuinely wide audit tables, not for the normal chart canvas.
- **Height:** charts use a readable minimum plot height (target 190–220 px); compact height may reduce chart height but not font below application typography. The window body scrolls; positioning controls, constraints, warnings and detailed results remain below the three plots and are not duplicated. Maximize uses the current host’s full visible canvas.
- **Schematic:** use a slim horizontal/vertical section schematic with bit, actual section changes, stuck point/neutral-point marker where defined, installed jar, and candidate marker. Reflow beside charts on wide windows and below them on narrow windows. Avoid deriving geometry from the Stage 8 fixture when showing the user’s actual BHA.
- If a per-window minimum is eventually added, make it viewport-aware and coordinate with `arrangeWindows()`; do not set a fixed minimum larger than a tiled column or the available screen.

## Saved-workspace and data migration

1. **Keep `jarConfiguration` as the module type and `jarConfiguration1` identity.** Change its title in `WidgetRegistry` to “Jar Performance Analysis” and replace component content. This retains existing Jar Position Analysis window visibility, x/y, dimensions, z-order, maximize and minimize fields through current `sanitize()` behavior. Keep the open-time width promotion but tune defaults/height only after responsive testing.
2. **Retiring `jarPlacement` needs explicit compatibility.** Do not simply remove it from `MODULES` and `WidgetRegistry`: `sanitize()` drops unknown types and later layout persistence can overwrite the workspace list. Implement a versioned migration or temporary hidden legacy registry entry that maps old visible `jarPlacement` to the new `jarConfiguration` without creating two windows. If both were visible, use the existing `jarConfiguration` geometry as primary; preserve a recoverable copy of the original layout during migration. Test existing and legacy keys.
3. **Preserve `bha.jarImpactInputs`.** Audit its schema and current consumers. Either keep a compatibility reader/writer and move the controls without changing saved fields, or implement an explicit, tested schema migration. Do not delete old values when the navigation entry is hidden.
4. **Per-BHA layouts:** test loaded/saved BHAs, draft-to-first-save transfer, old saved layouts, layouts with both jar modules open, and switching between BHA ids. Window migration must not change BHA rows or analysis inputs.
5. Keep `jarClearance` and `engineeringString` module ids unchanged so their independent windows/layouts restore normally.

## Numerical integrity, research fixture and background boundary

The Stage 8 OES points must be packaged/selected as an explicitly named, immutable **idealised research fixture** associated with its exact reconstructed geometry, physical inputs, jar/stuck-point setup, time-grid/refinement, metric definitions and provenance. Show a persistent label such as “Idealised Stage 8 research results — fixed OES fixture; not production validated; not an engineering recommendation.” Do not imply these values are calculated for the active BHA merely because the user has that BHA loaded. Prefer a visibly separate research demonstration mode with fixture identity and applicability displayed; otherwise do not display the fixed values in a live arbitrary-BHA workflow.

Use only the 16 stored positions and exact recorded metric values. Do not interpolate between positions, infer a continuous feasible envelope, extrapolate to a new jar/BHA, or call a point “optimal.” Preserve exact position-to-value mapping and source definitions/units. Display a candidate selection as a discrete fixture row. Static real-BHA neutral-point/placement outputs and idealised OES dynamics must be separated visually and textually; no synthetic combination may suggest one validates the other.

For live analysis, the future boundary is an independent calculation service reached through a Web Worker or, if memory containment requires it, a bounded child/server process. The request should contain a versioned immutable BHA/survey/conditions snapshot and unique request id. The response must distinguish queued/running/completed/invalid/incomplete/cancelled/timeout/resource-limit/error, report progress, and carry input hash, solver/version, validation diagnostics, and units. UI cancellation invalidates the request and prevents stale results from replacing newer state. Do not let a worker return a “valid” result after cancellation, timeout, OOM or failed engagement/energy checks.

Before commercial engineering use, complete independent physics validation beyond recurrence-versus-itself/Stage 4 equivalence; extend exact-event/full-window comparisons in cases currently cut off; verify nonuniform interfaces/boundaries, impact handoff, late arrivals, energy and maintained engagement over supported geometries; define supported BHA/tool applicability and source-backed inputs; and establish hard memory/runtime/cancellation containment. Stage 9 measurements show sampled process memory thresholds are best-effort, not a hard OS-enforced ceiling (the synthetic memory-limit test overshot its configured limit). Browser/Web Worker isolation alone does not provide a dependable hard memory cap. Resolve this through enforceable process/container limits and failure tests before offering unconstrained live sweeps.

## Phased implementation plan

1. **Inventory and contract tests.** Record current Jar Position Analysis and Impact & Impulse fields, outputs, saved BHA input schema, disabled/unsupported states, and window layout behavior. Add migration tests before removing any registration. No calculation change.
2. **Host/content replacement.** Retain `jarConfiguration` id; rename its registry/sidebar/window title and mount a unified composition inside the existing `FloatingWindow`. Preserve preliminary warning, readiness gates, controls, static results and audit links. Keep the current workflow available until parity is accepted.
3. **Unified presentation with static source.** Reuse actual BHA geometry, selected jar, load/neutral-point, position constraints and supported relocation APIs. Add distinct actual/candidate markers and synchronized UI state. Add explicit validation and Apply review; do not mutate BHA on selection.
4. **Three-plot research fixture preview.** Add a fixture-only adapter for the exact Stage 8 JSON rows; show all three charts, units/definitions, provenance, fixture restrictions and no-optimum language. Verify all values against JSON automatically. Do not make this the default result for a live arbitrary BHA.
5. **Workflow migration and retirement.** Once feature parity and migration are accepted, hide/retire the Impact & Impulse nav entry with a versioned layout/data migration, maintaining legacy input compatibility and recovery. Keep Neutral Point Behaviour and Engineering String independently available.
6. **Future live dynamics discovery/validation.** Separately define physics, input provenance, applicability, independent validation, resource envelope and worker/process contract. Implement only after the required engineering review; never substitute the Stage 8 fixture solver for production calculations.

## Risks, dependencies and acceptance criteria

### Principal risks / dependencies

- The Stage 8 fixture is a single idealised reconstructed OES case set; arbitrary user BHA presentation would be a material misrepresentation.
- The existing Jar Position Analysis static path and other windows may use different load construction paths. Resolve/reconcile the selected-mode source of truth before presenting a unified set of results; do not silently change calculations as a UI task.
- Current actual relocation support is narrower than a general continuous position sweep. Mixed, segmented, complex, inventory-constrained and unsupported jar-adjacent sections must remain explicitly rejected unless an engineering rule is implemented and validated.
- The old Impact & Impulse window includes user-entered/saved inputs and separate Jar Up/Down work; deleting it before schema and capability migration risks data loss or hidden workflow loss.
- Per-BHA layout migration is keyed by module type and the sanitizer discards unknown types; compatibility must be proven across old floating, Docking and legacy layouts.
- A Web Worker improves responsiveness but cannot enforce a hard memory cap. Stage 8 worst-case memory/runtime and Stage 9 limit-test overshoot require a containment design for future live sweeps.

### Acceptance criteria before retiring legacy navigation

- Existing saved BHA data and all `jarImpactInputs` remain readable, unchanged unless an explicit migration is documented and verified.
- Existing Jar Position Analysis layouts reopen as Jar Performance Analysis with reasonable saved geometry; old layouts with both jar windows do not create duplicates or lose recoverable state.
- BHA Data Entry remains sole source of actual assembly edits. Chart selection never mutates BHA; Apply is explicit, validated, reviewable, and leaves BHA unchanged on failure/cancel.
- Neutral Point Behaviour remains separately openable beside the new window with existing shared analysis behavior; Engineering String remains optional and available.
- Two primary plots, impact-velocity plot and schematic remain present through responsive reflow; no tabs/collapsed region hides a primary plot. Controls/warnings and detailed existing engineering outputs remain accessible below.
- Fixture values/units/definitions map exactly to Stage8Results.json, are visibly restricted to that named fixture, and do not interpolate, extrapolate or recommend a position.
- Readiness, deployment, survey, material/provenance, geometry and numerical error states remain blocking and traceable; no incomplete/failed dynamic run can be shown as a valid result.
- Independent engineering validation and resource-containment requirements are reviewed before any commercial live dynamics release.

## Inspection scope

This document records source inspection and a proposal only. No application source, route, window configuration, calculation, solver, test, prototype or benchmark result was modified. No test suite was run because no implementation was made.
