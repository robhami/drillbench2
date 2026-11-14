import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { calcSurveyAxialLoads } from '../../engineering/forces/calcSurveyAxialLoads';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis';
import { adjacentDcSection } from '../../Components/BHABuilder/bhaEngineeringSummary';

const finite = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value));
const unavailable = error => ({ valid: false, errors: [error] });
export function validateLoadedBhaWob(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return { valid: false, reason: 'WOB is required for static load and neutral-point results.' };
  }
  if (!finite(value)) return { valid: false, reason: 'WOB must be a finite nonnegative value in klbf.' };
  if (Number(value) < 0) return { valid: false, reason: 'WOB must be a finite nonnegative value in klbf.' };
  return { valid: true, value: Number(value) };
}

/** Presentation adapter over the existing loaded-BHA geometry and static solvers. */
export function buildLoadedBhaPresentation({ bha, survey, drillingMode = 'slide', surfaceReferenceMdFt = 0 }) {
  const depth = analysisDepth(bha);
  const surface = finite(surfaceReferenceMdFt) ? Number(surfaceReferenceMdFt) : NaN;
  const deployment = depth.valid && Number.isFinite(surface)
    ? deployDrillstring(bha, depth.bitMdFt, { surfaceMdFt: surface })
    : unavailable(depth.valid ? 'Surface reference MD must be a finite depth in feet.' : depth.error);
  const geometryBha = deployment.valid ? deployment.bha : bha;
  const positions = deployment.valid ? calcComponentPositions(geometryBha) : { totalLength: 0, components: [] };
  if (!deployment.valid) return { geometryBha, positions, deployment, straight: deployment, surveyLoads: deployment, drillingMode };

  // Reuse the existing adjacent, constant-diameter DC section definition. This
  // is presentation classification only; it does not alter deployed geometry.
  const indexedComponents = positions.components.map((component, index) => ({
    ...component, row: component, index,
    startFt: component.startFromBit, endFt: component.endFromBit,
    length: Number(component.length)
  }));
  const schematicSectionsByJarKey = {};
  indexedComponents.forEach((jar, jarIndex) => {
    if (String(jar.category || '').toUpperCase() !== 'JAR') return;
    const upperDc = adjacentDcSection(indexedComponents, jarIndex, 'above');
    const lowerDc = adjacentDcSection(indexedComponents, jarIndex, 'below');
    const firstBelow = indexedComponents[jarIndex - 1];
    const lowerBoundaryUnresolved = String(firstBelow?.category || '').toUpperCase() === 'DC' && !(lowerDc.lengthFt > 0);
    const lowerDimensionsValid = Number(firstBelow?.od) > 0 && Number(firstBelow?.idSize) > 0 &&
      Number.isFinite(Number(firstBelow?.od)) && Number.isFinite(Number(firstBelow?.idSize));
    const lowerBoundaryFt = lowerDc.lengthFt > 0 ? lowerDc.startFt
      : !lowerBoundaryUnresolved ? jar.startFromBit : null;
    schematicSectionsByJarKey[loadedJarRowKey(jar, jarIndex)] = {
      upperDcIndices: upperDc.components.map(component => component.index),
      // Component indices follow the stored bit-to-surface order. The helper
      // walks from the jar toward the bit for a lower section, so normalize
      // its returned indices back to the shared physical/index convention.
      lowerDcIndices: lowerDc.components.map(component => component.index).sort((a, b) => a - b),
      // The bit is always part of the fixed bottom assembly, even when an
      // intervening DC makes the boundary above it unresolved. Other rows are
      // classified only when the existing adjacent-DC geometry establishes it.
      lowerBhaIndices: indexedComponents
        .filter(component => String(component.category || '').toUpperCase() === 'BIT' ||
          (lowerBoundaryFt !== null && component.category && component.endFromBit <= lowerBoundaryFt + 1e-6))
        .map(component => component.index),
      lowerBoundaryFt,
      lowerBoundaryUnresolved,
      lowerBoundaryReason: lowerBoundaryUnresolved
        ? lowerDimensionsValid ? 'Adjacent DC connection compatibility does not establish a reliable Lower DC boundary.' : 'Adjacent DC dimensions are incomplete.'
        : null,
      lowerConnectionUnverified: lowerDc.connectionUnverified
    };
  });

  // Existing straight-hole jar analysis uses calcStraightDrag and its established
  // neutral-point extraction; no chart or presentation code computes loads.
  const wob = validateLoadedBhaWob(bha?.wob);
  const straight = wob.valid
    ? analyzeJarPlacement(deployment.bha, drillingMode)
    : {
      drillingMode,
      loadProfile: { valid: false, error: wob.reason, components: [] },
      neutralPointFt: null,
      jars: [],
      warnings: [wob.reason]
    };
  const surveyLoads = calcSurveyAxialLoads({
    bha: deployment.bha, survey, bitMdFt: depth.bitMdFt, mode: drillingMode,
    wobLbf: wob.valid ? wob.value * 1000 : '',
    mudWeightPpg: bha?.mudWeight,
    frictionCoefficient: bha?.frictionCoefficient,
    rpm: bha?.rpm,
    ropFtHr: bha?.rop,
    surfaceMdFt: surface
  });
  return { geometryBha, positions, deployment, straight, surveyLoads, drillingMode, schematicSectionsByJarKey };
}

export function loadedJarRowKey(row, index) {
  return String(row?.rowId || row?.selectedToolId || `${row?.toolName || row?.category || 'component'}-${index}`);
}

/** Compact display sections; the optional detailed schematic retains the row-level tools. */
export function buildLoadedBhaSchematicSections({ rows, components = [], selectedJarKey, sectionData }) {
  const sourceRows = Array.isArray(rows) ? rows.filter(row => row && (row.category || row.toolName || row.selectedToolId || row.length)) : [];
  const laidOut = sourceRows.map((row, sourceIndex) => {
    const componentIndex = components.findIndex(component => row.rowId && component.rowId === row.rowId);
    const resolvedIndex = componentIndex >= 0 ? componentIndex : sourceIndex < components.length ? sourceIndex : -1;
    return { row, key: loadedJarRowKey(row, sourceIndex), component: resolvedIndex >= 0 ? components[resolvedIndex] : null, componentIndex: resolvedIndex };
  }).reverse();
  const selected = laidOut.find(item => item.key === selectedJarKey && String(item.row.category).toUpperCase() === 'JAR');
  const selectedPositionIndex = selected?.componentIndex ?? -1;
  const classification = sectionData || {};
  const upperDc = new Set(classification.upperDcIndices || []);
  const lowerDc = new Set(classification.lowerDcIndices || []);
  const lowerBha = new Set(classification.lowerBhaIndices || []);
  const sectionFor = item => {
    const type = String(item.row.category || '').toUpperCase();
    if (type === 'BIT') return 'Bit';
    if (type === 'DP') return 'DP';
    if (type === 'HWDP') return 'HWDP';
    if (type === 'JAR') return 'Jar';
    if (item.componentIndex < 0 || selectedPositionIndex < 0) return 'Section unavailable';
    if (upperDc.has(item.componentIndex)) return 'Upper DC';
    if (type === 'DC' && item.componentIndex > selectedPositionIndex) return 'Upper DC';
    if (lowerDc.has(item.componentIndex)) return 'Lower DC';
    if (lowerBha.has(item.componentIndex)) return 'Lower BHA';
    return 'Section unavailable';
  };
  const groups = [];
  laidOut.forEach(item => {
    const label = sectionFor(item);
    const previous = groups[groups.length - 1];
    if (label !== 'Jar' && label !== 'Bit' && previous?.label === label) previous.items.push(item);
    else groups.push({ label, items: [item] });
  });
  return { groups, selectedKey: selected?.key || null, selectedComponentIndex: selectedPositionIndex };
}
