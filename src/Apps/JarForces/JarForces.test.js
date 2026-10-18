import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent, within } from '@testing-library/react';
import JarForces from './JarForces';
import { SURVEY_STORAGE_KEY, SURVEY_CHANGED_EVENT } from '../Survey/Survey';

const source = { originalCsv: 'MD,Inclination,Azimuth\n0,0,90\n20000,0,90', confirmed: true, filename: 'vertical.csv' };
const bha = { name: 'Static fixture', mudWeight: 10, frictionCoefficient: 0.25, drillpipeReferenceBitMdFt: 1010,
  rows: [{ category: 'JAR', length: 20, weight: 100 }, { category: 'DC', length: 990, weight: 100 }] };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
// Fixtures explicitly provide shared depth, independently of production defaults.
const mount = element => {
  const depth = element.props.analysisBitMdFt ?? element.props.bha.drillpipeReferenceBitMdFt ?? 1010;
  const withDepth = e => React.cloneElement(e, { analysisBitMdFt: depth, ...e.props });
  const view = render(withDepth(element));
  return { ...view, rerender: e => view.rerender(withDepth(e)) };
};
const calculate = () => {
  const advanced = screen.getByText('Advanced - forward static calculator').closest('details');
  if (!advanced.open) fireEvent.click(screen.getByText('Advanced - forward static calculator'));
  fireEvent.click(screen.getByRole('button', { name: 'Calculate static jar load' }));
};
beforeEach(() => { localStorage.clear(); localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(source)); });

test('absolute hookload calculates independently with explicit signs, physical reaction assumption and no charts', () => {
  mount(<JarForces bha={bha} />);
  expect(screen.queryByText('Jar-centre axial load')).not.toBeInTheDocument();
  change('Surface hookload / axial support (klbf)', '120'); calculate();
  expect(screen.getByText('-35.3 · tension')).toBeInTheDocument();
  expect(screen.getByText('120.0 · pickup')).toBeInTheDocument();
  expect(screen.queryByText('Incremental transferred load')).not.toBeInTheDocument();
  expect(screen.getByText(/Positive axial load = compression; negative = tension/)).toBeInTheDocument();
  expect(screen.getByText('The lower assembly is assumed to provide the necessary reaction.')).toBeInTheDocument();
  expect(screen.getByText(/are not jar firing forces/)).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  change('Operation', 'slackoff');
  expect(screen.queryByText('Jar-centre axial load')).not.toBeInTheDocument();
  calculate();
  expect(screen.getByText('-35.3 · tension')).toBeInTheDocument();
  expect(screen.getByText('120.0 · slack-off')).toBeInTheDocument();
});

test('reference overpull and set-down display assumed baseline, derived hookload and signed incremental transfer', () => {
  mount(<JarForces bha={bha} />);
  change('Load input', 'reference');
  expect(screen.getByText(/assumed frictionless baseline, not an actual measured parked state/)).toBeInTheDocument();
  change('Reference hookload (klbf)', '100'); change('Applied surface overpull (klbf)', '20'); calculate();
  expect(screen.getByText('-35.3 · tension')).toBeInTheDocument();
  expect(screen.getByText('20.0 · upward tensile change')).toBeInTheDocument();
  change('Operation', 'slackoff'); calculate();
  expect(screen.getByText('80.0 · slack-off')).toBeInTheDocument();
  expect(screen.getByText('4.7 · compression')).toBeInTheDocument();
  expect(screen.getByText('20.0 · downward compressive change')).toBeInTheDocument();
  change('Applied surface set-down (klbf)', '101'); calculate();
  expect(screen.getByRole('alert')).toHaveTextContent('unsupported downward surface push');
  expect(screen.queryByText('Jar-centre axial load')).not.toBeInTheDocument();
});

test('blank hookloads, missing survey and incomplete coverage never produce a default load', () => {
  const first = mount(<JarForces bha={bha} />);
  calculate(); expect(screen.getByRole('alert')).toHaveTextContent('blank loads are not zero');
  first.rerender(<JarForces bha={bha} analysisBitMdFt={2000} />); change('Surface hookload / axial support (klbf)', '100'); calculate();
  expect(screen.getByRole('alert')).toHaveTextContent('complete deployed string');
  first.unmount(); localStorage.removeItem(SURVEY_STORAGE_KEY);
  mount(<JarForces bha={bha} />);
  change('Surface hookload / axial support (klbf)', '100'); calculate();
  expect(screen.getByRole('alert')).toHaveTextContent('Import a directional survey');
});

test('selected jar controls physical section and deployment uses actual DP length', () => {
  const assembly = { ...bha, drillpipeReferenceBitMdFt: 1000, rows: [
    { category: 'JAR', length: 20, weight: 100 }, { category: 'DC', length: 50, weight: 100 },
    { category: 'JAR', length: 20, weight: 200 }, { category: 'DP', length: 15000, weight: 100 }
  ] };
  const view = mount(<JarForces bha={assembly} />);
  change('Selected jar', '1'); change('Surface hookload / axial support (klbf)', '120'); calculate();
  expect(screen.getByText(/Jar centre MD 920.0 ft · Deployed DP 910.0 ft/)).toBeInTheDocument();
  expect(screen.getByText('-41.2 · tension')).toBeInTheDocument();
});

test('BHA and survey remain unchanged, source/BHA changes invalidate results', () => {
  const original = JSON.stringify(bha), stored = localStorage.getItem(SURVEY_STORAGE_KEY);
  localStorage.setItem('drillbenchWell', 'unchanged');
  const { rerender } = mount(<JarForces bha={bha} />);
  change('Surface hookload / axial support (klbf)', '100'); calculate();
  expect(screen.getByText('Jar-centre axial load')).toBeInTheDocument();
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...source, confirmed: false } }));
  expect(screen.queryByText('Jar-centre axial load')).not.toBeInTheDocument();
  calculate(); expect(screen.getByRole('alert')).toHaveTextContent('Explicitly confirm');
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: source })); calculate();
  expect(screen.getByText('Jar-centre axial load')).toBeInTheDocument();
  rerender(<JarForces bha={{ ...bha, name: 'Updated' }} />);
  expect(screen.queryByText('Jar-centre axial load')).not.toBeInTheDocument();
  expect(JSON.stringify(bha)).toBe(original);
  expect(localStorage.getItem(SURVEY_STORAGE_KEY)).toBe(stored);
  expect(localStorage.getItem('drillbenchWell')).toBe('unchanged');
});


const row = (table, label) => within(screen.getByRole('table', { name: table })).getByText(label).closest('tr');
const cells = (table, label) => [...row(table, label).querySelectorAll('td')];
const values = (table, label) => cells(table, label).map(n => n.textContent);
const rotatingBha = { ...bha, rpm: 150, rop: 60, rows: bha.rows.map(r => ({ ...r, od: 6.75 })) };

test('four-column tables group weights and operating predictions, with two-column prominent jar results', () => {
  mount(<JarForces bha={rotatingBha} />);
  const weights = screen.getByRole('table', { name: 'String Weight' });
  expect(within(weights).getAllByRole('rowheader').map(n => n.querySelector('span').textContent)).toEqual(['Total Deployed String', 'Total BHA', 'Above Jar Centre', 'Below Jar Centre', 'Fixed BHA Above Jar']);
  expect(within(weights).getAllByRole('columnheader').map(n => n.textContent)).toEqual(['Component', 'Air Weight(klbf)', 'Buoyed Weight(klbf)', 'Inclination Corrected(klbf)']);
  const operations = screen.getByRole('table', { name: 'Operating Hookloads' });
  expect(within(operations).getAllByRole('rowheader').map(n => n.querySelector('span').textContent)).toEqual(['Pickup', 'Rotating Off Bottom', 'Slack-Off']);
  expect(values('Operating Hookloads', 'Rotating Off Bottom')).toEqual(['85.6', '0.0', 'Rotation only']);
  expect(screen.queryByRole('region', { name: 'Well Conditions' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Mud weight (ppg)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Friction coefficient')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Off-bottom RPM')).not.toBeInTheDocument();
  change('Surface hookload / axial support (klbf)', '120'); calculate();
  expect(row('Jar Force Results', 'Jar-centre axial load')).toHaveClass('jarForcesPrimaryLoad');
  expect(values('Jar Force Results', 'Jar-centre axial load')[0]).toContain('tension');
  for (const table of screen.getAllByRole('table')) {
    const columns = table.getAttribute('aria-label') === 'Jar Force Results' ? 2 : 4;
    for (const tr of within(table).getAllByRole('row')) expect(tr.children).toHaveLength(columns);
    for (const info of table.querySelectorAll('.jarForcesInfo')) {
      expect(info).toHaveAttribute('tabindex', '0'); expect(info.getAttribute('title')).toBeTruthy();
    }
  }
});

test('shared analysis depth is read-only, separate from Auto DP reference, and invalidates both calculations', () => {
  const { rerender } = render(<JarForces bha={rotatingBha} />);
  expect(screen.queryByLabelText('Bit Depth (ft MD)')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Calculate required hookload' })).toBeDisabled();
  expect(screen.getByText(/Analysis bit MD:/)).toHaveTextContent('Required in Analysis Inputs');
  rerender(<JarForces bha={rotatingBha} analysisBitMdFt={1010} />);
  expect(screen.getByText(/Analysis bit MD:/)).toHaveTextContent('1,010.0 ft');
  expect(screen.queryByLabelText('Selected jar')).not.toBeInTheDocument();
  expect(screen.getByText(/Selected jar:/)).toHaveTextContent('only jar in BHA');
  change('Desired axial force at jar (klbf)', '20');
  fireEvent.click(screen.getByRole('button', { name: 'Calculate required hookload' }));
  expect(screen.getByText('Required surface hookload')).toBeInTheDocument();
  change('Surface hookload / axial support (klbf)', '120'); calculate();
  rerender(<JarForces bha={rotatingBha} analysisBitMdFt={2000} />);
  expect(screen.queryByText('Required surface hookload')).not.toBeInTheDocument();
  expect(screen.queryByRole('table', { name: 'Jar Force Results' })).not.toBeInTheDocument();
  expect(screen.getByText(/Analysis bit MD:/)).toHaveTextContent('2,000.0 ft');
  expect(values('String Weight', 'Total Deployed String')).toEqual(['Unavailable', 'Unavailable', 'Unavailable']);
  for (const title of ['Engineering Assumptions', 'Calculation Details']) expect(screen.getByText(title).closest('details')).not.toHaveAttribute('open');
});

test('shared mud, friction and RPM synchronize immediately without resetting local analysis depth or jar inputs', () => {
  const { rerender } = mount(<JarForces bha={rotatingBha} />);
  fireEvent(window, new CustomEvent(SURVEY_CHANGED_EVENT, { detail: { ...source, originalCsv: 'MD,Inclination,Azimuth\n0,60,90\n20000,60,90' } }));
  expect(values('String Weight', 'Total Deployed String')).toEqual(['101.0', '85.6', '42.8']);
  const pickup = Number(values('Operating Hookloads', 'Pickup')[0]);
  change('Surface hookload / axial support (klbf)', '120'); calculate();
  rerender(<JarForces bha={{ ...rotatingBha, mudWeight: 20, frictionCoefficient: 0.5, rpm: 300, drillpipeReferenceBitMdFt: 9999 }} />);
  expect(screen.getByText(/Analysis bit MD:/)).toHaveTextContent('1,010.0 ft');
  expect(screen.getByLabelText('Surface hookload / axial support (klbf)')).toHaveValue(120);
  expect(screen.queryByText('Jar-centre axial load')).not.toBeInTheDocument();
  expect(values('String Weight', 'Total Deployed String')).toEqual(['101.0', '70.2', '35.1']);
  expect(Number(values('Operating Hookloads', 'Pickup')[0])).toBeGreaterThan(pickup);
  expect(screen.getByText(/Shared Analysis Inputs:/)).toHaveTextContent('mud 20 ppg, friction 0.5, RPM 300');
  rerender(<JarForces bha={{ ...rotatingBha, rpm: 0 }} />);
  expect(values('Operating Hookloads', 'Rotating Off Bottom')[0]).toContain('positive RPM');
  expect(values('Operating Hookloads', 'Pickup')[1]).toContain('Unavailable');
});

test.each(['mudWeight', 'frictionCoefficient', 'rpm'])('missing shared %s is explicit and never replaced by stale local values', field => {
  const { rerender } = mount(<JarForces bha={rotatingBha} />);
  rerender(<JarForces bha={{ ...rotatingBha, [field]: undefined }} />);
  expect(screen.getByText(/Shared Analysis Inputs:/)).toHaveTextContent('Unavailable');
  if (field === 'mudWeight') expect(values('String Weight', 'Total Deployed String')).toEqual(['Unavailable', 'Unavailable', 'Unavailable']);
  else expect(values('String Weight', 'Total Deployed String')[0]).toBe('101.0');
  const mode = field === 'rpm' ? 'Rotating Off Bottom' : 'Pickup';
  expect(values('Operating Hookloads', mode)[0]).toContain('Unavailable');
  change('Surface hookload / axial support (klbf)', '120'); calculate();
  if (field !== 'rpm') expect(screen.getByRole('alert')).toHaveTextContent('finite values');
  else expect(screen.getByText('Jar-centre axial load')).toBeInTheDocument(); // static branch needs no RPM
});

test('depth deployment and selected jar split update every weight column without modifying saved BHA', () => {
  const assembly = { ...rotatingBha, drillpipeReferenceBitMdFt: 1000, rows: [
    { category: 'JAR', length: 20, weight: 100, od: 6.75 }, { category: 'DC', length: 50, weight: 100, od: 6.75 },
    { category: 'JAR', length: 20, weight: 200, od: 6.75 }, { category: 'DP', length: 15000, weight: 100, od: 5.5 }
  ] };
  const before = JSON.stringify(assembly);
  const view = mount(<JarForces bha={assembly} />);
  change('Selected jar', '1');
  expect(values('String Weight', 'Above Jar Centre')).toEqual(['93.0', '78.8', '78.8']);
  expect(values('String Weight', 'Below Jar Centre')).toEqual(['9.0', '7.6', '7.6']);
  expect(values('String Weight', 'Fixed BHA Above Jar')).toEqual(['2.0', '1.7', '1.7']);
  view.rerender(<JarForces bha={assembly} analysisBitMdFt={1100} />);
  expect(values('String Weight', 'Total Deployed String')[0]).toBe('112.0');
  expect(values('String Weight', 'Fixed BHA Above Jar')[0]).toBe('2.0');
  expect(JSON.stringify(assembly)).toBe(before);
});

test('one decimal display preserves entered precision and incremental-mode controls', () => {
  mount(<JarForces bha={rotatingBha} />);
  change('Surface hookload / axial support (klbf)', '120.123456'); calculate();
  expect(screen.getByLabelText('Surface hookload / axial support (klbf)')).toHaveValue(120.123456);
  expect(values('Jar Force Results', 'Jar-centre axial load')[0]).toContain('-35.4');
  expect(values('String Weight', 'Total Deployed String')).toEqual(['101.0', '85.6', '85.6']);
  expect(screen.queryByLabelText('Reference hookload (klbf)')).not.toBeInTheDocument();
  change('Load input', 'reference');
  expect(screen.getByLabelText('Reference hookload (klbf)')).toBeInTheDocument();
  expect(screen.queryByLabelText('Surface hookload / axial support (klbf)')).not.toBeInTheDocument();
});

test('Test 4 predictions retain validated values in the four-column UI', () => {
  const csv = fs.readFileSync(path.join(process.cwd(), 'docs/ValidationStudies/SyntheticDirectionalWell.csv'), 'utf8');
  localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify({ ...source, originalCsv: csv }));
  const assembly = { ...rotatingBha, drillpipeReferenceBitMdFt: 12000, rows: [
    { category: 'STAB', length: 5, weight: 111.25, od: 6.75 }, { category: 'DC', length: 300, weight: 116, od: 6.75 },
    { category: 'JAR', length: 30, weight: 150, od: 9.5 }, { category: 'DC', length: 180, weight: 116, od: 6.75 },
    { category: 'DP', length: 11485, weight: 27.76, od: 5.5 }
  ] };
  mount(<JarForces bha={assembly} />);
  expect(values('Operating Hookloads', 'Pickup')).toEqual(['297.7', '86.2', 'Upward']);
  expect(values('Operating Hookloads', 'Rotating Off Bottom')).toEqual(['211.5', '0.0', 'Rotation only']);
  expect(values('Operating Hookloads', 'Slack-Off')).toEqual(['154.5', '57.0', 'Downward']);
  expect(values('String Weight', 'Total Deployed String')).toEqual(['379.6', '321.6', '211.5']);
  expect(values('String Weight', 'Fixed BHA Above Jar')).toEqual(['23.1', '19.6', '9.8']);
  expect(values('String Weight', 'Total BHA')).toEqual(['60.7', '51.5', '25.7']);
});

test('inverse Jar Loading targets Up and Down, verifies signs and exposes unreachable errors', () => {
  mount(<JarForces bha={rotatingBha} />);
  const advanced = screen.getByText('Advanced - forward static calculator').closest('details');
  expect(advanced).not.toHaveAttribute('open');
  change('Desired axial force at jar (klbf)', '20');
  const solve = () => fireEvent.click(screen.getByRole('button', { name: 'Calculate required hookload' }));
  solve();
  expect(values('Jar Loading Results', 'Required surface hookload')[0]).toBe('104.7 klbf');
  expect(values('Jar Loading Results', 'Desired jar force')[0]).toContain('20.0 klbf Jar Up (tension)');
  expect(within(screen.getByRole('table', { name: 'Jar Loading Results' })).getAllByRole('row')).toHaveLength(3);
  expect(screen.getByText('Calculation Details').closest('details')).not.toHaveAttribute('open');
  fireEvent.click(screen.getByText('Calculation Details'));
  expect(values('Jar Loading Diagnostics', 'Jar-centre axial load')[0]).toContain('-20.0');
  expect(values('Jar Loading Diagnostics', 'Jar-centre axial load')[0]).toContain('tension');
  expect(values('Jar Loading Diagnostics', 'Difference from rotating')[0]).toBe('19.2 klbf');
  expect(values('Jar Loading Diagnostics', 'Solver status')[0]).toBe('Forward verified');
  change('Jar direction', 'down');
  expect(screen.queryByText('Required surface hookload')).not.toBeInTheDocument();
  solve();
  expect(values('Jar Loading Results', 'Required surface hookload')[0]).toBe('64.7 klbf');
  expect(values('Jar Loading Diagnostics', 'Jar-centre axial load')[0]).toContain('compression');
  change('Desired axial force at jar (klbf)', '100'); solve();
  expect(screen.getByRole('alert')).toHaveTextContent('downward surface push');
  expect(screen.queryByText('Required surface hookload')).not.toBeInTheDocument();
  change('Desired axial force at jar (klbf)', ''); solve();
  expect(screen.getByRole('alert')).toHaveTextContent('positive magnitude');
});

test('no jar is an explicit visible error, and the inverse button cannot run', () => {
  mount(<JarForces bha={{ ...rotatingBha, rows: rotatingBha.rows.filter(r => r.category !== 'JAR') }} />);
  expect(screen.getByRole('alert')).toHaveTextContent('No jar exists in the BHA');
  expect(screen.getByRole('button', { name: 'Calculate required hookload' })).toBeDisabled();
});

test('inverse load remains available without RPM while the rotating comparison is explicitly unavailable', () => {
  mount(<JarForces bha={{ ...rotatingBha, rpm: '' }} />);
  change('Desired axial force at jar (klbf)', '20');
  fireEvent.click(screen.getByRole('button', { name: 'Calculate required hookload' }));
  expect(values('Jar Loading Results', 'Required surface hookload')[0]).toBe('104.7 klbf');
  fireEvent.click(screen.getByText('Calculation Details'));
  expect(values('Jar Loading Diagnostics', 'Difference from rotating')[0]).toContain('Unavailable');
});

test('table definitions distinguish inclination correction, hookload, drag and pure rotation', () => {
  mount(<JarForces bha={rotatingBha} />);
  const weights = screen.getByRole('table', { name: 'String Weight' });
  expect(within(weights).getByText('Inclination Corrected')).toHaveAttribute('title', 'Buoyed weight corrected for well inclination, excluding frictional drag. Represents the axial component of weight along the wellbore.');
  const operations = screen.getByRole('table', { name: 'Operating Hookloads' });
  expect(within(operations).getByText('Hookload')).toHaveAttribute('title', 'Predicted surface load accounting for buoyancy, well inclination and frictional resistance under the selected operating condition.');
  expect(within(operations).getByText('Drag')).toHaveAttribute('title', 'Additional axial resistance generated by friction acting at wellbore contact points. Calculated relative to rotating off-bottom hookload.');
  expect(within(operations).getByText('Rotating Off Bottom').closest('th').querySelector('[title]')).toHaveAttribute('title', 'Rotation at fixed depth with zero axial movement. The current model assumes zero axial frictional drag during pure rotation.');
  expect(screen.getByText(/Normal force is not added separately as an axial drag force/).closest('details')).not.toHaveAttribute('open');
});
