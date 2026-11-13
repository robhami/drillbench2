import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import study from '../../../docs/ValidationStudies/RealBHADynamicStage6E3/study.json';
import { prepareJarUpSweep, stuckCoordinate } from './jarUpSweep';
import { mapRealBhaWaves, mapRealBhaWaveGeometry, runRealBhaDynamic, FT_M } from './realBhaDynamicComparison';
import { resolveStandConfiguration } from '../jar/standAwareConfiguration';
import * as engine from './twoSidedJarImpact';
const bha=frozen.workingCopy,settings={...study.settings,stuckFromBitFt:100};
const request={bha,jarIndex:0,bitMdFt:9318,settings};
test('MD coordinates use bit MD and reject unknown units/nonfinite inputs',()=>{
  expect(stuckCoordinate(9318,9218,'md')).toEqual({aboveBitFt:100,mdFt:9218});
  expect(stuckCoordinate(9318,100)).toEqual({aboveBitFt:100,mdFt:9218});
  expect(()=>stuckCoordinate(9318,NaN)).toThrow();
  expect(()=>stuckCoordinate(9318,100,'metres')).toThrow();
});
test('sweep retains baseline, conserves inventory/weight/length, and holds terminal coordinate fixed',()=>{
  const before=JSON.stringify(bha);
  const r=prepareJarUpSweep({...request,minimumFt:610.83,maximumFt:670.83,incrementFt:30});
  expect(r.rejected).toEqual([]);expect(r.cases).toHaveLength(3);
  const weight=b=>b.rows.reduce((sum,x)=>sum+Number(x.length)*Number(x.weight),0);
  for(const c of r.cases){
    const map=mapRealBhaWaves({...request,bha:c.bha});
    expect(c.bha.rows.map(x=>x.rowId)).toEqual(bha.rows.map(x=>x.rowId));
    expect(weight(c.bha)).toBeCloseTo(weight(bha),7);
    expect(map.positions.totalLength).toBeCloseTo(9318,8);
    expect(map.stuckMdFt).toBe(9218);
    const low=map.input.lower.sections,up=map.input.upper.sections;
    const bitMap=mapRealBhaWaves({...request,bha:c.bha,settings:{...settings,stuckFromBitFt:0}});
    expect(map.input.upper).toEqual(bitMap.input.upper);
    expect(low.at(-1).fromBitFt).toBe(100);
    expect(low.reduce((sum,s)=>sum+s.lengthM,0)/FT_M).toBeCloseTo(c.jarCentreFt-100,8);
    expect(up.reduce((sum,s)=>sum+s.lengthM,0)/FT_M).toBeCloseTo(9318-c.jarCentreFt,8);
    expect([...low,...up].every(s=>s.lengthM>0)).toBe(true);
    expect(map.firstArrivalS).toBeCloseTo((c.jarCentreFt-100)*FT_M/Math.sqrt(200e9/7850),12);
    const t=low.at(-1);
    expect(t.impedanceNsM).toBeCloseTo(t.areaM2*Math.sqrt(t.densityKgM3*t.youngsModulusPa),8);
    expect(map.input.lower.farBoundary).toBe('fixed');
  }
  expect(JSON.stringify(bha)).toBe(before);
  const extra=prepareJarUpSweep({...request,minimumFt:611,maximumFt:651,incrementFt:20});
  expect(extra.cases.some(c=>c.movementFt===0)).toBe(true);
});
test('invalid geometry is rejected individually; sweep limits prevent unbounded work',()=>{
  const r=prepareJarUpSweep({...request,minimumFt:0,maximumFt:640.83,incrementFt:640.83});
  expect(r.cases).toHaveLength(1);expect(r.rejected).toHaveLength(1);
  expect(r.rejected[0].error).toMatch(/leave|collar/i);
  for(const patch of [{incrementFt:0},{incrementFt:1e-10},{maximumFt:1},{incrementFt:1},{minimumFt:NaN}])expect(()=>prepareJarUpSweep({...request,minimumFt:610,maximumFt:670,incrementFt:30,...patch})).toThrow();
});
test('OES requested range retains its full geometry limits and rejects positions beyond adjacent collar footage',()=>{
  const plan=prepareJarUpSweep({...request,minimumFt:610.83,maximumFt:960.83,incrementFt:30});
  expect(plan.cases.map(candidate=>candidate.jarCentreFt)).toEqual(expect.arrayContaining([610.83,640.83,670.83,700.83]));
  expect(plan.rejected.map(candidate=>candidate.jarCentreFt)).toEqual(expect.arrayContaining([730.83,760.83,790.83,820.83,850.83,880.83,910.83,940.83]));
  expect(plan.rejected.every(candidate=>/leave more than 0\.000001 ft of each adjacent collar/i.test(candidate.error))).toBe(true);
  expect(plan.cases.find(candidate=>candidate.movementFt===0).jarCentreFt).toBeCloseTo(640.83,8);
});
test('invalid terminals and unacknowledged complex interiors are blocked, explicit equivalents retain topology',()=>{
  for(const stuckFromBitFt of [-1,630,9319,.5])expect(()=>mapRealBhaWaves({...request,settings:{...settings,stuckFromBitFt}})).toThrow();
  const inside=mapRealBhaWaves({...request,settings:{...settings,stuckFromBitFt:.5,stuckEquivalentAcknowledged:true}});
  expect(inside.terminalSection.equivalent).toBe(true);
  expect(inside.input.lower.sections.at(-1).fromBitFt).toBe(.5);
  expect(()=>mapRealBhaWaves({...request,settings:{...settings,stuckFromBitFt:.5,stuckEquivalentAcknowledged:true,equivalents:{}}})).toThrow(/equivalent/);
  expect(mapRealBhaWaves({...request,settings:{...settings,stuckFromBitFt:0}}).firstArrivalS).toBeCloseTo(640.83*FT_M/Math.sqrt(200e9/7850),12);
});

test('a compressive absolute maximum is never reported as the tensile peak',()=>{
  // Measurement guard, not a physical impact benchmark. Both refinements receive
  // the same signed history so this isolates reporting from numerical dynamics.
  const histories=[[0,0],[.04,-10],[.06,100],[.12,0]].map(([timeS,stuckDynamicForceN])=>({timeS,stuckDynamicForceN,contactForceN:0}));
  const spy=jest.spyOn(engine,'simulateTwoSidedJarImpact').mockReturnValue({valid:true,histories,events:[],metrics:{peakContactForceN:0,peakAbsoluteDynamicStuckForceN:100},numerical:{maxIncrementalEnergyResidualJ:0,maxMomentumResidualNs:0}});
  try{
    const r=runRealBhaDynamic(request);
    expect(r.valid).toBe(true);
    expect(r.metrics.peakTransmittedN).toBe(100);
    expect(r.metrics.peakTensileN).toBe(10);
    expect(r.metrics.peakCompressiveN).toBe(100);
    expect(r.metrics.fixedSignedNs).toBeCloseTo(r.metrics.fixedCompressiveNs-r.metrics.fixedTensileNs,12);
  }finally{spy.mockRestore();}
});

test('iteration-table baseline remains a reference even when outside the requested range',()=>{
  const range={...request,minimumFt:611,maximumFt:631,incrementFt:20};
  const limited=prepareJarUpSweep({...range,baselineWithinRangeOnly:true});
  expect(limited.cases).toHaveLength(3);
  expect(limited.cases.some(c=>c.movementFt===0)).toBe(true);
  expect(prepareJarUpSweep(range).cases.some(c=>c.movementFt===0)).toBe(true);
  const inside=prepareJarUpSweep({...range,maximumFt:651,baselineWithinRangeOnly:true});
  expect(inside.cases.some(c=>c.movementFt===0)).toBe(true);
});

test('stand-aware Mode A retains current BHA and transfers measured joints using candidate-specific geometry',()=>{
  const original=JSON.stringify(bha),standConfiguration=resolveStandConfiguration({standType:'custom',jointLengthsFt:[30],jarAboveJoints:0,jarBelowJoints:1,bhaRows:bha.rows});
  const plan=prepareJarUpSweep({...request,model:'non-uniform-skeem',positioningMethod:'reposition-existing-dc',standConfiguration,minimumStandChange:-1,maximumStandChange:1,standIncrement:1});
  expect(standConfiguration.valid).toBe(true);
  expect(plan.cases.map(candidate=>candidate.requestedStandChange)).toEqual([-1,0,1]);
  expect(plan.rejected).toEqual([]);
  const baseline=plan.cases.find(candidate=>candidate.requestedStandChange===0);
  expect(baseline.jarCentreFt).toBeCloseTo(640.83,8);
  for(const candidate of plan.cases.filter(item=>item.requestedStandChange!==0)){
    expect(candidate.bha.rows.some(row=>row.toolName?.includes('transferred stand joint'))).toBe(true);
    expect(candidate.totalBhaLengthFt).toBeCloseTo(9318,8);
    const mapped=mapRealBhaWaves({...request,bha:candidate.bha});
    expect(mapped.jarCentreFt).toBeCloseTo(candidate.jarCentreFt,8);
    expect(mapped.input.upper.sections.every(section=>section.lengthM>0)).toBe(true);
    expect(mapped.input.lower.sections.every(section=>section.lengthM>0)).toBe(true);
  }
  expect(JSON.stringify(bha)).toBe(original);
  const constrained=resolveStandConfiguration({standType:'custom',jointLengthsFt:[30,30,30],jarAboveJoints:2,jarBelowJoints:1,bhaRows:bha.rows});
  const oneAlternative=prepareJarUpSweep({...request,model:'non-uniform-skeem',positioningMethod:'reposition-existing-dc',standConfiguration:constrained,minimumStandChange:-1,maximumStandChange:1,standIncrement:1});
  expect(oneAlternative.cases.map(candidate=>candidate.requestedStandChange)).toEqual([-1,0]);
  expect(oneAlternative.rejected).toHaveLength(1);
  expect(oneAlternative.rejected[0].standChange).toBe(1);
});

test('current BHA remains calculable when measured stand makeup is unavailable',()=>{
  const missingMakeup=resolveStandConfiguration({standType:'triple',jointLengthsFt:[],jarAboveJoints:2,jarBelowJoints:1,bhaRows:bha.rows});
  const plan=prepareJarUpSweep({...request,model:'non-uniform-skeem',positioningMethod:'reposition-existing-dc',standConfiguration:missingMakeup,minimumStandChange:-1,maximumStandChange:1,standIncrement:1});
  expect(plan.cases).toHaveLength(1);
  expect(plan.cases[0].requestedStandChange).toBe(0);
  expect(plan.cases[0].jarCentreFt).toBeCloseTo(640.83,8);
  expect(plan.rejected).toHaveLength(1);
  expect(plan.rejected[0].error).toMatch(/Stand alternatives unavailable/);
});

test('25-position capacity retains the current jar and rejects a 26th case',()=>{
  const range={...request,minimumFt:580.83,maximumFt:700.83,incrementFt:5,baselineWithinRangeOnly:true};
  const plan=prepareJarUpSweep(range);
  expect(plan.cases).toHaveLength(25);expect(plan.rejected).toEqual([]);expect(plan.cases.filter(c=>c.movementFt===0)).toHaveLength(1);
  expect(()=>prepareJarUpSweep({...range,maximumFt:705.83})).toThrow('25');
});

test('fixed-anvil sweep sends candidate-specific BHA geometry to the non-uniform Skeem mapper',()=>{
  const original=JSON.stringify(bha);
  const plan=prepareJarUpSweep({...request,model:'non-uniform-skeem',positioningMethod:'fixed-anvil-vary-above',jointLengthFt:30,minimumJoints:0,maximumJoints:2,jointIncrement:1,inventoryAction:'add-remove',inventoryMode:'add'});
  expect(plan.rejected).toEqual([]);expect(plan.cases).toHaveLength(3);
  expect(plan.cases.map(c=>c.requestedJointChange)).toEqual([0,1,2]);
  const maps=plan.cases.map(c=>mapRealBhaWaveGeometry({...request,bha:c.bha}));
  maps.forEach(map=>expect(map.jarCentreFt).toBeCloseTo(640.83,10));
  expect(maps[0].lower).toEqual(maps[1].lower);
  expect(maps[1].upper.reduce((s,x)=>s+x.lengthM,0)).toBeCloseTo(maps[0].upper.reduce((s,x)=>s+x.lengthM,0),8);
  const dcId=bha.rows[7].rowId, dpId=bha.rows.at(-1).rowId;
  expect(maps[1].mapping.find(row=>row.rowId===dcId).lengthFt-maps[0].mapping.find(row=>row.rowId===dcId).lengthFt).toBeCloseTo(30,8);
  expect(maps[1].mapping.find(row=>row.rowId===dpId).lengthFt-maps[0].mapping.find(row=>row.rowId===dpId).lengthFt).toBeCloseTo(-30,8);
  expect(plan.cases[2].totalBhaLengthFt-plan.cases[0].totalBhaLengthFt).toBeCloseTo(0,8);
  expect(JSON.stringify(bha)).toBe(original);
});
