import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';
import { buildLoadedBhaPresentation, buildLoadedBhaSchematicSections, validateLoadedBhaWob } from './loadedBhaPresentation';

const survey400 = calculateSurveyGeometry([
  { mdFt: 0, inclinationDeg: 0, azimuthDeg: 0 },
  { mdFt: 400, inclinationDeg: 0, azimuthDeg: 0 }
]);
const makeBha = (overrides = {}) => ({
  id: 'loaded-geometry', name: 'Loaded live BHA', mudWeight: 10, wob: 20,
  frictionCoefficient: 0.25, inclination: 0, rpm: 60, rop: 120,
  rows: [
    { rowId: 'bit', category: 'BIT', toolName: 'PDC bit', length: 10, od: 8.5, idSize: 0, weight: 40 },
    { rowId: 'lower', category: 'DC', toolName: 'Lower DC', length: 150, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'jar', category: 'JAR', toolName: 'Live jar', length: 30, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'upper', category: 'DC', toolName: 'Upper DC', length: 210, od: 6.5, idSize: 2.813, weight: 100 }
  ], ...overrides
});

it('uses loaded row order, entered dimensions and existing bit-up component geometry', () => {
  const bha = makeBha();
  const before = JSON.stringify(bha);
  const result = buildLoadedBhaPresentation({ bha, survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  const jar = result.positions.components.find(row => row.rowId === 'jar');
  expect(result.deployment.valid).toBe(true);
  expect(result.positions.totalLength).toBe(400);
  expect(jar).toMatchObject({ startFromBit: 160, centreFromBit: 175, endFromBit: 190, length: 30, od: 6.5, idSize: 2.813 });
  expect(JSON.stringify(bha)).toBe(before);
});

it('deploys an auto-length upper DP from the existing analysis-depth convention', () => {
  const bha = makeBha({
    rows: makeBha().rows.slice(0, 4).concat([{ rowId: 'dp', category: 'DP', toolName: 'Drillpipe', length: '', lengthMode: 'auto', od: 5, idSize: 4.276, weight: 20 }]),
    drillpipeReferenceBitMdFt: 1000
  });
  const result = buildLoadedBhaPresentation({ bha, survey: { valid: false, errors: [{ message: 'no survey' }] }, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(result.deployment.valid).toBe(true);
  expect(result.positions.totalLength).toBe(1000);
  expect(result.positions.components.find(row => row.rowId === 'dp').length).toBe(600);
});

it('exposes existing straight-hole and survey loads with their calculation provenance', () => {
  const result = buildLoadedBhaPresentation({ bha: makeBha(), survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(result.straight.loadProfile.valid).toBe(true);
  expect(result.straight.drillingMode).toBe('slide');
  expect(result.straight.loadProfile.components.find(row => row.rowId === 'jar')).toEqual(expect.objectContaining({
    bottomAxialForce: expect.any(Number), topAxialForce: expect.any(Number)
  }));
  expect(result.surveyLoads.valid).toBe(true);
  expect(result.surveyLoads.mode).toBe('slide');
  expect(result.surveyLoads.jars[0].axialForceLbf).toEqual(expect.any(Number));
  expect(result.surveyLoads.neutralPoints.every(point => Number.isFinite(point.fromBitFt) && Number.isFinite(point.mdFt))).toBe(true);
});

it('keeps Reference mode available only in the straight-hole path', () => {
  const result = buildLoadedBhaPresentation({ bha: makeBha(), survey: survey400, drillingMode: 'reference', surfaceReferenceMdFt: 0 });
  expect(result.straight.loadProfile.valid).toBe(true);
  expect(result.straight.drillingMode).toBe('reference');
  expect(result.surveyLoads.valid).toBe(false);
  expect(result.surveyLoads.errors.join(' ')).toMatch(/slide or rotate/i);
});

it('keeps invalid static inputs unavailable and does not require a jar to report loaded geometry', () => {
  const invalid = buildLoadedBhaPresentation({ bha: makeBha({ wob: 'invalid' }), survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(invalid.straight.loadProfile.valid).toBe(false);
  expect(invalid.surveyLoads.valid).toBe(false);
  const noJar = makeBha({ rows: makeBha().rows.filter(row => row.category !== 'JAR') });
  const result = buildLoadedBhaPresentation({ bha: noJar, survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(result.positions.totalLength).toBe(370);
  expect(result.straight.loadProfile.valid).toBe(true);
  expect(result.straight.jars).toHaveLength(0);
  expect(result.surveyLoads.valid).toBe(true);
  expect(result.surveyLoads.jars).toHaveLength(0);
});

it.each([
  ['blank', ''], ['undefined', undefined], ['null', null], ['whitespace', '   '],
  ['nonnumeric', 'not a number'], ['NaN', NaN], ['infinite', Infinity], ['negative', -1]
])('withholds both WOB-dependent result paths for %s while retaining valid geometry', (_label, wob) => {
  const bha = makeBha({ wob });
  const result = buildLoadedBhaPresentation({ bha, survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(result.deployment.valid).toBe(true);
  expect(result.positions.totalLength).toBe(400);
  expect(result.straight.loadProfile.valid).toBe(false);
  expect(result.straight.neutralPointFt).toBeNull();
  expect(result.straight.loadProfile.error).toMatch(/wob/i);
  expect(result.surveyLoads.valid).toBe(false);
  expect(result.surveyLoads.errors.join(' ')).toMatch(/wob/i);
});

it('distinguishes explicit zero WOB from missing WOB and validates each static pathway independently', () => {
  expect(validateLoadedBhaWob(0)).toEqual({ valid: true, value: 0 });
  const zero = buildLoadedBhaPresentation({ bha: makeBha({ wob: 0 }), survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(zero.straight.loadProfile.valid).toBe(true);
  expect(zero.straight.neutralPointFt).toBe(0);
  expect(zero.surveyLoads.valid).toBe(true);

  const blank = makeBha({ wob: '  ' });
  const independent = buildLoadedBhaPresentation({ bha: blank, survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(independent.straight.loadProfile.valid).toBe(false);
  expect(independent.surveyLoads.valid).toBe(false);
  const noSurvey = buildLoadedBhaPresentation({ bha: makeBha(), survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(noSurvey.straight.loadProfile.valid).toBe(true);
  expect(noSurvey.surveyLoads.valid).toBe(false);
});

it('uses the existing constant-diameter adjacent DC interval to separate Lower DC from the fixed Lower BHA', () => {
  const bha = makeBha({ rows: [
    { rowId: 'bit', category: 'BIT', toolName: 'PDC bit', length: 1, od: 8.5, weight: 40 },
    { rowId: 'fixed-dc', category: 'DC', toolName: 'Fixed lower collar', length: 10, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'stb', category: 'STB', toolName: 'Fixed stabilizer', length: 5, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'lower-dc-a', category: 'DC', toolName: 'Lower DC A', length: 20, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'lower-dc-b', category: 'DC', toolName: 'Lower DC B', length: 30, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'jar', category: 'JAR', toolName: 'Selected jar', length: 30, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'upper-dc', category: 'DC', toolName: 'Upper DC', length: 40, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'hwdp', category: 'HWDP', toolName: 'HWDP', length: 50, od: 5, idSize: 3, weight: 40 },
    { rowId: 'dp', category: 'DP', toolName: 'DP', length: 300, od: 5, idSize: 4, weight: 20 }
  ] });
  const result = buildLoadedBhaPresentation({ bha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  const sections = result.schematicSectionsByJarKey.jar;
  expect(result.positions.components.map(component => component.rowId)).toEqual([
    'bit', 'fixed-dc', 'stb', 'lower-dc-a', 'lower-dc-b', 'jar', 'upper-dc', 'hwdp', 'dp'
  ]);
  expect(sections.lowerDcIndices).toEqual([3, 4]);
  expect(sections.lowerBhaIndices).toEqual([0, 1, 2]);
  expect(sections.lowerBoundaryFt).toBe(16);
  expect(sections.lowerConnectionUnverified).toBe(true);
  const view = buildLoadedBhaSchematicSections({ rows: bha.rows, components: result.positions.components, selectedJarKey: 'jar', sectionData: sections });
  expect(view.groups.map(group => group.label)).toEqual(['DP', 'HWDP', 'Upper DC', 'Jar', 'Lower DC', 'Lower BHA', 'Bit']);
  expect(view.groups.find(group => group.label === 'Lower BHA').items.map(item => item.row.category)).toEqual(['STB', 'DC']);
  expect(view.groups.find(group => group.label === 'Jar').items[0].key).toBe('jar');
});

it('marks lower-section classification unavailable when an adjacent DC has insufficient dimensions', () => {
  const bha = makeBha({ rows: [
    { rowId: 'bit', category: 'BIT', length: 1, od: 8.5, weight: 40 },
    { rowId: 'dc-unknown', category: 'DC', toolName: 'Undimensioned lower DC', length: 20, weight: 100 },
    { rowId: 'jar', category: 'JAR', toolName: 'Jar', length: 30, od: 6.5, idSize: 2.813, weight: 100 }
  ] });
  const result = buildLoadedBhaPresentation({ bha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(result.schematicSectionsByJarKey.jar.lowerBoundaryUnresolved).toBe(true);
  expect(result.schematicSectionsByJarKey.jar.lowerBhaIndices).toEqual([0]);
  const view = buildLoadedBhaSchematicSections({ rows: bha.rows, components: result.positions.components, selectedJarKey: 'jar', sectionData: result.schematicSectionsByJarKey.jar });
  expect(view.groups.map(group => group.label)).toEqual(['Jar', 'Section unavailable', 'Bit']);
});

it('shows missing DC sections as absent and recomputes section markers for the selected jar', () => {
  const bha = makeBha({ rows: [
    { rowId: 'bit', category: 'BIT', length: 1, od: 8.5, weight: 40 },
    { rowId: 'jar-a', category: 'JAR', toolName: 'Jar A', length: 30, od: 6.5, idSize: 2.813, weight: 100 },
    { rowId: 'hwdp', category: 'HWDP', length: 10, od: 5, idSize: 3, weight: 40 },
    { rowId: 'jar-b', category: 'JAR', toolName: 'Jar B', length: 30, od: 6.5, idSize: 2.813, weight: 100 }
  ] });
  const result = buildLoadedBhaPresentation({ bha, survey: null, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(result.schematicSectionsByJarKey['jar-a'].lowerDcIndices).toEqual([]);
  expect(result.schematicSectionsByJarKey['jar-a'].lowerBhaIndices).toEqual([0]);
  expect(result.schematicSectionsByJarKey['jar-b'].lowerDcIndices).toEqual([]);
  const selectedA = buildLoadedBhaSchematicSections({ rows: bha.rows, components: result.positions.components, selectedJarKey: 'jar-a', sectionData: result.schematicSectionsByJarKey['jar-a'] });
  const selectedB = buildLoadedBhaSchematicSections({ rows: bha.rows, components: result.positions.components, selectedJarKey: 'jar-b', sectionData: result.schematicSectionsByJarKey['jar-b'] });
  expect(selectedA.selectedKey).toBe('jar-a');
  expect(selectedB.selectedKey).toBe('jar-b');
  expect(selectedA.groups.filter(group => group.label === 'Jar').map(group => group.items[0].key)).toContain('jar-a');
  expect(selectedB.groups.filter(group => group.label === 'Jar').map(group => group.items[0].key)).toContain('jar-b');
});

it('does not present partial auto-DP geometry when the required live bit depth is unavailable', () => {
  const bha = makeBha({
    rows: makeBha().rows.concat([{ rowId: 'dp', category: 'DP', toolName: 'Drillpipe', length: '', lengthMode: 'auto', od: 5, idSize: 4.276, weight: 20 }])
  });
  const result = buildLoadedBhaPresentation({ bha, survey: survey400, drillingMode: 'slide', surfaceReferenceMdFt: 0 });
  expect(result.deployment.valid).toBe(false);
  expect(result.positions).toEqual({ totalLength: 0, components: [] });
  expect(result.straight.valid).toBe(false);
  expect(result.surveyLoads.valid).toBe(false);
});
