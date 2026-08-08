import React from 'react';

import UnitCon from './Apps/UnitCon/UnitCon.js';
import BHAEntry from './Apps/BHAEntry/BHAEntry.js';
import AnalysisInputs from './Apps/AnalysisInputs/AnalysisInputs.js';
import BHASummaryCard from './Apps/BHASummary/BHASummaryCard.js';
import EngineeringResultsCard from './Apps/EngineeringResults/EngineeringResultsCard.js';
import BHAManagerCard from './Apps/BHAManager/BHAManagerCard.js';


export const createWidgets = ({
  bha,
  savedBhas,
  saveBha,
  loadBha,
  deleteBha,
  newBha,
  updateBha,
  updateRow,
  addRow,
  removeRow,
  reorderRows
}) => [
    {
      id: 0,
      name: 'Units Converter',
      image:
        'https://cdn.iconscout.com/icon/free/png-128/emi-calculator-1795294-1522560.png',
      value: 'Units Converter',
      app: <UnitCon />
    },

    {
      id: 1,
      name: 'BHA Data Entry',
      image:
        'https://cdn.iconscout.com/icon/premium/png-128-thumb/oil-well-6-1049520.png',
      value: 'BHA Data Entry',
      app: (
        <BHAEntry
          bha={bha}
          updateRow={updateRow}
          addRow={addRow}
          removeRow={removeRow}
          reorderRows={reorderRows}
        />
      )
    },

    {
      id: 2,
      name: 'Analysis Inputs',
      image:
        'https://cdn.iconscout.com/icon/premium/png-128-thumb/parameters-1980829-1672484.png',
      value: 'Analysis Inputs',
      app: (
        <AnalysisInputs
          bha={bha}
          updateBha={updateBha}
        />
      )
    },

    {
      id: 3,
      name: 'BHA Summary',
      image:
        'https://cdn.iconscout.com/icon/premium/png-128-thumb/parameters-1980829-1672484.png',
      value: 'BHA Summary',
      app: <BHASummaryCard bha={bha} />
    },

    {
      id: 4,
      name: 'Engineering Results',
      image:
        'https://cdn.iconscout.com/icon/premium/png-128-thumb/parameters-1980829-1672484.png',
      value: 'Engineering Results',
      app: <EngineeringResultsCard bha={bha} />
    },

    {
      id: 5,
      name: 'BHA Manager',
      image:
        'https://cdn.iconscout.com/icon/premium/png-128-thumb/parameters-1980829-1672484.png',
      value: 'BHA Manager',
      app: (
        <BHAManagerCard
          currentBha={bha}
          savedBhas={savedBhas}
          saveBha={saveBha}
          loadBha={loadBha}
          deleteBha={deleteBha}
          newBha={newBha}
        />
      )
    }





  ];