(() => {
  'use strict';
  const C = JSON.parse(document.getElementById('course-data').textContent);
  const W = C.weeks, P = C.practices;
  const abs = u => /^https?:/.test(u) ? u : C.site + u;
  const now = () => Date.now();
  const DAY = 86400000;
  const DAYS = C.practiceDaysPerWeek;
  // Media and readings play inside the app on a normal web origin (GitHub Pages, an iOS/Android web view).
  // Sandboxed previews (claude.ai) block other sites, so there the app falls back to opening them and asking how it went.
  const HOSTED = /^https?:$/.test(location.protocol) && !/claude|anthropic/i.test(location.hostname);

  // ================================================================ icons
  const ICON = {
    video: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    read: '<path d="M4 5.5c2.5-1 5-1 8 1 3-2 5.5-2 8-1v13c-2.5-1-5-1-8 1-3-2-5.5-2-8-1z"/><path d="M12 6.5v13"/>',
    task: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>',
    finish: '<path d="M6 21V4h11l-2 4 2 4H6"/>',
    practice: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>',
    informal: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
    today: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    path: '<path d="M4 18c3-6 6 0 9-6s5-3 7-6"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="6" r="1.6"/>',
    lib: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>',
    you: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 1.5M10 3h4"/>'
  };
  const icon = (n, cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls); s.innerHTML = ICON[n] || ''; return s; };

  // ================================================================ course index
  const readMin = r => r.min || C.readingMinutesEstimate;
  const ITEMS = {}, ORDER = {};
  W.forEach(w => {
    const list = [];
    (w.steps || []).forEach((s, i) => list.push({ key: `0s${i}`, kind: /questionnaire|worksheet|workbook/i.test(s.t) ? 'task' : 'read', title: s.t, by: s.by, url: s.url, alt: s.alt, min: s.min, optional: /optional/i.test(s.t) }));
    (w.videos || []).forEach((v, i) => list.push({ key: `${w.n}v${i}`, kind: 'video', title: v.t, by: v.by, id: v.id, min: v.min, approx: v.approx }));
    (w.readings || []).forEach((r, i) => list.push({ key: `${w.n}r${i}`, kind: 'read', title: r.t, by: r.by || '', url: r.url, min: readMin(r), first: i === 0 }));
    (w.tasks || []).forEach((t, i) => list.push({ key: `${w.n}t${i}`, kind: 'task', title: t.t, by: t.by, url: t.url, alt: t.alt, min: t.min }));
    (w.finish || []).forEach((f, i) => list.push({ key: `8f${i}`, kind: 'finish', title: f.t, by: f.by, url: f.url, optional: i > 0 }));
    list.forEach(x => { x.week = w.n; ITEMS[x.key] = x; });
    ORDER[w.n] = list;
  });
  const hasLog = n => n >= 1;
  const required = n => ORDER[n].filter(x => !x.optional);

  // Spread a week's videos and readings across its six practice days, in order, balancing minutes.
  const PLAN = {};
  function plan(n) {
    if (PLAN[n]) return PLAN[n];
    const vids = ORDER[n].filter(x => x.kind === 'video'), reads = ORDER[n].filter(x => x.kind === 'read');
    const seq = [];
    if (reads[0]) seq.push(reads[0]);
    const rest = reads.slice(1); let vi = 0, ri = 0;
    while (vi < vids.length || ri < rest.length) { if (vi < vids.length) seq.push(vids[vi++]); if (vi < vids.length) seq.push(vids[vi++]); if (ri < rest.length) seq.push(rest[ri++]); }
    const tot = seq.reduce((a, x) => a + x.min, 0), tgt = tot / DAYS || 1;
    const days = Array.from({ length: DAYS }, () => []);
    let cum = 0;
    seq.forEach(x => { days[Math.min(DAYS - 1, Math.floor((cum + x.min / 2) / tgt))].push(x.key); cum += x.min; });
    ORDER[n].filter(x => x.kind === 'task' || x.kind === 'finish').forEach(x => days[DAYS - 1].push(x.key));
    return (PLAN[n] = days);
  }
  const dayOfItem = k => { const n = ITEMS[k].week; if (!n) return 0; return plan(n).findIndex(d => d.includes(k)); };

  // What each practice day asks for (from the course's weekly instructions).
  const learned = n => {
    const base = ['bodyscan', 'sitting'];
    if (n > 3) base.push('yoga1'); if (n > 4) base.push('yoga2');
    if (n > 5) base.push('tt-emotional', 'tt-physical'); if (n > 6) base.push('mountain', 'lake');
    if (n > 7) base.push('lovingkindness', 'walking');
    return base;
  };
  function dayPractice(n, d) {
    switch (n) {
      case 1: return d === 0 ? ['raisin'] : ['bodyscan'];
      case 2: return d % 2 === 0 ? ['sitting'] : ['bodyscan'];
      case 3: return d === 5 ? ['bodyscan'] : d % 2 === 0 ? ['yoga1'] : ['sitting'];
      case 4: return d % 2 === 0 ? ['yoga2'] : ['sitting'];
      case 5: return d < 2 ? ['tt-emotional', 'tt-physical'] : learned(5).concat('tt-emotional', 'tt-physical');
      case 6: return d === 0 ? ['mountain', 'lake'] : ['bodyscan', 'sitting', 'yoga1', 'yoga2'];
      case 7: return d === 0 ? ['lovingkindness'] : d === 1 ? ['walking'] : learned(8);
      default: return learned(8).concat('rain', 'soften', 'silent');
    }
  }
  const practiceLabel = (n, d) => { const ids = dayPractice(n, d); return ids.length === 1 ? P[ids[0]].t : ids.length === 2 ? `${P[ids[0]].t} or ${P[ids[1]].t.replace(/^Turning Toward: /, '')}` : 'Your choice of practice'; };

  // ================================================================ state
  // Every entry carries its own timestamp, so copies from different devices merge without loss.
  const blank = () => ({ v: 3, items: {}, days: {}, inf: {}, free: {}, weekStart: {}, pending: null, pendingAt: 0, last: null, resetAt: 0 });
  let S = blank();
  const stable = o => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
  function upgrade(s) {
    if (!s || typeof s !== 'object') return blank();
    if (s.v === 3 || s.v === 2) return Object.assign(blank(), s, { v: 3 });
    if (s.done) { const o = blank(); Object.keys(s.done).forEach(k => { if (s.done[k]) o.items[k] = { done: true, at: 1 }; }); Object.entries(s.days || {}).forEach(([w, a]) => (a || []).forEach((v, d) => { if (v) (o.days[w] = o.days[w] || {})[d] = { done: true, at: 1 }; })); return o; }
    return blank();
  }
  function merge(a, b) {
    a = upgrade(a); b = upgrade(b);
    const R = Math.max(a.resetAt || 0, b.resetAt || 0);
    const out = blank(); out.resetAt = R;
    const live = e => e && Math.max(e.at || 0, e.posAt || 0) >= R;
    const pick = (x, y) => !live(x) ? (live(y) ? y : null) : !live(y) ? x : ((y.at || 0) > (x.at || 0) ? y : x);
    const keys = (p, q) => [...new Set([...Object.keys(p || {}), ...Object.keys(q || {})])];
    for (const k of keys(a.items, b.items)) {
      const x = a.items[k], y = b.items[k], d = pick(x, y); if (!d) continue;
      const e = { done: !!d.done, at: d.at || 0 };
      const wp = [x, y].filter(z => live(z) && z.posAt).sort((p, q) => q.posAt - p.posAt)[0];
      if (wp && !e.done) { e.pos = wp.pos; e.posAt = wp.posAt; }
      out.items[k] = e;
    }
    for (const f of ['days', 'inf']) for (const w of keys(a[f], b[f])) {
      const dd = {};
      for (const d of keys(a[f][w], b[f][w])) { const e = pick(a[f][w]?.[d], b[f][w]?.[d]); if (e) dd[d] = { ...e }; }
      if (Object.keys(dd).length) out[f][w] = dd;
    }
    for (const k of keys(a.free, b.free)) { const e = pick(a.free[k], b.free[k]); if (e) out.free[k] = { ...e }; }
    for (const w of keys(a.weekStart, b.weekStart)) { const v = [a.weekStart[w], b.weekStart[w]].filter(t => t && t >= R); if (v.length) out.weekStart[w] = Math.min(...v); }
    const pw = [a, b].filter(s => (s.pendingAt || 0) >= R).sort((p, q) => (q.pendingAt || 0) - (p.pendingAt || 0))[0];
    if (pw) { out.pending = pw.pending; out.pendingAt = pw.pendingAt; }
    out.last = pick(a.last, b.last);
    return out;
  }

  // ================================================================ persistence
  // cloud: the viewer's private record in the artifact store (claude.ai); local: this browser; memory: nothing kept.
  const LKEY = 'palouse-companion-v3';
  let mode = 'memory', ref = null, writing = false, again = false, timer = null, dueAt = 0, lastRemote = '', syncNote = '';
  function loadLocal() {
    for (const k of [LKEY, 'palouse-companion-v2', 'palouse-companion-v1']) {
      try { const raw = localStorage.getItem(k); if (raw) return JSON.parse(raw); } catch (e) {}
    }
    return null;
  }
  function saveLocal() { try { localStorage.setItem(LKEY, stable(S)); if (mode === 'memory') mode = 'local'; return true; } catch (e) { return false; } }
  function schedule(delay = 800) {
    if (!ref) return;
    const due = now() + delay;
    if (timer && dueAt <= due) return;
    clearTimeout(timer); dueAt = due; timer = setTimeout(flush, delay);
  }
  async function flush() {
    timer = null;
    if (!ref) return;
    if (writing) { again = true; return; }
    writing = true;
    const snap = stable(S);
    try { await ref.set({ state: JSON.parse(snap), savedAt: now() }); lastRemote = snap; }
    catch (e) {
      if (e && e.code === 'unavailable') setTimeout(() => schedule(0), 1500 + Math.random() * 2000);
      else { ref = null; mode = saveLocal() ? 'local' : 'memory'; syncNote = 'Your account copy could not be updated, so progress is saved on this device.'; }
    }
    writing = false;
    if (again) { again = false; schedule(); }
  }
  function applyRemote(st) {
    const rj = stable(st); if (rj === lastRemote) return; lastRemote = rj;
    const m = merge(S, st), mj = stable(m), changed = mj !== stable(S);
    S = m; saveLocal();
    if (changed) render();
    if (mj !== rj) schedule();
  }
  async function initCloud() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id(); if (!uid) return;
      const r = db.doc(`data/users/${uid}/progress`);
      const snap = await r.get();
      ref = r; mode = 'cloud';
      if (snap.exists && snap.data() && snap.data().state) applyRemote(snap.data().state);
      else if (Object.keys(S.items).length || Object.keys(S.days).length) schedule(0);
      r.onSnapshot(sn => { if (sn.metadata && sn.metadata.hasPendingWrites) return; if (sn.exists && sn.data() && sn.data().state) applyRemote(sn.data().state); }, () => {});
      if (tab === 'you') render();
      checkPending();
    } catch (e) {}
  }
  const syncText = () => syncNote || ({ cloud: 'Saved to your account. Pick up on any device.', local: 'Saved on this device. Use a progress code to move it.', memory: 'Not being saved here. Copy a progress code before you leave.' })[mode];
  function commit(opts = {}) { saveLocal(); schedule(opts.delay); if (opts.render !== false) render(); }

  // ================================================================ dates + progress model
  const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const today = () => ymd(now());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const niceDate = s => new Date(s + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const shortDate = s => new Date(s + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const ent = k => S.items[k] || {};
  const isDone = k => !!ent(k).done;
  const doneToday = k => isDone(k) && ymd(ent(k).at) === today();
  const posOf = k => ent(k).pos || 0;
  const touchWeek = n => { if (n >= 1 && !S.weekStart[n]) S.weekStart[n] = now(); };
  const verb = it => it.kind === 'video' ? 'Watched' : it.kind === 'read' ? 'Read' : 'Did';
  function setDone(k, v = true) {
    const it = ITEMS[k];
    S.items[k] = { done: v, at: now() };
    if (v) S.last = { week: it.week, label: `${verb(it)} “${it.title}”`, at: now() };
    touchWeek(it.week);
  }
  function setPos(k, sec) {
    const it = ITEMS[k];
    S.items[k] = { ...ent(k), pos: Math.max(0, Math.round(sec)), posAt: now() };
    S.last = { week: it.week, label: `Watching “${it.title}”`, at: now() };
    touchWeek(it.week);
  }
  const dayEnt = (n, d) => (S.days[n] || {})[d] || {};
  const infEnt = (n, d) => (S.inf[n] || {})[d] || {};
  const daysDone = n => Array.from({ length: DAYS }, (_, d) => dayEnt(n, d)).filter(e => e.done).length;
  function logDay(n, d, rec) {
    S.days[n] = { ...(S.days[n] || {}), [d]: { done: true, at: now(), date: today(), ...rec } };
    S.last = { week: n, label: `Practised ${rec.pid ? P[rec.pid].t : ''} (Week ${n}, day ${d + 1})`, at: now() };
    touchWeek(n);
  }
  function unlogDay(n, d) { S.days[n] = { ...(S.days[n] || {}), [d]: { done: false, at: now() } }; }
  function logInf(n, d, note) { S.inf[n] = { ...(S.inf[n] || {}), [d]: { done: true, at: now(), date: today(), note } }; touchWeek(n); }
  function logFree(pid, mins, rec) {
    const k = today(), e = S.free[k] || { mins: 0, list: [] };
    S.free[k] = { at: now(), mins: (e.mins || 0) + mins, list: [...(e.list || []), { pid, mins, ...rec }].slice(-12) };
  }

  function weekProgress(n) {
    const req = required(n);
    const done = req.filter(x => isDone(x.key)).length + (hasLog(n) ? daysDone(n) : 0);
    const total = req.length + (hasLog(n) ? DAYS : 0);
    return total ? done / total : 0;
  }
  const weekComplete = n => weekProgress(n) >= 1;
  function activeWeek() {
    const lw = S.last ? S.last.week : null;
    if (lw == null) { const f = W.find(w => !weekComplete(w.n)); return f ? f.n : 8; }
    if (weekComplete(lw)) { const nx = W.find(w => w.n > lw && !weekComplete(w.n)); return nx ? nx.n : lw; }
    return lw;
  }
  const opensOn = n => (n >= 2 && S.weekStart[n - 1]) ? addDays(ymd(S.weekStart[n - 1]), 7) : null;

  function practiceDates() {
    const set = new Set();
    Object.values(S.days).forEach(m => Object.values(m).forEach(e => { if (e.done && e.date) set.add(e.date); }));
    Object.keys(S.free).forEach(k => { if ((S.free[k].mins || 0) > 0) set.add(k); });
    return set;
  }
  function streak() {
    const s = practiceDates(); let d = today(), n = 0;
    if (!s.has(d)) d = addDays(d, -1);
    while (s.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }
  function bestStreak() {
    const ds = [...practiceDates()].sort(); let best = 0, run = 0, prev = null;
    ds.forEach(d => { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
    return best;
  }
  function totalMinutes() {
    let m = 0;
    Object.values(S.days).forEach(x => Object.values(x).forEach(e => { if (e.done) m += e.mins || 30; }));
    Object.values(S.free).forEach(e => { m += e.mins || 0; });
    return m;
  }

  // ================================================================ sessions
  // A session is an ordered list of steps; "done" is always read from saved progress.
  const L = k => ({ type: ITEMS[k].kind, key: k });
  function daySession(n, d, rollover) {
    const p = plan(n);
    let keys = p[d].slice();
    if (rollover) keys = p.slice(0, d + 1).flat().filter(k => !isDone(k) || doneToday(k) || p[d].includes(k));
    const steps = keys.filter(k => !ITEMS[k].optional || p[d].includes(k)).map(L);
    steps.push({ type: 'practice', n, d });
    if (W[n].prompt) steps.push({ type: 'informal', n, d });
    return { kind: 'day', n, d, title: `Week ${n} · Day ${d + 1}`, steps };
  }
  function stepDone(s) {
    if (s.type === 'practice') return s.free ? !!s.logged : !!dayEnt(s.n, s.d).done;
    if (s.type === 'informal') return !!infEnt(s.n, s.d).done;
    return isDone(s.key);
  }
  const stepMin = s => s.type === 'practice' ? (s.free ? P[s.pid].min : 30) : s.type === 'informal' ? 5 : (ITEMS[s.key].min || 5) - (s.type === 'video' ? Math.floor(posOf(s.key) / 60) : 0);
  const left = sess => sess.steps.filter(s => !stepDone(s)).reduce((a, s) => a + Math.max(1, stepMin(s)), 0);
  const stepTitle = s => s.type === 'practice' ? (s.free ? P[s.pid].t : practiceLabel(s.n, s.d)) : s.type === 'informal' ? 'Informal practice log' : ITEMS[s.key].title;
  const stepKind = s => ({ video: 'Video', read: 'Reading', task: 'To do', finish: 'Finish', practice: 'Formal practice', informal: 'Through the day' })[s.type];

  // What Today should show.
  function todayPlan() {
    const aw = activeWeek();
    if (aw === 0) {
      const steps = ORDER[0].map(x => L(x.key));
      if (steps.filter(s => !ITEMS[s.key].optional).every(stepDone)) return { kind: 'intro', n: 1 };
      return { kind: 'day', n: 0, d: 0, title: 'Getting started', steps };
    }
    if (!S.weekStart[aw]) {
      const o = opensOn(aw);
      if (o && today() < o) return { kind: 'rest', n: aw, opens: o };
      return { kind: 'intro', n: aw };
    }
    let d = -1;
    for (let i = 0; i < DAYS; i++) if (dayEnt(aw, i).done && dayEnt(aw, i).date === today()) d = i;
    if (d < 0) d = Array.from({ length: DAYS }, (_, i) => i).find(i => !dayEnt(aw, i).done) ?? -1;
    if (d < 0) {
      const leftover = plan(aw).flat().filter(k => !isDone(k) && !ITEMS[k].optional);
      if (leftover.length) return { kind: 'day', n: aw, d: DAYS - 1, title: `Week ${aw} · Catch up`, steps: leftover.map(L) };
      const o = aw < 8 ? addDays(ymd(S.weekStart[aw]), 7) : null;
      return { kind: aw === 8 ? 'complete' : 'rest', n: aw + 1, opens: o };
    }
    return daySession(aw, d, true);
  }
  function behind() {
    const aw = activeWeek(), out = [];
    W.filter(w => w.n < aw).forEach(w => { const items = required(w.n).filter(i => !isDone(i.key)); if (items.length) out.push(...items); });
    return out;
  }

  // ================================================================ formatting + DOM
  const hm = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
  const mmss = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function ago(t) { const m = Math.round((now() - t) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : `${d} days ago`; }
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k.startsWith('on')) n[k] = v; else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(k => k != null && k !== false && n.append(k));
    return n;
  };
  const ext = (text, href, onopen, cls) => el('a', { href, target: '_blank', rel: 'noopener', class: cls, onclick: onopen ? () => onopen() : null }, text);
  const ytWatch = (id, pos) => `https://www.youtube.com/watch?v=${id}${pos > 5 ? '&t=' + Math.floor(pos) + 's' : ''}`;
  const iconFor = s => s.type === 'practice' ? 'practice' : s.type;

  // ================================================================ tabs + routing
  const TABS = [['today', 'Today', 'today'], ['path', 'Path', 'path'], ['practices', 'Practices', 'lib'], ['you', 'You', 'you']];
  let tab = (location.hash || '').replace('#', '');
  if (!TABS.some(t => t[0] === tab)) tab = 'today';
  let pathWeek = null;
  function go(t) { tab = t; pathWeek = null; try { history.replaceState(null, '', '#' + t); } catch (e) {} render(); window.scrollTo(0, 0); }
  window.addEventListener('hashchange', () => { const t = location.hash.replace('#', ''); if (TABS.some(x => x[0] === t) && t !== tab) { tab = t; pathWeek = null; render(); } });

  function renderTabs() {
    const nav = document.getElementById('tabs'); nav.innerHTML = '';
    TABS.forEach(([id, label, ic]) => nav.append(el('a', { href: '#' + id, 'aria-current': tab === id ? 'page' : null, onclick: e => { e.preventDefault(); go(id); } }, icon(ic), label)));
  }

  function render() {
    renderTabs();
    const app = document.getElementById('app'); app.innerHTML = '';
    app.append(({ today: viewToday, path: viewPath, practices: viewPractices, you: viewYou })[tab]());
    if (session) updateSessionChrome();
  }

  // ================================================================ Today
  function stepper(sess) {
    const box = el('div', { class: 'stepper', role: 'img', 'aria-label': `${sess.steps.filter(stepDone).length} of ${sess.steps.length} steps done` });
    const cur = sess.steps.findIndex(s => !stepDone(s));
    sess.steps.forEach((s, i) => {
      if (i) box.append(el('span', { class: 'bar' + (stepDone(sess.steps[i - 1]) ? ' done' : '') }));
      box.append(el('span', { class: 'dot' + (stepDone(s) ? ' done' : i === cur ? ' cur' : ''), title: stepTitle(s) }, icon(stepDone(s) ? 'check' : iconFor(s))));
    });
    return box;
  }
  function stepRow(sess, i) {
    const s = sess.steps[i], done = stepDone(s);
    const sub = s.type === 'practice' ? (s.free ? `${P[s.pid].min} min` : (dayEnt(s.n, s.d).done ? `Logged · ${dayEnt(s.n, s.d).mins || 30} min` : 'About 30 min, guided')) :
      s.type === 'informal' ? (infEnt(s.n, s.d).done ? 'Logged' : 'Notice it during the day, log it tonight') :
      [stepKind(s), ITEMS[s.key].by].filter(Boolean).join(' · ');
    const pos = s.type === 'video' && !done && posOf(s.key) ? `Stopped at ${mmss(posOf(s.key))}` : '';
    return el('button', { class: 'step' + (done ? ' done' : ''), onclick: () => openSession(sess, i) },
      el('span', { class: 'ic' }, icon(done ? 'check' : iconFor(s))),
      el('div', {}, el('span', { class: 't' }, stepTitle(s)), el('span', { class: 's' }, pos ? el('span', { class: 'pos' }, pos) : sub)),
      el('span', { class: 'm' }, s.type === 'practice' || s.type === 'informal' ? '' : `${ITEMS[s.key].approx ? '~' : ''}${ITEMS[s.key].min || ''}${ITEMS[s.key].min ? ' min' : ''}`));
  }
  function topbar(title) {
    const st = streak();
    return el('div', { class: 'topbar' }, el('span', { class: 'brand' }, title),
      el('span', { class: 'pill' + (st ? ' hot' : ''), title: 'Days in a row with a practice' }, icon('leaf'), `${st} day${st === 1 ? '' : 's'}`));
  }
  function weekStrip(n) {
    if (!hasLog(n) || !S.weekStart[n]) return null;
    const start = ymd(S.weekStart[n]);
    const box = el('div', { class: 'week', 'aria-label': `Week ${n} practice days` });
    for (let d = 0; d < DAYS; d++) {
      const e = dayEnt(n, d);
      const isNext = !e.done && Array.from({ length: d }, (_, i) => dayEnt(n, i).done).every(Boolean);
      box.append(el('div', { class: 'wd' + (e.done ? ' done' : '') + (isNext ? ' today' : ''), title: practiceLabel(n, d) }, el('i', {}, e.done ? icon('check') : String(d + 1)), e.done && e.date ? shortDate(e.date) : `Day ${d + 1}`));
    }
    box.append(el('div', { class: 'wd rest', title: 'The course asks for at least seven days per week' }, el('i', {}, '7'), 'Rest'));
    return el('section', { class: 'card' },
      el('div', { class: 'spread' }, el('h3', {}, `This week`), el('span', { class: 'small muted mono' }, `${daysDone(n)} of ${DAYS} days`)),
      box,
      el('p', { class: 'small muted' }, `Started ${niceDate(start)}.` + (n < 8 ? ` Week ${n + 1} opens ${niceDate(addDays(start, 7))} at the earliest.` : '')));
  }
  function viewToday() {
    const tp = todayPlan();
    const scr = el('div', { class: 'screen' }, topbar('Palouse Companion'));
    if (S.last && now() - S.last.at > 4 * DAY) scr.append(el('p', { class: 'note' }, `Welcome back. It's been ${Math.floor((now() - S.last.at) / DAY)} days, which is common. Carry on from here; there's no need to restart.`));

    if (tp.kind === 'intro') {
      const w = W[tp.n];
      const vMin = (w.videos || []).reduce((a, v) => a + v.min, 0), rMin = (w.readings || []).reduce((a, r) => a + readMin(r), 0);
      scr.append(el('section', { class: 'card hero' },
        el('span', { class: 'eyebrow' }, `Week ${w.n} of 8 · ${w.subtitle}`),
        el('h1', {}, w.title), el('p', {}, w.summary),
        el('div', { class: 'budget' },
          el('div', {}, el('small', {}, 'Each day'), el('b', {}, `~${Math.round((vMin + rMin) / DAYS + 35)} min`), el('small', {}, 'learning + practice')),
          el('div', {}, el('small', {}, 'Practice'), el('b', {}, '6 days'), el('small', {}, practiceLabel(w.n, 0))),
          el('div', {}, el('small', {}, 'Videos + reading'), el('b', {}, hm(vMin + rMin)), el('small', {}, 'spread over the week'))),
        w.note ? el('p', { class: 'note' }, w.note) : null,
        el('button', { class: 'btn primary big', onclick: () => { touchWeek(w.n); S.last = { week: w.n, label: `Began Week ${w.n}`, at: now() }; commit(); openSession(todayPlan()); } }, `Begin Week ${w.n}`)));
    } else if (tp.kind === 'rest') {
      scr.append(el('section', { class: 'card hero' },
        el('span', { class: 'eyebrow' }, `Week ${tp.n - 1} complete`),
        el('h1', {}, 'Nicely done.'),
        el('p', {}, `Week ${tp.n} opens ${niceDate(tp.opens)}. The course asks for at least seven days per week so each one has time to settle.`),
        el('p', { class: 'muted small' }, 'Until then, keep your daily practice going.'),
        el('button', { class: 'btn primary big', onclick: () => go('practices') }, 'Choose a practice')));
    } else if (tp.kind === 'complete') {
      scr.append(el('section', { class: 'card hero' },
        el('span', { class: 'eyebrow' }, 'Course complete'),
        el('h1', {}, 'Eight weeks. Well done.'),
        el('p', {}, 'Keep the practices that work for you. Practices has every guided meditation and a silent timer.'),
        el('div', { class: 'row' }, ext('Request your certificate', abs('/MBSR/certificate.html'), null, 'btn primary'), el('button', { class: 'btn', onclick: () => go('practices') }, 'Practices'))));
    } else {
      const sess = tp, done = sess.steps.filter(stepDone).length, all = done === sess.steps.length;
      const nx = sess.steps.findIndex(s => !stepDone(s));
      const hero = el('section', { class: 'card hero' },
        el('div', { class: 'spread' }, el('span', { class: 'eyebrow' }, sess.title), el('span', { class: 'small mono muted' }, all ? 'All done' : `${hm(left(sess))} left`)),
        el('h1', {}, sess.n === 0 ? 'Set up for the course' : W[sess.n].title),
        stepper(sess),
        el('p', { class: 'small muted' }, all ? 'Today is complete.' : `${done} of ${sess.steps.length} done · next: ${stepTitle(sess.steps[nx])}`));
      if (!all) hero.append(el('button', { class: 'btn primary big', onclick: () => openSession(sess) }, done ? 'Continue' : 'Start today'));
      else {
        const nd = sess.n && sess.d < DAYS - 1 ? sess.d + 1 : null;
        hero.append(el('p', {}, nd != null ? `Back tomorrow for Day ${nd + 1}: ${practiceLabel(sess.n, nd)}.` : `That's the last practice day of Week ${sess.n}.`));
        if (nd != null) {
          const ahead = plan(sess.n)[nd].filter(k => !isDone(k));
          if (ahead.length) hero.append(el('button', { class: 'btn', onclick: () => openSession({ kind: 'ahead', n: sess.n, d: nd, title: `Get ahead · Day ${nd + 1}`, steps: ahead.map(L) }) }, `Get ahead: watch and read Day ${nd + 1}'s ${ahead.length} item${ahead.length > 1 ? 's' : ''}`));
        }
      }
      hero.append(el('div', { class: 'steps' }, sess.steps.map((_, i) => stepRow(sess, i))));
      scr.append(hero);
      if (sess.n) scr.append(weekStrip(sess.n));
    }
    const bh = behind();
    if (bh.length) scr.append(el('section', { class: 'card' },
      el('div', { class: 'spread' }, el('h3', {}, 'Still open from earlier weeks'), el('span', { class: 'small mono muted' }, `${bh.length} item${bh.length > 1 ? 's' : ''}`)),
      el('button', { class: 'btn', onclick: () => openSession({ kind: 'catchup', title: 'Catch up', steps: bh.map(x => L(x.key)) }) }, 'Catch up now')));
    if (S.last) scr.append(el('p', { class: 'small muted' }, `Last activity: ${S.last.label}, ${ago(S.last.at)}.`));
    return scr;
  }

  // ================================================================ Path
  function drawTrail() {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 720 120'); svg.setAttribute('role', 'list'); svg.setAttribute('aria-label', 'Course path');
    const aw = activeWeek();
    const xs = W.map((_, i) => 40 + i * (640 / (W.length - 1))), ys = W.map((_, i) => 62 - Math.sin(i * 0.9) * 16 - i * 2);
    let d = `M0 ${ys[0] + 6}`;
    xs.forEach((x, i) => { const px = i ? xs[i - 1] : 0, py = i ? ys[i - 1] : ys[0] + 6, cx = (px + x) / 2; d += ` C${cx} ${py} ${cx} ${ys[i]} ${x} ${ys[i]}`; });
    const ly = ys[ys.length - 1]; d += ` C700 ${ly} 700 ${ly - 4} 720 ${ly - 6}`;
    const mk = (t, a) => { const n = document.createElementNS(NS, t); Object.entries(a).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
    svg.append(mk('path', { d: d + ' L720 120 L0 120 Z', fill: 'var(--accent-soft)' }), mk('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '3 5' }));
    W.forEach((w, i) => {
      const p = weekProgress(w.n), r = w.n === aw ? 13 : 10;
      const g = mk('g', { class: 'stop', role: 'listitem', tabindex: 0, 'aria-label': `${w.n ? 'Week ' + w.n : 'Getting started'}: ${w.title}, ${Math.round(p * 100)}% done` });
      if (w.n === aw) g.append(mk('circle', { cx: xs[i], cy: ys[i], r: r + 5, fill: 'none', stroke: 'var(--accent)', 'stroke-dasharray': '2 3' }));
      g.append(mk('circle', { cx: xs[i], cy: ys[i], r, fill: p >= 1 ? 'var(--sage)' : 'var(--surface)', stroke: p > 0 ? 'var(--sage)' : 'var(--line)', 'stroke-width': 1.5 }));
      if (p > 0 && p < 1) { const c = 2 * Math.PI * r; g.append(mk('circle', { cx: xs[i], cy: ys[i], r, fill: 'none', stroke: 'var(--sage)', 'stroke-width': 3, 'stroke-dasharray': `${c * p} ${c}`, transform: `rotate(-90 ${xs[i]} ${ys[i]})` })); }
      const t = mk('text', { x: xs[i], y: ys[i] + 4, 'text-anchor': 'middle' }); t.style.fill = p >= 1 ? 'var(--surface)' : 'var(--ink)'; t.textContent = w.n || '·'; g.append(t);
      const lab = mk('text', { x: xs[i], y: ys[i] + 32, 'text-anchor': 'middle' }); lab.textContent = w.short; g.append(lab);
      const open = () => { pathWeek = w.n; render(); window.scrollTo(0, 0); };
      g.addEventListener('click', open); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      svg.append(g);
    });
    return el('div', { class: 'trail' }, svg);
  }
  function viewPath() {
    if (pathWeek != null) return viewWeek(W[pathWeek]);
    const aw = activeWeek();
    const all = W.reduce((a, w) => a + weekProgress(w.n), 0) / W.length;
    const scr = el('div', { class: 'screen' }, topbar('Your path'), drawTrail(),
      el('div', { class: 'stack' }, el('div', { class: 'spread' }, el('span', { class: 'small muted' }, 'Whole course'), el('span', { class: 'small mono' }, `${Math.round(all * 100)}%`)), el('div', { class: 'meter' }, el('span', { style: `width:${(all * 100).toFixed(0)}%` }))));
    const list = el('div', { class: 'stack' });
    W.forEach(w => {
      const p = weekProgress(w.n);
      list.append(el('button', { class: 'wk' + (p >= 1 ? ' done' : '') + (w.n === aw ? ' cur' : ''), onclick: () => { pathWeek = w.n; render(); window.scrollTo(0, 0); } },
        el('span', { class: 'n' }, p >= 1 ? icon('check') : (w.n || '·')),
        el('div', {}, el('strong', {}, w.title), el('div', { class: 'small muted' }, w.subtitle)),
        el('span', { class: 'small mono muted' }, w.n === aw ? 'Now' : `${Math.round(p * 100)}%`)));
    });
    scr.append(list);
    return scr;
  }
  function viewWeek(w) {
    const scr = el('div', { class: 'screen' },
      el('div', { class: 'topbar' }, el('button', { class: 'btn ghost', onclick: () => { pathWeek = null; render(); } }, icon('back'), 'Path'), null),
      el('div', { class: 'stack' }, el('span', { class: 'eyebrow' }, w.n ? `Week ${w.n} of 8 · ${w.subtitle}` : 'Before Week 1'), el('h1', {}, w.title), el('p', {}, w.summary)));
    if (w.note) scr.append(el('p', { class: 'note' }, w.note));
    if (w.n === 0) {
      const sess = { kind: 'day', n: 0, d: 0, title: 'Getting started', steps: ORDER[0].map(x => L(x.key)) };
      scr.append(el('section', { class: 'card' }, el('div', { class: 'steps' }, sess.steps.map((_, i) => stepRow(sess, i)))));
    } else {
      for (let d = 0; d < DAYS; d++) {
        const sess = daySession(w.n, d, false), e = dayEnt(w.n, d);
        scr.append(el('section', { class: 'card' },
          el('div', { class: 'spread' }, el('h3', {}, `Day ${d + 1}`), el('span', { class: 'small mono muted' }, e.done ? `Practised ${e.date ? shortDate(e.date) : ''}` : hm(left(sess)))),
          el('div', { class: 'steps' }, sess.steps.map((_, i) => stepRow(sess, i))),
          e.done ? el('button', { class: 'linkbtn', onclick: () => { unlogDay(w.n, d); commit(); } }, 'Undo practice log') : null));
      }
      const sheets = el('div', { class: 'row' });
      if (w.sheets) sheets.append(ext('Formal practice sheet', abs(`/practice/${w.sheets}-formal.pdf`), null, 'btn'), ext('Informal practice sheet', abs(`/practice/${w.sheets}-informal.pdf`), null, 'btn'));
      scr.append(el('section', { class: 'card' }, el('h3', {}, 'Daily practice'), el('p', {}, w.informal),
        w.sheets ? el('p', { class: 'small muted' }, 'Your log in this app is a record for you. If you want a certificate, the course also asks for its practice sheets.') : null, sheets));
      if (w.supplementary) scr.append(el('details', {}, el('summary', {}, `Optional extras (${w.supplementary.length})`),
        el('ul', {}, w.supplementary.map(s => el('li', {}, ext(s.t, abs(s.url)), s.by ? ` · ${s.by}` : '', s.min ? ` · ${s.min} min` : '')))));
    }
    scr.append(el('div', { class: 'row' }, ext('Open the original course page', abs(w.page), null, 'btn')));
    return scr;
  }

  // ================================================================ Practices
  function viewPractices() {
    const scr = el('div', { class: 'screen' }, topbar('Practices'),
      el('p', { class: 'muted' }, 'Every guided practice from the course, any time. Practising here counts toward your streak.'));
    const list = el('div', { class: 'plist' });
    Object.entries(P).forEach(([id, p]) => list.append(el('button', { class: 'pr', onclick: () => openSession({ kind: 'free', title: p.t, steps: [{ type: 'practice', free: true, pid: id }] }) },
      el('span', { class: 'ic' }, icon('play')), el('div', {}, el('strong', {}, p.t), p.prep ? el('div', { class: 'small muted' }, p.prep) : null), el('span', { class: 'small mono muted' }, `${p.min} min`))));
    list.append(el('button', { class: 'pr', onclick: () => openSession({ kind: 'free', title: 'Silent timer', steps: [{ type: 'practice', free: true, pid: 'silent', timerOnly: true }] }) },
      el('span', { class: 'ic' }, icon('timer')), el('div', {}, el('strong', {}, 'Silent timer'), el('div', { class: 'small muted' }, 'A bell to begin and end, nothing in between.')), el('span', { class: 'small mono muted' }, 'You choose')));
    scr.append(list);
    return scr;
  }

  // ================================================================ You
  function journalEntries() {
    const out = [];
    Object.entries(S.days).forEach(([n, m]) => Object.entries(m).forEach(([d, e]) => { if (e.done) out.push({ at: e.at, date: e.date, head: `Week ${n} · Day ${+d + 1} · ${e.pid ? P[e.pid].t : 'Practice'}${e.mins ? ' · ' + e.mins + ' min' : ''}`, text: [(e.moods || []).join(', '), e.note].filter(Boolean).join(' — ') }); }));
    Object.entries(S.inf).forEach(([n, m]) => Object.entries(m).forEach(([d, e]) => { if (e.done && e.note) out.push({ at: e.at, date: e.date, head: `Week ${n} · Day ${+d + 1} · Informal`, text: e.note }); }));
    Object.entries(S.free).forEach(([k, e]) => (e.list || []).forEach(x => out.push({ at: e.at, date: k, head: `${P[x.pid] ? P[x.pid].t : 'Practice'} · ${x.mins} min`, text: [(x.moods || []).join(', '), x.note].filter(Boolean).join(' — ') })));
    return out.sort((a, b) => b.at - a.at);
  }
  const encode = s => 'PC3.' + btoa(unescape(encodeURIComponent(stable(s))));
  const decode = c => JSON.parse(decodeURIComponent(escape(atob(c.trim().replace(/^PC\d\./, '')))));
  function copyText(text, msgEl, ta) {
    const fallback = () => { if (ta) { ta.focus(); ta.select(); } msgEl.textContent = 'Selected. Copy it with your keyboard or a long-press.'; };
    try { navigator.clipboard.writeText(text).then(() => { msgEl.textContent = 'Copied.'; }, fallback); } catch (e) { fallback(); }
  }
  function viewYou() {
    const st = streak(), J = journalEntries();
    const scr = el('div', { class: 'screen' }, topbar('You'),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('small', {}, 'Current streak'), el('b', {}, String(st)), el('small', {}, st === 1 ? 'day' : 'days')),
        el('div', { class: 'stat' }, el('small', {}, 'Best streak'), el('b', {}, String(bestStreak())), el('small', {}, 'days')),
        el('div', { class: 'stat' }, el('small', {}, 'Days practised'), el('b', {}, String(practiceDates().size)), el('small', {}, 'in total')),
        el('div', { class: 'stat' }, el('small', {}, 'Time practising'), el('b', {}, totalMinutes() < 60 ? `${totalMinutes()}m` : `${Math.floor(totalMinutes() / 60)}h ${totalMinutes() % 60}m`), el('small', {}, 'formal practice'))));
    const jl = el('ul', { class: 'journal' }, J.slice(0, 20).map(j => el('li', {}, el('div', { class: 'small mono muted' }, `${j.date ? shortDate(j.date) : ''} · ${j.head}`), j.text ? el('div', {}, j.text) : null)));
    const jmsg = el('span', { class: 'small', 'aria-live': 'polite' });
    scr.append(el('section', { class: 'card' }, el('div', { class: 'spread' }, el('h3', {}, 'Practice journal'), J.length ? el('button', { class: 'linkbtn', onclick: () => copyText(J.slice().reverse().map(j => `${j.date || ''}  ${j.head}${j.text ? '\n    ' + j.text : ''}`).join('\n'), jmsg) }, 'Copy all') : null),
      J.length ? jl : el('p', { class: 'muted' }, 'After each practice you can note how it went. Those notes collect here, and help when you fill in the course practice sheets.'), jmsg));

    const out = el('textarea', { class: 'code', readonly: true, 'aria-label': 'Your progress code' }); out.value = encode(S);
    const inp = el('textarea', { class: 'code', 'aria-label': 'Paste a progress code', placeholder: 'Paste a progress code here' });
    const m1 = el('span', { class: 'small', 'aria-live': 'polite' }), m2 = el('span', { class: 'small', 'aria-live': 'polite' });
    scr.append(el('section', { class: 'card' }, el('h3', {}, 'Your progress'), el('span', { class: 'sync', 'data-mode': mode }, el('i'), syncText()),
      el('details', {}, el('summary', {}, 'Move progress to another device'),
        el('div', { class: 'stack', style: 'margin-top:10px' }, el('p', { class: 'small' }, 'Copy this code on one device and paste it on the other. Progress from both is combined.'), out,
          el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => copyText(out.value, m1, out) }, 'Copy code'), m1), inp,
          el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => { try { const s = decode(inp.value); if (!s || !s.v) throw 0; S = merge(S, s); commit(); m2.textContent = 'Progress added.'; } catch (e) { m2.textContent = "That code didn't work. Copy the whole code, starting with PC."; } } }, 'Add this progress'), m2))),
      resetControl()));
    scr.append(el('footer', { class: 'about' },
      el('p', {}, 'Palouse Companion is an unofficial, open-source app for the free ', ext('Palouse Mindfulness', 'https://palousemindfulness.com/'), ' MBSR course by Dave Potter. Every video, reading and guided practice belongs to its creators and to Palouse Mindfulness Inc., and is shown from their sites. ', ext('Support the course', abs('/about-us/contributions.html')), '.'),
      el('p', {}, 'Difficult feelings can come up during this work. If they feel like too much, pause and talk to someone you trust or a counsellor. ', ext('Crisis lines by country', abs('/support/crisis-hotlines.html')), '.')));
    return scr;
  }
  function resetControl() {
    const wrap = el('div', { class: 'row small' });
    const ask = el('button', { class: 'linkbtn', onclick: () => { wrap.innerHTML = ''; wrap.append('This clears every tick and journal note on every device. ', el('button', { class: 'linkbtn', onclick: () => { const r = now(); S = blank(); S.resetAt = r; S.pendingAt = r; commit(); } }, 'Yes, clear it'), ' · ', el('button', { class: 'linkbtn', onclick: () => render() }, 'Keep it')); } }, 'Reset all progress');
    wrap.append(ask);
    return wrap;
  }

  // ================================================================ session player
  let session = null, sIdx = 0, media = null;
  const $s = () => document.getElementById('session');
  function openSession(sess, at) {
    session = sess;
    const first = sess.steps.findIndex(s => !stepDone(s));
    sIdx = at != null ? at : (first < 0 ? 0 : first);
    document.body.style.overflow = 'hidden';
    $s().hidden = false;
    buildSession();
  }
  function closeSession() {
    stopMedia();
    session = null; $s().hidden = true; $s().innerHTML = ''; document.body.style.overflow = '';
    render();
  }
  function buildSession() {
    const root = $s(); root.innerHTML = '';
    root.append(
      el('div', { class: 's-head' }, el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: closeSession }, icon('close')), el('div', { class: 'segs', id: 'segs' }), el('span', { class: 's-left', id: 'sleft' })),
      el('div', { class: 's-body', id: 'sbody' }),
      el('div', { class: 's-foot', id: 'sfoot' }));
    renderStep();
  }
  function updateSessionChrome() {
    if (!session) return;
    const segs = document.getElementById('segs'); if (!segs) return;
    segs.innerHTML = '';
    session.steps.forEach((s, i) => segs.append(el('span', { class: stepDone(s) ? 'done' : i === sIdx ? 'cur' : '', title: stepTitle(s) })));
    document.getElementById('sleft').textContent = session.steps.every(stepDone) ? 'Done' : `${hm(left(session))} left`;
    renderFoot();
  }
  function nextIndex() {
    const n = session.steps.length;
    for (let k = 1; k <= n; k++) { const i = (sIdx + k) % n; if (!stepDone(session.steps[i])) return i; }
    return -1;
  }
  function advance() {
    stopMedia();
    const i = nextIndex();
    if (i < 0 || (session.steps.length === 1 && stepDone(session.steps[0]))) return celebrate();
    sIdx = i; renderStep();
    document.getElementById('sbody').scrollTop = 0;
  }
  function renderStep() {
    stopMedia();
    const s = session.steps[sIdx], body = document.getElementById('sbody');
    body.innerHTML = '';
    const inner = el('div', { class: 's-inner' });
    body.append(inner);
    ({ video: stepVideo, read: stepRead, task: stepTask, finish: stepTask, practice: stepPractice, informal: stepInformal })[s.type](s, inner);
    updateSessionChrome();
  }
  let foot = { primary: null, secondary: null };
  function renderFoot() {
    const f = document.getElementById('sfoot'); if (!f || !session) return;
    const s = session.steps[sIdx], done = stepDone(s);
    const def = {
      video: done ? ['Next', advance] : ['Mark as watched', () => { setDone(s.key); commit({ render: false }); advance(); }],
      read: done ? ['Next', advance] : ["I've read it", () => { setDone(s.key); commit({ render: false }); advance(); }],
      task: done ? ['Next', advance] : ['Done', () => { setDone(s.key); commit({ render: false }); advance(); }],
      finish: done ? ['Next', advance] : ['Done', () => { setDone(s.key); commit({ render: false }); advance(); }],
      practice: done ? ['Next', advance] : ['Log practice', () => foot.logPractice && foot.logPractice()],
      informal: done ? ['Next', advance] : ['Save', () => foot.saveInformal && foot.saveInformal()]
    }[s.type];
    const last = session.steps.filter(x => !stepDone(x)).length <= (done ? 0 : 1);
    const label = done && nextIndex() < 0 ? 'Finish' : def[0];
    f.innerHTML = '';
    f.append(el('div', {},
      el('button', { class: 'btn ghost', onclick: () => { const i = nextIndex(); if (i < 0 || i === sIdx) closeSession(); else { sIdx = i; renderStep(); } } }, done || last ? 'Close' : (s.type === 'informal' ? 'Tonight' : 'Skip for now')),
      el('button', { class: 'btn big ' + (done ? 'sage' : 'primary'), onclick: done && nextIndex() < 0 ? celebrate : def[1] }, label)));
  }
  function head(s, inner, extra) {
    const it = s.key ? ITEMS[s.key] : null;
    inner.append(el('div', { class: 'stack', style: 'gap:6px' },
      el('span', { class: 'eyebrow' }, [stepKind(s), it && it.min ? `${it.approx ? '~' : ''}${it.min} min` : null, session.title].filter(Boolean).join(' · ')),
      el('h2', {}, stepTitle(s)),
      it && it.by ? el('p', { class: 'muted' }, it.by) : null, extra || null));
  }

  // ---- video
  let ytApi = null;
  function loadYT() {
    if (ytApi) return ytApi;
    ytApi = new Promise(res => { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); }; document.head.append(el('script', { src: 'https://www.youtube.com/iframe_api' })); });
    return ytApi;
  }
  async function ytPlayer(box, videoId, start, onState) {
    const slot = el('div'); box.append(slot);
    const YT = await loadYT();
    if (!box.isConnected) return null;
    return new YT.Player(slot, { videoId, playerVars: { start: Math.floor(start || 0), rel: 0, playsinline: 1, modestbranding: 1, cc_load_policy: 0 }, events: { onStateChange: e => onState(e, YT) } });
  }
  function stepVideo(s, inner) {
    const it = ITEMS[s.key];
    head(s, inner);
    if (HOSTED) {
      const box = el('div', { class: 'player' }); inner.append(box);
      const posLine = el('p', { class: 'small muted', id: 'vpos' }, posOf(s.key) && !isDone(s.key) ? `Picking up at ${mmss(posOf(s.key))}.` : 'Your place is saved as you watch.');
      inner.append(posLine);
      const m = { kind: 'yt', key: s.key, tick: null, player: null };
      media = m;
      ytPlayer(box, it.id, isDone(s.key) ? 0 : posOf(s.key), (e, YT) => {
        clearInterval(m.tick);
        if (e.data === YT.PlayerState.PLAYING) m.tick = setInterval(() => trackVideo(m), 5000);
        if (e.data === YT.PlayerState.PAUSED) trackVideo(m);
        if (e.data === YT.PlayerState.ENDED) { finishVideo(m); }
      }).then(p => { m.player = p; });
    } else {
      const pos = posOf(s.key);
      inner.append(el('div', { class: 'away' },
        el('p', {}, 'In the installed app this plays right here. In this preview, it opens in YouTube and you\'ll be asked how far you got when you come back.'),
        ext(pos ? `Resume at ${mmss(pos)} on YouTube` : 'Watch on YouTube', ytWatch(it.id, pos), () => markOpened(s.key), 'btn primary'),
        pos ? el('span', { class: 'pos' }, `Stopped at ${mmss(pos)}`) : null));
    }
  }
  function trackVideo(m) {
    if (!m.player || !m.player.getCurrentTime || isDone(m.key)) return;
    const t = m.player.getCurrentTime(), d = m.player.getDuration ? m.player.getDuration() : 0;
    if (!t) return;
    if (d && t / d >= 0.92) return finishVideo(m);
    setPos(m.key, t); commit({ render: false, delay: 15000 });
  }
  function finishVideo(m) {
    if (isDone(m.key)) return;
    setDone(m.key); commit({ render: false });
    updateSessionChrome();
    const pl = document.getElementById('vpos'); if (pl) pl.textContent = 'Watched. Tap Next when you\'re ready.';
  }

  // ---- reading + tasks
  function stepRead(s, inner) {
    const it = ITEMS[s.key];
    head(s, inner);
    if (HOSTED) {
      inner.append(el('iframe', { class: 'reader', src: abs(it.url), title: it.title, loading: 'lazy' }),
        el('p', { class: 'small muted' }, 'Shown from palousemindfulness.com. ', ext('Open in your browser', abs(it.url), null), ' if it\'s easier to read there.'));
    } else {
      inner.append(el('div', { class: 'away' }, el('p', {}, 'In the installed app this opens right here. In this preview it opens on the Palouse site.'), ext('Open the reading', abs(it.url), () => markOpened(s.key), 'btn primary')));
    }
  }
  function stepTask(s, inner) {
    const it = ITEMS[s.key];
    head(s, inner);
    inner.append(el('div', { class: 'away' }, el('div', { class: 'row' }, ext('Open', abs(it.url), () => markOpened(s.key), 'btn primary'), it.alt ? ext('Word version', abs(it.alt), null, 'btn') : null)));
  }

  // ---- formal practice
  let audioCtx = null;
  function bell(times = 1) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (let k = 0; k < times; k++) {
        const t0 = audioCtx.currentTime + k * 2.2;
        [[1, .5], [2.76, .18], [5.4, .08], [8.93, .04]].forEach(([mult, g]) => {
          const o = audioCtx.createOscillator(), v = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = 262 * mult;
          v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g * .5, t0 + .01); v.gain.exponentialRampToValueAtTime(.0001, t0 + 6 / Math.sqrt(mult));
          o.connect(v).connect(audioCtx.destination); o.start(t0); o.stop(t0 + 6);
        });
      }
    } catch (e) {}
  }
  let wake = null;
  async function keepAwake(on) { try { if (on && navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); else if (!on && wake) { await wake.release(); wake = null; } } catch (e) {} }

  function dial(onToggle) {
    const R = 92, C2 = 2 * Math.PI * R;
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 210 210'); svg.setAttribute('class', 'r'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<circle cx="105" cy="105" r="${R}" fill="none" stroke="var(--line)" stroke-width="8"/><circle cx="105" cy="105" r="${R}" fill="none" stroke="var(--sage)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C2}" stroke-dashoffset="${C2}"/>`;
    const arc = svg.lastChild;
    const btn = el('button', { class: 'play', 'aria-label': 'Play', onclick: onToggle }, icon('play'));
    const time = el('div', { class: 'time' }, '0:00');
    const root = el('div', { class: 'dial' }, el('div', { class: 'ring' }, svg, btn), time);
    return {
      root, time,
      set(frac, label, playing) { arc.setAttribute('stroke-dashoffset', String(C2 * (1 - Math.min(1, Math.max(0, frac))))); time.textContent = label; btn.innerHTML = ''; btn.append(icon(playing ? 'pause' : 'play')); btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
    };
  }
  function stepPractice(s, inner) {
    const ids = s.free ? [s.pid] : dayPractice(s.n, s.d);
    const logged = !s.free && dayEnt(s.n, s.d).done ? dayEnt(s.n, s.d) : null;
    if (!s.pid || !ids.includes(s.pid)) s.pid = logged && logged.pid && ids.includes(logged.pid) ? logged.pid : (ids.length === 1 ? ids[0] : null);
    const W8 = !s.free && s.n === 8;
    if (!s.pid) {
      inner.append(el('div', { class: 'stack', style: 'gap:6px' }, el('span', { class: 'eyebrow' }, `Formal practice · ${session.title}`), el('h2', {}, W8 ? 'Your own practice' : 'Choose today\'s practice'),
        el('p', { class: 'muted' }, s.n === 5 && s.d < 2 ? 'Pick the one that fits what you\'re working with.' : 'Any practice you\'ve learned so far. Go with what feels right today.')));
      const ch = el('div', { class: 'choices' });
      ids.forEach(id => ch.append(el('button', { class: 'pr', onclick: () => { s.pid = id; renderStep(); } }, el('span', { class: 'ic' }, icon('play')), el('div', {}, el('strong', {}, P[id].t), P[id].prep ? el('div', { class: 'small muted' }, P[id].prep) : null), el('span', { class: 'small mono muted' }, `${P[id].min} min`))));
      inner.append(ch);
      foot.logPractice = () => { const t = ch.querySelector('button'); t && t.focus(); };
      return;
    }
    const p = P[s.pid];
    inner.append(el('div', { class: 'stack', style: 'gap:6px' },
      el('span', { class: 'eyebrow' }, s.timerOnly ? 'Practise on your own' : `Formal practice · ${p.min} min · ${session.title}`),
      el('h2', {}, s.timerOnly ? 'Silent timer' : p.t),
      s.timerOnly ? null : p.prep ? el('p', { class: 'muted' }, p.prep) : null,
      ids.length > 1 ? el('button', { class: 'linkbtn', style: 'justify-self:start', onclick: () => { s.pid = null; s.chosen = false; renderStep(); } }, 'Choose a different practice') : null));
    if (logged) inner.append(el('p', { class: 'note' }, `Logged ${logged.date ? shortDate(logged.date) : ''}: ${logged.mins || 30} min${logged.note ? ' — ' + logged.note : ''}.`));

    // Modes
    const modes = [];
    if (!s.timerOnly) {
      if (HOSTED && p.video && (p.videoFirst || !p.audio)) modes.push(['video', 'Video']);
      if (HOSTED && p.audio) modes.push(['audio', 'Audio']);
      if (HOSTED && p.video && !(p.videoFirst || !p.audio)) modes.push(['video', 'Video + captions']);
      if (!HOSTED) modes.push(['away', 'Guided']);
    }
    modes.push(['timer', 'Timer only']);
    s.mode = modes.some(m => m[0] === s.mode) ? s.mode : modes[0][0];
    let played = 0;
    const area = el('div', { class: 'stack' });
    if (modes.length > 1) inner.append(el('div', { class: 'seg', role: 'group', 'aria-label': 'How to practise' }, modes.map(([id, label]) => el('button', { 'aria-pressed': s.mode === id ? 'true' : 'false', onclick: () => { s.mode = id; renderStep(); } }, label))));
    inner.append(area);

    const mins = el('input', { type: 'number', id: 'pmins', min: 1, max: 180, value: logged ? logged.mins || p.min : (s.timerOnly ? 20 : p.then ? p.min + p.then : p.min), inputmode: 'numeric', style: 'width:5.5em' });
    const finished = (m) => { played = Math.max(played, m); mins.value = String(Math.max(+mins.value || 0, Math.round(played)) || p.min); };

    if (s.mode === 'audio') {
      const a = new Audio(abs(p.audio)); a.preload = 'metadata';
      const dl = dial(() => { if (a.paused) { a.play(); keepAwake(true); } else a.pause(); });
      const upd = () => dl.set(a.duration ? a.currentTime / a.duration : 0, a.duration ? `${mmss(a.currentTime)} / ${mmss(a.duration)}` : mmss(a.currentTime), !a.paused);
      ['timeupdate', 'play', 'pause', 'loadedmetadata'].forEach(ev => a.addEventListener(ev, upd));
      a.addEventListener('ended', () => { keepAwake(false); finished(a.duration / 60); upd(); if (p.then) area.append(el('div', { class: 'note' }, `Guidance done. Keep walking on your own for another ${p.then} minutes.`, el('div', { class: 'row', style: 'margin-top:8px' }, el('button', { class: 'btn', onclick: () => { s.mode = 'timer'; s.timerMin = p.then; renderStep(); } }, `Start a ${p.then}-minute timer`)))); });
      area.append(dl.root, el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn ghost', onclick: () => { a.currentTime = Math.max(0, a.currentTime - 15); } }, '−15 s'),
        el('button', { class: 'btn ghost', onclick: () => { a.currentTime = Math.min(a.duration || 0, a.currentTime + 15); } }, '+15 s')));
      upd();
      media = { kind: 'audio', stop: () => { a.pause(); finished(a.currentTime / 60); keepAwake(false); } };
    } else if (s.mode === 'video') {
      const box = el('div', { class: 'player' }); area.append(box);
      const m = { kind: 'yt', player: null };
      media = { kind: 'ytp', stop: () => { try { finished(m.player.getCurrentTime() / 60); m.player.destroy(); } catch (e) {} } };
      ytPlayer(box, p.video, 0, (e, YT) => { if (e.data === YT.PlayerState.ENDED) finished(m.player.getDuration() / 60); }).then(pl => { m.player = pl; });
    } else if (s.mode === 'away') {
      area.append(el('div', { class: 'away' },
        el('p', {}, 'In the installed app the guided audio plays right here. In this preview, open it on the Palouse site, or use the timer below the line.'),
        ext('Open the guided practice', abs(p.page), null, 'btn primary')));
    } else {
      let total = (s.timerMin || (s.free && s.timerOnly ? 20 : p.then || p.min)) * 60, endAt = 0, remain = total, iv = null;
      const dl = dial(() => {
        if (iv) { remain = Math.max(0, (endAt - now()) / 1000); clearInterval(iv); iv = null; keepAwake(false); draw(); }
        else { if (remain <= 0) remain = total; if (remain === total) bell(1); endAt = now() + remain * 1000; iv = setInterval(tickT, 250); keepAwake(true); draw(); }
      });
      const draw = () => dl.set(1 - remain / total, mmss(remain), !!iv);
      const tickT = () => { remain = Math.max(0, (endAt - now()) / 1000); draw(); if (remain <= 0) { clearInterval(iv); iv = null; bell(3); keepAwake(false); finished(total / 60); draw(); } };
      const setMin = m => { if (iv) return; total = Math.max(60, Math.min(120 * 60, m * 60)); remain = total; s.timerMin = total / 60; draw(); };
      area.append(dl.root, el('div', { class: 'row', style: 'justify-content:center' },
        el('button', { class: 'btn ghost', onclick: () => setMin(total / 60 - 5) }, '−5 min'),
        el('button', { class: 'btn ghost', onclick: () => setMin(total / 60 + 5) }, '+5 min')),
        el('p', { class: 'small muted', style: 'text-align:center' }, 'A bell sounds at the start and three at the end.'));
      draw();
      media = { kind: 'timer', stop: () => { if (iv) { clearInterval(iv); finished((total - Math.max(0, (endAt - now()) / 1000)) / 60); } keepAwake(false); } };
    }

    // Reflection (the app's version of the practice sheet)
    const MOODS = ['Settled', 'Restless', 'Sleepy', 'Distracted', 'Uncomfortable', 'Kind to myself'];
    const chosen = new Set(logged ? logged.moods || [] : []);
    const note = el('textarea', { id: 'pnote', placeholder: 'Anything you noticed? (optional)', 'aria-label': 'Practice note' }); note.value = logged ? logged.note || '' : '';
    inner.append(el('div', { class: 'reflect' },
      el('h3', {}, 'After you practise'),
      el('div', { class: 'row' }, MOODS.map(m => { const b = el('button', { class: 'chip', 'aria-pressed': chosen.has(m) ? 'true' : 'false', onclick: () => { chosen.has(m) ? chosen.delete(m) : chosen.add(m); b.setAttribute('aria-pressed', chosen.has(m) ? 'true' : 'false'); } }, m); return b; })),
      note,
      el('label', { class: 'row small', for: 'pmins' }, 'Minutes practised', mins)));
    foot.logPractice = () => {
      if (media && media.stop) { media.stop(); media = null; }
      const rec = { pid: s.pid, mins: Math.max(1, Math.round(+mins.value || p.min)), moods: [...chosen], note: note.value.trim() };
      if (s.free) { logFree(s.pid, rec.mins, rec); s.logged = true; } else logDay(s.n, s.d, rec);
      commit({ render: false });
      advance();
    };
  }

  // ---- informal practice
  function stepInformal(s, inner) {
    const w = W[s.n], e = infEnt(s.n, s.d);
    inner.append(el('div', { class: 'stack', style: 'gap:6px' }, el('span', { class: 'eyebrow' }, `Informal practice · ${session.title}`), el('h2', {}, s.n === 8 ? 'Looking back' : 'Through the day'), el('p', {}, w.informal)));
    const ta = el('textarea', { id: 'inote', 'aria-label': w.prompt, placeholder: 'A sentence or two is plenty.' }); ta.value = e.note || '';
    inner.append(el('div', { class: 'reflect' }, el('h3', {}, w.prompt), ta,
      el('p', { class: 'small muted' }, 'If the moment hasn\'t happened yet, tap Tonight and come back before bed.')));
    foot.saveInformal = () => { logInf(s.n, s.d, ta.value.trim()); commit({ render: false }); advance(); };
  }

  function stopMedia() {
    if (media && media.kind === 'yt') { try { trackVideo(media); media.player && media.player.destroy(); } catch (e) {} clearInterval(media.tick); }
    else if (media && media.stop) { try { media.stop(); } catch (e) {} }
    media = null; foot.logPractice = null; foot.saveInformal = null;
  }

  function celebrate() {
    stopMedia();
    const body = document.getElementById('sbody'); body.innerHTML = '';
    const st = streak(), sess = session;
    const tomorrow = sess.kind === 'day' && sess.n && sess.d < DAYS - 1 ? `Tomorrow: Day ${sess.d + 2}, ${practiceLabel(sess.n, sess.d + 1)}.` : sess.kind === 'day' && sess.n ? `That was the last practice day of Week ${sess.n}.` : '';
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 140 140'); svg.setAttribute('class', 'big'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<circle cx="70" cy="70" r="60" fill="none" stroke="var(--line)" stroke-width="8"/><circle class="fill" cx="70" cy="70" r="60" fill="none" stroke="var(--sage)" stroke-width="8" stroke-linecap="round" transform="rotate(-90 70 70)"/><path d="M48 72l15 15 30-32" fill="none" stroke="var(--sage)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>';
    body.append(el('div', { class: 's-inner' }, el('div', { class: 'cele' }, svg,
      el('h1', {}, sess.kind === 'day' ? (sess.n ? `Day ${sess.d + 1} complete` : 'You\'re set up') : sess.kind === 'free' ? 'Practice logged' : 'All caught up'),
      st ? el('span', { class: 'pill hot' }, icon('leaf'), `${st}-day streak`) : null,
      tomorrow ? el('p', { class: 'muted' }, tomorrow) : null,
      sess.n === 0 && sess.kind === 'day' ? el('p', { class: 'muted' }, 'Week 1 is ready when you are.') : null)));
    updateSessionChrome();
    const f = document.getElementById('sfoot'); f.innerHTML = '';
    f.append(el('div', {}, el('span'), el('button', { class: 'btn big sage', onclick: closeSession }, 'Done')));
  }

  // ================================================================ leaving the app (preview fallback) + coming back
  function markOpened(key) {
    const it = ITEMS[key];
    S.pending = { kind: 'item', key, openedAt: now(), from: posOf(key) }; S.pendingAt = now();
    S.last = { week: it.week, label: `Opened “${it.title}”`, at: now() };
    touchWeek(it.week);
    commit({ render: false });
  }
  let sheetFor = 0;
  function closeSheet(clear) {
    document.getElementById('sheet').hidden = true;
    if (clear) { S.pending = null; S.pendingAt = now(); commit({ render: false }); }
    render();
    if (session) { renderFoot(); if (clear && stepDone(session.steps[sIdx])) advance(); else renderStep(); }
  }
  function checkPending() {
    const p = S.pending;
    if (!p || document.visibilityState === 'hidden') return;
    const age = now() - p.openedAt;
    if (age < 20000) { clearTimeout(checkPending.t); checkPending.t = setTimeout(checkPending, 20000 - age + 200); return; }
    if (sheetFor === S.pendingAt && !document.getElementById('sheet').hidden) return;
    const it = ITEMS[p.key];
    if (!it || isDone(it.key)) { S.pending = null; S.pendingAt = now(); commit({ render: false }); return; }
    sheetFor = S.pendingAt;
    const away = Math.max(1, Math.round(age / 60000));
    const body = document.getElementById('sheetBody'); body.innerHTML = '';
    const later = el('button', { class: 'linkbtn', onclick: () => { document.getElementById('sheet').hidden = true; } }, 'Ask me later');
    if (it.kind === 'video') {
      const guess = Math.max(1, Math.min(it.min - 1, Math.round((p.from || 0) / 60) + away));
      const inp = el('input', { type: 'number', id: 'stopMin', min: 0, max: it.min + 5, value: guess, inputmode: 'numeric' });
      body.append(el('h3', { id: 'sheetH' }, `Back from “${it.title}”?`),
        el('p', { class: 'small muted' }, `You opened it ${ago(p.openedAt)}${p.from ? ` at ${mmss(p.from)}` : ''}. It's ${it.min} minutes long.`),
        el('div', { class: 'row' }, el('button', { class: 'btn sage', onclick: () => { setDone(it.key); closeSheet(true); } }, 'I finished it')),
        el('div', { class: 'row' }, el('label', { for: 'stopMin', class: 'row' }, 'I stopped at', inp, 'min'), el('button', { class: 'btn', onclick: () => { setPos(it.key, (parseFloat(inp.value) || 0) * 60); closeSheet(true); } }, 'Save my place')),
        el('div', { class: 'row small' }, el('button', { class: 'linkbtn', onclick: () => closeSheet(true) }, "I didn't watch it"), ' · ', later));
    } else {
      body.append(el('h3', { id: 'sheetH' }, `Finished “${it.title}”?`), el('p', { class: 'small muted' }, `You opened it ${ago(p.openedAt)}.`),
        el('div', { class: 'row' }, el('button', { class: 'btn sage', onclick: () => { setDone(it.key); closeSheet(true); } }, 'Yes, done'), el('button', { class: 'btn', onclick: () => closeSheet(true) }, 'Not yet'), later));
    }
    document.getElementById('sheet').hidden = false;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkPending(); else if (media && media.kind === 'yt') trackVideo(media); });
  window.addEventListener('focus', checkPending);
  window.addEventListener('pageshow', checkPending);

  // ================================================================ boot
  const local = loadLocal();
  if (local) S = merge(blank(), local);
  if (saveLocal()) mode = 'local';
  render();
  checkPending();
  initCloud();
})();
