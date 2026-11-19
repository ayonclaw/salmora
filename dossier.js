import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const encoder = new TextEncoder();
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = data => new TextDecoder().decode(data);
const sizeOf = value => encoder.encode(value).length;
const sourcePattern = /\.(?:html|js|mjs|css|glsl|vert|frag|wgsl|json)$/i;
const vendoredPattern = /\.min\.(?:js|mjs|css)$/i;

function classify(path) {
  const parts = path.split('/');
  const name = parts.at(-1);
  if (parts.slice(0, -1).includes('vendor') || vendoredPattern.test(name)) return 'vendored';
  return sourcePattern.test(name) ? 'source' : 'asset';
}

function walk(root) {
  const files = [];
  const directories = [];
  function visit(dir, prefix = '') {
    for (const name of readdirSync(dir).sort(order)) {
      const path = prefix ? `${prefix}/${name}` : name;
      const full = join(dir, name);
      const info = lstatSync(full);
      if (info.isSymbolicLink()) throw new Error(`game/${path} is a symbolic link`);
      if (info.isDirectory()) {
        directories.push(path);
        visit(full, path);
      } else if (info.isFile()) files.push({ path, data: readFileSync(full) });
      else throw new Error(`game/${path} is a special file`);
    }
  }
  visit(root);
  files.sort((a, b) => order(a.path, b.path));
  directories.sort(order);
  return { files, directories };
}

function importsFrom(code) {
  const found = [];
  for (const match of code.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g)) found.push(match[1]);
  return found;
}

function loadedSources(sources, markup) {
  const mapTag = [...markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .find(match => /\btype\s*=\s*["']importmap["']/i.test(match[1]));
  const importMap = mapTag ? JSON.parse(mapTag[2]).imports ?? {} : {};
  const byPath = new Map(sources.map(file => [file.path, file]));
  const result = [];
  const seen = new Set();
  const targetPath = (specifier, from) => {
    let ref = specifier;
    let base = from;
    if (!ref.startsWith('./') && !ref.startsWith('../')) {
      if (typeof importMap[ref] !== 'string') return null;
      ref = importMap[ref];
      base = 'index.html';
    }
    const pieces = base.split('/').slice(0, -1);
    for (const part of ref.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!pieces.length) return null;
        pieces.pop();
      } else pieces.push(part);
    }
    return pieces.join('/');
  };
  const visit = path => {
    if (seen.has(path) || !byPath.has(path) || !/\.(?:js|mjs)$/i.test(path)) return;
    seen.add(path);
    result.push(path);
    for (const specifier of importsFrom(text(byPath.get(path).data))) {
      const target = targetPath(specifier, path);
      if (target) visit(target);
    }
  };
  const scripts = [...markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  for (const script of scripts) {
    if (!/\btype\s*=\s*["']module["']/i.test(script[1]) || /\btype\s*=\s*["']importmap["']/i.test(script[1])) continue;
    const src = /\bsrc\s*=\s*["']([^"']+)/i.exec(script[1])?.[1];
    if (src) {
      const target = targetPath(src, 'index.html');
      if (target) visit(target);
    } else {
      for (const specifier of importsFrom(script[2])) {
        const target = targetPath(specifier, 'index.html');
        if (target) visit(target);
      }
    }
  }
  return result;
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort(order).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function wholeLineCount(data) {
  if (!data.length) return 0;
  let count = 0;
  for (const byte of data) if (byte === 10) count++;
  return data[data.length - 1] === 10 ? count : count + 1;
}

function section(path, item) {
  const body = text(item.data);
  const lines = wholeLineCount(item.data);
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map(match => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const ext = path.split('.').at(-1).toLowerCase();
  const language = ext === 'js' || ext === 'mjs' ? 'js' : ext === 'css' ? 'css' : ext === 'html' ? 'html' : ext === 'json' ? 'json' : ext === 'glsl' || ext === 'vert' || ext === 'frag' ? 'glsl' : ext === 'wgsl' ? 'wgsl' : 'text';
  const head = `### game/${path} (${lines} ${lines === 1 ? 'line' : 'lines'}, ${item.data.length} bytes)\n\n`;
  const block = lines ? `${fence}${language}\n${body}${body.endsWith('\n') ? '' : '\n'}${fence}\n\n` : '';
  return { path, item, body, lines, fence, head, block };
}

function gameBlock(files, directoryCount) {
  const sources = files.filter(file => classify(file.path) === 'source');
  const vendors = files.filter(file => classify(file.path) === 'vendored');
  const assets = files.filter(file => classify(file.path) === 'asset');
  const sum = list => list.reduce((total, file) => total + file.data.length, 0);
  const lines = [
    '## Game',
    '',
    `Source files: ${sources.length} (${sum(sources)} bytes)`,
    `Vendored files: ${vendors.length} (${sum(vendors)} bytes)`,
  ];
  if (vendors.length) {
    const listed = vendors.slice(0, 24).map(file => `game/${file.path} (${file.data.length} bytes)`);
    const more = vendors.length > 24 ? `, and ${vendors.length - 24} more` : '';
    lines.push(`  ${listed.join(', ')}${more}`);
  }
  const byExtension = new Map();
  for (const file of assets) {
    const ext = file.path.split('.').at(-1).toLowerCase();
    const stat = byExtension.get(ext) ?? { count: 0, bytes: 0 };
    stat.count++;
    stat.bytes += file.data.length;
    byExtension.set(ext, stat);
  }
  const extensions = [...byExtension].sort(([a], [b]) => order(a, b)).map(([ext, stat]) => `${ext} ${stat.count} (${stat.bytes} bytes)`).join(', ');
  lines.push(`Assets: ${extensions || 'none'}`);
  lines.push(`Totals: ${files.length + directoryCount} files and directories (${sum(files)} bytes)`);
  return lines.join('\n');
}

export function buildDossier(directory) {
  const gameDir = join(directory, 'game');
  const tree = walk(gameDir);
  if (tree.files.length + tree.directories.length > 993) throw new Error('game/ exceeds its file and directory limit');
  if (tree.files.reduce((sum, file) => sum + file.data.length, 0) > 50331648) throw new Error('game/ exceeds 48 MiB');
  if (tree.files.some(file => sizeOf(file.path) > 1000)) throw new Error('game/ path exceeds 1000 bytes');
  const byPath = new Map(tree.files.map(file => [file.path, file]));
  const index = byPath.get('index.html');
  if (!index) throw new Error('game/index.html is missing');
  if (index.data.length > 1048576) throw new Error('game/index.html exceeds 1 MiB');
  const sources = tree.files.filter(file => classify(file.path) === 'source');
  const scriptOrder = loadedSources(sources, text(index.data));
  const used = new Set(['index.html', ...scriptOrder]);
  const paths = ['index.html', ...scriptOrder, ...sources.map(file => file.path).filter(path => !used.has(path)).sort(order)];
  const sections = paths.map(path => section(path, byPath.get(path)));
  let dossierText = `${gameBlock(tree.files, tree.directories.length)}\n\n## Sources\n\n`;
  for (const source of sections) dossierText += source.head + source.block;
  if (sizeOf(dossierText) > 163840) throw new Error('Dossier source text exceeds 160 KiB');
  const shotDir = join(directory, 'screenshots');
  const names = readdirSync(shotDir).filter(name => !name.startsWith('.')).sort(order);
  if (names.length < 3 || names.length > 4) throw new Error(`Expected 3 or 4 screenshots, found ${names.length}`);
  const images = names.map(name => {
    const data = readFileSync(join(shotDir, name));
    if (data.length > 262144) throw new Error(`screenshots/${name} exceeds 256 KiB`);
    const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    if (!png && !jpeg) throw new Error(`screenshots/${name} is neither PNG nor JPEG`);
    return { name, media_type: png ? 'image/png' : 'image/jpeg', sha256: createHash('sha256').update(data).digest('hex'), base64: data.toString('base64') };
  });
  const result = { schema: 'makefun/dossier/v1', cover: 0, text: dossierText.replace(/\n+$/, '\n'), images };
  return Buffer.from(canonical(result), 'utf8');
}
