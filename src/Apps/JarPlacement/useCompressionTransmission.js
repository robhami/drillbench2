import { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { importedGeometry } from '../JarClearance/clearanceData';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { compressionAssessmentKey } from '../../engineering/research/jarDownCompressionAssessment';
import { createCompressionAssessmentWorker } from './createCompressionAssessmentWorker';

const number = v => String(v ?? '').trim() === '' ? NaN : Number(v);
export function normalizedResearchInput(fields) {
  const E = number(fields.upperRods[0].youngsModulusPsi), rho = number(fields.upperRods[0].densitySlugFt3);
  return { ...fields, compressionLbf: number(fields.compressionLbf), strokeIn: number(fields.strokeIn), gravityFtS2: number(fields.gravityFtS2), horizonS: number(fields.horizonS),
    observation: { startS: number(fields.observation?.startS ?? 0), endS: number(fields.observation?.endS ?? fields.horizonS) },
    upperRods: fields.upperRods.map(r => ({ lengthFt: number(r.lengthFt), areaIn2: number(r.areaIn2), youngsModulusPsi: E, densitySlugFt3: rho })),
    lowerRods: fields.lowerRods.map(r => ({ lengthFt: number(r.lengthFt), areaIn2: number(r.areaIn2), youngsModulusPsi: E, densitySlugFt3: rho })) };
}

export default function useCompressionTransmission({ bha, fields, stuck, analysisBitMdFt, surfaceReferenceMdFt }) {
  const source = useActiveSurvey(bha);
  const [boundary, setBoundary] = useState({ direction: 'slackoff', hookloadKlbf: '' });
  const [request, setRequest] = useState(null), [snapshot, setSnapshot] = useState(null);
  const sequence = useRef(0);
  const survey = useMemo(() => importedGeometry(source), [source]);
  const depth = analysisDepth(bha);
  const bitMdFt = analysisBitMdFt ?? (depth.valid ? depth.bitMdFt : '');
  const surfaceMdFt = surfaceReferenceMdFt ?? '0';
  const researchInput = normalizedResearchInput(fields);
  // Manual compression is deliberately excluded: the candidate is checked
  // with the static force, and adoption must not invalidate itself.
  const key = compressionAssessmentKey({ bha, source, bitMdFt, surfaceMdFt, boundary, stuck, researchInput: { ...researchInput, compressionLbf: null } });
  const current = snapshot?.key === key && snapshot.id === request?.id ? snapshot : null;
  const pending = request?.key === key && !current;
  const token = `${key}:${request?.id ?? 'none'}`;
  useEffect(() => {
    if (!request) return undefined;
    if (request.key !== key) { setRequest(null); setSnapshot(null); return undefined; }
    let active = true, worker;
    try {
      worker = createCompressionAssessmentWorker();
      worker.onmessage = e => { if (active) setSnapshot({ key: request.key, id: request.id, assessment: e.data }); };
      worker.onerror = event => { event?.preventDefault?.(); if (active) setSnapshot({ key: request.key, id: request.id, assessment: { classification: 'Unsupported', canAdopt: false, issues: ['Static assessment worker failed. Reload the page and calculate again if the worker could not load.'], limitations: [] } }); };
      worker.postMessage(request.input);
    } catch (e) { setSnapshot({ key: request.key, id: request.id, assessment: { classification: 'Unsupported', canAdopt: false, issues: [e.message], limitations: [] } }); }
    return () => { active = false; worker?.terminate(); };
  }, [request, key]);
  return { key, token, boundary, setBoundary, pending, bitMdFt, surfaceMdFt,
    referenceContext: JSON.stringify({ bha, source, bitMdFt, surfaceMdFt }),
    assessment: current?.assessment || { classification: 'Unsupported', canAdopt: false, issues: [pending ? 'Static calculation pending; previous results are unavailable.' : 'No current assessment. Enter an explicit surface boundary, copy matching BHA shapes, and calculate.'], limitations: [] },
    calculate: () => { setSnapshot(null); setRequest({ key, id: ++sequence.current, input: { bha, survey, bitMdFt, surfaceMdFt, boundary, researchInput, stuckFt: stuck } }); } };
}
