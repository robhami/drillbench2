import { validateSurveyStations } from './surveyImport';

const RAD = Math.PI / 180;
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const direction = station => {
  const i = station.inclinationDeg * RAD, a = station.azimuthDeg * RAD;
  return [Math.sin(i) * Math.cos(a), Math.sin(i) * Math.sin(a), Math.cos(i)];
};
const sinc = x => Math.abs(x) < 1e-4 ? 1 - x * x / 6 + x ** 4 / 120 : Math.sin(x) / x;
const geometryError = message => ({ valid: false, errors: [{ message }], warnings: [], stations: [], segments: [] });

// Analytic integral of the rotating tangent. Equivalent to minimum curvature RF.
function partialInterval(segment, fraction) {
  const { doglegRad: beta, lengthFt: length, tangent0: u, turn } = segment;
  const angle = beta * fraction;
  const along = length * fraction * sinc(angle);
  // (1-cos angle)/beta using half-angle avoids cancellation near zero.
  const across = length * fraction * Math.sin(angle / 2) * sinc(angle / 2);
  const displacement = u.map((v, i) => along * v + across * turn[i]);
  const tangent = u.map((v, i) => Math.cos(angle) * v + Math.sin(angle) * turn[i]);
  return { displacement, tangent };
}

export function calculateSurveyGeometry(inputStations) {
  const validation = validateSurveyStations(inputStations);
  if (!validation.valid) return { ...validation, warnings: [], segments: [] };
  const stations = [], segments = [], warnings = [];
  let coordinates = [0, 0, 0];
  const coordinateFields = vector => ({ northingFt: vector[0], eastingFt: vector[1], tvdFt: vector[2] });
  validation.stations.forEach((station, index) => {
    if (index) {
      const previous = validation.stations[index - 1], u = direction(previous), v = direction(station);
      const cosine = Math.max(-1, Math.min(1, dot(u, v)));
      const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const sine = Math.hypot(...cross), beta = Math.atan2(sine, cosine);
      const length = station.mdFt - previous.mdFt;
      const turn = sine > 1e-15 ? v.map((value, i) => (value - cosine * u[i]) / sine) : [0, 0, 0];
      const segment = { fromMdFt: previous.mdFt, toMdFt: station.mdFt, lengthFt: length, doglegRad: beta, doglegDeg: beta / RAD, dlsDegPer100Ft: beta / RAD * 100 / length, tangent0: u, turn, start: coordinates.slice(), sourceRow: station.sourceRow };
      segments.push(segment);
      const { displacement } = partialInterval(segment, 1);
      coordinates = coordinates.map((value, i) => value + displacement[i]);
    }
    stations.push({ ...station, ...coordinateFields(coordinates), doglegDeg: index ? segments[index - 1].doglegDeg : 0, dlsDegPer100Ft: index ? segments[index - 1].dlsDegPer100Ft : 0 });
  });
  const ambiguous = segments.find(segment => Math.PI - segment.doglegRad < 1e-8);
  if (ambiguous) return geometryError(`Row ${ambiguous.sourceRow}: a 180° or near-180° dogleg does not define a stable, unique minimum-curvature arc.`);
  if (stations.some(station => ![station.tvdFt, station.northingFt, station.eastingFt, station.dlsDegPer100Ft].every(Number.isFinite))) return geometryError('Survey geometry exceeds numerical limits.');
  const first = stations[0], last = stations[stations.length - 1];
  if (first.mdFt !== 0) warnings.push('Coordinates and TVD are relative to the first survey station; the unsurveyed interval above it is unknown.');
  return { valid: true, errors: [], warnings, stations, segments, summary: { stationCount: stations.length, startMdFt: first.mdFt, endMdFt: last.mdFt, tvdFt: last.tvdFt, maxInclinationDeg: stations.reduce((max, s) => Math.max(max, s.inclinationDeg), 0), maxDlsDegPer100Ft: segments.reduce((max, s) => Math.max(max, s.dlsDegPer100Ft), 0) } };
}

export function evaluateSurveyAtMd(geometry, mdFt) {
  const fail = message => ({ valid: false, errors: [{ message }] });
  if (!geometry?.valid) return fail('A valid calculated survey is required.');
  if (typeof mdFt !== 'number' || !Number.isFinite(mdFt)) return fail('Measured depth must be a finite number in feet.');
  if (mdFt < geometry.summary.startMdFt || mdFt > geometry.summary.endMdFt) return fail('Measured depth is outside survey coverage; extrapolation is not supported.');
  const exact = geometry.stations.find(station => station.mdFt === mdFt);
  if (exact) return { valid: true, ...exact };
  const segment = geometry.segments.find(s => mdFt > s.fromMdFt && mdFt < s.toMdFt);
  const fraction = (mdFt - segment.fromMdFt) / segment.lengthFt;
  const { displacement, tangent } = partialInterval(segment, fraction);
  const coordinates = segment.start.map((v, i) => v + displacement[i]);
  const azimuth = Math.hypot(tangent[0], tangent[1]) < 1e-12 ? geometry.stations.find(s => s.mdFt === segment.fromMdFt).azimuthDeg : (Math.atan2(tangent[1], tangent[0]) / RAD + 360) % 360;
  return { valid: true, mdFt, inclinationDeg: Math.atan2(Math.hypot(tangent[0], tangent[1]), tangent[2]) / RAD, azimuthDeg: azimuth, northingFt: coordinates[0], eastingFt: coordinates[1], tvdFt: coordinates[2], dlsDegPer100Ft: segment.dlsDegPer100Ft };
}
