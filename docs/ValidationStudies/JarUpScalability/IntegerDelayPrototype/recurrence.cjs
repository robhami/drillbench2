// Isolated research prototype. PRELIMINARY -- NOT FOR OPERATIONAL USE.
// Scattering/energy conventions: nonUniformAxialWave.js, simulateNonUniformAxialWave.
// A sparse integer-indexed delay history, with exact dyadic off-grid origin phases.
// Each (tick, phase, interface) has ONE accumulated incoming increment, regardless
// of the number of reflection paths. No amplitude pruning or phase clustering.
const assert = require('assert/strict');
function dyadic(x) {
  if (!x) return { n: 0n, e: 0 };
  const v = new DataView(new ArrayBuffer(8)); v.setFloat64(0, x);
  const hi = v.getUint32(0), lo = v.getUint32(4), biased = (hi >>> 20) & 2047;
  let n = (BigInt(hi & 1048575) << 32n) + BigInt(lo), e = biased ? biased - 1075 : -1074;
  if (biased) n += 1n << 52n;
  while (!(n & 1n)) { n >>= 1n; e++; }
  return { n, e };
}
function initialIntegral(waves, direction, lo, hi) {
  if (hi <= lo) return 0;
  const ws = waves.filter(w => w.direction === direction);
  const cuts = [...new Set([lo, hi, ...ws.flatMap(w => [w.fromM, w.toM]).filter(x => x > lo && x < hi)])].sort((a,b) => a-b);
  let total = 0;
  for (let j=1;j<cuts.length;j++) {
    const x=(cuts[j]+cuts[j-1])/2;
    const f=ws.reduce((a,w) => a+(x>=w.fromM && x<w.toM ? w.forceN : 0),0);
    total += f*f*(cuts[j]-cuts[j-1]);
  }
  return total;
}
function simulate(input, options = {}) {
  const started=performance.now(), H=input.durationS;
  const dt=options.dt || .003048/Math.sqrt(200e9/7850);
  const N=input.sections.length, jar=options.jarNode;
  assert.equal(input.model,'research-linear-axial-waves'); assert.equal(input.units,'SI');
  assert(H>0 && H<=.2 && dt>0 && N>0);
  assert(!input.probes?.length, 'Prototype does not implement arbitrary probes.');
  assert((input.numerical?.delayPrecisionBits ?? 53)===53);
  const s=input.sections.map(sec => {
    for(const k of ['lengthM','areaM2','youngsModulusPa','densityKgM3']) assert(Number.isFinite(sec[k]) && sec[k]>0);
    const c=Math.sqrt(sec.youngsModulusPa/sec.densityKgM3), tau=sec.lengthM/c, d=Math.round(tau/dt);
    assert(d>=1 && Number.isSafeInteger(d));
    const delay=d*dt, error=delay-tau;
    assert(Math.abs(error)<=2e-15, 'Physical delays are not commensurate within the declared 2-fs gate.');
    return {...sec,c,tau,d,delay,error,speed:sec.lengthM/delay,K:sec.areaM2*sec.youngsModulusPa,
      Z:sec.areaM2*Math.sqrt(sec.youngsModulusPa)*Math.sqrt(sec.densityKgM3)};
  });
  // Interface scattering depends only on the adjacent impedances. Compute it
  // once, rather than repeating the same divisions and coefficient arithmetic
  // for every arrival at that interface.
  const scattering=Array.from({length:N+1},(_,node)=>{
    if(node===0||node===N)return null;
    const ZL=s[node-1].Z,ZR=s[node].Z,scale=Math.max(ZL,ZR),l=ZL/scale,z=ZR/scale;
    const sum=l+z,r=(z-l)/sum,tr=2*z/sum,tl=2*l/sum;
    return {ZL,ZR,scale,l,z,sum,r,tr,tl};
  });
  assert.equal(new Set(s.map(x=>x.id)).size,N);
  const index=new Map(s.map((x,i)=>[x.id,i]));
  const origins=[];
  let maxInitialTimingChangeS=0;
  for(const w of input.initialWaves || []) {
    const i=index.get(w.sectionId); assert(i!==undefined); const sec=s[i];
    assert(['down','up'].includes(w.direction) && w.fromM>=0 && w.toM<=sec.lengthM && w.toM>w.fromM && Number.isFinite(w.forceN));
    const distances=w.direction==='down' ? [sec.lengthM-w.toM,sec.lengthM-w.fromM] : [w.fromM,w.toM];
    distances.forEach((distance,k) => {
      const t=distance/sec.speed;
      maxInitialTimingChangeS=Math.max(maxInitialTimingChangeS,Math.abs(t-distance/(sec.lengthM/sec.tau)));
      origins.push({t,fullSection:distance===sec.lengthM?i:null,node:w.direction==='down'?i+1:i,dir:w.direction==='down'?0:1,value:k ? -w.forceN:w.forceN});
    });
  }
  for(const side of ['left','right']) assert(['free','fixed','matched'].includes(input.boundaries[side]));
  for(const source of input.boundaryExcitations || []) {
    assert(input.boundaries[source.boundary]==='matched');
    let prior=0;
    for(const h of source.history) {
      assert(h.timeS>=0 && Number.isFinite(h.forceN));
      origins.push({t:h.timeS,node:source.boundary==='left'?0:N,dir:2,value:h.forceN-prior}); prior=h.forceN;
    }
  }
  // Use exact dyadic residues, never Float64 modulo or a near-time tolerance.
  const exponent=Math.min(...[dt,H,...origins.map(x=>x.t)].filter(x=>x>0).map(x=>dyadic(x).e));
  const ticks=x=>{const a=dyadic(x);return a.n ? a.n<<BigInt(a.e-exponent):0n;};
  const unit=ticks(dt), end=ticks(H);
  // A full-section initial tail MUST coincide with the first boundary emission.
  // Multiplying d*dt in Float64 here would introduce an artificial sub-ulp gap.
  const originTicks=x=>x.fullSection!=null ? BigInt(s[x.fullSection].d)*unit : ticks(x.t);
  const phases=[...new Set([0n,...origins.map(x=>originTicks(x)%unit)])].sort((a,b)=>a<b?-1:a>b?1:0);
  const phaseIndex=new Map(phases.map((p,i)=>[p.toString(),i]));
  const lastTick=Number(end/unit), slots=new Array(lastTick+1),tickBases=new Array(lastTick+1),timeScale=2**exponent;
  const p=new Float64Array(N+1), q=new Float64Array(N+1), drive=new Float64Array(N+1);
  const down=new Float64Array(N), up=new Float64Array(N), lastDown=new Float64Array(N), lastUp=new Float64Array(N);
  const histories=Array.from({length:N+1},()=>[]);
  const auditTimes=options.energyTimes || Array.from({length:11},(_,i)=>H*i/10);
  const energy=auditTimes.map(timeS=>({timeS,initialPhysicalJ:0,physicalStoredJ:0,injectedJ:0,escapedJ:0}));
  s.forEach(sec=>{
    const ws=(input.initialWaves || []).filter(w=>w.sectionId===sec.id);
    const initial=(initialIntegral(ws,'down',0,sec.lengthM)+initialIntegral(ws,'up',0,sec.lengthM))/sec.K;
    for(const e of energy) {
      const travel=Math.min(sec.lengthM,e.timeS*sec.speed);
      e.initialPhysicalJ+=initial;
      e.physicalStoredJ+=(initialIntegral(ws,'down',0,sec.lengthM-travel)+initialIntegral(ws,'up',travel,sec.lengthM))/sec.K;
    }
  });
  let pending=0, peakPending=0, updates=0, merged=0, maxPower=0, sampledPeakRss=process.memoryUsage().rss;
  let allocatedCells=0,reusedCells=0,allocatedMaps=0,reusedMaps=0,historyRowsOmitted=0;
  // Exact reusable accumulator records backed by lazily allocated typed slabs.
  // Map keys and all seven Float64 values retain their original meaning/order.
  const CELL_SLAB_BITS=16,CELL_SLAB_SIZE=1<<CELL_SLAB_BITS,CELL_STRIDE=7;
  const cellSlabs=[],freeCells=[],freeMaps=[],keyScratch=[],releasedCells=[];
  let nextCellId=0;
  function cellOffset(id) { return (id & (CELL_SLAB_SIZE-1))*CELL_STRIDE; }
  function cellSlab(id) { return cellSlabs[id>>>CELL_SLAB_BITS]; }
  function newCell() {
    const id=nextCellId++, slabIndex=id>>>CELL_SLAB_BITS;
    if(!cellSlabs[slabIndex])cellSlabs[slabIndex]=new Float64Array(CELL_SLAB_SIZE*CELL_STRIDE);
    return id;
  }
  const eventWindow=[];
  const boundaryLast=new Float64Array(2), boundaryIn=new Float64Array(2), boundaryOut=new Float64Array(2);
  function schedule(n,phase,node,dir,value,force=false) {
    if(!force && value===0 || n>lastTick || n===lastTick && phases[phase]>end%unit)return;
    let slot=slots[n];
    if(!slot){slot=freeMaps.pop();if(slot){reusedMaps++;slot.clear();}else{slot=new Map();allocatedMaps++;}slots[n]=slot;}
    const key=phase*(N+1)+node;
    let id=slot.get(key),cell,offset;
    if(id===undefined){id=freeCells.pop();if(id!==undefined){reusedCells++;}else{id=newCell();allocatedCells++;}
      cell=cellSlab(id);offset=cellOffset(id);cell.fill(0,offset,offset+CELL_STRIDE);
      slot.set(key,id);pending++;peakPending=Math.max(peakPending,pending);}
    else merged++;
    if(cell===undefined){cell=cellSlab(id);offset=cellOffset(id);}
    // Compensated addition for coincident increments.
    const y=value-cell[offset+dir+3], v=cell[offset+dir]+y;cell[offset+dir+3]=(v-cell[offset+dir])-y;cell[offset+dir]=v;
    cell[offset+6]++;
    if(pending>=3000000)throw Error('INCOMPLETE: sparse delay-history storage budget reached.');
  }
  origins.forEach(o=>{const t=originTicks(o);schedule(Number(t/unit),phaseIndex.get((t%unit).toString()),o.node,o.dir,o.value);});
  for(let node=0;node<=N;node++)schedule(0,0,node,0,0,true);
  function emittedEnergy(i,a,b,value) {
    if(a===b || value===0)return;
    const sec=s[i], square=value*value*sec.speed/sec.K;
    for(const e of energy) e.physicalStoredJ+=Math.max(0,Math.min(b,e.timeS)-Math.max(a,e.timeS-sec.delay,0))*square;
  }
  function emit(i,dir,delta,n,phase,timeS) {
    if(delta===0)return;
    const values=dir===0?down:up, last=dir===0?lastDown:lastUp;
    emittedEnergy(i,last[i],timeS,values[i]);last[i]=timeS;values[i]+=delta;
    assert(Number.isFinite(values[i]),'Nonfinite emitted wave.');
    schedule(n+s[i].d,phase,dir===0?i+1:i,dir,delta);
  }
  function boundaryEnergy(b,timeS) {
    const i=b===0?0:N-1, side=b===0?'left':'right';
    if(input.boundaries[side]==='matched') for(const e of energy) {
      const elapsed=Math.max(0,Math.min(timeS,e.timeS)-boundaryLast[b]);
      e.injectedJ+=elapsed*boundaryOut[b]**2/s[i].Z; e.escapedJ+=elapsed*boundaryIn[b]**2/s[i].Z;
    }
    boundaryLast[b]=timeS;
  }
  for(let n=0;n<=lastTick;n++) {
    const slot=slots[n]; if(!slot)continue;
    keyScratch.length=0;for(const key of slot.keys())keyScratch.push(key);keyScratch.sort((a,b)=>a-b);
    for(const key of keyScratch) {
      const phase=Math.floor(key/(N+1)),node=key%(N+1),id=slot.get(key),changes=cellSlab(id),offset=cellOffset(id);
      if(tickBases[n]===undefined)tickBases[n]=BigInt(n)*unit;
      const timeS=Number(tickBases[n]+phases[phase])*timeScale;
      pending--;updates++; p[node]+=changes[offset];q[node]+=changes[offset+1];drive[node]+=changes[offset+2];
      let outL=0,outR=0,F,v;
      if(node===0 || node===N) {
        const b=node===0?0:1, side=b===0?'left':'right', i=b===0?0:N-1, incoming=b===0?q[node]:p[node];
        const reflection=input.boundaries[side]==='fixed'?1:input.boundaries[side]==='free'?-1:0;
        const outgoing=reflection*incoming+drive[node];
        boundaryEnergy(b,timeS);boundaryIn[b]=incoming;boundaryOut[b]=outgoing;
        if(b===0){outR=outgoing;emit(i,0,outgoing-down[i],n,phase,timeS);}
        else {outL=outgoing;emit(i,1,outgoing-up[i],n,phase,timeS);}
        F=incoming+outgoing;v=(b===0?outgoing-incoming:incoming-outgoing)/s[i].Z;
      } else {
        const {ZL,ZR,scale,l,sum,r,tr,tl}=scattering[node];
        outL=r*p[node]+tl*q[node];outR=tr*p[node]-r*q[node];
        F=tr*p[node]+tl*q[node];v=2*((p[node]-q[node])/scale)/sum;
        maxPower=Math.max(maxPower,Math.abs(p[node]**2/ZL+q[node]**2/ZR-outL**2/ZL-outR**2/ZR));
        emit(node-1,1,r*changes[offset]+tl*changes[offset+1],n,phase,timeS);
        emit(node,0,tr*changes[offset]-r*changes[offset+1],n,phase,timeS);
      }
      if(!Number.isFinite(F)||!Number.isFinite(v)||!Number.isFinite(outL)||!Number.isFinite(outR))
        throw Error('Nonfinite interface state.');
      if(options.eventWindow && (node===jar || node===N) && Math.abs(timeS-options.eventWindow.centreS)<=options.eventWindow.radiusS)
        eventWindow.push({node,timeS,tick:n,phaseTick:phases[phase].toString(),incomingDownDeltaN:changes[offset],incomingUpDeltaN:changes[offset+1],
          incomingDownN:p[node],incomingUpN:q[node],driveDeltaN:changes[offset+2],forceN:F,arrivalContributions:changes[offset+6]});
      // Keep every Jar discontinuity for the unchanged wrapper's sign gate.
      if(node===jar || node===N || histories[node].length===0) {
        const h=histories[node];
        if(!h.length || h[h.length-1].forceN!==F)h.push({timeS,forceN:F,velocityMS:v,outgoingDownN:outR,outgoingUpN:outL});
        else historyRowsOmitted++;
      }
      if(updates>=20000000)throw Error('INCOMPLETE: recurrence update budget reached.');
      releasedCells.push(id);
    }
    slot.clear();slots[n]=undefined;freeMaps.push(slot);
    for(const id of releasedCells)freeCells.push(id);
    releasedCells.length=0;keyScratch.length=0;
    if(n%2048===0){sampledPeakRss=Math.max(sampledPeakRss,process.memoryUsage().rss);if(sampledPeakRss>=1.5*1024**3)throw Error(`INCOMPLETE: 1.5-GiB recurrence RSS safety limit reached (${(sampledPeakRss/1024**2).toFixed(1)} MiB).`);}
  }
  for(let i=0;i<N;i++){emittedEnergy(i,lastDown[i],H,down[i]);emittedEnergy(i,lastUp[i],H,up[i]);}
  boundaryEnergy(0,H);boundaryEnergy(1,H);
  energy.forEach(e=>{e.residualJ=e.initialPhysicalJ+e.injectedJ-e.escapedJ-e.physicalStoredJ;});
  const rel=input.numerical?.energyRelativeTolerance ?? 1e-9,abs=input.numerical?.energyAbsoluteToleranceJ ?? 1e-12;
  const ok=energy.every(e=>Object.values(e).every(Number.isFinite) && Math.abs(e.residualJ)<=abs+rel*(e.initialPhysicalJ+e.injectedJ));
  return {valid:ok,complete:true,status:ok?'complete':'energy-tolerance-not-met',error:ok?'':'Physical energy residual exceeds requested tolerance.',
    researchOnly:true,notice:'PRELIMINARY -- NOT FOR OPERATIONAL USE',durationS:H,completedThroughS:H,energy,
    interfaces:histories.map((history,node)=>({node,history})),
    numerical:{scheme:'sparse integer-delay characteristic recurrence with exact origin residues',dtS:dt,sectionCount:N,phaseCount:phases.length,
      gridTicks:lastTick+1,processedEvents:updates,maxQueue:peakPending,mergedContributions:merged,maxInterfacePowerResidualW:maxPower,
      allocatedCells,reusedCells,allocatedMaps,reusedMaps,historyRowsOmitted,retainedJarSamples:histories[jar]?.length||0,retainedStuckSamples:histories[N]?.length||0,
      maxDelayErrorS:Math.max(...s.map(x=>Math.abs(x.error))),maxInitialTimingChangeS,
      delayMapping:s.map(x=>({id:x.id,physicalDelayS:x.tau,integerDelay:x.d,mappedDelayS:x.delay,errorS:x.error})),
      sampledPeakRssBytes:Math.max(sampledPeakRss,process.memoryUsage().rss),runtimeMs:performance.now()-started,eventWindow}};
}
module.exports={simulate,dyadic,initialIntegral};
