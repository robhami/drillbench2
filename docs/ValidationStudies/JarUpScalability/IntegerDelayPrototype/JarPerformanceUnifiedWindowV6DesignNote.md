# Jar Performance Analysis V6 — design note

## Layout

V6 uses a compact, horizontally arranged window with a 940 × 390 px CSS maximum, two permanently visible plots and a 265 px BHA panel. The force and impulse values remain in their chart headers. Both plots use responsive SVGs that fill the chart content width; the chart’s data region uses 278 of 320 SVG units. The panels size to their graph content instead of stretching to the taller schematic. At narrow widths, container queries reflow the content.

The slim schematic has a dedicated, readable component-label column. It shows the reconstructed OES order and dimensions: 5 in drillpipe, 5 in HWDP (274.67 ft), upper 6.5 in drill collar, 33 ft 6.5 in jar, lower 6.5 in drill collar, the STB/DC 89.96 ft/STB/DC 9.84 ft/STB stack, and the 8.5 in TCI bit. It also identifies each STB’s 4.92 ft body, 6.525 in OD, 8.5 in blade envelope and 2.5 ft blades. Upper and lower collar lengths update with the selected jar centre using the captured 748.29 ft BHA top, 16.5 ft jar half-length and 115.56 ft lower-stack datum.

The selected hypothetical jar is distinct from the 641.83 ft fixture reference. The schematic does not show a neutral-point marker: the frozen fixture has no sourced neutral-point result or selected operating condition. Mode and WOB are identified as unavailable. The bottom toolbar contains the position selector, impact velocity, fixture status and optional velocity-plot control.

## Data and interaction

The embedded 16 samples are taken directly from `Stage8Results.json`: `runs[].position`, `worker.result.metrics.peakTensileN / 1000`, `worker.result.metrics.fixedTensileNs / 1000`, and `worker.result.impact.impactVelocityMS`. The force and impulse definitions and units are retained; the 50 ms impulse is displayed in kN·s. Lines connect discrete samples as visual guides only. No interpolation, feasibility envelope or recommended position is calculated.

Changing the selector, clicking a chart marker or clicking the plot area synchronizes both charts, the header values, velocity, collar split and schematic marker. Plot-area clicks convert screen coordinates with `getScreenCTM().inverse()` before mapping to the nearest sample. Every marker is keyboard focusable and Enter/Space selectable; focus stays on the selected marker after the chart refreshes. The 611.83 ft and 613.06 ft markers are less than one CSS pixel apart at these plot widths; use the selector or keyboard marker navigation to choose either precisely when the full-range markers visually overlap.

## Browser validation

Chromium was used with device scale factor 1 to render and inspect 850 × 400, 900 × 450 and 1200 × 650 CSS viewports. The measured window and chart geometry was:

| CSS viewport | Window box | Force / impulse panel widths | Data plot widths | Plot / usable panel width |
|---|---:|---:|---:|---:|
| 850 × 400 | 838 × 388 px | 271.5 / 271.5 px | 225.4 / 225.4 px | 86.9% / 86.9% |
| 900 × 450 | 888 × 390 px | 296.5 / 296.5 px | 247.2 / 247.2 px | 86.9% / 86.9% |
| 1200 × 650 | 940 × 390 px | 322.5 / 322.5 px | 269.7 / 269.7 px | 86.9% / 86.9% |

At 850 px, 300 px chart panels do not fit alongside the 265 px labelled schematic and window gutters. The plot width target is still exceeded; axes and the 9 px component labels remain readable in the captured browser render. At 900 px, panels are within a few pixels of 300 px; at 1200 px they are within the 300–340 px target. All three renders showed no clipped axis labels, component-label overflow or document-level horizontal/vertical overflow. The body content fit its available height without scrolling. The selected-position label and collar lengths remained within the schematic at every sample.

Automated in-browser checks passed for all 16 exact Stage 8 mappings, selector/header/velocity/schematic synchronization, chart-marker and keyboard selection, transformed plot-area selection, position-dependent collar lengths, the hidden-by-default velocity plot toggle, and the NP-unavailable state. The two primary charts remained present when the velocity plot was enabled. Embedded JavaScript syntax was also checked.

## Preview and limits

Open `JarPerformanceUnifiedWindowPrototypeV6.html` directly in a browser. It has no server or application dependency. This remains a standalone visual design; its fixture metrics are idealised research outputs, not production predictions for an arbitrary BHA. It does not call production calculations or the research solver. Chart markers at the two closely spaced samples can visually overlap, so selector and keyboard selection are the reliable means to select those samples individually.
