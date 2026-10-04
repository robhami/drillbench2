## [0.2.0] - 2026-08-11

### Added
- 3D Engineering String
- WellBench Vision document
- Updated product roadmap

### Changed
- Product strategy
- Modular architecture planning

### Fixed
- Workspace experiment removed from engineering branch

## Unreleased — 2026-10-04 (documentation and regression tests)
- Documented implemented vertical axial-force equations and positive-compression convention in `VerticalAxialModel.md`.
- Recorded three hand-calculation cases and current validation limits in `Validation.md`.
- Added automated regression tests for axial loads, neutral point and jar interval warning.
- Prior local feature work: jar placement interface and axial profile, BHA Save As and Rename; verify separately against the relevant feature commit.

## Unreleased — straight-hole inclination screening
- Added constant inclination (0–90° from vertical) to Analysis Inputs.
- Projected buoyed axial gravity by cos(inclination) in axial-load and neutral-point models.
- Updated jar screening and axial-profile labels; retained positive compression convention.
- Added independent arithmetic regression cases for 0°, 60°, 90° and a jar crossing the neutral point.
- Documented no-drag, constant-inclination assumptions in StraightInclinationModel.md.
