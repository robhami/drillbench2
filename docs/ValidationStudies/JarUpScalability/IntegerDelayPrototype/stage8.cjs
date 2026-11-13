// Sequential Stage 8 compact-solver validation runner. Run from repository root.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),crypto=require('crypto');
const dir='docs/ValidationStudies/JarUpScalability/IntegerDelayPrototype';
const stage4=JSON.parse(fs.readFileSync(path.join(dir,'Stage4Results.json'),'utf8'));
const after=JSON.parse(fs.readFileSync('docs/ValidationStudies/JarUpScalability/after.json','utf8'));
const experiment=fs.readFileSync(path.join(dir,'experiment.cjs'));
const output=path.join(dir,'Stage8Results.json'),positions=stage4.positions;
const limits={runtimeMs:60000,recurrencePeakRssMiB:1536,updates:20000000,pendingCells:3000000};
const prior=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null;
const runs=prior?.runs||[];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function loadJson(p){return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;}
function history(position,mode,tag,node){
  const p=path.join(dir,`${position}-${mode}-x1-${tag}-${node}.f64`);
  if(!fs.existsSync(p))return null;
  const b=fs.readFileSync(p),a=[];for(let i=0;i+15<b.length;i+=16)a.push({t:b.readDoubleLE(i),f:b.readDoubleLE(i+8)});return a;
}
function stateAt(a,t){let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m].t<=t)lo=m+1;else hi=m;}return lo?a[lo-1].f:NaN;}
function compareHistory(exact,recurrence,through){
  if(!recurrence||!(through>0))return {available:false,reason:'Missing recurrence history or positive overlap.'};
  if(!exact?.length)return {available:true,comparison:'no stuck-point arrival in shared interval',throughS:through,maxAbsDifferenceN:0,samplesCompared:0,
    limitation:'Exact-event solver stopped before its first stuck-point arrival; both histories remain at zero.'};
  const ts=[...new Set([0,...exact.map(x=>x.t),...recurrence.map(x=>x.t)].filter(t=>t>=0&&t<=through))].sort((a,b)=>a-b),groups=[];
  for(const t of ts){if(!groups.length||t-groups.at(-1).max>1e-11)groups.push({min:t,max:t});else groups.at(-1).max=t;}
  let max=0,atS=null;const sample=t=>{const d=Math.abs(stateAt(exact,t)-stateAt(recurrence,t));if(Number.isFinite(d)&&d>max){max=d;atS=t;}};
  for(let i=0;i<groups.length;i++){if(groups[i].max+1e-11<=through)sample(groups[i].max+1e-11);
    if(i+1<groups.length&&groups[i+1].min-groups[i].max>2e-11)sample(groups[i].max+(groups[i+1].min-groups[i].max)/2);}
  return {available:true,comparison:'post-event force states with 10-ps timestamp alignment',throughS:through,maxAbsDifferenceN:max,atTimeS:atS,samplesCompared:groups.length,timestampGroupingToleranceS:1e-11};
}
function save(){
  const baselineByPos=p=>stage4.runs.find(x=>x.position===p&&x.mode==='recurrence')?.worker;
  const exactByPos=p=>stage4.runs.find(x=>x.position===p&&x.mode==='exact')?.worker;
  const comparisons=runs.map(run=>{
    const p=run.position,w=run.worker,base=baselineByPos(p),ex=exactByPos(p),reference=after.rows.find(x=>Math.abs(x.position-p)<1e-6);
    const recJar=history(p,'recurrence','stage8','jar'),recStuck=history(p,'recurrence','stage8','stuck');
    const baseJar=history(p,'recurrence','stage4','jar'),baseStuck=history(p,'recurrence','stage4','stuck');
    const exStuck=history(p,'exact','stage4','stuck');
    const overlap=compareHistory(exStuck,recStuck,Math.min(ex?.post?.completedThroughS??0,w?.post?.completedThroughS??0));
    const hashCompare=(a,b)=>a&&b?hash(path.join(dir,`${p}-recurrence-x1-${a}-jar.f64`))===hash(path.join(dir,`${p}-recurrence-x1-${b}-jar.f64`)):false;
    const jarSame=!!recJar&&!!baseJar&&hashCompare('stage8','stage4');
    const stuckSame=!!recStuck&&!!baseStuck&&hash(path.join(dir,`${p}-recurrence-x1-stage8-stuck.f64`))===hash(path.join(dir,`${p}-recurrence-x1-stage4-stuck.f64`));
    const exactComplete=ex?.result?.valid===true&&ex?.post?.completedThroughS===.05;
    const counterFields=['processedEvents','maxQueue','mergedContributions','allocatedCells','reusedCells','allocatedMaps','reusedMaps',
      'historyRowsOmitted','retainedJarSamples','retainedStuckSamples','phaseCount','gridTicks','maxDelayErrorS','maxInitialTimingChangeS'];
    const solverCountersMatchStage4=!!base&&counterFields.every(k=>w?.post?.numerical?.[k]===base.post.numerical?.[k]);
    const delayMappingMatchesStage4=!!base&&JSON.stringify(w?.post?.numerical?.delayMapping)===JSON.stringify(base.post.numerical?.delayMapping);
    const energyAuditMatchesStage4=!!base&&JSON.stringify(w?.post?.energy)===JSON.stringify(base.post.energy);
    const engagementMatchesStage4=!!base&&JSON.stringify(w?.result?.maintainedEngagement)===JSON.stringify(base.result.maintainedEngagement);
    const metricsMatchStage4=!!base&&JSON.stringify(w?.result?.metrics)===JSON.stringify(base.result.metrics);
    const geometryMatchesStage4=!!base&&JSON.stringify(w?.geometry)===JSON.stringify(base.geometry);
    const fullDiff=exactComplete&&w?.result?.metrics?{peakTensileN:w.result.metrics.peakTensileN-ex.result.metrics.peakTensileN,
      tensileImpulseNs:w.result.metrics.fixedTensileNs-ex.result.metrics.fixedTensileNs}:null;
    return {position:p,referenceExactStatus:reference?.status??null,stage4ExactCompletedThroughS:ex?.post?.completedThroughS??null,
      stage4RecurrenceComplete:base?.result?.valid===true&&base?.post?.completedThroughS===.05,
      stage8RecurrenceComplete:w?.result?.valid===true&&w?.post?.valid===true&&w?.post?.completedThroughS===.05,
      geometryValid:w?.result?.geometryValid??false,structuralMappingValid:w?.result?.structuralMappingValid??false,
      impactMatchesStage4:!!base&&JSON.stringify(w?.result?.impact)===JSON.stringify(base.result.impact),
      waveHandoffHashMatchesStage4:!!base&&w?.handoff?.waveHash===base.handoff.waveHash,
      geometryMatchesStage4,solverCountersMatchStage4,delayMappingMatchesStage4,energyAuditMatchesStage4,engagementMatchesStage4,metricsMatchStage4,
      jarHistoryMatchesStage4:jarSame,stuckHistoryMatchesStage4:stuckSame,
      stage8VsStage4PeakTensileN:w?.result?.metrics&&base?.result?.metrics?w.result.metrics.peakTensileN-base.result.metrics.peakTensileN:null,
      stage8VsStage4TensileImpulseNs:w?.result?.metrics&&base?.result?.metrics?w.result.metrics.fixedTensileNs-base.result.metrics.fixedTensileNs:null,
      completeExactReference:exactComplete,completeExactMetricDifferences:fullDiff,
      exactOverlappingStuckHistory:overlap,exactNoStuckArrivalBeforeCutoff:!exStuck?.length&&ex?.post?.completedThroughS<(reference?.firstArrivalS??Infinity),
      pass:run.status==='recorded'&&w?.result?.valid===true&&w?.post?.valid===true&&w?.post?.completedThroughS===.05&&
        w?.result?.geometryValid===true&&w?.result?.structuralMappingValid===true&&!!base&&
        JSON.stringify(w.result.impact)===JSON.stringify(base.result.impact)&&w?.handoff?.waveHash===base?.handoff?.waveHash&&jarSame&&stuckSame&&
        geometryMatchesStage4&&solverCountersMatchStage4&&delayMappingMatchesStage4&&energyAuditMatchesStage4&&engagementMatchesStage4&&metricsMatchStage4&&
        (!fullDiff||(Math.abs(fullDiff.peakTensileN)<=.0015&&Math.abs(fullDiff.tensileImpulseNs)<=4.33e-9))&&
        (exactComplete?(overlap.available&&overlap.maxAbsDifferenceN<=5.69e-8):(overlap.available&&overlap.maxAbsDifferenceN<=5.36e-8))};
  });
  const refPos=641.83,refinement=loadJson(path.join(dir,'641.83-recurrence-x2-stage6slab.json')),
    priorRef=loadJson(path.join(dir,'641.83-recurrence-x2-stage3a.json'));
  const refinementValidation={position:refPos,refinement:2,present:!!refinement&&!!priorRef,
    jarHistoryMatchesValidated:!!refinement&&!!priorRef&&hash(path.join(dir,'641.83-recurrence-x2-stage6slab-jar.f64'))===hash(path.join(dir,'641.83-recurrence-x2-stage3a-jar.f64')),
    stuckHistoryMatchesValidated:!!refinement&&!!priorRef&&hash(path.join(dir,'641.83-recurrence-x2-stage6slab-stuck.f64'))===hash(path.join(dir,'641.83-recurrence-x2-stage3a-stuck.f64')),
    impactMatchesValidated:!!refinement&&!!priorRef&&JSON.stringify(refinement.result.impact)===JSON.stringify(priorRef.result.impact),
    metricsMatchValidated:!!refinement&&!!priorRef&&JSON.stringify(refinement.result.metrics)===JSON.stringify(priorRef.result.metrics),
    energyResidualJ:refinement?.post?.energy?.length?Math.max(...refinement.post.energy.map(e=>Math.abs(e.residualJ))):null,completedThroughS:refinement?.post?.completedThroughS??null,
    maintainedEngagement:refinement?.result?.maintainedEngagement??null};
  refinementValidation.pass=refinementValidation.present&&refinementValidation.jarHistoryMatchesValidated&&refinementValidation.stuckHistoryMatchesValidated&&
    refinementValidation.impactMatchesValidated&&refinementValidation.metricsMatchValidated&&refinementValidation.completedThroughS===.05&&refinementValidation.maintainedEngagement?.admissible===true;
  fs.writeFileSync(output,JSON.stringify({stage:8,fixture:stage4.fixture,windowS:stage4.windowS,positions,execution:'sequential compact recurrence; saved Stage 4 exact-event references',
    solver:'current Stage 6 compact slab-backed recurrence; refinement x1',safetyLimits:limits,runs,comparisons,refinementValidation,
    summary:{positions:positions.length,completed:runs.filter(r=>r.worker?.result?.valid===true&&r.worker?.post?.completedThroughS===.05).length,
      pass:comparisons.length===positions.length&&comparisons.every(c=>c.pass)&&refinementValidation.pass,maxRuntimeMs:Math.max(0,...runs.map(r=>r.worker?.runtimeMs??r.runtimeMs??0)),
      maxPeakProcessRssMiB:Math.max(0,...runs.map(r=>r.worker?.peakProcessRssMiB??0)),maxProcessedUpdates:Math.max(0,...runs.map(r=>r.worker?.post?.numerical?.processedEvents??0)),
      maxPendingCells:Math.max(0,...runs.map(r=>r.worker?.post?.numerical?.maxQueue??0))}},null,2)+'\n');
}
function run(position){return new Promise(resolve=>{
  const env={...process.env,PROTOTYPE_POSITION:String(position),PROTOTYPE_MODE:'recurrence',PROTOTYPE_REFINEMENT:'1',PROTOTYPE_TAG:'stage8',PROTOTYPE_SWEEP:'1'};
  const child=spawn(process.execPath,['--preserve-symlinks','--experimental-vm-modules','-'],{cwd:process.cwd(),env,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;const started=Date.now();
  const timer=setTimeout(()=>{timedOut=true;child.kill();},limits.runtimeMs);
  child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr+=b.toString());
  child.on('error',e=>{clearTimeout(timer);resolve({position,status:'incomplete-runner-error',runtimeMs:Date.now()-started,error:String(e)});});
  child.on('close',code=>{
    clearTimeout(timer);const runtimeMs=Date.now()-started,stem=path.join(dir,`${position}-recurrence-x1-stage8.json`);
    if(timedOut)return resolve({position,status:'incomplete-runtime-limit',runtimeMs,limitMs:limits.runtimeMs,error:'Worker terminated at per-position runtime limit.'});
    if(code!==0||!fs.existsSync(stem))return resolve({position,status:'incomplete-worker-exit',runtimeMs,exitCode:code,stdout:stdout.slice(-2000),stderr:stderr.slice(-4000)});
    try{resolve({position,status:'recorded',runtimeMs,worker:JSON.parse(fs.readFileSync(stem,'utf8'))});}
    catch(e){resolve({position,status:'incomplete-result-read',runtimeMs,error:String(e)});}
  });
  child.stdin.end(experiment);
});}
(async()=>{
  if(process.env.STAGE8_FINALIZE_ONLY==='1'){save();console.log(`Finalized ${output}`);return;}
  for(const position of positions){const runResult=await run(position);runs.push(runResult);save();
    console.log(JSON.stringify({position:runResult.position,status:runResult.status,workerStatus:runResult.worker?.post?.status,
      runtimeMs:runResult.worker?.runtimeMs??runResult.runtimeMs,peakProcessRssMiB:runResult.worker?.peakProcessRssMiB,
      completedThroughS:runResult.worker?.post?.completedThroughS,processedUpdates:runResult.worker?.post?.numerical?.processedEvents,
      error:runResult.error??runResult.stderr?.slice(-300)}));}
  save();
})().catch(e=>{console.error(e);process.exitCode=1;});
