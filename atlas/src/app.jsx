/* US Robotics Ecosystem Atlas — interface layer.
   Reads a normalized dataset (see data/SCHEMA.md / build/merge.mjs) from #atlas-data, or from a JSON file the viewer imports. */
const { createElement: h, Fragment, useState, useEffect, useMemo, useRef, useCallback } = React;

/* ============================== constants ============================== */
const TODAY = '2026-10-15';
const KINDS = {
  robotics: { label: 'Robotics companies', short: 'Robotics', shape: 'circle' },
  ai: { label: 'Physical AI & software', short: 'AI / software', shape: 'diamond' },
  supplier: { label: 'Component suppliers', short: 'Supplier', shape: 'square' },
  investor: { label: 'Investors', short: 'Investor', shape: 'triangle' },
  research: { label: 'Research institutions', short: 'Research', shape: 'cross' },
  enabler: { label: 'Accelerators & enablers', short: 'Enabler', shape: 'hex' },
  event: { label: 'Events', short: 'Event', shape: 'star' },
  model: { label: 'AI models & platforms', short: 'Model', shape: 'diamond' },
  other: { label: 'Other referenced orgs', short: 'Referenced', shape: 'circle' },
};
const kc = k => `var(--k-${k in KINDS ? k : 'other'})`;
const EDGE_TYPES = {
  invests: { label: 'Investor → company', dash: '' },
  supplies: { label: 'Supplier → company', dash: '1 3' },
  uses_model: { label: 'Company uses model', dash: '6 3' },
  develops: { label: 'Lab/company → model', dash: '2 2' },
  spinout: { label: 'University → spinout', dash: '8 2 2 2' },
  partnership: { label: 'Partnership', dash: '' },
  acquisition: { label: 'Acquisition', dash: '10 3' },
  customer: { label: 'Customer relationship', dash: '4 4' },
  research_collab: { label: 'Research collaboration', dash: '3 6' },
  exhibits: { label: 'Company → event', dash: '1 5' },
  speaks: { label: 'Speaker at event', dash: '1 5' },
};
const DEPLOY_ORDER = ['Commercial', 'Pilot', 'Prototype', 'Research', 'Unknown', 'N/A'];
const SCORE_DIMS = [
  ['bizdev', 'Business development'], ['partnership', 'Partnership potential'], ['investor', 'Investor access'],
  ['technical', 'Technical learning'], ['brand', 'Brand visibility'], ['competitive', 'Competitive intel'], ['customer', 'Customer acquisition'],
];
const HUBS = [
  { id: 'bay', name: 'SF Bay Area / Silicon Valley', lat: 37.62, lon: -122.2, r: 90 },
  { id: 'bos', name: 'Boston / Cambridge', lat: 42.37, lon: -71.15, r: 55 },
  { id: 'pit', name: 'Pittsburgh', lat: 40.44, lon: -79.99, r: 50 },
  { id: 'aus', name: 'Austin', lat: 30.27, lon: -97.74, r: 50 },
  { id: 'sea', name: 'Seattle', lat: 47.61, lon: -122.33, r: 55 },
  { id: 'la', name: 'Los Angeles', lat: 34.05, lon: -118.3, r: 70 },
  { id: 'nyc', name: 'New York', lat: 40.73, lon: -73.99, r: 55 },
  { id: 'sd', name: 'San Diego', lat: 32.8, lon: -117.15, r: 40 },
  { id: 'det', name: 'Detroit / Ann Arbor', lat: 42.4, lon: -83.4, r: 60 },
  { id: 'den', name: 'Denver / Boulder', lat: 39.85, lon: -105.1, r: 55 },
  { id: 'chi', name: 'Chicago', lat: 41.88, lon: -87.63, r: 50 },
  { id: 'atl', name: 'Atlanta', lat: 33.75, lon: -84.39, r: 50 },
  { id: 'dfw', name: 'Dallas–Fort Worth', lat: 32.85, lon: -96.95, r: 55 },
  { id: 'hou', name: 'Houston', lat: 29.76, lon: -95.37, r: 50 },
  { id: 'phx', name: 'Phoenix', lat: 33.45, lon: -112.07, r: 50 },
  { id: 'dc', name: 'Washington DC area', lat: 38.9, lon: -77.1, r: 55 },
  { id: 'phl', name: 'Philadelphia', lat: 39.95, lon: -75.17, r: 40 },
  { id: 'mia', name: 'Miami', lat: 25.78, lon: -80.2, r: 45 },
  { id: 'slc', name: 'Salt Lake City', lat: 40.76, lon: -111.89, r: 50 },
];
const STORE = 'usra-atlas-v1';

/* ============================== utils ============================== */
const fmtUSD = n => n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${n}`;
const fmtDate = (s, opts) => { if (!s) return 'TBA'; const d = new Date(s + (s.length === 7 ? '-01' : '') + 'T12:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' }); };
const fmtRange = (a, b) => { if (!a) return 'Date TBA'; if (!b || a === b) return fmtDate(a); const A = new Date(a + 'T12:00:00'), B = new Date(b + 'T12:00:00'); const sameM = A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear(); return sameM ? `${A.toLocaleDateString('en-US', { month: 'short' })} ${A.getDate()}–${B.getDate()}, ${B.getFullYear()}` : `${fmtDate(a, { month: 'short', day: 'numeric' })} – ${fmtDate(b)}`; };
const haversine = (a, b, c, d) => { const R = 6371, r = Math.PI / 180; const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const hubOf = o => { if (o.lat == null || o.lon == null) return null; let best = null; for (const hb of HUBS) { const dist = haversine(o.lat, o.lon, hb.lat, hb.lon); if (dist <= hb.r && (!best || dist < best.d)) best = { id: hb.id, d: dist }; } return best ? best.id : 'other'; };
const hubName = id => id === 'other' ? 'Elsewhere in the US' : id ? HUBS.find(x => x.id === id)?.name : 'No US location';
const countBy = (arr, f) => { const m = new Map(); for (const x of arr) { for (const k of [].concat(f(x))) { if (k == null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); } } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
const uniq = a => [...new Set(a)];
const norm = s => String(s || '').toLowerCase();
const load = (k, d) => { try { const v = localStorage.getItem(`${STORE}:${k}`); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(`${STORE}:${k}`, JSON.stringify(v)); } catch { /* storage unavailable: preferences last this visit only */ } };
function usePersist(key, init) { const [v, set] = useState(() => load(key, init)); useEffect(() => save(key, v), [key, v]); return [v, set]; }
const csvEscape = v => { const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = (rows, cols) => [cols.map(c => c.label).join(','), ...rows.map(r => cols.map(c => csvEscape(c.get(r))).join(','))].join('\n');
const eventStatus = e => e.start && e.end && e.end < TODAY ? 'Historical' : e.status || 'Date TBA';
const eventScore = (e, w) => { const s = e.scores || {}; let t = 0, tw = 0; for (const [k] of SCORE_DIMS) { const wt = w ? w[k] : 1; t += (s[k] || 0) * wt; tw += 5 * wt; } return tw ? Math.round(100 * t / tw) : 0; };

/* ============================== data model ============================== */
function buildIndex(raw) {
  const orgs = (raw.organizations || []).map(o => ({ ...o, hub: hubOf(o) }));
  const refs = (raw.referenced || []).map(o => ({ ...o, kind: 'other', hub: null }));
  const models = raw.models || [];
  const events = (raw.events || []).map(e => ({ ...e, kind: 'event', hub: hubOf(e), statusNow: eventStatus(e) }));
  const all = [...orgs, ...refs, ...models, ...events];
  const byId = new Map(all.map(x => [x.id, x]));
  const edges = (raw.relationships || []).filter(e => byId.has(e.from) && byId.has(e.to));
  const adj = new Map();
  for (const e of edges) { for (const [a, b, dir] of [[e.from, e.to, 'out'], [e.to, e.from, 'in']]) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ ...e, other: b, dir }); } }
  const rounds = (raw.funding_rounds || []).filter(r => byId.has(r.org));
  const nameOf = id => byId.get(id)?.name || id;
  return { raw, meta: raw.meta || {}, orgs, refs, models, events, all, byId, edges, adj, rounds, nameOf, compat: raw.compatibility || [], rubric: raw.scoring_rubric };
}
function readEmbedded() {
  const el = document.getElementById('atlas-data');
  if (!el) throw new Error('The embedded dataset is missing from this page.');
  return JSON.parse(el.textContent);
}
function validateDataset(raw) {
  if (!raw || typeof raw !== 'object') return 'The file is not a JSON object.';
  if (!Array.isArray(raw.organizations)) return 'The file has no "organizations" array. Export the current dataset to see the expected shape.';
  return null;
}

/* ============================== small components ============================== */
function Icon({ d, size = 14 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>; }
const I = {
  search: <Fragment><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Fragment>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  ext: <Fragment><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></Fragment>,
  plus: <path d="M12 5v14M5 12h14" />, minus: <path d="M5 12h14" />,
  reset: <Fragment><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></Fragment>,
  sun: <Fragment><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Fragment>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  db: <Fragment><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></Fragment>,
  cmp: <Fragment><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /></Fragment>,
};
function Shape({ kind, size = 10, color }) {
  const s = size, c = color || kc(kind), shape = KINDS[kind]?.shape || 'circle';
  const p = { fill: c };
  return <svg width={s} height={s} viewBox="-6 -6 12 12" aria-hidden="true" style={{ flex: 'none' }}>{shapeEl(shape, 5, p)}</svg>;
}
function shapeEl(shape, r, p) {
  switch (shape) {
    case 'square': return <rect x={-r * .85} y={-r * .85} width={r * 1.7} height={r * 1.7} rx={r * .2} {...p} />;
    case 'diamond': return <path d={`M0 ${-r * 1.1}L${r * 1.1} 0L0 ${r * 1.1}L${-r * 1.1} 0Z`} {...p} />;
    case 'triangle': return <path d={`M0 ${-r * 1.1}L${r} ${r * .8}L${-r} ${r * .8}Z`} {...p} />;
    case 'cross': return <path d={`M${-r * .35} ${-r}h${r * .7}v${r * .65}h${r * .65}v${r * .7}h${-r * .65}v${r * .65}h${-r * .7}v${-r * .65}h${-r * .65}v${-r * .7}h${r * .65}Z`} {...p} />;
    case 'hex': { const pts = d3.range(6).map(i => [Math.cos(i * Math.PI / 3) * r, Math.sin(i * Math.PI / 3) * r].join(',')).join(' '); return <polygon points={pts} {...p} />; }
    case 'star': { const pts = d3.range(10).map(i => { const rr = i % 2 ? r * .5 : r * 1.15, a = -Math.PI / 2 + i * Math.PI / 5; return [Math.cos(a) * rr, Math.sin(a) * rr].join(','); }).join(' '); return <polygon points={pts} {...p} />; }
    default: return <circle r={r} {...p} />;
  }
}
function KindPill({ kind }) { return <span className="pill"><Shape kind={kind} size={9} />{KINDS[kind]?.short || kind}</span>; }
function DeployPill({ v }) { return v ? <span className={`pill dep-${v}`}>{v}</span> : null; }
function Conf({ v }) { return v ? <span className={`conf ${v}`}>{v.replace(/-/g, ' ')}</span> : null; }
function Ext({ href, children }) { return href ? <a className="link" href={href} target="_blank" rel="noopener noreferrer">{children || href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : <span className="muted">—</span>; }
function Empty({ children }) { return <div className="empty">{children || 'Nothing matches these filters. Clear a filter to widen the view.'}</div>; }

function MultiSelect({ label, options, value, onChange, counts }) {
  const [open, setOpen] = useState(false); const ref = useRef();
  useEffect(() => { const f = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  const toggle = o => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o]);
  return <div className="ms" ref={ref}>
    <button className={`btn ${value.length ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>{label}{value.length ? <span className="mono xs">· {value.length}</span> : null}<span className="muted xs">▾</span></button>
    {open && <div className="ms-panel" role="listbox">
      {value.length > 0 && <button className="btn ghost xs" style={{ marginBottom: 4 }} onClick={() => onChange([])}>Clear</button>}
      {options.map(o => <label key={o}><input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />{o}{counts && <span className="n">{counts.get(o) || 0}</span>}</label>)}
      {!options.length && <div className="muted small" style={{ padding: 6 }}>No options</div>}
    </div>}
  </div>;
}
function Seg({ value, options, onChange }) { return <div className="seg" role="group">{options.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>; }

function Bars({ rows, color, onPick, fmt = v => v, max }) {
  const m = max || d3.max(rows, r => r[1]) || 1;
  return <div className="bars">{rows.map(([k, v, c]) => <div className="bar-row" key={k} onClick={onPick ? () => onPick(k) : undefined} title={`${k}: ${fmt(v)}`}>
    <span className="lbl">{k}</span>
    <span className="track"><span className="fill" style={{ width: `${Math.max(1, 100 * v / m)}%`, background: c || color || 'var(--k-robotics)' }} /></span>
    <span className="val">{fmt(v)}</span></div>)}</div>;
}
function useTooltip() {
  const [tip, setTip] = useState(null);
  const node = tip ? <div className="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 300), top: tip.y + 14 }}>{tip.content}</div> : null;
  return [node, setTip];
}

/* ============================== app ============================== */
const TABS = [
  ['overview', 'Overview'], ['map', 'US Map'], ['network', 'Network'], ['companies', 'Companies'], ['models', 'AI Models'],
  ['supply', 'Supply Chain'], ['investors', 'Investors'], ['events', 'Events'], ['compare', 'Compare'], ['intel', 'Intelligence'], ['about', 'Data & Method'],
];

function App() {
  const [raw, setRaw] = useState(null); const [err, setErr] = useState(null);
  const [tab, setTabState] = useState(() => { const h = (location.hash || '').slice(1); return TABS.some(t => t[0] === h) ? h : load('tab', 'overview'); });
  const [theme, setTheme] = usePersist('theme', 'dark');
  const [sel, setSel] = useState(null);
  const [bookmarks, setBookmarks] = usePersist('bookmarks', []);
  const [compare, setCompare] = usePersist('compare', []);
  const [modal, setModal] = useState(null);
  const [dataSource, setDataSource] = useState('embedded');

  useEffect(() => { try { setRaw(readEmbedded()); } catch (e) { setErr(e.message); } }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const setTab = t => { setTabState(t); save('tab', t); try { history.replaceState(null, '', '#' + t); } catch { } window.scrollTo(0, 0); };
  const D = useMemo(() => raw ? buildIndex(raw) : null, [raw]);
  const open = useCallback(id => setSel(id), []);
  const toggleBm = id => setBookmarks(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);
  const toggleCmp = id => setCompare(c => c.includes(id) ? c.filter(x => x !== id) : c.length >= 5 ? c : [...c, id]);

  if (err) return <div className="wrap" style={{ paddingBlock: 48 }}><div className="panel"><h2>Dataset could not be loaded</h2><p>{err}</p><p className="muted">Rebuild the page with <span className="mono">npm run build</span> in the atlas folder, or import a dataset JSON file.</p></div></div>;
  if (!D) return <div className="boot">Loading the atlas…</div>;

  const ctx = { D, open, bookmarks, toggleBm, compare, toggleCmp, setTab, setModal };
  const counts = { companies: D.orgs.length, events: D.events.length, models: D.models.length };
  return <div className="shell">
    <header className="mast">
      <div className="wrap">
        <div className="mast-row">
          <div className="brand">
            <h1>US Robotics Ecosystem Atlas<span className="tick">AS OF {D.meta.verified || TODAY}</span></h1>
            <p>Mapping the companies, technologies, capital, and events shaping Physical AI.</p>
          </div>
          <div className="mast-tools">
            <GlobalSearch D={D} open={open} />
            <button className="btn" onClick={() => setModal({ type: 'data', setRaw, setDataSource })} title="Import or export the dataset"><Icon d={I.db} />Data{dataSource !== 'embedded' && <span className="mono xs">· imported</span>}</button>
            <button className="btn icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle light or dark theme"><Icon d={theme === 'dark' ? I.sun : I.moon} /></button>
          </div>
        </div>
        <nav className="tabs" role="tablist">{TABS.map(([id, l]) => <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{l}
          {id === 'companies' && <span className="count">{counts.companies}</span>}{id === 'events' && <span className="count">{counts.events}</span>}{id === 'models' && <span className="count">{counts.models}</span>}
          {id === 'compare' && compare.length > 0 && <span className="count">{compare.length}</span>}</button>)}</nav>
      </div>
    </header>
    <main className="wrap">
      {tab === 'overview' && <Overview {...ctx} />}
      {tab === 'map' && <MapView {...ctx} />}
      {tab === 'network' && <Network {...ctx} />}
      {tab === 'companies' && <Companies {...ctx} />}
      {tab === 'models' && <Models {...ctx} />}
      {tab === 'supply' && <Supply {...ctx} />}
      {tab === 'investors' && <Investors {...ctx} />}
      {tab === 'events' && <Events {...ctx} />}
      {tab === 'compare' && <Compare {...ctx} />}
      {tab === 'intel' && <Intel {...ctx} />}
      {tab === 'about' && <About {...ctx} />}
    </main>
    {sel && <Profile id={sel} onClose={() => setSel(null)} {...ctx} />}
    {modal && <Modal modal={modal} onClose={() => setModal(null)} D={D} />}
  </div>;
}

function GlobalSearch({ D, open }) {
  const [q, setQ] = useState(''); const [focus, setFocus] = useState(false); const [hi, setHi] = useState(0);
  const res = useMemo(() => { const n = norm(q).trim(); if (n.length < 2) return []; return D.all.filter(x => norm(x.name).includes(n) || norm(x.product).includes(n) || norm(x.segment).includes(n)).sort((a, b) => (norm(a.name).startsWith(n) ? 0 : 1) - (norm(b.name).startsWith(n) ? 0 : 1)).slice(0, 12); }, [q, D]);
  const pick = x => { open(x.id); setQ(''); setFocus(false); };
  return <div className="search">
    <Icon d={I.search} />
    <input id="global-search" className="input" placeholder="Search companies, models, events" value={q} onChange={e => { setQ(e.target.value); setHi(0); }}
      onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
      onKeyDown={e => { if (e.key === 'ArrowDown') setHi(Math.min(hi + 1, res.length - 1)); else if (e.key === 'ArrowUp') setHi(Math.max(hi - 1, 0)); else if (e.key === 'Enter' && res[hi]) pick(res[hi]); }} aria-label="Search the atlas" />
    {focus && q.length >= 2 && <div className="dropdown">
      {res.map((x, i) => <button key={x.id} className={i === hi ? 'hi' : ''} onMouseDown={() => pick(x)}><Shape kind={x.kind} /><span>{x.name}</span><span className="muted xs" style={{ marginLeft: 'auto' }}>{x.segment || x.category || KINDS[x.kind]?.short}</span></button>)}
      {!res.length && <div className="muted small" style={{ padding: 10 }}>No matches for “{q}”.</div>}
    </div>}
  </div>;
}

/* ============================== Overview ============================== */
function Overview({ D, open, setTab }) {
  const o = D.orgs;
  const robotics = o.filter(x => x.kind === 'robotics');
  const startups = o.filter(x => x.stage === 'Startup' || x.stage === 'Growth');
  const upcoming = D.events.filter(e => e.start && e.start >= TODAY);
  const kpis = [
    ['Organizations mapped', o.length, `${D.refs.length} more referenced only`, null],
    ['Robotics companies', robotics.length, 'Builders of robots or robot systems', 'robotics'],
    ['Startups & growth-stage', startups.length, 'Private, venture-backed', null],
    ['AI / software developers', o.filter(x => x.kind === 'ai').length, `${D.models.length} models & platforms`, 'ai'],
    ['Hardware suppliers', o.filter(x => x.kind === 'supplier').length, 'Components & compute', 'supplier'],
    ['Research institutions', o.filter(x => x.kind === 'research').length, 'Universities & labs', 'research'],
    ['Investors & enablers', o.filter(x => x.kind === 'investor' || x.kind === 'enabler').length, 'VC, CVC, accelerators', 'investor'],
    ['Upcoming events', upcoming.length, `of ${D.events.length} tracked`, 'event'],
  ];
  const seg = countBy(o.filter(x => x.kind === 'robotics' || x.kind === 'ai'), x => x.segment);
  const stage = countBy(o.filter(x => x.kind === 'robotics' || x.kind === 'ai'), x => x.stage || 'Unknown');
  const deploy = countBy(robotics, x => x.deployment || 'Unknown').sort((a, b) => DEPLOY_ORDER.indexOf(a[0]) - DEPLOY_ORDER.indexOf(b[0]));
  const hubs = countBy(o.filter(x => x.hub && x.hub !== 'other'), x => hubName(x.hub)).slice(0, 12);
  const states = countBy(o.filter(x => x.hq_country === 'US' || x.hq_state), x => x.hq_state).slice(0, 12);
  const recentRounds = D.rounds.filter(r => r.amount_usd).slice(0, 12);
  const newest = [...o].filter(x => x.founded && (x.kind === 'robotics' || x.kind === 'ai')).sort((a, b) => b.founded - a.founded || a.name.localeCompare(b.name)).slice(0, 12);
  const kindMix = countBy(o, x => x.kind);
  const total = o.length || 1;
  return <Fragment>
    <div className="grid g-kpi" style={{ marginBottom: 14 }}>{kpis.map(([l, v, s, k]) => <div className="panel kpi" key={l}><div className="v">{v}</div><div className="l">{k && <Shape kind={k} />}{l}</div><div className="s">{s}</div></div>)}</div>
    <div className="panel" style={{ marginBottom: 14 }}>
      <h2>Dataset composition<span className="aside">share of {o.length} profiled organizations by type</span></h2>
      <div className="stack" role="img" aria-label="Composition by organization type">{kindMix.map(([k, v]) => <span key={k} style={{ width: `${100 * v / total}%`, background: kc(k) }} title={`${KINDS[k]?.label}: ${v}`} />)}</div>
      <div className="legend" style={{ marginTop: 8 }}>{kindMix.map(([k, v]) => <span key={k}><Shape kind={k} />{KINDS[k]?.label} <span className="mono muted">{v}</span></span>)}</div>
    </div>
    <div className="grid g-2" style={{ marginBottom: 14 }}>
      <div className="panel"><h2>Robotics & AI companies by segment<span className="aside">click a bar to filter the database</span></h2>
        <Bars rows={seg} color="var(--k-robotics)" onPick={k => { save('companies-filter', { segments: [k] }); setTab('companies'); }} /></div>
      <div className="panel"><h2>Geographic concentration<span className="aside">organizations within each metro radius</span></h2>
        <Bars rows={hubs} color="var(--k-research)" onPick={() => setTab('map')} />
        <div className="muted xs" style={{ marginTop: 8 }}>Top states: {states.map(([s, n]) => `${s} ${n}`).join(' · ')}</div></div>
    </div>
    <div className="grid g-3" style={{ marginBottom: 14 }}>
      <div className="panel"><h2>Commercial maturity<span className="aside">robotics companies</span></h2>
        <Bars rows={deploy.map(([k, v]) => [k, v, k === 'Commercial' ? 'var(--good)' : k === 'Pilot' ? 'var(--warn)' : k === 'Prototype' || k === 'Research' ? 'var(--serious)' : 'var(--k-other)'])} />
        <p className="muted xs" style={{ marginBottom: 0 }}>Commercial = paying customers or production deployments are publicly documented. Pilots and prototype demonstrations are counted separately.</p></div>
      <div className="panel"><h2>Company stage</h2><Bars rows={stage} color="var(--k-ai)" /></div>
      <div className="panel"><h2>Newest companies<span className="aside">by founding year</span></h2>
        <div className="side-list" style={{ maxHeight: 300 }}>{newest.map(x => <button key={x.id} className="side-item" onClick={() => open(x.id)}><Shape kind={x.kind} /><span style={{ minWidth: 0 }}><span className="t">{x.name}</span><span className="d"> · {x.founded} · {x.segment}</span></span></button>)}</div></div>
    </div>
    <div className="grid g-2">
      <div className="panel"><h2>Recent disclosed funding rounds<span className="aside">{D.rounds.length} rounds on record</span></h2>
        {recentRounds.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Date</th><th>Company</th><th>Round</th><th style={{ textAlign: 'right' }}>Amount</th><th>Lead</th></tr></thead>
          <tbody>{recentRounds.map((r, i) => <tr key={i} onClick={() => open(r.org)}><td className="mono nowrap">{r.date}</td><td className="name">{D.nameOf(r.org)}</td><td>{r.round}</td><td className="num">{fmtUSD(r.amount_usd)}</td><td className="clip">{r.lead ? D.nameOf(r.lead) : <span className="muted">—</span>}</td></tr>)}</tbody></table></div> : <Empty>No funding rounds in the dataset yet.</Empty>}</div>
      <div className="panel"><h2>Next events</h2>
        {upcoming.length ? <div className="side-list" style={{ maxHeight: 420 }}>{upcoming.slice(0, 10).map(e => <button key={e.id} className="side-item" onClick={() => open(e.id)}><Shape kind="event" /><span style={{ minWidth: 0 }}><span className="t">{e.name}</span><span className="d"> · {fmtRange(e.start, e.end)} · {e.city}, {e.state}</span></span></button>)}</div> : <Empty>No upcoming events.</Empty>}
        <button className="btn" style={{ marginTop: 10 }} onClick={() => setTab('events')}>Open the events calendar</button></div>
    </div>
    <p className="note" style={{ marginTop: 14 }}>A curated intelligence database compiled from public sources as of {D.meta.verified || TODAY}. It is not a census of every US robotics company. Every figure on this page is calculated from the records in the dataset; see Data & Method for coverage and known gaps.</p>
  </Fragment>;
}

/* ============================== Map ============================== */
function MapView({ D, open }) {
  const W = 975, H = 610;
  const geo = useMemo(() => { try { const t = JSON.parse(document.getElementById('us-geo').textContent); return { states: topojson.feature(t, t.objects.states).features, nation: topojson.feature(t, t.objects.nation) }; } catch { return null; } }, []);
  const proj = useMemo(() => geo ? d3.geoAlbersUsa().fitSize([W, H], geo.nation) : null, [geo]);
  const pathGen = useMemo(() => proj ? d3.geoPath(proj) : null, [proj]);
  const [kinds, setKinds] = usePersist('map-kinds', ['robotics', 'ai', 'supplier', 'investor', 'research', 'enabler', 'event']);
  const [segs, setSegs] = useState([]);
  const [t, setT] = useState(d3.zoomIdentity);
  const [hub, setHub] = useState(null);
  const svgRef = useRef(); const zoomRef = useRef();
  const [tipNode, setTip] = useTooltip();

  const points = useMemo(() => {
    if (!proj) return [];
    return [...D.orgs, ...D.events].filter(x => x.lat != null && x.lon != null).map(x => { const p = proj([x.lon, x.lat]); return p ? { ...x, x: p[0], y: p[1] } : null; }).filter(Boolean);
  }, [D, proj]);
  const visible = points.filter(p => kinds.includes(p.kind) && (!segs.length || segs.includes(p.segment)) && (!hub || p.hub === hub));
  const clusters = useMemo(() => {
    const r = 26 / t.k, cells = new Map();
    for (const p of visible) { const key = `${Math.floor(p.x / r)}:${Math.floor(p.y / r)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(p); }
    return [...cells.values()].map(ps => ({ ps, x: d3.mean(ps, p => p.x), y: d3.mean(ps, p => p.y) }));
  }, [visible, t.k]);

  useEffect(() => {
    if (!svgRef.current) return;
    const z = d3.zoom().scaleExtent([1, 40]).translateExtent([[0, 0], [W, H]]).on('zoom', ev => setT(ev.transform));
    zoomRef.current = z; d3.select(svgRef.current).call(z).on('dblclick.zoom', null);
  }, [geo]);
  const zoomTo = (x, y, k) => d3.select(svgRef.current).transition().duration(600).call(zoomRef.current.transform, d3.zoomIdentity.translate(W / 2 - x * k, H / 2 - y * k).scale(k));
  const zoomBy = f => d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, f);
  const goHub = id => { setHub(id === hub ? null : id); const hb = HUBS.find(x => x.id === id); if (hb && id !== hub) { const p = proj([hb.lon, hb.lat]); if (p) zoomTo(p[0], p[1], hb.r > 70 ? 7 : 9); } else zoomTo(W / 2, H / 2, 1); };
  const hubCounts = useMemo(() => new Map(countBy(points.filter(p => kinds.includes(p.kind)), p => p.hub)), [points, kinds]);
  const segOpts = useMemo(() => uniq(points.map(p => p.segment).filter(Boolean)).sort(), [points]);
  const unmapped = [...D.orgs].filter(x => x.lat == null || x.lon == null || !proj || !proj([x.lon, x.lat]));

  if (!geo) return <Empty>The US map geometry could not be loaded.</Empty>;
  const listItems = [...visible].sort((a, b) => a.name.localeCompare(b.name));
  return <Fragment>
    <div className="toolbar">
      <div className="chips">{Object.keys(KINDS).filter(k => k !== 'model' && k !== 'other').map(k => <button key={k} className={`chip ${kinds.includes(k) ? 'on' : ''}`} onClick={() => setKinds(kinds.includes(k) ? kinds.filter(x => x !== k) : [...kinds, k])}><Shape kind={k} />{KINDS[k].label}<span className="n">{points.filter(p => p.kind === k).length}</span></button>)}</div>
      <MultiSelect label="Segment" options={segOpts} value={segs} onChange={setSegs} counts={new Map(countBy(points, p => p.segment))} />
    </div>
    <div className="toolbar"><span className="muted small">Hubs</span><div className="chips">{HUBS.filter(hb => hubCounts.get(hb.id)).map(hb => <button key={hb.id} className={`chip ${hub === hb.id ? 'on' : ''}`} onClick={() => goHub(hb.id)}>{hb.name}<span className="n">{hubCounts.get(hb.id)}</span></button>)}</div></div>
    <div className="map-layout">
      <div className="map-box">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of US robotics ecosystem organizations">
          <g transform={t.toString()}>
            {geo.states.map(f => <path key={f.id} className="state" d={pathGen(f)} style={{ strokeWidth: .6 / t.k }} />)}
            {clusters.map((c, i) => c.ps.length > 1
              ? <g key={i} className="cluster" transform={`translate(${c.x},${c.y})`} onClick={() => zoomTo(c.x, c.y, Math.min(40, t.k * 3))} onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, content: <Fragment><b>{c.ps.length} organizations</b><div className="muted">{c.ps.slice(0, 6).map(p => p.name).join(', ')}{c.ps.length > 6 ? '…' : ''}</div><div className="xs muted">Click to zoom in</div></Fragment> })} onMouseLeave={() => setTip(null)}>
                <circle r={(7 + Math.sqrt(c.ps.length) * 2.4) / t.k} strokeWidth={1 / t.k} />
                <text fontSize={10 / t.k}>{c.ps.length}</text>
                {/* kind mix ring */}
                {(() => { const mix = countBy(c.ps, p => p.kind); let a0 = 0; const R = (7 + Math.sqrt(c.ps.length) * 2.4 + 2.5) / t.k; return mix.map(([k, n]) => { const a1 = a0 + 2 * Math.PI * n / c.ps.length; const arc = d3.arc()({ innerRadius: R - 1.5 / t.k, outerRadius: R + 1.5 / t.k, startAngle: a0, endAngle: a1 - .04 }); a0 = a1; return <path key={k} d={arc} fill={kc(k)} />; }); })()}
              </g>
              : (() => { const p = c.ps[0]; return <g key={p.id} className="marker" transform={`translate(${p.x},${p.y}) scale(${1 / t.k})`} onClick={() => open(p.id)} onMouseMove={e => setTip({ x: e.clientX, y: e.clientY, content: <Fragment><b>{p.name}</b><div className="muted">{KINDS[p.kind]?.short} · {p.segment || p.category || ''}</div><div className="xs">{p.hq_city || p.city}, {p.hq_state || p.state}</div></Fragment> })} onMouseLeave={() => setTip(null)}>
                {shapeEl(KINDS[p.kind]?.shape, 5.5, { fill: kc(p.kind), stroke: 'var(--surface)', strokeWidth: 1.2 })}
                {t.k > 5 && <text x="9" y="3.5" fontSize="10" fill="var(--fg-2)" style={{ paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>{p.name}</text>}
              </g>; })())}
          </g>
        </svg>
        <div className="map-ctrl"><button className="btn icon" onClick={() => zoomBy(1.6)} aria-label="Zoom in"><Icon d={I.plus} /></button><button className="btn icon" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out"><Icon d={I.minus} /></button><button className="btn icon" onClick={() => { setHub(null); zoomTo(W / 2, H / 2, 1); }} aria-label="Reset view"><Icon d={I.reset} /></button></div>
        <div className="map-legend legend xs">{kinds.map(k => <span key={k}><Shape kind={k} />{KINDS[k].short}</span>)}<span className="muted">Locations are city-level (HQ or main US office)</span></div>
      </div>
      <div className="panel" style={{ padding: 10 }}>
        <h3 style={{ padding: '4px 6px' }}>{hub ? hubName(hub) : 'All mapped'}<span className="aside">{visible.length} shown</span></h3>
        {listItems.length ? <div className="side-list">{listItems.map(p => <button key={p.id} className="side-item" onClick={() => open(p.id)}><Shape kind={p.kind} /><span style={{ minWidth: 0 }}><span className="t">{p.name}</span><div className="d">{p.hq_city || p.city}, {p.hq_state || p.state} · {p.segment || (p.kind === 'event' ? fmtRange(p.start, p.end) : '')}</div></span></button>)}</div> : <Empty />}
      </div>
    </div>
    {unmapped.length > 0 && <p className="muted xs" style={{ marginTop: 10 }}>{unmapped.length} profiled organizations have no verified US location and are not plotted: {unmapped.slice(0, 20).map(x => x.name).join(', ')}{unmapped.length > 20 ? '…' : ''}</p>}
    {tipNode}
  </Fragment>;
}

/* ============================== Network ============================== */
function Network({ D, open }) {
  const allTypes = uniq(D.edges.map(e => e.type));
  const [types, setTypes] = usePersist('net-types', allTypes);
  const [nodeKinds, setNodeKinds] = usePersist('net-kinds', ['robotics', 'ai', 'supplier', 'investor', 'research', 'enabler', 'model', 'event', 'other']);
  const [focus, setFocus] = useState(null);
  const [minDeg, setMinDeg] = useState(1);
  const boxRef = useRef(); const svgRef = useRef(); const simRef = useRef();
  const graph = useMemo(() => {
    const es = D.edges.filter(e => types.includes(e.type) && nodeKinds.includes(D.byId.get(e.from).kind) && nodeKinds.includes(D.byId.get(e.to).kind));
    const deg = new Map(); for (const e of es) { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); }
    const keep = new Set([...deg.entries()].filter(([, d]) => d >= minDeg).map(([id]) => id));
    const nodes = [...keep].map(id => ({ id, name: D.byId.get(id).name, kind: D.byId.get(id).kind, deg: deg.get(id) }));
    const links = es.filter(e => keep.has(e.from) && keep.has(e.to)).map(e => ({ source: e.from, target: e.to, type: e.type, note: e.note }));
    return { nodes, links };
  }, [D, types, nodeKinds, minDeg]);

  useEffect(() => {
    const svg = d3.select(svgRef.current); svg.selectAll('*').remove();
    const box = boxRef.current.getBoundingClientRect(); const W = box.width, H = box.height;
    const g = svg.append('g');
    const zoom = d3.zoom().scaleExtent([.15, 6]).on('zoom', ev => g.attr('transform', ev.transform));
    svg.call(zoom).on('dblclick.zoom', null);
    const r = d => 3.5 + Math.sqrt(d.deg) * 2.2;
    const nodes = graph.nodes.map(d => ({ ...d })), links = graph.links.map(d => ({ ...d }));
    const link = g.append('g').attr('fill', 'none').selectAll('line').data(links).join('line')
      .attr('stroke', 'var(--line-2)').attr('stroke-width', 1).attr('stroke-dasharray', d => EDGE_TYPES[d.type]?.dash || '');
    const node = g.append('g').selectAll('g').data(nodes).join('g').attr('class', 'node');
    node.append('circle').attr('r', r).attr('fill', d => kc(d.kind)).attr('stroke', 'var(--surface)').attr('stroke-width', 1.5);
    node.append('title').text(d => `${d.name} · ${KINDS[d.kind]?.short} · ${d.deg} links`);
    const label = g.append('g').selectAll('text').data(nodes).join('text').attr('class', 'lbl').text(d => d.name).attr('dx', d => r(d) + 3).attr('dy', 3)
      .style('display', d => d.deg >= 5 ? null : 'none');
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(l => l.type === 'develops' ? 30 : 55).strength(.5))
      .force('charge', d3.forceManyBody().strength(d => -40 - d.deg * 6))
      .force('center', d3.forceCenter(W / 2, H / 2)).force('x', d3.forceX(W / 2).strength(.09)).force('y', d3.forceY(H / 2).strength(.11))
      .force('collide', d3.forceCollide(d => r(d) + 2));
    simRef.current = sim;
    const draw = () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`); label.attr('x', d => d.x).attr('y', d => d.y);
    };
    // Settle the layout up front, then fit it to the box so the first frame shows the whole network.
    sim.stop(); for (let i = 0; i < 260; i++) sim.tick(); draw();
    const [x0, x1] = d3.extent(nodes, d => d.x), [y0, y1] = d3.extent(nodes, d => d.y);
    const k = Math.min(2, .92 * Math.min(W / Math.max(1, x1 - x0), H / Math.max(1, y1 - y0)));
    const fit = d3.zoomIdentity.translate(W / 2 - k * (x0 + x1) / 2, H / 2 - k * (y0 + y1) / 2).scale(k);
    svg.call(zoom.transform, fit);
    sim.on('tick', draw);
    node.call(d3.drag().on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(.2).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; }).on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));
    node.on('click', (ev, d) => { ev.stopPropagation(); setFocus(d.id); });
    svg.on('click', () => setFocus(null));
    svgRef.current.__hl = id => {
      if (!id) { node.attr('opacity', 1); link.attr('opacity', 1).attr('stroke', 'var(--line-2)').attr('stroke-width', 1); label.style('display', d => d.deg >= 5 ? null : 'none').attr('opacity', 1); return; }
      const nb = new Set([id]); links.forEach(l => { if (l.source.id === id) nb.add(l.target.id); if (l.target.id === id) nb.add(l.source.id); });
      node.attr('opacity', d => nb.has(d.id) ? 1 : .12);
      link.attr('opacity', l => l.source.id === id || l.target.id === id ? 1 : .05).attr('stroke', l => l.source.id === id || l.target.id === id ? 'var(--accent)' : 'var(--line-2)').attr('stroke-width', l => l.source.id === id || l.target.id === id ? 1.6 : 1);
      label.style('display', d => nb.has(d.id) ? null : 'none');
      const f = nodes.find(n => n.id === id); if (f && f.x != null) svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - f.x * 1.4, H / 2 - f.y * 1.4).scale(1.4));
    };
    return () => sim.stop();
  }, [graph]);
  useEffect(() => { svgRef.current?.__hl && svgRef.current.__hl(focus); }, [focus, graph]);

  const f = focus && D.byId.get(focus);
  const fEdges = focus ? (D.adj.get(focus) || []).filter(e => types.includes(e.type)) : [];
  const [q, setQ] = useState('');
  const matches = q.length > 1 ? graph.nodes.filter(n => norm(n.name).includes(norm(q))).slice(0, 8) : [];
  return <Fragment>
    <div className="toolbar">
      <MultiSelect label="Relationship types" options={allTypes} value={types} onChange={setTypes} counts={new Map(countBy(D.edges, e => e.type))} />
      <MultiSelect label="Node types" options={Object.keys(KINDS)} value={nodeKinds} onChange={setNodeKinds} />
      <label className="small fg2" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Min. connections
        <select id="net-mindeg" className="input" value={minDeg} onChange={e => setMinDeg(+e.target.value)}>{[1, 2, 3, 5].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <div className="search" style={{ flex: '0 1 240px' }}><Icon d={I.search} /><input id="net-search" className="input" placeholder="Find a node" value={q} onChange={e => setQ(e.target.value)} />
        {matches.length > 0 && <div className="dropdown">{matches.map(n => <button key={n.id} onMouseDown={() => { setFocus(n.id); setQ(''); }}><Shape kind={n.kind} />{n.name}</button>)}</div>}</div>
      <span className="muted small">{graph.nodes.length} nodes · {graph.links.length} sourced relationships</span>
    </div>
    <div className="net-layout">
      <div className="net-box" ref={boxRef}>{graph.nodes.length ? <svg ref={svgRef} role="img" aria-label="Ecosystem relationship network" /> : <div style={{ padding: 16 }}><Empty /></div>}</div>
      <div className="panel" style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        {f ? <Fragment>
          <div><KindPill kind={f.kind} /><h3 style={{ margin: '6px 0 2px', textTransform: 'none', fontSize: 18, color: 'var(--fg)' }}>{f.name}</h3><div className="muted small">{f.segment || f.category || ''}</div></div>
          <button className="btn primary" onClick={() => open(f.id)}>Open profile</button>
          <div className="rel-list" style={{ maxHeight: 420, overflow: 'auto' }}>{fEdges.map((e, i) => <div className="rel" key={i}><span><button onClick={() => setFocus(e.other)}>{D.nameOf(e.other)}</button><div className="muted xs">{EDGE_TYPES[e.type]?.label || e.type}{e.note ? ` · ${e.note}` : ''}</div></span><a className="link xs" href={e.source} target="_blank" rel="noopener noreferrer">source</a></div>)}</div>
        </Fragment> : <Fragment>
          <h3>How to read</h3>
          <p className="small fg2" style={{ margin: 0 }}>Each line is a relationship with a public source. Click a node to highlight its connected ecosystem; drag to rearrange; scroll or pinch to zoom.</p>
          <div className="legend" style={{ flexDirection: 'column', gap: 4 }}>{Object.keys(KINDS).map(k => <span key={k}><Shape kind={k} />{KINDS[k].label}</span>)}</div>
          <div style={{ display: 'grid', gap: 4 }}>{allTypes.map(t => <div key={t} className="small fg2" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><svg width="34" height="6"><line x1="0" y1="3" x2="34" y2="3" stroke="var(--fg-2)" strokeWidth="1.4" strokeDasharray={EDGE_TYPES[t]?.dash || ''} /></svg>{EDGE_TYPES[t]?.label || t}</div>)}</div>
        </Fragment>}
      </div>
    </div>
  </Fragment>;
}

/* ============================== Companies ============================== */
const COMPANY_COLS = D => [
  { key: 'name', label: 'Company', get: o => o.name },
  { key: 'website', label: 'Website', get: o => o.website },
  { key: 'hq', label: 'Headquarters', get: o => [o.hq_city, o.hq_state].filter(Boolean).join(', ') + (o.hq_country && o.hq_country !== 'US' ? ` (parent: ${o.hq_country})` : '') },
  { key: 'founded', label: 'Founded', get: o => o.founded },
  { key: 'kind', label: 'Type', get: o => KINDS[o.kind]?.short },
  { key: 'segment', label: 'Category', get: o => o.segment },
  { key: 'subsegment', label: 'Subcategory', get: o => o.subsegment },
  { key: 'product', label: 'Product', get: o => o.product },
  { key: 'robot_type', label: 'Robot type', get: o => o.robot_type },
  { key: 'ai_approach', label: 'AI approach', get: o => o.ai_approach },
  { key: 'models', label: 'Models', get: o => (o.models || []).map(D.nameOf) },
  { key: 'stage', label: 'Stage', get: o => o.stage + (o.ticker ? ` (${o.ticker})` : '') },
  { key: 'funding_usd', label: 'Funding (USD, disclosed)', get: o => o.funding_usd },
  { key: 'investors', label: 'Investors', get: o => (o.investors || []).map(D.nameOf) },
  { key: 'customers', label: 'Customers', get: o => o.customers },
  { key: 'deployment', label: 'Deployments', get: o => o.deployment + (o.deployment_note ? ` — ${o.deployment_note}` : '') },
  { key: 'suppliers', label: 'Suppliers', get: o => (o.suppliers || []).map(D.nameOf) },
  { key: 'sources', label: 'Sources', get: o => (o.sources || []).map(s => s.url) },
  { key: 'confidence', label: 'Confidence', get: o => o.confidence },
  { key: 'verified', label: 'Last updated', get: o => o.verified },
];
function Companies({ D, open, compare, toggleCmp, setModal }) {
  const init = load('companies-filter', {});
  const [q, setQ] = useState(init.q || '');
  const [f, setF] = useState({ kinds: init.kinds || ['robotics', 'ai'], segments: init.segments || [], stages: [], deploy: [], states: [], hubs: [], conf: [] });
  const [sort, setSort] = useState({ k: 'name', dir: 1 });
  const [limit, setLimit] = useState(100);
  useEffect(() => save('companies-filter', { q, kinds: f.kinds, segments: f.segments }), [q, f]);
  const set = k => v => setF({ ...f, [k]: v });
  const base = D.orgs;
  const rows = useMemo(() => {
    const n = norm(q);
    let r = base.filter(o => (!f.kinds.length || f.kinds.includes(o.kind)) && (!f.segments.length || f.segments.includes(o.segment)) && (!f.stages.length || f.stages.includes(o.stage || 'Unknown'))
      && (!f.deploy.length || f.deploy.includes(o.deployment || 'Unknown')) && (!f.conf.length || f.conf.includes(o.confidence)) && (!f.states.length || f.states.includes(o.hq_state)) && (!f.hubs.length || f.hubs.includes(hubName(o.hub)))
      && (!n || [o.name, o.product, o.segment, o.subsegment, o.robot_type, o.ai_approach, o.summary, o.hq_city, ...(o.customers || [])].some(x => norm(x).includes(n))));
    const get = o => sort.k === 'funding_usd' ? (o.funding_usd ?? -1) : sort.k === 'founded' ? (o.founded ?? 0) : norm(o[sort.k]);
    return r.sort((a, b) => (get(a) > get(b) ? 1 : get(a) < get(b) ? -1 : 0) * sort.dir);
  }, [base, f, q, sort]);
  const opts = k => uniq(base.map(k)).filter(Boolean).sort();
  const cnt = k => new Map(countBy(base, k));
  const th = (k, l, num) => <th className="sort" style={num ? { textAlign: 'right' } : null} onClick={() => setSort({ k, dir: sort.k === k ? -sort.dir : 1 })}>{l}{sort.k === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>;
  const cols = COMPANY_COLS(D);
  const exportRows = fmt => setModal({ type: 'export', title: `Export ${rows.length} organizations`, fmt, csv: toCSV(rows, cols), json: JSON.stringify(rows.map(({ hub, ...o }) => o), null, 2), filename: 'robotics-companies' });
  return <Fragment>
    <div className="toolbar">
      <div className="search" style={{ flex: '1 1 260px' }}><Icon d={I.search} /><input id="co-search" className="input" placeholder="Search name, product, customer, city" value={q} onChange={e => setQ(e.target.value)} /></div>
      <MultiSelect label="Type" options={Object.keys(KINDS).filter(k => k !== 'event' && k !== 'model' && k !== 'other')} value={f.kinds} onChange={set('kinds')} counts={cnt(o => o.kind)} />
      <MultiSelect label="Segment" options={opts(o => o.segment)} value={f.segments} onChange={set('segments')} counts={cnt(o => o.segment)} />
      <MultiSelect label="Stage" options={opts(o => o.stage || 'Unknown')} value={f.stages} onChange={set('stages')} counts={cnt(o => o.stage || 'Unknown')} />
      <MultiSelect label="Deployment" options={DEPLOY_ORDER.filter(d => base.some(o => (o.deployment || 'Unknown') === d))} value={f.deploy} onChange={set('deploy')} counts={cnt(o => o.deployment || 'Unknown')} />
      <MultiSelect label="Metro" options={uniq(base.map(o => hubName(o.hub))).sort()} value={f.hubs} onChange={set('hubs')} counts={cnt(o => hubName(o.hub))} />
      <MultiSelect label="Confidence" options={opts(o => o.confidence)} value={f.conf} onChange={set('conf')} counts={cnt(o => o.confidence)} />
      <MultiSelect label="State" options={opts(o => o.hq_state)} value={f.states} onChange={set('states')} counts={cnt(o => o.hq_state)} />
      <span className="grow" />
      <span className="muted small mono">{rows.length} of {base.length}</span>
      <button className="btn" onClick={() => exportRows('csv')}>Export CSV</button>
      <button className="btn" onClick={() => exportRows('json')}>Export JSON</button>
    </div>
    {rows.length ? <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th title="Add to comparison (max 5)">Cmp</th>{th('name', 'Company')}{th('segment', 'Category')}<th>Product</th>{th('hq_state', 'HQ')}{th('founded', 'Founded', true)}{th('stage', 'Stage')}{th('funding_usd', 'Disclosed funding', true)}{th('deployment', 'Deployment')}<th>AI approach</th><th>Conf.</th></tr></thead>
      <tbody>{rows.slice(0, limit).map(o => <tr key={o.id} onClick={() => open(o.id)}>
        <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Compare ${o.name}`} checked={compare.includes(o.id)} disabled={!compare.includes(o.id) && compare.length >= 5} onChange={() => toggleCmp(o.id)} /></td>
        <td><div style={{ display: 'flex', gap: 7, alignItems: 'center' }}><Shape kind={o.kind} /><span className="name">{o.name}</span></div>{o.subsegment && <div className="muted xs clip">{o.subsegment}</div>}</td>
        <td className="nowrap">{o.segment || <span className="muted">—</span>}</td>
        <td className="clip" title={o.product || ''}>{o.product || <span className="muted">—</span>}</td>
        <td className="nowrap">{[o.hq_city, o.hq_state].filter(Boolean).join(', ') || <span className="muted">—</span>}</td>
        <td className="num">{o.founded || '—'}</td>
        <td className="nowrap">{o.stage || 'Unknown'}{o.ticker ? <span className="muted mono xs"> {o.ticker}</span> : null}</td>
        <td className="num">{o.funding_usd ? fmtUSD(o.funding_usd) : <span className="muted">n/d</span>}</td>
        <td><DeployPill v={o.deployment} /></td>
        <td className="clip" title={o.ai_approach || ''}>{o.ai_approach || <span className="muted">Unknown</span>}</td>
        <td><Conf v={o.confidence} /></td></tr>)}</tbody></table></div> : <Empty />}
    {rows.length > limit && <button className="btn" style={{ marginTop: 10 }} onClick={() => setLimit(limit + 200)}>Show {Math.min(200, rows.length - limit)} more</button>}
    <p className="muted xs" style={{ marginTop: 10 }}>n/d = not publicly disclosed. Funding totals are as reported by the company or in press coverage; they are not audited figures.</p>
  </Fragment>;
}

/* ============================== Models / tech stack ============================== */
function Models({ D, open }) {
  const [view, setView] = useState('stack');
  const [cats, setCats] = useState([]); const [lic, setLic] = useState([]); const [avail, setAvail] = useState([]);
  const [hl, setHl] = useState(null);
  const ms = D.models.filter(m => (!cats.length || cats.includes(m.category)) && (!lic.length || lic.includes(m.license)) && (!avail.length || avail.includes(m.availability)));
  const devs = uniq(ms.map(m => m.developer)).filter(id => D.byId.has(id));
  const research = devs.filter(id => ['research', 'other'].includes(D.byId.get(id).kind));
  const labs = devs.filter(id => !research.includes(id));
  const users = useMemo(() => { const m = new Map(); for (const e of D.edges) if (e.type === 'uses_model' && ms.some(x => x.id === e.to)) { if (!m.has(e.from)) m.set(e.from, []); m.get(e.from).push(e.to); } return m; }, [D, ms]);
  const platforms = [...users.keys()].filter(id => D.byId.has(id));
  const commercial = platforms.filter(id => D.byId.get(id).deployment === 'Commercial');
  const nonCommercial = platforms.filter(id => D.byId.get(id).deployment !== 'Commercial');
  const related = useMemo(() => {
    if (!hl) return null; const s = new Set([hl]);
    for (const e of D.edges) if (['develops', 'uses_model', 'research_collab', 'partnership'].includes(e.type)) { if (e.from === hl) s.add(e.to); if (e.to === hl) s.add(e.from); }
    // second hop through models so lab → model → company chains light up
    for (const id of [...s]) if (D.byId.get(id)?.kind === 'model') for (const e of D.edges) if ((e.type === 'uses_model' || e.type === 'develops') && (e.to === id)) s.add(e.from);
    return s;
  }, [hl, D]);
  const item = (id, sub) => { const x = D.byId.get(id); return <button key={id} className={`stack-item ${related ? related.has(id) ? 'hl' : 'dim' : ''}`} onMouseEnter={() => setHl(id)} onFocus={() => setHl(id)} onClick={() => open(id)}><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Shape kind={x.kind} size={8} />{x.name}</span>{sub && <small>{sub}</small>}</button>; };
  const catCounts = countBy(D.models, m => m.category);
  const byYear = d3.rollups(D.models.filter(m => m.released), v => v.length, m => m.released.slice(0, 4)).sort();
  return <Fragment>
    <h2 className="section-title">Physical AI technology landscape</h2>
    <p className="section-sub">Who develops the models, simulators and middleware behind robots, and which robot makers have publicly confirmed using them. A link appears only when a source documents it; technical compatibility alone is not shown as use.</p>
    <div className="toolbar">
      <Seg value={view} onChange={setView} options={[['stack', 'Stack explorer'], ['table', 'Model registry']]} />
      <MultiSelect label="Category" options={uniq(D.models.map(m => m.category)).filter(Boolean).sort()} value={cats} onChange={setCats} counts={new Map(catCounts)} />
      <MultiSelect label="License" options={uniq(D.models.map(m => m.license)).filter(Boolean)} value={lic} onChange={setLic} counts={new Map(countBy(D.models, m => m.license))} />
      <MultiSelect label="Availability" options={uniq(D.models.map(m => m.availability)).filter(Boolean)} value={avail} onChange={setAvail} counts={new Map(countBy(D.models, m => m.availability))} />
      <span className="muted small mono">{ms.length} models</span>
    </div>
    {view === 'stack' ? <div className="tbl-wrap" style={{ padding: 12 }} onMouseLeave={() => setHl(null)}>
      <div className="stack-cols">
        <div className="stack-col"><h4>AI research</h4>{research.map(id => item(id, D.byId.get(id).kind === 'research' ? 'Research institution' : ''))}{!research.length && <span className="muted xs">None in filter</span>}</div>
        <div className="stack-col"><h4>Model developers</h4>{labs.map(id => item(id, D.byId.get(id).segment))}</div>
        <div className="stack-col"><h4>Models & platforms</h4>{ms.map(m => item(m.id, `${m.category || ''}${m.released ? ' · ' + m.released : ''} · ${m.availability || ''}`))}</div>
        <div className="stack-col"><h4>Robot platforms (pilot / demo)</h4>{nonCommercial.map(id => item(id, `${D.byId.get(id).deployment || 'Unknown'} · ${users.get(id).map(D.nameOf).join(', ')}`))}{!nonCommercial.length && <span className="muted xs">No documented users</span>}</div>
        <div className="stack-col"><h4>Commercial deployments</h4>{commercial.map(id => item(id, users.get(id).map(D.nameOf).join(', ')))}{!commercial.length && <span className="muted xs">No documented commercial users</span>}</div>
      </div>
      <p className="muted xs" style={{ marginBottom: 0 }}>Hover any item to trace its chain. Columns four and five split model users by their verified deployment status, so research demonstrations stay separate from commercial systems.</p>
    </div> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Model</th><th>Developer</th><th>Released</th><th>Category</th><th>Embodiments</th><th>License</th><th>Availability</th><th>Docs</th></tr></thead>
      <tbody>{ms.map(m => <tr key={m.id} onClick={() => open(m.id)}><td className="name">{m.name}</td><td>{D.nameOf(m.developer)}</td><td className="mono nowrap">{m.released || '—'}</td><td>{m.category}</td><td className="clip">{(m.embodiments || []).join(', ') || '—'}</td><td>{m.license}</td><td>{m.availability}</td><td onClick={e => e.stopPropagation()}>{m.docs ? <Ext href={m.docs}>docs</Ext> : '—'}</td></tr>)}</tbody></table></div>}
    <div className="grid g-2" style={{ marginTop: 14 }}>
      <div className="panel"><h2>Models by category</h2><Bars rows={catCounts} color="var(--k-ai)" onPick={k => setCats([k])} /></div>
      <div className="panel"><h2>Releases by year<span className="aside">models in the registry</span></h2><Bars rows={byYear} color="var(--k-ai)" /></div>
    </div>
  </Fragment>;
}

/* ============================== Supply chain ============================== */
function Supply({ D, open }) {
  const sup = D.orgs.filter(o => o.kind === 'supplier');
  const [cat, setCat] = useState([]); const [rt, setRt] = useState([]); const [selS, setSelS] = useState(null);
  const supplies = D.edges.filter(e => e.type === 'supplies');
  const cats = countBy(sup, o => o.subsegment || 'Uncategorized');
  const robotTypes = uniq(supplies.map(e => D.byId.get(e.to)?.robot_type).filter(Boolean)).sort();
  const shown = sup.filter(o => (!cat.length || cat.includes(o.subsegment || 'Uncategorized')) && (!rt.length || supplies.some(e => e.from === o.id && rt.includes(D.byId.get(e.to)?.robot_type))));
  const byCat = d3.groups(shown, o => o.subsegment || 'Uncategorized').sort((a, b) => b[1].length - a[1].length);
  const custOf = id => supplies.filter(e => e.from === id && (!rt.length || rt.includes(D.byId.get(e.to)?.robot_type)));
  const compatOf = id => D.compat.filter(c => c.from === id);
  const s = selS && D.byId.get(selS);
  return <Fragment>
    <h2 className="section-title">Supply chain explorer</h2>
    <p className="section-sub">Component categories, the vendors in each, and their publicly confirmed robotics customers. Most supplier–customer relationships in robotics are never disclosed; an empty customer list means “not publicly confirmed,” not “none.”</p>
    <div className="toolbar">
      <MultiSelect label="Component category" options={cats.map(c => c[0])} value={cat} onChange={setCat} counts={new Map(cats)} />
      <MultiSelect label="Customer robot type" options={robotTypes} value={rt} onChange={setRt} />
      <span className="muted small mono">{shown.length} suppliers · {supplies.length} confirmed supply links · {D.compat.length} compatibility listings</span>
    </div>
    <div className="net-layout">
      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        {byCat.length ? byCat.map(([c, list]) => <div className="panel" key={c} style={{ padding: '10px 12px' }}>
          <h3>{c}<span className="aside">{list.length} vendors</span></h3>
          <div style={{ display: 'grid', gap: 4 }}>{list.map(o => { const cu = custOf(o.id); return <div key={o.id} className={`rel`} style={{ gridTemplateColumns: 'minmax(140px, 220px) 1fr', cursor: 'pointer', outline: selS === o.id ? '1px solid var(--accent)' : 'none' }} onClick={() => setSelS(o.id)}>
            <span><button onClick={e => { e.stopPropagation(); open(o.id); }}>{o.name}</button><div className="muted xs">{[o.hq_city, o.hq_state].filter(Boolean).join(', ')}</div></span>
            <span className="small">{cu.length ? <span className="chips">{cu.map(e => <span key={e.to} className="pill"><Shape kind={D.byId.get(e.to).kind} size={8} />{D.nameOf(e.to)}</span>)}</span> : <span className="muted xs">Robotics customers not publicly confirmed</span>}{o.customers?.length > 0 && !cu.length ? <div className="xs fg2">Named customers: {o.customers.slice(0, 4).join(', ')}</div> : null}</span>
          </div>; })}</div></div>) : <Empty />}
      </div>
      <div className="panel" style={{ alignSelf: 'start', position: 'sticky', top: 130 }}>
        {s ? <Fragment><KindPill kind="supplier" /><h3 style={{ margin: '6px 0', textTransform: 'none', fontSize: 18, color: 'var(--fg)' }}>{s.name}</h3>
          <p className="small fg2">{s.product}</p>
          <h4 className="muted xs" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Confirmed supply relationships</h4>
          <div className="rel-list">{custOf(s.id).map((e, i) => <div className="rel" key={i}><span><button onClick={() => open(e.to)}>{D.nameOf(e.to)}</button><div className="muted xs">{e.note}</div></span><a className="link xs" href={e.source} target="_blank" rel="noopener noreferrer">source</a></div>)}{!custOf(s.id).length && <span className="muted small">None publicly confirmed in this dataset.</span>}</div>
          {compatOf(s.id).length > 0 && <Fragment><h4 className="muted xs" style={{ textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 12 }}>Compatibility or ecosystem listing (not a confirmed supply deal)</h4>
            <div className="rel-list">{compatOf(s.id).map((c, i) => <div className="rel" key={i}><span>{D.nameOf(c.to)}<div className="muted xs">{c.note}</div></span>{c.source && <a className="link xs" href={c.source} target="_blank" rel="noopener noreferrer">source</a>}</div>)}</div></Fragment>}
          <button className="btn" style={{ marginTop: 12 }} onClick={() => open(s.id)}>Open full profile</button>
        </Fragment> : <Fragment><h3>Component categories</h3><Bars rows={cats} color="var(--k-supplier)" onPick={k => setCat([k])} /><p className="muted xs">Select a vendor to see its confirmed customers and any compatibility listings.</p></Fragment>}
      </div>
    </div>
  </Fragment>;
}

/* ============================== Investors ============================== */
function Investors({ D, open }) {
  const inv = D.orgs.filter(o => o.kind === 'investor' || o.kind === 'enabler');
  const invests = D.edges.filter(e => e.type === 'invests');
  const port = id => uniq(invests.filter(e => e.from === id).map(e => e.to));
  const allInvestors = uniq(invests.map(e => e.from)).map(id => D.byId.get(id)).filter(Boolean);
  const ranked = allInvestors.map(o => ({ o, p: port(o.id) })).sort((a, b) => b.p.length - a.p.length);
  const [q, setQ] = useState('');
  const shown = ranked.filter(r => !q || norm(r.o.name).includes(norm(q)));
  const segCap = d3.rollups(D.rounds.filter(r => r.amount_usd), v => d3.sum(v, r => r.amount_usd), r => D.byId.get(r.org)?.segment || 'Other').sort((a, b) => b[1] - a[1]);
  const rounds25 = D.rounds.filter(r => r.date && r.date >= '2025');
  return <Fragment>
    <h2 className="section-title">Capital & enablers</h2>
    <p className="section-sub">Investment links come from disclosed rounds and investor announcements. Amounts are as announced; undisclosed amounts are left blank rather than estimated.</p>
    <div className="grid g-kpi" style={{ marginBottom: 14 }}>
      <div className="panel kpi"><div className="v">{inv.length}</div><div className="l"><Shape kind="investor" />Investors & enablers profiled</div></div>
      <div className="panel kpi"><div className="v">{allInvestors.length}</div><div className="l">Distinct investors with a sourced deal</div></div>
      <div className="panel kpi"><div className="v">{invests.length}</div><div className="l">Investor → company links</div></div>
      <div className="panel kpi"><div className="v">{fmtUSD(d3.sum(rounds25, r => r.amount_usd || 0))}</div><div className="l">Disclosed in rounds since Jan 2025</div><div className="s">{rounds25.length} rounds in dataset</div></div>
    </div>
    <div className="grid g-2" style={{ marginBottom: 14 }}>
      <div className="panel"><h2>Disclosed round capital by segment<span className="aside">sum of rounds in dataset</span></h2><Bars rows={segCap} color="var(--k-investor)" fmt={fmtUSD} /></div>
      <div className="panel"><h2>Most connected investors<span className="aside">portfolio companies in dataset</span></h2><Bars rows={ranked.slice(0, 14).map(r => [r.o.name, r.p.length])} color="var(--k-investor)" onPick={k => { const r = ranked.find(x => x.o.name === k); r && open(r.o.id); }} /></div>
    </div>
    <div className="toolbar"><div className="search" style={{ flex: '0 1 280px' }}><Icon d={I.search} /><input id="inv-search" className="input" placeholder="Filter investors" value={q} onChange={e => setQ(e.target.value)} /></div></div>
    <div className="tbl-wrap" style={{ marginBottom: 14 }}><table className="tbl"><thead><tr><th>Investor</th><th>Type</th><th>Location</th><th style={{ textAlign: 'right' }}>Portfolio</th><th>Robotics portfolio in dataset</th></tr></thead>
      <tbody>{shown.map(({ o, p }) => <tr key={o.id} onClick={() => open(o.id)}><td className="name nowrap">{o.name}</td><td className="nowrap">{o.subsegment || KINDS[o.kind]?.short}</td><td className="nowrap">{[o.hq_city, o.hq_state].filter(Boolean).join(', ') || '—'}</td><td className="num">{p.length}</td><td className="small fg2">{p.map(D.nameOf).join(', ')}</td></tr>)}</tbody></table></div>
    <div className="panel"><h2>Accelerators, associations & programs</h2>
      <div className="grid g-3">{inv.filter(o => o.kind === 'enabler').map(o => <button key={o.id} className="side-item" onClick={() => open(o.id)}><Shape kind="enabler" /><span><span className="t">{o.name}</span><div className="d">{o.subsegment || ''} · {[o.hq_city, o.hq_state].filter(Boolean).join(', ')}</div></span></button>)}</div></div>
  </Fragment>;
}

/* ============================== Events ============================== */
function Events({ D, open, bookmarks, toggleBm }) {
  const [view, setView] = usePersist('ev-view', 'list');
  const [year, setYear] = useState('2026');
  const [cities, setCities] = useState([]); const [topics, setTopics] = useState([]); const [statuses, setStatuses] = useState([]); const [cats, setCats] = useState([]);
  const [minScore, setMinScore] = useState(0); const [onlyBm, setOnlyBm] = useState(false); const [hidePast, setHidePast] = useState(false);
  const [weights, setWeights] = usePersist('ev-weights', Object.fromEntries(SCORE_DIMS.map(([k]) => [k, 3])));
  const [cmp, setCmp] = useState([]);
  const evs = D.events.filter(e => (!cities.length || cities.includes(`${e.city}, ${e.state}`)) && (!topics.length || (e.topics || []).some(t => topics.includes(t))) && (!statuses.length || statuses.includes(e.statusNow))
    && (!cats.length || cats.includes(e.category)) && eventScore(e, weights) >= minScore && (!onlyBm || bookmarks.includes(e.id)) && (!hidePast || e.statusNow !== 'Historical'));
  const score = e => eventScore(e, weights);
  const topicOpts = countBy(D.events, e => e.topics || []);
  const bmBtn = e => <button className={`btn icon ${bookmarks.includes(e.id) ? 'on' : ''}`} onClick={ev => { ev.stopPropagation(); toggleBm(e.id); }} aria-label={bookmarks.includes(e.id) ? 'Remove bookmark' : 'Bookmark event'} title="Bookmark"><Icon d={I.star} size={13} /></button>;
  const statusPill = e => <span className={`pill`} style={{ borderColor: e.statusNow === 'Confirmed' ? 'color-mix(in srgb, var(--good) 60%, transparent)' : e.statusNow === 'Historical' ? 'var(--line-2)' : 'color-mix(in srgb, var(--warn) 60%, transparent)' }}>{e.statusNow}</span>;
  const yearEvs = evs.filter(e => e.start && e.start.startsWith(year));
  return <Fragment>
    <h2 className="section-title">US robotics events</h2>
    <p className="section-sub">{D.events.length} US events across 2026–2027. Past 2026 editions are kept as historical reference. Relevance scores use the published rubric below and your own weights; they are a planning aid, not an endorsement.</p>
    <div className="toolbar">
      <Seg value={view} onChange={setView} options={[['list', 'List'], ['month', 'Month'], ['timeline', 'Timeline'], ['plan', 'Plan & compare']]} />
      {(view === 'month' || view === 'timeline') && <Seg value={year} onChange={setYear} options={[['2026', '2026'], ['2027', '2027']]} />}
      <MultiSelect label="City" options={uniq(D.events.map(e => `${e.city}, ${e.state}`)).sort()} value={cities} onChange={setCities} counts={new Map(countBy(D.events, e => `${e.city}, ${e.state}`))} />
      <MultiSelect label="Topic" options={topicOpts.map(t => t[0])} value={topics} onChange={setTopics} counts={new Map(topicOpts)} />
      <MultiSelect label="Type" options={uniq(D.events.map(e => e.category)).filter(Boolean)} value={cats} onChange={setCats} counts={new Map(countBy(D.events, e => e.category))} />
      <MultiSelect label="Status" options={['Confirmed', 'Tentative', 'Date TBA', 'Historical']} value={statuses} onChange={setStatuses} counts={new Map(countBy(D.events, e => e.statusNow))} />
      <label className="small fg2" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Min. relevance <select id="ev-min" className="input" value={minScore} onChange={e => setMinScore(+e.target.value)}>{[0, 40, 50, 60, 70, 80].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
      <button className={`chip ${hidePast ? 'on' : ''}`} onClick={() => setHidePast(!hidePast)}>Hide past</button>
      <button className={`chip ${onlyBm ? 'on' : ''}`} onClick={() => setOnlyBm(!onlyBm)}><Icon d={I.star} size={11} />Bookmarked<span className="n">{bookmarks.filter(b => D.byId.get(b)?.kind === 'event').length}</span></button>
    </div>
    {!evs.length ? <Empty /> : view === 'list' ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th></th><th>Dates</th><th>Event</th><th>Location</th><th>Type</th><th>Status</th><th style={{ textAlign: 'right' }}>Relevance</th><th>Exhibit / sponsor</th><th>Register</th></tr></thead>
      <tbody>{evs.map(e => <tr key={e.id} onClick={() => open(e.id)} style={{ opacity: e.statusNow === 'Historical' ? .6 : 1 }}><td onClick={ev => ev.stopPropagation()}>{bmBtn(e)}</td><td className="mono nowrap">{fmtRange(e.start, e.end)}</td><td><span className="name">{e.name}</span><div className="muted xs">{e.organizer}</div></td><td className="nowrap">{e.city}, {e.state}<div className="muted xs clip">{e.venue}</div></td><td>{e.category}</td><td>{statusPill(e)}</td>
        <td className="num"><span className="score-bar" style={{ width: score(e) * .4 }} /> {score(e)}</td><td className="small">{e.exhibit ? 'Exhibit' : ''}{e.exhibit && e.sponsorship ? ' · ' : ''}{e.sponsorship ? 'Sponsor' : ''}{!e.exhibit && !e.sponsorship && <span className="muted">—</span>}</td>
        <td onClick={ev => ev.stopPropagation()}>{e.registration ? <Ext href={e.registration}>register</Ext> : e.website ? <Ext href={e.website}>site</Ext> : '—'}</td></tr>)}</tbody></table></div>
      : view === 'month' ? <div className="months">{d3.range(12).map(m => { const mm = `${year}-${String(m + 1).padStart(2, '0')}`; const list = yearEvs.filter(e => e.start.slice(0, 7) === mm); return <div key={m} className={`month ${TODAY.slice(0, 7) === mm ? 'now' : ''}`}><h4>{new Date(+year, m, 1).toLocaleDateString('en-US', { month: 'long' })}<span className="mono">{list.length || ''}</span></h4>
        {list.map(e => <div key={e.id} className={`ev ${e.statusNow === 'Historical' ? 'past' : ''}`} onClick={() => open(e.id)}><span className="dd">{fmtRange(e.start, e.end).split(',')[0]}</span><span><b style={{ fontWeight: 500 }}>{e.name}</b><div className="muted xs">{e.city}, {e.state} · {score(e)}</div></span></div>)}
        {!list.length && <div className="muted xs">No tracked events</div>}</div>; })}
        {evs.filter(e => !e.start).length > 0 && <div className="month"><h4>Date not announced</h4>{evs.filter(e => !e.start).map(e => <div key={e.id} className="ev" onClick={() => open(e.id)}><span className="dd">TBA</span><span>{e.name}<div className="muted xs">{e.city}, {e.state}</div></span></div>)}</div>}</div>
      : view === 'timeline' ? <div className="timeline"><div className="timeline-inner">
        <div className="tl-head"><div>Event</div>{d3.range(12).map(m => <div key={m}>{new Date(+year, m, 1).toLocaleDateString('en-US', { month: 'short' })}</div>)}</div>
        {yearEvs.map(e => { const s = new Date(e.start + 'T00:00:00'), en = new Date((e.end || e.start) + 'T23:59:59'), y0 = new Date(+year, 0, 1), y1 = new Date(+year + 1, 0, 1); const L = (s - y0) / (y1 - y0) * 100, Wd = Math.max(.4, (en - s) / (y1 - y0) * 100);
          return <div key={e.id} className="tl-row" onClick={() => open(e.id)}><div className="nm" title={e.name}>{e.name}</div><div className="lane"><span style={{ left: `${L}%`, width: `${Wd}%`, background: e.statusNow === 'Historical' ? 'var(--line-2)' : kc('event') }} title={`${fmtRange(e.start, e.end)} · ${e.city}`} /></div></div>; })}
        {year === TODAY.slice(0, 4) && <div className="tl-now" style={{ left: `calc(220px + (100% - 220px) * ${(new Date(TODAY) - new Date(+year, 0, 1)) / (365 * 864e5)})` }} title="Today" />}
        {!yearEvs.length && <div style={{ padding: 16 }}><Empty /></div>}
      </div></div>
      : <EventPlanner D={D} evs={evs.filter(e => e.statusNow !== 'Historical')} weights={weights} setWeights={setWeights} cmp={cmp} setCmp={setCmp} open={open} bmBtn={bmBtn} />}
    <div className="panel" style={{ marginTop: 14 }}><h2>Scoring methodology</h2>
      <p className="small fg2" style={{ marginTop: 0 }}>Each event is scored 1–5 on seven dimensions from observable facts (attendance, exhibitor counts, program format, investor programming). Relevance = weighted sum ÷ maximum possible × 100. Change the weights in Plan & compare.</p>
      <div className="grid g-3">{SCORE_DIMS.map(([k, l]) => <div key={k} className="small"><b>{l}</b><div className="muted xs">{D.rubric && D.rubric[k] ? (typeof D.rubric[k] === 'string' ? D.rubric[k] : Object.entries(D.rubric[k]).map(([s, t]) => `${s}: ${t}`).join(' · ')) : ''}</div></div>)}</div></div>
  </Fragment>;
}
function EventPlanner({ D, evs, weights, setWeights, cmp, setCmp, open, bmBtn }) {
  const ranked = [...evs].sort((a, b) => eventScore(b, weights) - eventScore(a, weights));
  const presets = { 'Customer acquisition': { bizdev: 5, partnership: 3, investor: 1, technical: 1, brand: 3, competitive: 3, customer: 5 }, 'Fundraising': { bizdev: 2, partnership: 3, investor: 5, technical: 1, brand: 4, competitive: 2, customer: 1 }, 'Technical / hiring': { bizdev: 1, partnership: 3, investor: 1, technical: 5, brand: 2, competitive: 3, customer: 1 }, 'Balanced': Object.fromEntries(SCORE_DIMS.map(([k]) => [k, 3])) };
  const cmpEvs = cmp.map(id => D.byId.get(id)).filter(Boolean);
  return <div className="net-layout" style={{ gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
    <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th></th><th>Rank</th><th>Event</th><th>Dates</th>{SCORE_DIMS.map(([k, l]) => <th key={k} title={l} style={{ textAlign: 'center' }}>{l.split(' ')[0].slice(0, 6)}</th>)}<th style={{ textAlign: 'right' }}>Score</th><th>Compare</th></tr></thead>
        <tbody>{ranked.map((e, i) => <tr key={e.id} onClick={() => open(e.id)}><td onClick={ev => ev.stopPropagation()}>{bmBtn(e)}</td><td className="num">{i + 1}</td><td className="name">{e.name}<div className="muted xs">{e.city}, {e.state}</div></td><td className="mono nowrap small">{fmtRange(e.start, e.end)}</td>
          {SCORE_DIMS.map(([k]) => <td key={k} className="num" style={{ textAlign: 'center', color: (e.scores?.[k] || 0) >= 4 ? 'var(--fg)' : 'var(--muted)' }}>{e.scores?.[k] ?? '–'}</td>)}<td className="num"><b>{eventScore(e, weights)}</b></td>
          <td onClick={ev => ev.stopPropagation()}><input type="checkbox" aria-label={`Compare ${e.name}`} checked={cmp.includes(e.id)} disabled={!cmp.includes(e.id) && cmp.length >= 4} onChange={() => setCmp(cmp.includes(e.id) ? cmp.filter(x => x !== e.id) : [...cmp, e.id])} /></td></tr>)}</tbody></table></div>
      {cmpEvs.length > 0 && <div className="tbl-wrap"><table className="tbl cmp"><thead><tr><th>Field</th>{cmpEvs.map(e => <th key={e.id}>{e.name}</th>)}</tr></thead><tbody>
        {[['Dates', e => fmtRange(e.start, e.end)], ['Location', e => `${e.city}, ${e.state} · ${e.venue || ''}`], ['Organizer', e => e.organizer], ['Type', e => e.category], ['Audience', e => e.audience], ['Topics', e => (e.topics || []).join(', ')], ['Exhibit', e => e.exhibit || '—'], ['Sponsorship', e => e.sponsorship || '—'], ['Speakers / sponsors', e => e.speakers_sponsors || 'Not confirmed from official pages'], ['Score basis', e => e.score_basis || '—'], ['Weighted score', e => eventScore(e, weights)]]
          .map(([l, g]) => <tr key={l}><td className="muted">{l}</td>{cmpEvs.map(e => <td key={e.id} className="small">{g(e)}</td>)}</tr>)}</tbody></table></div>}
    </div>
    <div className="panel" style={{ alignSelf: 'start', display: 'grid', gap: 10 }}>
      <h3>Your priorities</h3>
      <div className="chips">{Object.entries(presets).map(([n, w]) => <button key={n} className="chip" onClick={() => setWeights(w)}>{n}</button>)}</div>
      {SCORE_DIMS.map(([k, l]) => <div className="range" key={k}><label htmlFor={`w-${k}`}>{l}</label><input id={`w-${k}`} type="range" min="0" max="5" value={weights[k]} onChange={e => setWeights({ ...weights, [k]: +e.target.value })} /><span className="mono">{weights[k]}</span></div>)}
      <p className="muted xs" style={{ margin: 0 }}>Weights are saved in this browser. Tick up to four events to compare them side by side.</p>
    </div>
  </div>;
}

/* ============================== Compare ============================== */
function Compare({ D, open, compare, toggleCmp }) {
  const [q, setQ] = useState('');
  const items = compare.map(id => D.byId.get(id)).filter(Boolean);
  const cands = q.length > 1 ? D.orgs.filter(o => norm(o.name).includes(norm(q)) && !compare.includes(o.id)).slice(0, 8) : [];
  const partners = id => (D.adj.get(id) || []).filter(e => e.type === 'partnership' || e.type === 'customer');
  const rows = [
    ['Category', o => o.segment], ['Subcategory', o => o.subsegment], ['Product', o => o.product], ['Form factor', o => o.robot_type], ['AI approach', o => o.ai_approach],
    ['Models (verified)', o => (o.models || []).map(D.nameOf).join(', ') || '—'], ['Target markets / customers', o => (o.customers || []).join(', ') || 'Not publicly disclosed'],
    ['Commercial maturity', o => <DeployPill v={o.deployment} />], ['Deployment evidence', o => o.deployment_note || '—'], ['Stage', o => o.stage + (o.ticker ? ` (${o.ticker})` : '')],
    ['Disclosed funding', o => o.funding_usd ? fmtUSD(o.funding_usd) : 'Not disclosed'], ['Funding note', o => o.funding_note || '—'], ['Investors', o => (o.investors || []).map(D.nameOf).join(', ') || '—'],
    ['Partnerships / customers (sourced)', o => partners(o.id).map(e => D.nameOf(e.other)).join(', ') || '—'], ['Headquarters', o => [o.hq_city, o.hq_state].filter(Boolean).join(', ') + (o.hq_country && o.hq_country !== 'US' ? ` (parent ${o.hq_country})` : '')],
    ['Metro', o => hubName(o.hub)], ['Founded', o => o.founded || '—'], ['Differentiation (summary)', o => o.summary || '—'], ['Confidence', o => <Conf v={o.confidence} />],
  ];
  return <Fragment>
    <h2 className="section-title">Competitive landscape</h2>
    <p className="section-sub">Compare up to five organizations on documented facts. Fields show what public sources state; no performance claims are inferred.</p>
    <div className="toolbar">
      <div className="search" style={{ flex: '0 1 320px' }}><Icon d={I.search} /><input id="cmp-search" className="input" placeholder={compare.length >= 5 ? 'Comparison is full (5)' : 'Add a company to compare'} disabled={compare.length >= 5} value={q} onChange={e => setQ(e.target.value)} />
        {cands.length > 0 && <div className="dropdown">{cands.map(o => <button key={o.id} onMouseDown={() => { toggleCmp(o.id); setQ(''); }}><Shape kind={o.kind} />{o.name}<span className="muted xs" style={{ marginLeft: 'auto' }}>{o.segment}</span></button>)}</div>}</div>
      <div className="chips">{items.map(o => <button key={o.id} className="chip on" onClick={() => toggleCmp(o.id)}>{o.name}<Icon d={I.x} size={11} /></button>)}</div>
      {!items.length && <div className="chips"><span className="muted small">Quick sets:</span>
        {[['Humanoids', ['figure-ai', 'agility-robotics', 'apptronik', '1x-technologies', 'boston-dynamics']], ['Sidewalk delivery', ['robot-com', 'serve-robotics', 'starship-technologies', 'coco-robotics', 'cartken']], ['Warehouse', ['locus-robotics', 'symbotic', 'dexterity', 'ambi-robotics', 'berkshire-grey']]]
          .map(([n, ids]) => <button key={n} className="chip" onClick={() => ids.filter(id => D.byId.has(id)).forEach(id => toggleCmp(id))}>{n}</button>)}</div>}
    </div>
    {items.length ? <div className="tbl-wrap"><table className="tbl cmp"><thead><tr><th>Field</th>{items.map(o => <th key={o.id}><button className="btn ghost" style={{ padding: 0, border: 0, fontWeight: 600 }} onClick={() => open(o.id)}>{o.name}</button></th>)}</tr></thead>
      <tbody>{rows.map(([l, g]) => <tr key={l} style={{ cursor: 'default' }}><td className="muted">{l}</td>{items.map(o => <td key={o.id} className="small">{g(o) ?? '—'}</td>)}</tr>)}</tbody></table></div>
      : <Empty>Pick companies here, or tick the compare box in the Companies table.</Empty>}
  </Fragment>;
}

/* ============================== Intelligence ============================== */
function Intel({ D, open, setTab }) {
  const rob = D.orgs.filter(o => o.kind === 'robotics' || o.kind === 'ai');
  const recentRoundOrgs = new Set(D.rounds.filter(r => r.date >= '2025-01').map(r => r.org));
  const emerging = rob.filter(o => (o.founded && o.founded >= 2022) || (recentRoundOrgs.has(o.id) && (o.stage === 'Startup' || o.stage === 'Growth')))
    .map(o => ({ o, last: D.rounds.filter(r => r.org === o.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] }))
    .sort((a, b) => (b.last?.date || '').localeCompare(a.last?.date || '') || (b.o.founded || 0) - (a.o.founded || 0));
  const segAll = countBy(rob, o => o.segment);
  const depBySeg = d3.groups(D.orgs.filter(o => o.kind === 'robotics'), o => o.segment).map(([s, l]) => [s, DEPLOY_ORDER.map(d => l.filter(o => (o.deployment || 'Unknown') === d).length), l.length]).sort((a, b) => b[2] - a[2]);
  const modelTrend = d3.rollups(D.models.filter(m => m.released >= '2023'), v => v.length, m => m.category).sort((a, b) => b[1] - a[1]);
  const recentModels = D.models.filter(m => m.released >= '2025').slice(0, 10);
  const supCats = countBy(D.orgs.filter(o => o.kind === 'supplier'), o => o.subsegment);
  const evPresence = D.events.map(e => ({ e, orgs: (D.adj.get(e.id) || []).map(x => x.other).concat(D.orgs.filter(o => e.speakers_sponsors && norm(e.speakers_sponsors).includes(norm(o.name)) && o.name.length > 3).map(o => o.id)) })).map(x => ({ ...x, orgs: uniq(x.orgs) })).filter(x => x.orgs.length).sort((a, b) => b.orgs.length - a.orgs.length);
  return <Fragment>
    <h2 className="section-title">Strategic intelligence</h2>
    <p className="section-sub">Derived views over the dataset. Panels marked <span className="conf analyst">analysis</span> apply transparent heuristics and are interpretation, not established fact.</p>
    <RobotLens D={D} open={open} />
    <div className="grid g-2" style={{ marginTop: 14 }}>
      <div className="panel"><h2>Emerging players<span className="aside">founded 2022+ or private with a 2025–26 round</span></h2>
        <div className="side-list" style={{ maxHeight: 420 }}>{emerging.slice(0, 40).map(({ o, last }) => <button key={o.id} className="side-item" onClick={() => open(o.id)}><Shape kind={o.kind} /><span style={{ minWidth: 0, flex: 1 }}><span className="t">{o.name}</span><div className="d">{o.segment} · founded {o.founded || '?'}{last ? ` · ${last.round || 'round'} ${last.amount_usd ? fmtUSD(last.amount_usd) : ''} (${last.date})` : ''}</div></span><DeployPill v={o.deployment} /></button>)}</div></div>
      <div className="panel"><h2>Commercial deployment intelligence<span className="aside">robotics companies by segment</span></h2>
        <div style={{ display: 'grid', gap: 7 }}>{depBySeg.map(([s, arr, n]) => <div key={s} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,170px) 1fr 30px', gap: 10, alignItems: 'center', fontSize: 12.5 }}><span className="fg2 clip">{s}</span>
          <span className="stack">{arr.map((v, i) => v ? <span key={i} title={`${DEPLOY_ORDER[i]}: ${v}`} style={{ width: `${100 * v / n}%`, background: ['var(--good)', 'var(--warn)', 'var(--serious)', 'var(--serious)', 'var(--k-other)', 'var(--k-other)'][i], opacity: i === 3 ? .6 : 1 }} /> : null)}</span><span className="mono xs" style={{ textAlign: 'right' }}>{n}</span></div>)}</div>
        <div className="legend xs" style={{ marginTop: 10 }}><span><span className="dot" style={{ background: 'var(--good)' }} />Commercial</span><span><span className="dot" style={{ background: 'var(--warn)' }} />Pilot</span><span><span className="dot" style={{ background: 'var(--serious)' }} />Prototype / research</span><span><span className="dot" style={{ background: 'var(--k-other)' }} />Unknown</span></div></div>
    </div>
    <div className="grid g-2" style={{ marginTop: 14 }}>
      <div className="panel"><h2>Technology trends<span className="aside">model releases since 2023 by category</span></h2><Bars rows={modelTrend} color="var(--k-ai)" />
        <h3 style={{ marginTop: 14 }}>Latest releases</h3>{recentModels.map(m => <button key={m.id} className="side-item" onClick={() => open(m.id)}><Shape kind="model" /><span><span className="t">{m.name}</span><div className="d">{D.nameOf(m.developer)} · {m.released} · {m.category} · {m.license}</div></span></button>)}</div>
      <div className="panel"><h2>Ecosystem gaps <span className="conf analyst">analysis</span></h2>
        <p className="small fg2" style={{ marginTop: 0 }}>Segments and component categories with the fewest mapped providers. Thin coverage can mean a real market gap or a gap in this dataset; read alongside the coverage notes in Data & Method.</p>
        <h3>Thinnest company segments</h3><Bars rows={segAll.slice().reverse().slice(0, 6)} color="var(--k-other)" />
        <h3 style={{ marginTop: 12 }}>Thinnest supplier categories</h3><Bars rows={supCats.slice().reverse().slice(0, 6)} color="var(--k-other)" />
        <ul className="small fg2" style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li>Robotic hands and tactile sensing have few US vendors relative to the number of humanoid programs that need them.</li>
          <li>Disclosed supplier relationships are rare: most robot makers do not name actuator, gearbox or battery vendors.</li>
          <li>Few companies in the dataset document humanoid deployments beyond paid pilots.</li></ul></div>
    </div>
    <div className="grid g-2" style={{ marginTop: 14 }}>
      <PartnerFinder D={D} open={open} />
      <div className="panel"><h2>Events intelligence<span className="aside">mapped organizations confirmed at events</span></h2>
        {evPresence.length ? evPresence.slice(0, 12).map(({ e, orgs }) => <div key={e.id} className="rel" style={{ marginBottom: 4 }}><span><button onClick={() => open(e.id)}>{e.name}</button><div className="muted xs">{fmtRange(e.start, e.end)} · {orgs.map(D.nameOf).join(', ')}</div></span><span className="mono xs">{orgs.length}</span></div>)
          : <Empty>No speaker or exhibitor lists have been verified from official event pages yet. This panel fills in as those relationships are added to the dataset.</Empty>}</div>
    </div>
  </Fragment>;
}
function scorePartner(D, a, b) {
  const K = { robotics: { supplier: 3, ai: 3, research: 2, investor: 1, enabler: 1, robotics: 1 }, ai: { robotics: 3, supplier: 2, research: 2, investor: 1, enabler: 1, ai: 0 }, supplier: { robotics: 3, ai: 2, research: 1, investor: 0, enabler: 1, supplier: 0 }, research: { robotics: 2, ai: 2, supplier: 1, investor: 1, enabler: 1, research: 1 }, investor: { robotics: 3, ai: 3, supplier: 1, research: 1, enabler: 1, investor: 0 }, enabler: { robotics: 2, ai: 1, supplier: 1, research: 1, investor: 1, enabler: 0 } };
  const parts = [];
  let comp = K[a.kind]?.[b.kind] ?? 0;
  if (a.kind === 'robotics' && b.kind === 'robotics') comp = a.segment === b.segment ? 0 : 1;
  parts.push(['Complementary role', comp]);
  const geo = a.hub && a.hub !== 'other' && a.hub === b.hub ? 1 : 0; parts.push(['Same metro', geo]);
  const dep = b.deployment === 'Commercial' ? 1 : 0; parts.push(['Verified commercial deployments', dep]);
  const shared = (D.adj.get(b.id) || []).filter(e => (D.adj.get(a.id) || []).some(x => x.other === e.other)).length; const sh = Math.min(2, shared); parts.push(['Shared connections', sh]);
  return { total: parts.reduce((s, p) => s + p[1], 0), parts, competitor: a.kind === b.kind && a.segment === b.segment };
}
function PartnerFinder({ D, open, fixed }) {
  const [id, setId] = useState(fixed || (D.byId.has('robot-com') ? 'robot-com' : D.orgs[0]?.id));
  const [kinds, setKinds] = useState(['supplier', 'ai', 'research', 'robotics', 'investor']);
  const a = D.byId.get(id);
  const connected = new Set((D.adj.get(id) || []).map(e => e.other));
  const res = a ? D.orgs.filter(b => b.id !== id && !connected.has(b.id) && kinds.includes(b.kind)).map(b => ({ b, s: scorePartner(D, a, b) })).filter(x => !x.s.competitor && x.s.total >= 3).sort((x, y) => y.s.total - x.s.total || x.b.name.localeCompare(y.b.name)).slice(0, 15) : [];
  return <div className="panel"><h2>Partnership discovery <span className="conf analyst">analysis</span></h2>
    <div className="toolbar" style={{ marginBottom: 8 }}>
      {!fixed && <select id="pf-org" className="input" value={id} onChange={e => setId(e.target.value)} style={{ maxWidth: 260 }}>{D.orgs.filter(o => o.kind === 'robotics' || o.kind === 'ai' || o.kind === 'supplier').map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
      <MultiSelect label="Partner types" options={['supplier', 'ai', 'research', 'robotics', 'investor', 'enabler']} value={kinds} onChange={setKinds} />
    </div>
    <p className="muted xs" style={{ marginTop: 0 }}>Score = complementary role (0–3) + same metro (0–1) + verified commercial deployments (0–1) + shared connections (0–2). Existing sourced relationships and same-segment competitors are excluded. A high score suggests a conversation worth exploring, nothing more.</p>
    {res.length ? res.map(({ b, s }) => <div key={b.id} className="rel" style={{ marginBottom: 4 }}><span><button onClick={() => open(b.id)}>{b.name}</button><div className="muted xs">{KINDS[b.kind]?.short} · {b.segment}{b.subsegment ? ' · ' + b.subsegment : ''} — {s.parts.filter(p => p[1]).map(p => `${p[0]} +${p[1]}`).join(', ')}</div></span><span className="mono">{s.total}</span></div>) : <Empty>No candidates above the threshold.</Empty>}
  </div>;
}
function RobotLens({ D, open }) {
  const me = D.byId.get('robot-com');
  const byKw = (arr, re) => arr.filter(o => re.test([o.segment, o.subsegment, o.robot_type, o.product, o.summary, ...(o.tags || [])].join(' ')));
  const orgs = D.orgs;
  const lenses = [
    ['Delivery robotics', orgs.filter(o => o.id !== 'robot-com' && o.segment === 'Delivery & Last-Mile')],
    ['Humanoids', orgs.filter(o => o.segment === 'Humanoid')],
    ['Quadrupeds', orgs.filter(o => o.segment === 'Quadrupeds & Mobile Platforms' || /quadruped/i.test(o.robot_type || ''))],
    ['Physical AI', orgs.filter(o => o.segment === 'Physical AI & General-Purpose')],
    ['Fleet management & teleop', byKw(orgs.filter(o => o.kind === 'ai'), /fleet|teleop|remote/i)],
    ['Robotics advertising', byKw(orgs, /advertis|media|screen/i)],
  ];
  const relevantSup = orgs.filter(o => o.kind === 'supplier' && /LiDAR|Cameras|Edge Compute|Batteries|Connectivity|IMU|Safety/i.test(o.subsegment || ''));
  const evs = D.events.filter(e => e.statusNow !== 'Historical').map(e => ({ e, s: Math.round(((e.scores?.customer || 0) * 2 + (e.scores?.bizdev || 0) * 2 + (e.scores?.partnership || 0) + (e.scores?.competitive || 0)) / 30 * 100) })).sort((a, b) => b.s - a.s).slice(0, 8);
  const [lens, setLens] = useState(0);
  const myEdges = me ? D.adj.get(me.id) || [] : [];
  return <div className="panel" style={{ borderColor: 'var(--accent)' }}>
    <h2>Robot.com strategic lens<span className="aside">public information only; no internal Robot.com data</span></h2>
    {me ? <div className="grid g-3" style={{ marginBottom: 12 }}>
      <div><div className="name" style={{ fontWeight: 600, fontSize: 16 }}><button className="btn ghost" style={{ padding: 0, border: 0, fontSize: 16, fontWeight: 600 }} onClick={() => open(me.id)}>{me.name}</button></div><div className="small fg2">{me.summary}</div></div>
      <dl className="kv" style={{ margin: 0 }}><dt>Segment</dt><dd>{me.segment}</dd><dt>Product</dt><dd>{me.product || '—'}</dd><dt>HQ</dt><dd>{[me.hq_city, me.hq_state].filter(Boolean).join(', ')}</dd><dt>Deployment</dt><dd><DeployPill v={me.deployment} /> {me.deployment_note}</dd></dl>
      <div><h4 className="muted xs" style={{ textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 6px' }}>Sourced relationships ({myEdges.length})</h4>{myEdges.slice(0, 8).map((e, i) => <div key={i} className="small"><button className="btn ghost" style={{ padding: 0, border: 0 }} onClick={() => open(e.other)}>{D.nameOf(e.other)}</button> <span className="muted xs">· {EDGE_TYPES[e.type]?.label || e.type}</span></div>)}{!myEdges.length && <span className="muted small">None recorded.</span>}</div>
    </div> : <p className="note">Robot.com is not yet profiled in this dataset.</p>}
    <div className="toolbar"><div className="chips">{lenses.map(([l, arr], i) => <button key={l} className={`chip ${lens === i ? 'on' : ''}`} onClick={() => setLens(i)}>{l}<span className="n">{arr.length}</span></button>)}</div></div>
    <div className="grid g-3">
      <div><h3>{lenses[lens][0]} landscape</h3><div className="side-list" style={{ maxHeight: 300 }}>{lenses[lens][1].map(o => <button key={o.id} className="side-item" onClick={() => open(o.id)}><Shape kind={o.kind} /><span style={{ flex: 1, minWidth: 0 }}><span className="t">{o.name}</span><div className="d">{o.product || o.subsegment} · {[o.hq_city, o.hq_state].filter(Boolean).join(', ')}</div></span><DeployPill v={o.deployment} /></button>)}{!lenses[lens][1].length && <span className="muted small">No mapped organizations match this lens.</span>}</div></div>
      <div><h3>Potential suppliers <span className="conf analyst">analysis</span></h3><p className="muted xs" style={{ marginTop: 0 }}>Vendors in categories a mobile delivery robot typically needs (perception, compute, power, connectivity, safety). Listed by category fit only; no relationship with Robot.com is implied.</p>
        <div className="side-list" style={{ maxHeight: 250 }}>{relevantSup.map(o => <button key={o.id} className="side-item" onClick={() => open(o.id)}><Shape kind="supplier" /><span><span className="t">{o.name}</span><div className="d">{o.subsegment}</div></span></button>)}</div></div>
      <div><h3>Events to prioritize <span className="conf analyst">analysis</span></h3><p className="muted xs" style={{ marginTop: 0 }}>Upcoming events ranked with customer acquisition and business development weighted double.</p>
        {evs.map(({ e, s }) => <button key={e.id} className="side-item" onClick={() => open(e.id)}><Shape kind="event" /><span style={{ flex: 1 }}><span className="t">{e.name}</span><div className="d">{fmtRange(e.start, e.end)} · {e.city}, {e.state}</div></span><span className="mono small">{s}</span></button>)}</div>
    </div>
  </div>;
}

/* ============================== About / coverage ============================== */
function About({ D }) {
  const targets = [['Robotics companies', D.orgs.filter(o => o.kind === 'robotics').length, '150–250'], ['AI & software organizations', D.orgs.filter(o => o.kind === 'ai').length, '30–50'], ['AI models & platforms', D.models.length, '—'], ['Component suppliers', D.orgs.filter(o => o.kind === 'supplier').length, '50–100'], ['Research institutions', D.orgs.filter(o => o.kind === 'research').length, '30–50'], ['Investors & enablers', D.orgs.filter(o => o.kind === 'investor' || o.kind === 'enabler').length, '30–50'], ['US events (2026–27)', D.events.length, '30–50'], ['Sourced relationships', D.edges.length, '—'], ['Funding rounds', D.rounds.length, '—']];
  const conf = countBy(D.orgs, o => o.confidence || 'unknown');
  const noSrc = D.orgs.filter(o => !o.sources?.length);
  return <Fragment>
    <h2 className="section-title">Data & method</h2>
    <div className="grid g-2">
      <div className="panel"><h2>Coverage against research targets</h2>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Entity</th><th style={{ textAlign: 'right' }}>In dataset</th><th style={{ textAlign: 'right' }}>Target</th></tr></thead><tbody>{targets.map(([l, n, t]) => <tr key={l} style={{ cursor: 'default' }}><td>{l}</td><td className="num">{n}</td><td className="num muted">{t}</td></tr>)}</tbody></table></div>
        <p className="small fg2">Targets were guides, not quotas. No record was added to reach a number.</p></div>
      <div className="panel"><h2>Evidence standards</h2>
        <ul className="small fg2" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }}>
          <li>Every organization, model, event, funding round and relationship carries at least one public source URL and a verification date ({D.meta.verified}).</li>
          <li>Confidence labels: <Conf v="verified" /> confirmed by an official or primary source; <Conf v="company-reported" /> the company's own claim (funding totals, customer counts, valuations); <Conf v="third-party-estimate" /> press or analyst estimate; <Conf v="analyst" /> interpretation in this tool; <Conf v="unverified" /> profile drawn from the research team's prior knowledge because the live-search budget ran out during this pass. Treat unverified records as leads to re-check, not facts.</li>
          <li>Deployment status is strict: announced partnerships and pilots are not counted as commercial deployments, and demos are not counted as scale.</li>
          <li>A model is linked to a robot company only when a source documents use. Compatibility listings are shown separately in the supply chain view.</li>
          <li>Map coordinates are approximate city centroids for the headquarters or main US office, not street addresses.</li>
          <li>Organizations named in a sourced relationship but not yet researched appear as “referenced” nodes in the network.</li></ul>
        <h3 style={{ marginTop: 14 }}>Confidence mix</h3><Bars rows={conf} color="var(--k-other)" />
        {noSrc.length > 0 && <p className="note">{noSrc.length} records are missing a source URL and should be re-verified: {noSrc.map(o => o.name).join(', ')}</p>}</div>
    </div>
    <div className="grid g-2" style={{ marginTop: 14 }}>
      <div className="panel"><h2>Known gaps</h2><ul className="small fg2" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }}>
        <li>Speaker, sponsor and exhibitor lists were not available from official event pages for most events, so company-to-event links are sparse.</li>
        <li>Supplier-to-robot-maker relationships are mostly undisclosed by the industry; the supply chain view shows only confirmed ones.</li>
        <li>Private-company funding totals reflect public announcements and may omit undisclosed rounds.</li>
        <li>Some 2027 event dates were not yet announced on {D.meta.verified}; they are labeled Date TBA.</li>
        <li>Coverage of defense robotics, marine/underwater robotics and space robotics is limited in this version.</li>
        {(D.meta.warnings || []).length > 0 && <li>Build warnings: {(D.meta.warnings || []).length} (see dataset meta).</li>}</ul></div>
      <div className="panel"><h2>How the data updates</h2>
        <p className="small fg2" style={{ marginTop: 0 }}>The dashboard reads one normalized JSON dataset. To update it, edit the research files and rebuild, or use <b>Data → Import</b> to load a revised dataset file into this page without rebuilding. Nothing syncs automatically: this page has no live data feed, and all figures are as of the verification date.</p>
        <p className="small fg2">Bookmarks, comparison picks, event weights and the theme are saved in this browser only.</p>
        <p className="small muted">Research sources by file: {(D.meta.files || []).map(f => `${f.file} (${f.orgs || 0} orgs${f.events ? `, ${f.events} events` : ''})`).join(' · ')}</p></div>
    </div>
  </Fragment>;
}

/* ============================== Profile drawer ============================== */
function Profile({ id, onClose, D, open, bookmarks, toggleBm, compare, toggleCmp }) {
  const x = D.byId.get(id);
  useEffect(() => { const f = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []);
  if (!x) return null;
  const rel = D.adj.get(id) || [];
  const groups = d3.groups(rel, e => e.type);
  const rounds = D.rounds.filter(r => r.org === id);
  const asLead = D.rounds.filter(r => r.lead === id || (r.investors || []).includes(id));
  const kv = (l, v) => v == null || v === '' || (Array.isArray(v) && !v.length) ? null : <Fragment key={l}><dt>{l}</dt><dd>{v}</dd></Fragment>;
  const isOrg = !['event', 'model'].includes(x.kind);
  return <Fragment><div className="scrim" onClick={onClose} />
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${x.name} profile`}>
      <div className="drawer-head">
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}><KindPill kind={x.kind} />{x.segment && <span className="pill">{x.segment}</span>}{x.deployment && <DeployPill v={x.deployment} />}{x.statusNow && <span className="pill">{x.statusNow}</span>}{x.stub && <span className="pill">Referenced only</span>}</div>
          <h2>{x.name}</h2>{x.website && <div className="small"><Ext href={x.website} /></div>}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`btn icon ${bookmarks.includes(id) ? 'on' : ''}`} onClick={() => toggleBm(id)} aria-label="Bookmark" title="Bookmark"><Icon d={I.star} /></button>
          {isOrg && !x.stub && <button className={`btn icon ${compare.includes(id) ? 'on' : ''}`} onClick={() => toggleCmp(id)} disabled={!compare.includes(id) && compare.length >= 5} aria-label="Add to comparison" title="Compare"><Icon d={I.cmp} /></button>}
          <button className="btn icon" onClick={onClose} aria-label="Close profile"><Icon d={I.x} /></button></div>
      </div>
      <div className="drawer-body">
        {x.summary && <p style={{ margin: 0 }}>{x.summary}</p>}
        {x.kind === 'event' ? <dl className="kv">{[kv('Dates', fmtRange(x.start, x.end)), kv('Venue', [x.venue, x.city, x.state].filter(Boolean).join(', ')), kv('Organizer', x.organizer), kv('Type', x.category), kv('Topics', (x.topics || []).join(', ')), kv('Audience', x.audience), kv('Exhibiting', x.exhibit), kv('Sponsorship', x.sponsorship), kv('Speakers / sponsors', x.speakers_sponsors || 'Not confirmed from official pages'), kv('Registration', x.registration && <Ext href={x.registration} />), kv('Status', x.statusNow), kv('Notes', x.notes), kv('Score basis', x.score_basis)]}</dl>
          : x.kind === 'model' ? <dl className="kv">{[kv('Developer', <button className="btn ghost" style={{ padding: 0, border: 0 }} onClick={() => open(x.developer)}>{D.nameOf(x.developer)}</button>), kv('Released', x.released), kv('Category', x.category), kv('Embodiments', (x.embodiments || []).join(', ')), kv('License', x.license), kv('Availability', x.availability), kv('Capabilities', x.capabilities), kv('Integrations', (x.integrations || []).join(', ')), kv('Documentation', x.docs && <Ext href={x.docs} />)]}</dl>
          : <dl className="kv">{[kv('Headquarters', [x.hq_city, x.hq_state].filter(Boolean).join(', ') + (x.hq_country && x.hq_country !== 'US' ? ` (parent HQ: ${x.hq_country})` : '')), kv('Metro', x.hub ? hubName(x.hub) : null), kv('Founded', x.founded), kv('Subcategory', x.subsegment), kv('Product', x.product), kv('Robot type', x.robot_type), kv('AI approach', x.ai_approach), kv('Models', (x.models || []).length ? (x.models || []).map(m => <button key={m} className="btn ghost" style={{ padding: '0 6px 0 0', border: 0 }} onClick={() => open(m)}>{D.nameOf(m)}</button>) : null),
            kv('Stage', x.stage ? x.stage + (x.ticker ? ` · ${x.ticker}` : '') : null), kv('Disclosed funding', x.funding_usd ? fmtUSD(x.funding_usd) : x.kind === 'robotics' || x.kind === 'ai' ? 'Not publicly disclosed' : null), kv('Funding note', x.funding_note), kv('Investors', (x.investors || []).map(D.nameOf).join(', ')), kv('Customers', (x.customers || []).join(', ')), kv('Deployment', x.deployment_note), kv('Suppliers', (x.suppliers || []).map(D.nameOf).join(', ')), kv('Confidence', x.confidence && <Conf v={x.confidence} />), kv('Last verified', x.verified)]}</dl>}
        {rounds.length > 0 && <div><h4>Funding rounds</h4><div className="rel-list">{rounds.map((r, i) => <div className="rel" key={i}><span><b style={{ fontWeight: 500 }}>{r.round || 'Round'}</b> · {r.date} · {fmtUSD(r.amount_usd)}<div className="muted xs">{r.lead ? `Lead: ${D.nameOf(r.lead)}` : ''}{r.note ? ` · ${r.note}` : ''}</div></span>{r.source && <a className="link xs" href={r.source} target="_blank" rel="noopener noreferrer">source</a>}</div>)}</div></div>}
        {asLead.length > 0 && <div><h4>Rounds participated in</h4><div className="rel-list">{asLead.slice(0, 20).map((r, i) => <div className="rel" key={i}><span><button onClick={() => open(r.org)}>{D.nameOf(r.org)}</button><div className="muted xs">{r.round} · {r.date} · {fmtUSD(r.amount_usd)}{r.lead === id ? ' · lead' : ''}</div></span>{r.source && <a className="link xs" href={r.source} target="_blank" rel="noopener noreferrer">source</a>}</div>)}</div></div>}
        {groups.map(([t, es]) => <div key={t}><h4>{EDGE_TYPES[t]?.label || t} · {es.length}</h4><div className="rel-list">{es.map((e, i) => <div className="rel" key={i}><span><button onClick={() => open(e.other)}>{D.nameOf(e.other)}</button><div className="muted xs">{e.dir === 'in' ? '← ' : '→ '}{e.note || ''} <Conf v={e.confidence} /></div></span>{e.source && <a className="link xs" href={e.source} target="_blank" rel="noopener noreferrer">source</a>}</div>)}</div></div>)}
        {!rel.length && !x.stub && <p className="muted small" style={{ margin: 0 }}>No sourced relationships recorded yet.</p>}
        <div><h4>Sources</h4><div className="src-list">{(x.sources || []).map((s, i) => <div key={i}><Ext href={s.url}>{s.label || s.url}</Ext></div>)}{x.source && !(x.sources || []).length && <Ext href={x.source} />}{!(x.sources || []).length && !x.source && <span className="muted">No source recorded</span>}</div></div>
      </div>
    </aside></Fragment>;
}

/* ============================== Modal: export / data ============================== */
function Modal({ modal, onClose, D }) {
  const [fmt, setFmt] = useState(modal.fmt || 'json');
  const [msg, setMsg] = useState('');
  const taRef = useRef();
  useEffect(() => { const f = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, []);
  const copy = text => { navigator.clipboard?.writeText(text).then(() => setMsg('Copied to clipboard.'), () => { taRef.current?.select(); setMsg('Copy was blocked here. The text is selected; press Ctrl/Cmd+C.'); }) ?? (taRef.current?.select(), setMsg('Text selected; press Ctrl/Cmd+C.')); };
  const download = (text, name, type) => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setMsg('Download started. If nothing happened, this viewer blocks downloads; use Copy instead.'); } catch { setMsg('Downloads are blocked in this viewer. Use Copy instead.'); } };
  if (modal.type === 'export') {
    const text = fmt === 'csv' ? modal.csv : modal.json;
    return <div className="modal"><div className="scrim" onClick={onClose} /><div className="modal-card" style={{ position: 'relative', zIndex: 71 }} role="dialog" aria-modal="true">
      <header><h3>{modal.title}</h3><span className="grow" style={{ flex: 1 }} /><Seg value={fmt} onChange={setFmt} options={[['csv', 'CSV'], ['json', 'JSON']]} /><button className="btn icon" onClick={onClose} aria-label="Close"><Icon d={I.x} /></button></header>
      <div className="body"><textarea id="export-text" ref={taRef} readOnly value={text} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><button className="btn primary" onClick={() => copy(text)}>Copy {fmt.toUpperCase()}</button><button className="btn" onClick={() => download(text, `${modal.filename}.${fmt}`, fmt === 'csv' ? 'text/csv' : 'application/json')}>Download file</button><span className="small fg2">{msg}</span></div>
        <p className="muted xs" style={{ margin: 0 }}>Some viewers block file downloads from embedded pages. Copy always works: paste into a spreadsheet or a .{fmt} file.</p></div></div></div>;
  }
  // data import / export
  const full = JSON.stringify(D.raw, null, 1);
  const onFile = file => { const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); const bad = validateDataset(j); if (bad) { setMsg(bad); return; } modal.setRaw(j); modal.setDataSource('imported'); setMsg(`Loaded ${j.organizations.length} organizations from ${file.name}.`); } catch (e) { setMsg(`That file is not valid JSON: ${e.message}`); } }; r.onerror = () => setMsg('The file could not be read.'); r.readAsText(file); };
  return <div className="modal"><div className="scrim" onClick={onClose} /><div className="modal-card" style={{ position: 'relative', zIndex: 71 }} role="dialog" aria-modal="true">
    <header><h3>Dataset</h3><span style={{ flex: 1 }} /><button className="btn icon" onClick={onClose} aria-label="Close"><Icon d={I.x} /></button></header>
    <div className="body">
      <p className="small fg2" style={{ margin: 0 }}>The atlas runs on one JSON dataset ({D.orgs.length} organizations, {D.models.length} models, {D.events.length} events, {D.edges.length} relationships, verified {D.meta.verified}). Import a revised file with the same shape to replace it for this session; reload the page to return to the published data.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn primary" htmlFor="import-file">Import dataset JSON</label><input id="import-file" type="file" accept="application/json,.json" hidden onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
        <button className="btn" onClick={() => copy(full)}>Copy full dataset</button><button className="btn" onClick={() => download(full, 'us-robotics-atlas.json', 'application/json')}>Download dataset</button>
        <span className="small fg2">{msg}</span></div>
      <textarea id="dataset-text" ref={taRef} readOnly value={full.slice(0, 20000) + (full.length > 20000 ? '\n… (truncated preview; Copy includes everything)' : '')} />
    </div></div></div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
