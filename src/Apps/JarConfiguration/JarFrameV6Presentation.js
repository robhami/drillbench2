import React, { useState } from 'react';
import EngineeringStringSchematic from '../EngineeringString/EngineeringStringSchematic';
import STAGE8_FIXTURE from './Stage8OesResearchFixture.v1.json';
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

function loadedSchematicRows(rows, selectedJarId) {
  const drawable = rows.filter(row => Number(row?.length) > 0 || row?.category || row?.toolName);
  const jars = drawable.filter(row => String(row.category).toUpperCase() === 'JAR');
  const selectedJar = jars.find(row => row.rowId === selectedJarId) || (jars.length === 1 ? jars[0] : null);
  const segments = drawable.slice().reverse();
  const usableHeight = 178;
  const weights = segments.map(row => Math.max(0.7, Math.sqrt(Math.max(0, Number(row.length) || 0))));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 10;
  const laidOut = segments.map((row, index) => {
    const height = usableHeight * weights[index] / totalWeight;
    const item = { row, top: cursor, bottom: cursor + height, selected: row === selectedJar };
    cursor += height;
    return item;
  });
  return { laidOut, selectedJar };
}

function LoadedBhaSchematic({ bha, rows }) {
  const { laidOut, selectedJar } = loadedSchematicRows(rows, bha?.selectedJarId);
  const jarSegment = laidOut.find(item => item.selected);
  const jarY = jarSegment ? (jarSegment.top + jarSegment.bottom) / 2 : null;
  const componentClass = row => {
    const type = String(row.category || '').toUpperCase();
    return ['BIT', 'JAR', 'STB', 'DC', 'HWDP', 'DP'].includes(type) ? `jarV6${type[0]}${type.slice(1).toLowerCase()}` : 'jarV6Dc';
  };
  const rowLabel = row => `${row.category || row.toolName || 'Component'} · ${row.length || '—'} ft · OD ${row.od || '—'} in${row.idSize || row.id ? ` · ID ${row.idSize || row.id} in` : ''}`;
  return <aside className="jarV6Panel jarV6Schematic jarV6LoadedSchematic" aria-label="Loaded BHA schematic">
    <header className="jarV6SchematicHeader"><h2>Loaded BHA · schematic</h2><span>Current BHA rows · not to scale</span></header>
    <div className="jarV6SchematicGrid">
      <svg className="jarV6SchematicSvg" viewBox="0 0 61 208" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`Complete loaded BHA assembly${selectedJar ? `; selected jar ${selectedJar.toolName || selectedJar.category} highlighted` : '; no jar row available'}`} data-testid="loaded-bha-assembly">
        <line x1="31" y1="8" x2="31" y2="189" className="jarV6Rail" />
        {laidOut.map(({ row, top, bottom, selected }, index) => {
          const category = String(row.category || '').toUpperCase();
          const width = category === 'JAR' ? 20 : category === 'BIT' ? 18 : category === 'STB' ? 17 : category === 'HWDP' ? 16 : category === 'DP' ? 12 : 13;
          const height = Math.max(1.5, bottom - top);
          return <g key={row.rowId || `${category}-${index}`}>
            <rect x={31 - width / 2} y={top} width={width} height={height} rx={category === 'BIT' ? 2 : 1}
              className={`jarV6SchematicShape ${componentClass(row)}${selected ? ' jarV6SelectedLoadedJar' : ''}`} />
            {selected && <><line x1="13" y1={jarY} x2="50" y2={jarY} className="jarV6CandidateGuide" />
              <circle cx="31" cy={jarY} r="4" className="jarV6CandidateMarker" data-testid="loaded-selected-jar-marker" /></>}
          </g>;
        })}
        <path d="M22 188l9 8 9-8z" className="jarV6BitTip" />
      </svg>
      <div className="jarV6ComponentLabels" aria-label="Loaded BHA component labels">
        {laidOut.map(({ row }, index) => <div key={row.rowId || `label-${index}`} title={`${row.toolName || row.category || 'Component'} · ${rowLabel(row)}`}>
          <b>{rowLabel(row)}</b></div>)}
        {!laidOut.length && <div><b>No BHA components</b>Load rows to view the assembly.</div>}
      </div>
    </div>
    <div className="jarV6SchematicStatus"><span className="jarV6CandidateLabel">{selectedJar ? `Selected jar · ${selectedJar.toolName || selectedJar.category}` : 'No selected jar row'}</span><span className="jarV6NpState">NP unavailable</span></div>
    <details className="jarV6DetailedSchematic"><summary>Optional detailed tool illustration</summary>
      <EngineeringStringSchematic components={rows} neutralPointFt={null} jars={[]} dcSections={{}} />
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
  const rect = (a, b, width, className, key) => <rect key={key} x={rail - width / 2} y={a} width={width} height={Math.max(1.5, b - a)} className={`jarV6SchematicShape ${className}`} />;
  const fixtureY = y(fixtureReferenceFt), candidateY = y(selectedPositionFt);
  const coincident = Math.abs(selectedPositionFt - fixtureReferenceFt) < 0.005;
  const fixtureX = coincident ? rail - 5 : rail, candidateX = coincident ? rail + 5 : rail;
  return <aside className="jarV6Panel jarV6Schematic" aria-label="Stage 8 OES research fixture BHA schematic">
    <header className="jarV6SchematicHeader"><h2>OES BHA · schematic</h2><span>Stage 8 fixture · not to scale</span></header>
    <div className="jarV6SchematicGrid">
      <svg className="jarV6SchematicSvg" viewBox="0 0 61 208" preserveAspectRatio="xMidYMid meet" role="img" data-testid="stage8-fixture-assembly"
        aria-label={`Stage 8 OES fixture; selected hypothetical jar centre ${format(selectedPositionFt)} feet; fixed fixture reference jar centre 641.83 feet`}>
        <line x1={rail} y1={yTop} x2={rail} y2={yBottom} className="jarV6Rail" />
        <rect x={rail - 6} y="2" width="12" height="7" rx="2" className="jarV6SchematicShape jarV6Pipe" />
        <rect x={rail - 8} y="10" width="16" height="9" rx="2" className="jarV6SchematicShape jarV6Hwdp" />
        {rect(yTop, y(jarTop), 13, 'jarV6Dc', 'upper-dc')}
        {rect(y(jarTop), y(jarBottom), 20, 'jarV6Jar', 'hypothetical-jar')}
        {rect(y(jarBottom), fixedTop, 13, 'jarV6Dc', 'lower-dc')}
        {lowerStack.map((type, index) => {
          const a = fixedTop + index * step, b = index === 5 ? yBottom : fixedTop + (index + 1) * step;
          return <g key={`${type}-${index}`}>
            {rect(a, b, widths[index], `jarV6${type[0].toUpperCase()}${type.slice(1)}`, `stack-${index}`)}
            {type === 'stb' && <rect x={rail - 13} y={a + 1} width="26" height={Math.max(1, b - a - 2)} className="jarV6Blade" />}
          </g>;
        })}
        <line x1={fixtureX - 10} y1={fixtureY} x2={fixtureX + 10} y2={fixtureY} className="jarV6FixtureGuide" />
        <circle cx={fixtureX} cy={fixtureY} r="3.5" className="jarV6FixtureMarker" data-testid="fixture-reference-marker" />
        <line x1={candidateX - 10} y1={candidateY} x2={candidateX + 10} y2={candidateY} className="jarV6CandidateGuide" />
        <circle cx={candidateX} cy={candidateY} r="3.8" className="jarV6CandidateMarker" data-testid="hypothetical-position-marker" />
        <path d={`M${rail - 9} ${yBottom - 1}l9 8 9-8z`} className="jarV6BitTip" />
      </svg>
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

export default function JarFrameV6Presentation({ bha }) {
  const [showVelocity, setShowVelocity] = useState(false);
  const [mode, setMode] = useState('loaded');
  const initialSample = fixtureSamples.findIndex(sample => Math.abs(sample.positionFt - fixtureReferenceFt) < 0.005);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, initialSample));
  const selected = fixtureSamples[selectedIndex];
  const loadedRows = Array.isArray(bha?.rows) ? bha.rows : [];
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
      <span className="jarV6NpStrip">NP unavailable · mode / WOB unavailable</span>
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
      {researchMode ? <ResearchFixtureSchematic selectedPositionFt={selected.positionFt} /> : <LoadedBhaSchematic bha={bha} rows={loadedRows} />}
      {showVelocity && (researchMode ? <ResearchChart title="Impact velocity at jar" unit="m/s" field="impactVelocityMS" ticks={[2.5, 3.5, 4.5]} domainMax={5}
        selectedIndex={selectedIndex} onSelect={setSelectedIndex} className="jarV6Velocity" digits={3} /> :
        <UnavailableChart title="Impact velocity at jar" unit="m/s" ticks={[2.5, 3.5, 4.5]} className="jarV6Velocity" />)}
    </section>
    <footer className="jarV6Toolbar" aria-label="JarFrame performance controls">
      <label className="jarV6Control jarV6PositionControl"><span>Hypothetical jar centre</span>
        {researchMode ? <select aria-label="Select hypothetical jar centre" value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))}>
          {fixtureSamples.map((sample, index) => <option key={sample.positionFt} value={index}>{format(sample.positionFt)} ft</option>)}
        </select> : <select aria-label="Select hypothetical jar centre" value="" disabled><option value="">Unavailable · Loaded BHA mode</option></select>}
      </label>
      <div className="jarV6ImpactVelocity"><span>Impact velocity</span><strong data-testid="impact-velocity-readout">{researchMode ? `${format(selected.impactVelocityMS, 3)} m/s` : '— m/s'}</strong></div>
      <div className="jarV6ModeContext">Mode / WOB<br /><b>unavailable</b></div>
      <div className="jarV6ResearchStatus"><b>{researchMode ? 'Opt-in Stage 8 fixture demo' : 'Loaded BHA selected'}</b><br />
        {researchMode ? 'Fixture data only · not loaded-BHA results' : 'Stage 8 fixture is not displayed'}</div>
      <label className="jarV6Control jarV6VelocityToggle"><input type="checkbox" checked={showVelocity} onChange={event => setShowVelocity(event.target.checked)} /> Show velocity plot</label>
    </footer>
    {!researchMode && <EmptyResearchState />}
  </section>;
}
