/* NOPHASE browser tools: music. Needs tools-core.js. */
(function () {
  'use strict';

  var NP = window.NP;
  if (!NP) return;
  var q = NP.q;
  var fmt = NP.fmt;
  var A = NP.audio;

  NP.a4 = { v: 440 };
  function midiToHz(m) { return NP.a4.v * Math.pow(2, (m - 69) / 12); }

  function option(list, sel) {
    return list.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('');
  }

  var ROOTS = NP.SHARP.map(function (n, i) { return [String(i), n]; });

  /* =====================================================================
   * Tempo -> time
   * ===================================================================== */
  NP.tool({
    id: 'tempo',
    group: 'music',
    title: 'Tempo → time',
    keys: 'bpm tap delay reverb ms note length dotted triplet',
    head: '<div class="seg mono" data-f="unit"><button type="button" class="seg-btn active" data-v="ms">ms</button>' +
      '<button type="button" class="seg-btn" data-v="hz">Hz</button></div>',
    html:
      '<div class="bpm-row">' +
      '<button type="button" class="step-btn mono" data-f="half" title="Half time">½</button>' +
      '<label class="bpm-field"><input data-f="bpm" class="field mono" type="number" min="20" max="400" step="0.1" aria-label="BPM"><span class="mono">BPM</span></label>' +
      '<button type="button" class="step-btn mono" data-f="double" title="Double time">2×</button>' +
      '<button type="button" class="tap-btn mono" data-f="tap">TAP</button></div>' +
      '<table class="time-table mono"><thead><tr><th></th><th>straight</th><th>dotted</th><th>triplet</th></tr></thead>' +
      '<tbody data-f="rows"></tbody></table>' +
      '<p class="tool-note mono">click a value to copy</p>',
    init: function (c) {
      var bpmEl = q(c, 'bpm');
      var rows = q(c, 'rows');
      var unit = 'ms';
      var NOTES = [['1/1', 4], ['1/2', 2], ['1/4', 1], ['1/8', 0.5], ['1/16', 0.25], ['1/32', 0.125]];

      function show(ms) {
        if (unit === 'hz') return fmt(1000 / ms, 4);
        return ms < 100 ? ms.toFixed(2) : ms.toFixed(1);
      }
      function draw() {
        var beat = 60000 / NP.bpm.get();
        rows.innerHTML = NOTES.map(function (n) {
          var ms = beat * n[1];
          return '<tr><th scope="row">' + n[0] + '</th>' + [ms, ms * 1.5, ms * 2 / 3].map(function (v) {
            return '<td><button type="button" class="cell" data-copy="' + show(v) + '">' + show(v) + '</button></td>';
          }).join('') + '</tr>';
        }).join('');
      }

      bpmEl.value = fmt(NP.bpm.get(), 4);
      draw();
      NP.bpm.on(function (v, from) {
        if (from !== 'tempo') bpmEl.value = fmt(v, 4);
        draw();
      });
      bpmEl.addEventListener('input', function () {
        if (parseFloat(bpmEl.value) > 0) NP.bpm.set(bpmEl.value, 'tempo');
      });
      q(c, 'half').addEventListener('click', function () { NP.bpm.set(NP.bpm.get() / 2); });
      q(c, 'double').addEventListener('click', function () { NP.bpm.set(NP.bpm.get() * 2); });
      rows.addEventListener('click', function (e) {
        var cell = e.target.closest('.cell');
        if (cell) NP.copy(cell.getAttribute('data-copy'), cell);
      });
      NP.seg(q(c, 'unit'), function (u) { unit = u; draw(); });

      var taps = [];
      q(c, 'tap').addEventListener('click', function () {
        var now = performance.now();
        if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
        taps.push(now);
        taps = taps.slice(-8);
        if (taps.length > 1) {
          NP.bpm.set(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
        }
      });
    }
  });

  /* =====================================================================
   * Note <-> Hz <-> MIDI + keyboard
   * ===================================================================== */
  NP.tool({
    id: 'pitch',
    group: 'music',
    title: 'Note ↔ Hz ↔ MIDI',
    keys: 'frequency hz midi note number cents tuning a4 keyboard',
    head: '<label class="ref mono">A4 <input data-f="a4" class="field field-sm mono" type="number" min="400" max="480" step="0.1" value="440" aria-label="A4 reference in Hz"></label>',
    html:
      '<div class="pitch-row">' +
      '<label><span class="mono">note</span><input data-f="note" class="field mono" type="text" spellcheck="false" autocapitalize="off"></label>' +
      '<label><span class="mono">midi</span><input data-f="midi" class="field mono" type="number" min="0" max="127" step="any"></label>' +
      '<label><span class="mono">Hz</span><input data-f="hz" class="field mono" type="number" min="1" max="20000" step="any"></label></div>' +
      '<p class="pitch-out mono" data-f="out"></p>' +
      '<div data-f="keys"></div>' +
      '<div class="pitch-ctl"><button type="button" class="tap-btn mono" data-f="drone"><i class="fas fa-play fa-fw"></i> drone</button></div>',
    init: function (c) {
      var noteEl = q(c, 'note');
      var midiEl = q(c, 'midi');
      var hzEl = q(c, 'hz');
      var a4El = q(c, 'a4');
      var out = q(c, 'out');
      var cur = parseInt(NP.store('nophase.midi'), 10);
      if (!(cur >= 0 && cur <= 127)) cur = 69;
      var drone = null;

      function parseNote(s) {
        var m = String(s).trim().match(/^([A-Ga-g])([#b♯♭]?)(-?\d)$/);
        if (!m) return null;
        var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
        var acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] ? -1 : 0;
        return (parseInt(m[3], 10) + 1) * 12 + base + acc;
      }

      var piano = NP.piano(q(c, 'keys'), {
        start: 48,
        octaves: 2,
        onKey: function (m) {
          cur = m;
          NP.store('nophase.midi', String(m));
          show();
          A.tone(midiToHz(m), { dur: 0.7 });
        }
      });

      function show(source) {
        var f = midiToHz(cur);
        var r = Math.round(cur);
        if (source !== 'note') noteEl.value = NP.midiName(r);
        if (source !== 'midi') midiEl.value = r === cur ? cur : fmt(cur, 5);
        if (source !== 'hz') hzEl.value = fmt(f, 6);
        var cents = (cur - r) * 100;
        var wl = 343 / f;
        out.textContent = NP.midiName(r) + (Math.abs(cents) > 0.05 ? (cents > 0 ? ' +' : ' ') + cents.toFixed(1) + '¢' : '') +
          '  ·  ' + fmt(1000 / f, 4) + ' ms  ·  λ ' + (wl >= 1 ? fmt(wl, 3) + ' m' : fmt(wl * 100, 3) + ' cm');
        var oct = NP.clamp(Math.floor(r / 12) - 1, 0, 8);
        piano.update({ start: (oct + 1) * 12, midi: [r] });
        if (drone) drone.osc.frequency.setTargetAtTime(f, drone.ac.currentTime, 0.02);
      }

      noteEl.addEventListener('input', function () {
        var m = parseNote(noteEl.value);
        if (m !== null && m >= 0 && m <= 127) { cur = m; show('note'); }
      });
      midiEl.addEventListener('input', function () {
        var m = parseFloat(midiEl.value);
        if (isFinite(m) && m >= 0 && m <= 127) { cur = m; show('midi'); }
      });
      hzEl.addEventListener('input', function () {
        var f = parseFloat(hzEl.value);
        if (f > 0) { cur = NP.clamp(69 + 12 * Math.log(f / NP.a4.v) / Math.LN2, 0, 127); show('hz'); }
      });
      a4El.addEventListener('input', function () {
        var v = parseFloat(a4El.value);
        if (v > 0) { NP.a4.v = v; show(); }
      });

      var btn = q(c, 'drone');
      btn.addEventListener('click', function () {
        if (drone) {
          drone.gain.gain.setTargetAtTime(0.0001, drone.ac.currentTime, 0.04);
          drone.osc.stop(drone.ac.currentTime + 0.25);
          drone = null;
          btn.classList.remove('active');
          btn.innerHTML = '<i class="fas fa-play fa-fw"></i> drone';
          return;
        }
        var ac = A.get();
        if (!ac) return;
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        osc.type = A.wave;
        osc.frequency.value = midiToHz(cur);
        gain.gain.value = 0.0001;
        gain.gain.setTargetAtTime(0.14, ac.currentTime, 0.04);
        osc.connect(gain).connect(A.master);
        osc.start();
        drone = { ac: ac, osc: osc, gain: gain };
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-stop fa-fw"></i> stop';
      });

      show();
    }
  });

  /* =====================================================================
   * Cycle / LFO calculator
   * ===================================================================== */
  NP.tool({
    id: 'cycle',
    group: 'music',
    title: 'LFO / cycle time',
    keys: 'lfo rate period sync bars beats hz',
    html:
      '<div class="cyc-row">' +
      '<label><span class="mono">cycle length</span><input data-f="val" class="field mono" type="number" min="0" step="any" value="2"></label>' +
      '<label><span class="mono">unit</span><select data-f="unit" class="field mono">' +
      option([['s', 'seconds'], ['ms', 'ms'], ['hz', 'Hz'], ['beats', 'beats'], ['bars', 'bars (4/4)']], 's') +
      '</select></label></div>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<p class="tool-note mono" data-f="note"></p>',
    init: function (c) {
      var val = q(c, 'val');
      var unit = q(c, 'unit');
      var out = q(c, 'out');
      var note = q(c, 'note');

      // every sync division in beats, straight / dotted / triplet
      var DIVS = [];
      [[32, '8 bars'], [16, '4 bars'], [8, '2 bars'], [4, '1 bar'], [2, '1/2'], [1, '1/4'], [0.5, '1/8'],
        [0.25, '1/16'], [0.125, '1/32'], [0.0625, '1/64']].forEach(function (d) {
        DIVS.push({ b: d[0], n: d[1] });
        DIVS.push({ b: d[0] * 1.5, n: d[1] + ' dotted' });
        DIVS.push({ b: d[0] * 2 / 3, n: d[1] + ' triplet' });
      });

      function draw() {
        var beat = 60000 / NP.bpm.get();
        var v = parseFloat(val.value);
        if (!(v > 0)) { out.innerHTML = ''; note.textContent = ''; return; }
        var ms = { ms: v, s: v * 1000, hz: 1000 / v, beats: v * beat, bars: v * beat * 4 }[unit.value];
        var beats = ms / beat;
        var best = DIVS.reduce(function (a, d) {
          return Math.abs(Math.log(d.b / beats)) < Math.abs(Math.log(a.b / beats)) ? d : a;
        });
        var err = (best.b / beats - 1) * 100;
        out.innerHTML = [
          ['period', fmt(ms, 5) + ' ms'],
          ['rate', fmt(1000 / ms, 5) + ' Hz'],
          ['beats', fmt(beats, 4)],
          ['bars (4/4)', fmt(beats / 4, 4)],
          ['nearest sync', best.n + (Math.abs(err) < 0.05 ? ' (exact)' : ' (' + (err > 0 ? '+' : '') + err.toFixed(1) + '%)')]
        ].map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('');
        note.textContent = 'at ' + fmt(NP.bpm.get(), 4) + ' BPM (shared with the tempo tool)';
      }

      val.addEventListener('input', draw);
      unit.addEventListener('change', draw);
      NP.bpm.on(draw);
      draw();
    }
  });

  /* =====================================================================
   * Scale & chord finder
   * ===================================================================== */
  var SCALES = [
    ['Major', [0, 2, 4, 5, 7, 9, 11]], ['Natural minor', [0, 2, 3, 5, 7, 8, 10]],
    ['Harmonic minor', [0, 2, 3, 5, 7, 8, 11]], ['Melodic minor', [0, 2, 3, 5, 7, 9, 11]],
    ['Dorian', [0, 2, 3, 5, 7, 9, 10]], ['Phrygian', [0, 1, 3, 5, 7, 8, 10]],
    ['Lydian', [0, 2, 4, 6, 7, 9, 11]], ['Mixolydian', [0, 2, 4, 5, 7, 9, 10]],
    ['Locrian', [0, 1, 3, 5, 6, 8, 10]], ['Major pentatonic', [0, 2, 4, 7, 9]],
    ['Minor pentatonic', [0, 3, 5, 7, 10]], ['Blues', [0, 3, 5, 6, 7, 10]],
    ['Whole tone', [0, 2, 4, 6, 8, 10]], ['Diminished (W-H)', [0, 2, 3, 5, 6, 8, 9, 11]],
    ['Phrygian dominant', [0, 1, 4, 5, 7, 8, 10]]
  ];
  var CHORDS = [
    ['maj', [0, 4, 7]], ['min', [0, 3, 7]], ['dim', [0, 3, 6]], ['aug', [0, 4, 8]],
    ['sus2', [0, 2, 7]], ['sus4', [0, 5, 7]], ['6', [0, 4, 7, 9]], ['m6', [0, 3, 7, 9]],
    ['maj7', [0, 4, 7, 11]], ['min7', [0, 3, 7, 10]], ['7', [0, 4, 7, 10]], ['m7b5', [0, 3, 6, 10]],
    ['dim7', [0, 3, 6, 9]], ['add9', [0, 2, 4, 7]], ['maj9', [0, 2, 4, 7, 11]],
    ['min9', [0, 2, 3, 7, 10]], ['9', [0, 2, 4, 7, 10]]
  ];

  /* =====================================================================
   * Guitar: chord shapes, diagrams and a fretboard (standard tuning)
   * ===================================================================== */
  var TUNING = [40, 45, 50, 55, 59, 64]; // low E, A, D, G, B, high E
  var X = -1; // a muted string in a fret list
  var _ = null; // a muted string in a relative shape (relative -1 is a real fret)
  // Movable CAGED-style shapes: frets relative to the root's fret on the
  // shape's root string. Every one is checked against its chord tones.
  var SHAPES = [
    { open: 4, q: { // root on the low E string
      '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], maj7: [0, 2, 1, 1, 0, 0],
      m7: [0, 2, 0, 0, 0, 0], dim: [0, 1, 2, 0, _, _], aug: [0, 3, 2, 1, 1, 0], mMaj7: [0, 2, 1, 0, 0, 0],
      'maj7#5': [0, 3, 1, 1, 1, 0], m7b5: [0, _, 0, 0, -1, _], sus4: [0, 2, 2, 2, 0, 0], '6': [0, 2, 2, 1, 2, 0],
      m6: [0, 2, 2, 0, 2, 0], add9: [0, 2, 4, 1, 0, 0], '9': [0, 2, 0, 1, 0, 2], maj9: [0, 2, 1, 1, 0, 2],
      m9: [0, 2, 0, 0, 0, 2]
    } },
    { open: 9, q: { // root on the A string
      '': [_, 0, 2, 2, 2, 0], m: [_, 0, 2, 2, 1, 0], '7': [_, 0, 2, 0, 2, 0], maj7: [_, 0, 2, 1, 2, 0],
      m7: [_, 0, 2, 0, 1, 0], dim: [_, 0, 1, 2, 1, _], aug: [_, 0, 3, 2, 2, 1], mMaj7: [_, 0, 2, 1, 1, 0],
      'maj7#5': [_, 0, 3, 1, 2, 1], m7b5: [_, 0, 1, 0, 1, _], dim7: [_, 0, 1, -1, 1, _], sus2: [_, 0, 2, 2, 0, 0],
      sus4: [_, 0, 2, 2, 3, 0], '6': [_, 0, 2, 2, 2, 2], m6: [_, 0, 2, 2, 1, 2], add9: [_, 0, 2, 4, 2, 0]
    } },
    { open: 2, q: { dim7: [_, _, 0, 1, 0, 1] } } // root on the D string
  ];
  // the open chords every chart uses where the movable shapes would sit high
  var OPEN = {
    0: { aug: [X, 3, 2, 1, 1, 0], '': [X, 3, 2, 0, 1, 0], '7': [X, 3, 2, 3, 1, 0], maj7: [X, 3, 2, 0, 0, 0], add9: [X, 3, 2, 0, 3, 0], '6': [X, 3, 2, 2, 1, 0] },
    2: { '': [X, X, 0, 2, 3, 2], m: [X, X, 0, 2, 3, 1], '7': [X, X, 0, 2, 1, 2], maj7: [X, X, 0, 2, 2, 2], m7: [X, X, 0, 2, 1, 1],
      sus2: [X, X, 0, 2, 3, 0], sus4: [X, X, 0, 2, 3, 3] },
    5: { maj7: [X, X, 3, 2, 1, 0] },
    7: { '': [3, 2, 0, 0, 0, 3], '7': [3, 2, 0, 0, 0, 1], maj7: [3, 2, 0, 0, 0, 2], '6': [3, 2, 0, 0, 0, 0] },
    11: { '7': [X, 2, 1, 2, 0, 2] }
  };
  // scale-finder chord names -> shape quality keys
  var QUALITY = { maj: '', min: 'm', min7: 'm7', min9: 'm9' };

  function maxFret(f) { return Math.max.apply(null, f); }
  function strings(f) { return f.filter(function (v) { return v >= 0; }).length; }

  // root: pitch class, q: quality key ('', 'm', '7', 'maj7', ...). Returns frets low E -> high E, or null.
  function chordShape(root, q) {
    q = QUALITY[q] !== undefined ? QUALITY[q] : q;
    if (OPEN[root] && OPEN[root][q]) return OPEN[root][q].slice();
    var best = null;
    SHAPES.forEach(function (sh) {
      var rel = sh.q[q];
      if (!rel) return;
      var r = (root - sh.open + 12) % 12;
      if (rel.some(function (v) { return v !== _ && r + v < 0; })) r += 12;
      var f = rel.map(function (v) { return v === _ ? X : r + v; });
      if (maxFret(f) > 17) return;
      if (!best || maxFret(f) < maxFret(best) || (maxFret(f) === maxFret(best) && strings(f) > strings(best))) best = f;
    });
    return best;
  }

  function shapeInfo(frets) {
    var fretted = frets.filter(function (f) { return f > 0; });
    var min = fretted.length ? Math.min.apply(null, fretted) : 0;
    var max = fretted.length ? Math.max.apply(null, fretted) : 0;
    var barre = null;
    // only call it a barre when there are more fretted notes than fingers
    if (fretted.length > 4) {
      var at = [];
      frets.forEach(function (f, i) { if (f === min) at.push(i); });
      var ok = at.length >= 2;
      for (var i = at[0]; ok && i <= at[at.length - 1]; i++) if (frets[i] < min) ok = false;
      if (ok) barre = { fret: min, from: at[0], to: at[at.length - 1] };
    }
    return { base: max <= 4 ? 1 : min, barre: barre };
  }

  function tab(frets) {
    var wide = frets.some(function (f) { return f > 9; });
    return frets.map(function (f) { return f < 0 ? 'x' : String(f); }).join(wide ? ' ' : '');
  }

  function shapeMidi(frets) {
    var out = [];
    frets.forEach(function (f, i) { if (f >= 0) out.push(TUNING[i] + f); });
    return out;
  }

  // SVG chord box. root: pitch class to highlight.
  function chordDiagram(frets, root, label) {
    var info = shapeInfo(frets);
    var sx = 16;
    var gap = 12;
    var top = 20;
    var fh = 14;
    var y = function (f) { return top + (f - info.base + 0.5) * fh; };
    var svg = '<svg viewBox="0 0 86 96" class="gd" role="img" aria-label="' + NP.esc(label) + ' on guitar: ' + tab(frets) + '">';
    if (info.base > 1) svg += '<text x="0" y="' + (top + fh * 0.5 + 3) + '" class="gd-fr">' + info.base + 'fr</text>';
    for (var r = 0; r <= 5; r++) {
      svg += '<line x1="' + sx + '" y1="' + (top + r * fh) + '" x2="' + (sx + 5 * gap) + '" y2="' + (top + r * fh) + '" class="' +
        (r === 0 && info.base === 1 ? 'gd-nut' : 'gd-line') + '"/>';
    }
    for (var s = 0; s < 6; s++) {
      svg += '<line x1="' + (sx + s * gap) + '" y1="' + top + '" x2="' + (sx + s * gap) + '" y2="' + (top + 5 * fh) + '" class="gd-line"/>';
    }
    var b = info.barre;
    if (b) {
      svg += '<rect x="' + (sx + b.from * gap - 5) + '" y="' + (y(b.fret) - 5) + '" width="' + ((b.to - b.from) * gap + 10) +
        '" height="10" rx="5" class="gd-dot"/>';
    }
    frets.forEach(function (f, i) {
      var x = sx + i * gap;
      var isRoot = f >= 0 && (TUNING[i] + f) % 12 === root;
      if (f < 0) svg += '<text x="' + x + '" y="' + (top - 6) + '" class="gd-x">×</text>';
      else if (f === 0) svg += '<circle cx="' + x + '" cy="' + (top - 8) + '" r="3.2" class="gd-open' + (isRoot ? ' root' : '') + '"/>';
      else if (!(b && f === b.fret && i >= b.from && i <= b.to)) {
        svg += '<circle cx="' + x + '" cy="' + y(f) + '" r="4.8" class="gd-dot' + (isRoot ? ' root' : '') + '"/>';
      } else if (isRoot) {
        svg += '<circle cx="' + x + '" cy="' + y(f) + '" r="2.2" class="gd-in"/>';
      }
    });
    return svg + '</svg>';
  }

  NP.guitar = { TUNING: TUNING, shape: chordShape, diagram: chordDiagram, tab: tab, midi: shapeMidi, SHAPES: SHAPES, OPEN: OPEN };

  // Horizontal fretboard, high E on top like tab. opts: { frets, onNote(midi) }
  NP.fretboard = function (el, opts) {
    var FR = opts.frets || 15;
    var x0 = 30;
    var fw = 40;
    var y0 = 14;
    var sg = 18;
    var W = x0 + FR * fw + 8;
    var H = y0 + 5 * sg + 22;
    var state = { pc: [], root: -1, flats: false };
    el.classList.add('fb');

    function cx(f) { return f === 0 ? x0 - 15 : x0 + (f - 0.5) * fw; }

    function render() {
      var on = {};
      state.pc.forEach(function (p) { on[p] = 1; });
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="fb-svg" role="img" aria-label="Guitar fretboard">';
      [3, 5, 7, 9, 15].forEach(function (f) {
        if (f <= FR) svg += '<circle cx="' + cx(f) + '" cy="' + (y0 + 2.5 * sg) + '" r="4" class="fb-inlay"/>';
      });
      if (FR >= 12) {
        svg += '<circle cx="' + cx(12) + '" cy="' + (y0 + 1.5 * sg) + '" r="4" class="fb-inlay"/>' +
          '<circle cx="' + cx(12) + '" cy="' + (y0 + 3.5 * sg) + '" r="4" class="fb-inlay"/>';
      }
      for (var f = 0; f <= FR; f++) {
        svg += '<line x1="' + (x0 + f * fw) + '" y1="' + y0 + '" x2="' + (x0 + f * fw) + '" y2="' + (y0 + 5 * sg) + '" class="' +
          (f === 0 ? 'fb-nut' : 'fb-fret') + '"/>';
        if ([3, 5, 7, 9, 12, 15].indexOf(f) !== -1) svg += '<text x="' + cx(f) + '" y="' + (H - 4) + '" class="fb-num">' + f + '</text>';
      }
      for (var row = 0; row < 6; row++) {
        var open = TUNING[5 - row];
        var yy = y0 + row * sg;
        svg += '<line x1="' + x0 + '" y1="' + yy + '" x2="' + (x0 + FR * fw) + '" y2="' + yy + '" class="fb-string" style="stroke-width:' + (0.8 + row * 0.25) + '"/>';
        for (f = 0; f <= FR; f++) {
          var m = open + f;
          var pc = m % 12;
          if (on[pc]) {
            svg += '<g class="fb-note' + (pc === state.root ? ' root' : '') + '" data-m="' + m + '"><circle cx="' + cx(f) + '" cy="' + yy +
              '" r="7.5"/><text x="' + cx(f) + '" y="' + (yy + 2.6) + '">' + NP.pcName(pc, state.flats) + '</text></g>';
          } else if (opts.onNote) {
            svg += '<rect data-m="' + m + '" x="' + (cx(f) - fw / 2 + 2) + '" y="' + (yy - sg / 2) + '" width="' + (fw - 4) + '" height="' + sg + '" class="fb-hit"/>';
          }
        }
      }
      el.innerHTML = svg + '</svg>';
    }

    if (opts.onNote) {
      el.addEventListener('click', function (e) {
        var t = e.target.closest('[data-m]');
        if (t) opts.onNote(parseInt(t.getAttribute('data-m'), 10));
      });
    }
    render();
    return {
      update: function (u) {
        state.pc = u.pc || [];
        state.root = u.root === undefined ? -1 : u.root;
        state.flats = !!u.flats;
        render();
      }
    };
  };

  function pcsOf(root, ivs) { return ivs.map(function (i) { return (root + i) % 12; }); }

  NP.tool({
    id: 'scales',
    group: 'music',
    title: 'Scale & chord finder',
    keys: 'scale mode chord key finder notes theory',
    wide: true,
    head: '<div class="gen-row"><div class="seg mono" data-f="view"><button type="button" class="seg-btn active" data-v="keys">keys</button>' +
      '<button type="button" class="seg-btn" data-v="guitar">guitar</button></div>' +
      '<div class="seg mono" data-f="mode"><button type="button" class="seg-btn active" data-v="build">build</button>' +
      '<button type="button" class="seg-btn" data-v="find">identify</button></div></div>',
    html:
      '<div class="sc-controls" data-f="build-ui">' +
      '<label><span class="mono">root</span><select data-f="root" class="field mono">' + option(ROOTS, '0') + '</select></label>' +
      '<label><span class="mono">type</span><select data-f="type" class="field mono">' +
      '<optgroup label="Scales">' + SCALES.map(function (s, i) { return '<option value="s' + i + '">' + s[0] + '</option>'; }).join('') + '</optgroup>' +
      '<optgroup label="Chords">' + CHORDS.map(function (s, i) { return '<option value="c' + i + '">' + s[0] + '</option>'; }).join('') + '</optgroup>' +
      '</select></label>' +
      '<div class="seg mono" data-f="acc"><button type="button" class="seg-btn active" data-v="sharp">♯</button>' +
      '<button type="button" class="seg-btn" data-v="flat">♭</button></div>' +
      '<button type="button" class="tap-btn mono" data-f="play"><i class="fas fa-play fa-fw"></i> play</button></div>' +
      '<p class="sc-hint mono" data-f="hint" hidden>click keys or frets to select notes, matching scales and chords appear below</p>' +
      '<div data-f="keys"></div>' +
      '<div data-f="frets" hidden></div>' +
      '<div class="sc-out mono" data-f="out"></div>',
    init: function (c) {
      var mode = 'build';
      var flats = false;
      var picked = {};
      var rootEl = q(c, 'root');
      var typeEl = q(c, 'type');
      var out = q(c, 'out');
      var buildUi = q(c, 'build-ui');
      var hint = q(c, 'hint');
      var piano;
      var board;
      var view = NP.store('nophase.scview') === 'guitar' ? 'guitar' : 'keys';

      // one place that lights up notes on whichever instrument is showing
      function show(u) {
        piano.update({ start: 48, pc: u.pc, root: u.root });
        board.update({ pc: u.pc, root: u.root, flats: flats });
      }

      function current() {
        var t = typeEl.value;
        var list = t[0] === 's' ? SCALES : CHORDS;
        var item = list[parseInt(t.slice(1), 10)];
        return { isScale: t[0] === 's', name: item[0], ivs: item[1], root: parseInt(rootEl.value, 10) };
      }

      function drawBuild() {
        var s = current();
        var pcs = pcsOf(s.root, s.ivs);
        show({ pc: pcs, root: s.root });
        var shape = !s.isScale && view === 'guitar' && NP.guitar.shape(s.root, s.name);
        out.innerHTML = '<div class="sc-notes">' + pcs.map(function (p, i) {
          return '<span class="note' + (i === 0 ? ' is-root' : '') + '">' + NP.pcName(p, flats) + '</span>';
        }).join('') + '</div>' +
          '<div class="sc-sub">' + NP.pcName(s.root, flats) + ' ' + s.name + ' · semitones ' + s.ivs.join(' ') + '</div>' +
          (shape ? '<div class="gd-wrap">' + NP.guitar.diagram(shape, s.root, NP.pcName(s.root, flats) + ' ' + s.name) +
            '<span class="gd-tab">' + NP.guitar.tab(shape) + '</span></div>' : '');
      }

      function drawFind() {
        var sel = Object.keys(picked).map(Number).sort(function (a, b) { return a - b; });
        show({ pc: sel });
        if (!sel.length) { out.innerHTML = '<div class="sc-sub">no notes selected</div>'; return; }
        var scales = [];
        var chords = [];
        for (var r = 0; r < 12; r++) {
          SCALES.forEach(function (s, i) {
            var set = pcsOf(r, s[1]);
            if (sel.every(function (p) { return set.indexOf(p) !== -1; })) scales.push({ r: r, i: i, n: s[0] });
          });
          CHORDS.forEach(function (s, i) {
            var set = pcsOf(r, s[1]);
            if (set.length === sel.length && sel.every(function (p) { return set.indexOf(p) !== -1; })) {
              chords.push({ r: r, i: i, n: s[0] });
            }
          });
        }
        function chips(list, kind) {
          return list.slice(0, 18).map(function (m) {
            return '<button type="button" class="match" data-t="' + kind + m.i + '" data-r="' + m.r + '">' +
              NP.pcName(m.r, flats) + ' ' + m.n + '</button>';
          }).join('') + (list.length > 18 ? '<span class="sc-sub">+' + (list.length - 18) + ' more</span>' : '');
        }
        out.innerHTML = (chords.length ? '<div class="sc-sub">chords</div><div class="matches">' + chips(chords, 'c') + '</div>' : '') +
          '<div class="sc-sub">scales containing all ' + sel.length + ' notes (' + scales.length + ')</div>' +
          '<div class="matches">' + (scales.length ? chips(scales, 's') : '<span class="sc-sub">none</span>') + '</div>';
      }

      function draw() { if (mode === 'build') drawBuild(); else drawFind(); }

      function onNote(m) {
        if (mode === 'find') {
          var p = m % 12;
          if (picked[p]) delete picked[p]; else picked[p] = 1;
          drawFind();
        }
        A.tone(midiToHz(m), { dur: 0.5 });
      }
      piano = NP.piano(q(c, 'keys'), { start: 48, octaves: 2, onKey: onNote });
      board = NP.fretboard(q(c, 'frets'), { frets: 15, onNote: onNote });

      function setView(v) {
        view = v;
        NP.store('nophase.scview', v);
        q(c, 'keys').hidden = v !== 'keys';
        q(c, 'frets').hidden = v !== 'guitar';
        draw();
      }
      NP.seg(q(c, 'view'), setView)(view);
      q(c, 'keys').hidden = view !== 'keys';
      q(c, 'frets').hidden = view !== 'guitar';

      rootEl.addEventListener('change', draw);
      typeEl.addEventListener('change', draw);
      NP.seg(q(c, 'acc'), function (v) { flats = v === 'flat'; draw(); });
      NP.seg(q(c, 'mode'), function (v) {
        mode = v;
        buildUi.hidden = v !== 'build';
        hint.hidden = v !== 'find';
        draw();
      });

      out.addEventListener('click', function (e) {
        var m = e.target.closest('.match');
        if (!m) return;
        rootEl.value = m.getAttribute('data-r');
        typeEl.value = m.getAttribute('data-t');
        mode = 'build';
        buildUi.hidden = false;
        hint.hidden = true;
        c.querySelectorAll('[data-f="mode"] .seg-btn').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-v') === 'build');
        });
        draw();
      });

      q(c, 'play').addEventListener('click', function () {
        var s = current();
        var base = 60 + s.root - 12;
        var ac = A.get();
        if (!ac) return;
        var t = ac.currentTime + 0.03;
        if (s.isScale) {
          s.ivs.concat([12]).forEach(function (iv, i) {
            A.tone(midiToHz(base + iv), { when: t + i * 0.22, dur: 0.4, gain: 0.16 });
          });
        } else {
          s.ivs.forEach(function (iv, i) {
            A.tone(midiToHz(base + iv), { when: t + i * 0.025, dur: 1.6, gain: 0.13 });
          });
        }
      });

      draw();
    }
  });

  /* =====================================================================
   * Chord progression generator
   * ===================================================================== */
  var MAJOR = [0, 2, 4, 5, 7, 9, 11];
  var MINOR = [0, 2, 3, 5, 7, 8, 10];
  var HARM = [0, 2, 3, 5, 7, 8, 11];
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  var TRIADS = { '4,7': ['', 0], '3,7': ['m', 1], '3,6': ['dim', 1], '4,8': ['aug', 0] };
  var SEVENTHS = {
    '4,7,11': ['maj7', 0], '3,7,10': ['m7', 1], '4,7,10': ['7', 0], '3,6,10': ['m7b5', 1],
    '3,6,9': ['dim7', 1], '3,7,11': ['mMaj7', 1], '4,8,11': ['maj7#5', 0]
  };
  var SEV_SUFFIX = { maj7: 'maj7', m7: '7', '7': '7', m7b5: '\u00f87', dim7: '\u00b07', mMaj7: 'maj7', 'maj7#5': 'maj7+' };
  var COMMON = {
    major: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [1, 4, 0, 5], [0, 3, 5, 4], [3, 0, 4, 5], [0, 2, 3, 4], [0, 3, 0, 4]],
    minor: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 6, 5, 4], [0, 3, 4, 0], [0, 5, 3, 4], [5, 6, 0, 0], [0, 6, 3, 4], [0, 2, 6, 3]]
  };
  var WALK = {
    major: [[1, 2, 3, 4, 5, 6], [4, 6], [5, 3], [0, 4, 1, 6], [0, 5, 2], [1, 3, 4], [0, 2]],
    minor: [[1, 2, 3, 4, 5, 6], [4, 6], [5, 3], [0, 4, 6], [0, 5, 2], [1, 3, 6], [0, 2, 5]]
  };

  function usesFlats(key, minor) {
    var flatKeys = minor ? [2, 7, 0, 5, 10, 3] : [5, 10, 3, 8, 1, 6];
    return flatKeys.indexOf(key) !== -1;
  }

  NP.tool({
    id: 'prog',
    group: 'music',
    title: 'Chord progression generator',
    keys: 'chord progression generator roman numerals theory guitar chords diagram voicing voice leading midi export',
    wide: true,
    head: '<div class="seg mono" data-f="mode"><button type="button" class="seg-btn active" data-v="major">major</button>' +
      '<button type="button" class="seg-btn" data-v="minor">minor</button></div>',
    html:
      '<div class="sc-controls">' +
      '<label><span class="mono">key</span><select data-f="key" class="field mono">' + option(ROOTS, '0') + '</select></label>' +
      '<div class="seg mono" data-f="style"><button type="button" class="seg-btn active" data-v="common">common</button>' +
      '<button type="button" class="seg-btn" data-v="wild">wild</button></div>' +
      '<div class="seg mono" data-f="len"><button type="button" class="seg-btn active" data-v="4">4</button>' +
      '<button type="button" class="seg-btn" data-v="8">8</button></div>' +
      '<label class="check mono"><input type="checkbox" data-f="sev"> 7ths</label>' +
      '<div class="seg mono" data-f="view"><button type="button" class="seg-btn active" data-v="notes">notes</button>' +
      '<button type="button" class="seg-btn" data-v="guitar">guitar</button></div>' +
      '<button type="button" class="tap-btn mono" data-f="roll"><i class="fas fa-dice fa-fw"></i> roll</button></div>' +
      '<div class="chords" data-f="chords"></div>' +
      '<p class="tool-note mono" data-f="guitarhelp" hidden>Read each box left to right: low E, A, D, G, B, high E. Dots show where to press; a bar means hold those strings together. Numbers are frets, 0 is an open string, x means don’t play it. Highlighted dots are the root note.</p>' +
      '<div class="pitch-ctl"><button type="button" class="tap-btn mono" data-f="play"><i class="fas fa-play fa-fw"></i> play</button>' +
      '<button type="button" class="step-btn mono" data-f="loop" title="Loop">loop</button>' +
      '<button type="button" class="step-btn mono" data-f="copy" title="Copy chord names">copy</button>' +
      '<button type="button" class="step-btn mono" data-f="mid" title="Download as a MIDI file">.mid</button>' +
      '<label class="check mono" title="Move each chord to the nearest inversion instead of jumping"><input type="checkbox" data-f="smooth" checked> smooth</label></div>' +
      '<p class="tool-note mono" data-f="note"></p>',
    init: function (c) {
      var minor = false;
      var style = 'common';
      var len = 4;
      var view = NP.store('nophase.progview') === 'guitar' ? 'guitar' : 'notes';
      var keyEl = q(c, 'key');
      var sev = q(c, 'sev');
      var smooth = q(c, 'smooth');
      var box = q(c, 'chords');
      var playBtn = q(c, 'play');
      var loopBtn = q(c, 'loop');
      var prog = [];
      var locked = [];
      var chords = [];
      var timers = [];
      var playing = false;
      var loop = false;

      function chordFor(key, deg, withSev, harmonic) {
        var sc = (minor ? (harmonic && (deg === 4 || deg === 6) ? HARM : MINOR) : MAJOR);
        var steps = [0, 2, 4].concat(withSev ? [6] : []).map(function (o) {
          return (sc[(deg + o) % 7] - sc[deg] + 12) % 12;
        });
        var table = withSev ? SEVENTHS : TRIADS;
        var info = table[steps.slice(1).join(',')] || ['?', 0];
        var rootPc = (key + sc[deg]) % 12;
        var f = usesFlats(key, minor);
        var rn = ROMAN[deg];
        var low = info[1] === 1;
        var sfx = withSev ? (SEV_SUFFIX[info[0]] || '') : (info[0] === 'dim' ? '°' : info[0] === 'aug' ? '+' : '');
        return {
          name: NP.pcName(rootPc, f) + info[0], roman: (low ? rn.toLowerCase() : rn) + sfx, root: rootPc, steps: steps,
          quality: info[0], notes: steps.map(function (s) { return NP.pcName(rootPc + s, f); }),
          shape: NP.guitar.shape(rootPc, info[0])
        };
      }

      function pickDegrees() {
        var mode = minor ? 'minor' : 'major';
        if (style === 'common') {
          var base = COMMON[mode][Math.floor(Math.random() * COMMON[mode].length)];
          if (len === 4) return base.slice();
          var second = COMMON[mode][Math.floor(Math.random() * COMMON[mode].length)];
          return base.concat(second);
        }
        var seq = [0];
        while (seq.length < len) {
          var opts = WALK[mode][seq[seq.length - 1]];
          seq.push(opts[Math.floor(Math.random() * opts.length)]);
        }
        if (seq[len - 1] !== 0 && seq[len - 1] !== 4) seq[len - 1] = Math.random() < 0.5 ? 4 : 0;
        return seq;
      }

      /* voicings: what plays is what exports */

      // every close-position inversion with its lowest note between E3 and E4
      function inversions(ch) {
        var pcs = ch.steps.map(function (s) { return (ch.root + s) % 12; });
        var out = [];
        for (var inv = 0; inv < pcs.length; inv++) {
          var order = pcs.slice(inv).concat(pcs.slice(0, inv));
          for (var lo = 52; lo <= 64; lo++) {
            if (lo % 12 !== order[0]) continue;
            var v = [lo];
            order.slice(1).forEach(function (pc) {
              var m = v[v.length - 1] + 1;
              while (m % 12 !== pc) m++;
              v.push(m);
            });
            out.push(v);
          }
        }
        return out;
      }

      function voicings() {
        if (view === 'guitar') {
          return chords.map(function (ch) { return ch.shape ? NP.guitar.midi(ch.shape) : [48 + ch.root]; });
        }
        var prev = null;
        return chords.map(function (ch) {
          var bass = 36 + ch.root;
          var upper;
          if (!smooth.checked) {
            var base = 60 + ch.root;
            if (base > 65) base -= 12;
            upper = ch.steps.map(function (s) { return base + s; });
          } else {
            var cost = Infinity;
            inversions(ch).forEach(function (v) {
              var cst = 0;
              if (!prev) cst = Math.abs(v[0] - 57) + (v[0] % 12 === ch.root ? 0 : 4);
              else {
                for (var i = 0; i < Math.max(v.length, prev.length); i++) {
                  cst += Math.abs(v[Math.min(i, v.length - 1)] - prev[Math.min(i, prev.length - 1)]);
                }
              }
              if (cst < cost) { cost = cst; upper = v; }
            });
            prev = upper;
          }
          return [bass].concat(upper);
        });
      }

      function build(newRoll) {
        stop();
        var key = parseInt(keyEl.value, 10);
        if (newRoll || !prog.length) {
          var fresh = pickDegrees();
          prog = fresh.map(function (d, i) { return locked[i] && prog[i] !== undefined ? prog[i] : d; });
        }
        locked = prog.map(function (_, i) { return !!locked[i]; });
        chords = prog.map(function (d) { return chordFor(key, d, sev.checked, true); });
        box.classList.toggle('with-guitar', view === 'guitar');
        q(c, 'guitarhelp').hidden = view !== 'guitar';
        box.innerHTML = chords.map(function (ch, i) {
          return '<div class="chord' + (locked[i] ? ' locked' : '') + '" role="button" tabindex="0" data-i="' + i + '">' +
            '<span class="chord-top"><span class="rn mono">' + ch.roman + '</span>' +
            '<button type="button" class="chord-lock" data-lock="' + i + '" aria-pressed="' + locked[i] + '" title="Keep this chord when you roll">' +
            '<i class="fas fa-' + (locked[i] ? 'lock' : 'lock-open') + '"></i></button></span>' +
            '<span class="cn">' + ch.name + '</span><span class="nt mono">' + ch.notes.join(' ') + '</span>' +
            (view === 'guitar' && ch.shape ? '<span class="gd-wrap">' + NP.guitar.diagram(ch.shape, ch.root, ch.name) +
              '<span class="gd-tab">' + NP.guitar.tab(ch.shape) + '</span></span>' : '') +
            '</div>';
        }).join('');
        var anyLocked = locked.some(Boolean);
        q(c, 'note').textContent = NP.pcName(key, usesFlats(key, minor)) + (minor ? ' minor' : ' major') + ' · ' +
          fmt(NP.bpm.get(), 4) + ' BPM, one bar per chord' +
          (view === 'guitar' ? ' · standard tuning, strummed' : '') +
          (anyLocked ? ' · locked chords stay when you roll' : ' · lock a chord to keep it');
      }

      function playVoicing(v, when, dur) {
        var strum = view === 'guitar' ? 0.022 : 0;
        v.forEach(function (m, i) {
          A.tone(midiToHz(m), { when: when + i * strum, dur: dur - i * strum, gain: view === 'guitar' ? 0.09 : (i === 0 ? 0.15 : 0.09), attack: 0.01 });
        });
      }

      function mark(i) {
        [].forEach.call(box.children, function (el, j) { el.classList.toggle('playing', j === i); });
      }

      function stop() {
        timers.forEach(clearTimeout);
        timers = [];
        playing = false;
        mark(-1);
        playBtn.innerHTML = '<i class="fas fa-play fa-fw"></i> play';
      }

      function run() {
        var ac = A.get();
        if (!ac) return;
        playing = true;
        playBtn.innerHTML = '<i class="fas fa-stop fa-fw"></i> stop';
        var bar = (60 / NP.bpm.get()) * 4;
        var t0 = ac.currentTime + 0.05;
        voicings().forEach(function (v, i) {
          playVoicing(v, t0 + i * bar, bar * 0.95);
          timers.push(setTimeout(function () { mark(i); }, (t0 + i * bar - ac.currentTime) * 1000));
        });
        timers.push(setTimeout(function () {
          if (loop && playing) run(); else stop();
        }, (t0 + chords.length * bar - ac.currentTime) * 1000));
      }

      function exportMidi() {
        var ppq = 480;
        var barTicks = ppq * 4;
        var notes = [];
        voicings().forEach(function (v, i) {
          v.forEach(function (m, j) {
            var lag = view === 'guitar' ? j * 12 : 0;
            notes.push({ t: i * barTicks + lag, d: barTicks - 24 - lag, n: m, v: j === 0 ? 96 : 84 });
          });
        });
        var key = NP.pcName(parseInt(keyEl.value, 10), usesFlats(parseInt(keyEl.value, 10), minor)).replace('#', 's');
        var name = 'nophase-' + key + (minor ? 'm' : '') + '-' + chords.map(function (ch) { return ch.roman.replace(/[^\w]/g, ''); }).join('-');
        NP.download(NP.midiFile(notes, { bpm: NP.bpm.get(), endTick: chords.length * barTicks, name: chords.map(function (ch) { return ch.name; }).join(' ') }),
          name + '.mid', 'audio/midi');
      }

      function playOne(i) {
        var ac = A.get();
        if (ac) playVoicing(voicings()[i], ac.currentTime + 0.01, 1.6);
      }

      box.addEventListener('click', function (e) {
        var lock = e.target.closest('.chord-lock');
        if (lock) {
          var li = parseInt(lock.getAttribute('data-lock'), 10);
          locked[li] = !locked[li];
          build(false);
          return;
        }
        var b = e.target.closest('.chord');
        if (b) playOne(parseInt(b.getAttribute('data-i'), 10));
      });
      box.addEventListener('keydown', function (e) {
        var b = e.target.closest('.chord');
        if (b && e.target === b && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          playOne(parseInt(b.getAttribute('data-i'), 10));
        }
      });
      playBtn.addEventListener('click', function () { if (playing) stop(); else run(); });
      loopBtn.addEventListener('click', function () { loop = !loop; loopBtn.classList.toggle('active', loop); });
      q(c, 'copy').addEventListener('click', function (e) {
        NP.copy(chords.map(function (ch) {
          return ch.name + (view === 'guitar' && ch.shape ? ' (' + NP.guitar.tab(ch.shape) + ')' : '');
        }).join(' – '), e.currentTarget);
      });
      q(c, 'mid').addEventListener('click', exportMidi);
      q(c, 'roll').addEventListener('click', function () { build(true); });
      keyEl.addEventListener('change', function () { build(false); });
      sev.addEventListener('change', function () { build(false); });
      smooth.addEventListener('change', function () { if (playing) { stop(); run(); } });
      NP.seg(q(c, 'mode'), function (v) { minor = v === 'minor'; locked = []; build(true); });
      NP.seg(q(c, 'style'), function (v) { style = v; build(true); });
      NP.seg(q(c, 'len'), function (v) { len = parseInt(v, 10); build(true); });
      NP.seg(q(c, 'view'), function (v) { view = v; NP.store('nophase.progview', v); build(false); })(view);
      NP.bpm.on(function () { if (!playing) build(false); });

      build(true);
    }
  });

  /* =====================================================================
   * Euclidean rhythm: two layers and a logic operator
   * ===================================================================== */
  function euclid(n, k, rot) {
    k = Math.min(k, n);
    var base = [];
    for (var i = 0; i < n; i++) base.push(k > 0 && (i * k) % n < k ? 1 : 0);
    return base.map(function (_, i) { return base[((i - rot) % n + n) % n]; });
  }
  NP.euclid = euclid;
  var LOGIC = {
    and: function (a, b) { return a && b; },
    or: function (a, b) { return a || b; },
    xor: function (a, b) { return a !== b; },
    nand: function (a, b) { return !(a && b); },
    anot: function (a, b) { return a && !b; },
    bnot: function (a, b) { return b && !a; }
  };
  var LOGIC_LABEL = { and: 'AND', or: 'OR', xor: 'XOR', nand: 'NAND', anot: 'A−B', bnot: 'B−A' };
  var EUC_RATES = [['1/8', 0.5], ['1/8T', 1 / 3], ['1/16', 0.25], ['1/16T', 1 / 6], ['1/32', 0.125]];
  var VOICES = ['kick', 'snare', 'hat', 'click', 'off'];
  var GM = { kick: 36, snare: 38, hat: 42, click: 37 };
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  function layerHtml(id, n, k, r, voice) {
    return '<div class="euc-layer" data-l="' + id + '"><span class="euc-tag mono">' + id.toUpperCase() + '</span>' +
      '<label><span class="mono">steps <b data-f="' + id + 'nv">' + n + '</b></span><input type="range" data-f="' + id + 'n" min="2" max="32" value="' + n + '"></label>' +
      '<label><span class="mono">hits <b data-f="' + id + 'kv">' + k + '</b></span><input type="range" data-f="' + id + 'k" min="0" max="32" value="' + k + '"></label>' +
      '<label><span class="mono">rotate <b data-f="' + id + 'rv">' + r + '</b></span><input type="range" data-f="' + id + 'r" min="0" max="31" value="' + r + '"></label>' +
      '<select data-f="' + id + 'voice" class="field field-sm mono" aria-label="Layer ' + id.toUpperCase() + ' sound">' +
      VOICES.map(function (v) { return '<option' + (v === voice ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>';
  }

  NP.tool({
    id: 'euclid',
    group: 'music',
    title: 'Euclidean rhythm',
    keys: 'euclidean rhythm sequencer polyrhythm polymeter drums pattern logic and or xor midi export',
    wide: true,
    html:
      '<div class="euc">' +
      '<svg viewBox="0 0 200 200" class="euc-svg" data-f="svg" role="img" aria-label="Euclidean rhythm rings, A outside, B inside"></svg>' +
      '<div class="euc-side">' +
      layerHtml('a', 16, 4, 0, 'kick') + layerHtml('b', 16, 7, 2, 'hat') +
      '<div class="euc-layer euc-out"><span class="euc-tag mono">=</span>' +
      '<div class="seg mono" data-f="op">' + Object.keys(LOGIC).map(function (k) {
        return '<button type="button" class="seg-btn' + (k === 'xor' ? ' active' : '') + '" data-v="' + k + '">' + LOGIC_LABEL[k] + '</button>';
      }).join('') + '</div>' +
      '<select data-f="ovoice" class="field field-sm mono" aria-label="Logic output sound">' +
      VOICES.map(function (v) { return '<option' + (v === 'snare' ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
      '</div></div>' +
      '<div class="euc-grid mono" data-f="grid"></div>' +
      '<div class="pitch-ctl"><button type="button" class="tap-btn mono" data-f="play"><i class="fas fa-play fa-fw"></i> play</button>' +
      '<select data-f="rate" class="field field-sm mono" aria-label="Step length">' + EUC_RATES.map(function (r) {
        return '<option value="' + r[1] + '"' + (r[0] === '1/16' ? ' selected' : '') + '>' + r[0] + '</option>';
      }).join('') + '</select>' +
      '<button type="button" class="step-btn mono" data-f="copy">copy</button>' +
      '<button type="button" class="step-btn mono" data-f="mid" title="Download as a MIDI drum clip">.mid</button></div>' +
      '<p class="tool-note mono" data-f="note"></p>',
    init: function (c) {
      var svg = q(c, 'svg');
      var grid = q(c, 'grid');
      var playBtn = q(c, 'play');
      var op = 'xor';
      var A_ = [];
      var B_ = [];
      var pos = -1;
      var timer = 0;
      var step = 0;
      var next = 0;

      function layer(id) {
        var nEl = q(c, id + 'n');
        var kEl = q(c, id + 'k');
        var rEl = q(c, id + 'r');
        var n = parseInt(nEl.value, 10);
        kEl.max = n;
        rEl.max = n - 1;
        var k = Math.min(parseInt(kEl.value, 10), n);
        var r = parseInt(rEl.value, 10) % n;
        q(c, id + 'nv').textContent = n;
        q(c, id + 'kv').textContent = k;
        q(c, id + 'rv').textContent = r;
        return euclid(n, k, r);
      }

      function cycle() { return A_.length * B_.length / gcd(A_.length, B_.length); }
      function out(t) { return LOGIC[op](!!A_[t % A_.length], !!B_[t % B_.length]) ? 1 : 0; }

      function compute() {
        A_ = layer('a');
        B_ = layer('b');
        var len = cycle();
        q(c, 'note').textContent = (A_.length === B_.length ? A_.length + ' steps' :
          'polymeter ' + A_.length + ' against ' + B_.length + ', repeats every ' + len + ' steps') +
          ' · at the shared tempo · = is A ' + LOGIC_LABEL[op] + ' B';
        draw();
      }

      function pt(i, n, r) {
        var a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r];
      }

      function ring(pat, r, cls, now) {
        var n = pat.length;
        var html = '<circle cx="100" cy="100" r="' + r + '" class="euc-ring"/>';
        var hits = [];
        pat.forEach(function (v, i) { if (v) hits.push(pt(i, n, r)); });
        if (hits.length > 1) {
          html += '<polygon class="euc-poly ' + cls + '" points="' + hits.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
        }
        pat.forEach(function (v, i) {
          var p = pt(i, n, r);
          html += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (v ? 5.5 : 2.8) + '" class="euc-dot ' + cls +
            (v ? ' hit' : '') + (i === now ? ' now' : '') + '"/>';
        });
        return html;
      }

      function draw() {
        svg.innerHTML = ring(A_, 84, 'la', pos < 0 ? -1 : pos % A_.length) + ring(B_, 56, 'lb', pos < 0 ? -1 : pos % B_.length) +
          '<text x="100" y="104" class="euc-op">' + LOGIC_LABEL[op] + '</text>';
        var len = Math.min(cycle(), 64);
        var cur = pos < 0 ? -1 : pos % cycle();
        function row(label, fn, cls) {
          var cells = '';
          for (var t = 0; t < len; t++) {
            cells += '<i class="' + (fn(t) ? 'on ' + cls : '') + (t === cur ? ' now' : '') + (t % 4 === 0 ? ' beat' : '') + '"></i>';
          }
          return '<div class="euc-row"><span>' + label + '</span><div class="euc-cells" style="--n:' + len + '">' + cells + '</div></div>';
        }
        grid.innerHTML = row('A', function (t) { return A_[t % A_.length]; }, 'la') +
          row('B', function (t) { return B_[t % B_.length]; }, 'lb') +
          row('=', out, 'lo') + (cycle() > 64 ? '<p class="tool-note">showing 64 of ' + cycle() + ' steps</p>' : '');
      }

      function voices() { return { a: q(c, 'avoice').value, b: q(c, 'bvoice').value, o: q(c, 'ovoice').value }; }

      function tick() {
        var ac = A.get();
        var stepDur = (60 / NP.bpm.get()) * parseFloat(q(c, 'rate').value);
        var v = voices();
        while (next < ac.currentTime + 0.12) {
          var t = step;
          if (A_[t % A_.length]) A.drum(v.a, next);
          if (B_[t % B_.length]) A.drum(v.b, next);
          if (out(t)) A.drum(v.o, next);
          (function (idx, when) {
            setTimeout(function () { if (timer) { pos = idx; draw(); } }, Math.max(0, (when - ac.currentTime) * 1000));
          })(t, next);
          next += stepDur;
          step++;
        }
      }

      function stop() {
        clearInterval(timer);
        timer = 0;
        pos = -1;
        draw();
        playBtn.innerHTML = '<i class="fas fa-play fa-fw"></i> play';
      }

      playBtn.addEventListener('click', function () {
        if (timer) { stop(); return; }
        var ac = A.get();
        if (!ac) return;
        step = 0;
        next = ac.currentTime + 0.05;
        timer = setInterval(tick, 25);
        playBtn.innerHTML = '<i class="fas fa-stop fa-fw"></i> stop';
      });

      q(c, 'copy').addEventListener('click', function (e) {
        var len = cycle();
        function line(fn) { var s = ''; for (var t = 0; t < len; t++) s += fn(t) ? 'x' : '.'; return s; }
        NP.copy('A ' + line(function (t) { return A_[t % A_.length]; }) + '\nB ' + line(function (t) { return B_[t % B_.length]; }) +
          '\n= ' + line(out) + '   (A ' + LOGIC_LABEL[op] + ' B)', e.currentTarget);
      });

      q(c, 'mid').addEventListener('click', function () {
        var ppq = 480;
        var stepTicks = Math.round(ppq * parseFloat(q(c, 'rate').value));
        var len = cycle();
        var v = voices();
        var notes = [];
        for (var t = 0; t < len; t++) {
          [['a', A_[t % A_.length]], ['b', B_[t % B_.length]], ['o', out(t)]].forEach(function (x) {
            if (x[1] && GM[v[x[0]]]) notes.push({ t: t * stepTicks, d: Math.max(30, stepTicks / 2), n: GM[v[x[0]]], v: x[0] === 'o' ? 110 : 96, ch: 9 });
          });
        }
        if (!notes.length) return;
        NP.download(NP.midiFile(notes, { bpm: NP.bpm.get(), endTick: len * stepTicks, name: 'NOPHASE euclid' }),
          'nophase-euclid-' + A_.length + 'x' + B_.length + '-' + LOGIC_LABEL[op].replace('−', '-not-').toLowerCase() + '.mid', 'audio/midi');
      });

      c.addEventListener('input', function (e) { if (e.target.type === 'range') compute(); });
      NP.seg(q(c, 'op'), function (v) { op = v; compute(); });
      compute();
    }
  });

  /* =====================================================================
   * Patch dice
   * ===================================================================== */
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function logRange(lo, hi) { return Math.round(lo * Math.pow(hi / lo, Math.random())); }
  function pickN(a, n) {
    var pool = a.slice();
    var out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  var DEST = ['pitch', 'cutoff', 'pulse width', 'wavefold', 'amp', 'pan', 'FM amount', 'drive', 'resonance'];
  var SRC = ['LFO', 'Random S&H', 'Envelope', 'Step sequencer', 'Velocity', 'Key tracking'];
  var RATE = ['1/4', '1/8', '1/16', '1/8T', '1/16 dotted', '1 bar', '2 bars', '4 bars', 'free 0.3 Hz', 'free 7 Hz'];
  function modLine() {
    return pick(SRC) + ' → ' + pick(DEST) + ' · ' + pick(RATE) + ' · ' + (10 + Math.floor(Math.random() * 90)) + '%';
  }
  var DICE = [
    ['Oscillator', function () {
      return pick(['Saw', 'Square (PWM)', 'Triangle', 'Sine', 'Wavetable', 'Noise', 'Saw stack, 7 voices',
        'FM 2-op, ratio ' + pick([0.5, 1, 1.5, 2, 3, 3.5, 4, 5, 7])]);
    }],
    ['Layer', function () {
      return pick(['none', 'sub sine, -1 oct', 'noise layer, low', 'detuned copy +7¢', 'octave-up square', 'formant pad']);
    }],
    ['Filter', function () {
      return pick(['LP 12', 'LP 24', 'HP', 'BP', 'Comb', 'Notch', 'Formant']) + ' · ' + logRange(60, 12000) + ' Hz · res ' + Math.floor(Math.random() * 90) + '%';
    }],
    ['Amp env', function () {
      return 'A ' + logRange(1, 1800) + ' ms · D ' + logRange(30, 1500) + ' ms · S ' + Math.floor(Math.random() * 100) + '% · R ' + logRange(20, 3000) + ' ms';
    }],
    ['Mod 1', modLine],
    ['Mod 2', modLine],
    ['FX chain', function () {
      return pickN(['Distortion', 'Bitcrush', 'Chorus', 'Phaser', 'Flanger', 'Ping-pong delay', 'Plate reverb', 'Huge reverb',
        'Ring mod', 'Freq shift', 'Compressor', 'Tape wobble', 'Granular smear', 'Pitch shift +12'], 3).join(' → ');
    }],
    ['Vibe', function () {
      return pickN(['glassy', 'gritty', 'wet', 'dry', 'lo-fi', 'blooming', 'plucky', 'rubbery', 'metallic', 'vocal', 'hollow', 'wide',
        'mono', 'aggressive', 'delicate', 'broken', 'warm', 'icy', 'unstable'], 3).join(', ');
    }],
    ['Rule', function () {
      return pick(['Use only one oscillator', 'Modulate something with velocity', 'Automate cutoff over 8 bars', 'Resample it and pitch down',
        'Make it mono', 'Layer a noise hit on the transient', 'Sidechain it to the kick', 'Cut everything below 120 Hz', 'Add one wrong note',
        'Bounce and reverse the tail', 'Put the reverb before the distortion', 'Mute the first beat of every bar']);
    }]
  ];

  NP.tool({
    id: 'dice',
    group: 'music',
    title: 'Patch dice',
    keys: 'random patch idea oblique strategy prompt',
    html:
      '<div class="dice" data-f="rows"></div>' +
      '<div class="pitch-ctl"><button type="button" class="tap-btn mono" data-f="roll"><i class="fas fa-dice fa-fw"></i> roll</button>' +
      '<button type="button" class="step-btn mono" data-f="copy">copy</button></div>' +
      '<p class="tool-note mono">lock a row to keep it, roll the rest</p>',
    init: function (c) {
      var rows = q(c, 'rows');
      var state = DICE.map(function () { return { v: '', lock: false }; });

      function draw() {
        rows.innerHTML = DICE.map(function (d, i) {
          return '<div class="dice-row' + (state[i].lock ? ' locked' : '') + '"><button type="button" class="lock" data-i="' + i +
            '" aria-pressed="' + state[i].lock + '" title="Lock"><i class="fas fa-' + (state[i].lock ? 'lock' : 'lock-open') + '"></i></button>' +
            '<span class="dl mono">' + d[0] + '</span><span class="dv">' + NP.esc(state[i].v) + '</span></div>';
        }).join('');
      }
      function roll() {
        DICE.forEach(function (d, i) { if (!state[i].lock) state[i].v = d[1](); });
        draw();
      }

      rows.addEventListener('click', function (e) {
        var b = e.target.closest('.lock');
        if (!b) return;
        var i = parseInt(b.getAttribute('data-i'), 10);
        state[i].lock = !state[i].lock;
        draw();
      });
      q(c, 'roll').addEventListener('click', roll);
      q(c, 'copy').addEventListener('click', function (e) {
        NP.copy(DICE.map(function (d, i) { return d[0] + ': ' + state[i].v; }).join('\n'), e.currentTarget);
      });
      roll();
    }
  });

  /* =====================================================================
   * Converters
   * ===================================================================== */
  NP.tool({
    id: 'conv',
    group: 'music',
    title: 'Audio converters',
    keys: 'db gain decibel semitones ratio samples ms sample rate',
    html:
      '<div class="conv">' +
      '<div class="conv-row"><label><span class="mono">dB</span><input data-f="db" class="field mono" type="number" step="any" value="-6"></label>' +
      '<i class="fas fa-arrows-left-right" aria-hidden="true"></i>' +
      '<label><span class="mono">gain ×</span><input data-f="gain" class="field mono" type="number" step="any" min="0"></label></div>' +
      '<div class="conv-row"><label><span class="mono">semitones</span><input data-f="st" class="field mono" type="number" step="any" value="7"></label>' +
      '<i class="fas fa-arrows-left-right" aria-hidden="true"></i>' +
      '<label><span class="mono">ratio ×</span><input data-f="ratio" class="field mono" type="number" step="any" min="0"></label></div>' +
      '<div class="conv-row"><label><span class="mono">ms</span><input data-f="ms" class="field mono" type="number" step="any" value="10"></label>' +
      '<i class="fas fa-arrows-left-right" aria-hidden="true"></i>' +
      '<label><span class="mono">samples</span><input data-f="smp" class="field mono" type="number" step="any"></label></div>' +
      '<label class="conv-sr mono">sample rate <select data-f="sr" class="field field-sm mono">' +
      option([['44100', '44.1k'], ['48000', '48k'], ['88200', '88.2k'], ['96000', '96k']], '48000') + '</select></label>' +
      '</div>',
    init: function (c) {
      var sr = q(c, 'sr');
      NP.pair(q(c, 'db'), q(c, 'gain'), function (d) { return Math.pow(10, d / 20); },
        function (g) { return g > 0 ? 20 * Math.log(g) / Math.LN10 : NaN; })();
      NP.pair(q(c, 'st'), q(c, 'ratio'), function (s) { return Math.pow(2, s / 12); },
        function (r) { return r > 0 ? 12 * Math.log(r) / Math.LN2 : NaN; }, 6)();
      var sync = NP.pair(q(c, 'ms'), q(c, 'smp'), function (ms) { return ms * parseFloat(sr.value) / 1000; },
        function (s) { return s * 1000 / parseFloat(sr.value); }, 7);
      sync();
      sr.addEventListener('change', sync);
    }
  });
  /* =====================================================================
   * Tuner (microphone, autocorrelation)
   * ===================================================================== */
  // McLeod's normalised square difference (NSDF) over a fixed window, then the
  // first strong peak with parabolic interpolation. Returns Hz, or -1 when the
  // signal is too quiet or has no clear period.
  function detectPitch(buf, sr) {
    var n = buf.length;
    var rms = 0;
    for (var i = 0; i < n; i++) rms += buf[i] * buf[i];
    if (Math.sqrt(rms / n) < 0.008) return -1;
    var maxLag = Math.min(Math.floor(sr / 30), Math.floor(n / 2));
    var win = n - maxLag - 1;
    var nsdf = new Float32Array(maxLag + 1);
    var e0 = 0;
    for (i = 0; i < win; i++) e0 += buf[i] * buf[i];
    var eLag = e0;
    for (var lag = 0; lag <= maxLag; lag++) {
      var acf = 0;
      for (var j = 0; j < win; j++) acf += buf[j] * buf[j + lag];
      nsdf[lag] = (2 * acf) / (e0 + eLag || 1);
      eLag += buf[lag + win] * buf[lag + win] - buf[lag] * buf[lag];
    }
    // peaks between positive-going and negative-going zero crossings
    var peaks = [];
    var minLag = Math.floor(sr / 1500);
    i = 1;
    while (i < maxLag && nsdf[i] > 0) i++;
    while (i < maxLag) {
      while (i < maxLag && nsdf[i] <= 0) i++;
      var at = -1;
      while (i < maxLag && nsdf[i] > 0) {
        if (at < 0 || nsdf[i] > nsdf[at]) at = i;
        i++;
      }
      if (at > minLag && at < maxLag) peaks.push(at);
    }
    if (!peaks.length) return -1;
    var top = 0;
    peaks.forEach(function (p) { top = Math.max(top, nsdf[p]); });
    if (top < 0.5) return -1;
    var pick = peaks.filter(function (p) { return nsdf[p] >= top * 0.9; })[0];
    var x1 = nsdf[pick - 1];
    var x2 = nsdf[pick];
    var x3 = nsdf[pick + 1];
    var a = (x1 + x3 - 2 * x2) / 2;
    var shift = a ? (x1 - x3) / (4 * a) : 0;
    return sr / (pick + shift);
  }
  NP.detectPitch = detectPitch;

  NP.tool({
    id: 'tuner',
    group: 'music',
    title: 'Tuner',
    keys: 'tuner tune guitar bass pitch detect microphone mic cents',
    head: '<button type="button" class="step-btn mono" data-f="go">start mic</button>',
    html:
      '<div class="tuner">' +
      '<div class="tuner-note" data-f="note">--</div>' +
      '<div class="tuner-meter" aria-hidden="true"><span class="tuner-zero"></span><span class="tuner-needle" data-f="needle"></span></div>' +
      '<div class="tuner-read mono"><span data-f="cents">± 0 cents</span><span data-f="hz">0.00 Hz</span></div>' +
      '</div>' +
      '<p class="tool-note mono" data-f="msg">Uses your microphone. Audio stays in this tab. A4 follows the Note ↔ Hz tool.</p>',
    init: function (c) {
      var noteEl = q(c, 'note');
      var needle = q(c, 'needle');
      var centsEl = q(c, 'cents');
      var hzEl = q(c, 'hz');
      var msg = q(c, 'msg');
      var btn = q(c, 'go');
      var stream = null;
      var src = null;
      var analyser = null;
      var timer = 0;
      var buf = null;
      var recent = [];

      function show(f) {
        if (f <= 0) { c.classList.remove('live'); return; }
        recent.push(f);
        if (recent.length > 5) recent.shift();
        var sorted = recent.slice().sort(function (x, y) { return x - y; });
        f = sorted[Math.floor(sorted.length / 2)];
        var m = 69 + 12 * Math.log(f / NP.a4.v) / Math.LN2;
        var near = Math.round(m);
        var cents = Math.round((m - near) * 100);
        noteEl.textContent = NP.midiName(near);
        needle.style.left = (50 + cents) + '%';
        centsEl.textContent = (cents > 0 ? '+' : cents < 0 ? '−' : '± ') + Math.abs(cents) + ' cents';
        hzEl.textContent = f.toFixed(2) + ' Hz';
        c.classList.add('live');
        c.classList.toggle('in-tune', Math.abs(cents) <= 4);
      }

      function stop() {
        clearInterval(timer);
        if (src) src.disconnect();
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        stream = src = null;
        btn.textContent = 'start mic';
        btn.classList.remove('active');
        c.classList.remove('live', 'in-tune');
      }

      btn.addEventListener('click', function () {
        if (stream) { stop(); return; }
        var ac = NP.audio.get();
        if (!ac || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          msg.textContent = 'No microphone access in this browser (it needs https).';
          return;
        }
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        }).then(function (s) {
          stream = s;
          src = ac.createMediaStreamSource(s);
          analyser = ac.createAnalyser();
          analyser.fftSize = 4096;
          buf = new Float32Array(analyser.fftSize);
          src.connect(analyser);
          recent = [];
          timer = setInterval(function () {
            analyser.getFloatTimeDomainData(buf);
            show(detectPitch(buf, ac.sampleRate));
          }, 80);
          btn.textContent = 'stop';
          btn.classList.add('active');
        }, function () {
          msg.textContent = 'Microphone permission was denied.';
        });
      });
      document.addEventListener('visibilitychange', function () { if (document.hidden && stream) stop(); });
    }
  });

  /* =====================================================================
   * Metronome (lookahead scheduler on the audio clock)
   * ===================================================================== */
  NP.tool({
    id: 'metro',
    group: 'music',
    title: 'Metronome',
    keys: 'metronome click tempo bpm beat count in',
    html:
      '<div class="bpm-row">' +
      '<label class="bpm-field"><input data-f="bpm" class="field mono" type="number" min="20" max="400" step="0.1" aria-label="BPM"><span class="mono">BPM</span></label>' +
      '<button type="button" class="tap-btn mono" data-f="go">START</button></div>' +
      '<div class="beats" data-f="beats"></div>' +
      '<div class="gen-row mono">' +
      '<label class="ref">beats <input data-f="n" class="field field-sm" type="number" min="1" max="16" value="4"></label>' +
      '<div class="seg" data-f="sub"><button type="button" class="seg-btn active" data-v="1">♩</button>' +
      '<button type="button" class="seg-btn" data-v="2">♪♪</button><button type="button" class="seg-btn" data-v="3">3</button>' +
      '<button type="button" class="seg-btn" data-v="4">♬</button></div>' +
      '<label class="check"><input type="checkbox" data-f="accent" checked> accent 1</label></div>' +
      '<p class="tool-note mono">shares its tempo with the other tools</p>',
    init: function (c) {
      var bpmEl = q(c, 'bpm');
      var beatsEl = q(c, 'beats');
      var go = q(c, 'go');
      var sub = 1;
      var timer = 0;
      var next = 0;
      var step = 0;
      var queue = [];
      var raf = 0;

      function beats() { return NP.clamp(parseInt(q(c, 'n').value, 10) || 4, 1, 16); }
      function drawDots(active) {
        var n = beats();
        var html = '';
        for (var i = 0; i < n; i++) html += '<span class="beat' + (i === active ? ' on' : '') + (i === 0 ? ' first' : '') + '"></span>';
        beatsEl.innerHTML = html;
      }

      function click(when, level) {
        var ac = NP.audio.ctx;
        var osc = ac.createOscillator();
        var g = ac.createGain();
        osc.frequency.value = level === 2 ? 1760 : level === 1 ? 1175 : 880;
        g.gain.setValueAtTime(level === 0 ? 0.12 : 0.32, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
        osc.connect(g).connect(NP.audio.master);
        osc.start(when);
        osc.stop(when + 0.06);
      }

      function schedule() {
        var ac = NP.audio.ctx;
        var spb = 60 / NP.bpm.get() / sub;
        while (next < ac.currentTime + 0.12) {
          var beat = Math.floor(step / sub) % beats();
          var onBeat = step % sub === 0;
          click(next, !onBeat ? 0 : beat === 0 && q(c, 'accent').checked ? 2 : 1);
          if (onBeat) queue.push([next, beat]);
          next += spb;
          step++;
        }
      }

      function paint() {
        raf = requestAnimationFrame(paint);
        var now = NP.audio.ctx.currentTime;
        var cur = -1;
        while (queue.length && queue[0][0] <= now) cur = queue.shift()[1];
        if (cur !== -1) drawDots(cur);
      }

      function stop() {
        clearInterval(timer);
        cancelAnimationFrame(raf);
        timer = 0;
        queue = [];
        go.textContent = 'START';
        go.classList.remove('active');
        drawDots(-1);
      }

      go.addEventListener('click', function () {
        if (timer) { stop(); return; }
        var ac = NP.audio.get();
        if (!ac) return;
        step = 0;
        next = ac.currentTime + 0.06;
        schedule();
        timer = setInterval(schedule, 25);
        paint();
        go.textContent = 'STOP';
        go.classList.add('active');
      });

      bpmEl.value = NP.fmt(NP.bpm.get(), 4);
      NP.bpm.on(function (v, from) { if (from !== 'metro') bpmEl.value = NP.fmt(v, 4); });
      bpmEl.addEventListener('input', function () { if (parseFloat(bpmEl.value) > 0) NP.bpm.set(bpmEl.value, 'metro'); });
      q(c, 'n').addEventListener('input', function () { drawDots(-1); });
      NP.seg(q(c, 'sub'), function (v) { sub = parseInt(v, 10); });
      document.addEventListener('visibilitychange', function () { if (document.hidden && timer) stop(); });
      drawDots(-1);
    }
  });

  /* =====================================================================
   * Test tone & noise
   * ===================================================================== */
  function noiseBuffer(ac, kind) {
    var len = ac.sampleRate * 4;
    var buffer = ac.createBuffer(1, len, ac.sampleRate);
    var d = buffer.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    var sum = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === 'pink') {
        // Paul Kellet's refined pink filter
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else d[i] = w;
      sum += d[i] * d[i];
    }
    // normalise to the RMS of a full-scale sine, so a level means roughly the same loudness for each
    var k = Math.SQRT1_2 / Math.sqrt(sum / len);
    for (i = 0; i < len; i++) d[i] = NP.clamp(d[i] * k, -1, 1);
    return buffer;
  }

  NP.tool({
    id: 'tone',
    group: 'music',
    title: 'Test tone & noise',
    keys: 'test tone sine sweep pink white noise generator speaker check left right level dbfs',
    html:
      '<div class="seg mono" data-f="kind"><button type="button" class="seg-btn active" data-v="sine">sine</button>' +
      '<button type="button" class="seg-btn" data-v="sweep">sweep</button><button type="button" class="seg-btn" data-v="pink">pink</button>' +
      '<button type="button" class="seg-btn" data-v="white">white</button></div>' +
      '<div class="cyc-row" data-f="freqrow"><label><span class="mono">frequency (Hz)</span>' +
      '<input data-f="freq" class="field mono" type="number" min="20" max="20000" step="any" value="1000"></label>' +
      '<label><span class="mono">sweep (s)</span><input data-f="dur" class="field mono" type="number" min="1" max="60" value="10"></label></div>' +
      '<input data-f="fslider" type="range" min="0" max="1000" value="566" aria-label="Frequency (log scale)">' +
      '<div class="gen-row mono"><label class="ref">level <input data-f="db" class="field field-sm" type="number" min="-60" max="-6" step="1" value="-24"> dBFS</label>' +
      '<div class="seg" data-f="pan"><button type="button" class="seg-btn" data-v="-1">L</button>' +
      '<button type="button" class="seg-btn active" data-v="0">both</button><button type="button" class="seg-btn" data-v="1">R</button></div></div>' +
      '<button type="button" class="tap-btn mono" data-f="go">PLAY</button>' +
      '<p class="tool-note mono" data-f="msg">plays at the level shown and skips the volume slider. Start low.</p>',
    init: function (c) {
      var kind = 'sine';
      var pan = 0;
      var freq = q(c, 'freq');
      var slider = q(c, 'fslider');
      var go = q(c, 'go');
      var nodes = null;
      var buffers = {};
      var sweepTimer = 0;

      function sliderToHz(v) { return 20 * Math.pow(1000, v / 1000); }
      function hzToSlider(f) { return Math.round(1000 * Math.log(f / 20) / Math.log(1000)); }
      function level() { return Math.pow(10, NP.clamp(parseFloat(q(c, 'db').value) || -24, -60, -6) / 20); }

      function stop() {
        clearTimeout(sweepTimer);
        if (nodes) {
          var ac = NP.audio.ctx;
          nodes.gain.gain.setTargetAtTime(0, ac.currentTime, 0.01);
          var src = nodes.src;
          setTimeout(function () { try { src.stop(); } catch (e) { /* already stopped */ } }, 80);
        }
        nodes = null;
        go.textContent = 'PLAY';
        go.classList.remove('active');
      }

      function play() {
        var ac = NP.audio.get();
        if (!ac) return;
        var gain = ac.createGain();
        var panner = ac.createStereoPanner ? ac.createStereoPanner() : null;
        var src;
        var now = ac.currentTime;
        if (kind === 'pink' || kind === 'white') {
          src = ac.createBufferSource();
          src.buffer = buffers[kind] || (buffers[kind] = noiseBuffer(ac, kind));
          src.loop = true;
        } else {
          src = ac.createOscillator();
          src.type = 'sine';
          if (kind === 'sweep') {
            var dur = NP.clamp(parseFloat(q(c, 'dur').value) || 10, 1, 60);
            src.frequency.setValueAtTime(20, now);
            src.frequency.exponentialRampToValueAtTime(20000, now + dur);
            sweepTimer = setTimeout(stop, dur * 1000);
          } else src.frequency.value = NP.clamp(parseFloat(freq.value) || 1000, 20, 20000);
        }
        // the level is a sine's peak; noise buffers already carry a sine's RMS
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(level(), now + 0.03);
        src.connect(gain);
        if (panner) { panner.pan.value = pan; gain.connect(panner).connect(ac.destination); } else gain.connect(ac.destination);
        src.start();
        nodes = { src: src, gain: gain, panner: panner };
        go.textContent = 'STOP';
        go.classList.add('active');
      }

      NP.seg(q(c, 'kind'), function (v) {
        kind = v;
        q(c, 'freqrow').hidden = kind === 'pink' || kind === 'white';
        slider.hidden = kind !== 'sine';
        if (nodes) { stop(); play(); }
      });
      NP.seg(q(c, 'pan'), function (v) {
        pan = parseFloat(v);
        if (nodes && nodes.panner) nodes.panner.pan.setTargetAtTime(pan, NP.audio.ctx.currentTime, 0.01);
      });
      freq.addEventListener('input', function () {
        var f = parseFloat(freq.value);
        if (f >= 20 && f <= 20000) {
          slider.value = hzToSlider(f);
          if (nodes && kind === 'sine') nodes.src.frequency.setTargetAtTime(f, NP.audio.ctx.currentTime, 0.01);
        }
      });
      slider.addEventListener('input', function () {
        var f = sliderToHz(parseFloat(slider.value));
        freq.value = f < 100 ? f.toFixed(1) : Math.round(f);
        if (nodes && kind === 'sine') nodes.src.frequency.setTargetAtTime(f, NP.audio.ctx.currentTime, 0.01);
      });
      q(c, 'db').addEventListener('input', function () {
        if (nodes) nodes.gain.gain.setTargetAtTime(level(), NP.audio.ctx.currentTime, 0.02);
      });
      go.addEventListener('click', function () { if (nodes) stop(); else play(); });
      document.addEventListener('visibilitychange', function () { if (document.hidden && nodes) stop(); });
    }
  });
})();
