import React, { useState } from 'react';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

import { toolLibrary } from '../../Apps/BHAEntry/toolLibrary.js';
import { toolType } from '../../Apps/BHAEntry/toolType.js';

const createEmptyRow = () => ({
  rowId: `${Date.now()}-${Math.random()}`,
  category: '',
  selectedToolId: '',
  od: '',
  idSize: '',
  weight: '',
  length: ''
});

const SortableRow = ({
  row,
  index,
  rowsLength,
  updateRow,
  removeRow
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: row.rowId
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    backgroundColor: isDragging ? '#f8f9fa' : undefined
  };

  const availableTools = toolLibrary.filter(
    (tool) => tool.category === row.category
  );

  const handleCategoryChange = (category) => {
    updateRow(row.rowId, {
      category,
      selectedToolId: '',
      od: '',
      idSize: '',
      weight: '',
      length: ''
    });
  };

  const handleToolChange = (toolId) => {
    const selectedTool = toolLibrary.find(
      (tool) =>
        tool.category === row.category &&
        String(tool.id) === toolId
    );

    if (!selectedTool) {
      updateRow(row.rowId, {
        selectedToolId: '',
        od: '',
        idSize: '',
        weight: '',
        length: ''
      });

      return;
    }

    updateRow(row.rowId, {
      selectedToolId: toolId,
      od: selectedTool.od ?? '',
      idSize: selectedTool.idSize ?? '',
      weight: selectedTool.weight ?? '',
      length: selectedTool.length ?? ''
    });
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <button
          type="button"
          className="bhaDragHandle"
          aria-label={`Move component ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          ☰
        </button>
      </td>

      <td>{index + 1}</td>

      <td>
        <Form.Select
          size="sm"
          value={row.category}
          onChange={(event) =>
            handleCategoryChange(event.target.value)
          }
        >
          <option value="">Select Type</option>

          {toolType.map((type) => (
            <option key={type.id} value={type.name}>
              {type.name}
            </option>
          ))}
        </Form.Select>
      </td>

      <td>
        <Form.Select
          size="sm"
          value={row.selectedToolId}
          disabled={!row.category}
          onChange={(event) =>
            handleToolChange(event.target.value)
          }
        >
          <option value="">
            {row.category
              ? 'Select Tool'
              : 'Select Type First'}
          </option>

          {availableTools.map((tool) => (
            <option key={tool.id} value={tool.id}>
              {tool.name}
            </option>
          ))}
        </Form.Select>
      </td>

      {[
        ['od', row.od],
        ['idSize', row.idSize],
        ['weight', row.weight],
        ['length', row.length]
      ].map(([field, value]) => (
        <td key={field}>
          <input
            className="numInput"
            type="number"
            step="any"
            value={value}
            onChange={(event) =>
              updateRow(row.rowId, {
                [field]: event.target.value
              })
            }
          />
        </td>
      ))}

      <td>
        <Button
          variant="outline-danger"
          size="sm"
          disabled={rowsLength === 1}
          onClick={() => removeRow(row.rowId)}
        >
          ×
        </Button>
      </td>
    </tr>
  );
};

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
            type="number"
            step="any"
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
            type="number"
            step="any"
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
    </>
  );
};


export default BHABuilder;