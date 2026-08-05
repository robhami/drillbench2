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

const SmallTable = () => {
  const [bha, setBha] = useState({
  name: '',
  holeSize: '',
  mudWeight: '',
  rows: [createEmptyRow()]
});

const rows = bha.rows;

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
  setBha((currentBha) => ({
    ...currentBha,
    rows: currentBha.rows.map((row) =>
      row.rowId === rowId
        ? { ...row, ...changes }
        : row
    )
  }));
};

 const addRow = () => {
  setBha((currentBha) => ({
    ...currentBha,
    rows: [
      ...currentBha.rows,
      createEmptyRow()
    ]
  }));
};

  const removeRow = (rowId) => {
  setBha((currentBha) => ({
    ...currentBha,
    rows:
      currentBha.rows.length === 1
        ? currentBha.rows
        : currentBha.rows.filter(
            (row) => row.rowId !== rowId
          )
  }));
};

   const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) {
      return;
    }

    setBha((currentBha) => {
      const oldIndex = currentBha.rows.findIndex(
        (row) => row.rowId === active.id
      );

      const newIndex = currentBha.rows.findIndex(
        (row) => row.rowId === over.id
      );

      return {
        ...currentBha,
        rows: arrayMove(
          currentBha.rows,
          oldIndex,
          newIndex
        )
      };
    });
  };

  return (
    <>
      <div className="bhaDetails">
        <Form.Group>
          <Form.Label>BHA Name</Form.Label>
          <Form.Control
            type="text"
            placeholder='e.g. 8½" Production BHA'
            value={bha.name}
            onChange={(event) =>
              setBha((currentBha) => ({
                ...currentBha,
                name: event.target.value
              }))
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
              setBha((currentBha) => ({
                ...currentBha,
                holeSize: event.target.value
              }))
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
              setBha((currentBha) => ({
                ...currentBha,
                mudWeight: event.target.value
              }))
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

export default SmallTable;