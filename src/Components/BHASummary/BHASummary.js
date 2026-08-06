import React from 'react';

import { buildBHASummary } from '../../calculations/buildBHASummary.js';
import { calculateCentreOfGravity } from '../../calculations/calculateCentreOfGravity.js';
import { calculateComponentPositions } from '../../calculations/calculateComponentPositions.js';

const formatNumber = (value, decimals = 1) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const SummaryItem = ({ label, value }) => (
  <div className="bhaSummaryItem">
    <span>{label}</span>
    <span className="bhaSummaryDots" />
    <strong>{value}</strong>
  </div>
);

const BHASummary = ({ bha }) => {
  const summary = buildBHASummary(bha);
  const centreOfGravity = calculateCentreOfGravity(bha);
  const positionResults = calculateComponentPositions(bha);

  const hasMudWeight = summary.buoyancyFactor !== null;

  return (
    <section className="bhaSummary">
      

      <div className="bhaSummaryColumns">
        <div>
          <SummaryItem
            label="Components"
            value={summary.componentCount}
          />

          <SummaryItem
            label="Total length"
            value={`${formatNumber(
              summary.totalLength,
              1
            )} ft`}
          />

          <SummaryItem
            label="Total air weight"
            value={`${formatNumber(
              summary.totalAirWeight,
              0
            )} lb`}
          />

          <SummaryItem
            label="Buoyancy factor"
            value={
              hasMudWeight
                ? formatNumber(summary.buoyancyFactor, 3)
                : '—'
            }
          />
        </div>

        <div>
          <SummaryItem
            label="Total buoyed weight"
            value={
              summary.totalBuoyedWeight === null
                ? '—'
                : `${formatNumber(
                    summary.totalBuoyedWeight,
                    0
                  )} lb`
            }
          />

          <SummaryItem
            label="Centre of gravity"
            value={
              centreOfGravity.centreOfGravityFromBit === null
                ? '—'
                : `${formatNumber(
                    centreOfGravity.centreOfGravityFromBit,
                    1
                  )} ft above bit`
            }
          />

          <SummaryItem
            label="Calculated BHA length"
            value={`${formatNumber(
              positionResults.totalLength,
              1
            )} ft`}
          />
        </div>
      </div>

      {!hasMudWeight && (
        <div className="bhaSummaryNotice">
          Enter mud weight to calculate buoyed values.
        </div>
      )}
    </section>
  );
};

export default BHASummary;