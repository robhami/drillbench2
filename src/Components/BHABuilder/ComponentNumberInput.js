import React, { useEffect, useState } from 'react';

// Presentation only: never parse, round or write the stored/editor value.
export default function ComponentNumberInput({ value, minimumFractionDigits, maximumFractionDigits, onChange, onFocus, onBlur, ...props }) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [props.readOnly]);
  const raw = value ?? '';
  const display = (maximumFractionDigits !== undefined || minimumFractionDigits !== undefined) && String(raw).trim() !== '' && Number.isFinite(Number(raw))
    ? Number(raw).toLocaleString('en-US', { minimumFractionDigits, maximumFractionDigits }) : raw;
  return <input {...props} value={editing && !props.readOnly ? raw : display}
    onFocus={event => { if (!props.readOnly) setEditing(true); onFocus?.(event); }} onBlur={event => { setEditing(false); onBlur?.(event); }}
    onChange={event => { if (!props.readOnly) { setEditing(true); onChange?.(event); } }} />;
}
