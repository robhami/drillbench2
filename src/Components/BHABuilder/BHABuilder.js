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
import ComponentEditorContext from './ComponentEditorContext';
import { loadMyComponents, resolvedStandardComponents, standardComponents } from '../../Apps/BHAEntry/componentStore';
import MeasuredDepthInput from './MeasuredDepthInput';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { nominalHoleDiameter, componentNominalClearance } from '../../engineering/bha/nominalHoleClearance';
import './BHABuilder.css';
import { definedStringDepth } from '../../engineering/bha/definedStringDepth';
import { analysisDepth } from '../../engineering/bha/analysisDepth';
import { assessBhaReadiness, bhaReadinessKey } from './bhaReadiness';
import { DemoProvenance } from '../DemoPresentation';
import { cumulativeBhaLengths } from './cumulativeBhaLengths';
import { calculateBhaEngineeringSummary } from './bhaEngineeringSummary';

const summaryNumber = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const InfoTip = ({ label, text }) => <button type="button" className="bhaSummaryInfo" aria-label={`${label} information`} title={text}><i className="bi bi-info-circle" aria-hidden="true" /></button>;
const SummaryValue = ({ value }) => <span className="bhaSummaryValue">{value == null ? 'Unavailable' : summaryNumber(value)}</span>;

const BHABuilder = ({
  bha,
  updateBha,
  updateRow,
  addRow,
  removeRow,
  reorderRows,
  bhaValidationRequest
}) => {
  const rows = bha?.rows || [];
  const [myComponents, setMyComponents] = React.useState([]);
  const [standardTools, setStandardTools] = React.useState(() => { try { return resolvedStandardComponents(); } catch { return standardComponents; } });
  const openComponentEditor = React.useContext(ComponentEditorContext);
  React.useEffect(() => {
    const read = () => { try { setMyComponents(loadMyComponents()); } catch { /* Editor reports storage errors without changing the BHA. */ }
      try { setStandardTools(resolvedStandardComponents()); } catch { /* Preserve the catalogue if local overrides are unreadable. */ } };
    read(); window.addEventListener('drillbench-components', read); window.addEventListener('storage', read);
    return () => { window.removeEventListener('drillbench-components', read); window.removeEventListener('storage', read); };
  }, []);
  const nominalHole = nominalHoleDiameter(bha);
  const hasPipe = rows.some(r => r.category === 'DP');
  const definedDepth = definedStringDepth(bha);
  const depth = analysisDepth(bha);
  const autoDeployment = hasPipe ? deployDrillstring(bha, bha?.drillpipeReferenceBitMdFt) : null;
  const cumulativeLengths = cumulativeBhaLengths(rows, autoDeployment?.valid ? autoDeployment.metadata.deployedDpLengthFt : null);
  const engineeringSummary = React.useMemo(() => calculateBhaEngineeringSummary(bha), [bha]);
  const readiness = assessBhaReadiness(bha), readinessKey = bhaReadinessKey(bha);
  const requested = bhaValidationRequest === readinessKey;
  const [focusedNumericRowId, setFocusedNumericRowId] = React.useState(null);
  const [summaryExpanded, setSummaryExpanded] = React.useState(true);
  const editingMessages = readiness.rows.flatMap((r, index) => r.state === 'invalid' && rows[index]?.rowId !== focusedNumericRowId ? [r.invalidMessage] : []);
  const messages = requested ? readiness.messages : editingMessages;

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
      <DemoProvenance bha={bha} />
      <div className="bhaTopInputs">
      <div>
        <label>Bit Size (in) <input className="bhaBitSizeInput" type="text" inputMode="decimal"
          value={bha?.holeSize ?? ''} aria-invalid={nominalHole.status === 'invalid-input'}
          onChange={e => updateBha?.({ holeSize: e.target.value })} /></label>
        {!nominalHole.valid && <small role={nominalHole.status === 'invalid-input' ? 'alert' : 'status'}>{nominalHole.message}</small>}
      </div>
      {hasPipe && <div className="bhaDepthMode">
        <label>MD (ft) <MeasuredDepthInput readOnly={definedDepth.active} value={definedDepth.active ? depth.valid ? depth.bitMdFt : '' : bha.drillpipeReferenceBitMdFt ?? ''} onChange={value => updateBha?.({ drillpipeReferenceBitMdFt: value })} /></label>
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
      <section className="bhaEngineeringSummary" aria-label="BHA engineering summary">
        <button type="button" className="bhaSummaryHeading" aria-expanded={summaryExpanded}
          aria-controls="bhaSummaryContents" onClick={() => setSummaryExpanded(expanded => !expanded)}>
          <span><i className={`bi ${summaryExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden="true" /> BHA Summary</span>
        </button>
        <div className="bhaEngineeringSummaryGrid" id="bhaSummaryContents" hidden={!summaryExpanded}>
          <table className="bhaSummaryTable">
            <thead><tr><th>Section</th><th>Length (ft)</th>
              <th>Buoyed (klbf)<InfoTip label="Buoyed weight" text="Preliminary buoyed weight using entered ppf and nominal steel buoyancy." /></th>
              <th>Axial (klbf)<InfoTip label="Axial weight" text={`Survey-based axial gravitational contribution. Excludes friction and drag.${bha?.trajectoryMode === 'vertical' ? ' Uses the explicitly selected generated vertical fallback (0° inclination), not a measured survey.' : ' Uses the confirmed associated survey; no vertical fallback is inferred.'}`} /></th></tr></thead>
            <tbody>
              <tr><th><span>BHA</span><InfoTip label="BHA" text="Assembly below the first drill pipe component." /></th>
                <td><SummaryValue value={engineeringSummary.geometry.bhaLengthFt} /></td>
                <td><SummaryValue value={engineeringSummary.weights.buoyedBhaWeightLbf == null ? null : engineeringSummary.weights.buoyedBhaWeightLbf / 1000} /></td>
                <td><SummaryValue value={engineeringSummary.weights.axialBhaWeightLbf == null ? null : engineeringSummary.weights.axialBhaWeightLbf / 1000} /></td></tr>
              <tr><th><span>Below jar</span><InfoTip label="Below jar" text="All components below the selected jar, excluding the jar." /></th>
                <td><SummaryValue value={engineeringSummary.geometry.belowJarLengthFt} /></td>
                <td><SummaryValue value={engineeringSummary.weights.buoyedBelowJarLbf == null ? null : engineeringSummary.weights.buoyedBelowJarLbf / 1000} /></td>
                <td><SummaryValue value={engineeringSummary.weights.axialBelowJarLbf == null ? null : engineeringSummary.weights.axialBelowJarLbf / 1000} /></td></tr>
              <tr><th><span>Available DC below jar</span><InfoTip label="Available DC below jar" text={`Contiguous compatible drill collars directly below the jar. Excludes other tool types and incompatible collar sections.${engineeringSummary.geometry.availableDcBelowJarConnectionUnverified ? ' Connection data is incomplete; grouping uses matching OD/ID and does not confirm rig-handling compatibility.' : ''}${engineeringSummary.availableDcWeightReasons.below.buoyed ? ` Buoyed weight unavailable: ${engineeringSummary.availableDcWeightReasons.below.buoyed}` : ''}${engineeringSummary.availableDcWeightReasons.below.axial ? ` Axial weight unavailable: ${engineeringSummary.availableDcWeightReasons.below.axial}` : ''}`} /></th>
                <td><SummaryValue value={engineeringSummary.geometry.availableDcBelowJarLengthFt} /></td>
                <td><SummaryValue value={engineeringSummary.weights.availableDcBelowJarBuoyedWeightLbf == null ? null : engineeringSummary.weights.availableDcBelowJarBuoyedWeightLbf / 1000} /></td>
                <td><SummaryValue value={engineeringSummary.weights.availableDcBelowJarAxialWeightLbf == null ? null : engineeringSummary.weights.availableDcBelowJarAxialWeightLbf / 1000} /></td></tr>
              <tr><th><span>Available DC above jar</span><InfoTip label="Available DC above jar" text={`Contiguous compatible drill collars directly above the jar. Excludes HWDP, DP and incompatible collar sections.${engineeringSummary.geometry.availableDcAboveJarConnectionUnverified ? ' Connection data is incomplete; grouping uses matching OD/ID and does not confirm rig-handling compatibility.' : ''}${engineeringSummary.availableDcWeightReasons.above.buoyed ? ` Buoyed weight unavailable: ${engineeringSummary.availableDcWeightReasons.above.buoyed}` : ''}${engineeringSummary.availableDcWeightReasons.above.axial ? ` Axial weight unavailable: ${engineeringSummary.availableDcWeightReasons.above.axial}` : ''}`} /></th>
                <td><SummaryValue value={engineeringSummary.geometry.availableDcAboveJarLengthFt} /></td>
                <td><SummaryValue value={engineeringSummary.weights.availableDcAboveJarBuoyedWeightLbf == null ? null : engineeringSummary.weights.availableDcAboveJarBuoyedWeightLbf / 1000} /></td>
                <td><SummaryValue value={engineeringSummary.weights.availableDcAboveJarAxialWeightLbf == null ? null : engineeringSummary.weights.availableDcAboveJarAxialWeightLbf / 1000} /></td></tr>
            </tbody>
          </table>
        </div>
      </section>
      </div>
      {messages.length > 0 && <div className="bhaValidationSummary" role="alert">{messages.map(message => <p key={message}>{message}</p>)}</div>}
      {requested && readiness.valid && definedDepth.active && !definedDepth.valid && <p role="alert">{definedDepth.error}</p>}
      {requested && readiness.valid && rows.some(row => row.category === 'DP' && row.lengthMode === 'auto') && !autoDeployment?.valid && <p role="alert">{autoDeployment?.errors.join(' ')}</p>}
      <div className="bhaTableSection">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="bhaTableWrapper">
            <Table className="bhaComponentTable">
              <colgroup><col className="bhaDragCol" /><col className="bhaNumberCol" /><col className="bhaTypeCol" /><col className="bhaToolCol" />
                <col className="bhaDimensionCol" /><col className="bhaDimensionCol" /><col className="bhaWeightCol" /><col className="bhaLengthCol" /><col className="bhaCumulativeCol" /><col className="bhaDeleteCol" /></colgroup>
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

                  <th>
                    CUM
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
                      standardComponents={standardTools}
                      customComponents={[...myComponents, ...(bha?.projectComponents || [])]}
                      nominalClearance={componentNominalClearance(bha, row)}
                      validation={readiness.rows[index]}
                      deferValidation={focusedNumericRowId === row.rowId}
                      onNumericFocus={() => setFocusedNumericRowId(row.rowId)}
                      onNumericBlur={() => setFocusedNumericRowId(current => current === row.rowId ? null : current)}
                      autoDeployment={autoDeployment}
                      cumulativeLengthFt={cumulativeLengths[index]}
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
          <Button className="bhaAddButton" onClick={() => openComponentEditor?.()}>+ Library Component</Button>
        </div>
      </div>
    </div>
  );
};

export default BHABuilder;
