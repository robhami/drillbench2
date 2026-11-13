import { comparisonGeometry, listComparisonJars, relocateComparisonJar } from './realBhaComparison';
import { populatedComponent } from '../bha/componentApplicability';
import { deployDrillstring } from '../bha/deployDrillstring';

export const JAR_POSITIONING_METHODS = Object.freeze({
  REPOSITION: 'reposition-existing-dc',
  FIXED_ANVIL: 'fixed-anvil-vary-above',
  FIXED_HAMMER: 'fixed-hammer-vary-below',
  INDEPENDENT: 'vary-above-and-below'
});

let nextCandidate = 1;
const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
const category = row => String(row?.category || '').toUpperCase();
const clone = value => JSON.parse(JSON.stringify(value));

function propertyKey(row) {
  return JSON.stringify({
    od: Number(row.od), id: Number(row.idSize), weight: Number(row.weight),
    orientation: row.orientation, selectedToolId: row.selectedToolId,
    definition: row.componentDefinition ? { ...row.componentDefinition, length: null } : null
  });
}

function setLength(row, length) {
  row.length = length;
  if (row.componentDefinition) row.componentDefinition.length = length;
}

function makeCandidate({ bha, jarIndex, method, candidateId, nextBha, bitMdFt, surfaceMdFt = 0, sourceRowIndex = null, warnings = [], sourceGeometry = null }) {
  const source = sourceGeometry || comparisonGeometry(bha, jarIndex);
  if (!source.valid) return { valid: false, error: source.error };
  const deployment = deployDrillstring(nextBha, bitMdFt, { surfaceMdFt });
  if (!deployment.valid) return { valid: false, error: deployment.errors?.join(' ') || 'Candidate BHA deployment is invalid.' };
  const rows = (deployment.bha.rows || []).filter(populatedComponent);
  const originalDeployment = deployDrillstring(bha, bitMdFt, { surfaceMdFt });
  if (!originalDeployment.valid) return { valid: false, error: originalDeployment.errors?.join(' ') || 'Original BHA deployment is invalid.' };
  const originalRows = (originalDeployment.bha.rows || []).filter(populatedComponent);
  const jarRow = source.jar?.rowId
    ? rows.find(row => row.rowId === source.jar.rowId)
    : rows[source.index];
  if (!jarRow || category(jarRow) !== 'JAR') return { valid: false, error: 'Candidate no longer contains the selected jar at its original sequence position.' };
  const candidateJarIndex = rows.indexOf(jarRow);
  for (const [i, row] of rows.entries()) {
    if (!finitePositive(row.length)) return { valid: false, error: `Candidate row ${i + 1} must have positive length.` };
  }
  const start = rows.slice(0, candidateJarIndex).reduce((sum, row) => sum + Number(row.length), 0);
  const jarCentreFt = start + Number(jarRow.length) / 2;
  const totalBhaLengthFt = rows.reduce((sum, row) => sum + Number(row.length), 0);
  const hasLinearWeights = rows.every(row => finitePositive(row.weight));
  const totalCalculatedWeightLbf = hasLinearWeights ? rows.reduce((sum, row) => sum + Number(row.length) * Number(row.weight), 0) : null;
  const originalDp = originalRows.find(row => category(row) === 'DP'), candidateDp = rows.find(row => category(row) === 'DP');
  const drillpipeLengthChangeFt = Number(candidateDp?.length || 0) - Number(originalDp?.length || 0);
  const originalCalculatedWeightLbf = originalRows.every(row => finitePositive(row.weight)) ? originalRows.reduce((sum,row)=>sum+Number(row.length)*Number(row.weight),0) : null;
  const contiguousLength = direction => {
    let total = 0;
    for (let i = candidateJarIndex + direction; i >= 0 && i < rows.length && category(rows[i]) === 'DC'; i += direction) total += Number(rows[i].length);
    return total;
  };
  const candidate = {
    candidateId: candidateId || `jar-candidate-${nextCandidate++}`,
    positioningMethod: method,
    jarLocationAboveBitFt: jarCentreFt,
    drillCollarLengthAboveJarFt: contiguousLength(1),
    drillCollarLengthBelowJarFt: contiguousLength(-1),
    addedDcJointsAbove: 0,
    removedDcJointsAbove: 0,
    reallocatedDcJointsAbove: 0,
    addedDcJointsBelow: 0,
    removedDcJointsBelow: 0,
    addedDcLengthAboveFt: 0,
    removedDcLengthAboveFt: 0,
    reallocatedDcLengthAboveFt: 0,
    totalBhaLengthFt,
    totalCalculatedWeightLbf,
    changeInCalculatedWeightLbf: Number.isFinite(originalCalculatedWeightLbf) && Number.isFinite(totalCalculatedWeightLbf) ? totalCalculatedWeightLbf - originalCalculatedWeightLbf : null,
    drillpipeLengthChangeFt,
    deployedLengthFt: totalBhaLengthFt,
    components: rows,
    bha: nextBha,
    valid: true,
    warnings: [...warnings, ...(!hasLinearWeights ? ['Calculated nominal weight unavailable because one or more rows lack a positive linear weight.'] : [])],
    sourceBha: bha,
    sourceRowIndex
  };
  // The joint-foot fields are set by the method builder below, once joint length is known.
  return candidate;
}

function uniformResizableDc(row) {
  return category(row) === 'DC' && (!row.componentDefinition?.geometry || row.componentDefinition.geometry.kind === 'uniform') &&
    row.componentDefinition?.sectionModel !== 'complex' && !row.componentDefinition?.effectiveProperties &&
    (row.quantity == null || row.quantity === '' || Number(row.quantity) === 1) &&
    (row.componentDefinition?.totalWeight === null || row.componentDefinition?.totalWeight === undefined || row.componentDefinition.totalWeight === '' || !Number.isFinite(Number(row.componentDefinition.totalWeight)));
}

export function fixedAnvilConfigurationGeometry(bha, jarIndex) {
  const rows = (bha?.rows || []).filter(populatedComponent), jars = listComparisonJars(bha);
  if (!Number.isInteger(jarIndex) || !jars[jarIndex]) throw Error('Select a jar explicitly; no jar is substituted.');
  const index = jars[jarIndex].rowIndex, jar = rows[index], target = rows[index + 1];
  if (!jar || category(jar) !== 'JAR' || !target || category(target) !== 'DC') throw Error('Fixed-anvil mode requires a DC section immediately above the selected jar; components below it remain fixed.');
  if (!finitePositive(jar.length) || !finitePositive(target.length)) throw Error('The selected jar and adjacent upper DC require positive lengths.');
  const currentCentreFt = rows.slice(0, index).reduce((sum, row) => sum + Number(row.length), 0) + Number(jar.length) / 2;
  return { valid: true, rows, index, jar, upper: target, currentCentreFt, minCentreFt: currentCentreFt, maxCentreFt: currentCentreFt };
}

export function makeRepositionCandidate({ bha, jarIndex, movementFt, candidateId, bitMdFt, surfaceMdFt = 0 }) {
  const moved = relocateComparisonJar(bha, jarIndex, movementFt, 'A');
  if (!moved.valid) return moved;
  const candidate = makeCandidate({ bha, jarIndex, method: JAR_POSITIONING_METHODS.REPOSITION, candidateId, nextBha: moved.bha, bitMdFt, surfaceMdFt });
  if (!candidate.valid) return candidate;
  return { ...candidate, movementFt: moved.movementFt, addedDcLengthAboveFt: 0, removedDcLengthAboveFt: 0, addedDcJointsAbove: 0, removedDcJointsAbove: 0,
    sourceRowIndex: null, warnings: [...candidate.warnings, 'Existing Mode A footage transfer; total deployed length and nominal calculated weight are preserved.'] };
}

/**
 * Reposition a jar by transferring a measured stand of the adjacent, matching
 * DC section across the jar. The incoming stand is represented by its measured
 * joint lengths; the residual source section remains intact. No footage is
 * rounded or synthesized from an assumed nominal joint length.
 */
export function makeStandRepositionCandidate({ bha, jarIndex, standChange, standMakeupFt, candidateId, bitMdFt, surfaceMdFt = 0 }) {
  if (!Number.isInteger(standChange) || !Array.isArray(standMakeupFt) || !standMakeupFt.length || standMakeupFt.some(length => !finitePositive(Number(length)))) {
    return { valid: false, error: 'A whole stand change and its measured positive DC joint lengths are required.' };
  }
  const source = comparisonGeometry(bha, jarIndex);
  if (!source.valid) return source;
  if (standChange === 0) return makeRepositionCandidate({ bha, jarIndex, movementFt: 0, candidateId, bitMdFt, surfaceMdFt });
  if (!uniformResizableDc(source.lower) || !uniformResizableDc(source.upper) || propertyKey(source.lower) !== propertyKey(source.upper)) {
    return { valid: false, error: 'Stand transfer requires matching uniform DC sections immediately above and below the jar.' };
  }
  const makeup = Array.from({ length: Math.abs(standChange) }, () => standMakeupFt.map(Number)).flat();
  const transferFt = makeup.reduce((sum, length) => sum + length, 0);
  const donor = standChange < 0 ? source.lower : source.upper;
  if (Number(donor.length) - transferFt <= 1e-6) {
    return { valid: false, error: 'The adjacent donor DC section cannot supply this complete stand while retaining positive length.' };
  }

  const nextBha = clone(bha);
  const rows = nextBha.rows.filter(populatedComponent);
  const jar = rows[source.index];
  const rawIndex = row => row.rowId ? nextBha.rows.findIndex(item => item.rowId === row.rowId) : bha.rows.indexOf(row);
  const rawJarIndex = rawIndex(jar);
  const rawDonorIndex = rawIndex(donor);
  if (rawJarIndex < 0 || rawDonorIndex < 0) return { valid: false, error: 'The selected jar or adjacent DC row is missing from the candidate BHA.' };
  const donorClone = nextBha.rows[rawDonorIndex];
  setLength(donorClone, Number(donorClone.length) - transferFt);
  const transferredRows = makeup.map((length, index) => {
    const joint = clone(donorClone);
    joint.rowId = `${donorClone.rowId || `dc-row-${rawDonorIndex + 1}`}-${candidateId || 'stand'}-joint-${index + 1}`;
    joint.length = length;
    joint.toolName = `${donorClone.toolName || 'DC'} (transferred stand joint ${index + 1})`;
    if (joint.componentDefinition) joint.componentDefinition = { ...joint.componentDefinition, length };
    return joint;
  });
  // Bit-to-surface order: negative change moves the jar toward bit, so the
  // donor stand from below is placed above it; positive does the reverse.
  nextBha.rows.splice(standChange < 0 ? rawJarIndex + 1 : rawJarIndex, 0, ...transferredRows);
  const candidate = makeCandidate({ bha, jarIndex, method: JAR_POSITIONING_METHODS.REPOSITION, candidateId, nextBha, bitMdFt, surfaceMdFt });
  if (!candidate.valid) return candidate;
  const movementFt = standChange * standMakeupFt.reduce((sum, length) => sum + Number(length), 0);
  return { ...candidate, movementFt, requestedStandChange: standChange, positioningUnit: 'stand', standMakeupFt: [...standMakeupFt],
    addedDcJointsAbove: 0, removedDcJointsAbove: 0, addedDcLengthAboveFt: 0, removedDcLengthAboveFt: 0,
    warnings: [...candidate.warnings, `${Math.abs(standChange)} measured DC stand(s) transferred across the jar; total length and nominal weight are preserved. Rig handling remains unverified unless independently confirmed.`] };
}

export function buildFixedAnvilCandidates({
  bha, jarIndex, jointLengthFt = 30, minimumJoints = 0, maximumJoints = 2, jointIncrement = 1,
  inventoryAction = 'add-remove', inventoryMode = 'both', sourceRowIndex = null, bitMdFt, surfaceMdFt = 0, candidatePrefix = 'fixed-anvil',
  standMakeupFt = null, countUnit = 'joint'
}) {
  const g = fixedAnvilConfigurationGeometry(bha, jarIndex);
  if (!finitePositive(jointLengthFt) || ![minimumJoints, maximumJoints, jointIncrement].every(Number.isFinite) ||
      !Number.isInteger(minimumJoints) || !Number.isInteger(maximumJoints) || !Number.isInteger(jointIncrement) ||
      jointIncrement < 1 || maximumJoints < minimumJoints) throw Error('Use a positive collar joint length and integer joint counts with minimum <= maximum and increment >= 1.');
  if (standMakeupFt && (!Array.isArray(standMakeupFt) || !standMakeupFt.length || standMakeupFt.some(length => !finitePositive(length)) ||
      Math.abs(standMakeupFt.reduce((sum, length) => sum + Number(length), 0) - Number(jointLengthFt)) > 1e-7)) {
    throw Error('Stand footage must equal the sum of its measured DC joint makeup.');
  }
  if (!['add', 'remove', 'add-remove', 'reallocate'].includes(inventoryAction) || !['add', 'remove', 'both'].includes(inventoryMode)) throw Error('Choose a supported inventory action and add/remove direction.');
  const counts = [];
  for (let count = minimumJoints; count <= maximumJoints; count += jointIncrement) {
    if (inventoryMode === 'add' && count < 0) continue;
    if (inventoryMode === 'remove' && count > 0) continue;
    counts.push(count);
  }
  if (!counts.includes(0)) counts.push(0);
  const uniqueCounts = [...new Set(counts)].sort((a, b) => a - b);
  if (uniqueCounts.length > 25) throw Error('Limit candidate configurations to 25, including the current configuration.');
  const target = g.rows[g.index + 1];
  if (!uniformResizableDc(target)) throw Error('Fixed-anvil mode requires a uniform, single-inventory drill-collar section immediately above the jar; no other tool is resized.');
  if (!finitePositive(target.weight)) throw Error('Fixed-anvil mode requires the selected DC row to have a positive nominal linear weight to account for candidate weight changes.');
  const output = [], rejected = [];
  uniqueCounts.forEach((count, ordinal) => {
    const candidateId = `${candidatePrefix}-${ordinal + 1}`;
    if (count === 0) {
      const base = makeCandidate({ bha, jarIndex, method: JAR_POSITIONING_METHODS.FIXED_ANVIL, candidateId, nextBha: clone(bha), sourceGeometry: g, bitMdFt, surfaceMdFt });
      if (!Number.isFinite(base.totalCalculatedWeightLbf)) { rejected.push({ candidateId, requestedJointChange: 0, error: 'Total nominal BHA weight is unavailable because a component lacks a positive linear weight.' }); return; }
      output.push({ ...base, requestedJointChange: 0, requestedStandChange: countUnit === 'stand' ? 0 : null, positioningUnit: countUnit, standMakeupFt: standMakeupFt || null, jointLengthFt, addedDcLengthAboveFt: 0, removedDcLengthAboveFt: 0,
        addedDcJointsAbove: 0, removedDcJointsAbove: 0, inventoryAction: inventoryAction === 'reallocate' ? 'reallocate' : inventoryAction,
        sourceRowIndex: inventoryAction === 'reallocate' ? sourceRowIndex : null, warnings: ['Reference configuration; lower assembly is unchanged.'] });
      return;
    }
    const sign = Math.sign(count), footage = Math.abs(count) * Number(jointLengthFt);
    const nextBha = clone(bha), rows = nextBha.rows.filter(populatedComponent), targetClone = rows[g.index + 1];
    let candidateAction = inventoryAction;
    if (candidateAction === 'add-remove') candidateAction = 'add-remove';
    if (candidateAction === 'reallocate') {
      if (!Number.isInteger(sourceRowIndex)) { rejected.push({ candidateId, requestedJointChange: count, error: 'Reallocation requires an explicitly selected source DC row above the jar.' }); return; }
      const donor = rows[sourceRowIndex];
      const path = rows.slice(g.index + 2, sourceRowIndex + 1);
      if (sourceRowIndex <= g.index + 1 || category(donor) !== 'DC' || !uniformResizableDc(donor) || propertyKey(donor) !== propertyKey(target) ||
          path.some(row => category(row) !== 'DC' || !uniformResizableDc(row) || propertyKey(row) !== propertyKey(target))) {
        rejected.push({ candidateId, requestedJointChange: count, error: 'Selected source must be within the contiguous uniform DC block above the jar and match the immediately upper DC. Stabilizers, HWDP and other tools cannot be crossed or shifted.' }); return;
      }
      if (sign > 0) {
        if (Number(donor.length) - footage <= 1e-6) { rejected.push({ candidateId, requestedJointChange: count, error: 'Source DC does not contain enough footage while retaining positive length.' }); return; }
        setLength(donor, Number(donor.length) - footage); setLength(targetClone, Number(targetClone.length) + footage);
      } else {
        if (Number(targetClone.length) - footage <= 1e-6) { rejected.push({ candidateId, requestedJointChange: count, error: 'The DC section above the jar does not contain enough footage to reallocate.' }); return; }
        setLength(targetClone, Number(targetClone.length) - footage); setLength(donor, Number(donor.length) + footage);
      }
    } else if (count < 0 && standMakeupFt && countUnit === 'stand' && inventoryAction !== 'reallocate') {
      const jarRawIndex = nextBha.rows.findIndex(row => row.rowId === g.jar.rowId);
      const removeRows = Math.abs(count) * standMakeupFt.length;
      const actual = nextBha.rows.slice(jarRawIndex + 1, jarRawIndex + 1 + removeRows);
      const expectedLengths = Array.from({ length: Math.abs(count) }, () => standMakeupFt).flat();
      const matches = actual.length === expectedLengths.length && actual.every((row, index) => category(row) === 'DC' && uniformResizableDc(row) && Math.abs(Number(row.length) - Number(expectedLengths[index])) <= 1e-7 && propertyKey(row) === propertyKey(target));
      if (!matches) { rejected.push({ candidateId, requestedJointChange: count, requestedStandChange: count, error: 'Cannot remove this stand: the loaded BHA has no matching discrete DC joint rows with the entered measured makeup immediately above the jar.' }); return; }
      nextBha.rows.splice(jarRawIndex + 1, removeRows);
      candidateAction = 'removal';
    } else {
      if ((candidateAction === 'add' && sign < 0) || (candidateAction === 'remove' && sign > 0)) {
        rejected.push({ candidateId, requestedJointChange: count, error: `This inventory action does not permit ${sign < 0 ? 'removing' : 'adding'} collars.` }); return;
      }
      const nextLength = Number(targetClone.length) + count * Number(jointLengthFt);
      if (nextLength <= 1e-6) { rejected.push({ candidateId, requestedJointChange: count, error: 'Removal would leave a zero or negative DC section above the jar.' }); return; }
      if (count > 0 && standMakeupFt && countUnit === 'stand') {
        const jointRows = Array.from({ length: count }, (_, standIndex) => standMakeupFt.map((length, jointIndex) => {
          const joint = clone(targetClone);
          const id = `${targetClone.rowId || 'dc'}-${candidateId}-stand-${standIndex + 1}-joint-${jointIndex + 1}`;
          joint.rowId = id; joint.length = Number(length); joint.toolName = `${targetClone.toolName || 'DC'} (stand ${standIndex + 1}, joint ${jointIndex + 1})`;
          if (joint.componentDefinition) { joint.componentDefinition = { ...joint.componentDefinition, length: Number(length) }; }
          return joint;
        })).flat();
        const jarRawIndex = nextBha.rows.findIndex(row => row.rowId === g.jar.rowId);
        if (jarRawIndex < 0) { rejected.push({ candidateId, requestedJointChange: count, error: 'Selected jar row is missing from the candidate BHA.' }); return; }
        nextBha.rows.splice(jarRawIndex + 1, 0, ...jointRows);
      } else setLength(targetClone, nextLength);
      candidateAction = count > 0 ? 'addition' : 'removal';
    }
    // Every row below the selected jar must remain byte-for-byte identical.
    for (let i = 0; i < g.index; i++) {
      if (JSON.stringify(rows[i]) !== JSON.stringify(g.rows[i])) {
        rejected.push({ candidateId, requestedJointChange: count, error: `Fixed-anvil invariant failed: component row ${i + 1} below the jar changed.` }); return;
      }
    }
    const candidate = makeCandidate({ bha, jarIndex, method: JAR_POSITIONING_METHODS.FIXED_ANVIL, candidateId, nextBha, sourceRowIndex: candidateAction === 'reallocate' ? sourceRowIndex : null, sourceGeometry: g, bitMdFt, surfaceMdFt });
    if (!Number.isFinite(candidate.totalCalculatedWeightLbf)) { rejected.push({ candidateId, requestedJointChange: count, error: 'Total nominal BHA weight is unavailable because a component lacks a positive linear weight.' }); return; }
    const adds = candidateAction === 'addition' || (candidateAction === 'reallocate' && sign > 0);
    const removes = candidateAction === 'removal' || (candidateAction === 'reallocate' && sign < 0);
    const changedJointCount = Math.abs(count) * (countUnit === 'stand' && standMakeupFt ? standMakeupFt.length : 1);
    output.push({ ...candidate, movementFt: count, requestedJointChange: count, requestedStandChange: countUnit === 'stand' ? count : null,
      positioningUnit: countUnit, jointLengthFt, standMakeupFt: standMakeupFt || null, inventoryAction: candidateAction,
      addedDcJointsAbove: adds && candidateAction !== 'reallocate' ? changedJointCount : 0,
      removedDcJointsAbove: removes && candidateAction !== 'reallocate' ? changedJointCount : 0,
      reallocatedDcJointsAbove: candidateAction === 'reallocate' ? Math.sign(count) * changedJointCount : 0,
      addedDcLengthAboveFt: adds && candidateAction !== 'reallocate' ? footage : 0,
      removedDcLengthAboveFt: removes && candidateAction !== 'reallocate' ? footage : 0,
      reallocatedDcLengthAboveFt: candidateAction === 'reallocate' ? count * jointLengthFt : 0,
      warnings: candidateAction === 'reallocate' ? [`${Math.abs(count)} joint(s) reallocated between adjacent and explicitly named source DC row ${sourceRowIndex + 1}; total length and nominal weight remain constant.`]
        : [`${Math.abs(count)} DC joint(s) ${adds ? 'added' : 'removed'} immediately above the jar. The existing depth-dependent deployment recalculates uppermost DP footage by ${candidate.drillpipeLengthChangeFt} ft; deployed bit-to-surface length is reported explicitly and nominal weight changes by ${candidate.changeInCalculatedWeightLbf} lbf.`] });
  });
  return { candidates: output, rejected, geometry: g };
}
