import { deployDrillstring } from './deployDrillstring';
import { calcComponentPositions } from './calcComponentPositions';
import { evaluateSurveyAtMd } from '../survey/surveyGeometry';

const finite = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
const fail = (message, status = 'invalid-input') => ({ valid: false, status, errors: [message] });
const populated = row => row && ['category', 'toolName', 'selectedToolId', 'length', 'weight', 'od', 'idSize'].some(k => row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '');

/** Deployed gravitational weight magnitudes and frictionless free-hanging
 * axial support (zero bit/end load). This does not calculate operating loads.
 * Uniform component weight makes integral(w_b*cos(I) ds) = w_b*deltaTVD exact
 * with the existing survey interpolation, including curved component spans.
 */
export function calcStringWeightSummary(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Supply string weight inputs as an object.');
  const { bha, survey } = input;
  if (!finite(input.bitMdFt) || Number(input.bitMdFt) < 0) return fail('Enter a nonnegative bit MD for the string weight summary.');
  const surface = input.surfaceMdFt === undefined ? 0 : input.surfaceMdFt;
  if (!finite(surface) || Number(surface) < 0) return fail('Enter a nonnegative surface reference MD.');
  if (!finite(input.mudWeightPpg) || Number(input.mudWeightPpg) <= 0 || Number(input.mudWeightPpg) >= 65.5) return fail('Mud weight must be positive and below 65.5 ppg.');
  const jarIndex = input.jarIndex === undefined ? 0 : input.jarIndex;
  if (!Number.isSafeInteger(jarIndex) || jarIndex < 0) return fail('Select a valid jar for the weight split.');
  if (!Array.isArray(bha?.rows) || !bha.rows.filter(populated).length || bha.rows.filter(populated).some(row =>
    !(row.category || row.toolName || row.selectedToolId) || !finite(row.weight) || Number(row.weight) < 0)) return fail('Every populated component needs identity and explicit nonnegative air weight per foot.');
  const bitMd = Number(input.bitMdFt), surfaceMd = Number(surface);
  const deployment = deployDrillstring(bha, bitMd, { surfaceMdFt: surfaceMd, deploymentMode: 'depth-dependent' });
  if (!deployment.valid) return fail(deployment.errors.join(' '), 'invalid-deployment');
  // Override only the temporary BHA with the explicitly supplied mud value.
  const positions = calcComponentPositions({ ...deployment.bha, mudWeight: Number(input.mudWeightPpg) });
  if (!Number.isFinite(positions.totalLength) || Math.abs(positions.totalLength - (bitMd - surfaceMd)) > 1e-7) return fail('The complete deployed string must extend from surface reference to bit.', 'invalid-deployment');
  if (!survey?.valid || !survey.summary || !Array.isArray(survey.segments) || !survey.segments.length) return fail('A valid confirmed survey is required for frictionless hookload.', 'outside-survey');
  if (surfaceMd < survey.summary.startMdFt || bitMd > survey.summary.endMdFt) return fail('Survey must cover the full deployed string; no extrapolation.', 'outside-survey');
  const jar = positions.components.filter(c => String(c.category).toUpperCase() === 'JAR')[jarIndex];
  if (!jar) return fail('Selected jar is unavailable.');
  let air = 0, buoyed = 0, above = 0, below = 0, axial = 0;
  const components = [];
  const partition = () => ({ airWeightLbf: 0, buoyedWeightLbf: 0, axialWeightLbf: 0 });
  const aboveJar = partition(), belowJar = partition(), fixedAboveJar = partition(), totalBha = partition();
  const add = (target, airWeightLbf, buoyedWeightLbf, axialWeightLbf) => {
    target.airWeightLbf += airWeightLbf; target.buoyedWeightLbf += buoyedWeightLbf; target.axialWeightLbf += axialWeightLbf;
  };
  for (const component of positions.components) {
    const topMdFt = Math.max(surfaceMd, bitMd - component.endFromBit), bottomMdFt = bitMd - component.startFromBit;
    const top = evaluateSurveyAtMd(survey, topMdFt), bottom = evaluateSurveyAtMd(survey, bottomMdFt);
    if (!top.valid || !bottom.valid) return fail('A deployed component falls outside survey coverage.', 'outside-survey');
    const belowLengthFt = Math.max(0, Math.min(Number(component.length), jar.centreFromBit - component.startFromBit));
    const belowWeight = belowLengthFt * component.weightPerFoot * positions.buoyancyFactor;
    const aboveWeight = component.buoyedWeight - belowWeight;
    const axialWeight = component.weightPerFoot * positions.buoyancyFactor * (bottom.tvdFt - top.tvdFt);
    // Split at the selected jar centre using the same exact TVD integral as
    // the full component. Include half of the selected jar on either side.
    const splitMdFt = Math.max(topMdFt, Math.min(bottomMdFt, bitMd - jar.centreFromBit));
    const split = evaluateSurveyAtMd(survey, splitMdFt);
    if (!split.valid) return fail('Jar-centre partition falls outside survey coverage.', 'outside-survey');
    const aboveAir = (Number(component.length) - belowLengthFt) * component.weightPerFoot;
    const aboveAxial = component.weightPerFoot * positions.buoyancyFactor * (split.tvdFt - top.tvdFt);
    add(aboveJar, aboveAir, aboveWeight, aboveAxial);
    add(belowJar, component.airWeight - aboveAir, belowWeight, axialWeight - aboveAxial);
    if (String(component.category).toUpperCase() !== 'DP') {
      add(fixedAboveJar, aboveAir, aboveWeight, aboveAxial);
      add(totalBha, component.airWeight, component.buoyedWeight, axialWeight);
    }
    air += component.airWeight; buoyed += component.buoyedWeight;
    above += aboveWeight; below += belowWeight; axial += axialWeight;
    components.push({ topMdFt, bottomMdFt, airWeightLbf: component.airWeight, buoyedWeightLbf: component.buoyedWeight,
      buoyedWeightAboveJarLbf: aboveWeight, buoyedWeightBelowJarLbf: belowWeight, axialWeightLbf: axialWeight });
  }
  if (![air, buoyed, above, below, axial, ...Object.values(aboveJar), ...Object.values(belowJar), ...Object.values(fixedAboveJar), ...Object.values(totalBha)].every(Number.isFinite)) return fail('String weight exceeds numerical range.', 'numerical-limit');
  return { valid: true, status: 'calculated', errors: [], totalAirWeightLbf: air, totalBuoyedWeightLbf: buoyed,
    buoyedWeightAboveJarLbf: above, buoyedWeightBelowJarLbf: below, frictionlessHookloadLbf: axial,
    weightConservationResidualLbf: above + below - buoyed, buoyancyFactor: positions.buoyancyFactor,
    bitMdFt: bitMd, surfaceMdFt: surfaceMd, jarIndex, jarFromBitFt: jar.centreFromBit, jarMdFt: bitMd - jar.centreFromBit,
    weightPartitions: {
      total: { airWeightLbf: air, buoyedWeightLbf: buoyed, axialWeightLbf: axial },
      aboveJar, belowJar, fixedAboveJar, totalBha
    },
    deployment: deployment.metadata, components };
}
