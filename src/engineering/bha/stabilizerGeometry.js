// External stabilizer envelope only. No blade metal area, mass, EA or impedance.
const finite = x => x != null && String(x).trim() !== '' && Number.isFinite(Number(x));
const positive = x => finite(x) && Number(x) > 0;

export function deriveCentredStabilizer(component) {
  const { length, od, idSize, weight } = component;
  const { bladeLength, bladeOd } = component.stabilizer || {};
  const errors = {};
  if (!positive(length)) errors.length = 'Total tool length must be positive (ft).';
  if (!positive(bladeLength) || (positive(length) && Number(bladeLength) > Number(length))) errors.bladeLength = 'Blade length must be positive and no greater than total tool length (ft).';
  if (!positive(od) || !finite(idSize) || Number(idSize) < 0 || Number(idSize) >= Number(od)) errors.od = errors.idSize = 'Require body OD > ID >= 0 (in).';
  if (!positive(bladeOd) || (positive(od) && Number(bladeOd) < Number(od))) errors.bladeOd = 'Blade OD must be at least body OD (in).';
  if (!positive(weight)) errors.weight = 'Nominal linear weight must be positive (lb/ft).';
  if (Object.keys(errors).length) return { valid: false, errors, sections: [] };
  const total = Number(length), blade = Number(bladeLength), endLength = (total - blade) / 2;
  const sections = [
    { label: 'Lower body', length: endLength, od: Number(od), startFt: 0, endFt: endLength },
    { label: 'Blade section', length: blade, od: Number(bladeOd), startFt: endLength, endFt: endLength + blade, externalGeometry: 'blade-envelope' },
    { label: 'Upper body', length: endLength, od: Number(od), startFt: endLength + blade, endFt: total }
  ];
  return { valid: true, errors, sections };
}
