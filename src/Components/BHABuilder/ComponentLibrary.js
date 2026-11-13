import React from 'react';
import { toolType } from '../../Apps/BHAEntry/toolType';
import { standardComponents, loadStandardComponentOverrides, saveStandardBitOverride, resetStandardComponentOverride, loadMyComponents, saveMyComponents, filterComponents, notifyComponentLibraryChanged } from '../../Apps/BHAEntry/componentStore';
import { componentId, definitionSnapshot, definitionRowPatch, validateDefinition, sectionProperties } from '../../engineering/bha/componentDefinition';
import { resolveBitStructuralProperties } from '../../engineering/bha/bitStructuralProperties';
import './ComponentLibrary.css';
import { deriveCentredStabilizer } from '../../engineering/bha/stabilizerGeometry';
import { componentEntryDefinition, isCentredStabilizer } from './componentEntryDefinition';

const blank = () => ({ id: componentId(), source: 'project', name: '', category: 'OTHER', sectionModel: 'complex', manufacturer: '', model: '', length: '', od: '', idSize: '', weight: '', material: { name: 'Unspecified', densityLbFt3: '', youngsModulusPsi: '' }, notes: '', geometry: { kind: 'uniform', segments: [] } });
const primaryFields = [['length', 'Length (ft)'], ['od', 'OD (in)'], ['idSize', 'ID (in)'], ['weight', 'Nominal linear weight (lb/ft)']];
const types = [...new Set([...toolType.map(t => t.name), ...standardComponents.map(c => c.category)])];

// Presentation only: route the existing validator's messages beside their inputs.
function fieldErrors(errors, scope, key) {
  const messages = scope ? errors.filter(e => e.startsWith(`${scope}:`)) : errors;
  const patterns = { name: /Component name/, category: /Component type/, length: /length must/, od: /OD > ID/, idSize: /OD > ID/,
    weight: /nominal linear weight/, material: /material name/, densityLbFt3: /densityLbFt3/, youngsModulusPsi: /youngsModulusPsi/,
    maximumOd: /maximumOd|Overall maximum OD/, contactDiameter: /contactDiameter|contact diameter/,
    geometry: /At least one segment|Segment lengths|Overall maximum OD|Choose uniform/, provenance: /provenance and limitations/,
    limitations: /provenance and limitations/, axialStiffnessLbf: /axialStiffnessLbf/, waveImpedanceLbfSecFt: /waveImpedanceLbfSecFt/ };
  return messages.filter(e => patterns[key]?.test(e));
}
function Field({ label, errors = [], children }) {
  const id = React.useId();
  return <div className="componentField"><label htmlFor={id}>{label}</label>
    {React.cloneElement(children, { id, 'aria-invalid': errors.length ? true : undefined, 'aria-describedby': errors.length ? `${id}-error` : undefined })}
    {errors.length > 0 && <small className="componentFieldError" id={`${id}-error`} role="alert">{errors.join(' ')}</small>}
  </div>;
}
function SectionFields({ value, onChange, prefix, errors, advanced = false, complexOnly = false, lockMaximum = false }) {
  const err = key => fieldErrors(errors, prefix, key);
  const field = (key, label) => <Field key={key} label={label} errors={err(key)}><input aria-label={`${prefix} ${label}`} inputMode="decimal" readOnly={lockMaximum && key === 'maximumOd'} value={value[key] ?? ''} onChange={e => onChange({ ...value, [key]: e.target.value })} /></Field>;
  if (!advanced) return <>{primaryFields.map(([key, label]) => field(key, label))}</>;
  return <>
    <Field label="Section idealization"><select aria-label={`${prefix} section idealization`} disabled={complexOnly} value={complexOnly ? 'complex' : value.sectionModel || 'annular'} onChange={e => onChange({ ...value, sectionModel: e.target.value })}><option value="annular">Simple annular section</option><option value="complex">Complex tool</option></select></Field>
    {[['maximumOd', 'Maximum OD (in, optional)'], ['contactDiameter', 'Contact diameter (in, optional)']].map(([key, label]) => field(key, label))}
    {[['name', 'Material'], ['densityLbFt3', 'Material density (lb/ft³, optional)'], ['youngsModulusPsi', 'Young’s modulus (psi, optional)']].map(([key, label]) => <Field key={key} label={label + (key === 'name' ? ' (required)' : '')} errors={err(key === 'name' ? 'material' : key)}><input aria-label={`${prefix} ${label}`} value={value.material?.[key] ?? ''} onChange={e => onChange({ ...value, material: { ...value.material, [key]: e.target.value } })} /></Field>)}
  </>;
}

function StabilizerFields({ draft, onChange, derived, attempted }) {
  return <>{[['length', 'Total tool length (ft)'], ['od', 'Body OD (in)'], ['bladeOd', 'Blade OD (in)'], ['bladeLength', 'Blade length (ft)'], ['idSize', 'ID (in)'], ['weight', 'Nominal linear weight (lb/ft)']].map(([key, label]) => {
    const blade = key === 'bladeOd' || key === 'bladeLength';
    return <Field key={key} label={label} errors={attempted && derived.errors[key] ? [derived.errors[key]] : []}><input inputMode="decimal" value={(blade ? draft.stabilizer[key] : draft[key]) ?? ''} onChange={e => onChange(blade ? { ...draft, stabilizer: { ...draft.stabilizer, [key]: e.target.value } } : { ...draft, [key]: e.target.value })} /></Field>;
  })}</>;
}

function StabilizerSummary({ derived }) {
  return <div className="stabilizerSummary" aria-label="Derived stabilizer geometry">
    <p>Blade section centred along the tool. Distances measured from the lower end.</p>
    {derived.valid ? <table><thead><tr><th>Section</th><th>From–to (ft)</th><th>Length (ft)</th><th>External OD (in)</th></tr></thead><tbody>{derived.sections.map(s => <tr key={s.label}><td>{s.label}</td><td>{s.startFt}–{s.endFt}</td><td>{s.length}</td><td>{s.od}</td></tr>)}</tbody></table> : <small>Enter valid dimensions and nominal weight to preview the three sections.</small>}
    <small>Blade OD is the maximum external envelope, not a solid annulus. No blade mass, stiffness or wave impedance is derived. Nominal weight is retained.</small>
  </div>;
}

function BitStructuralFields({ value, onChange, errors = [] }) {
  const props = value || {}, resolved = resolveBitStructuralProperties(props);
  const set = (key, next) => onChange({ ...props, [key]: next });
  const structuralErrors = errors.filter(message => message.startsWith('BIT structural properties:')).map(message => message.replace('BIT structural properties: ', ''));
  const err = text => structuralErrors.filter(message => message.includes(text));
  const dimensionsPresent = props.bodyOdIn !== '' && props.bodyOdIn != null && props.boreIdIn !== '' && props.boreIdIn != null;
  return <fieldset className="bitStructuralFields"><legend>BIT structural properties (separate from cutting OD)</legend>
    <div className="componentEditorGrid">
      <Field label="Structural body / fishneck OD (in)" errors={err('body OD')}><input inputMode="decimal" value={props.bodyOdIn ?? ''} onChange={e => set('bodyOdIn', e.target.value)} /></Field>
      <Field label="Structural bore ID (in)" errors={err('bore ID')}><input inputMode="decimal" value={props.boreIdIn ?? ''} onChange={e => set('boreIdIn', e.target.value)} /></Field>
      <Field label="Calculated equivalent structural area (in²)"><input readOnly value={resolved.calculatedAreaIn2 == null ? '' : resolved.calculatedAreaIn2.toFixed(3)} title="Calculated from structural body OD and bore ID; nominal cutting OD is never used." /></Field>
      <Field label="Direct equivalent area (in²; when dimensions unavailable)" errors={err('Direct area')}><input inputMode="decimal" disabled={dimensionsPresent} value={props.equivalentAreaIn2 ?? ''} onChange={e => set('equivalentAreaIn2', e.target.value)} /></Field>
      <Field label="Material density (kg/m³)" errors={err('Material density')}><input inputMode="decimal" value={props.densityKgM3 ?? ''} onChange={e => set('densityKgM3', e.target.value)} /></Field>
      <Field label="Young's modulus (GPa)" errors={err('Young’s modulus')}><input inputMode="decimal" value={props.youngsModulusGPa ?? ''} onChange={e => set('youngsModulusGPa', e.target.value)} /></Field>
      <Field label="Structural-property source" errors={err('source')}><select value={props.provenanceType || ''} onChange={e => set('provenanceType', e.target.value)}><option value="">Select source</option><option value="manufacturer">Manufacturer supplied</option><option value="calculated">Calculated from supplied dimensions</option><option value="illustrative">Engineering estimate / illustrative assumption</option></select></Field>
      <Field label="Notes / provenance reference" errors={err('provenance')}><textarea value={props.provenance || ''} onChange={e => set('provenance', e.target.value)} rows={2} /></Field>
    </div>
    {resolved.valid && resolved.equivalentAreaIn2 != null && <small>Effective area: {resolved.equivalentAreaIn2.toFixed(3)} in². When dimensions are supplied, calculated area takes precedence; a direct value must agree within 0.01 in².</small>}
  </fieldset>;
}

export default function ComponentLibrary({ bha, updateBha, onClose }) {
  const [mine, setMine] = React.useState([]), [standardOverrides, setStandardOverrides] = React.useState({}), [error, setError] = React.useState(''), [storeWritable, setStoreWritable] = React.useState(true);
  const [source, setSource] = React.useState('my'), [filters, setFilters] = React.useState({});
  const [draft, setDraft] = React.useState(blank), [insert, setInsert] = React.useState(true), [effective, setEffective] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false), [advanced, setAdvanced] = React.useState(false), [editingStandard, setEditingStandard] = React.useState(false);
  const [placement, setPlacement] = React.useState(() => {
    const empty = (bha?.rows || []).find(r => !['category', 'toolName', 'selectedToolId', 'length', 'od', 'idSize', 'weight'].some(k => r[k] !== '' && r[k] != null));
    return empty ? `replace:${empty.rowId}` : 'append';
  });
  const project = bha?.projectComponents || [];
  React.useEffect(() => {
    const read = () => { try { setMine(loadMyComponents()); setStandardOverrides(loadStandardComponentOverrides()); setStoreWritable(true); } catch (e) { setStoreWritable(false); setError(`Could not load component library: ${e.message}`); } };
    read(); window.addEventListener('drillbench-components', read); window.addEventListener('storage', read);
    return () => { window.removeEventListener('drillbench-components', read); window.removeEventListener('storage', read); };
  }, []);
  const persist = list => {
    if (!storeWritable) { setError('My Components could not be read. Stored data has been preserved; use Current BHA only until storage is repaired.'); return false; }
    try { saveMyComponents(list); setMine(list); window.dispatchEvent(new Event('drillbench-components')); return true; }
    catch (e) { setError(`Could not save My Components: ${e.message}`); return false; }
  };
  const start = (value, duplicate = false) => {
    const next = value ? definitionSnapshot(value) : blank();
    if (duplicate) { next.id = componentId(); next.name += ' Copy'; next.source = 'my'; }
    next.geometry ||= { kind: 'uniform', segments: [] };
    next.sectionModel ||= ['DP', 'DC'].includes(next.category) ? 'annular' : 'complex';
    next.material ||= { name: 'Unspecified', densityLbFt3: '', youngsModulusPsi: '' };
    if (next.category === 'STB') next.stabilizer ||= { mode: 'manual' }; // Never infer blades from a legacy OD.
    setDraft(next); setInsert(!value || duplicate); setEffective(Boolean(next.effectiveProperties)); setAttempted(false); setAdvanced(false); setEditingStandard(false); setError('');
  };
  const editStandardBit = value => {
    const next = definitionSnapshot(value);
    next.bitStructuralProperties ||= {};
    setDraft(next); setInsert(false); setEffective(false); setAttempted(false); setAdvanced(false); setEditingStandard(true); setError('');
  };
  const apply = definition => {
    const rows = bha?.rows || [], patch = definitionRowPatch(definition);
    const position = placement.indexOf(':'), mode = placement.slice(0, position), target = placement.slice(position + 1);
    const index = rows.findIndex(r => r.rowId === target);
    if (placement !== 'append' && index < 0) { setError('The chosen BHA row no longer exists. Choose another placement.'); return null; }
    if (mode === 'replace') return rows.map((r, i) => i === index ? { ...r, ...patch } : r);
    const next = [...rows], row = { rowId: componentId(), orientation: 'bottom-to-top', quantity: 1, ...patch };
    next.splice(placement === 'append' ? rows.length : index + (mode === 'after' ? 1 : 0), 0, row);
    return next;
  };
  const save = destination => {
    setAttempted(true); setError('');
    const next = definitionSnapshot({ ...componentEntryDefinition(draft), id: draft.source === destination ? draft.id : componentId(), source: destination });
    if (!effective) delete next.effectiveProperties;
    const validation = validateDefinition(next);
    if (!validation.valid || (isCentredStabilizer(draft) && !deriveCentredStabilizer(draft).valid)) { setAdvanced(true); return; }
    const rows = insert ? apply(next) : null;
    if (insert && !rows) return;
    const collection = destination === 'my' ? mine : project;
    const list = [...collection.filter(c => c.id !== next.id), next];
    if (destination === 'my' && !persist(list)) return;
    updateBha?.({ ...(destination === 'project' ? { projectComponents: list } : {}), ...(insert ? { rows } : {}) });
    onClose?.();
  };
  const saveStandardBit = () => {
    setAttempted(true); setError('');
    const resolved = resolveBitStructuralProperties(draft.bitStructuralProperties);
    if (!resolved.valid) return;
    try {
      if (resolved.hasAny) saveStandardBitOverride(draft.id, draft.bitStructuralProperties);
      else resetStandardComponentOverride(draft.id);
      notifyComponentLibraryChanged(); onClose?.();
    } catch (e) { setError(`Could not save standard BIT override: ${e.message}`); }
  };
  const validation = draft ? validateDefinition({ ...componentEntryDefinition(draft), ...(!effective ? { effectiveProperties: undefined } : {}) }) : null;
  const centred = isCentredStabilizer(draft), derived = centred ? deriveCentredStabilizer(draft) : null;
  const errors = attempted ? (editingStandard ? resolveBitStructuralProperties(draft?.bitStructuralProperties).errors.map(e => `BIT structural properties: ${e}`) : validation?.errors || []) : [];
  const collection = source === 'standard' ? standardComponents.map(c => standardOverrides[String(c.id)] ? { ...c, ...standardOverrides[String(c.id)] } : c) : source === 'my' ? mine : project;
  const segmentChange = (i, value) => setDraft({ ...draft, geometry: { ...draft.geometry, segments: draft.geometry.segments.map((v, j) => i === j ? value : v) } });
  return <section className="componentEditor" aria-label="Component editor">
    <nav aria-label="Component editor views"><button type="button" aria-pressed={!!draft} onClick={() => start()}>New Component</button><button type="button" aria-pressed={!draft} onClick={() => { setDraft(null); setError(''); }}>Manage Components</button></nav>
    {error && <p role="alert">{error}</p>}
    <Field label="Placement"><select aria-label="Component placement" value={placement} onChange={e => setPlacement(e.target.value)}><option value="append">Append after last row</option>{(bha?.rows || []).map((r, i) => <React.Fragment key={r.rowId}>{['replace', 'before', 'after'].map(mode => <option key={mode} value={`${mode}:${r.rowId}`}>{mode === 'replace' ? 'Replace' : `Insert ${mode}`} row {i + 1}: {r.toolName || r.category || 'Empty'}</option>)}</React.Fragment>)}</select></Field>
    {!draft ? <>
      <p>Catalogue data is not certified manufacturer data. Editing a definition does not update existing BHA snapshots.</p>
      <div className="componentEditorGrid">
        <Field label="Source"><select value={source} onChange={e => setSource(e.target.value)}><option value="standard">Standard Library (read only)</option><option value="my">My Components</option><option value="project">Project Components</option></select></Field>
        {[['query', 'Search components'], ['od', 'Filter OD (in)'], ['manufacturer', 'Filter manufacturer']].map(([key, label]) => <Field key={key} label={label}><input value={filters[key] || ''} onChange={e => setFilters({ ...filters, [key]: e.target.value })} /></Field>)}
        <Field label="Filter type"><select value={filters.category || ''} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">All types</option>{types.map(t => <option key={t}>{t}</option>)}</select></Field>
      </div>
      <div className="componentManagementList">{filterComponents(collection, filters).map(c => <div key={c.id}><strong>{c.name}</strong> — {c.od ?? '?'} in — {c.manufacturer || 'Manufacturer unspecified'}
        <div className="componentEditorActions"><button type="button" onClick={() => { const rows = apply(c); if (rows) { updateBha?.({ rows }); onClose?.(); } }}>Use / explicitly update selected row</button>
          <button type="button" onClick={() => start(c, true)}>Duplicate</button>
          {source === 'standard' && c.category === 'BIT' && <button type="button" onClick={() => editStandardBit(c)}>Edit BIT structural properties</button>}
          {source === 'standard' && standardOverrides[String(c.id)] && <button type="button" onClick={() => { try { resetStandardComponentOverride(c.id); setStandardOverrides(loadStandardComponentOverrides()); notifyComponentLibraryChanged(); } catch (e) { setError(`Could not reset standard BIT override: ${e.message}`); } }}>Reset to standard</button>}
          {source !== 'standard' && <><button type="button" onClick={() => start(c)}>Edit definition</button><button type="button" onClick={() => source === 'my' ? persist(mine.filter(x => x.id !== c.id)) : updateBha?.({ projectComponents: project.filter(x => x.id !== c.id) })}>Remove definition</button></>}
          {source === 'project' && <button type="button" onClick={() => persist([...mine, definitionSnapshot({ ...c, id: componentId(), source: 'my' })])}>Save to My Library</button>}
        </div></div>)}</div>
      <button type="button" onClick={onClose}>Cancel</button>
    </> : <form onSubmit={e => { e.preventDefault(); editingStandard ? saveStandardBit() : save('my'); }} noValidate>
      {editingStandard ? <>
        <p><strong>{draft.name}</strong> · nominal cutting diameter {draft.od} in · length {draft.length} ft. These catalogue dimensions are read-only; only the BIT structural wave-model properties are overridden.</p>
        <BitStructuralFields value={draft.bitStructuralProperties} onChange={value => setDraft({ ...draft, bitStructuralProperties: value })} errors={errors} />
      </> : <>
      <div className="componentEditorGrid">
        <Field label="Component name" errors={fieldErrors(errors, null, 'name')}><input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Component type" errors={fieldErrors(errors, null, 'category')}><select value={draft.category} onChange={e => {
          const category = e.target.value, next = { ...draft, category };
          if (category === 'STB') next.stabilizer = { mode: 'centred', bladeOd: '', bladeLength: '' };
          else if (draft.category === 'STB') { delete next.stabilizer; delete next.maximumOd; next.geometry = { kind: 'uniform', segments: [] }; }
          setDraft(next);
        }}>{types.map(t => <option key={t}>{t}</option>)}</select></Field>
        {centred ? <StabilizerFields draft={draft} onChange={setDraft} derived={derived} attempted={attempted} /> : <SectionFields prefix="Component" value={draft} onChange={setDraft} errors={errors} />}
      </div>
      {draft.category === 'BIT' && <BitStructuralFields value={draft.bitStructuralProperties} onChange={value => setDraft({ ...draft, bitStructuralProperties: value })} errors={errors} />}
      {centred && <StabilizerSummary derived={derived} />}
      <details className="componentAdvanced" open={advanced} onToggle={e => setAdvanced(e.currentTarget.open)}><summary>Advanced Properties</summary>
        {draft.category === 'STB' && <label><input type="checkbox" checked={!centred} onChange={e => setDraft(e.target.checked ? { ...componentEntryDefinition(draft), stabilizer: { ...draft.stabilizer, mode: 'manual' } } : { ...draft, stabilizer: { ...draft.stabilizer, mode: 'centred' } })} />Override centred blade geometry (manual)</label>}
        {!centred && <Field label="Geometry" errors={fieldErrors(errors, null, 'geometry')}><select value={draft.geometry.kind} onChange={e => setDraft({ ...draft, geometry: { ...draft.geometry, kind: e.target.value } })}><option value="uniform">Uniform</option><option value="segmented">Segmented</option></select></Field>}
        <div className="componentEditorGrid">
          {[['manufacturer', 'Manufacturer (optional)'], ['model', 'Model / part number (optional)'], ['notes', 'Notes / source reference']].map(([key, label]) => <Field key={key} label={label}><input value={draft[key] || ''} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></Field>)}
          <SectionFields prefix="Component" value={centred ? { ...draft, maximumOd: draft.stabilizer.bladeOd } : draft} onChange={setDraft} errors={errors} advanced complexOnly={draft.category === 'STB'} lockMaximum={centred} />
        </div>
        <small>“Unspecified” records an unknown material; no density or modulus is assumed.</small>
        {centred && fieldErrors(errors, null, 'geometry').map(message => <p role="alert" key={message}>{message}</p>)}
        {!centred && draft.geometry.kind === 'segmented' && <section aria-label="Segmented axial geometry editor">
          <p>Segments run from the bit-facing end toward the surface-facing end. Length sum tolerance: 0.000001 ft. No equivalent stiffness or impedance is inferred.</p>
          {draft.geometry.segments.map((s, i) => <fieldset key={i}><legend>Segment {i + 1} (bit to surface)</legend><div className="componentEditorGrid">
            <Field label="Segment label"><input value={s.label || ''} onChange={e => segmentChange(i, { ...s, label: e.target.value })} /></Field>
            <SectionFields prefix={`Segment ${i + 1}`} value={s} onChange={value => segmentChange(i, value)} errors={errors} />
            <SectionFields prefix={`Segment ${i + 1}`} value={s} onChange={value => segmentChange(i, value)} errors={errors} advanced complexOnly={draft.category === 'STB'} />
          </div><button type="button" onClick={() => setDraft({ ...draft, geometry: { ...draft.geometry, segments: draft.geometry.segments.filter((_, j) => i !== j) } })}>Remove segment {i + 1}</button></fieldset>)}
          <button type="button" onClick={() => setDraft({ ...draft, geometry: { ...draft.geometry, segments: [...draft.geometry.segments, { length: '', od: '', idSize: '', weight: '', sectionModel: draft.sectionModel, material: { ...draft.material } }] } })}>Add segment</button>
        </section>}
        {draft.category === 'STB' ? <p>Stabilizer geometry describes external envelopes only. Nominal weight is retained; blade metal area, mass, axial stiffness and wave impedance are not inferred.</p> : draft.category === 'BIT' ? <p>BIT nominal cutting OD is not used to infer structural wave area. Enter separate structural properties above when available.</p> : <p>Annular geometric area: {sectionProperties(draft).geometricAreaIn2?.toFixed(4) ?? 'Unavailable'} in². Material weight: {sectionProperties(draft).calculatedWeightLbFt?.toFixed(3) ?? 'Unavailable'} lb/ft. Nominal weight is retained.</p>}
        <label><input type="checkbox" checked={effective} onChange={e => { setEffective(e.target.checked); setDraft({ ...draft, effectiveProperties: e.target.checked ? { provenance: '', limitations: '' } : undefined }); }} />Explicit effective properties for a complex tool</label>
        {effective && <div className="componentEditorGrid">{[['axialStiffnessLbf', 'Effective axial rigidity EA (lbf, optional)'], ['waveImpedanceLbfSecFt', 'Axial wave impedance (lbf·s/ft, optional)'], ['provenance', 'Effective property provenance'], ['limitations', 'Effective property limitations']].map(([key, label]) => <Field key={key} label={label} errors={fieldErrors(errors, null, key)}><input value={draft.effectiveProperties?.[key] || ''} onChange={e => setDraft({ ...draft, effectiveProperties: { ...draft.effectiveProperties, [key]: e.target.value } })} /></Field>)}</div>}
      </details>
      </>}
      {validation.warnings.map(w => <p role="status" key={w}>{w}</p>)}
      {!insert && <p>Editing the library definition only. Existing BHA instances retain their snapshots; use Manage Components to explicitly replace a chosen row.</p>}
      <div className="componentEditorActions">{editingStandard ? <button type="submit">Save BIT properties</button> : <><button type="submit">Save to My Library</button><button type="button" onClick={() => save('project')}>Use in Current BHA Only</button></>}<button type="button" onClick={onClose}>Cancel</button></div>
    </form>}
  </section>;
}
