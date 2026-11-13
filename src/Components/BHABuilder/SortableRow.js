import React from 'react';
import ComponentNumberInput from './ComponentNumberInput';
import { useDemoPresentation, componentDisplayLabel } from '../DemoPresentation';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toolType } from '../../Apps/BHAEntry/toolType.js';
import { cloneDefinition, definitionRowPatch } from '../../engineering/bha/componentDefinition';

const SortableRow = ({
    row,
    standardComponents = [],
    customComponents = [],
    nominalClearance,
    validation,
    deferValidation = false,
    onNumericFocus,
    onNumericBlur,
    autoDeployment,
    cumulativeLengthFt,
    index,
    rowsLength,
    updateRow,
    removeRow
}) => {
    const demoPresentation = useDemoPresentation();
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

    const library = [...standardComponents, ...customComponents];
    const availableTools = library.filter(
        (tool) => tool.category === row.category
    );
    // A missing OD is an unfinished edit, not a row-level message. Keep the
    // engineering result untouched; only mark an explicitly supplied bad OD.
    const hasOd = row.od !== null && row.od !== undefined && String(row.od).trim() !== '';
    const showClearanceError = Boolean(row.category && hasOd && nominalClearance && !nominalClearance.valid && nominalClearance.diameterIn !== null);
    const librarySpec = row.librarySpecification || library.find(tool => String(tool.id) === String(row.selectedToolId)) || row.componentDefinition;
    const differsFromLibrary = row.category === 'STB' && librarySpec && ['od', 'idSize', 'weight', 'length'].some(field =>
        Number.isFinite(Number(row[field])) && Number.isFinite(Number(librarySpec[field]))
            ? Number(row[field]) !== Number(librarySpec[field]) : String(row[field] ?? '') !== String(librarySpec[field] ?? ''));

    const handleCategoryChange = (category) => {
        updateRow(row.rowId, {
            category,
            componentDefinition: undefined,
            componentSchemaVersion: undefined,
            librarySpecification: undefined,
            selectedToolId: '',
            od: '',
            idSize: '',
            weight: '',
            length: '',
            toolName: ''
        });
    };

    const handleToolChange = (toolId) => {
        const selectedTool = library.find(
            (tool) =>
                tool.category === row.category &&
                String(tool.id) === toolId
        );

        if (!selectedTool) {
            updateRow(row.rowId, {
                selectedToolId: '',
                componentDefinition: undefined,
                componentSchemaVersion: undefined,
                librarySpecification: undefined,
                od: '',
                idSize: '',
                weight: '',
                length: ''
            });

            return;
        }

        const patch = definitionRowPatch(selectedTool);
        const sameSizeBit = row.category === 'BIT' &&
            Number(row.od) === Number(selectedTool.od) &&
            Number(row.length) === Number(selectedTool.length);
        const retainedBitInstance = sameSizeBit ? {
            od: row.od,
            idSize: row.idSize,
            weight: row.weight,
            length: row.length
        } : {};
        updateRow(row.rowId, {
            ...patch,
            ...retainedBitInstance,
            ...(row.category === 'STB' ? { librarySpecification: cloneDefinition(patch.componentDefinition) } : {})
        });
    };

    return (
        <tr ref={setNodeRef} style={style} data-row-state={validation?.state}>
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
                    aria-label={`Component ${index + 1} type`}
                    value={row.category}
                    onChange={(event) =>
                        handleCategoryChange(event.target.value)
                    }
                >
                    <option value="">Select Type</option>

                    {[...new Set([...toolType.map(t => t.name), ...library.map(t => t.category)])].map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </Form.Select>
                {differsFromLibrary && <small className="bhaLibraryOverrideNotice">Edited from library specification; changes apply to this BHA only.</small>}
            </td>

            <td>
                <div className="bhaToolControls">
                <Form.Select
                    size="sm"
                    aria-label={`Component ${index + 1} tool`}
                    title={demoPresentation && componentDisplayLabel(row, true) !== componentDisplayLabel(row, false) ? `Original catalogue: ${row.toolName} · ID ${row.selectedToolId}` : undefined}
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
                            {componentDisplayLabel(String(tool.id) === String(row.selectedToolId) && row.toolName ? row : tool, demoPresentation && String(tool.id) === String(row.selectedToolId))}
                        </option>
                    ))}
                    {row.selectedToolId && !availableTools.some(t => String(t.id) === String(row.selectedToolId)) && <option value={row.selectedToolId}>{row.toolName} (saved snapshot)</option>}
                </Form.Select>
                </div>
            </td>

            {[
                ['od', row.od],
                ['idSize', row.idSize],
                ['weight', row.weight],
                ['length', row.length]
            ].map(([field, value]) => (
                <td key={field}>
                    {field === 'length' && row.category === 'DP' && row.lengthMode === 'auto' ? <ComponentNumberInput maximumFractionDigits={1}
                        className="numInput" aria-label={`Calculated drillpipe length ${index + 1}`} readOnly
                        value={autoDeployment?.valid ? autoDeployment.metadata.deployedDpLengthFt : ''} placeholder="Unavailable" /> :
                    <ComponentNumberInput maximumFractionDigits={field === 'length' ? 2 : field === 'weight' ? 2 : undefined}
                        aria-label={`Component ${index + 1} ${field}`}
                        className="numInput"
                        type="text"
                        inputMode="decimal"
                        value={value}
                        readOnly={row.category !== 'STB' && row.componentDefinition?.geometry?.kind === 'segmented'}
                        aria-invalid={!deferValidation && (validation?.errors[field] || (field === 'od' && showClearanceError)) ? true : undefined}
                        title={deferValidation ? undefined : field === 'od' && showClearanceError ? nominalClearance.message : validation?.errors[field]}
                        placeholder={
                            field === 'length'
                                ? 'Enter ft'
                                : ''
                        }
                        onFocus={onNumericFocus}
                        onBlur={onNumericBlur}
                        onChange={(event) =>
                            updateRow(row.rowId, {
                                [field]: event.target.value,
                                ...(row.componentDefinition ? { componentDefinition: { ...row.componentDefinition, [field]: event.target.value } } : {})
                            })
                        }
                    />}
                </td>
            ))}

            <td>
                <ComponentNumberInput minimumFractionDigits={2} maximumFractionDigits={2} className="numInput bhaCumulativeInput" aria-label={`Cumulative length ${index + 1}`} readOnly
                    value={cumulativeLengthFt ?? ''} placeholder={cumulativeLengthFt == null ? '—' : ''} />
            </td>

            <td>
                <Button
                    className="bhaDeleteButton"
                    onClick={() => removeRow(row.rowId)}
                    aria-label={`Delete component ${index + 1}`}
                >
                    <i className="bi bi-trash3"></i>
                </Button>
            </td>
        </tr>
    );
};

export default SortableRow;
