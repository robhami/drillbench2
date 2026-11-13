import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { cumulativeBhaLengths } from '../../Components/BHABuilder/cumulativeBhaLengths';

const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
const bhaKeys = ['id', 'name', 'holeSize', 'mudWeight', 'wob', 'inclination', 'frictionCoefficient', 'rpm', 'rop', 'drillpipeReferenceBitMdFt'];
const rowKeys = ['rowId', 'category', 'toolName', 'selectedToolId', 'bitId', 'length', 'lengthMode', 'od', 'id', 'idSize', 'weight'];
const sourceKeys = ['filename', 'kind', 'origin', 'confirmed'];
// JSON has no nonfinite numeric representation. Preserve it explicitly, never as a zero.
export const serializeNpDiagnostics = value => JSON.stringify(value, (key, item) => typeof item === 'number' && !Number.isFinite(item) ? { nonfiniteNumber: String(item) } : item, 2);
const snapshot = value => JSON.parse(serializeNpDiagnostics(value));

export function npInputContext(bha, source, survey, fields, drillingMode) {
  const selectedBha = { ...pick(bha, bhaKeys), rows: (bha?.rows || []).map(row => pick(row, rowKeys)) };
  const hasAutoDp = selectedBha.rows.some(row => row.category === 'DP' && row.lengthMode === 'auto');
  const deployment = hasAutoDp ? deployDrillstring(selectedBha, bha?.drillpipeReferenceBitMdFt) : null;
  const positions = calcComponentPositions(deployment?.valid ? deployment.bha : selectedBha);
  const cumulative = cumulativeBhaLengths(selectedBha.rows, deployment?.valid ? deployment.metadata.deployedDpLengthFt : null);
  const exportedRows = selectedBha.rows.map((row, index) => ({ ...row, cumulativeLengthFt: cumulative[index] ?? null }));
  return snapshot({ bha: { ...selectedBha, rows: exportedRows }, componentPositions: positions,
    survey: { provenance: pick(source, sourceKeys), associationReviewRequired: bha?.surveyState?.reviewRequired ?? null,
      valid: survey?.valid === true, errors: survey?.errors || [], stations: survey?.stations || [], summary: survey?.summary || null },
    fields: pick(fields, ['start', 'end', 'increment', 'modes', 'avoidance', 'surface', 'minWob', 'maxWob', 'samples', 'friction', 'mud', 'rpm', 'rop', 'view']), currentDrillingMode: drillingMode });
}

export function captureNpRequest(request, context, transport, startedAt = new Date().toISOString()) {
  // The worker currently receives the entire BHA, including unrelated UI/history.
  // Keep its exact engineering payload and disclose every excluded metadata field.
  const selectedBha = { ...pick(request.bha, bhaKeys), rows: (request.bha?.rows || []).map(row => pick(row, rowKeys)) };
  const omitted = Object.keys(request.bha || {}).filter(key => !bhaKeys.includes(key) && key !== 'rows').map(key => `request.bha.${key}`);
  (request.bha?.rows || []).forEach((row, index) => Object.keys(row).filter(key => !rowKeys.includes(key)).forEach(key => omitted.push(`request.bha.rows[${index}].${key}`)));
  return snapshot({ startedAt, transport, requestMessage: { request: { ...request, bha: selectedBha } },
    omittedNonEngineeringMetadata: omitted, inputContext: context });
}

export function buildNpDiagnostics({ current, capture, response, state, error = null, plot = null, selections = [], jarIndex = 0,
  compare = true, hiddenCurves = {}, generatedAt = new Date().toISOString() }) {
  const scenarios = response?.scenarios || [], groups = new Map(), previous = new Map();
  const samples = scenarios.map((s, index) => {
    if (!s.valid) {
      const key = JSON.stringify([s.status ?? 'unknown', s.errors || []]);
      if (!groups.has(key)) groups.set(key, { reasonCode: s.status ?? 'unknown', messages: s.errors || [], count: 0, sampleIndices: [] });
      const group = groups.get(key); group.count += 1; group.sampleIndices.push(index);
    }
    const identity = JSON.stringify([s.wobLbf, s.mode, s.frictionCoefficient]);
    const prior = previous.get(identity), unique = s.valid && s.neutralPoints?.length === 1 && !s.neutralIntervals?.length;
    const priorUnique = prior?.valid && prior.neutralPoints?.length === 1 && !prior.neutralIntervals?.length;
    previous.set(identity, s);
    const plottedSeries = selections.flatMap((selection, curveIndex) => {
      if (!selection || selection.wobLbf !== s.wobLbf || selection.mode !== s.mode || selection.frictionCoefficient !== s.frictionCoefficient) return [];
      // Chart emits one primary trace per selection plus optional nonunique traces.
      const primary = plot?.data?.filter(t => t.showlegend);
      const trace = primary?.length ? primary[curveIndex] : plot?.data?.[0];
      if (!trace) return [];
      const at = trace.x.indexOf(s.bitMdFt);
      const extra = (plot.data || []).filter(t => t.name === `${trace.name}: nonunique NP samples`);
      return [{ name: trace.name, visible: trace.visible !== false, primaryValueFt: at < 0 ? null : trace.y[at],
        nonuniqueValuesFt: extra.flatMap(t => t.x.flatMap((md, i) => md === s.bitMdFt ? [t.y[i]] : [])) }];
    });
    return { sampleIndex: index, bitMdFt: s.bitMdFt, wobLbf: s.wobLbf, mode: s.mode, frictionCoefficient: s.frictionCoefficient,
      valid: s.valid, status: s.status, invalidReasonCode: s.valid ? null : s.status ?? 'unknown', errors: s.errors || [],
      validRootCount: s.valid ? s.neutralPoints?.length ?? 0 : null, neutralIntervals: s.valid ? s.neutralIntervals || [] : null,
      neutralPoints: s.valid ? s.neutralPoints || [] : null,
      jars: (s.jars || []).map(j => ({ jarIndex: j.jarIndex, jarAboveBitFt: j.jarFromBitFt,
        npRelativeToJarFt: s.valid ? (s.neutralPoints || []).map(n => n.fromBitFt - j.jarFromBitFt) : null,
        nearestNpRelativeToJarFt: j.signedSeparationFt == null ? null : -j.signedSeparationFt })),
      previousBitMdFt: prior?.bitMdFt ?? null,
      componentTransition: Boolean(unique && priorUnique && s.neutralPoints[0].componentIndex !== prior.neutralPoints[0].componentIndex),
      plottedSeries, includedInSelectedSeries: plottedSeries.length > 0,
      visibleFinitePoint: plottedSeries.some(t => t.visible && (Number.isFinite(t.primaryValueFt) || t.nonuniqueValuesFt.some(Number.isFinite))) };
  });
  const invalidByReason = [...groups.values()], computedInvalid = invalidByReason.reduce((sum, g) => sum + g.count, 0);
  return snapshot({ format: 'DrillFrame NP Diagnostics', schemaVersion: 1, generatedAt,
    notice: 'Preliminary engineering analysis; not for operational use. No solver was run by this export.',
    state, error, currentSelection: current, analysis: capture ? { ...capture, responseMessage: response == null ? null : { result: response } } : null,
    view: { compare, jarIndex, selections, hiddenCurves, plot },
    totals: { evaluated: scenarios.length, displayedInvalidSampleCount: response?.invalidScenarios ?? null, computedInvalidSampleCount: response ? computedInvalid : null,
      reconciled: response ? computedInvalid === response.invalidScenarios : null, invalidByReason,
      invalidInVisibleSeries: samples.filter(s => !s.valid && s.plottedSeries.some(t => t.visible)).length,
      invalidInHiddenSelectedSeries: samples.filter(s => !s.valid && s.plottedSeries.length && s.plottedSeries.every(t => !t.visible)).length,
      invalidOutsideSelectedSeries: samples.filter(s => !s.valid && !s.plottedSeries.length).length }, samples });
}

export function downloadNpDiagnostics(diagnostics) {
  const filename = `DrillFrame-NP-Diagnostics-${diagnostics.generatedAt.slice(0, 10).replace(/-/g, '')}.json`;
  const url = URL.createObjectURL(new Blob([serializeNpDiagnostics(diagnostics)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
  return filename;
}
