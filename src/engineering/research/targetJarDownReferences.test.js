import { targetReferenceContext, compatibleTargetReference } from './targetJarDownReferences';
const input = { bha: { id: 'a', mudWeight: 10 }, survey: { valid: true, stations: [{ mdFt: 0 }] }, bitMdFt: 100, surfaceMdFt: 0 };
const candidate = { context: targetReferenceContext(input), units: 'lbf', boundaryDefinition: 'net-upward-local-axial-support', loadCase: 'slackoff', rotationRpm: 0, valueLbf: 2000 };
test('current nonrotating local-axial support is compatible, not implicitly selected', () => expect(compatibleTargetReference(candidate, input)).toBe(true));
test.each([{ loadCase: 'pickup' }, { loadCase: 'rotating', rotationRpm: 150 }, { boundaryDefinition: 'vertical-rig-hookload' }, { units: 'klbf' }, { valueLbf: -1 }, { valueLbf: null }])('incompatible reference metadata is excluded: %j', patch => expect(compatibleTargetReference({ ...candidate, ...patch }, input)).toBe(false));
test.each([{ bha: { ...input.bha, mudWeight: 11 } }, { survey: { valid: true, stations: [{ mdFt: 1 }] } }, { surfaceMdFt: 1 }, { loadCase: 'pickup' }])('upstream identity/case changes invalidate reference: %j', patch => expect(compatibleTargetReference(candidate, { ...input, ...patch })).toBe(false));
