import { simulateExtendedJarDown, integrateSteps, stepValue, auditExtendedState } from './jarDownExtendedDynamics';
import fixtures from '../../../docs/ValidationStudies/SkeemJarDownExtendedDynamicsStage5C9.json';
import early from '../../../docs/ValidationStudies/SkeemJarDownDerivationStage5C8.json';

const close = (actual, expected, tolerance = 1e-9) => expect(Math.abs(actual - expected)).toBeLessThan(tolerance * Math.max(1, Math.abs(expected)));
const base = fixtures.cases.baseline_equalRodsZeroGravity.input;
const motionAt = (rows, t) => {
  const r = rows.filter(e => e.timeS <= t).pop();
  return { ...r, hammerDisplacementFt: r.hammerDisplacementFt + r.hammerVelocityFtS * (t - r.timeS),
    anvilDisplacementFt: r.anvilDisplacementFt + r.anvilVelocityFtS * (t - r.timeS) };
};

describe.each(Object.entries(fixtures.cases))('%s independent force-wave verification', (name, fixture) => {
  const result = simulateExtendedJarDown(fixture.input);
  test('contact transitions and explicit matched-counterfactual impulses', () => {
    expect(result.valid).toBe(true);
    expect(result.productionAvailable).toBe(false);
    expect(result.primaryInterval).toBeNull();
    for (const key of ['contact', 'noContact']) {
      expect(result[key].impactStatus).toBe(fixture[key].impactStatus);
      expect(result[key].transitions.length).toBe(fixture[key].transitions.length);
      result[key].transitions.forEach((e, i) => {
        const f = fixture[key].transitions[i]; expect(e.type).toBe(f.type);
        ['timeS', 'contactForceLbf', 'freeRelativeVelocityFtS', 'gapFt'].forEach(k => close(e[k], f[k]));
      });
    }
    Object.entries(fixture.observation).forEach(([k, v]) => close(result.observation[k], v));
  });
  test('whole-horizon motions, complementarity and bilateral reaction', () => {
    expect(result.valid).toBe(true);
    for (const key of ['contact', 'noContact']) {
      const knots = [...new Set([...result[key].motion.map(e => e.timeS), ...fixture[key].motion.map(e => e.timeS)])].sort((a, b) => a - b);
      for (let i = 1; i < knots.length; i++) {
        if (knots[i] - knots[i - 1] < 1e-12) continue;
        const t = (knots[i] + knots[i - 1]) / 2;
        const actual = motionAt(result[key].motion, t), expected = motionAt(fixture[key].motion, t);
        ['hammerDisplacementFt', 'anvilDisplacementFt', 'hammerVelocityFtS', 'anvilVelocityFtS', 'contactForceLbf'].forEach(k => close(actual[k], expected[k]));
        close(stepValue(result[key].reaction, t), stepValue(fixture[key].reaction, t));
        if (key === 'contact') {
          const gap = fixture.input.strokeIn / 12 - actual.hammerDisplacementFt + actual.anvilDisplacementFt;
          expect(gap).toBeGreaterThanOrEqual(-1e-10);
          expect(actual.contactForceLbf).toBeGreaterThanOrEqual(0);
          close(actual.contactForceLbf * gap, 0, 1e-7);
          if (actual.state === 'engaged-stop') close(actual.hammerVelocityFtS, actual.anvilVelocityFtS);
          else close(actual.contactForceLbf, 0);
        }
        // Direct traction reconstruction on each face: released traction is
        // zero; engaged tractions agree. This checks solver boundary algebra
        // separately from comparison with the force-wave reference.
        const j = result.jarNode, upper = result.rods[j - 1], lower = result.rods[j];
        const incomingA = stepValue(result[key].waveHistories[j - 1].a, t - upper.tau);
        const incomingB = stepValue(result[key].waveHistories[j].b, t - lower.tau);
        close(fixture.input.compressionLbf + upper.Z * (incomingA - actual.hammerVelocityFtS), actual.contactForceLbf);
        close(fixture.input.compressionLbf + lower.Z * (actual.anvilVelocityFtS - incomingB), actual.contactForceLbf);
        close(actual.contactForceLbf * (actual.hammerVelocityFtS - actual.anvilVelocityFtS), 0, 1e-7);
      }
    }
  });
  test('spatial energy/momentum at every transition, before/after, and horizon', () => {
    expect(result.valid).toBe(true);
    for (const key of ['contact', 'noContact']) fixture[key].audits.forEach(expected => {
      const actual = auditExtendedState(result, expected.timeS, key === 'noContact');
      const energyScale = Math.max(1, fixture.input.compressionLbf * fixture.input.strokeIn / 12);
      const impulseScale = Math.max(1, fixture.input.compressionLbf * fixture.input.horizonS);
      expect(Math.abs(actual.energyResidualFtLbf)).toBeLessThan(1e-8 * energyScale);
      expect(Math.abs(actual.momentumResidualLbfS)).toBeLessThan(1e-8 * impulseScale);
      ['kineticEnergyFtLbf', 'elasticEnergyChangeFtLbf', 'gravityEnergyChangeFtLbf', 'waveEnergyFtLbf', 'momentumSlugFtS', 'supportImpulseLbfS'].forEach(k => close(actual[k], expected[k], 1e-7));
    });
  });
});

test.each(Object.entries(early.cases))('unchanged early-window reference: %s', (name, f) => {
  const r = simulateExtendedJarDown(fixtures.cases[`baseline_${name}`].input);
  close(r.contact.transitions[0].timeS, f.expected.impactTimeS);
  close(r.contact.transitions[0].freeRelativeVelocityFtS, f.expected.relativeImpactVelocityFtS);
  close(r.contact.transitions[0].contactForceLbf, f.expected.incidentCompressionLbf);
  close(r.observation.totalLbfS, f.expected.primaryTotalImpulseLbfS);
  close(r.observation.incrementalLbfS, f.expected.excessOverPreReleaseImpulseLbfS);
  close(r.observation.impactAttributableLbfS, f.expected.impactResponseImpulseLbfS);
});

test('late first contacts follow actual upper and lower returns', () => {
  const upper = simulateExtendedJarDown(fixtures.cases.lateUpper.input);
  // First 10 ms closes .02 ft; thereafter relative speed is 3.2 ft/s.
  close(upper.contact.transitions[0].timeS, .01 + (.03 - .02) / 3.2);
  close(upper.contact.transitions[0].contactForceLbf, 1600);
  const lower = simulateExtendedJarDown(fixtures.cases.lowerReturns.input);
  expect(lower.contact.transitions[0].timeS).toBeGreaterThan(.005);
  expect(simulateExtendedJarDown(fixtures.cases.lateBoth.input).contact.transitions[0].timeS).toBeGreaterThan(.02);
  const lowerFirst = simulateExtendedJarDown(fixtures.cases.lowerBeforeUpper.input);
  close(lowerFirst.contact.transitions[0].timeS, .005 + (.009 - .0075) / .5);
  close(lowerFirst.contact.transitions[0].contactForceLbf, 1000 / 3);
});

test('coincident gap closure uses right-limit incoming waves once', () => {
  const r = simulateExtendedJarDown(fixtures.cases.coincidentImpact.input);
  close(r.contact.transitions[0].timeS, .01);
  // Release reflection arrives just as the gap closes; 1000 lbf is the wrong left-limit force.
  close(r.contact.transitions[0].contactForceLbf, 1600);
  expect(r.contact.coincidenceBatches.length).toBeGreaterThan(0);
  expect(simulateExtendedJarDown(fixtures.cases.coincidentImpact.input)).toEqual(r);
});

test('near-coincident contact forces have a real discontinuity, impulses remain close', () => {
  const a = simulateExtendedJarDown(fixtures.cases.beforeCoincidence.input);
  const b = simulateExtendedJarDown(fixtures.cases.afterCoincidence.input);
  close(a.contact.transitions[0].contactForceLbf, 1000);
  close(b.contact.transitions[0].contactForceLbf, 1600);
  expect(Math.abs(a.observation.totalLbfS - b.observation.totalLbfS)).toBeLessThan(1e-4);
});

test('uniform free rod has exact fixed-end reflection timing and force doubling', () => {
  const r = simulateExtendedJarDown({ ...fixtures.cases.noImpact.input,
    upperRods: [{ ...base.upperRods[1], lengthFt: 80 }], lowerRods: [{ ...base.lowerRods[0], lengthFt: 160 }] });
  const P = 1000;
  // First lower release arrives after 10 ms; subsequent sign reversals every
  // 20 ms. These follow the d'Alembert fixed/free reflection solution.
  [.005, .02, .04, .06, .08, .1].forEach(t => {
    const expected = t < .01 ? P : (Math.floor((t - .01) / .02) % 2 ? P : -P);
    close(stepValue(r.noContact.reaction, t), expected);
  });
  close(motionAt(r.noContact.motion, .005).hammerVelocityFtS, P / 1000);
  close(motionAt(r.noContact.motion, .015).hammerVelocityFtS, -P / 1000);
});

test('no impact is explicit and matched run has zero attributable impulse', () => {
  const r = simulateExtendedJarDown(fixtures.cases.noImpact.input);
  expect(r.contact.impactStatus).toBe('no-impact-within-horizon');
  expect(r.contact.transitions).toEqual([]);
  close(r.observation.impactAttributableLbfS, 0);
  expect(r.contact.reaction.some(e => e.value < 0)).toBe(true);
});

test('opening increases gap; re-engagement requires positive free closing speed', () => {
  const r = simulateExtendedJarDown(fixtures.cases.surfaceReturns.input);
  expect(r.contact.transitions.filter(e => e.type === 'engage').length).toBeGreaterThan(2);
  r.contact.transitions.forEach(e => {
    if (e.type === 'open') { expect(e.freeRelativeVelocityFtS).toBeLessThan(0); close(e.contactForceLbf, 0); }
    else { expect(e.freeRelativeVelocityFtS).toBeGreaterThan(0); close(e.gapFt, 0); }
  });
});

test('event tolerance sensitivity leaves resolved events and integrals unchanged', () => {
  const p = fixtures.cases.surfaceReturns.input;
  const results = [16, 32, 64, 128].map(coincidenceUlps => simulateExtendedJarDown({ ...p, coincidenceUlps }));
  results.forEach(r => {
    expect(r.valid).toBe(true);
    close(r.observation.totalLbfS, results[0].observation.totalLbfS);
    expect(r.contact.transitions.map(e => e.type)).toEqual(results[0].contact.transitions.map(e => e.type));
  });
});

test('splitting a uniform rod preserves propagated solution', () => {
  const lower = base.lowerRods[0];
  const a = simulateExtendedJarDown(base);
  const b = simulateExtendedJarDown({ ...base, lowerRods: [{ ...lower, lengthFt: 60 }, { ...lower, lengthFt: 100 }] });
  expect(b.valid).toBe(true);
  close(a.observation.totalLbfS, b.observation.totalLbfS);
  a.contact.reaction.forEach((e, i, rows) => {
    if (i + 1 < rows.length) close(stepValue(b.contact.reaction, (e.timeS + rows[i + 1].timeS) / 2), e.value);
  });
});

test('independent junction algebra: impedance match and energy flux', () => {
  // Physical waves f incident down and k incident up; continuity determines n,v.
  [[1000, 2000, 300, -70], [1000, 1000, 300, 0], [250, 1000, -200, 40]].forEach(([Zu, Zl, f, k]) => {
    const n = 2 * (Zl * f + Zu * k) / (Zu + Zl), v = 2 * (f - k) / (Zu + Zl);
    const reflected = n - f, transmitted = n - k;
    close((f - reflected) / Zu, v); close((transmitted - k) / Zl, v);
    close(f * f / Zu + k * k / Zl, reflected * reflected / Zu + transmitted * transmitted / Zl);
  });
});

test.each([
  { horizonS: 0 }, { strokeIn: 0 }, { compressionLbf: -1 }, { gravityFtS2: NaN }, { model: 'unspecified' },
  { upperRods: [] }, { survey: [] }, { observation: { startS: .1, endS: .2 } },
  { lowerRods: [{ ...base.lowerRods[0], densitySlugFt3: 0 }] },
  { lowerRods: [{ ...base.lowerRods[0], lengthFt: 1e-20 }] }
  , { gravityFtS2: Number.MAX_VALUE }, { horizonS: Number.MIN_VALUE }
])('rejects invalid/unresolved inputs without partial histories: %j', changes => {
  const r = simulateExtendedJarDown({ ...base, ...changes });
  expect(r.valid).toBe(false); expect(r.contact).toBeUndefined(); expect(r.observation).toBeUndefined();
});

test('step quadrature retains endpoints and signed intervals', () => {
  const h = [{ timeS: 0, value: -1000 }, { timeS: .01, value: 2200 }, { timeS: .02, value: 0 }];
  close(integrateSteps(h, 0, .02), 12);
  close(integrateSteps(h, .01, .02), 22);
  expect(() => integrateSteps(h, 1, 0)).toThrow();
});
