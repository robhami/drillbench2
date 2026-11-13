import { npInputContext, captureNpRequest, buildNpDiagnostics, serializeNpDiagnostics, downloadNpDiagnostics } from './npDiagnostics';

const bha = { id: 'selected', name: 'Selected BHA', wob: 25, mudWeight: 10, password: 'SECRET',
  surveyState: { active: { filename: 'active.csv' }, history: [{ originalCsv: 'PRIVATE HISTORY' }] },
  rows: [{ category: 'JAR', length: 30, weight: 100, od: 6.75, idSize: 2.25, note: 'PRIVATE NOTE' }] };
const survey = { valid: true, stations: [{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 90 }], segments: [], summary: { startMdFt: 0 } };
const request = { bha, survey, modes: 'both', minWobLbf: 10000, maxWobLbf: 35000, wobSamples: 5, rpm: 150 };
const source = { filename: 'active.csv', kind: 'imported', origin: 'CSV import', confirmed: true, token: 'SECRET TOKEN' };
const context = () => npInputContext(bha, source, survey, { start: '500', secret: 'SECRET FIELD' }, 'slide');
const capture = () => captureNpRequest(request, context(), 'worker', '2026-11-02T00:00:00.000Z');
const scenario = (index, valid = false) => ({ bitMdFt: 1000 + index, wobLbf: index % 2 ? 10000 : 22500, mode: index % 2 ? 'rotate' : 'slide', frictionCoefficient: .25,
  valid, status: valid ? 'calculated' : index % 2 ? 'outside-survey' : 'numerical-limit', errors: valid ? [] : [index % 2 ? 'Coverage missing' : 'Unresolvable step'],
  neutralPoints: valid ? [{ fromBitFt: 20, componentIndex: 0 }] : [], neutralIntervals: [], jars: valid ? [{ jarIndex: 0, jarFromBitFt: 15, signedSeparationFt: -5 }] : [] });

test('captures exact engineering request, active survey, run metadata and safe selected BHA positions without history/secrets', () => {
  const captured = capture();
  expect(captured.requestMessage.request.survey).toEqual(request.survey);
  expect(captured.requestMessage.request.rpm).toBe(request.rpm);
  expect(captured.requestMessage.request.bha.rows[0]).toEqual({ category: 'JAR', length: 30, weight: 100, od: 6.75, idSize: 2.25 });
  expect(captured.inputContext.componentPositions.components[0].centreFromBit).toBe(15);
  expect(captured.omittedNonEngineeringMetadata).toContain('request.bha.surveyState');
  expect(serializeNpDiagnostics(captured)).not.toMatch(/PRIVATE|SECRET/);
  request.rpm = 151; expect(captured.requestMessage.request.rpm).toBe(150); request.rpm = 150;
});

test('BHA diagnostics export carries Bit ID and cumulative component end while legacy rows stay optional', () => {
  const bit = { ...bha, rows: [{ category: 'BIT', toolName: 'Generic PDC', selectedToolId: 'spec-8p5', bitId: 'PDC-001', length: 1, weight: 50, od: 8.5, idSize: .5 }] };
  const exported = npInputContext(bit, source, survey, {}, 'reference');
  expect(exported.bha.rows[0]).toMatchObject({ bitId: 'PDC-001', cumulativeLengthFt: 1 });
  expect(exported.bha.rows[0].selectedToolId).toBe('spec-8p5');
  expect(exported.bha.rows[0].bitId).not.toBe(exported.bha.rows[0].selectedToolId);
  const legacy = npInputContext(bha, source, survey, {}, 'reference');
  expect(legacy.bha.rows[0]).not.toHaveProperty('bitId');
  expect(legacy.bha.rows[0].cumulativeLengthFt).toBe(30);
});

test('diagnostics export cumulative length uses deployed Auto DP length when available', () => {
  const bhaWithAuto = { ...bha, drillpipeReferenceBitMdFt: 100, rows: [
    { category: 'BIT', toolName: 'Generic PDC', length: 1, weight: 50, od: 8.5, idSize: .5 },
    { category: 'DP', toolName: 'DP', lengthMode: 'auto', length: 10, weight: 20, od: 5, idSize: 4 }
  ] };
  const exported = npInputContext(bhaWithAuto, source, survey, {}, 'reference');
  expect(exported.bha.rows.map(row => row.cumulativeLengthFt)).toEqual([1, 100]);
  expect(exported.componentPositions.totalLength).toBe(100);
  expect(exported.bha.rows[1].length).toBe(10);
});

test('all 290 synthetic failures reconcile, preserving raw response and exclusive reason groups including non-displayed WOB', () => {
  const response = { valid: true, invalidScenarios: 290, scenarios: Array.from({ length: 290 }, (_, i) => scenario(i)) };
  const value = buildNpDiagnostics({ current: context(), capture: capture(), response, state: 'current' });
  expect(value.analysis.responseMessage.result).toEqual(response);
  expect(value.totals).toMatchObject({ evaluated: 290, displayedInvalidSampleCount: 290, computedInvalidSampleCount: 290, reconciled: true, invalidOutsideSelectedSeries: 290 });
  expect(value.totals.invalidByReason.map(g => g.count)).toEqual([145, 145]);
  expect(value.samples.every(s => s.validRootCount === null && s.neutralPoints === null)).toBe(true);
  expect(JSON.parse(serializeNpDiagnostics(value))).toEqual(value);
  expect(buildNpDiagnostics({ response: { ...response, invalidScenarios: 289 }, state: 'current' }).totals.reconciled).toBe(false);
});

test('records hidden series, true signed values and component transitions without dropping response samples', () => {
  const selection = { wobLbf: 10000, mode: 'rotate', frictionCoefficient: .25 };
  const a = { ...scenario(1, true), ...selection }, b = { ...scenario(3, true), ...selection, neutralPoints: [{ fromBitFt: 21, componentIndex: 1 }] };
  const response = { invalidScenarios: 0, scenarios: [a, b, scenario(4, true)] };
  const plot = { data: [{ showlegend: true, name: 'Minimum WOB 10 klbf — Rotate', visible: false, x: [a.bitMdFt, null, b.bitMdFt], y: [5, null, 6] }] };
  const value = buildNpDiagnostics({ response, state: 'current', plot, selections: [selection] });
  expect(value.samples[0]).toMatchObject({ validRootCount: 1, includedInSelectedSeries: true, visibleFinitePoint: false });
  expect(value.samples[1]).toMatchObject({ componentTransition: true, jars: [{ jarIndex: 0, jarAboveBitFt: 15, npRelativeToJarFt: [6], nearestNpRelativeToJarFt: 5 }] });
  expect(value.samples[2].includedInSelectedSeries).toBe(false);
  expect(value.view.plot).toEqual(plot);
});

test('missing/stale exports and nonfinite serialization are explicit and safe', () => {
  const value = buildNpDiagnostics({ current: npInputContext(null, null, null, null, 'slide'), state: 'stale-results-excluded' });
  expect(value.analysis).toBeNull(); expect(value.totals.reconciled).toBeNull(); expect(value.samples).toEqual([]);
  expect(JSON.parse(serializeNpDiagnostics({ zero: 0, missing: null, bad: NaN, overflow: Infinity }))).toEqual({ zero: 0, missing: null, bad: { nonfiniteNumber: 'NaN' }, overflow: { nonfiniteNumber: 'Infinity' } });
});

test('download creates a single JSON file and releases the object URL', () => {
  jest.useFakeTimers(); URL.createObjectURL = jest.fn(() => 'blob:np'); URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  expect(downloadNpDiagnostics({ generatedAt: '2026-11-02T01:02:03.000Z' })).toBe('DrillFrame-NP-Diagnostics-20261102.json');
  expect(URL.createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(click).toHaveBeenCalledTimes(1); expect(document.querySelector('a')).toBeNull();
  jest.runOnlyPendingTimers(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:np');
  click.mockRestore(); jest.useRealTimers();
});
