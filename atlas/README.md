# US Robotics Ecosystem Atlas

Interactive intelligence dashboard mapping US robotics companies, Physical AI models, suppliers, research institutions, investors, relationships and events. Built as a single self-contained HTML page.

## Layout
- `data/SCHEMA.md` — record schema (organizations, models, relationships, funding rounds, events).
- `data/research/*.json` — per-domain research files, each record with source URLs and a confidence label.
- `build/merge.mjs` — normalizes IDs, deduplicates and merges research into `data/atlas.json`; flags records not re-checked against a live source as `unverified`; turns endpoints of sourced relationships that lack a full profile into "referenced" nodes.
- `src/app.jsx`, `src/styles.css`, `src/template.html` — the interface (React 18 + d3 from cdnjs, JSX compiled by esbuild).
- `dist/us-robotics-atlas.html` — built page.

## Build
```
cd atlas && npm install && npm run build
```

## Updating data
Edit or add files in `data/research/` and rebuild, or use **Data → Import** inside the page to load a revised `atlas.json` without rebuilding. Nothing syncs automatically; all figures are as of the verification date.

## Known limits of the 2026-10-15 pass
The research pass hit its web-search budget, so ~120 organization records are labeled `unverified` (prior knowledge, homepage-only source). Event speaker/exhibitor lists and most supplier→customer links are sparse because they are rarely published.
