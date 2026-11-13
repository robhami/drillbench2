import React, { useEffect, useState } from 'react';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { readLegacySurvey, readSurveyArchive, verticalSurvey } from './surveyAssociation';

export default function SurveyManagement({ bha, source, geometry, updateBha, onReplace }) {
  const depth = analysisDepth(bha);
  const [choice, setChoice] = useState('');
  useEffect(() => setChoice(''), [bha?.id]);
  const candidates = [...(bha?.trajectoryMode === 'vertical' ? [{ source: bha?.surveyState?.active, label: 'Preserved associated survey' }] : []),
    ...(bha?.surveyState?.history || []).map(source => ({ source, label: 'Previous survey' })),
    ...readSurveyArchive().map(record => ({ source: record.source, label: `Archived from ${record.bhaName}` })),
    { source: readLegacySurvey(), label: 'Legacy browser survey — review ownership' }]
    .filter((record, i, all) => record.source?.originalCsv && all.findIndex(other => JSON.stringify(other.source) === JSON.stringify(record.source)) === i);
  const replaceVertical = () => {
    // Invalid/unconfirmed sources may also contain directional stations. Require
    // confirmation whenever we cannot establish that the existing path is vertical.
    if (source.originalCsv && (!geometry?.valid || geometry.summary.maxInclinationDeg > 0) &&
      !window.confirm('Replace the existing survey with a vertical survey? Survey-based analyses will change. The previous survey will be preserved for restoration.')) return;
    onReplace(verticalSurvey(depth.bitMdFt));
  };
  return <div className="surveyManagement" style={{ fontSize: 12, marginBottom: 8 }}>
    <button type="button" disabled={!depth.valid || !(depth.bitMdFt > 0)} onClick={replaceVertical}>Replace with Vertical Survey</button>{' '}
    <span>{depth.valid && depth.bitMdFt > 0 ? `Coverage: 0–${depth.bitMdFt.toLocaleString('en-US')} ft MD` : 'Enter a valid current bit MD to generate a vertical survey.'}</span>
    {bha?.surveyState?.reviewRequired && bha?.trajectoryMode !== 'vertical' && updateBha && <button type="button" onClick={() => updateBha({ surveyState: { ...bha.surveyState, reviewRequired: false } })}>Confirm survey association</button>}
    <details><summary>Restore a previous or legacy survey</summary>
      <label>Preserved survey <select value={choice} onChange={e => setChoice(e.target.value)}><option value="">Select a preserved source</option>
        {candidates.map((record, i) => <option key={i} value={i}>{record.source.filename || 'Unnamed survey'} — {record.label}</option>)}
      </select></label>{' '}
      <button type="button" disabled={choice === '' || !candidates[Number(choice)]} onClick={() => {
        const candidate = candidates[Number(choice)];
        if (candidate && window.confirm('Restore this preserved survey for the current BHA? Survey-based analyses will use its stations.')) { onReplace(candidate.source); setChoice(''); }
      }}>Restore selected survey</button>
      <p>Restore is explicit and applies to this working BHA only. Save stores its association. Originals remain in the recovery archive; no survey is deleted.</p>
    </details>
  </div>;
}
