import fs from 'fs';
import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import reference from '../../../docs/ValidationStudies/OES8p5Stage6C1.reference.json';
import {resolveActiveSurvey,surveyGeometry} from '../../Apps/Survey/surveyAssociation';
import {comparisonGeometry,relocateComparisonJar,calculateRealBhaStatic,listComparisonJars,DYNAMIC_UNAVAILABLE} from './realBhaComparison';
const bha=frozen.workingCopy, before=JSON.stringify(bha), survey=surveyGeometry(resolveActiveSurvey(bha));
const request={bha,survey,bitMdFt:9318,surfaceMdFt:0,mode:'slide',jarIndex:0,targetCompressionKlbf:40};
const tolerance=frozen.tolerances, evidence=[];
const close=(a,b,t)=>expect(Math.abs(a-b)).toBeLessThanOrEqual(t);
afterAll(()=>{
 expect(JSON.stringify(bha)).toBe(before);
 fs.writeFileSync('docs/ValidationStudies/RealBHAJarStage6E2/static-comparisons.json',JSON.stringify({fixtureId:frozen.fixtureId,sourceSha256:frozen.sourceSha256,tolerances:tolerance,comparisons:evidence},null,2));
});
test('unchanged frozen OES working copy reproduces the authoritative static baseline',()=>{
 const result=calculateRealBhaStatic(request); expect(result.valid).toBe(true);
 const v=result.values, primary=reference.cases.find(c=>c.wobLbf===33000);
 close(v.buoyedWeightLbf,reference.totalBuoyedWeightLbf,tolerance.forceLbf);
 close(v.hookloadLbf,primary.surfaceHookloadLbf,tolerance.forceLbf);
 close(v.jarForceLbf,primary.jarAxialForceLbf,tolerance.forceLbf);
 close(v.requiredHookloadLbf,reference.jar.requiredSurfaceHookloadLbf,tolerance.forceLbf);
 close(result.inverse.jarAxialLoadLbf,40000,tolerance.forceLbf);
 close(v.neutralFt,primary.neutralPoint.fromBitFt,tolerance.neutralPointFt);
 close(v.neutralMdFt,primary.neutralPoint.mdFt,tolerance.neutralPointFt);
 expect(v.jarForceLbf).toBeLessThan(0); expect(v.jarMinusNeutralFt).toBeGreaterThan(0);
 close(v.jarCentreFt,(v.jarBottomFt+v.jarTopFt)/2,tolerance.positionFt);
 close(v.jarMdFt+v.jarCentreFt,9318,tolerance.positionFt);
 close(v.jarBottomMdFt+v.jarBottomFt,9318,tolerance.positionFt);
 close(v.jarTopFt-v.jarBottomFt,33,tolerance.positionFt);
 close(v.totalLengthFt,9318,tolerance.positionFt);
 expect(result.dynamicStatus).toBe(DYNAMIC_UNAVAILABLE);
 expect(result).not.toHaveProperty('impactForce');
 evidence.push({label:'Current OES working copy',values:v});
});
test.each([-30,30])('Mode A %s ft preserves inventory and independently matches static changes',delta=>{
 const moved=relocateComparisonJar(bha,0,delta); expect(moved.valid).toBe(true);
 const g=comparisonGeometry(bha,0), rows=moved.bha.rows;
 expect(rows.map(r=>r.rowId)).toEqual(bha.rows.map(r=>r.rowId));
 expect(rows.map(r=>r.category)).toEqual(bha.rows.map(r=>r.category));
 expect(rows[g.index]).toEqual(bha.rows[g.index]);
 rows.map((r,i)=>({r,i})).filter(({i})=>i!==g.index-1&&i!==g.index+1).forEach(({r,i})=>expect(r).toEqual(bha.rows[i]));
 close(Number(rows[g.index-1].length)+Number(rows[g.index+1].length),g.collarInventoryFt,tolerance.positionFt);
 for(const i of [g.index-1,g.index+1]) {
   expect({...rows[i],length:0,componentDefinition:{...rows[i].componentDefinition,length:0}}).toEqual({...bha.rows[i],length:0,componentDefinition:{...bha.rows[i].componentDefinition,length:0}});
   expect(Number(rows[i].componentDefinition.length)).toBe(Number(rows[i].length));
 }
 const result=calculateRealBhaStatic({...request,bha:moved.bha}), primary=reference.cases.find(c=>c.wobLbf===33000); expect(result.valid).toBe(true);
 // Independent vertical equilibrium: moved collar weight below jar = delta*w*(1-rhoMud/rhoSteel).
 const change=delta*100.43*(1-15.5/65.5), v=result.values;
 close(v.jarForceLbf,primary.jarAxialForceLbf-change,tolerance.forceLbf);
 close(v.requiredHookloadLbf,reference.jar.requiredSurfaceHookloadLbf-change,tolerance.forceLbf);
 close(v.jarCentreFt,reference.jar.centreFromBitFt+delta,tolerance.positionFt);
 close(v.jarMdFt,reference.jar.centreMdFt-delta,tolerance.positionFt);
 close(v.hookloadLbf,primary.surfaceHookloadLbf,tolerance.forceLbf);
 close(v.totalAirWeightLbf,reference.totalAirWeightLbf,tolerance.forceLbf);
 close(v.totalLengthFt,9318,tolerance.positionFt);
 // The NP remains within the untouched portion below the moved jar.
 close(v.neutralFt,primary.neutralPoint.fromBitFt,tolerance.neutralPointFt);
 expect(moved.addedCollarFt).toBe(0);
 evidence.push({label:`Mode A ${delta>0?'+':''}${delta} ft`,independentJarForceLbf:primary.jarAxialForceLbf-change,independentRequiredHookloadLbf:reference.jar.requiredSurfaceHookloadLbf-change,values:v});
});
test('Mode B/C are explicitly unsupported; neither L1 nor collar inventory is altered',()=>{
 for(const mode of ['B','C']){const r=relocateComparisonJar(bha,0,30,mode);expect(r.valid).toBe(false);expect(r.error).toContain('unsupported');expect(r.bha).toBeUndefined();}
 expect(JSON.stringify(bha)).toBe(before);
});
test('invalid movements, nonmatching collars and unsupported properties are blocked without substitution',()=>{
 for(const delta of ['',NaN,Infinity,-509.77,89.96,1000])expect(relocateComparisonJar(bha,0,delta).valid).toBe(false);
 const changed=JSON.parse(before);changed.rows[7].idSize=2;expect(relocateComparisonJar(changed,0,20).valid).toBe(false);
 changed.rows[7].idSize=2.813;changed.rows[7].componentDefinition.geometry={kind:'segmented',segments:[]};expect(relocateComparisonJar(changed,0,20).valid).toBe(false);
 const missing=JSON.parse(before);missing.rows[0].idSize='';expect(calculateRealBhaStatic({...request,bha:missing}).error).toContain('Row 1');
 const density=JSON.parse(before);density.rows[0].componentDefinition.material.densityLbFt3=490;expect(calculateRealBhaStatic({...request,bha:density}).valid).toBe(false);
 const quantity=JSON.parse(before);quantity.rows[5].quantity=2;expect(calculateRealBhaStatic({...request,bha:quantity}).error).toContain('quantity');expect(relocateComparisonJar(quantity,0,20).valid).toBe(false);
 const fixedWeight=JSON.parse(before);fixedWeight.rows[5].componentDefinition.totalWeight=123;expect(relocateComparisonJar(fixedWeight,0,20).valid).toBe(false);
 expect(calculateRealBhaStatic({...request,survey:null}).valid).toBe(false);
});
test('multiple jars require explicit selection and selected jar coordinates/loads are consistent',()=>{
 const multiple=JSON.parse(before); multiple.rows.splice(8,0,{...multiple.rows[6],rowId:'second-jar',toolName:'Second jar'});
 expect(listComparisonJars(multiple)).toHaveLength(2);
 expect(calculateRealBhaStatic({...request,bha:multiple,jarIndex:null}).valid).toBe(false);
 const a=calculateRealBhaStatic({...request,bha:multiple,jarIndex:0}), b=calculateRealBhaStatic({...request,bha:multiple,jarIndex:1});
 expect(a.valid&&b.valid).toBe(true);expect(b.jar.name).toBe('Second jar');
 expect(b.values.jarCentreFt).toBeGreaterThan(a.values.jarCentreFt);
 expect(b.values.jarForceLbf).toBeLessThan(a.values.jarForceLbf);
});
