import { runRealBhaSkeem } from './realBhaSkeemComparison';
import { prepareJarUpSweep } from './jarUpSweep';
import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import previous from '../../../docs/ValidationStudies/RealBHADynamicStage6E3/study.json';
import { iterationCsv } from '../../Apps/JarConfiguration/iterationTablePresentation';
import { standardComponents } from '../../Apps/BHAEntry/componentStore';
import { resolveBitStructuralProperties } from '../bha/bitStructuralProperties';

const { massKg, velocityMS, stiffnessNm, ...material } = previous.settings;
const settings = { ...material, localTensionLbf: 185000, strokeIn: 7.5, durationS: .05, windowStartS: 0, windowEndS: .05 };
const request = { bha: frozen.workingCopy, bitMdFt: 9318, jarIndex: 0, settings };
test('application sweep uses actual Skeem calculation and reproduces full precision OES references without impact parameters', () => {
  const original = JSON.stringify(request.bha);
  const sweep = prepareJarUpSweep({ ...request, minimumFt: 610.830, maximumFt: 670.830, incrementFt: 30, model: 'non-uniform-skeem' });
  expect(sweep.rejected).toEqual([]); expect(sweep.cases).toHaveLength(3);
  const expected = [
    [4.026028923906896, 797621.2598553874, 3228419.6112442403, 37199.97233845926],
    [4.3047914809231544, 852848.6181606153, 3195413.421260871, 33067.63352688327],
    [4.3599189896978015, 863770.266721166, 3331170.5932215815, 28197.943812521688]
  ];
  const rows = sweep.cases.map((c, i) => {
    const r = runRealBhaSkeem({ ...request, bha: c.bha });
    expect(r.valid).toBe(true); expect(r.maintainedEngagement.admissible).toBe(true);
    expect(r.metrics.fixedTensileNs).toBeCloseTo(-r.metrics.fixedSignedNs, 5);
    [r.impact.impactVelocityMS, r.impact.initialImpactForceN, r.metrics.peakTensileN, r.metrics.fixedTensileNs].forEach((x, j) => expect(x).toBeCloseTo(expected[i][j], j === 0 ? 10 : 5));
    expect(r.trace.some(p => p.stuckN < 0)).toBe(true);
    return { ...r, scenario: 'Base', movementFt: c.movementFt };
  });
  const csv = iterationCsv(rows, 'force', 'oilfield', true, { loadLbf: 185000, strokeIn: 7.5, stuckAboveBit: 0, minimum: 610.83, maximum: 670.83, increment: 30, lengthUnit: 'ft', windowEndMs: 50 });
  expect(csv).toContain('Impact velocity (m/s)'); expect(csv).toContain('Valid*');
  expect(csv).toContain('Applied tensile load at jar'); expect(csv).toContain('185000'); expect(csv).toContain('Impulse window end after impact'); expect(csv).toContain('50');
  expect(csv).toContain(String(rows[0].metrics.fixedTensileNs / 4448.2216152605));
  const changed = runRealBhaSkeem({ ...request, settings: { ...settings, localTensionLbf: 180000 } });
  expect(changed.valid).toBe(true); expect(changed.impact.impactVelocityMS).not.toBe(rows[1].impact.impactVelocityMS);
  expect(JSON.stringify(request.bha)).toBe(original);
});
test('application adapter blocks missing acknowledgement, invalid inputs, unsupported geometry and alternate impulse windows', () => {
  for (const patch of [{ acknowledged: false }, { localTensionLbf: 0 }, { strokeIn: -1 }, { equivalents: {} }, { windowEndS: .12 }, { stuckFromBitFt: NaN }]) {
    const r = runRealBhaSkeem({ ...request, settings: { ...settings, ...patch } });
    expect(r.valid).toBe(false); expect(r.metrics).toBeNull(); expect(r.error).toBeTruthy();
  }
});

test('PDC BIT properties reach the non-uniform solver and preserve valid Mode 2 alternatives', () => {
  const frozenBefore = JSON.stringify(frozen.workingCopy);
  const pdc = standardComponents.find(row => row.id === 'bha-187');
  const properties = { bodyOdIn: '6', boreIdIn: '2.5', densityKgM3: '7850', youngsModulusGPa: '200', provenanceType: 'illustrative',
    provenance: 'Illustrative equivalent PDC body using assumed 6.0-in fishneck OD and 2.5-in bore ID; not manufacturer data.' };
  const bit = { rowId: 'test-pdc-bit', category: 'BIT', selectedToolId: pdc.id, toolName: pdc.name, od: '8.5', idSize: '', weight: '', length: '1',
    componentDefinition: { ...pdc, bitStructuralProperties: properties } };
  const bhaWithBit = { ...frozen.workingCopy, rows: [bit, ...frozen.workingCopy.rows] };
  const missing = runRealBhaSkeem({ bha: { ...bhaWithBit, rows: [{ ...bit, componentDefinition: pdc }, ...frozen.workingCopy.rows] }, bitMdFt: 9318, jarIndex: 1, settings });
  expect(missing.valid).toBe(false);
  expect(missing.error).toContain('BIT 8.5-inch PDC Drill Bit');
  const resolved = resolveBitStructuralProperties(properties);
  const studySettings = { ...settings, stuckFromBitFt: 0 };
  const sweep = prepareJarUpSweep({ bha: bhaWithBit, bitMdFt: 9318, jarIndex: 1, settings: studySettings,
    minimumFt: 611.83, maximumFt: 671.83, incrementFt: 30, model: 'non-uniform-skeem' });
  expect(sweep.rejected).toEqual([]);
  expect(sweep.cases.map(candidate => candidate.jarCentreFt)).toEqual([611.83, 641.83, 671.83]);
  const results = sweep.cases.map(candidate => runRealBhaSkeem({ bha: candidate.bha, bitMdFt: 9318, jarIndex: 1, settings: studySettings }));
  expect(results.every(result => result.valid && Number.isFinite(result.impact.impactVelocityMS) && Number.isFinite(result.metrics.peakTensileN))).toBe(true);
  expect(results[1].jarCentreFt).toBeCloseTo(641.83, 8);
  expect(sweep.cases[1].bha.rows[0].componentDefinition.bitStructuralProperties).toEqual(properties);
  expect(resolved.equivalentAreaIn2).toBeCloseTo(23.365, 3);
  expect(JSON.stringify(frozen.workingCopy)).toBe(frozenBefore);
});
