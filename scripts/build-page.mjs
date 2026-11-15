// Inlines the built data into the page template.
//
//   node scripts/build-page.mjs <template.html> <app-data.json> <out.html>              -> full standalone HTML document (Vercel, any static host)
//   node scripts/build-page.mjs <template.html> <app-data.json> <out.html> --artifact   -> body-only fragment for a claude.ai artifact,
//                                                                                          whose host adds the doctype and <head> itself
import fs from 'fs';
const [, , TPL, DATA, OUT, FLAG] = process.argv;
const tpl = fs.readFileSync(TPL, 'utf8'), data = fs.readFileSync(DATA, 'utf8');
let page = tpl.replace('__DATA__', () => data).replace('/*__DBG__*/', '');

if (FLAG !== '--artifact') {
  // The template starts with its <title>, font links and <style>; everything after the first </style> is page body.
  const cut = page.indexOf('</style>') + '</style>'.length;
  const headPart = page.slice(0, cut).replace(/<meta name="claude:[^>]*>\n?/g, '');
  const bodyPart = page.slice(cut);
  const description = 'An interactive cartoon 3D map of US tech internships, startup roles and H-1B sponsors. Free, no login.';
  const favicon = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 37c-1-6-11-12-11-21a11 11 0 0 1 22 0c0 9-10 15-11 21z" fill="#ff6b6b" stroke="#1d2b53" stroke-width="2.6" stroke-linejoin="round"/><circle cx="20" cy="16" r="4.5" fill="#fffaf0" stroke="#1d2b53" stroke-width="2.4"/></svg>');
  page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<meta name="theme-color" content="#8fd3f4">
<meta property="og:title" content="Job Quest Map">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${favicon}">
<style>html, body { margin: 0; } img { max-width: 100%; }</style>
${headPart}
</head>
<body>${bodyPart}
</body>
</html>
`;
}
fs.writeFileSync(OUT, page);
console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB${FLAG === '--artifact' ? ', artifact fragment' : ', standalone page'})`);
