import React from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';

import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

import SortableRow from './SortableRow.js';
import MeasuredDepthInput from './MeasuredDepthInput';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { nominalHoleDiameter, componentNominalClearance } from '../../engineering/bha/nominalHoleClearance';
import './BHABuilder.css';
import { definedStringDepth } from '../../engineering/bha/definedStringDepth';

const BHABuilder = ({
  bha,
  updateBha,
  updateRow,
  addRow,
  removeRow,
  reorderRows
}) => {
  const rows = bha?.rows || [];
  const nominalHole = nominalHoleDiameter(bha);
  const hasPipe = rows.some(r => r.category === 'DP');
  const definedDepth = definedStringDepth(bha);
  const autoDeployment = hasPipe ? deployDrillstring(bha, bha?.drillpipeReferenceBitMdFt) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) {
      return;
    }

    reorderRows(active.id, over.id);
  };

  return (
    <div className="bhaWorkspace">
      <div className="bhaTopInputs">
      <div>
        <label>Bit Size (in) <input className="bhaBitSizeInput" type="text" inputMode="decimal"
          value={bha?.holeSize ?? ''} aria-invalid={nominalHole.status === 'invalid-input'}
          onChange={e => updateBha?.({ holeSize: e.target.value })} /></label>
        {!nominalHole.valid && <small role={nominalHole.status === 'invalid-input' ? 'alert' : 'status'}>{nominalHole.message}</small>}
      </div>
      {hasPipe && <div className="bhaDepthMode">
        <label>MD (ft) <MeasuredDepthInput readOnly={definedDepth.active} value={bha.drillpipeReferenceBitMdFt ?? ''} onChange={value => updateBha?.({ drillpipeReferenceBitMdFt: value })} /></label>
        {rows.filter(row => row.category === 'DP').map(row => <div className="bhaDpControl" key={row.rowId}>
          <span>DP</span>
          <div className="bhaDpSwitch" role="group" aria-label={`Drillpipe length mode ${rows.indexOf(row) + 1}`}>
            {['auto', 'manual'].map(mode => <button type="button" key={mode}
              aria-pressed={(row.lengthMode || 'manual') === mode}
              onClick={() => updateRow(row.rowId, { lengthMode: mode })}>
              {mode === 'auto' ? 'Auto' : 'Defined'}
            </button>)}
          </div>
        </div>)}
      </div>}
      </div>
      {definedDepth.active && !definedDepth.valid && <small role="alert">{definedDepth.error}</small>}
      {rows.some(row => row.category === 'DP' && row.lengthMode === 'auto') && !autoDeployment?.valid && <small role="alert">{autoDeployment?.errors.join(' ')}</small>}
      <div className="bhaTableSection">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="bhaTableWrapper">
            <Table className="bhaComponentTable">
              <colgroup><col className="bhaDragCol" /><col className="bhaNumberCol" /><col className="bhaTypeCol" /><col className="bhaToolCol" />
                <col className="bhaDimensionCol" /><col className="bhaDimensionCol" /><col className="bhaWeightCol" /><col className="bhaLengthCol" /><col className="bhaDeleteCol" /></colgroup>
              <thead>
                <tr>
                  <th aria-label="Move component"></th>
                  <th>#</th>
                  <th>Type</th>
                  <th>Tool</th>

                  <th>
                    OD
                    <small>(in)</small>
                  </th>

                  <th>
                    ID
                    <small>(in)</small>
                  </th>

                  <th>
                    WT
                    <small>(lb/ft)</small>
                  </th>

                  <th>
                    LEN
                    <small>(ft)</small>
                  </th>

                  <th aria-label="Delete component"></th>
                </tr>
              </thead>

              <SortableContext
                items={rows.map((row) => row.rowId)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {rows.map((row, index) => (
                    <SortableRow
                      key={row.rowId}
                      row={row}
                      nominalClearance={componentNominalClearance(bha, row)}
                      autoDeployment={autoDeployment}
                      index={index}
                      rowsLength={rows.length}
                      updateRow={updateRow}
                      removeRow={removeRow}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </Table>
          </div>
        </DndContext>

        <div className="bhaTableActions">
          <Button
            className="bhaAddButton"
            onClick={addRow}
          >
           <i className="bi bi-plus-square"></i>
            <span>Insert Row</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BHABuilder;
