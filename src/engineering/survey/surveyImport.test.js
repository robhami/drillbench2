import { parseSurveyCsv, validateSurveyStations } from './surveyImport';

const units = { mdUnit: 'ft', angleUnit: 'deg' };
const csv = 'MD,Inclination,Azimuth\n0,0,90\n100,3,90\n';

test('requires explicit feet/degrees and rejects incompatible declared/header units', () => {
  expect(parseSurveyCsv(csv).errors[0].code).toBe('units-required');
  expect(parseSurveyCsv(csv, { mdUnit: 'm', angleUnit: 'deg' }).valid).toBe(false);
  expect(parseSurveyCsv(csv.replace('MD', 'MD (m)'), units).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unsupported-unit', row: 1 })]));
  expect(parseSurveyCsv(csv.replace('Inclination', 'Inclination (rad)'), units).valid).toBe(false);
});

test.each(['MD,Inclination,Azimuth', 'Measured Depth (feet),Inc (degrees),Azi (°)', 'md_ft,inclination_deg,azimuth_deg', 'Measured-Depth,INC,AZI'])('accepts header variation %s', header => {
  const result = parseSurveyCsv(csv.replace('MD,Inclination,Azimuth', header), units);
  expect(result.valid).toBe(true);
  expect(result.stations[1]).toMatchObject({ mdFt: 100, inclinationDeg: 3, azimuthDeg: 90, sourceRow: 3 });
});

test('preserves original CSV and original field values, handles BOM CRLF and quoted fields', () => {
  const source = '\uFEFFMD,Inclination,Azimuth,Note\r\n"000.00",0,360,"a,b"\r\n\r\n" 1e2 ",3.00,090,"said ""hi"""\r\n';
  const result = parseSurveyCsv(source, units);
  expect(result.valid).toBe(true);
  expect(result.originalCsv).toBe(source);
  expect(result.rawStations[1]).toMatchObject({ mdFt: ' 1e2 ', inclinationDeg: '3.00', azimuthDeg: '090', sourceRow: 4 });
  expect(result.rawStations[1].fields[3]).toBe('said "hi"');
  expect(result.stations[0].azimuthDeg).toBe(360);
});

test.each(['MD,Inclination\n0,0\n100,3', 'MD,MD,Inclination,Azimuth\n0,0,0,90\n100,100,3,90', 'MD,Inclination,Azimuth\n0,0,90\n100,3', 'MD,Inclination,Azimuth\n0,0,90\n"100,3,90', 'MD,Inclination,Azimuth\n0,0,90\n"100"x,3,90'])('rejects malformed CSV/header %s', source => {
  expect(parseSurveyCsv(source, units).valid).toBe(false);
});

test.each([['', 'missing-value'], ['oops', 'nonnumeric-value'], ['Infinity', 'nonnumeric-value'], ['0x10', 'nonnumeric-value']])('identifies affected row for invalid value %s', (value, code) => {
  const result = parseSurveyCsv(`MD,Inclination,Azimuth\n0,0,90\n100,${value},90`, units);
  expect(result.errors).toContainEqual(expect.objectContaining({ row: 3, field: 'inclinationDeg', code }));
  expect(result.errors.find(error => error.code === code).message).toContain('Row 3');
});

test('empty station fields are validated rather than silently skipped as blank lines', () => {
  const result = parseSurveyCsv('MD,Inclination,Azimuth\n0,0,90\n,,\n100,3,90', units);
  expect(result.valid).toBe(false);
  expect(result.rawStations).toHaveLength(3);
  expect(result.errors.filter(error => error.row === 3 && error.code === 'missing-value')).toHaveLength(3);
});

test.each([[100, 181, 90, 'inclinationDeg'], [100, -1, 90, 'inclinationDeg'], [100, 60, 361, 'azimuthDeg'], [100, 60, -1, 'azimuthDeg'], [-1, 60, 90, 'mdFt']])('validates bounds %s %s %s', (mdFt, inclinationDeg, azimuthDeg, field) => {
  const result = validateSurveyStations([{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 0 }, { mdFt, inclinationDeg, azimuthDeg }]);
  expect(result.errors).toContainEqual(expect.objectContaining({ row: 2, field, code: 'out-of-range' }));
});

test('accepts full angle range and rejects duplicate, decreasing or insufficient stations without reordering', () => {
  const input = [{ mdFt: 0, inclinationDeg: 0, azimuthDeg: 0 }, { mdFt: 100, inclinationDeg: 180, azimuthDeg: 360 }];
  expect(validateSurveyStations(input).valid).toBe(true);
  expect(validateSurveyStations([input[0], input[0]]).errors[0].code).toBe('duplicate-station');
  expect(validateSurveyStations(input.slice().reverse()).errors[0].code).toBe('non-increasing-md');
  expect(validateSurveyStations([input[0]]).errors[0].code).toBe('insufficient-stations');
  expect(validateSurveyStations(null).valid).toBe(false);
  expect(parseSurveyCsv('', units).valid).toBe(false);
  expect(parseSurveyCsv(null, units).valid).toBe(false);
});
