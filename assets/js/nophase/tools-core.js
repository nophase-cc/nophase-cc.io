/*
 * NOPHASE browser tools: core.
 *
 * A tiny registry. tools-music.js and tools-dev.js call NP.tool({...}) to add
 * cards; start.js calls NP.render() once the page is ready. Everything runs
 * client-side, nothing is sent anywhere.
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

  var GROUPS = [['music', 'Music'], ['dev', 'Network & Dev']];

  NP.render = function () {
    var host = document.getElementById('tools');
    var bar = document.getElementById('tools-bar');
    if (!host || !bar) return;

    bar.innerHTML =
      '<div class="seg tabs mono" role="tablist" aria-label="Tool category">' +
      GROUPS.map(function (g) {
        return '<button type="button" role="tab" class="seg-btn" data-v="' + g[0] + '">' + g[1] + '</button>';
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

    function showGroup(g) {
      NP.store('nophase.tab', g);
      [].forEach.call(host.children, function (c) { c.hidden = c.getAttribute('data-group') !== g; });
      document.getElementById('audio-bar').hidden = g !== 'music';
      setTab(g);
    }
    var setTab = NP.seg(bar.querySelector('.tabs'), showGroup);

    var saved = NP.store('nophase.tab');
    showGroup(GROUPS.some(function (g) { return g[0] === saved; }) ? saved : 'music');

    NP.seg(document.getElementById('wave-seg'), function (w) { A.wave = w; });
    document.getElementById('vol').addEventListener('input', function (e) { A.setVol(parseFloat(e.target.value)); });
  };
})();
