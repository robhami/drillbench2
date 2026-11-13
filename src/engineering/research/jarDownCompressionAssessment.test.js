import { calculateCompressionAssessment, assessCompressionCandidate, matchingResearchShapes } from './jarDownCompressionAssessment';
import { copyResearchGeometry } from './researchJarGeometry';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
const bha = { id: 'vertical-independent', mudWeight: 32.75, frictionCoefficient: .25, holeSize: 8,
  rows: [{ category: 'DC', length: 40, weight: 20, od: 6, idSize: 2 }, { category: 'JAR', length: 20, weight: 30 },
    { category: 'DC', length: 80, weight: 20, od: 6, idSize: 2 }, { category: 'DP', length: 100, weight: 10, od: 4, idSize: 2 }] };
const survey = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 0 }, { mdFt: 240, inclinationDeg: 0, azimuthDeg: 0 }]);
const shapes = copyResearchGeometry(bha, 0);
const material = r => ({ ...r, youngsModulusPsi: 16000000, densitySlugFt3: 9 });
const input = { bha, survey, bitMdFt: 240, surfaceMdFt: 0, stuckFt: 0, boundary: { direction: 'slackoff', hookloadKlbf: '1' },
  researchInput: { model: 'ideal-guided-extended-contact', compressionLbf: 123, strokeIn: .01, gravityFtS2: 0, horizonS: .08,
    upperRods: shapes.upperRods.map(material), lowerRods: shapes.lowerRods.map(material) } };
const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1e-7);

test('independent vertical force balance: C=-1000+.5*(100*10+80*20+10*30)=450 lbf', () => {
  const r = calculateCompressionAssessment(input);
  expect(r.canAdopt).toBe(true); expect(r.classification).toBe('Compatible for idealised research');
  near(r.staticForceLbf, 450); near(r.staticCompressionLbf, 450); near(r.staticResult.surfaceHookloadLbf, 1000);
  expect(r.staticResult.jarMdFt).toBe(190); expect(r.inclinationDeg).toBe(0);
  expect(r.limitations.join(' ')).toContain('Buckling screening is unavailable');
  expect(input.researchInput.compressionLbf).toBe(123);
});
test.each([['2', -550], ['1.45', 0]])('tension/zero at explicit boundary %s klbf is never eligible', (hookloadKlbf, force) => {
  const r = calculateCompressionAssessment({ ...input, boundary: { direction: 'slackoff', hookloadKlbf } });
  near(r.staticForceLbf, force); expect(r.staticCompressionLbf).toBe(0); expect(r.canAdopt).toBe(false);
});
test.each([
  { boundary: { direction: 'slackoff', hookloadKlbf: '' } }, { boundary: { direction: 'slackoff', hookloadKlbf: '-1' } },
  { boundary: { direction: 'pickup', hookloadKlbf: '1' } }, { boundary: { direction: 'rotate', hookloadKlbf: '1' } },
  { survey: { valid: false } }, { stuckFt: '' }, { stuckFt: 50 }, { bitMdFt: '' },
  { bha: { ...bha, mudWeight: '' } }, { bha: { ...bha, frictionCoefficient: '' } },
  { bha: { ...bha, rows: bha.rows.filter(r => r.category !== 'JAR') } },
  { researchInput: { ...input.researchInput, strokeIn: 0 } },
  { researchInput: { ...input.researchInput, upperRods: input.researchInput.upperRods.map(r => ({ ...r, areaIn2: 1 })) } }
])('unsupported prerequisites cannot enable adoption: %j', extra => {
  const r = calculateCompressionAssessment({ ...input, ...extra }); expect(r.canAdopt).toBe(false); expect(r.classification).toBe('Unsupported');
});
test('directional/buckling restrictions preserve force and mark significant limitations', () => {
  const s = calculateCompressionAssessment(input).staticResult;
  const base = { staticResult: s, geometryValid: true, dynamicDomain: { valid: true }, survey };
  const noWarning = assessCompressionCandidate({ ...base, buckling: { valid: true, status: 'calculated', summary: { completeCoverage: true } } });
  expect(noWarning.canAdopt).toBe(true); expect(noWarning.limitations.join(' ')).toContain('No buckling warning is not evidence');
  for (const change of [{ survey: { valid: true, stations: [{ inclinationDeg: 60 }] } }, { buckling: { valid: true, status: 'calculated', summary: { firstSinusoidalOnset: { mdFt: 150 } } } }]) {
    const r = assessCompressionCandidate({ ...base, ...change }); expect(r.classification).toBe('Research with significant limitations'); expect(r.canAdopt).toBe(true); expect(r.staticForceLbf).toBe(450);
  }
});
test('actual existing inclined-well screening reports onset; no buckling multiplier alters force', () => {
  const b = { ...bha, rows: bha.rows.map(r => ({ ...r, length: r.category === 'DP' ? 20000 : r.length, youngsModulusPsi: 30000000, bucklingIdealizationConfirmed: true })) };
  const geometry = copyResearchGeometry(b, 0), inclination = 60;
  const r = calculateCompressionAssessment({ ...input, bha: b, bitMdFt: 20140,
    boundary: { direction: 'slackoff', hookloadKlbf: 0 },
    survey: calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: inclination, azimuthDeg: 90 }, { mdFt: 20140, inclinationDeg: inclination, azimuthDeg: 90 }]),
    researchInput: { ...input.researchInput, upperRods: geometry.upperRods.map(material), lowerRods: geometry.lowerRods.map(material) } });
  const weight = .5 * (20000 * 10 + 80 * 20 + 10 * 30);
  near(r.staticForceLbf, weight * (Math.cos(Math.PI / 3) - .25 * Math.sin(Math.PI / 3)));
  expect(r.bucklingOnset).toBe(true); expect(r.canAdopt).toBe(true); expect(r.classification).toBe('Research with significant limitations');
});
test('known Test 4 vertical static fixture uses deployed weights and excludes Jar Up overpull', () => {
  const rows = [{ category: 'STAB', length: 5, weight: 111.25 }, { category: 'DC', length: 300, weight: 116, od: 6.75, idSize: 1.5 },
    { category: 'JAR', length: 30, weight: 150 }, { category: 'DC', length: 180, weight: 116, od: 6.75, idSize: 1.5 },
    { category: 'DP', length: 11485, weight: 27.76, od: 5.5, idSize: 4.67 }];
  const b = { ...bha, mudWeight: 10, rows }, g = copyResearchGeometry(b, 5);
  const request = { ...input, bha: b, bitMdFt: 12000, stuckFt: 5, survey: calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 12000, inclinationDeg: 0, azimuthDeg: 90 }]),
    boundary: { direction: 'slackoff', hookloadKlbf: 120 }, researchInput: { ...input.researchInput, upperRods: g.upperRods.map(material), lowerRods: g.lowerRods.map(material) } };
  const r = calculateCompressionAssessment(request);
  near(r.staticForceLbf, (1 - 10 / 65.5) * (11485 * 27.76 + 180 * 116 + 15 * 150) - 120000);
  expect(r.staticResult.jarMdFt).toBe(11680); expect(r.canAdopt).toBe(true);
  const missing = calculateCompressionAssessment({ ...request, boundary: { direction: 'slackoff', hookloadKlbf: '' } });
  expect(missing.canAdopt).toBe(false); expect(missing.staticForceLbf).toBeNull();
});
test('shape matching uses numerical identity, not a transmission efficiency', () => {
  expect(matchingResearchShapes(shapes, input.researchInput)).toBe(true);
  expect(matchingResearchShapes({ error: 'missing' }, input.researchInput)).toBe(false);
});
