/* =========================================================
   FX — ritim oyunu tarzı vuruş efektleri (canvas, metnin üstünde)
   Işık hüzmesi + vuruş çizgisi + halka + kıvılcımlar
   ========================================================= */
window.FX = (() => {
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let level = 2;              // 0 kapalı, 1 düşük, 2 yüksek
  const beams = [], rings = [], parts = [], flashes = [], boxes = [], impacts = [];
  const MAX_PARTS = 700;
  let running = false, last = 0;

  const PALETTE = {
    ok: [62, 240, 143],
    warn: [255, 159, 28],
    bad: [255, 61, 90],
    gold: [255, 209, 102],
    blue: [122, 162, 255],
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const col = (c) => (typeof c === 'string' ? PALETTE[c] : c);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function start() {
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }

  function spark(x, y, c, vx, vy, life, size) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push({ x, y, vx, vy, t: 0, life, size, c });
  }

  /**
   * Tek harf vuruşu. (x, y) = harfin alt-orta noktası, w/h = harf boyutu.
   */
  function hit(x, y, color, o = {}) {
    if (!level) return;
    const c = col(color);
    const s = o.strength || 1;
    const w = o.w || 14, h = o.h || 24;
    const cy = y + 2;          // vuruş çizgisi: harfin hemen altı

    // yukarı yükselen ışık hüzmesi (piyano oyunlarındaki "hit lane")
    beams.push({ x, y, w: w * 1.25, len: (level === 2 ? 78 : 46) * s, t: 0, life: 360, c });
    // vuruş çizgisi + parlama
    flashes.push({ x, y: cy, r: 16 * s, t: 0, life: 230, c, lineW: w * 2.4, flat: 0.45 });
    // genişleyen halka
    rings.push({ x, y: cy, r0: 3, r1: (level === 2 ? 24 : 16) * s, t: 0, life: 420, c, lw: 2.2, flat: 0.32 });
    if (level === 2 && s > 1) rings.push({ x, y: cy, r0: 2, r1: 38 * s, t: -60, life: 480, c, lw: 1.3, flat: 0.32 });

    // kıvılcımlar
    const n = Math.round((level === 2 ? 11 : 4) * s);
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.92, -Math.PI * 0.08);
      const sp = rnd(70, 260) * s;
      spark(x + rnd(-w / 2, w / 2), cy, c,
        Math.cos(a) * sp, Math.sin(a) * sp, rnd(380, 760), rnd(1, 2.6));
    }
    start();
  }

  /** Yanlış kelime: kelimenin etrafında kırmızı şok dalgası + saçılma */
  function wordBurst(rect, color = 'bad') {
    if (!level) return;
    const c = col(color);
    boxes.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height, t: 0, life: 520, c });
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    flashes.push({ x: cx, y: cy, r: Math.max(rect.width * 0.6, 30), t: 0, life: 300, c, lineW: rect.width + 20 });
    const n = level === 2 ? Math.min(46, 14 + rect.width / 4) : 12;
    for (let i = 0; i < n; i++) {
      const px = rect.left + Math.random() * rect.width;
      const py = rect.top + Math.random() * rect.height;
      const a = Math.atan2(py - cy, px - cx) + rnd(-0.5, 0.5);
      const sp = rnd(80, 300);
      spark(px, py, c, Math.cos(a) * sp, Math.sin(a) * sp - 60, rnd(420, 820), rnd(1.2, 3));
    }
    start();
  }

  /** Uzun ve hızlı seriden sonra yapılan hatayı karakterin üzerinde belirginleştirir. */
  function mistakeEl(el, streak = 0) {
    if (!level || !el) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const c = PALETTE.bad;
    const power = Math.min(1.7, 1 + streak / 80);
    impacts.push({ x, y, t: 0, life: 580, power });
    flashes.push({ x, y, r: 105 * power, t: 0, life: 420, c, lineW: 150 * power, flat: 1 });
    rings.push({ x, y, r0: 8, r1: 115 * power, t: 0, life: 620, c, lw: 4, flat: 0.8 });
    rings.push({ x, y, r0: 3, r1: 68 * power, t: -75, life: 500, c, lw: 2.5, flat: 0.8 });
    const count = level === 2 ? 44 : 20;
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2), speed = rnd(150, 520) * power;
      spark(x, y, c, Math.cos(a) * speed, Math.sin(a) * speed, rnd(420, 850), rnd(2, 4.5));
    }
    start();
  }

  /** Kutlama (rekor vb.) */
  function celebrate(x, y) {
    if (!level) return;
    const cs = [PALETTE.ok, PALETTE.gold, PALETTE.blue, PALETTE.warn];
    for (let i = 0; i < 160; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(120, 560);
      spark(x, y, cs[i % cs.length], Math.cos(a) * sp, Math.sin(a) * sp - 200, rnd(900, 1700), rnd(1.5, 3.4));
    }
    rings.push({ x, y, r0: 4, r1: 160, t: 0, life: 700, c: PALETTE.gold, lw: 3 });
    start();
  }

  function step(arr, dt) {
    for (let i = arr.length - 1; i >= 0; i--) {
      arr[i].t += dt;
      if (arr[i].t >= arr[i].life) { arr[i] = arr[arr.length - 1]; arr.pop(); }
    }
  }

  function loop(now) {
    const realDt = Math.max(0, now - last);
    const dt = Math.min(realDt, 50);   // fizik için sınırlı adım
    last = now;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // Hüzmeler
    for (const b of beams) {
      if (b.t < 0) continue;
      const k = b.t / b.life, e = 1 - k;
      const len = b.len * (0.55 + 0.45 * Math.sin(Math.min(1, k * 2.2) * Math.PI / 2));
      const w = b.w * (1 + 0.25 * k) * (0.4 + 0.6 * e);
      const g = ctx.createLinearGradient(0, b.y, 0, b.y - len);
      g.addColorStop(0, rgba(b.c, 0.3 * e));
      g.addColorStop(0.3, rgba(b.c, 0.1 * e));
      g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(b.x - w / 2, b.y - len, w, len);
      // çekirdek ince çizgi
      ctx.fillStyle = rgba(b.c, 0.5 * e * e);
      ctx.fillRect(b.x - 1, b.y - len * 0.8, 2, len * 0.8);
    }

    // Parlamalar + vuruş çizgisi
    for (const f of flashes) {
      const e = 1 - f.t / f.life;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, rgba(f.c, 0.45 * e));
      g.addColorStop(1, rgba(f.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * (f.flat || 1), 0, 0, Math.PI * 2); ctx.fill();
      const lw = f.lineW * (0.6 + 0.4 * e);
      const lg = ctx.createLinearGradient(f.x - lw / 2, 0, f.x + lw / 2, 0);
      lg.addColorStop(0, rgba(f.c, 0));
      lg.addColorStop(0.5, rgba(f.c, 0.95 * e));
      lg.addColorStop(1, rgba(f.c, 0));
      ctx.fillStyle = lg;
      ctx.fillRect(f.x - lw / 2, f.y - 1, lw, 2);
    }

    // Halkalar
    for (const r of rings) {
      if (r.t < 0) continue;
      const k = r.t / r.life, e = 1 - k;
      const ease = 1 - Math.pow(1 - k, 3);
      ctx.strokeStyle = rgba(r.c, 0.75 * e);
      ctx.lineWidth = r.lw * e + 0.3;
      const rr = r.r0 + (r.r1 - r.r0) * ease;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rr, rr * (r.flat || 1), 0, 0, Math.PI * 2); ctx.stroke();
    }

    // Şok kutuları (yanlış kelime)
    for (const b of boxes) {
      const k = b.t / b.life, e = 1 - k;
      const pad = 2 + 16 * (1 - Math.pow(1 - k, 3));
      ctx.strokeStyle = rgba(b.c, 0.85 * e);
      ctx.lineWidth = 2.5 * e + 0.5;
      roundRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, 8 + pad / 2);
      ctx.stroke();
      ctx.fillStyle = rgba(b.c, 0.1 * e);
      roundRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 6);
      ctx.fill();
    }

    // Çizgi roman tarzı yıldız patlaması: kısa, yüksek kontrastlı ve tuş alanının dışında.
    for (const b of impacts) {
      const k = Math.min(1, b.t / 170), fade = 1 - b.t / b.life;
      const outer = (42 + 76 * k) * b.power, inner = outer * .62;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = i * Math.PI / 10, rad = i % 2 ? inner : outer;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad * .82;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fillStyle = `rgba(255,61,90,${.86 * fade})`; ctx.fill();
      ctx.lineWidth = 5 * fade + 1; ctx.strokeStyle = `rgba(255,255,255,${.95 * fade})`; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(12,14,20,${fade})`; ctx.stroke();
      ctx.rotate(Math.PI / 2); ctx.font = `900 ${Math.round(28 * b.power)}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(12,14,20,${fade})`; ctx.lineWidth = 7; ctx.strokeText('!', 0, 1);
      ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.fillText('!', 0, 1); ctx.restore();
    }

    // Kıvılcımlar
    const sec = dt / 1000;
    for (const p of parts) {
      p.vy += 520 * sec;
      p.vx *= 0.985;
      p.x += p.vx * sec; p.y += p.vy * sec;
      const e = 1 - p.t / p.life;
      ctx.fillStyle = rgba(p.c, e);
      const s = p.size * (0.5 + 0.5 * e);
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(p.c, 0.18 * e);
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 3, 0, Math.PI * 2); ctx.fill();
    }

    step(beams, realDt); step(flashes, realDt); step(rings, realDt); step(parts, realDt); step(boxes, realDt); step(impacts, realDt);
    ctx.globalCompositeOperation = 'source-over';

    if (beams.length + flashes.length + rings.length + parts.length + boxes.length + impacts.length) {
      requestAnimationFrame(loop);
    } else {
      running = false;
      ctx.clearRect(0, 0, W, H);
    }
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Bir DOM elemanının konumunda vuruş efekti */
  function hitEl(el, color, o = {}) {
    if (!level || !el) return;
    const r = el.getBoundingClientRect();
    hit(r.left + r.width / 2, r.bottom - (o.inset || 0), color, { w: r.width, h: r.height, ...o });
  }

  return {
    hit, hitEl, wordBurst, mistakeEl, celebrate,
    setLevel(l) { level = l; },
    get level() { return level; },
  };
})();
