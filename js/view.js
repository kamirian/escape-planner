// Escape Planner — draws a plan: destination cards, tabs, route maps, comparison and checks.
// © 2026 Kiyan Amirian. All rights reserved.
(function(){
const EP = window.EP, esc = EP.esc;

// ---------- photos from Wikipedia (Wikimedia Commons images only) ----------
EP.photosOn = true;
const photoCache = new Map();
EP.photo = title => {
  if (!EP.photosOn || !title) return Promise.resolve(null);
  const key = String(title).trim();
  if (photoCache.has(key)) return photoCache.get(key);
  const p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key.replace(/ /g, '_'))}`)
    .then(r => r.ok ? r.json() : null)
    .then(j => {
      const orig = j?.originalimage?.source || '', thumb = j?.thumbnail?.source || '';
      if (!/\/wikipedia\/commons\//.test(orig || thumb)) return null; // skip non-free local images
      const file = decodeURIComponent((orig || thumb).split('/').pop().replace(/^\d+px-/, ''));
      const big = (j.originalimage?.width || 0) > 1280 && /\/thumb\//.test(thumb) ? thumb.replace(/\/\d+px-([^/]+)$/, '/1280px-$1') : (orig || thumb);
      return {thumb: thumb || orig, big, page: j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(key)}`, file: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`, title: j.title || key};
    })
    .catch(() => null);
  photoCache.set(key, p);
  return p;
};
EP.fillPhotos = root => {
  (root || document).querySelectorAll('[data-photo]:not([data-photo-done])').forEach(el => {
    el.setAttribute('data-photo-done', '1');
    EP.photo(el.dataset.photo).then(ph => {
      if (!ph) { el.classList.add('no-photo'); return; }
      const big = el.dataset.size === 'big';
      el.innerHTML = `<img src="${esc(big ? ph.big : ph.thumb)}" alt="${esc(el.dataset.alt || ph.title)}" loading="lazy" decoding="async">${big ? `<a class="photo-credit-chip" href="${esc(ph.file)}" target="_blank" rel="noopener noreferrer">Photo: Wikimedia Commons ↗</a>` : ''}`;
      el.classList.add('has-photo');
    });
  });
};
const initials = s => String(s || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const photoBox = (d, size) => `<span class="photo ${size === 'big' ? 'photo-big' : 'photo-thumb'}" ${EP.photosOn && d.wikipedia ? `data-photo="${esc(d.wikipedia)}"` : ''} data-size="${size}" data-alt="${esc(d.name)}"><span class="photo-fallback" aria-hidden="true">${esc(initials(d.name))}</span></span>`;

// ---------- small renderers ----------
const ext = (url, text, cls = 'button') => { const u = EP.safeUrl(url); return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${text}<span class="ext" aria-hidden="true">↗</span></a>` : ''; };
const srcLink = (s, label = 'Source') => s && EP.safeUrl(s.url) ? `<a class="src" href="${esc(EP.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title || label)} ↗</a>` : '';
const badge = (total, budget) => { const f = EP.fit(total, budget); return f ? `<span class="fit fit-${f.cls}">${f.text}</span>` : ''; };
const para = s => s ? `<p>${esc(s)}</p>` : '';
const peopleCount = t => t.travelers.reduce((n, g) => n + (Number(g.people) || 0), 0) || 2;
const flightSearch = (from, to, start, end, people, oneWay) => `https://www.google.com/travel/flights?q=${encodeURIComponent(`${from} to ${to}${start ? ' ' + start : ''}${!oneWay && end ? ' ' + end : ''} ${people} ${people === 1 ? 'adult' : 'adults'} ${oneWay ? 'one way' : 'round trip'}`)}`;
const staySearch = (place, start, end, people) => `https://www.booking.com/searchresults.html?${new URLSearchParams({ss: place, ...(start ? {checkin: start} : {}), ...(end ? {checkout: end} : {}), group_adults: String(people), no_rooms: '1', group_children: '0'})}`;
const directions = (a, b, mode) => `https://www.google.com/maps/dir/?${new URLSearchParams({api: '1', origin: a, destination: b, travelmode: mode})}`;

// ---------- state ----------
const V = EP.view = {plan: null, dest: null, tab: 'overview', route: {}, checks: [], onChange: null};
const TABS = [['overview', 'Overview'], ['todo', 'Things to do'], ['routes', 'Routes & maps'], ['safety', 'Weather & safety'], ['book', 'Book']];

EP.renderPlan = async (plan, root, {example = false, shared = false} = {}) => {
  V.plan = plan; V.root = root;
  root.innerHTML = `<p class="loading">Loading maps…</p>`;
  try { await EP.loadMapData(); } catch (e) { /* maps are optional */ }
  V.checks = EP.check(plan, window.EP_AIRPORTS);
  if (!plan.destinations.find(d => d.id === V.dest)) V.dest = plan.destinations[0]?.id || null;
  const t = plan.trip, cur = t.currency;
  const nights = t.nights ? `${t.nights} nights` : '';
  const when = t.start_date && t.end_date ? `${EP.date(t.start_date, {month: 'short', day: 'numeric', year: 'numeric'})} – ${EP.date(t.end_date, {month: 'short', day: 'numeric', year: 'numeric'})}` : '';
  const warn = V.checks.filter(c => c.level !== 'info').length;
  root.innerHTML = `
  ${example ? `<p class="banner">This is an example. The places are real, but the prices, dates and details are made up to show how the page works. <a href="#/plan">Plan your own trip</a> for real suggestions.</p>` : ''}
  ${shared ? `<p class="banner">You opened a shared plan. It lives only in the link and in your browser. <button type="button" class="linklike" data-act="save">Save a copy on this device</button></p>` : ''}
  <section class="plan-intro">
    <h1>${esc(t.title || 'Your trip options')}</h1>
    <ul class="trip-facts">
      ${when ? `<li><b>${esc(when)}</b>${esc(nights)}</li>` : nights ? `<li><b>${esc(nights)}</b></li>` : ''}
      ${t.travelers.map(g => `<li><b>${esc(g.people || '?')} ${Number(g.people) === 1 ? 'traveler' : 'travelers'}</b>from ${esc(g.from || '?')}${(g.airports || []).length ? ` (${esc(g.airports.join(', '))})` : ''}</li>`).join('')}
      ${t.budget && t.budget.max ? `<li><b>${t.budget.min ? EP.money(t.budget.min, cur) + '–' : 'up to '}${EP.money(t.budget.max, cur)}</b>${esc(t.budget.covers || 'budget')}</li>` : ''}
    </ul>
    <p class="trip-note">Every cost here is a planning estimate from an AI, not a live quote.${t.researched_on ? ` The AI says it checked sources on ${esc(EP.date(t.researched_on, {month: 'long', day: 'numeric', year: 'numeric'}))}.` : ' The plan doesn’t say when sources were checked.'} Confirm prices, entry rules and advisories before you book. <a href="#how-numbers" data-scroll="how-numbers">How to read the numbers</a></p>
    ${V.checks.length ? `<details class="checks"${warn ? ' open' : ''}><summary>${warn ? `${warn} thing${warn > 1 ? 's' : ''} to double-check` : 'Notes on this plan'} <span class="count">${V.checks.length}</span></summary><ul>${V.checks.map(c => `<li class="check-${c.level}"><b>${esc(c.where)}:</b> ${esc(c.text)}</li>`).join('')}</ul></details>` : ''}
  </section>
  <section class="picker" aria-labelledby="pick-title">
    <div class="section-head"><h2 id="pick-title">Your options</h2>
    ${t.budget && t.budget.max ? `<div class="fit-key"><p>Totals compare with your ${t.budget.min ? EP.money(t.budget.min, cur) + '–' : ''}${EP.money(t.budget.max, cur)} budget:</p><ul><li><span class="fit fit-within">Within budget</span> the whole range fits</li><li><span class="fit fit-low">Only at the low end</span> only the cheaper end fits</li><li><span class="fit fit-above">Above budget</span> even the low end is over</li></ul></div>` : ''}</div>
    <div class="picker-grid">
      <nav class="dest-grid" aria-label="Destinations">${plan.destinations.map(d => { const tot = EP.destTotal(d); return `<button type="button" class="dest-card" data-dest="${esc(d.id)}" aria-current="${d.id === V.dest}">${photoBox(d, 'thumb')}<span class="dest-text"><strong>${esc(d.name)}</strong><small>${esc([d.country, d.area].filter(Boolean).join(' · '))}</small>${d.tagline ? `<span class="dest-tag">${esc(d.tagline)}</span>` : ''}<span class="dest-meta">${d.weather && typeof d.weather.high === 'number' ? `<span>${esc(EP.temp(d.weather.high, d.weather.unit))}</span>` : ''}${d.entry?.status ? `<span>${esc(d.entry.status)}</span>` : ''}</span><span class="dest-cost-row"><span class="dest-cost">${tot ? EP.range(tot, cur) : 'No estimate'}</span>${badge(tot, t.budget)}</span></span></button>`; }).join('')}</nav>
      ${EP.overviewFigure(plan)}
    </div>
  </section>
  <section id="planner" class="planner" aria-live="polite"></section>
  <section class="compare" aria-labelledby="compare-title">
    <div class="section-head"><h2 id="compare-title">Side by side</h2><p>All amounts ${esc(cur)}${t.budget?.covers ? `, for ${esc(t.budget.covers)}` : ''}. Select a name to open it.</p></div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Cost comparison, scrolls sideways on small screens"><table><thead><tr><th scope="col">Destination</th><th scope="col">Typical high</th><th scope="col">Entry</th><th scope="col">Flights</th><th scope="col">Lodging</th><th scope="col">Everything else</th><th scope="col">Total</th>${t.budget?.max ? '<th scope="col">Against budget</th>' : ''}</tr></thead><tbody>${plan.destinations.map(d => { const tot = EP.destTotal(d); return `<tr><th scope="row"><button type="button" class="linklike" data-dest="${esc(d.id)}" data-scroll="planner">${esc(d.name)}</button></th><td>${d.weather && typeof d.weather.high === 'number' ? esc(EP.temp(d.weather.high, d.weather.unit)) : '—'}</td><td>${esc(d.entry?.status || '—')}</td><td>${EP.range(d.costs.flights, cur)}</td><td>${EP.range(d.costs.lodging, cur)}</td><td>${EP.range(d.costs.other, cur)}</td><td class="total-cell">${tot ? EP.range(tot, cur) : '—'}</td>${t.budget?.max ? `<td>${badge(tot, t.budget)}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>
  </section>
  <section id="how-numbers" class="numbers" aria-labelledby="numbers-title">
    <div class="section-head"><h2 id="numbers-title">How to read the numbers</h2></div>
    <div class="numbers-grid">
      <div><h3>Where they come from</h3><p>Everything in a plan comes from the AI that wrote it. This site doesn’t look up prices; it only draws, adds up and checks what the AI said.</p>${t.assumptions?.length ? `<p><b>The AI’s assumptions:</b></p><ul>${t.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}</div>
      <div><h3>What the site checks</h3><p>It adds up each cost range, compares stop nights with the trip length, checks airport codes against a list of ${window.EP_AIRPORTS ? EP.num(Object.keys(window.EP_AIRPORTS).length) : "known"} airports, and flags places whose coordinates are far from their airport. See “things to double-check” at the top.</p></div>
      <div><h3>How the maps work</h3><p>Maps are schematic. Distances are straight-line (great-circle) between airports for flights and between towns for other travel; roads are longer. Flying times are a rule-of-thumb estimate (30 minutes plus 1 hour per 500 miles, nonstop) and leave out connections. Other travel times are the AI’s.</p></div>
      <div><h3>Before you book</h3><p>Search links open live results for your dates; they are not reserved fares or rooms. Confirm visa and entry rules with official sources for each traveler’s passport.</p></div>
    </div>
  </section>`;
  bindPlan();
  if (V.dest) selectDest(V.dest, {keepTab: true});
  EP.fillPhotos(root);
  requestAnimationFrame(() => EP.placeLabels(root));
};

function bindPlan() {
  if (V.root._epBound) return; V.root._epBound = true;
  V.root.addEventListener('click', onClick);
}
function onClick(e) {
  const d = e.target.closest('[data-dest],[data-pick]');
  if (d && V.root.contains(d)) { selectDest(d.dataset.dest || d.dataset.pick, {scroll: true}); return; }
  const tab = e.target.closest('[data-tab]'); if (tab) { showTab(tab.dataset.tab, true); return; }
  const r = e.target.closest('[data-route]'); if (r) { V.route[V.dest] = +r.dataset.route; renderRoute(); V.onChange?.(); return; }
  const g = e.target.closest('[data-goto-tab]'); if (g) { showTab(g.dataset.gotoTab, true); return; }
  const s = e.target.closest('[data-scroll]'); if (s && !s.dataset.dest) { e.preventDefault(); document.getElementById(s.dataset.scroll)?.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }
}
const cur = () => V.plan.trip.currency;
const D = () => V.plan.destinations.find(x => x.id === V.dest);

function selectDest(id, {scroll = false, keepTab = false} = {}) {
  const d = V.plan.destinations.find(x => x.id === id) || V.plan.destinations[0]; if (!d) return;
  V.dest = d.id; if (!keepTab && !TABS.some(([k]) => k === V.tab)) V.tab = 'overview';
  V.root.querySelectorAll('.dest-card').forEach(b => b.setAttribute('aria-current', String(b.dataset.dest === d.id)));
  const t = V.plan.trip, tot = EP.destTotal(d);
  const counts = {todo: d.activities.length, routes: d.routes.length};
  V.root.querySelector('#planner').innerHTML = `
  <div class="dest-head">
    ${photoBox(d, 'big')}
    <div class="summary">
      ${d.tagline ? `<p class="tag">${esc(d.tagline)}</p>` : ''}
      <h2>${esc(d.name)}</h2>
      <p class="country">${esc([d.area, d.country].filter(Boolean).join(' · '))}</p>
      ${d.summary ? `<p class="intro-text">${esc(d.summary)}</p>` : ''}
      <dl class="facts">
        ${d.weather ? `<div><dt>Typical weather for your dates</dt><dd><strong>${typeof d.weather.high === 'number' ? esc(EP.temp(d.weather.high, d.weather.unit)) + ' high' : '—'}${typeof d.weather.low === 'number' ? `, ${esc(EP.temp(d.weather.low, d.weather.unit))} low` : ''}</strong><small>Historical average, not a forecast. ${srcLink(d.weather.source, 'Climate source')}</small></dd></div>` : ''}
        ${d.entry ? `<div><dt>Entry for your group</dt><dd><strong>${esc(d.entry.status || '—')}</strong></dd></div>` : ''}
        <div><dt>Estimated total</dt><dd><strong>${tot ? EP.range(tot, cur()) : 'No estimate'}</strong>${badge(tot, t.budget)}<small>${esc(t.budget?.covers ? 'For ' + t.budget.covers + '. ' : '')}Planning estimate, not a quote.</small></dd></div>
      </dl>
    </div>
  </div>
  <div class="tabbar" role="tablist" aria-label="${esc(d.name)} sections">${TABS.map(([k, label]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="tabpanel" data-tab="${k}" aria-selected="false" tabindex="-1">${label}${counts[k] ? ` <span class="count">${counts[k]}</span>` : ''}</button>`).join('')}</div>
  <div id="tabpanel" class="tabpanel" role="tabpanel" tabindex="0"></div>`;
  const tabs = [...V.root.querySelectorAll('[role=tab]')];
  tabs.forEach((b, i) => b.addEventListener('keydown', e => { let n; if (e.key === 'ArrowRight') n = (i + 1) % tabs.length; if (e.key === 'ArrowLeft') n = (i + tabs.length - 1) % tabs.length; if (e.key === 'Home') n = 0; if (e.key === 'End') n = tabs.length - 1; if (n !== undefined) { e.preventDefault(); showTab(tabs[n].dataset.tab); tabs[n].focus(); } }));
  showTab(V.tab);
  EP.fillPhotos(V.root.querySelector('#planner'));
  if (scroll) V.root.querySelector('#planner').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  V.onChange?.();
}

function showTab(k, user = false) {
  const d = D(); V.tab = k;
  V.root.querySelectorAll('[role=tab]').forEach(b => { const on = b.dataset.tab === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  const panel = V.root.querySelector('#tabpanel'); panel.setAttribute('aria-labelledby', `tab-${k}`);
  panel.innerHTML = ({overview, todo, routes, safety, book})[k](d);
  if (k === 'routes') renderRoute();
  if (user) { const bar = V.root.querySelector('.tabbar'); if (bar.getBoundingClientRect().top < 0) bar.scrollIntoView({block: 'start'}); }
  V.onChange?.();
}

function overview(d) {
  const why = Array.isArray(d.why) ? d.why.filter(Boolean) : [];
  return `<div class="panel-grid">
    ${d.tradeoffs ? `<section class="block"><h3>The tradeoffs</h3>${para(d.tradeoffs)}</section>` : ''}
    ${d.entry ? `<section class="block"><h3>Visa &amp; entry</h3><p><b>${esc(d.entry.status || '')}</b></p>${para(d.entry.details)}${d.entry.source ? `<p class="block-link">${srcLink(d.entry.source, 'Official entry guidance')}</p>` : ''}</section>` : ''}
    ${why.length ? `<section class="block"><h3>Why it fits</h3><ul>${why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></section>` : ''}
    ${d.stay ? `<section class="block"><h3>Where to stay</h3>${para(d.stay.area)}${para(d.stay.suggestion)}${d.stay.url ? `<p class="block-link">${ext(d.stay.url, 'Example stay', 'src')}</p>` : ''}</section>` : ''}
  </div>
  ${d.food ? `<section class="block block-wide"><h3>Food</h3>${para(d.food.summary)}${Array.isArray(d.food.try) && d.food.try.length ? `<ul class="chips">${d.food.try.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</section>` : ''}
  ${d.sources.length ? `<section class="block block-wide"><h3>Sources the AI cited</h3><ul class="sources">${d.sources.map(s => `<li>${EP.safeUrl(s.url) ? `<a href="${esc(EP.safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)} ↗</a>` : esc(s.title || '')}${s.checked_on ? ` <span class="small">checked ${esc(EP.date(s.checked_on, {month: 'short', day: 'numeric', year: 'numeric'}))}</span>` : ''}</li>`).join('')}</ul></section>` : ''}`;
}
function todo(d) {
  if (!d.activities.length) return `<p class="panel-lead">The plan has no activities for ${esc(d.name)}.</p>`;
  return `<p class="panel-lead">${d.activities.length} ideas. Prices are what the AI found; check them for your dates.</p><div class="activity-grid">${d.activities.map(a => `<article class="activity"><h3>${esc(a.name)}</h3>${para(a.description)}${a.price ? `<p class="activity-price">${esc(a.price)}</p>` : ''}<div class="activity-links">${ext(a.url, 'Details &amp; current price', 'button small-button')}</div></article>`).join('')}</div>`;
}
function safety(d) {
  const s = d.safety || {}; const w = d.weather || {};
  return `<div class="panel-grid">
    <section class="block"><h3>Weather for your dates</h3>${para(w.summary)}${typeof w.high === 'number' ? `<p>Typical high ${esc(EP.temp(w.high, w.unit))}${typeof w.low === 'number' ? `, low ${esc(EP.temp(w.low, w.unit))}` : ''}.</p>` : ''}<p class="small">Historical averages, not a forecast. ${srcLink(w.source, 'Climate source')}</p></section>
    <section class="block"><h3>Weather risks</h3>${para(s.weather_risks) || '<p class="small">Not covered by this plan.</p>'}</section>
    <section class="block"><h3>Travel advisory</h3>${para(s.advisory) || '<p class="small">Not covered by this plan.</p>'}</section>
    <section class="block"><h3>How to plan</h3>${para(s.tips) || '<p class="small">Not covered by this plan.</p>'}</section>
  </div>
  ${Array.isArray(s.sources) && s.sources.some(x => EP.safeUrl(x.url)) ? `<div class="link-row">${s.sources.map(x => ext(x.url, esc(x.title || 'Source'), 'button small-button')).join('')}</div>` : ''}
  <p class="fine">Check advisories again before paying for anything nonrefundable, and check forecasts a week before you go.</p>`;
}
function book(d) {
  const t = V.plan.trip, people = peopleCount(t), tot = EP.destTotal(d);
  const home = EP.airport((t.travelers[0]?.airports || [])[0]), there = EP.airport(d.airport);
  const groups = t.travelers.length ? t.travelers : [{people, from: '', airports: []}];
  return `<div class="panel-grid">
    <section class="block"><h3>Flights</h3><p class="price-line">${EP.range(d.costs.flights, cur())}</p>${home && there ? `<p class="small">${esc(home.code)} to ${esc(there.code)}: ${EP.distanceBoth(EP.miles(home, there))} straight-line, roughly ${EP.fmtMinutes(EP.flightMinutes(EP.miles(home, there)))} in the air if nonstop (estimate; connections add time).</p>` : ''}
      <div class="link-row">${groups.map((g, i) => ext(flightSearch((g.airports || []).join(' ') || g.from || 'home', d.airport || d.name, t.start_date, t.end_date, Number(g.people) || 1), `Search flights${groups.length > 1 ? ` from ${esc(g.from || 'group ' + (i + 1))}` : ''}`, i ? 'button' : 'button primary')).join('')}</div></section>
    <section class="block"><h3>A place to stay</h3><p class="price-line">${EP.range(d.costs.lodging, cur())}</p>${para(d.stay?.area)}${para(d.stay?.suggestion)}<div class="link-row">${ext(staySearch(`${d.stay?.area || d.area || d.name}, ${d.country || ''}`, t.start_date, t.end_date, people), 'Search stays for your dates', 'button primary')}${ext(d.stay?.url, 'Example stay')}</div></section>
  </div>
  <section class="block block-wide totals"><h3>Estimated total</h3><p class="price-line">${tot ? EP.range(tot, cur()) : 'No estimate'} ${badge(tot, t.budget)}</p><p>Flights ${EP.range(d.costs.flights, cur())} + lodging ${EP.range(d.costs.lodging, cur())} + everything else ${EP.range(d.costs.other, cur())}.${d.costs.notes ? ' ' + esc(d.costs.notes) : ''}</p></section>`;
}
function routes(d) {
  const t = V.plan.trip, sel = V.route[d.id] ?? (d.routes.length ? 1 : 0), tot = EP.destTotal(d);
  return `${d.routes.length ? '<p class="panel-lead">Compare staying in one place with the multi-stop routes the AI suggested.</p>' : ''}
  <div class="route-options" role="group" aria-label="Route options">
    <button type="button" class="route-option" data-route="0" aria-pressed="${sel === 0}"><strong>One base</strong><small>Stay in ${esc(d.area || d.name)}</small><span class="route-cost">${tot ? EP.range(tot, cur()) : 'No estimate'}</span>${badge(tot, t.budget)}</button>
    ${d.routes.map((r, i) => { const rt = EP.routeTotal(r); return `<button type="button" class="route-option" data-route="${i + 1}" aria-pressed="${sel === i + 1}"><strong>${esc(r.title || 'Route ' + (i + 1))}</strong>${r.tag ? `<small>${esc(r.tag)}</small>` : ''}<span class="route-cost">${rt ? EP.range(rt, cur()) : 'No estimate'}</span>${badge(rt, t.budget)}</button>`; }).join('')}
  </div>
  <div id="route-detail"></div>`;
}

function legItems(plan, d, data) {
  const t = plan.trip;
  return `<ol class="legs">${data.legs.map(l => {
    let link = '';
    if (l.mode === 'flight' && l.codes && l.codes[0] && l.codes[1]) link = ext(flightSearch(l.codes[0], l.codes[1], l.date, '', peopleCount(t), true), `Search ${esc(l.codes[0])} to ${esc(l.codes[1])}${l.date ? ' · ' + esc(EP.date(l.date)) : ''}`, 'button small-button');
    else if (['drive', 'rail', 'bus', 'ferry'].includes(l.mode)) link = ext(directions(`${l.from}, ${d.country || ''}`, `${l.to}, ${d.country || ''}`, l.mode === 'drive' ? 'driving' : 'transit'), l.mode === 'drive' ? 'Driving directions' : 'Directions', 'button small-button');
    const time = l.min ? `Roughly ${EP.fmtMinutes(l.min)} in the air if nonstop (estimate)` : (l.duration ? `Time from the plan: ${esc(l.duration)}` : 'Time not given in the plan');
    return `<li class="leg-item li-${l.kind === 'home' ? 'flight' : l.mode}"><span class="leg-num" aria-hidden="true">${l.n}</span><div><p class="leg-route">${EP.icon(l.kind === 'home' ? 'flight' : l.mode)}<span class="sr">${EP.MODE[l.mode] || 'Travel'}: </span>${esc(l.from)} → ${esc(l.to)}</p><p class="leg-meta">${l.date ? `<span>${esc(EP.date(l.date))}</span>` : ''}<span>${EP.distanceBoth(l.mi)}${l.straight ? ' straight-line' : ''}</span><span>${time}</span></p>${l.note ? `<p class="leg-note">${esc(l.note)}</p>` : ''}<div class="leg-links">${link}</div></div></li>`;
  }).join('')}</ol>`;
}

function renderRoute() {
  const d = D(), plan = V.plan, t = plan.trip, box = V.root.querySelector('#route-detail'); if (!box) return;
  const i = V.route[d.id] ?? (d.routes.length ? 1 : 0);
  V.root.querySelectorAll('.route-option').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.route === i)));
  const r = i > 0 ? d.routes[i - 1] : null;
  let data = null; try { data = window.d3 ? EP.routeLegs(plan, d, r) : null; } catch (e) { data = null; }
  const map = data && data.nodes.length ? EP.mapFigure(data, {uid: `${d.id}-${i}`}) : '';
  if (!r) {
    box.innerHTML = `<div class="route-head"><div><h3>One base: ${esc(d.area || d.name)}</h3><p>${t.nights ? `${t.nights} nights in one place. ` : ''}No extra flights or hotel moves.</p></div></div>${map || data ? `<div class="route-map-grid">${map}<div class="legs-box"><h4>Getting there</h4>${data ? legItems(plan, d, data) : ''}</div></div>` : ''}`;
  } else {
    const rt = EP.routeTotal(r), stops = r.stops, dates = data?.stopDates || [];
    const bd = Array.isArray(r.costs.breakdown) ? r.costs.breakdown.filter(b => EP.isRange(b.range)) : [];
    box.innerHTML = `<div class="route-head"><div>${r.tag ? `<p class="route-tag"><span class="tag">${esc(r.tag)}</span></p>` : ''}<h3>${esc(r.title || 'Route')}</h3><p>${stops.reduce((n, s) => n + s.nights, 0)} nights · ${stops.map(s => `${s.nights} in ${esc(s.name)}`).join(' / ')}</p>${para(r.summary)}</div><div class="route-total"><span>Estimated total</span><strong>${rt ? EP.range(rt, cur()) : 'No estimate'}</strong>${badge(rt, t.budget)}</div></div>
    ${map || data ? `<div class="route-map-grid">${map}<div class="legs-box"><h4>Getting around</h4>${data ? legItems(plan, d, data) : ''}</div></div>` : ''}
    <h4 class="sub-head">Where you stay</h4>
    <ol class="stops">${stops.map((s, j) => `<li class="stop"><p class="stop-dates">${dates[j]?.start && dates[j]?.end && dates[j].start !== dates[j].end ? `${esc(EP.date(dates[j].start))} – ${esc(EP.date(dates[j].end))} · ` : ''}${s.nights} night${s.nights === 1 ? '' : 's'}</p><h5>${esc(s.name)}</h5>${Array.isArray(s.highlights) && s.highlights.filter(Boolean).length ? `<ul>${s.highlights.filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<div class="link-row">${ext(staySearch(`${s.name}, ${d.country || ''}`, dates[j]?.start, dates[j]?.end, peopleCount(t)), 'Search stays for these dates', 'button small-button')}</div></li>`).join('')}</ol>
    <div class="route-bottom">
      <section class="cost-box"><h4>Rough budget</h4>${bd.length || rt ? `<dl class="cost-list">${bd.map(b => `<div><dt>${esc(b.label || 'Item')}</dt><dd>${EP.range(b.range, cur())}</dd></div>`).join('')}<div class="cost-total"><dt>Estimated total</dt><dd>${rt ? EP.range(rt, cur()) : '—'}</dd></div></dl>` : '<p class="small">No cost estimate for this route.</p>'}<p class="fine">Amounts in ${esc(cur())}${t.budget?.covers ? ` for ${esc(t.budget.covers)}` : ''}. Planning estimates from the AI, not quotes.</p></section>
      <div class="route-notes">
        ${r.tradeoffs ? `<details class="more" open><summary>The tradeoff</summary>${para(r.tradeoffs)}</details>` : ''}
        ${r.entry ? `<details class="more"><summary>Entry &amp; documents</summary>${para(r.entry)}</details>` : ''}
        ${r.safety ? `<details class="more"><summary>Weather &amp; warnings for added stops</summary>${para(r.safety)}</details>` : ''}
      </div>
    </div>`;
  }
  requestAnimationFrame(() => EP.placeLabels(box));
}
EP.viewState = () => ({dest: V.dest, tab: V.tab, route: V.route[V.dest]});
EP.setViewState = s => { if (s.dest) V.dest = s.dest; if (s.tab && TABS.some(([k]) => k === s.tab)) V.tab = s.tab; if (s.dest && typeof s.route === 'number') V.route[s.dest] = s.route; };
})();
