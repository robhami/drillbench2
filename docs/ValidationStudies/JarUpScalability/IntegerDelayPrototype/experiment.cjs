// Run from repo root using stdin; see Report.md for commands.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const directory='docs/ValidationStudies/JarUpScalability/IntegerDelayPrototype';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function loader(wave,port) {
  const cache=new Map();
  function create(file) {
    file=path.resolve(file);if(!path.extname(file))file+='.js';if(cache.has(file))return cache.get(file);
    let m;
    if(wave && file.endsWith('nonUniformAxialWave.js'))m=new vm.SyntheticModule(['simulateNonUniformAxialWave','createAxialWavePortNetwork'],function(){this.setExport('simulateNonUniformAxialWave',wave);this.setExport('createAxialWavePortNetwork',port);});
    else if(file.endsWith('.json'))m=new vm.SyntheticModule(['default'],function(){this.setExport('default',JSON.parse(fs.readFileSync(file,'utf8')));});
    else m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{identifier:file});
    cache.set(file,m);return m;
  }
  return async p=>{const m=create(p);if(m.status==='unlinked')await m.link((s,parent)=>create(path.resolve(path.dirname(parent.identifier),s)));if(m.status!=='evaluated')await m.evaluate();return m.namespace;};
}
async function main() {
  const position=Number(process.env.PROTOTYPE_POSITION || 641.83),mode=process.env.PROTOTYPE_MODE || 'recurrence',refinement=Number(process.env.PROTOTYPE_REFINEMENT || 1),tag=process.env.PROTOTYPE_TAG;
  assert(process.env.PROTOTYPE_SWEEP==='1' || [641.83,132.07].some(x=>Math.abs(x-position)<1e-6));assert(['exact','recurrence'].includes(mode));assert([1,2,4].includes(refinement));
  const protectedPaths=['src/engineering/research/nonUniformAxialWave.js','src/engineering/research/nonUniformSkeemUp.js',
    'src/engineering/research/realBhaDynamicComparison.js','src/engineering/research/realBhaSkeemComparison.js','src/engineering/research/jarUpSweep.js',
    'scripts/benchmarkJarUpScalability.cjs',...['after.json','before.json','comparison.csv','Handover.md','KalsiComparison.md','RecurrenceFeasibility.md'].map(x=>'docs/ValidationStudies/JarUpScalability/'+x)];
  const hashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(p)]));
  const base=loader(),{simulateNonUniformAxialWave:exact,createAxialWavePortNetwork:port}=await base('src/engineering/research/nonUniformAxialWave.js');
  const {simulate}=require(path.resolve(directory,'recurrence.cjs'));
  let upperCount=0,lastPre,post,postInput;
  const phases=[];
  const hooked=loader(input=>{
    const started=performance.now();let result;
    if(input.boundaries.right==='free') {upperCount=input.sections.length;result=exact(input);lastPre=result;}
    else {postInput=input;result=mode==='exact'?exact(input):simulate(input,{jarNode:upperCount,dt:.003048/Math.sqrt(200e9/7850)/refinement,
      eventWindow:{centreS:.04590105487082558,radiusS:2e-6}});post=result;}
    phases.push({phase:input.boundaries.right==='free'?'pre':'post',durationS:input.durationS,runtimeMs:performance.now()-started,status:result.status,numerical:result.numerical});
    return result;
  },port);
  const {runRealBhaSkeem}=await hooked('src/engineering/research/realBhaSkeemComparison.js');
  const {prepareJarUpSweep}=await base('src/engineering/research/jarUpSweep.js');
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
  const frozen=read('docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json').workingCopy;
  const bit=read('src/data/components.json').components.find(c=>c.id==='bha-9');
  const bha={...frozen,rows:[{rowId:'diagnostic-bit',category:'BIT',selectedToolId:bit.id,toolName:bit.name,od:bit.od,idSize:bit.idSize,weight:bit.weight,length:1,componentDefinition:bit},...frozen.rows]};
  const material=read('docs/ValidationStudies/RealBHADynamicStage6E3/study.json').settings;
  const settings={...material,localTensionLbf:185000,strokeIn:7.5,durationS:.05,windowStartS:0,windowEndS:.05,
    equivalents:{...material.equivalents,'diagnostic-bit':{areaM2:.0150773892,densityKgM3:7850,youngsModulusPa:200e9,provenance:'User supplied diagnostic TCI properties; illustrative only.'}}};
  const request={bha,bitMdFt:9318,jarIndex:0,settings,model:'non-uniform-skeem'};
  const single=prepareJarUpSweep({...request,minimumFt:position,maximumFt:position,incrementFt:30});
  const candidate=single.cases.find(c=>Math.abs(c.jarCentreFt-position)<1e-6);assert(candidate);
  const original=JSON.stringify(candidate.bha),started=performance.now();
  const result=runRealBhaSkeem({...request,bha:candidate.bha});
  const runtimeMs=performance.now()-started;
  assert.equal(JSON.stringify(candidate.bha),original);
  const saved=read('docs/ValidationStudies/JarUpScalability/after.json').rows.find(r=>Math.abs(r.position-position)<1e-6);assert(saved,'Position is not part of the frozen 16-position benchmark.');
  assert.deepEqual(result.impact,saved.impact,'Exact pre-impact quantities must match frozen benchmark.');
  assert(post && lastPre && postInput,'Capture failed before the handoff.');
  const waveHash=crypto.createHash('sha256').update(JSON.stringify(postInput.initialWaves)).digest('hex');
  const handoffResidualJ=post.energy[0].initialPhysicalJ-lastPre.energy.at(-1).physicalStoredJ;
  const handoffLimitJ=1e-12+1e-9*Math.abs(lastPre.energy.at(-1).physicalStoredJ);
  const jar=post.interfaces[upperCount].history,stuck=post.interfaces.at(-1).history;
  const windowCentreS=.04590105487082558,windowRadiusS=2e-6;
  const forceWindow={centreS:windowCentreS,radiusS:windowRadiusS,
    jar:jar.filter(x=>Math.abs(x.timeS-windowCentreS)<=windowRadiusS),stuck:stuck.filter(x=>Math.abs(x.timeS-windowCentreS)<=windowRadiusS)};
  const arrivalWindow=post.arrivalEvents?.filter(x=>(x.node===upperCount || x.node===postInput.sections.length) && Math.abs(x.timeS-windowCentreS)<=windowRadiusS) || null;
  // Do not convert a failed wrapper result into valid force/impulse metrics.
  const {trace,...summary}=result;
  const output={position,mode,refinement,runtimeMs,peakProcessRssMiB:process.resourceUsage().maxRSS/1024,
    finalMemory:process.memoryUsage(),nodeVersion:process.version,platform:process.platform,result:summary,
    geometry:{sectionCount:postInput.sections.length,sections:postInput.sections.map(s=>({id:s.id,lengthM:s.lengthM,areaM2:s.areaM2,youngsModulusPa:s.youngsModulusPa,densityKgM3:s.densityKgM3}))},
    handoff:{waveHash,intervalCount:postInput.initialWaves.length,prePhysicalJ:lastPre.energy.at(-1).physicalStoredJ,
      postInitialPhysicalJ:post.energy[0].initialPhysicalJ,residualJ:handoffResidualJ,limitJ:handoffLimitJ,
      initialJarForceN:jar[0].forceN,initialImpactForceErrorN:jar[0].forceN+result.impact.initialImpactForceN},
    post:{valid:post.valid,status:post.status,completedThroughS:post.completedThroughS,numerical:post.numerical,energy:post.energy,forceWindow,arrivalWindow,
      jarSamples:jar.length,stuckSamples:stuck.length,maxJarCompressionN:jar.reduce((m,x)=>Math.max(m,x.forceN),-Infinity)},
    phases,protectedHashes:hashes};
  for(const p of protectedPaths)assert.equal(hash(p),hashes[p]);
  const stem=path.join(directory,`${position}-${mode}-x${refinement}${tag?'-'+tag:''}`);
  fs.writeFileSync(stem+'.json',JSON.stringify(output,null,2)+'\n');
  for(const [name,history] of [['jar',jar],['stuck',stuck]]) {
    const data=Buffer.alloc(history.length*16);
    history.forEach((x,i)=>{data.writeDoubleLE(x.timeS,i*16);data.writeDoubleLE(x.forceN,i*16+8);});
    fs.writeFileSync(stem+'-'+name+'.f64',data);
  }
  console.log(JSON.stringify({position,mode,refinement,tag:tag||null,runtimeMs,peakProcessRssMiB:output.peakProcessRssMiB,status:result.status,impact:result.impact,metrics:result.metrics,
    handoff:{residualJ:handoffResidualJ,initialJarForceErrorN:output.handoff.initialJarForceErrorN},post:{status:post.status,completedThroughS:post.completedThroughS,
      maxAbsEnergyResidualJ:Math.max(...(post.energy||[]).map(e=>Math.abs(e.residualJ))),maintainedEngagementMaximumForceN:jar.reduce((m,x)=>Math.max(m,x.forceN),-Infinity),
      phaseCount:post.numerical?.phaseCount,processedEvents:post.numerical?.processedEvents,historySamples:[jar.length,stuck.length]}}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
