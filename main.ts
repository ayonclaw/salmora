import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './dossier.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(output, { recursive: true });
cpSync(join(here, 'game'), join(output, 'game'), { recursive: true });
mkdirSync(join(output, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots')))
  cpSync(join(here, 'screenshots'), join(output, 'screenshots'), { recursive: true });

const dossier = buildDossier(output);
writeFileSync(join(output, 'dossier.json'), dossier);

// Keep the build inspectable without generating a network dependency or a binary bundle.
const report = JSON.parse(dossier.toString('utf8'));
console.log(`Prepared ${report.images.length} Salmora screenshots and ${report.text.length} source characters.`);
