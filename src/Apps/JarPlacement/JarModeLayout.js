import React from 'react';

// Mode-specific physics stays with the existing adapters; this component owns
// the common visible hierarchy for both modes.
export default function JarModeLayout({ label, className = '', warningClassName = '', inputs,
  graph, graphClassName = '', graphLabel, results, details, detailsClassName = '', detailsResetKey = 0 }) {
  return <section className={`jarModeLayout ${className}`} aria-label={label}>
    <p className={`jarModelNotice ${warningClassName}`}>Idealised research model — Not for operational use</p>
    {inputs}
    <section className={`jarHistoryArea ${graphClassName}`} aria-label={graphLabel}>{graph}</section>
    {results}
    <details key={detailsResetKey} className={`jarEngineeringDetails ${detailsClassName}`}><summary>Engineering Details</summary>{details}</details>
  </section>;
}

export function JarResetButton({ mode, onClick }) {
  return <button type="button" className="jarCalculationReset" aria-label={`Reset Jar ${mode} calculation`} onClick={onClick}>Reset</button>;
}

export function JarCalculationResults({ rows, className = '' }) {
  return <dl className={`jarPerformanceResults jarUnifiedResults ${className}`}>
    {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd aria-label={value === '—' ? 'Not calculated' : undefined} className={value === '—' ? 'jarResultPlaceholder' : undefined}>{value}</dd></div>)}
  </dl>;
}

export function JarDirectionTabs({ value, onChange, idPrefix }) {
  const modes = ['up', 'down'];
  function move(event, mode) {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = modes[(modes.indexOf(mode) + 1) % 2];
    if (event.key === 'Home') next = 'up';
    if (event.key === 'End') next = 'down';
    if (next) { event.preventDefault(); onChange(next); document.getElementById(`${idPrefix}-tab-${next}`)?.focus(); }
  }
  return <div className="jarDirectionTabs" role="tablist" aria-label="Jarring direction">
    {modes.map(mode => <button key={mode} type="button" role="tab" id={`${idPrefix}-tab-${mode}`}
      aria-controls={`${idPrefix}-panel-${mode}`} aria-selected={value === mode} tabIndex={value === mode ? 0 : -1}
      onClick={() => onChange(mode)} onKeyDown={event => move(event, mode)}>Jar {mode === 'up' ? 'Up' : 'Down'}</button>)}
  </div>;
}
