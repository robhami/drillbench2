// RESEARCH adapter only. No wave/contact equations are implemented here.
import { deployDrillstring } from '../bha/deployDrillstring';
import { calcComponentPositions } from '../bha/calcComponentPositions';
import { simulateTwoSidedJarImpact } from './twoSidedJarImpact';
import { firstTensileLobe } from './jarPositionComparison';
import { extractImpulseMetrics, integrateImpulseWindow } from './jarImpulseInterpretation';
import { resolveBitStructuralProperties } from '../bha/bitStructuralProperties';
export const FT_M=.3048, IN2_M2=.00064516;
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
const need=(ok,error)=>{if(!ok)throw Error(error);};
export const requiresEquivalent=r=>!['DC','DP'].includes(String(r.category).toUpperCase())||r.componentDefinition?.sectionModel==='complex'||!!r.componentDefinition?.effectiveProperties;
export function validateDynamicSettings(s) {
  need(s.acknowledged===true,'Acknowledge assumed parameters, zero-increment dynamics and the ideal rigid housing before calculating.');
  need(s.direction==='up'&&s.upperBoundary==='matched'&&s.lowerBoundary==='fixed'&&s.staticTreatment==='zero-increment','Only Jar Up, matched upper/fixed lower boundaries and zero-increment perturbations are supported here.');
  need(s.damping===undefined||s.damping===0,'Contact damping is unsupported by the verified two-sided solver.');
  need(s.hammerExcluded===true,'Confirm distributed equivalent jar-body mass excludes the separately modelled hammer.');
  need(String(s.provenance||'').trim().length>0,'Document the provenance and limitations of assumed material properties.');
  need(positive(s.massKg)&&s.massKg>=5&&s.massKg<=500&&positive(s.velocityMS)&&s.velocityMS<=5&&positive(s.stiffnessNm)&&s.stiffnessNm>=1e6&&s.stiffnessNm<=1e8,'Research input envelope: mass 5–500 kg, velocity >0–5 m/s, stiffness 1–100 MN/m. These are computational limits, not manufacturer specifications.');
  need(Number.isFinite(s.stuckFromBitFt)&&s.stuckFromBitFt>=0,'Stuck point must be a finite nonnegative distance above bit (ft).');
  need(positive(s.durationS)&&s.durationS<=.2&&Number.isFinite(s.windowStartS)&&s.windowStartS>=0&&positive(s.windowEndS)&&s.windowEndS>s.windowStartS&&s.windowEndS<=s.durationS,'Use 0 <= window start < end <= duration <= 0.2 s.');
  need(positive(s.timeStepS)&&s.timeStepS>=.5e-6&&s.timeStepS<=20e-6,'Requested coarse resolution must be 0.5–20 microseconds; numerical safeguards still apply.');
}
// Shared geometry only: no hammer/contact parameters are required or assigned.
export function mapRealBhaWaveGeometry({bha,bitMdFt,surfaceMdFt=0,jarIndex,settings:s}) {
  need(s?.acknowledged===true&&String(s.provenance||'').trim(),'Acknowledge and document the research material/equivalent-property assumptions.');
  need(bha?.trajectoryMode==='vertical','This initial actual-geometry research adapter requires an explicitly generated vertical trajectory; directional structural coupling is not established.');
  const deployed=deployDrillstring(bha,bitMdFt,{surfaceMdFt});need(deployed.valid,deployed.errors?.join(' ')||'Invalid deployment.');
  const positions=calcComponentPositions(deployed.bha), jar=positions.components.filter(r=>String(r.category).toUpperCase()==='JAR')[jarIndex];
  need(Number.isInteger(jarIndex)&&!!jar,'Select a jar explicitly.');
  need(s.stuckFromBitFt<jar.startFromBit,'Stuck boundary must be below the selected jar bottom; internal jar/stuck-point interaction is unsupported.');
  need(positions.components.filter(r=>String(r.category).toUpperCase()==='JAR').length===1,'Multiple internal jar mechanisms are unsupported by this dynamic research adapter.');
  const mapping=[];
  for(const [i,row] of positions.components.entries()) {
    need(row.quantity==null||row.quantity===''||Number(row.quantity)===1,`Row ${i+1}: quantity expansion is unsupported.`);
    need(!row.orientation||['bottom-to-top','bit-to-surface','surface-to-bottom'].includes(row.orientation),`Row ${i+1}: unknown orientation.`);
    const d=row.componentDefinition, override=s.equivalents?.[row.rowId], complex=requiresEquivalent(row), isBit=String(row.category).toUpperCase()==='BIT';
    const bitProperties=isBit?resolveBitStructuralProperties(d?.bitStructuralProperties):null;
    const completeAnalysisBitOverride=isBit&&positive(override?.areaM2)&&positive(override?.densityKgM3)&&positive(override?.youngsModulusPa)&&String(override?.provenance||'').trim();
    if(isBit&&d?.bitStructuralProperties&&bitProperties.hasAny&&!bitProperties.valid&&!completeAnalysisBitOverride)need(false,`BIT ${row.toolName||`Row ${i+1}`} structural properties: ${bitProperties.errors.join(' ')}`);
    need(!complex||(row.rowId&&positions.components.filter(r=>r.rowId===row.rowId).length===1),`Row ${i+1}: a unique component row ID is required for explicit equivalent-property assignment.`);
    need(!complex||(String(override?.provenance||bitProperties?.provenance||'').trim()&&(override||bitProperties?.equivalentAreaIn2)),`${isBit?`BIT ${row.toolName||`Row ${i+1}`} (row ${i+1}): `:`Row ${i+1} (${row.toolName}): `}explicit equivalent structural area/material and provenance required. Nominal cutting OD and tool weight cannot supply dynamic properties.`);
    let segments=d?.geometry?.kind==='segmented'?d.geometry.segments:[row];
    need(segments?.length>0,`Row ${i+1}: segmented geometry is empty.`);
    need(Math.abs(segments.reduce((a,x)=>a+Number(x.length),0)-Number(row.length))<=1e-6,`Row ${i+1}: segment lengths do not reconcile with component length.`);
    if(row.orientation==='surface-to-bottom')segments=[...segments].reverse();
    let offset=row.startFromBit;
    const sections=segments.map((g,n)=>{
      const lengthFt=Number(g.length), material=g.material||d?.material;
      if(!complex)for(const key of ['densityLbFt3','youngsModulusPsi'])need(material?.[key]==null||material[key]===''||positive(Number(material[key])),`Row ${i+1}: invalid stored ${key}; assumed values cannot silently replace it.`);
      const density=complex?(positive(override?.densityKgM3)?Number(override.densityKgM3):isBit&&positive(bitProperties?.densityKgM3)?bitProperties.densityKgM3:s.densityKgM3):positive(Number(material?.densityLbFt3))?Number(material.densityLbFt3)*16.01846337396014:s.densityKgM3;
      const E=complex?(positive(override?.youngsModulusPa)?Number(override.youngsModulusPa):isBit&&positive(bitProperties?.youngsModulusPa)?bitProperties.youngsModulusPa:s.youngsModulusPa):positive(Number(material?.youngsModulusPsi))?Number(material.youngsModulusPsi)*6894.757293168:s.youngsModulusPa;
      const od=Number(g.od),id=Number(g.idSize),area=complex?(positive(override?.areaM2)?Number(override.areaM2):isBit&&bitProperties?.equivalentAreaIn2!=null?bitProperties.equivalentAreaIn2*IN2_M2:NaN):Math.PI/4*(od*od-id*id)*IN2_M2;
      need(complex||(g.od!=null&&g.idSize!=null&&g.od!==''&&g.idSize!==''&&od>id&&id>=0),`Row ${i+1}: explicit valid annular OD and ID required.`);
      need([lengthFt,area,density,E].every(positive),`${isBit?`BIT ${row.toolName||`Row ${i+1}`}`:`Row ${i+1} (${row.toolName})`}: positive explicit length, structural area, density and modulus required. No default material substitution.`);
      const section={id:`${row.rowId||i}-segment-${n}`,kind:'uniform-elastic',rowId:row.rowId,label:g.label||row.toolName,category:row.category,fromBitFt:offset,toBitFt:offset+lengthFt,
        lengthM:lengthFt*FT_M,areaM2:area,densityKgM3:density,youngsModulusPa:E,waveSpeedMS:Math.sqrt(E/density),impedanceNsM:area*Math.sqrt(E*density),
        provenance:complex?(override?.provenance||bitProperties?.provenance||s.provenance):material?.densityLbFt3&&material?.youngsModulusPsi?'Stored material properties':s.provenance,equivalent:complex};
      offset+=lengthFt;return section;
    });
    mapping.push({rowId:row.rowId,name:row.toolName,category:row.category,lengthFt:Number(row.length),nominalWeightLbFt:row.weight,sections,
      nominalMassKg:Number(row.weight)*Number(row.length)*.45359237,distributedModelMassKg:sections.reduce((a,x)=>a+x.lengthM*x.areaM2*x.densityKgM3,0),complex});
  }
  const flat=mapping.flatMap(r=>r.sections), centre=jar.centreFromBit;
  const terminalSection=flat.find(sec=>s.stuckFromBitFt>=sec.fromBitFt&&s.stuckFromBitFt<sec.toBitFt);
  need(!!terminalSection,'Stuck point must lie within the deployed string.');
  need(s.stuckFromBitFt===0||!terminalSection.equivalent||s.stuckEquivalentAcknowledged===true,'Internal stuck point lies in a complex tool: explicitly acknowledge the equivalent structural representation at this terminal or select an ordinary tubular.');
  const slice=(lo,hi)=>flat.flatMap(sec=>{const a=Math.max(lo,sec.fromBitFt),b=Math.min(hi,sec.toBitFt);return b>a?[{...sec,id:sec.id+`-${lo}-${hi}`,fromBitFt:a,toBitFt:b,lengthM:(b-a)*FT_M}]:[];});
  const lower=slice(s.stuckFromBitFt,centre).reverse(),upper=slice(centre,positions.totalLength);
  const firstArrivalS=lower.reduce((a,x)=>a+x.lengthM/x.waveSpeedMS,0);
  return {mapping,positions,jarCentreFt:centre,jarMdFt:Number(bitMdFt)-centre,stuckFromBitFt:s.stuckFromBitFt,stuckMdFt:Number(bitMdFt)-s.stuckFromBitFt,terminalSection,jarToStuckFt:centre-s.stuckFromBitFt,firstArrivalS,
    upper,lower};
}
export function mapRealBhaWaves(request) {
  const s=request.settings;validateDynamicSettings(s);
  const {upper,lower,...mapped}=mapRealBhaWaveGeometry(request);
  need(mapped.firstArrivalS<s.durationS,'Simulation ends before the direct wave reaches the stuck boundary. Extend the supported horizon or revise the declared scenario.');
  return {...mapped,input:{model:'research-two-sided-rigid-housing',units:'SI',mechanism:'ideal-rigid-through-housing',direction:'up',equilibrium:{kind:'uniform-self-equilibrated',axialForceN:0},
      hammerMassKg:s.massKg,contactStiffnessNm:s.stiffnessNm,strokeM:0,release:{timeS:0,relativeVelocityMS:s.velocityMS},upper:{sections:upper,farBoundary:'matched'},lower:{sections:lower,farBoundary:'fixed'},durationS:s.durationS,
      numerical:{timeStepS:s.timeStepS,maxSteps:500000,maxHistoryCells:20000000,energyRelativeTolerance:3e-5,momentumRelativeTolerance:3e-5},
      convergence:{forceAbsoluteN:.01,impulseAbsoluteNs:1e-5,relative:.001,eventTimeS:1e-6}}};
}
export function runRealBhaDynamic(input) {
  let map;try{map=mapRealBhaWaves(input);}catch(e){return {valid:false,status:'unsupported-or-invalid-input',error:e.message,metrics:null};}
  const coarse=simulateTwoSidedJarImpact(map.input);
  if(!coarse.valid)return {jarCentreFt:map.jarCentreFt,valid:false,status:coarse.status,error:coarse.error,metrics:null,numerical:coarse.numerical};
  // Extra metric-level refinement: unchanged engine already checks its own peaks/events/impulse.
  const result=simulateTwoSidedJarImpact({...map.input,numerical:{...map.input.numerical,timeStepS:map.input.numerical.timeStepS/2}});
  const summary={jarCentreFt:map.jarCentreFt,jarMdFt:map.jarMdFt,firstArrivalS:map.firstArrivalS,stuckFromBitFt:map.stuckFromBitFt,stuckMdFt:map.stuckMdFt,jarToStuckFt:map.jarToStuckFt,terminalSection:map.terminalSection,mapping:map.mapping,numerical:result.numerical};
  if(!result.valid)return {...summary,valid:false,status:result.status,error:result.error,metrics:null};
  const s=input.settings,metrics=measureDynamicHistory(result,map,s),previous=measureDynamicHistory(coarse,map,s);
  const convergence=['peakContactN','peakTransmittedN','peakTensileN','peakCompressiveN','firstResponseS','firstDurationS','firstImpulseNs','fixedSignedNs','fixedTensileNs','fixedCompressiveNs','reboundGlobalMS'].map(key=>{
    const a=metrics[key],b=previous[key],abs=key.endsWith('S')?1e-6:key.endsWith('MS')?1e-6:key.endsWith('Ns')?1e-5:.01;
    return {key,difference:a==null&&b==null?0:a==null||b==null?Infinity:Math.abs(a-b),limit:abs+.001*Math.abs(a||0)};
  });
  if(convergence.some(c=>c.difference>c.limit))return {...summary,valid:false,status:'metric-numerical-nonconvergence',error:'Position metric refinement exceeds predeclared 0.1% plus absolute tolerances; refine time step.',metrics:null,metricConvergence:convergence};
  if(metrics.minContactN<0)return {...summary,valid:false,status:'invalid-contact-history',metrics:null};
  const stride=Math.max(1,Math.ceil(result.histories.length/4000));
  return {...summary,valid:true,status:'valid-assumed-parameter-research',metrics,metricConvergence:convergence,events:result.events,
    trace:result.histories.filter((r,i)=>i%stride===0||i===result.histories.length-1).map(r=>({timeS:r.timeS,stuckN:r.stuckDynamicForceN,contactN:r.contactForceN}))};
}
function measureDynamicHistory(result,map,s) {
  const primary=firstTensileLobe(result.histories,map.firstArrivalS);
  const fixed=integrateImpulseWindow(result.histories,s.windowStartS,s.windowEndS);
  const lobe=primary.status==='complete-first-tensile-lobe'?extractImpulseMetrics(result,primary,{startS:s.windowStartS,endS:s.windowEndS}):null;
  const peak=result.histories.reduce((a,r)=>r.stuckDynamicForceN<a.stuckDynamicForceN?r:a,result.histories[0]);
  const first=result.histories.find(r=>r.timeS>=map.firstArrivalS&&Math.abs(r.stuckDynamicForceN)>1e-6);
  const separation=result.events.find(e=>e.type==='separation'),rebound=separation?result.histories.find(r=>r.timeS>=separation.timeS)?.hammerVelocityMS:null;
  return {peakContactN:result.metrics.peakContactForceN,peakTransmittedN:result.metrics.peakAbsoluteDynamicStuckForceN,peakTensileN:Math.max(0,-peak.stuckDynamicForceN),peakCompressiveN:result.histories.reduce((a,r)=>Math.max(a,r.stuckDynamicForceN),0),peakTimeS:peak.timeS,
    firstResponseS:first?.timeS??null,firstArrivalS:map.firstArrivalS,firstDurationS:lobe?.primaryDurationS??null,firstImpulseNs:lobe?.primaryImpulseNs??null,firstStartS:lobe?.primaryStartS??null,firstEndS:lobe?.primaryEndS??null,
    fixedSignedNs:fixed.signedNs,fixedTensileNs:fixed.tensileOnlyNs,fixedCompressiveNs:fixed.compressiveOnlyNs,reboundGlobalMS:rebound,energyResidualJ:result.numerical.maxIncrementalEnergyResidualJ,momentumResidualNs:result.numerical.maxMomentumResidualNs,
    firstLobeStatus:primary.status,minContactN:result.histories.reduce((a,r)=>Math.min(a,r.contactForceN),Infinity)};
}
