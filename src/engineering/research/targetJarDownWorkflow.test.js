import strokeCases from '../../../docs/ValidationStudies/JarDownStrokeAndStuckPointStage5C12H.independent.json';
import { calculateTargetStatic, calculateTargetDynamics } from './targetJarDownWorkflow';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import independent from '../../../docs/ValidationStudies/JarDownSimplifiedWorkflowStage5C12B.independent.json';
const rows = [
  { category: 'DC', length: 40, weight: 20, od: 6, idSize: 2 },
  { category: 'JAR', length: 20, weight: 30, od: 6, idSize: 2 },
  { category: 'DC', length: 80, weight: 20, od: 6, idSize: 2 },
  { category: 'DP', length: 100, lengthMode: 'defined', weight: 10, od: 4, idSize: 2 }
];
const bha = { id: 'independent-target', mudWeight: 32.75, frictionCoefficient: .25, holeSize: 8, rows };
const survey = (inc = 0, end = 240) => calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: inc, azimuthDeg: 90 }, { mdFt: end, inclinationDeg: inc, azimuthDeg: 90 }]);
const base = { bha, survey: survey(), bitMdFt: 240, surfaceMdFt: 0, targetKlbf: '.45',
  settings: { stuckPointFt: '0', strokeIn: '.12', youngsModulusPsi: 16000000, densitySlugFt3: 9, gravityFtS2: 0, horizonS: .12 } };
test('confirmed BHA-derived short-stroke history matches independent force-wave fixture', () => {
  const s = calculateTargetStatic({ ...base, settings: { ...base.settings, strokeIn: '.0001' } });
  const d = calculateTargetDynamics(s, base.survey, true);
  expect(d.valid).toBe(true);
  for (const key of ['totalLbfS', 'incrementalLbfS', 'peakTotalCompressionLbf', 'minimumTotalCompressionLbf', 'averageTotalCompressionLbf']) {
    expect(Math.abs(d.observation[key] - independent.observation[key])).toBeLessThan(1e-7);
  }
  expect(d.contact.transitions).toHaveLength(independent.transitions.length);
});
test('independent vertical target 450 lbf requires 1000 lbf surface support, with mapped shapes only', () => {
  // Independent G=.5*(100*10+80*20+10*30)=1450; H=1450-450=1000.
  const r = calculateTargetStatic(base);
  expect(r.valid).toBe(true);
  expect(r.inverse.requiredSurfaceHookloadLbf).toBeCloseTo(1000, 1);
  expect(Math.abs(r.inverse.jarAxialLoadLbf - 450)).toBeLessThanOrEqual(.01);
  expect(r.dynamicInput.compressionLbf).toBe(450);
  // Off-bottom end load is zero: BF * total entered string weight = .5 * 4000.
  expect(r.referenceCandidates).toHaveLength(1);
  expect(r.referenceCandidates[0].valueLbf).toBeCloseTo(2000, 6);
  expect(r.referenceCandidates[0].loadCase).toBe('slackoff');
  expect(r.dynamicInput.upperRods.map(x => x.lengthFt)).toEqual([100, 80]);
  expect(r.dynamicInput.lowerRods.map(x => x.lengthFt)).toEqual([40]);
  expect(calculateTargetDynamics(r, base.survey, false).valid).toBe(false);
  const d = calculateTargetDynamics(r, base.survey, true);
  expect(d.valid).toBe(true); expect(d.compressionLbf).toBe(450);
  expect(d.assessment.canAdopt).toBe(true);
});
test('directional inverse reuses friction, not a one-for-one load change', () => {
  const r = calculateTargetStatic({ ...base, survey: survey(60), targetKlbf: '.1' });
  const expected = 1450 * (.5 - .25 * Math.sin(Math.PI / 3)) - 100;
  expect(r.valid).toBe(true);
  expect(Math.abs(r.inverse.requiredSurfaceHookloadLbf - expected)).toBeLessThan(.02);
  expect(r.limitations.join(' ')).toContain('Directional-well');
  // Constant inclination: sum of buoyed weight times (cos I - mu sin I).
  expect(r.referenceCandidates[0].valueLbf).toBeCloseTo(2000 * (.5 - .25 * Math.sin(Math.PI / 3)), 6);
});
test.each(['', '0', '-1', '2'])('unsupported target %s yields no invented hookload', targetKlbf => {
  const r = calculateTargetStatic({ ...base, targetKlbf });
  expect(r.valid).toBe(false);
  expect(r).not.toHaveProperty('dynamicInput');
  expect(r.inverse).not.toHaveProperty('requiredSurfaceHookloadLbf');
});
test.each([{ survey: null }, { bha: { ...bha, rows: [] } }, { bha: { ...bha, frictionCoefficient: '' } }])('missing static inputs reject inverse: %j', extra => {
  expect(calculateTargetStatic({ ...base, ...extra }).valid).toBe(false);
});
test('multi-jar geometry is not assigned an implicit target jar', () => {
  const r = calculateTargetStatic({ ...base, bha: { ...bha, rows: rows.map((r, i) => i === 0 ? { ...r, category: 'JAR' } : r) } });
  expect(r.valid).toBe(false); expect(r.errors.join(' ')).toContain('no jar is selected implicitly');
});
test('unsupported dynamic geometry or missing settings retains independently valid static result', () => {
  const r = calculateTargetStatic({ ...base, bha: { ...bha, rows: rows.map((x, i) => i === 2 ? { ...x, category: 'HWDP' } : x) } });
  expect(r.valid).toBe(true); expect(r.dynamicInput).toBeNull();
  expect(r.inverse.requiredSurfaceHookloadLbf).toBeCloseTo(1000, 1);
  expect(calculateTargetDynamics(r, base.survey, true).valid).toBe(false);
  const missing = calculateTargetStatic({ ...base, settings: { ...base.settings, strokeIn: '' } });
  expect(missing.valid).toBe(true); expect(missing.dynamicInput).toBeNull();
});
test('existing buckling screening onset is retained without altering the requested force', () => {
  const longBha = { ...bha, rows: rows.map(r => ({ ...r, length: r.category === 'DP' ? 20000 : r.length, youngsModulusPsi: 30000000, bucklingIdealizationConfirmed: true })) };
  const r = calculateTargetStatic({ ...base, bha: longBha, bitMdFt: 20140, survey: survey(60, 20140), targetKlbf: '28' });
  expect(r.valid).toBe(true);
  expect(r.limitations.join(' ')).toContain('buckling onset');
  expect(Math.abs(r.inverse.jarAxialLoadLbf - 28000)).toBeLessThan(.01);
});

// Independent Decimal force-wave implementation; no production-derived expectations.
test.each(strokeCases)('stroke $strokeIn / stuck point $stuckPointFt matches independent wave history', fixture => {
  const staticResult = calculateTargetStatic({ ...base, settings: { ...base.settings, strokeIn: String(fixture.strokeIn), stuckPointFt: String(fixture.stuckPointFt) } });
  expect(staticResult.dynamicInput.strokeIn).toBe(fixture.strokeIn);
  expect(staticResult.dynamicInput.lowerRods[0].lengthFt).toBe(40-fixture.stuckPointFt);
  expect(staticResult.inverse.requiredSurfaceHookloadLbf).toBeCloseTo(1000, 1);
  const result = calculateTargetDynamics(staticResult, base.survey, true);
  expect(result.valid).toBe(true);
  for (const key of ['totalLbfS', 'incrementalLbfS', 'peakTotalCompressionLbf', 'averageTotalCompressionLbf']) {
    expect(Math.abs(result.observation[key]-fixture.observation[key])).toBeLessThan(1e-7);
  }
  expect(result.contact.transitions).toHaveLength(fixture.contact.transitions.length);
  result.contact.transitions.forEach((event, index) => expect(event.timeS).toBeCloseTo(fixture.contact.transitions[index].timeS, 10));
});
test.each(['40', '50', '-1', ''])('unsupported stuck point %s retains static result without a dynamic fixture fallback', stuckPointFt => {
  const result = calculateTargetStatic({ ...base, settings: { ...base.settings, stuckPointFt } });
  expect(result.valid).toBe(true); expect(result.dynamicInput).toBeNull();
  expect(result.dynamicErrors.length).toBeGreaterThan(0);
});
