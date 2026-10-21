/* VRMIC 2026 admin - shared helpers for the Slots and Posters pages. Include AFTER admin-common.js and admin-page.js. */
(function () {
  const S = (window.SL = {});
  const st = document.createElement('style');
  st.textContent = '.sl-Scheduled{background:rgba(179,188,214,.12);color:var(--text-2);}.sl-Presented{background:rgba(79,169,128,.16);color:var(--teal-light);}'
    + '.sl-No-show{background:rgba(216,105,90,.16);color:#e8988c;}.sl-Pending{background:rgba(219,164,60,.14);color:var(--warn);}'
    + '.t-Oral{background:rgba(31,122,104,.16);color:var(--teal-light);}.t-Poster{background:rgba(205,163,85,.16);color:var(--gold-light);}'
    + '.modal .box.mid{max-width:600px;}.modal .box.wide{max-width:820px;}input[type=checkbox].ck{width:16px;height:16px;accent-color:#c9974f;cursor:pointer;}'
    + '.vcard{border:1px solid var(--navy-border);border-radius:14px;margin-bottom:18px;overflow:hidden;background:var(--navy-900);}'
    + '.vcard>h3{margin:0;padding:12px 16px;font-size:15px;border-bottom:1px solid var(--navy-border);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;}'
    + '.note-row td{background:rgba(232,201,131,.05);font-size:12.5px;color:var(--text-2);}';
  document.head.appendChild(st);

  S.nz = v => String(v == null ? '' : v).trim();
  const p2 = n => ('0' + n).slice(-2);
  S.min12 = m => { if (m == null) return '—'; m = ((m % 1440) + 1440) % 1440; let h = Math.floor(m / 60); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + p2(m % 60) + ' ' + ap; };
  S.parse = t => {
    const m = String(t == null ? '' : t).trim().match(/^(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(am|pm)?$/i);
    if (!m || (m[2] === undefined && !m[3])) return null;
    let h = +m[1]; const mi = m[2] === undefined ? 0 : +m[2], ap = (m[3] || '').toLowerCase();
    if (mi > 59) return null;
    if (ap) { if (h < 1 || h > 12) return null; if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; } else if (h > 23) return null;
    return h * 60 + mi;
  };
  S.to24 = t => { const m = S.parse(t); return m == null ? '' : p2(Math.floor(m / 60)) + ':' + p2(m % 60); };
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  S.dayKey = d => { const m = String(d || '').trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4})$/); if (!m) return /^\d{4}-\d{2}-\d{2}/.test(d) ? String(d).slice(0, 10) : ''; const i = MON.indexOf(m[2].toLowerCase()); return i < 0 ? '' : m[3] + '-' + p2(i + 1) + '-' + p2(+m[1]); };
  S.range = r => r.time ? (r.end != null ? r.time + ' – ' + S.min12(r.end) : r.time) : '—';
  S.status = r => r.venue ? (r.status || 'Scheduled') : 'Pending';
  S.badge = r => '<span class="badge sl-' + S.status(r) + '">' + esc(S.status(r)) + '</span>';
  S.typeBadge = t => '<span class="badge t-' + esc(t) + '">' + esc(t) + '</span>';
  S.cmp = (a, b) => (a.dateKey || '9').localeCompare(b.dateKey || '9') || S.nz(a.venue).localeCompare(S.nz(b.venue)) || S.nz(a.room).localeCompare(S.nz(b.room))
    || (a.start == null ? 99999 : a.start) - (b.start == null ? 99999 : b.start) || S.nz(a.token || a.board).localeCompare(S.nz(b.token || b.board), undefined, { numeric: true }) || S.nz(a.name).localeCompare(S.nz(b.name));
  S.days = async () => { let d = []; try { d = await VR.confDays(); } catch (e) {} return d.length ? d : ['26 Nov 2026', '27 Nov 2026', '28 Nov 2026']; };
  S.load = page => VR.api('adminListSlots', { page: page });
  S.fill = (sel, items, first, keep) => { const c = keep === false ? '' : $(sel).value; $(sel).innerHTML = (first === null ? '' : '<option value="">' + esc(first) + '</option>') + items.map(x => { const v = typeof x === 'string' ? x : x.v, t = typeof x === 'string' ? x : x.t; return '<option value="' + esc(v) + '">' + esc(t) + '</option>'; }).join(''); if (c) $(sel).value = c; };
  S.dayOpts = days => days.map((d, i) => ({ v: d, t: 'Day ' + (i + 1) + ' — ' + d }));

  // Ask for a reason in a small dialog. Resolves to the text, or null when cancelled.
  S.ask = (title, hint, required) => new Promise(resolve => {
    const d = document.createElement('div'); d.className = 'modal show';
    d.innerHTML = '<div class="box mid"><h3 style="margin-bottom:4px;">' + esc(title) + '</h3><p class="hint" style="margin-bottom:12px;">' + esc(hint || '') + '</p><div class="alert alert-error" id="sl-ae"></div>'
      + '<textarea id="sl-rt" rows="3" maxlength="200" placeholder="Reason" style="width:100%;"></textarea><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;"><button class="btn" id="sl-rc">Cancel</button><button class="btn btn-gold" id="sl-ro">Confirm</button></div></div>';
    document.body.appendChild(d); const t = d.querySelector('#sl-rt'); t.focus();
    const done = v => { d.remove(); resolve(v); };
    d.querySelector('#sl-rc').onclick = () => done(null);
    d.querySelector('#sl-ro').onclick = () => { const v = t.value.trim(); if (required && !v) { const a = d.querySelector('#sl-ae'); a.textContent = 'A reason is required.'; a.classList.add('show'); return; } done(v); };
  });
})();
