/* =========================================================
   Türkçe Q klavye düzeni + parmak eşlemesi
   ========================================================= */
window.KB = (() => {
  const FINGERS = {
    lp: { name: 'Sol serçe parmak', short: 'Serçe', color: '#f783ac' },
    lr: { name: 'Sol yüzük parmağı', short: 'Yüzük', color: '#b197fc' },
    lm: { name: 'Sol orta parmak', short: 'Orta', color: '#74c0fc' },
    li: { name: 'Sol işaret parmağı', short: 'İşaret', color: '#ffd43b' },
    th: { name: 'Başparmak', short: 'Başparmak', color: '#ced4da' },
    ri: { name: 'Sağ işaret parmağı', short: 'İşaret', color: '#ffd43b' },
    rm: { name: 'Sağ orta parmak', short: 'Orta', color: '#74c0fc' },
    rr: { name: 'Sağ yüzük parmağı', short: 'Yüzük', color: '#b197fc' },
    rp: { name: 'Sağ serçe parmak', short: 'Serçe', color: '#f783ac' },
  };

  const up = (s) => s.toLocaleUpperCase('tr');
  const sp = (code, label, w, f) => ({ code, label, w, f, special: true });

  // Her satır: [önce özel tuşlar], karakter tuşları, [sonra özel tuşlar]
  const Q_ROWS = [
    {
      keys: ['"', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '-'],
      shift: ['é', '!', "'", '^', '+', '%', '&', '/', '(', ')', '=', '?', '_'],
      fingers: 'lp lp lr lm li li ri ri rm rr rp rp rp',
      post: [sp('Backspace', '⌫', 2, 'rp')],
    },
    {
      pre: [sp('Tab', 'Tab', 1.5, 'lp')],
      keys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'ı', 'o', 'p', 'ğ', 'ü', ','],
      shift: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü', ';'],
      fingers: 'lp lr lm li li ri ri rm rr rp rp rp rp',
      widths: { 12: 1.5 },
    },
    {
      pre: [sp('CapsLock', 'Caps', 1.75, 'lp')],
      keys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
      fingers: 'lp lr lm li li ri ri rm rr rp rp',
      post: [sp('Enter', 'Enter', 2.25, 'rp')],
    },
    {
      pre: [sp('ShiftLeft', 'Shift', 1.25, 'lp')],
      keys: ['<', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç', '.'],
      shift: ['>', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', ':'],
      fingers: 'lp lp lr lm li li ri ri rm rr rp',
      post: [sp('ShiftRight', 'Shift', 2.75, 'rp')],
    },
    {
      pre: [sp('ControlLeft', 'Ctrl', 1.5, 'lp'), sp('AltLeft', 'Alt', 1.5, 'th')],
      keys: [' '], fingers: 'th', widths: { 0: 9 }, labels: { 0: 'Boşluk' },
      post: [sp('AltRight', 'AltGr', 1.5, 'th'), sp('ControlRight', 'Ctrl', 1.5, 'rp')],
    },
  ];

  // Turkish F layout, arranged on the same physical key positions as the Q rows.
  const F_ROWS = [
    Q_ROWS[0],
    { ...Q_ROWS[1], keys: ['f','g','ğ','ı','o','d','r','n','h','p','q','w',','], fingers: 'lp lr lm li li ri ri rm rr rp rp rp rp' },
    { ...Q_ROWS[2], keys: ['u','i','e','a','ü','t','k','m','l','y','ş'] },
    { ...Q_ROWS[3], keys: ['j','ö','v','c','ç','z','s','b','.','x','-'], shift: ['J','Ö','V','C','Ç','Z','S','B',':','X','_'] },
    Q_ROWS[4],
  ];
  const LAYOUTS = { q: Q_ROWS, f: F_ROWS };
  const PHYSICAL_CODES = [
    ['Backquote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'],
    ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Backslash'],
    ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'],
    ['IntlBackslash','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash'],
    ['Space'],
  ];

  const HOME = new Set(['f', 'j']);
  const isLetter = (c) => c.length === 1 && c.toLocaleLowerCase('tr') !== up(c);

  /** Klavyeyi container içine çizer, arama tabloları döndürür */
  function create(container, layout = 'q') {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    el.innerHTML = '';
    const byChar = new Map();   // karakter -> {el, f, shifted, base}
    const byCode = new Map();   // e.code -> el
    const charByCode = new Map();
    const all = [];

    const addKey = (rowEl, k) => {
      const d = document.createElement('div');
      d.className = 'key' + (k.special ? ' special' : '') + (HOME.has(k.char) ? ' home' : '');
      d.style.setProperty('--w', k.w);
      d.dataset.f = k.f;
      if (k.special) {
        d.textContent = k.label;
        d.dataset.code = k.code;
        byCode.set(k.code, d);
      } else {
        const c = k.char;
        d.dataset.char = c;
        if (k.label) d.textContent = k.label;
        else if (isLetter(c)) d.textContent = up(c);
        else {
          d.innerHTML = `<span class="sh">${k.shift ?? ''}</span>${c}`;
        }
        byChar.set(c, { el: d, f: k.f, shifted: false, base: c });
        if (k.shift && !byChar.has(k.shift)) byChar.set(k.shift, { el: d, f: k.f, shifted: true, base: c });
        if (c === ' ') byCode.set('Space', d);
      }
      rowEl.appendChild(d);
      all.push(d);
    };

    const rows = LAYOUTS[layout] || Q_ROWS;
    rows.forEach((row, rowIndex) => {
      const r = document.createElement('div');
      r.className = 'kb-row';
      (row.pre || []).forEach((k) => addKey(r, k));
      const fs = row.fingers.split(' ');
      row.keys.forEach((c, i) => {
        const shift = row.shift ? row.shift[i] : (isLetter(c) ? up(c) : undefined);
        addKey(r, {
          char: c, shift, f: fs[i],
          w: (row.widths && row.widths[i]) || 1,
          label: row.labels && row.labels[i],
        });
        const keyEl = r.lastElementChild;
        if (PHYSICAL_CODES[rowIndex] && PHYSICAL_CODES[rowIndex][i]) {
          byCode.set(PHYSICAL_CODES[rowIndex][i], keyEl);
          charByCode.set(PHYSICAL_CODES[rowIndex][i], { char: c, shift: shift || up(c) });
        }
      });
      (row.post || []).forEach((k) => addKey(r, k));
      el.appendChild(r);
    });

    function find(ch) {
      if (ch == null) return null;
      return byChar.get(ch) || byChar.get(ch.toLocaleLowerCase('tr')) || null;
    }

    /** Klavye olayından tuş elemanını bul */
    function fromEvent(e) {
      if (byCode.has(e.code)) return { el: byCode.get(e.code), f: byCode.get(e.code).dataset.f };
      if (e.key && e.key.length === 1) return find(e.key);
      return null;
    }

    function characterFromEvent(e) {
      const mapped = charByCode.get(e.code);
      if (!mapped) return e.key;
      return e.shiftKey ? mapped.shift : mapped.char;
    }

    function flash(target, cls) {
      const d = target && (target.el || target);
      if (!d) return;
      d.classList.remove('k-ok', 'k-warn', 'k-bad');
      void d.offsetWidth;
      d.classList.add(cls);
      clearTimeout(d._ft);
      d._ft = setTimeout(() => d.classList.remove(cls), 160);
    }

    /** Karakter yazıldığında tuşu (ve gerekirse karşı Shift'i) yak */
    function press(ch, cls) {
      const k = find(ch);
      if (!k) return null;
      flash(k, cls);
      if (k.shifted || (isLetter(ch) && ch !== ch.toLocaleLowerCase('tr'))) {
        flash(byCode.get(k.f[0] === 'l' ? 'ShiftRight' : 'ShiftLeft'), cls);
      }
      return k;
    }

    return { el, byChar, byCode, all, find, fromEvent, characterFromEvent, flash, press };
  }

  /** Karakter -> parmak (klavye çizmeden) */
  const fingerMap = new Map();
  Q_ROWS.forEach((row) => {
    const fs = row.fingers.split(' ');
    row.keys.forEach((c, i) => {
      fingerMap.set(c, fs[i]);
      const s = row.shift ? row.shift[i] : (isLetter(c) ? up(c) : null);
      if (s && !fingerMap.has(s)) fingerMap.set(s, fs[i]);
    });
  });

  return { FINGERS, ROWS: Q_ROWS, LAYOUTS, create, fingerOf: (c) => fingerMap.get(c) || fingerMap.get(c.toLocaleLowerCase('tr')) };
})();
