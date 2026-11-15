import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveSurvey } from '../Survey/surveyAssociation';
import { importedGeometry } from '../JarClearance/clearanceData';
import { buildLoadedBhaPresentation, loadedJarRowKey } from '../JarConfiguration/loadedBhaPresentation';
import LoadedBhaSchematic from './LoadedBhaSchematic';
import './StringFrame.css';

export { calculateStringFrameLabelLayout, allocateCompressedComponentHeights, compressedLengthWeight, schematicWidthForOd } from './LoadedBhaSchematic';

export default function StringFrame({ bha, loadedData: suppliedData, drillingMode = 'slide', setDrillingMode, surfaceReferenceMdFt = 0, selectedLoadedJarKey }) {
  const contentRef = useRef(null);
  const initialHeight = useRef(null);
  const [extraOverviewHeight, setExtraOverviewHeight] = useState(0);
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const measure = () => {
      const height = content.clientHeight;
      if (!Number.isFinite(height) || height <= 0) return;
      if (initialHeight.current === null) {
        initialHeight.current = height;
        return;
      }
      const extra = Math.max(0, height - initialHeight.current);
      setExtraOverviewHeight(current => current === extra ? current : extra);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);
  const surveySource = useActiveSurvey(bha);
  const surveyMode = bha?.trajectoryMode === 'directional';
  const survey = useMemo(() => importedGeometry(surveySource), [surveySource]);
  const computed = useMemo(() => suppliedData || buildLoadedBhaPresentation({ bha, survey, drillingMode, surfaceReferenceMdFt }),
    [suppliedData, bha, survey, drillingMode, surfaceReferenceMdFt]);
  const rows = computed?.geometryBha?.rows || bha?.rows || [];
  const jars = rows.map((row, index) => ({ row, key: loadedJarRowKey(row, index) })).filter(item => String(item.row.category).toUpperCase() === 'JAR');
  const selectedKey = jars.some(item => item.key === selectedLoadedJarKey) ? selectedLoadedJarKey
    : jars.some(item => item.key === bha?.selectedJarId) ? bha.selectedJarId : jars.length === 1 ? jars[0].key : '';
  return <main ref={contentRef} className="stringFrameWindow" aria-label="BHA Schematic">
    <LoadedBhaSchematic rows={rows} positions={computed?.positions} selectedJarKey={selectedKey}
      schematicSectionsByJarKey={computed?.schematicSectionsByJarKey} straight={computed?.straight}
      surveyLoads={computed?.surveyLoads} drillingMode={computed?.drillingMode || drillingMode} deployment={computed?.deployment}
      controllingWob={bha?.wob}
      setDrillingMode={setDrillingMode} surveyMode={surveyMode}
      extraOverviewHeight={extraOverviewHeight} tall />
  </main>;
}
