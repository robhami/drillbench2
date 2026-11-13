import data from '../../data/components.json';
import { cloneDefinition, COMPONENT_SCHEMA_VERSION } from '../../engineering/bha/componentDefinition';

export const COMPONENT_STORAGE_KEY = 'drillbenchMyComponents';
export const STANDARD_OVERRIDE_STORAGE_KEY = 'drillbenchStandardComponentOverrides';
export const standardComponents = data.components.map(c => ({ ...c, source: 'standard', schemaVersion: COMPONENT_SCHEMA_VERSION }));
export function loadStandardComponentOverrides(storage = window.localStorage) {
  const raw = storage?.getItem(STANDARD_OVERRIDE_STORAGE_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (parsed.schemaVersion !== COMPONENT_SCHEMA_VERSION || !parsed.overrides || Array.isArray(parsed.overrides) || typeof parsed.overrides !== 'object')
    throw new Error('Unsupported standard-component override schema. Stored overrides have been preserved.');
  return cloneDefinition(parsed.overrides);
}
export function saveStandardBitOverride(id, bitStructuralProperties, storage = window.localStorage) {
  const base = standardComponents.find(c => String(c.id) === String(id));
  if (!base || base.category !== 'BIT') throw new Error('Only a standard BIT can receive structural-property overrides.');
  const overrides = loadStandardComponentOverrides(storage);
  overrides[String(id)] = { bitStructuralProperties: cloneDefinition(bitStructuralProperties) };
  storage.setItem(STANDARD_OVERRIDE_STORAGE_KEY, JSON.stringify({ schemaVersion: COMPONENT_SCHEMA_VERSION, overrides }));
}
export function resetStandardComponentOverride(id, storage = window.localStorage) {
  const overrides = loadStandardComponentOverrides(storage);
  if (!Object.prototype.hasOwnProperty.call(overrides, String(id))) return false;
  delete overrides[String(id)];
  if (Object.keys(overrides).length) storage.setItem(STANDARD_OVERRIDE_STORAGE_KEY, JSON.stringify({ schemaVersion: COMPONENT_SCHEMA_VERSION, overrides }));
  else storage.removeItem(STANDARD_OVERRIDE_STORAGE_KEY);
  return true;
}
export function getResolvedStandardComponent(id, storage = window.localStorage) {
  const base = standardComponents.find(c => String(c.id) === String(id));
  if (!base) return null;
  const override = loadStandardComponentOverrides(storage)[String(id)];
  return override ? { ...base, ...cloneDefinition(override) } : base;
}
export function resolvedStandardComponents(storage = window.localStorage) {
  const overrides = loadStandardComponentOverrides(storage);
  return standardComponents.map(base => overrides[String(base.id)] ? { ...base, ...cloneDefinition(overrides[String(base.id)]) } : base);
}
export function notifyComponentLibraryChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('drillbench-components'));
}
export function loadMyComponents(storage = localStorage) {
  const raw = storage.getItem(COMPONENT_STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (parsed.schemaVersion !== COMPONENT_SCHEMA_VERSION || !Array.isArray(parsed.components)) throw new Error('Unsupported component library schema. Stored library has been preserved.');
  return cloneDefinition(parsed.components);
}
export function saveMyComponents(components, storage = localStorage) {
  storage.setItem(COMPONENT_STORAGE_KEY, JSON.stringify({ schemaVersion: COMPONENT_SCHEMA_VERSION, components }));
}
export function filterComponents(components, { query = '', category = '', od = '', manufacturer = '' } = {}) {
  const match = (value, text) => String(value || '').toLowerCase().includes(text.toLowerCase());
  return components.filter(c => (!category || c.category === category) && (!od || Number(c.od) === Number(od)) && match(c.manufacturer, manufacturer) && match(`${c.name} ${c.category} ${c.od} ${c.manufacturer || ''} ${c.model || ''}`, query));
}
