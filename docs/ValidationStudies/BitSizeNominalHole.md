# Bit Size and nominal open-hole clearance

BHA Data Entry exposes Bit Size (in) using the existing persisted `bha.holeSize`
field. Analysis Inputs shows that same value read-only; BHA Data Entry is the
primary editing location. No second
storage key, default diameter or migration is introduced. Existing saved hole
sizes retain their value; records without a value display Not Configured.
Existing save/load, duplication and workspace persistence apply unchanged.

For now the entire nominal open hole is assumed uniform and equal to Bit Size.
It is not a measured/caliper diameter, a cased-hole profile or an underreamed
diameter. Real hole size can differ. Underreamers and variable hole profiles are
deferred in `docs/5_Backlog.md`.

`componentNominalClearance` computes `(Bit Size - component OD)/2` in inches.
Both dimensions must be finite and positive. Negative clearance is preserved
and flags OD larger than nominal hole; equality flags no positive clearance.
The BHA table displays actionable dimension and clearance errors when relevant;
routine row information icons and hover explanations are omitted.
`calcDeployedNominalClearances` reuses depth-dependent deployment and component
positions to return clearance, actual length and MD extent for every deployed
component. Depth must be explicitly provided; Auto DP reference depth and
shared analysis depth are not conflated. Clearance does not depend on length,
but the set of deployed components does. Saved manual pipe lengths are unchanged.

Stage 4C already reads `bha.holeSize` as its default wellbore diameter, so Bit Size
propagates without modifying buckling or force equations. Explicit engineering
wellbore overrides retain their existing precedence. Positive clearance does not
establish buckling applicability, tool passability, firing or operational safety.
Missing modulus and other required model inputs still prevent evaluation.

Analytical checks: an 8.5-in bit with 5.5-in OD gives 1.5-in radial clearance;
9.5-in OD gives -0.5 in and an oversize warning. An 8-in bit with 6-in jar OD
gives 1 in, and 5-in DP gives 1.5 in at both 1000 and 2000 ft bit MD while
deployed DP length changes from 980 to 1980 ft. Regression tests also verify
Stage 4C propagation, explicit bore overrides, invalid dimensions and persistence.

Validation run: 730 tests passed across 43 suites, including 13 added regressions.
Production build passed with existing unrelated lint warnings. Working-tree and
new-file whitespace checks passed. No force, inverse or buckling equation changed.

## BHA layout follow-up

Bit Size and Auto DP reference MD use a wrapping top row. The component table
uses a fixed compact 670-px width. Its columns are 24/28/65/245/60/60/70/90/28 px
for drag handle, number, Type, Tool, OD, ID, WT, LEN and delete respectively.
Numeric fields are centred. Auto DP mode and calculated length occupy separate
lines within LEN. The default floating-window width remains 760 px; wider windows
do not stretch the table. Only its wrapper scrolls below the minimum width.
Editing help, row information icons and explanatory hover text are removed;
accessible control labels and actionable validation errors remain.

Headless Chrome checks at 1000/760/520/300-px floating-window widths found no
controls outside their table cells. There was no horizontal table scrolling at
1000/760 px; scrolling was contained at 520/300 px. Long selected tool names use
ellipsis without changing the selected value. Browser checks verified centred
numeric inputs, exact column widths, Auto output, primary-editor to
read-only Bit Size synchronization, add/remove, keyboard reordering and reload
of BHA values and saved window width. Unit tests cover numeric edits, removal of
help/icons and control placement; existing persistence/workspace regressions remain passing.
After this UI-only follow-up, all 732 tests in 43 suites passed, production
build passed with existing unrelated warnings, and whitespace checks passed.
