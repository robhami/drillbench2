// Preserve source text/CSV fields; numeric stations are a separate derived model.
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const error = (row, field, code, message) => ({ row, field, code, message: `${row ? `Row ${row}: ` : ''}${message}` });

export function validateSurveyStations(stations) {
  const errors = [], normalized = [], seen = new Map();
  if (!Array.isArray(stations) || stations.length < 2) errors.push(error(null, null, 'insufficient-stations', 'At least two survey stations are required.'));
  let previousMd;
  (Array.isArray(stations) ? stations : []).forEach((station, index) => {
    const row = station?.sourceRow ?? index + 1;
    const values = {};
    ['mdFt', 'inclinationDeg', 'azimuthDeg'].forEach(field => {
      const raw = station?.[field];
      const text = typeof raw === 'number' || typeof raw === 'string' ? String(raw).trim() : '';
      if (!text) errors.push(error(row, field, 'missing-value', `${field} is required.`));
      else if (!numeric.test(text) || !Number.isFinite(Number(text))) errors.push(error(row, field, 'nonnumeric-value', `${field} must be a finite number.`));
      else values[field] = Number(text);
    });
    const md = values.mdFt;
    if (md !== undefined) {
      if (md < 0) errors.push(error(row, 'mdFt', 'out-of-range', 'Measured depth must be nonnegative (ft).'));
      if (seen.has(md)) errors.push(error(row, 'mdFt', 'duplicate-station', `Duplicate station at MD ${md} ft; first occurs at row ${seen.get(md)}.`));
      else if (previousMd !== undefined && md <= previousMd) errors.push(error(row, 'mdFt', 'non-increasing-md', 'Measured depth must increase strictly from the previous station.'));
      seen.set(md, seen.get(md) ?? row);
      previousMd = md;
    }
    if (values.inclinationDeg < 0 || values.inclinationDeg > 180) errors.push(error(row, 'inclinationDeg', 'out-of-range', 'Inclination must be between 0 and 180 degrees.'));
    if (values.azimuthDeg < 0 || values.azimuthDeg > 360) errors.push(error(row, 'azimuthDeg', 'out-of-range', 'Azimuth must be between 0 and 360 degrees.'));
    normalized.push({ ...values, sourceRow: row });
  });
  return { valid: errors.length === 0, errors, stations: normalized };
}

// RFC-style quoted fields, escaped quotes, BOM, CRLF and physical row tracking.
function readCsv(text) {
  const records = [], errors = [];
  let fields = [], field = '', quoted = false, closed = false, line = 1, start = 1;
  const pushField = () => { fields.push(field); field = ''; closed = false; };
  const pushRow = () => { pushField(); if (fields.length > 1 || fields.some(value => value.trim())) records.push({ fields, sourceRow: start }); fields = []; start = line + 1; };
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') { quoted = false; closed = true; }
      else { field += c; if (c === '\n') line += 1; }
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ',') pushField();
    else if (c === '\n' || c === '\r') {
      pushRow(); if (c === '\r' && source[i + 1] === '\n') i += 1;
      line += 1;
    } else if (closed || c === '"') {
      errors.push(error(line, null, 'malformed-csv', 'Unexpected character or quote in CSV field.')); break;
    } else field += c;
  }
  if (quoted) errors.push(error(start, null, 'malformed-csv', 'Unterminated quoted CSV field.'));
  if (field || fields.length || closed) pushRow();
  return { records, errors };
}

function identifyHeader(value) {
  const header = value.trim().toLowerCase();
  const match = header.match(/^(md|measured[\s_-]*depth|inclination|inc|azimuth|azi)(.*)$/);
  if (!match) return null;
  const field = /^(md|measured)/.test(match[1]) ? 'mdFt' : /^(inc)/.test(match[1]) ? 'inclinationDeg' : 'azimuthDeg';
  const unit = match[2].replace(/[\s()[\]_-]/g, '');
  const permitted = field === 'mdFt' ? ['', 'ft', 'feet'] : ['', 'deg', 'degree', 'degrees', '°'];
  return { field, unitValid: permitted.includes(unit) };
}

export function parseSurveyCsv(originalCsv, units) {
  const result = { valid: false, originalCsv, rawStations: [], stations: [], errors: [] };
  if (typeof originalCsv !== 'string') { result.errors.push(error(null, null, 'invalid-csv', 'CSV input must be text.')); return result; }
  if (units?.mdUnit !== 'ft' || units?.angleUnit !== 'deg') result.errors.push(error(null, null, 'units-required', 'Explicitly confirm measured depth in feet and inclination/azimuth in degrees.'));
  const { records, errors } = readCsv(originalCsv);
  result.errors.push(...errors);
  if (!records.length) { result.errors.push(error(null, null, 'missing-header', 'CSV header MD,Inclination,Azimuth is required.')); return result; }
  const headers = records[0].fields, columns = {};
  headers.forEach((header, index) => {
    const identified = identifyHeader(header);
    if (!identified) return;
    if (!identified.unitValid) result.errors.push(error(records[0].sourceRow, identified.field, 'unsupported-unit', `Unsupported unit in header "${header}"; only feet and degrees are supported.`));
    if (columns[identified.field] !== undefined) result.errors.push(error(records[0].sourceRow, identified.field, 'duplicate-header', `Duplicate header for ${identified.field}.`));
    columns[identified.field] = index;
  });
  ['mdFt', 'inclinationDeg', 'azimuthDeg'].forEach(field => {
    if (columns[field] === undefined) result.errors.push(error(records[0].sourceRow, field, 'missing-header', `Missing ${field} header (MD,Inclination,Azimuth).`));
  });
  result.rawStations = records.slice(1).map(record => {
    if (record.fields.length !== headers.length) result.errors.push(error(record.sourceRow, null, 'column-count', `Expected ${headers.length} CSV columns; found ${record.fields.length}.`));
    return { sourceRow: record.sourceRow, fields: record.fields, mdFt: record.fields[columns.mdFt], inclinationDeg: record.fields[columns.inclinationDeg], azimuthDeg: record.fields[columns.azimuthDeg] };
  });
  const validation = validateSurveyStations(result.rawStations);
  result.errors.push(...validation.errors);
  result.stations = validation.stations;
  result.valid = result.errors.length === 0;
  return result;
}
