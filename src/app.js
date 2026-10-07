(() => {
  'use strict';
  const C = JSON.parse(document.getElementById('course-data').textContent);
  const W = C.weeks;
  const abs = u => /^https?:/.test(u) ? u : C.site + u;
  const now = () => Date.now();
  const DAY = 86400000;
  // Inline YouTube needs a normal web origin (GitHub Pages, an app web view). Sandboxed previews open YouTube instead.
  const canEmbed = /^https?:$/.test(location.protocol) && !/claude|anthropic/.test(location.hostname);

  // ---------------------------------------------------------------- course index
  const readMin = r => r.min || C.readingMinutesEstimate;
  const ytUrl = (id, list, pos) => `https://www.youtube.com/watch?v=${id}${list ? '&list=' + list : ''}${pos > 5 ? '&t=' + Math.floor(pos) + 's' : ''}`;
  const ITEMS = {}, ORDER = {};
  W.forEach(w => {
    const list = [];
    (w.steps || []).forEach((s, i) => list.push({ key: `0s${i}`, kind: 'step', title: s.t, by: s.by, url: abs(s.url), alt: s.alt && abs(s.alt), min: s.min, optional: /optional/i.test(s.t) }));
    (w.videos || []).forEach((v, i) => list.push({ key: `${w.n}v${i}`, kind: 'video', title: v.t, by: v.by, id: v.id, min: v.min, approx: v.approx }));
    (w.readings || []).forEach((r, i) => list.push({ key: `${w.n}r${i}`, kind: 'read', title: r.t, by: (r.first ? 'Read this first. ' : '') + (r.by || ''), url: abs(r.url), min: readMin(r) }));
    (w.finish || []).forEach((f, i) => list.push({ key: `8f${i}`, kind: 'finish', title: f.t, by: f.by, url: abs(f.url), optional: i > 0 }));
    list.forEach(x => { x.week = w.n; ITEMS[x.key] = x; });
    ORDER[w.n] = list;
  });
  const hasLog = w => w.n >= 1 && w.n <= 7;
  const DAYS = C.practiceDaysPerWeek;
  const PRACTICE_MIN = C.practiceMinutesPerDay + C.informalMinutesPerDay;
  const kindLabel = { video: 'Video', read: 'Reading', step: 'Getting started', finish: 'Finishing up' };

  // ---------------------------------------------------------------- state + merge
  // Every entry carries its own timestamp, so progress from two devices merges cleanly (latest change wins per item).
  const blank = () => ({ v: 2, items: {}, days: {}, weekStart: {}, pending: null, pendingAt: 0, last: null, resetAt: 0 });
  let S = blank();

  const stable = o => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
  function merge(a, b) {
    a = a || blank(); b = b || blank();
    const R = Math.max(a.resetAt || 0, b.resetAt || 0);
    const out = blank(); out.resetAt = R;
    const live = e => e && Math.max(e.at || 0, e.posAt || 0) >= R;
    const later = (x, y, f = 'at') => !live(x) ? (live(y) ? y : null) : !live(y) ? x : ((y[f] || 0) > (x[f] || 0) ? y : x);
    const keys = (p, q) => [...new Set([...Object.keys(p || {}), ...Object.keys(q || {})])];
    for (const k of keys(a.items, b.items)) {
      const x = a.items?.[k], y = b.items?.[k];
      const d = later(x, y, 'at'); if (!d) continue;
      const e = { done: !!d.done, at: d.at || 0 };
      const withPos = [x, y].filter(z => live(z) && z.posAt).sort((p, q) => q.posAt - p.posAt)[0];
      if (withPos) { e.pos = withPos.pos; e.posAt = withPos.posAt; }
      out.items[k] = e;
    }
    for (const w of keys(a.days, b.days)) {
      const dd = {};
      for (const d of keys(a.days?.[w], b.days?.[w])) { const e = later(a.days?.[w]?.[d], b.days?.[w]?.[d]); if (e) dd[d] = { ...e }; }
      if (Object.keys(dd).length) out.days[w] = dd;
    }
    for (const w of keys(a.weekStart, b.weekStart)) {
      const vals = [a.weekStart?.[w], b.weekStart?.[w]].filter(t => t && t >= R);
      if (vals.length) out.weekStart[w] = Math.min(...vals);
    }
    const pa = (a.pendingAt || 0) >= R ? a : null, pb = (b.pendingAt || 0) >= R ? b : null;
    const pw = !pa ? pb : !pb ? pa : ((pb.pendingAt || 0) > (pa.pendingAt || 0) ? pb : pa);
    if (pw) { out.pending = pw.pending; out.pendingAt = pw.pendingAt; }
    out.last = later(a.last, b.last);
    return out;
  }
  function migrateV1(o) {
    const s = blank();
    Object.keys(o.done || {}).forEach(k => { if (o.done[k]) s.items[k] = { done: true, at: 1 }; });
    Object.entries(o.days || {}).forEach(([w, arr]) => (arr || []).forEach((v, d) => { if (v) { (s.days[w] = s.days[w] || {})[d] = { done: true, at: 1 }; } }));
    return s;
  }

  // ---------------------------------------------------------------- persistence
  // cloud: the viewer's private record in this artifact's store (follows them across devices on claude.ai)
  // local: this browser's storage (GitHub Pages / app); memory: nothing persists
  const LKEY = 'palouse-companion-v2';
  let mode = 'memory', ref = null, writing = false, again = false, timer = null, dueAt = 0, lastRemote = '';
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LKEY);
      if (raw) return JSON.parse(raw);
      const old = localStorage.getItem('palouse-companion-v1');
      if (old) return migrateV1(JSON.parse(old));
    } catch (e) {}
    return null;
  }
  function saveLocal() {
    try { localStorage.setItem(LKEY, stable(S)); if (mode === 'memory') { mode = 'local'; } return true; } catch (e) { return false; }
  }
  function schedule(delay = 800) {
    if (!ref) return;
    const due = now() + delay;
    if (timer && dueAt <= due) return;
    clearTimeout(timer); dueAt = due;
    timer = setTimeout(flush, delay);
  }
  async function flush() {
    timer = null;
    if (!ref) return;
    if (writing) { again = true; return; }
    writing = true;
    const snapshot = stable(S);
    try {
      await ref.set({ state: JSON.parse(snapshot), savedAt: now() });
      lastRemote = snapshot;
    } catch (e) {
      if (e && e.code === 'unavailable') { setTimeout(() => schedule(0), 1500 + Math.random() * 2000); }
      else { ref = null; mode = saveLocal() ? 'local' : 'memory'; syncNote = 'Your account copy could not be updated, so progress is saved in this browser.'; showSync(); }
    }
    writing = false;
    if (again) { again = false; schedule(); }
  }
  function applyRemote(st) {
    const rj = stable(st);
    if (rj === lastRemote) return;
    lastRemote = rj;
    const merged = merge(S, st);
    const mj = stable(merged);
    const changed = mj !== stable(S);
    S = merged; saveLocal();
    if (changed) refresh(true);
    if (mj !== rj) schedule();
  }
  let syncNote = '';
  async function initCloud() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      const r = db.doc(`data/users/${uid}/progress`);
      const snap = await r.get();
      ref = r; mode = 'cloud';
      if (snap.exists && snap.data() && snap.data().state) applyRemote(snap.data().state);
      else if (hasAnyProgress()) schedule(0);
      showSync();
      r.onSnapshot(sn => {
        if (sn.metadata && sn.metadata.hasPendingWrites) return;
        if (sn.exists && sn.data() && sn.data().state) applyRemote(sn.data().state);
      }, () => {});
      checkPending();
    } catch (e) { /* stay on local */ }
  }
  function showSync() {
    const el = document.getElementById('sync'), t = document.getElementById('syncText');
    el.dataset.mode = mode;
    t.textContent = syncNote || ({
      cloud: 'Progress saved to your account · pick up on any device',
      local: 'Progress saved in this browser · move it with a progress code',
      memory: 'Progress is not being saved here · copy a progress code before you leave'
    })[mode];
  }
  function hasAnyProgress() { return Object.keys(S.items).length || Object.keys(S.days).length; }
  function commit({ render = true, delay } = {}) {
    saveLocal(); schedule(delay); showSync();
    if (render) refresh();
  }

  // ---------------------------------------------------------------- progress model
  const ent = k => S.items[k] || {};
  const isDone = k => !!ent(k).done;
  const posOf = k => ent(k).pos || 0;
  const today = () => new Date().toLocaleDateString('en-CA');
  function touchWeek(w) { if (!S.weekStart[w]) S.weekStart[w] = now(); }
  function setDone(k, v) {
    const it = ITEMS[k];
    S.items[k] = { ...ent(k), done: v, at: now() };
    if (v) { delete S.items[k].pos; delete S.items[k].posAt; S.last = { week: it.week, label: (it.kind === 'video' ? 'Watched ' : it.kind === 'read' ? 'Read ' : 'Did ') + `“${it.title}”`, at: now() }; }
    touchWeek(it.week);
  }
  function setPos(k, sec) {
    const it = ITEMS[k];
    S.items[k] = { ...ent(k), pos: Math.max(0, Math.round(sec)), posAt: now() };
    S.last = { week: it.week, label: `Watching “${it.title}”`, at: now() };
    touchWeek(it.week);
  }
  const dayEnt = (w, d) => (S.days[w] || {})[d] || {};
  const daysDone = w => Array.from({ length: DAYS }, (_, d) => dayEnt(w, d)).filter(e => e.done).length;
  const loggedToday = w => Array.from({ length: DAYS }, (_, d) => dayEnt(w, d)).some(e => e.done && e.date === today());
  function setDay(w, d, v) {
    S.days[w] = { ...(S.days[w] || {}), [d]: { done: v, at: now(), date: v ? today() : null } };
    if (v) S.last = { week: w, label: `Logged practice, Week ${w} day ${d + 1}`, at: now() };
    touchWeek(w);
  }
  function required(w) { return ORDER[w].filter(x => !x.optional); }
  function weekProgress(w) {
    const req = required(w.n);
    const done = req.filter(x => isDone(x.key)).length + (hasLog(w) ? daysDone(w.n) : 0);
    const total = req.length + (hasLog(w) ? DAYS : 0);
    return total ? done / total : 0;
  }
  function minutesLeft(w) {
    let m = required(w.n).filter(x => !isDone(x.key)).reduce((a, x) => a + (x.min || 0) - (x.kind === 'video' ? Math.floor(posOf(x.key) / 60) : 0), 0);
    if (hasLog(w)) m += (DAYS - daysDone(w.n)) * PRACTICE_MIN;
    return Math.max(0, m);
  }
  // "Where you left off": the week you were last active in, or the next one once it's complete.
  function activeWeek() {
    const lastW = S.last ? S.last.week : null;
    if (lastW == null) { const f = W.find(w => weekProgress(w) < 1); return f ? f.n : 8; }
    if (weekProgress(W[lastW]) >= 1) { const nx = W.find(w => w.n > lastW && weekProgress(w) < 1); return nx ? nx.n : lastW; }
    return lastW;
  }
  const nextItem = w => required(w).find(x => !isDone(x.key));
  function behind(w) {
    const out = [];
    W.filter(x => x.n < w).forEach(x => {
      const items = required(x.n).filter(i => !isDone(i.key));
      const days = hasLog(x) ? DAYS - daysDone(x.n) : 0;
      if (items.length || days) out.push({ w: x.n, items, days });
    });
    return out;
  }

  // ---------------------------------------------------------------- formatting
  const hm = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function ago(t) {
    const m = Math.round((now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  const shortDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const weekName = n => n === 0 ? 'Getting Started' : `Week ${n}`;

  // ---------------------------------------------------------------- DOM helpers
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n[k] = v;
      else n.setAttribute(k, v);
    }
    kids.flat().forEach(k => k != null && k !== false && n.append(k));
    return n;
  };
  const ext = (text, href, onopen, cls) => el('a', { href, target: '_blank', rel: 'noopener', class: cls, onclick: onopen ? () => { onopen(); } : null }, text);
  const tick = () => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.innerHTML = '<path d="M3 8.5l3.2 3L13 4.5"/>'; return s; };

  // Opening something outside the page: remember it, then ask about it when the person comes back.
  function markOpened(key) {
    const it = ITEMS[key];
    S.pending = { kind: 'item', key, openedAt: now(), from: posOf(key) }; S.pendingAt = now();
    S.last = { week: it.week, label: `Opened “${it.title}”`, at: now() };
    touchWeek(it.week);
    commit({ render: false });
  }
  function markPlaylist(w) {
    S.pending = { kind: 'playlist', week: w, openedAt: now() }; S.pendingAt = now();
    S.last = { week: w, label: `Opened the Week ${w} playlist`, at: now() };
    touchWeek(w);
    commit({ render: false });
  }
  const watchHref = it => ytUrl(it.id, W[it.week].playlist, posOf(it.key));

  // ---------------------------------------------------------------- view state
  let view = 0;

  // ---------------------------------------------------------------- resume card
  function renderResume() {
    const box = document.getElementById('resume');
    box.innerHTML = '';
    const aw = activeWeek(), w = W[aw], nx = nextItem(aw);
    const gapDays = S.last ? Math.floor((now() - S.last.at) / DAY) : 0;

    box.append(el('span', { class: 'eyebrow', id: 'resumeH' }, S.last ? `Pick up where you left off · ${weekName(aw)}` : 'Start here'));
    if (S.last) box.append(el('p', { class: 'small muted' }, `Last time: ${S.last.label}, ${ago(S.last.at)}.`));
    if (gapDays >= 4) box.append(el('p', { class: 'note' }, `Welcome back. A ${gapDays}-day gap is common and you don't need to restart. Carry on from here, and if it helps, repeat a practice you know before moving on.`));

    if (nx) {
      const pos = posOf(nx.key);
      box.append(el('div', { class: 'what' }, nx.title));
      const meta = el('div', { class: 'meta' },
        el('span', {}, `${kindLabel[nx.kind]}${nx.min ? ' · ' + (nx.approx ? '~' : '') + nx.min + ' min' : ''}`),
        nx.by ? el('span', {}, nx.by) : null,
        pos ? el('span', { class: 'pos' }, `Stopped at ${mmss(pos)}`) : null);
      box.append(meta);
      const row = el('div', { class: 'row' });
      if (nx.kind === 'video') {
        if (canEmbed) row.append(el('button', { class: 'btn primary', onclick: () => { goWeek(aw); setTimeout(() => playHere(nx.key), 50); } }, pos ? `Resume at ${mmss(pos)}` : 'Play'));
        else row.append(ext(pos ? `Resume at ${mmss(pos)} on YouTube` : 'Watch on YouTube', watchHref(nx), () => markOpened(nx.key), 'btn primary'));
      } else {
        row.append(ext(nx.kind === 'read' ? 'Open reading' : 'Open', nx.url, () => markOpened(nx.key), 'btn primary'));
      }
      row.append(el('button', { class: 'btn', onclick: () => { setDone(nx.key, true); commit(); } }, 'Mark done'));
      if (view !== aw) row.append(el('button', { class: 'linkbtn', onclick: () => goWeek(aw) }, `Open ${weekName(aw)}`));
      box.append(row);
    } else if (hasLog(w) && daysDone(aw) < DAYS) {
      box.append(el('div', { class: 'what' }, `${weekName(aw)}: videos and reading done`));
      box.append(el('p', {}, `${DAYS - daysDone(aw)} practice ${DAYS - daysDone(aw) === 1 ? 'day' : 'days'} left before Week ${aw + 1}.`));
    } else if (aw < 8) {
      const start = S.weekStart[aw];
      const ready = !start || now() - start >= 7 * DAY;
      box.append(el('div', { class: 'what' }, `${weekName(aw)} complete`));
      box.append(el('p', {}, ready ? `You're ready for Week ${aw + 1}.` : `The course asks for at least seven days per week, so Week ${aw + 1} opens up from ${shortDate(start + 7 * DAY)}. Keep practising until then.`));
      box.append(el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => goWeek(aw + 1) }, `Go to Week ${aw + 1}`)));
    } else {
      box.append(el('div', { class: 'what' }, 'Course complete. Well done.'));
      box.append(el('p', {}, 'Keep the practices that work for you, and request your certificate if you want one.'));
    }

    if (hasLog(w) && (nx || daysDone(aw) < DAYS)) {
      const d = Array.from({ length: DAYS }, (_, i) => i).find(i => !dayEnt(aw, i).done);
      const line = loggedToday(aw)
        ? el('p', { class: 'small' }, '✓ Today\'s practice is logged.')
        : d != null ? el('div', { class: 'row small' }, el('span', {}, `Today's practice: ${planFor(aw, d)}, about 30 min.`), el('button', { class: 'btn sage', onclick: () => { setDay(aw, d, true); commit(); } }, 'Log it')) : null;
      if (line) box.append(line);
    }
    if (aw > 0) box.append(el('p', { class: 'small muted mono' }, `About ${hm(minutesLeft(w))} left in ${weekName(aw)}${hasLog(w) ? ', including practice' : ''}.`));

    const bh = behind(aw);
    if (bh.length) {
      const b = el('div', { class: 'behind' }, el('strong', {}, 'Still open from earlier: '));
      bh.forEach((x, i) => {
        const bits = [];
        const v = x.items.filter(i => i.kind === 'video').length, r = x.items.filter(i => i.kind !== 'video').length;
        if (v) bits.push(`${v} video${v > 1 ? 's' : ''}`);
        if (r) bits.push(`${r} ${x.w === 0 ? 'step' : 'reading'}${r > 1 ? 's' : ''}`);
        if (x.days) bits.push(`${x.days} practice day${x.days > 1 ? 's' : ''}`);
        b.append(i ? ' · ' : '', el('button', { onclick: () => goWeek(x.w) }, weekName(x.w)), ` (${bits.join(', ')})`);
      });
      box.append(b);
    }
  }

  // ---------------------------------------------------------------- trail
  function drawTrail() {
    const svg = document.getElementById('trail');
    svg.innerHTML = '';
    const aw = activeWeek();
    const xs = W.map((_, i) => 40 + i * (640 / (W.length - 1)));
    const ys = W.map((_, i) => 62 - Math.sin(i * 0.9) * 16 - i * 2);
    let d = `M0 ${ys[0] + 6}`;
    xs.forEach((x, i) => { const px = i ? xs[i - 1] : 0, py = i ? ys[i - 1] : ys[0] + 6, cx = (px + x) / 2; d += ` C${cx} ${py} ${cx} ${ys[i]} ${x} ${ys[i]}`; });
    const ly = ys[ys.length - 1];
    d += ` C700 ${ly} 700 ${ly - 4} 720 ${ly - 6}`;
    const mk = (tag, a) => { const n = document.createElementNS(NS, tag); Object.entries(a).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
    svg.append(mk('path', { d: d + ' L720 120 L0 120 Z', fill: 'var(--accent-soft)' }));
    svg.append(mk('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '3 5' }));
    W.forEach((w, i) => {
      const sel = view === i, p = weekProgress(w), r = sel ? 13 : 10;
      const g = mk('g', { class: 'stop' + (sel ? ' sel' : ''), role: 'listitem', tabindex: 0, 'aria-label': `${weekName(w.n)}: ${w.title}, ${Math.round(p * 100)}% done${w.n === aw ? ', where you left off' : ''}` });
      if (w.n === aw) g.append(mk('circle', { cx: xs[i], cy: ys[i], r: r + 5, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '2 3' }));
      g.append(mk('circle', { cx: xs[i], cy: ys[i], r, fill: p >= 1 ? 'var(--sage)' : 'var(--surface)', stroke: sel ? 'var(--ink)' : (p > 0 ? 'var(--sage)' : 'var(--line)'), 'stroke-width': sel ? 2 : 1.5 }));
      if (p > 0 && p < 1) { const c = 2 * Math.PI * r; g.append(mk('circle', { cx: xs[i], cy: ys[i], r, fill: 'none', stroke: 'var(--sage)', 'stroke-width': 3, 'stroke-dasharray': `${c * p} ${c}`, transform: `rotate(-90 ${xs[i]} ${ys[i]})` })); }
      const num = mk('text', { x: xs[i], y: ys[i] + 4, 'text-anchor': 'middle' });
      num.style.fill = p >= 1 ? 'var(--surface)' : 'var(--ink)'; num.style.fontSize = '11px';
      num.textContent = w.n === 0 ? '·' : w.n; g.append(num);
      const lab = mk('text', { x: xs[i], y: ys[i] + 32, 'text-anchor': 'middle' }); lab.textContent = w.short; g.append(lab);
      g.addEventListener('click', () => goWeek(i, true));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goWeek(i, true); } });
      svg.append(g);
    });
  }

  // ---------------------------------------------------------------- practice log
  function planFor(n, d) {
    switch (n) {
      case 1: return d === 0 ? 'Raisin Meditation' : 'Body Scan';
      case 2: return d % 2 === 0 ? 'Sitting Meditation' : 'Body Scan';
      case 3: return d === 5 ? 'Body Scan' : (d % 2 === 0 ? 'Mindful Yoga 1' : 'Sitting Meditation');
      case 4: return d % 2 === 0 ? 'Mindful Yoga 2' : 'Sitting Meditation';
      case 5: return d < 2 ? '“Turning Toward” Meditation' : 'a practice of your choice';
      case 6: return d === 0 ? 'Mountain or Lake Meditation' : 'Body Scan, Sitting or Yoga';
      case 7: return d === 0 ? 'Lovingkindness' : d === 1 ? 'Walking Meditation' : 'a practice of your choice';
      default: return '';
    }
  }
  function drawToday() {
    const w = W[view];
    const days = document.getElementById('days'), txt = document.getElementById('todayText'), meta = document.getElementById('todayMeta'), logRow = document.getElementById('logRow');
    days.innerHTML = ''; logRow.innerHTML = '';
    if (!hasLog(w)) {
      document.getElementById('todayH').textContent = w.n === 0 ? 'Before you begin' : 'Your own practice';
      txt.textContent = w.n === 0
        ? 'Plan for about 50 hours over eight or more weeks: around 2 hours of videos and reading each week, plus 30–35 minutes of practice a day. Spend at least seven days on each week.'
        : 'Week 8 has no practice log. Choose what you will keep doing, and how often, so it fits your life.';
      meta.textContent = '';
    } else {
      document.getElementById('todayH').textContent = `Week ${w.n} practice log`;
      const n = daysDone(w.n);
      const next = Array.from({ length: DAYS }, (_, i) => i).find(i => !dayEnt(w.n, i).done);
      const start = S.weekStart[w.n];
      meta.textContent = `${n} of ${DAYS} days${start ? ' · started ' + shortDate(start) : ''}`;
      if (n >= DAYS) txt.textContent = 'Six days logged. When the ideas from the videos and reading feel settled and at least a week has passed, move on.';
      else txt.textContent = `Day ${next + 1}: ${planFor(w.n, next)} (about 30 min), plus your informal practice and a few minutes on your sheet before bed.`;
      if (n < DAYS) {
        logRow.append(loggedToday(w.n)
          ? el('button', { class: 'btn', disabled: '' }, '✓ Logged today')
          : el('button', { class: 'btn sage', onclick: () => { setDay(w.n, next, true); commit(); } }, `Log today's practice (day ${next + 1})`));
      }
      for (let d = 0; d < DAYS; d++) {
        const e = dayEnt(w.n, d);
        const b = el('button', { class: 'day', 'aria-pressed': e.done ? 'true' : 'false', title: planFor(w.n, d), 'aria-label': `Day ${d + 1}: ${planFor(w.n, d)}${e.done ? ', done' : ''}` },
          String(d + 1), e.done && e.date ? el('small', {}, new Date(e.date + 'T12:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })) : null);
        b.onclick = () => { setDay(w.n, d, !e.done); commit(); };
        days.append(b);
      }
    }
    const p = weekProgress(w);
    document.getElementById('meter').style.width = (p * 100).toFixed(0) + '%';
    const all = W.reduce((a, x) => a + weekProgress(x), 0) / W.length;
    document.getElementById('meterText').textContent = `${weekName(w.n)} ${Math.round(p * 100)}% · Whole course ${Math.round(all * 100)}%`;
  }

  // ---------------------------------------------------------------- items (updated in place so a playing video is never interrupted)
  function itemRow(it) {
    const li = el('li', { class: 'item', 'data-key': it.key });
    const b = el('button', { class: 'check', 'aria-label': `Mark “${it.title}” as done` }, tick());
    b.onclick = () => { setDone(it.key, !isDone(it.key)); commit(); };
    const titleLink = it.kind === 'video'
      ? ext(it.title, watchHref(it), () => markOpened(it.key))
      : ext(it.title, it.url, () => markOpened(it.key));
    titleLink.dataset.role = 'title';
    const body = el('div', {}, el('div', { class: 't' }, titleLink), it.by ? el('div', { class: 'by' }, it.by) : null);
    const tools = el('div', { class: 'tools' });
    if (it.kind === 'video') {
      if (canEmbed) tools.append(el('button', { class: 'linkbtn', 'data-role': 'play', onclick: () => playHere(it.key) }, 'Play here'));
      tools.append(el('span', { class: 'pos', 'data-role': 'pos' }));
    }
    if (it.alt) tools.append(ext('Word version', it.alt));
    if (tools.childNodes.length) body.append(tools);
    li.append(b, body, el('span', { class: 'min' }, it.min ? `${it.approx ? '~' : ''}${it.min} min` : ''));
    return li;
  }
  function updateItems() {
    const aw = activeWeek(), nx = nextItem(aw);
    document.querySelectorAll('[data-key]').forEach(li => {
      const k = li.dataset.key, it = ITEMS[k], done = isDone(k), pos = posOf(k);
      li.classList.toggle('done', done);
      li.classList.toggle('next', !!nx && nx.key === k);
      li.querySelector('.check').setAttribute('aria-pressed', done ? 'true' : 'false');
      if (it.kind === 'video') {
        li.querySelector('[data-role="title"]').href = watchHref(it);
        const p = li.querySelector('[data-role="pos"]');
        p.textContent = !done && pos ? `Stopped at ${mmss(pos)}` : '';
        const play = li.querySelector('[data-role="play"]');
        if (play) play.textContent = !done && pos ? `Resume here at ${mmss(pos)}` : 'Play here';
      }
    });
  }

  // ---------------------------------------------------------------- embedded YouTube (hosted builds only)
  let ytApi = null, active = null;
  function loadYT() {
    if (ytApi) return ytApi;
    ytApi = new Promise(res => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
      document.head.append(el('script', { src: 'https://www.youtube.com/iframe_api' }));
    });
    return ytApi;
  }
  async function playHere(key) {
    const li = document.querySelector(`[data-key="${key}"]`);
    if (!li) return;
    if (active && active.key === key) return;
    if (active) stopActive();
    const box = el('div', { class: 'player' }), slot = el('div');
    box.append(slot); li.append(box);
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const YT = await loadYT();
    const it = ITEMS[key];
    const player = new YT.Player(slot, {
      videoId: it.id,
      playerVars: { start: Math.floor(posOf(key)), rel: 0, playsinline: 1, autoplay: 1, modestbranding: 1 },
      events: {
        onStateChange: e => {
          clearInterval(active && active.tick);
          if (e.data === YT.PlayerState.PLAYING) active.tick = setInterval(() => track(key, player), 5000);
          if (e.data === YT.PlayerState.PAUSED) track(key, player);
          if (e.data === YT.PlayerState.ENDED) { setDone(key, true); commit({ render: false }); refresh(); }
        }
      }
    });
    active = { key, player, box, tick: null };
  }
  function track(key, player) {
    const t = player.getCurrentTime ? player.getCurrentTime() : 0, d = player.getDuration ? player.getDuration() : 0;
    if (!t) return;
    if (d && t / d >= 0.92) { if (!isDone(key)) { setDone(key, true); commit({ render: false }); refresh(); } return; }
    setPos(key, t);
    commit({ render: false, delay: 15000 });
    updateItems();
  }
  function stopActive() {
    if (!active) return;
    try { track(active.key, active.player); } catch (e) {}
    clearInterval(active.tick);
    try { active.player.destroy(); } catch (e) {}
    active.box.remove(); active = null;
  }

  // ---------------------------------------------------------------- week view
  function renderWeek() {
    stopActive();
    const w = W[view], root = document.getElementById('week');
    root.innerHTML = '';
    root.append(el('div', { class: 'week-head' },
      el('span', { class: 'eyebrow' }, w.n === 0 ? 'Before Week 1' : `Week ${w.n} of 8 · ${w.subtitle}`),
      el('h2', {}, w.title),
      el('p', {}, w.summary)));

    if (w.n === 0) {
      const setup = w.steps.reduce((a, s) => a + s.min, 0);
      root.append(el('div', { class: 'budget' },
        el('div', { class: 'total' }, el('small', {}, 'Setup time'), el('b', {}, hm(setup)), el('small', {}, 'one sitting or two')),
        el('div', {}, el('small', {}, 'Whole course'), el('b', {}, '~50 h'), el('small', {}, 'over 8+ weeks')),
        el('div', {}, el('small', {}, 'Daily practice'), el('b', {}, '30–35 min'), el('small', {}, '6 days a week'))));
      root.append(el('section', { class: 'block' }, el('div', { class: 'block-head' }, el('h3', {}, 'Five steps to begin')), el('ul', { class: 'items' }, ORDER[0].map(itemRow))));
    } else {
      const vids = ORDER[w.n].filter(x => x.kind === 'video'), reads = ORDER[w.n].filter(x => x.kind === 'read');
      const vMin = vids.reduce((a, x) => a + x.min, 0), rMin = reads.reduce((a, x) => a + x.min, 0);
      const pMin = hasLog(w) ? PRACTICE_MIN * DAYS : 0;
      root.append(el('div', { class: 'budget', role: 'group', 'aria-label': 'Time needed this week' },
        el('div', {}, el('small', {}, 'Videos'), el('b', {}, hm(vMin)), el('small', {}, `${vids.length} videos`)),
        el('div', {}, el('small', {}, 'Reading'), el('b', {}, hm(rMin)), el('small', {}, `${reads.length} pieces, est.`)),
        el('div', {}, el('small', {}, 'Practice'), el('b', {}, pMin ? hm(pMin) : 'Your choice'), el('small', {}, pMin ? '~35 min × 6 days' : 'no log this week')),
        el('div', { class: 'total' }, el('small', {}, 'Left this week'), el('b', { id: 'leftMin' }, hm(minutesLeft(w))), el('small', {}, `of ≈ ${hm(vMin + rMin + pMin)} in total`))));
      if (w.note) root.append(el('p', { class: 'note' }, w.note));

      root.append(el('section', { class: 'block' },
        el('div', { class: 'block-head' }, el('h3', {}, 'Watch'),
          ext(`Play all on YouTube · ${hm(vMin)}`, `https://www.youtube.com/playlist?list=${w.playlist}`, () => markPlaylist(w.n), 'btn')),
        canEmbed ? null : el('p', { class: 'small muted' }, 'Videos open in YouTube. When you come back, you\'ll be asked whether you finished, so your place is kept.'),
        el('ul', { class: 'items' }, vids.map(itemRow))));

      root.append(el('section', { class: 'block' },
        el('div', { class: 'block-head' }, el('h3', {}, 'Read'), el('span', { class: 'mono muted', style: 'font-size:.8rem' }, 'times are estimates')),
        el('ul', { class: 'items' }, reads.map(itemRow))));

      const pr = el('section', { class: 'practice', 'aria-labelledby': `pr${w.n}` },
        el('h3', { id: `pr${w.n}` }, 'Daily practice'),
        el('div', {}, el('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Formal · about 30 min'), el('ul', {}, w.formal.map(f => el('li', {}, f)))),
        el('div', { class: 'sheets' }, w.formalLinks.map(l => ext('▶ ' + l.t, abs(l.url), null, 'btn'))),
        el('div', {}, el('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Informal · through the day'), el('p', {}, w.informal)));
      if (w.sheets || w.extraSheets) {
        const s = el('div', { class: 'sheets' });
        if (w.sheets) s.append(ext('Formal sheet (PDF)', abs(`/practice/${w.sheets}-formal.pdf`), null, 'btn'), ext('Informal sheet (PDF)', abs(`/practice/${w.sheets}-informal.pdf`), null, 'btn'));
        (w.extraSheets || []).forEach(x => s.append(ext(x.t + ' (PDF)', abs(x.url), null, 'btn')));
        pr.append(el('div', {}, el('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Practice sheets'), s,
          w.sheets ? el('p', { class: 'muted small', style: 'margin-top:6px' }, 'Word versions: ', ext('formal', abs(`/practice/${w.sheets}-formal.docx`)), ', ', ext('informal', abs(`/practice/${w.sheets}-informal.docx`)), '. Keep them if you want a certificate.') : null));
      }
      root.append(pr);

      if (w.finish) root.append(el('section', { class: 'block' }, el('div', { class: 'block-head' }, el('h3', {}, 'Finishing the course')), el('ul', { class: 'items' }, ORDER[8].filter(x => x.kind === 'finish').map(itemRow))));
      if (w.supplementary) root.append(el('details', {},
        el('summary', {}, `Optional extras (${w.supplementary.length})`),
        el('ul', {}, w.supplementary.map(s => el('li', {}, ext(s.t, abs(s.url)), s.by ? ` · ${s.by}` : '', s.min ? ` · ${s.min} min` : '')))));
    }

    const nav = el('div', { class: 'next' });
    nav.append(view > 0 ? el('button', { class: 'btn', onclick: () => goWeek(view - 1, true) }, '← ' + weekName(view - 1)) : el('span'));
    nav.append(ext('Open original page', abs(w.page), null, 'btn'));
    if (view < W.length - 1) nav.append(el('button', { class: 'btn', onclick: () => goWeek(view + 1, true) }, weekName(view + 1) + ' →'));
    root.append(nav);
    updateItems();
  }

  function goWeek(i, scroll) {
    stopActive();
    view = i;
    refresh(true);
    if (scroll) document.getElementById('week').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function refresh(rebuildWeek) {
    renderResume(); drawTrail(); drawToday();
    if (rebuildWeek && !active) renderWeek(); else { updateItems(); const lm = document.getElementById('leftMin'); if (lm && view > 0) lm.textContent = hm(minutesLeft(W[view])); }
    if (document.getElementById('backupBox').open) fillBackup();
  }

  // ---------------------------------------------------------------- welcome-back sheet
  let sheetFor = 0;
  function closeSheet(clear) {
    document.getElementById('sheet').hidden = true;
    if (clear) { S.pending = null; S.pendingAt = now(); commit(); }
  }
  function checkPending() {
    const p = S.pending;
    if (!p || document.visibilityState === 'hidden') return;
    const age = now() - p.openedAt;
    if (age < 20000) { clearTimeout(checkPending.t); checkPending.t = setTimeout(checkPending, 20000 - age + 200); return; }
    if (sheetFor === S.pendingAt && !document.getElementById('sheet').hidden) return;
    sheetFor = S.pendingAt;
    const away = Math.max(1, Math.round((now() - p.openedAt) / 60000));
    const body = document.getElementById('sheetBody');
    body.innerHTML = '';
    const later = el('button', { class: 'linkbtn', onclick: () => closeSheet(false) }, 'Ask me later');

    if (p.kind === 'playlist') {
      const vids = ORDER[p.week].filter(x => x.kind === 'video' && !isDone(x.key));
      if (!vids.length) { closeSheet(true); return; }
      let acc = 0;
      const boxes = vids.map(v => { acc += v.min; const id = 'pl-' + v.key; return { v, input: el('input', { type: 'checkbox', id, checked: acc <= away + 1 ? '' : null }) }; });
      body.append(el('h3', { id: 'sheetH' }, `Back from the Week ${p.week} videos?`),
        el('p', { class: 'small muted' }, `You opened the playlist ${ago(p.openedAt)}. Tick the ones you finished.`),
        el('ul', {}, boxes.map(({ v, input }) => el('li', {}, el('label', { for: input.id }, input, el('span', {}, v.title, el('span', { class: 'muted small' }, ` · ${v.min} min`)))))),
        el('div', { class: 'acts' },
          el('button', { class: 'btn sage', onclick: () => { boxes.forEach(({ v, input }) => { if (input.checked) setDone(v.key, true); }); closeSheet(true); } }, 'Save'),
          el('button', { class: 'btn', onclick: () => closeSheet(true) }, "I didn't watch any"),
          later));
    } else {
      const it = ITEMS[p.key];
      if (!it || isDone(it.key)) { closeSheet(true); return; }
      if (it.kind === 'video') {
        const guess = Math.max(1, Math.min(it.min - 1, Math.round((p.from || 0) / 60) + away));
        const inp = el('input', { type: 'number', id: 'stopMin', min: 0, max: it.min + 5, value: guess, inputmode: 'numeric' });
        body.append(el('h3', { id: 'sheetH' }, `Back from “${it.title}”?`),
          el('p', { class: 'small muted' }, `You opened it ${ago(p.openedAt)}${p.from ? ` at ${mmss(p.from)}` : ''}. It's ${it.min} minutes long.`),
          el('div', { class: 'acts' }, el('button', { class: 'btn sage', onclick: () => { setDone(it.key, true); closeSheet(true); } }, 'I finished it')),
          el('div', { class: 'acts' },
            el('label', { for: 'stopMin' }, 'I stopped at', inp, 'min'),
            el('button', { class: 'btn', onclick: () => { setPos(it.key, (parseFloat(inp.value) || 0) * 60); closeSheet(true); } }, 'Save my place')),
          el('div', { class: 'acts' }, el('button', { class: 'linkbtn', onclick: () => closeSheet(true) }, "I didn't watch it"), ' · ', later));
      } else {
        body.append(el('h3', { id: 'sheetH' }, `Finished “${it.title}”?`),
          el('p', { class: 'small muted' }, `You opened it ${ago(p.openedAt)}.`),
          el('div', { class: 'acts' },
            el('button', { class: 'btn sage', onclick: () => { setDone(it.key, true); closeSheet(true); } }, 'Yes, done'),
            el('button', { class: 'btn', onclick: () => closeSheet(true) }, 'Not yet'),
            later));
      }
    }
    document.getElementById('sheet').hidden = false;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkPending(); else if (active) track(active.key, active.player); });
  window.addEventListener('focus', checkPending);
  window.addEventListener('pageshow', checkPending);

  // ---------------------------------------------------------------- backup code
  const encode = s => 'PC2.' + btoa(unescape(encodeURIComponent(stable(s))));
  const decode = c => JSON.parse(decodeURIComponent(escape(atob(c.trim().replace(/^PC2\./, '')))));
  function fillBackup() { document.getElementById('backupOut').value = encode(S); }
  document.getElementById('backupBox').addEventListener('toggle', e => { if (e.target.open) fillBackup(); });
  document.getElementById('copyCode').onclick = () => {
    const out = document.getElementById('backupOut'), msg = document.getElementById('copyMsg');
    fillBackup();
    const fallback = () => { out.focus(); out.select(); msg.textContent = 'Selected. Copy it with your keyboard or long-press.'; };
    try { navigator.clipboard.writeText(out.value).then(() => { msg.textContent = 'Copied.'; }, fallback); } catch (e) { fallback(); }
  };
  document.getElementById('restoreCode').onclick = () => {
    const msg = document.getElementById('restoreMsg'), inp = document.getElementById('backupIn');
    try {
      const st = decode(inp.value);
      if (!st || st.v !== 2) throw new Error();
      S = merge(S, st); commit({ render: false }); refresh(true);
      inp.value = ''; msg.textContent = 'Progress added.';
    } catch (e) { msg.textContent = "That code didn't work. Copy the whole code, starting with PC2."; }
  };

  // ---------------------------------------------------------------- reset
  const rc = document.getElementById('resetConfirm');
  document.getElementById('reset').onclick = () => { rc.hidden = false; };
  document.getElementById('resetNo').onclick = () => { rc.hidden = true; };
  document.getElementById('resetYes').onclick = () => { const r = now(); S = blank(); S.resetAt = r; S.pendingAt = r; rc.hidden = true; view = 0; commit({ render: false }); refresh(true); };

  // ---------------------------------------------------------------- boot
  const local = loadLocal();
  if (local) S = merge(blank(), local);
  if (saveLocal()) mode = 'local';
  view = activeWeek();
  showSync();
  refresh(true);
  checkPending();
  initCloud();
})();
