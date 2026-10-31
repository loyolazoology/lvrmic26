/* LVRMIC 2026 — shared helpers for all participant pages.
   Load with:  <script src="participant-common.js"></script>   (login page, site root)
               <script src="../participant-common.js"></script> (pages inside /participant/)  */
(function (w) {
  'use strict';

  var CFG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbwAkN1CF441d8ZtOykNIiM0oV1xaOF8lWzT2xKA3QufWBd71KvnoHR1LqRfFS3IoV4d/exec',
    REGISTER_URL: 'https://erp.loyolacollege.edu/loyolaonline/conference',
    TZ: 'Asia/Kolkata',
    KEYS: { token: 'lvrmic_token', name: 'lvrmic_name', email: 'lvrmic_saved_email' },
    IP_LOOKUP: 'https://api.ipify.org?format=json',
    PUBLIC_SETTINGS_ACTION: 'getPublicSettings'
  };

  /* ---------- Clock ---------- */
  function startClock(id) {
    var el = document.getElementById(id || 'utc-clock');
    if (!el) return;
    function tick() {
      var now = new Date();
      var d = now.toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', timeZone: CFG.TZ, timeZoneName: 'short' });
      var t = now.toLocaleTimeString('en-GB', { timeZone: CFG.TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      el.innerHTML = '<b>' + d + ' &nbsp;·&nbsp; ' + t + '</b>';
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Menu (mobile drawer + dropdowns) + back-to-top ---------- */
  function initMenu() {
    var toggle = document.getElementById('nav-toggle');
    var links = document.getElementById('nav-links');
    if (!toggle || !links) return;
    var icon = toggle.querySelector('i');
    function closeDropdowns() { document.querySelectorAll('.has-dropdown.open').forEach(function (li) { li.classList.remove('open'); }); }
    function closeMenu() { links.classList.remove('open'); document.body.classList.remove('no-scroll'); if (icon) icon.className = 'fa-solid fa-bars'; closeDropdowns(); }
    function openMenu() { links.classList.add('open'); document.body.classList.add('no-scroll'); if (icon) icon.className = 'fa-solid fa-xmark'; }
    toggle.addEventListener('click', function () { links.classList.contains('open') ? closeMenu() : openMenu(); });
    document.querySelectorAll('.dropdown-toggle').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var li = t.closest('.has-dropdown');
        var was = li.classList.contains('open');
        closeDropdowns();
        if (!was) li.classList.add('open');
      });
    });
    links.querySelectorAll('a:not(.dropdown-toggle)').forEach(function (a) {
      a.addEventListener('click', function () { if (window.innerWidth <= 800) closeMenu(); });
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 800) closeMenu(); });

    var top = document.getElementById('back-to-top-btn');
    if (top) {
      var onScroll = function () { top.classList.toggle('show', window.scrollY > 420); };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
  }

  /* ---------- Visitor IP (cached; never blocks login for more than 3 s) ---------- */
  var ipPromise = null;
  function getClientIp() {
    if (ipPromise) return ipPromise;
    ipPromise = new Promise(function (resolve) {
      var ctl = new AbortController();
      var timer = setTimeout(function () { ctl.abort(); }, 3000);
      fetch(CFG.IP_LOOKUP, { signal: ctl.signal })
        .then(function (r) { return r.json(); })
        .then(function (j) { resolve((j && j.ip) || ''); })
        .catch(function () { resolve(''); })
        .then(function () { clearTimeout(timer); });
    });
    return ipPromise;
  }

  /* ---------- API call: resolves to server JSON or throws an Error safe to show ---------- */
  async function callApi(action, payload) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 30000);
    var res;
    try {
      res = await fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action }, payload)),
        signal: ctl.signal
      });
    } catch (err) {
      throw new Error(err && err.name === 'AbortError'
        ? 'The server took too long to respond. Please try again in a moment.'
        : 'Could not reach the server. Check your internet connection and try again.');
    } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error('The server returned an error (' + res.status + '). Please try again shortly.');
    try { return await res.json(); }
    catch (e) { throw new Error('The server sent an unexpected reply. Please try again, or contact the organisers if it keeps happening.'); }
  }

  /* ---------- Settings (public, no login needed) ---------- */
  var settingsPromise = null;
  function loadPublicSettings() {
    if (settingsPromise) return settingsPromise;
    settingsPromise = callApi(CFG.PUBLIC_SETTINGS_ACTION, {})
      .then(function (res) {
        if (!res || res.ok === false) return {};
        return res.settings || res;
      })
      .catch(function () { return {}; });
    return settingsPromise;
  }

  /* ---------- Dates & countdown ---------- */
  // Accepts ISO ("2026-11-23", "2026-11-23T10:00:00+05:30") or "23-11-2026". Date-only values mean end of that day IST.
  function parseDeadline(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T23:59:59+05:30');
    if ((m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/))) return new Date(m[3] + '-' + m[2] + '-' + m[1] + 'T23:59:59+05:30');
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function formatDate(v) {
    var d = parseDeadline(v);
    if (!d) return '';
    var p = new Intl.DateTimeFormat('en-GB', { timeZone: CFG.TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
    var g = function (t) { return p.find(function (x) { return x.type === t; }).value; };
    return g('day') + '-' + g('month') + '-' + g('year');
  }
  function isPast(v) { var d = parseDeadline(v); return !!d && Date.now() > d.getTime(); }

  // countdown(deadline, el, onDone) — writes "3d 04h 12m 09s" into el; returns the interval id.
  function countdown(deadline, el, onDone) {
    var d = parseDeadline(deadline);
    if (!d || !el) return null;
    function tick() {
      var ms = d.getTime() - Date.now();
      if (ms <= 0) { el.textContent = 'Closed'; clearInterval(id); if (onDone) onDone(); return; }
      var s = Math.floor(ms / 1000);
      var dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
      var z = function (n) { return String(n).padStart(2, '0'); };
      el.textContent = dd + 'd ' + z(hh) + 'h ' + z(mm) + 'm ' + z(ss) + 's';
    }
    var id = setInterval(tick, 1000);
    tick();
    return id;
  }

  /* ---------- Photo helper: Google Drive link / file id / plain URL -> displayable image URL ---------- */
  function photoUrl(src, size) {
    if (!src) return '';
    var s = String(src).trim(), id = null, m;
    if ((m = s.match(/\/d\/([\w-]{15,})/)) || (m = s.match(/[?&]id=([\w-]{15,})/))) id = m[1];
    else if (/^[\w-]{25,}$/.test(s)) id = s;
    return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (size || 400) : s;
  }

  /* ---------- Session helpers (single source for the LVRMIC storage keys) ---------- */
  var session = {
    token: function () { return localStorage.getItem(CFG.KEYS.token); },
    save: function (token, name) { localStorage.setItem(CFG.KEYS.token, token); if (name != null) localStorage.setItem(CFG.KEYS.name, name); },
    clear: function () { localStorage.removeItem(CFG.KEYS.token); localStorage.removeItem(CFG.KEYS.name); }
  };

  w.LVRMIC = {
    CFG: CFG, startClock: startClock, initMenu: initMenu, getClientIp: getClientIp,
    callApi: callApi, loadPublicSettings: loadPublicSettings, parseDeadline: parseDeadline,
    formatDate: formatDate, isPast: isPast, countdown: countdown, photoUrl: photoUrl, session: session
  };
})(window);
