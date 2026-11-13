// Audit-only verification; no production helper supplies the expected integrals.
import {integrate,primary,peaks,sample} from '../../../docs/ValidationStudies/RealBHADynamicAuditStage6E4/independent.cjs';
import {integrateImpulseWindow} from './jarImpulseInterpretation';
test('independent absolute-integral decomposition handles clipping and both signs exactly',()=>{
 const h=[{timeS:0,forceN:-4},{timeS:2,forceN:4}];
 expect(integrate(h,0,2)).toMatchObject({signedNs:0,tensileNs:2,compressiveNs:2,absoluteNs:4});
 expect(integrate(h,.5,1.5)).toMatchObject({signedNs:0,tensileNs:.5,compressiveNs:.5});
 expect(sample(h,1)).toEqual({timeS:1,forceN:0});
 expect(()=>integrate(h,0,3)).toThrow('No extrapolation');
});
test('primary-lobe audit closes on the first zero and does not merge later tensile events',()=>{
 const h=[{timeS:0,forceN:0},{timeS:1,forceN:-4},{timeS:2,forceN:0},{timeS:3,forceN:-8},{timeS:4,forceN:0}];
 expect(primary(h,0)).toMatchObject({status:'complete',startS:0,endS:2,durationS:2,tensileNs:4});
 expect(peaks(h)).toMatchObject({peakTensileN:8,peakTensileTimeS:3,peakAbsoluteN:8,peakAbsoluteTimeS:3,peakCompressiveN:0});
 expect(primary(h.slice(0,2),0).status).toBe('unclosed-lobe');
});
test('independent piecewise absolute primitive agrees with application integration across mixed signs and windows',()=>{
 const h=[{timeS:0,forceN:0},{timeS:.17,forceN:-32},{timeS:.41,forceN:21},{timeS:.49,forceN:-11},{timeS:.83,forceN:7},{timeS:1.1,forceN:0}];
 const app=h.map(x=>({timeS:x.timeS,stuckDynamicForceN:x.forceN}));
 for(const [a,b]of [[0,1.1],[.12,.82],[.41,.49]]){
   const independent=integrate(h,a,b),comparison=integrateImpulseWindow(app,a,b);
   expect(comparison.signedNs).toBeCloseTo(independent.signedNs,12);
   expect(comparison.tensileOnlyNs).toBeCloseTo(independent.tensileNs,12);
   expect(comparison.compressiveOnlyNs).toBeCloseTo(independent.compressiveNs,12);
 }
});
