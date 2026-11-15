import React, { useEffect, useState } from 'react';
import V6ContinuousAssemblyDrawing from '../StringFrame/v6Drawing';
import STAGE8_FIXTURE from './Stage8OesResearchFixture.v1.json';
import { loadedJarRowKey, validateLoadedBhaWob } from './loadedBhaPresentation';
import JarUpPositionComparison from './jarUpPositionComparison';
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

function LoadedBhaStaticSummary({ bha, loadedData, selectedJarKey }) {
  const rows = loadedData?.geometryBha?.rows || bha?.rows || [];
  const jar = rows.map((row, index) => ({ row, index, key: loadedJarRowKey(row, index) })).find(item => item.key === selectedJarKey);
  const component = loadedData?.positions?.components?.find(item => item.rowId === jar?.row?.rowId);
  const boundary = loadedData?.schematicSectionsByJarKey?.[selectedJarKey];
  const positionIndex = loadedData?.positions?.components?.findIndex(item => item.rowId === jar?.row?.rowId) ?? -1;
  const straightJar = loadedData?.straight?.loadProfile?.valid && positionIndex >= 0
    ? loadedData.straight.loadProfile.components[positionIndex] : null;
  const jarOrdinal = rows.slice(0, jar?.index ?? 0).filter(row => String(row.category).toUpperCase() === 'JAR').length;
  const surveyJar = loadedData?.surveyLoads?.valid ? loadedData.surveyLoads.jars?.[jarOrdinal] : null;
  return <aside className="jarV6Panel jarV6LoadedSummary" aria-label="Loaded BHA static engineering results">
    <div className="jarV6SchematicHeader"><h2>Loaded BHA · static results</h2>
    </div>
    <div className="jarV6LiveStatic">
      <div className="jarV6CandidateLabel">{jar ? `Selected jar · ${jar.row.toolName || jar.row.category}` : 'No jar selected'}</div>
      {boundary?.lowerBoundaryUnresolved ? <div className="jarV6BoundaryUnavailable" role="note">Lower DC / fixed Lower BHA boundary unavailable: {boundary.lowerBoundaryReason}</div>
        : boundary?.lowerConnectionUnverified && <div className="jarV6BoundaryUnavailable" role="note">Lower DC follows matching entered OD/ID; the fixed Lower BHA transition cannot be confirmed from connection data.</div>}
      {component && <div>Centre {format(component.centreFromBit)} ft · bottom {format(component.startFromBit)} ft · top {format(component.endFromBit)} ft above bit; {format((loadedData.positions.totalLength || 0) - component.endFromBit)} ft above / {format(component.startFromBit)} ft below.</div>}
      {loadedData?.straight?.loadProfile?.valid ? <div><b>Straight-hole · {loadedData.straight.drillingMode}:</b> {straightJar ? `jar bottom/top ${format(straightJar.bottomAxialForce, 0)} / ${format(straightJar.topAxialForce, 0)} lbf` : 'jar load unavailable'}; NP {Number.isFinite(loadedData.straight.neutralPointFt) ? `${format(loadedData.straight.neutralPointFt)} ft above bit` : 'not found'}.</div>
        : <div><b>Straight-hole · {loadedData?.drillingMode || 'slide'}:</b> unavailable · {loadedData?.straight?.loadProfile?.error || 'valid deployed-BHA inputs required'}.</div>}
      {loadedData?.surveyLoads?.valid ? <div><b>Survey · {loadedData.surveyLoads.mode}:</b> {surveyJar ? `${format(surveyJar.axialForceLbf, 0)} lbf (+ compression)` : 'selected-jar load unavailable'}; NP {loadedData.surveyLoads.neutralPoints?.length === 1 ? `${format(loadedData.surveyLoads.neutralPoints[0].fromBitFt)} ft above bit` : 'not unique or not found'}.</div>
        : <div><b>Survey · {loadedData?.drillingMode || 'slide'}:</b> unavailable · {loadedData?.surveyLoads?.errors?.join(' ') || 'valid covered survey inputs required'}.</div>}
      <div className="jarV6StaticProvenance">Positive force is compression; negative force is tension. Static drilling loads are separate from preliminary idealized Jar Up candidate force and impulse predictions.</div>
      {!loadedData?.deployment?.valid && <div className="jarV6BoundaryUnavailable" role="note">Loaded BHA geometry unavailable · {loadedData?.deployment?.errors?.join(' ') || 'valid deployment inputs required'}.</div>}
    </div>
  </aside>;
}

function EmptyResearchState() {
  return <div className="jarV6ResearchEmpty" role="status">No research data displayed. Select the Stage 8 OES Research Demo mode to opt in to the frozen fixture.</div>;
}

export default function JarFrameV6Presentation({ bha, loadedData, mode: controlledMode, onModeChange,
  selectedLoadedJarKey: controlledSelectedJarKey, onSelectedLoadedJarChange, onOpenStringFrame }) {
  const [showVelocity, setShowVelocity] = useState(false);
  const [localMode, setLocalMode] = useState('loaded');
  const mode = controlledMode || localMode;
  const setMode = onModeChange || setLocalMode;
  const [localSelectedJarKey, setLocalSelectedJarKey] = useState(null);
  useEffect(() => setLocalSelectedJarKey(null), [bha?.id, bha?.selectedJarId]);
  const initialSample = fixtureSamples.findIndex(sample => Math.abs(sample.positionFt - fixtureReferenceFt) < 0.005);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialSample));
  const selected = fixtureSamples[selectedIndex];
  const loadedRows = Array.isArray(loadedData?.geometryBha?.rows) ? loadedData.geometryBha.rows : (Array.isArray(bha?.rows) ? bha.rows : []);
  const loadedJarOptions = loadedRows.map((row, index) => ({ row, index, key: loadedJarRowKey(row, index) }))
    .filter(item => String(item.row.category || '').toUpperCase() === 'JAR');
  const isValidJarKey = key => loadedJarOptions.some(item => item.key === key);
  const requestedSelectedKey = controlledSelectedJarKey === undefined ? localSelectedJarKey : controlledSelectedJarKey;
  const selectedLoadedKey = isValidJarKey(requestedSelectedKey) ? requestedSelectedKey
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
    {onOpenStringFrame && <button type="button" className="jarV6OpenStringFrame" aria-label="Open BHA Schematic"
      title="Open or restore the independently movable BHA Schematic" onClick={onOpenStringFrame}>Open BHA Schematic</button>}
    <div className="jarV6FixtureStrip">
      <span><strong>{researchMode ? 'Frozen Stage 8 research fixture' : 'Loaded-BHA Jar Up position comparison'}</strong>
        {researchMode ? ` · ${STAGE8_FIXTURE.fixtureIdentity} · 50 ms window` : ' · only individually eligible candidate results are plotted'}</span>
      <span className="jarV6NpStrip">{researchMode ? 'NP unavailable · mode / WOB unavailable' : 'Static load and neutral point shown when valid'}</span>
      <strong className="jarV6Warning">PRELIMINARY — NOT FOR OPERATIONAL USE</strong>
    </div>
    {researchMode && <div className="jarV6Provenance" role="note">
      Opt-in demonstration only · source: Stage8Results.json · SHA-256 {STAGE8_FIXTURE.sourceSha256} · 16 recorded samples · no solver or numerical histories loaded.
    </div>}
    <section className={`jarV6Visuals ${researchMode ? 'jarV6ResearchVisuals' : 'jarV6LoadedVisuals'}`}
      aria-label={researchMode ? 'Stage 8 research charts and fixture schematic' : 'Loaded-BHA Jar Up dynamic comparison charts'}>
      {researchMode ? <>
        <ResearchChart title="Peak stuck-point tensile impact force" unit="kN" field="peakTensileImpactForceKN" ticks={[2000, 2500, 3000, 3500]}
          selectedIndex={selectedIndex} onSelect={setSelectedIndex} className="jarV6Force" />
        <ResearchChart title="50 ms tensile impulse" unit="kN·s" field="tensileImpulse50msKNs" ticks={[0, 30, 60, 90]}
          selectedIndex={selectedIndex} onSelect={setSelectedIndex} className="jarV6Impulse" />
      </> : <JarUpPositionComparison bha={bha} selectedJarKey={selectedLoadedKey} />}
      {researchMode && <ResearchFixtureSchematic selectedPositionFt={selected.positionFt} />}
      {showVelocity && (researchMode ? <ResearchChart title="Impact velocity at jar" unit="m/s" field="impactVelocityMS" ticks={[2.5, 3.5, 4.5]} domainMax={5}
        selectedIndex={selectedIndex} onSelect={setSelectedIndex} className="jarV6Velocity" digits={3} /> :
        <UnavailableChart title="Impact velocity at jar" unit="m/s" ticks={[2.5, 3.5, 4.5]} className="jarV6Velocity" />)}
    </section>
    {!researchMode && <LoadedBhaStaticSummary bha={bha} loadedData={loadedData} selectedJarKey={selectedLoadedKey} />}
    <footer className="jarV6Toolbar" aria-label="JarFrame performance controls">
      <label className="jarV6Control jarV6PositionControl"><span>{researchMode ? 'Hypothetical jar centre' : 'Selected loaded jar'}</span>
        {researchMode ? <select aria-label="Select hypothetical jar centre" value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))}>
          {fixtureSamples.map((sample, index) => <option key={sample.positionFt} value={index}>{format(sample.positionFt)} ft</option>)}
        </select> : <select aria-label="Select loaded BHA jar" value={selectedLoadedKey} disabled={!loadedJarOptions.length}
          onChange={event => {
            const key = event.target.value;
            if (onSelectedLoadedJarChange) onSelectedLoadedJarChange(key);
            else setLocalSelectedJarKey(key);
          }}>
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
