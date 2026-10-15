// Merge the per-domain research files in data/research/ into one normalized dataset (data/atlas.json).
// The app only ever reads atlas.json, so the data can be refreshed without touching the interface.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const researchDir = path.join(root, 'data', 'research');
const VERIFIED = '2026-10-15';

const ALIASES = {
  'a16z': 'andreessen-horowitz', 'andreessen-horowitz-a16z': 'andreessen-horowitz',
  'nvidia-nventures': 'nvidia', 'nventures': 'nvidia', 'nvidia-corporation': 'nvidia',
  'sequoia': 'sequoia-capital', 'khosla': 'khosla-ventures', 'eclipse': 'eclipse-ventures',
  'cmu': 'carnegie-mellon-university', 'carnegie-mellon': 'carnegie-mellon-university',
  'berkeley': 'uc-berkeley', 'university-of-california-berkeley': 'uc-berkeley',
  'massachusetts-institute-of-technology': 'mit', 'stanford-university': 'stanford',
  'georgia-institute-of-technology': 'georgia-tech', 'upenn': 'university-of-pennsylvania',
  'penn': 'university-of-pennsylvania', 'uw': 'university-of-washington',
  'deepmind': 'google-deepmind', 'tri': 'toyota-research-institute',
  'figure': 'figure-ai', 'agility': 'agility-robotics', '1x': '1x-technologies',
  'robotcom': 'robot-com', 'robot.com': 'robot-com', 'kiwibot': 'kiwibot',
  'amazon-industrial-innovation-fund-aiif': 'amazon-industrial-innovation-fund',
  'softbank-group': 'softbank', 'softbank-vision-fund': 'softbank-vision-fund',
  'abb-robotics': 'abb', 'fanuc-america': 'fanuc', 'teradyne-robotics': 'teradyne',
  'intel-realsense-spinout': 'intel-realsense', 'realsense': 'intel-realsense',
  'general-motors': 'gm', 'microsoft-m12': 'm12', 'meta-platforms': 'meta', 'meta-fair': 'meta',
  'hyundai-motor-group': 'hyundai', 'rai-institute': 'rai-institute', 'boston-dynamics-ai-institute': 'rai-institute',
};

const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const LABELS = new Map(); // first human-readable label seen for an id, used to name referenced-only nodes
const canon = id => { const s = slug(id); const c = ALIASES[s] || s; if (typeof id === 'string' && /[A-Z ]/.test(id) && !LABELS.has(c)) LABELS.set(c, id.trim()); return c; };
const splitNames = v => asArr(v).flatMap(x => typeof x === 'string' && /,|;| and | & /.test(x) && !/^[a-z0-9-]+$/.test(x) ? x.split(/,|;| and | & /) : [x]).map(x => typeof x === 'string' ? x.replace(/\(.*?\)/g, '').trim() : x).filter(Boolean);
Object.assign(ALIASES, { 'att-ventures': 'at-t-ventures', 'canaan-partners': 'canaan', 'd-e-shaw-ventures': 'd-e-shaw', 'brookfield-asset-management': 'brookfield', 'eqt-ventures': 'eqt', 'tiger-global-management': 'tiger-global', 'google-ventures': 'gv', 'amazon-com': 'amazon', 'liquid-2-ventures': 'liquid-2', 'prysm-capital': 'prysm', 'salesforce-ventures': 'salesforce', 'sumitomo-corporation': 'sumitomo', 'lattitude-ventures': 'latitude', 'jpmorgan-chase': 'jpmorgan', 'j-p-morgan': 'jpmorgan', 'at-t-ventures': 'at-t-ventures' });
const uniqArr = a => [...new Set(a)];
const asArr = v => Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
const nonEmpty = v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
const normSources = s => asArr(s).map(x => typeof x === 'string' ? { url: x, label: hostOf(x) } : { url: x.url, label: x.label || x.title || hostOf(x.url) })
  .filter(x => x.url && /^https?:\/\//.test(x.url));
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } }

const files = fs.existsSync(researchDir) ? fs.readdirSync(researchDir).filter(f => f.endsWith('.json')) : [];
const log = { files: [], warnings: [] };
const orgs = new Map(), models = new Map(), events = new Map();
const rounds = [], edges = [], compat = [];
let rubric = null;

const ORG_KINDS = new Set(['robotics', 'ai', 'supplier', 'research', 'investor', 'enabler']);

function mergeRecord(map, rec, file) {
  const prev = map.get(rec.id);
  if (!prev) { map.set(rec.id, { ...rec, _files: [file] }); return; }
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'sources') prev.sources = dedupeSources([...(prev.sources || []), ...v]);
    else if (Array.isArray(v)) prev[k] = [...new Set([...(asArr(prev[k])), ...v])];
    else if (!nonEmpty(prev[k]) && nonEmpty(v)) prev[k] = v;
  }
  prev._files.push(file);
}
const dedupeSources = arr => { const seen = new Set(); return arr.filter(s => !seen.has(s.url) && seen.add(s.url)); };

for (const f of files) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(path.join(researchDir, f), 'utf8')); }
  catch (e) { log.warnings.push(`${f}: invalid JSON (${e.message})`); continue; }
  const counts = {};
  for (const o of asArr(raw.organizations)) {
    const id = canon(o.id || o.name);
    if (!id || !o.name) { log.warnings.push(`${f}: org without id/name skipped`); continue; }
    const kind = ORG_KINDS.has(o.kind) ? o.kind : 'robotics';
    const rec = {
      id, name: o.name, kind, website: o.website || null,
      hq_city: o.hq_city || null, hq_state: o.hq_state || null, hq_country: o.hq_country || 'US',
      lat: typeof o.lat === 'number' ? o.lat : null, lon: typeof o.lon === 'number' ? o.lon : null,
      founded: Number.isFinite(+o.founded) && o.founded ? +o.founded : null,
      segment: o.segment || null, subsegment: o.subsegment || null, product: o.product || null,
      robot_type: o.robot_type || null, ai_approach: o.ai_approach || null,
      models: asArr(o.models).map(canon), stage: o.stage || null, ticker: o.ticker || null,
      funding_usd: Number.isFinite(+o.funding_usd) && o.funding_usd ? +o.funding_usd : null,
      funding_note: o.funding_note || null,
      investors: splitNames(o.investors).map(canon), customers: asArr(o.customers).map(String),
      deployment: o.deployment || 'Unknown', deployment_note: o.deployment_note || null,
      suppliers: asArr(o.suppliers).map(canon), tags: asArr(o.tags).map(String),
      summary: o.summary || null, sources: normSources(o.sources),
      confidence: o.confidence || 'verified', verified: o.verified || VERIFIED,
    };
    // Records the research pass could not check against a live source are flagged, never presented as verified.
    const unverifiedText = /Not re-verified (by web search|in 2026-10-15 pass)|Profile \(HQ\/products\) from company site and prior public knowledge|from prior knowledge\.?$/i;
    if (o.confidence === 'analyst' || rec.tags.some(t => /^needs-/.test(t)) || unverifiedText.test(rec.deployment_note || '') || unverifiedText.test(rec.funding_note || '')) {
      rec.confidence_original = rec.confidence; rec.confidence = 'unverified';
    }
    if (!rec.sources.length) log.warnings.push(`${f}: ${id} has no valid source`);
    mergeRecord(orgs, rec, f); counts.orgs = (counts.orgs || 0) + 1;
  }
  for (const m of asArr(raw.models)) {
    const id = canon(m.id || m.name);
    if (!id) continue;
    mergeRecord(models, {
      id, name: m.name, kind: 'model', developer: canon(m.developer), developer_name: m.developer_name || null,
      released: m.released || null, category: m.category || null, embodiments: asArr(m.embodiments),
      license: m.license || null, docs: m.docs || null, integrations: asArr(m.integrations).map(String),
      capabilities: m.capabilities || null, availability: m.availability || null,
      sources: normSources(m.sources), verified: m.verified || VERIFIED,
    }, f); counts.models = (counts.models || 0) + 1;
  }
  for (const e of asArr(raw.events)) {
    const id = canon(e.id || e.name);
    mergeRecord(events, {
      ...e, id, kind: 'event', topics: asArr(e.topics), scores: e.scores || {},
      sources: normSources(e.sources || e.source), verified: e.verified || VERIFIED,
    }, f); counts.events = (counts.events || 0) + 1;
  }
  for (const r of asArr(raw.funding_rounds)) {
    if (!r.org) continue;
    const leads = splitNames(r.lead).map(canon);
    rounds.push({ ...r, org: canon(r.org), lead: leads[0] || null, investors: uniqArr([...leads.slice(1), ...splitNames(r.investors).map(canon)]),
      amount_usd: Number.isFinite(+r.amount_usd) && r.amount_usd ? +r.amount_usd : null }); counts.rounds = (counts.rounds || 0) + 1;
  }
  for (const r of asArr(raw.relationships)) {
    if (!r.from || !r.to || !r.type) continue;
    edges.push({ from: canon(r.from), to: canon(r.to), type: r.type, note: r.note || null,
      source: r.source || (r.sources && r.sources[0] && (r.sources[0].url || r.sources[0])) || null,
      confidence: r.confidence || 'verified' }); counts.edges = (counts.edges || 0) + 1;
  }
  for (const r of asArr(raw.compatibility)) {
    if (!r.from || !r.to) continue;
    compat.push({ from: canon(r.from), to: canon(r.to), note: r.note || null, source: r.source || null });
  }
  if (raw.scoring_rubric) rubric = raw.scoring_rubric;
  log.files.push({ file: f, ...counts });
}

// Developer edges from model records.
for (const m of models.values()) if (m.developer) edges.push({ from: m.developer, to: m.id, type: 'develops', note: 'Model developer', source: m.sources[0]?.url || null, confidence: 'verified' });
// Funding rounds → invests edges (lead + listed investors).
for (const r of rounds) for (const inv of [r.lead, ...r.investors].filter(Boolean))
  edges.push({ from: inv, to: r.org, type: 'invests', note: `${r.round || 'Round'}${r.date ? ' · ' + r.date : ''}`, source: r.source || null, confidence: r.confidence || 'company-reported' });

// Dedupe rounds & edges; drop unsourced edges.
const seenR = new Set();
const roundsOut = rounds.filter(r => { const k = `${r.org}|${r.date}|${r.round}`; if (seenR.has(k)) return false; seenR.add(k); return true; });
const edgeMap = new Map();
let unsourced = 0;
for (const e of edges) {
  if (!e.source || !/^https?:\/\//.test(e.source)) { unsourced++; continue; }
  if (e.from === e.to) continue;
  const k = `${e.from}|${e.to}|${e.type}`;
  if (!edgeMap.has(k)) edgeMap.set(k, e);
}
if (unsourced) log.warnings.push(`${unsourced} relationships dropped for missing source URL`);

// Endpoints referenced by sourced relationships but not researched as full records become "referenced" stubs.
const known = id => orgs.has(id) || models.has(id) || events.has(id);
const stubs = new Map();
for (const e of edgeMap.values()) for (const id of [e.from, e.to]) if (!known(id) && !stubs.has(id)) {
  stubs.set(id, { id, name: LABELS.get(id) || id.split('-').map(w => w.length <= 3 && /\d|^(ai|ml|gm|lg|abb|ati|nxp|amd|tdk)$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' '),
    kind: 'other', stub: true, segment: null, sources: [{ url: e.source, label: hostOf(e.source) }], verified: VERIFIED,
    summary: 'Referenced by a sourced relationship; not yet profiled in this dataset.' });
}
const STUB_NAMES = { 'andreessen-horowitz': 'Andreessen Horowitz (a16z)', 'gm': 'General Motors', 'bmw': 'BMW', 'ups': 'UPS', 'dhl': 'DHL', 'fedex': 'FedEx', 'uber': 'Uber', 'doordash': 'DoorDash', 'openai': 'OpenAI', 'lg': 'LG', 'jpmorgan': 'J.P. Morgan' };
for (const [id, n] of Object.entries(STUB_NAMES)) if (stubs.has(id)) stubs.get(id).name = n;

const strip = o => { const { _files, ...rest } = o; return rest; };
const out = {
  meta: {
    title: 'US Robotics Ecosystem Atlas', version: 1, verified: VERIFIED, built: new Date().toISOString().slice(0, 10),
    note: 'Curated intelligence database compiled from public sources. Not a complete census of US robotics.',
    files: log.files, warnings: log.warnings,
  },
  organizations: [...orgs.values()].map(strip).sort((a, b) => a.name.localeCompare(b.name)),
  referenced: [...stubs.values()].sort((a, b) => a.name.localeCompare(b.name)),
  models: [...models.values()].map(strip).sort((a, b) => (b.released || '').localeCompare(a.released || '')),
  events: [...events.values()].map(strip).sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999')),
  funding_rounds: roundsOut.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  relationships: [...edgeMap.values()],
  compatibility: compat,
  scoring_rubric: rubric,
};
fs.writeFileSync(path.join(root, 'data', 'atlas.json'), JSON.stringify(out, null, 1));
console.log(`orgs ${out.organizations.length} · stubs ${out.referenced.length} · models ${out.models.length} · events ${out.events.length} · rounds ${out.funding_rounds.length} · edges ${out.relationships.length}`);
for (const w of log.warnings) console.warn('warn:', w);
