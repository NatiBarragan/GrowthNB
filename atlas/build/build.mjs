// Assemble the single-file artifact: template + CSS + compiled JSX + embedded dataset and US geometry.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const safeJson = s => s.replace(/</g, '\\u003c');

const js = transformSync(read('src/app.jsx'), { loader: 'jsx', jsxFactory: 'h', jsxFragment: 'Fragment', target: 'es2020', minify: true }).code;
const data = JSON.stringify(JSON.parse(read('data/atlas.json')));
const geo = JSON.stringify(JSON.parse(read('src/states-10m.json')));

const html = read('src/template.html')
  .replace('/*__CSS__*/', () => read('src/styles.css'))
  .replace('__DATA__', () => safeJson(data))
  .replace('__GEO__', () => safeJson(geo))
  .replace('/*__APP__*/', () => js);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'us-robotics-atlas.html'), html);
console.log(`dist/us-robotics-atlas.html ${(html.length / 1024).toFixed(0)} KB`);
