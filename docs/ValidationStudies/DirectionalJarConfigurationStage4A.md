# Stage 4A - directional jar configuration and operating loads

Stage 4A adds user-entered mechanism metadata and static operating targets. It
does not change survey, friction, static force-transfer, inverse or Skeem equations.
The existing inverse solver still maps compression-positive signed jar target to
nonnegative surface hookload, using pickup for Jar Up (negative tension) and
slack-off for Jar Down (positive compression), with fresh forward verification.

## Data and persistence

Each BHA row may contain jarDirections.up and jarDirections.down. Each direction
stores mechanism (hydraulic, mechanical or unavailable), optional tripForceKlbf,
and optional targetForceKlbf. No overall mechanism is stored or inferred from
a manufacturer/model name. Missing or unrecognized mechanism is Unconfigured;
old records remain valid without automatic data migration. Weight tables and
the Advanced forward diagnostic calculator remain available. Operating inverse
calculations require an explicitly supported mechanism.

Configuration writes use the existing updateRow(rowId, changes) and existing
BHA save/duplicate/load persistence. Rows without rowId can be updated by their
explicit current-BHA row index through updateBha; no new storage system or ID
migration is introduced. Each direction's target is stored with its jar row.
Existing saved BHA entries are updated only through existing save actions;
configuration edits change the working BHA and its existing working-well store.

An absent mechanical target initially displays its direction's trip force.
Once the user edits it, including clearing it, targetForceKlbf is explicit and
is not overwritten by direction/jar switching or trip-setting edits. Unedited
defaults track the configured trip setting. Hydraulic targets start empty and
are supplied by the user; a retained trip field from a prior mechanism is hidden
and ignored for hydraulic operation. Changing mechanisms preserves manual targets.

## Interpretation and safeguards

Mechanical trip force is a user-entered manufacturer-defined release setting,
independent for Up and Down. It must be positive before mechanical operation.
Targets below that setting are valid static-load calculations but are labelled
as not reaching the configured release setting. Equality or excess means only
the static target meets the entered setting; it never guarantees release.
Hydraulic operation requires no mechanical trip or artificial activation force.
Its target is an applied static load, not a fixed firing threshold; hydraulic
firing characteristics depend on tool design. Not Available blocks inverse
operation for that direction. Unconfigured is distinct from Not Available.

Shared Analysis Inputs and current survey/deployment remain authoritative.
Targets are positive magnitudes; sign is assigned only by the unchanged inverse
model. Required Surface Hookload stays prominent; calculated jar force, residual
and solver details remain collapsed. Changes to configuration invalidate stale
static results. String Weight and Operating Hookload tables are unchanged.

The lower assembly is assumed to supply the required reaction. Stage 4A does
not establish reaction capacity or compressed-string stability. It does not
predict hydraulic firing delay, impact force or energy, guaranteed mechanical
release, rig maximum overpull, component tensile yield, sinusoidal/helical
buckling limits or a safe operating envelope. Outputs remain preliminary static
engineering screening, not operational guidance or manufacturer limits.

## Validation

UI tests cover legacy/unconfigured records; hydraulic/hydraulic,
mechanical/mechanical and mixed configurations; single-direction jars;
independent trip forces; below/equal/above-trip status; hydraulic loading without
trip input; switching direction/jar with manual and cleared targets; and
multiple jars without metadata leakage. Existing persistence tests are extended
to save, duplicate, reload and load independent mechanism/target data through
the existing application store. Existing forward/inverse and Test 4 regressions
remain unchanged. No force equations are tuned to release settings.
