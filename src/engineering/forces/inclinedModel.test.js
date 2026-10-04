import { buildEngModel } from '../models/buildEngModel';
import { calcNeutralPoint } from './calcNeutralPoint';
import { analyzeJarPlacement } from '../jar/jarAnalysis';
const BF = 1 - 10 / 65.5;
const row = (category, length, weight) => ({category,toolName:category,length,weight,od:8});
const make = (inclination, rows) => ({inclination,rows,wob:30,mudWeight:10,holeSize:12.25});
const close = (a,b) => expect(a).toBeCloseTo(b,5);
describe('straight constant-inclination, no-drag screening', () => {
 test('zero degrees exactly reproduces vertical boundary loads and neutral point', () => {
  const rows=[row('DC',100,200),row('JAR',30,150),row('DC',100,200)];
  const legacy=buildEngModel({rows,wob:30,mudWeight:10,holeSize:12.25});
  const zero=buildEngModel(make(0,rows));
  zero.axialLoads.components.forEach((c,i)=>{
    close(c.bottomAxialForce,legacy.axialLoads.components[i].bottomAxialForce);
    close(c.topAxialForce,legacy.axialLoads.components[i].topAxialForce);
  });
  close(calcNeutralPoint(zero).neutralPointFromBit,calcNeutralPoint(legacy).neutralPointFromBit);
 });
 test('60 degrees: projected axial gravity halves and neutral point moves', () => {
  const model=buildEngModel(make(60,[row('DC',400,200)]));
  close(model.axialLoads.bitAxialForce,30000);
  close(model.axialLoads.topOfBhaAxialForce,30000-80000*BF*0.5);
  close(calcNeutralPoint(model).neutralPointFromBit,30000/(200*BF*0.5));
 });
 test('90 degrees: no axial gravity and no neutral point for positive WOB', () => {
  const model=buildEngModel(make(90,[row('DC',400,200)]));
  close(model.axialLoads.topOfBhaAxialForce,30000);
  expect(calcNeutralPoint(model).neutralPointFound).toBe(false);
 });
 test('inclined jar straddles neutral point when reference forces cross inside it', () => {
  const assembly=make(60,[row('DC',320,200),row('JAR',60,150),row('DC',100,200)]);
  const result=analyzeJarPlacement(assembly);
  const expected=320+(30000-320*200*BF*0.5)/(150*BF*0.5);
  close(result.neutralPointFt,expected);
  expect(result.jars[0].issues.some(s=>s.includes('inside jar'))).toBe(true);
 });
});
