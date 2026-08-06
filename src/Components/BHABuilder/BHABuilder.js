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

const BHABuilder = ({
  bha,
  updateRow,
  addRow,
  removeRow,
  reorderRows
}) => {
  const rows = bha?.rows || [];

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
            variant="outline-success"
            size="sm"
            onClick={addRow}
          >
            + Add Component
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BHABuilder;