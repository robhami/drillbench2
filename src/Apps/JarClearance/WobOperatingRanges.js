import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { calcWobRangesAtDepth } from '../../engineering/jar/wobOperatingRanges';
import { wobRangesPlot } from './wobRangesPlot';

const Plot = lazy(() => import('../JarConfiguration/ConfigurationPlot'));

export default function WobOperatingRanges({ request, depthsFt, frictionCoefficient, jarIndex, revision }) {
  const [scanStep, setScanStep] = useState('0.5');
  const [result, setResult] = useState(null), [progress, setProgress] = useState(null), [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1; setResult(null); setProgress(null); setError('');
    return () => { generation.current += 1; };
  }, [request, depthsFt, frictionCoefficient, jarIndex, scanStep]);
  const calculate = async () => {
    const spacing = Number(scanStep) * 1000, range = Number(request.maxWobLbf) - Number(request.minWobLbf);
    const cells = Math.ceil(range / spacing);
    if (!(spacing > 0 && Number.isFinite(spacing)) || !Number.isSafeInteger(cells) || cells * 2 + 1 > 2048 ||
        depthsFt.length * 2 * (cells * 2 + 1 + 96) > 100000) {
      setError('Increase WOB scan spacing: maximum 2,048 evaluations per depth/mode and a 100,000-evaluation run planning budget.'); return;
    }
    if (!request.frictionCoefficients.includes(frictionCoefficient)) {
      setError('Select a friction coefficient included in this run.'); return;
    }
    const token = ++generation.current, rows = [];
    let remainingEvaluations = 100000;
    setResult(null); setError(''); setProgress(0);
    for (let i = 0; i < depthsFt.length; i += 1) {
      // Yield between depths so progress and cancellation remain responsive.
      await new Promise(resolve => setTimeout(resolve, 0));
      if (token !== generation.current) return;
      for (const mode of ['slide', 'rotate']) {
        const row = calcWobRangesAtDepth(request, depthsFt[i], mode, frictionCoefficient, jarIndex, { scanStepLbf: spacing, maxEvaluations: Math.min(2048, remainingEvaluations) });
        remainingEvaluations -= row.evaluationCount || 0;
        rows.push(row);
      }
      setProgress(i + 1);
    }
    if (token !== generation.current) return;
    setResult(rows); setProgress(null);
  };
  const rangeLbf = [Number(request.minWobLbf), Number(request.maxWobLbf)];
  const plot = result ? wobRangesPlot(result, rangeLbf, revision) : null;
  return <section aria-label="WOB operating ranges" className="wobOperatingRanges">
    <h6>WOB ranges versus bit depth</h6>
    <p>Evaluated WOB: {rangeLbf[0] / 1000}–{rangeLbf[1] / 1000} klbf · friction {frictionCoefficient} · selected jar {jarIndex + 1}.</p>
    <label>WOB scan spacing (klbf) <input type="number" min="0.001" step="any" value={scanStep} onChange={e => setScanStep(e.target.value)} /></label>{' '}
    <button type="button" disabled={progress !== null} onClick={calculate}>Calculate WOB ranges</button>
    {progress !== null && <><span role="status"> Evaluated {progress} / {depthsFt.length} depths</span>{' '}<button type="button" onClick={() => { generation.current += 1; setProgress(null); }}>Cancel WOB calculation</button></>}
    {error && <p role="alert">{error}</p>}
    {plot && <Suspense fallback={<p>Loading WOB graph...</p>}><Plot {...plot} /></Suspense>}
    {result && <p role="status">{result.filter(r => !r.valid || r.regions.some(region => region.status === 'unknown')).length} depth/mode results include unresolved regions or boundary brackets. Refined brackets are at most 0.001 klbf wide with clearance residual at most 0.01 ft.</p>}
    <p>Jar-placement screening, not a manufacturer-approved operating limit. Coloured intervals are sample-supported at sampled depths only; midpoint checks halve the scan spacing. Narrow unsampled excursions may exist. Grey regions include missing NPs, failed calculations and unresolved transitions. Boundary brackets remain excluded from acceptable intervals. Dashed lines mark the evaluated WOB range, not operating limits. No maximum WOB is inferred. Refine spacing near boundaries.</p>
  </section>;
}
