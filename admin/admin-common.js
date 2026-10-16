/* VRMIC 2026 admin — shared helpers. Include with: <script src="admin-common.js"></script>
 *  VR.api(action, payload)            call the backend (adds token + visitor IP)
 *  VR.settings()                      public settings (cached 5 min) -> {conf name, dates, venues...}
 *  VR.confDays()                      ["26 Nov 2026", "27 Nov 2026", ...] built from the Settings dates
 *  VR.exportCSV / exportExcel / exportPDF / exportImage / printHtml   formatted exports
 */
(function () {
  const VR = (window.VR = {});
  VR.URL = 'https://script.google.com/macros/s/AKfycbwAkN1CF441d8ZtOykNIiM0oV1xaOF8lWzT2xKA3QufWBd71KvnoHR1LqRfFS3IoV4d/exec';
  VR.token = () => localStorage.getItem('vrmic_admin_token') || '';
  VR.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  VR.can = (m, a) => { try { const p = JSON.parse(localStorage.getItem('vrmic_admin_permissions') || '{}'); return !!(p[m] && p[m][a]); } catch (e) { return false; } };

  const ipP = (async () => { try { const r = await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip || ''; } catch (e) { return ''; } })();
  VR.ip = () => Promise.race([ipP, new Promise(r => setTimeout(() => r(''), 1500))]);
  VR.logout = () => { ['token', 'name', 'position', 'permissions', 'id', 'category', 'last_login'].forEach(k => localStorage.removeItem('vrmic_admin_' + k)); (window.top || window).location.href = '../admin-login.html'; };
  VR.api = async (action, payload) => {
    const ip = await VR.ip();
    const res = await fetch(VR.URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, token: VR.token(), ip }, payload || {})) });
    const j = await res.json();
    if (!j.ok && /session expired/i.test(j.error || '')) VR.logout();
    return j;
  };

  // ---- conference settings (public) ----
  VR.settings = async () => {
    try { const c = JSON.parse(sessionStorage.getItem('vrmic_pub') || 'null'); if (c && Date.now() - c.t < 300000) return c.s; } catch (e) {}
    try { const r = await fetch(VR.URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'getPublicSettings' }) }); const j = await r.json();
      if (j.ok) { sessionStorage.setItem('vrmic_pub', JSON.stringify({ t: Date.now(), s: j.settings })); return j.settings; } } catch (e) {}
    return {};
  };
  const fmt = (d, o) => d.toLocaleDateString('en-GB', Object.assign({ timeZone: 'Asia/Kolkata' }, o));
  VR.confDays = async () => {
    const s = await VR.settings(); if (!s['conf.startDate'] || !s['conf.endDate']) return [];
    const out = []; let d = new Date(s['conf.startDate'] + 'T00:00:00+05:30'); const end = new Date(s['conf.endDate'] + 'T00:00:00+05:30');
    while (d <= end && out.length < 31) { out.push(fmt(d, { day: 'numeric', month: 'short', year: 'numeric' })); d = new Date(d.getTime() + 86400000); }
    return out;
  };
  VR.confDates = async () => {
    const s = await VR.settings(); if (!s['conf.startDate']) return '';
    const a = new Date(s['conf.startDate'] + 'T00:00:00+05:30'), b = new Date((s['conf.endDate'] || s['conf.startDate']) + 'T00:00:00+05:30');
    const same = fmt(a, { month: 'long', year: 'numeric' }) === fmt(b, { month: 'long', year: 'numeric' });
    return same ? fmt(a, { day: 'numeric' }) + '–' + fmt(b, { day: 'numeric', month: 'long', year: 'numeric' }) : fmt(a, { day: 'numeric', month: 'long' }) + ' – ' + fmt(b, { day: 'numeric', month: 'long', year: 'numeric' });
  };
  VR.now = () => new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) + ' IST';

  // ---- exports (libraries load only when used) ----
  const libs = {};
  VR.load = src => libs[src] || (libs[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load export tool. Check your internet connection.')); document.head.appendChild(s); }));
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const clean = v => (v == null ? '' : String(v));
  VR.fileName = (base, ext) => 'VRMIC2026_' + base.replace(/[^A-Za-z0-9]+/g, '_') + '_' + stamp() + '.' + ext;

  VR.exportCSV = (base, headers, rows) => {
    const q = c => '"' + clean(c).replace(/"/g, '""') + '"';
    save(new Blob(['\ufeff' + [headers].concat(rows).map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }), VR.fileName(base, 'csv'));
  };
  VR.exportExcel = async (base, title, headers, rows) => {
    await VR.load(CDN + 'xlsx/0.18.5/xlsx.full.min.js');
    const s = await VR.settings();
    const aoa = [[(s['conf.shortName'] || 'VRMIC 2026') + ' — ' + title], ['Generated: ' + VR.now()], [], headers].concat(rows.map(r => r.map(clean)));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(48, Math.max(String(h).length, ...rows.slice(0, 200).map(r => clean(r[i]).length)) + 2) }));
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
    XLSX.writeFile(wb, VR.fileName(base, 'xlsx'));
  };
  // landscape A4 table with title, date and page numbers
  VR.exportPDF = async (base, title, headers, rows, opts) => {
    opts = opts || {};
    await VR.load(CDN + 'jspdf/2.5.1/jspdf.umd.min.js'); await VR.load(CDN + 'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    const s = await VR.settings();
    const doc = new window.jspdf.jsPDF({ orientation: opts.orientation || (headers.length > 6 ? 'landscape' : 'portrait'), unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    doc.setFontSize(13); doc.text((s['conf.name'] || 'VRMIC 2026'), 36, 34, { maxWidth: W - 72 });
    doc.setFontSize(11); doc.text(title, 36, 62); doc.setFontSize(8.5); doc.setTextColor(110); doc.text('Generated ' + VR.now() + '  ·  ' + rows.length + ' record(s)', 36, 76);
    doc.autoTable({ head: [headers], body: rows.map(r => r.map(clean)), startY: 88, margin: { left: 36, right: 36, bottom: 36 },
      styles: { fontSize: opts.fontSize || 8, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: [18, 32, 67], textColor: 255 }, alternateRowStyles: { fillColor: [245, 246, 250] },
      didDrawPage: () => { doc.setFontSize(8); doc.setTextColor(120); doc.text('Page ' + doc.internal.getNumberOfPages(), W - 36, doc.internal.pageSize.getHeight() - 16, { align: 'right' }); } });
    doc.save(VR.fileName(base, 'pdf'));
  };
  VR.exportImage = async (base, el) => {
    await VR.load(CDN + 'html2canvas/1.4.1/html2canvas.min.js');
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    await new Promise(r => canvas.toBlob(b => { save(b, VR.fileName(base, 'png')); r(); }, 'image/png'));
  };
  // prints an element (or html string) on a clean white page with a header
  VR.printHtml = async (title, html) => {
    const s = await VR.settings();
    const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + VR.esc(title) + '</title><style>@page{size:A4;margin:14mm}body{font:12px/1.45 Arial,sans-serif;color:#111}h1{font-size:15px;margin:0}h2{font-size:13px;margin:2px 0 10px;font-weight:600}.meta{color:#666;font-size:10px;margin-bottom:12px;border-bottom:1px solid #ccc;padding-bottom:8px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top;font-size:10.5px}th{background:#122043;color:#fff}tr{page-break-inside:avoid}img{max-width:100%}.noprint{display:none}</style></head><body><h1>' + VR.esc(s['conf.name'] || 'VRMIC 2026') + '</h1><h2>' + VR.esc(title) + '</h2><div class="meta">Generated ' + VR.now() + '</div>' + html + '</body></html>');
    w.document.close(); w.focus(); setTimeout(() => { w.print(); }, 400);
  };
  VR.tableHtml = (headers, rows) => '<table><thead><tr>' + headers.map(h => '<th>' + VR.esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + VR.esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';

  // drop-in "Export" button group: VR.exportBar(containerEl, {name, title, getData: () => ({headers, rows}), imageEl: () => element})
  VR.exportBar = (host, cfg) => {
    host.innerHTML = '<div class="xp" style="display:inline-flex;gap:6px;flex-wrap:wrap;">' + [['csv', 'fa-file-csv', 'CSV'], ['xlsx', 'fa-file-excel', 'Excel'], ['pdf', 'fa-file-pdf', 'PDF'], ['img', 'fa-image', 'Image'], ['print', 'fa-print', 'Print']]
      .filter(x => x[0] !== 'img' || cfg.imageEl).map(x => '<button type="button" class="btn btn-sm" data-x="' + x[0] + '" style="padding:8px 12px;font-size:12.5px;"><i class="fa-solid ' + x[1] + '"></i> ' + x[2] + '</button>').join('') + '</div>';
    host.onclick = async e => {
      const b = e.target.closest('[data-x]'); if (!b) return; const old = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
      try {
        const d = cfg.getData ? cfg.getData() : null, k = b.dataset.x;
        if (k === 'csv') VR.exportCSV(cfg.name, d.headers, d.rows);
        else if (k === 'xlsx') await VR.exportExcel(cfg.name, cfg.title, d.headers, d.rows);
        else if (k === 'pdf') { if (cfg.pdf) await cfg.pdf(); else await VR.exportPDF(cfg.name, cfg.title, d.headers, d.rows, cfg.pdfOpts); }
        else if (k === 'img') await VR.exportImage(cfg.name, cfg.imageEl());
        else if (k === 'print') { if (cfg.print) await cfg.print(); else await VR.printHtml(cfg.title, VR.tableHtml(d.headers, d.rows)); }
      } catch (er) { alert(er.message || 'Export failed.'); } finally { b.disabled = false; b.innerHTML = old; }
    };
  };
})();
