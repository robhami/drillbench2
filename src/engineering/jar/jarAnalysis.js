// Preliminary straight-hole jar-placement screening while drilling.
// All modes retain WOB at the bit. Slide uses full axial Coulomb drag; Rotate
// resolves Coulomb friction into its axial share using RPM, ROP and tool OD.
import { buildEngModel } from '../models/buildEngModel.js';
import { calcStraightDrag, calcNeutralPointFromLoadProfile } from '../forces/calcStraightDrag.js';
import { calcJarAvoidanceZone } from './neutralPointAvoidance.js';

export function analyzeJarPlacement(bha, drillingMode = 'reference') {
  const model = buildEngModel(bha);
  const loadProfile = calcStraightDrag(model, drillingMode);
  const neutral = calcNeutralPointFromLoadProfile(loadProfile);
  const zeroProfile = calcStraightDrag({ ...model, bha: { ...model.bha, wob: 0 } }, drillingMode);
  const components = model.positions.components;
  const jars = components.filter(c => String(c.category || '').toUpperCase() === 'JAR');
  const warnings = [];
  const inclination = Number(bha?.inclination ?? 0);
  const mu = Number(bha?.frictionCoefficient ?? 0.25);

  if (!Number.isFinite(inclination) || inclination < 0 || inclination > 90) warnings.push('Inclination must be between 0° and 90° from vertical.');
  if (!Number.isFinite(mu) || mu < 0 || mu > 1) warnings.push('Friction coefficient must be between 0 and 1.');
  const holeSize = Number(bha?.holeSize);
  if (!Number.isFinite(holeSize) || holeSize <= 0) warnings.push('Enter a valid hole size.');
  if (!(Number(bha?.mudWeight) > 0)) warnings.push('Enter a valid mud weight.');
  if (!(Number(bha?.wob) > 0)) warnings.push('Enter a valid weight on bit.');
  if (drillingMode === 'rotate' && !(Number(bha?.rop) > 0)) warnings.push('Enter ROP > 0 ft/hr for Rotate drilling.');
  if (drillingMode === 'rotate' && !(Number(bha?.rpm) >= 0)) warnings.push('Enter RPM ≥ 0 for Rotate drilling.');
  if (!loadProfile.valid) warnings.push(loadProfile.error);
  if (!jars.length) warnings.push('Add a JAR to the BHA to analyse placement.');
  if (jars.length > 1) warnings.push('Multiple jars detected; evaluate each independently and verify manufacturer guidance.');

  const descriptions = {
    slide: 'Screening only: straight constant-inclination slide-drilling model using WOB at the bit, buoyed axial weight and Coulomb wall drag (μN). Curvature, buckling, tortuosity and dynamics are not evaluated. Not for field placement decisions.',
    rotate: 'Screening only: straight constant-inclination rotary-drilling model using WOB at the bit. Axial drag is the axial component of Coulomb friction derived from ROP, RPM and component OD. Curvature, buckling, tortuosity, bit torque and dynamics are not evaluated. Not for field placement decisions.',
    reference: 'Screening only: straight constant-inclination frictionless drilling reference using WOB at the bit and buoyed axial weight. Not for field placement decisions.'
  };

  return {
    drillingMode,
    loadProfile,
    neutralPointFt: neutral.neutralPointFound ? neutral.neutralPointFromBit : null,
    jars: jars.map(jar => {
      const od = Number(jar.od);
      const issues = [];
      if (!(od > 0)) issues.push('Jar OD is missing.');
      if (holeSize > 0 && od > holeSize) issues.push('Jar OD exceeds selected hole size.');
      if (!(Number(jar.length) > 0) || !(Number(jar.weight) > 0)) issues.push('Jar length or weight is missing.');
      const distance = neutral.neutralPointFound ? jar.centreFromBit - neutral.neutralPointFromBit : null;
      if (distance !== null && jar.startFromBit <= neutral.neutralPointFromBit && jar.endFromBit >= neutral.neutralPointFromBit) {
        issues.push(`Calculated ${drillingMode} drilling neutral point falls inside jar length.`);
      }
      const avoidanceZone = calcJarAvoidanceZone(model, drillingMode, jar, neutral.neutralPointFound ? neutral.neutralPointFromBit : null, zeroProfile);
      return { name: jar.toolName || 'JAR', startFt: jar.startFromBit, centreFt: jar.centreFromBit, endFt: jar.endFromBit, distanceFromNeutralFt: distance, issues, avoidanceZone };
    }),
    warnings,
    disclaimer: descriptions[drillingMode] || descriptions.reference
  };
}
