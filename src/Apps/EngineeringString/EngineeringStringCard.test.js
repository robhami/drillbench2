import React from 'react';
import { render, screen } from '@testing-library/react';
import EngineeringStringCard from './EngineeringStringCard';
import EngineeringString3D from './EngineeringString3D';
import JarPlacement from '../JarPlacement/JarPlacement';
import { buildEngModel } from '../../engineering/models/buildEngModel';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis';

jest.mock('./EngineeringString3D', () => jest.fn(() => null));
jest.mock('../JarPlacement/AxialLoadChart', () => () => null);

const row = (category, length, weight) => ({ category, toolName: category, length, weight, od: 8 });
// Validation Test 3: user-confirmed bottom DC geometry and drilling conditions.
const bha = {
    rows: [{ ...row('DC', 160, 200), od: 9.5, idSize: 3.75 }, { ...row('JAR', 30, 150), od: 9.5 }, { ...row('DC', 40, 200), od: 9.5 }],
    wob: 10, mudWeight: 10, inclination: 45, frictionCoefficient: 0.25,
    rpm: 40, rop: 200, holeSize: 12.25
};
const latestView = () => EngineeringString3D.mock.calls.slice(-1)[0][0];

test('all selected modes share Jar Placement loads and neutral point; jar geometry stays fixed', () => {
    const model = buildEngModel(bha);
    const { rerender } = render(<EngineeringStringCard engModel={model} drillingMode="reference" />);
    const values = {};
    for (const mode of ['reference', 'rotate', 'slide']) {
        rerender(<EngineeringStringCard engModel={model} drillingMode={mode} />);
        const result = analyzeJarPlacement(bha, mode);
        const view = latestView();
        expect(view.components).toEqual(result.loadProfile.components);
        expect(view.neutralPointFt).toBe(result.neutralPointFt);
        expect(view.jars).toEqual(result.jars);
        const zone = result.jars[0].avoidanceZone;
        expect(screen.getByText(`NP avoidance zone · 140.0–210.0 ft · WOB ${zone.minWobKlbf.toFixed(2)}–${zone.maxWobKlbf.toFixed(2)} klbf`)).toBeInTheDocument();
        expect(screen.getByText('BHA length · 230.0 ft')).toBeInTheDocument();
        values[mode] = view.neutralPointFt;
        // Independent constant-collar arithmetic; all crossings fall in first DC.
        const tangential = Math.PI * 9.5 / 12 * 40 * 60;
        const fraction = mode === 'reference' ? 0 : mode === 'slide' ? 1 : 200 / Math.hypot(200, tangential);
        const expected = 10000 / (200 * (1 - 10 / 65.5) * (Math.cos(Math.PI / 4) - 0.25 * Math.sin(Math.PI / 4) * fraction));
        expect(view.neutralPointFt).toBeCloseTo(expected, 5);
        expect(view.components[1]).toMatchObject({ startFromBit: 160, endFromBit: 190, centreFromBit: 175 });
        const modeName = mode === 'reference' ? 'Reference' : mode === 'rotate' ? 'Rotate' : 'Slide';
        expect(screen.getByText(`${modeName} · NP ${expected.toFixed(1)} ft`)).toBeInTheDocument();
        expect(screen.getByText(`JAR · 175.0 ft · +${(175 - expected).toFixed(1)} ft above NP`)).toBeInTheDocument();
        expect(screen.queryByText(/Purple ring|Teal JAR/)).not.toBeInTheDocument();
        const placement = render(<JarPlacement bha={bha} drillingMode={mode} />);
        const digits = mode === 'rotate' ? 2 : 1;
        expect(placement.getByText(`Neutral point: ${expected.toFixed(digits)} ft above bit`)).toBeInTheDocument();
        placement.unmount();
    }
    expect(values.reference).toBeLessThan(values.rotate);
    expect(values.rotate).toBeLessThan(values.slide);
    expect(values.reference).toBeCloseTo(83.4513408427, 5);
    expect(values.rotate).toBeCloseTo(84.16, 2);
    expect(values.slide).toBeCloseTo(111.2684544570, 5);
});

test('zero WOB puts marker at bit; no crossing or invalid load hides marker without moving jars', () => {
    const { rerender } = render(<EngineeringStringCard bha={{ ...bha, wob: 0 }} drillingMode="reference" />);
    expect(latestView().neutralPointFt).toBe(0);
    rerender(<EngineeringStringCard bha={{ ...bha, wob: 100 }} drillingMode="reference" />);
    expect(latestView().neutralPointFt).toBeNull();
    expect(screen.getByText('JAR · 175.0 ft · NP not determined')).toBeInTheDocument();
    const invalid = { ...bha, rop: 0 };
    rerender(<EngineeringStringCard bha={invalid} drillingMode="rotate" />);
    expect(latestView().neutralPointFt).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Rotate mode requires');
    expect(latestView().components[1].centreFromBit).toBe(175);
    expect(screen.getByText('PRELIMINARY — NOT FOR OPERATIONAL USE')).toBeInTheDocument();
});

test('multiple jars are individually identified at their geometry positions', () => {
    render(<EngineeringStringCard bha={{ ...bha, rows: [...bha.rows, row('JAR', 20, 150)] }} />);
    const jars = latestView().components.filter(component => component.category === 'JAR');
    expect(jars).toHaveLength(2);
    expect(jars[0]).toMatchObject({ startFromBit: 160, endFromBit: 190, centreFromBit: 175 });
    expect(jars[1]).toMatchObject({ startFromBit: 230, endFromBit: 250, centreFromBit: 240 });
    expect(screen.getByText(/^JAR · 175.0 ft ·/)).toBeInTheDocument();
    expect(screen.getByText(/^JAR · 240.0 ft ·/)).toBeInTheDocument();
});

test('jar summary shows signed separation below the selected neutral point', () => {
    render(<EngineeringStringCard bha={{ ...bha, wob: 23 }} drillingMode="reference" />);
    const result = analyzeJarPlacement({ ...bha, wob: 23 }, 'reference');
    expect(result.jars[0].distanceFromNeutralFt).toBeLessThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Current WOB places NP inside');
    expect(screen.getByText(`JAR · 175.0 ft · ${result.jars[0].distanceFromNeutralFt.toFixed(1)} ft below NP`)).toBeInTheDocument();
});

test('BHA length excludes DP even when the display must extend to NP within DP', () => {
    const assembly = { ...bha, wob: 40, rows: [...bha.rows, row('DP', 10000, 20)] };
    render(<EngineeringStringCard bha={assembly} drillingMode="reference" />);
    expect(screen.getByText('BHA length · 230.0 ft')).toBeInTheDocument();
    expect(latestView().neutralPointFt).toBeGreaterThan(230);
    expect(latestView().jars[0].distanceFromNeutralFt).toBe(analyzeJarPlacement(assembly, 'reference').jars[0].distanceFromNeutralFt);
});
