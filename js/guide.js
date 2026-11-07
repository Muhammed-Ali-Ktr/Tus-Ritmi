/* =========================================================
   Parmak Rehberi — hangi tuşa hangi parmak?
   ========================================================= */
window.Guide = (() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { FINGERS } = KB;
  const kb = KB.create('#kbGuide', App.settings.layout);
  const fingersSvg = $$('#hands .finger');

  const LESSONS = {
    home: 'asdfjklş',
    homeExt: 'asdfghjklşi',
    top: 'qwertyuıopğü',
    bottom: 'zxcvbnmöç',
    freq: 'aeinrlıkdmuytsbo',
    all: 'abcçdefgğhıijklmnoöprsştuüvyz',
    numbers: '1234567890',
  };
  const LESSON_SETS = {
    home: LESSONS.homeExt,
    top: LESSONS.top + 'asdfjkl',
    bottom: LESSONS.bottom + 'asdfjkl',
    freq: LESSONS.freq,
    all: LESSONS.all,
    numbers: LESSONS.numbers,
  };

  let lesson = App.store.get('lesson', 'home');
  let seq = [], idx = 0;
  let stats = { ok: 0, err: 0, t0: 0 };
  let missedHere = false;

  /* ---------- Lejant ---------- */
  const legend = $('#legend');
  [['lp', 'Serçe'], ['lr', 'Yüzük'], ['lm', 'Orta'], ['li', 'İşaret'], ['th', 'Başparmak']].forEach(([f, n]) => {
    const s = document.createElement('span');
    s.innerHTML = `<i style="background:${FINGERS[f].color}"></i>${n}`;
    s.dataset.f = f;
    legend.appendChild(s);
  });
  legend.addEventListener('mouseover', (e) => {
    const s = e.target.closest('span');
    if (!s) return;
    const f = s.dataset.f;
    const pair = f === 'th' ? ['th'] : [f, 'r' + f[1]];
    highlightFingers(pair);
  });
  legend.addEventListener('mouseleave', () => highlightFingers([]));

  function highlightFingers(fs) {
    const set = new Set(fs);
    kb.all.forEach((k) => k.classList.toggle('hl', set.has(k.dataset.f)));
    fingersSvg.forEach((f) => f.classList.toggle('hl', set.has(f.dataset.f)));
    $('#kbGuide').classList.toggle('dim-others', set.size > 0);
  }

  /* ---------- Hedef gösterimi ---------- */
  function keyLabel(ch) {
    if (ch === ' ') return '␣';
    return ch.toLocaleUpperCase('tr');
  }

  function showTarget(keyEl, f, label) {
    kb.all.forEach((k) => k.classList.remove('target'));
    fingersSvg.forEach((x) => x.classList.toggle('active', x.dataset.f === f));
    if (keyEl) keyEl.classList.add('target');
    const info = FINGERS[f] || { name: '—', color: '#545e72' };
    $('#drillKey').textContent = label;
    $('#drillKey').style.setProperty('--fc', info.color);
    $('#drillFinger').textContent = info.name;
    $('#fingerDot').style.background = info.color;
    $('#fingerDot').style.color = info.color;
  }

  /* ---------- Alıştırma ---------- */
  function genSeq() {
    const set = LESSON_SETS[lesson];
    const out = [];
    const groups = 8;
    for (let g = 0; g < groups; g++) {
      const len = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < len; i++) out.push(set[Math.floor(Math.random() * set.length)]);
      if (g < groups - 1) out.push(' ');
    }
    return out;
  }

  function newDrill() {
    seq = genSeq();
    idx = 0;
    missedHere = false;
    const strip = $('#drillStrip');
    strip.innerHTML = seq.map((c) => `<span class="${c === ' ' ? 'sp' : ''}">${c === ' ' ? '␣' : keyLabel(c)}</span>`).join('');
    renderDrill();
  }

  function renderDrill() {
    const spans = $('#drillStrip').children;
    [...spans].forEach((s, i) => s.classList.toggle('cur', i === idx));
    const cur = spans[idx];
    if (cur) {
      const wrapW = $('#drillStrip').parentElement.clientWidth;
      const off = cur.offsetLeft - wrapW / 2 + cur.offsetWidth / 2;
      $('#drillStrip').style.transform = `translateX(${-Math.max(0, off)}px)`;
    }
    const ch = seq[idx];
    const k = kb.find(ch);
    showTarget(k && k.el, k ? k.f : 'th', keyLabel(ch));
  }

  function updateStats() {
    const total = stats.ok + stats.err;
    $('#gOk').textContent = stats.ok;
    $('#gErr').textContent = stats.err;
    $('#gAcc').textContent = total ? Math.round((stats.ok / total) * 100) + '%' : '100%';
    const min = stats.t0 ? (performance.now() - stats.t0) / 60000 : 0;
    $('#gKpm').textContent = min > 0.02 ? Math.round(stats.ok / min) : 0;
  }

  function resetStats() { stats = { ok: 0, err: 0, t0: 0 }; updateStats(); }

  /* ---------- Serbest keşif ---------- */
  function explore(keyEl, f, label) {
    showTarget(keyEl, f, label);
    $('.drill-label').textContent = 'bastığın tuş';
  }

  /* ---------- Ders seçimi ---------- */
  function setLesson(l) {
    lesson = l;
    App.store.set('lesson', l);
    $$('#lessonPick button').forEach((b) => b.classList.toggle('active', b.dataset.lesson === l));
    const isExplore = l === 'explore';
    $('.drill-card').classList.toggle('explore', isExplore);
    $('.drill-label').textContent = isExplore ? 'bir tuşa bas ya da üzerine gel' : 'sıradaki tuş';
    resetStats();
    if (isExplore) showTarget(null, 'li', 'F');
    else newDrill();
  }
  $('#lessonPick').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { setLesson(b.dataset.lesson); b.blur(); }
  });

  /* Tuşların üzerine gelince parmak göster */
  $('#kbGuide').addEventListener('mouseover', (e) => {
    const k = e.target.closest('.key');
    if (!k) return;
    highlightFingers([k.dataset.f]);
    if (lesson === 'explore') {
      explore(k, k.dataset.f, k.dataset.char !== undefined ? keyLabel(k.dataset.char) : k.textContent);
    }
  });
  $('#kbGuide').addEventListener('mouseleave', () => highlightFingers([]));
  $('#kbGuide').addEventListener('click', (e) => {
    const k = e.target.closest('.key');
    if (k) { FX.hitEl(k, 'ok', { inset: 4 }); kb.flash(k, 'k-ok'); }
  });
  fingersSvg.forEach((f) => {
    f.addEventListener('mouseenter', () => highlightFingers([f.dataset.f]));
    f.addEventListener('mouseleave', () => highlightFingers([]));
  });

  /* ---------- Klavye olayı ---------- */
  function handle(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.ctrlKey && !e.altKey) return;
    if (e.key === 'Escape') { e.preventDefault(); setLesson(lesson); return; }
    if (e.key === 'Tab' || e.key === ' ' || e.key === "'" || e.key === '/' || e.key === 'Backspace') e.preventDefault();

    const hit = kb.fromEvent(e);

    if (lesson === 'explore') {
      if (!hit) return;
      e.preventDefault();
      const label = e.key.length === 1 ? keyLabel(e.key) : hit.el.textContent;
      explore(hit.el, hit.f || hit.el.dataset.f, label);
      FX.hitEl(hit.el, 'ok', { inset: 4 });
      kb.flash(hit.el, 'k-ok');
      App.Sound.ok(kb.all.indexOf(hit.el) % 10);
      return;
    }

    if (e.key.length !== 1) {
      // Shift vb. tek başına: sadece görsel geri bildirim
      if (hit) kb.flash(hit.el, 'k-ok');
      return;
    }
    e.preventDefault();
    if (!stats.t0) stats.t0 = performance.now();

    const want = seq[idx];
    const got = kb.characterFromEvent(e).toLocaleLowerCase('tr');
    const spans = $('#drillStrip').children;

    if (got === want) {
      const k = kb.find(want);
      FX.hitEl(k && k.el, 'ok', { inset: 4, strength: 1.15 });
      kb.flash(k, 'k-ok');
      App.Sound.ok(idx % 8, 0);
      if (!missedHere) stats.ok++;
      spans[idx].classList.add(missedHere ? 'missed' : 'done');
      missedHere = false;
      idx++;
      if (idx >= seq.length) {
        const r = $('#drillStrip').getBoundingClientRect();
        FX.celebrate(r.left + r.width / 2, r.top + r.height / 2);
        setTimeout(newDrill, 250);
      } else renderDrill();
    } else {
      stats.err++;
      missedHere = true;
      FX.hitEl(hit && hit.el, 'warn', { inset: 4 });
      if (hit) kb.flash(hit.el, 'k-warn');
      const t = kb.find(want);
      if (t) { t.el.classList.remove('target'); void t.el.offsetWidth; t.el.classList.add('target'); }
      App.Sound.warn();
      spans[idx].classList.add('missed');
    }
    updateStats();
  }

  function activate() {
    requestAnimationFrame(() => renderDrillSafe());
  }
  function renderDrillSafe() { if (lesson !== 'explore' && seq.length) renderDrill(); }

  setLesson(LESSON_SETS[lesson] || lesson === 'explore' ? lesson : 'home');
  setInterval(() => { if (App.settings.view === 'guide' && stats.t0) updateStats(); }, 1000);

  return { handle, activate };
})();

App.onReady();
