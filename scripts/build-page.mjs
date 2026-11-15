// Inlines the built data into the page template, producing a single self-contained HTML file.
// Usage: node scripts/build-page.mjs <template.html> <app-data.json> <out.html>
import fs from 'fs';
const [, , TPL, DATA, OUT] = process.argv;
const tpl = fs.readFileSync(TPL, 'utf8'), data = fs.readFileSync(DATA, 'utf8');
fs.writeFileSync(OUT, tpl.replace('__DATA__', () => data).replace('/*__DBG__*/', ''));
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
