// Escape Planner — schematic maps drawn in the browser from Natural Earth data.
// © 2026 Kiyan Amirian. All rights reserved.
(function(){
const EP = window.EP;
const loaded = {};
const loadScript = src => loaded[src] || (loaded[src] = new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete loaded[src]; fail(new Error('Could not load ' + src)); }; document.head.appendChild(s); }));
let geo = null;
EP.loadMapData = async () => {
  if (geo) return geo;
  await loadScript('vendor/d3-array.min.js');
  await Promise.all([loadScript('vendor/d3-geo.min.js'), loadScript('vendor/topojson-client.min.js'), loadScript('data/world-50m.js'), loadScript('data/airports.js')]);
  const w = window.EP_WORLD;
  const landAll = topojson.feature(w, w.objects.land);
  const polys = (landAll.type === 'FeatureCollection' ? landAll.features : [landAll]).flatMap(f => f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]);
  // drop rings d3 reads as "the whole sphere minus land"
  const land = {type: 'MultiPolygon', coordinates: polys.filter(p => d3.geoArea({type: 'Polygon', coordinates: p}) < 2 * Math.PI)};
  const borders = topojson.mesh(w, w.objects.countries, (a, b) => a !== b);
  geo = {land, borders, airports: window.EP_AIRPORTS || {}};
  return geo;
};
EP.airport = code => { const a = geo && code ? geo.airports[String(code).trim().toUpperCase()] : null; return a ? {code: String(code).trim().toUpperCase(), lat: a[0], lon: a[1], name: a[2], city: a[3], country: a[4]} : null; };

const MODE = {flight: 'Flight', drive: 'Drive', rail: 'Train', bus: 'Bus', ferry: 'Ferry', other: 'Other transport'};
EP.MODE = MODE;
EP.normMode = m => { m = String(m || '').toLowerCase(); if (/fl(y|ight)|plane|air/.test(m)) return 'flight'; if (/ferry|boat|ship|catamaran/.test(m)) return 'ferry'; if (/train|rail/.test(m)) return 'rail'; if (/bus|coach|shuttle/.test(m)) return 'bus'; if (/drive|car|road|taxi|transfer/.test(m)) return 'drive'; return m ? 'other' : ''; };
const ICON = {
  flight: '<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>',
  drive: '<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>',
  rail: '<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>',
  ferry: '<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>'
};
ICON.bus = ICON.drive; ICON.other = ICON.drive;
EP.icon = mode => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[mode] || ICON.other}</svg>`;

const W = 640, H = 400, r1 = x => Math.round(x * 10) / 10;
const circMeanLon = lons => { const x = lons.reduce((s, l) => s + Math.cos(l * Math.PI / 180), 0), y = lons.reduce((s, l) => s + Math.sin(l * Math.PI / 180), 0); return Math.atan2(y, x) * 180 / Math.PI; };

function projectionFor(points, {padX = 150, padY = 78, minSpan = 0.9} = {}) {
  const cLon = circMeanLon(points.map(p => p.lon));
  const rel = p => { let d = p.lon - cLon; d = ((d + 540) % 360) - 180; return d; };
  const lats = points.map(p => p.lat), dl = points.map(rel);
  let [a, b, c, d] = [Math.min(...lats), Math.max(...lats), Math.min(...dl), Math.max(...dl)];
  const span = Math.max(d - c, b - a);
  if (b - a < minSpan * 0.62) { const m = (a + b) / 2; a = m - minSpan * 0.31; b = m + minSpan * 0.31; }
  if (d - c < minSpan) { const m = (c + d) / 2; c = m - minSpan / 2; d = m + minSpan / 2; }
  const wide = span > 70;
  const base = wide ? d3.geoNaturalEarth1() : d3.geoMercator();
  const proj = base.rotate([-cLon, 0]).fitExtent([[padX, padY], [W - padX, H - padY]], {type: 'MultiPoint', coordinates: [[c + cLon, a], [d + cLon, b], [c + cLon, b], [d + cLon, a]]});
  proj.clipExtent([[-5, -5], [W + 5, H + 5]]);
  return proj;
}
const quadPoint = (sx, sy, cx, cy, ex, ey, t) => { const q = (A, C, B) => (1 - t) * (1 - t) * A + 2 * (1 - t) * t * C + t * t * B; return {x: r1(q(sx, cx, ex)), y: r1(q(sy, cy, ey))}; };
function curve(a, b, bend) { const dx = b.x - a.x, dy = b.y - a.y; const cx = r1((a.x + b.x) / 2 - dy * bend), cy = r1((a.y + b.y) / 2 + dx * bend); return {d: `M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}`, mid: quadPoint(a.x, a.y, cx, cy, b.x, b.y, 0.5), c: {x: cx, y: cy}}; }
function toEdge(n, target) { const dx = target.x - n.x, dy = target.y - n.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, m = 16; let t = Infinity; if (ux > 0) t = Math.min(t, (W - m - n.x) / ux); if (ux < 0) t = Math.min(t, (m - n.x) / ux); if (uy > 0) t = Math.min(t, (H - m - n.y) / uy); if (uy < 0) t = Math.min(t, (m - n.y) / uy); return {x: r1(n.x + ux * t), y: r1(n.y + uy * t)}; }
const inside = p => p.x > 20 && p.x < W - 20 && p.y > 20 && p.y < H - 20;

// Build the travel legs of a route (or a single destination) with distances.
// Returns {nodes:[{id,label,lat,lon,code}], legs:[{n,kind,mode,from,to,a,b,mi,min,duration,note,codes,date,dir}]}
EP.routeLegs = (plan, dest, route) => {
  const t = plan.trip, origin = (t.travelers[0] && (t.travelers[0].airports || [])[0]) || '';
  const homeAp = EP.airport(origin);
  const stops = route ? route.stops : [{name: dest.name, lat: dest.lat, lon: dest.lon, airport: dest.airport, nights: t.nights || 0}];
  const nodes = [];
  stops.forEach((s, i) => {
    const ap = EP.airport(s.airport) || (i === 0 || i === stops.length - 1 ? EP.airport(dest.airport) : null);
    const lat = typeof s.lat === 'number' ? s.lat : ap?.lat, lon = typeof s.lon === 'number' ? s.lon : ap?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;
    let node = nodes.find(n => n.label.toLowerCase() === String(s.name).toLowerCase());
    if (!node) { node = {id: 'n' + nodes.length, label: s.name, lat, lon, code: EP.airport(s.airport)?.code || ''}; nodes.push(node); }
    s._node = node.id;
  });
  const byName = name => { const k = String(name || '').toLowerCase(); return nodes.find(n => n.label.toLowerCase() === k) || nodes.find(n => k && (n.label.toLowerCase().includes(k) || k.includes(n.label.toLowerCase()))); };
  // stop dates
  let date = t.start_date && /^\d{4}-\d{2}-\d{2}$/.test(t.start_date) ? t.start_date : '';
  const stopDates = stops.map(s => { const st = date; if (date && s.nights) date = EP.addDays(date, s.nights); return {start: st, end: date}; });
  const legs = [];
  const firstStop = stops[0], lastStop = stops[stops.length - 1];
  const arrAp = EP.airport(firstStop.airport) || EP.airport(dest.airport), depAp = EP.airport(lastStop.airport) || EP.airport(dest.airport);
  const nFirst = nodes.find(n => n.id === firstStop._node), nLast = nodes.find(n => n.id === lastStop._node);
  if (homeAp && nFirst) { const to = arrAp || nFirst; const mi = EP.miles(homeAp, to); legs.push({kind: 'home', dir: 'in', mode: 'flight', from: `${t.travelers[0].from || homeAp.city} (${homeAp.code})`, to: `${nFirst.label}${arrAp ? ` (${arrAp.code})` : ''}`, a: 'home', b: nFirst.id, mi, min: EP.flightMinutes(mi), codes: [homeAp.code, arrAp?.code || ''], date: t.start_date || ''}); }
  // between stops
  const given = route ? route.legs.filter(l => l && (l.from || l.to)) : [];
  if (route) {
    if (given.length) given.forEach((l, i) => {
      const A = byName(l.from) || nodes[i], B = byName(l.to) || nodes[i + 1]; if (!A || !B || A === B) return;
      const mode = EP.normMode(l.mode) || 'other'; const fa = EP.airport(l.from_airport), ta = EP.airport(l.to_airport);
      const mi = (mode === 'flight' && fa && ta) ? EP.miles(fa, ta) : EP.miles(A, B);
      const si = stops.findIndex(s => s._node === B.id && stops.indexOf(s) > 0);
      legs.push({kind: 'leg', mode, from: A.label, to: B.label, a: A.id, b: B.id, mi, min: mode === 'flight' ? EP.flightMinutes(mi) : null, straight: !(mode === 'flight' && fa && ta), codes: mode === 'flight' && fa && ta ? [fa.code, ta.code] : null, duration: l.duration || '', note: l.note || '', date: given.length === stops.length - 1 ? stopDates[i + 1].start : (si > 0 ? stopDates[si].start : ''), given: true});
    });
    else for (let i = 0; i + 1 < stops.length; i++) {
      const A = nodes.find(n => n.id === stops[i]._node), B = nodes.find(n => n.id === stops[i + 1]._node); if (!A || !B || A === B) continue;
      const mi = EP.miles(A, B), mode = mi > 400 ? 'flight' : 'drive';
      legs.push({kind: 'leg', mode, from: A.label, to: B.label, a: A.id, b: B.id, mi, min: mode === 'flight' ? EP.flightMinutes(mi) : null, straight: true, assumed: true, date: stopDates[i + 1].start, note: 'The plan didn’t say how to travel here; mode assumed from distance.'});
    }
  }
  if (homeAp && nLast) { const from = depAp || nLast; const mi = EP.miles(from, homeAp); legs.push({kind: 'home', dir: 'out', mode: 'flight', from: `${nLast.label}${depAp ? ` (${depAp.code})` : ''}`, to: `${t.travelers[0].from || homeAp.city} (${homeAp.code})`, a: nLast.id, b: 'home', mi, min: EP.flightMinutes(mi), codes: [depAp?.code || '', homeAp.code], date: t.end_date || ''}); }
  legs.forEach((l, i) => l.n = i + 1);
  return {nodes, legs, home: homeAp, stopDates};
};

// SVG + HTML overlay for a set of nodes and legs.
EP.mapFigure = (data, {uid, caption = true} = {}) => {
  if (!geo || !data.nodes.length) return '';
  const pts = data.nodes.map(n => ({lat: n.lat, lon: n.lon}));
  const homeInView = data.home && data.nodes.length && Math.max(...data.nodes.map(n => EP.miles(n, data.home))) < 1500 && data.legs.some(l => l.kind === 'home');
  const proj = projectionFor(homeInView ? [...pts, data.home] : pts, {minSpan: data.nodes.length > 1 ? 0.9 : 6});
  const path = d3.geoPath(proj).digits(1);
  const xy = p => { const v = proj([p.lon, p.lat]); return v ? {x: r1(v[0]), y: r1(v[1])} : null; };
  const nodes = data.nodes.map(n => ({...n, ...xy(n)})).filter(n => typeof n.x === 'number');
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  let homeP = data.home ? xy(data.home) : null;
  if (homeP && !inside(homeP)) homeP = null; // draw an arrow to the edge instead
  // group there-and-back legs so each pair is drawn once
  const groups = [];
  data.legs.forEach(l => {
    const key = l.kind === 'home' ? `home|${l.dir}|${l.kind === 'home' ? (l.dir === 'in' ? l.b : l.a) : ''}` : `${[l.a, l.b].sort().join('|')}|${l.mode}`;
    let g = groups.find(x => x.key === key); if (!g) { g = {key, legs: []}; groups.push(g); } g.legs.push(l);
  });
  // combine home in/out when they touch the same node
  const hin = groups.find(g => g.key.startsWith('home|in')), hout = groups.find(g => g.key.startsWith('home|out'));
  if (hin && hout && hin.legs[0].b === hout.legs[0].a) { hin.legs.push(...hout.legs); groups.splice(groups.indexOf(hout), 1); hin.both = true; }
  const homeDir = data.home ? (() => { const v = proj([data.home.lon, data.home.lat]); return v ? {x: v[0], y: v[1]} : null; })() : null;
  const drawn = groups.map(g => {
    const l = g.legs[0];
    let geom;
    if (l.kind === 'home') {
      const n = byId[l.dir === 'in' ? l.b : l.a]; if (!n) return null;
      const target = homeP || (homeDir ? toEdge(n, homeDir) : toEdge(n, {x: n.x, y: -100}));
      const both = g.both || g.legs.length > 1; const bend = both ? 0.06 : (l.dir === 'in' ? 0.1 : -0.1);
      const [s, e] = (l.dir === 'in' || both) ? [target, n] : [n, target];
      const c = curve(s, e, bend); const tt = (l.dir === 'in' || both) ? 0.28 : 0.72;
      geom = {d: c.d, label: quadPoint(s.x, s.y, c.c.x, c.c.y, e.x, e.y, tt)};
    } else {
      const A = byId[l.a], B = byId[l.b]; if (!A || !B) return null;
      const c = curve(A, B, l.mode === 'flight' ? 0.22 : 0.14); geom = {d: c.d, label: c.mid};
    }
    return {...l, ...geom, nums: g.legs.map(x => x.n), both: g.legs.length > 1};
  }).filter(Boolean);
  const k = l => l.kind === 'home' ? 'home' : l.mode;
  const id = uid || ('m' + Math.random().toString(36).slice(2, 8));
  const markers = ['flight', 'drive', 'rail', 'bus', 'ferry', 'other', 'home'].map(m => `<marker id="ar-${m}-${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ah ah-${m}"/></marker>`).join('');
  const pct = (v, T) => `${(v / T * 100).toFixed(2)}%`;
  const clamp = (v, T, lo) => Math.min(T * (1 - lo), Math.max(T * lo, v));
  const labels = nodes.map(n => `<span class="map-label" data-x="${n.x}" data-y="${n.y}" style="left:${pct(n.x, W)};top:${pct(n.y, H)}">${EP.esc(n.label)}</span>`).join('') + (homeP ? `<span class="map-label map-home" data-x="${homeP.x}" data-y="${homeP.y}" style="left:${pct(homeP.x, W)};top:${pct(homeP.y, H)}">${EP.esc(data.home.city || 'Home')}</span>` : '');
  const badges = drawn.map(l => `<span class="map-badge mb-${k(l)}" style="left:${pct(clamp(l.label.x, W, .1), W)};top:${pct(clamp(l.label.y, H, .07), H)}">${l.nums.map(x => `<b>${x}</b>`).join('')}<span>${l.kind === 'home' ? (l.both ? 'home ' : l.dir === 'in' ? 'from home ' : 'to home ') : ''}${EP.distance(l.mi)}</span></span>`).join('');
  const modes = [...new Set(drawn.map(l => l.kind === 'home' ? 'flight' : l.mode))];
  const legend = modes.map(m => `<span class="legend-item"><svg viewBox="0 0 34 8" aria-hidden="true"><path class="leg leg-${m}" d="M2 4H32"/></svg>${MODE[m] || 'Other'}</span>`).join('');
  const aria = 'Schematic map. ' + data.legs.map(l => `${l.n}. ${MODE[l.mode] || 'Travel'} from ${l.from} to ${l.to}, ${EP.distance(l.mi)}`).join('; ') + '.';
  return `<figure class="route-map"><div class="map-frame" data-w="${W}" data-h="${H}" style="aspect-ratio:${W}/${H}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${EP.esc(aria)}"><defs>${markers}</defs><rect class="sea" width="${W}" height="${H}"/><path class="land" d="${path(geo.land) || ''}"/><path class="border" d="${path(geo.borders) || ''}"/>${drawn.map(l => `<path class="leg leg-${k(l)}" d="${l.d}" marker-end="url(#ar-${k(l)}-${id})"${l.both ? ` marker-start="url(#ar-${k(l)}-${id})"` : ''}/>`).join('')}${homeP ? `<rect class="home-node" x="${homeP.x - 6}" y="${homeP.y - 6}" width="12" height="12" rx="2"/>` : ''}${nodes.map(n => `<circle class="node" cx="${n.x}" cy="${n.y}" r="7"/>`).join('')}</svg>${labels}${badges}</div>${caption ? `<figcaption><span class="legend">${legend}</span><span>Schematic: lines show the order of travel, not real flight paths or roads. Numbers match the legs listed.</span></figcaption>` : ''}</figure>`;
};

// Overview map: every destination, with lines from home.
EP.overviewFigure = plan => {
  if (!geo) return '';
  const t = plan.trip, home = EP.airport((t.travelers[0]?.airports || [])[0]);
  const dests = plan.destinations.filter(d => typeof d.lat === 'number' && typeof d.lon === 'number');
  if (!dests.length) return '';
  const pts = dests.map(d => ({lat: d.lat, lon: d.lon})); if (home) pts.push(home);
  const proj = projectionFor(pts, {padX: 110, padY: 60, minSpan: 8});
  const path = d3.geoPath(proj).digits(1);
  const xy = p => { const v = proj([p.lon, p.lat]); return v ? {x: r1(v[0]), y: r1(v[1])} : null; };
  const pct = (v, T) => `${(v / T * 100).toFixed(2)}%`;
  const hp = home ? xy(home) : null;
  const marks = dests.map(d => ({d, p: xy(d)})).filter(m => m.p);
  const lines = hp ? marks.map((m, i) => { const c = curve(hp, m.p, 0.12 * (i % 2 ? 1 : -1)); return `<path class="leg leg-flight ov-line" d="${c.d}"/>`; }).join('') : '';
  const labels = marks.map(m => `<button type="button" class="map-label map-pick" data-pick="${EP.esc(m.d.id)}" data-x="${m.p.x}" data-y="${m.p.y}" style="left:${pct(m.p.x, W)};top:${pct(m.p.y, H)}">${EP.esc(m.d.name)}${home ? `<small>${EP.distance(EP.miles(home, EP.airport(m.d.airport) || m.d))}</small>` : ''}</button>`).join('') + (hp ? `<span class="map-label map-home" data-x="${hp.x}" data-y="${hp.y}" style="left:${pct(hp.x, W)};top:${pct(hp.y, H)}">${EP.esc(t.travelers[0]?.from || home.city)}</span>` : '');
  return `<figure class="route-map overview-map"><div class="map-frame" data-w="${W}" data-h="${H}" style="aspect-ratio:${W}/${H}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${EP.esc('Map of the options: ' + dests.map(d => d.name).join(', '))}"><rect class="sea" width="${W}" height="${H}"/><path class="land" d="${path(geo.land) || ''}"/><path class="border" d="${path(geo.borders) || ''}"/>${lines}${hp ? `<rect class="home-node" x="${hp.x - 6}" y="${hp.y - 6}" width="12" height="12" rx="2"/>` : ''}${marks.map(m => `<circle class="node" cx="${m.p.x}" cy="${m.p.y}" r="7"/>`).join('')}</svg>${labels}</div><figcaption><span>${home ? `Straight-line distance from ${EP.esc(home.code)} under each name. ` : ''}Select a name to open it.</span></figcaption></figure>`;
};

// Place labels where they collide least with lines, badges, other labels and the frame.
EP.placeLabels = root => {
  (root || document).querySelectorAll('.map-frame').forEach(frame => {
    const Wf = +frame.dataset.w, fr = frame.getBoundingClientRect(); if (!fr.width) return; const k = fr.width / Wf;
    const pts = []; frame.querySelectorAll('path.leg').forEach(p => { const n = p.getAttribute('d').match(/-?[\d.]+/g).map(Number); if (n.length < 6) return; const [sx, sy, cx, cy, ex, ey] = n; for (let t = 0.04; t <= 0.96; t += 0.04) { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; pts.push([(a * sx + b * cx + c * ex) * k, (a * sy + b * cy + c * ey) * k]); } });
    const bplaced = [];
    frame.querySelectorAll('.map-badge').forEach(b => { b.style.marginLeft = '0px'; b.style.marginTop = '0px'; const r = b.getBoundingClientRect(); let dx = 0, dy = 0; if (r.left - fr.left < 4) dx = 4 - (r.left - fr.left); if (r.right - fr.left > fr.width - 4) dx = (fr.width - 4) - (r.right - fr.left); let box = [r.left - fr.left + dx, r.top - fr.top, r.right - fr.left + dx, r.bottom - fr.top]; for (let i = 0; i < 6; i++) { const hit = bplaced.find(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]); if (!hit) break; const down = hit[3] - box[1] + 3, up = box[3] - hit[1] + 3; const step = (box[3] + down < fr.height - 4) ? down : -up; dy += step; box = [box[0], box[1] + step, box[2], box[3] + step]; } b.style.marginLeft = `${dx}px`; b.style.marginTop = `${dy}px`; bplaced.push(box); });
    const boxes = [...bplaced];
    frame.querySelectorAll('circle.node,rect.home-node').forEach(c => { const x = +(c.getAttribute('cx') ?? (+c.getAttribute('x') + 6)) * k, y = +(c.getAttribute('cy') ?? (+c.getAttribute('y') + 6)) * k; boxes.push([x - 7, y - 7, x + 7, y + 7]); });
    const placed = [];
    frame.querySelectorAll('.map-label').forEach(el => {
      el.style.transform = 'none'; const w = el.offsetWidth, h = el.offsetHeight, x = +el.dataset.x * k, y = +el.dataset.y * k, g = 11;
      const cands = [[x + g, y - h / 2], [x - g - w, y - h / 2], [x - w / 2, y + g - 2], [x - w / 2, y - g - h + 2], [x + g - 4, y + 4], [x + g - 4, y - h - 4], [x - g - w + 4, y + 4], [x - g - w + 4, y - h - 4]];
      let best = null;
      cands.forEach(([lx, ly], order) => { const box = [lx, ly, lx + w, ly + h]; let s = order * 0.4; s += (Math.max(0, 4 - box[0]) + Math.max(0, box[2] - (fr.width - 4)) + Math.max(0, 4 - box[1]) + Math.max(0, box[3] - (fr.height - 4))) * 20; pts.forEach(([px, py]) => { if (px > box[0] - 2 && px < box[2] + 2 && py > box[1] - 2 && py < box[3] + 2) s += 6; }); [...boxes, ...placed].forEach(b => { const ix = Math.max(0, Math.min(box[2], b[2]) - Math.max(box[0], b[0])), iy = Math.max(0, Math.min(box[3], b[3]) - Math.max(box[1], b[1])); s += ix * iy * 0.25; }); if (!best || s < best.s) best = {s, box}; });
      el.style.left = `${best.box[0]}px`; el.style.top = `${best.box[1]}px`; placed.push(best.box);
    });
  });
};
let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => EP.placeLabels(), 120); });
})();
