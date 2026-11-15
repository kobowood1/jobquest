# Job Quest Map

An interactive, cartoon-style 3D map of US tech jobs that runs in the browser with no login. Switch between three job types:

| Mode | What a pin means | Source |
|---|---|---|
| **Internships** | Open US tech internships, by city | [SimplifyJobs internship list](https://github.com/SimplifyJobs/Summer2026-Internships) (community-run, updated daily) |
| **Startup roles** | Full-time roles at venture-backed startups | Weekly startup jobs list by [@deaguiarza](https://x.com/deaguiarza) (`data/raw/startups-*.xlsx`) |
| **H-1B sponsors** | US tech companies that regularly sponsor H-1B visas (employers, not specific openings) | Shared "100 Hidden US Sponsors" sheet (`data/raw/h1b-sponsors.psv`) |

States rise by how many roles they hold, pins grow with each city's count and take the color of its most common category, and remote roles float in a hot-air balloon off the Pacific coast. A toy biplane flies over now and then (click it for a barrel roll), a paddle steamer sails around the coast (click it to sound the whistle), and a little sailboat tacks around the Gulf and up the Atlantic (click it to ring the bell).

The mode is kept in the URL hash, so `#internships`, `#startups` and `#h1b-sponsors` can be shared directly.

## Open it / deploy

The site is one self-contained page, `public/index.html`: the data is inlined and three.js loads from jsDelivr. There is no server code.

- **Locally:** open `public/index.html` in a browser, or run `npm run serve`.
- **Vercel:** import the repo. `vercel.json` tells Vercel to skip the install and build steps and serve `public/` as is, so nothing needs configuring. Only `public/` is published; the raw data and scripts stay in the repo.

## Rebuild with fresh data

The data is rebuilt on your machine, not on Vercel. Commit the new `public/index.html` and Vercel redeploys it.

```bash
npm install
pip install openpyxl

# 1. latest internships (about 13 MB, not committed)
curl -L -o data/raw/listings.json \
  https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json

# 2. a new weekly startup spreadsheet: drop it in data/raw/ and point the "data" script at it in package.json

# 3. rebuild data/app-data.json, public/index.html and build/artifact.html
npm run build:local
```

## Layout

```
public/index.html          built, self-contained page (what Vercel serves)
vercel.json                static-site settings for Vercel
src/template.html          page source (HTML, CSS, three.js scene); data is injected at __DATA__
scripts/build-data.mjs     cleans and geocodes all three sources into data/app-data.json
scripts/xlsx_to_json.py    converts the startup spreadsheet to JSON
scripts/build-page.mjs     inlines the data into the template (full page, or --artifact fragment)
data/raw/                  source files
data/app-data.json         combined, geocoded dataset
```

`build-data.mjs` handles the messy location strings found in job posts ("NYC Office", "South SF", "Playa Vista, LA", "United States / remote") and places each city with [all-the-cities](https://www.npmjs.com/package/all-the-cities) and the [us-atlas](https://github.com/topojson/us-atlas) Albers USA projection. A posting with only "United States" counts as remote / anywhere in the US.

Job data belongs to its sources. Always confirm a role on the company's own page before applying.
