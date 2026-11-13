import { validateSurveyStations } from './surveyImport';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const vector = value => Array.isArray(value) && value.length === 3 && value.every(finite);
const stationGeometryValid = station => station && [station.tvdFt, station.northingFt, station.eastingFt, station.dlsDegPer100Ft].every(finite);
const fmt = value => value.toLocaleString('en-US', { maximumFractionDigits: 6 });
const intervalText = interval => `${fmt(interval.startMdFt)}–${fmt(interval.endMdFt)} ft`;

// Coverage is defined by usable minimum-curvature arcs, not bounding MD alone.
export function validateSurveyCoverage(survey, { startMdFt, endMdFt, calculations = ['survey-dependent calculation'] }) {
  const required = finite(startMdFt) && finite(endMdFt) && startMdFt >= 0 && endMdFt >= startMdFt
    ? { startMdFt, endMdFt } : null;
  const stationCheck = validateSurveyStations(survey?.stations || []);
  const issues = [];
  if (!survey?.valid || !stationCheck.valid) issues.push('Survey is missing or internally invalid.');
  if (survey?.stations?.some(station => !stationGeometryValid(station))) issues.push('Survey contains invalid computed station geometry.');
  if (!survey?.valid) issues.push(...(survey?.errors || []).map(error => error.message || String(error)));
  if (stationCheck.valid && (!survey?.summary || survey.summary.startMdFt !== survey.stations[0].mdFt || survey.summary.endMdFt !== survey.stations[survey.stations.length - 1].mdFt)) issues.push('Survey MD summary does not match its stations.');
  const usable = [];
  let previousEnd = -Infinity;
  for (const segment of survey?.segments || []) {
    const endpoints = finite(segment.fromMdFt) && finite(segment.toMdFt) && segment.fromMdFt >= 0 && segment.toMdFt > segment.fromMdFt;
    const valid = endpoints && finite(segment.lengthFt) && segment.lengthFt === segment.toMdFt - segment.fromMdFt &&
      finite(segment.doglegRad) && segment.doglegRad >= 0 && segment.doglegRad < Math.PI - 1e-8 &&
      vector(segment.tangent0) && Math.abs(Math.hypot(...segment.tangent0) - 1) <= 1e-8 && vector(segment.turn) && vector(segment.start) && segment.fromMdFt >= previousEnd &&
      (survey.stations || []).some((s, index) => s.mdFt === segment.fromMdFt && stationGeometryValid(s) && stationGeometryValid(survey.stations[index + 1]) && survey.stations[index + 1].mdFt === segment.toMdFt);
    if (endpoints) previousEnd = segment.toMdFt;
    if (valid && survey.valid && stationCheck.valid) usable.push({ startMdFt: segment.fromMdFt, endMdFt: segment.toMdFt });
    else issues.push('Survey contains an invalid or overlapping trajectory interval.');
  }
  const actualCoverage = [];
  usable.sort((a, b) => a.startMdFt - b.startMdFt).forEach(interval => {
    const last = actualCoverage[actualCoverage.length - 1];
    if (last && last.endMdFt === interval.startMdFt) last.endMdFt = interval.endMdFt;
    else actualCoverage.push({ ...interval });
  });
  const missingIntervals = [];
  if (required) {
    let cursor = startMdFt;
    for (const interval of actualCoverage) {
      if (interval.endMdFt < cursor || interval.startMdFt > endMdFt) continue;
      if (interval.startMdFt > cursor) missingIntervals.push({ startMdFt: cursor, endMdFt: Math.min(interval.startMdFt, endMdFt) });
      cursor = Math.max(cursor, Math.min(interval.endMdFt, endMdFt));
    }
    if (cursor < endMdFt || (startMdFt === endMdFt && !actualCoverage.some(i => startMdFt >= i.startMdFt && startMdFt <= i.endMdFt))) missingIntervals.push({ startMdFt: cursor, endMdFt });
  }
  const covered = Boolean(required && actualCoverage.length && !missingIntervals.length && !issues.length);
  missingIntervals.forEach(interval => { interval.location = interval.startMdFt === startMdFt && interval.endMdFt === endMdFt ? 'entire' : interval.startMdFt === startMdFt ? 'beginning' : interval.endMdFt === endMdFt ? 'end' : 'internal'; });
  const status = !required ? 'invalid-required-interval' : covered ? 'complete' : issues.length ? 'invalid-survey' : 'incomplete';
  const message = covered ? '' : !required ? 'Survey coverage unavailable: establish a valid BHA bit depth and surface reference MD.' :
    `Survey coverage warning: actual ${actualCoverage.map(intervalText).join(', ') || 'none usable'}; required ${intervalText(required)}; missing ${missingIntervals.map(intervalText).join(', ') || 'none in required interval'}. ${issues.length ? [...new Set(issues)].join(' ') + ' ' : ''}No extrapolation is permitted.`;
  return { covered, status, units: 'ft', requiredCoverage: required, actualCoverage,
    surveyRange: actualCoverage.length ? { startMdFt: actualCoverage[0].startMdFt, endMdFt: actualCoverage[actualCoverage.length - 1].endMdFt } : null,
    missingIntervals, issues: [...new Set(issues)], message,
    calculations: calculations.map(calculation => ({ calculation, requiredCoverage: required })) };
}
