# Stage 4B - preliminary maximum surface hookload check

Base: 05cf7a613f9c15395f74b27db682cd238968e03e, feature/workspace-v2.

## Source of truth and persistence

The single optional input Maximum Allowable Hookload (klbf) is user-defined.
No rig rating, maximum-overpull input or minimum hookload is inferred. The value
lives in well.rigLimits.maximumAllowableHookloadKlbf in App state, persisted by
the existing drillbenchWell store, outside currentBha and saved BHA records.
App passes the same limit/update callback through Workspace and Widget to Jar
Forces. All jars and loaded BHAs in the current well/workspace use that limit;
new/saved/duplicated BHA operations do not overwrite it. Old well records default
to an empty optional value. Clearing it persists an empty Not Configured state.
No new storage system/key is introduced. Rig Limits defaults collapsed.

## Calculation

The existing calculated nonrotating pickup hookload P is the reference. The
existing inverse static jar solver supplies required surface hookload H. For
Jar Up only, maximum M, P and H are in lbf internally:

- Available overpull = M - P
- Required overpull = H - P
- Remaining margin = M - H

No intermediate values are rounded and no negative results are clipped. Outputs
show one decimal place in klbf. Empty/absent maximum means Not Configured;
nonempty values must be finite and positive, including after unit conversion.
Invalid limits produce a visible input error and no passing status. Missing
pickup/inverse results remain unavailable. A limit below P produces a visible
insufficient-pickup-capacity warning even before a successful inverse result.
The comparison is recomputed when the shared limit changes; force solutions
are not rerun or modified by changing a rig rating.

Within Limit means M-H is positive; Exceeds Limit means it is negative. At Limit
allows only 0.000001 lbf numerical roundoff around equality, not UI rounding or
an operational margin. Small nonzero differences outside that allowance retain
their sign/status even if displayed as 0.0 klbf. The inverse solver retains its
existing numerical residual tolerance, which is distinct from this comparison.
A maximum below pickup may coexist with a required load below the maximum;
that does not remove the independent insufficient-pickup-capacity warning.

Jar Down still calculates H, but has no lower-load limit, overpull table or
Within/At/Exceeds status. It states that compression and buckling limits are not
yet evaluated. Invalid user-entered rig data remains a visible input error but
is not turned into a Jar Down safe/unsafe assessment.

## Independent validation

For P=100000 lbf, M=120000 lbf and H=110000 / 120000 / 130000 lbf,
required overpull is 10000 / 20000 / 30000 lbf, available overpull is 20000 lbf,
and remaining margin is 10000 / 0 / -10000 lbf, giving Within / At / Exceeds.
For M=90000, P=100000 and H=95000 lbf, required overpull=-5000,
available=-10000 and remaining=-5000 lbf; insufficient pickup is flagged.

Unit/UI tests cover configured/missing/invalid input, exact equality, signed
margins, invalid pickup, multiple jars sharing one limit and Jar Down without a
false safety status. A straight 60-degree UI fixture checks overpull against
independent P=W_b*(cos(I)+mu*sin(I)), distinct from pure-rotation hookload.
Persistence/reload, BHA switching and real App/Workspace/Widget propagation are
covered. Existing Stage 4A, Test 4, forward/inverse and Skeem regressions remain.

## Limitations

This is only a comparison of predicted surface load with an entered maximum.
Passing it does not establish drillstring tensile safety, component yield,
connection capacity, hydraulic firing delay, jar release or firing success,
impact energy/force, compression stability, sinusoidal/helical buckling or a
safe operating envelope. Lower-assembly reaction capacity remains assumed,
and model predictions are not measured rig loads. Stage 4B does not add or
alter force, friction, inverse-solver or Skeem equations. The separate inverse
solver computational search ceiling is not a rig rating.
