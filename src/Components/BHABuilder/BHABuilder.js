import React, { useState } from 'react';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import BHASummary from '../BHASummary/BHASummary.js';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  
  verticalListSortingStrategy
} from '@dnd-kit/sortable';


import SortableRow from './SortableRow.js';


const createEmptyRow = () => ({
  rowId: `${Date.now()}-${Math.random()}`,
  category: '',
  selectedToolId: '',
  toolName:'',
  od: '',
  idSize: '',
  weight: '',
  length: ''
});



const BHABuilder = () => {
 const [well, setWell] = useState({
  name: '',
  field: '',
  operator: '',
  currentBha: {
    name: '',
    holeSize: '',
    mudWeight: '',
    rows: [createEmptyRow()]
  }
});

const bha = well.currentBha;
const rows = bha.rows;


const updateBha = (bhaChanges) => {
  setWell((currentWell) => ({
    ...currentWell,
    currentBha: {
      ...currentWell.currentBha,
      ...bhaChanges
    }
  }));
};

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

  const updateRow = (rowId, changes) => {
  setWell((currentWell) => ({
    ...currentWell,
    currentBha: {
      ...currentWell.currentBha,
      rows: currentWell.currentBha.rows.map((row) =>
        row.rowId === rowId
          ? { ...row, ...changes }
          : row
      )
    }
  }));
};

 const addRow = () => {
  setWell((currentWell) => ({
    ...currentWell,
    currentBha: {
      ...currentWell.currentBha,
      rows: [
        ...currentWell.currentBha.rows,
        createEmptyRow()
      ]
    }
  }));
};

  const removeRow = (rowId) => {
  setWell((currentWell) => ({
    ...currentWell,
    currentBha: {
      ...currentWell.currentBha,
      rows:
        currentWell.currentBha.rows.length === 1
          ? currentWell.currentBha.rows
          : currentWell.currentBha.rows.filter(
              (row) => row.rowId !== rowId
            )
    }
  }));
};

  const handleDragEnd = ({ active, over }) => {
  if (!over || active.id === over.id) {
    return;
  }

  setWell((currentWell) => {
    const currentRows = currentWell.currentBha.rows;

    const oldIndex = currentRows.findIndex(
      (row) => row.rowId === active.id
    );

    const newIndex = currentRows.findIndex(
      (row) => row.rowId === over.id
    );

    return {
      ...currentWell,
      currentBha: {
        ...currentWell.currentBha,
        rows: arrayMove(currentRows, oldIndex, newIndex)
      }
    };
  });
};

  return (
    <>
<div className="wellDetails">
  <Form.Group>
    <Form.Label>Well Name</Form.Label>
    <Form.Control
      type="text"
      placeholder="e.g. Demo Well A"
      value={well.name}
      onChange={(event) =>
        setWell((currentWell) => ({
          ...currentWell,
          name: event.target.value
                }
              )
            )
        }

    />
  </Form.Group>

  <Form.Group>
    <Form.Label>Field</Form.Label>
    <Form.Control
      type="text"
      placeholder="e.g. Demo Field"
      value={well.field}
      onChange={(event) =>
        setWell((currentWell) => ({
          ...currentWell,
          field: event.target.value
        }))
      }
    />
  </Form.Group>

  <Form.Group>
    <Form.Label>Operator</Form.Label>
    <Form.Control
      type="text"
      placeholder="e.g. Demo Operator"
      value={well.operator}
      onChange={(event) =>
        setWell((currentWell) => ({
          ...currentWell,
          operator: event.target.value
        }))
      }
    />
  </Form.Group>
</div>

      <div className="bhaDetails">
        <Form.Group>
          <Form.Label>BHA Name</Form.Label>
          <Form.Control
            type="text"
            placeholder='e.g. 8½" Production BHA'
            value={bha.name}
            onChange={(event) =>
              updateBha({
              name: event.target.value
               })
            }
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Hole Size (in)</Form.Label>
          <Form.Control
            type="text"
            inputMode="decimal"
            value={bha.holeSize}
            onChange={(event) =>
              updateBha({
              holeSize: event.target.value
            })
          }
          />
        </Form.Group>

        <Form.Group>
          <Form.Label>Mud Weight (ppg)</Form.Label>
          <Form.Control
            type="text"
            inputMode="decimal"
            value={bha.mudWeight}
           onChange={(event) =>
              updateBha({
              mudWeight: event.target.value
             })
            }
          />
        </Form.Group>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <Table responsive>
          <thead>
            <tr>
              <th aria-label="Move"></th>
              <th>#</th>
              <th>Type</th>
              <th>Tool</th>
              <th>OD</th>
              <th>ID</th>
              <th>WT</th>
              <th>LEN</th>
              <th></th>
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
      </DndContext>

      <Button
        variant="outline-primary"
        size="sm"
        onClick={addRow}
      >
        + Add Component
      </Button>

      <BHASummary bha={bha} />






    </>
  );
};


export default BHABuilder;