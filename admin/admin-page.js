/* VRMIC 2026 admin - small helpers shared by the newer pages. Include AFTER admin-common.js. */
(function () {
  window.$ = id => document.getElementById(id);
  window.esc = VR.esc;
  window.showErr = m => { const e = $('err'); if (!e) return alert(m); e.textContent = m; e.className = 'alert alert-error show'; window.scrollTo({ top: 0, behavior: 'smooth' }); };
  window.showOk = m => { const e = $('ok'); if (!e) return; e.textContent = m; e.className = 'alert alert-success show'; window.scrollTo({ top: 0, behavior: 'smooth' }); };
  window.hideAlerts = () => { ['err', 'ok'].forEach(i => { const e = $(i); if (e) e.classList.remove('show'); }); };
  window.yes = v => String(v).toUpperCase() === 'TRUE';
  const IST = { timeZone: 'Asia/Kolkata' };
  window.fmtD = v => { if (!v) return '—'; const d = new Date(String(v).length === 10 ? v + 'T00:00:00+05:30' : v); return isNaN(d) ? String(v) : d.toLocaleDateString('en-GB', Object.assign({ day: '2-digit', month: 'short', year: 'numeric' }, IST)); };
  window.hm12 = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return '—'; let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m[2] + ' ' + ap; };
  VR.today = () => new Date().toLocaleDateString('en-CA', IST);   // yyyy-mm-dd in IST
  VR.kind = () => (new URLSearchParams(location.search).get('kind') === 'student' ? 'student' : 'participant');
  VR.guard = () => { if (!VR.token()) { (window.top || window).location.replace(VR.LOGIN_URL); return false; } return true; };
  // These pages are meant to live inside the home frame; opened directly they go back to the portal.
  VR.frameOnly = () => { if (window.self === window.top) { location.replace(VR.HOME_URL + '#' + location.pathname.split('/').pop() + location.search); return false; } return true; };
  VR.busy = async (btn, label, fn) => { const o = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + label; try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = o; } };
  VR.denied = msg => { document.querySelector('.wrap').innerHTML = '<div class="alert alert-error show">' + esc(msg || 'You do not have permission to open this page.') + '</div>'; };
})();
