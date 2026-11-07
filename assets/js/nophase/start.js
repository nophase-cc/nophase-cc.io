/*
 * NOPHASE start page: clock, launcher, feed, then hands off to the tools.
 * No dependencies. Link and project data come from the rendered page, tools
 * from the NP registry (tools-*.js), headlines from the feed JSON.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }

  /* ---------- clock ---------- */

  var clockEl = $('clock');
  var dateEl = $('date');

  function tick() {
    var now = new Date();
    if (clockEl) clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  }
  tick();

  function ago(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
    if (s < 86400) return Math.round(s / 3600) + 'h';
    return Math.round(s / 86400) + 'd';
  }

  /* ---------- browser tools (see tools-*.js) ---------- */

  if (window.NP && window.NP.render) window.NP.render();

  /* ---------- search index ---------- */

  // { type, name, url, hay, meta, icon, tool? }
  var index = [];
  var TYPE_ORDER = { tool: 0, link: 1, project: 2, news: 3 };

  [].forEach.call(document.querySelectorAll('#links .link'), function (a) {
    index.push({
      type: 'link',
      name: a.getAttribute('data-name'),
      url: a.href,
      hay: a.getAttribute('data-search'),
      meta: a.getAttribute('data-group'),
      icon: a.getAttribute('data-icon')
    });
  });

  if (window.NP && window.NP.tools) {
    window.NP.tools.forEach(function (t) {
      var group = window.NP.groupName ? window.NP.groupName(t.group) : t.group;
      index.push({
        type: 'tool',
        name: t.title,
        url: '#tool-' + t.id,
        tool: t.id,
        hay: (t.title + ' ' + (t.keys || '') + ' ' + group + ' tool').toLowerCase(),
        meta: group + ' tool',
        icon: 'fas fa-toolbox'
      });
    });
  }

  [].forEach.call(document.querySelectorAll('#home-projects .project-card'), function (card) {
    var title = card.querySelector('.project-card-title');
    var name = title ? title.textContent.trim() : '';
    index.push({
      type: 'project',
      name: name,
      url: card.href,
      hay: card.textContent.replace(/\s+/g, ' ').toLowerCase() + ' project',
      meta: 'project',
      icon: 'fas fa-cube'
    });
  });

  /* ---------- launcher ---------- */

  var input = $('q');
  var form = $('launcher');
  var hint = $('hint');
  var box = $('results');
  var cfg = { default: 'https://duckduckgo.com/?q={q}', label: 'DuckDuckGo', prefixes: {} };
  var defaultHint = hint ? hint.innerHTML : '';
  var MAX = 8;

  try {
    var raw = JSON.parse($('start-config').textContent);
    if (raw) cfg = raw;
  } catch (e) { /* keep defaults */ }

  var rows = [];
  var sel = 0;

  function prefixTarget(query) {
    var m = query.match(/^(\S+)\s+(.+)$/);
    if (m && cfg.prefixes && cfg.prefixes[m[1].toLowerCase()]) {
      return { url: cfg.prefixes[m[1].toLowerCase()].replace('{q}', encodeURIComponent(m[2])), q: m[2] };
    }
    return null;
  }

  function webRow(query) {
    var p = prefixTarget(query);
    var url = p ? p.url : cfg.default.replace('{q}', encodeURIComponent(query));
    var host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* bad config */ }
    return {
      type: 'web',
      name: 'Search ' + (p ? host : cfg.label) + ' for “' + (p ? p.q : query) + '”',
      url: url,
      meta: p ? 'prefix' : '⇧↵',
      icon: 'fas fa-magnifying-glass'
    };
  }

  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // tokens: [{ t, re }]. Short tokens ("pi", "ui") only match at a word start,
  // longer ones anywhere ("chef" finds CyberChef).
  function score(item, q, tokens) {
    var hay = item.hay;
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].re ? !tokens[i].re.test(hay) : hay.indexOf(tokens[i].t) === -1) return -1;
    }
    var name = item.name.toLowerCase();
    var s = 0;
    if (name === q) s += 200;
    else if (name.indexOf(q) === 0) s += 120;
    else if (new RegExp('(^|[^a-z0-9])' + reEsc(q)).test(name)) s += 80;
    else if (name.indexOf(q) !== -1) s += 50;
    tokens.forEach(function (t) { if (name.indexOf(t.t) !== -1) s += 10; });
    return s - TYPE_ORDER[item.type];
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    if (prefixTarget(query.trim())) return [webRow(query.trim())];
    var tokens = q.split(/\s+/).map(function (t) {
      return { t: t, re: t.length <= 2 ? new RegExp('(^|[^a-z0-9])' + reEsc(t)) : null };
    });
    var hits = [];
    index.forEach(function (item) {
      var s = score(item, q, tokens);
      if (s >= 0) hits.push({ item: item, s: s });
    });
    hits.sort(function (a, b) { return b.s - a.s || TYPE_ORDER[a.item.type] - TYPE_ORDER[b.item.type]; });
    var out = hits.slice(0, MAX).map(function (h) { return h.item; });
    out.push(webRow(query.trim()));
    return out;
  }

  var TAG = { link: 'link', tool: 'tool', project: 'project', news: 'feed', web: 'web' };

  function render() {
    var query = input.value;
    rows = search(query);
    sel = Math.min(sel, Math.max(0, rows.length - 1));
    if (!rows.length) {
      box.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      hint.innerHTML = defaultHint;
      return;
    }
    box.innerHTML = rows.map(function (r, i) {
      var ext = r.type === 'link' || r.type === 'news' || r.type === 'web';
      return '<a class="res' + (i === sel ? ' is-sel' : '') + '" role="option" id="res-' + i + '" aria-selected="' + (i === sel) +
        '" data-i="' + i + '" href="' + esc(r.url) + '"' + (ext ? ' rel="noopener"' : '') + '>' +
        '<i class="' + esc(r.icon || 'fas fa-link') + ' fa-fw" aria-hidden="true"></i>' +
        '<span class="res-name">' + esc(r.name) + '</span>' +
        '<span class="res-meta">' + esc(r.meta || '') + '</span>' +
        '<span class="res-tag res-' + r.type + '">' + TAG[r.type] + '</span></a>';
    }).join('');
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', 'res-' + sel);
    var only = rows.length === 1;
    hint.textContent = only ? '↵ ' + rows[0].name.toLowerCase() :
      '↵ open · ↑↓ choose · ⇧↵ web search · ⌘↵ new tab · ' + (rows.length - 1) + ' on this page';
  }

  function close() {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function open(r, newTab) {
    if (!r) return;
    if (r.type === 'tool' && !newTab && window.NP && window.NP.open) {
      close();
      input.blur();
      window.NP.open(r.tool);
      return;
    }
    if (newTab) window.open(r.url, '_blank', 'noopener');
    else window.location.href = r.url;
  }

  function move(d) {
    if (!rows.length) return;
    sel = (sel + d + rows.length) % rows.length;
    render();
    var el = $('res-' + sel);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  if (input && form && box) {
    input.addEventListener('input', function () { sel = 0; render(); });
    input.addEventListener('focus', function () { if (input.value.trim()) render(); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Escape') {
        if (!box.hidden) close();
        else { input.value = ''; render(); input.blur(); }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var q = input.value.trim();
        if (!q) return;
        var newTab = e.metaKey || e.ctrlKey;
        if (e.shiftKey) open(webRow(q), newTab);
        else open(rows[sel] || webRow(q), newTab);
      }
    });

    form.addEventListener('submit', function (e) { e.preventDefault(); });

    box.addEventListener('mousemove', function (e) {
      var a = e.target.closest('.res');
      if (!a) return;
      var i = parseInt(a.getAttribute('data-i'), 10);
      if (i !== sel) {
        sel = i;
        [].forEach.call(box.children, function (el, j) {
          el.classList.toggle('is-sel', j === i);
          el.setAttribute('aria-selected', String(j === i));
        });
      }
    });
    box.addEventListener('click', function (e) {
      var a = e.target.closest('.res');
      if (!a || e.button !== 0) return;
      var newTab = e.metaKey || e.ctrlKey;
      e.preventDefault();
      open(rows[parseInt(a.getAttribute('data-i'), 10)], newTab);
    });

    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('.launch-wrap')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var el = document.activeElement;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      e.preventDefault();
      input.focus();
      input.select();
    });
  }

  /* ---------- feed ---------- */

  var feedEl = $('feed');
  var feedStatus = $('feed-status');
  var feedCfg = null;
  try { feedCfg = JSON.parse(($('feed-config') || {}).textContent || 'null'); } catch (e) { /* no feed */ }

  function feedFailed() {
    feedEl.classList.remove('is-loading');
    feedEl.classList.add('is-offline');
    if (feedStatus) feedStatus.textContent = 'headlines unavailable right now · the sources are below';
  }

  function feedRender(data, cached) {
    if (!data || !Array.isArray(data.columns)) throw new Error('Invalid feed');
    var total = 0;
    index = index.filter(function (item) { return item.type !== 'news'; });
    (data.columns || []).forEach(function (col) {
      var list = [].find.call(feedEl.querySelectorAll('[data-feed]'), function (el) {
        return el.getAttribute('data-feed') === col.title;
      });
      if (!list || !Array.isArray(col.items) || !col.items.length) return;
      list.textContent = '';
      col.items.forEach(function (it) {
        var url = safeUrl(it.url);
        if (!url || !it.title) return;
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener';
        var t = document.createElement('span');
        t.className = 'ft';
        t.textContent = it.title;
        var m = document.createElement('span');
        m.className = 'fm';
        m.textContent = it.source + (it.date ? ' · ' + ago(it.date) : '');
        a.appendChild(t);
        a.appendChild(m);
        li.appendChild(a);
        list.appendChild(li);
        total++;
        index.push({
          type: 'news',
          name: it.title,
          url: url,
          hay: (it.title + ' ' + it.source + ' ' + col.title + ' news feed').toLowerCase(),
          meta: it.source,
          icon: 'fas fa-rss'
        });
      });
    });
    if (!total) throw new Error('Empty feed');
    feedEl.classList.remove('is-loading');
    feedEl.classList.remove('is-offline');
    if (feedStatus) feedStatus.textContent = (cached ? 'saved headlines · ' : '') +
      'updated ' + ago(data.generated) + ' ago · ' + (cached ? 'live feed unavailable' : 'opens the source');
    if (!cached) {
      try { localStorage.setItem('nophase.feed', JSON.stringify(data)); } catch (error) {}
    }
  }

  if (feedEl && feedCfg && feedCfg.url && window.fetch) {
    // a new query every 10 minutes: skips stale CDN and service-worker copies
    var bucket = Math.floor(Date.now() / 600000);
    var controller = window.AbortController ? new AbortController() : null;
    var timeout;
    var deadline = new Promise(function (resolve, reject) {
      timeout = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error('Feed timed out'));
      }, 12000);
    });
    var request = fetch(feedCfg.url + '?t=' + bucket, { cache: 'no-store', signal: controller ? controller.signal : undefined })
      .then(function (response) { if (!response.ok) throw new Error(response.status); return response.json(); });
    Promise.race([request, deadline])
      .then(function (data) { clearTimeout(timeout); feedRender(data, false); })
      .catch(function () {
        clearTimeout(timeout);
        try {
          feedRender(JSON.parse(localStorage.getItem('nophase.feed')), true);
        } catch (error) { feedFailed(); }
      });
  } else if (feedEl) {
    feedFailed();
  }
})();
