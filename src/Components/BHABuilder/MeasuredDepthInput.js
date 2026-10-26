import React from 'react';

const ungroup = value => String(value ?? '').replace(/,/g, '');
const formatted = value => {
  const raw = ungroup(value);
  if (!/^-?\d+(\.\d*)?$/.test(raw)) return raw;
  const [integer, fraction] = raw.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
};

// Keep punctuation and partial decimals in the editor, never in persisted MD.
export default function MeasuredDepthInput({ value, readOnly, onChange }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  React.useEffect(() => { setEditing(false); }, [readOnly]);
  return <input className="bhaMdInput" type="text" inputMode="decimal" readOnly={readOnly}
    value={editing && !readOnly ? draft : formatted(value)}
    onFocus={() => { if (!readOnly) { setDraft(ungroup(value)); setEditing(true); } }}
    onBlur={() => setEditing(false)}
    onChange={event => {
      if (readOnly) return;
      const raw = ungroup(event.target.value);
      if (!/^-?\d*(\.\d*)?$/.test(raw)) return;
      const number = Number(raw);
      if (raw !== '' && raw !== '.' && raw !== '-' && raw !== '-.' && !Number.isFinite(number)) return;
      setDraft(event.target.value);
      setEditing(true);
      onChange(raw === '' || raw === '.' || raw === '-' || raw === '-.' ? '' : number);
    }} />;
}
