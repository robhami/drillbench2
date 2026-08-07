import React from 'react';
import Table from 'react-bootstrap/Table';

import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions.js';

const formatNumber = (value, decimals = 1) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

const EngineeringResults = ({ bha }) => {
  const results = calcComponentPositions(bha);

  return (
    <div id="engineeringResults">
      <Table 
        bordered
        hover
        responsive
        size="sm">
        <thead>
          <tr>
             <th className="position">Pos</th>
            <th className="tool left">Component</th>
            <th className="length num">Length</th>
            <th className="distance num">Start</th>
            <th className="distance num">Centre</th>
            <th className="distance num">End</th>
            <th className="weight num">Air wt</th>
            <th className="weight num">Buoyed wt</th>
          </tr>
        </thead>

        <tbody>
          {results.components.map((component) => (
                 <tr key={component.position}>
            <td className="centre">{component.position}</td>
            <td className="left">
                {component.toolName || component.category}
            </td>
            <td className="num">{formatNumber(component.length,1)}</td>
            <td className="num">{formatNumber(component.startFromBit,1)}</td>
            <td className="num">{formatNumber(component.centreFromBit,1)}</td>
            <td className="num">{formatNumber(component.endFromBit,1)}</td>
            <td className="num">{formatNumber(component.airWeight,0)}</td>
            <td className="num">
                {component.buoyedWeight === null
                    ? "—"
                    : formatNumber(component.buoyedWeight,0)}
            </td>
        </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default EngineeringResults;