/* LVRMIC 2026 — shared helpers for STUDENT pages.
   Load AFTER participant-common.js:
     <script src="participant-common.js"></script>  <script src="student-common.js"></script>      (site root: student-login.html)
     <script src="../participant-common.js"></script><script src="../student-common.js"></script>   (pages in /student/)
   Uses its own storage keys, so a student and a participant can be logged in in the same browser. */
(function (w) {
  'use strict';
  var L = w.LVRMIC;
  var K = { token: 'lvrmic_student_token', name: 'lvrmic_student_name', email: 'lvrmic_student_saved_email' };
  var LOGIN = '../student-login.html';

  var session = {
    token: function () { return localStorage.getItem(K.token); },
    name: function () { return localStorage.getItem(K.name) || ''; },
    save: function (t, n) { localStorage.setItem(K.token, t); if (n != null) localStorage.setItem(K.name, n); },
    clear: function () { localStorage.removeItem(K.token); localStorage.removeItem(K.name); }
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var nl2br = function (s) { return esc(s).replace(/\n/g, '<br>'); };
  var IST = { timeZone: 'Asia/Kolkata' };
  function fmtDT(v) { var d = L.parseDeadline(v); return d ? d.toLocaleString('en-GB', Object.assign({ day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }, IST)) + ' IST' : ''; }
  function logout() { session.clear(); location.href = LOGIN; }

  // Server call with the student token. Sends the student to the login page when the session is gone
  // or the password still has to be changed.
  async function api(action, payload) {
    var res = await L.callApi(action, Object.assign({ token: session.token() }, payload || {}));
    if (!res.ok) {
      if (res.mustReset) { location.href = LOGIN + '#reset'; }
      else if (/session expired|log in again/i.test(res.error || '')) { session.clear(); location.href = LOGIN; }
    }
    return res;
  }

  var libs = {};
  function load(src) { return libs[src] || (libs[src] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); })); }

  function popup(msg, title, ok) {
    var b = document.getElementById('popup-back');
    if (!b) {
      b = document.createElement('div'); b.id = 'popup-back'; b.className = 'popup-back';
      b.innerHTML = '<div class="popup" id="popup" role="alertdialog" aria-modal="true"><div class="popup-icon"><i class="fa-solid fa-triangle-exclamation" id="popup-i"></i></div><h3 id="popup-title"></h3><p id="popup-msg"></p><button type="button" class="btn btn-gold" style="width:100%;" id="popup-ok">OK</button></div>';
      document.body.appendChild(b);
      b.addEventListener('click', function (e) { if (e.target === b || e.target.id === 'popup-ok') b.classList.remove('show'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') b.classList.remove('show'); });
    }
    document.getElementById('popup-title').textContent = title || (ok ? 'Done' : 'Something went wrong');
    document.getElementById('popup-msg').textContent = msg || '';
    document.getElementById('popup').classList.toggle('ok', !!ok);
    document.getElementById('popup-i').className = 'fa-solid ' + (ok ? 'fa-circle-check' : 'fa-triangle-exclamation');
    b.classList.add('show'); document.getElementById('popup-ok').focus();
  }

  // Page shell: clock bar, masthead, top navigation with user menu, footer. Needs <div id="shell"> (and optionally <div id="foot">).
  function shell(active) {
    if (!session.token()) { location.href = LOGIN; return; }
    var nav = function (id, href, icon, label, hide) { return '<li' + (id ? ' id="' + id + '"' : '') + (hide ? ' style="display:none;"' : '') + '><a href="' + href + '"' + (active === href.replace('.html', '') ? ' class="active"' : '') + '><i class="' + icon + '"></i> ' + label + '</a></li>'; };
    var nm = session.name(), ini = nm.split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase();
    document.getElementById('shell').innerHTML =
      '<div class="utcbar"><div class="utcbar-inner"><i class="fa-regular fa-clock"></i><span id="utc-clock"><b>Loading time…</b></span></div></div>' +
      '<div class="masthead"><div class="masthead-inner"><div class="masthead-logos"><img src="../assets/loyola-crest.png" alt="Loyola College" onerror="this.style.display=\'none\'"><img src="../assets/cimser-logo.png" alt="CIMSER" onerror="this.style.display=\'none\'"></div>' +
      '<div class="masthead-text"><div class="m-super">Loyola College (Autonomous), Chennai</div><h1>4th International Conference on Life Sciences &amp; Vector Risk Management for a Sustainable Healthy Environment</h1></div></div></div>' +
      '<div class="topnav"><div class="topnav-inner"><button class="pnav-toggle" id="nav-toggle" aria-label="Menu"><i class="fa-solid fa-bars"></i></button><ul class="pnav" id="nav-links">' +
      nav('', 'home.html', 'fa-solid fa-house', 'Home') + nav('nav-schedule', 'schedule.html', 'fa-regular fa-calendar', 'Schedule', true) + nav('', 'feedback.html', 'fa-regular fa-comment-dots', 'Feedback') +
      '</ul><div class="pop-wrap"><button class="user-chip-btn" id="user-btn" type="button" aria-label="My account"><div class="avatar-fallback" id="user-av">' + (esc(ini) || '<i class="fa-solid fa-user"></i>') + '</div></button>' +
      '<div class="pop user-menu" id="user-menu"><a href="home.html"><i class="fa-solid fa-house"></i> Dashboard</a><button type="button" id="logout-btn"><i class="fa-solid fa-right-from-bracket"></i> Log out</button></div></div></div></div>';
    var f = document.getElementById('foot');
    if (f) f.innerHTML = '<footer><div class="wrap"><p><b style="color:#fff;">26&ndash;28 November 2026</b> &middot; Student Portal</p><p>Centre for Insect Molecular Studies and Environmental Research (CIMSER), PG &amp; Research Dept. of Advanced Zoology &amp; Biotechnology</p><p>© 2026, Loyola College (Autonomous), Chennai &mdash; <em>“Luceat Lux Vestra — Let Your Light Shine”</em></p></div></footer>';
    L.startClock('utc-clock'); L.initMenu();
    var um = document.getElementById('user-menu');
    document.getElementById('user-btn').addEventListener('click', function (e) { e.stopPropagation(); um.classList.toggle('open'); });
    document.addEventListener('click', function (e) { if (!e.target.closest('.pop-wrap')) um.classList.remove('open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') um.classList.remove('open'); });
    document.getElementById('logout-btn').addEventListener('click', logout);
    L.loadPublicSettings().then(function (s) { if (s && s['sw.studentScheduleVisible'] === 'true') document.getElementById('nav-schedule').style.display = ''; });
  }

  w.StudentPortal = { KEYS: K, session: session, esc: esc, nl2br: nl2br, fmtDT: fmtDT, api: api, logout: logout, load: load, popup: popup, shell: shell };
})(window);