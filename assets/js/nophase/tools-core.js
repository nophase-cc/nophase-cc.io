/*
 * NOPHASE browser tools: core.
 *
 * A tiny registry. tools-music.js, tools-dev.js and tools-net.js call
 * NP.tool({...}) to add cards; start.js calls NP.render() once the page is
 * ready. Everything runs client-side. The only tool that touches the network is
 * DNS lookup, and only when you press its button.
 *
 * Tool fields: id, group (music | net | sec | dev), title, keys (extra words for
 * the launcher search), html, init(card), optional head (header controls) and
 * wide (spans two columns).
 */
(function () {
  'use strict';

  var NP = (window.NP = window.NP || {});
  var tools = [];
  NP.tools = tools;
  NP.tool = function (def) { tools.push(def); };

  /* ---------- helpers ---------- */

  NP.store = function (key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* storage blocked: everything still works */ }
    return null;
  };

  NP.fmt = function (n, digits) {
    if (!isFinite(n)) return '';
    return String(parseFloat(Number(n).toPrecision(digits === undefined ? 5 : digits)));
  };

  NP.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  NP.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // find an element by data-f="name" inside a tool card
  NP.q = function (root, name) { return root.querySelector('[data-f="' + name + '"]'); };

  var copyTimer = 0;
  NP.copy = function (text, el) {
    var done = function () {
      if (!el) return;
      el.classList.add('copied');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function () { el.classList.remove('copied'); }, 900);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    else done();
  };

  // two-way bound pair of inputs: edit either, the other follows
  NP.pair = function (a, b, ab, ba, digits) {
    function fromA() { var v = parseFloat(a.value); b.value = isFinite(v) ? NP.fmt(ab(v), digits) : ''; }
    function fromB() { var v = parseFloat(b.value); a.value = isFinite(v) ? NP.fmt(ba(v), digits) : ''; }
    a.addEventListener('input', fromA);
    b.addEventListener('input', fromB);
    return fromA;
  };

  // segmented button group: onPick(value) fires when a button is clicked
  NP.seg = function (container, onPick) {
    var btns = [].slice.call(container.querySelectorAll('[data-v]'));
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (o) { o.classList.toggle('active', o === b); });
        onPick(b.getAttribute('data-v'));
      });
    });
    return function (v) {
      btns.forEach(function (o) { o.classList.toggle('active', o.getAttribute('data-v') === v); });
    };
  };

  /* ---------- shared tempo ---------- */

  var bpm = { v: parseFloat(NP.store('nophase.bpm')) || 120, subs: [] };
  NP.bpm = {
    get: function () { return bpm.v; },
    set: function (v, from) {
      v = NP.clamp(parseFloat(v) || 120, 20, 400);
      bpm.v = v;
      NP.store('nophase.bpm', String(v));
      bpm.subs.forEach(function (f) { f(v, from); });
    },
    on: function (f) { bpm.subs.push(f); }
  };

  /* ---------- shared audio ---------- */

  var A = (NP.audio = {
    ctx: null,
    master: null,
    wave: 'sine',
    vol: parseFloat(NP.store('nophase.vol')) || 0.6,
    live: []
  });

  A.get = function () {
    if (!A.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      A.ctx = new AC();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.vol * 0.8;
      var comp = A.ctx.createDynamicsCompressor();
      A.master.connect(comp).connect(A.ctx.destination);
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  };

  A.setVol = function (v) {
    A.vol = v;
    NP.store('nophase.vol', String(v));
    if (A.master) A.master.gain.setTargetAtTime(v * 0.8, A.ctx.currentTime, 0.02);
  };

  // one pitched note. opts: when (ctx time), dur, gain, type, attack
  A.tone = function (freq, opts) {
    var ac = A.get();
    if (!ac) return null;
    opts = opts || {};
    var t0 = opts.when || ac.currentTime;
    var dur = opts.dur || 0.6;
    var g = ac.createGain();
    var osc = ac.createOscillator();
    osc.type = opts.type || A.wave;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.2, t0 + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(A.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  };

  // percussive hit for the euclidean sequencer
  A.hit = function (when, accent) {
    var ac = A.get();
    if (!ac) return;
    var osc = ac.createOscillator();
    var g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 160 : 700, when);
    osc.frequency.exponentialRampToValueAtTime(accent ? 45 : 300, when + 0.12);
    g.gain.setValueAtTime(accent ? 0.5 : 0.25, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + (accent ? 0.28 : 0.09));
    osc.connect(g).connect(A.master);
    osc.start(when);
    osc.stop(when + 0.32);
  };

  // small drum kit: kick, snare, hat, click
  var noiseBuf = null;
  function noise(ac) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.4), ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  A.drum = function (kind, when) {
    var ac = A.get();
    if (!ac || !kind || kind === 'off') return;
    if (kind === 'kick') { A.hit(when, true); return; }
    if (kind === 'click') { A.hit(when, false); return; }
    var src = ac.createBufferSource();
    var f = ac.createBiquadFilter();
    var g = ac.createGain();
    src.buffer = noise(ac);
    if (kind === 'hat') {
      f.type = 'highpass';
      f.frequency.value = 7000;
      g.gain.setValueAtTime(0.22, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    } else {
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.7;
      g.gain.setValueAtTime(0.38, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      var o = ac.createOscillator();
      var og = ac.createGain();
      o.frequency.setValueAtTime(220, when);
      o.frequency.exponentialRampToValueAtTime(140, when + 0.08);
      og.gain.setValueAtTime(0.28, when);
      og.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
      o.connect(og).connect(A.master);
      o.start(when);
      o.stop(when + 0.12);
    }
    src.connect(f).connect(g).connect(A.master);
    src.start(when);
    src.stop(when + 0.2);
  };

  /* ---------- MIDI files + downloads ---------- */

  // notes: [{ t: tick, d: duration ticks, n: note, v: velocity, ch: 0-15 }]
  // Returns a format 0 Standard MIDI File as a Uint8Array.
  NP.midiFile = function (notes, opts) {
    opts = opts || {};
    var ppq = opts.ppq || 480;
    var bytes = [];
    function push() { for (var i = 0; i < arguments.length; i++) bytes.push(arguments[i]); }
    function vlq(n) {
      var out = [n & 0x7f];
      while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
      out.forEach(function (b) { bytes.push(b); });
    }
    var name = String(opts.name || 'NOPHASE').slice(0, 60);
    push(0, 0xff, 0x03, name.length);
    for (var i = 0; i < name.length; i++) bytes.push(name.charCodeAt(i) & 0x7f);
    var us = Math.round(60000000 / (opts.bpm || 120));
    push(0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255);
    push(0, 0xff, 0x58, 4, 4, 2, 24, 8);
    var ev = [];
    notes.forEach(function (n) {
      var ch = (n.ch || 0) & 15;
      ev.push([n.t, 1, 0x90 | ch, n.n & 127, NP.clamp(n.v || 100, 1, 127)]);
      ev.push([n.t + Math.max(1, n.d), 0, 0x80 | ch, n.n & 127, 0]);
    });
    // by time, note-offs first so repeated notes retrigger cleanly
    ev.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var last = 0;
    ev.forEach(function (e) { vlq(e[0] - last); push(e[2], e[3], e[4]); last = e[0]; });
    vlq(Math.max(0, (opts.endTick || last) - last));
    push(0xff, 0x2f, 0);
    var len = bytes.length;
    var head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 255, ppq & 255,
      0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255];
    return new Uint8Array(head.concat(bytes));
  };

  NP.download = function (data, filename, type) {
    var url = URL.createObjectURL(new Blob([data], { type: type || 'application/octet-stream' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  };

  /* ---------- piano keyboard ---------- */

  var BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 };

  // opts: { start: midi of first C, octaves, onKey(midi) }
  NP.piano = function (el, opts) {
    var octaves = opts.octaves || 2;
    var state = { start: opts.start, midi: {}, pc: {}, root: -1 };

    function render() {
      var whites = octaves * 7 + 1;
      var bw = (100 / whites) * 0.62;
      var html = '';
      var wi = 0;
      for (var i = 0; i < octaves * 12 + 1; i++) {
        var m = state.start + i;
        var pc = m % 12;
        var on = state.midi[m] || state.pc[pc] ? ' on' : '';
        var root = state.root === pc && on ? ' root' : '';
        if (BLACK[pc]) {
          html += '<button type="button" class="key key-b' + on + root + '" style="left:calc(' + wi + ' * ' +
            (100 / whites) + '% - ' + (bw / 2) + '%);width:' + bw + '%" data-m="' + m + '" aria-label="' +
            NP.midiName(m) + '"></button>';
        } else {
          html += '<button type="button" class="key key-w' + on + root + '" data-m="' + m + '" aria-label="' +
            NP.midiName(m) + '"><span class="mono">' + (pc === 0 ? 'C' + (Math.floor(m / 12) - 1) : '') +
            '</span></button>';
          wi++;
        }
      }
      el.innerHTML = html;
    }

    el.classList.add('keys');
    el.addEventListener('click', function (e) {
      var k = e.target.closest('.key');
      if (k && opts.onKey) opts.onKey(parseInt(k.getAttribute('data-m'), 10));
    });

    return {
      // midi / pc: arrays of highlighted midi notes or pitch classes
      update: function (u) {
        if (u.start !== undefined) state.start = u.start;
        state.midi = {};
        state.pc = {};
        (u.midi || []).forEach(function (m) { state.midi[m] = 1; });
        (u.pc || []).forEach(function (p) { state.pc[p] = 1; });
        state.root = u.root === undefined ? -1 : u.root;
        render();
      }
    };
  };

  var SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  NP.SHARP = SHARP;
  NP.FLAT = FLAT;
  NP.pcName = function (pc, flats) { return (flats ? FLAT : SHARP)[((pc % 12) + 12) % 12]; };
  NP.midiName = function (m, flats) { return NP.pcName(m, flats) + (Math.floor(m / 12) - 1); };

  /* ---------- rendering ---------- */

  var GROUPS = [['music', 'Music'], ['net', 'Network'], ['sec', 'Security'], ['dev', 'Dev']];
  NP.GROUPS = GROUPS;
  var showGroup = null;

  // Masonry packing for the tool grid: each card spans as many 2px rows as its
  // height needs, so short cards don't leave holes next to tall ones.
  NP.masonry = function (host) {
    if (!window.ResizeObserver) return;
    host.classList.add('masonry');
    var ROW = 2;
    function fit(card) {
      if (card.hidden) return;
      var gap = parseFloat(getComputedStyle(host).columnGap) || 16;
      card.style.gridRowEnd = 'span ' + Math.ceil((card.getBoundingClientRect().height + gap) / ROW);
    }
    var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { fit(e.target); }); });
    [].forEach.call(host.children, function (card) { ro.observe(card); });
    NP.refit = function () { [].forEach.call(host.children, fit); };
  };

  NP.render = function () {
    var host = document.getElementById('tools');
    var bar = document.getElementById('tools-bar');
    if (!host || !bar) return;

    bar.innerHTML =
      '<div class="seg tabs mono" role="tablist" aria-label="Tool category">' +
      GROUPS.map(function (g) {
        var n = tools.filter(function (t) { return t.group === g[0]; }).length;
        return '<button type="button" role="tab" class="seg-btn" data-v="' + g[0] + '">' + g[1] +
          ' <span class="tab-n">' + n + '</span></button>';
      }).join('') + '</div>' +
      '<div class="audio-bar mono" id="audio-bar">' +
      '<span>sound</span>' +
      '<div class="seg" id="wave-seg">' +
      ['sine', 'triangle', 'sawtooth', 'square'].map(function (w) {
        return '<button type="button" class="seg-btn' + (w === A.wave ? ' active' : '') + '" data-v="' + w + '">' +
          w.slice(0, 3) + '</button>';
      }).join('') + '</div>' +
      '<input type="range" min="0" max="1" step="0.01" value="' + A.vol + '" id="vol" aria-label="Volume">' +
      '</div>';

    tools.forEach(function (def) {
      var card = document.createElement('article');
      card.className = 'tool' + (def.wide ? ' tool-wide' : '');
      card.id = 'tool-' + def.id;
      card.setAttribute('data-group', def.group);
      card.innerHTML =
        '<header class="tool-head"><h3 class="mono">' + def.title + '</h3>' + (def.head || '') + '</header>' +
        '<div class="tool-body">' + def.html + '</div>';
      host.appendChild(card);
      try {
        def.init(card);
      } catch (err) {
        card.querySelector('.tool-body').textContent = 'tool failed to load';
        if (window.console) console.error(def.id, err);
      }
    });

    showGroup = function (g) {
      NP.store('nophase.tab', g);
      [].forEach.call(host.children, function (c) { c.hidden = c.getAttribute('data-group') !== g; });
      document.getElementById('audio-bar').hidden = g !== 'music';
      setTab(g);
    };
    var setTab = NP.seg(bar.querySelector('.tabs'), showGroup);

    NP.masonry(host);
    var saved = NP.store('nophase.tab');
    showGroup(GROUPS.some(function (g) { return g[0] === saved; }) ? saved : 'music');

    NP.seg(document.getElementById('wave-seg'), function (w) { A.wave = w; });
    document.getElementById('vol').addEventListener('input', function (e) { A.setVol(parseFloat(e.target.value)); });

    // deep links: /#tool-cidr opens the right tab and jumps to the card
    var m = location.hash.match(/^#tool-([\w-]+)$/);
    if (m) setTimeout(function () { NP.open(m[1]); }, 0);
    window.addEventListener('hashchange', function () {
      var h = location.hash.match(/^#tool-([\w-]+)$/);
      if (h) NP.open(h[1]);
    });
  };

  // Show a tool: switch to its tab, scroll to it, flash it and focus its first field.
  NP.open = function (id) {
    var def = tools.filter(function (t) { return t.id === id; })[0];
    var card = document.getElementById('tool-' + id);
    if (!def || !card || !showGroup) return false;
    showGroup(def.group);
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    var field = card.querySelector('input:not([type=file]):not([type=checkbox]):not([type=range]):not([type=color]), textarea, select');
    if (field) setTimeout(function () { field.focus({ preventScroll: true }); }, 350);
    return true;
  };

  NP.groupName = function (g) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][0] === g) return GROUPS[i][1];
    return g;
  };
})();
