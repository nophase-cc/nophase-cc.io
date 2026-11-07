/* NOPHASE browser tools: MIDI. Needs tools-core.js. */
(function () {
  'use strict';

  var NP = window.NP;
  if (!NP) return;
  var q = NP.q;

  function hex2(n) { return ('0' + n.toString(16).toUpperCase()).slice(-2); }

  /* ---------- controller numbers ---------- */

  // MIDI 1.0 control change assignments. Blank = undefined in the spec, which
  // makes it a safe pick for your own mappings.
  var CC = [];
  (function () {
    var named = {
      0: 'Bank Select MSB', 1: 'Mod Wheel', 2: 'Breath', 4: 'Foot Controller', 5: 'Portamento Time',
      6: 'Data Entry MSB', 7: 'Channel Volume', 8: 'Balance', 10: 'Pan', 11: 'Expression',
      12: 'Effect Control 1', 13: 'Effect Control 2', 16: 'General Purpose 1', 17: 'General Purpose 2',
      18: 'General Purpose 3', 19: 'General Purpose 4', 64: 'Sustain', 65: 'Portamento On/Off',
      66: 'Sostenuto', 67: 'Soft Pedal', 68: 'Legato Footswitch', 69: 'Hold 2',
      70: 'Sound Variation', 71: 'Resonance / Timbre', 72: 'Release Time', 73: 'Attack Time',
      74: 'Cutoff / Brightness', 75: 'Decay Time', 76: 'Vibrato Rate', 77: 'Vibrato Depth',
      78: 'Vibrato Delay', 79: 'Sound Controller 10', 80: 'General Purpose 5', 81: 'General Purpose 6',
      82: 'General Purpose 7', 83: 'General Purpose 8', 84: 'Portamento Control',
      88: 'High Res Velocity Prefix', 91: 'Reverb Send', 92: 'Tremolo Depth', 93: 'Chorus Send',
      94: 'Detune Depth', 95: 'Phaser Depth', 96: 'Data Increment', 97: 'Data Decrement',
      98: 'NRPN LSB', 99: 'NRPN MSB', 100: 'RPN LSB', 101: 'RPN MSB', 120: 'All Sound Off',
      121: 'Reset All Controllers', 122: 'Local Control', 123: 'All Notes Off', 124: 'Omni Off',
      125: 'Omni On', 126: 'Mono On', 127: 'Poly On'
    };
    for (var i = 0; i < 128; i++) {
      var name = named[i] || '';
      var kind = 'free';
      if (named[i]) kind = i >= 120 ? 'mode' : 'std';
      if (i >= 32 && i <= 63) {
        name = 'LSB for CC ' + (i - 32) + (named[i - 32] ? ' (' + named[i - 32] + ')' : '');
        kind = 'lsb';
      }
      CC.push({ n: i, name: name, kind: kind });
    }
  })();
  NP.ccName = function (n) { return CC[n] && CC[n].name; };

  /* ---------- decoding ---------- */

  var STATUS = {
    0x80: 'Note Off', 0x90: 'Note On', 0xa0: 'Poly Aftertouch', 0xb0: 'Control Change',
    0xc0: 'Program Change', 0xd0: 'Channel Pressure', 0xe0: 'Pitch Bend'
  };
  var SYSTEM = {
    0xf1: ['MTC Quarter Frame', 1], 0xf2: ['Song Position', 2], 0xf3: ['Song Select', 1], 0xf6: ['Tune Request', 0],
    0xf8: ['Clock', 0], 0xfa: ['Start', 0], 0xfb: ['Continue', 0], 0xfc: ['Stop', 0],
    0xfe: ['Active Sensing', 0], 0xff: ['Reset', 0]
  };
  var DATA_LEN = { 0x80: 2, 0x90: 2, 0xa0: 2, 0xb0: 2, 0xc0: 1, 0xd0: 1, 0xe0: 2 };
  var MANUFACTURER = {
    '01': 'Sequential', '04': 'Moog', '06': 'Lexicon', '07': 'Kurzweil', '0F': 'Ensoniq', '10': 'Oberheim',
    '18': 'E-mu', '40': 'Kawai', '41': 'Roland', '42': 'Korg', '43': 'Yamaha', '44': 'Casio', '47': 'Akai',
    '7D': 'non-commercial', '7E': 'universal non-realtime', '7F': 'universal realtime',
    '00 20 29': 'Novation', '00 20 32': 'Behringer', '00 20 3C': 'Elektron', '00 21 1D': 'Ableton',
    '00 20 6B': 'Arturia', '00 01 79': 'DJ TechTools', '00 20 33': 'Access', '00 00 66': 'Mackie'
  };

  // one message (array of byte numbers) -> { kind, ch, text }
  function describe(b) {
    var st = b[0];
    if (st === 0xf0) {
      var id = hex2(b[1] || 0);
      if (b[1] === 0) id = [b[1], b[2], b[3]].map(function (x) { return hex2(x || 0); }).join(' ');
      return { kind: 'sysex', text: 'SysEx · ' + (MANUFACTURER[id] || 'ID ' + id) + ' · ' + b.length + ' bytes' };
    }
    if (st >= 0xf0) {
      var sys = SYSTEM[st] || ['System ' + hex2(st), 0];
      var t = sys[0];
      if (st === 0xf2) t += ' · ' + (b[1] | (b[2] << 7)) + ' sixteenths';
      if (st === 0xf3 || st === 0xf1) t += ' · ' + b[1];
      return { kind: st >= 0xf8 ? 'rt' : 'sys', text: t };
    }
    var type = st & 0xf0;
    var ch = (st & 0x0f) + 1;
    var text = STATUS[type];
    if (type === 0x90 && b[2] === 0) text = 'Note Off (on, vel 0)';
    if (type === 0x80 || type === 0x90) text += ' · ' + NP.midiName(b[1]) + ' (' + b[1] + ') · vel ' + b[2];
    else if (type === 0xa0) text += ' · ' + NP.midiName(b[1]) + ' · ' + b[2];
    else if (type === 0xb0) text += ' · CC ' + b[1] + (CC[b[1]] && CC[b[1]].name ? ' ' + CC[b[1]].name : '') + ' = ' + b[2];
    else if (type === 0xc0) text += ' · ' + b[1] + ' (' + (b[1] + 1) + ' if 1-based)';
    else if (type === 0xd0) text += ' · ' + b[1];
    else if (type === 0xe0) {
      var v = (b[1] | (b[2] << 7)) - 8192;
      text += ' · ' + (v > 0 ? '+' : '') + v;
    }
    return { kind: type === 0xb0 ? 'cc' : type <= 0xa0 ? 'note' : 'ch', ch: ch, text: text };
  }
  NP.midiDescribe = describe;

  // byte stream (with running status) -> [{ bytes, info | error }]
  function parseStream(bytes) {
    var out = [];
    var running = 0;
    var i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      if (b === 0xf0) {
        var end = bytes.indexOf(0xf7, i);
        var msg = bytes.slice(i, end === -1 ? bytes.length : end + 1);
        out.push(end === -1 ? { bytes: msg, error: 'SysEx with no F7 end byte' } : { bytes: msg, info: describe(msg) });
        i += msg.length;
        running = 0;
        continue;
      }
      if (b >= 0xf8) { out.push({ bytes: [b], info: describe([b]) }); i++; continue; }
      if (b >= 0xf0) {
        var len = SYSTEM[b] ? SYSTEM[b][1] : 0;
        var sm = bytes.slice(i, i + 1 + len);
        out.push(sm.length === len + 1 ? { bytes: sm, info: describe(sm) } : { bytes: sm, error: 'incomplete message' });
        i += sm.length;
        running = 0;
        continue;
      }
      var status = b;
      var start = i + 1;
      if (b < 0x80) {
        if (!running) { out.push({ bytes: [b], error: 'data byte with no status (running status needs one first)' }); i++; continue; }
        status = running;
        start = i;
      }
      running = status;
      var n = DATA_LEN[status & 0xf0];
      var data = bytes.slice(start, start + n);
      var bad = data.length < n || data.some(function (d) { return d > 0x7f; });
      var full = [status].concat(data);
      out.push(bad ? { bytes: full, error: 'needs ' + n + ' data bytes (0-7F)' } : { bytes: full, info: describe(full), rs: b < 0x80 });
      i = start + data.length;
    }
    return out;
  }

  function parseHex(str) {
    var tokens = str.replace(/0x/gi, ' ').replace(/[,;:]/g, ' ').trim().split(/\s+/).filter(Boolean);
    var bytes = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!/^[0-9a-f]+$/i.test(t)) return null;
      if (t.length > 2) {
        if (t.length % 2) return null;
        for (var j = 0; j < t.length; j += 2) bytes.push(parseInt(t.substr(j, 2), 16));
      } else bytes.push(parseInt(t, 16));
    }
    return bytes;
  }

  /* =====================================================================
   * Decoder + builder
   * ===================================================================== */
  var BUILD = [
    ['90', 'Note On', 'note', 'velocity'], ['80', 'Note Off', 'note', 'velocity'], ['b0', 'Control Change', 'CC', 'value'],
    ['c0', 'Program Change', 'program', ''], ['e0', 'Pitch Bend', 'bend (-8192..8191)', ''],
    ['d0', 'Channel Pressure', 'pressure', ''], ['a0', 'Poly Aftertouch', 'note', 'pressure']
  ];

  NP.tool({
    id: 'midibytes',
    group: 'music',
    title: 'MIDI message decoder',
    keys: 'midi hex bytes decode encode status running sysex cc note pitch bend',
    html:
      '<label class="stack"><span class="mono">hex bytes (running status and SysEx are fine)</span>' +
      '<textarea data-f="in" class="field mono" rows="2" spellcheck="false">B0 07 64 0A 40 90 3C 7F E0 00 50 F8</textarea></label>' +
      '<ol class="msg-list mono" data-f="out"></ol>' +
      '<div class="build mono">' +
      '<select data-f="type" class="field field-sm">' + BUILD.map(function (b) { return '<option value="' + b[0] + '">' + b[1] + '</option>'; }).join('') + '</select>' +
      '<label>ch <input data-f="ch" class="field field-sm" type="number" min="1" max="16" value="1"></label>' +
      '<label><span data-f="l1">note</span> <input data-f="d1" class="field field-sm" type="number" value="60"></label>' +
      '<label data-f="w2"><span data-f="l2">velocity</span> <input data-f="d2" class="field field-sm" type="number" min="0" max="127" value="100"></label>' +
      '<button type="button" class="cell build-out" data-f="hex" title="click to copy"></button>' +
      '<button type="button" class="step-btn" data-f="use">decode it</button></div>',
    init: function (c) {
      var inp = q(c, 'in');
      var out = q(c, 'out');
      var type = q(c, 'type');

      function decode() {
        var bytes = parseHex(inp.value);
        if (!bytes) { out.innerHTML = '<li class="bad">not hex: use pairs like 90 3C 7F</li>'; return; }
        out.innerHTML = parseStream(bytes).map(function (m) {
          var hx = m.bytes.map(hex2).join(' ');
          if (m.error) return '<li class="bad"><code>' + hx + '</code><span>' + NP.esc(m.error) + '</span></li>';
          return '<li><code>' + hx + '</code><span>' + (m.info.ch ? '<b>ch ' + m.info.ch + '</b> ' : '') +
            NP.esc(m.info.text) + (m.rs ? ' <em>running status</em>' : '') + '</span></li>';
        }).join('');
      }

      function build() {
        var t = parseInt(type.value, 16);
        var def = BUILD.filter(function (b) { return b[0] === type.value; })[0];
        q(c, 'l1').textContent = def[2];
        q(c, 'l2').textContent = def[3];
        q(c, 'w2').hidden = !def[3];
        var ch = NP.clamp(parseInt(q(c, 'ch').value, 10) || 1, 1, 16);
        var d1 = parseInt(q(c, 'd1').value, 10) || 0;
        var d2 = NP.clamp(parseInt(q(c, 'd2').value, 10) || 0, 0, 127);
        var bytes = [t | (ch - 1)];
        if (t === 0xe0) {
          var v = NP.clamp(d1, -8192, 8191) + 8192;
          bytes.push(v & 0x7f, v >> 7);
        } else {
          bytes.push(NP.clamp(d1, 0, 127));
          if (def[3]) bytes.push(d2);
        }
        var hx = bytes.map(hex2).join(' ');
        var el = q(c, 'hex');
        el.textContent = hx;
        el.setAttribute('data-copy', hx);
      }

      inp.addEventListener('input', decode);
      [type, q(c, 'ch'), q(c, 'd1'), q(c, 'd2')].forEach(function (el) { el.addEventListener('input', build); });
      type.addEventListener('change', function () {
        q(c, 'd1').value = type.value === 'e0' ? 0 : type.value === 'b0' ? 74 : type.value === 'c0' ? 0 : 60;
        build();
      });
      q(c, 'hex').addEventListener('click', function (e) { NP.copy(e.currentTarget.getAttribute('data-copy'), e.currentTarget); });
      q(c, 'use').addEventListener('click', function () { inp.value = q(c, 'hex').textContent; decode(); });
      decode();
      build();
    }
  });

  /* =====================================================================
   * CC map
   * ===================================================================== */
  NP.tool({
    id: 'ccref',
    group: 'music',
    title: 'MIDI CC map',
    keys: 'midi cc control change numbers list free unassigned nrpn rpn sustain mod wheel',
    head: '<input data-f="filter" class="field field-sm mono" type="search" placeholder="filter" aria-label="Filter controllers">',
    html:
      '<div class="seg mono" data-f="show"><button type="button" class="seg-btn active" data-v="all">all</button>' +
      '<button type="button" class="seg-btn" data-v="free">free to use</button>' +
      '<button type="button" class="seg-btn" data-v="std">assigned</button></div>' +
      '<div class="ref-scroll"><table class="ref-table mono"><tbody>' +
      CC.map(function (r) {
        return '<tr data-kind="' + r.kind + '"><td>' + r.n + ' <span class="dim">' + hex2(r.n) + '</span></td><td>' +
          (r.name ? NP.esc(r.name) : '<span class="dim">undefined · free</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="tool-note mono">"free" numbers are undefined in the spec, so nothing else should claim them. 32-63 are the fine (LSB) halves of 0-31.</p>',
    init: function (c) {
      var rows = [].slice.call(c.querySelectorAll('tbody tr'));
      var show = 'all';
      var filter = q(c, 'filter');
      function apply() {
        var v = filter.value.trim().toLowerCase();
        rows.forEach(function (r) {
          var k = r.getAttribute('data-kind');
          var okKind = show === 'all' || (show === 'free' ? k === 'free' : k !== 'free');
          var okText = !v || r.textContent.toLowerCase().indexOf(v) !== -1 || r.firstChild.textContent.split(' ')[0] === v;
          r.hidden = !(okKind && okText);
        });
      }
      filter.addEventListener('input', apply);
      NP.seg(q(c, 'show'), function (v) { show = v; apply(); });
    }
  });

  /* =====================================================================
   * Web MIDI monitor
   * ===================================================================== */
  NP.tool({
    id: 'midimon',
    group: 'music',
    title: 'MIDI monitor',
    keys: 'web midi monitor input log debug controller clock learn',
    head: '<button type="button" class="step-btn mono" data-f="go">connect</button>',
    html:
      '<p class="tool-note mono" data-f="ports">Connect to see your MIDI inputs. Your browser will ask first.</p>' +
      '<div class="gen-row mono">' +
      '<label class="check"><input type="checkbox" data-f="hideclock" checked> hide clock &amp; sensing</label>' +
      '<label class="check"><input type="checkbox" data-f="pause"> pause</label>' +
      '<span class="mon-bpm" data-f="bpm"></span>' +
      '<button type="button" class="step-btn" data-f="clear">clear</button></div>' +
      '<ol class="msg-list mon-log mono" data-f="log"></ol>',
    init: function (c) {
      var log = q(c, 'log');
      var portsEl = q(c, 'ports');
      var bpmEl = q(c, 'bpm');
      var access = null;
      var ticks = [];
      var MAX = 150;

      if (!navigator.requestMIDIAccess) {
        portsEl.textContent = 'This browser has no Web MIDI. Chrome, Edge, Firefox and Opera do; Safari does not.';
        q(c, 'go').disabled = true;
        return;
      }

      function onMessage(e) {
        var data = Array.prototype.slice.call(e.data);
        var st = data[0];
        if (st === 0xf8) {
          ticks.push(e.timeStamp || performance.now());
          if (ticks.length > 48) ticks.shift();
          if (ticks.length > 24) {
            var bpm = 60000 / (((ticks[ticks.length - 1] - ticks[0]) / (ticks.length - 1)) * 24);
            bpmEl.textContent = 'clock ≈ ' + bpm.toFixed(1) + ' BPM';
          }
        }
        if (q(c, 'pause').checked) return;
        if ((st === 0xf8 || st === 0xfe) && q(c, 'hideclock').checked) return;
        var info = describe(data);
        var li = document.createElement('li');
        li.innerHTML = '<code>' + data.map(hex2).join(' ') + '</code><span>' + (info.ch ? '<b>ch ' + info.ch + '</b> ' : '') +
          NP.esc(info.text) + ' <em>' + NP.esc(e.target.name || '') + '</em></span>';
        log.insertBefore(li, log.firstChild);
        while (log.children.length > MAX) log.removeChild(log.lastChild);
      }

      function listPorts() {
        var names = [];
        access.inputs.forEach(function (input) {
          input.onmidimessage = onMessage;
          names.push(input.name + (input.state === 'connected' ? '' : ' (offline)'));
        });
        portsEl.textContent = names.length ? 'listening to: ' + names.join(' · ') : 'Connected, but no MIDI inputs found. Plug one in.';
      }

      q(c, 'go').addEventListener('click', function (e) {
        var btn = e.currentTarget;
        navigator.requestMIDIAccess({ sysex: false }).then(function (a) {
          access = a;
          access.onstatechange = listPorts;
          listPorts();
          btn.textContent = 'connected';
          btn.disabled = true;
        }, function () {
          portsEl.textContent = 'MIDI access was blocked. Allow it in the site settings and try again.';
        });
      });
      q(c, 'clear').addEventListener('click', function () { log.innerHTML = ''; ticks = []; bpmEl.textContent = ''; });
    }
  });
})();
