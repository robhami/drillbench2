import {defaultIterationRange,iterationRows,iterationCsv,iterationUnits} from './iterationTablePresentation';
const row=(position,force,impulse,valid=true)=>({scenario:'Base',valid,jarCentreFt:position,jarToStuckFt:position-100,metrics:{peakTensileN:force,fixedTensileNs:impulse}});
test('sorting and unit-aware four-column CSV use only valid base results and retain inputs',()=>{
  const rows=[row(640,2000,30),row(610,3000,20),row(670,1000,40),row(700,9000,900,false),{...row(720,9999,999),scenario:'Sensitivity'}];
  const before=JSON.stringify(rows);
  expect(iterationRows(rows).map(r=>r.jarCentreFt)).toEqual([610,640,670]);
  expect(iterationRows(rows,'force').map(r=>r.jarCentreFt)).toEqual([610,640,670]);
  expect(iterationRows(rows,'impulse').map(r=>r.jarCentreFt)).toEqual([670,640,610]);
  const csv=iterationCsv(rows);
  expect(csv).toContain('(kip)');expect(csv).toContain('(kip·s)');expect(csv).not.toContain('displacement');expect(csv.split('\r\n')).toHaveLength(4);
  expect(csv.split('\r\n')[1].split(',')).toHaveLength(4);expect(csv).not.toContain('9999');
  expect(iterationCsv(rows,'position','si')).toContain('"185.928","155.448","3","20"');
  expect(iterationCsv(rows,'impulse').split('\r\n')[1]).toContain('"670"');
  expect(JSON.stringify(rows)).toBe(before);
});
test('Jar Up CSV reports the simple position sweep and rig-handling limitation',()=>{
  const csv=iterationCsv([row(640,2000,30)],'position','oilfield',true,{loadLbf:185000,strokeIn:7.5,stuckAboveBit:0,lengthUnit:'ft',minimum:610,maximum:670,increment:30,windowEndMs:50});
  expect(csv).toContain('Minimum jar position');
  expect(csv).toContain('Maximum jar position');
  expect(csv).toContain('Position increment');
  expect(csv).toContain('Engineering position comparison — rig handling not verified');
  expect(csv).not.toContain('Stand type');
});

test('force impulse and length conversions follow SI definitions and round-trip without model changes',()=>{
  // International pound, standard gravity and international foot, independently evaluated.
  const newtonsPerKip=1000*.45359237*9.80665;
  const oil=iterationUnits(),si=iterationUnits('si');
  expect(oil.force(newtonsPerKip)).toBeCloseTo(1,14);expect(oil.impulse(3*newtonsPerKip)).toBeCloseTo(3,14);
  expect(si.force(newtonsPerKip)).toBeCloseTo(newtonsPerKip/1000,14);expect(si.impulse(123.45)).toBe(123.45);
  expect(si.length(100)).toBe(30.48);expect(si.toFeet(si.length(640.83))).toBeCloseTo(640.83,10);
  expect(oil.length(640.83)).toBe(640.83);expect(()=>iterationUnits('unknown')).toThrow();
});
test('default range is centred on current jar and stays strictly inside Mode A limits',()=>{
  expect(defaultIterationRange({valid:true,currentCentreFt:640.83,minCentreFt:131.06,maxCentreFt:730.79})).toEqual({min:'610.83',max:'670.83',increment:'30'});
  const near=defaultIterationRange({valid:true,currentCentreFt:5,minCentreFt:0,maxCentreFt:20});
  expect(Number(near.min)).toBeGreaterThan(0);expect(Number(near.max)).toBeLessThan(20);
  expect(defaultIterationRange({valid:false})).toEqual({min:'',max:'',increment:'30'});
});
import { candidateCounts, candidateOutcome, comparisonAxisRange } from './iterationTablePresentation';

test('original reference is separate from alternative counts and remains within the chart axis', () => {
  const rows = [{ scenario: 'Base', movementFt: 0, valid: true }, { scenario: 'Base', movementFt: 30, valid: true },
    { scenario: 'Base', movementFt: -30, valid: false, status: 'incomplete' }];
  const counts = candidateCounts(rows, [{ movementFt: -600, geometryValid: false }, { movementFt: 60, structuralMappingValid: false }]);
  expect(counts.successfulAlternatives).toBe(1);
  expect(counts.alternatives).toBe(4);
  expect(counts.outcomes).toEqual({ successful: 2, 'incomplete computational result': 1, 'geometry exclusion': 1, 'invalid input': 1 });
  expect(candidateOutcome(counts.reference)).toBe('successful');
  expect(comparisonAxisRange(650, 700, 641.87)).toEqual([641.87, 700]);
});
