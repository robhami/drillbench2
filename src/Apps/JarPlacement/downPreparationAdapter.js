import { calcComponentPositions } from '../../engineering/bha/calcComponentPositions';
import { calcJarDownPreparation } from '../../engineering/jar/jarDownPreparation';
import { directionSettings } from '../JarForces/directionalJarConfig';

// Uses existing geometry and direction metadata; does not derive a load profile.
export function evaluateJarDownPreparation(bha, fields) {
  const numeric = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v));
  const jars = calcComponentPositions(bha).components.filter(c => String(c.category).toUpperCase() === 'JAR');
  const unavailable = message => ({ valid: false, dynamicPredictionAvailable: false, issues: [message], warnings: [] });
  if (jars.length !== 1) return unavailable('Exactly one jar is required to identify the downward load location.');
  const jar = jars[0], settings = directionSettings(jar, 'down');
  if (String(fields.stuckPointFt ?? '').trim() === '' || !Number.isFinite(Number(fields.stuckPointFt)) || Number(fields.stuckPointFt) < 0 || Number(fields.stuckPointFt) >= jar.startFromBit) {
    return unavailable('Define a stuck point below the jar lower face; missing or above-jar sticking is unsupported.');
  }
  return { ...calcJarDownPreparation({
    compressionLbf: numeric(fields.compressionKlbf) ? Number(fields.compressionKlbf) * 1000 : '',
    freeStrokeIn: fields.strokeIn, loadBasis: fields.loadBasis,
    pressureDropPsi: fields.pressureDropPsi, pumpOpenAreaIn2: fields.pumpOpenAreaIn2,
    compressionReference: fields.compressionReference, manufacturerReference: fields.manufacturerReference,
    mechanism: settings.mechanism
  }), jar, settings };
}
