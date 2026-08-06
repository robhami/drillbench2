import React from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import componentLibraryData from '../../data/components.json';
import { toolType } from '../../Apps/BHAEntry/toolType.js';

const componentLibrary = componentLibraryData.components;
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

  const availableTools = componentLibrary.filter(
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
    const selectedTool = componentLibrary.find(
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
            type="text"
            inputMode="decimal"
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

export default SortableRow;