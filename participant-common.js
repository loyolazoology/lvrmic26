/* =====================================================================
   participant-common.js — shared by every participant page (LVRMIC 2026)
   One copy of: clock, menu, API call, session, photo helper, countdown,
   settings helpers, login (with visitor IP).
   Load it first on every page:   <script src="../participant-common.js"></script>
   ===================================================================== */
(function (w) {
  'use strict';

  /* ---------- 1. the only deployment-specific values ---------- */
  // You can also set window.LVRMIC_CONFIG = {...} before this script loads.
  var CONFIG = Object.assign({
    API_URL: '',                                   // <-- paste your Apps Script web-app URL (ends with /exec)
    TOKEN_KEY: 'lvrmic_token',                     // <-- the localStorage key your login page already uses
    NAME_KEY: 'lvrmic_name',
    LOGIN_URL: '../participant-login.html',
    TZ: 'Asia/Kolkata',
    TIMEOUT_MS: 30000
  }, w.LVRMIC_CONFIG || {});

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- 2. small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function safeUrl(u) { return /^https?:\/\/\S+$/i.test(String(u || '')) ? String(u) : ''; }
  function $(id) { return document.getElementById(id); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* "2026-11-20" -> "20 Nov 2026" */
  function formatDate(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || '');
    return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : '';
  }
  /* "14:30" -> "2:30 PM" ('' if not a 24-hour time) */
  function hm12(hm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(hm || ''); if (!m) return '';
    var h = +m[1], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return h + ':' + m[2] + ' ' + ap;
  }
  /* "10:30 AM" or "14:00" -> minutes after midnight, or null */
  function minutes(t) {
    var s = String(t || '').trim(), m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(s); if (!m) return null;
    var h = +m[1]; if (m[3]) { h = h % 12 + (/pm/i.test(m[3]) ? 12 : 0); }
    return h * 60 + +m[2];
  }
  /* "26 Nov 2026" or "2026-11-26" -> "2026-11-26" */
  function dateKey(s) {
    s = String(s || '').trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/.exec(s);
    var i = m ? MON.map(function (x) { return x.toLowerCase(); }).indexOf(m[2].toLowerCase()) : -1;
    return i < 0 ? '' : m[3] + '-' + p2(i + 1) + '-' + p2(+m[1]);
  }
  function todayKey() { return new Date().toLocaleDateString('en-CA', { timeZone: CONFIG.TZ }); }

  /* ---------- 3. deadlines ---------- */
  /* Accepts "2026-11-20T23:59:59+05:30", "2026-11-20 23:59", "2026-11-20" (no zone = IST). Returns Date or null. */
  function parseDeadline(v) {
    if (v instanceof Date) return isNaN(v) ? null : v;
    var s = String(v == null ? '' : v).trim(); if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T23:59:59';
    s = s.replace(' ', 'T');
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += '+05:30';
    var d = new Date(s); return isNaN(d) ? null : d;
  }
  function isPast(v) { var d = parseDeadline(v); return !!d && d.getTime() < Date.now(); }
  function fmtDate(v) { var d = parseDeadline(v); return d ? d.toLocaleDateString('en-GB', { timeZone: CONFIG.TZ, day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function fmtDateTime(v) {
    var d = parseDeadline(v);
    return d ? d.toLocaleString('en-GB', { timeZone: CONFIG.TZ, day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) + ' IST' : '';
  }

  var timers = [];
  /* Live countdown inside element `el`. Returns a stop() function. */
  function countdown(deadline, el, doneText) {
    var d = parseDeadline(deadline); if (!d || !el) return function () {};
    function tick() {
      var ms = d.getTime() - Date.now();
      if (ms <= 0) { el.textContent = doneText || 'Closed'; el.classList.add('is-closed'); stop(); return; }
      var s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
      el.textContent = (dd ? dd + 'd ' : '') + p2(hh) + 'h ' + p2(mm) + 'm ' + p2(ss) + 's left';
      el.classList.toggle('is-urgent', ms < 86400000);
    }
    var id = setInterval(tick, 1000); timers.push(id);
    function stop() { clearInterval(id); }
    tick(); return stop;
  }

  /* ---------- 4. clock (IST + UTC) ---------- */
  function startClock(id) {
    var el = $(id || 'utc-clock'); if (!el) return;
    function tick() {
      var n = new Date();
      var ist = n.toLocaleString('en-GB', { timeZone: CONFIG.TZ, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      var utc = n.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false });
      el.innerHTML = '<b>' + esc(ist) + ' IST</b> &nbsp;·&nbsp; ' + esc(utc) + ' UTC';
    }
    tick(); setInterval(tick, 1000);
  }

  /* ---------- 5. session (login token) ---------- */
  var session = {
    token: function () { try { return localStorage.getItem(CONFIG.TOKEN_KEY) || sessionStorage.getItem(CONFIG.TOKEN_KEY) || ''; } catch (e) { return ''; } },
    set: function (token, name) { try { localStorage.setItem(CONFIG.TOKEN_KEY, token); if (name) localStorage.setItem(CONFIG.NAME_KEY, name); } catch (e) {} },
    clear: function () { try { localStorage.removeItem(CONFIG.TOKEN_KEY); localStorage.removeItem(CONFIG.NAME_KEY); sessionStorage.removeItem(CONFIG.TOKEN_KEY); } catch (e) {} }
  };
  function logout() { session.clear(); w.location.href = CONFIG.LOGIN_URL; }

  /* ---------- 6. API ---------- */
  /* Low-level call. Never throws: always resolves to {ok:false,error} on failure. */
  function callApi(action, payload) {
    if (!CONFIG.API_URL) return Promise.resolve({ ok: false, error: 'API_URL is not set in participant-common.js.' });
    var ctl = ('AbortController' in w) ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, CONFIG.TIMEOUT_MS);
    return fetch(CONFIG.API_URL, {
      method: 'POST', redirect: 'follow', signal: ctl ? ctl.signal : undefined,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },          // plain text avoids the CORS pre-flight Apps Script cannot answer
      body: JSON.stringify(Object.assign({}, payload || {}, { action: action }))
    }).then(function (r) { return r.text(); }).then(function (txt) {
      try { return JSON.parse(txt); } catch (e) { return { ok: false, error: 'The server sent an unreadable reply. Please try again.' }; }
    }).catch(function (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'The server took too long to answer. Please try again.' : 'Could not reach the server. Check your connection and try again.' };
    }).then(function (res) { if (t) clearTimeout(t); return res || { ok: false, error: 'Empty reply from the server.' }; });
  }
  /* Page-level call: adds the login token; sends the user to login when the session has expired.
     opts: { anon:true } = no login needed · { stay:true } = never redirect */
  function api(action, payload, opts) {
    opts = opts || {};
    var p = Object.assign({}, payload || {}); if (!opts.anon) p.token = session.token();
    return callApi(action, p).then(function (res) {
      if (!opts.anon && !opts.stay && res && !res.ok && /session expired|log in again/i.test(res.error || '')) { session.clear(); w.location.href = CONFIG.LOGIN_URL; }
      return res;
    });
  }

  /* ---------- 7. login with visitor IP ---------- */
  var ipPromise = null;
  function getIp() {                                   // best effort: '' if the lookup is blocked or slow
    if (ipPromise) return ipPromise;
    try { var c = sessionStorage.getItem('lvrmic_ip'); if (c) return (ipPromise = Promise.resolve(c)); } catch (e) {}
    var ctl = ('AbortController' in w) ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 3000);
    ipPromise = fetch('https://api.ipify.org?format=json', { signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { var ip = String((j && j.ip) || '').slice(0, 45); try { sessionStorage.setItem('lvrmic_ip', ip); } catch (e) {} return ip; })
      .catch(function () { return ''; })
      .then(function (ip) { if (t) clearTimeout(t); return ip; });
    return ipPromise;
  }
  /* Returns the server reply untouched, so the page can show res.error (incl. "too many wrong attempts…") and read res.locked.
     On success the token is stored. */
  function login(email, password) {
    return getIp().then(function (ip) {
      return callApi('login', { email: String(email || '').trim(), password: password, ip: ip });
    }).then(function (res) { if (res && res.ok && res.token) session.set(res.token, res.name); return res; });
  }

  /* ---------- 8. settings (nothing hard-coded in pages) ---------- */
  function loadPublicSettings() {
    return callApi('getPublicSettings', {}).then(function (r) { return (r && r.ok && r.settings) || {}; });
  }
  function num(S, key, fallback) { var n = parseFloat(S && S[key]); return isFinite(n) ? n : fallback; }
  /* "26–28 November 2026" from conf.startDate / conf.endDate */
  function confDates(S) {
    var a = /^(\d{4})-(\d{2})-(\d{2})/.exec((S || {})['conf.startDate'] || ''), b = /^(\d{4})-(\d{2})-(\d{2})/.exec((S || {})['conf.endDate'] || '');
    if (!a) return '';
    if (!b || (a[0] === b[0])) return (+a[3]) + ' ' + MONTH[+a[2] - 1] + ' ' + a[1];
    if (a[1] === b[1] && a[2] === b[2]) return (+a[3]) + '–' + (+b[3]) + ' ' + MONTH[+a[2] - 1] + ' ' + a[1];
    if (a[1] === b[1]) return (+a[3]) + ' ' + MONTH[+a[2] - 1] + ' – ' + (+b[3]) + ' ' + MONTH[+b[2] - 1] + ' ' + a[1];
    return (+a[3]) + ' ' + MONTH[+a[2] - 1] + ' ' + a[1] + ' – ' + (+b[3]) + ' ' + MONTH[+b[2] - 1] + ' ' + b[1];
  }
  /* Typed view of the file rules */
  function limits(S) {
    S = S || {};
    return {
      abstractMb: num(S, 'file.abstractMaxMb', 10), pptMb: num(S, 'file.pptMaxMb', 25), words: num(S, 'file.abstractWordLimit', 300),
      coAuthors: num(S, 'file.maxCoAuthors', 5), pptTypes: String(S['file.pptTypes'] || 'pptx,pdf,ppt').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
      posterSize: S['file.posterSize'] || ''
    };
  }
  /* Who to contact (emails and phones always come from Settings) */
  function support(S) {
    S = S || {};
    return { email: S['conf.contactEmail'] || '', convenerEmail: S['conf.convenerEmail'] || S['conf.contactEmail'] || '', phone: S['conf.contactPhone'] || '',
             techPhone: S['conf.supportPhone'] || S['conf.contactPhone'] || '', convener: S['conf.convenerName'] || '' };
  }
  /* Declarative fill — put these attributes in the HTML, call L.fillSettings(S) once:
       data-s="file.abstractMaxMb"          -> text = the value
       data-s-date="dl.abstract"            -> text = "20 Nov 2026"
       data-s-datetime="dl.abstract"        -> text = "20 Nov 2026, 11:59 PM IST"
       data-s-confdates                     -> text = "26–28 November 2026"
       data-s-mail="conf.contactEmail"      -> href=mailto: + text (hidden if empty)
       data-s-tel="conf.supportPhone"       -> href=tel: + text (hidden if empty)
       data-s-countdown="dl.abstract"       -> live countdown                                   */
  function fillSettings(S, root) {
    root = root || document; S = S || {};
    [].forEach.call(root.querySelectorAll('[data-s]'), function (el) { var v = S[el.getAttribute('data-s')]; if (v != null && v !== '') el.textContent = v; });
    [].forEach.call(root.querySelectorAll('[data-s-date]'), function (el) { var t = fmtDate(S[el.getAttribute('data-s-date')]); el.textContent = t || 'the announced date'; });
    [].forEach.call(root.querySelectorAll('[data-s-datetime]'), function (el) { var t = fmtDateTime(S[el.getAttribute('data-s-datetime')]); el.textContent = t || 'the announced date'; });
    [].forEach.call(root.querySelectorAll('[data-s-confdates]'), function (el) { var t = confDates(S); if (t) el.textContent = t; });
    [].forEach.call(root.querySelectorAll('[data-s-mail]'), function (el) {
      var v = S[el.getAttribute('data-s-mail')]; if (!v) { el.style.display = 'none'; return; }
      el.textContent = v; el.setAttribute('href', 'mailto:' + v);
    });
    [].forEach.call(root.querySelectorAll('[data-s-tel]'), function (el) {
      var v = S[el.getAttribute('data-s-tel')]; if (!v) { el.style.display = 'none'; return; }
      el.textContent = v; el.setAttribute('href', 'tel:' + String(v).replace(/[^\d+]/g, ''));
    });
    [].forEach.call(root.querySelectorAll('[data-s-countdown]'), function (el) { countdown(S[el.getAttribute('data-s-countdown')], el); });
  }

  /* ---------- 9. photo helper ---------- */
  /* Google Drive links do not work in <img>; turn them into a thumbnail URL. */
  function photoUrl(url, size) {
    var u = String(url || ''); if (!u) return '';
    var m = /\/file\/d\/([\w-]+)/.exec(u) || /[?&]id=([\w-]+)/.exec(u) || /\/d\/([\w-]+)/.exec(u);
    return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + (size || 200) : u;
  }
  function setAvatar(url) {
    var img = $('user-avatar'), fb = $('user-avatar-fallback'); if (!img || !url) return;
    img.onerror = function () { img.style.display = 'none'; if (fb) fb.style.display = ''; };
    img.src = photoUrl(url, 100); img.style.display = ''; if (fb) fb.style.display = 'none';
  }

  /* ---------- 10. menu ---------- */
  /* Mobile slide-in menu. Safe to call on every page. */
  function initMenu() {
    var tg = $('nav-toggle'), nav = $('nav-links'); if (!tg || !nav) return;
    function close() { nav.classList.remove('open'); }
    tg.addEventListener('click', function (e) { e.stopPropagation(); nav.classList.toggle('open'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('click', function (e) { if (!e.target.closest('#nav-links') && !e.target.closest('#nav-toggle')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  /* Account pop-over (avatar button). Opt-in, so pages that already bind their own do not toggle twice. */
  function initUserMenu() {
    var b = $('user-btn'), m = $('user-menu'); if (!b || !m) return;
    b.addEventListener('click', function (e) { e.stopPropagation(); m.classList.toggle('open'); });
    document.addEventListener('click', function (e) { if (!e.target.closest('#user-menu')) m.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') m.classList.remove('open'); });
  }

  /* ---------- 11. one-call page start ---------- */
  /* Clock + menu + login check. Returns true when the page may continue. */
  function init(opts) {
    opts = opts || {};
    startClock('utc-clock'); initMenu(); initUserMenu();
    if (!opts.public && !session.token()) { w.location.href = CONFIG.LOGIN_URL; return false; }
    if (!CONFIG.API_URL) {
      var bar = document.createElement('div');
      bar.style.cssText = 'background:#c0392b;color:#fff;padding:10px 16px;font:600 13px Inter,sans-serif;text-align:center';
      bar.textContent = 'Setup incomplete: set API_URL at the top of participant-common.js.'; document.body.insertBefore(bar, document.body.firstChild);
    }
    return true;
  }

  w.LVRMIC = {
    config: CONFIG, esc: esc, nl2br: nl2br, safeUrl: safeUrl, p2: p2,
    formatDate: formatDate, dmy: formatDate, hm12: hm12, minutes: minutes, dateKey: dateKey, todayKey: todayKey,
    parseDeadline: parseDeadline, isPast: isPast, fmtDate: fmtDate, fmtDateTime: fmtDateTime, countdown: countdown,
    startClock: startClock, session: session, logout: logout, callApi: callApi, api: api, getIp: getIp, login: login,
    loadPublicSettings: loadPublicSettings, num: num, confDates: confDates, limits: limits, support: support, fillSettings: fillSettings,
    photoUrl: photoUrl, setAvatar: setAvatar, initMenu: initMenu, initUserMenu: initUserMenu, init: init
  };
})(window);
