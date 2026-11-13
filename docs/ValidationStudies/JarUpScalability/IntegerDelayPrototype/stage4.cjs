// Sequential, isolated Stage 4 sweep runner. Invoke via stdin from repo root.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const dir='docs/ValidationStudies/JarUpScalability/IntegerDelayPrototype';
const outPath=path.join(dir,'Stage4Results.json');
const baseline=JSON.parse(fs.readFileSync('docs/ValidationStudies/JarUpScalability/after.json','utf8'));
const positions=baseline.rows.map(r=>r.position),limitMs=60000,memoryLimitMiB=1536;
const prior=process.env.STAGE4_FINALIZE_ONLY==='1'&&fs.existsSync(outPath)?JSON.parse(fs.readFileSync(outPath,'utf8')):null;
const runs=prior?.runs||[];
function save(){fs.writeFileSync(outPath,JSON.stringify({stage:4,fixture:'reconstructed OES 8.5in BHA with diagnostic TCI bit',windowS:.05,
  positions,execution:'sequential',safetyLimits:{perRunRuntimeMs:limitMs,recurrencePeakRssMiB:memoryLimitMiB,recurrenceExistingUpdateBudget:20000000,
    recurrenceExistingPendingBucketBudget:3000000},runs},null,2)+'\n');}
function worker(position,mode){return new Promise(resolve=>{
  const env={...process.env,PROTOTYPE_POSITION:String(position),PROTOTYPE_MODE:mode,PROTOTYPE_REFINEMENT:'1',PROTOTYPE_TAG:'stage4',PROTOTYPE_SWEEP:'1'};
  const child=spawn(process.execPath,['--preserve-symlinks','--experimental-vm-modules','-'],{cwd:process.cwd(),env,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;const started=Date.now();
  const timer=setTimeout(()=>{timedOut=true;child.kill();},limitMs);
  child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr+=b.toString());
  child.on('error',e=>{clearTimeout(timer);resolve({position,mode,status:'incomplete-runner-error',runtimeMs:Date.now()-started,error:String(e)});});
  child.on('close',code=>{
    clearTimeout(timer);const runtimeMs=Date.now()-started;
    const stem=path.join(dir,`${position}-${mode}-x1-stage4.json`);
    if(timedOut)return resolve({position,mode,status:'incomplete-runtime-limit',runtimeMs,limitMs,peakProcessRssMiB:null,error:'Worker terminated at per-run wall-time limit.'});
    if(code!==0||!fs.existsSync(stem))return resolve({position,mode,status:'incomplete-worker-exit',runtimeMs,exitCode:code,
      memoryLimitMiB:mode==='recurrence'?memoryLimitMiB:null,stdout:stdout.slice(-2000),stderr:stderr.slice(-4000)});
    try{resolve({position,mode,status:'recorded',runtimeMs,worker:JSON.parse(fs.readFileSync(stem,'utf8'))});}
    catch(e){resolve({position,mode,status:'incomplete-result-read',runtimeMs,error:String(e),stdout:stdout.slice(-2000),stderr:stderr.slice(-2000)});}
  });
  child.stdin.end(fs.readFileSync(path.join(dir,'experiment.cjs')));
});}
function readHistory(position,mode,node){
  const f=path.join(dir,`${position}-${mode}-x1-stage4-${node}.f64`);if(!fs.existsSync(f))return [];
  const b=fs.readFileSync(f),a=[];for(let i=0;i+15<b.length;i+=16)a.push({t:b.readDoubleLE(i),f:b.readDoubleLE(i+8)});return a;
}
function at(a,t){let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m].t<=t)lo=m+1;else hi=m;}return lo?a[lo-1].f:NaN;}
function compareHistory(exact,recurrence,through){
  if(!recurrence.length||!(through>0))return {available:false,reason:'Recurrence force history or positive overlap is unavailable.'};
  if(!exact.length)return {available:true,comparison:'no stuck-point arrival in shared interval',throughS:through,
    maxAbsDifferenceN:0,samplesCompared:0,limitation:'Exact solver stopped before its first stuck-point arrival; both histories remain at the initial zero force.'};
  const times=[...new Set([0,...exact.map(x=>x.t),...recurrence.map(x=>x.t)].filter(t=>t>=0&&t<=through))].sort((a,b)=>a-b);
  // Float64 seconds representations of the same exact/dyadic arrival can
  // differ by a few femtoseconds. Compare the post-event states after grouping
  // only those representationally adjacent timestamps (1e-11 s); this does not
  // change or merge the solver's event histories.
  const groups=[];for(const t of times){if(!groups.length||t-groups[groups.length-1].max>1e-11)groups.push({min:t,max:t});else groups[groups.length-1].max=t;}
  let maxAbsDifferenceN=0,atTimeS=null;
  const sample=t=>{const d=Math.abs(at(exact,t)-at(recurrence,t));if(Number.isFinite(d)&&d>maxAbsDifferenceN){maxAbsDifferenceN=d;atTimeS=t;}};
  for(let i=0;i<groups.length;i++){if(groups[i].max+1e-11<=through)sample(groups[i].max+1e-11);
    if(i+1<groups.length&&groups[i+1].min-groups[i].max>2e-11)sample(groups[i].max+(groups[i+1].min-groups[i].max)/2);}
  return {available:true,comparison:'post-event force states with sub-10-ps timestamp alignment',throughS:through,
    maxAbsDifferenceN,atTimeS,samplesCompared:groups.length,timestampGroupingToleranceS:1e-11};
}
function writeAll(){
  const comparisons=[];
  for(const position of positions){
    const ex=runs.find(r=>r.position===position&&r.mode==='exact'),rc=runs.find(r=>r.position===position&&r.mode==='recurrence');
    const exact=ex?.worker,rec=rc?.worker,bench=baseline.rows.find(r=>Math.abs(r.position-position)<1e-6);
    let overlap=null;if(exact&&rec)overlap=compareHistory(readHistory(position,'exact','stuck'),readHistory(position,'recurrence','stuck'),Math.min(exact.post.completedThroughS,rec.post.completedThroughS));
    const exactCoverage=bench.computation?.phaseAttempts?.filter(a=>a.phase==='post-impact').at(-1)?.completedThroughS??null;
    comparisons.push({position,benchmarkExactStatus:bench.status,benchmarkExactCompletedThroughS:exactCoverage,
      exactRunStatus:ex?.status==='recorded'?exact.post.status:ex?.status??'not-run',recurrenceRunStatus:rc?.status==='recorded'?rec.post.status:rc?.status??'not-run',
      recurrenceComplete50ms:!!rec&&rec.result.valid===true&&rec.post.valid===true&&rec.post.completedThroughS===.05,
      geometryValid:rec?.result.geometryValid??null,structuralMappingValid:rec?.result.structuralMappingValid??null,
      sectionCount:rec?.geometry.sectionCount??null,handoffResidualJ:rec?.handoff.residualJ??null,
      maintainedEngagement:rec?.result.maintainedEngagement??null,peakTensileN:rec?.result.metrics?.peakTensileN??null,
      tensileImpulseNs:rec?.result.metrics?.fixedTensileNs??null,impactTimeS:rec?.result.impact?.impactTimeS??null,
      impactVelocityMS:rec?.result.impact?.impactVelocityMS??null,processedUpdates:rec?.post.numerical?.processedEvents??null,
      peakProcessRssMiB:rec?.peakProcessRssMiB??rc?.peakProcessRssMiB??null,runtimeMs:rec?.runtimeMs??rc?.runtimeMs??null,
      maxEnergyResidualJ:rec?.post.energy?Math.max(...rec.post.energy.map(e=>Math.abs(e.residualJ))):null,
      exactPeakTensileN:exact?.result.metrics?.peakTensileN??bench.metrics?.peakTensileN??null,
      exactTensileImpulseNs:exact?.result.metrics?.fixedTensileNs??bench.metrics?.fixedTensileNs??null,
      completeExactMetricDifferences:exact?.result.metrics&&rec?.result.metrics?{
        peakTensileN:rec.result.metrics.peakTensileN-exact.result.metrics.peakTensileN,
        tensileImpulseNs:rec.result.metrics.fixedTensileNs-exact.result.metrics.fixedTensileNs}:null,
      overlappingStuckForceHistory:overlap,
      diagnostics:{recurrenceStatus:rec?.post.status??rc?.status??null,error:rec?.result.error??rc?.stderr??null,
        maxInterfacePowerResidualW:rec?.post.numerical?.maxInterfacePowerResidualW??null,phaseCount:rec?.post.numerical?.phaseCount??null,
        pendingPeak:rec?.post.numerical?.maxQueue??null,recurrenceEnergyAuditCount:rec?.post.energy?.length??null}});
  }
  fs.writeFileSync(outPath,JSON.stringify({stage:4,fixture:'reconstructed OES 8.5in BHA with diagnostic TCI bit',windowS:.05,
    positions,execution:'sequential',safetyLimits:{perRunRuntimeMs:limitMs,recurrencePeakRssMiB:memoryLimitMiB,
      recurrenceExistingUpdateBudget:20000000,recurrenceExistingPendingBucketBudget:3000000},runs,comparisons},null,2)+'\n');
}
(async()=>{
  if(process.env.STAGE4_FINALIZE_ONLY==='1'){writeAll();console.log(`Finalized ${outPath}`);return;}
  save();
  for(const position of positions){
    for(const mode of ['exact','recurrence']){
      const run=await worker(position,mode);runs.push(run);save();
      console.log(JSON.stringify({position,mode,status:run.status,workerStatus:run.worker?.post?.status,
        runtimeMs:run.worker?.runtimeMs??run.runtimeMs,peakProcessRssMiB:run.worker?.peakProcessRssMiB??run.peakProcessRssMiB,
        completedThroughS:run.worker?.post?.completedThroughS,processedUpdates:run.worker?.post?.numerical?.processedEvents,error:run.error??run.stderr?.slice(-500)}));
    }
  }
  writeAll();
})().catch(e=>{console.error(e);process.exitCode=1;});
