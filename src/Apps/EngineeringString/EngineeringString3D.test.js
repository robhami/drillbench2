import { classifyEngineeringSection, get3DComponentKind, mapStringPosition } from './EngineeringString3D';
import { hasBitComponent } from './stringDisplayExtent';

test('the renderer recognizes the actual bit type and stabilizers', () => {
    expect(get3DComponentKind({ category: 'BIT', toolName: '8.5 TCI Roller Cone' })).toBe('TCI');
    expect(get3DComponentKind({ category: 'BIT', description: 'PDC bit' })).toBe('PDC');
    expect(get3DComponentKind({ category: 'BIT', name: '8.5-inch PDC Drill Bit' })).toBe('PDC');
    expect(get3DComponentKind({ category: 'STAB' })).toBe('STB');
    expect(hasBitComponent([{ category: 'DC' }])).toBe(false);
    expect(hasBitComponent([{ category: 'BIT' }])).toBe(true);
});

test('engineering positions map linearly into the displayed schematic extent', () => {
    expect(mapStringPosition(0, 100)).toBe(-4.25);
    expect(mapStringPosition(100, 100)).toBe(4.25);
    expect(mapStringPosition(25, 100)).toBe(-2.125);
});

test('visual section colours follow the existing contiguous DC intervals and actual component boundaries', () => {
    const rows = [
        { rowId: 'bit', category: 'BIT', startFromBit: 0, endFromBit: 1 },
        { rowId: 'stb', category: 'STB', startFromBit: 1, endFromBit: 5 },
        { rowId: 'lower-dc', category: 'DC', startFromBit: 5, endFromBit: 10 },
        { rowId: 'jar', category: 'JAR', startFromBit: 10, endFromBit: 20 },
        { rowId: 'upper-dc', category: 'DC', startFromBit: 20, endFromBit: 25 },
        { rowId: 'other-dc', category: 'DC', startFromBit: 25, endFromBit: 30 },
        { rowId: 'hwdp', category: 'HWDP', startFromBit: 30, endFromBit: 40 },
        { rowId: 'dp', category: 'DP', startFromBit: 40, endFromBit: 100 }
    ];
    const sections = {
        below: { lengthFt: 5, startFt: 5, endFt: 10 },
        above: { lengthFt: 5, startFt: 20, endFt: 25 }
    };
    expect(rows.map(row => classifyEngineeringSection(row, rows, sections))).toEqual([
        'lowerBha', 'lowerBha', 'lowerDc', 'jar', 'upperDc', 'fallback', 'hwdp', 'dp'
    ]);
});

test('with no contiguous DC below jar, components below the jar are lower BHA and unrelated DC remains neutral', () => {
    const rows = [
        { category: 'BIT', startFromBit: 0, endFromBit: 1 },
        { category: 'STB', startFromBit: 1, endFromBit: 5 },
        { category: 'JAR', startFromBit: 5, endFromBit: 15 },
        { category: 'DC', startFromBit: 15, endFromBit: 25 }
    ];
    expect(classifyEngineeringSection(rows[0], rows, { below: { lengthFt: 0 }, above: { lengthFt: 0 } })).toBe('lowerBha');
    expect(classifyEngineeringSection(rows[1], rows, { below: { lengthFt: 0 }, above: { lengthFt: 0 } })).toBe('lowerBha');
    expect(classifyEngineeringSection(rows[3], rows, { below: { lengthFt: 0 }, above: { lengthFt: 0 } })).toBe('fallback');
});
