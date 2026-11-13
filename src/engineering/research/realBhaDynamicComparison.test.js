import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import study from '../../../docs/ValidationStudies/RealBHADynamicStage6E3/study.json';
import {mapRealBhaWaves,runRealBhaDynamic,FT_M,IN2_M2} from './realBhaDynamicComparison';
import {relocateComparisonJar} from '../jar/realBhaComparison';
import * as contactEngine from './twoSidedJarImpact';
const bha=frozen.workingCopy,settings=study.settings,request={bha,bitMdFt:9318,surfaceMdFt:0,jarIndex:0,settings};
jest.setTimeout(300000);
test('OES mapping preserves order, segments, exact deployed lengths and explicitly assumed impedances',()=>{
 const before=JSON.stringify(bha), map=mapRealBhaWaves(request);
 expect(map.mapping.map(x=>x.rowId)).toEqual(bha.rows.map(x=>x.rowId));
 expect(map.mapping[0].sections).toHaveLength(3);
 expect(map.mapping[0].sections.every(s=>s.areaM2===settings.equivalents[bha.rows[0].rowId].areaM2)).toBe(true);
 expect(map.positions.totalLength).toBeCloseTo(9318,8);
 const networks=[...map.input.lower.sections,...map.input.upper.sections];
 expect(networks.reduce((sum,s)=>sum+s.lengthM,0)/FT_M).toBeCloseTo(9318,7);
 const area=Math.PI/4*(6.5**2-2.813**2)*IN2_M2;
 expect(map.mapping[5].sections[0].areaM2).toBeCloseTo(area,12);
 expect(map.mapping[5].sections[0].impedanceNsM).toBeCloseTo(area*Math.sqrt(7850*200e9),6);
 expect(map.firstArrivalS).toBeCloseTo(640.83*.3048/Math.sqrt(200e9/7850),12);
 expect(map.input.release).toEqual({timeS:0,relativeVelocityMS:2});expect(map.input.strokeM).toBe(0);
 expect(map.input.equilibrium.axialForceN).toBe(0);expect(map.input.lower.farBoundary).toBe('fixed');
 expect(JSON.stringify(bha)).toBe(before);
 const clipped=mapRealBhaWaves({...request,settings:{...settings,stuckFromBitFt:100}});
 expect(clipped.input.lower.sections.reduce((sum,s)=>sum+s.lengthM,0)/FT_M).toBeCloseTo(540.83,8);
});
test('complex properties, missing materials, invalid boundaries and unsupported mechanisms are blocked',()=>{
 for(const patch of [{equivalents:{}},{densityKgM3:0},{massKg:0},{velocityMS:6},{stiffnessNm:1e9},{acknowledged:false},{hammerExcluded:false},{stuckFromBitFt:630},{damping:1},{windowEndS:.3},{staticTreatment:'distributed-preload'}])expect(runRealBhaDynamic({...request,settings:{...settings,...patch}}).valid).toBe(false);
 expect(runRealBhaDynamic({...request,bha:{...bha,trajectoryMode:'directional'}}).valid).toBe(false);
 const missingBore=JSON.parse(JSON.stringify(bha));missingBore.rows[1].idSize=null;
 expect(runRealBhaDynamic({...request,bha:missingBore}).error).toContain('OD and ID required');
});
test.each([0,-30,30])('actual Mode A %s ft: numerical safeguards, timing, metrics and reproducibility',move=>{
 const candidate=move===0?bha:relocateComparisonJar(bha,0,move).bha,r=runRealBhaDynamic({...request,bha:candidate});
 expect(r.valid).toBe(true);expect(r.numerical.convergence.status).toBe('passed-two-resolution-check');
 expect(r.metricConvergence.every(c=>c.difference<=c.limit)).toBe(true);
 expect(r.metrics.energyResidualJ).toBeLessThanOrEqual(3e-5*settings.massKg*settings.velocityMS**2/2+1e-10);
 expect(r.metrics.minContactN).toBeGreaterThanOrEqual(0);
 expect(r.events.find(e=>e.type==='release').hammerVelocityAfterMS).toBe(-settings.velocityMS);
 expect(r.events.find(e=>e.type==='release').workJ).toBe(settings.massKg*settings.velocityMS**2/2);
 expect(r.metrics.firstResponseS).toBeGreaterThanOrEqual(r.firstArrivalS-1e-9);
 expect(r.metrics.firstResponseS-r.firstArrivalS).toBeLessThan(2*r.numerical.maxStepS+1e-9);
 const prior=study.results.find(x=>x.scenario==='Base'&&x.movementFt===move);
 expect(r.metrics.peakTransmittedN).toBeCloseTo(prior.metrics.peakTransmittedN,2);
 expect(r.metrics.fixedSignedNs).toBeCloseTo(prior.metrics.fixedSignedNs,3);
 expect(r.mapping.reduce((a,m)=>a+m.lengthFt,0)).toBeCloseTo(9318,8);
});
test('failed conservation or incomplete engine runs never expose numerical metrics',()=>{
 for(const status of ['energy-accounting-failure','numerical-nonconvergence','incomplete-simulation']){
   const spy=jest.spyOn(contactEngine,'simulateTwoSidedJarImpact').mockReturnValueOnce({valid:false,status,error:'Synthetic engine failure for adapter guard test.'});
   const r=runRealBhaDynamic(request);expect(r.valid).toBe(false);expect(r.metrics).toBeNull();expect(r.status).toBe(status);spy.mockRestore();
 }
});
function analyticCase(unequal=false,subdivide=false) {
 const A=.001,rho=1000,E=1e9,od=Math.sqrt(4*A/Math.PI)/.0254;
 const row=(id,category,lengthM)=>({rowId:id,category,toolName:id,length:lengthM/FT_M,od,idSize:0,weight:1});
 const lower=row('lower','DC',9.99);
 if(subdivide||unequal)lower.componentDefinition={geometry:{kind:'segmented',segments:[{length:6/FT_M,od:unequal?od*Math.sqrt(2):od,idSize:0},{length:3.99/FT_M,od,idSize:0}]}};
 const example={trajectoryMode:'vertical',rows:[lower,row('jar','JAR',.02),row('upper','DC',10),row('pipe','DP',0)]};
 const s={...settings,massKg:10,velocityMS:1,stiffnessNm:1e6,densityKgM3:rho,youngsModulusPa:E,durationS:.016,windowEndS:.016,equivalents:{jar:{areaM2:A,densityKgM3:rho,youngsModulusPa:E,provenance:'Analytical uniform-rod apparatus; not a drilling jar.'}}};
 return {bha:example,bitMdFt:110/FT_M,jarIndex:0,settings:s};
}
test('independent uniform/two-section analytical first-pulse peaks and equal subdivision limit',()=>{
 // Before feedback reaches observation: delta=v0 exp(-a t) sin(b t)/b;
 // a=k/(2*(Zu+Zl)), b=sqrt(k/M-a²), fixed end doubles incident wave.
 const a=250,b=Math.sqrt(1e6/10-a*a),tp=Math.atan(b/a)/b,peak=1e6*Math.exp(-a*tp)*Math.sin(b*tp)/b;
 const uniform=runRealBhaDynamic(analyticCase()),split=runRealBhaDynamic(analyticCase(false,true)),unequal=runRealBhaDynamic(analyticCase(true));
 for(const r of [uniform,split,unequal])expect(r.valid).toBe(true);
 expect(Math.abs(uniform.metrics.peakTransmittedN-peak)).toBeLessThan(peak*.001+.01);
 expect(Math.abs(unequal.metrics.peakTransmittedN-peak*4/3)).toBeLessThan(peak*4/3*.001+.01);
 expect(Math.abs(split.metrics.peakTransmittedN-uniform.metrics.peakTransmittedN)).toBeLessThan(.01);
 expect(uniform.firstArrivalS).toBeCloseTo(.01,10);
 expect(uniform.metrics.firstImpulseNs).toBeNull(); // Horizon ends before lobe closure; never substitute zero.
});
