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
    group: 'dev',
    title: 'Subnet calculator',
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
    group: 'dev',
    title: 'Encode / decode',
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
    group: 'dev',
    title: 'Hash',
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
    group: 'dev',
    title: 'UUID & password',
    html:
      '<div class="gen-row"><button type="button" class="step-btn mono" data-f="uuid">new UUID</button>' +
      '<button type="button" class="cell gen-out mono" data-f="uuidout" title="click to copy"></button></div>' +
      '<div class="gen-row"><label class="mono ref">length <input data-f="len" class="field field-sm mono" type="number" min="8" max="128" value="24"></label>' +
      '<label class="check mono"><input type="checkbox" data-f="sym" checked> symbols</label>' +
      '<button type="button" class="step-btn mono" data-f="pw">new password</button></div>' +
      '<button type="button" class="cell gen-out mono" data-f="pwout" title="click to copy"></button>' +
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
        var buf = new Uint32Array(len);
        crypto.getRandomValues(buf);
        var s = '';
        for (var i = 0; i < len; i++) s += set[buf[i] % set.length];
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
    group: 'dev',
    title: 'Common ports',
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
})();
