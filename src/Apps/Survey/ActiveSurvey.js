import React, { useMemo } from 'react';
import { surveyGeometry, useActiveSurvey } from './surveyAssociation';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { validateSurveyCoverage } from '../../engineering/survey/surveyCoverage';

export default function ActiveSurvey({ bha, compact = false }) {
  const source = useActiveSurvey(bha);
  const geometry = useMemo(() => surveyGeometry(source), [source]);
  const summary = geometry?.valid ? geometry.summary : null;
  const depth = analysisDepth(bha);
  if (compact || bha?.trajectoryMode) {
    const covered = validateSurveyCoverage(geometry, { startMdFt: 0, endMdFt: depth.valid ? depth.bitMdFt : NaN }).covered;
    const vertical = bha?.trajectoryMode === 'vertical';
    return <div className="activeSurvey" aria-label="Active survey" style={{ fontSize: 12, padding: '4px 0' }}>
      <strong>{vertical ? covered ? 'Vertical trajectory — full MD coverage' : 'Vertical trajectory — set a valid analysis depth' :
        summary && !bha?.surveyState?.reviewRequired && (!depth.valid || covered) ? `Directional — Survey: ${source.filename || 'Unnamed survey'}` : 'Directional survey required'}</strong>
      {vertical && source && <div>Generated vertical data · Type: Vertical · 0–{depth.bitMdFt.toLocaleString('en-US')} ft MD · Inclination 0°; azimuth 0° convention · Not a measured survey.</div>}
      {!vertical && summary && <div>Type: {summary.maxInclinationDeg === 0 ? 'Vertical' : 'Directional'} · MD coverage {summary.startMdFt.toLocaleString('en-US')}–{summary.endMdFt.toLocaleString('en-US')} ft MD · Source: {source.origin || 'Imported CSV'}</div>}
      {!vertical && (!covered || bha?.surveyState?.reviewRequired) && <div>Select, validate or import the associated survey in Survey. Full coverage is required; no extrapolation.</div>}
      {bha?.surveyState?.reviewRequired && !vertical && <div>Legacy shared survey — review required. Confirm its BHA association in Survey.</div>}
    </div>;
  }
  return <div className="activeSurvey" aria-label="Active survey" style={{ fontSize: 12, padding: '6px 0' }}>
    <strong>Active survey: {source?.originalCsv ? source.filename || 'Unnamed survey' : 'None associated with this BHA'}</strong>
    {source?.originalCsv && <div>Source: {source.origin || 'Imported CSV'} · Type: {summary ? summary.maxInclinationDeg === 0 ? 'Vertical' : 'Directional' : 'Unvalidated'} · MD coverage: {summary ? `${summary.startMdFt.toLocaleString('en-US')}–${summary.endMdFt.toLocaleString('en-US')} ft MD` : 'Unavailable'}</div>}
    {bha?.surveyState?.reviewRequired && <div role="status">Legacy shared survey — review required. Original BHA ownership was not recorded.</div>}
    <div>Survey stations control survey-based neutral point and axial-load analyses. The simplified inclination field is a constant-inclination reference only; editing it does not replace a survey.</div>
  </div>;
}
