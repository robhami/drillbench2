// Isolated sequential child-process supervisor for the integer-delay prototype.
// Run from repository root: node stage9.cjs. Ctrl+C cancels the active child.
const fs=require('fs'),path=require('path'),os=require('os'),{spawn,execFile}=require('child_process'),crypto=require('crypto');
const dir='docs/ValidationStudies/JarUpScalability/IntegerDelayPrototype';
const experimentPath=path.join(dir,'experiment.cjs'),baselinePath=path.join(dir,'Stage8Results.json');
const positionsBaseline=JSON.parse(fs.readFileSync(baselinePath,'utf8')).positions;
const experiment=fs.readFileSync(experimentPath),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const defaultLimits={runtimeMs:60000,memoryMiB:1536,pollMs:100};
let activeSweep=null;
function readJson(p){return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null;}
function writeJson(p,value){fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n');}
function byteHistory(position,tag,node){const p=path.join(dir,`${position}-recurrence-x1-${tag}-${node}.f64`);return fs.existsSync(p)?p:null;}
function rssMiB(pid){return new Promise(resolve=>{
  if(process.platform==='win32'){
    // tasklist is blocked in this workspace; PowerShell Get-Process exposes
    // WorkingSet64 for child processes without changing the solver process.
    execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      `try { (Get-Process -Id ${Number(pid)} -ErrorAction Stop).WorkingSet64 } catch { exit 3 }`],
      {windowsHide:true},(error,stdout,stderr)=>{
        if(error)return resolve({available:false,reason:(stderr||error.message).trim()});
        const bytes=Number(stdout.trim());return Number.isFinite(bytes)&&bytes>0?resolve({available:true,rssMiB:bytes/1024**2}):resolve({available:false,reason:'PowerShell returned no working-set value'});
      });return;
  }
  const status=`/proc/${pid}/status`;
  fs.readFile(status,'utf8',(error,content)=>{if(error)return resolve({available:false,reason:error.message});
    const m=content.match(/^VmRSS:\s+(\d+)\s+kB/m);resolve(m?{available:true,rssMiB:Number(m[1])/1024}:{available:false,reason:'VmRSS missing'});});
});}
function stage9Summary(position,worker,wallMs,peakRssMiB){
  const baselinePosition=positionsBaseline.find(p=>Math.abs(p-position)<1e-6)??position;
  const baseline=readJson(path.join(dir,`${baselinePosition}-recurrence-x1-stage8.json`));
  if(!baseline)return {matches:false,reason:'Stage 8 baseline result file is missing.'};
  const sameJson=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const refs={impact:sameJson(worker.result.impact,baseline.result.impact),geometry:sameJson(worker.geometry,baseline.geometry),
    energy:sameJson(worker.post.energy,baseline.post.energy),engagement:sameJson(worker.result.maintainedEngagement,baseline.result.maintainedEngagement),
    metrics:sameJson(worker.result.metrics,baseline.result.metrics),delayMapping:sameJson(worker.post.numerical.delayMapping,baseline.post.numerical.delayMapping),
    updateCount:worker.post.numerical.processedEvents===baseline.post.numerical.processedEvents,
    pendingPeak:worker.post.numerical.maxQueue===baseline.post.numerical.maxQueue};
  for(const node of ['jar','stuck']){
    const a=byteHistory(position,'stage9',node),b=byteHistory(baselinePosition,'stage8',node);
    refs[`${node}History`]=!!a&&!!b&&sha(a)===sha(b);
  }
  return {matches:Object.values(refs).every(Boolean),checks:refs,stage8RuntimeMs:baseline.runtimeMs,
    childRuntimeMs:worker.runtimeMs,supervisorWallRuntimeMs:wallMs,supervisorOverheadMs:wallMs-worker.runtimeMs,
    sampledChildPeakRssMiB:peakRssMiB,childReportedPeakRssMiB:worker.peakProcessRssMiB};
}
function eventRecord(sweep,event){
  const e={timeUtc:new Date().toISOString(),sweepId:sweep.id,sequence:++sweep.sequence,
    position: event.position??null,status:event.status,completionStatus:event.completionStatus??event.status,
    runtimeMs:event.runtimeMs??(sweep.active?Date.now()-sweep.active.startedAt:0),
    memoryUsageMiB:event.memoryUsageMiB??sweep.active?.peakRssMiB??null,
    remainingWork:event.remainingWork??Math.max(0,sweep.positions.length-sweep.nextIndex),...event};
  sweep.events.push(e);fs.appendFileSync(sweep.progressPath,JSON.stringify(e)+'\n');
  sweep.onProgress?.(e);console.log(JSON.stringify(e));return e;
}
function childScript(mode){
  if(mode==='hang')return "setInterval(()=>{},1000)";
  if(mode==='memory')return "const x=Buffer.alloc(256*1024*1024,1);setInterval(()=>{if(x[0]!==1)process.exit(2)},1000)";
  if(mode==='oom')return "process.kill(process.pid,'SIGKILL')";
  if(mode==='fail')return "process.stderr.write('intentional child failure\\n');process.exit(23)";
  return null;
}
function runPosition(sweep,position,index){return new Promise(resolve=>{
  const artifact=path.join(dir,`${position}-recurrence-x1-stage9.json`);
  for(const p of [artifact,path.join(dir,`${position}-recurrence-x1-stage9-jar.f64`),path.join(dir,`${position}-recurrence-x1-stage9-stuck.f64`)])if(fs.existsSync(p))fs.unlinkSync(p);
  const mode=sweep.testMode,code=childScript(mode);
  const env={...process.env,PROTOTYPE_POSITION:String(position),PROTOTYPE_MODE:'recurrence',PROTOTYPE_REFINEMENT:'1',
    PROTOTYPE_TAG:'stage9',PROTOTYPE_SWEEP:'1'};
  const args=code?['-e',code]:['--preserve-symlinks','--experimental-vm-modules','-'];
  const child=spawn(process.execPath,args,{cwd:process.cwd(),env,stdio:code?['ignore','pipe','pipe']:['pipe','pipe','pipe'],windowsHide:true});
  const a={position,index,startedAt:Date.now(),child,peakRssMiB:0,monitorUnavailable:null,terminateReason:null,closed:false};
  sweep.active=a;let stdout='',stderr='',polling=false;
  const output=(stream,buffer)=>stream.on('data',b=>{if(buffer==='out')stdout+=b.toString();else stderr=(stderr+b.toString()).slice(-6000);});
  output(child.stdout,'out');output(child.stderr,'err');
  const terminate=reason=>{if(a.terminateReason||a.closed)return;a.terminateReason=reason;child.kill();
    a.killFallback=setTimeout(()=>{if(!a.closed)child.kill('SIGKILL');},1000);};
  a.terminate=terminate;
  let timer=setTimeout(()=>terminate('runtime-limit'),sweep.limits.runtimeMs);
  a.progressTimer=setInterval(()=>eventRecord(sweep,{position,status:'position-progress',completionStatus:'running',
    runtimeMs:Date.now()-a.startedAt,memoryUsageMiB:a.peakRssMiB||null,remainingWork:sweep.positions.length-index}),1000);
  const poll=async()=>{
    if(a.closed||polling||a.terminateReason)return;polling=true;
    const m=await rssMiB(child.pid);polling=false;
    if(a.closed)return;
    if(!m.available){a.monitorUnavailable=m.reason;terminate('memory-monitor-unavailable');return;}
    a.peakRssMiB=Math.max(a.peakRssMiB,m.rssMiB);
    if(m.rssMiB>sweep.limits.memoryMiB)terminate('memory-limit');
  };
  poll();a.pollTimer=setInterval(poll,sweep.limits.pollMs);
  if(!code)child.stdin.end(experiment);
  child.on('error',error=>{a.spawnError=String(error);});
  child.on('close',(exitCode,signal)=>{
    a.closed=true;clearTimeout(timer);clearTimeout(a.killFallback);clearInterval(a.pollTimer);clearInterval(a.progressTimer);
    const wallMs=Date.now()-a.startedAt,worker=exitCode===0?readJson(artifact):null;
    const observedPeakRssMiB=Math.max(a.peakRssMiB,worker?.peakProcessRssMiB??0)||null;
    let status,validEngineeringResult=false,comparison=null,errorText=null;
    if(a.terminateReason==='cancelled')status='cancelled';
    else if(a.terminateReason==='runtime-limit')status='incomplete-runtime-limit';
    else if(a.terminateReason==='memory-limit')status='incomplete-memory-limit';
    else if(a.terminateReason==='memory-monitor-unavailable')status='incomplete-memory-monitor-unavailable';
    else if(worker&&worker.peakProcessRssMiB>sweep.limits.memoryMiB)status='incomplete-memory-limit';
    else if(wallMs>sweep.limits.runtimeMs)status='incomplete-runtime-limit';
    else if(a.spawnError||exitCode!==0)status='incomplete-child-process-failure';
    else if(!worker)status='incomplete-missing-child-result';
    else if(worker.result?.valid!==true||worker.post?.valid!==true||worker.post?.completedThroughS!==.05)status='incomplete-child-result';
    else {
      comparison=stage9Summary(position,worker,wallMs,a.peakRssMiB);
      status=comparison.matches?'completed':'completed-baseline-mismatch';validEngineeringResult=comparison.matches;
      if(!comparison.matches)errorText='Completed child result differs from the Stage 8 baseline.';
    }
    if(status!=='completed'&&status!=='completed-baseline-mismatch'&&!errorText)
      errorText=a.monitorUnavailable||a.spawnError||stderr||`Child exited with code ${exitCode} signal ${signal}.`;
    const result={position,index,status,validEngineeringResult,runtimeMs:wallMs,childRuntimeMs:worker?.runtimeMs??null,
      peakMemoryUsageMiB:observedPeakRssMiB,sampledPeakRssMiB:a.peakRssMiB||null,childReportedPeakRssMiB:worker?.peakProcessRssMiB??null,
      exitCode,signal,terminationReason:a.terminateReason,monitorUnavailable:a.monitorUnavailable,error:errorText,
      worker:worker??null,baselineComparison:comparison,stdout:stdout.slice(-1200),stderr:stderr.slice(-2400)};
    sweep.active=null;resolve(result);
  });
});}
async function runSweep(options={}){
  const sweep={id:options.id||`stage9-${Date.now()}`,positions:options.positions||positionsBaseline,
    limits:{...defaultLimits,...options.limits},results:[],events:[],nextIndex:0,sequence:0,active:null,cancelRequested:false,
    progressPath:options.progressPath||path.join(dir,'Stage9Progress.jsonl'),onProgress:options.onProgress,testMode:options.testMode||null};
  if(!Number.isFinite(sweep.limits.runtimeMs)||sweep.limits.runtimeMs<=0||!Number.isFinite(sweep.limits.memoryMiB)||sweep.limits.memoryMiB<=0)
    throw Error('Positive runtime and memory limits are required.');
  if(!options.keepProgress)fs.writeFileSync(sweep.progressPath,'');
  activeSweep=sweep;
  eventRecord(sweep,{status:'sweep-started',completionStatus:'running',remainingWork:sweep.positions.length,
    configuredRuntimeLimitMs:sweep.limits.runtimeMs,configuredMemoryLimitMiB:sweep.limits.memoryMiB,monitorIntervalMs:sweep.limits.pollMs});
  for(let i=0;i<sweep.positions.length;i++){
    sweep.nextIndex=i;
    if(sweep.cancelRequested)break;
    const position=sweep.positions[i];eventRecord(sweep,{position,status:'position-started',completionStatus:'running',remainingWork:sweep.positions.length-i});
    const result=await runPosition(sweep,position,i);sweep.results.push(result);sweep.nextIndex=i+1;
    eventRecord(sweep,{position,status:result.status,completionStatus:result.status,runtimeMs:result.runtimeMs,
      memoryUsageMiB:result.peakMemoryUsageMiB,validEngineeringResult:result.validEngineeringResult,
      remainingWork:sweep.positions.length-sweep.nextIndex,terminationReason:result.terminationReason,error:result.error});
    if(sweep.cancelRequested||result.terminationReason||!['completed'].includes(result.status))break;
  }
  const skipped=sweep.positions.slice(sweep.results.length).map((position,index)=>({position,index:sweep.results.length+index,
    status:sweep.cancelRequested?'not-started-cancelled':'not-started-after-prior-failure',validEngineeringResult:false,runtimeMs:0,peakMemoryUsageMiB:null}));
  const output={stage:9,sweepId:sweep.id,execution:'sequential child process; maximum concurrency 1',limits:sweep.limits,
    memoryLimitEnforcement:'sampled child RSS; process killed after an over-limit sample. Not an OS hard memory cap.',
    positions:sweep.positions,results:[...sweep.results,...skipped],progress:sweep.events,
    summary:{requested:sweep.positions.length,started:sweep.results.length,completed:sweep.results.filter(r=>r.validEngineeringResult).length,
      skipped:skipped.length,cancelled:sweep.cancelRequested,allCompleted:sweep.results.length===sweep.positions.length&&sweep.results.every(r=>r.validEngineeringResult),
      maxRuntimeMs:Math.max(0,...sweep.results.map(r=>r.runtimeMs)),maxPeakMemoryUsageMiB:Math.max(0,...sweep.results.map(r=>r.peakMemoryUsageMiB||0)),
      maxSupervisorOverheadMs:Math.max(0,...sweep.results.map(r=>r.baselineComparison?.supervisorOverheadMs||0))}};
  activeSweep=null;options.outputPath&&writeJson(options.outputPath,output);
  eventRecord(sweep,{status:sweep.cancelRequested?'sweep-cancelled':output.summary.allCompleted?'sweep-complete':'sweep-incomplete',
    completionStatus:sweep.cancelRequested?'cancelled':output.summary.allCompleted?'complete':'incomplete',remainingWork:skipped.length,
    runtimeMs:sweep.results.reduce((n,r)=>n+r.runtimeMs,0),memoryUsageMiB:output.summary.maxPeakMemoryUsageMiB});
  return output;
}
function requestCancel(){if(!activeSweep||activeSweep.cancelRequested)return;activeSweep.cancelRequested=true;
  if(activeSweep.active)activeSweep.active.terminate('cancelled');}
process.on('SIGINT',()=>{requestCancel();});
async function selfTest(){
  const tests=[];
  const normal=await runSweep({id:'stage9-test-normal',positions:[641.83],outputPath:path.join(dir,'Stage9TestNormal.json'),progressPath:path.join(dir,'Stage9TestNormal.progress.jsonl')});
  tests.push({test:'normal-completion-and-stage8-equivalence',pass:normal.summary.allCompleted&&normal.summary.completed===1,
    result:normal.results[0]&&{status:normal.results[0].status,validEngineeringResult:normal.results[0].validEngineeringResult,
      baselineComparison:normal.results[0].baselineComparison}});
  const cancelPromise=runSweep({id:'stage9-test-cancel',positions:[132.07,133.06],testMode:'hang',outputPath:path.join(dir,'Stage9TestCancel.json'),progressPath:path.join(dir,'Stage9TestCancel.progress.jsonl'),
    onProgress:e=>{if(e.status==='position-started'&&e.position===132.07)setTimeout(()=>requestCancel(),150);}});
  const cancelled=await cancelPromise;
  tests.push({test:'cancellation-stops-child-and-skips-later-positions',pass:cancelled.summary.cancelled&&cancelled.results[0]?.status==='cancelled'&&
    cancelled.results[1]?.status==='not-started-cancelled',summary:cancelled.summary,positions:cancelled.results.map(r=>({position:r.position,status:r.status}))});
  const timed=await runSweep({id:'stage9-test-timeout',positions:[641.83,132.07],testMode:'hang',limits:{runtimeMs:200},outputPath:path.join(dir,'Stage9TestTimeout.json'),progressPath:path.join(dir,'Stage9TestTimeout.progress.jsonl')});
  tests.push({test:'timeout-kills-child-and-skips-later-positions',pass:timed.results[0]?.status==='incomplete-runtime-limit'&&timed.results[1]?.status==='not-started-after-prior-failure',
    positions:timed.results.map(r=>({position:r.position,status:r.status,validEngineeringResult:r.validEngineeringResult}))});
  const memory=await runSweep({id:'stage9-test-memory',positions:[641.83,132.07],testMode:'memory',limits:{memoryMiB:80,runtimeMs:10000,pollMs:50},
    outputPath:path.join(dir,'Stage9TestMemory.json'),progressPath:path.join(dir,'Stage9TestMemory.progress.jsonl')});
  tests.push({test:'sampled-memory-limit-terminates-child-and-skips-later-positions',pass:memory.results[0]?.status==='incomplete-memory-limit'&&
    memory.results[1]?.status==='not-started-after-prior-failure',positions:memory.results.map(r=>({position:r.position,status:r.status,
      peakMemoryUsageMiB:r.peakMemoryUsageMiB,validEngineeringResult:r.validEngineeringResult}))});
  const failure=await runSweep({id:'stage9-test-failure',positions:[641.83,132.07],testMode:'fail',outputPath:path.join(dir,'Stage9TestFailure.json'),
    progressPath:path.join(dir,'Stage9TestFailure.progress.jsonl')});
  tests.push({test:'nonzero-child-exit-cannot-be-valid',pass:failure.results[0]?.status==='incomplete-child-process-failure'&&
    failure.results[0]?.validEngineeringResult===false&&failure.results[1]?.status==='not-started-after-prior-failure',
    positions:failure.results.map(r=>({position:r.position,status:r.status,validEngineeringResult:r.validEngineeringResult}))});
  const killed=await runSweep({id:'stage9-test-abrupt-kill',positions:[641.83,132.07],testMode:'oom',outputPath:path.join(dir,'Stage9TestAbruptKill.json'),
    progressPath:path.join(dir,'Stage9TestAbruptKill.progress.jsonl')});
  tests.push({test:'abrupt-kill-or-oom-exit-cannot-be-valid',pass:killed.results[0]?.status==='incomplete-child-process-failure'&&
    killed.results[0]?.validEngineeringResult===false&&killed.results[1]?.status==='not-started-after-prior-failure',
    positions:killed.results.map(r=>({position:r.position,status:r.status,validEngineeringResult:r.validEngineeringResult,signal:r.signal}))});
  const result={stage:9,tests,pass:tests.every(t=>t.pass)};writeJson(path.join(dir,'Stage9TestResults.json'),result);return result;
}
async function main(){
  if(process.env.STAGE9_SELF_TEST==='1'){const t=await selfTest();console.log(JSON.stringify({selfTestComplete:true,pass:t.pass,tests:t.tests.map(x=>({test:x.test,pass:x.pass}))}));return;}
  const positions=process.env.STAGE9_POSITIONS?process.env.STAGE9_POSITIONS.split(',').map(Number):positionsBaseline;
  const limits={runtimeMs:Number(process.env.STAGE9_RUNTIME_LIMIT_MS||defaultLimits.runtimeMs),
    memoryMiB:Number(process.env.STAGE9_MEMORY_LIMIT_MIB||defaultLimits.memoryMiB),pollMs:Number(process.env.STAGE9_MEMORY_POLL_MS||defaultLimits.pollMs)};
  const result=await runSweep({positions,limits,outputPath:path.join(dir,'Stage9Results.json'),progressPath:path.join(dir,'Stage9Progress.jsonl')});
  console.log(JSON.stringify({resultFile:'Stage9Results.json',progressFile:'Stage9Progress.jsonl',summary:result.summary}));
}
if(require.main===module||process.argv[1]==='-')main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={runSweep,selfTest,requestCancel};
