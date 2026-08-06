import React from 'react';
import Card from 'react-bootstrap/Card';

import { buildBhaSummary } from '../../calculations/buildBHASummary.js';

import { calculateCentreOfGravity } from '../../calculations/calculateCentreOfGravity.js';

const formatNumber = (value, decimals = 1) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const BHASummary = ({ bha }) => {
  const summary = buildBhaSummary(bha);

  const centreOfGravity =
  calculateCentreOfGravity(bha);

  return (
    <Card className="bhaSummary">
      <Card.Header>
        <strong>BHA Summary</strong>
      </Card.Header>

      <Card.Body>
        <div className="bhaSummaryGrid">
          <span>Components</span>
          <strong>{summary.componentCount}</strong>

          <span>Total length</span>
          <strong>
            {formatNumber(summary.totalLength)} ft
          </strong>

          <span>Total air weight</span>
          <strong>
            {formatNumber(summary.totalAirWeight, 0)} lb
          </strong>

          <span>Buoyancy factor</span>
          <strong>
            {summary.buoyancyFactor === null
              ? 'Enter mud weight'
              : formatNumber(summary.buoyancyFactor, 3)}
          </strong>

          <span>Total buoyed weight</span>
          <strong>
            {summary.totalBuoyedWeight === null
              ? '—'
              : `${formatNumber(
                  summary.totalBuoyedWeight,
                  0
                )} lb`}
        </strong>
        
            <span>Centre of gravity</span>
        <strong>
            {centreOfGravity.centreOfGravityFromBit === null
            ? '—'
            : `${formatNumber(
                centreOfGravity.centreOfGravityFromBit,
                1
            )} ft above bit`}
        </strong>
        </div>
      </Card.Body>
    </Card>
  );
};

export default BHASummary;