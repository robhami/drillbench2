import evidence from '../../../docs/ValidationStudies/NeutralPointDirectionalMotorInvestigation.json';
import { calcSurveyAxialLoads } from '../../engineering/forces/calcSurveyAxialLoads';
import { deployDrillstring } from '../../engineering/bha/deployDrillstring';
import { calcJarClearanceAcrossRun } from '../../engineering/jar/jarClearanceAcrossRun';
import { comparisonClearances, comparisonPlot } from './clearanceData';
import { neutralPointChart } from './neutralPointChart';

test.each(['A','B','C'])('%s: vertical/motor/directional loads agree with independent RK4 and statics', name => {
  const study = evidence.studies[name];
  for (const sample of study.rows) {
    const request = study.request;
    const result = calcSurveyAxialLoads({ ...request, bha: deployDrillstring(request.bha, sample.depth).bha,
      bitMdFt: sample.depth, wobLbf: 35000, mode: sample.mode });
    expect(result.valid).toBe(true);
    expect(result.neutralPoints).toHaveLength(sample.fineReference.roots.length);
    expect(Math.abs(sample.reference.roots[0]-sample.fineReference.roots[0])).toBeLessThan(.0001);
    expect(Math.abs(result.neutralPoints[0].fromBitFt-sample.fineReference.roots[0])).toBeLessThan(.003);
    expect(Math.abs(result.topOfBhaAxialForce-sample.fineReference.topForce)).toBeLessThan(.2);
    if(name!=='C') {
      const bf=1-10/65.5;
      const expected=name==='A'?330+(35000/bf-300*116-30*150)/116:330+(35000/bf-30*100-300*116)/150;
      expect(result.neutralPoints[0].fromBitFt).toBeCloseTo(expected,7);
    }
  }
});

test('motor removal restores baseline; exact fixed-length boundary is valid, shorter deployment is rejected', () => {
  const {base,motor}=evidence;
  const inserted={...base,rows:[motor,...base.rows]};
  expect(deployDrillstring(inserted,539).valid).toBe(false);
  expect(deployDrillstring(inserted,540).valid).toBe(true);
  expect(deployDrillstring(inserted,540).metadata.deployedDpLengthFt).toBe(0);
  expect(deployDrillstring({...inserted,rows:inserted.rows.slice(1)},1000)).toEqual(deployDrillstring(base,1000));
  const missing={...inserted,rows:[{...motor,weight:''},...base.rows]};
  const result=calcSurveyAxialLoads({...evidence.studies.B.request,bha:deployDrillstring(missing,1000).bha,bitMdFt:1000,wobLbf:35000,mode:'slide'});
  expect(result.valid).toBe(false);
  expect(result.errors.join(' ')).toContain('air weight');
});

test('directional component crossings preserve samples; tangent plateau and final chart signs are retained', () => {
  const request=evidence.studies.C.request;
  const result=calcJarClearanceAcrossRun({...request,startBitMdFt:4000,depthIncrementFt:100});
  const series=comparisonClearances(result,request,.25);
  const chart=neutralPointChart(comparisonPlot(result,request,1,series),result,request,{},0,series.map(s=>s.selection));
  expect(result.invalidScenarios).toBe(0);
  for(const trace of chart.data.filter(t=>t.showlegend)) {
    for(const s of result.scenarios.filter(s=>trace.name.includes(s.mode==='slide'?'Slide':'Rotate'))) {
      expect(trace.y[trace.x.indexOf(s.bitMdFt)]).toBeCloseTo(s.neutralPoints[0].fromBitFt-s.jars[0].jarFromBitFt,8);
    }
    expect(trace.connectgaps).toBe(false);
  }
  const rotate=chart.data.find(t=>t.name.includes('Rotate'));
  expect(rotate.y[rotate.x.indexOf(8000)]).toBeCloseTo(rotate.y[rotate.x.indexOf(10000)],8);
  expect(chart.layout.shapes.some(s=>s.type==='line'&&s.y0===0&&s.y1===0)).toBe(true);
});
