import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalysisInputs from '../AnalysisInputs/AnalysisInputs';
import Survey from './Survey';
import App from '../../App';
import { emptySurveyState, resolveActiveSurvey, surveyGeometry, trajectorySelectionPatch, useActiveSurvey, SURVEY_STORAGE_KEY } from './surveyAssociation';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { validateSurveyCoverage } from '../../engineering/survey/surveyCoverage';
import { calcSurveyAxialLoads } from '../../engineering/forces/calcSurveyAxialLoads';
import { calcOffBottomHookloads } from '../../engineering/forces/calcOffBottomHookloads';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { jarLoadingKey } from '../JarForces/jarLoadingInputs';

jest.mock('./SurveyTrajectory', () => () => <div>Survey geometry view</div>);
jest.mock('../../WorkspaceV2/Workspace', () => () => null);
const directional = { originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n5000,30,90\n15000,60,90', filename: 'measured-directional.csv', confirmed: true, kind: 'imported', origin: 'CSV import' };
const assembly = { id: 'trajectory', name: 'Trajectory fixture', holeSize: 8.5, mudWeight: 10, wob: 35, inclination: 45, rpm: 150, rop: 60, frictionCoefficient: .25, drillpipeReferenceBitMdFt: 10000,
  rows: [{ rowId: 'jar', category: 'JAR', toolName: 'Jar', length: 20, weight: 100, od: 6, idSize: 2 }, { rowId: 'dp', category: 'DP', lengthMode: 'auto', length: 9999, weight: 100, od: 5.5, idSize: 4 }],
  surveyState: { ...emptySurveyState(), active: directional } };
const effectiveGeometry = bha => surveyGeometry(resolveActiveSurvey(bha));
let current;
function Harness({ initial = assembly }) {
  const [bha, setBha] = React.useState(initial); current = bha;
  const source = useActiveSurvey(bha);
  return <><AnalysisInputs bha={bha} updateBha={patch => setBha(b => ({ ...b, ...patch }))} /><Survey bha={bha} updateBha={patch => setBha(b => ({ ...b, ...patch }))} />
    <button onClick={() => setBha(b => ({ ...b, drillpipeReferenceBitMdFt: 12000.125 }))}>Change MD</button><output data-testid="active-source">{JSON.stringify(source)}</output></>;
}
beforeEach(() => localStorage.clear());

test('vertical 10,000 ft has explicit generated provenance, 0° inclination/azimuth and full MC coverage', () => {
  const input = { ...assembly, ...trajectorySelectionPatch('vertical') }, source = resolveActiveSurvey(input), geometry = surveyGeometry(source);
  expect(input.inclination).toBe(0); expect(source.kind).toBe('generated-vertical'); expect(source.origin).toMatch(/not measured/);
  expect(geometry.stations.map(s => [s.mdFt, s.inclinationDeg, s.azimuthDeg])).toEqual([[0, 0, 0], [10000, 0, 0]]);
  expect(geometry.summary.tvdFt).toBeCloseTo(10000, 9);
  expect(validateSurveyCoverage(geometry, { startMdFt: 0, endMdFt: 10000 }).covered).toBe(true);
});

test('MD changes rebuild the effective vertical path without altering imported data or archived history', () => {
  const input = { ...assembly, trajectoryMode: 'vertical' }, original = JSON.stringify(input.surveyState), first = resolveActiveSurvey(input);
  const changed = { ...input, drillpipeReferenceBitMdFt: 12000.125 }, geometry = effectiveGeometry(changed);
  expect(geometry.summary.endMdFt).toBe(12000.125); expect(first.originalCsv).toContain('10000,0,0');
  expect(JSON.stringify(changed.surveyState)).toBe(original);
  expect(resolveActiveSurvey({ ...input, drillpipeReferenceBitMdFt: '' })).toBeNull();
});

test('Directional → Vertical → Directional restores the original association byte for byte and never uses scalar inclination', () => {
  const original = JSON.stringify(assembly), vertical = { ...assembly, ...trajectorySelectionPatch('vertical') };
  const restored = { ...vertical, ...trajectorySelectionPatch('directional') };
  expect(resolveActiveSurvey(restored)).toBe(directional); expect(resolveActiveSurvey({ ...restored, inclination: 0 })).toBe(directional);
  expect(JSON.stringify(assembly)).toBe(original); expect(restored.surveyState).toBe(assembly.surveyState);
  expect(effectiveGeometry({ ...restored, trajectoryMode: 'vertical' }).summary.maxInclinationDeg).toBe(0);
});

test('directional selection rejects missing/unreviewed/unconfirmed/incomplete coverage without extrapolation or global fallback', () => {
  const input = { ...assembly, trajectoryMode: 'directional' };
  expect(resolveActiveSurvey({ ...input, surveyState: emptySurveyState() }, directional)).toBeNull();
  const generatedOnly = { ...input, surveyState: { ...emptySurveyState(), active: resolveActiveSurvey({ ...assembly, trajectoryMode: 'vertical' }) } };
  expect(resolveActiveSurvey(generatedOnly)).toBeNull();
  expect(resolveActiveSurvey({ ...input, surveyState: { ...input.surveyState, reviewRequired: true } })).toBeNull();
  const unconfirmed = { ...input, surveyState: { ...input.surveyState, active: { ...directional, confirmed: false } } };
  expect(effectiveGeometry(unconfirmed)).toBeNull();
  const short = { ...input, surveyState: { ...input.surveyState, active: { ...directional, originalCsv: 'MD,Inc,Azi\n0,30,90\n8000,30,90' } } };
  const coverage = validateSurveyCoverage(effectiveGeometry(short), { startMdFt: 0, endMdFt: 10000 });
  expect(coverage.covered).toBe(false); expect(coverage.missingIntervals[0]).toMatchObject({ startMdFt: 8000, endMdFt: 10000 });
});

test('previous directional source can be recovered from an older vertical replacement history; legacy callers remain unchanged', () => {
  const generated = resolveActiveSurvey({ ...assembly, trajectoryMode: 'vertical' });
  const input = { ...assembly, trajectoryMode: 'directional', surveyState: { ...assembly.surveyState, active: generated, history: [directional] } };
  expect(resolveActiveSurvey(input)).toBe(directional); expect(resolveActiveSurvey(assembly)).toBe(directional);
  expect(resolveActiveSurvey({ rows: [] }, directional)).toBe(directional);
});

test('Parameter Entry keeps its five fields and trajectory selection while survey recovery stays in Survey', () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<Harness initial={{ ...assembly, trajectoryMode: 'directional' }} />);
  expect(screen.getByLabelText('Mud Weight (ppg)')).toBeInTheDocument();
  expect(screen.getByLabelText('Low WOB (klbf)')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Well Trajectory' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Directional' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByLabelText('Inclination (°)')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Replace with Vertical Survey'));
  expect(current.trajectoryMode).toBe('vertical');
  expect(screen.getByLabelText('Active survey')).toHaveTextContent('Not a measured survey');
  fireEvent.click(screen.getByText('Restore a previous or legacy survey'));
  fireEvent.change(screen.getByLabelText('Preserved survey'), { target: { value: '0' } });
  fireEvent.click(screen.getByText('Restore selected survey'));
  expect(current.trajectoryMode).toBe('directional');
  expect(JSON.parse(screen.getByTestId('active-source').textContent)).toEqual(directional);
  fireEvent.click(screen.getByText('Change MD'));
  expect(JSON.parse(screen.getByTestId('active-source').textContent).originalCsv).toBe(directional.originalCsv);
  confirm.mockRestore();
});
test('missing directional UI requests import instead of substituting the constant-inclination reference', () => {
  render(<Harness initial={{ ...assembly, trajectoryMode: 'directional', surveyState: emptySurveyState(), inclination: 0 }} />);
  expect(screen.getAllByText('Directional survey required')).toHaveLength(1); expect(screen.getByTestId('active-source')).toHaveTextContent('null');
});

test('CSV import while Vertical switches to Directional and requires an explicit imported-unit confirmation', async () => {
  render(<Harness initial={{ ...assembly, trajectoryMode: 'vertical' }} />);
  fireEvent.change(screen.getByLabelText('Survey CSV'), { target: { files: [new File([directional.originalCsv], 'new-directional.csv')] } });
  await waitFor(() => expect(current.trajectoryMode).toBe('directional'));
  expect(current.surveyState.active.confirmed).toBe(false); expect(current.surveyState.history).toContainEqual(directional);
  fireEvent.click(screen.getByRole('checkbox')); expect(current.surveyState.active.confirmed).toBe(true);
  expect(surveyGeometry(current.surveyState.active).valid).toBe(true);
});

test('a delayed import cannot override a later trajectory selection', () => {
  const Original = global.FileReader; let reader;
  global.FileReader = class { constructor() { reader = this; } readAsText() {} };
  try {
    render(<Harness initial={{ ...assembly, trajectoryMode: 'directional' }} />); fireEvent.change(screen.getByLabelText('Survey CSV'), { target: { files: [{ name: 'late.csv', size: 1 }] } });
    fireEvent.click(screen.getByText('Replace with Vertical Survey')); act(() => { reader.result = directional.originalCsv; reader.onload(); });
    expect(current.trajectoryMode).toBe('vertical'); expect(current.surveyState.active).toBe(directional);
  } finally { global.FileReader = Original; }
});

test('pending ownership review remains inspectable, and unit confirmation cannot authorise its use in calculations', () => {
  render(<Harness initial={{ ...assembly, trajectoryMode: 'directional', surveyState: { ...assembly.surveyState, reviewRequired: true } }} />);
  expect(document.querySelectorAll('.surveyTable tbody tr')).toHaveLength(3);
  expect(screen.getByTestId('active-source')).toHaveTextContent('null');
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('checkbox'));
  expect(current.surveyState.reviewRequired).toBe(true); expect(screen.getByTestId('active-source')).toHaveTextContent('null');
  fireEvent.click(screen.getByText('Confirm survey association'));
  expect(current.surveyState.reviewRequired).toBe(false); expect(JSON.parse(screen.getByTestId('active-source').textContent).originalCsv).toBe(directional.originalCsv);
});

test('selection, directional association and generated coverage survive App save/reload without modifying the global recovery source', () => {
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(directional));
  localStorage.setItem('drillbenchWell', JSON.stringify({ currentBha: assembly, savedBhas: [] }));
  const ref = React.createRef(), view = render(<App ref={ref} />);
  act(() => ref.current.updateBha(trajectorySelectionPatch('vertical'))); act(() => ref.current.saveBha());
  view.unmount(); const restored = React.createRef(); render(<App ref={restored} />);
  expect(restored.current.state.well.currentBha.trajectoryMode).toBe('vertical');
  expect(restored.current.state.well.currentBha.surveyState.active).toEqual(directional);
  expect(effectiveGeometry(restored.current.state.well.currentBha).summary.endMdFt).toBe(10000);
  expect(JSON.parse(localStorage.getItem(SURVEY_STORAGE_KEY))).toEqual(directional);
});

test('vertical NP and Hookload reproduce independent uniform-weight statics at 10,000 ft MD', () => {
  const input = { ...assembly, ...trajectorySelectionPatch('vertical') }, survey = effectiveGeometry(input);
  const deployed = deployDrillstring(input, 10000); expect(deployed.valid).toBe(true);
  const bf = 1 - 10 / 65.5, expectedWeight = 100 * 10000 * bf, expectedNp = 35000 / (100 * bf);
  for (const mode of ['slide', 'rotate']) {
    const load = calcSurveyAxialLoads({ bha: deployed.bha, survey, bitMdFt: 10000, wobLbf: 35000, mode, mudWeightPpg: 10, frictionCoefficient: .25, rpm: 150, ropFtHr: 60 });
    expect(load.valid).toBe(true); expect(load.neutralPoints[0].fromBitFt).toBeCloseTo(expectedNp, 7);
  }
  const hook = calcOffBottomHookloads({ bha: input, survey, bitMdFt: 10000, mudWeightPpg: 10, frictionCoefficient: .25, rpm: 150, ropFtHr: 60 });
  for (const key of ['pickupHookload', 'slackOffHookload', 'rotatingHookload']) { expect(hook[key].valid).toBe(true); expect(hook[key].valueLbf).toBeCloseTo(expectedWeight, 6); }
});

test('the existing Test 4 directional reference is unchanged after switching out of and back into survey mode', () => {
  const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  const row = (category, length, weight, od) => ({ category, length, weight, od });
  const input = { ...assembly, trajectoryMode: 'directional', drillpipeReferenceBitMdFt: 12000, wob: 35,
    rows: [row('STAB', 5, 111.25, 6.75), row('DC', 300, 116, 6.75), row('JAR', 30, 150, 9.5), row('DC', 180, 116, 6.75), { ...row('DP', 9999, 27.76, 5.5), lengthMode: 'auto' }],
    surveyState: { ...emptySurveyState(), active: { ...directional, originalCsv: csv } } };
  const restored = { ...input, ...trajectorySelectionPatch('vertical'), ...trajectorySelectionPatch('directional') };
  const run = value => calcSurveyAxialLoads({ bha: deployDrillstring(value, 12000).bha, survey: effectiveGeometry(value), bitMdFt: 12000, wobLbf: 35000, mode: 'slide', mudWeightPpg: 10, frictionCoefficient: .25, rpm: 150, ropFtHr: 60 });
  const before = run(input), after = run(restored); expect(after.valid).toBe(true);
  expect(after.neutralPoints[0].fromBitFt).toBeCloseTo(3575.816674, 5); expect(after.jars[0].axialForceLbf / 1000).toBeCloseTo(25.966521, 5);
  expect(after.neutralPoints).toEqual(before.neutralPoints); expect(after.jars).toEqual(before.jars);
});

test('Jar Loading result identity invalidates mode changes even for identical survey geometry', () => {
  const vertical = { ...assembly, trajectoryMode: 'vertical' }, survey = effectiveGeometry(vertical);
  const props = { survey, bitMdFt: analysisDepth(vertical).bitMdFt, surfaceMdFt: 0, jarIndex: 0, jarDirection: 'down', targetForceKlbf: 5, available: true, covered: true };
  expect(jarLoadingKey({ ...props, bha: vertical })).not.toBe(jarLoadingKey({ ...props, bha: { ...vertical, trajectoryMode: 'directional' } }));
});
