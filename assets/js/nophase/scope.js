/*
 * NOPHASE start page: generative "phase scope" (full-page backdrop).
 *
 * Every load (and every click / space press) rolls a fresh seed, palette and
 * visual mode; `c` swaps only the colours. All four modes are driven by a seeded PRNG, react to the pointer,
 * and honour prefers-reduced-motion (a single static frame is drawn instead).
 */
(function () {
  'use strict';

  var canvas = document.getElementById('scope');
  var root = document.getElementById('start');
  if (!canvas || !root) return;

  // The canvas is a fixed, full-page backdrop. Park it on <body> so no
  // transformed ancestor can break position: fixed.
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  var info = document.getElementById('scope-info');
  var rerollBtn = document.getElementById('reroll');
  var TAU = Math.PI * 2;
  var BG = '11, 11, 14';
  var BG_HEX = '#0b0b0e';

  // Two bright colours per palette: `a` also becomes the page accent, so keep
  // both light enough to read on near-black. The order flips at random, and a
  // share of rolls make a fresh colour-harmony pair instead (see makePalette).
  var PALETTES = [
    { name: 'copper', a: '#ff8a4c', b: '#7fb4ff' },
    { name: 'acid', a: '#c6ff4d', b: '#ff4dcb' },
    { name: 'ice', a: '#8ef0ff', b: '#b69bff' },
    { name: 'signal', a: '#ff4d5e', b: '#ffd166' },
    { name: 'bone', a: '#f3ead8', b: '#ff7a45' },
    { name: 'phosphor', a: '#39ff88', b: '#1fd1c1' },
    { name: 'amber crt', a: '#ffb000', b: '#ff6a00' },
    { name: 'vapor', a: '#ff71ce', b: '#01cdfe' },
    { name: 'sunset', a: '#ff5f6d', b: '#ffc371' },
    { name: 'lagoon', a: '#00e5c7', b: '#4f8dff' },
    { name: 'orchid', a: '#e47cf0', b: '#7cf0c8' },
    { name: 'citrus', a: '#ffe14d', b: '#4dff9a' },
    { name: 'ember', a: '#ff3d2e', b: '#ffb86b' },
    { name: 'glacier', a: '#c9f1ff', b: '#6fa8ff' },
    { name: 'tape', a: '#ffcf8a', b: '#e06c75' },
    { name: 'neon', a: '#00f0ff', b: '#ff00a8' },
    { name: 'moss', a: '#b4e86a', b: '#e8d06a' },
    { name: 'sakura', a: '#ffb7d5', b: '#a7c7ff' },
    { name: 'riso', a: '#ff48b0', b: '#3d9bff' },
    { name: 'ultraviolet', a: '#9d7bff', b: '#ff7bd5' },
    { name: 'reef', a: '#ff7f6b', b: '#3ff2d0' },
    { name: 'gold leaf', a: '#ffd36b', b: '#fff4d6' },
    { name: 'mint chip', a: '#8affc1', b: '#c2a6ff' },
    { name: 'infrared', a: '#ff2a6d', b: '#ff9e2a' },
    { name: 'arctic', a: '#7df9ff', b: '#f2f7ff' },
    { name: 'lime soda', a: '#d4ff3f', b: '#3fd4ff' },
    { name: 'plasma', a: '#ff5ef2', b: '#ffd25e' },
    { name: 'verdigris', a: '#2ee6d6', b: '#e6a92e' },
    { name: 'graphite', a: '#f2f2f2', b: '#8c93a3' },
    { name: 'blood orange', a: '#ff6b3d', b: '#ff3d77' },
    { name: 'tron', a: '#6ef3ff', b: '#ff9d3b' },
    { name: 'lavender haze', a: '#c9b6ff', b: '#ffd6e8' },
    { name: 'toxic', a: '#a6ff00', b: '#ffe600' },
    { name: 'deep sea', a: '#3be8ff', b: '#7a6bff' }
  ];

  // relationship between the two generated hues, in degrees
  var HARMONIES = [['complement', 180], ['split', 150], ['triad', 120], ['square', 90], ['analog', 40]];
  var GENERATED_SHARE = 0.3;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- helpers ---------- */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRandom(seed) {
    var next = mulberry32(seed);
    return {
      next: next,
      range: function (lo, hi) { return lo + next() * (hi - lo); },
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      sign: function () { return next() < 0.5 ? -1 : 1; }
    };
  }

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, alpha) {
    var c = rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
  }

  function hslHex(h, sat, light) {
    sat /= 100;
    light /= 100;
    var amp = sat * Math.min(light, 1 - light);
    function f(n) {
      var k = (n + h / 30) % 12;
      var v = light - amp * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return ('0' + Math.round(v * 255).toString(16)).slice(-2);
    }
    return '#' + f(0) + f(8) + f(4);
  }

  // blues and violets look darker at the same HSL lightness; lift them so the
  // accent stays readable as text on the near-black background
  function lift(hue) {
    return hue > 200 && hue < 290 ? 8 : 0;
  }

  // rand() -> 0..1. Returns { name, a, b }.
  function makePalette(rand) {
    if (rand() < GENERATED_SHARE) {
      var hue = Math.floor(rand() * 360);
      var hm = HARMONIES[Math.floor(rand() * HARMONIES.length)];
      var hue2 = (hue + hm[1] * (rand() < 0.5 ? -1 : 1) + 360) % 360;
      return {
        name: hm[0] + ' ' + hue + '°',
        a: hslHex(hue, 85 + rand() * 15, 62 + rand() * 10 + lift(hue)),
        b: hslHex(hue2, 75 + rand() * 25, 58 + rand() * 14 + lift(hue2))
      };
    }
    var p = PALETTES[Math.floor(rand() * PALETTES.length)];
    return rand() < 0.5 ? { name: p.name, a: p.a, b: p.b } : { name: p.name, a: p.b, b: p.a };
  }

  function mix(hexA, hexB, k, alpha) {
    var a = rgb(hexA);
    var b = rgb(hexB);
    return 'rgba(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' +
      Math.round(a[1] + (b[1] - a[1]) * k) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * k) + ',' + alpha + ')';
  }

  /* ---------- canvas sizing ---------- */

  var W = 1;
  var H = 1;

  function resize() {
    var box = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(box.width));
    H = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG_HEX;
    ctx.fillRect(0, 0, W, H);
  }

  function fade(alpha) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(' + BG + ',' + alpha + ')';
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- pointer (smoothed, -1..1) ---------- */

  var ptr = { x: 0, y: 0, tx: 0, ty: 0, ax: -9999, ay: -9999, active: false, idle: 0 };

  document.addEventListener('pointermove', function (e) {
    var box = canvas.getBoundingClientRect();
    var px = e.clientX - box.left;
    var py = e.clientY - box.top;
    ptr.tx = Math.max(-1, Math.min(1, (px / box.width) * 2 - 1));
    ptr.ty = Math.max(-1, Math.min(1, (py / box.height) * 2 - 1));
    ptr.ax = px;
    ptr.ay = py;
    ptr.active = true;
    ptr.idle = 0;
  });

  document.documentElement.addEventListener('pointerleave', function () {
    ptr.active = false;
    ptr.ax = -9999;
    ptr.ay = -9999;
  });

  function updatePointer(dt, t) {
    ptr.idle += dt;
    if (!ptr.active && ptr.idle > 1.5) {
      // drift slowly on its own so touch devices and idle tabs keep moving
      ptr.tx = Math.sin(t * 0.17) * 0.6;
      ptr.ty = Math.cos(t * 0.13) * 0.5;
    }
    var k = 1 - Math.pow(0.001, dt);
    ptr.x += (ptr.tx - ptr.x) * k;
    ptr.y += (ptr.ty - ptr.y) * k;
  }

  /* ---------- scenes ---------- */

  // Two phase-offset Lissajous curves, like a goniometer with a drifting phase.
  function lissajous(R, pal) {
    var a = R.int(1, 7);
    var b = R.int(1, 7);
    if (a === b) b = a + R.int(1, 3);
    var speed = R.range(0.12, 0.45) * R.sign();
    var phi = R.range(0, TAU);
    var delta = R.range(0.08, 0.35);
    var wobble = R.int(2, 6);
    var points = 700;

    return {
      label: 'lissajous ' + a + ':' + b,
      fade: 0.15,
      step: function (dt, t) {
        phi += dt * speed;
        fade(0.15);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        var cx = W / 2;
        var cy = H / 2;
        var rx = W * 0.34;
        var ry = H * 0.38;
        for (var k = 0; k < 2; k++) {
          ctx.strokeStyle = rgba(k ? pal.b : pal.a, 0.8);
          var ph = phi + k * (delta + ptr.x * 1.1);
          ctx.beginPath();
          for (var i = 0; i <= points; i++) {
            var th = (i / points) * TAU;
            var x = Math.sin(a * th + ph);
            var y = Math.sin(b * th) + ptr.y * 0.3 * Math.sin(wobble * th + t * 0.8);
            if (i) ctx.lineTo(cx + x * rx, cy + y * ry);
            else ctx.moveTo(cx + x * rx, cy + y * ry);
          }
          ctx.stroke();
        }
      }
    };
  }

  // A damped four-pendulum harmonograph that redraws itself when it dies out.
  function harmonograph(R, pal) {
    var p = {};
    var t, fxs, fys, ends, state, hold;

    function reset() {
      p.fx1 = R.int(1, 5) + R.range(-0.02, 0.02);
      p.fx2 = R.int(1, 5) + R.range(-0.02, 0.02);
      p.fy1 = R.int(1, 5) + R.range(-0.02, 0.02);
      p.fy2 = R.int(1, 5) + R.range(-0.02, 0.02);
      p.px = [R.range(0, TAU), R.range(0, TAU)];
      p.py = [R.range(0, TAU), R.range(0, TAU)];
      ends = R.range(180, 320);
      p.d = 3.2 / ends;
      t = 0;
      state = 'draw';
      hold = 0;
      fxs = null;
      ctx.fillStyle = BG_HEX;
      ctx.fillRect(0, 0, W, H);
    }

    function pos(tt) {
      var dx = Math.exp(-p.d * tt);
      var dy = Math.exp(-p.d * 1.15 * tt);
      var x = 0.58 * Math.sin(p.fx1 * tt + p.px[0]) * dx +
        0.42 * Math.sin((p.fx2 + ptr.x * 0.01) * tt + p.px[1]) * dx;
      var y = 0.58 * Math.sin(p.fy1 * tt + p.py[0]) * dy +
        0.42 * Math.sin((p.fy2 + ptr.y * 0.01) * tt + p.py[1]) * dy;
      return [W / 2 + x * W * 0.30, H / 2 + y * H * 0.40];
    }

    reset();

    return {
      label: 'harmonograph ' + Math.round(p.fx1) + '/' + Math.round(p.fy1),
      step: function (dt) {
        if (state === 'hold') {
          fade(0.06);
          hold -= dt;
          if (hold <= 0) reset();
          return;
        }
        fade(0.012);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1.1;
        var steps = Math.max(8, Math.round(dt * 60 * 55));
        var prev = pos(t);
        for (var i = 0; i < steps; i++) {
          t += 0.012;
          var cur = pos(t);
          ctx.strokeStyle = mix(pal.a, pal.b, 0.5 + 0.5 * Math.sin(t * 0.045), 0.9);
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(cur[0], cur[1]);
          ctx.stroke();
          prev = cur;
        }
        if (t > ends * 1.5) {
          state = 'hold';
          hold = 1.6;
        }
      }
    };
  }

  // Particles riding a time-varying angle field, swirling around the pointer.
  function flow(R, pal) {
    var count = Math.round(Math.max(300, Math.min(2400, (W * H) / 560)));
    var f1 = R.range(0.0018, 0.006);
    var f2 = R.range(0.0018, 0.006);
    var f3 = R.range(0.001, 0.004);
    var amp = R.range(1.6, 3.6);
    var speed = R.range(0.9, 1.7);
    var swirl = R.sign();
    var ps = [];

    function spawn(q) {
      q.x = R.next() * W;
      q.y = R.next() * H;
      q.life = R.range(80, 260);
      q.c = R.next() < 0.5;
    }
    for (var i = 0; i < count; i++) {
      var q = {};
      spawn(q);
      ps.push(q);
    }

    return {
      label: 'flow field ' + count,
      step: function (dt, t) {
        fade(0.07);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1;
        var pa = new Path2D();
        var pb = new Path2D();
        var sp = speed * dt * 60;
        for (var i = 0; i < ps.length; i++) {
          var q = ps[i];
          var ang = Math.sin(q.x * f1 + t * 0.21) * amp +
            Math.cos(q.y * f2 - t * 0.17) * amp +
            Math.sin((q.x + q.y) * f3 + t * 0.11) * amp * 0.6;
          if (ptr.active) {
            var dx = q.x - ptr.ax;
            var dy = q.y - ptr.ay;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < 190) ang += (1 - d / 190) * 3.2 * swirl + Math.atan2(dy, dx) * (1 - d / 190) * 0.4;
          }
          var nx = q.x + Math.cos(ang) * sp * 1.6;
          var ny = q.y + Math.sin(ang) * sp * 1.6;
          var path = q.c ? pa : pb;
          path.moveTo(q.x, q.y);
          path.lineTo(nx, ny);
          q.x = nx;
          q.y = ny;
          q.life -= sp;
          if (q.life <= 0 || nx < -10 || nx > W + 10 || ny < -10 || ny > H + 10) spawn(q);
        }
        ctx.strokeStyle = rgba(pal.a, 0.6);
        ctx.stroke(pa);
        ctx.strokeStyle = rgba(pal.b, 0.6);
        ctx.stroke(pb);
      }
    };
  }

  // Stacked waveform ridgelines, a nod to pulsar plots and scope screens.
  function ridges(R, pal) {
    var peaks = [];
    var n = R.int(2, 4);
    for (var i = 0; i < n; i++) {
      peaks.push({
        c: R.range(0.2, 0.8),
        h: R.range(0.5, 1),
        s: R.range(0.04, 0.12),
        w: R.range(0.2, 0.7),
        p: R.range(0, TAU)
      });
    }
    var noise = R.range(0.1, 0.3);
    var nf1 = R.range(25, 60);
    var nf2 = R.range(60, 120);
    var tilt = R.range(-0.2, 0.2);

    return {
      label: 'ridgelines x' + n,
      step: function (dt, t) {
        fade(1);
        var rows = Math.max(22, Math.min(46, Math.round(H / 13)));
        var cols = Math.max(60, Math.round(W / 7));
        var top = H * 0.1;
        var span = H * 0.86;
        var x0 = -W * 0.02;
        var x1 = W * 1.02;
        var ys = new Array(cols + 1);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1.3;
        ctx.lineJoin = 'round';
        for (var r = 0; r < rows; r++) {
          var rk = r / (rows - 1);
          var base = top + rk * span;
          for (var i = 0; i <= cols; i++) {
            var u = i / cols;
            var env = Math.sin(u * Math.PI);
            var amp = 0;
            for (var k = 0; k < peaks.length; k++) {
              var pk = peaks[k];
              var c = pk.c + Math.sin(t * pk.w + pk.p) * 0.12 + (k === 0 ? ptr.x * 0.18 : 0);
              var du = (u - c) / pk.s;
              amp += pk.h * Math.exp(-0.5 * du * du);
            }
            var nz = Math.sin(u * nf1 + r * 1.7 + t * 1.9) * Math.sin(u * nf2 - r * 2.3 - t * 1.3);
            var lift = (amp * (0.9 + 0.5 * (1 - ptr.y)) + noise * nz * (0.3 + amp)) * env;
            ys[i] = base - lift * H * 0.11 * (0.7 + rk * 0.6) + (u - 0.5) * tilt * 12;
          }
          ctx.beginPath();
          ctx.moveTo(x0, ys[0]);
          for (i = 1; i <= cols; i++) ctx.lineTo(x0 + (x1 - x0) * (i / cols), ys[i]);
          ctx.lineTo(x1, H + 20);
          ctx.lineTo(x0, H + 20);
          ctx.closePath();
          ctx.fillStyle = BG_HEX;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x0, ys[0]);
          for (i = 1; i <= cols; i++) ctx.lineTo(x0 + (x1 - x0) * (i / cols), ys[i]);
          ctx.strokeStyle = mix(pal.b, pal.a, rk, 0.35 + rk * 0.6);
          ctx.stroke();
        }
      }
    };
  }

  var SCENES = [lissajous, harmonograph, flow, ridges];

  /* ---------- orchestration ---------- */

  var seed = 0;
  var modeIndex = -1;
  // one live object: scenes read pal.a / pal.b every frame, so recolouring
  // (the `c` key) can swap colours without rebuilding the scene
  var pal = { name: PALETTES[0].name, a: PALETTES[0].a, b: PALETTES[0].b };
  var scene = null;
  var clock = 0;
  var raf = 0;
  var last = 0;

  function setInfo() {
    if (!info || !scene) return;
    info.textContent = scene.label + ' · ' + pal.name + ' · #' +
      ('0000' + (seed & 0xffff).toString(16)).slice(-4);
  }

  function applyPalette() {
    root.style.setProperty('--accent', pal.a);
    root.style.setProperty('--accent-2', pal.b);
  }

  function setPalette(p) {
    pal.name = p.name;
    pal.a = p.a;
    pal.b = p.b;
    applyPalette();
  }

  function recolour() {
    setPalette(makePalette(Math.random));
    setInfo();
    if (reduceMotion.matches) build(modeIndex, true);
  }

  function build(forceMode, keepPalette) {
    var R = makeRandom(seed);
    var rolled = makePalette(R.next);
    if (!keepPalette) setPalette(rolled);
    // always consume the mode draw so a given seed + mode builds the same scene
    var drawn = R.int(0, SCENES.length - 1);
    if (typeof forceMode === 'number') modeIndex = forceMode;
    else modeIndex = drawn === modeIndex ? (drawn + 1) % SCENES.length : drawn;
    resize();
    scene = SCENES[modeIndex](R, pal);
    setInfo();
    if (reduceMotion.matches) {
      for (var i = 0; i < 260; i++) scene.step(1 / 60, i / 60);
    }
  }

  function reroll(forceMode) {
    seed = (Math.random() * 0xffffffff) >>> 0;
    build(forceMode);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    clock += dt;
    updatePointer(dt, clock);
    root.style.setProperty('--phase', (ptr.x + Math.sin(clock * 0.9) * 0.35).toFixed(3));
    scene.step(dt, clock);
  }

  function start() {
    if (raf || reduceMotion.matches || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---------- wiring ---------- */

  // click empty space (hero, gaps between sections) to re-roll
  root.addEventListener('click', function (e) {
    if (e.target.closest('input, button, a, form, select, textarea, label, .tool, .link-group, .feed-col, .launch-wrap, .project-card, .tools-bar, .start-h')) return;
    reroll();
  });

  if (rerollBtn) rerollBtn.addEventListener('click', function () { reroll(); });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var el = document.activeElement;
    var typing = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if (typing) return;
    if (e.key === ' ' && !(el && /^(BUTTON|A|SUMMARY)$/.test(el.tagName))) {
      e.preventDefault();
      reroll();
    } else if (/^[1-4]$/.test(e.key)) {
      reroll(Number(e.key) - 1);
    } else if (e.key === 'c' || e.key === 'C') {
      recolour();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  // dim the backdrop as you scroll down into the content
  function dim() {
    var k = Math.min(1, window.scrollY / (window.innerHeight * 0.85));
    canvas.style.opacity = (1 - k * 0.7).toFixed(3);
  }
  window.addEventListener('scroll', dim, { passive: true });
  dim();

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var wasRunning = !!raf;
      stop();
      build(modeIndex, true);
      if (wasRunning) start();
    }, 150);
  });

  reduceMotion.addEventListener('change', function () {
    stop();
    build(modeIndex, true);
    start();
  });

  var params = new URLSearchParams(location.search);
  var urlSeed = parseInt(params.get('seed'), 16);
  seed = isNaN(urlSeed) ? ((Math.random() * 0xffffffff) >>> 0) : urlSeed;
  var urlMode = parseInt(params.get('mode'), 10);
  build(!isNaN(urlMode) && urlMode >= 1 && urlMode <= SCENES.length ? urlMode - 1 : undefined);
  start();
})();
