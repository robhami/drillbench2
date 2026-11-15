import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import EngineeringStringCard from './EngineeringStringCard';
import EngineeringString3D from './EngineeringString3D';
import { hasBitComponent } from './stringDisplayExtent';
import { neutralPointRelativeToJar } from './EngineeringStringCard';
import { analyzeJarPlacement } from '../../engineering/jar/jarAnalysis';
import { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';

jest.mock('./EngineeringString3D', () => jest.fn(() => null));
const row = (category, length, weight, od = 8) => ({ category, toolName: category, length, weight, od, ...(category === 'DC' ? { idSize: '2.813' } : {}) });
const bha = { rows: [row('DC', 160, 200, 9.5), row('JAR', 30, 150, 9.5), row('DC', 40, 200, 9.5)],
    wob: 10, mudWeight: 10, inclination: 45, frictionCoefficient: .25, rpm: 40, rop: 200, holeSize: 12.25 };
const latestView = () => EngineeringString3D.mock.calls.slice(-1)[0][0];
const source = originalCsv => ({ confirmed: true, originalCsv });
const straight = angle => source(`MD,Inclination,Azimuth\n0,${angle},90\n20000,${angle},90`);
const save = value => localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(value));
const changeSurvey = value => { save(value); fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: value })); };
const reference = () => fireEvent.click(screen.getByText('Constant-Inclination Drilling NP'));
const summaryValue = label => screen.getByText(label).closest('div').querySelector('dd').textContent;
beforeEach(() => { localStorage.clear(); EngineeringString3D.mockClear(); save(straight(45)); });

test('compact current-depth summary preserves calculations without mounting the diagram', () => {
    render(<EngineeringStringCard bha={bha} analysisBitMdFt={1000} drillingMode="slide" summaryOnly />);
    const expected = 10000 / (200 * (1 - 10 / 65.5) * (Math.cos(Math.PI / 4) - .25 * Math.sin(Math.PI / 4)));
    expect(summaryValue('NP above bit')).toBe(`${expected.toFixed(1)} ft`);
    expect(screen.queryByText('NP depth from surface')).not.toBeInTheDocument();
    expect(EngineeringString3D).not.toHaveBeenCalled();
    expect(screen.getByText('Engineering Details').closest('details')).not.toHaveAttribute('open');
});

test('main Engineering String mounts the historical 3D viewer with BHA-only default and supports Full String', () => {
    render(<EngineeringStringCard bha={bha} analysisBitMdFt={1000} drillingMode="slide" />);
    expect(latestView().fullString).toBe(false);
    expect(latestView().components).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Engineering string view'), { target: { value: 'full' } });
    expect(latestView().fullString).toBe(true);
    expect(screen.getByText('DC above jar')).toBeInTheDocument();
    expect(screen.getByText('DC below jar')).toBeInTheDocument();
});

test('historical 3D viewer only adds its bit when a BIT component exists', () => {
    expect(hasBitComponent([row('DC', 10, 200)])).toBe(false);
    expect(hasBitComponent([row('BIT', 1, 80)])).toBe(true);
});

test('neutral point direction relative to the jar follows actual positions, including coincidence', () => {
    expect(neutralPointRelativeToJar(190, 175)).toEqual({ distanceFt: 15, direction: 'above' });
    expect(neutralPointRelativeToJar(160, 175)).toEqual({ distanceFt: 15, direction: 'below' });
    expect(neutralPointRelativeToJar(175, 175)).toEqual({ distanceFt: 0, direction: 'at' });
    expect(neutralPointRelativeToJar(null, 175)).toBeNull();
});

test('Engineering String keeps shared mode control but no editable WOB field', () => {
    const updateBha = jest.fn(), setDrillingMode = jest.fn();
    render(<EngineeringStringCard bha={{ ...bha, wob: '22', wobAnalysis: { minWobKlbf: '10', maxWobKlbf: '35' } }}
        updateBha={updateBha} setDrillingMode={setDrillingMode} drillingMode="rotate" analysisBitMdFt={1000} summaryOnly />);
    expect(screen.queryByLabelText('Analysis WOB (klbf)')).not.toBeInTheDocument();
    expect(updateBha).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Drilling Mode'), { target: { value: 'slide' } });
    expect(setDrillingMode).toHaveBeenCalledWith('slide');
});

test('explicit vertical fallback is identified as generated and not measured', () => {
    render(<EngineeringStringCard bha={{ ...bha, trajectoryMode: 'vertical', drillpipeReferenceBitMdFt: 1000 }}
        analysisBitMdFt={1000} summaryOnly />);
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText(/Trajectory input: Generated vertical fallback.*not a measured survey/)).toBeInTheDocument();
});

test('Directional mode without a confirmed associated survey shows a visible error and no neutral-point marker', () => {
    render(<EngineeringStringCard bha={{ ...bha, trajectoryMode: 'directional', surveyState: { active: null, history: [], reviewRequired: false } }}
        analysisBitMdFt={1000} summaryOnly />);
    expect(screen.getByRole('alert')).toHaveTextContent('Drilling Neutral Point unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent(/survey/i);
});

test.each(['slide', 'rotate'])('straight %s NP and marker match independent constant-collar arithmetic', mode => {
    render(<EngineeringStringCard bha={bha} drillingMode={mode} analysisBitMdFt={1000} />);
    const fraction = mode === 'slide' ? 1 : 200 / Math.hypot(200, Math.PI * 9.5 * 40 * 5);
    const expected = 10000 / (200 * (1 - 10 / 65.5) * (Math.cos(Math.PI / 4) - .25 * Math.sin(Math.PI / 4) * fraction));
    expect(latestView().neutralPointFt).toBeCloseTo(expected, 7);
    expect(summaryValue('NP above bit')).toBe(`${expected.toFixed(1)} ft`);
    expect(summaryValue('NP relative to jar')).toBe(`NP ${Math.abs(175 - expected).toFixed(1)} ft ${expected > 175 ? 'above' : 'below'} jar`);
    expect(latestView().components[1]).toMatchObject({ startFromBit: 160, endFromBit: 190, centreFromBit: 175 });
    expect(latestView().jars[0].distanceFromNeutralFt).toBeCloseTo(175 - expected, 7);
    expect(summaryValue('Axial load at jar')).toContain('klbf · tension');
    reference();
    expect(screen.getByLabelText('Drilling Mode')).toHaveValue(mode);
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText(/Compression → tension toward surface/)).toBeVisible();
});

test('the main NP result reports coincidence with the selected jar', () => {
    const wobKlbf = 175 * 200 * (1 - 10 / 65.5) * (Math.cos(Math.PI / 4) - .25 * Math.sin(Math.PI / 4)) / 1000;
    render(<EngineeringStringCard bha={{ ...bha, wob: wobKlbf }} analysisBitMdFt={1000} drillingMode="slide" summaryOnly />);
    expect(summaryValue('NP relative to jar')).toBe('NP at jar');
});

test('adjacent collar diagram annotations come from BHA summary and stop at STAB and HWDP boundaries', () => {
    const dc = (length, od = 6.5) => ({ ...row('DC', length, 200, od), idSize: '2.75' });
    const input = { ...bha, rows: [dc(20), row('STAB', 3, 100, 7), dc(8), row('JAR', 5, 150, 6), dc(6), row('HWDP', 10, 80), dc(9)] };
    render(<EngineeringStringCard bha={input} analysisBitMdFt={1000} drillingMode="slide" />);
    expect(latestView().dcSections).toMatchObject({
        below: { lengthFt: 8, startFt: 23, endFt: 31 },
        above: { lengthFt: 6, startFt: 36, endFt: 42 }
    });
    expect(latestView().components.some(component => component.category === 'STAB' && component.od === 7 && component.length === 3)).toBe(true);
});

test('constant-inclination reference retains selected-mode values, jar geometry and avoidance output', () => {
    const { rerender } = render(<EngineeringStringCard bha={bha} drillingMode="reference" analysisBitMdFt={1000} />);
    reference();
    for (const [mode, expected] of [['reference', 83.4513408427], ['rotate', 84.16], ['slide', 111.2684544570]]) {
        rerender(<EngineeringStringCard bha={bha} drillingMode={mode} analysisBitMdFt={1000} />);
        const r = analyzeJarPlacement(bha, mode), zone = r.jars[0].avoidanceZone;
        expect(r.neutralPointFt).toBeCloseTo(expected, mode === 'rotate' ? 2 : 5);
        expect(screen.getByText(`${mode === 'reference' ? 'Reference' : mode === 'rotate' ? 'Rotate' : 'Slide'} · NP ${r.neutralPointFt.toFixed(1)} ft`)).toBeVisible();
        expect(screen.getByText(`NP avoidance zone · 140.0–210.0 ft · WOB ${zone.minWobKlbf.toFixed(2)}–${zone.maxWobKlbf.toFixed(2)} klbf`)).toBeVisible();
        expect(screen.getByText(`JAR · 175.0 ft · +${(175 - r.neutralPointFt).toFixed(1)} ft above NP`)).toBeVisible();
        expect(screen.getByText('BHA length · 230.0 ft')).toBeVisible();
    }
});

test('vertical survey NP does not use the simplified inclination field', () => {
    save(straight(0));
    const { rerender } = render(<EngineeringStringCard bha={bha} drillingMode="slide" analysisBitMdFt={1000} />);
    const expected = 10000 / (200 * (1 - 10 / 65.5));
    expect(latestView().neutralPointFt).toBeCloseTo(expected, 7);
    rerender(<EngineeringStringCard bha={{ ...bha, inclination: 60 }} drillingMode="slide" analysisBitMdFt={1000} />);
    expect(latestView().neutralPointFt).toBeCloseTo(expected, 7);
    reference();
    expect(screen.getByText(/Slide · NP/)).toHaveTextContent(analyzeJarPlacement({ ...bha, inclination: 60 }, 'slide').neutralPointFt.toFixed(1));
});

test('reference keeps signed below-NP separation and its avoidance warning', () => {
    render(<EngineeringStringCard bha={{ ...bha, wob: 23 }} drillingMode="reference" analysisBitMdFt={1000} />);
    reference();
    const r = analyzeJarPlacement({ ...bha, wob: 23 }, 'reference');
    expect(r.jars[0].distanceFromNeutralFt).toBeLessThan(0);
    expect(screen.getByText(`JAR · 175.0 ft · ${r.jars[0].distanceFromNeutralFt.toFixed(1)} ft below NP`)).toBeVisible();
    expect(screen.getByText('Current WOB places NP inside the jar NP avoidance zone.')).toBeVisible();
    expect(latestView().neutralPointFt).toBeNull();
});

test('NP within DP does not redefine fixed BHA length and Rotate responds to RPM and ROP', () => {
    const assembly = { ...bha, wob: 40, rows: [...bha.rows, row('DP', 10000, 20)] };
    const { rerender } = render(<EngineeringStringCard bha={assembly} drillingMode="rotate" />);
    const previous = latestView().neutralPointFt;
    expect(previous).toBeGreaterThan(230);
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText(/BHA length: 230.0 ft/)).toBeVisible();
    expect(latestView().jars[0].centreFt).toBe(175);
    rerender(<EngineeringStringCard bha={{ ...assembly, rpm: 80, rop: 100 }} drillingMode="rotate" />);
    expect(latestView().neutralPointFt).not.toBe(previous);
});

const test4 = { ...bha, wob: 35, inclination: 60, rpm: 150, rop: 60, holeSize: 16, drillpipeReferenceBitMdFt: 12000,
    rows: [row('STAB', 5, 111.25, 6.75), row('DC', 300, 116, 6.75), row('JAR', 30, 150, 9.5), row('DC', 180, 116, 6.75),
        { ...row('DP', 9999, 27.76, 5.5), lengthMode: 'auto' }] };
const synthetic = () => source(fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8'));
const fmt = v => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

test('Test 4 12-klbf Slide compact summary reproduces the supplied rounded references', () => {
    save(synthetic()); render(<EngineeringStringCard bha={{ ...test4, wob: 12 }} analysisBitMdFt={12000} drillingMode="slide" />);
    expect(screen.queryByLabelText(/Operating mode:/)).not.toBeInTheDocument();
    expect(summaryValue('NP above bit')).toBe('422.1 ft');
    expect(summaryValue('NP relative to jar')).toBe('NP 102.1 ft above jar');
    expect(summaryValue('Axial load at jar')).toBe('3.0 klbf · compression');
    expect(latestView().neutralPointFt.toFixed(1)).toBe('422.1');
    expect(latestView().dcSections).toMatchObject({ above: { lengthFt: 180, startFt: 335, endFt: 515 }, below: { lengthFt: 300, startFt: 5, endFt: 305 } });
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText(/NP 1: MD 11,577.9 ft/)).toBeVisible();
    expect(screen.getByText('Drilling condition only; this is not a jar-firing or buckling assessment.')).toBeVisible();
});
test.each([
    [12000, 35, 'slide', 3575.816674, 8424.183326, 25.966521],
    [12000, 35, 'rotate', 1308.140917, 10691.859083, 19.093157],
    [12000, 10, 'slide', 350.289768, 11649.710232, .966521],
    [12000, 10, 'rotate', 204.017021, 11795.982979, -5.906843],
    [4000, 35, 'slide', 440.227435, 3559.772565, 10.543533],
    [5000, 35, 'rotate', 720.851386, 4279.148614, 16.834740],
    [7000, 35, 'slide', 2937.738546, 4062.261454, 25.966521]
])('Test 4 MD %s WOB %s %s reproduces Stage 5B.3b display and marker', (depth, wob, mode, above, md, jarLoad) => {
    save(synthetic()); render(<EngineeringStringCard bha={{ ...test4, wob }} analysisBitMdFt={depth} drillingMode={mode} />);
    expect(latestView().neutralPointFt).toBeCloseTo(above, 5);
    expect(latestView().components.find(c => c.category === 'DP').length).toBe(depth - 515);
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText(new RegExp(`NP 1: MD ${fmt(md)} ft`))).toBeVisible();
    expect(summaryValue('NP above bit')).toBe(`${fmt(above)} ft`);
    expect(latestView().jars[0].axialForceLbf / 1000).toBeCloseTo(jarLoad, 5);
    expect(latestView().jars[0].centreFt).toBe(320);
    expect(test4.rows[4].length).toBe(9999);
});

test('WOB, mud, friction, mode, depth and component changes refresh the profile', () => {
    save(synthetic()); let current = test4;
    const { rerender } = render(<EngineeringStringCard bha={current} analysisBitMdFt={12000} drillingMode="slide" />);
    for (const [patch, expected] of [[{ wob: 50 }, 5825.268931], [{ wob: 35, mudWeight: 12 }, 3772.030578], [{ mudWeight: 10, frictionCoefficient: .1 }, 1926.486317]]) {
        current = { ...current, ...patch };
        rerender(<EngineeringStringCard bha={current} analysisBitMdFt={12000} drillingMode="slide" />);
        expect(latestView().neutralPointFt).toBeCloseTo(expected, 5);
    }
    rerender(<EngineeringStringCard bha={test4} analysisBitMdFt={7000} drillingMode="slide" />);
    expect(latestView().neutralPointFt).toBeCloseTo(2937.738546, 5);
    rerender(<EngineeringStringCard bha={test4} analysisBitMdFt={12000} drillingMode="rotate" />);
    expect(latestView().neutralPointFt).toBeCloseTo(1308.140917, 5);
    const changed = { ...test4, rows: test4.rows.map(r => r.category === 'DP' ? { ...r, weight: 30 } : r) };
    rerender(<EngineeringStringCard bha={changed} analysisBitMdFt={12000} drillingMode="rotate" />);
    expect(latestView().neutralPointFt).not.toBeCloseTo(1308.140917, 3);
});

test('missing, incomplete and unconfirmed surveys clear the marker without reference fallback', () => {
    const { rerender } = render(<EngineeringStringCard bha={bha} analysisBitMdFt={1000} />);
    expect(latestView().neutralPointFt).not.toBeNull();
    for (const value of [null, source('MD,Inclination,Azimuth\n100,0,90\n20000,0,90'), source('MD,Inclination,Azimuth\n0,0,90\n900,0,90'), { ...straight(45), confirmed: false }]) {
        changeSurvey(value);
        expect(latestView().neutralPointFt).toBeNull();
        expect(screen.getByRole('alert')).toHaveTextContent('Drilling Neutral Point unavailable');
        expect(latestView().components[1].centreFromBit).toBe(175);
    }
    reference(); expect(screen.getByText('Drilling Neutral Point')).toBeVisible();
    rerender(<EngineeringStringCard bha={bha} analysisBitMdFt="" />);
    expect(latestView().neutralPointFt).toBeNull();
});

test('no crossing, endpoint zero and invalid inputs remain distinct', () => {
    const { rerender } = render(<EngineeringStringCard bha={{ ...bha, wob: 100 }} analysisBitMdFt={1000} />);
    expect(screen.getByText(/No neutral point within the deployed string/)).toBeVisible();
    expect(latestView().neutralPointFt).toBeNull();
    rerender(<EngineeringStringCard bha={{ ...bha, wob: 0 }} analysisBitMdFt={1000} />);
    expect(latestView().neutralPointFt).toBe(0);
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText(/Boundary zero; one-sided/)).toBeVisible();
    for (const patch of [{ rop: 0 }, { wob: '' }, { mudWeight: 70 }, { frictionCoefficient: '' }]) {
        rerender(<EngineeringStringCard bha={{ ...bha, ...patch }} analysisBitMdFt={1000} drillingMode="rotate" />);
        expect(latestView().neutralPointFt).toBeNull();
        expect(screen.getByText(/^Drilling Neutral Point unavailable\./)).toBeVisible();
    }
});

test('all crossings retain direction without a universal marker or ambiguous jar separation', () => {
    save(source('MD,Inclination,Azimuth\n0,0,90\n1000,0,90\n1500,90,90\n5500,90,90\n6000,0,90\n6500,0,90'));
    render(<EngineeringStringCard bha={{ ...bha, wob: 5, rows: [row('JAR', 20, 100), row('DC', 6480, 100)] }} analysisBitMdFt={6500} />);
    expect(screen.getByRole('status')).toHaveTextContent('3 isolated zero crossing(s)');
    expect(latestView().neutralPointFt).toBeNull();
    expect(latestView().jars[0].distanceFromNeutralFt).toBeNull();
    expect(screen.queryByText('Jar centre relative to NP')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getAllByText(/NP \d: MD/)).toHaveLength(3);
    expect(screen.getAllByText(/Compression → tension toward surface/)).toHaveLength(2);
    expect(screen.getByText(/Tension → compression toward surface/)).toBeVisible();
    expect(screen.getByText(/not tracked physical branches/)).toBeVisible();
});

test('neutral interval reports both coordinates instead of a point marker', () => {
    save(straight(0)); render(<EngineeringStringCard bha={{ ...bha, wob: 0, rows: [row('JAR', 1000, 0)] }} analysisBitMdFt={1000} />);
    expect(screen.getByRole('status')).toHaveTextContent('0 isolated zero crossing(s); 1 neutral interval(s)');
    expect(latestView().neutralPointFt).toBeNull();
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText('Neutral interval 1: MD 0.0–1,000.0 ft · 0.0–1,000.0 ft above bit.')).toBeVisible();
});

test('multiple jars retain physical positions and separate drilling loads', () => {
    render(<EngineeringStringCard bha={{ ...bha, rows: [...bha.rows, row('JAR', 20, 150)] }} analysisBitMdFt={1000} />);
    expect(latestView().jars.map(j => j.centreFt)).toEqual([175, 240]);
    expect(screen.getAllByText('Axial load at jar')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Drilling load at jar 2' })).getByText(/tension/)).toBeVisible();
    fireEvent.click(screen.getByText('Engineering Details'));
    expect(screen.getByText(/JAR 2 · centre MD 760.0 ft/)).toBeVisible();
});

test('survey events and workspace reload recompute derived NP without new persistence', () => {
    save(synthetic()); const first = render(<EngineeringStringCard bha={test4} drillingMode="slide" />);
    const previous = latestView().neutralPointFt; first.unmount();
    render(<EngineeringStringCard bha={JSON.parse(JSON.stringify(test4))} drillingMode="slide" />);
    expect(latestView().neutralPointFt).toBe(previous);
    changeSurvey(straight(0)); expect(latestView().neutralPointFt).toBeCloseTo(347.500485, 5);
    save(null); fireEvent(window, new StorageEvent('storage', { key: SURVEY_STORAGE_KEY }));
    expect(latestView().neutralPointFt).toBeNull();
});
