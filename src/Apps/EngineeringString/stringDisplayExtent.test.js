import { getStringDisplayExtent } from './stringDisplayExtent';

const component = (category, startFromBit, endFromBit, bottomAxialForce, topAxialForce) => Object.freeze({
    category, startFromBit, endFromBit, length: endFromBit - startFromBit,
    centreFromBit: (startFromBit + endFromBit) / 2, bottomAxialForce, topAxialForce
});
const bha = [component('DC', 0, 160, 10000, -5000), component('JAR', 160, 190, -5000, -6000), component('DC', 190, 230, -6000, -8000)];

test('wholly tensile DP contributes context, not its full length, without changing source geometry', () => {
    const string = Object.freeze([...bha, component('DP', 230, 10230, -8000, -50000)]);
    expect(getStringDisplayExtent(string, 111.268454456982)).toBe(253);
    expect(string[3]).toMatchObject({ length: 10000, centreFromBit: 5230, topAxialForce: -50000 });
    expect(string[1].centreFromBit).toBe(175);
});

test('selected-mode NP within DP extends the range, with context beyond NP', () => {
    const string = [...bha, component('DP', 230, 10230, 5000, -50000)];
    expect(getStringDisplayExtent(string, 500)).toBe(523);
    expect(getStringDisplayExtent(string, 700)).toBe(723);
    expect(getStringDisplayExtent(string, 10220)).toBe(10230);
});

test('multiple DP rows retain compressed rows and reach NP inside a later DP row', () => {
    const string = [...bha, component('DP', 230, 330, 5000, 3000), component('DP', 330, 10330, 3000, -50000)];
    expect(getStringDisplayExtent(string, 800)).toBe(823);
});

test('no crossing retains fully compressed DP but truncates fully tensile DP', () => {
    expect(getStringDisplayExtent([...bha, component('DP', 230, 10230, 5000, 2000)], null)).toBe(10230);
    expect(getStringDisplayExtent([...bha, component('DP', 230, 10230, -5000, -20000)], null)).toBe(253);
});

test('BHA without DP, short DP, DP-only strings, empty strings and unknown loads retain available geometry', () => {
    expect(getStringDisplayExtent(bha, 0)).toBe(230);
    expect(getStringDisplayExtent([...bha, component('DP', 230, 240, -5000, -6000)], 111)).toBe(240);
    expect(getStringDisplayExtent([component('DP', 0, 1000, -5000, -6000)], null)).toBe(1000);
    expect(getStringDisplayExtent([], null)).toBe(0);
    expect(getStringDisplayExtent([...bha, component('DP', 230, 10230)], null)).toBe(10230);
});
