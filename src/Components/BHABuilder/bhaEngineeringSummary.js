import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { calcBuoyancyFactor, calcBuoyedWeight } from '../../engineering/forces/calcBuoyancy';
import { calculateSurveyGeometry, evaluateSurveyAtMd } from '../../engineering/survey/surveyGeometry';
import { validateSurveyCoverage } from '../../engineering/survey/surveyCoverage';
import { resolveActiveSurvey } from '../../Apps/Survey/surveyAssociation';
import { parseSurveyCsv } from '../../engineering/survey/surveyImport';

const positive = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0;
const category = row => String(row?.category || '').toUpperCase();
const populated = row => Boolean(row && (row.category || row.selectedToolId || row.toolName));
const rowLengthValid = row => positive(row?.length);

const dimension = (row, key) => {
  const value = Number(row?.[key] ?? row?.componentDefinition?.[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
};
const connection = (row, key) => String(row?.[key] ?? row?.componentDefinition?.[key] ?? '').trim().toUpperCase();
const sameDimension = (a, b) => a != null && b != null && Math.abs(a - b) <= 1e-6;

// Component order is bit-to-surface. A section is grouped by matching collar OD/ID;
// stored mating connection labels, when present on both sides, must also agree.
function adjacentDcSection(components, jarIndex, direction) {
  if (jarIndex < 0) return { lengthFt: null, startFt: null, endFt: null, connectionUnverified: false, components: [] };
  const step = direction === 'below' ? -1 : 1;
  const firstIndex = jarIndex + step;
  const first = components[firstIndex];
  if (!first || category(first.row) !== 'DC') return { lengthFt: 0, startFt: null, endFt: null, connectionUnverified: false, components: [] };
  const od = dimension(first.row, 'od');
  const id = dimension(first.row, 'idSize');
  let lengthFt = 0;
  let connectionUnverified = false;
  const sectionComponents = [];
  let previous = components[jarIndex];
  for (let index = firstIndex; components[index] && category(components[index].row) === 'DC'; index += step) {
    const current = components[index];
    if (!sameDimension(od, dimension(current.row, 'od')) || !sameDimension(id, dimension(current.row, 'idSize'))) break;
    const lower = step < 0 ? current.row : previous.row;
    const upper = step < 0 ? previous.row : current.row;
    const lowerConnection = connection(lower, 'connectionTop');
    const upperConnection = connection(upper, 'connectionBottom');
    if (lowerConnection && upperConnection && lowerConnection !== upperConnection) break;
    if (!lowerConnection || !upperConnection) connectionUnverified = true;
    lengthFt += current.length;
    sectionComponents.push(current);
    previous = current;
  }
  return { lengthFt, startFt: sectionComponents.length ? Math.min(...sectionComponents.map(component => component.startFt)) : null,
    endFt: sectionComponents.length ? Math.max(...sectionComponents.map(component => component.endFt)) : null,
    connectionUnverified, components: sectionComponents };
}

export function calculateBhaEngineeringSummary(bha) {
  const depth = analysisDepth(bha);
  const autoDp = bha?.rows?.some(row => category(row) === 'DP' && row.lengthMode === 'auto');
  const deployment = autoDp
    ? depth.valid ? deployDrillstring(bha, depth.bitMdFt) : { valid: false, errors: [depth.error || 'Auto drillpipe reference depth is unavailable.'] }
    : { valid: true, bha };
  const sourceRows = deployment.valid ? deployment.bha.rows || [] : bha?.rows || [];
  const rowsComplete = sourceRows.filter(populated).length > 0 && sourceRows.filter(populated).every(rowLengthValid);
  let cursor = 0;
  const components = sourceRows.filter(populated).map((row, index) => {
    const length = Number(row.length), startFt = cursor, endFt = cursor + length;
    cursor = endFt;
    return { row, index: sourceRows.indexOf(row), length, startFt, endFt };
  });
  const firstJarIndex = components.findIndex(component => category(component.row) === 'JAR');
  const firstJar = firstJarIndex >= 0 ? components[firstJarIndex] : null;
  const firstDpIndex = components.findIndex(component => category(component.row) === 'DP');
  const bhaComponents = firstDpIndex < 0 ? components : components.slice(0, firstDpIndex);
  const bhaLengthFt = bhaComponents.reduce((sum, component) => sum + component.length, 0);
  const lowerDc = adjacentDcSection(components, firstJarIndex, 'below');
  const upperDc = adjacentDcSection(components, firstJarIndex, 'above');
  const geometryValid = deployment.valid && rowsComplete;
  const geometry = {
    bhaLengthFt: geometryValid ? bhaLengthFt : null,
    belowJarLengthFt: geometryValid && firstJar ? firstJar.startFt : null,
    availableDcBelowJarLengthFt: geometryValid && firstJar ? lowerDc.lengthFt : null,
    availableDcAboveJarLengthFt: geometryValid && firstJar ? upperDc.lengthFt : null,
    availableDcBelowJarStartFt: geometryValid && firstJar ? lowerDc.startFt : null,
    availableDcBelowJarEndFt: geometryValid && firstJar ? lowerDc.endFt : null,
    availableDcAboveJarStartFt: geometryValid && firstJar ? upperDc.startFt : null,
    availableDcAboveJarEndFt: geometryValid && firstJar ? upperDc.endFt : null,
    availableDcBelowJarConnectionUnverified: lowerDc.connectionUnverified,
    availableDcAboveJarConnectionUnverified: upperDc.connectionUnverified,
    firstJarIndex
  };

  const geometryReasons = [];
  if (!deployment.valid) geometryReasons.push(...(deployment.errors || ['BHA deployment is unavailable.']));
  if (!rowsComplete) geometryReasons.push('Enter a positive length for every populated component.');
  if (!firstJar) geometryReasons.push('Add a jar to calculate lower BHA length.');

  const reasons = [];
  if (!deployment.valid) reasons.push(...(deployment.errors || ['BHA deployment is unavailable.']));
  if (!rowsComplete) reasons.push('Enter a positive length for every populated component.');
  if (!positive(bha?.mudWeight)) reasons.push('Enter mud weight in Parameter Entry.');
  const missingWeight = bhaComponents.find(component => !positive(component.row.weight));
  if (missingWeight) reasons.push(`Enter positive weight per foot for ${missingWeight.row.toolName || category(missingWeight.row) || 'each BHA component'}.`);
  const buoyancyFactor = positive(bha?.mudWeight) ? calcBuoyancyFactor(Number(bha.mudWeight)) : null;
  if (buoyancyFactor !== null && buoyancyFactor <= 0) reasons.push('Mud weight must be below the nominal steel density of 65.5 ppg.');
  const weightedComponents = components.map(component => {
    const airWeightLbf = Number(component.row.weight) * component.length;
    const buoyedWeightLbf = buoyancyFactor === null || buoyancyFactor <= 0
      ? null : calcBuoyedWeight(airWeightLbf, Number(bha.mudWeight));
    return { ...component, buoyancyFactor: buoyancyFactor > 0 ? buoyancyFactor : null, buoyedWeightLbf };
  });
  const buoyedComponents = weightedComponents.slice(0, bhaComponents.length);
  const buoyancyReasons = [...reasons];
  const buoyedBhaWeightLbf = geometryValid && reasons.length === 0
    ? buoyedComponents.reduce((sum, component) => sum + component.buoyedWeightLbf, 0) : null;
  const belowJarComponents = firstJar ? buoyedComponents.filter(component => component.endFt <= firstJar.startFt) : [];
  const buoyedBelowJarLbf = geometryValid && firstJar && reasons.length === 0
    ? belowJarComponents.reduce((sum, component) => sum + component.buoyedWeightLbf, 0) : null;

  const surveySource = resolveActiveSurvey(bha);
  const confirmedSurvey = !bha?.surveyState?.reviewRequired && surveySource?.confirmed === true ? surveySource : null;
  const parsedSurvey = confirmedSurvey?.originalCsv ? parseSurveyCsv(confirmedSurvey.originalCsv, { mdUnit: 'ft', angleUnit: 'deg' }) : null;
  const survey = parsedSurvey?.valid ? calculateSurveyGeometry(parsedSurvey.stations) : null;
  let surveyReason = depth.valid ? 'Load and confirm a survey in Parameter Entry.' : depth.error || 'Enter a valid current bit MD.';
  let coverageValid = false;
  if (survey?.valid && depth.valid && geometryValid) {
    const startMdFt = depth.bitMdFt - bhaLengthFt;
    const coverage = validateSurveyCoverage(survey, { startMdFt, endMdFt: depth.bitMdFt, calculations: ['BHA gravitational weight'] });
    coverageValid = coverage.covered;
    if (!coverage.covered) surveyReason = coverage.message || 'Survey does not cover the BHA interval; extrapolation is unavailable.';
  } else if (survey?.valid && !depth.valid) surveyReason = depth.error || 'Enter a valid current bit MD.';
  else if (surveySource && !confirmedSurvey) surveyReason = 'Confirm the loaded survey in Parameter Entry.';

  const axialWeight = componentsToIntegrate => {
    let total = 0;
    for (const component of componentsToIntegrate) {
      const top = evaluateSurveyAtMd(survey, depth.bitMdFt - component.endFt);
      const bottom = evaluateSurveyAtMd(survey, depth.bitMdFt - component.startFt);
      if (!top.valid || !bottom.valid || component.buoyancyFactor == null) return null;
      total += Number(component.row.weight) * component.buoyancyFactor * (bottom.tvdFt - top.tvdFt);
    }
    return total;
  };
  const axialBhaWeightLbf = geometryValid && coverageValid && reasons.length === 0 ? axialWeight(buoyedComponents) : null;
  const axialBelowJarLbf = firstJar && geometryValid && coverageValid && reasons.length === 0 ? axialWeight(belowJarComponents) : null;

  const sectionWeights = section => {
    if (!section.components.length) return { buoyedWeightLbf: 0, axialWeightLbf: 0, buoyedReason: '', axialReason: '' };
    if (!geometryValid) {
      const reason = geometryReasons.join(' ') || 'BHA geometry is unavailable.';
      return { buoyedWeightLbf: null, axialWeightLbf: null, buoyedReason: reason, axialReason: reason };
    }
    const selected = weightedComponents.filter(component => section.components.some(sectionComponent => sectionComponent.row === component.row));
    const invalidWeight = selected.find(component => !positive(component.row.weight));
    const buoyedReason = !positive(bha?.mudWeight)
      ? 'Enter mud weight in Parameter Entry.'
      : buoyancyFactor <= 0 ? 'Mud weight must be below the nominal steel density of 65.5 ppg.'
        : invalidWeight ? `Enter positive weight per foot for ${invalidWeight.row.toolName || 'each available DC'}.` : '';
    const buoyedWeightLbf = buoyedReason ? null : selected.reduce((sum, component) => sum + component.buoyedWeightLbf, 0);
    let axialReason = buoyedReason;
    if (!axialReason) {
      if (!survey?.valid || !confirmedSurvey) axialReason = surveyReason;
      else if (!depth.valid) axialReason = depth.error || 'Enter a valid current bit MD.';
      else if (!geometryValid) axialReason = geometryReasons.join(' ') || 'BHA geometry is unavailable.';
      else {
        const startMdFt = depth.bitMdFt - Math.max(...section.components.map(component => component.endFt));
        const endMdFt = depth.bitMdFt - Math.min(...section.components.map(component => component.startFt));
        const coverage = validateSurveyCoverage(survey, { startMdFt, endMdFt, calculations: ['available DC gravitational weight'] });
        if (!coverage.covered) axialReason = coverage.message || surveyReason;
      }
    }
    const axialWeightLbf = axialReason ? null : axialWeight(selected);
    if (axialWeightLbf == null && !axialReason) axialReason = surveyReason || 'Survey does not cover the available DC interval.';
    return { buoyedWeightLbf, axialWeightLbf: axialReason ? null : axialWeightLbf, buoyedReason, axialReason };
  };
  const availableDcBelowWeights = sectionWeights(lowerDc);
  const availableDcAboveWeights = sectionWeights(upperDc);
  if (!coverageValid) reasons.push(surveyReason);

  return {
    geometry,
    weights: { buoyedBelowJarLbf, buoyedBhaWeightLbf, axialBelowJarLbf, axialBhaWeightLbf,
      availableDcBelowJarBuoyedWeightLbf: availableDcBelowWeights.buoyedWeightLbf,
      availableDcBelowJarAxialWeightLbf: availableDcBelowWeights.axialWeightLbf,
      availableDcAboveJarBuoyedWeightLbf: availableDcAboveWeights.buoyedWeightLbf,
      availableDcAboveJarAxialWeightLbf: availableDcAboveWeights.axialWeightLbf },
    availableDcWeightReasons: {
      below: { buoyed: availableDcBelowWeights.buoyedReason, axial: availableDcBelowWeights.axialReason },
      above: { buoyed: availableDcAboveWeights.buoyedReason, axial: availableDcAboveWeights.axialReason }
    },
    reasons: [...new Set(reasons)],
    buoyancyReasons: [...new Set(buoyancyReasons)],
    geometryReasons: [...new Set(geometryReasons)],
    surveyReason
  };
}
