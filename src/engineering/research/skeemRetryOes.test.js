import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import previous from '../../../docs/ValidationStudies/RealBHADynamicStage6E3/study.json';
import catalogue from '../../data/components.json';
import { prepareJarUpSweep } from './jarUpSweep';
import { mapRealBhaWaveGeometry } from './realBhaDynamicComparison';
import { calculateNonUniformSkeemUp } from './nonUniformSkeemUp';
import { runRealBhaSkeem } from './realBhaSkeemComparison';

// Reconstructed 641.830-ft geometry, not the unavailable live 641.870-ft BHA.
const bit = catalogue.components.find(c => c.id === 'bha-9');
const bha = { ...frozen.workingCopy, rows: [{ rowId: 'retry-tci-bit', category: 'BIT', selectedToolId: bit.id,
  toolName: bit.name, od: bit.od, idSize: bit.idSize, weight: bit.weight, length: 1, componentDefinition: bit }, ...frozen.workingCopy.rows] };
const settings = { ...previous.settings, localTensionLbf: 185000, strokeIn: 7.5, durationS: .05, windowStartS: 0, windowEndS: .05,
  equivalents: { ...previous.settings.equivalents, 'retry-tci-bit': { areaM2: .0150773892, densityKgM3: 7850,
    youngsModulusPa: 200e9, provenance: 'User supplied diagnostic TCI properties; illustrative only.' } } };

test('reconstructed TCI baseline and +/-30 ft complete without altering physical inputs or existing successful values', () => {
  const original = JSON.stringify(bha);
  const request = { bha, bitMdFt: 9318, jarIndex: 0, settings };
  const sweep = prepareJarUpSweep({ ...request, minimumFt: 611.83, maximumFt: 671.83, incrementFt: 30, model: 'non-uniform-skeem' });
  expect(sweep.rejected).toEqual([]);
  expect(sweep.cases.map(c => c.movementFt)).toEqual([-30, 0, 30]);
  const expected = [[3226243.301746234, 36959.127049061564], [3194433.623376503, 32820.09655473377], [3330795.794093759, 28006.683641664964]];
  sweep.cases.forEach((candidate, index) => {
    const map = mapRealBhaWaveGeometry({ ...request, bha: candidate.bha });
    const initial = calculateNonUniformSkeemUp({ acknowledged: true, localTensionN: 185000*4.4482216152605,
      strokeM: 7.5*.0254, upperSections: map.upper, lowerSections: map.lower, durationS: .05, preImpactHorizonS: .1 });
    expect(initial.valid).toBe(index !== 0);
    const result = runRealBhaSkeem({ ...request, bha: candidate.bha });
    expect(result.valid).toBe(true);
    expect(result.metrics.peakTensileN).toBeCloseTo(expected[index][0], 5);
    expect(result.metrics.fixedTensileNs).toBeCloseTo(expected[index][1], 5);
    expect(result.maintainedEngagement.admissible).toBe(true);
    expect(Math.abs(result.numerical.handoffResidualJ)).toBeLessThanOrEqual(result.numerical.energyLimitJ);
    expect(result.computation.retried).toBe(index === 0);
    const attempts = result.computation.phaseAttempts.filter(a => a.phase === 'post-impact');
    expect(attempts.map(a => a.eventLimit)).toEqual(index === 0 ? [250000, 500000] : [250000]);
    if (index === 0) expect(attempts[1].processedEvents).toBe(260470);
    else {
      expect(result.metrics.peakTensileN).toBe(initial.metrics.peakTensileN);
      expect(result.metrics.fixedTensileNs).toBe(initial.metrics.tensileNs);
    }
  });
  expect(JSON.stringify(bha)).toBe(original);
}, 180000);
