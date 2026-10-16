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
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';

const BHABuilder = ({
  bha,
  updateBha,
  updateRow,
  addRow,
  removeRow,
  reorderRows
}) => {
  const rows = bha?.rows || [];
  const hasPipe = rows.some(r => r.category === 'DP');
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
      {hasPipe && <div style={{ marginBottom: 8 }}>
        <label>Auto DP reference bit MD (ft) <input type="number" min="0" step="any" style={{ width: 120 }} value={bha.drillpipeReferenceBitMdFt ?? ''} onChange={e => updateBha?.({ drillpipeReferenceBitMdFt: e.target.value })} /></label>
        <small style={{ display: 'block' }}>Enter an explicit reference depth for Auto. Stored manual lengths remain available to existing drilling/Skeem analyses; run analysis deploys pipe at each sampled depth.</small>
      </div>}
      <div className="bhaTableSection">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="bhaTableWrapper">
            <Table className="bhaComponentTable">
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
