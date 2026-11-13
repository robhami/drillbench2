// Shape adapter shared by research UI and applicability; no load equations.
import { calcComponentPositions } from '../bha/calcComponentPositions';
import { dynamicSectionIssue, rowLabel } from '../bha/componentApplicability';

export function copyResearchGeometry(bha, stuckFt) {
  if (String(stuckFt).trim() === '' || !Number.isFinite(Number(stuckFt)) || Number(stuckFt) < 0) return { error: 'Specify a nonnegative stuck-point position above the bit.' };
  if ((bha?.rows || []).some(r => (r.category || r.toolName || r.selectedToolId) && !(Number(r.length) > 0))) return { error: 'Complete positive BHA component lengths first.' };
  const { components } = calcComponentPositions(bha), jars = components.filter(r => String(r.category).toUpperCase() === 'JAR');
  if (jars.length !== 1 || Number(stuckFt) >= jars[0].startFromBit) return { error: 'Exactly one jar and a stuck point below its lower face are required.' };
  const jar = jars[0], upper = components.slice(components.indexOf(jar) + 1).reverse();
  const lower = components.filter(r => r.endFromBit > Number(stuckFt) && r.startFromBit < jar.startFromBit).reverse();
  for (const row of [...upper, ...lower]) {
    const index = components.indexOf(row);
    const issue = dynamicSectionIssue(row, index, 'Dynamic Jar Down research');
    if (issue) return { error: issue };
    if (!['DP', 'DC'].includes(String(row.category).toUpperCase())) return { error: `Dynamic Jar Down research: ${rowLabel(row, index)} (${row.category}) requires a validated tool mass/stiffness/transmission definition. Only explicit DP/DC tubular rods are supported; no equivalent section is substituted.` };
  }
  if (!upper.length || !lower.length || [...upper, ...lower].some(r => !['DP', 'DC'].includes(String(r.category).toUpperCase()) || r.idSize == null || !Number.isFinite(Number(r.od)) || !(Number(r.od) > Number(r.idSize)) || String(r.idSize).trim() === '' || !(Number(r.idSize) >= 0))) return { error: 'Only explicit DP/DC tubular sections with valid OD/ID can be copied. Tools and mixed tool spans are not approximated.' };
  const shape = r => ({ lengthFt: r.endFromBit - Math.max(Number(stuckFt), r.startFromBit), areaIn2: Math.PI * (Number(r.od) ** 2 - Number(r.idSize) ** 2) / 4 });
  return { upperRods: upper.map(shape), lowerRods: lower.map(shape) };
}
