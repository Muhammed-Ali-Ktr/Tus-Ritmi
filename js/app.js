/* =========================================================
   TuşRitmi — Hız testi
   ========================================================= */
window.App = (() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Kalıcı ayarlar ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tusritmi_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('tusritmi_' + k, JSON.stringify(v)); } catch { /* yoksay */ } },
  };
  const defaults = { mode: 'time', time: 30, words: 25, lang: 'tr', punct: false, nums: false, fx: 2, sound: false, kb: true, view: 'test' };
  const settings = { ...defaults, ...store.get('settings', {}) };
  const save = () => store.set('settings', settings);
  let customText = store.get('custom', 'Klavyede hızlı yazmak, düzenli pratik ve doğru parmak kullanımıyla gelişen bir beceridir. Önce doğruluğa odaklan, hız kendiliğinden gelecek.');

  const AMOUNTS = { time: [15, 30, 60, 120], words: [10, 25, 50, 100] };

  /* ---------- Ses: piyano benzeri tonlar ---------- */
  const Sound = (() => {
    let ac;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0]; // C pentatonik
    const roots = [0, 3, 1, 4];
    function tone(freq, dur, type, gain, when = 0) {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === 'suspended') ac.resume();
        const t = ac.currentTime + when;
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = type; o.frequency.value = freq;
        f.type = 'lowpass'; f.frequency.value = type === 'triangle' ? 3200 : 900;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f); f.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + dur + 0.03);
      } catch { /* ses desteklenmiyor */ }
    }
    return {
      ok(pos, wordIdx = 0) {
        if (!settings.sound) return;
        const n = pos + roots[wordIdx % roots.length];
        tone(scale[n % 5] * Math.pow(2, Math.floor(n / 5) % 3), 0.32, 'triangle', 0.07);
      },
      warn() { if (settings.sound) tone(138, 0.13, 'square', 0.025); },
      bad() { if (settings.sound) { tone(233, 0.12, 'sawtooth', 0.03); tone(174, 0.18, 'sawtooth', 0.03, 0.07); } },
      word() { if (settings.sound) tone(523.25, 0.12, 'sine', 0.025); },
    };
  })();

  /* ---------- Elemanlar ---------- */
  const wordsEl = $('#words');
  const wrap = $('#typingWrap');
  const input = $('#hiddenInput');
  const caret = document.createElement('div');
  caret.className = 'caret blink';
  const kb = KB.create('#kbTest');

  /* ---------- Metin üretimi ---------- */
  const rand = (n) => Math.floor(Math.random() * n);
  const capFirst = (w) => w.charAt(0).toLocaleUpperCase(settings.lang === 'tr' ? 'tr' : 'en') + w.slice(1);
  let capNext = true;

  function genWords(n) {
    const list = WORDS[settings.lang];
    const out = [];
    let prev = '';
    for (let i = 0; i < n; i++) {
      let w;
      do { w = list[rand(list.length)]; } while (w === prev);
      prev = w;
      if (settings.nums && Math.random() < 0.12) {
        w = String(Math.random() < 0.5 ? rand(100) : 1000 + rand(9000));
      }
      if (settings.punct) {
        if (capNext) { w = capFirst(w); capNext = false; }
        const r = Math.random();
        if (r < 0.09) { w += '.'; capNext = true; }
        else if (r < 0.16) w += ',';
        else if (r < 0.18) { w += '?'; capNext = true; }
        else if (r < 0.2) { w += '!'; capNext = true; }
        else if (r < 0.22) w += ':';
        else if (r < 0.24) w = '"' + w + '"';
        else if (r < 0.26) w = '(' + w + ')';
      }
      out.push(w);
    }
    return out;
  }

  function simplify(t) {
    return t
      .replace(/[“”„«»″]/g, '"')
      .replace(/[‘’‚′`´]/g, "'")
      .replace(/[–—―]/g, '-')
      .replace(/…/g, '...')
      .replace(/[  -​]/g, ' ')
      .replace(/[âÂ]/g, (c) => (c === 'â' ? 'a' : 'A'))
      .replace(/[îÎ]/g, (c) => (c === 'î' ? 'i' : 'İ'))
      .replace(/[ûÛ]/g, (c) => (c === 'û' ? 'u' : 'U'));
  }
  const splitWords = (t) => t.split(/\s+/).filter(Boolean);

  function buildWords() {
    capNext = true;
    if (settings.mode === 'custom') {
      let w = splitWords(customText);
      if (!w.length) w = ['metin', 'girilmedi'];
      if (store.get('customShuffle', false)) w = w.sort(() => Math.random() - 0.5);
      return w;
    }
    if (settings.mode === 'words') return genWords(settings.words);
    return genWords(90);
  }

  /* ---------- Test durumu ---------- */
  let T = null;
  let wordEls = [];
  let lineH = 0, scrollY = 0;

  function newTest(repeat = false) {
    if (T) clearInterval(T.iv);
    const words = repeat && T ? T.words.slice() : buildWords();
    T = {
      words, inputs: [''], wi: 0,
      started: false, finished: false, t0: 0, iv: null,
      keys: 0, okKeys: 0,        // tüm vuruşlar / doğru vuruşlar
      secKeys: 0, secErr: 0, lastSec: 0, secs: [],
    };
    document.body.classList.remove('typing');
    $('#results').hidden = true;
    $('#testArea').hidden = false;
    render();
    updateLive();
    focusInput();
  }

  const esc = (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c);

  function render() {
    const frag = document.createDocumentFragment();
    wordEls = T.words.map((w) => {
      const d = document.createElement('div');
      d.className = 'word';
      frag.appendChild(d);
      return d;
    });
    wordsEl.innerHTML = '';
    wordsEl.appendChild(frag);
    wordsEl.appendChild(caret);
    T.words.forEach((_, i) => updateWord(i));
    scrollY = 0;
    wordsEl.style.transform = 'translateY(0)';
    measure();
    updateCaret();
  }

  function appendWords(n) {
    const more = genWords(n);
    const frag = document.createDocumentFragment();
    more.forEach((w) => {
      T.words.push(w);
      const d = document.createElement('div');
      d.className = 'word';
      frag.appendChild(d);
      wordEls.push(d);
    });
    wordsEl.insertBefore(frag, caret);
    for (let i = T.words.length - n; i < T.words.length; i++) updateWord(i);
  }

  function measure() {
    const w = wordEls[0];
    if (!w) return;
    const cs = getComputedStyle(w);
    lineH = w.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
  }

  function updateWord(i) {
    const el = wordEls[i];
    if (!el) return;
    const target = T.words[i], typed = T.inputs[i] ?? '';
    let html = '';
    for (let j = 0; j < target.length; j++) {
      const c = typed[j];
      const cls = c === undefined ? '' : c === target[j] ? ' ok' : ' bad';
      html += `<span class="l${cls}">${esc(target[j])}</span>`;
    }
    for (let j = target.length; j < typed.length; j++) html += `<span class="l extra">${esc(typed[j])}</span>`;
    el.innerHTML = html;
    el.classList.toggle('err', i < T.wi && typed !== target);
  }

  function updateCaret() {
    const el = wordEls[T.wi];
    if (!el) return;
    const letters = el.children;
    const n = T.inputs[T.wi].length;
    const base = wordsEl.getBoundingClientRect();
    let x, y, h;
    if (n < letters.length) {
      const r = letters[n].getBoundingClientRect();
      x = r.left - base.left; y = r.top - base.top; h = r.height;
    } else {
      const r = letters[letters.length - 1].getBoundingClientRect();
      x = r.right - base.left; y = r.top - base.top; h = r.height;
    }
    caret.style.height = h * 0.82 + 'px';
    caret.style.transform = `translate(${x - 1}px, ${y + h * 0.09}px)`;

    // Satır kaydırma: aktif satır her zaman 2. satırda kalsın
    const top = el.offsetTop - wordEls[0].offsetTop;
    const want = Math.max(0, top - lineH);
    if (Math.abs(want - scrollY) > 1) {
      scrollY = want;
      wordsEl.style.transform = `translateY(${-scrollY}px)`;
    }
  }

  /* ---------- İstatistikler ---------- */
  function countStats() {
    let cw = 0, ok = 0, bad = 0, extra = 0, missed = 0;
    for (let i = 0; i <= T.wi && i < T.words.length; i++) {
      const tg = T.words[i], ty = T.inputs[i] || '';
      const done = i < T.wi;
      const m = Math.min(tg.length, ty.length);
      for (let j = 0; j < m; j++) (ty[j] === tg[j] ? ok++ : bad++);
      if (ty.length > tg.length) extra += ty.length - tg.length;
      if (done && ty.length < tg.length) missed += tg.length - ty.length;
      if (done) { if (ty === tg) cw += tg.length + 1; }
      else if (ty.length && tg.startsWith(ty)) cw += ty.length;
    }
    return { cw, ok, bad, extra, missed };
  }
  const elapsedSec = () => (T.started ? (performance.now() - T.t0) / 1000 : 0);
  const wpmOf = (chars, sec) => (sec > 0 ? (chars / 5) * (60 / sec) : 0);

  function recordSecond(sec) {
    const st = countStats();
    T.secs.push({ s: sec, wpm: wpmOf(st.cw, sec), raw: T.secKeys * 12, err: T.secErr });
    T.secKeys = 0; T.secErr = 0;
  }

  function tick() {
    if (!T.started || T.finished) return;
    const el = elapsedSec();
    const s = Math.floor(el);
    while (T.lastSec < s) { T.lastSec++; recordSecond(T.lastSec); }
    if (settings.mode === 'time' && el >= settings.time) { finish(); return; }
    updateLive();
  }

  function pbKey() {
    if (settings.mode === 'custom') return null;
    return [settings.mode, settings.mode === 'time' ? settings.time : settings.words, settings.lang, settings.punct ? 'p' : '', settings.nums ? 'n' : ''].join('-');
  }

  function updateLive() {
    const prog = $('#liveProgress');
    if (settings.mode === 'time') {
      prog.textContent = Math.max(0, Math.ceil(settings.time - elapsedSec()));
      prog.classList.add('show');
    } else {
      prog.textContent = `${Math.min(T.wi, T.words.length)}/${T.words.length}`;
      prog.classList.toggle('show', T.started);
    }
    const el = elapsedSec();
    $('#liveWpm').textContent = el > 1 ? Math.round(wpmOf(countStats().cw, el)) : 0;
    $('#liveAcc').textContent = T.keys ? Math.round((T.okKeys / T.keys) * 100) : 100;
    const k = pbKey();
    const pb = k ? store.get('pb', {})[k] : null;
    $('#livePb').textContent = pb ? `en iyi: ${Math.round(pb.wpm)} wpm` : '';
  }

  /* ---------- Yazma ---------- */
  function startTest() {
    T.started = true;
    T.t0 = performance.now();
    T.iv = setInterval(tick, 100);
    document.body.classList.add('typing');
    caret.classList.remove('blink');
  }

  function letterEl(i, j) { return wordEls[i] && wordEls[i].children[j]; }

  function typeChar(ch) {
    if (T.finished) return;
    if (ch === ' ' || ch === '\n' || ch === '\t') return commitWord();
    if (!T.started) startTest();
    const target = T.words[T.wi];
    const typed = T.inputs[T.wi];
    if (typed.length >= target.length + 12) return;

    const pos = typed.length;
    const correct = target[pos] === ch;
    T.inputs[T.wi] = typed + ch;
    T.keys++; T.secKeys++;
    if (correct) T.okKeys++; else T.secErr++;

    updateWord(T.wi);
    updateCaret();

    const le = letterEl(T.wi, pos);
    FX.hitEl(le, correct ? 'ok' : 'warn', { inset: 2 });
    kb.press(ch, correct ? 'k-ok' : 'k-warn');
    correct ? Sound.ok(pos, T.wi) : Sound.warn();

    // Son kelime doğru tamamlandıysa testi bitir
    if (settings.mode !== 'time' && T.wi === T.words.length - 1 && T.inputs[T.wi] === target) {
      T.wi++; T.inputs.push('');
      finish();
    }
    caret.classList.remove('blink');
  }

  function commitWord() {
    if (!T.started) return;
    const typed = T.inputs[T.wi];
    if (!typed) return;
    const target = T.words[T.wi];
    const ok = typed === target;
    T.keys++; T.secKeys++;
    if (ok) T.okKeys++; else T.secErr++;

    const wEl = wordEls[T.wi];
    T.wi++;
    T.inputs.push('');
    updateWord(T.wi - 1);

    kb.press(' ', ok ? 'k-ok' : 'k-bad');
    if (!ok) {
      FX.wordBurst(wEl.getBoundingClientRect(), 'bad');
      wEl.classList.remove('shake'); void wEl.offsetWidth; wEl.classList.add('shake');
      Sound.bad();
    } else {
      Sound.word();
    }

    if (T.wi >= T.words.length) {
      if (settings.mode === 'time') appendWords(40);
      else { finish(); return; }
    }
    if (settings.mode === 'time' && T.words.length - T.wi < 40) appendWords(40);
    updateCaret();
    updateLive();
  }

  function backspace(ctrl) {
    if (T.finished || !T.started) return;
    let typed = T.inputs[T.wi];
    if (typed.length) {
      T.inputs[T.wi] = ctrl ? '' : typed.slice(0, -1);
    } else if (T.wi > 0 && T.inputs[T.wi - 1] !== T.words[T.wi - 1]) {
      // Yalnızca hatalı önceki kelimeye geri dönülebilir
      T.inputs.pop();
      T.wi--;
      T.inputs[T.wi] = ctrl ? '' : T.inputs[T.wi];
      updateWord(T.wi);
    } else return;
    updateWord(T.wi);
    updateCaret();
  }

  /* ---------- Bitiş & sonuçlar ---------- */
  function finish() {
    if (T.finished) return;
    T.finished = true;
    clearInterval(T.iv);
    let sec = settings.mode === 'time' ? settings.time : elapsedSec();
    sec = Math.max(sec, 0.5);
    if (sec - T.lastSec > 0.25) recordSecond(sec);

    const st = countStats();
    const wpm = wpmOf(st.cw, sec);
    const raw = wpmOf(T.keys, sec);
    const acc = T.keys ? (T.okKeys / T.keys) * 100 : 0;
    const raws = T.secs.map((s) => s.raw);
    const mean = raws.reduce((a, b) => a + b, 0) / (raws.length || 1);
    const sd = Math.sqrt(raws.reduce((a, b) => a + (b - mean) ** 2, 0) / (raws.length || 1));
    const cons = mean ? Math.max(0, 100 * (1 - sd / mean)) : 0;

    // Rekor
    const k = pbKey();
    let isPb = false, pbVal = null;
    if (k) {
      const pbs = store.get('pb', {});
      pbVal = pbs[k];
      if (wpm > 0 && acc >= 50 && (!pbVal || wpm > pbVal.wpm)) {
        isPb = !!pbVal || wpm > 0;
        pbs[k] = { wpm, acc, date: Date.now() };
        store.set('pb', pbs);
        pbVal = pbs[k];
      }
    }

    document.body.classList.remove('typing');
    $('#testArea').hidden = true;
    $('#results').hidden = false;

    animateNumber($('#rWpm'), wpm, (v) => Math.round(v));
    animateNumber($('#rAcc'), acc, (v) => Math.round(v) + '%');
    $('#rRaw').textContent = Math.round(raw);
    $('#rChars').textContent = `${st.ok}/${st.bad}/${st.extra}/${st.missed}`;
    $('#rCons').textContent = Math.round(cons) + '%';
    $('#rTime').textContent = sec < 60 ? `${Math.round(sec)}s` : `${Math.floor(sec / 60)}d ${Math.round(sec % 60)}s`;
    $('#rType').textContent = settings.mode === 'custom' ? 'kendi metnim'
      : `${settings.mode === 'time' ? settings.time + ' sn' : settings.words + ' kelime'} ${settings.lang.toUpperCase()}`;
    $('#rPb').textContent = pbVal ? Math.round(pbVal.wpm) + ' wpm' : '-';
    $('#pbBadge').hidden = !isPb;

    requestAnimationFrame(() => {
      drawChart();
      if (isPb) {
        const r = $('#rWpm').getBoundingClientRect();
        FX.celebrate(r.left + r.width / 2, r.top + r.height / 2);
      }
    });
    $('#btnNext').focus({ preventScroll: true });
  }

  function animateNumber(el, to, fmt) {
    const t0 = performance.now(), dur = 700;
    const stepFn = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  }

  function drawChart() {
    const cv = $('#chart');
    const box = cv.parentElement;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = box.clientWidth - 28, H = Math.max(180, box.clientHeight - 44);
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);

    const data = T.secs;
    if (!data.length) return;
    const pad = { l: 34, r: 30, t: 10, b: 22 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const maxY = Math.max(20, ...data.map((d) => Math.max(d.wpm, d.raw))) * 1.15;
    const maxErr = Math.max(1, ...data.map((d) => d.err));
    const maxX = data[data.length - 1].s;
    const X = (s) => pad.l + (data.length === 1 ? pw / 2 : ((s - data[0].s) / Math.max(0.001, maxX - data[0].s)) * pw);
    const Y = (v) => pad.t + ph - (v / maxY) * ph;

    c.font = '11px JetBrains Mono, monospace';
    c.fillStyle = '#545e72';
    c.strokeStyle = 'rgba(255,255,255,.05)';
    c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = (maxY / 4) * i, y = Y(v);
      c.beginPath(); c.moveTo(pad.l, y); c.lineTo(W - pad.r, y); c.stroke();
      c.textAlign = 'right'; c.fillText(Math.round(v), pad.l - 6, y + 4);
    }
    c.textAlign = 'center';
    const stepX = Math.max(1, Math.ceil(data.length / 10));
    data.forEach((d, i) => { if (i % stepX === 0 || i === data.length - 1) c.fillText(Math.round(d.s), X(d.s), H - 4); });

    const line = (key, color, width, dash) => {
      c.save();
      c.setLineDash(dash || []);
      c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round';
      c.beginPath();
      data.forEach((d, i) => (i ? c.lineTo(X(d.s), Y(d[key])) : c.moveTo(X(d.s), Y(d[key]))));
      c.stroke();
      c.restore();
    };
    // wpm alanı
    const g = c.createLinearGradient(0, pad.t, 0, pad.t + ph);
    g.addColorStop(0, 'rgba(62,240,143,.25)'); g.addColorStop(1, 'rgba(62,240,143,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(X(data[0].s), Y(0));
    data.forEach((d) => c.lineTo(X(d.s), Y(d.wpm)));
    c.lineTo(X(data[data.length - 1].s), Y(0));
    c.fill();

    line('raw', '#545e72', 1.5, [4, 4]);
    line('wpm', '#3ef08f', 2.5);

    data.forEach((d) => {
      if (!d.err) return;
      const x = X(d.s), y = pad.t + 6 + (1 - d.err / maxErr) * 10;
      c.fillStyle = 'rgba(255,61,90,.9)';
      c.beginPath(); c.arc(x, y, 2.5 + (d.err / maxErr) * 2.5, 0, Math.PI * 2); c.fill();
    });
  }

  /* ---------- Yapılandırma çubuğu ---------- */
  function syncConfig() {
    $$('#cfgMode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === settings.mode));
    $$('#cfgLang button').forEach((b) => b.classList.toggle('active', b.dataset.lang === settings.lang));
    $$('#cfgExtras button').forEach((b) => b.classList.toggle('active', !!settings[b.dataset.toggle]));
    const custom = settings.mode === 'custom';
    $$('#cfgExtras button, #cfgLang button').forEach((b) => b.classList.toggle('disabled', custom));

    const am = $('#cfgAmount');
    am.innerHTML = '';
    if (custom) {
      const b = document.createElement('button');
      b.innerHTML = '<b>✎</b> metni düzenle';
      b.onclick = openCustom;
      am.appendChild(b);
    } else {
      AMOUNTS[settings.mode].forEach((v) => {
        const b = document.createElement('button');
        b.textContent = v;
        b.classList.toggle('active', settings[settings.mode] === v);
        b.onclick = () => { settings[settings.mode] = v; save(); syncConfig(); newTest(); };
        am.appendChild(b);
      });
    }
    // Üst butonlar
    const fxNames = ['Kapalı', 'Düşük', 'Yüksek'];
    $('#fxLabel').textContent = 'Efekt: ' + fxNames[settings.fx];
    $('#btnFx').classList.toggle('on', settings.fx > 0);
    $('#soundLabel').textContent = 'Ses: ' + (settings.sound ? 'Açık' : 'Kapalı');
    $('#btnSound').classList.toggle('on', settings.sound);
    $('#kbLabel').textContent = 'Klavye: ' + (settings.kb ? 'Açık' : 'Kapalı');
    $('#btnKb').classList.toggle('on', settings.kb);
    document.body.classList.toggle('no-kb', !settings.kb);
    FX.setLevel(settings.fx);
  }

  $('#cfgMode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mode === 'custom') { openCustom(); return; }
    settings.mode = b.dataset.mode; save(); syncConfig(); newTest();
  });
  $('#cfgLang').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings.lang = b.dataset.lang; save(); syncConfig(); newTest();
  });
  $('#cfgExtras').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[b.dataset.toggle] = !settings[b.dataset.toggle]; save(); syncConfig(); newTest();
  });
  $('#btnFx').onclick = () => { settings.fx = (settings.fx + 2) % 3; save(); syncConfig(); demoFx(); blurBtn(); };
  $('#btnSound').onclick = () => { settings.sound = !settings.sound; save(); syncConfig(); Sound.ok(0); blurBtn(); };
  $('#btnKb').onclick = () => { settings.kb = !settings.kb; save(); syncConfig(); requestAnimationFrame(updateCaret); blurBtn(); };
  $('#btnRestart').onclick = () => newTest();
  $('#btnNext').onclick = () => newTest();
  $('#btnRepeat').onclick = () => newTest(true);
  const blurBtn = () => document.activeElement && document.activeElement.blur();

  function demoFx() {
    const r = $('#btnFx').getBoundingClientRect();
    FX.hit(r.left + r.width / 2, r.bottom + 4, 'ok', { w: 20, h: 20 });
  }

  /* ---------- Kendi metnin ---------- */
  const dlg = $('#customDlg');
  const ta = $('#customText');
  const updateCount = () => { $('#customCount').textContent = splitWords(ta.value).length + ' kelime'; };

  function openCustom() {
    ta.value = customText;
    $('#optShuffle').checked = store.get('customShuffle', false);
    updateCount();
    dlg.showModal();
    ta.focus();
  }
  ta.addEventListener('input', updateCount);
  $('#customForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = e.submitter ? e.submitter.value === 'ok' : true;
    dlg.close();
    if (ok) applyCustom(); else focusInput();
  });
  dlg.addEventListener('cancel', () => setTimeout(focusInput, 0));

  function applyCustom() {
    let t = ta.value;
    if ($('#optSimplify').checked) t = simplify(t);
    t = t.replace(/\s+/g, ' ').trim();
    if (!t) { focusInput(); return; }
    customText = t;
    store.set('custom', t);
    store.set('customShuffle', $('#optShuffle').checked);
    settings.mode = 'custom'; save(); syncConfig(); newTest();
  }

  function loadFile(file) {
    if (!file) return;
    if (file.size > 2_000_000) { alert('Dosya çok büyük (en fazla 2 MB).'); return; }
    const rd = new FileReader();
    rd.onload = () => { ta.value = String(rd.result); updateCount(); };
    rd.readAsText(file, 'UTF-8');
  }
  $('#fileIn').addEventListener('change', (e) => loadFile(e.target.files[0]));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));

  /* ---------- Odak ---------- */
  function focusInput() {
    if (settings.view !== 'test' || dlg.open) return;
    input.focus({ preventScroll: true });
    wrap.classList.remove('blurred');
  }
  wrap.addEventListener('mousedown', (e) => { e.preventDefault(); focusInput(); });
  addEventListener('blur', () => { if (settings.view === 'test') wrap.classList.add('blurred'); });
  addEventListener('focus', () => wrap.classList.remove('blurred'));

  // Mobil / IME yedeği: keydown ile gelmeyen karakterler
  input.addEventListener('input', (e) => {
    const v = input.value;
    input.value = '';
    if (!v || settings.view !== 'test') return;
    for (const ch of v) typeChar(ch);
  });

  /* ---------- Klavye olayları ---------- */
  document.addEventListener('keydown', (e) => {
    if (dlg.open) return;
    if (settings.view === 'guide') { window.Guide && Guide.handle(e); return; }
    const tag = e.target.tagName;
    if ((tag === 'TEXTAREA' || (tag === 'INPUT' && e.target !== input)) ) return;

    if (e.key === 'Tab') { e.preventDefault(); newTest(); return; }
    if (e.key === 'Escape') { e.preventDefault(); newTest(true); return; }
    if (!$('#results').hidden) {
      if (e.key === 'Enter') { e.preventDefault(); newTest(); }
      return;
    }
    if (e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    if (wrap.classList.contains('blurred')) wrap.classList.remove('blurred');
    if (document.activeElement !== input) input.focus({ preventScroll: true });

    if (e.key === 'Backspace') { e.preventDefault(); backspace(e.ctrlKey || e.altKey || e.metaKey); return; }
    if (e.key === 'Enter') { e.preventDefault(); return; }
    // AltGr = Ctrl+Alt (Windows) — izin ver
    const ctrlOnly = (e.ctrlKey && !e.altKey) || e.metaKey;
    if (e.key.length === 1 && !ctrlOnly) {
      e.preventDefault();
      typeChar(e.key);
    }
  });

  addEventListener('resize', () => { if (T && !T.finished) { measure(); updateCaret(); } else if (T && T.finished) drawChart(); });

  /* ---------- Görünüm geçişi ---------- */
  function setView(v) {
    settings.view = v; save();
    $$('.tab').forEach((t) => {
      const on = t.dataset.view === v;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    $('#view-test').hidden = v !== 'test';
    $('#view-guide').hidden = v !== 'guide';
    document.body.classList.remove('typing');
    if (v === 'test') {
      if (T && T.started && !T.finished) newTest(true);
      requestAnimationFrame(() => { measure(); updateCaret(); focusInput(); });
    } else {
      input.blur();
      window.Guide && Guide.activate();
    }
  }
  $$('.tab').forEach((t) => (t.onclick = () => { setView(t.dataset.view); t.blur(); }));
  $('.brand').onclick = (e) => { e.preventDefault(); setView('test'); };

  /* ---------- Başlat ---------- */
  syncConfig();
  newTest();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (T && !T.started) { measure(); updateCaret(); } });

  return { settings, Sound, setView, store, onReady: () => setView(settings.view) };
})();
