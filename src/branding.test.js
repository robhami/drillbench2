import fs from 'fs';
import path from 'path';
import { MODULES } from './WorkspaceV2/floatingLayout';

test('browser and installed application metadata identify DrillFrame', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'public/index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/manifest.json'), 'utf8'));
  expect(html).toContain('<title>DrillFrame</title>');
  expect(html).toContain('DrillFrame drilling engineering software');
  expect(manifest.name).toBe('DrillFrame'); expect(manifest.short_name).toBe('DrillFrame');
});

test('JarFrame groups exactly the existing two jar modules without renaming identifiers', () => {
  expect(MODULES.filter(([, group]) => group === 'JARFRAME').map(([type]) => type))
    .toEqual(['jarConfiguration', 'jarPlacement']);
});
