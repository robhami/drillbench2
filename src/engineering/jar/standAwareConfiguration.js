const TYPE_COUNTS = Object.freeze({ double: 2, triple: 3 });

/** Resolve explicitly measured DC joint lengths; aggregate BHA footage is never
 * interpreted as individual joint length or as proof of a rackable stand. */
export function resolveStandConfiguration({ standType = 'triple', jointLengthsFt = [], jarAboveJoints = 0, jarBelowJoints = 0,
  minRackingLengthFt = '', maxRackingLengthFt = '', bhaRows = [] } = {}) {
  const lengths = Array.isArray(jointLengthsFt) ? jointLengthsFt.map(Number) : [];
  const expected = TYPE_COUNTS[standType];
  const errors = [];
  if (!expected && standType !== 'custom') errors.push('Choose Double, Triple or Custom stand makeup.');
  if (!lengths.length || lengths.some(length => !Number.isFinite(length) || length <= 0)) errors.push('Enter each measured DC joint length in the selected stand makeup.');
  if (expected && lengths.length !== expected) errors.push(`${standType === 'double' ? 'Double' : 'Triple'} makeup requires exactly ${expected} measured joint lengths.`);
  if (standType === 'custom' && lengths.length > 12) errors.push('Custom makeup is limited to 12 joints per stand.');
  if (![jarAboveJoints, jarBelowJoints].every(value => Number.isInteger(Number(value)) && Number(value) >= 0)) errors.push('Jar-stand collar counts must be non-negative whole joints.');
  const jarJointCount = Number(jarAboveJoints) + Number(jarBelowJoints);
  const hasJar = bhaRows.some(row => String(row.category).toUpperCase() === 'JAR');
  if (lengths.length && hasJar && jarJointCount !== lengths.length) errors.push('Assign every measured collar in the complete jar-containing stand above or below the jar.');
  const standLengthFt = lengths.reduce((sum, value) => sum + value, 0);
  const jarStandLengthFt = Number.isFinite(standLengthFt) && lengths.length && hasJar
    ? Number(bhaRows.find(row => String(row.category).toUpperCase() === 'JAR')?.length || 0) + lengths.slice(0, jarJointCount).reduce((sum, value) => sum + value, 0)
    : standLengthFt;
  const min = minRackingLengthFt === '' ? NaN : Number(minRackingLengthFt);
  const max = maxRackingLengthFt === '' ? NaN : Number(maxRackingLengthFt);
  const hasLimits = Number.isFinite(min) && min > 0 && Number.isFinite(max) && max >= min;
  if ((minRackingLengthFt !== '' || maxRackingLengthFt !== '') && !hasLimits) errors.push('Racking limits must be positive, with minimum no greater than maximum.');
  if (hasLimits && lengths.length && (standLengthFt < min || standLengthFt > max || jarStandLengthFt < min || jarStandLengthFt > max)) {
    errors.push('The standard or jar-containing stand falls outside the configured racking-length limits.');
  }

  const connectionCheck = assessRigConnections(bhaRows);
  // The current BHA schema has no independently validated rack-assembly record.
  // User-entered makeup and limits screen lengths, but cannot certify handling.
  const rackingFeasibility = 'unverified';
  const reasons = [
    ...(!hasLimits ? ['Rig racking limits are not configured.'] : []),
    ...(!connectionCheck.verified ? [connectionCheck.reason] : []),
    ...(!bhaRows.every(row => row.standId || row.standMakeup) ? ['Saved BHA does not identify individual racked stand membership.'] : [])
  ];
  return { valid: errors.length === 0, errors, standType, jointLengthsFt: lengths, jointsPerStand: lengths.length,
    standLengthFt, jarStandLengthFt, jarAboveJoints: Number(jarAboveJoints), jarBelowJoints: Number(jarBelowJoints),
    minRackingLengthFt: min, maxRackingLengthFt: max, rackingFeasibility,
    handlingStatus: rackingFeasibility === 'verified' ? 'Rig handling verified' : 'Rig handling unverified', handlingReasons: reasons };
}

export function standChangePositions(configuration, minimum, maximum, increment) {
  if (!configuration?.valid) throw Error(configuration?.errors?.join(' ') || 'Complete a valid stand makeup.');
  if (![minimum, maximum, increment].every(Number.isInteger) || minimum > maximum || increment < 1) throw Error('Stand changes require whole-number bounds and a positive whole-number increment.');
  const changes = [];
  for (let value = minimum; value <= maximum; value += increment) changes.push(value);
  if (!changes.includes(0)) changes.push(0);
  const unique = [...new Set(changes)].sort((a, b) => a - b);
  if (unique.length > 25) throw Error('Limit the stand-position comparison to 25 configurations, including the current BHA.');
  return unique.map(standChange => ({ standChange, movementFt: standChange * configuration.standLengthFt }));
}

export function assessRigConnections(rows) {
  const components = (rows || []).filter(row => Number(row.length) > 0);
  if (!components.length || components.some(row => !row.componentDefinition?.connectionTop || !row.componentDefinition?.connectionBottom)) {
    return { verified: false, reason: 'Connection data is incomplete.' };
  }
  for (let i = 1; i < components.length; i++) {
    const lower = components[i - 1].componentDefinition.connectionTop;
    const upper = components[i].componentDefinition.connectionBottom;
    if (String(lower).trim().toUpperCase() !== String(upper).trim().toUpperCase()) return { verified: false, reason: `Connection mismatch between rows ${i} and ${i + 1}.` };
  }
  return { verified: true, reason: '' };
}
