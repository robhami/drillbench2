import React from 'react';

/** Shared V6 continuous drillstring SVG. Coordinates are visual only. */
export default function V6ContinuousAssemblyDrawing({
  segments, markers = [], sectionGuides = [], discontinuities = [], slimStabilizerBlades = false,
  showHeadFittings = false, showBitTip = false, ariaLabel, testId,
  viewHeight = 208, yTop = 7, yBottom = 189, bitTipY = yBottom, bitTipWidth,
  compactBitGeometry = false
}) {
  const rail = 31;
  const compactBitSegment = compactBitGeometry
    ? [...segments].reverse().find(segment => segment.section === 'Bit') : null;
  const finalLowerBhaSegment = compactBitSegment
    ? [...segments].reverse().find(segment => segment.section === 'Lower BHA') : null;
  const compactBitBodyHeight = 8;
  const compactBitCuttingHeight = 6;
  // The Bit label has its own track, but the tool itself must join the final
  // Lower BHA component. Do not render the track's blank spacer as a rail stem.
  const compactBitBodyY = compactBitSegment
    ? finalLowerBhaSegment?.y2 ?? compactBitSegment.y1 +
      (compactBitSegment.y2 - compactBitSegment.y1 - (compactBitBodyHeight + compactBitCuttingHeight)) / 2
    : yBottom;
  return <svg className="jarV6SchematicSvg" viewBox={`0 0 61 ${viewHeight}`} preserveAspectRatio="xMidYMid meet"
    role="img" aria-label={ariaLabel} data-testid={testId}>
    <line x1={rail} y1={yTop} x2={rail} y2={compactBitSegment ? compactBitBodyY : yBottom} className="jarV6Rail" />
    {showHeadFittings && <>
      <rect x={rail - 6} y="2" width="12" height="7" rx="2" className="jarV6SchematicShape jarV6Pipe" />
      <rect x={rail - 8} y="10" width="16" height="9" rx="2" className="jarV6SchematicShape jarV6Hwdp" />
    </>}
    {segments.map(segment => {
      const compactBit = compactBitGeometry && segment.section === 'Bit';
      const bitBodyHeight = compactBitBodyHeight;
      // Anchor the compact tool directly below the final Lower BHA component;
      // its label track spacing is not physical geometry.
      const bitBodyY = compactBit && finalLowerBhaSegment
        ? finalLowerBhaSegment.y2
        : segment.y1 + (segment.y2 - segment.y1 - (bitBodyHeight + compactBitCuttingHeight)) / 2;
      const bitBodyBottom = bitBodyY + bitBodyHeight;
      return <g key={segment.key} data-testid={segment.testId} data-row-key={segment.key} data-selected={segment.selected ? 'true' : undefined}
      data-blade-envelope-width={segment.bladeWidth || undefined} data-section={segment.section} data-component-category={segment.category} title={segment.title}>
      <rect x={rail - segment.width / 2} y={compactBit ? bitBodyY : segment.y1} width={segment.width}
        height={compactBit ? bitBodyHeight : Math.max(1.5, segment.y2 - segment.y1)}
        data-testid={compactBit ? 'loaded-compact-bit-body' : undefined}
        className={`jarV6SchematicShape ${segment.className}${segment.unknownOd ? ' jarV6UnknownOd' : ''}${segment.selected ? ' jarV6SelectedLoadedJar' : ''}`} />
      {compactBit && <path d={`M${rail - segment.width / 2} ${bitBodyBottom} L${rail + segment.width / 2} ${bitBodyBottom} L${rail} ${bitBodyBottom + compactBitCuttingHeight} Z`}
        className="jarV6BitTip" data-testid="loaded-compact-bit-tip" />}
      {!compactBit && segment.bladeWidth > segment.width && (slimStabilizerBlades ? [-1, 1].map(side => {
        const tubeEdge = rail + side * (segment.width / 2 - .35);
        const bladeEdge = rail + side * segment.bladeWidth / 2;
        const endInset = Math.min(1.5, (segment.y2 - segment.y1) * .2);
        return <path key={side} d={`M${tubeEdge} ${segment.y1 + endInset} L${bladeEdge} ${segment.y1 + endInset + .7} L${bladeEdge} ${segment.y2 - endInset - .7} L${tubeEdge} ${segment.y2 - endInset} Z`} className="jarV6Blade" />;
      }) : <rect x={rail - segment.bladeWidth / 2} y={segment.y1 + 1} width={segment.bladeWidth}
        height={Math.max(1, segment.y2 - segment.y1 - 2)} className="jarV6Blade" />)}
    </g>;
    })}
    {discontinuities.map(mark => <path key={mark.key}
      d={`M${rail - mark.width / 2} ${mark.y - 5} L${rail + mark.width / 2} ${mark.y + 1} M${rail - mark.width / 2} ${mark.y + 1} L${rail + mark.width / 2} ${mark.y + 7}`}
      className="jarV6Discontinuity" data-discontinuity="true" data-discontinuity-key={mark.key} />)}
    {sectionGuides.map(guide => guide.fromY == null
      ? <line key={guide.key} x1="43" y1={guide.y} x2="61" y2={guide.y} className="jarV6SectionGuide" aria-hidden="true" />
      : <path key={guide.key} d={`M43 ${guide.fromY} L61 ${guide.y}`} className="jarV6SectionGuide" aria-hidden="true" data-section-guide={guide.section} data-from-y={guide.fromY} data-to-y={guide.y} />)}
    {markers.map(marker => <g key={marker.key}>
      {marker.guide && <line x1={marker.x - marker.guide / 2} y1={marker.y} x2={marker.x + marker.guide / 2} y2={marker.y} className={marker.guideClass} />}
      <circle cx={marker.x} cy={marker.y} r={marker.radius} className={marker.className} data-testid={marker.testId} />
    </g>)}
    {showBitTip && !compactBitGeometry && <path d={bitTipWidth
      ? `M${rail - bitTipWidth / 2} ${bitTipY - .5} L${rail + bitTipWidth / 2} ${bitTipY - .5} L${rail} ${bitTipY + 7} Z`
      : `M${rail - 9} ${bitTipY - 1}l9 8 9-8z`} className="jarV6BitTip" data-testid={bitTipWidth ? 'loaded-compact-bit-tip' : undefined} />}
  </svg>;
}
