import React, { useEffect, useState } from 'react';
import EngineeringStringSchematic, { schematicComponentHeight, schematicToolType } from '../EngineeringString/EngineeringStringSchematic';
import STAGE8_FIXTURE from './Stage8OesResearchFixture.v1.json';
import { buildLoadedBhaSchematicSections, loadedJarRowKey, validateLoadedBhaWob } from './loadedBhaPresentation';
import '../EngineeringString/EngineeringStringCard.css';
import './JarFrameV6Presentation.css';

const plot = { width: 320, height: 175, left: 37, right: 5, top: 7, bottom: 34 };
const xTicks = [150, 300, 450, 600, 750];
const fixtureSamples = Object.freeze(STAGE8_FIXTURE.samples.map(sample => Object.freeze({ ...sample })));
const fixtureIntegrityValid = STAGE8_FIXTURE.version === 'stage8-oes-research-v1' &&
  STAGE8_FIXTURE.stage === 8 && fixtureSamples.length === 16 &&
  fixtureSamples.every((sample, index) => Number.isFinite(sample.positionFt) &&
    Number.isFinite(sample.peakTensileImpactForceKN) && Number.isFinite(sample.tensileImpulse50msKNs) &&
    Number.isFinite(sample.impactVelocityMS) && (index === 0 || sample.positionFt > fixtureSamples[index - 1].positionFt));
const fixtureReferenceFt = 641.83;
const format = (value, digits = 2) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function UnavailableChart({ title, unit, ticks, className = '' }) {
  const { width, height, left, right, top, bottom } = plot;
  const yEnd = height - bottom, xEnd = width - right;
  const x = value => left + (value - 100) * (xEnd - left) / 650;
  const y = value => top + (Math.max(...ticks) - value) * (yEnd - top) / (Math.max(...ticks) - Math.min(...ticks));
  return <article className={`jarV6Panel jarV6Chart ${className}`} aria-label={title}>
    <header className="jarV6ChartHeader"><div className="jarV6ChartTitle">{title}<small>{unit} · unavailable for Loaded BHA</small></div>
      <div className="jarV6ChartValue" aria-label={`${title}: unavailable`}>—<small>no loaded-BHA result</small></div>
    </header>
    <svg className="jarV6ChartSvg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
      aria-label={`${title} versus jar centre above bit in feet; unavailable for Loaded BHA`}>
      {ticks.map(value => <g key={value}>
        <line x1={left} y1={y(value)} x2={xEnd} y2={y(value)} className="jarV6Grid" />
        <text x={left - 4} y={y(value) + 3.5} textAnchor="end" className="jarV6Tick">{value}</text>
      </g>)}
      <line x1={left} y1={top} x2={left} y2={yEnd} className="jarV6Axis" />
      <line x1={left} y1={yEnd} x2={xEnd} y2={yEnd} className="jarV6Axis" />
      {xTicks.map(value => <g key={value}>
        <line x1={x(value)} y1={yEnd} x2={x(value)} y2={yEnd + 3} className="jarV6Axis" />
        <text x={x(value)} y={yEnd + 14} textAnchor={value === 750 ? 'end' : 'middle'} className="jarV6Tick">{value}</text>
      </g>)}
      <text x={left + (xEnd - left) / 2} y={height - 2} textAnchor="middle" className="jarV6AxisLabel">Jar centre above bit (ft)</text>
      <text x={left + (xEnd - left) / 2} y={(top + yEnd) / 2} textAnchor="middle" className="jarV6NoData">Dynamic result unavailable</text>
    </svg>
    <div className="jarV6PlotNote">No loaded-BHA dynamic prediction is displayed.</div>
  </article>;
}

function ResearchChart({ title, unit, field, ticks, domainMax, selectedIndex, onSelect, className = '', digits = 2 }) {
  const { width, height, left, right, top, bottom } = plot;
  const yEnd = height - bottom, xEnd = width - right;
  const minX = 100, maxX = 750, minY = Math.min(...ticks), maxY = domainMax ?? Math.max(...ticks);
  const x = value => left + (value - minX) * (xEnd - left) / (maxX - minX);
  const y = value => top + (maxY - value) * (yEnd - top) / (maxY - minY);
  const sample = fixtureSamples[selectedIndex];
  const series = fixtureSamples.map((point, index) => `${index ? 'L' : 'M'}${x(point.positionFt)},${y(point[field])}`).join(' ');
  const chooseNearest = event => {
    const point = event.currentTarget.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(event.currentTarget.getScreenCTM().inverse());
    if (local.x < left || local.x > xEnd) return;
    const clickedFt = minX + (local.x - left) * (maxX - minX) / (xEnd - left);
    let nearest = 0;
    for (let index = 1; index < fixtureSamples.length; index += 1) {
      if (Math.abs(fixtureSamples[index].positionFt - clickedFt) < Math.abs(fixtureSamples[nearest].positionFt - clickedFt)) nearest = index;
    }
    onSelect(nearest);
  };
  const selectMarker = (event, index) => { event.stopPropagation(); onSelect(index); };
  const markerKeyDown = (event, index) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(index); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); onSelect(Math.max(0, index - 1)); }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); onSelect(Math.min(fixtureSamples.length - 1, index + 1)); }
  };
  return <article className={`jarV6Panel jarV6Chart ${className}`} aria-label={title}>
    <header className="jarV6ChartHeader"><div className="jarV6ChartTitle">{title}<small>{unit} · 16 discrete Stage 8 samples</small></div>
      <div className="jarV6ChartValue" aria-label={`${title}: ${format(sample[field], digits)} ${unit}`} data-testid={`${field}-readout`}>
        {format(sample[field], digits)}<small>at {format(sample.positionFt)} ft</small>
      </div>
    </header>
    <svg className="jarV6ChartSvg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
      aria-label={`${title} versus hypothetical jar centre above bit in feet; 16 frozen Stage 8 samples`}
      data-testid={`${field}-chart`} data-selected-index={selectedIndex} onClick={chooseNearest}>
      {ticks.map(value => <g key={value}>
        <line x1={left} y1={y(value)} x2={xEnd} y2={y(value)} className="jarV6Grid" />
        <text x={left - 4} y={y(value) + 3.5} textAnchor="end" className="jarV6Tick">{value}</text>
      </g>)}
      <line x1={left} y1={top} x2={left} y2={yEnd} className="jarV6Axis" />
      <line x1={left} y1={yEnd} x2={xEnd} y2={yEnd} className="jarV6Axis" />
      {xTicks.map(value => <g key={value}>
        <line x1={x(value)} y1={yEnd} x2={x(value)} y2={yEnd + 3} className="jarV6Axis" />
        <text x={x(value)} y={yEnd + 14} textAnchor={value === 750 ? 'end' : 'middle'} className="jarV6Tick">{value}</text>
      </g>)}
      <text x={left + (xEnd - left) / 2} y={height - 2} textAnchor="middle" className="jarV6AxisLabel">Jar centre above bit (ft)</text>
      <path d={series} className="jarV6Series" aria-hidden="true" />
      {fixtureSamples.map((point, index) => <circle key={point.positionFt} cx={x(point.positionFt)} cy={y(point[field])} r="4"
        className="jarV6SampleMarker" role="button" tabIndex="0"
        aria-label={`${format(point.positionFt)} ft; ${format(point[field], digits)} ${unit}`}
        aria-pressed={selectedIndex === index}
        data-sample-index={index} onClick={event => selectMarker(event, index)} onKeyDown={event => markerKeyDown(event, index)} />)}
      <line x1={x(sample.positionFt)} y1={top} x2={x(sample.positionFt)} y2={yEnd} className="jarV6SelectedGuide" aria-hidden="true" />
      <circle cx={x(sample.positionFt)} cy={y(sample[field])} r="6" className="jarV6SelectedPoint" aria-hidden="true" />
    </svg>
    <div className="jarV6PlotNote">Guide line joins samples; it is not an interpolated calculation.</div>
  </article>;
}

function V6ContinuousAssemblyDrawing({ segments, markers = [], sectionGuides = [], slimStabilizerBlades = false, showHeadFittings = false, showBitTip = false, ariaLabel, testId }) {
  const rail = 31, yTop = 7, yBottom = 189;
  return <svg className="jarV6SchematicSvg" viewBox="0 0 61 208" preserveAspectRatio="xMidYMid meet"
    role="img" aria-label={ariaLabel} data-testid={testId}>
    <line x1={rail} y1={yTop} x2={rail} y2={yBottom} className="jarV6Rail" />
    {showHeadFittings && <>
      <rect x={rail - 6} y="2" width="12" height="7" rx="2" className="jarV6SchematicShape jarV6Pipe" />
      <rect x={rail - 8} y="10" width="16" height="9" rx="2" className="jarV6SchematicShape jarV6Hwdp" />
    </>}
    {segments.map(segment => <g key={segment.key} data-testid={segment.testId} data-row-key={segment.key} data-selected={segment.selected ? 'true' : undefined}
      data-blade-envelope-width={segment.bladeWidth || undefined}
      data-section={segment.section} data-component-category={segment.category}>
      <rect x={rail - segment.width / 2} y={segment.y1} width={segment.width} height={Math.max(1.5, segment.y2 - segment.y1)}
        className={`jarV6SchematicShape ${segment.className}${segment.unknownOd ? ' jarV6UnknownOd' : ''}${segment.selected ? ' jarV6SelectedLoadedJar' : ''}`} />
      {segment.bladeWidth > segment.width && (slimStabilizerBlades ? [-1, 1].map(side => {
        const tubeEdge = rail + side * (segment.width / 2 - .35);
        const bladeEdge = rail + side * segment.bladeWidth / 2;
        const endInset = Math.min(1.5, (segment.y2 - segment.y1) * .2);
        return <path key={side} d={`M${tubeEdge} ${segment.y1 + endInset} L${bladeEdge} ${segment.y1 + endInset + .7} L${bladeEdge} ${segment.y2 - endInset - .7} L${tubeEdge} ${segment.y2 - endInset} Z`} className="jarV6Blade" />;
      }) : <rect x={rail - segment.bladeWidth / 2} y={segment.y1 + 1} width={segment.bladeWidth}
        height={Math.max(1, segment.y2 - segment.y1 - 2)} className="jarV6Blade" />)}
    </g>)}
    {sectionGuides.map(guide => <line key={guide.key} x1="43" y1={guide.y} x2="61" y2={guide.y} className="jarV6SectionGuide" aria-hidden="true" />)}
    {markers.map(marker => <g key={marker.key}>
      {marker.guide && <line x1={marker.x - marker.guide / 2} y1={marker.y} x2={marker.x + marker.guide / 2} y2={marker.y} className={marker.guideClass} />}
      <circle cx={marker.x} cy={marker.y} r={marker.radius} className={marker.className} data-testid={marker.testId} />
    </g>)}
    {showBitTip && <path d={`M${rail - 9} ${yBottom - 1}l9 8 9-8z`} className="jarV6BitTip" />}
  </svg>;
}

const finitePositive = value => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
const odWidth = row => finitePositive(row?.od) ? Math.max(8, Math.min(22, Number(row.od) * 2)) : 11;
const formatDimension = value => finitePositive(value) ? format(Number(value), 2) : '—';
const range = values => {
  const valid = [...new Set(values.filter(finitePositive).map(value => Number(value)))].sort((a, b) => a - b);
  if (!valid.length) return '—';
  return valid.length === 1 ? format(valid[0], 2) : `${format(valid[0], 2)}–${format(valid[valid.length - 1], 2)}`;
};
const stabilizerBladeOd = row => {
  const definition = row.librarySpecification || row.componentDefinition || {};
  const bladeSection = definition.geometry?.segments?.find(segment => segment.externalGeometry === 'blade-envelope');
  return row.stabilizer?.bladeOd ?? row.maximumOd ?? definition.maximumOd ?? definition.stabilizer?.bladeOd ?? bladeSection?.od;
};

function loadedGroupDetails(group) {
  const rows = group.items.map(item => item.row);
  const totalLength = rows.reduce((sum, row) => sum + (finitePositive(row.length) ? Number(row.length) : 0), 0);
  if (rows.length === 1) {
    const row = rows[0];
    return `OD ${formatDimension(row.od)} · ID ${formatDimension(row.idSize || row.id)} in · ${finitePositive(row.length) ? `${format(Number(row.length), 2)} ft` : 'length unavailable'}`;
  }
  const countByType = {};
  rows.forEach(row => { const type = schematicToolType(row); countByType[type] = (countByType[type] || 0) + 1; });
  const types = Object.entries(countByType).map(([type, count]) => `${type}${count > 1 ? ` ×${count}` : ''}`).join(', ');
  return `${rows.length} tools · ${types} · OD ${range(rows.map(row => row.od))} in · ID ${range(rows.map(row => row.idSize || row.id))} in · ${totalLength > 0 ? `${format(totalLength, 2)} ft` : 'length unavailable'}`;
}

function LoadedBhaSchematic({ rows, positions, selectedJarKey, schematicSectionsByJarKey, straight, surveyLoads, drillingMode }) {
  const sourceRows = Array.isArray(rows) ? rows.filter(row => row && (row.category || row.toolName || row.selectedToolId || row.length)) : [];
  const components = positions?.components || [];
  const componentFor = (row, index) => components.find(component => row.rowId && component.rowId === row.rowId) || components[index] || null;
  const { groups: schematicGroups, selectedKey, selectedComponentIndex } = buildLoadedBhaSchematicSections({
    rows: sourceRows, components, selectedJarKey, sectionData: schematicSectionsByJarKey?.[selectedJarKey]
  });
  const laidOut = sourceRows.map((row, index) => ({ row, index, key: loadedJarRowKey(row, index), component: componentFor(row, index) })).reverse();
  const jars = sourceRows.map((row, index) => ({ row, index, key: loadedJarRowKey(row, index), component: componentFor(row, index) }))
    .filter(item => String(item.row.category).toUpperCase() === 'JAR');
  const selected = jars.find(item => item.key === selectedKey) || null;
  const selectedJar = selected?.row || null;
  const selectedPosition = selected?.component;
  const totalLength = Number(positions?.totalLength) || 0;
  // Compress each source component into a continuous visual interval. These
  // coordinates are illustrative only; numeric geometry stays provider-owned.
  const assemblyItems = schematicGroups.flatMap(group => group.items.map(item => ({ ...item, section: group.label })));
  const availableHeight = 182;
  // Use explicit visual bands: long collar sections receive most of the
  // drawing height, while the protected directional assembly stays clustered
  // near the bit. This is schematic-only compression, never a length scale.
  const sectionVisualShares = { DP: 0.04, HWDP: 0.06, 'Upper DC': 0.25, Jar: 0.08, 'Lower DC': 0.40, 'Lower BHA': 0.13, Bit: 0.04 };
  const sectionShareTotal = schematicGroups.reduce((sum, group) => sum + (sectionVisualShares[group.label] || 0.05), 0);
  const segmentHeights = new Map();
  schematicGroups.forEach(group => {
    const groupItems = group.items.map(item => assemblyItems.find(candidate => candidate.key === item.key)).filter(Boolean);
    if (!groupItems.length) return;
    const budget = availableHeight * (sectionVisualShares[group.label] || 0.05) / sectionShareTotal;
    const weights = groupItems.map(item => Math.max(4, schematicComponentHeight(item.row)));
    const minimumHeight = Math.min(1.5, budget / groupItems.length);
    const remainingHeight = Math.max(0, budget - minimumHeight * groupItems.length);
    const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
    groupItems.forEach((item, index) => {
      segmentHeights.set(item.key, minimumHeight + remainingHeight * weights[index] / weightTotal);
    });
  });
  let cursorY = 7;
  const segments = assemblyItems.map((item, index) => {
    const y1 = cursorY;
    const segmentHeight = segmentHeights.get(item.key) || availableHeight / Math.max(assemblyItems.length, 1);
    cursorY = index === assemblyItems.length - 1 ? 189 : cursorY + segmentHeight;
    const toolType = schematicToolType(item.row);
    const className = toolType === 'JAR' && item.key !== selectedKey ? 'jarV6Dc'
      : ({ DP: 'jarV6Pipe', HWDP: 'jarV6Hwdp', DC: 'jarV6Dc', JAR: 'jarV6Jar', STB: 'jarV6Stb', BIT: 'jarV6Bit', PDC: 'jarV6Bit', TCI: 'jarV6Bit', OTHER: 'jarV6Other' })[toolType] || 'jarV6Other';
    const width = odWidth(item.row);
    const bladeOd = Number(stabilizerBladeOd(item.row));
    const bodyOd = Number(item.row.od);
    const bladeOdVisualWidth = finitePositive(bladeOd) ? odWidth({ od: bladeOd }) : width;
    return { ...item, y1, y2: cursorY, width, className,
      unknownOd: !finitePositive(item.row.od),
      bladeWidth: item.section === 'Lower BHA' && toolType === 'STB' && finitePositive(bladeOd) && finitePositive(bodyOd)
        ? Math.min(30, width + Math.max(0, bladeOdVisualWidth - width) * 0.35) : 0 };
  });
  const sectionLayouts = schematicGroups.map(group => {
    const groupSegments = group.items.map(item => segments.find(segment => segment.key === item.key)).filter(Boolean);
    const first = groupSegments[0];
    const last = groupSegments[groupSegments.length - 1];
    return { group, y: first && last ? (first.y1 + last.y2) / 2 : 7 };
  });
  const selectedSegment = segments.find(segment => segment.key === selectedKey);
  const jarY = selectedSegment ? (selectedSegment.y1 + selectedSegment.y2) / 2 : null;
  const straightComponent = straight?.loadProfile?.valid && selectedComponentIndex >= 0
    ? straight.loadProfile.components[selectedComponentIndex] : null;
  const jarOrdinal = selected ? jars.indexOf(selected) : -1;
  const surveyJar = surveyLoads?.valid && jarOrdinal >= 0 ? surveyLoads.jars?.[jarOrdinal] : null;
  const formatNeutral = result => !result?.valid ? 'Unavailable'
    : result.neutralPoints?.length === 1 && !result.neutralIntervals?.length ? `${format(result.neutralPoints[0].fromBitFt)} ft above bit`
      : result.neutralIntervals?.length ? 'Neutral interval · no unique point'
        : result.neutralPoints?.length > 1 ? 'Multiple crossings · no unique point' : 'No neutral point within deployed BHA';
  return <aside className="jarV6Panel jarV6Schematic jarV6LoadedSchematic" aria-label="Loaded BHA schematic">
    <header className="jarV6SchematicHeader"><h2>Loaded BHA · Schematic · not to scale</h2><span>{totalLength > 0 ? `${format(totalLength)} ft deployed` : 'Deployment unavailable'}</span></header>
    <div className="jarV6SchematicGrid">
      <V6ContinuousAssemblyDrawing segments={segments.map((segment, index) => ({
        key: segment.key, y1: segment.y1, y2: segment.y2, width: segment.width, className: segment.className,
        section: segment.section, category: segment.row.category,
        unknownOd: segment.unknownOd, selected: segment.key === selectedKey, testId: `loaded-component-${index}`,
        bladeWidth: segment.bladeWidth
      }))} sectionGuides={sectionLayouts.map((layout, index) => ({ key: index, y: layout.y }))} slimStabilizerBlades
      markers={jarY == null ? [] : [{ key: selectedKey, x: 31, y: jarY, guide: 20, guideClass: 'jarV6CandidateGuide', radius: 3.8, className: 'jarV6CandidateMarker', testId: 'loaded-selected-jar-marker' }]}
      showBitTip={assemblyItems.some(item => item.section === 'Bit')}
      ariaLabel={`Complete loaded BHA assembly${selectedJar ? `; selected jar ${selectedJar.toolName || selectedJar.category} highlighted` : '; no jar row available'}`} testId="loaded-bha-assembly" />
      <div className="jarV6ComponentLabels jarV6LoadedLabels" aria-label="Loaded BHA component labels">
        {sectionLayouts.map(({ group, y }) => {
          const details = loadedGroupDetails(group);
          const connectionNote = group.label === 'Lower DC' && schematicSectionsByJarKey?.[selectedJarKey]?.lowerConnectionUnverified
            ? ' Lower DC section follows matching entered OD/ID; mating connection compatibility is unverified.' : '';
          return <div key={group.items[0].key} data-section={group.label} style={{ top: `${y / 208 * 100}%` }} title={`${group.label} · ${details}.${connectionNote}`} aria-label={`${group.label} · ${details}${connectionNote}`}>
            <b>{group.label}</b><span>{details}</span></div>;
        })}
        {!laidOut.length && <div><b>No BHA components</b>Load rows to view the assembly.</div>}
      </div>
    </div>
      <div className="jarV6LiveStatic" aria-label="Loaded BHA geometry and static results">
      <div className="jarV6CandidateLabel">{selectedJar ? `Selected jar · ${selectedJar.toolName || selectedJar.category}` : 'No jar selected'}</div>
      {schematicSectionsByJarKey?.[selectedJarKey]?.lowerBoundaryUnresolved
        ? <div className="jarV6BoundaryUnavailable" role="note">Lower DC / fixed Lower BHA boundary unavailable: {schematicSectionsByJarKey[selectedJarKey].lowerBoundaryReason}</div>
        : schematicSectionsByJarKey?.[selectedJarKey]?.lowerConnectionUnverified && <div className="jarV6BoundaryUnavailable" role="note">Lower DC uses matching entered OD/ID; one or more mating connections are unverified, so the fixed Lower BHA transition cannot be confirmed from connection data.</div>}
      {selectedPosition && <div>Centre {format(selectedPosition.centreFromBit)} ft · bottom {format(selectedPosition.startFromBit)} ft · top {format(selectedPosition.endFromBit)} ft above bit; {format(totalLength - selectedPosition.endFromBit)} ft above / {format(selectedPosition.startFromBit)} ft below.</div>}
      {straight?.loadProfile?.valid ? <div><b>Straight-hole · {straight.drillingMode}:</b> {straightComponent ? `jar bottom/top ${format(straightComponent.bottomAxialForce, 0)} / ${format(straightComponent.topAxialForce, 0)} lbf` : 'jar load unavailable'}; NP {Number.isFinite(straight.neutralPointFt) ? `${format(straight.neutralPointFt)} ft above bit` : 'not found'}.</div>
        : <div><b>Straight-hole · {drillingMode}:</b> unavailable · {straight?.loadProfile?.error || straight?.errors?.join(' ') || 'valid deployed-BHA inputs required'}.</div>}
      {surveyLoads?.valid ? <div><b>Survey · {surveyLoads.mode}:</b> {surveyJar ? `${format(surveyJar.axialForceLbf, 0)} lbf (+ compression)` : 'selected-jar load unavailable'}; NP {formatNeutral(surveyLoads)}.</div>
        : <div><b>Survey · {drillingMode}:</b> unavailable · {surveyLoads?.errors?.join(' ') || 'valid covered survey inputs required'}.</div>}
      <div className="jarV6StaticProvenance">Straight-hole calcStraightDrag is constant-inclination screening; survey calcSurveyAxialLoads is preliminary soft-string screening without buckling or contact redistribution. Positive force is compression; negative force is tension. Dynamic results remain unavailable.</div>
    </div>
    <details className="jarV6DetailedSchematic"><summary>Optional detailed tool illustration</summary>
      <EngineeringStringSchematic components={rows} neutralPointFt={null} jars={[]} dcSections={{}} showNotToScaleLabel={false} />
    </details>
  </aside>;
}
function ResearchFixtureSchematic({ selectedPositionFt }) {
  const rail = 31, yTop = 7, yBottom = 189, topMd = 748.29;
  const scale = (yBottom - yTop) / topMd, y = feet => yBottom - feet * scale;
  const jarTop = selectedPositionFt + 16.5, jarBottom = selectedPositionFt - 16.5;
  const fixedTop = y(115.56), step = (yBottom - fixedTop) / 6;
  const lowerStack = ['stb', 'dc', 'stb', 'dc', 'stb', 'bit'];
  const widths = [17, 11, 17, 11, 17, 18];
  const segments = [
    { key: 'upper-dc', y1: yTop, y2: y(jarTop), width: 13, className: 'jarV6Dc' },
    { key: 'hypothetical-jar', y1: y(jarTop), y2: y(jarBottom), width: 20, className: 'jarV6Jar' },
    { key: 'lower-dc', y1: y(jarBottom), y2: fixedTop, width: 13, className: 'jarV6Dc' },
    ...lowerStack.map((type, index) => ({
      key: `stack-${index}`, y1: fixedTop + index * step, y2: index === 5 ? yBottom : fixedTop + (index + 1) * step,
      width: widths[index], className: `jarV6${type[0].toUpperCase()}${type.slice(1)}`, bladeWidth: type === 'stb' ? 26 : 0
    }))
  ];
  const fixtureY = y(fixtureReferenceFt), candidateY = y(selectedPositionFt);
  const coincident = Math.abs(selectedPositionFt - fixtureReferenceFt) < 0.005;
  const fixtureX = coincident ? rail - 5 : rail, candidateX = coincident ? rail + 5 : rail;
  return <aside className="jarV6Panel jarV6Schematic" aria-label="Stage 8 OES research fixture BHA schematic">
    <header className="jarV6SchematicHeader"><h2>OES BHA · schematic</h2><span>Stage 8 fixture · not to scale</span></header>
    <div className="jarV6SchematicGrid">
      <V6ContinuousAssemblyDrawing segments={segments} showHeadFittings showBitTip ariaLabel={`Stage 8 OES fixture; selected hypothetical jar centre ${format(selectedPositionFt)} feet; fixed fixture reference jar centre 641.83 feet`} testId="stage8-fixture-assembly"
        markers={[
          { key: 'fixture-reference', x: fixtureX, y: fixtureY, guide: 20, guideClass: 'jarV6FixtureGuide', radius: 3.5, className: 'jarV6FixtureMarker', testId: 'fixture-reference-marker' },
          { key: 'hypothetical-position', x: candidateX, y: candidateY, guide: 20, guideClass: 'jarV6CandidateGuide', radius: 3.8, className: 'jarV6CandidateMarker', testId: 'hypothetical-position-marker' }
        ]} />
      <div className="jarV6ComponentLabels" aria-label="Stage 8 fixture component geometry">
        <div><b>5 in drillpipe · OD 5.000</b>ID 4.276 in · continues uphole</div>
        <div><b>5 in HWDP</b>OD 5.000 · ID 3.000 in · 274.67 ft</div>
        <div><b>Upper 6.5 in drill collar</b>OD 6.500 · ID 2.813 in · 89.96 ft</div>
        <div><b>Jar · 6.5 in · 33 ft</b>Hypothetical position · highlighted</div>
        <div><b>Lower 6.5 in drill collar</b>OD 6.500 · ID 2.813 in · 509.77 ft</div>
        <div><b>Lower stack order</b>STB → DC 89.96 ft → STB → DC 9.84 ft → STB → bit</div>
        <div><b>Each STB</b>4.92 ft body · 6.525 in OD · 8.5 in blade envelope · 2.5 ft blades</div>
      </div>
    </div>
    <div className="jarV6SchematicStatus"><span className="jarV6CandidateLabel">Hypothetical jar centre {format(selectedPositionFt)} ft</span><span className="jarV6NpState">NP unavailable</span></div>
    <div className="jarV6Legend"><span><i className="jarV6LegendFixture" />641.83 ft · fixture reference</span><span><i className="jarV6LegendCandidate" />Selected hypothetical position</span></div>
  </aside>;
}

function EmptyResearchState() {
  return <div className="jarV6ResearchEmpty" role="status">No research data displayed. Select the Stage 8 OES Research Demo mode to opt in to the frozen fixture.</div>;
}

export default function JarFrameV6Presentation({ bha, loadedData, mode: controlledMode, onModeChange }) {
  const [showVelocity, setShowVelocity] = useState(false);
  const [localMode, setLocalMode] = useState('loaded');
  const mode = controlledMode || localMode;
  const setMode = onModeChange || setLocalMode;
  const [selectedLoadedJarKey, setSelectedLoadedJarKey] = useState(null);
  useEffect(() => setSelectedLoadedJarKey(null), [bha?.id, bha?.selectedJarId]);
  const initialSample = fixtureSamples.findIndex(sample => Math.abs(sample.positionFt - fixtureReferenceFt) < 0.005);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialSample));
  const selected = fixtureSamples[selectedIndex];
  const loadedRows = Array.isArray(loadedData?.geometryBha?.rows) ? loadedData.geometryBha.rows : (Array.isArray(bha?.rows) ? bha.rows : []);
  const loadedJarOptions = loadedRows.map((row, index) => ({ row, index, key: loadedJarRowKey(row, index) }))
    .filter(item => String(item.row.category || '').toUpperCase() === 'JAR');
  const isValidJarKey = key => loadedJarOptions.some(item => item.key === key);
  const selectedLoadedKey = isValidJarKey(selectedLoadedJarKey) ? selectedLoadedJarKey
    : isValidJarKey(bha?.selectedJarId) ? bha.selectedJarId
      : loadedJarOptions.length === 1 ? loadedJarOptions[0].key : '';
  const researchMode = mode === 'stage8' && fixtureIntegrityValid;
  return <section className={`jarV6Presentation ${researchMode ? 'jarV6ResearchDemo' : ''}`} aria-label="JarFrame V6 performance presentation" data-presentation-mode={researchMode ? 'stage8-research-demo' : 'loaded-bha'}>
    <div className="jarV6ModeSelector" role="radiogroup" aria-label="JarFrame data view">
      <label><input type="radio" name="jarV6DataMode" value="loaded" checked={mode === 'loaded'} onChange={() => setMode('loaded')} /> Loaded BHA</label>
      <label><input type="radio" name="jarV6DataMode" value="stage8" checked={mode === 'stage8'} disabled={!fixtureIntegrityValid}
        onChange={() => setMode('stage8')} /> Stage 8 OES Research Demo</label>
      {!fixtureIntegrityValid && <span role="alert">Stage 8 fixture integrity check failed; demo unavailable.</span>}
    </div>
    <div className="jarV6FixtureStrip">
      <span><strong>{researchMode ? 'Frozen Stage 8 research fixture' : 'Loaded-BHA dynamic results unavailable'}</strong>
        {researchMode ? ` · ${STAGE8_FIXTURE.fixtureIdentity} · 50 ms window` : ' · no dynamic prediction is connected'}</span>
      <span className="jarV6NpStrip">{researchMode ? 'NP unavailable · mode / WOB unavailable' : 'Static load and neutral point shown when valid'}</span>
      <strong className="jarV6Warning">PRELIMINARY — NOT FOR OPERATIONAL USE</strong>
    </div>
    {researchMode && <div className="jarV6Provenance" role="note">
      Opt-in demonstration only · source: Stage8Results.json · SHA-256 {STAGE8_FIXTURE.sourceSha256} · 16 recorded samples · no solver or numerical histories loaded.
    </div>}
    <section className="jarV6Visuals" aria-label={researchMode ? 'Stage 8 research charts and fixture schematic' : 'Loaded-BHA unavailable charts and current BHA schematic'}>
      {researchMode ? <>
        <ResearchChart title="Peak stuck-point tensile impact force" unit="kN" field="peakTensileImpactForceKN" ticks={[2000, 2500, 3000, 3500]}
          selectedIndex={selectedIndex} onSelect={setSelectedIndex} className="jarV6Force" />
        <ResearchChart title="50 ms tensile impulse" unit="kN·s" field="tensileImpulse50msKNs" ticks={[0, 30, 60, 90]}
          selectedIndex={selectedIndex} onSelect={setSelectedIndex} className="jarV6Impulse" />
      </> : <>
        <UnavailableChart title="Peak stuck-point tensile impact force" unit="kN" ticks={[2000, 2500, 3000, 3500]} className="jarV6Force" />
        <UnavailableChart title="50 ms tensile impulse" unit="kN·s" ticks={[0, 30, 60, 90]} className="jarV6Impulse" />
      </>}
      {researchMode ? <ResearchFixtureSchematic selectedPositionFt={selected.positionFt} /> : <LoadedBhaSchematic
        rows={loadedRows} positions={loadedData?.positions} selectedJarKey={selectedLoadedKey}
        schematicSectionsByJarKey={loadedData?.schematicSectionsByJarKey}
        straight={loadedData?.straight} surveyLoads={loadedData?.surveyLoads} drillingMode={loadedData?.drillingMode || 'slide'} />}
      {showVelocity && (researchMode ? <ResearchChart title="Impact velocity at jar" unit="m/s" field="impactVelocityMS" ticks={[2.5, 3.5, 4.5]} domainMax={5}
        selectedIndex={selectedIndex} onSelect={setSelectedIndex} className="jarV6Velocity" digits={3} /> :
        <UnavailableChart title="Impact velocity at jar" unit="m/s" ticks={[2.5, 3.5, 4.5]} className="jarV6Velocity" />)}
    </section>
    <footer className="jarV6Toolbar" aria-label="JarFrame performance controls">
      <label className="jarV6Control jarV6PositionControl"><span>{researchMode ? 'Hypothetical jar centre' : 'Selected loaded jar'}</span>
        {researchMode ? <select aria-label="Select hypothetical jar centre" value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))}>
          {fixtureSamples.map((sample, index) => <option key={sample.positionFt} value={index}>{format(sample.positionFt)} ft</option>)}
        </select> : <select aria-label="Select loaded BHA jar" value={selectedLoadedKey} disabled={!loadedJarOptions.length}
          onChange={event => setSelectedLoadedJarKey(event.target.value)}>
          {!loadedJarOptions.length && <option value="">No jar in loaded BHA</option>}
          {loadedJarOptions.map(({ row, key }, index) => <option key={key} value={key}>{index + 1}: {row.toolName || 'Jar'} · {format(Number(row.length))} ft</option>)}
        </select>}
      </label>
      <div className="jarV6ImpactVelocity"><span>Impact velocity</span><strong data-testid="impact-velocity-readout">{researchMode ? `${format(selected.impactVelocityMS, 3)} m/s` : '— m/s'}</strong></div>
      <div className="jarV6ModeContext">Mode / WOB<br /><b>{researchMode || !loadedData?.straight?.loadProfile?.valid || !validateLoadedBhaWob(bha?.wob).valid
        ? 'unavailable' : `${loadedData.drillingMode} · ${format(Number(bha.wob))} klbf`}</b></div>
      <div className="jarV6ResearchStatus"><b>{researchMode ? 'Opt-in Stage 8 fixture demo' : 'Loaded BHA selected'}</b><br />
        {researchMode ? 'Fixture data only · not loaded-BHA results' : 'Stage 8 fixture is not displayed'}</div>
      <label className="jarV6Control jarV6VelocityToggle"><input type="checkbox" checked={showVelocity} onChange={event => setShowVelocity(event.target.checked)} /> Show velocity plot</label>
    </footer>
    {!researchMode && <EmptyResearchState />}
  </section>;
}
