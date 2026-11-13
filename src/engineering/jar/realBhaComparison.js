// Geometry/orchestration only. All static physics comes from established engines.
import { deployDrillstring } from '../bha/deployDrillstring';
import { calcComponentPositions } from '../bha/calcComponentPositions';
import { populatedComponent } from '../bha/componentApplicability';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';
import { calcStringWeightSummary } from '../bha/calcStringWeightSummary';
import { solveStaticJarHookload } from './inverseStaticJarLoads';

export const DYNAMIC_UNAVAILABLE = 'Dynamic impact comparison unavailable — jar-specific dynamic parameters and model applicability not established.';
const fail = error => ({ valid:false, error });
const finite = x => x !== '' && x != null && Number.isFinite(Number(x));
const cat = r => String(r?.category || '').toUpperCase();
const unitQuantity = r => r.quantity==null || r.quantity==='' || Number(r.quantity)===1;
export function listComparisonJars(bha) {
  return (bha?.rows || []).filter(populatedComponent).flatMap((r,i)=>cat(r)==='JAR'?[{ rowIndex:i, name:r.toolName || `Jar at row ${i+1}` }]:[]);
}
export function comparisonGeometry(bha, jarIndex) {
  const rows=(bha?.rows || []).filter(populatedComponent), jars=listComparisonJars(bha);
  if (!Number.isInteger(jarIndex) || !jars[jarIndex]) return fail('Select a jar explicitly; no jar is substituted.');
  const index=jars[jarIndex].rowIndex, jar=rows[index], lower=rows[index-1], upper=rows[index+1];
  const base={ rows,index,jar,jarIndex,lower,upper };
  if (cat(lower)!=='DC'||cat(upper)!=='DC') return {...base,...fail('Mode A requires adjacent uniform drill-collar rows on both sides of the selected jar. Stabilizers, HWDP and other tools cannot be crossed.')};
  const uniform=r=>(!r.componentDefinition?.geometry || r.componentDefinition.geometry.kind==='uniform') && r.componentDefinition?.sectionModel!=='complex' && !r.componentDefinition?.effectiveProperties;
  if (![lower,upper].every(r=>uniform(r)&&unitQuantity(r))) return {...base,...fail('Segmented, complex or quantity-based collars cannot be resized by this continuous-length relocation operation.')};
  if ([lower,upper].some(r=>finite(r.componentDefinition?.totalWeight))) return {...base,...fail('Collars with independently specified total weight require an explicit resizing policy; nominal footage is not substituted.')};
  const signature=r=>JSON.stringify({ od:Number(r.od),id:Number(r.idSize),weight:Number(r.weight),orientation:r.orientation,toolId:r.selectedToolId,
    definition:r.componentDefinition?{...r.componentDefinition,length:null}:null });
  if (signature(lower)!==signature(upper)) return {...base,...fail('Mode A can transfer footage only between adjacent collars with identical properties and definition identity. Mixed collar sections elsewhere are retained; no equivalent collar is substituted.')};
  if (![lower.length,upper.length,jar.length].every(v=>finite(v)&&Number(v)>0)) return {...base,...fail('Positive collar and jar lengths are required.')};
  const offset=rows.slice(0,index-1).reduce((s,r)=>s+Number(r.length),0), centre=offset+Number(lower.length)+Number(jar.length)/2;
  return {...base,valid:true,offsetFt:offset,currentCentreFt:centre,minCentreFt:offset+Number(jar.length)/2,maxCentreFt:offset+Number(lower.length)+Number(upper.length)+Number(jar.length)/2,
    collarInventoryFt:Number(lower.length)+Number(upper.length)};
}
export function relocateComparisonJar(bha, jarIndex, movementFt, mode='A') {
  if (mode!=='A') return fail(`Mode ${mode} real mixed-BHA alternatives are unsupported. Existing Mode ${mode} behaviour is retained in the legacy workflow; no new collar inventory or deployment policy is assumed.`);
  const g=comparisonGeometry(bha,jarIndex); if(!g.valid)return g;
  if (!finite(movementFt)) return fail('Enter a finite movement in ft; positive is toward surface, negative toward bit.');
  const delta=Number(movementFt), a=Number(g.lower.length)+delta, b=Number(g.upper.length)-delta;
  if (a<=1e-6||b<=1e-6) return fail('Movement must leave more than 0.000001 ft of each adjacent collar. No tool is crossed and no length is clamped.');
  const candidate=JSON.parse(JSON.stringify(bha));
  // Preserve all rows, order, metadata and snapshots; change only the two preview lengths.
  const populated=candidate.rows.filter(populatedComponent);
  [[g.index-1,a],[g.index+1,b]].forEach(([i,length])=>{
    populated[i].length=length;
    if(populated[i].componentDefinition)populated[i].componentDefinition.length=length;
  });
  return {valid:true,bha:candidate,movementFt:delta,addedCollarFt:0,redistributedCollarFt:Math.abs(delta),geometry:g};
}
export function calculateRealBhaStatic({bha,survey,bitMdFt,surfaceMdFt=0,mode='slide',jarIndex,targetCompressionKlbf=40}) {
  const jars=listComparisonJars(bha); if(!Number.isInteger(jarIndex)||!jars[jarIndex])return fail('Select a valid jar.');
  const rows=(bha?.rows||[]).filter(populatedComponent);
  for(const [i,r] of rows.entries()) {
    if(!unitQuantity(r))return fail(`Row ${i+1}: quantity-based expansion is not supported by this comparison; explicit component lengths must represent the deployed inventory.`);
    if(!finite(r.od)||Number(r.od)<=0||!finite(r.idSize)||Number(r.idSize)<0||Number(r.idSize)>=Number(r.od)||!finite(r.weight)||Number(r.weight)<=0)
      return fail(`Row ${i+1} (${r.toolName||r.category}): explicit OD > ID >= 0 and positive nominal weight are required. Missing values are not inferred.`);
  }
  const deployment=deployDrillstring(bha,bitMdFt,{surfaceMdFt});
  if(!deployment.valid)return fail(deployment.errors.join(' '));
  const request={bha:deployment.bha,survey,bitMdFt,surfaceMdFt,mode,jarIndex,wobLbf:finite(bha.wob)?Number(bha.wob)*1000:'',mudWeightPpg:bha.mudWeight,frictionCoefficient:bha.frictionCoefficient,rpm:bha.rpm,ropFtHr:bha.rop};
  const load=calcSurveyAxialLoads(request); if(!load.valid)return {...fail(load.errors.join(' ')),status:load.status};
  const weights=calcStringWeightSummary(request);
  const inverse=finite(targetCompressionKlbf)&&Number(targetCompressionKlbf)>0 ? solveStaticJarHookload({...request,jarDirection:'down',desiredJarForceLbf:Number(targetCompressionKlbf)*1000}) : {valid:false,errors:['Enter a positive jar compression target in klbf.']};
  const positions=calcComponentPositions(deployment.bha), component=positions.components[jars[jarIndex].rowIndex], jar=load.jars[jarIndex];
  const neutral=load.neutralPoints.length===1&&!load.neutralIntervals.length?load.neutralPoints[0]:null;
  return {valid:true,load,weights,inverse,positions,jar,component,deployment:deployment.metadata,
    values:{jarCentreFt:jar.centreFromBitFt,jarMdFt:jar.mdFt,jarBottomFt:component.startFromBit,jarTopFt:component.endFromBit,
      jarBottomMdFt:Number(bitMdFt)-component.startFromBit,jarTopMdFt:Number(bitMdFt)-component.endFromBit,jarForceLbf:jar.axialForceLbf,
      neutralFt:neutral?.fromBitFt??null,neutralMdFt:neutral?.mdFt??null,jarMinusNeutralFt:neutral?jar.centreFromBitFt-neutral.fromBitFt:null,
      hookloadLbf:-load.topOfBhaAxialForce,totalLengthFt:positions.totalLength,fixedBhaLengthFt:deployment.metadata.fixedLengthFt,
      fixedBhaAirWeightLbf:weights.valid?weights.weightPartitions.totalBha.airWeightLbf:null,totalAirWeightLbf:weights.valid?weights.totalAirWeightLbf:null,
      buoyedWeightLbf:weights.valid?weights.totalBuoyedWeightLbf:null,requiredHookloadLbf:inverse.valid?inverse.requiredSurfaceHookloadLbf:null},
    warnings:[...load.warnings,...(!weights.valid?weights.errors:[]),...(!inverse.valid?inverse.errors:[])],dynamicStatus:DYNAMIC_UNAVAILABLE};
}
