// Escape Planner — core: formatting, the plan format, prompt builder, parsing and checks.
// © 2026 Kiyan Amirian. All rights reserved.
(function(){
const EP = window.EP = window.EP || {};
EP.FORMAT = 'escape-planner/1';

// ---------- small helpers ----------
EP.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
EP.num = n => new Intl.NumberFormat('en-US').format(Math.round(n));
EP.isRange = r => Array.isArray(r) && r.length === 2 && r.every(v => typeof v === 'number' && isFinite(v));
EP.money = (n, cur='USD') => { try { return new Intl.NumberFormat('en-US',{style:'currency',currency:cur,maximumFractionDigits:0}).format(n); } catch { return `${cur} ${EP.num(n)}`; } };
EP.range = (r, cur) => EP.isRange(r) ? `${EP.money(r[0],cur)}–${EP.money(r[1],cur)}` : '—';
EP.sumRanges = rs => rs.filter(EP.isRange).reduce((a,r)=>[a[0]+r[0],a[1]+r[1]],[0,0]);
EP.safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u.trim())) ? u.trim() : '';
EP.slug = s => String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'item';
EP.date = (iso, opts={month:'short',day:'numeric'}) => { if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||'')) return iso||''; return new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{...opts,timeZone:'UTC'}); };
EP.addDays = (iso, n) => { const d = new Date(iso+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
EP.nightsBetween = (a,b) => (/^\d{4}-\d{2}-\d{2}$/.test(a||'') && /^\d{4}-\d{2}-\d{2}$/.test(b||'')) ? Math.round((new Date(b+'T12:00:00Z') - new Date(a+'T12:00:00Z'))/864e5) : null;
EP.today = () => new Date().toISOString().slice(0,10);

// distances and rough flying time
EP.miles = (a, b) => { const R=3958.8, rad=x=>x*Math.PI/180; const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon); const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
EP.units = 'mi';
EP.distance = mi => EP.units === 'km' ? `${EP.num(mi * 1.609344)} km` : `${EP.num(mi)} mi`;
EP.distanceBoth = mi => EP.units === 'km' ? `${EP.num(mi * 1.609344)} km / ${EP.num(mi)} mi` : `${EP.num(mi)} mi / ${EP.num(mi * 1.609344)} km`;
EP.flightMinutes = mi => Math.round((30 + mi/500*60)/5)*5; // rule of thumb: 30 min + 1 h per 500 miles
EP.fmtMinutes = m => m < 60 ? `${m} min` : `${Math.floor(m/60)} h${m%60 ? ` ${m%60} min` : ''}`;
EP.temp = (v, unit) => { if (typeof v !== 'number') return ''; const u=(unit||'C').toUpperCase().startsWith('F')?'F':'C'; const c=u==='C'?v:(v-32)*5/9, f=u==='F'?v:v*9/5+32; return `${Math.round(f)}°F / ${Math.round(c)}°C`; };

// budget fit: same rule as the Christmas planner
EP.fit = (total, budget) => {
  if (!EP.isRange(total) || !budget || typeof budget.max !== 'number') return null;
  if (total[0] > budget.max) return {cls:'above', text:'Above budget'};
  if (total[1] > budget.max) return {cls:'low', text:'Only at the low end'};
  return {cls:'within', text:'Within budget'};
};

// ---------- the brief → prompt ----------
EP.PRIORITIES = ['Relaxing','Beaches','Warm weather','Mild weather','Good food','Culture & history','Nature & hiking','Wildlife','Adventure','Nightlife','Shopping','Family-friendly','Little walking','Off the beaten path','Winter sports','Festivals & holidays'];

EP.skeleton = () => ({
  format: EP.FORMAT,
  trip: {
    title: 'short trip name',
    start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD', nights: 7,
    currency: 'USD',
    budget: {min: 0, max: 0, covers: 'who the budget pays for, e.g. 3 travelers from Washington, DC'},
    travelers: [{label: 'Main group', people: 2, from: 'city', airports: ['IATA']}],
    priorities: ['...'],
    researched_on: 'YYYY-MM-DD (the day you checked sources)',
    assumptions: ['short assumption used for all costs']
  },
  destinations: [{
    id: 'kebab-case-id',
    name: 'Place name', country: 'Country', area: 'region or base town',
    tagline: 'one line: what this option is best for',
    summary: '2–3 sentences',
    lat: 0.0, lon: 0.0, airport: 'IATA',
    wikipedia: 'Exact English Wikipedia article title for a photo, e.g. Lisbon',
    weather: {high: 0, low: 0, unit: 'C or F', summary: 'typical weather for these dates (historical, not a forecast)', source: {title: '', url: ''}},
    entry: {status: 'e.g. No visa needed / eVisa / Visa required', details: 'for the passports given', source: {title: '', url: ''}},
    costs: {flights: [0, 0], lodging: [0, 0], other: [0, 0], total: [0, 0], notes: 'what is included; say which prices you could not verify'},
    activities: [{name: '', description: '', price: 'price text with date checked, or "check current price"', url: ''}],
    food: {summary: '', try: ['dish or place']},
    stay: {area: 'where to stay', suggestion: 'type of lodging or an example', url: ''},
    tradeoffs: 'honest downsides for these dates',
    safety: {weather_risks: '', advisory: 'current official advisory level with its date', tips: '', sources: [{title: '', url: ''}]},
    routes: [{
      title: 'Base + second stop', tag: 'what this route is best for', summary: '',
      stops: [{name: 'Stop name', lat: 0.0, lon: 0.0, airport: 'IATA or empty', nights: 0, highlights: ['']}],
      legs: [{from: 'Stop name', to: 'Stop name', mode: 'flight | drive | train | bus | ferry', from_airport: 'IATA if flight', to_airport: 'IATA if flight', duration: 'e.g. 2–3 h', note: ''}],
      costs: {total: [0, 0], breakdown: [{label: 'Flights', range: [0, 0]}, {label: 'Lodging', range: [0, 0]}, {label: 'Ground transport', range: [0, 0]}, {label: 'Food & activities', range: [0, 0]}]},
      tradeoffs: '', entry: 'extra entry rules for added countries, if any', safety: ''
    }],
    sources: [{title: '', url: '', checked_on: 'YYYY-MM-DD'}]
  }]
});

EP.briefLines = b => {
  const L = [];
  const nights = EP.nightsBetween(b.start, b.end);
  if (b.title) L.push(`Trip name: ${b.title}`);
  if (b.start && b.end) L.push(`Dates: ${b.start} to ${b.end}${nights?` (${nights} nights)`:''}${b.flex?`; flexible by about ${b.flex} days`:''}`);
  else if (b.when) L.push(`When: ${b.when}`);
  (b.groups||[]).filter(g=>g.from||g.people).forEach((g,i)=>L.push(`Travelers${(b.groups.length>1)?` (group ${i+1}${g.label?`, ${g.label}`:''})`:''}: ${g.people||'?'} ${Number(g.people)===1?'person':'people'} from ${g.from||'(departure city not given)'}${g.separate?'; pays separately (not part of the budget)':''}`));
  if (b.budgetMax) L.push(`Budget: ${b.currency||'USD'} ${b.budgetMin?EP.num(b.budgetMin)+'–':''}${EP.num(b.budgetMax)} in total${b.budgetCovers?` for ${b.budgetCovers}`:''}`);
  if (b.lodging) L.push(`Lodging: ${b.lodging}`);
  if (b.passports) L.push(`Passports / residency (use for visa and entry rules): ${b.passports}`);
  if ((b.priorities||[]).length) L.push(`What matters most: ${b.priorities.join(', ')}`);
  if (b.tempMin || b.tempMax) L.push(`Preferred daytime highs: ${b.tempMin||'?'}–${b.tempMax||'?'} °${b.tempUnit||'F'}`);
  if (b.include) L.push(`Places or regions to consider: ${b.include}`);
  if (b.exclude) L.push(`Places to leave out: ${b.exclude}`);
  if (b.maxFlight) L.push(`Longest flight we would accept: about ${b.maxFlight} hours`);
  L.push(`Trip style: ${b.stops>1?`single-base options, plus multi-stop routes with up to ${b.stops} stops`:'one base per destination (no multi-stop routes needed)'}`);
  if (b.notes) L.push(`Other notes: ${b.notes}`);
  return L;
};

EP.buildPrompt = b => {
  const n = Math.max(2, Math.min(10, Number(b.count)||5));
  const nights = EP.nightsBetween(b.start, b.end);
  const cur = b.currency || 'USD';
  return `You are helping me choose a trip destination. Research ${n} destination options that fit the brief below, then answer with ONE JSON object in the exact format at the end. Reply with the JSON only.

TRIP BRIEF
${EP.briefLines(b).map(l=>'- '+l).join('\n')}

HOW TO RESEARCH
1. Use web search if you have it. Prices, entry/visa rules, travel advisories, opening dates and timetables change, so check current sources and put the date you checked in "researched_on" and in each source's "checked_on".
2. Give money as [low, high] ranges in ${cur}, for exactly who the budget covers. If you could not verify a price, still give your best range, and say so in the "notes" field. Never present an estimate as a quote.
3. For every destination, costs.total must equal flights + lodging + other (low with low, high with high). For routes, costs.total must equal the sum of the breakdown.
4. Entry rules must be for the passports/residency in the brief, with an official source link.
5. Weather is typical (historical) for these dates, not a forecast. Give the unit.
6. Coordinates in decimal degrees. Airports as 3-letter IATA codes. List every traveler group in trip.travelers with its home airports. For "wikipedia", give the exact English Wikipedia article title of the place.
${b.stops>1?`7. For each destination, add 0–3 "routes" that combine it with nearby places (up to ${b.stops} stops). ${nights?`Stop nights must add up to ${nights}, or explain the difference in the route's "tradeoffs" (for example an overnight flight). `:''}List every leg between stops with its mode.`:`7. Leave "routes" as an empty list.`}
8. Prefer official sources (governments, tourism boards, operators). Don't invent links; leave "url" empty if unsure.
9. Keep text short and practical. Be honest about downsides.

FORMAT (replace every placeholder; repeat objects as needed; no comments, no trailing commas)
${JSON.stringify(EP.skeleton(), null, 1)}
`;
};

EP.buildRefinePrompt = (plan, request) => `Here is a trip plan in JSON (format "${EP.FORMAT}"). Update it with this change request:

"${request}"

Keep everything that doesn't need to change. Re-check any facts you change (use web search if you have it) and update "researched_on". Keep costs.total equal to the sum of its parts. Reply with the full updated JSON only, in the same format.

${JSON.stringify(plan)}
`;

// ---------- parsing ----------
// Pull the first JSON object out of an AI reply (handles code fences and surrounding text).
EP.extractJson = text => {
  if (typeof text !== 'string') throw new Error('Nothing to read.');
  let t = text.trim().replace(/^﻿/, '');
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].includes('{')) t = fence[1];
  const start = t.indexOf('{');
  if (start < 0) throw new Error('No JSON object found. Paste the AI’s whole answer, starting with “{”.');
  // walk to the matching closing brace, respecting strings
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('The JSON looks cut off (no closing “}”). The AI may have stopped early — ask it to “continue” or to answer again with shorter text.');
  let body = t.slice(start, end + 1);
  try { return JSON.parse(body); } catch (e1) {
    // common AI slips: trailing commas, smart quotes around keys
    const fixed = body.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
    try { return JSON.parse(fixed); } catch (e2) {
      const m = String(e1.message).match(/position (\d+)/);
      let where = '';
      if (m) { const p = +m[1]; const line = body.slice(0, p).split('\n').length; where = ` near line ${line}: “${body.slice(Math.max(0,p-40), p+40).replace(/\s+/g,' ')}”`; }
      throw new Error(`The JSON has a syntax error${where}. Ask the AI to “return valid JSON only”.`);
    }
  }
};

// Light normalisation so small format differences still display.
EP.normalize = raw => {
  const plan = (raw && typeof raw === 'object') ? raw : {};
  if (Array.isArray(plan)) return EP.normalize({destinations: plan});
  plan.trip = plan.trip && typeof plan.trip === 'object' ? plan.trip : {};
  const t = plan.trip;
  if (!t.nights) { const n = EP.nightsBetween(t.start_date, t.end_date); if (n) t.nights = n; }
  t.currency = (typeof t.currency === 'string' && /^[A-Z]{3}$/.test(t.currency.trim().toUpperCase())) ? t.currency.trim().toUpperCase() : 'USD';
  t.travelers = Array.isArray(t.travelers) ? t.travelers : [];
  plan.destinations = (Array.isArray(plan.destinations) ? plan.destinations : []).filter(d => d && typeof d === 'object' && d.name);
  const seen = new Set();
  plan.destinations.forEach(d => {
    let id = EP.slug(d.id || d.name); while (seen.has(id)) id += '-2'; seen.add(id); d.id = id;
    d.costs = d.costs && typeof d.costs === 'object' ? d.costs : {};
    d.activities = Array.isArray(d.activities) ? d.activities.filter(a => a && a.name) : [];
    d.routes = Array.isArray(d.routes) ? d.routes.filter(r => r && Array.isArray(r.stops) && r.stops.length) : [];
    d.sources = Array.isArray(d.sources) ? d.sources : [];
    d.routes.forEach(r => { r.legs = Array.isArray(r.legs) ? r.legs : []; r.costs = r.costs && typeof r.costs === 'object' ? r.costs : {}; r.stops.forEach(s => { s.nights = Number(s.nights) || 0; }); });
  });
  return plan;
};

EP.destTotal = d => EP.isRange(d.costs.total) ? d.costs.total : (['flights','lodging','other'].some(k => EP.isRange(d.costs[k])) ? EP.sumRanges([d.costs.flights, d.costs.lodging, d.costs.other]) : null);
EP.routeTotal = r => EP.isRange(r.costs.total) ? r.costs.total : (Array.isArray(r.costs.breakdown) && r.costs.breakdown.some(b => EP.isRange(b.range)) ? EP.sumRanges(r.costs.breakdown.map(b => b.range)) : null);

// ---------- checks: things worth a second look ----------
EP.check = (plan, airports) => {
  const out = [], add = (level, where, text) => out.push({level, where, text});
  const t = plan.trip, cur = t.currency;
  if (plan.format && plan.format !== EP.FORMAT) add('info', 'Plan', `Format is “${plan.format}”, expected “${EP.FORMAT}”. It was read anyway.`);
  if (!plan.destinations.length) add('error', 'Plan', 'No destinations found.');
  if (!t.researched_on) add('warn', 'Plan', 'No research date given, so you can’t tell how current the prices and rules are.');
  if (!t.budget || typeof t.budget.max !== 'number' || !t.budget.max) add('info', 'Plan', 'No budget in the plan, so budget badges are hidden.');
  const tol = v => Math.max(2, Math.abs(v) * 0.005);
  const near = (a, b) => Math.abs(a[0]-b[0]) <= tol(a[0]) && Math.abs(a[1]-b[1]) <= tol(a[1]);
  const ap = code => code && airports ? airports[String(code).toUpperCase()] : null;
  const checkAirport = (code, where) => { if (code && airports && !ap(code)) add('warn', where, `Airport code “${code}” isn’t in the airport list; distances from it are skipped.`); };
  plan.destinations.forEach(d => {
    const w = d.name;
    ['flights','lodging','other','total'].forEach(k => { const r = d.costs[k]; if (r != null && !EP.isRange(r)) add('warn', w, `Cost “${k}” isn’t a [low, high] pair of numbers.`); else if (EP.isRange(r) && r[0] > r[1]) add('warn', w, `Cost “${k}” has low ${EP.money(r[0],cur)} above high ${EP.money(r[1],cur)}.`); });
    if (EP.isRange(d.costs.total) && ['flights','lodging','other'].every(k => EP.isRange(d.costs[k]))) {
      const s = EP.sumRanges([d.costs.flights, d.costs.lodging, d.costs.other]);
      if (!near(s, d.costs.total)) add('warn', w, `Total ${EP.range(d.costs.total,cur)} doesn’t equal flights + lodging + other (${EP.range(s,cur)}).`);
    }
    if (!EP.destTotal(d)) add('info', w, 'No cost estimate.');
    if (typeof d.lat !== 'number' || typeof d.lon !== 'number') add('info', w, 'No coordinates, so it can’t be placed on maps.');
    checkAirport(d.airport, w);
    const a = ap(d.airport);
    if (a && typeof d.lat === 'number' && typeof d.lon === 'number') { const mi = EP.miles({lat:d.lat,lon:d.lon},{lat:a[0],lon:a[1]}); if (mi > 250) add('warn', w, `Its coordinates are ${EP.num(mi)} miles from ${d.airport} airport. Check the location or the airport.`); }
    if (!d.entry || !d.entry.status) add('info', w, 'No entry/visa information.');
    else if (!EP.safeUrl(d.entry.source && d.entry.source.url)) add('info', w, 'Entry rules have no source link.');
    d.routes.forEach(r => {
      const rw = `${w} → ${r.title || 'route'}`;
      const n = r.stops.reduce((s, x) => s + (Number(x.nights)||0), 0);
      if (t.nights && n && n !== t.nights) add('info', rw, `Stops add up to ${n} nights; the trip is ${t.nights} nights.`);
      r.stops.forEach(s => { if (typeof s.lat !== 'number' || typeof s.lon !== 'number') { if (!ap(s.airport)) add('info', rw, `Stop “${s.name}” has no coordinates, so it is left off the map.`); } checkAirport(s.airport, rw); });
      r.legs.forEach(l => { checkAirport(l.from_airport, rw); checkAirport(l.to_airport, rw); });
      const bd = Array.isArray(r.costs.breakdown) ? r.costs.breakdown.filter(b => EP.isRange(b.range)) : [];
      if (EP.isRange(r.costs.total) && bd.length) { const s = EP.sumRanges(bd.map(b=>b.range)); if (!near(s, r.costs.total)) add('warn', rw, `Total ${EP.range(r.costs.total,cur)} doesn’t equal the sum of its breakdown (${EP.range(s,cur)}).`); }
    });
  });
  return out;
};
})();
