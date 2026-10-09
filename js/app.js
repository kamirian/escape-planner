// Escape Planner — page wiring: the brief form, asking an AI, saving and sharing plans.
// © 2026 Kiyan Amirian. All rights reserved.
(function(){
const EP = window.EP, $ = s => document.querySelector(s), esc = EP.esc;

// ---------- storage (best effort; private windows may block it) ----------
const store = {
  get(k, fallback, area = 'local') { try { const v = (area === 'session' ? sessionStorage : localStorage).getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v, area = 'local') { try { (area === 'session' ? sessionStorage : localStorage).setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k, area = 'local') { try { (area === 'session' ? sessionStorage : localStorage).removeItem(k); } catch {} }
};

// ---------- the brief form ----------
const form = $('#brief');
let groups = store.get('ep.groups', [{people: 2, from: '', separate: false}]);
function renderGroups() {
  $('#groups').innerHTML = groups.map((g, i) => `<div class="group-row" data-i="${i}">
    <label class="field">People<input type="number" min="1" max="50" inputmode="numeric" data-g="people" value="${esc(g.people || '')}"></label>
    <label class="field grow">Leaving from<input data-g="from" value="${esc(g.from || '')}" placeholder="city or airport, e.g. Washington, DC"></label>
    ${i > 0 ? `<label class="check"><input type="checkbox" data-g="separate" ${g.separate ? 'checked' : ''}> Pays separately</label><button type="button" class="linklike" data-remove="${i}" aria-label="Remove travelers from ${esc(g.from || 'this city')}">Remove</button>` : ''}
  </div>`).join('');
}
$('#groups').addEventListener('input', e => { const row = e.target.closest('[data-i]'); if (!row) return; const g = groups[+row.dataset.i], k = e.target.dataset.g; g[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; changed(); });
$('#groups').addEventListener('click', e => { const r = e.target.closest('[data-remove]'); if (r) { groups.splice(+r.dataset.remove, 1); renderGroups(); changed(); } });
$('#add-group').addEventListener('click', () => { groups.push({people: 1, from: '', separate: true}); renderGroups(); changed(); groups.length && document.querySelector(`[data-i="${groups.length - 1}"] [data-g="from"]`)?.focus(); });

let priorities = new Set(store.get('ep.priorities', []));
$('#priorities').innerHTML = EP.PRIORITIES.map(p => `<label class="chip"><input type="checkbox" value="${esc(p)}" ${priorities.has(p) ? 'checked' : ''}><span>${esc(p)}</span></label>`).join('');
$('#priorities').addEventListener('change', e => { if (e.target.checked) priorities.add(e.target.value); else priorities.delete(e.target.value); changed(); });

const saved = store.get('ep.brief', {});
for (const el of form.elements) if (el.name && saved[el.name] != null) el.value = saved[el.name];
if (!saved.start) { /* leave empty by default */ }
renderGroups();

function brief() {
  const f = Object.fromEntries([...form.elements].filter(el => el.name).map(el => [el.name, el.value.trim()]));
  return {...f, groups, priorities: [...priorities], stops: Number(f.stops) || 1, count: Number(f.count) || 5};
}
function changed() {
  const b = brief();
  const {groups: g, priorities: p, ...rest} = b;
  store.set('ep.brief', rest); store.set('ep.groups', g); store.set('ep.priorities', p);
  $('#prompt').value = EP.buildPrompt(b);
}
form.addEventListener('input', changed);
form.addEventListener('submit', e => e.preventDefault());
changed();

// ---------- copy helpers ----------
async function copyText(text, statusEl, okMsg) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
  if (statusEl) { statusEl.textContent = okMsg; statusEl.hidden = false; clearTimeout(statusEl._t); statusEl._t = setTimeout(() => { statusEl.textContent = ''; }, 5000); }
}
$('#copy-prompt').addEventListener('click', e => { copyText($('#prompt').value, null); e.target.textContent = 'Copied'; setTimeout(() => e.target.textContent = 'Copy prompt', 2500); });

// ---------- ask modes ----------
const modeTabs = [$('#mode-copy'), $('#mode-api')];
function setMode(m) { modeTabs.forEach(t => { const on = t.id === 'mode-' + m; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }); $('#panel-copy').hidden = m !== 'copy'; $('#panel-api').hidden = m !== 'api'; store.set('ep.mode', m); }
modeTabs.forEach((t, i) => { t.addEventListener('click', () => setMode(t.id.slice(5))); t.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = modeTabs[(i + 1) % 2]; setMode(n.id.slice(5)); n.focus(); } }); });
setMode(store.get('ep.mode', 'copy'));

// ---------- reading an answer ----------
function readPlan(text) {
  const raw = EP.extractJson(text);
  const plan = EP.normalize(raw);
  if (!plan.destinations.length) throw new Error('The answer has no destinations with names. Ask the AI to answer again in the given format.');
  return plan;
}
const showError = (el, msg) => { el.textContent = msg; el.hidden = !msg; };
$('#show-plan').addEventListener('click', () => {
  try { const plan = readPlan($('#answer').value); showError($('#answer-error'), ''); openPlan(plan, {source: 'pasted'}); }
  catch (e) { showError($('#answer-error'), e.message); }
});
function openFile(input) {
  const f = input.files && input.files[0]; if (!f) return;
  f.text().then(txt => { try { openPlan(readPlan(txt), {source: 'file'}); } catch (e) { alertMsg(e.message); } }).finally(() => { input.value = ''; });
}
$('#open-file').addEventListener('change', e => openFile(e.target));
$('#open-file-2').addEventListener('change', e => openFile(e.target));
function alertMsg(m) { const el = location.hash.startsWith('#/saved') ? null : $('#answer-error'); if (el) showError(el, m); else { const s = $('#saved-list'); s.insertAdjacentHTML('afterbegin', `<p class="error" role="alert">${esc(m)}</p>`); } }

// ---------- API mode ----------
const prov = $('#provider');
prov.innerHTML = Object.entries(EP.PROVIDERS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join('');
const apiPrefs = store.get('ep.api', {provider: 'claude', models: {}, base: '', search: true});
prov.value = apiPrefs.provider in EP.PROVIDERS ? apiPrefs.provider : 'claude';
function syncProvider() {
  const k = prov.value, p = EP.PROVIDERS[k]; shownProvider = k;
  $('#model-list').innerHTML = p.models.map(m => `<option value="${esc(m)}">`).join('');
  $('#model').value = apiPrefs.models[k] || p.model;
  $('#model').placeholder = p.model || 'model name';
  $('#base-wrap').hidden = k !== 'compatible'; $('#base').value = apiPrefs.base || p.base || '';
  $('#key-label').textContent = p.keyLabel; $('#key').placeholder = p.keyHint;
  $('#key').value = store.get('ep.key.' + k, '') || '';
  $('#remember').checked = !!store.get('ep.key.' + k, '');
  $('#search-wrap').hidden = !p.search; $('#search').checked = apiPrefs.search !== false; $('#search-note').textContent = p.searchNote || '';
  $('#key-help').innerHTML = p.keyUrl ? `Get a key from the provider’s console: <a href="${esc(p.keyUrl)}" target="_blank" rel="noopener noreferrer">${esc(new URL(p.keyUrl).host)} ↗</a>. Calls are billed to your account.` : 'Works with services that offer an OpenAI-style “chat completions” endpoint, such as OpenRouter or a local model server.';
}
let shownProvider = prov.value;
function savePrefs() { apiPrefs.provider = prov.value; apiPrefs.models[shownProvider] = $('#model').value.trim(); apiPrefs.base = $('#base').value.trim(); apiPrefs.search = $('#search').checked; store.set('ep.api', apiPrefs); if ($('#remember').checked && $('#key').value) store.set('ep.key.' + shownProvider, $('#key').value); else store.del('ep.key.' + shownProvider); }
prov.addEventListener('change', () => { savePrefs(); syncProvider(); });
['#model', '#base', '#search', '#remember', '#key'].forEach(s => $(s).addEventListener('change', savePrefs));
syncProvider();

let controller = null;
async function callAI(prompt, statusEl, errorEl, button) {
  const k = prov.value, key = $('#key').value.trim(), model = $('#model').value.trim() || EP.PROVIDERS[k].model;
  if (k !== 'compatible' && !key) { showError(errorEl, 'Enter an API key first (Step 2 → Use my API key).'); return null; }
  if (!model) { showError(errorEl, 'Enter a model name.'); return null; }
  savePrefs(); showError(errorEl, '');
  controller = new AbortController();
  const started = Date.now(); let extra = '';
  const tick = setInterval(() => { const s = Math.round((Date.now() - started) / 1000); statusEl.textContent = `Waiting for ${EP.PROVIDERS[k].label}… ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${extra ? ' · ' + extra : ''}. Research with web search often takes 2–6 minutes.`; }, 1000);
  button.disabled = true; $('#cancel-api').hidden = false;
  try {
    const res = await EP.askAI(k, {key, model, prompt, search: $('#search').checked && EP.PROVIDERS[k].search, base: $('#base').value.trim(), signal: controller.signal, onStatus: m => extra = m});
    const u = res.usage || {};
    statusEl.textContent = `Done. Used about ${EP.num(u.input || 0)} input and ${EP.num(u.output || 0)} output tokens${u.searches ? ` and ${u.searches} web searches` : ''}.${u.truncated ? ' The answer hit the length limit and may be cut off.' : ''}`;
    return res.text;
  } catch (e) {
    statusEl.textContent = '';
    showError(errorEl, e.name === 'AbortError' ? 'Cancelled.' : e.message);
    return null;
  } finally { clearInterval(tick); button.disabled = false; $('#cancel-api').hidden = true; controller = null; }
}
$('#cancel-api').addEventListener('click', () => controller?.abort());
$('#run-api').addEventListener('click', async () => {
  const text = await callAI($('#prompt').value, $('#api-status'), $('#api-error'), $('#run-api'));
  if (text == null) return;
  try { openPlan(readPlan(text), {source: 'api'}); }
  catch (e) { $('#answer').value = text; showError($('#api-error'), e.message + ' The raw answer was copied into the paste box under “Copy a prompt”, so you can fix or reuse it.'); }
});

// ---------- the current plan ----------
let current = store.get('ep.current', null, 'session'); // {plan, meta}
function openPlan(plan, meta = {}) {
  current = {plan, meta: {...meta, opened: Date.now()}};
  if (meta.source !== 'shared' && meta.source !== 'example') store.set('ep.current', current, 'session');
  EP.view.dest = null; EP.view.route = {};
  location.hash = meta.source === 'example' ? '#/example' : '#/view';
  route();
}
const toolbarStatus = m => { const s = $('#toolbar-status'); s.textContent = m; clearTimeout(s._t); s._t = setTimeout(() => s.textContent = '', 6000); };

$('#view-view').addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a || !current) return;
  const act = a.dataset.act, plan = current.plan;
  if (act === 'save') {
    const list = store.get('ep.saved', []);
    const id = current.meta.savedId || ('p' + Date.now().toString(36));
    const entry = {id, title: plan.trip.title || 'Untitled trip', savedAt: new Date().toISOString(), plan};
    const i = list.findIndex(x => x.id === id); if (i >= 0) list[i] = entry; else list.unshift(entry);
    if (store.set('ep.saved', list)) { current.meta.savedId = id; store.set('ep.current', current, 'session'); toolbarStatus('Saved on this device. Find it under Saved trips.'); }
    else toolbarStatus('Couldn’t save in this browser (storage is blocked or full). Use Download file instead.');
  }
  if (act === 'download') {
    const blob = new Blob([JSON.stringify(plan, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${EP.slug(plan.trip.title || 'trip-plan')}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toolbarStatus('Downloaded. Open it later with “Open a plan file”.');
  }
  if (act === 'share') {
    try {
      const code = await pack(plan); const url = `${location.href.split('#')[0]}#/share/${code}`;
      await copyText(url, null);
      toolbarStatus(`Link copied (${EP.num(url.length)} characters). Anyone with the link can see this plan.${url.length > 8000 ? ' It’s long, so some apps may cut it off; sending the downloaded file is safer.' : ''}`);
    } catch { toolbarStatus('This browser can’t make share links. Use Download file instead.'); }
  }
  if (act === 'refine') { const r = $('#refine'); r.hidden = !r.hidden; if (!r.hidden) $('#refine-text').focus(); }
});
$('#refine-copy').addEventListener('click', () => { const req = $('#refine-text').value.trim(); if (!req) { showError($('#refine-error'), 'Describe the change first.'); return; } showError($('#refine-error'), ''); copyText(EP.buildRefinePrompt(current.plan, req), $('#refine-status'), 'Prompt copied. Paste it into the same AI chat, then paste the answer below.'); });
$('#refine-api').addEventListener('click', async () => {
  const req = $('#refine-text').value.trim(); if (!req) { showError($('#refine-error'), 'Describe the change first.'); return; }
  const text = await callAI(EP.buildRefinePrompt(current.plan, req), $('#refine-status'), $('#refine-error'), $('#refine-api'));
  if (text != null) { $('#refine-answer').value = text; applyRefine(); }
});
function applyRefine() { try { const plan = readPlan($('#refine-answer').value); showError($('#refine-error'), ''); const keep = current.meta.savedId; openPlan(plan, {source: 'refined', savedId: keep}); $('#refine').hidden = true; $('#refine-answer').value = ''; toolbarStatus('Plan updated.' + (keep ? ' Select “Save on this device” to keep the change.' : '')); } catch (e) { showError($('#refine-error'), e.message); } }
$('#refine-apply').addEventListener('click', applyRefine);

// photos & units
EP.photosOn = store.get('ep.photos', true); $('#photos-toggle').checked = EP.photosOn;
EP.units = store.get('ep.units', 'mi'); $('#units').value = EP.units;
$('#photos-toggle').addEventListener('change', e => { EP.photosOn = e.target.checked; store.set('ep.photos', EP.photosOn); route(); });
$('#units').addEventListener('change', e => { EP.units = e.target.value; store.set('ep.units', EP.units); route(); });

// ---------- share links: deflate + base64url ----------
const b64u = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function pack(obj) { const s = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw')); return b64u(new Uint8Array(await new Response(s).arrayBuffer())); }
async function unpack(code) { const s = new Blob([unb64u(code)]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return JSON.parse(await new Response(s).text()); }

// ---------- saved trips ----------
function renderSaved() {
  const list = store.get('ep.saved', []);
  $('#saved-list').innerHTML = list.length ? `<ul class="saved">${list.map(x => `<li><div><b>${esc(x.title)}</b><span class="small">${esc((x.plan.destinations || []).map(d => d.name).join(', '))}</span><span class="small">Saved ${esc(new Date(x.savedAt).toLocaleString())}</span></div><div class="actions"><button type="button" class="button small-button primary" data-open="${esc(x.id)}">Open</button><button type="button" class="button small-button" data-delete="${esc(x.id)}">Delete</button></div></li>`).join('')}</ul>` : '<p class="empty">No saved trips on this device yet. Make a plan, then select “Save on this device”.</p>';
}
$('#saved-list').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'), d = e.target.closest('[data-delete]'); const list = store.get('ep.saved', []);
  if (o) { const x = list.find(p => p.id === o.dataset.open); if (x) openPlan(EP.normalize(x.plan), {source: 'saved', savedId: x.id}); }
  if (d) { const x = list.find(p => p.id === d.dataset.delete); if (x && confirmDelete(d, x)) { store.set('ep.saved', list.filter(p => p.id !== x.id)); renderSaved(); } }
});
function confirmDelete(btn, x) { if (btn.dataset.armed) return true; btn.dataset.armed = '1'; btn.textContent = 'Select again to delete'; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Delete'; } }, 4000); return false; }

// ---------- routing ----------
async function route() {
  const h = location.hash || '';
  const show = v => { document.querySelectorAll('.view').forEach(s => s.hidden = s.id !== 'view-' + v); document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', String(a.dataset.nav === v || (v === 'view' && a.dataset.nav === 'example' && h.startsWith('#/example'))))); };
  document.querySelector('[data-nav="view"]').hidden = !(current && current.meta.source !== 'example');
  if (h.startsWith('#/share/')) {
    try { const plan = EP.normalize(await unpack(h.slice(8))); current = {plan, meta: {source: 'shared'}}; show('view'); await EP.renderPlan(plan, $('#plan-root'), {shared: true}); }
    catch { show('plan'); showError($('#answer-error'), 'That share link couldn’t be read. It may have been cut off when it was sent.'); }
    return;
  }
  if (h.startsWith('#/example')) {
    await loadExample(); current = {plan: EP.normalize(JSON.parse(JSON.stringify(window.EP_EXAMPLE))), meta: {source: 'example'}};
    show('view'); await EP.renderPlan(current.plan, $('#plan-root'), {example: true}); return;
  }
  if (h.startsWith('#/saved')) { show('saved'); renderSaved(); return; }
  if (h.startsWith('#/view') && current) { if (current.meta.source === 'example') { location.hash = '#/example'; return; } show('view'); await EP.renderPlan(current.plan, $('#plan-root'), {shared: current.meta.source === 'shared'}); return; }
  show('plan');
}
const loadExample = () => window.EP_EXAMPLE ? Promise.resolve() : new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'data/example.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
window.addEventListener('hashchange', route);
route();
})();
