import React from 'react';
import EngineeringStringSchematic, { schematicToolType, schematicComponentHeight } from '../EngineeringString/EngineeringStringSchematic';
import V6ContinuousAssemblyDrawing from './v6Drawing';
import { buildNeutralPointPresentation } from './neutralPointPresentation';
import { buildLoadedBhaSchematicSections, loadedJarRowKey } from '../JarConfiguration/loadedBhaPresentation';
import '../EngineeringString/EngineeringStringCard.css';
import '../JarConfiguration/JarFrameV6Presentation.css';
import './StringFrame.css';

const format = (value, digits = 2) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const finitePositive = value => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
// Drawing width is a linear visual mapping of entered OD (2 SVG units/in), capped only for legibility.
export const schematicWidthForOd = od => finitePositive(od) ? Math.max(8, Math.min(24, Number(od) * 2)) : 11;
const odWidth = row => schematicWidthForOd(row?.od);
// Display-only power law compresses length ratios while keeping shorter tools visible.
export const compressedLengthWeight = length => Math.pow(Math.max(0, Number(length) || 0), 0.45);
export function allocateCompressedComponentHeights(items, totalHeight, minimumHeight = 4) {
  if (!items.length) return [];
  const floor = Math.min(minimumHeight, totalHeight / items.length);
  const weights = items.map(item => compressedLengthWeight(item?.length ?? item?.row?.length));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || items.length;
  const remainder = Math.max(0, totalHeight - floor * items.length);
  return weights.map(weight => floor + remainder * (weight || 1) / weightTotal);
}
const formatDimension = value => finitePositive(value) ? format(Number(value), 2) : '—';
const dimensionRange = values => {
  const formatted = range(values);
  return formatted === '—' ? formatted : `${formatted}in`;
};
const range = values => {
  const valid = [...new Set(values.filter(finitePositive).map(Number))].sort((a, b) => a - b);
  if (!valid.length) return '—';
  return valid.length === 1 ? format(valid[0], 2) : `${format(valid[0], 2)}–${format(valid[valid.length - 1], 2)}`;
};
const stabilizerBladeSegment = row => {
  const definition = row.librarySpecification || row.componentDefinition || {};
  return (row.geometry?.segments || definition.geometry?.segments || [])
    .find(segment => segment.externalGeometry === 'blade-envelope');
};
const stabilizerBladeOd = row => {
  const definition = row.librarySpecification || row.componentDefinition || {};
  return row.stabilizer?.gaugeOd ?? row.stabilizer?.bladeOd ?? row.gaugeOd ?? row.geometry?.stabilizer?.bladeOd ??
    stabilizerBladeSegment(row)?.od ?? definition.stabilizer?.bladeOd ??
    (definition.geometry?.segments || []).find(segment => segment.externalGeometry === 'blade-envelope')?.od ??
    row.maximumOd ?? definition.maximumOd;
};
const weightPerFoot = row => finitePositive(row.weight) ? `${format(Number(row.weight), 1)}#` : null;
const sectionWeightPerFoot = rows => {
  const weights = rows.map(row => finitePositive(row.weight) ? Number(row.weight) : null);
  return weights.length && weights.every(weight => weight !== null && weight === weights[0])
    ? `${format(weights[0], 1)}#` : null;
};
const componentSpec = row => `OD ${formatDimension(row.od)}in · ID ${formatDimension(row.idSize || row.id)}in · ${finitePositive(row.length) ? `${format(Number(row.length), 2)}ft` : 'length unavailable'}${weightPerFoot(row) ? ` · ${weightPerFoot(row)}` : ''}`;

function detailLines(group) {
  return group.items.map(({ row }) => ({
    name: row.toolName || schematicToolType(row),
    detail: componentSpec(row),
    category: schematicToolType(row)
  }));
}

const rowLength = row => finitePositive(row.length) ? Number(row.length) : 0;
const sectionLength = group => group.items.reduce((sum, item) => sum + rowLength(item.row), 0);
const stabilizerSpecification = row => ({
  length: rowLength(row), bodyOd: Number(row.od) || null, id: Number(row.idSize || row.id) || null,
  gaugeOd: Number(stabilizerBladeOd(row)) || null,
  bladeLength: Number(row.stabilizer?.bladeLength ?? row.geometry?.stabilizer?.bladeLength ??
    row.componentDefinition?.stabilizer?.bladeLength ?? stabilizerBladeSegment(row)?.length) || null
});
const stabilizerSpecText = row => {
  const spec = stabilizerSpecification(row);
  return `${format(spec.length)}ft body · OD ${formatDimension(spec.bodyOd)}in · gauge OD ${formatDimension(spec.gaugeOd)}in${spec.bladeLength ? ` · blades ${format(spec.bladeLength)}ft` : ''}`;
};
const sameStabilizerSpecification = rows => rows.length > 0 && rows.every(row => {
  const a = stabilizerSpecification(row), b = stabilizerSpecification(rows[0]);
  return Object.keys(a).every(key => a[key] === b[key]);
});

function lowerStackOrder(group, includesBit) {
  const tokens = group.items.map(({ row }) => {
    const type = schematicToolType(row);
    return type === 'DC' ? `DC ${format(rowLength(row))}ft` : type;
  });
  if (includesBit) tokens.push('bit');
  return tokens.join(' → ');
}

function sectionLabel(group, allGroups = [group]) {
  const rows = group.items.map(item => item.row);
  if (group.label === 'Lower BHA') {
    const stabilizers = rows.filter(row => schematicToolType(row) === 'STB');
    const spec = sameStabilizerSpecification(stabilizers)
      ? `Each STB · ${stabilizerSpecText(stabilizers[0])}`
      : stabilizers.length ? 'STB specifications vary · hover each stabilizer for dimensions' : 'No stabilizers in this interval';
    const includesBit = allGroups.some(candidate => candidate.label === 'Bit' && candidate.items.length > 0);
    return { primary: 'Lower BHA · stack order', secondary: lowerStackOrder(group, includesBit), tertiary: spec };
  }
  const od = dimensionRange(rows.map(row => row.od)), id = dimensionRange(rows.map(row => row.idSize || row.id));
  const length = format(sectionLength(group));
  const description = ({
    DP: `DP · ${od}`, HWDP: `HWDP · ${od}`,
    'Upper DC': `Upper DC · ${od}`, Jar: `Jar · ${rows[0]?.toolName || `${od} jar`}`,
    'Lower DC': `Lower DC · ${od}`, Bit: `Bit · ${od}`,
    'Section unavailable': group.label
  })[group.label] || group.label;
  const weight = ['DP', 'HWDP', 'Upper DC', 'Lower DC', 'Jar'].includes(group.label) ? sectionWeightPerFoot(rows) : null;
  const lengthText = group.label === 'DP' ? `${length}ft loaded` : `${length}ft`;
  const secondary = group.label === 'Jar'
    ? `OD ${od} · ID ${id} · ${lengthText}${weight ? ` · ${weight}` : ''}` : `ID ${id} · ${lengthText}`;
  const primaryWeight = group.label === 'Jar' ? null : weight;
  return { primary: `${description}${primaryWeight ? ` · ${primaryWeight}` : ''}`, secondary };
}

/** Stage 8 style label rows align to variable-height geometry sections. */
export function calculateStringFrameLabelLayout(groups, charsPerLine = 42, lowerConnectionUnverified = false, availableHeight = null) {
  let cursor = 0;
  const prepared = groups.map(group => {
    const details = detailLines(group);
    const copy = sectionLabel(group, groups);
    const lines = [copy.primary, copy.secondary, copy.tertiary].filter(Boolean)
      .reduce((sum, text) => sum + Math.max(1, Math.ceil(text.length / charsPerLine)), 0);
    const height = Math.max(group.label === 'Lower BHA' ? 52 : 38,
      18 + lines * 12 + (group.label === 'Lower DC' && lowerConnectionUnverified ? 22 : 0));
    // DP is a BHA overview cue: the paired break symbol truncates its drawn span,
    // while the secondary label retains the actual loaded DP length.
    const expandsWithWindow = ['HWDP', 'Upper DC', 'Lower DC'].includes(group.label);
    const weight = expandsWithWindow ? compressedLengthWeight(sectionLength(group)) : 0;
    return { group, details, ...copy, height, weight };
  });
  const baseHeight = prepared.reduce((sum, row) => sum + row.height, 0);
  const extraHeight = Math.max(0, (availableHeight ?? baseHeight) - baseHeight);
  const totalWeight = prepared.reduce((sum, row) => sum + row.weight, 0) || prepared.length || 1;
  return prepared.map(preparedRow => {
    const height = preparedRow.height + extraHeight * preparedRow.weight / totalWeight;
    const row = { ...preparedRow, top: cursor, center: cursor + height / 2, bottom: cursor + height, height };
    cursor += height;
    return row;
  });
}

export default function LoadedBhaSchematic({ rows, positions, selectedJarKey, schematicSectionsByJarKey, straight, surveyLoads, drillingMode = 'slide', setDrillingMode, controllingWob, surveyMode = false, extraOverviewHeight = 0, tall = false }) {
  const sourceRows = Array.isArray(rows) ? rows.filter(row => row && (row.category || row.toolName || row.selectedToolId || row.length)) : [];
  const components = positions?.components || [];
  const componentFor = (row, index) => components.find(component => row.rowId && component.rowId === row.rowId) || components[index] || null;
  const { groups, selectedKey, selectedComponentIndex } = buildLoadedBhaSchematicSections({
    rows: sourceRows, components, selectedJarKey, sectionData: schematicSectionsByJarKey?.[selectedJarKey]
  });
  const assemblyItems = groups.flatMap(group => group.items.map(item => ({ ...item, section: group.label })));
  const boundary = schematicSectionsByJarKey?.[selectedJarKey];
  const labelArgs = [groups, tall ? 36 : 27, boundary?.lowerConnectionUnverified];
  const baseLabels = calculateStringFrameLabelLayout(...labelArgs);
  const baseLabelHeight = baseLabels.reduce((sum, row) => sum + row.height, 0);
  // Standard StringFrame uses a compact 420 px BHA overview. Complex labels
  // grow beyond that and remain scrollable in the floating window.
  const labels = tall
    ? calculateStringFrameLabelLayout(...labelArgs, Math.max(baseLabelHeight, 399) + Math.max(0, extraOverviewHeight))
    : baseLabels;
  const labelContentHeight = labels.reduce((sum, row) => sum + row.height, 0);
  const viewHeight = tall ? Math.max(300, labelContentHeight + 21) : 208;
  const inset = tall ? 10 : 7;
  const visualRows = tall ? labels : labels.map(row => ({ ...row, top: 7 + ((row.top) / Math.max(1, labels.at(-1)?.bottom || 1)) * 182,
    center: 7 + (row.center / Math.max(1, labels.at(-1)?.bottom || 1)) * 182,
    bottom: 7 + (row.bottom / Math.max(1, labels.at(-1)?.bottom || 1)) * 182 }));
  const segments = [];
  const itemHeights = new Map();
  const itemTrackHeights = new Map();
  if (tall) {
    // Each geometry section shares its label's variable-height track, then
    // individual tools retain nonlinear relative lengths within that section.
    labels.forEach(label => {
      const items = label.group.items.map(item => assemblyItems.find(candidate => candidate.key === item.key)).filter(Boolean);
      const tracks = allocateCompressedComponentHeights(items, label.height);
      const bitItems = label.group.label === 'Bit';
      const visualTotal = bitItems ? Math.min(label.height, Math.max(12, items.length * 6)) : label.height;
      const heights = bitItems ? allocateCompressedComponentHeights(items, visualTotal, 2) : tracks;
      items.forEach((item, index) => {
        itemTrackHeights.set(item.key, tracks[index]);
        itemHeights.set(item.key, heights[index]);
      });
    });
  } else {
    // Preserve the established compact JarFrame section geometry.
    const sectionShares = { DP: .04, HWDP: .06, 'Upper DC': .25, Jar: .08, 'Lower DC': .40, 'Lower BHA': .13, Bit: .04 };
    const shareTotal = groups.reduce((sum, group) => sum + (sectionShares[group.label] || .05), 0) || 1;
    groups.forEach(group => {
      const items = group.items.map(item => assemblyItems.find(candidate => candidate.key === item.key)).filter(Boolean);
      const budget = 182 * (sectionShares[group.label] || .05) / shareTotal;
      const weights = items.map(item => Math.max(4, schematicComponentHeight(item.row)));
      const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
      items.forEach((item, index) => itemHeights.set(item.key, budget * weights[index] / weightTotal));
    });
  }
  let assemblyCursor = tall ? inset : 7;
  const assemblyBottom = tall ? viewHeight - inset - 1 : 189;
  assemblyItems.forEach(item => {
    const trackHeight = tall ? itemTrackHeights.get(item.key) : itemHeights.get(item.key);
    const drawHeight = itemHeights.get(item.key) || (assemblyBottom - (tall ? inset : 7)) / Math.max(1, assemblyItems.length);
    const actualTrackHeight = trackHeight || drawHeight;
    const y1 = assemblyCursor + (actualTrackHeight - drawHeight) / 2;
    const y2 = y1 + Math.min(actualTrackHeight, drawHeight);
    assemblyCursor += actualTrackHeight;
    const toolType = schematicToolType(item.row), width = tall ? schematicWidthForOd(item.row.od) : odWidth(item.row);
    const bladeOd = Number(stabilizerBladeOd(item.row)), bladeVisualWidth = finitePositive(bladeOd) ? (tall ? schematicWidthForOd(bladeOd) : odWidth({ od: bladeOd })) : width;
    const klass = toolType === 'JAR' && item.key !== selectedKey ? 'jarV6Dc'
      : ({ DP: 'jarV6Pipe', HWDP: 'jarV6Hwdp', DC: 'jarV6Dc', JAR: 'jarV6Jar', STB: 'jarV6Stb', BIT: 'jarV6Bit', PDC: 'jarV6Bit', TCI: 'jarV6Bit', OTHER: 'jarV6Other' })[toolType] || 'jarV6Other';
    segments.push({ ...item, y1, y2,
      width, className: klass, unknownOd: !finitePositive(item.row.od),
      title: `${item.row.toolName || toolType} · ${componentSpec(item.row)}${toolType === 'STB' ? ` · body OD ${formatDimension(item.row.od)}in · gauge OD ${formatDimension(bladeOd)}in` : ''}`,
      bladeWidth: item.section === 'Lower BHA' && toolType === 'STB' && finitePositive(bladeOd)
        ? tall ? bladeVisualWidth : Math.min(30, width + Math.max(0, bladeVisualWidth - width) * .35) : 0 });
  });
  if (segments.length && !tall) segments[segments.length - 1].y2 = assemblyBottom;
  const compactRows = tall ? visualRows : groups.map(group => {
    const groupSegments = segments.filter(segment => segment.section === group.label);
    const first = groupSegments[0], last = groupSegments[groupSegments.length - 1];
    return { group, center: first && last ? (first.y1 + last.y2) / 2 : 7 };
  });
  const selected = sourceRows.map((row, index) => ({ row, key: loadedJarRowKey(row, index), component: componentFor(row, index) }))
    .find(item => item.key === selectedKey && String(item.row.category).toUpperCase() === 'JAR');
  const selectedPosition = selected?.component;
  const selectedSegment = segments.find(segment => segment.key === selectedKey);
  const jarY = selectedSegment ? (selectedSegment.y1 + selectedSegment.y2) / 2 : null;
  const totalLength = Number(positions?.totalLength) || 0;
  const straightComponent = straight?.loadProfile?.valid && selectedComponentIndex >= 0 ? straight.loadProfile.components[selectedComponentIndex] : null;
  const jarOrdinal = sourceRows.map((row, index) => ({ row, index })).filter(item => String(item.row.category).toUpperCase() === 'JAR').findIndex(item => loadedJarRowKey(item.row, item.index) === selectedKey);
  const surveyJar = surveyLoads?.valid && jarOrdinal >= 0 ? surveyLoads.jars?.[jarOrdinal] : null;
  const neutral = result => !result?.valid ? 'Unavailable' : result.neutralPoints?.length === 1 && !result.neutralIntervals?.length
    ? `${format(result.neutralPoints[0].fromBitFt)} ft above bit` : result.neutralIntervals?.length ? 'Neutral interval · no unique point'
      : result.neutralPoints?.length > 1 ? 'Multiple crossings · no unique point' : 'No neutral point within deployed BHA';
  const bitSegment = segments.filter(segment => segment.section === 'Bit').at(-1);
  const neutralPresentation = tall ? buildNeutralPointPresentation({ straight, surveyLoads, drillingMode,
    positions, segments, totalLength, jarCentreFromBitFt: selectedPosition?.centreFromBit,
    compactBitGeometry: true, surveyMode }) : { markers: [], outputs: [] };
  return <aside className={`jarV6Panel jarV6Schematic jarV6LoadedSchematic stringFrameSchematic ${tall ? 'stringFrameTall' : ''}`} aria-label="BHA Schematic loaded assembly">
    <header className="jarV6SchematicHeader"><h2>BHA Schematic · loaded assembly · not to scale</h2><span>{totalLength > 0 ? `${format(totalLength)}ft deployed` : 'Deployment unavailable'}</span></header>
    {tall && <div className="stringFrameModeControl">
      <label htmlFor="string-frame-drilling-mode">Drilling mode</label>
      <select id="string-frame-drilling-mode" aria-label="BHA Schematic drilling mode" value={drillingMode} disabled={!setDrillingMode}
        onChange={event => setDrillingMode?.(event.target.value)}>
        <option value="reference" disabled={surveyMode}>Reference{surveyMode ? ' (unavailable for survey)' : ''}</option>
        <option value="slide">Slide</option><option value="rotate">Rotate</option>
      </select>
      <span className="stringFrameControllingWob" aria-label="Controlling WOB">Controlling WOB · {controllingWob !== undefined && controllingWob !== null && String(controllingWob).trim() !== '' && Number.isFinite(Number(controllingWob)) ? `${format(Number(controllingWob))} klbf` : 'Unavailable'}</span>
      {surveyMode && <span className="stringFrameModeNote" role="status">Survey neutral points require covered Slide or Rotate results.</span>}
    </div>}
    {!positions?.components?.length && <div className="stringFrameUnavailable" role="status">Live BHA geometry unavailable. {positions?.errors?.join(' ') || 'Check deployment inputs.'}</div>}
    <div className={`jarV6SchematicGrid ${tall ? 'stringFrameGrid' : ''}`} style={tall ? { '--string-frame-height': `${viewHeight}px` } : undefined}>
      <div className="stringFrameSvgScroll">
        <V6ContinuousAssemblyDrawing viewWidth={tall ? 166 : 61} viewHeight={viewHeight} yTop={inset} yBottom={viewHeight - inset - 1}
          segments={segments.map((segment, index) => ({ key: segment.key, y1: segment.y1, y2: segment.y2, width: segment.width,
            componentIndex: segment.componentIndex,
            className: segment.className, section: segment.section, category: segment.row.category, unknownOd: segment.unknownOd,
            selected: segment.key === selectedKey, testId: `loaded-component-${index}`, bladeWidth: segment.bladeWidth,
            title: segment.title }))}
          discontinuities={tall && segments.some(segment => segment.section === 'DP') ? [{
            key: 'loaded-dp-break',
            y: (segments.find(segment => segment.section === 'DP').y1 + [...segments].reverse().find(segment => segment.section === 'DP').y2) / 2,
            width: Math.max(...segments.filter(segment => segment.section === 'DP').map(segment => segment.width))
          }] : []}
          sectionGuides={tall ? [] : compactRows.map((row, index) => ({ key: index, y: row.center }))} slimStabilizerBlades
          markers={[...(jarY == null ? [] : [{ key: selectedKey, x: 31, y: jarY, guide: 20, guideClass: 'jarV6CandidateGuide', radius: 3.8, className: 'jarV6CandidateMarker', testId: 'loaded-selected-jar-marker' }]), ...neutralPresentation.markers]}
          showBitTip={assemblyItems.some(item => item.section === 'Bit')}
          bitTipY={bitSegment?.y2} bitTipWidth={tall ? bitSegment?.width : undefined} compactBitGeometry={tall}
          ariaLabel={`Complete loaded BHA assembly${selected ? `; selected jar ${selected.row.toolName || selected.row.category} highlighted` : '; no jar row available'}`} testId="loaded-bha-assembly" />
      </div>
      <div className="jarV6ComponentLabels jarV6LoadedLabels stringFrameLabels" aria-label="BHA Schematic component labels">
        {labels.map(({ group, details, height, primary, secondary, tertiary }, index) => {
          const connectionNote = group.label === 'Lower DC' && boundary?.lowerConnectionUnverified;
          const detailText = details.map(detail => `${detail.name} · ${detail.detail}`).join('; ');
          const lowerTypes = [...details.reduce((counts, detail) => counts.set(detail.category, (counts.get(detail.category) || 0) + 1), new Map())]
            .map(([type, count]) => `${type}${count > 1 ? ` ×${count}` : ''}`).join(', ');
          const lowerLength = group.items.reduce((sum, item) => sum + (finitePositive(item.row.length) ? Number(item.row.length) : 0), 0);
          const fullBoundaryWarning = 'Lower DC follows matching entered OD/ID; the fixed Lower BHA transition cannot be confirmed from connection data.';
          const boundaryQualification = 'Lower DC / fixed Lower BHA boundary inferred from entered geometry; connection verification unavailable.';
          return <div key={`${group.label}-${index}`} className={`stringFrameLabelRow ${group.label === 'Lower BHA' ? 'stringFrameLowerBha' : ''}`}
            data-section={group.label} title={`${group.label} · ${detailText}${connectionNote ? ` · ${fullBoundaryWarning}` : ''}`} style={tall
              ? { position: 'static', top: 'auto', height: `${height}px`, boxSizing: 'border-box' }
              : { top: `${compactRows[index].center / viewHeight * 100}%` }}>
            {tall ? <><b>{primary}</b><span>{secondary}</span>{tertiary && <span>{tertiary}</span>}</>
              : <><b>{group.label}</b>{group.label === 'Lower BHA'
                ? <span>{details.length} tools · {lowerTypes} · {format(lowerLength)}ft</span>
                : <span>{details.map(detail => detail.detail).join(' · ')}</span>}</>}
            {connectionNote && <small className="stringFrameBoundaryNote" title={fullBoundaryWarning}>{boundaryQualification}</small>}
          </div>;
        })}
        {!groups.length && <div className="stringFrameEmptyLabel"><b>No BHA components</b><span>Load rows to view the assembly.</span></div>}
      </div>
    </div>
    {tall && <section className="stringFrameNeutralStatus" aria-label="Neutral point status">
      {neutralPresentation.outputs.map(output => <p key={output.kind} data-testid={`neutral-point-status-${output.kind}`}>
        <b>{output.label}:</b> {output.point
          ? `${output.jarDistanceLabel || 'NP — jar-relative distance unavailable'} · Neutral point ${output.approximate ? 'approximately within DP section · ' : ''}${format(output.point.fromBitFt)} ft above bit${Number.isFinite(output.point.mdFt) ? ` · MD ${format(output.point.mdFt)} ft` : ''}${output.jarDistanceReason ? ` · ${output.jarDistanceReason}` : ''}${output.reason ? ` · ${output.reason}` : ''}.`
          : output.reason}
      </p>)}
    </section>}
    <details className="stringFrameStaticDetails"><summary>Static calculations and boundary details</summary>
    <div className="jarV6LiveStatic stringFrameStatic" aria-label="Loaded BHA geometry and static results">
      <div className="jarV6CandidateLabel">{selected ? `Selected jar · ${selected.row.toolName || selected.row.category}` : 'No jar selected'}</div>
      {boundary?.lowerBoundaryUnresolved ? <div className="jarV6BoundaryUnavailable" role="note">Lower DC / fixed Lower BHA boundary unavailable: {boundary.lowerBoundaryReason}</div>
        : boundary?.lowerConnectionUnverified && <div className="jarV6BoundaryUnavailable" role="note">Lower DC follows matching entered OD/ID; the fixed Lower BHA transition cannot be confirmed from connection data.</div>}
      {selectedPosition && <div>Centre {format(selectedPosition.centreFromBit)} ft · bottom {format(selectedPosition.startFromBit)} ft · top {format(selectedPosition.endFromBit)} ft above bit; {format(totalLength - selectedPosition.endFromBit)} ft above / {format(selectedPosition.startFromBit)} ft below.</div>}
      {straight?.loadProfile?.valid ? <div><b>Straight-hole · {straight.drillingMode}:</b> {straightComponent ? `jar bottom/top ${format(straightComponent.bottomAxialForce, 0)} / ${format(straightComponent.topAxialForce, 0)} lbf` : 'jar load unavailable'}; NP {Number.isFinite(straight.neutralPointFt) ? `${format(straight.neutralPointFt)} ft above bit` : 'not found'}.</div>
        : <div><b>Straight-hole · {drillingMode}:</b> unavailable · {straight?.loadProfile?.error || straight?.errors?.join(' ') || 'valid deployed-BHA inputs required'}.</div>}
      {surveyLoads?.valid ? <div><b>Survey · {surveyLoads.mode}:</b> {surveyJar ? `${format(surveyJar.axialForceLbf, 0)} lbf (+ compression)` : 'selected-jar load unavailable'}; NP {neutral(surveyLoads)}.</div>
        : <div><b>Survey · {drillingMode}:</b> unavailable · {surveyLoads?.errors?.join(' ') || 'valid covered survey inputs required'}.</div>}
      <div className="jarV6StaticProvenance">Straight-hole calcStraightDrag is constant-inclination screening; survey calcSurveyAxialLoads is preliminary soft-string screening without buckling or contact redistribution. Positive force is compression; negative force is tension. Dynamic results remain unavailable.</div>
    </div></details>
    <details className="jarV6DetailedSchematic"><summary>Optional detailed tool illustration</summary>
      <EngineeringStringSchematic components={rows} neutralPointFt={null} jars={[]} dcSections={{}} showNotToScaleLabel={false} />
    </details>
  </aside>;
}
