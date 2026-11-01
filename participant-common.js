/* ===== PASTE THIS BLOCK into participant-common.js, directly ABOVE the line:  w.LVRMIC = {  ===== */

  /* ---------- Logged-in API call, guard, logout (shared by every participant page) ---------- */
  CFG.LOGIN_URL = location.pathname.indexOf('/participant/') > -1 ? '../participant-login.html' : 'participant-login.html';

  function logout() { session.clear(); try { sessionStorage.clear(); } catch (e) {} location.href = CFG.LOGIN_URL; }
  function guard() { if (!session.token()) { location.href = CFG.LOGIN_URL; return false; } return true; }

  // api(action, payload, {anon:true for login/public calls, stay:true = do not log out on "session expired"})
  // Adds the visitor IP and the token. A lock reply { ok:false, locked:true, error:'...15 minutes.' } is returned as is: show r.error.
  async function api(action, payload, opt) {
    opt = opt || {};
    var ip = await getClientIp();
    var r = await callApi(action, Object.assign({ ip: ip }, opt.anon ? {} : { token: session.token() }, payload));
    if (r && r.ok === false && !opt.anon && !opt.stay && /session/i.test(r.error || '')) logout();
    return r;
  }

  /* ---------- Small shared formatters / UI ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hm12(hm) { var m = /^(\d{1,2}):(\d{2})/.exec(hm || ''); if (!m) return ''; var h = +m[1], ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m[2] + ' ' + ap; }
  function formatDateTime(v) {   // "20-11-2026, 11:59 PM IST"
    var d = parseDeadline(v); if (!d) return '';
    return formatDate(d) + ', ' + d.toLocaleTimeString('en-US', { timeZone: CFG.TZ, hour: 'numeric', minute: '2-digit', hour12: true }) + ' IST';
  }
  function setAvatar(url) {
    var a = document.getElementById('user-avatar'), f = document.getElementById('user-avatar-fallback');
    if (!a || !url) return;
    a.src = photoUrl(url, 100); a.style.display = ''; if (f) f.style.display = 'none';
    a.onerror = function () { a.style.display = 'none'; if (f) f.style.display = ''; };
  }
  function initUserMenu() {   // avatar dropdown: <img onclick="toggleUserMenu()"> and <a onclick="logout()">
    window.toggleUserMenu = function () { var m = document.getElementById('user-menu'); if (m) m.classList.toggle('open'); };
    window.logout = logout;
    document.addEventListener('click', function (e) { if (!e.target.closest('.user-chip')) { var m = document.getElementById('user-menu'); if (m) m.classList.remove('open'); } });
  }
  // One call at the top of every logged-in page:  if (LVRMIC.init()) { ... }
  function init() { if (!guard()) return false; startClock(); initMenu(); initUserMenu(); return true; }

  /* ===== THEN change the export at the bottom to include the new names ===== */
  w.LVRMIC = {
    CFG: CFG, startClock: startClock, initMenu: initMenu, getClientIp: getClientIp,
    callApi: callApi, loadPublicSettings: loadPublicSettings, parseDeadline: parseDeadline,
    formatDate: formatDate, isPast: isPast, countdown: countdown, photoUrl: photoUrl, session: session,
    api: api, guard: guard, logout: logout, init: init, esc: esc, hm12: hm12,
    formatDateTime: formatDateTime, setAvatar: setAvatar, initUserMenu: initUserMenu
  };
