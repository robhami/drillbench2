import { deployDrillstring } from '../bha/deployDrillstring';
import { calcSurveyAxialLoads } from '../forces/calcSurveyAxialLoads';

const finite = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value));
const category = row => String(row.category || '').toUpperCase();
const fail = error => ({ valid: false, error });
const populated = row => row && ['category', 'toolName', 'selectedToolId', 'length', 'weight', 'od', 'idSize'].some(k => row[k] != null && String(row[k]).trim() !== '');

// Stage 1 relocation policy, independent of the Skeem dynamic adapter.
// One aggregate DC section each side; the optional bottom tool is never a DC.
export function staticJarPositionGeometry(bha) {
  const rows = (bha?.rows || []).filter(populated);
  const hasMotor = category(rows[0] || {}) === 'RSS_MTR';
  const offset = hasMotor ? 1 : 0;
  if (rows.map(category).join(',') !== (hasMotor ? 'RSS_MTR,DC,JAR,DC,DP' : 'DC,JAR,DC,DP')) {
    return fail('Stage 1 static relocation requires one aggregate DC section below and above one jar, followed by one uppermost DP section; an optional single RSS_MTR motor/tool must be below the lower DC. Other arrangements are unsupported.');
  }
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if ((category(r) !== 'DP' && (!finite(r.length) || Number(r.length) <= 0)) || !finite(r.weight) || Number(r.weight) <= 0) return fail(`Row ${i + 1}: positive fixed-tool length and explicit positive distributed air weight (lbf/ft) are required.`);
    if (!finite(r.od) || Number(r.od) <= 0 || !finite(r.idSize) || Number(r.idSize) < 0 || Number(r.idSize) >= Number(r.od)) return fail(`Row ${i + 1}: valid nominal OD and ID in inches are required; dimensions are not inferred.`);
  }
  const lower = rows[offset], jar = rows[offset + 1], upper = rows[offset + 2];
  if ([lower, upper].some(r => r.componentDefinition?.geometry?.kind === 'segmented' || r.componentDefinition?.sectionModel === 'complex')) return fail('Static relocation cannot redistribute segmented or complex collar definitions. Current-BHA static loads are assessed separately; stored segments are not resized or replaced.');
  if (['od', 'idSize', 'weight'].some(k => Number(lower[k]) !== Number(upper[k]))) return fail('Fixed-inventory relocation requires identical lower/upper collar OD, ID and entered air weight per foot. Mixed collar inventories are not redistributed.');
  return { valid: true, rows, hasMotor, lowerIndex: offset, upperIndex: offset + 2,
    motorLengthFt: hasMotor ? Number(rows[0].length) : 0,
    lowerCollarLengthFt: Number(lower.length), upperCollarLengthFt: Number(upper.length),
    collarInventoryFt: Number(lower.length) + Number(upper.length), jarLengthFt: Number(jar.length) };
}

export function calculateStaticJarPositions({ bha, survey, bitMdFt, surfaceMdFt = 0, mode, minLowerCollarFt, maxLowerCollarFt, samples }) {
  const geometry = staticJarPositionGeometry(bha);
  if (!geometry.valid) return geometry;
  if (!['slide', 'rotate'].includes(mode)) return fail('Static survey screening requires the shared Slide or Rotate drilling mode. Reference mode is not supported in this view.');
  if (!survey?.valid) return fail('Associate a valid confirmed survey; no scalar-inclination fallback or extrapolation is used.');
  if (!finite(bha.wob) || Number(bha.wob) < 0) return fail('Enter an explicit nonnegative current drilling WOB in klbf.');
  if (![minLowerCollarFt, maxLowerCollarFt, samples].every(finite)) return fail('Enter finite lower-collar bounds and an integer sample count.');
  const min = Number(minLowerCollarFt), max = Number(maxLowerCollarFt), count = Number(samples);
  if (!(min > 0 && max >= min && max < geometry.collarInventoryFt) || !Number.isSafeInteger(count) || count < 1 || count > 101 || ((count === 1) !== (min === max))) return fail('Use positive lower-collar lengths below the collar inventory and 1–101 samples; equal bounds require one sample. No length is clamped.');
  const lengths = Array.from({ length: count }, (_, i) => i === count - 1 ? max : min + (max - min) * i / (count - 1));
  if (lengths.some((v, i) => i && v <= lengths[i - 1])) return fail('Candidate length spacing cannot be resolved numerically.');
  const calculate = lowerLength => {
    const rows = geometry.rows.map((r, i) => i === geometry.lowerIndex ? { ...r, length: lowerLength } : i === geometry.upperIndex ? { ...r, length: geometry.collarInventoryFt - lowerLength } : { ...r });
    const candidateBha = { ...bha, rows };
    const deployment = deployDrillstring(candidateBha, bitMdFt, { surfaceMdFt });
    const load = deployment.valid ? calcSurveyAxialLoads({ bha: deployment.bha, survey, bitMdFt,
      wobLbf: Number(bha.wob) * 1000, mode, frictionCoefficient: bha.frictionCoefficient,
      mudWeightPpg: bha.mudWeight, rpm: bha.rpm, ropFtHr: bha.rop }) : deployment;
    return { lowerCollarLengthFt: lowerLength, upperCollarLengthFt: geometry.collarInventoryFt - lowerLength,
      candidateBha, deployment: deployment.metadata || null, valid: load.valid, status: load.status, errors: load.errors,
      jarLoadState: load.valid ? load.profile.find(p => p.fromBitFt === load.jars[0].centreFromBitFt).state : null,
      load: load.valid ? load : null };
  };
  const actual = calculate(geometry.lowerCollarLengthFt), candidates = lengths.map(calculate);
  return { valid: true, geometry, mode, bitMdFt: Number(bitMdFt), wobLbf: Number(bha.wob) * 1000, actual, candidates,
    validCount: candidates.filter(c => c.valid).length, invalidCount: candidates.filter(c => !c.valid).length,
    scope: 'Static drilling-load screening only. Motor identity and properties are retained; no motor stiffness, firing, force-time, impact or impulse prediction is made.' };
}
