import {DEFAULT_CONTROLS, POSITIONS, validateComparison, calculateResearchPosition, metricSummary} from './researchComparisonData';
import reference from '../../../docs/ValidationStudies/JarImpulseStage6D3E/findings.json';
import browserInputs from './researchAnalogue.v1.json';
import originalInputs from '../../../docs/ValidationStudies/JarPositionStage6D3D/config.v1.json';
const controls={...DEFAULT_CONTROLS,acknowledged:true};
jest.setTimeout(180000);
test('browser input fixture is identical to the preserved research source',()=>expect(browserInputs).toEqual(originalInputs));
test('rejects unacknowledged, actual BHA, untested parameters and invalid windows',()=>{
  for(const patch of [{acknowledged:false},{source:'OES 8.5in'},{massKg:21},{velocityMS:3},{stiffnessNm:3e7},{startMs:25},{endMs:26},{positions:[9.25,100]},{baseline:100}]) expect(validateComparison({...controls,...patch})).toBeTruthy();
  expect(validateComparison(controls)).toBeNull();
});
test('all seven live calculations reproduce frozen Stage 6D.3E references; baseline and metric rankings remain separate',()=>{
  const rows=POSITIONS.map(position=>calculateResearchPosition(controls,position));
  rows.forEach((r,i)=>{
    expect(r.valid).toBe(true);
    const ref=reference.summaries[i];
    for(const [actual,expected] of [[r.metrics.peakTensileForceN,ref.peakN],[r.metrics.primaryImpulseNs,ref.A],[r.metrics.fixed.signedNs,ref.B],[r.metrics.fixed.tensileOnlyNs,ref.C]]) expect(Math.abs(actual-expected)).toBeLessThan(Math.max(Math.abs(expected)*.001,1e-5));
    expect(r.metrics.minContactForceN).toBeGreaterThanOrEqual(0);
  });
  expect(metricSummary(rows,9.25,'peak').best).toBe(7.25);
  expect(metricSummary(rows,9.25,'first').best).toBe(13.25);
  expect(metricSummary(rows,9.25,'signed').indistinguishable).toEqual([5.25,7.25]);
  expect(metricSummary(rows,7.25,'peak').percent(rows[2])).toBe(0);
  expect(metricSummary(rows.filter(r=>r.positionM!==9.25),9.25,'peak')).toBeNull();
});
test('changed impulse window integrates live history without changing the peak',()=>{
  const r=calculateResearchPosition({...controls,endMs:10},9.25);
  expect(r.valid).toBe(true); expect(r.metrics.fixed.endS).toBe(.01);
  expect(r.metrics.fixed.tensileOnlyNs).toBeLessThan(reference.summaries[3].C);
  expect(r.metrics.peakTensileForceN).toBeCloseTo(reference.summaries[3].peakN,1);
});
