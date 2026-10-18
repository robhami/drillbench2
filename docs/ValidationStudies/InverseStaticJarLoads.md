# Inverse static jar loads and shared analysis depth

## Boundary conditions documented before implementation

The existing calcStaticJarLoads Stage 3A model remains authoritative and unchanged.
Force C is positive in compression and negative in tension. Hookload H is
nonnegative net upward surface support, with C(surface)=-H. The full deployed
string from surface reference to selected jar centre is integrated. The bit/end
load is not independently imposed: the lower assembly is assumed to supply the
necessary reaction. Its reaction capacity is not calculated.

With s increasing downhole, pickup uses dC/ds=w_b*cos(I)+mu*n(C,s), while
slack-off uses dC/ds=w_b*cos(I)-mu*n(C,s). Normal contact includes curvature
and axial-force dependence through the unchanged forward model. Jar Up uses
pickup with C_target=-positive magnitude; Jar Down uses slack-off with
C_target=+positive magnitude. No firing threshold is assumed.

The inverse residual is f(H)=C_jar(H)-C_target. Nonnegative hookload is the
admissible boundary domain. The scalar soft-string initial-value flow preserves
ordering (the contact norm is Lipschitz in force), so C_jar decreases as H
increases while the same model branch is valid. A numerical failure is never
bridged or interpreted as a valid bracket. Evaluate H=0; reject targets beyond
that branch's available compression. Expand an upper hookload bracket and bisect
with finite evaluation/iteration limits. Verify every accepted result with a
fresh forward solve and enforce the requested residual tolerance. Forward mesh
convergence checks remain active. The default search ceiling is 10000000 lbf,
a computational bound, not a manufacturer or operational limit. Reaching it
without a bracket is unresolved within the search range, not proof of a
physical equipment limit. Residual tolerance is numerical consistency, not a
physical accuracy estimate.

Shared analysisBitMdFt lives in Workspace state and is edited only in Analysis
Inputs. It starts unset, is session-only, and is separate from Auto DP reference
MD and saved/manual string lengths. Other modules ignore it. Mud, friction and
RPM remain shared BHA values. There is no saved/shared selected-jar field: a
single jar is selected automatically; multiple jars use local selection, and
no jar is an error. No saved BHA mutation or inferred jar identity is introduced.
Surface reference MD has no shared source and remains an Advanced control,
initially zero, applying consistently to weights, inverse and forward results.


## Implementation and independent validation

The new solveStaticJarHookload wrapper calls calcStaticJarLoads without modifying
that model or its equations. Default search uses at most 32 bracket expansions
and 60 bisections, with 0.01-lbf target residual tolerance. The final returned
jar load, state, warnings and numerical convergence audit come from a fresh
forward evaluation at the solved hookload. Difference from rotating off-bottom
hookload is a signed subtraction only, never an inverse boundary condition.
If the rotating prediction is unavailable, the inverse solution may remain valid
but its comparison is unavailable. All UI loads display one decimal place.

Independent tests use 1000 ft above jar centre at 100 lbf/ft, BF=1, desired
magnitude 20000 lbf. Straight-well formulas are H_up=G+D+target and
H_down=G-D-target, with G=W*cos(I), D=mu*W*sin(I).

| Case | Jar Up required H klbf | Jar Down required H klbf |
| --- | ---: | ---: |
| Vertical, mu=0.25 | 120.000000 | 80.000000 |
| Straight 60 degrees, mu=0.25 | 91.650635 | 8.349365 |

Calculated values match these independent expectations within 0.01 lbf.
Curved 30-to-60-degree fixtures invert independently specified forward hookloads
of 100000 lbf (pickup) and 10000 lbf (slack-off), recovering surface load within
0.03 lbf and jar force within 0.01 lbf, with forward mesh convergence required.
Depth-dependent DP is checked at 1000 and 2000 ft, with a deliberately unrelated
stored DP length. Vertical compression target 100001 lbf exceeds the branch's
100000-lbf zero-hookload reaction and is rejected as requiring downward surface
push; exactly 100000 lbf is supported at zero hookload. Unbracketed, invalid,
non-convergent and failed-forward cases return no invented hookload.

UI regressions retain the existing Test 4 weight and operating-hookload values,
and cover read-only shared depth, stale-result invalidation, single/multiple/no
jar handling, positive target magnitude, Up/Down signs, unavailable rotating
comparison, Advanced forward controls and saved-data non-mutation. Separate
Workspace and real-Widget tests verify the shared depth path from Analysis
Inputs into Jar Forces, including close/reopen within the same workspace.
Shared analysis depth is session-only; no other module changes its depth source.

Limits remain those of the forward soft-string model. Lower-assembly reaction
capacity and compressed-string stability are not established. No impact,
manufacturer thresholds, firing prediction, support capacity or operational
safety claim is added. Surface reference is an Advanced local setting because
no authoritative shared surface-reference value exists. Multiple-jar selection
also remains local because no saved/shared selected-jar identity exists.
