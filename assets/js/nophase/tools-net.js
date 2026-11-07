/* NOPHASE browser tools: network and security. Needs tools-core.js. */
(function () {
  'use strict';

  var NP = window.NP;
  if (!NP) return;
  var q = NP.q;

  function kv(rows) {
    return rows.map(function (r) {
      return '<tr><th>' + r[0] + '</th><td><button type="button" class="cell" data-copy="' + NP.esc(r[1]) + '">' +
        NP.esc(r[1]) + '</button></td></tr>';
    }).join('');
  }
  function copyCells(el) {
    el.addEventListener('click', function (e) {
      var cell = e.target.closest('.cell');
      if (cell) NP.copy(cell.getAttribute('data-copy'), cell);
    });
  }
  function filterRows(card, input) {
    var rows = [].slice.call(card.querySelectorAll('tbody tr'));
    input.addEventListener('input', function () {
      var v = input.value.trim().toLowerCase();
      rows.forEach(function (r) { r.hidden = !!v && r.textContent.toLowerCase().indexOf(v) === -1; });
    });
  }

  /* =====================================================================
   * IPv6
   * ===================================================================== */
  // "2001:db8::1" -> [8 x 16-bit numbers] or null. Accepts a trailing IPv4.
  function parse6(str) {
    var s = str.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
    var v4 = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (v4) {
      var o = v4[2].split('.').map(Number);
      if (o.some(function (x) { return x > 255; })) return null;
      s = v4[1] + ((o[0] << 8) | o[1]).toString(16) + ':' + ((o[2] << 8) | o[3]).toString(16);
    }
    var halves = s.split('::');
    if (halves.length > 2) return null;
    function groups(part) { return part ? part.split(':') : []; }
    var head = groups(halves[0]);
    var tail = halves.length === 2 ? groups(halves[1]) : [];
    var fill = 8 - head.length - tail.length;
    if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
    var all = head.concat(new Array(halves.length === 2 ? fill : 0).fill('0'), tail);
    var out = [];
    for (var i = 0; i < 8; i++) {
      if (!/^[0-9a-f]{1,4}$/i.test(all[i])) return null;
      out.push(parseInt(all[i], 16));
    }
    return out;
  }

  // RFC 5952: lowercase, no leading zeros, longest run (2+) of zero groups -> ::
  function compress6(g) {
    var best = -1, bestLen = 0, cur = -1, len = 0;
    for (var i = 0; i < 8; i++) {
      if (g[i] === 0) {
        if (cur < 0) { cur = i; len = 0; }
        len++;
        if (len > bestLen) { best = cur; bestLen = len; }
      } else cur = -1;
    }
    var hexes = g.map(function (x) { return x.toString(16); });
    if (bestLen < 2) return hexes.join(':');
    return hexes.slice(0, best).join(':') + '::' + hexes.slice(best + bestLen).join(':');
  }
  function expand6(g) { return g.map(function (x) { return ('000' + x.toString(16)).slice(-4); }).join(':'); }
  function mask6(g, prefix, hostBits) {
    return g.map(function (x, i) {
      var bits = NP.clamp(prefix - i * 16, 0, 16);
      var m = bits === 0 ? 0 : (0xffff << (16 - bits)) & 0xffff;
      return hostBits ? (x & m) | (~m & 0xffff) : x & m;
    });
  }
  var TYPES6 = [
    ['::1', 128, 'loopback'], ['::', 128, 'unspecified'], ['::ffff:0:0', 96, 'IPv4-mapped'],
    ['64:ff9b::', 96, 'NAT64 (well-known prefix)'], ['2001:db8::', 32, 'documentation'],
    ['2001::', 32, 'Teredo'], ['2002::', 16, '6to4'], ['fe80::', 10, 'link-local'],
    ['fc00::', 7, 'unique local (ULA, private)'], ['ff00::', 8, 'multicast'], ['2000::', 3, 'global unicast']
  ];
  function type6(g) {
    for (var i = 0; i < TYPES6.length; i++) {
      var t = TYPES6[i];
      if (expand6(mask6(g, t[1])) === expand6(mask6(parse6(t[0]), t[1]))) return t[2];
    }
    return 'reserved / other';
  }

  NP.tool({
    id: 'ipv6',
    group: 'net',
    title: 'IPv6 expand / compress',
    keys: 'ipv6 v6 address prefix expand compress ula link local reverse arpa ptr',
    html:
      '<label class="stack"><span class="mono">IPv6 address, optional /prefix</span>' +
      '<input data-f="in" class="field mono" type="text" value="2001:db8:0:0:8a2e::7334/64" spellcheck="false" autocapitalize="off"></label>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var input = q(c, 'in');
      var out = q(c, 'out');
      var msg = q(c, 'msg');
      copyCells(out);
      function draw() {
        var m = input.value.trim().match(/^([^/\s]+)(?:\s*\/\s*(\d{1,3}))?$/);
        var g = m && parse6(m[1]);
        var prefix = m && m[2] !== undefined ? parseInt(m[2], 10) : null;
        if (!g || (prefix !== null && prefix > 128)) {
          out.innerHTML = '';
          msg.textContent = 'enter something like fe80::1 or 2001:db8::/48';
          return;
        }
        var rows = [['compressed', compress6(g)], ['expanded', expand6(g)]];
        if (prefix !== null) {
          rows.push(['network', compress6(mask6(g, prefix)) + '/' + prefix]);
          rows.push(['first', compress6(mask6(g, prefix))]);
          rows.push(['last', compress6(mask6(g, prefix, true))]);
          var host = 128 - prefix;
          rows.push(['addresses', host <= 52 ? Math.pow(2, host).toLocaleString() : '2^' + host]);
          if (prefix <= 64 && prefix % 4 === 0) rows.push(['/64 subnets', prefix === 64 ? '1' : '2^' + (64 - prefix)]);
        }
        if (expand6(g).indexOf('0000:0000:0000:0000:0000:ffff') === 0) {
          rows.push(['IPv4', [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.')]);
        }
        rows.push(['reverse', expand6(g).replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa']);
        out.innerHTML = kv(rows);
        msg.textContent = type6(g);
      }
      input.addEventListener('input', draw);
      draw();
    }
  });

  /* =====================================================================
   * Data rate & transfer time
   * ===================================================================== */
  var SIZE = [['B', 1], ['KB', 1e3], ['MB', 1e6], ['GB', 1e9], ['TB', 1e12], ['KiB', 1024], ['MiB', 1048576],
    ['GiB', 1073741824], ['TiB', 1099511627776]];
  var RATE = [['Kbps', 1e3], ['Mbps', 1e6], ['Gbps', 1e9], ['KB/s', 8e3], ['MB/s', 8e6], ['GB/s', 8e9]];
  function opts(list, sel) {
    return list.map(function (u) { return '<option value="' + u[1] + '"' + (u[0] === sel ? ' selected' : '') + '>' + u[0] + '</option>'; }).join('');
  }
  function duration(s) {
    if (!isFinite(s)) return '';
    if (s < 1) return (s * 1000).toFixed(0) + ' ms';
    var d = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = Math.round(s % 60);
    return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + (d || h || m ? m + 'm ' : '') + sec + 's';
  }
  function bytes(n) {
    var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var i = 0;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    return NP.fmt(n, 4) + ' ' + units[i];
  }

  NP.tool({
    id: 'rate',
    group: 'net',
    title: 'Transfer time & bandwidth',
    keys: 'bandwidth transfer time download upload speed mbps megabytes gigabit throughput data rate',
    html:
      '<div class="conv">' +
      '<div class="unit-row"><label><span class="mono">file size</span><input data-f="size" class="field mono" type="number" min="0" step="any" value="50"></label>' +
      '<select data-f="sunit" class="field field-sm mono" aria-label="Size unit">' + opts(SIZE, 'GB') + '</select></div>' +
      '<div class="unit-row"><label><span class="mono">link speed</span><input data-f="rate" class="field mono" type="number" min="0" step="any" value="500"></label>' +
      '<select data-f="runit" class="field field-sm mono" aria-label="Rate unit">' + opts(RATE, 'Mbps') + '</select></div>' +
      '<label class="conv-sr mono">real-world efficiency <input data-f="eff" class="field field-sm mono" type="number" min="1" max="100" value="90"> %</label>' +
      '</div>' +
      '<table class="kv mono" data-f="out"></table>',
    init: function (c) {
      var out = q(c, 'out');
      copyCells(out);
      function draw() {
        var size = parseFloat(q(c, 'size').value) * parseFloat(q(c, 'sunit').value);
        var bps = parseFloat(q(c, 'rate').value) * parseFloat(q(c, 'runit').value);
        var eff = NP.clamp(parseFloat(q(c, 'eff').value) || 100, 1, 100) / 100;
        if (!(size >= 0) || !(bps > 0)) { out.innerHTML = ''; return; }
        var real = bps * eff;
        out.innerHTML = kv([
          ['transfer time', duration((size * 8) / real)],
          ['at line rate', duration((size * 8) / bps)],
          ['throughput', NP.fmt(real / 8e6, 4) + ' MB/s · ' + NP.fmt(real / 1e6, 4) + ' Mbps'],
          ['per hour', bytes((real / 8) * 3600)],
          ['per day', bytes((real / 8) * 86400)],
          ['per month', bytes((real / 8) * 86400 * 30)]
        ]);
      }
      ['size', 'sunit', 'rate', 'runit', 'eff'].forEach(function (f) { q(c, f).addEventListener('input', draw); });
      draw();
    }
  });

  /* =====================================================================
   * MAC address
   * ===================================================================== */
  NP.tool({
    id: 'mac',
    group: 'net',
    title: 'MAC address',
    keys: 'mac address format cisco colon dash eui-64 link local oui random locally administered',
    head: '<button type="button" class="step-btn mono" data-f="rand" title="Random locally administered unicast MAC">random</button>',
    html:
      '<label class="stack"><span class="mono">any format: aa:bb:cc… aa-bb-cc… aabb.ccdd.eeff</span>' +
      '<input data-f="in" class="field mono" type="text" value="3C:22:FB:12:34:56" spellcheck="false" autocapitalize="off"></label>' +
      '<table class="kv mono" data-f="out"></table>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var input = q(c, 'in');
      var out = q(c, 'out');
      var msg = q(c, 'msg');
      copyCells(out);
      function draw() {
        var hex = input.value.replace(/[^0-9a-f]/gi, '').toLowerCase();
        if (hex.length !== 12) { out.innerHTML = ''; msg.textContent = 'needs 12 hex digits'; return; }
        var o = hex.match(/../g);
        var first = parseInt(o[0], 16);
        var eui = [first ^ 2].concat(o.slice(1, 3).map(function (x) { return parseInt(x, 16); }), [0xff, 0xfe],
          o.slice(3).map(function (x) { return parseInt(x, 16); }));
        var groups = [];
        for (var i = 0; i < 8; i += 2) groups.push(((eui[i] << 8) | eui[i + 1]).toString(16));
        out.innerHTML = kv([
          ['colon', o.join(':')], ['upper', o.join(':').toUpperCase()], ['dash', o.join('-').toUpperCase()],
          ['cisco', hex.match(/.{4}/g).join('.')], ['bare', hex], ['OUI', o.slice(0, 3).join(':').toUpperCase()],
          ['EUI-64 link-local', 'fe80::' + groups.join(':').replace(/(^|:)0+(?=[0-9a-f])/g, '$1')]
        ]);
        msg.textContent = (first & 1 ? 'multicast' : 'unicast') + ' · ' +
          (first & 2 ? 'locally administered (random or virtual, no vendor)' : 'universally administered (vendor OUI)');
      }
      q(c, 'rand').addEventListener('click', function () {
        var b = crypto.getRandomValues(new Uint8Array(6));
        b[0] = (b[0] & 0xfc) | 0x02;
        input.value = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(':');
        draw();
      });
      input.addEventListener('input', draw);
      draw();
    }
  });

  /* =====================================================================
   * DNS lookup (DNS over HTTPS, JSON API)
   * ===================================================================== */
  var RR = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 43: 'DS',
    46: 'RRSIG', 48: 'DNSKEY', 64: 'SVCB', 65: 'HTTPS', 257: 'CAA' };
  var RCODE = ['NOERROR', 'FORMERR', 'SERVFAIL', 'NXDOMAIN', 'NOTIMP', 'REFUSED'];
  var RESOLVERS = {
    cloudflare: function (name, type) { return 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(name) + '&type=' + type; },
    google: function (name, type) { return 'https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + type; }
  };
  var ALL = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'CAA', 'SOA'];

  function reverseName(s) {
    var v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) return [v4[4], v4[3], v4[2], v4[1]].join('.') + '.in-addr.arpa';
    var g = s.indexOf(':') !== -1 && parse6(s);
    if (g) return expand6(g).replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa';
    return null;
  }

  NP.tool({
    id: 'dns',
    group: 'net',
    title: 'DNS lookup',
    keys: 'dns lookup dig nslookup resolve a aaaa mx txt ns cname caa soa ptr reverse doh dnssec spf dmarc email',
    wide: true,
    html:
      '<div class="dns-row">' +
      '<input data-f="name" class="field mono" type="text" value="nophase.cc" spellcheck="false" autocapitalize="off" aria-label="Domain or IP">' +
      '<select data-f="type" class="field field-sm mono" aria-label="Record type"><option>ALL</option>' +
      ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'CAA', 'SOA', 'SRV', 'PTR', 'HTTPS', 'DS', 'DNSKEY'].map(function (t) { return '<option>' + t + '</option>'; }).join('') +
      '</select>' +
      '<select data-f="via" class="field field-sm mono" aria-label="Resolver"><option value="cloudflare">1.1.1.1</option><option value="google">8.8.8.8</option></select>' +
      '<button type="button" class="tap-btn mono" data-f="go">LOOK UP</button></div>' +
      '<div class="ref-scroll"><table class="ref-table dns-table mono" data-f="out"></table></div>' +
      '<p class="tool-note mono" data-f="msg">This one does use the network: it sends the name (and nothing else) to the resolver you pick, over HTTPS. An IP looks up its PTR.</p>',
    init: function (c) {
      var name = q(c, 'name');
      var type = q(c, 'type');
      var out = q(c, 'out');
      var msg = q(c, 'msg');
      var seq = 0;

      function ask(n, t) {
        return fetch(RESOLVERS[q(c, 'via').value](n, t), { headers: { accept: 'application/dns-json' }, cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      }

      function run() {
        var raw = name.value.trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/\.$/, '');
        if (!raw) return;
        var rev = reverseName(raw);
        var n = rev || raw;
        var types = rev ? ['PTR'] : type.value === 'ALL' ? ALL : [type.value];
        var queries = types.map(function (t) { return [n, t]; });
        // ALL also checks the mail-auth records that live on other names
        if (!rev && type.value === 'ALL') queries.push(['_dmarc.' + n, 'TXT']);
        var id = ++seq;
        msg.textContent = 'asking ' + q(c, 'via').selectedOptions[0].textContent + ' for ' + n + ' …';
        Promise.all(queries.map(function (x) {
          return ask(x[0], x[1]).then(function (j) { return { t: x[1], j: j }; }, function (e) { return { t: x[1], err: e.message }; });
        })).then(function (res) {
          if (id !== seq) return;
          var rows = [];
          var status = '';
          var secure = false;
          res.forEach(function (r, i) {
            if (r.err) { rows.push('<tr><td>' + r.t + '</td><td class="bad">' + NP.esc(r.err) + '</td></tr>'); return; }
            // the overall status is the main name's; a missing _dmarc record is not an NXDOMAIN for it
            if (i === 0 || !status) status = RCODE[r.j.Status] || 'rcode ' + r.j.Status;
            secure = secure || !!r.j.AD;
            (r.j.Answer || []).forEach(function (a) {
              rows.push('<tr><td>' + (RR[a.type] || a.type) + '</td><td><button type="button" class="cell" data-copy="' +
                NP.esc(a.data) + '">' + NP.esc(a.data) + '</button><span class="dim"> ' + NP.esc(a.name) + ' · ttl ' + a.TTL + '</span></td></tr>');
            });
          });
          out.innerHTML = rows.join('') || '<tr><td>—</td><td>no records</td></tr>';
          var mail = '';
          if (!rev && type.value === 'ALL') {
            var txt = rows.join(' ');
            mail = ' · SPF ' + (/v=spf1/i.test(txt) ? '✓' : '✗') + ' · DMARC ' + (/v=DMARC1/i.test(txt) ? '✓' : '✗');
          }
          msg.textContent = n + ' · ' + status + (secure ? ' · DNSSEC validated' : '') + ' · ' + rows.length + ' records' + mail;
        });
      }

      copyCells(out);
      q(c, 'go').addEventListener('click', run);
      name.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    }
  });

  /* =====================================================================
   * HTTP status codes
   * ===================================================================== */
  var HTTP = [
    [100, 'Continue'], [101, 'Switching Protocols (WebSocket upgrade)'], [103, 'Early Hints'],
    [200, 'OK'], [201, 'Created'], [202, 'Accepted (queued)'], [204, 'No Content'], [206, 'Partial Content (range request)'],
    [301, 'Moved Permanently (may switch POST to GET)'], [302, 'Found (temporary redirect)'], [303, 'See Other (go GET this)'],
    [304, 'Not Modified (use your cache)'], [307, 'Temporary Redirect (keeps method)'], [308, 'Permanent Redirect (keeps method)'],
    [400, 'Bad Request'], [401, 'Unauthorized (not logged in)'], [403, 'Forbidden (logged in, still no)'], [404, 'Not Found'],
    [405, 'Method Not Allowed'], [406, 'Not Acceptable'], [408, 'Request Timeout'], [409, 'Conflict'], [410, 'Gone'],
    [411, 'Length Required'], [412, 'Precondition Failed'], [413, 'Content Too Large'], [414, 'URI Too Long'],
    [415, 'Unsupported Media Type'], [416, 'Range Not Satisfiable'], [418, "I'm a teapot"], [421, 'Misdirected Request'],
    [422, 'Unprocessable Content (validation)'], [425, 'Too Early'], [426, 'Upgrade Required'], [428, 'Precondition Required'],
    [429, 'Too Many Requests (rate limited)'], [431, 'Request Header Fields Too Large'], [451, 'Unavailable For Legal Reasons'],
    [500, 'Internal Server Error'], [501, 'Not Implemented'], [502, 'Bad Gateway (upstream sent garbage)'],
    [503, 'Service Unavailable (down or overloaded)'], [504, 'Gateway Timeout (upstream too slow)'],
    [505, 'HTTP Version Not Supported'], [507, 'Insufficient Storage'], [511, 'Network Authentication Required (captive portal)'],
    [520, 'Cloudflare: unknown origin error'], [521, 'Cloudflare: origin refused connection'],
    [522, 'Cloudflare: origin connection timed out'], [523, 'Cloudflare: origin unreachable'],
    [524, 'Cloudflare: origin response timed out'], [525, 'Cloudflare: origin TLS handshake failed'],
    [526, 'Cloudflare: invalid origin certificate']
  ];
  NP.tool({
    id: 'http',
    group: 'net',
    title: 'HTTP status codes',
    keys: 'http status codes response error 404 500 502 503 redirect 301 cloudflare',
    head: '<input data-f="filter" class="field field-sm mono" type="search" placeholder="filter" aria-label="Filter status codes">',
    html: '<div class="ref-scroll"><table class="ref-table mono"><tbody>' +
      HTTP.map(function (h) { return '<tr><td>' + h[0] + '</td><td>' + NP.esc(h[1]) + '</td></tr>'; }).join('') +
      '</tbody></table></div>',
    init: function (c) { filterRows(c, q(c, 'filter')); }
  });

  /* =====================================================================
   * IOC extractor, defang / refang
   * ===================================================================== */
  function refang(s) {
    return s
      .replace(/\bhxxp(s?)/gi, 'http$1')
      .replace(/\bfxp\b/gi, 'ftp')
      .replace(/\[:\/\/\]|\[:\]\/\//g, '://')
      .replace(/\[(?:\.|dot)\]|\((?:\.|dot)\)|\{(?:\.|dot)\}|\s\[dot\]\s/gi, '.')
      .replace(/\[(?:@|at)\]|\((?:@|at)\)/gi, '@')
      .replace(/\[:\]/g, ':');
  }
  function defangHost(h) { return h.replace(/\./g, '[.]'); }
  function defang(s) {
    return s
      .replace(/\b(?:https?|ftp):\/\/[^\s"'<>]+/gi, function (u) {
        var m = u.match(/^(\w+):\/\/([^/?#]+)(.*)$/);
        return m[1].replace(/^http/i, 'hxxp').replace(/^ftp/i, 'fxp') + '[://]' + defangHost(m[2]) + m[3];
      })
      .replace(/\b[\w.+-]+@([a-z0-9-]+\.)+[a-z]{2,24}\b/gi, function (e) { return e.replace('@', '[@]').replace(/\.(?=[^@]*$)/g, '[.]'); })
      .replace(/(^|[^\w.[\]/@-])((?:\d{1,3}\.){3}\d{1,3})(?![\w.])/g, function (all, pre, ip) { return pre + defangHost(ip); })
      .replace(/(^|[^\w.[\]/@-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?![\w-]|\[)/gi, function (all, pre, d) {
        return NOT_TLD.test(d) ? all : pre + defangHost(d);
      });
  }

  var IOC = [
    ['url', 'URLs', /\b(?:https?|ftp):\/\/[^\s"'<>()[\]]+/gi],
    ['email', 'Emails', /\b[\w.+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,24}\b/gi],
    ['ipv4', 'IPv4', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
    ['ipv6', 'IPv6', /(?:^|[^\w:])((?:[0-9a-f]{1,4}:){2,7}(?::|[0-9a-f]{1,4})|(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}:?){0,5}[0-9a-f]{0,4})(?![\w:])/gi],
    ['domain', 'Domains', /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24})\b/gi],
    ['sha256', 'SHA-256', /\b[a-f0-9]{64}\b/gi],
    ['sha1', 'SHA-1', /\b[a-f0-9]{40}\b/gi],
    ['md5', 'MD5', /\b[a-f0-9]{32}\b/gi],
    ['cve', 'CVEs', /\bCVE-\d{4}-\d{4,}\b/gi],
    ['attack', 'ATT&CK', /\bT1\d{3}(?:\.\d{3})?\b/g]
  ];
  // file names that look like domains
  var NOT_TLD = /\.(?:exe|dll|sys|bat|ps1|vbs|js|json|txt|log|zip|rar|7z|gz|tar|pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|svg|html?|php|aspx?|py|rb|sh|md|csv|xml|yml|yaml|ini|cfg|conf|tmp|bak|dat|bin|iso|img|msi|lnk|jar)$/i;
  var LOOKUP = {
    ipv4: function (v) { return 'https://www.abuseipdb.com/check/' + v; },
    ipv6: function (v) { return 'https://www.abuseipdb.com/check/' + v; },
    domain: function (v) { return 'https://urlscan.io/domain/' + v; },
    url: function (v) { return 'https://www.virustotal.com/gui/search/' + encodeURIComponent(encodeURIComponent(v)); },
    sha256: function (v) { return 'https://www.virustotal.com/gui/file/' + v; },
    sha1: function (v) { return 'https://www.virustotal.com/gui/file/' + v; },
    md5: function (v) { return 'https://www.virustotal.com/gui/file/' + v; },
    cve: function (v) { return 'https://www.cve.org/CVERecord?id=' + v.toUpperCase(); },
    attack: function (v) { return 'https://attack.mitre.org/techniques/' + v.replace('.', '/') + '/'; }
  };

  function extract(text) {
    var clean = refang(text);
    var seen = {};
    var found = {};
    var urlHosts = {};
    IOC.forEach(function (d) {
      var list = [];
      clean.replace(d[2], function (m, g1) {
        var v = (d[0] === 'ipv6' ? g1 : m).replace(/[.,;:]+$/, '');
        if (d[0] === 'url') {
          var host = v.match(/^\w+:\/\/([^/?#:]+)/);
          if (host) urlHosts[host[1].toLowerCase()] = 1;
        }
        if (d[0] === 'domain' && (NOT_TLD.test(v) || /^\d+(\.\d+)+$/.test(v))) return m;
        if (d[0] === 'ipv6') {
          // times (12:30:45) and MACs look similar; keep only real addresses
          var g = parse6(v);
          if (!g) return m;
          v = compress6(g);
        }
        var key = d[0] + '|' + v.toLowerCase();
        if (!seen[key]) { seen[key] = 1; list.push(v); }
        return m;
      });
      found[d[0]] = list;
    });
    // emails and URLs already carry their domains; keep the list to new ones
    found.email.forEach(function (e) { urlHosts[e.split('@')[1].toLowerCase()] = 1; });
    found.domain = found.domain.filter(function (d) { return !urlHosts[d.toLowerCase()]; });
    return found;
  }

  NP.tool({
    id: 'ioc',
    group: 'sec',
    title: 'IOC extractor & defang',
    keys: 'ioc indicators extract defang refang hxxp phishing ip domain hash url threat intel soc',
    wide: true,
    html:
      '<textarea data-f="in" class="field mono" rows="5" spellcheck="false" placeholder="paste an alert, email, report or log">' +
      'Beacon to hxxps://evil-cdn[.]example/update.php from 10.20.30.40, then 203.0.113[.]7.\n' +
      'Dropper payload.exe sha256 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 (CVE-2024-3400, T1059.001)\n' +
      'Reply-to: billing@pay-invoices.example</textarea>' +
      '<div class="gen-row mono"><div class="seg" data-f="mode"><button type="button" class="seg-btn active" data-v="extract">extract</button>' +
      '<button type="button" class="seg-btn" data-v="defang">defang text</button><button type="button" class="seg-btn" data-v="refang">refang text</button></div>' +
      '<label class="check" data-f="dfwrap"><input type="checkbox" data-f="df" checked> defang results</label>' +
      '<button type="button" class="step-btn" data-f="copy">copy</button></div>' +
      '<div class="ioc-out mono" data-f="out"></div>' +
      '<p class="tool-note mono">Runs in this tab. The small links open a lookup on that site only when you click them.</p>',
    init: function (c) {
      var inp = q(c, 'in');
      var out = q(c, 'out');
      var mode = 'extract';
      var text = '';

      function draw() {
        q(c, 'dfwrap').hidden = mode !== 'extract';
        if (mode !== 'extract') {
          text = mode === 'defang' ? defang(refang(inp.value)) : refang(inp.value);
          out.innerHTML = '<pre class="ioc-text">' + NP.esc(text) + '</pre>';
          return;
        }
        var df = q(c, 'df').checked;
        var found = extract(inp.value);
        var lines = [];
        var html = IOC.map(function (d) {
          var list = found[d[0]];
          if (!list.length) return '';
          var shown = list.map(function (v) { return df && /^(url|email|ipv4|domain)$/.test(d[0]) ? defang(v) : v; });
          lines.push('# ' + d[1]);
          lines = lines.concat(shown);
          return '<div class="ioc-group"><h4>' + d[1] + ' <span>' + list.length + '</span></h4><ul>' +
            list.map(function (v, i) {
              var look = LOOKUP[d[0]];
              return '<li><button type="button" class="cell" data-copy="' + NP.esc(shown[i]) + '">' + NP.esc(shown[i]) + '</button>' +
                (look ? '<a href="' + NP.esc(look(v)) + '" target="_blank" rel="noopener noreferrer" title="Look up">↗</a>' : '') + '</li>';
            }).join('') + '</ul></div>';
        }).join('');
        text = lines.join('\n');
        out.innerHTML = html || '<p class="tool-note">nothing found</p>';
      }

      copyCells(out);
      inp.addEventListener('input', draw);
      q(c, 'df').addEventListener('change', draw);
      NP.seg(q(c, 'mode'), function (v) { mode = v; draw(); });
      q(c, 'copy').addEventListener('click', function (e) { NP.copy(text, e.currentTarget); });
      draw();
    }
  });

  /* =====================================================================
   * Hidden and lookalike characters
   * ===================================================================== */
  var INVISIBLE = {
    0x00ad: 'soft hyphen', 0x034f: 'combining grapheme joiner', 0x061c: 'arabic letter mark', 0x115f: 'hangul filler',
    0x180e: 'mongolian vowel separator', 0x200b: 'zero width space', 0x200c: 'zero width non-joiner',
    0x200d: 'zero width joiner', 0x200e: 'left-to-right mark', 0x200f: 'right-to-left mark',
    0x202a: 'LRE (bidi embed)', 0x202b: 'RLE (bidi embed)', 0x202c: 'PDF (bidi pop)', 0x202d: 'LRO (bidi override)',
    0x202e: 'RLO (bidi override)', 0x2060: 'word joiner', 0x2061: 'function application', 0x2062: 'invisible times',
    0x2063: 'invisible separator', 0x2064: 'invisible plus', 0x2066: 'LRI (bidi isolate)', 0x2067: 'RLI (bidi isolate)',
    0x2068: 'FSI (bidi isolate)', 0x2069: 'PDI (bidi pop isolate)', 0x3164: 'hangul filler', 0xfeff: 'BOM / zero width no-break',
    0xffa0: 'halfwidth hangul filler'
  };
  var SPACES = { 0x00a0: 'no-break space', 0x2007: 'figure space', 0x2009: 'thin space', 0x200a: 'hair space',
    0x202f: 'narrow no-break space', 0x205f: 'math space', 0x3000: 'ideographic space', 0x2002: 'en space', 0x2003: 'em space' };
  // common Cyrillic / Greek letters that pass for Latin
  var LOOKALIKE = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'һ': 'h',
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I', 'Ј': 'J',
    'ο': 'o', 'α': 'a', 'ν': 'v', 'ρ': 'p', 'τ': 't', 'ι': 'i', 'κ': 'k', 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I',
    'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X'
  };

  function classify(cp, ch) {
    if (INVISIBLE[cp]) return ['bad', INVISIBLE[cp]];
    if (cp >= 0xe0000 && cp <= 0xe007f) return ['bad', 'tag character (hidden ASCII "' + (cp >= 0xe0020 && cp < 0xe007f ? String.fromCharCode(cp - 0xe0000) : '') + '")'];
    if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)) return ['warn', 'variation selector'];
    if (SPACES[cp]) return ['warn', SPACES[cp]];
    if (LOOKALIKE[ch]) return ['warn', 'looks like "' + LOOKALIKE[ch] + '" (U+' + cp.toString(16).toUpperCase() + ')'];
    if ((cp < 0x20 && cp !== 9 && cp !== 10 && cp !== 13) || (cp >= 0x7f && cp < 0xa0)) return ['bad', 'control character'];
    return null;
  }

  NP.tool({
    id: 'unicode',
    group: 'sec',
    title: 'Hidden & lookalike characters',
    keys: 'unicode zero width invisible homoglyph lookalike bidi trojan source tag characters prompt injection punycode idn phishing',
    html:
      '<textarea data-f="in" class="field mono" rows="3" spellcheck="false" placeholder="paste text, a URL or a domain"></textarea>' +
      '<div class="uni-view mono" data-f="view"></div>' +
      '<ul class="uni-list mono" data-f="list"></ul>' +
      '<div class="pitch-ctl"><button type="button" class="step-btn mono" data-f="clean">copy cleaned text</button>' +
      '<label class="check mono"><input type="checkbox" data-f="fold" checked> swap lookalikes for Latin</label></div>' +
      '<p class="tool-note mono" data-f="msg"></p>',
    init: function (c) {
      var inp = q(c, 'in');
      var view = q(c, 'view');
      var list = q(c, 'list');
      var msg = q(c, 'msg');
      // sample: a Cyrillic "а" in paypal, a zero width space and tag characters spelling "hi"
      inp.value = 'Log in at pаypal.com​/verify󠁨󠁩';

      function draw() {
        var chars = Array.from(inp.value);
        var counts = {};
        var html = '';
        chars.forEach(function (ch) {
          var cp = ch.codePointAt(0);
          var hit = classify(cp, ch);
          if (!hit) { html += NP.esc(ch); return; }
          var key = hit[1];
          counts[key] = counts[key] || { n: 0, sev: hit[0], cp: cp };
          counts[key].n++;
          var shown = LOOKALIKE[ch] ? NP.esc(ch) : 'U+' + cp.toString(16).toUpperCase();
          html += '<mark class="' + hit[0] + '" title="' + NP.esc(key) + '">' + shown + '</mark>';
        });
        view.innerHTML = html || '<span class="dim">…</span>';
        var keys = Object.keys(counts);
        list.innerHTML = keys.map(function (k) {
          return '<li class="' + counts[k].sev + '">' + counts[k].n + ' × ' + NP.esc(k) + '</li>';
        }).join('');
        var host = inp.value.trim().match(/^(?:[a-z]+:\/\/)?([^/\s?#]+\.[^/\s?#]+)/i);
        var puny = '';
        if (host && /[^\x00-\x7f]/.test(host[1])) {
          try { puny = ' · domain is really ' + new URL('http://' + host[1].replace(/[​-‍⁠﻿]/g, '')).hostname; } catch (e) { /* not a hostname */ }
        }
        msg.textContent = (keys.length ? keys.length + ' kinds of suspicious character' : 'clean: nothing hidden') + puny;
      }

      q(c, 'clean').addEventListener('click', function (e) {
        var fold = q(c, 'fold').checked;
        var out = Array.from(inp.value).map(function (ch) {
          var cp = ch.codePointAt(0);
          var hit = classify(cp, ch);
          if (!hit) return ch;
          if (LOOKALIKE[ch]) return fold ? LOOKALIKE[ch] : ch;
          if (SPACES[cp]) return ' ';
          return '';
        }).join('');
        NP.copy(out, e.currentTarget);
      });
      inp.addEventListener('input', draw);
      draw();
    }
  });

  /* =====================================================================
   * What this browser shares
   * ===================================================================== */
  NP.tool({
    id: 'fp',
    group: 'sec',
    title: 'What this browser shares',
    keys: 'browser fingerprint user agent webgl canvas privacy timezone screen headers tracking',
    head: '<button type="button" class="step-btn mono" data-f="copy">copy</button>',
    html: '<div class="ref-scroll"><table class="kv mono" data-f="out"></table></div>' +
      '<p class="tool-note mono">Read in this tab and sent nowhere. Any site can read all of this without asking.</p>',
    init: function (c) {
      var out = q(c, 'out');
      var rows = [];
      var n = navigator;
      function add(k, v) { if (v !== undefined && v !== null && v !== '') rows.push([k, String(v)]); }
      function draw() { out.innerHTML = kv(rows); }

      add('user agent', n.userAgent);
      if (n.userAgentData) {
        add('UA brands', n.userAgentData.brands.map(function (b) { return b.brand + ' ' + b.version; }).join(', '));
        add('UA platform', n.userAgentData.platform + (n.userAgentData.mobile ? ' (mobile)' : ''));
      }
      add('languages', (n.languages || [n.language]).join(', '));
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      var off = -new Date().getTimezoneOffset();
      add('time zone', tz + ' (UTC' + (off >= 0 ? '+' : '−') + Math.floor(Math.abs(off) / 60) + (off % 60 ? ':' + ('0' + Math.abs(off % 60)).slice(-2) : '') + ')');
      add('screen', screen.width + '×' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x, ' + screen.colorDepth + '-bit');
      add('window', window.innerWidth + '×' + window.innerHeight);
      add('CPU threads', n.hardwareConcurrency);
      add('memory', n.deviceMemory ? '≥ ' + n.deviceMemory + ' GB (rounded)' : '');
      add('touch points', n.maxTouchPoints);
      add('cookies', n.cookieEnabled ? 'enabled' : 'disabled');
      add('Do Not Track', n.doNotTrack === '1' ? 'on' : 'off');
      add('Global Privacy Control', n.globalPrivacyControl ? 'on' : 'off');
      add('color scheme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      add('reduced motion', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'yes' : 'no');
      if (n.connection) add('network', (n.connection.effectiveType || '') + (n.connection.downlink ? ' · ~' + n.connection.downlink + ' Mbps' : ''));
      try {
        var gl = document.createElement('canvas').getContext('webgl');
        var dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) add('GPU', gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) + ' (' + gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) + ')');
      } catch (e) { /* no WebGL */ }
      draw();

      // canvas fingerprint: the same drawing renders slightly differently per GPU, driver and font stack
      try {
        var cv = document.createElement('canvas');
        cv.width = 240;
        cv.height = 40;
        var x = cv.getContext('2d');
        x.textBaseline = 'top';
        x.font = '16px Arial';
        x.fillStyle = '#f60';
        x.fillRect(100, 1, 60, 20);
        x.fillStyle = '#069';
        x.fillText('NOPHASE ✓ 🎛️ fingerprint', 2, 4);
        x.fillStyle = 'rgba(102, 204, 0, 0.7)';
        x.fillText('NOPHASE ✓ 🎛️ fingerprint', 4, 6);
        if (crypto.subtle) {
          crypto.subtle.digest('SHA-256', new TextEncoder().encode(cv.toDataURL())).then(function (h) {
            add('canvas hash', Array.prototype.map.call(new Uint8Array(h).slice(0, 8), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''));
            draw();
          });
        }
      } catch (e) { /* canvas blocked */ }

      copyCells(out);
      q(c, 'copy').addEventListener('click', function (e) {
        NP.copy(rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n'), e.currentTarget);
      });
    }
  });
})();
