import { useState, useMemo } from 'react';
import { analysisDepth } from '../engineering/bha/analysisDepth';
import { useActiveSurvey } from '../Apps/Survey/surveyAssociation';
import { importedGeometry } from '../Apps/JarClearance/clearanceData';
import { validateSurveyCoverage } from '../engineering/survey/surveyCoverage';

// Existing shared inputs remain independent of panel locations.
export default function useWorkspaceAnalysis(bha) {
  const [drillingMode, setDrillingMode] = useState('slide');
  const [surfaceReferenceMdFt, setSurfaceReferenceMdFt] = useState('0');
  const source = useActiveSurvey(bha);
  const survey = useMemo(() => importedGeometry(source), [source]);
  const depth = analysisDepth(bha), analysisBitMdFt = depth.valid ? String(depth.bitMdFt) : '';
  const surveyCoverage = useMemo(() => validateSurveyCoverage(survey, {
    startMdFt: String(surfaceReferenceMdFt).trim() !== '' ? Number(surfaceReferenceMdFt) : NaN,
    endMdFt: analysisBitMdFt === '' ? NaN : Number(analysisBitMdFt),
    calculations: ['string-weight projection', 'off-bottom hookloads', 'static/inverse jar loads', 'buckling screening']
  }), [survey, analysisBitMdFt, surfaceReferenceMdFt]);
  return { analysisBitMdFt, drillingMode, setDrillingMode, surfaceReferenceMdFt, setSurfaceReferenceMdFt, surveyCoverage };
}
