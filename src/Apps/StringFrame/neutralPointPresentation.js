const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

function rootsFromStraightProfile(result) {
  const profile = result?.loadProfile;
  if (!profile?.valid || !Array.isArray(profile.components)) return { reason: profile?.error || 'Straight-hole load profile unavailable.' };
  const points = [];
  let interval = false;
  const add = (fromBitFt, componentIndex) => {
    if (!finite(fromBitFt)) return;
    if (!points.some(point => near(point.fromBitFt, fromBitFt))) points.push({ fromBitFt: Number(fromBitFt), componentIndex });
  };
  if (Number(profile.bitAxialForce) === 0) add(0, 0);
  profile.components.forEach((component, index) => {
    const bottom = Number(component.bottomAxialForce), top = Number(component.topAxialForce);
    const start = Number(component.startFromBit), end = Number(component.endFromBit);
    if (![bottom, top, start, end].every(Number.isFinite) || !(end > start)) return;
    if (bottom === 0 && top === 0) { interval = true; return; }
    if (bottom === 0) add(start, index);
    else if (top === 0) add(end, index);
    else if (Math.sign(bottom) !== Math.sign(top)) add(start + bottom / (bottom - top) * (end - start), index);
  });
  points.sort((a, b) => a.fromBitFt - b.fromBitFt);
  if (interval) return { reason: 'Neutral interval; no unique neutral point.' };
  if (points.length > 1) return { reason: 'Multiple straight-hole crossings; no unique neutral point.' };
  if (!points.length) return { reason: 'No straight-hole neutral point within the deployed BHA.' };
  if (!finite(result.neutralPointFt) || !near(Number(result.neutralPointFt), points[0].fromBitFt)) {
    return { reason: 'Straight-hole neutral point is unavailable or inconsistent with its load profile.' };
  }
  return { point: points[0] };
}

function uniqueSurveyPoint(result, expectedMode) {
  if (!result?.valid) return { reason: result?.errors?.join(' ') || 'Valid covered survey load profile unavailable; survey extrapolation is not used.' };
  if (result.mode !== expectedMode) return { reason: `Survey ${expectedMode} result unavailable; no matching drilling-mode profile.` };
  if (result.neutralIntervals?.length) return { reason: 'Survey neutral interval; no unique neutral point.' };
  if ((result.neutralPoints || []).length > 1) return { reason: 'Multiple survey crossings; no unique neutral point.' };
  const point = result.neutralPoints?.[0];
  if (!point) return { reason: 'No survey neutral point within the deployed BHA.' };
  if (!finite(point.fromBitFt) || !finite(point.mdFt) || !finite(result.bitMdFt) || !near(point.mdFt, result.bitMdFt - point.fromBitFt)) {
    return { reason: 'Survey neutral point is unavailable or its MD datum is inconsistent.' };
  }
  return { point: { fromBitFt: Number(point.fromBitFt), mdFt: Number(point.mdFt), componentIndex: point.componentIndex } };
}

function mapPoint(point, components, segments, totalLength, { compactBitGeometry = false } = {}) {
  if (point.fromBitFt < -1e-6) return { reason: 'Neutral point is below the bit and outside the displayed assembly.' };
  if (point.fromBitFt > totalLength + 1e-6) return { reason: 'Neutral point is above the deployed BHA and outside the displayed assembly.' };
  const component = components[point.componentIndex] || components.find(item =>
    point.fromBitFt >= Number(item.startFromBit) - 1e-6 && point.fromBitFt <= Number(item.endFromBit) + 1e-6);
  const segment = segments.find(item => item.componentIndex === point.componentIndex) ||
    (component && segments.find(item => item.row?.rowId && item.row.rowId === component.rowId));
  if (!component || !segment) return { reason: 'Neutral point is within the deployed interval but outside the visible schematic geometry.' };
  const category = String(component.category || segment.row?.category || '').toUpperCase();
  if (category === 'DP') {
    const pipeSegments = segments.filter(item => String(item.row?.category || '').toUpperCase() === 'DP');
    const top = Math.min(...pipeSegments.map(item => item.y1)), bottom = Math.max(...pipeSegments.map(item => item.y2));
    return { y: (top + bottom) / 2, approximate: true, section: 'DP',
      reason: 'Within DP; discontinuity means the line indicates the section only, not a precise schematic depth.' };
  }
  const start = Number(component.startFromBit), end = Number(component.endFromBit);
  const fraction = Math.max(0, Math.min(1, (point.fromBitFt - start) / (end - start)));
  if (compactBitGeometry && category === 'BIT') {
    const lowerBha = [...segments].reverse().find(item => item.section === 'Lower BHA');
    if (lowerBha) return { y: lowerBha.y2 + 8 + 6 * (1 - fraction), approximate: false, section: 'Bit' };
  }
  return { y: segment.y2 - fraction * (segment.y2 - segment.y1), approximate: false, section: segment.section };
}

function jarRelativeDistance(point, jarCentreFromBitFt, totalLength) {
  if (!finite(point?.fromBitFt)) return { jarDistanceReason: 'Neutral point distance is unavailable.' };
  if (!finite(totalLength) || Number(point.fromBitFt) < 0 || Number(point.fromBitFt) > Number(totalLength)) {
    return { jarDistanceReason: 'Neutral point is outside deployed BHA geometry; jar-relative distance is not calculated.' };
  }
  if (!finite(jarCentreFromBitFt) || Number(jarCentreFromBitFt) < 0 || Number(jarCentreFromBitFt) > Number(totalLength)) {
    return { jarDistanceReason: 'Selected jar centre geometry is unavailable; jar-relative distance is not calculated.' };
  }
  const deltaFt = Number(point.fromBitFt) - Number(jarCentreFromBitFt);
  if (!Number.isFinite(deltaFt)) return { jarDistanceReason: 'Jar-relative distance is unavailable.' };
  if (Math.abs(deltaFt) <= 1e-6) return { jarSeparationFt: 0, jarDistanceLabel: 'NP — At jar' };
  const magnitude = Math.abs(deltaFt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { jarSeparationFt: deltaFt, jarDistanceLabel: `NP — ${magnitude}ft ${deltaFt > 0 ? 'above' : 'below'} jar` };
}

function compactJarDistanceLabel(separationFt) {
  if (!finite(separationFt)) return 'NP —';
  const distance = Math.abs(Number(separationFt)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Number(separationFt) === 0) return 'NP 0.00ft';
  return `NP ${Number(separationFt) > 0 ? '+' : '−'}${distance}ft`;
}

/** Presentation adapter only: classifies already-computed roots and maps them to SVG geometry. */
export function buildNeutralPointPresentation({ straight, surveyLoads, drillingMode, positions, segments, totalLength,
  jarCentreFromBitFt, compactBitGeometry = false, surveyMode = false }) {
  const outputs = [];
  const add = (kind, result, neutral) => {
    if (!neutral.point) { outputs.push({ kind, label: result.label, reason: neutral.reason }); return; }
    const mapped = mapPoint(neutral.point, positions?.components || [], segments, totalLength,
      { compactBitGeometry });
    outputs.push({ kind, label: result.label, point: neutral.point,
      ...jarRelativeDistance(neutral.point, jarCentreFromBitFt, totalLength), ...mapped });
  };
  if (surveyMode) {
    const result = { label: `Survey · ${drillingMode}` };
    if (drillingMode === 'reference') add('survey', result,
      { reason: 'Survey Reference is unavailable; select Slide or Rotate for a covered survey neutral point.' });
    else add('survey', result, uniqueSurveyPoint(surveyLoads, drillingMode));
  } else {
    const result = { label: `Straight-hole · ${drillingMode}` };
    if (!['reference', 'slide', 'rotate'].includes(drillingMode)) {
      add('straight', result, { reason: 'Select Reference, Slide or Rotate for the straight-hole profile.' });
    } else if (straight?.drillingMode !== drillingMode) {
      add('straight', result, { reason: `Straight-hole ${drillingMode} result unavailable; no matching drilling-mode profile.` });
    } else add('straight', result, rootsFromStraightProfile(straight));
  }

  const markers = outputs.filter(output => Number.isFinite(output.y)).map(output => ({
    key: `neutral-${output.kind}`, x: 31, y: output.y, guide: 60, fullWidth: true,
    guideClass: 'stringFrameNeutralGuide', radius: 0, className: 'stringFrameNeutralMarker',
    testId: `neutral-point-${output.kind}`, title: compactJarDistanceLabel(output.jarSeparationFt),
    label: compactJarDistanceLabel(output.jarSeparationFt), mode: drillingMode,
    lineOnly: true, approximate: output.approximate
  }));
  return { markers, outputs };
}
