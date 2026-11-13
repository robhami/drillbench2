import { useEffect, useMemo, useState } from 'react';
import { parseSurveyCsv } from '../../engineering/survey/surveyImport';
import { calculateSurveyGeometry } from '../../engineering/survey/surveyGeometry';
import { analysisDepth } from '../../engineering/bha/analysisDepth';

// Keep the legacy key intact as a recovery source, never as the active source
// for a managed BHA. Records are immutable snapshots, not shared mutable paths.
export const SURVEY_STORAGE_KEY = 'wellbenchSurveyV1';
export const SURVEY_CHANGED_EVENT = 'wellbench-survey-changed';
export const SURVEY_ARCHIVE_KEY = 'drillframeSurveyArchiveV1';
export const emptySurveyState = () => ({ version: 1, active: null, history: [], reviewRequired: false });
export const readLegacySurvey = () => {
  try { const value = JSON.parse(localStorage.getItem(SURVEY_STORAGE_KEY)); return typeof value?.originalCsv === 'string' ? value : null; }
  catch { return null; }
};
export const hasSurveyAssociation = bha => Object.prototype.hasOwnProperty.call(bha || {}, 'surveyState');
export const isGeneratedVerticalSurvey = source => source?.kind === 'generated-vertical' ||
  source?.origin === 'Explicit vertical replacement' || /^Generated vertical trajectory/i.test(source?.origin || '');

export function inferTrajectoryMode(bha) {
  if (bha?.trajectoryMode === 'vertical' || bha?.trajectoryMode === 'directional') return bha.trajectoryMode;
  const active = bha?.surveyState?.active;
  if (isGeneratedVerticalSurvey(active)) return 'vertical';
  const sources = [active, ...(bha?.surveyState?.history || [])];
  if (sources.some(source => source?.originalCsv && !isGeneratedVerticalSurvey(source))) return 'directional';
  // Older BHAs without an imported source retain the app's vertical fallback;
  // a present but invalid/unconfirmed import remains Directional and requires review.
  return 'vertical';
}

export function migrateSurveyAssociations(well, legacy = readLegacySurvey()) {
  const migrate = bha => {
    const associated = hasSurveyAssociation(bha) ? bha : { ...bha, surveyState: legacy?.originalCsv ? {
      version: 1, active: { ...legacy, origin: 'Legacy shared browser survey', kind: 'imported' }, history: [], reviewRequired: true
    } : emptySurveyState() };
    return associated.trajectoryMode === 'vertical' || associated.trajectoryMode === 'directional'
      ? associated : { ...associated, trajectoryMode: inferTrajectoryMode(associated) };
  };
  return { ...well, currentBha: migrate(well.currentBha), savedBhas: (well.savedBhas || []).map(migrate) };
}

// Read-only compatibility for old standalone callers/validation fixtures. The
// application migrates every loaded BHA and creates new ones with an explicit
// empty association, so a managed BHA can NEVER fall back to global data.
export function useActiveSurvey(bha) {
  const managed = hasSurveyAssociation(bha) || Boolean(bha?.trajectoryMode);
  const [legacy, setLegacy] = useState(readLegacySurvey);
  useEffect(() => {
    if (managed) return undefined;
    const refresh = event => {
      if (event.type === 'storage' && event.key && event.key !== SURVEY_STORAGE_KEY) return;
      setLegacy(event.type === SURVEY_CHANGED_EVENT ? event.detail : readLegacySurvey());
    };
    setLegacy(readLegacySurvey());
    window.addEventListener(SURVEY_CHANGED_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(SURVEY_CHANGED_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, [bha?.id, managed]);
  const depth = analysisDepth(bha);
  const active = bha?.surveyState?.active, history = bha?.surveyState?.history, mode = bha?.trajectoryMode;
  return useMemo(() => resolveActiveSurvey(bha, legacy),
    // Resolve the selected path synchronously; scalar reference inclination is not a survey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [managed, active, history, mode, bha?.surveyState?.reviewRequired, depth.valid, depth.bitMdFt, legacy]);
}
export function resolveActiveSurvey(bha, legacy = null) {
  if (bha?.trajectoryMode === 'vertical') {
    const depth = analysisDepth(bha);
    return depth.valid && depth.bitMdFt > 0 ? { ...verticalSurvey(depth.bitMdFt),
      origin: 'Generated vertical trajectory; inclination 0°, azimuth 0° convention (not measured)' } : null;
  }
  if (bha?.trajectoryMode === 'directional') {
    if (bha.surveyState?.reviewRequired) return null;
    const sources = [bha.surveyState?.active, ...[...(bha.surveyState?.history || [])].reverse()];
    return sources.find(s => s?.originalCsv && !isGeneratedVerticalSurvey(s)) || null;
  }
  // Preserve legacy caller/fixture semantics until a trajectory choice is explicit.
  return hasSurveyAssociation(bha) ? bha.surveyState?.active || null : legacy;
}
export function trajectorySelectionPatch(mode) {
  return { trajectoryMode: mode, ...(mode === 'vertical' ? { inclination: 0 } : {}) };
}
export function surveyGeometry(source) {
  if (!source?.originalCsv) return null;
  const parsed = parseSurveyCsv(source.originalCsv, source.confirmed === true ? { mdUnit: 'ft', angleUnit: 'deg' } : undefined);
  return parsed.valid ? calculateSurveyGeometry(parsed.stations) : null;
}
export function verticalSurvey(bitMdFt) {
  if (!Number.isFinite(bitMdFt) || bitMdFt <= 0) throw new Error('A valid positive current bit MD is required.');
  return { originalCsv: `MD,Inclination,Azimuth\n0,0,0\n${bitMdFt},0,0`, confirmed: true,
    filename: `Vertical survey 0–${bitMdFt} ft MD`, kind: 'generated-vertical', origin: 'Explicit vertical replacement' };
}
export function replaceSurvey(state, source) {
  const previous = state || emptySurveyState();
  return { version: 1, active: source, history: previous.active?.originalCsv ? [...(previous.history || []), previous.active] : previous.history || [], reviewRequired: false };
}
export function readSurveyArchive() {
  try { const value = JSON.parse(localStorage.getItem(SURVEY_ARCHIVE_KEY)); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export function archiveSurveys(sources, bha) {
  const raw = localStorage.getItem(SURVEY_ARCHIVE_KEY);
  if (raw && !Array.isArray(JSON.parse(raw))) throw new Error('Recovery archive requires review.');
  const records = readSurveyArchive();
  sources.filter(s => s?.originalCsv).forEach(source => {
    if (!records.some(r => JSON.stringify(r.source) === JSON.stringify(source)))
      records.push({ source, bhaName: bha?.name || 'Unsaved BHA', bhaId: bha?.id || '', archivedAt: new Date().toISOString() });
  });
  // Do not apply a replacement if its recovery snapshot could not be saved.
  localStorage.setItem(SURVEY_ARCHIVE_KEY, JSON.stringify(records));
}
