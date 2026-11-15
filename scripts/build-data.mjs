// Builds data/app-data.json for Job Quest Map from three sources:
//   internships  - SimplifyJobs listings.json (GitHub)
//   startups     - weekly startup-jobs spreadsheet (converted by xlsx_to_json.py)
//   h1b          - curated list of H-1B sponsoring companies (pipe-separated)
// Usage: node scripts/build-data.mjs <listings.json> <startups.json> <h1b.psv> <out.json>
import fs from 'fs';
import { createRequire } from 'module';
import { geoAlbersUsa } from 'd3-geo';
import { feature } from 'topojson-client';
const require = createRequire(import.meta.url);
const allCities = require('all-the-cities').filter(c => c.country === 'US');
const [, , LISTINGS, STARTUPS, H1B, OUT] = process.argv;

// ---------- geocoder ----------
const STATES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
const NAME2AB = Object.fromEntries(Object.entries(STATES).map(([a, n]) => [n.toLowerCase(), a]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(st\.?|saint) /, 'saint ').replace(/^ft\.? /, 'fort ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const stateOf = tok => { const t = tok.trim(); if (/^[A-Z]{2}$/.test(t) && STATES[t]) return t; return NAME2AB[t.toLowerCase()] || null; };

const byCityState = new Map(), byName = new Map();
for (const c of allCities) for (const n of [c.name, ...(c.altName ? c.altName.split(',') : [])]) {
  const k = norm(n); if (!k) continue;
  const ks = k + '|' + c.adminCode; const p = byCityState.get(ks); if (!p || p.population < c.population) byCityState.set(ks, c);
  const q = byName.get(k); if (!q || q.population < c.population) byName.set(k, c);
}
const fix = (name, st, lon, lat) => ({ name, adminCode: st, population: 1e7, loc: { coordinates: [lon, lat] } });
const NYC = fix('New York', 'NY', -74.006, 40.713), SF = fix('San Francisco', 'CA', -122.419, 37.775), DC = fix('Washington', 'DC', -77.037, 38.907);
const MANUAL = {
  'new york|NY': NYC, 'new york city|NY': NYC, 'washington|DC': DC, 'san francisco|CA': SF,
  'malta|NY': fix('Malta', 'NY', -73.79, 42.98), 'annapolis junction|MD': fix('Annapolis Junction', 'MD', -76.79, 39.12),
  'lake saint louis|MO': fix('Lake Saint Louis', 'MO', -90.79, 38.8), 'hopewell junction|NY': fix('Hopewell Junction', 'NY', -73.81, 41.58),
  'hudson valley|NY': fix('Hudson Valley', 'NY', -73.92, 41.7), 'holmdel|NJ': fix('Holmdel', 'NJ', -74.18, 40.35),
  'playa vista|CA': fix('Playa Vista', 'CA', -118.43, 33.97), 'silicon valley|CA': fix('San Jose', 'CA', -121.886, 37.338),
  'parsippany troy hills|NJ': fix('Parsippany', 'NJ', -74.43, 40.86), 'simsbury|CT': fix('Simsbury', 'CT', -72.8, 41.88),
  'hopewell township|NJ': fix('Hopewell', 'NJ', -74.79, 40.36), 'warrendale|PA': fix('Warrendale', 'PA', -80.08, 40.65),
  'warren|NJ': fix('Warren', 'NJ', -74.52, 40.63), 'tysons|VA': fix('Tysons', 'VA', -77.23, 38.92),
  'linthicum heights|MD': fix('Linthicum Heights', 'MD', -76.66, 39.2), 'moon twp|PA': fix('Moon Township', 'PA', -80.21, 40.52),
  'carpinteria|CA': fix('Carpinteria', 'CA', -119.518, 34.399), 'eden prairie|MN': fix('Eden Prairie', 'MN', -93.47, 44.855)
};
// bare city names (no state) people write in job posts
const BARE = { 'nyc': NYC, 'new york': NYC, 'new york city': NYC, 'manhattan': NYC, 'brooklyn': fix('Brooklyn', 'NY', -73.944, 40.678), 'sf': SF, 'san francisco': SF,
  'bay area': SF, 'sf bay area': SF, 'san francisco bay area': SF, 'silicon valley': MANUAL['silicon valley|CA'], 'dc': DC, 'washington dc': DC, 'washington d c': DC,
  'south sf': fix('South San Francisco', 'CA', -122.408, 37.655), 'east bay': fix('Oakland', 'CA', -122.271, 37.804), 'la': fix('Los Angeles', 'CA', -118.244, 34.052), 'los angeles': fix('Los Angeles', 'CA', -118.244, 34.052), 'greater boston': fix('Boston', 'MA', -71.059, 42.36) };
// bare names that are much more often a foreign city in job posts
const FOREIGN_BARE = new Set(['vancouver', 'london', 'dublin', 'melbourne', 'birmingham', 'manchester', 'paris', 'athens', 'waterloo', 'victoria', 'toronto', 'sydney', 'cambridge uk', 'hamilton', 'kingston', 'windsor', 'berlin', 'munich', 'zurich', 'lima', 'cordoba', 'florence', 'naples', 'valencia', 'leon', 'santiago', 'delhi', 'bangalore', 'bengaluru']);
const FOREIGN = /\b(canada|ontario|british columbia|quebec|alberta|uk|united kingdom|england|scotland|ireland|india|germany|france|spain|portugal|netherlands|poland|israel|mexico|brazil|argentina|colombia|chile|australia|japan|singapore|china|korea|philippines|vietnam|switzerland|sweden|denmark|norway|finland|italy|greece|romania|ukraine|turkey|uae|dubai|emea|apac|latam|europe|remote eu|nigeria|kenya|egypt|south africa|new zealand|taiwan|hong kong|czech|austria|belgium|estonia|lithuania|serbia|croatia|pakistan|bangladesh|indonesia|malaysia|thailand)\b/i;

function cityFor(name, st) {
  const k = norm(name) + '|' + st;
  return MANUAL[k] || byCityState.get(k) || null;
}
function bareCity(name) {
  const k = norm(name);
  if (!k || FOREIGN_BARE.has(k)) return null;
  if (BARE[k]) return BARE[k];
  const c = byName.get(k);
  return c && c.population >= 15000 ? c : null;
}

// Parses a free-text location into { places: [{city, st, c} | {stateOnly}], remote, foreign }
function parseLocation(raw) {
  const out = { places: [], remote: false, foreign: false };
  if (!raw) return out;
  let s = String(raw).replace(/\s+/g, ' ').trim();
  if (/remote|anywhere|distributed|work from home|wfh/i.test(s)) out.remote = true;
  const segments = s.replace(/ [-–] /g, ', ').split(/;|\||\n| \/ |\/| or | and | & |·|•/i);
  const mentionsUS = /united states|\busa?\b|\bu\.s\./i.test(s);
  for (let seg of segments) {
    seg = seg.replace(/\((.*?)\)/g, ', $1').replace(/\b(remote|hybrid|on-?site|in-?office|office|offices|hq|headquarters|campus|metro(politan)? area|greater|based|only|first|friendly|preferred|time ?zones?|any location)\b/gi, ' ')
      .replace(/\b(united states of america|united states|usa|u\.s\.a\.|u\.s\.|us)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!seg || /^[,\s-]*$/.test(seg)) continue;
    if (FOREIGN.test(seg)) { out.foreign = true; continue; }
    const toks = seg.split(',').map(t => t.replace(/^[\s-]+|[\s-]+$/g, '')).filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
      const st = stateOf(toks[i]);
      const nextSt = i + 1 < toks.length ? stateOf(toks[i + 1]) : null;
      if (nextSt) {
        // 'Austin, TX', and cities that share a state's name: 'New York, NY', 'Washington, DC'
        // job posts often write 'LA' for Los Angeles, as in 'Playa Vista, LA'
        const c = cityFor(toks[i], nextSt) || (nextSt === 'DC' ? DC : null) || (toks[i + 1].trim() === 'LA' ? cityFor(toks[i], 'CA') : null);
        if (c || !st) { out.places.push(c ? { c, st: c.adminCode } : { stateOnly: nextSt }); i++; continue; }
      }
      if (st) {
        // "New York" / "Washington" alone are far more often the city than the state
        const b = BARE[norm(toks[i])]; if (b && (toks[i].length > 2 || toks[i] === 'LA')) { out.places.push({ c: b, st: b.adminCode }); continue; }
        out.places.push({ stateOnly: st }); continue;
      }
      const c = bareCity(toks[i]); if (c) out.places.push({ c, st: c.adminCode });
    }
  }
  // a bare 'United States' with no city means the role can be anywhere in the US
  if (!out.places.length && mentionsUS && !out.foreign) out.remote = true;
  return out;
}

// ---------- shared place table ----------
const places = new Map();
function placeId(p) {
  let key, rec;
  if (p.c) { const name = p.c.name === 'New York City' ? 'New York' : p.c.name; key = name + '|' + p.st;
    rec = { n: name, s: p.st, lon: p.c.loc.coordinates[0], lat: p.c.loc.coordinates[1] }; }
  else if (p.stateOnly === 'DC') return placeId({ c: DC, st: 'DC' });
  else { key = 'state|' + p.stateOnly; rec = { n: STATES[p.stateOnly] + ' (statewide)', s: p.stateOnly, state: 1 }; }
  if (!places.has(key)) places.set(key, { id: places.size, ...rec });
  return places.get(key).id;
}
const dayOf = d => Math.round(new Date(d + 'T12:00:00Z').getTime() / 86400000);
const uniq = a => [...new Set(a)];
const misses = {};

// ---------- internships ----------
const listings = JSON.parse(fs.readFileSync(LISTINGS, 'utf8'));
const catIntern = c => /AI|Data/.test(c) ? 'AI/ML/Data' : /Software/.test(c) ? 'Software' : /Product/.test(c) ? 'Product' : /Quant/.test(c) ? 'Quant' : /Hardware/.test(c) ? 'Hardware' : 'Software';
const intern = [];
for (const x of listings) {
  if (!x.active || x.is_visible === false) continue;
  const locs = []; let remote = false;
  for (const l of x.locations || []) {
    const g = parseLocation(l); if (g.remote && !g.foreign) remote = true;
    g.places.forEach(p => locs.push(placeId(p)));
    if (!g.places.length && !g.remote && !g.foreign) misses[l] = (misses[l] || 0) + 1;
  }
  if (!locs.length && !remote) continue;
  intern.push({ co: x.company_name, ti: x.title, cat: catIntern(x.category || ''), term: (x.terms || [])[0] || 'N/A', url: x.url, day: Math.round(x.date_posted / 86400), locs: uniq(locs), r: remote ? 1 : 0 });
}

// ---------- startups ----------
const startupRows = JSON.parse(fs.readFileSync(STARTUPS, 'utf8'));
const startup = [];
for (const r of startupRows) {
  const g = parseLocation(r['Location']);
  const locs = uniq(g.places.map(placeId));
  const saysUS = /united states|\busa?\b|\bu\.s\./i.test(r['Location'] || '') || !r['Location'] || /^\s*remote\s*$/i.test(r['Location']);
  const remote = (r['Remote'] === 'Yes' || g.remote) && (locs.length > 0 || saysUS) && !(g.foreign && !locs.length && !saysUS);
  if (!locs.length && !remote) { if (!g.foreign) misses[r['Location']] = (misses[r['Location']] || 0) + 1; continue; }
  startup.push({ co: r['Company'], ti: r['Role'], cat: r['Category'], url: r['Apply link'].replace(/[?&]embed=js$/, ''), day: dayOf(r['Posted date']), locs, r: remote ? 1 : 0, raised: r['Money raised'] || '', site: r['Company website'] || '' });
}

// ---------- H-1B sponsors ----------
const h1bLines = fs.readFileSync(H1B, 'utf8').trim().split('\n');
const H = h1bLines[0].split('|');
const sector = ind => /health|biotech|techbio|drug/i.test(ind) ? 'Health & Bio'
  : /fintech|bnpl|lending|payment|banking|remittance/i.test(ind) ? 'Fintech'
  : /secur|identity|endpoint|zero-trust|soc\b/i.test(ind) ? 'Security'
  : /\bAI\b|ML|data|vector|chip|database|streaming|automl/i.test(ind) ? 'AI & Data'
  : /cloud|devops|ci\/cd|api|observ|code|web dev|frontend|workflow|ide\b|infra/i.test(ind) ? 'Dev & Cloud'
  : /logistic|fleet|autonom|self-driving|\bEV\b|commerce|marketplace|real estate|proptech|supply|trucking/i.test(ind) ? 'Mobility & Commerce'
  : 'SaaS';
const h1b = h1bLines.slice(1).map(line => { const v = Object.fromEntries(line.split('|').map((x, i) => [H[i], x.trim()]));
  const g = parseLocation(v['Location']);
  return { co: v['Company'], ti: v['Industry'], cat: sector(v['Industry']), url: v['Careers Page'], locs: uniq(g.places.map(placeId)), r: 0,
    visa: v['Visa Type'], grads: v['Freshers?'], exp: v['Min Exp'], stack: v['Tech Stack'], pay: v['Avg Base Salary'], reloc: v['Relocation?'], note: v['Tips'] }; });

// ---------- project + states ----------
const topo = require('us-atlas/states-albers-10m.json');
const fc = feature(topo, topo.objects.states);
const rd = v => Math.round(v * 10) / 10;
const simplify = ring => { const o = []; let last = null; for (const p of ring) { const q = [rd(p[0]), rd(p[1])]; if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1.2) { o.push(q); last = q; } } return o.length >= 4 ? o : null; };
const states = fc.features.map(f => { const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return { name: f.properties.name, polys: polys.map(p => p.map(simplify).filter(Boolean)).filter(p => p.length) }; });
const proj = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const placeList = [...places.values()].map(p => { const o = { id: p.id, n: p.n, s: p.s }; if (p.state) o.state = 1; else { const xy = proj([p.lon, p.lat]); if (xy) { o.x = rd(xy[0]); o.y = rd(xy[1]); } } return o; });

const updated = { intern: Math.max(...listings.map(x => x.date_updated || 0)) * 1000, startup: Math.max(...startup.map(j => j.day)) * 86400000, h1b: Date.now() };
fs.writeFileSync(OUT, JSON.stringify({ built: Date.now(), updated, places: placeList, states, modes: { intern, startup, h1b } }));
console.log(`intern ${intern.length} (remote ${intern.filter(j => j.r).length}) | startup ${startup.length}/${startupRows.length} (remote ${startup.filter(j => j.r).length}) | h1b ${h1b.length} (unplaced ${h1b.filter(j => !j.locs.length).map(j => j.co)}) | places ${placeList.length}`);
console.log('top unmatched locations:', Object.entries(misses).sort((a, b) => b[1] - a[1]).slice(0, 30));
