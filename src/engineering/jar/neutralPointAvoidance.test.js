import { buildEngModel } from '../models/buildEngModel';
import { analyzeJarPlacement } from './jarAnalysis';
import { calcWobForNeutralPoint } from './neutralPointAvoidance';

const row = (category, length, weight, od = 8) => ({ category, toolName: category, length, weight, od });
const test3 = {
    rows: [row('DC', 160, 200, 9.5), row('JAR', 30, 150, 9.5), row('DC', 40, 200, 9.5)],
    wob: 10, inclination: 45, mudWeight: 10, frictionCoefficient: 0.25,
    rpm: 40, rop: 200, holeSize: 12.25
};

// Independent piecewise hand balance: integrate buoyed weight per foot,
// projected gravity and the axial friction share up to the requested location.
const handWob = (bha, mode, position) => {
    let remaining = position;
    let force = 0;
    for (const c of bha.rows) {
        const length = Math.min(remaining, c.length);
        const angle = bha.inclination * Math.PI / 180;
        const tangential = Math.PI * c.od * bha.rpm * 5;
        const share = mode === 'reference' ? 0 : mode === 'slide' ? 1 : bha.rop / Math.sqrt(bha.rop ** 2 + tangential ** 2);
        force += length * c.weight * (1 - bha.mudWeight / 65.5) * (Math.cos(angle) - bha.frictionCoefficient * Math.sin(angle) * share);
        remaining -= length;
        if (remaining <= 0) break;
    }
    return force / 1000;
};

test.each(['reference', 'slide', 'rotate'])('Test 3 %s boundaries match independent arithmetic and forward NP', mode => {
    const before = JSON.stringify(test3);
    const result = analyzeJarPlacement(test3, mode);
    const zone = result.jars[0].avoidanceZone;
    expect(zone).toMatchObject({ lowerFt: 140, upperFt: 210, valid: true, currentInside: false });
    expect(zone.minWobKlbf).toBeCloseTo(handWob(test3, mode, 140), 8);
    expect(zone.maxWobKlbf).toBeCloseTo(handWob(test3, mode, 210), 8);
    for (const boundary of [zone.lower, zone.upper]) {
        const check = analyzeJarPlacement({ ...test3, wob: boundary.wobKlbf }, mode);
        expect(check.neutralPointFt).toBeCloseTo(boundary.positionFt, 6);
        expect(check.jars[0].avoidanceZone.currentInside).toBe(true);
    }
    const middle = analyzeJarPlacement({ ...test3, wob: (zone.minWobKlbf + zone.maxWobKlbf) / 2 }, mode);
    expect(middle.jars[0].avoidanceZone.currentInside).toBe(true);
    expect(analyzeJarPlacement({ ...test3, wob: zone.minWobKlbf - 0.01 }, mode).jars[0].avoidanceZone.currentInside).toBe(false);
    expect(analyzeJarPlacement({ ...test3, wob: zone.maxWobKlbf + 0.01 }, mode).jars[0].avoidanceZone.currentInside).toBe(false);
    expect(JSON.stringify(test3)).toBe(before);
});

test('component boundaries, bit and top of model solve through the existing NP path', () => {
    const model = buildEngModel(test3);
    for (const position of [0, 160, 190, 230]) {
        const result = calcWobForNeutralPoint(model, 'reference', position);
        expect(result.valid).toBe(true);
        expect(result.wobKlbf).toBeCloseTo(handWob(test3, 'reference', position), 8);
    }
});

test('invalid inputs, out-of-string boundaries and unreachable or flat profiles give no misleading WOB range', () => {
    expect(calcWobForNeutralPoint(buildEngModel(test3), 'reference', 231).valid).toBe(false);
    expect(calcWobForNeutralPoint(buildEngModel(test3), 'reference', -1).valid).toBe(false);
    expect(calcWobForNeutralPoint(buildEngModel(test3), 'reference', NaN).valid).toBe(false);
    expect(analyzeJarPlacement({ ...test3, rop: 0 }, 'rotate').jars[0].avoidanceZone.valid).toBe(false);
    expect(analyzeJarPlacement({ ...test3, inclination: 90 }, 'reference').jars[0].avoidanceZone.valid).toBe(false);
    expect(analyzeJarPlacement({ ...test3, inclination: 60, frictionCoefficient: 1 }, 'slide').jars[0].avoidanceZone.valid).toBe(false);
    const short = { ...test3, rows: [row('DC', 160, 200), row('JAR', 30, 150)] };
    const zone = analyzeJarPlacement(short, 'reference').jars[0].avoidanceZone;
    expect(zone.lower.valid).toBe(true);
    expect(zone.upper.valid).toBe(false);
    expect(zone.maxWobKlbf).toBeNull();
});

test('multiple jars derive their own geometry boundaries', () => {
    const bha = { ...test3, rows: [...test3.rows, row('JAR', 20, 150), row('DC', 100, 200)] };
    const result = analyzeJarPlacement(bha, 'slide');
    expect(result.jars[0].avoidanceZone).toMatchObject({ lowerFt: 140, upperFt: 210 });
    expect(result.jars[1].avoidanceZone).toMatchObject({ lowerFt: 192, upperFt: 288, valid: true });
});

test('a flat segment within the zone prevents claiming a continuous unique WOB interval', () => {
    const bha = { ...test3, rows: [row('DC', 160, 200, 9.5), row('JAR', 30, 0), row('DC', 40, 200)] };
    const zone = analyzeJarPlacement(bha, 'reference').jars[0].avoidanceZone;
    expect(zone.lower.valid).toBe(true);
    expect(zone.upper.valid).toBe(true);
    expect(zone.valid).toBe(false);
    expect(zone.minWobKlbf).toBeNull();
    expect(zone.errors[0]).toContain('flat or non-monotonic');
});

test.each([
    { inclination: 30 }, { mudWeight: 12 }, { frictionCoefficient: 0.4 },
    { rpm: 80 }, { rop: 400 },
    { rows: [row('DC', 170, 220, 9.5), row('JAR', 30, 150), row('DC', 60, 200)] }
])('limits update with engineering inputs: %j', changes => {
    const bha = { ...test3, ...changes };
    const zone = analyzeJarPlacement(bha, 'rotate').jars[0].avoidanceZone;
    expect(zone.valid).toBe(true);
    expect(zone.minWobKlbf).toBeCloseTo(handWob(bha, 'rotate', zone.lowerFt), 8);
    expect(zone.maxWobKlbf).toBeCloseTo(handWob(bha, 'rotate', zone.upperFt), 8);
    expect(zone.minWobKlbf).not.toBe(analyzeJarPlacement(test3, 'rotate').jars[0].avoidanceZone.minWobKlbf);
});

test('zero RPM Rotate limits equal Slide; zero friction limits equal Reference', () => {
    const bha = { ...test3, rpm: 0 };
    const slide = analyzeJarPlacement(bha, 'slide').jars[0].avoidanceZone;
    expect(analyzeJarPlacement(bha, 'rotate').jars[0].avoidanceZone.minWobKlbf).toBe(slide.minWobKlbf);
    const frictionless = { ...test3, frictionCoefficient: 0 };
    expect(analyzeJarPlacement(frictionless, 'rotate').jars[0].avoidanceZone.maxWobKlbf)
        .toBe(analyzeJarPlacement(frictionless, 'reference').jars[0].avoidanceZone.maxWobKlbf);
});
