# DP Auto / Defined length control

The existing row `lengthMode` remains `auto` or `manual`; the latter is labelled
Defined. Legacy rows without mode metadata retain the existing manual default.
The compact Auto / Defined segmented switch, labelled DP, sits immediately
beside MD (ft) above the table. Native buttons support keyboard activation and expose selected state
with `aria-pressed`. LEN contains one centred field, grey and read-only in Auto
and normally styled/editable in Defined. Defined Bit MD is not displayed in the
editor. MD (ft) shows the saved Auto reference and is grey/read-only in Defined
mode and editable in Auto; switching modes never replaces it with total string
length. Its persistence key is unchanged. Saved manual length is never replaced
by the calculated Auto value.

MD is 85 px wide and Bit Size is 65 px; both remain centred and 28 px high.
MD displays thousands separators when idle or read-only, and an ungrouped draft
on focus for ordinary decimal editing. Input with or without commas is accepted.
Valid edited MD is stored as a finite number under the same existing key, never
as a comma-formatted string. Empty and incomplete drafts provide the existing
empty input state rather than a guessed depth. Legacy numeric/string values
remain supported. Display grouping adds no engineering rounding.

Auto uses the existing deployment utility at `drillpipeReferenceBitMdFt`:
DP length = Auto reference MD minus fixed BHA length. Invalid deployment is
reported rather than displayed as a guessed length.

Defined analysis depth is the sum of fixed BHA lengths and the positive saved DP
length, derived in Workspace and passed through the existing shared analysis
depth prop. It is read-only in Analysis Inputs. Invalid/missing lengths clear the
effective analysis depth. Returning to Auto restores Workspace's independent
analysis depth, which remains separate from the saved Auto reference MD. There
is no effect writing depth back into DP length, hence no circular update.
The independent Auto analysis depth retains its existing session-only lifecycle;
Defined depth is reconstructed from persisted BHA lengths after reload.

This is a surface-zero string-length definition. It does not introduce another
surface-reference boundary condition. The existing single uppermost DP policy
is enforced; multiple DP sections or tools above DP are not silently resolved.
No force, inverse, jar, deployment or buckling equations are changed. Other
modules retain their existing depth sources; the existing shared analysis-depth
consumer is Jar Forces.

Independent checks: 300-ft DC + 30-ft jar + 9000-ft Defined DP gives 9330 ft.
Changing the DP to 9500 ft with 300 ft fixed gives 9800 ft. A 12000-ft Auto
reference with 965 ft fixed gives 11035 ft DP. Editing Defined DP to 9000 ft
gives 9965 ft analysis depth without modifying that Auto reference.
A 12000-ft reference with 515 ft fixed gives 11485 ft DP; changing the reference
to 10000 ft gives 9485 ft DP, without changing the saved Defined length.

Automated regressions cover mode round trips, manual editing, invalid/missing
lengths, shared analysis-depth updates, restoration of the independent Auto
analysis depth, and reconstruction from saved BHA data. Browser checks at
1000/760/520/300-px window widths cover alignment, contained scrolling, mode
switching, editing, reload, insertion/deletion and keyboard reordering.

Validation: all 741 tests in 44 suites passed. Production build passed with
existing unrelated lint warnings. Working-tree and new-file whitespace checks
passed. Browser measurements confirmed 670-px table width, 32.8-px component row
heights and no overflowing controls at all four tested window widths.
Keyboard Space activation selected both segments; the selected button state,
grey locked Auto field, Defined editing and absence of Defined Bit MD display
were checked in Chrome. Save/reload and manual-length preservation also passed.
The MD/DP layout follow-up retained same-line placement at all four widths and
removed the switch from the table row. MD stayed at 12000 ft through Defined
editing and reload while analysis depth became 9965 ft; MD was locked in Defined
and editable again in Auto. All 741 tests and the production build passed again.

Formatted-MD follow-up: all 745 tests in 45 suites passed, including parsing,
partial decimal editing, empty input and mode switching. Production build passed
with existing warnings. Chrome confirmed 85/65-px MD/Bit Size widths, equal
28-px control heights and normal-width alignment. Entering 15,500.25 displayed
that value after blur, persisted numeric 15500.25, and calculated 14535.25 ft DP
with 965 ft fixed BHA. The formatted value survived Defined mode and reload.
