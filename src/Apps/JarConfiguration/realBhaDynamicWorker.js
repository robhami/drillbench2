/* global globalThis */
import { runRealBhaDynamic } from '../../engineering/research/realBhaDynamicComparison';
import { runRealBhaSkeem } from '../../engineering/research/realBhaSkeemComparison';
import { MAX_SWEEP_POSITIONS, MAX_DYNAMIC_CASE_JOBS } from '../../engineering/research/jarUpSweep';
globalThis.onmessage=({data})=>{
  try {
    if(!Array.isArray(data.cases)||!Array.isArray(data.scenarios)||!data.cases.length||data.cases.length>MAX_SWEEP_POSITIONS||!data.scenarios.length||data.scenarios.length>4||data.cases.length*data.scenarios.length>MAX_DYNAMIC_CASE_JOBS)throw Error('Research batch exceeds position/scenario safeguards. Reduce the sweep or sensitivity cases.');
    for(const scenario of data.scenarios)for(const c of data.cases)globalThis.postMessage({row:{scenario:scenario.name,movementFt:c.movementFt,
      candidateId:c.candidateId,positioningMethod:c.positioningMethod,jarLocationAboveBitFt:c.jarLocationAboveBitFt,
      jarCentreFt:c.jarCentreFt ?? c.jarLocationAboveBitFt,isReference:c.movementFt===0,
      geometryValid:c.geometryValid ?? true,structuralMappingValid:c.structuralMappingValid ?? true,
      drillCollarLengthAboveJarFt:c.drillCollarLengthAboveJarFt,drillCollarLengthBelowJarFt:c.drillCollarLengthBelowJarFt,
      addedDcJointsAbove:c.addedDcJointsAbove,removedDcJointsAbove:c.removedDcJointsAbove,reallocatedDcJointsAbove:c.reallocatedDcJointsAbove,
      addedDcLengthAboveFt:c.addedDcLengthAboveFt,removedDcLengthAboveFt:c.removedDcLengthAboveFt,reallocatedDcLengthAboveFt:c.reallocatedDcLengthAboveFt,
      drillpipeLengthChangeFt:c.drillpipeLengthChangeFt,changeInCalculatedWeightLbf:c.changeInCalculatedWeightLbf,
      requestedJointChange:c.requestedJointChange,jointLengthFt:c.jointLengthFt,inventoryAction:c.inventoryAction,
      totalBhaLengthFt:c.totalBhaLengthFt,totalCalculatedWeightLbf:c.totalCalculatedWeightLbf,
      configurationWarnings:c.warnings,
      ...(data.model === 'non-uniform-skeem' ? runRealBhaSkeem : runRealBhaDynamic)({...data.request,bha:c.bha,settings:{...data.settings,...scenario.patch}})}});
    globalThis.postMessage({complete:true});
  } catch(e){globalThis.postMessage({error:e.message});}
};
