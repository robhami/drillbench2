import fixture from '../../../docs/ValidationStudies/DrillFrameMixedBHAStage6B1.fixture.json';
import { componentEntryDefinition } from '../../Components/BHABuilder/componentEntryDefinition';
import { definitionRowPatch } from './componentDefinition';
import { assessBhaReadiness } from '../../Components/BHABuilder/bhaReadiness';
import { analysisDepth } from './analysisDepth';
import { deployDrillstring } from './deployDrillstring';
import { resolveActiveSurvey, surveyGeometry } from '../../Apps/Survey/surveyAssociation';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { calcOffBottomHookloads } from '../forces/calcOffBottomHookloads';
import { calcStaticJarLoads } from '../jar/staticJarLoads';
import { calculateJarPerformance } from '../../Apps/JarPlacement/skeemPerformance';
import { configurationGeometry } from '../../Apps/JarConfiguration/configurationData';
import { copyResearchGeometry } from '../research/researchJarGeometry';
import { toolType } from '../../Apps/BHAEntry/toolType';
import { calculateTargetStatic } from '../research/targetJarDownWorkflow';
import { calcJarDownBuckling } from '../jar/drillstringBuckling';

export const mixedBha = () => ({ ...fixture, rows: fixture.rows.map(row => row.category !== 'STB' ? { ...row } : {
  ...row, ...definitionRowPatch(componentEntryDefinition({ ...row, id: row.rowId, name: row.toolName,
    material: { name: 'Unspecified', densityLbFt3: '', youngsModulusPsi: '' },
    stabilizer: { mode: 'centred', bladeOd: 8.5, bladeLength: 2 } }))
}) });
const operating = { strokeIn: 4, overpullKlbf: 165, stuckPointFt: 0 };
const demoBha = { rows: [
  { category: 'DC', length: 60, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'JAR', length: 10 },
  { category: 'DC', length: 180, od: 6.25, idSize: 2.75, weight: 84.01718313127864 },
  { category: 'DP', length: 3000, od: 4.5, idSize: Math.sqrt(13.95), weight: 16.6 }
] };
const inputs = bha => ({ bha, survey: surveyGeometry(resolveActiveSurvey(bha)), bitMdFt: 10000, surfaceMdFt: 0,
  mudWeightPpg: 10, frictionCoefficient: .25, rpm: 150, ropFtHr: 60 });

test('mixed input, centred blades, HWDP category and Auto deployment preserve all row data', () => {
  const bha = mixedBha(), before = JSON.stringify(bha), restored = JSON.parse(before);
  expect(assessBhaReadiness(restored).valid).toBe(true); expect(toolType.some(t => t.name === 'HWDP')).toBe(true);
  expect(analysisDepth(restored).bitMdFt).toBe(10000);
  const deployed = deployDrillstring(restored, 10000); expect(deployed.valid).toBe(true);
  expect(deployed.metadata.deployedDpLengthFt).toBe(9375);
  expect(deployed.bha.rows.map(r => r.category)).toEqual(bha.rows.map(r => r.category));
  expect(deployed.bha.rows.slice(0, -1)).toEqual(bha.rows.slice(0, -1));
  expect(bha.rows[0].componentDefinition.geometry.segments.map(s => [s.length, s.od])).toEqual([[1.5, 6.5], [2, 8.5], [1.5, 6.5]]);
  expect(JSON.stringify(bha)).toBe(before);
});

test('independent piecewise vertical statics: nominal weight, NP interpolation and hookloads', () => {
  const bha = mixedBha(), request = inputs(bha), deployed = deployDrillstring(bha, 10000).bha;
  const bf = 1 - 10 / 65.5;
  // Sum entered air weights: 500+10000+500+9000+1100+9000+15000+400+187500.
  const air = 233000, expectedNp = 110 + (10000 / bf - 11000) / 90;
  for (const mode of ['slide', 'rotate']) {
    const loads = calcSurveyAxialLoads({ ...request, bha: deployed, mode, wobLbf: 10000 });
    expect(loads.valid).toBe(true); expect(loads.neutralPoints[0].fromBitFt).toBeCloseTo(expectedNp, 7);
    expect(loads.components.map(r => r.idSize)).toEqual(bha.rows.map(r => r.idSize));
    expect(loads.components[6].category).toBe('HWDP');
    expect(loads.topOfBhaAxialForce).toBeCloseTo(10000 - air * bf, 6);
  }
  const hook = calcOffBottomHookloads(request);
  for (const key of ['pickupHookload', 'slackOffHookload', 'rotatingHookload']) expect(hook[key].valueLbf).toBeCloseTo(air * bf, 6);
  const staticJar = calcStaticJarLoads({ ...request, direction: 'slackoff', loadMode: 'absolute', surfaceHookloadLbf: air * bf - 10000 });
  expect(staticJar.valid).toBe(true);
});

test('different collar ODs remain input-valid; dynamic section rejection never rejects static weights', () => {
  const bha = mixedBha(); bha.rows[3].od = 6.75;
  expect(assessBhaReadiness(bha).valid).toBe(true);
  expect(calcOffBottomHookloads(inputs(bha)).pickupHookload.valid).toBe(true);
  const result = calculateJarPerformance(bha, operating);
  expect(result.valid).toBe(false); expect(result.error).toMatch(/Row 1.*STB.*Unsupported geometry/);
  expect(result.input).toBeUndefined(); expect(configurationGeometry(bha).valid).toBe(false);
  expect(copyResearchGeometry(deployDrillstring(bha, 10000).bha, 0).error).toMatch(/Dynamic Jar Down.*Row.*requires/);
});

test('Auto DP blank stored length is deployed for a supported uniform dynamic reference', () => {
  const bha = { ...demoBha, drillpipeReferenceBitMdFt: 3250, rows: demoBha.rows.map(r => r.category === 'DP' ? { ...r, length: '', lengthMode: 'auto' } : r) };
  const before = JSON.stringify(bha), result = calculateJarPerformance(bha, operating);
  expect(result.valid).toBe(true); expect(result.input.freePipeLengthFt).toBe(3000);
  expect(result.impulseLbfS).toBeCloseTo(12303.474541984585, 8); expect(JSON.stringify(bha)).toBe(before);
});

test('uniform envelope with independently different collar weights is not silently treated as uniform dynamic mass', () => {
  const bha = { ...demoBha, rows: demoBha.rows.map((r, i) => i === 2 ? { ...r, weight: 100 } : r) };
  expect(calculateJarPerformance(bha, operating).error).toMatch(/Row 3.*Mixed collar linear weights/);
});

test.each([{ length: '' }, { length: -1 }, { category: '' }])('precise row diagnostic for genuinely incomplete input %j', patch => {
  const bha = mixedBha(); Object.assign(bha.rows[3], patch);
  expect(assessBhaReadiness(bha).valid).toBe(false);
  expect(calculateJarPerformance(bha, operating).error).toMatch(/Row 4.*(length|category)/);
});

test('complex snapshots, segment weights and supplied material properties are never silently averaged/overridden', () => {
  const bha = mixedBha(); bha.rows[0].componentDefinition.geometry.segments[1].weight = 200;
  expect(assessBhaReadiness(bha).valid).toBe(true);
  expect(calcOffBottomHookloads(inputs(bha)).pickupHookload.reason).toMatch(/Row 1.*segment weights/);
  bha.rows[0].componentDefinition.geometry.segments[1].weight = '';
  bha.rows[0].componentDefinition.material.densityLbFt3 = 170;
  expect(calcOffBottomHookloads(inputs(bha)).pickupHookload.reason).toMatch(/Row 1.*material density/);
  const uniform = JSON.parse(JSON.stringify(demoBha));
  uniform.rows[0].componentDefinition = { geometry: { kind: 'segmented', segments: [{ length: 60, od: 6.25, idSize: 2.75 }] } };
  expect(calculateJarPerformance(uniform, operating).error).toMatch(/Row 1.*segmented geometry/);
  expect(copyResearchGeometry(uniform, 0).error).toMatch(/segmented geometry/);
});

test('varying blade contact does not silently enter directional rotating friction', () => {
  const bha = mixedBha(), req = inputs(bha);
  const survey = surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,30,0\n10000,30,0' });
  const load = calcSurveyAxialLoads({ ...req, bha: deployDrillstring(bha, 10000).bha, survey, mode: 'rotate', wobLbf: 10000 });
  expect(load.valid).toBe(false); expect(load.errors.join(' ')).toMatch(/Row 1.*rotating contact/);
  expect(calcSurveyAxialLoads({ ...req, bha: deployDrillstring(bha, 10000).bha, survey, mode: 'slide', wobLbf: 10000 }).valid).toBe(true);
});

test('Jar Down keeps mixed static inverse result available but exposes no unsupported dynamic input', () => {
  const bha = mixedBha(), result = calculateTargetStatic({ ...inputs(bha), targetKlbf: 5,
    settings: { stuckPointFt: 0, strokeIn: 4, youngsModulusPsi: 30000000, densitySlugFt3: 15.2, gravityFtS2: 32.174, horizonS: .05 } });
  expect(result.valid).toBe(true); expect(result.inverse.valid).toBe(true);
  expect(result.dynamicInput).toBeNull(); expect(result.dynamicErrors.join(' ')).toMatch(/Dynamic Jar Down research: Row/);
});

test('complex/blade structural sections cannot yield annular buckling stiffness or thresholds', () => {
  const bha = mixedBha(), result = calcJarDownBuckling({ ...inputs(bha),
    survey: surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,30,0\n10000,30,0' }),
    direction: 'slackoff', loadMode: 'absolute', surfaceHookloadLbf: 100000, youngsModulusPsi: 30000000 });
  expect(result.valid).toBe(true);
  const stbIntervals = result.intervals.filter(i => i.componentId === 'stb2');
  // The above-jar screening interval need not include below-jar stabilizers.
  expect(stbIntervals).toHaveLength(0);
  const above = mixedBha(); above.rows.splice(6, 0, { ...above.rows[0], rowId: 'upper-stb' });
  const screened = calcJarDownBuckling({ ...inputs(above), survey: surveyGeometry({ confirmed: true, originalCsv: 'MD,Inclination,Azimuth\n0,30,0\n10000,30,0' }),
    direction: 'slackoff', loadMode: 'absolute', surfaceHookloadLbf: 100000, youngsModulusPsi: 30000000 });
  const sections = screened.intervals.filter(i => i.componentId === 'upper-stb');
  expect(sections.length).toBeGreaterThan(0);
  expect(sections.every(s => s.applicability === 'unavailable' && s.bendingStiffnessLbfIn2 === null && s.sinusoidalThresholdLbf === null)).toBe(true);
});
