// Preliminary straight-hole jar-placement screening while drilling.
// Slide mode includes WOB + simplified Coulomb drag. Rotate will be added later.
import { buildEngModel } from '../models/buildEngModel.js';
import { calcStraightDrag, calcNeutralPointFromLoadProfile } from '../forces/calcStraightDrag.js';

export function analyzeJarPlacement(bha, drillingMode = 'reference') {
  const model = buildEngModel(bha);
  const loadProfile = calcStraightDrag(model, drillingMode);
  const neutral = calcNeutralPointFromLoadProfile(loadProfile);
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
  if (!loadProfile.valid) warnings.push(loadProfile.error);
  if (!jars.length) warnings.push('Add a JAR to the BHA to analyse placement.');
  if (jars.length > 1) warnings.push('Multiple jars detected; evaluate each independently and verify manufacturer guidance.');

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
      return { name: jar.toolName || 'JAR', startFt: jar.startFromBit, centreFt: jar.centreFromBit, endFt: jar.endFromBit, distanceFromNeutralFt: distance, issues };
    }),
    warnings,
    disclaimer: drillingMode === 'slide'
      ? 'Screening only: straight constant-inclination slide-drilling model using WOB at the bit, buoyed axial weight and Coulomb wall drag (μN). Curvature, buckling, tortuosity, dynamics and rotational effects are not evaluated. Not for field placement decisions.'
      : 'Screening only: straight constant-inclination frictionless drilling reference using WOB at the bit and buoyed axial weight. Not for field placement decisions.'
  };
}
