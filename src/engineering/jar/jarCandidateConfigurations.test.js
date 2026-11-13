import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import { comparisonGeometry } from './realBhaComparison';
import { buildFixedAnvilCandidates, makeRepositionCandidate, makeStandRepositionCandidate } from './jarCandidateConfigurations';
import { deployDrillstring } from '../bha/deployDrillstring';

const bha = frozen.workingCopy;

test('Mode 1 retains the existing Mode A candidate geometry, inventory, length and calculated weight', () => {
  const original = JSON.stringify(bha), result = makeRepositionCandidate({ bha, jarIndex: 0, movementFt: 30, candidateId: 'mode-a-test', bitMdFt: 9318 });
  expect(result.valid).toBe(true);
  expect(result.candidateId).toBe('mode-a-test');
  expect(result.positioningMethod).toBe('reposition-existing-dc');
  expect(result.jarLocationAboveBitFt).toBeCloseTo(670.83, 8);
  expect(result.totalBhaLengthFt).toBeCloseTo(9318, 8);
  const beforeWeight = makeRepositionCandidate({ bha, jarIndex: 0, movementFt: 0, candidateId: 'mode-a-baseline', bitMdFt: 9318 }).totalCalculatedWeightLbf;
  expect(result.totalCalculatedWeightLbf).toBeCloseTo(beforeWeight, 6);
  expect(result.components.map(row => row.rowId)).toEqual(bha.rows.map(row => row.rowId));
  expect(JSON.stringify(bha)).toBe(original);
});

test('stand-aware Mode A transfers measured collar joints across the jar and keeps the current BHA unchanged', () => {
  const before = JSON.stringify(bha), makeup = [30];
  const towardBit = makeStandRepositionCandidate({ bha, jarIndex: 0, standChange: -1, standMakeupFt: makeup, candidateId: 'stand-minus-one', bitMdFt: 9318 });
  const towardSurface = makeStandRepositionCandidate({ bha, jarIndex: 0, standChange: 1, standMakeupFt: makeup, candidateId: 'stand-plus-one', bitMdFt: 9318 });
  const baseline = makeStandRepositionCandidate({ bha, jarIndex: 0, standChange: 0, standMakeupFt: makeup, candidateId: 'stand-current', bitMdFt: 9318 });
  expect([towardBit.valid, towardSurface.valid, baseline.valid]).toEqual([true, true, true]);
  expect(towardBit.jarLocationAboveBitFt).toBeCloseTo(610.83, 8);
  expect(towardSurface.jarLocationAboveBitFt).toBeCloseTo(670.83, 8);
  expect(baseline.components.map(row => row.rowId)).toEqual(bha.rows.map(row => row.rowId));
  for (const candidate of [towardBit, towardSurface]) {
    const transferred = candidate.components.filter(row => row.toolName?.includes('transferred stand joint'));
    expect(transferred).toHaveLength(1);
    expect(Number(transferred[0].length)).toBe(30);
    expect(candidate.totalBhaLengthFt).toBeCloseTo(9318, 8);
    expect(candidate.totalCalculatedWeightLbf).toBeCloseTo(baseline.totalCalculatedWeightLbf, 6);
    expect(new Set(candidate.components.map(row => row.rowId)).size).toBe(candidate.components.length);
  }
  expect(JSON.stringify(bha)).toBe(before);
});

test('stand-aware Mode A retains baseline and rejects a full stand that would consume adjacent donor section', () => {
  const rejected = makeStandRepositionCandidate({ bha, jarIndex: 0, standChange: 1, standMakeupFt: [30, 30, 30], candidateId: 'oversized-upper-transfer', bitMdFt: 9318 });
  expect(rejected.valid).toBe(false);
  expect(rejected.error).toMatch(/donor DC section/i);
  const baseline = makeStandRepositionCandidate({ bha, jarIndex: 0, standChange: 0, standMakeupFt: [30, 30, 30], candidateId: 'current-only', bitMdFt: 9318 });
  expect(baseline.valid).toBe(true);
  expect(baseline.jarLocationAboveBitFt).toBeCloseTo(640.83, 8);
});

test('fixed-anvil add/remove changes only the immediate upper DC section and accounts length and nominal weight', () => {
  const original = JSON.stringify(bha), g = comparisonGeometry(bha, 0);
  const plan = buildFixedAnvilCandidates({ bha, jarIndex: 0, bitMdFt: 9318, jointLengthFt: 30, minimumJoints: -1, maximumJoints: 1, jointIncrement: 1, inventoryAction: 'add-remove', inventoryMode: 'both' });
  expect(plan.candidates.map(c => c.requestedJointChange)).toEqual([-1, 0, 1]);
  for (const candidate of plan.candidates) {
    expect(candidate.valid).toBe(true);
    expect(candidate.jarLocationAboveBitFt).toBeCloseTo(g.currentCentreFt, 8);
    expect(candidate.components.slice(0, g.index)).toEqual(g.rows.slice(0, g.index));
    expect(candidate.components[g.index]).toEqual(g.jar);
  }
  expect(plan.candidates[0].totalBhaLengthFt).toBeCloseTo(9318, 8);
  expect(plan.candidates[1].totalBhaLengthFt).toBeCloseTo(9318, 8);
  expect(plan.candidates[2].totalBhaLengthFt).toBeCloseTo(9318, 8);
  expect(plan.candidates[2].drillpipeLengthChangeFt).toBeCloseTo(-30, 8);
  expect(plan.candidates[2].changeInCalculatedWeightLbf).toBeCloseTo(30 * (Number(g.upper.weight) - Number(bha.rows.at(-1).weight)), 6);
  expect(plan.candidates[0].removedDcJointsAbove).toBe(1);
  expect(plan.candidates[2].addedDcJointsAbove).toBe(1);
  expect(JSON.stringify(bha)).toBe(original);
});

test('fixed-anvil reallocation requires explicit property-matched source and conserves total length/weight', () => {
  const donorAssembly = JSON.parse(JSON.stringify(bha));
  const g = comparisonGeometry(donorAssembly, 0), target = g.upper;
  const donor = { ...JSON.parse(JSON.stringify(target)), rowId: 'explicit-upper-dc-source', toolName: 'Named source DC', length: 60, componentDefinition: { ...target.componentDefinition, length: 60 } };
  donorAssembly.rows.splice(donorAssembly.rows.findIndex(row => row.category === 'JAR') + 2, 0, donor);
  const deployedBefore = deployDrillstring(donorAssembly, 9318).bha.rows;
  const before = deployedBefore.reduce((sum, row) => sum + Number(row.length) * Number(row.weight), 0), totalBefore = deployedBefore.reduce((sum, row) => sum + Number(row.length), 0);
  const sourceIndex = donorAssembly.rows.filter(row => row && row.category).findIndex(row => row.rowId === donor.rowId);
  const plan = buildFixedAnvilCandidates({ bha: donorAssembly, jarIndex: 0, bitMdFt: 9318, jointLengthFt: 30, minimumJoints: 0, maximumJoints: 1, jointIncrement: 1, inventoryAction: 'reallocate', inventoryMode: 'add', sourceRowIndex: sourceIndex });
  expect(plan.rejected).toEqual([]);
  expect(plan.candidates).toHaveLength(2);
  const moved = plan.candidates.find(candidate => candidate.requestedJointChange === 1);
  expect(moved.sourceRowIndex).toBe(sourceIndex);
  expect(moved.totalBhaLengthFt).toBeCloseTo(totalBefore, 8);
  expect(moved.totalCalculatedWeightLbf).toBeCloseTo(before, 6);
  expect(moved.components.find(row => row.rowId === donor.rowId).length).toBe(30);
  expect(moved.components.find(row => row.rowId === target.rowId).length).toBe(Number(target.length) + 30);
  const blocked = buildFixedAnvilCandidates({ bha, jarIndex: 0, bitMdFt: 9318, jointLengthFt: 30, minimumJoints: 0, maximumJoints: 1, jointIncrement: 1, inventoryAction: 'reallocate', inventoryMode: 'add', sourceRowIndex: 3 });
  expect(blocked.candidates).toHaveLength(1);
  expect(blocked.rejected[0].error).toMatch(/identical properties|source|DC block/i);
});

test('fixed-anvil rejects impossible transfers and enforces the candidate cap', () => {
  expect(() => buildFixedAnvilCandidates({ bha, jarIndex: 0, bitMdFt: 9318, jointLengthFt: 30, minimumJoints: -25, maximumJoints: 0, jointIncrement: 1, inventoryMode: 'remove' })).toThrow(/25|limit/i);
  const plan = buildFixedAnvilCandidates({ bha, jarIndex: 0, bitMdFt: 9318, jointLengthFt: 30, minimumJoints: -4, maximumJoints: 0, jointIncrement: 1, inventoryAction: 'add-remove', inventoryMode: 'remove' });
  expect(plan.candidates.some(candidate => candidate.requestedJointChange === -4)).toBe(false);
  expect(plan.rejected.some(candidate => candidate.requestedJointChange === -3)).toBe(true);
});

test('stand-based Mode B adds measured joint rows and refuses removal from aggregate collar footage', () => {
  const makeup = [29.8, 30.1, 29.9];
  const added = buildFixedAnvilCandidates({ bha, jarIndex: 0, bitMdFt: 9318, jointLengthFt: 89.8, minimumJoints: 0, maximumJoints: 1, jointIncrement: 1, inventoryAction: 'add-remove', inventoryMode: 'add', standMakeupFt: makeup, countUnit: 'stand' });
  expect(added.candidates).toHaveLength(2);
  const candidate = added.candidates.find(row => row.requestedStandChange === 1);
  expect(candidate.components.filter(row => row.toolName?.includes('stand 1, joint')).map(row => Number(row.length))).toEqual(makeup);
  expect(candidate.addedDcJointsAbove).toBe(3);
  expect(candidate.totalBhaLengthFt).toBeCloseTo(9318, 8);

  const removed = buildFixedAnvilCandidates({ bha, jarIndex: 0, bitMdFt: 9318, jointLengthFt: 89.8, minimumJoints: -1, maximumJoints: 0, jointIncrement: 1, inventoryAction: 'add-remove', inventoryMode: 'remove', standMakeupFt: makeup, countUnit: 'stand' });
  expect(removed.candidates).toHaveLength(1);
  expect(removed.rejected[0].error).toMatch(/no matching discrete DC joint rows/);
});
