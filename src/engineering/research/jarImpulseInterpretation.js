// RESEARCH post-processing only. No impact/wave equations or fixture changes.
const finite = x => typeof x === 'number' && Number.isFinite(x);

export function integrateImpulseWindow(history, startS, endS) {
  if (!Array.isArray(history) || history.length < 2 || !finite(startS) || !finite(endS) || endS <= startS || startS < history[0].timeS || endS > history.at(-1).timeS + 1e-14) throw Error('Integration requires a complete, ordered history covering the specified window.');
  let signedNs = 0, tensileOnlyNs = 0, compressiveOnlyNs = 0;
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1], b = history[i];
    if (![a.timeS,b.timeS,a.stuckDynamicForceN,b.stuckDynamicForceN].every(finite) || b.timeS <= a.timeS) throw Error('Finite force and strictly increasing time required.');
    const lo = Math.max(startS, a.timeS), hi = Math.min(endS, b.timeS); if (hi <= lo) continue;
    const slope = (b.stuckDynamicForceN - a.stuckDynamicForceN) / (b.timeS - a.timeS);
    const f0 = a.stuckDynamicForceN + slope * (lo - a.timeS), f1 = a.stuckDynamicForceN + slope * (hi - a.timeS), dt = hi - lo;
    signedNs += dt * (f0 + f1) / 2;
    if (f0 <= 0 && f1 <= 0) tensileOnlyNs -= dt * (f0 + f1) / 2;
    else if (f0 >= 0 && f1 >= 0) compressiveOnlyNs += dt * (f0 + f1) / 2;
    else {
      const negativeFraction = (f0 < 0 ? -f0 : -f1) / Math.abs(f1 - f0);
      tensileOnlyNs += dt * negativeFraction * Math.max(-f0,-f1) / 2;
      compressiveOnlyNs += dt * (1-negativeFraction) * Math.max(f0,f1) / 2;
    }
  }
  return { startS,endS,signedNs,tensileOnlyNs,compressiveOnlyNs,identityResidualNs:signedNs-(compressiveOnlyNs-tensileOnlyNs) };
}

export function extractImpulseMetrics(result, primary, window) {
  if (!result.valid || !primary || primary.status !== 'complete-first-tensile-lobe') throw Error('Valid complete research result and closed original primary lobe required.');
  const h=result.histories, peak=h.reduce((best,r)=>r.stuckDynamicForceN<best.stuckDynamicForceN?r:best,h[0]);
  const fixed=integrateImpulseWindow(h,window.startS,window.endS), independentLobe=integrateImpulseWindow(h,primary.startS,primary.endS);
  const samples=h.filter(r=>r.timeS>primary.startS&&r.timeS<primary.endS);
  const positiveInterior=samples.filter(r=>r.stuckDynamicForceN>=0).length;
  const valleys=[];
  for(let i=1;i<h.length-1;i++) if(h[i].timeS>primary.startS+.0002&&h[i].timeS<primary.endS-.0002&&h[i].stuckDynamicForceN<0&&h[i].stuckDynamicForceN>h[i-1].stuckDynamicForceN&&h[i].stuckDynamicForceN>=h[i+1].stuckDynamicForceN) valleys.push({timeS:h[i].timeS,forceN:h[i].stuckDynamicForceN});
  valleys.sort((a,b)=>b.forceN-a.forceN);
  const separation=result.events.find(e=>e.type==='separation');
  return {peakTensileForceN:-peak.stuckDynamicForceN,peakTimeS:peak.timeS,primaryStartS:primary.startS,primaryEndS:primary.endS,
    primaryDurationS:primary.endS-primary.startS,primaryImpulseNs:primary.magnitudeImpulseNs,meanPrimaryTensileForceN:primary.magnitudeImpulseNs/(primary.endS-primary.startS),
    independentlyIntegratedLobeNs:independentLobe.tensileOnlyNs,lobeAgreementResidualNs:independentLobe.tensileOnlyNs-primary.magnitudeImpulseNs,nonTensileInteriorSamples:positiveInterior,
    leastTensileInteriorValleys:valleys.slice(0,8),fixed,hammerReboundGlobalVelocityMS:separation?h.find(r=>r.timeS>=separation.timeS)?.hammerVelocityMS:null,
    energyResidualJ:result.numerical.maxIncrementalEnergyResidualJ,minContactForceN:h.reduce((min,r)=>Math.min(min,r.contactForceN),Infinity)};
}

export function geometryWavePaths(caseData) {
  const paths=[],upper=caseData.input.upper.sections,lower=caseData.input.lower.sections;
  for(const [side,sections] of [['upper',upper],['lower',lower]]) {
    let time=0,distance=0;
    sections.forEach((s,i)=>{
      const c=Math.sqrt(s.youngsModulusPa/s.densityKgM3),Z=s.areaM2*Math.sqrt(s.youngsModulusPa*s.densityKgM3);
      time+=s.lengthM/c;distance+=s.lengthM;
      if(i<sections.length-1){const n=sections[i+1],Zn=n.areaM2*Math.sqrt(n.youngsModulusPa*n.densityKgM3),r=(Zn-Z)/(Zn+Z);
        paths.push({kind:'first-interface-return-to-jar',side,from:s.id,to:n.id,distanceFromJarM:distance,timeS:2*time,forceReflectionCoefficient:r,
          qualification:'Earliest single-path onset, not identification of an isolated observed peak.'});
        if(side==='lower') paths.push({kind:'first-bit-interface-bit-echo',side,interface:s.id+' / '+n.id,timeS:caseData.firstArrivalS+2*(caseData.firstArrivalS-time),forceReflectionCoefficient:-r,
          qualification:'Fixed-bit return reflected back toward bit at this interface; source/other echoes may overlap.'});
      }
    });
    paths.push({kind:side==='lower'?'fixed-bit-return-to-jar':'hypothetical-surface-return',side,timeS:2*time,
      supported:side==='lower',qualification:side==='lower'?'Fixed-end force reflection +1':'Upper end is matched: no surface reflection is modelled.'});
  }
  return paths.sort((a,b)=>a.timeS-b.timeS);
}
