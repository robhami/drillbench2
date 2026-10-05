# Straight inclined-hole sliding-drag screening (experimental)

**Not for operational design or jar firing decisions.** The existing static neutral point and jar warnings remain independent of the friction scenario.

Angle θ is measured from vertical; buoyed component weight W is taken from the existing BHA model. For a straight constant-angle well, gravity axial contribution is `W cos θ`, idealized wall-normal force is `W sin θ`, and sliding friction magnitude is `μ W sin θ`. At each component boundary, moving upward from the bit with compression-positive convention: `F_top = F_bottom - W cos θ + s μ W sin θ`, where `s=0` for static, `+1` for running in and `−1` for pulling out. This is a comparison under a **fixed imposed bit force**, not a physically complete running/pulling hookload model. A moving string ordinarily needs a surface or bottom boundary appropriate to its operating state, not drilling WOB.

Assumptions: buoyed weight and constant inclination; no curvature, dogleg side force, pipe-wall clearance, rotation, hydraulic effects, buckling, dynamic contact, actual jar firing or accelerator response. The direction of movement is idealized and friction coefficients are illustrative, not calibrated. No moving-scenario neutral point is reported. Do not use this module for field decisions.

Tests: 0° friction vanishes; 45° projected forces; 90° static axial gravity vanishes; μ=0 reduces to static; invalid parameter rejection.
