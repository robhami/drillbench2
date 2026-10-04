// Preliminary, vertical static screening only. Not an operational jar-placement design.
import { buildEngModel } from '../models/buildEngModel.js';
import { calcNeutralPoint } from '../forces/calcNeutralPoint.js';

export function analyzeJarPlacement(bha) {
  const model = buildEngModel(bha);
  const neutral = calcNeutralPoint(model);
  const components = model.positions.components;
  const jars = components.filter(c => String(c.category || '').toUpperCase() === 'JAR');
  const warnings = [];
  const holeSize = Number(bha?.holeSize);
  if (!Number.isFinite(holeSize) || holeSize <= 0) warnings.push('Enter a valid hole size.');
  if (!(Number(bha?.mudWeight) > 0)) warnings.push('Enter a valid mud weight.');
  if (!(Number(bha?.wob) > 0)) warnings.push('Enter a valid weight on bit.');
  if (!jars.length) warnings.push('Add a JAR to the BHA to analyse placement.');
  if (jars.length > 1) warnings.push('Multiple jars detected; evaluate each independently and verify manufacturer guidance.');
  return {
    neutralPointFt: neutral.neutralPointFound ? neutral.neutralPointFromBit : null,
    jars: jars.map(jar => {
      const od = Number(jar.od);
      const issues = [];
      if (!(od > 0)) issues.push('Jar OD is missing.');
      if (holeSize > 0 && od > holeSize) issues.push('Jar OD exceeds selected hole size.');
      if (!(Number(jar.length) > 0) || !(Number(jar.weight) > 0)) issues.push('Jar length or weight is missing.');
      const distance = neutral.neutralPointFound ? jar.centreFromBit - neutral.neutralPointFromBit : null;
      if (distance !== null && jar.startFromBit <= neutral.neutralPointFromBit && jar.endFromBit >= neutral.neutralPointFromBit) {
        issues.push('Calculated neutral point falls inside jar length (vertical static approximation).');
      }
      return { name: jar.toolName || 'JAR', startFt: jar.startFromBit, centreFt: jar.centreFromBit, endFt: jar.endFromBit, distanceFromNeutralFt: distance, issues };
    }),
    warnings,
    disclaimer: 'Screening only: vertical static buoyed-weight approximation. Inclination, drag, buckling, temperature, jar firing force, accelerator compatibility and manufacturer limits are NOT evaluated. Not for field placement decisions.'
  };
}
