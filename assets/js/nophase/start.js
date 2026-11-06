/*
 * NOPHASE start page: clock and link launcher, then hands off to the tools.
 * No dependencies. Link data comes from _data/start.yml (rendered into the page).
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

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

  /* ---------- launcher ---------- */

  var input = $('q');
  var form = $('launcher');
  var hint = $('hint');
  var links = [].slice.call(document.querySelectorAll('#links .link'));
  var groups = [].slice.call(document.querySelectorAll('#links .link-group'));
  var emptyMsg = $('no-links');
  var cfg = { default: 'https://duckduckgo.com/?q={q}', label: 'DuckDuckGo', prefixes: {} };
  var defaultHint = hint ? hint.innerHTML : '';

  try {
    var raw = JSON.parse($('start-config').textContent);
    if (raw) cfg = raw;
  } catch (e) { /* keep defaults */ }

  var matches = [];
  var sel = 0;

  function webTarget(query) {
    var m = query.match(/^(\S+)\s+(.+)$/);
    if (m && cfg.prefixes && cfg.prefixes[m[1].toLowerCase()]) {
      return cfg.prefixes[m[1].toLowerCase()].replace('{q}', encodeURIComponent(m[2]));
    }
    return null;
  }

  function render() {
    var query = input.value.trim().toLowerCase();
    var tokens = query.split(/\s+/).filter(Boolean);
    var webOnly = !!webTarget(input.value.trim());
    matches = [];

    links.forEach(function (a) {
      var hay = a.getAttribute('data-search');
      var ok = !tokens.length || (!webOnly && tokens.every(function (t) { return hay.indexOf(t) !== -1; }));
      a.parentNode.hidden = !ok;
      a.classList.remove('is-sel');
      if (ok && tokens.length) matches.push(a);
    });

    groups.forEach(function (g) {
      g.hidden = !g.querySelector('li:not([hidden])');
    });
    if (emptyMsg) emptyMsg.hidden = !tokens.length || !!matches.length || webOnly ? true : false;

    sel = Math.min(sel, Math.max(0, matches.length - 1));
    if (matches[sel]) matches[sel].classList.add('is-sel');
    updateHint(query);
  }

  function updateHint(query) {
    if (!hint) return;
    if (!query) { hint.innerHTML = defaultHint; return; }
    var web = webTarget(input.value.trim());
    if (web) {
      hint.textContent = '↵ search ' + new URL(web).hostname.replace(/^www\./, '') + ' for “' +
        input.value.trim().replace(/^\S+\s+/, '') + '”';
    } else if (matches.length) {
      hint.textContent = '↵ open ' + matches[sel].getAttribute('data-name') +
        (matches.length > 1 ? '  ·  ↑↓ to switch (' + matches.length + ' matches)' : '');
    } else {
      hint.textContent = '↵ search ' + cfg.label + ' for “' + input.value.trim() + '”';
    }
  }

  function go(url, newTab) {
    if (newTab) window.open(url, '_blank', 'noopener');
    else window.location.href = url;
  }

  if (input && form) {
    input.addEventListener('input', function () { sel = 0; render(); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!matches.length) return;
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        render();
        matches[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Escape') {
        input.value = '';
        sel = 0;
        render();
        input.blur();
      }
    });

    function submit(e) {
      var q = input.value.trim();
      if (!q) return;
      var newTab = e.metaKey || e.ctrlKey;
      var prefixed = webTarget(q);
      if (prefixed) return go(prefixed, newTab);
      if (matches.length && !e.shiftKey) return go(matches[sel].href, newTab);
      go(cfg.default.replace('{q}', encodeURIComponent(q)), newTab);
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submit(e); }
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

  /* ---------- browser tools (see tools-*.js) ---------- */

  if (window.NP && window.NP.render) window.NP.render();
})();
