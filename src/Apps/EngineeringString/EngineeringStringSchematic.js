import React, { useMemo, useState } from 'react';

const category = component => String(component?.category || '').trim().toUpperCase();
const finite = value => value !== null && value !== '' && Number.isFinite(Number(value));

export function schematicToolType(component) {
    const type = category(component);
    const identity = `${component?.toolName || ''} ${component?.bitType || ''} ${component?.description || ''}`.toUpperCase();
    if (type === 'BIT') return /\bTCI\b|ROLLER\s*CONE|TRICONE/.test(identity) ? 'TCI' : /\bPDC\b/.test(identity) ? 'PDC' : 'BIT';
    if (['STB', 'STAB', 'STABILIZER'].includes(type)) return 'STB';
    return ['DC', 'DP', 'HWDP', 'JAR'].includes(type) ? type : 'OTHER';
}

const minimumHeight = type => ({ BIT: 36, PDC: 40, TCI: 42, STB: 34, JAR: 44, HWDP: 34, DC: 26, DP: 24, OTHER: 26 }[type] || 26);
const maximumHeight = type => ({ BIT: 52, PDC: 52, TCI: 54, STB: 52, JAR: 58, HWDP: 72, DC: 82, DP: 54, OTHER: 60 }[type] || 60);

export function schematicComponentHeight(component, type = schematicToolType(component)) {
    const length = Math.max(0, Number(component?.length) || 0);
    const naturalHeight = Math.sqrt(length) * 3.9;
    return Math.max(minimumHeight(type), Math.min(maximumHeight(type), naturalHeight));
}

export function buildSchematicLayout(components = [], view = 'bha') {
    let runningFt = 0;
    const all = components.filter(component => Number(component?.length) > 0 &&
        (component?.category || component?.toolName || component?.selectedToolId)).map((component, index) => {
        const length = Math.max(0, Number(component.length) || 0);
        const startFt = finite(component.startFromBit) ? Number(component.startFromBit) : runningFt;
        const endFt = finite(component.endFromBit) && Number(component.endFromBit) > startFt
            ? Number(component.endFromBit) : startFt + length;
        runningFt = Math.max(runningFt, endFt);
        const type = schematicToolType(component);
        const height = schematicComponentHeight(component, type);
        const idealHeight = Math.max(0, endFt - startFt) * 0.28;
        return { component, index, key: component.rowId ?? `${type}-${startFt}-${index}`, type, length: endFt - startFt, startFt, endFt, height,
            compressed: idealHeight > height * 1.35 };
    }).sort((a, b) => a.startFt - b.startFt || a.index - b.index);
    const firstDp = all.findIndex(item => item.type === 'DP');
    const items = view === 'full' || firstDp < 0 ? all : all.slice(0, firstDp);
    let cursorBottom = 0;
    const placed = items.map(item => {
        const next = { ...item, bottomY: cursorBottom, topY: cursorBottom + item.height };
        cursorBottom = next.topY;
        return next;
    });
    const layout = { view, items: placed, totalHeight: cursorBottom, topY: 24, bottomY: 24 + cursorBottom,
        hasDp: firstDp >= 0, excludedDpCount: view === 'bha' && firstDp >= 0 ? all.length - firstDp : 0 };
    return layout;
}

export function mapSchematicPosition(layout, positionFt) {
    if (!layout || !finite(positionFt)) return null;
    const ft = Number(positionFt);
    const item = layout.items.find((entry, index) => ft >= entry.startFt - 1e-8 &&
        (ft < entry.endFt - 1e-8 || (index === layout.items.length - 1 && ft <= entry.endFt + 1e-8)));
    if (!item) return null;
    const span = item.endFt - item.startFt;
    const ratio = span > 0 ? Math.max(0, Math.min(1, (ft - item.startFt) / span)) : 0.5;
    return layout.bottomY - item.bottomY - ratio * item.height;
}

const fmt = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// The drawing intentionally enlarges radial scale relative to axial scale so tool profiles remain legible.
const odRadius = component => Math.max(20, Math.min((Number(component?.od) || 5) * 7.4, 64));
const toolName = component => component?.toolName || component?.category || 'Component';

function ComponentSilhouette({ item, selected, onSelect }) {
    const { component, type, topY, bottomY, height, compressed } = item;
    const centre = 180;
    const radius = odRadius(component);
    const shoulder = Math.min(5, height * 0.12);
    const centerY = (topY + bottomY) / 2;
    const select = () => onSelect(component);
    const keySelect = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } };
    const bodyPath = (r, y0 = topY, y1 = bottomY, shoulderPx = shoulder) =>
        `M ${centre - r * .82} ${y0} L ${centre + r * .82} ${y0} L ${centre + r} ${y0 + shoulderPx} L ${centre + r} ${y1 - shoulderPx} L ${centre + r * .82} ${y1} L ${centre - r * .82} ${y1} L ${centre - r} ${y1 - shoulderPx} L ${centre - r} ${y0 + shoulderPx} Z`;
    const common = { role: 'button', tabIndex: 0, onClick: select, onKeyDown: keySelect,
        'aria-label': `Select ${category(component)} ${toolName(component)}, OD ${component.od || 'not entered'} inches, length ${fmt(component.length)} feet`,
        'aria-pressed': selected, 'data-silhouette': type, 'data-compressed': compressed ? 'true' : 'false', className: `bhaSchematicComponent ${selected ? 'isSelected' : ''}` };
    const diameterStroke = selected ? '#b4771d' : '#4b5961';
    const edge = <path d={bodyPath(radius)} fill={`url(#${type === 'DP' ? 'dpSteel' : type === 'HWDP' ? 'hwdpSteel' : type === 'JAR' ? 'jarSteel' : 'silverSteel'})`} stroke={diameterStroke} strokeWidth={selected ? 1.8 : 1.1} />;
    const bands = (r = radius) => <>
        <path d={`M ${centre-r} ${topY+shoulder} L ${centre+r} ${topY+shoulder}`} stroke="#39454c" strokeWidth="1.8" />
        <path d={`M ${centre-r} ${topY+shoulder+2.5} L ${centre+r} ${topY+shoulder+2.5}`} stroke="#e5e9eb" strokeWidth="1" />
        <path d={`M ${centre-r} ${bottomY-shoulder-2.5} L ${centre+r} ${bottomY-shoulder-2.5}`} stroke="#39454c" strokeWidth="1.5" />
    </>;

    let shape;
    if (type === 'STB') {
        const bladeR = Math.min(odRadius(component), radius);
        const bladeOffset = Math.min(bladeR * .73, height * .19);
        const bladeTop = topY + Math.max(4, height * .12), bladeBottom = bottomY - Math.max(4, height * .12);
        shape = <>
            <path d={bodyPath(radius * .48)} fill="url(#silverSteel)" stroke="#526069" strokeWidth="1" />
            {[-1, 1].map(side => {
                const xOuter = centre + side * bladeR;
                const xInner = centre + side * bladeR * .46;
                const d = side < 0
                    ? `M ${xInner} ${bladeTop} Q ${centre-bladeOffset} ${centerY-3} ${xOuter} ${centerY-7} L ${xOuter} ${centerY+5} Q ${centre-bladeOffset} ${centerY+7} ${xInner} ${bladeBottom} Z`
                    : `M ${xInner} ${bladeTop} Q ${centre+bladeOffset} ${centerY-3} ${xOuter} ${centerY-7} L ${xOuter} ${centerY+5} Q ${centre+bladeOffset} ${centerY+7} ${xInner} ${bladeBottom} Z`;
                return <g key={side}><path d={d} fill="url(#bladeSteel)" stroke="#4c7778" strokeWidth="1.2" />
                    <path d={`M ${xOuter-side*2} ${bladeTop+3} Q ${centre+side*bladeOffset} ${centerY} ${xOuter-side*2} ${bladeBottom-2}`} fill="none" stroke="#78a5a3" strokeWidth="1.5" /></g>;
            })}
            <path d={`M ${centre-2.2} ${bladeTop+2} Q ${centre+4} ${centerY-5} ${centre-2.2} ${centerY} Q ${centre-5} ${centerY+7} ${centre+2.2} ${bladeBottom-2} L ${centre+4} ${bladeBottom-1} Q ${centre-3} ${centerY+6} ${centre+4} ${centerY} Q ${centre-3} ${centerY-6} ${centre+2.2} ${bladeTop+2} Z`}
                fill="url(#bladeSteel)" stroke="#58656c" strokeWidth=".7" />
            {bands(radius * .48)}
        </>;
    } else if (type === 'JAR') {
        const mandrelTop = topY + Math.max(8, height * .25), mandrelBottom = bottomY - Math.max(8, height * .25);
        shape = <>
            <path d={bodyPath(radius * .86)} fill="url(#jarSteel)" stroke="#334d5d" strokeWidth="1.2" />
            <path d={bodyPath(radius, topY, topY + Math.min(9, height*.2), 2)} fill="url(#silverSteel)" stroke="#43515a" strokeWidth=".8" />
            <path d={bodyPath(radius, bottomY - Math.min(9, height*.2), bottomY, 2)} fill="url(#silverSteel)" stroke="#43515a" strokeWidth=".8" />
            <path d={`M ${centre-radius*.36} ${mandrelTop} L ${centre+radius*.36} ${mandrelTop} L ${centre+radius*.36} ${mandrelBottom} L ${centre-radius*.36} ${mandrelBottom} Z`} fill="url(#polishedSteel)" stroke="#53616a" strokeWidth=".8" />
            <path d={`M ${centre-radius*.86} ${centerY-2} L ${centre+radius*.86} ${centerY-2}`} stroke="#2c4d61" strokeWidth="1.2" />
            <path d={`M ${centre-radius*.86} ${centerY+2} L ${centre+radius*.86} ${centerY+2}`} stroke="#b7c9d2" strokeWidth="1" />
            <path d={`M ${centre-radius*.72} ${mandrelTop-3} L ${centre+radius*.72} ${mandrelTop-3} M ${centre-radius*.72} ${mandrelBottom+3} L ${centre+radius*.72} ${mandrelBottom+3}`} stroke="#263f50" strokeWidth="1.2" />
        </>;
    } else if (type === 'PDC' || type === 'TCI' || type === 'BIT') {
        const headTop = Math.max(topY, bottomY - Math.min(height * .72, 31));
        const headCenter = (headTop + bottomY) / 2;
        shape = <>
            <path d={`M ${centre-radius*.45} ${topY} L ${centre+radius*.45} ${topY} L ${centre+radius*.45} ${headTop+3} Q ${centre+radius*.92} ${bottomY-3} ${centre+radius*.78} ${bottomY} L ${centre-radius*.78} ${bottomY} Q ${centre-radius*.92} ${bottomY-3} ${centre-radius*.45} ${headTop+3} Z`} fill="url(#silverSteel)" stroke="#45525a" strokeWidth="1" />
            {type === 'PDC' && <>
                {[0,1,2].map(blade => {
                    const x = centre - radius*.48 + blade * radius*.48;
                    return <g key={blade}><path d={`M ${x} ${headTop+3} Q ${x+radius*.13} ${headCenter-4} ${x+radius*.23} ${bottomY-3}`} fill="none" stroke="#8e713e" strokeWidth="2.4" />
                        {[0,1].map(cutter => <circle key={cutter} cx={x+radius*.19} cy={headTop+9+cutter*8} r="1.8" fill="url(#cutterGold)" stroke="#70572f" strokeWidth=".5" />)}</g>;
                })}
                <path d={`M ${centre-radius*.28} ${bottomY-2} Q ${centre} ${bottomY+1} ${centre+radius*.28} ${bottomY-2}`} fill="none" stroke="#b08a4e" strokeWidth="2" />
            </>}
            {type === 'TCI' && <>
                {[-1,0,1].map((cone,index) => {
                    const cx = centre + cone*radius*.35, cy = headCenter + Math.abs(cone)*2;
                    return <g key={index}><path d={`M ${cx} ${cy-9} Q ${cx+radius*.24} ${cy-6} ${cx+radius*.23} ${cy+5} Q ${cx} ${cy+10} ${cx-radius*.23} ${cy+5} Q ${cx-radius*.24} ${cy-6} ${cx} ${cy-9} Z`} fill="url(#polishedSteel)" stroke="#53616a" strokeWidth=".8" />
                        {[-1,0,1].map(row => <circle key={row} cx={cx+row*2.6} cy={cy+2} r="1.45" fill="url(#cutterGold)" stroke="#5f513d" strokeWidth=".45" />)}</g>;
                })}
            </>}
            {type === 'BIT' && <path d={`M ${centre-radius*.65} ${bottomY-4} L ${centre} ${bottomY+1} L ${centre+radius*.65} ${bottomY-4}`} fill="none" stroke="#58656d" strokeWidth="1.5" />}
        </>;
    } else if (type === 'DP') {
        const jointR = radius, jointH = Math.min(8, height*.22);
        shape = <>
            <path d={bodyPath(radius*.58, topY, bottomY, Math.min(3,height*.1))} fill="url(#dpSteel)" stroke="#303940" strokeWidth="1" />
            <path d={bodyPath(jointR, topY, topY+jointH, 1.5)} fill="url(#silverSteel)" stroke="#293139" strokeWidth=".9" />
            <path d={bodyPath(jointR, bottomY-jointH, bottomY, 1.5)} fill="url(#silverSteel)" stroke="#293139" strokeWidth=".9" />
            {[0,1,2].map(n => <path key={n} d={`M ${centre-jointR*.78} ${topY+2+n*1.4} L ${centre+jointR*.78} ${topY+2+n*1.4}`} stroke="#38444c" strokeWidth=".55" />)}
        </>;
    } else {
        shape = <>
            {edge}
            {bands()}
            {type === 'HWDP' && <>
                <path d={bodyPath(radius, centerY-7, centerY+7, 2)} fill="url(#hwdpSteel)" stroke="#5e513b" strokeWidth=".9" />
                {/SPIRAL|WEAR.?PAD/.test(toolName(component).toUpperCase())
                    ? <path d={`M ${centre-radius*.88} ${centerY+6} L ${centre-radius*.3} ${centerY-5} L ${centre+radius*.3} ${centerY+5} L ${centre+radius*.88} ${centerY-6}`} fill="none" stroke="#705e42" strokeWidth="1.8" />
                    : <path d={`M ${centre-radius*.75} ${centerY} L ${centre+radius*.75} ${centerY}`} stroke="#6f6048" strokeWidth="1.5" />}
            </>}
        </>;
    }

    return <g {...common}>
        <title>{`${category(component)} · ${toolName(component)} · OD ${component.od || '—'} in · ID ${component.idSize || component.id || '—'} in · ${fmt(component.length)} ft`}</title>
        {selected && <rect x="112" y={topY-1} width="136" height={height+2} rx="5" fill="#e6a63a" opacity=".11" />}
        {shape}
        {compressed && <g aria-hidden="true"><rect x={centre-radius*1.8} y={centerY-3} width={radius*3.6} height="6" fill="#fff" opacity=".96" />
            <path d={`M ${centre-radius*1.7} ${centerY+3} l 5 -6 l 5 6 l 5 -6 l 5 6`} fill="none" stroke="#5c6870" strokeWidth="1.4" /></g>}
        {selected && <path d={`M 76 ${centerY} l 5 -5 l 5 5 l -5 5 Z`} fill="#bd7c19" stroke="#fff" strokeWidth=".8" />}
    </g>;
}

const EngineeringStringSchematic = ({ components = [], neutralPointFt = null, jars = [], dcSections = {} }) => {
    const [view, setView] = useState('bha');
    const [selectedKey, setSelectedKey] = useState(null);
    const layout = useMemo(() => buildSchematicLayout(components, view), [components, view]);
    const selectedItem = layout.items.find(item => item.key === selectedKey) || null;
    const selectedComponent = selectedItem?.component;
    // Component inspection must not silently change which engineering jar is marked.
    const selectedJar = layout.items.find(item => item.type === 'JAR')?.component;
    const jarFt = selectedJar ? Number.isFinite(Number(selectedJar.centreFromBit)) ? Number(selectedJar.centreFromBit) : (Number(selectedJar.startFromBit) + Number(selectedJar.endFromBit)) / 2 : null;
    const jarY = jarFt === null ? null : mapSchematicPosition(layout, jarFt);
    const npY = Number.isFinite(neutralPointFt) ? mapSchematicPosition(layout, neutralPointFt) : null;
    const outsideNp = Number.isFinite(neutralPointFt) && npY === null;
    const displayedTopFt = layout.items.length ? Math.max(...layout.items.map(item => item.endFt)) : 0;
    const npOutsideAbove = Number.isFinite(neutralPointFt) && neutralPointFt > displayedTopFt;
    const selectedPosition = selectedComponent ? `${fmt(selectedItem.startFt)}–${fmt(selectedItem.endFt)} ft above bit` : '—';
    const totalHeight = Math.max(300, layout.totalHeight + 60);
    const top = layout.topY;
    const y = distanceFromBottom => top + layout.totalHeight - distanceFromBottom;
    const renderMarker = (label, markerY, color, side, actualPositionFt) => {
        if (markerY === null) return null;
        const markerItem = layout.items.find(item => actualPositionFt >= item.startFt - 1e-8 && actualPositionFt <= item.endFt + 1e-8);
        const markerRadius = markerItem ? odRadius(markerItem.component) : 0;
        const nearJar = jarY !== null && Math.abs(markerY - jarY) < 29;
        const actualSide = nearJar && label === 'NP' ? 'left' : side;
        const pipeEdge = actualSide === 'left' ? 180 - markerRadius - 3 : 180 + markerRadius + 3;
        const lineEnd = actualSide === 'left' ? 82 : 270;
        const labelX = actualSide === 'left' ? 77 : 283;
        const anchor = actualSide === 'left' ? 'end' : 'start';
        const labelY = markerY + (label === 'NP' && nearJar ? -8 : 4);
        return <g key={label} className={`bhaSchematicMarker ${label === 'NP' ? 'npMarker' : 'jarMarker'}`} data-position-ft={actualPositionFt} data-schematic-y={markerY}>
            <path d={`M ${pipeEdge} ${markerY} L ${lineEnd} ${markerY}`} stroke={color} strokeWidth="1.8" />
            <path d={`M ${pipeEdge} ${markerY} l ${actualSide === 'left' ? 5 : -5} -3 l 0 6 Z`} fill={color} />
            <text x={labelX} y={labelY} textAnchor={anchor} fill={color}>{label}</text>
        </g>;
    };

    return <section className="engineeringStringViewer" aria-label="Engineering string BHA schematic">
        <div className="engineeringStringViewerToolbar">
            <span className="bhaSchematicNotToScale">Schematic · not to scale</span>
            <label className="engineeringStringViewChoice">View <select aria-label="Schematic view" value={view} onChange={event => setView(event.target.value)}>
                <option value="bha">BHA</option><option value="full">Full String</option>
            </select></label>
        </div>
        <div className={`bhaSchematicScroll ${view === 'full' ? 'isFullString' : ''}`} role="region" aria-label="BHA schematic">
            {layout.items.length ? <>
            <svg className="bhaSchematicSvg" viewBox={`0 0 360 ${totalHeight}`} role="group" aria-label={`${view === 'bha' ? 'BHA below first drillpipe' : 'Full string'} schematic; not to scale`}>
                <defs>
                    <linearGradient id="silverSteel" x1="0" x2="1"><stop offset="0" stopColor="#66737a"/><stop offset=".16" stopColor="#d2d8db"/><stop offset=".34" stopColor="#f4f6f6"/><stop offset=".52" stopColor="#9ca8ae"/><stop offset=".75" stopColor="#e0e5e7"/><stop offset="1" stopColor="#737f85"/></linearGradient>
                    <linearGradient id="polishedSteel" x1="0" x2="1"><stop offset="0" stopColor="#9ba6ab"/><stop offset=".35" stopColor="#fff"/><stop offset=".68" stopColor="#bcc5c9"/><stop offset="1" stopColor="#78848a"/></linearGradient>
                    <linearGradient id="bladeSteel" x1="0" x2="1"><stop offset="0" stopColor="#59666d"/><stop offset=".35" stopColor="#cbd2d5"/><stop offset=".7" stopColor="#eef1f2"/><stop offset="1" stopColor="#69767d"/></linearGradient>
                    <linearGradient id="dpSteel" x1="0" x2="1"><stop offset="0" stopColor="#252e35"/><stop offset=".25" stopColor="#59636a"/><stop offset=".52" stopColor="#303a41"/><stop offset=".78" stopColor="#606a70"/><stop offset="1" stopColor="#20292f"/></linearGradient>
                    <linearGradient id="hwdpSteel" x1="0" x2="1"><stop offset="0" stopColor="#6b5a40"/><stop offset=".25" stopColor="#c0a875"/><stop offset=".5" stopColor="#e1d0a7"/><stop offset=".75" stopColor="#9a8156"/><stop offset="1" stopColor="#65543d"/></linearGradient>
                    <linearGradient id="jarSteel" x1="0" x2="1"><stop offset="0" stopColor="#29475b"/><stop offset=".26" stopColor="#5f87a0"/><stop offset=".52" stopColor="#8ca9b8"/><stop offset=".78" stopColor="#426a82"/><stop offset="1" stopColor="#29475b"/></linearGradient>
                    <linearGradient id="cutterGold" x1="0" x2="1"><stop offset="0" stopColor="#916e36"/><stop offset=".5" stopColor="#e3c98e"/><stop offset="1" stopColor="#9c773b"/></linearGradient>
                </defs>
                <rect x="0" y="0" width="360" height={totalHeight} fill="#fbfcfc" />
                {layout.items.map(item => <ComponentSilhouette key={item.key} item={{ ...item, topY: y(item.bottomY + item.height), bottomY: y(item.bottomY) }}
                    selected={Boolean(selectedItem && selectedItem.key === item.key)} onSelect={() => setSelectedKey(item.key)} />)}
                {layout.items.some(item => item.type === 'BIT') && <path d={`M 166 ${layout.bottomY+9} l 14 5 l 14 -5`} fill="none" stroke="#9ba5aa" strokeWidth=".8" />}
                {jarFt !== null && renderMarker('JAR', jarY, '#28749a', 'right', jarFt)}
                {Number.isFinite(neutralPointFt) && npY !== null && renderMarker('NP', npY, '#c47a21', 'right', neutralPointFt)}
                {outsideNp && <g className="bhaSchematicOutsideNp">
                    {npOutsideAbove
                        ? <path d="M 206 27 l 0 -9 m -4 4 l 4 -4 l 4 4" fill="none" stroke="#c47a21" strokeWidth="1.5" />
                        : <path d={`M 206 ${layout.bottomY+31} l 0 9 m -4 -4 l 4 4 l 4 -4`} fill="none" stroke="#c47a21" strokeWidth="1.5" />}
                    <text x="223" y={npOutsideAbove ? 20 : layout.bottomY+43}>NP outside BHA view</text>
                </g>}
            </svg>
            </> : <div className="engineeringStringEmpty bhaSchematicEmpty">{layout.hasDp ? 'No BHA components below the first drillpipe. Select Full String to inspect the defined assembly.' : 'Add BHA components to view the schematic.'}</div>}
        </div>
        <div className="engineeringStringDcReadouts" aria-label="Available drill collar sections">
            <span><b>DC above jar</b><strong>{finite(dcSections.above?.lengthFt) ? `${fmt(dcSections.above.lengthFt)} ft` : 'Unavailable'}</strong></span>
            <span><b>DC below jar</b><strong>{finite(dcSections.below?.lengthFt) ? `${fmt(dcSections.below.lengthFt)} ft` : 'Unavailable'}</strong></span>
        </div>
        {selectedComponent && <div className="bhaSchematicComponentDetails" aria-live="polite">
            {selectedComponent ? <><strong>{category(selectedComponent)} · {toolName(selectedComponent)}</strong>
                <span>OD {selectedComponent.od || '—'} in</span><span>ID {selectedComponent.idSize || selectedComponent.id || '—'} in</span>
                <span>Length {fmt(selectedComponent.length)} ft</span><span>Position {selectedPosition}</span></>
                : null}
        </div>}
    </section>;
};

export default EngineeringStringSchematic;
