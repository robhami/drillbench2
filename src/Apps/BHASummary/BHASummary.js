import React from 'react';

import { basicBHACalcs } from '../../engineering/bha/basicBHACalcs.js';
import { calcCentreOfGravity } from '../../engineering/bha/calcCentreOfGravity.js';
import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions.js';
import { calcNeutralPoint } from '../../engineering/forces/calcNeutralPoint.js';
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
  const summary = basicBHACalcs(bha);
  const centreOfGravityResult = calcCentreOfGravity(bha);
  const positionResults = calcComponentPositions(bha);

  const hasMudWeight = summary.buoyancyFactor !== null;

  const neutralPointResult = calcNeutralPoint(bha);



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
              centreOfGravityResult.centreOfGravityFromBit === null
                ? '—'
                : `${formatNumber(
                  centreOfGravityResult.centreOfGravityFromBit,
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

          <SummaryItem
            label="Neutral point"
            value={
              neutralPointResult.neutralPointFound
                ? `${formatNumber(
                  neutralPointResult.neutralPointFromBit,
                  1
                )} ft above bit`
                : '—'
            }
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