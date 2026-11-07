/* NOPHASE browser tools: network & dev. Needs tools-core.js. */
(function () {
  'use strict';

  var NP = window.NP;
  if (!NP) return;
  var q = NP.q;
  var fmt = NP.fmt;

  function kv(rows) {
    return rows.map(function (r) {
      return '<tr><th>' + r[0] + '</th><td><button type="button" class="cell" data-copy="' + NP.esc(r[1]) + '">' +
        NP.esc(r[1]) + '</button></td></tr>';
    }).join('');
  }

  // delegate: click any .cell inside el to copy its data-copy value
  function copyCells(el) {
    el.addEventListener('click', function (e) {
      var cell = e.target.closest('.cell');
      if (cell) NP.copy(cell.getAttribute('data-copy'), cell);
    });
  }

  /* =====================================================================
   * IPv4 subnet calculator
   * ===================================================================== */
  function ipToInt(s) {
    var m = String(s).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    var n = 0;
    for (var i = 1; i <= 4; i++) {
      var o = parseInt(m[i], 10);
      if (o > 255) return null;
      n = n * 256 + o;
    }
    return n;
  }
  function intToIp(n) {
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }
  function bin(n) {
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].map(function (o) {
      return ('00000000' + o.toString(2)).slice(-8);
    }).join('.');
  }
  var PRIVATE = [
    ['10.0.0.0', 8, 'private (RFC 1918)'], ['172.16.0.0', 12, 'private (RFC 1918)'], ['192.168.0.0', 16, 'private (RFC 1918)'],
    ['127.0.0.0', 8, 'loopback'], ['169.254.0.0', 16, 'link-local'], ['100.64.0.0', 10, 'CGNAT (Tailscale lives here)'],
    ['224.0.0.0', 4, 'multicast']
  ];

  NP.tool({
    id: 'cidr',
    group: 'net',
    title: 'Subnet calculator',
    keys: 'subnet cidr ip ipv4 netmask wildcard broadcast hosts network',
    html:
      '<label class="stack"><span class="mono">IPv4 / prefix (or mask)</span>' +
      '<input data-f="in" class="field mono" type="text" value="192.168.1.10/24" spellcheck="false" autocapitalize="off"></label>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var input = q(c, 'in');
      var out = q(c, 'out');
      var msg = q(c, 'msg');
      copyCells(out);

      function draw() {
        var m = input.value.trim().match(/^([\d.]+)(?:(?:\s*\/\s*|\s+)(\d{1,2}|\d[\d.]*))?$/);
        var ip = m && ipToInt(m[1]);
        var prefix = 24;
        if (m && m[2] !== undefined) {
          if (m[2].indexOf('.') !== -1) {
            var mk = ipToInt(m[2]);
            prefix = -1;
            for (var b = 0; mk !== null && b <= 32; b++) {
              if ((b === 0 ? 0 : (0xffffffff << (32 - b)) >>> 0) === mk) { prefix = b; break; }
            }
          } else prefix = parseInt(m[2], 10);
        }
        if (ip === null || !m || prefix < 0 || prefix > 32) {
          out.innerHTML = '';
          msg.textContent = 'enter something like 10.0.0.5/22 or 192.168.1.1 255.255.255.0';
          return;
        }
        var maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
        var net = (ip & maskInt) >>> 0;
        var bc = (net | (~maskInt >>> 0)) >>> 0;
        var hosts = prefix >= 31 ? Math.pow(2, 32 - prefix) : Math.pow(2, 32 - prefix) - 2;
        var first = prefix >= 31 ? net : net + 1;
        var last = prefix >= 31 ? bc : bc - 1;
        var kind = '';
        PRIVATE.forEach(function (p) {
          var pm = (0xffffffff << (32 - p[1])) >>> 0;
          if (((ip & pm) >>> 0) === ipToInt(p[0])) kind = p[2];
        });
        out.innerHTML = kv([
          ['network', intToIp(net) + '/' + prefix], ['netmask', intToIp(maskInt)], ['wildcard', intToIp(~maskInt >>> 0)],
          ['broadcast', intToIp(bc)], ['first host', intToIp(first)], ['last host', intToIp(last)],
          ['usable hosts', String(hosts)], ['binary', bin(ip)]
        ]);
        msg.textContent = kind || 'public address space';
      }

      input.addEventListener('input', draw);
      draw();
    }
  });

  /* =====================================================================
   * Epoch / time
   * ===================================================================== */
  NP.tool({
    id: 'epoch',
    group: 'dev',
    title: 'Epoch & time',
    keys: 'unix timestamp epoch date time utc iso convert',
    head: '<button type="button" class="step-btn mono" data-f="now">now</button>',
    html:
      '<label class="stack"><span class="mono">unix time (s or ms) or any date string</span>' +
      '<input data-f="in" class="field mono" type="text" spellcheck="false" autocapitalize="off"></label>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var input = q(c, 'in');
      var out = q(c, 'out');
      var msg = q(c, 'msg');
      copyCells(out);

      function rel(ms) {
        var d = (ms - Date.now()) / 1000;
        var a = Math.abs(d);
        var units = [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm'], [1, 's']];
        for (var i = 0; i < units.length; i++) {
          if (a >= units[i][0]) {
            var n = Math.floor(a / units[i][0]);
            return d < 0 ? n + units[i][1] + ' ago' : 'in ' + n + units[i][1];
          }
        }
        return 'now';
      }

      function draw() {
        var v = input.value.trim();
        if (!v) { out.innerHTML = ''; msg.textContent = ''; return; }
        var t;
        if (/^-?\d+(\.\d+)?$/.test(v)) {
          var n = parseFloat(v);
          t = Math.abs(n) > 1e11 ? n : n * 1000;
        } else t = Date.parse(v);
        if (!isFinite(t)) { out.innerHTML = ''; msg.textContent = 'could not parse that'; return; }
        var d = new Date(t);
        out.innerHTML = kv([
          ['seconds', String(Math.floor(t / 1000))], ['millis', String(Math.floor(t))],
          ['UTC', d.toISOString()], ['local', d.toString().replace(/ GMT.*/, '')],
          ['relative', rel(t)]
        ]);
        msg.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }

      input.addEventListener('input', draw);
      q(c, 'now').addEventListener('click', function () { input.value = String(Math.floor(Date.now() / 1000)); draw(); });
      input.value = String(Math.floor(Date.now() / 1000));
      draw();
    }
  });

  /* =====================================================================
   * Encode / decode
   * ===================================================================== */
  function b64enc(s) {
    var bytes = new TextEncoder().encode(s);
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  function b64dec(s) {
    var str = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
    var bin = atob(str + '==='.slice((str.length + 3) % 4));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  var CODECS = {
    base64: [b64enc, b64dec],
    url: [encodeURIComponent, decodeURIComponent],
    hex: [function (s) {
      return Array.prototype.map.call(new TextEncoder().encode(s), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(' ');
    }, function (s) {
      var h = s.replace(/[^0-9a-f]/gi, '');
      var arr = new Uint8Array(h.length >> 1);
      for (var i = 0; i < arr.length; i++) arr[i] = parseInt(h.substr(i * 2, 2), 16);
      return new TextDecoder().decode(arr);
    }],
    html: [function (s) { return NP.esc(s); }, function (s) {
      var t = document.createElement('textarea');
      t.innerHTML = s;
      return t.value;
    }],
    jwt: [null, function (s) {
      var parts = s.trim().split('.');
      if (parts.length < 2) throw new Error('not a JWT');
      return JSON.stringify(JSON.parse(b64dec(parts[0])), null, 2) + '\n\n' + JSON.stringify(JSON.parse(b64dec(parts[1])), null, 2);
    }]
  };

  NP.tool({
    id: 'encode',
    group: 'sec',
    title: 'Encode / decode',
    keys: 'base64 url hex html jwt encode decode',
    head: '<select data-f="kind" class="field field-sm mono"><option>base64</option><option>url</option><option>hex</option><option>html</option><option>jwt</option></select>',
    html:
      '<div class="seg mono" data-f="dir"><button type="button" class="seg-btn active" data-v="enc">encode</button>' +
      '<button type="button" class="seg-btn" data-v="dec">decode</button></div>' +
      '<textarea data-f="in" class="field mono" rows="3" spellcheck="false" placeholder="input"></textarea>' +
      '<textarea data-f="out" class="field mono" rows="3" spellcheck="false" placeholder="output" readonly></textarea>' +
      '<div class="pitch-ctl"><button type="button" class="step-btn mono" data-f="copy">copy output</button>' +
      '<button type="button" class="step-btn mono" data-f="swap">use as input</button></div>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var kind = q(c, 'kind');
      var inp = q(c, 'in');
      var out = q(c, 'out');
      var msg = q(c, 'msg');
      var dir = 'enc';

      function run() {
        msg.textContent = '';
        try {
          var codec = CODECS[kind.value];
          var fn = dir === 'enc' ? codec[0] : codec[1];
          if (!fn) { out.value = ''; msg.textContent = kind.value + ' is decode only'; return; }
          out.value = inp.value ? fn(inp.value) : '';
        } catch (e) {
          out.value = '';
          msg.textContent = 'could not ' + (dir === 'enc' ? 'encode' : 'decode') + ' that';
        }
      }
      inp.addEventListener('input', run);
      kind.addEventListener('change', function () {
        if (kind.value === 'jwt' && dir === 'enc') { dir = 'dec'; setDir('dec'); }
        run();
      });
      var setDir = NP.seg(q(c, 'dir'), function (v) { dir = v; run(); });
      q(c, 'copy').addEventListener('click', function (e) { NP.copy(out.value, e.currentTarget); });
      q(c, 'swap').addEventListener('click', function () { inp.value = out.value; run(); });
    }
  });

  /* =====================================================================
   * Hash (SubtleCrypto, text or file, all local)
   * ===================================================================== */
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  NP.tool({
    id: 'hash',
    group: 'sec',
    title: 'Hash',
    keys: 'sha1 sha256 sha512 checksum digest file',
    html:
      '<textarea data-f="in" class="field mono" rows="3" spellcheck="false" placeholder="text to hash"></textarea>' +
      '<label class="file mono"><input type="file" data-f="file"> or hash a file (stays on your machine)</label>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var inp = q(c, 'in');
      var out = q(c, 'out');
      var msg = q(c, 'msg');
      copyCells(out);
      var ALGS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

      function digest(data, label) {
        if (!window.crypto || !crypto.subtle) { msg.textContent = 'needs https or localhost'; return; }
        Promise.all(ALGS.map(function (a) { return crypto.subtle.digest(a, data); })).then(function (res) {
          out.innerHTML = kv(res.map(function (r, i) { return [ALGS[i], hex(r)]; }));
          msg.textContent = label;
        });
      }

      inp.addEventListener('input', function () {
        if (!inp.value) { out.innerHTML = ''; msg.textContent = ''; return; }
        digest(new TextEncoder().encode(inp.value), inp.value.length + ' chars');
      });
      q(c, 'file').addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (f) f.arrayBuffer().then(function (buf) { digest(buf, f.name + ' (' + f.size + ' bytes)'); });
      });
    }
  });

  /* =====================================================================
   * JSON
   * ===================================================================== */
  NP.tool({
    id: 'json',
    group: 'dev',
    title: 'JSON format & validate',
    keys: 'json format pretty minify validate lint',
    html:
      '<textarea data-f="in" class="field mono" rows="7" spellcheck="false" placeholder=\'{"paste":"json here"}\'></textarea>' +
      '<div class="pitch-ctl"><button type="button" class="tap-btn mono" data-f="pretty">format</button>' +
      '<button type="button" class="step-btn mono" data-f="min">minify</button>' +
      '<button type="button" class="step-btn mono" data-f="copy">copy</button></div>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var inp = q(c, 'in');
      var msg = q(c, 'msg');

      function parse() {
        if (!inp.value.trim()) { msg.textContent = ''; return null; }
        try {
          var v = JSON.parse(inp.value);
          msg.textContent = 'valid · ' + (Array.isArray(v) ? v.length + ' items' : typeof v === 'object' && v ? Object.keys(v).length + ' keys' : typeof v);
          msg.classList.remove('bad');
          return { v: v };
        } catch (e) {
          msg.textContent = e.message;
          msg.classList.add('bad');
          return null;
        }
      }
      inp.addEventListener('input', parse);
      q(c, 'pretty').addEventListener('click', function () { var r = parse(); if (r) inp.value = JSON.stringify(r.v, null, 2); });
      q(c, 'min').addEventListener('click', function () { var r = parse(); if (r) inp.value = JSON.stringify(r.v); });
      q(c, 'copy').addEventListener('click', function (e) { NP.copy(inp.value, e.currentTarget); });
    }
  });

  /* =====================================================================
   * Generators
   * ===================================================================== */
  NP.tool({
    id: 'gen',
    group: 'sec',
    title: 'UUID & password',
    keys: 'uuid guid password generator random entropy',
    html:
      '<div class="gen-row"><button type="button" class="step-btn mono" data-f="uuid">new UUID</button>' +
      '<button type="button" class="cell gen-out mono" data-f="uuidout" title="click to copy"></button></div>' +
      '<div class="gen-row"><label class="mono ref">length <input data-f="len" class="field field-sm mono" type="number" min="8" max="128" value="24"></label>' +
      '<label class="check mono"><input type="checkbox" data-f="sym" checked> symbols</label>' +
      '<button type="button" class="step-btn mono" data-f="pw">new password</button></div>' +
      '<button type="button" class="cell gen-out mono" data-f="pwout" title="click to copy"></button>' +
      '<p class="tool-note mono" data-f="bits"></p>' +
      '<p class="tool-note mono">generated with crypto.getRandomValues, never leaves the page</p>',
    init: function (c) {
      var uuidOut = q(c, 'uuidout');
      var pwOut = q(c, 'pwout');

      function uuid() {
        if (crypto.randomUUID) return crypto.randomUUID();
        var b = crypto.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        var h = hex(b);
        return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-');
      }
      function pw() {
        var len = NP.clamp(parseInt(q(c, 'len').value, 10) || 24, 8, 128);
        var set = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' + (q(c, 'sym').checked ? '!@#$%^&*-_=+?' : '');
        // rejection sampling: drop values past the last whole multiple of the
        // set size so every character is equally likely (no modulo bias)
        var cap = Math.floor(4294967296 / set.length) * set.length;
        var buf = new Uint32Array(1);
        var s = '';
        while (s.length < len) {
          crypto.getRandomValues(buf);
          if (buf[0] < cap) s += set[buf[0] % set.length];
        }
        var bits = Math.floor(len * Math.log(set.length) / Math.LN2);
        q(c, 'bits').textContent = bits + ' bits of entropy · ' + (bits >= 128 ? 'overkill, in a good way' :
          bits >= 80 ? 'strong' : bits >= 60 ? 'fine for most accounts' : 'short, add length');
        return s;
      }
      function setOut(el, v) { el.textContent = v; el.setAttribute('data-copy', v); }
      q(c, 'uuid').addEventListener('click', function () { setOut(uuidOut, uuid()); });
      q(c, 'pw').addEventListener('click', function () { setOut(pwOut, pw()); });
      copyCells(c);
      setOut(uuidOut, uuid());
      setOut(pwOut, pw());
    }
  });

  /* =====================================================================
   * Color
   * ===================================================================== */
  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var l = (max + min) / 2;
    var h = 0;
    var s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }
  function lum(rgb) {
    var v = rgb.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }

  NP.tool({
    id: 'color',
    group: 'dev',
    title: 'Color',
    keys: 'color colour hex rgb hsl contrast picker',
    html:
      '<div class="color-top"><input type="color" data-f="pick" value="#ff8a4c" aria-label="Pick a color">' +
      '<div class="color-sw" data-f="sw"></div></div>' +
      '<div class="pitch-row">' +
      '<label><span class="mono">hex</span><input data-f="hex" class="field mono" type="text" spellcheck="false"></label>' +
      '<label><span class="mono">rgb</span><input data-f="rgb" class="field mono" type="text" spellcheck="false"></label>' +
      '<label><span class="mono">hsl</span><input data-f="hsl" class="field mono" type="text" spellcheck="false"></label></div>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var pick = q(c, 'pick');
      var hexEl = q(c, 'hex');
      var rgbEl = q(c, 'rgb');
      var hslEl = q(c, 'hsl');
      var rgb = [255, 138, 76];

      function show(skip) {
        var hx = '#' + rgb.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
        var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        if (skip !== 'hex') hexEl.value = hx;
        if (skip !== 'rgb') rgbEl.value = rgb.join(', ');
        if (skip !== 'hsl') hslEl.value = hsl[0] + ', ' + hsl[1] + '%, ' + hsl[2] + '%';
        pick.value = hx;
        q(c, 'sw').style.background = hx;
        var L = lum(rgb);
        q(c, 'msg').textContent = 'contrast: ' + ((1.05) / (L + 0.05)).toFixed(2) + ' on white · ' + ((L + 0.05) / 0.05).toFixed(2) + ' on black';
      }

      pick.addEventListener('input', function () {
        var n = parseInt(pick.value.slice(1), 16);
        rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        show();
      });
      hexEl.addEventListener('input', function () {
        var m = hexEl.value.trim().replace('#', '');
        if (m.length === 3) m = m.replace(/./g, '$&$&');
        if (/^[0-9a-f]{6}$/i.test(m)) { var n = parseInt(m, 16); rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; show('hex'); }
      });
      rgbEl.addEventListener('input', function () {
        var m = rgbEl.value.match(/\d+/g);
        if (m && m.length >= 3) { rgb = m.slice(0, 3).map(function (v) { return NP.clamp(parseInt(v, 10), 0, 255); }); show('rgb'); }
      });
      hslEl.addEventListener('input', function () {
        var m = hslEl.value.match(/\d+(\.\d+)?/g);
        if (m && m.length >= 3) { rgb = hslToRgb(+m[0] % 360, NP.clamp(+m[1], 0, 100), NP.clamp(+m[2], 0, 100)); show('hsl'); }
      });
      show();
    }
  });

  /* =====================================================================
   * Common ports
   * ===================================================================== */
  var PORTS = [
    [21, 'FTP'], [22, 'SSH / SFTP'], [23, 'Telnet'], [25, 'SMTP'], [53, 'DNS'], [67, 'DHCP server'], [68, 'DHCP client'],
    [80, 'HTTP'], [123, 'NTP'], [161, 'SNMP'], [389, 'LDAP'], [443, 'HTTPS'], [445, 'SMB'], [465, 'SMTPS'], [514, 'Syslog'],
    [587, 'SMTP submission'], [636, 'LDAPS'], [853, 'DNS over TLS'], [993, 'IMAPS'], [1883, 'MQTT'], [2049, 'NFS'],
    [2375, 'Docker API (plain)'], [2376, 'Docker API (TLS)'], [3000, 'Grafana / AdGuard setup'], [3306, 'MySQL / MariaDB'],
    [3389, 'RDP'], [5353, 'mDNS'], [5432, 'PostgreSQL'], [5601, 'Kibana'], [5900, 'VNC'], [6379, 'Redis'], [6443, 'Kubernetes API'],
    [8006, 'Proxmox web UI'], [8080, 'HTTP alt / Traefik dash'], [8096, 'Jellyfin'], [8123, 'Home Assistant'],
    [8384, 'Syncthing UI'], [8443, 'HTTPS alt / UniFi'], [8883, 'MQTT over TLS'], [9000, 'Portainer'], [9090, 'Prometheus'],
    [9100, 'node_exporter'], [9200, 'Elasticsearch'], [27017, 'MongoDB'], [32400, 'Plex'], [51820, 'WireGuard']
  ];

  NP.tool({
    id: 'ports',
    group: 'net',
    title: 'Common ports',
    keys: 'tcp udp port numbers services well known',
    head: '<input data-f="filter" class="field field-sm mono" type="search" placeholder="filter" aria-label="Filter ports">',
    html: '<div class="ref-scroll"><table class="ref-table mono" data-f="table"><tbody>' +
      PORTS.map(function (p) { return '<tr><td>' + p[0] + '</td><td>' + p[1] + '</td></tr>'; }).join('') +
      '</tbody></table></div>',
    init: function (c) {
      var rows = [].slice.call(c.querySelectorAll('tbody tr'));
      q(c, 'filter').addEventListener('input', function (e) {
        var v = e.target.value.trim().toLowerCase();
        rows.forEach(function (r) { r.hidden = !!v && r.textContent.toLowerCase().indexOf(v) === -1; });
      });
    }
  });
  /* =====================================================================
   * Regex tester (runs in a worker so a runaway pattern can be killed)
   * ===================================================================== */
  // Pure: job -> result. Runs inside the worker (its source is copied into a
  // Blob), or inline if workers are unavailable.
  function rxRun(d) {
    var res = { id: d.id, matches: [], total: 0 };
    try {
      var re = new RegExp(d.pattern, d.flags.indexOf('g') === -1 ? d.flags + 'g' : d.flags);
      var m;
      while ((m = re.exec(d.text)) !== null) {
        if (res.matches.length < 500) res.matches.push({ i: m.index, s: m[0], g: m.slice(1), n: m.groups || null });
        res.total++;
        if (m[0] === '') re.lastIndex++;
        if (res.total > 100000) break;
      }
      if (d.replace !== null) res.replaced = d.text.replace(new RegExp(d.pattern, d.flags), d.replace);
    } catch (err) {
      res.error = err.message;
    }
    return res;
  }
  NP.rxRun = rxRun;
  var RX_WORKER = 'var rxRun = ' + rxRun.toString() + ';\nself.onmessage = function (e) { self.postMessage(rxRun(e.data)); };';

  NP.tool({
    id: 'regex',
    group: 'dev',
    title: 'Regex tester',
    keys: 'regex regexp regular expression match test replace groups javascript',
    wide: true,
    html:
      '<div class="rx-row mono"><span>/</span><input data-f="pat" class="field mono" type="text" spellcheck="false" autocapitalize="off" ' +
      'value="(?<user>[\\w.+-]+)@(?<host>[\\w-]+\\.[\\w.]+)" aria-label="Pattern"><span>/</span>' +
      '<input data-f="flags" class="field field-sm mono" type="text" value="gi" spellcheck="false" aria-label="Flags"></div>' +
      '<textarea data-f="text" class="field mono" rows="4" spellcheck="false">Mail ops@nophase.cc or charles.l+test@example.co.uk, not @nobody.</textarea>' +
      '<div class="rx-view mono" data-f="view"></div>' +
      '<table class="kv mono rx-groups" data-f="groups"></table>' +
      '<label class="stack"><span class="mono">replace with ($1, $&lt;name&gt;, $&amp;)</span>' +
      '<input data-f="rep" class="field mono" type="text" value="$<user> at $<host>" spellcheck="false"></label>' +
      '<textarea data-f="out" class="field mono" rows="2" readonly placeholder="replacement result"></textarea>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var pat = q(c, 'pat');
      var flags = q(c, 'flags');
      var text = q(c, 'text');
      var rep = q(c, 'rep');
      var view = q(c, 'view');
      var msg = q(c, 'msg');
      var worker = null;
      var workerUrl = null;
      var busy = 0;
      var seq = 0;
      var timer = 0;

      function render(r) {
        msg.classList.toggle('bad', !!r.error);
        if (r.error) {
          msg.textContent = r.error;
          view.textContent = text.value;
          q(c, 'groups').innerHTML = '';
          q(c, 'out').value = '';
          return;
        }
        var t = text.value;
        var html = '';
        var last = 0;
        r.matches.forEach(function (m) {
          if (m.i < last) return;
          html += NP.esc(t.slice(last, m.i)) + (m.s ? '<mark>' + NP.esc(m.s) + '</mark>' : '<mark class="zero"></mark>');
          last = m.i + m.s.length;
        });
        view.innerHTML = html + NP.esc(t.slice(last));
        q(c, 'groups').innerHTML = r.matches.slice(0, 8).map(function (m, i) {
          var parts = m.g.map(function (g, gi) { return '$' + (gi + 1) + ' ' + (g === undefined ? '∅' : JSON.stringify(g)); });
          if (m.n) Object.keys(m.n).forEach(function (k) { parts.push(k + ' ' + JSON.stringify(m.n[k])); });
          return '<tr><th>#' + (i + 1) + ' @' + m.i + '</th><td>' + NP.esc(JSON.stringify(m.s) + (parts.length ? '  ·  ' + parts.join('  ') : '')) + '</td></tr>';
        }).join('');
        q(c, 'out').value = r.replaced === undefined ? '' : r.replaced;
        msg.textContent = r.total + (r.total === 1 ? ' match' : ' matches') + (r.total > 500 ? ' (first 500 highlighted)' : '');
      }

      function run() {
        if (!/^[dgimsuyv]*$/.test(flags.value)) { render({ error: 'flags can only be d g i m s u v y' }); return; }
        var job = { id: ++seq, pattern: pat.value, flags: flags.value, text: text.value, replace: rep.value };
        if (!window.Worker || !window.Blob) { render(rxRun(job)); return; }
        if (busy && worker) { worker.terminate(); worker = null; }
        try {
          if (!worker) {
            workerUrl = workerUrl || URL.createObjectURL(new Blob([RX_WORKER], { type: 'text/javascript' }));
            worker = new Worker(workerUrl);
            worker.onmessage = function (e) {
              if (e.data.id !== busy) return;
              busy = 0;
              clearTimeout(timer);
              render(e.data);
            };
          }
        } catch (err) {
          render(rxRun(job));
          return;
        }
        busy = job.id;
        worker.postMessage(job);
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (busy !== job.id) return;
          worker.terminate();
          worker = null;
          busy = 0;
          render({ error: 'stopped after 1 s: this pattern backtracks badly on this text' });
        }, 1000);
      }

      var debounce = 0;
      function soon() { clearTimeout(debounce); debounce = setTimeout(run, 90); }
      [pat, flags, text, rep].forEach(function (el) { el.addEventListener('input', soon); });
      run();
    }
  });

  /* =====================================================================
   * Text diff (Myers, line based)
   * ===================================================================== */
  var DIFF_LIMIT = 2000;

  // a, b: arrays of comparison keys. Returns [['=', ai, bi] | ['-', ai] | ['+', bi]] or null if too different.
  function myers(a, b) {
    var n = a.length;
    var m = b.length;
    var max = n + m;
    var off = max + 1;
    var v = new Int32Array(2 * max + 3);
    var trace = [];
    for (var d = 0; d <= max; d++) {
      if (d > DIFF_LIMIT) return null;
      trace.push(v.slice(off - d - 1, off + d + 2));
      for (var k = -d; k <= d; k += 2) {
        var x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
        var y = x - k;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        v[off + k] = x;
        if (x >= n && y >= m) return backtrack(trace, n, m);
      }
    }
    return null;
  }
  function backtrack(trace, x, y) {
    var ops = [];
    for (var d = trace.length - 1; d >= 0; d--) {
      var tv = trace[d];
      var at = function (k) { return tv[k + d + 1]; };
      var k = x - y;
      var prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
      var prevX = at(prevK);
      var prevY = prevX - prevK;
      while (x > prevX && y > prevY) { ops.push(['=', x - 1, y - 1]); x--; y--; }
      if (d > 0) ops.push(x === prevX ? ['+', y - 1] : ['-', x - 1]);
      x = prevX;
      y = prevY;
    }
    return ops.reverse();
  }
  NP.myers = myers;

  NP.tool({
    id: 'diff',
    group: 'dev',
    title: 'Text diff',
    keys: 'diff compare text lines changes config before after',
    wide: true,
    html:
      '<div class="two-col">' +
      '<textarea data-f="a" class="field mono" rows="6" spellcheck="false">interface eth0\n  address 10.0.0.2/24\n  gateway 10.0.0.1\n  mtu 1500\n  dns 1.1.1.1</textarea>' +
      '<textarea data-f="b" class="field mono" rows="6" spellcheck="false">interface eth0\n  address 10.0.0.12/24\n  gateway 10.0.0.1\n  mtu 9000\n  dns 1.1.1.1\n  dns 9.9.9.9</textarea></div>' +
      '<div class="gen-row mono"><label class="check"><input type="checkbox" data-f="ws"> ignore whitespace</label>' +
      '<label class="check"><input type="checkbox" data-f="case"> ignore case</label>' +
      '<label class="check"><input type="checkbox" data-f="all"> show all lines</label>' +
      '<span class="diff-stat" data-f="stat"></span></div>' +
      '<div class="diff mono" data-f="out"></div>',
    init: function (c) {
      var out = q(c, 'out');
      function key(line) {
        var k = line;
        if (q(c, 'ws').checked) k = k.replace(/\s+/g, ' ').trim();
        if (q(c, 'case').checked) k = k.toLowerCase();
        return k;
      }
      function row(cls, na, nb, mark, line) {
        return '<div class="dl ' + cls + '"><span class="ln">' + (na || '') + '</span><span class="ln">' + (nb || '') +
          '</span><span class="mk">' + mark + '</span><span class="tx">' + NP.esc(line) + '</span></div>';
      }
      function draw() {
        var a = q(c, 'a').value.split('\n');
        var b = q(c, 'b').value.split('\n');
        var ops = myers(a.map(key), b.map(key));
        if (!ops) { out.innerHTML = '<p class="tool-note">these are too different to diff here (over ' + DIFF_LIMIT + ' changes)</p>'; q(c, 'stat').textContent = ''; return; }
        var adds = 0;
        var dels = 0;
        var showAll = q(c, 'all').checked;
        var keep = ops.map(function () { return showAll; });
        ops.forEach(function (op, i) {
          if (op[0] === '=') return;
          op[0] === '+' ? adds++ : dels++;
          for (var j = Math.max(0, i - 3); j <= Math.min(ops.length - 1, i + 3); j++) keep[j] = true;
        });
        var html = '';
        var skipped = 0;
        ops.forEach(function (op, i) {
          if (!keep[i]) { skipped++; return; }
          if (skipped) { html += '<div class="dl gap">⋯ ' + skipped + ' unchanged</div>'; skipped = 0; }
          if (op[0] === '=') html += row('', op[1] + 1, op[2] + 1, ' ', a[op[1]]);
          else if (op[0] === '-') html += row('del', op[1] + 1, '', '−', a[op[1]]);
          else html += row('add', '', op[1] + 1, '+', b[op[1]]);
        });
        if (skipped) html += '<div class="dl gap">⋯ ' + skipped + ' unchanged</div>';
        out.innerHTML = adds + dels ? html : '<p class="tool-note">identical</p>';
        q(c, 'stat').textContent = '+' + adds + ' −' + dels;
      }
      ['a', 'b'].forEach(function (f) { q(c, f).addEventListener('input', draw); });
      ['ws', 'case', 'all'].forEach(function (f) { q(c, f).addEventListener('change', draw); });
      draw();
    }
  });

  /* =====================================================================
   * Cron
   * ===================================================================== */
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var MACROS = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
  var FIELDS = [['minute', 0, 59], ['hour', 0, 23], ['day of month', 1, 31], ['month', 1, 12, MONTHS], ['day of week', 0, 7, DAYS]];

  function cronField(str, lo, hi, names) {
    var set = [];
    var s = str.toLowerCase();
    // names count from the field's low end: jan = 1, sun = 0
    if (names) names.forEach(function (n, i) { s = s.replace(new RegExp('\\b' + n + '\\b', 'g'), String(i + lo)); });
    s.split(',').forEach(function (part) {
      var m = part.match(/^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/);
      if (!m) throw new Error('can\'t read "' + part + '"');
      var a = m[1] === '*' ? lo : parseInt(m[1], 10);
      var b = m[1] === '*' ? hi : m[2] !== undefined ? parseInt(m[2], 10) : m[3] ? hi : a;
      var step = m[3] ? parseInt(m[3], 10) : 1;
      if (a < lo || b > hi || a > b || step < 1) throw new Error('"' + part + '" is outside ' + lo + '-' + hi);
      for (var i = a; i <= b; i += step) set[i] = true;
    });
    return set;
  }

  // [values] -> "1-5" style text
  function compact(set, lo, hi, label) {
    var vals = [];
    for (var i = lo; i <= hi; i++) if (set[i]) vals.push(i);
    var out = [];
    for (var j = 0; j < vals.length; j++) {
      var start = vals[j];
      while (j + 1 < vals.length && vals[j + 1] === vals[j] + 1) j++;
      var name = label || String;
      out.push(vals[j] - start >= 2 ? name(start) + '–' + name(vals[j]) : vals[j] === start ? name(start) : name(start) + ', ' + name(vals[j]));
    }
    return out.join(', ');
  }

  function cronDescribe(f, raw) {
    var pad = function (n) { return ('0' + n).slice(-2); };
    var count = function (set) { return set.filter(Boolean).length; };
    var mins = [];
    var hours = [];
    f[0].forEach(function (v, i) { if (v) mins.push(i); });
    f[1].forEach(function (v, i) { if (v) hours.push(i); });
    var time;
    if (mins.length * hours.length <= 6 && mins.length && hours.length) {
      var t = [];
      hours.forEach(function (h) { mins.forEach(function (m) { t.push(pad(h) + ':' + pad(m)); }); });
      time = 'at ' + t.join(', ');
    } else {
      var step = raw[0].match(/^\*\/(\d+)$/);
      time = raw[0] === '*' ? 'every minute' : step ? 'every ' + step[1] + ' minutes' : 'at minute ' + compact(f[0], 0, 59);
      var hstep = raw[1].match(/^\*\/(\d+)$/);
      if (hstep) time += ', every ' + hstep[1] + ' hours';
      else if (raw[1] !== '*') time += ', ' + (count(f[1]) === 1 ? 'during hour ' : 'during hours ') + compact(f[1], 0, 23, pad);
    }
    var dayName = function (d) { return DAYS[d % 7].charAt(0).toUpperCase() + DAYS[d % 7].slice(1); };
    var monName = function (m) { return MONTHS[m - 1].charAt(0).toUpperCase() + MONTHS[m - 1].slice(1); };
    var dom = raw[2] === '*' ? '' : 'on day ' + compact(f[2], 1, 31) + ' of the month';
    var dow = raw[4] === '*' ? '' : 'on ' + compact(f[4], 0, 6, dayName);
    var day = dom && dow ? dom + ' or ' + dow : dom || dow || 'every day';
    var mon = raw[3] === '*' ? '' : ' in ' + compact(f[3], 1, 12, monName);
    return time + ', ' + day + mon;
  }

  function cronNext(f, raw, utc, count) {
    var get = function (d, what) { return d[(utc ? 'getUTC' : 'get') + what](); };
    var set = function (d, what, args) { d[(utc ? 'setUTC' : 'set') + what].apply(d, args); };
    var domStar = raw[2].charAt(0) === '*';
    var dowStar = raw[4].charAt(0) === '*';
    function dayOk(d) {
      var a = f[2][get(d, 'Date')];
      var b = f[4][get(d, 'Day')];
      if (domStar && dowStar) return true;
      if (domStar) return b;
      if (dowStar) return a;
      return a || b;
    }
    var t = new Date();
    t.setSeconds(0, 0);
    t = new Date(t.getTime() + 60000);
    var out = [];
    for (var guard = 0; out.length < count && guard < 200000; guard++) {
      if (!f[3][get(t, 'Month') + 1]) { set(t, 'Month', [get(t, 'Month') + 1, 1]); set(t, 'Hours', [0, 0, 0, 0]); continue; }
      if (!dayOk(t)) { set(t, 'Date', [get(t, 'Date') + 1]); set(t, 'Hours', [0, 0, 0, 0]); continue; }
      if (!f[1][get(t, 'Hours')]) { set(t, 'Hours', [get(t, 'Hours') + 1, 0, 0, 0]); continue; }
      if (!f[0][get(t, 'Minutes')]) { set(t, 'Minutes', [get(t, 'Minutes') + 1, 0, 0]); continue; }
      out.push(new Date(t));
      t = new Date(t.getTime() + 60000);
    }
    return out;
  }
  NP.cron = { field: cronField, describe: cronDescribe, next: cronNext };

  NP.tool({
    id: 'cron',
    group: 'dev',
    title: 'Cron explainer',
    keys: 'cron crontab schedule next run systemd timer job',
    html:
      '<label class="stack"><span class="mono">minute · hour · day · month · weekday (or @daily, @hourly…)</span>' +
      '<input data-f="in" class="field mono" type="text" value="*/15 9-17 * * mon-fri" spellcheck="false" autocapitalize="off"></label>' +
      '<p class="pitch-out mono" data-f="desc"></p>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<div class="gen-row mono"><label class="check"><input type="checkbox" data-f="utc"> server runs in UTC</label>' +
      '<span class="tool-note" data-f="tz"></span></div>',
    init: function (c) {
      var input = q(c, 'in');
      var out = q(c, 'out');
      var desc = q(c, 'desc');
      copyCells(out);
      function draw() {
        var v = input.value.trim().toLowerCase();
        var utc = q(c, 'utc').checked;
        q(c, 'tz').textContent = utc ? 'times shown in UTC' : 'times shown in ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (v === '@reboot') { desc.textContent = 'once, when the system starts'; out.innerHTML = ''; return; }
        var raw = (MACROS[v] || v).split(/\s+/);
        if (raw.length !== 5) { desc.textContent = 'needs 5 fields'; out.innerHTML = ''; return; }
        var f;
        try {
          f = raw.map(function (r, i) { return cronField(r, FIELDS[i][1], FIELDS[i][2], FIELDS[i][3]); });
        } catch (e) {
          desc.textContent = e.message;
          out.innerHTML = '';
          return;
        }
        if (f[4][7]) f[4][0] = true;
        desc.textContent = cronDescribe(f, raw);
        var runs = cronNext(f, raw, utc, 5);
        out.innerHTML = runs.length ? kv(runs.map(function (d, i) {
          var txt = utc ? d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' :
            d.toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          return [i ? 'then' : 'next', txt];
        })) : '<tr><td>never runs (no date matches)</td></tr>';
      }
      input.addEventListener('input', draw);
      q(c, 'utc').addEventListener('change', draw);
      draw();
    }
  });

  /* =====================================================================
   * Number bases
   * ===================================================================== */
  NP.tool({
    id: 'base',
    group: 'dev',
    title: 'Number bases',
    keys: 'hex binary decimal octal base convert bits bytes two\'s complement signed 14-bit msb lsb nrpn ascii',
    html:
      '<div class="base-grid">' +
      '<label><span class="mono">dec</span><input data-f="10" class="field mono" type="text" value="12345" spellcheck="false"></label>' +
      '<label><span class="mono">hex</span><input data-f="16" class="field mono" type="text" spellcheck="false"></label>' +
      '<label><span class="mono">oct</span><input data-f="8" class="field mono" type="text" spellcheck="false"></label>' +
      '<label><span class="mono">bin</span><input data-f="2" class="field mono" type="text" spellcheck="false"></label></div>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<p class="tool-note mono" data-f="msg">any size; negative decimals show their two\'s complement</p>',
    init: function (c) {
      var BASES = [10, 16, 8, 2];
      var PREFIX = { 16: '0x', 8: '0o', 2: '0b' };
      var out = q(c, 'out');
      copyCells(out);

      function parse(str, base) {
        var s = str.trim().replace(/[\s_]/g, '').toLowerCase();
        var neg = s.charAt(0) === '-';
        if (neg) s = s.slice(1);
        if (PREFIX[base] && s.indexOf(PREFIX[base]) === 0) s = s.slice(2);
        if (!s) return null;
        var digits = { 10: /^\d+$/, 16: /^[0-9a-f]+$/, 8: /^[0-7]+$/, 2: /^[01]+$/ }[base];
        if (!digits.test(s)) return null;
        var v = base === 10 ? BigInt(s) : BigInt(PREFIX[base] + s);
        return neg ? -v : v;
      }

      function group(str, n, sep) {
        var outStr = '';
        for (var i = str.length; i > 0; i -= n) outStr = str.slice(Math.max(0, i - n), i) + (outStr ? sep + outStr : '');
        return outStr;
      }

      function draw(from) {
        var v = parse(q(c, String(from)).value, from);
        if (v === null) { out.innerHTML = ''; return; }
        var width = 8;
        var abs = v < 0n ? -v : v;
        while (width < 512 && (v < 0n ? abs > 1n << BigInt(width - 1) : abs >= 1n << BigInt(width))) width *= 2;
        var bits = v < 0n ? (1n << BigInt(width)) + v : v;
        BASES.forEach(function (b) {
          if (b !== from) q(c, String(b)).value = (v < 0n && b !== 10 ? bits : v).toString(b);
        });
        var rows = [];
        var hx = bits.toString(16);
        if (hx.length % 2) hx = '0' + hx;
        rows.push(['bytes', group(hx.toUpperCase(), 2, ' ')]);
        rows.push(['bits', group(bits.toString(2).padStart(width, '0'), 4, ' ') + (v < 0n ? '  (' + width + '-bit)' : '')]);
        if (v >= 0n && v < 256n) rows.push(['as int8', String(v > 127n ? v - 256n : v)]);
        else if (v >= 0n && v < 65536n) rows.push(['as int16', String(v > 32767n ? v - 65536n : v)]);
        else if (v >= 0n && v < 4294967296n) rows.push(['as int32', String(v > 2147483647n ? v - 4294967296n : v)]);
        if (v >= 0n && v < 16384n) {
          var n = Number(v);
          rows.push(['MIDI 14-bit', 'MSB ' + (n >> 7) + ' · LSB ' + (n & 127) + '  (pitch bend ' + (n - 8192 > 0 ? '+' : '') + (n - 8192) + ')']);
        }
        if (v >= 32n && v <= 0x10ffffn && !(v >= 0xd800n && v <= 0xdfffn)) {
          rows.push(['character', String.fromCodePoint(Number(v)) + '  U+' + v.toString(16).toUpperCase().padStart(4, '0')]);
        }
        out.innerHTML = kv(rows);
      }

      BASES.forEach(function (b) { q(c, String(b)).addEventListener('input', function () { draw(b); }); });
      draw(10);
    }
  });

  /* =====================================================================
   * Text: case, slug, lines, counts
   * ===================================================================== */
  function words(s) {
    return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^A-Za-z0-9À-ɏ]+/).filter(Boolean);
  }
  function perLine(fn) { return function (s) { return s.split('\n').map(fn).join('\n'); }; }
  var TEXT_OPS = [
    ['UPPER', function (s) { return s.toUpperCase(); }],
    ['lower', function (s) { return s.toLowerCase(); }],
    ['Title', function (s) { return s.toLowerCase().replace(/(^|[\s(["'\-/])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }],
    ['Sentence', function (s) { return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }],
    ['camel', perLine(function (l) { return words(l).map(function (w, i) { w = w.toLowerCase(); return i ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(''); })],
    ['Pascal', perLine(function (l) { return words(l).map(function (w) { w = w.toLowerCase(); return w.charAt(0).toUpperCase() + w.slice(1); }).join(''); })],
    ['snake', perLine(function (l) { return words(l).join('_').toLowerCase(); })],
    ['kebab', perLine(function (l) { return words(l).join('-').toLowerCase(); })],
    ['CONST', perLine(function (l) { return words(l).join('_').toUpperCase(); })],
    ['slug', perLine(function (l) {
      return l.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    })],
    ['sort', function (s) { return s.split('\n').sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).join('\n'); }],
    ['unique', function (s) { var seen = {}; return s.split('\n').filter(function (l) { return seen[l] ? false : (seen[l] = true); }).join('\n'); }],
    ['reverse', function (s) { return s.split('\n').reverse().join('\n'); }],
    ['trim', function (s) { return s.split('\n').map(function (l) { return l.trim(); }).filter(function (l, i, all) { return l || (i && all[i - 1]); }).join('\n').trim(); }]
  ];

  NP.tool({
    id: 'text',
    group: 'dev',
    title: 'Case, slug & lines',
    keys: 'text case convert camelcase snake kebab slug uppercase lowercase title sort lines unique dedupe count words characters bytes',
    html:
      '<textarea data-f="in" class="field mono" rows="4" spellcheck="false">NOPHASE release notes\nparseControlChange\nsnapshot_recall_on_the_one</textarea>' +
      '<div class="btn-row mono">' + TEXT_OPS.map(function (o, i) {
        return '<button type="button" class="step-btn" data-op="' + i + '">' + o[0] + '</button>';
      }).join('') + '<button type="button" class="step-btn" data-f="undo" disabled>undo</button>' +
      '<button type="button" class="step-btn" data-f="copy">copy</button></div>' +
      '<p class="tool-note mono" data-f="stats"></p>',
    init: function (c) {
      var inp = q(c, 'in');
      var undo = q(c, 'undo');
      var history = [];
      function stats() {
        var v = inp.value;
        var w = v.trim() ? v.trim().split(/\s+/).length : 0;
        q(c, 'stats').textContent = Array.from(v).length + ' chars · ' + w + ' words · ' + (v ? v.split('\n').length : 0) +
          ' lines · ' + new TextEncoder().encode(v).length + ' bytes UTF-8';
      }
      c.querySelector('.btn-row').addEventListener('click', function (e) {
        var b = e.target.closest('[data-op]');
        if (!b) return;
        history.push(inp.value);
        if (history.length > 30) history.shift();
        inp.value = TEXT_OPS[parseInt(b.getAttribute('data-op'), 10)][1](inp.value);
        undo.disabled = false;
        stats();
      });
      undo.addEventListener('click', function () {
        if (history.length) inp.value = history.pop();
        undo.disabled = !history.length;
        stats();
      });
      q(c, 'copy').addEventListener('click', function (e) { NP.copy(inp.value, e.currentTarget); });
      inp.addEventListener('input', stats);
      stats();
    }
  });

  /* =====================================================================
   * chmod
   * ===================================================================== */
  NP.tool({
    id: 'chmod',
    group: 'dev',
    title: 'chmod calculator',
    keys: 'chmod permissions unix linux octal rwx 755 644 setuid setgid sticky',
    html:
      '<table class="perm-grid mono"><thead><tr><th></th><th>read</th><th>write</th><th>exec</th><th></th></tr></thead><tbody>' +
      [['owner', 'setuid', 4], ['group', 'setgid', 2], ['other', 'sticky', 1]].map(function (r, ri) {
        return '<tr><th>' + r[0] + '</th>' + [4, 2, 1].map(function (bit) {
          return '<td><input type="checkbox" data-r="' + ri + '" data-b="' + bit + '" aria-label="' + r[0] + ' ' + bit + '"></td>';
        }).join('') + '<td><label class="check"><input type="checkbox" data-s="' + r[2] + '"> ' + r[1] + '</label></td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="gen-row mono"><label class="ref">octal <input data-f="oct" class="field field-sm" type="text" value="755" maxlength="4"></label>' +
      ['644', '755', '600', '700', '775', '1777'].map(function (p) { return '<button type="button" class="step-btn" data-p="' + p + '">' + p + '</button>'; }).join('') +
      '</div><table class="kv mono" data-f="out"></table>',
    init: function (c) {
      var oct = q(c, 'oct');
      var out = q(c, 'out');
      copyCells(out);
      var boxes = [].slice.call(c.querySelectorAll('[data-r]'));
      var special = [].slice.call(c.querySelectorAll('[data-s]'));

      function value() {
        var v = [0, 0, 0];
        boxes.forEach(function (b) { if (b.checked) v[+b.getAttribute('data-r')] += +b.getAttribute('data-b'); });
        var s = 0;
        special.forEach(function (b) { if (b.checked) s += +b.getAttribute('data-s'); });
        return { s: s, v: v };
      }
      function show(skipOct) {
        var p = value();
        var str = (p.s ? p.s : '') + p.v.join('');
        if (!skipOct) oct.value = str;
        var sym = p.v.map(function (n, i) {
          var x = n & 1;
          var flag = [4, 2, 1][i] & p.s;
          var xc = flag ? (i === 2 ? (x ? 't' : 'T') : (x ? 's' : 'S')) : (x ? 'x' : '-');
          return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + xc;
        }).join('');
        var who = ['u', 'g', 'o'];
        var symbolic = p.v.map(function (n, i) {
          return who[i] + '=' + (n & 4 ? 'r' : '') + (n & 2 ? 'w' : '') + (n & 1 ? 'x' : '');
        }).join(',');
        if (p.s) symbolic += ',' + [p.s & 4 ? 'u+s' : '', p.s & 2 ? 'g+s' : '', p.s & 1 ? '+t' : ''].filter(Boolean).join(',');
        out.innerHTML = kv([['ls -l', '-' + sym], ['command', 'chmod ' + str + ' file'], ['symbolic', 'chmod ' + symbolic + ' file']]);
      }
      function fromOctal(v) {
        if (!/^[0-7]{3,4}$/.test(v)) return;
        var d = v.length === 4 ? v : '0' + v;
        special.forEach(function (b) { b.checked = !!(+d[0] & +b.getAttribute('data-s')); });
        boxes.forEach(function (b) { b.checked = !!(+d[1 + +b.getAttribute('data-r')] & +b.getAttribute('data-b')); });
        show(true);
      }
      c.addEventListener('change', function (e) { if (e.target.type === 'checkbox') show(); });
      oct.addEventListener('input', function () { fromOctal(oct.value.trim()); });
      c.querySelector('.gen-row').addEventListener('click', function (e) {
        var b = e.target.closest('[data-p]');
        if (b) { oct.value = b.getAttribute('data-p'); fromOctal(oct.value); }
      });
      fromOctal('755');
    }
  });
})();
