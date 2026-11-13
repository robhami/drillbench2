import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import reference from '../../../docs/ValidationStudies/MotorStaticJarPositionStage1.json';
import { staticJarPositionGeometry, calculateStaticJarPositions } from './staticJarPosition';
import { calculateSurveyGeometry } from '../survey/surveyGeometry';
import { configurationGeometry } from '../../Apps/JarConfiguration/configurationData';
import { calculateJarPerformance } from '../../Apps/JarPlacement/skeemPerformance';

const input = patch => ({ bha: live.bha, survey: live.survey, bitMdFt: 10000, mode: 'slide', minLowerCollarFt: 300, maxLowerCollarFt: 1200, samples: 4, ...patch });
test('motor identity, dimensions, mass distribution and offset survive relocation; removal restores collar-only geometry and dynamic eligibility', () => {
  const original = JSON.stringify(live.bha), result = calculateStaticJarPositions(input());
  expect(result.valid).toBe(true); expect(result.invalidCount).toBe(0);
  for (const c of [result.actual, ...result.candidates]) {
    expect(c.candidateBha.rows[0]).toEqual(live.bha.rows[0]);
    expect(c.candidateBha.rows[0].category).toBe('RSS_MTR');
    expect(c.load.jars[0].centreFromBitFt).toBeCloseTo(31.16798 + c.lowerCollarLengthFt + 16.5, 9);
    expect(c.lowerCollarLengthFt + c.upperCollarLengthFt).toBe(1500);
    expect(c.deployment.deployedDpLengthFt).toBeCloseTo(8435.83202, 8);
    expect(c.load.components[0].buoyedWeight).toBeCloseTo(Number(live.bha.rows[0].weight) * 31.16798 * (1 - 10 / 65.5), 8);
    expect(configurationGeometry(c.candidateBha).valid).toBe(false);
    expect(c).not.toHaveProperty('impulseLbfS'); expect(c).not.toHaveProperty('impactForceKlbf');
  }
  expect(calculateJarPerformance(live.bha, { strokeIn: 4, overpullKlbf: 165, stuckPointFt: 0 }).valid).toBe(false);
  const removed = { ...live.bha, rows: live.bha.rows.slice(1) };
  expect(staticJarPositionGeometry(removed).motorLengthFt).toBe(0);
  expect(calculateStaticJarPositions(input({ bha: removed })).actual.load.jars[0].centreFromBitFt).toBe(916.5);
  expect(configurationGeometry(removed).valid).toBe(true);
  expect(JSON.stringify(live.bha)).toBe(original);
});

test('vertical statics and directional placement candidates match separately implemented numerical references in Slide and Rotate', () => {
  for (const study of reference.studies) {
    const bha = { ...live.bha, rows: live.bha.rows.slice(study.withMotor ? 0 : 1) };
    const survey = study.directional ? live.survey : calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }, { mdFt: 12000, inclinationDeg: 0, azimuthDeg: 90 }]);
    const result = calculateStaticJarPositions(input({ bha, survey, bitMdFt: study.md, mode: study.mode }));
    expect(result.valid).toBe(true); expect(result.validCount).toBe(4);
    [result.actual, ...result.candidates].forEach((candidate, i) => {
      const expected = study.rows[i];
      expect(Math.abs(expected.coarse.roots[0] - expected.fine.roots[0])).toBeLessThan(.0001);
      expect(candidate.load.neutralPoints).toHaveLength(expected.fine.roots.length);
      expect(Math.abs(candidate.load.neutralPoints[0].fromBitFt - expected.fine.roots[0])).toBeLessThan(study.directional ? .002 : 1e-7);
      expect(Math.abs(candidate.load.jars[0].axialForceLbf - expected.fine.jarForce)).toBeLessThan(study.directional ? .06 : 1e-6);
      expect(candidate.load.jars[0].centreFromBitFt).toBeCloseTo(expected.fine.jarCentre, 8);
      if (!study.directional) {
        // Independently integrate entered buoyed weights to the jar centre.
        const motorWeight = study.withMotor ? 31.16798 * Number(live.bha.rows[0].weight) : 0;
        const jarForce = 25000 - (1 - 10 / 65.5) * (motorWeight + candidate.lowerCollarLengthFt * 92 + 16.5 * 78.8);
        expect(candidate.load.jars[0].axialForceLbf).toBeCloseTo(jarForce, 6);
      }
    });
  }
});

test.each(['length', 'weight', 'od', 'idSize'])('missing motor %s blocks static eligibility instead of inventing a value', field => {
  const bha = { ...live.bha, rows: live.bha.rows.map((r, i) => i ? r : { ...r, [field]: '' }) };
  expect(staticJarPositionGeometry(bha).valid).toBe(false);
});

test('mixed inventory, unsupported motor position, incomplete inputs, extrapolation and partial deployment remain rejected', () => {
  const rows = live.bha.rows;
  expect(staticJarPositionGeometry({ rows: [rows[1], rows[0], ...rows.slice(2)] }).valid).toBe(false);
  expect(staticJarPositionGeometry({ rows: rows.map((r, i) => i === 3 ? { ...r, weight: 93 } : r) }).valid).toBe(false);
  expect(calculateStaticJarPositions(input({ survey: null })).valid).toBe(false);
  expect(calculateStaticJarPositions(input({ mode: 'reference' })).valid).toBe(false);
  expect(calculateStaticJarPositions(input({ minLowerCollarFt: 0 })).valid).toBe(false);
  expect(calculateStaticJarPositions(input({ maxLowerCollarFt: 1500 })).valid).toBe(false);
  expect(calculateStaticJarPositions(input({ samples: 102 })).valid).toBe(false);
  const partial = calculateStaticJarPositions(input({ bitMdFt: 1000 }));
  expect(partial.actual.status).toBe('invalid-deployment'); expect(partial.invalidCount).toBe(4);
  const uncovered = calculateStaticJarPositions(input({ bitMdFt: 12001 }));
  expect(uncovered.actual.status).toBe('outside-survey'); expect(uncovered.invalidCount).toBe(4);
  expect(calculateStaticJarPositions(input({ bha: { ...live.bha, wob: '' } })).valid).toBe(false);
});

test('no-root and neutral-interval outputs remain explicit; fixed minimum deployment omits only DP', () => {
  const noRoot = calculateStaticJarPositions(input({ bha: { ...live.bha, wob: 1000 } }));
  expect(noRoot.actual.load.neutralStatus).toBe('none-within-bha'); expect(noRoot.actual.load.neutralPoints).toEqual([]);
  const horizontal = calculateSurveyGeometry([{ mdFt: 0, inclinationDeg: 90, azimuthDeg: 90 }, { mdFt: 12000, inclinationDeg: 90, azimuthDeg: 90 }]);
  const neutral = calculateStaticJarPositions(input({ survey: horizontal, bha: { ...live.bha, wob: 0, frictionCoefficient: 0 } }));
  expect(neutral.actual.load.neutralStatus).toBe('neutral-interval');
  const boundary = calculateStaticJarPositions(input({ bitMdFt: 1564.16798 }));
  expect(boundary.actual.valid).toBe(true); expect(boundary.actual.deployment.deployedDpLengthFt).toBe(0);
});
