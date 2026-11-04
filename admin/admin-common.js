/* LVRMIC 2026 admin — shared helpers. Include with: <script src="admin-common.js"></script>
 *  VR.api(action, payload)            call the backend (adds token + visitor IP)
 *  VR.settings()                      public settings (cached 5 min) -> {conf name, dates, venues...}
 *  VR.confDays()                      ["26 Nov 2026", "27 Nov 2026", ...] built from the Settings dates
 *  VR.exportCSV / exportExcel / exportPDF / exportImage / printHtml   formatted exports
 *  PDF + Print share one letterhead (4 logos, centred titles, organiser lines, footer with generated-on + page numbers)
 */
(function () {
  const VR = (window.VR = {});
  VR.URL = 'https://script.google.com/macros/s/AKfycbwAkN1CF441d8ZtOykNIiM0oV1xaOF8lWzT2xKA3QufWBd71KvnoHR1LqRfFS3IoV4d/exec';
  // ---- where things live (change here ONLY if the site folders move) ----
  VR.LOGIN_URL = '/admin-login.html';   // https://vrmic26.vercel.app/vrmic26/admin-login.html
  VR.HOME_URL  = '/admin/home.html';            // https://vrmic26.vercel.app/admin/home.html
  VR.token = () => localStorage.getItem('vrmic_admin_token') || '';
  VR.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  VR.can = (m, a) => { try { const p = JSON.parse(localStorage.getItem('vrmic_admin_permissions') || '{}'); return !!(p[m] && p[m][a]); } catch (e) { return false; } };

  const ipP = (async () => { try { const r = await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip || ''; } catch (e) { return ''; } })();
  VR.ip = () => Promise.race([ipP, new Promise(r => setTimeout(() => r(''), 1500))]);
  VR.logout = () => { ['token', 'name', 'position', 'permissions', 'id', 'category', 'last_login', 'menu_open'].forEach(k => localStorage.removeItem('vrmic_admin_' + k)); sessionStorage.removeItem('vrmic_pub'); (window.top || window).location.href = VR.LOGIN_URL; };
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
  VR.fileName = (base, ext) => 'LVRMIC2026_' + base.replace(/[^A-Za-z0-9]+/g, '_') + '_' + stamp() + '.' + ext;

  VR.exportCSV = (base, headers, rows) => {
    const q = c => '"' + clean(c).replace(/"/g, '""') + '"';
    save(new Blob(['\ufeff' + [headers].concat(rows).map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }), VR.fileName(base, 'csv'));
  };
  VR.exportExcel = async (base, title, headers, rows) => {
    await VR.load(CDN + 'xlsx/0.18.5/xlsx.full.min.js');
    const s = await VR.settings();
    const aoa = [[(s['conf.shortName'] || 'LVRMIC 2026') + ' — ' + title], ['Generated: ' + VR.now()], [], headers].concat(rows.map(r => r.map(clean)));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map((h, i) => ({ wch: Math.min(48, Math.max(String(h).length, ...rows.slice(0, 200).map(r => clean(r[i]).length)) + 2) }));
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
    XLSX.writeFile(wb, VR.fileName(base, 'xlsx'));
  };

  // ---- letterhead used by PDF + Print ----
  VR.LOGOS = [
    'https://lvrmic26.vercel.app/assets/loyola-crest.png',
    'https://lvrmic26.vercel.app/assets/cimser-logo.png',
    'https://lvrmic26.vercel.app/assets/iaes-logo.png',
    'https://lvrmic26.vercel.app/assets/ahcf-logo.png'
  ];
  VR.ORG_1 = 'Organized by CIMSER, Loyola College';
  VR.ORG_2 = 'in association with IAES, Haridwar and AHCF, New Delhi';

  // loads the logos once and converts them to PNG data for jsPDF (a failed logo is skipped, never blocks the export)
  const logoCache = {};
  VR.logoData = () => logoCache.p || (logoCache.p = Promise.all(VR.LOGOS.map(src => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); res({ data: c.toDataURL('image/png'), w: c.width, h: c.height }); } catch (e) { res(null); } };
    im.onerror = () => res(null);
    im.src = src;
  }))).then(r => { if (!r.some(Boolean)) logoCache.p = null; return r; }));

  // A4 table: logos row, centred titles, organiser lines, table, then footer (generated on / records / page x of y) on every page
  VR.exportPDF = async (base, title, headers, rows, opts) => {
    opts = opts || {};
    await VR.load(CDN + 'jspdf/2.5.1/jspdf.umd.min.js'); await VR.load(CDN + 'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    const [s, logos] = await Promise.all([VR.settings(), VR.logoData()]);
    const doc = new window.jspdf.jsPDF({ orientation: opts.orientation || (headers.length > 6 ? 'landscape' : 'portrait'), unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36, mid = W / 2;
    let y = M;

    // logos, evenly spaced and vertically centred
    const ok = logos.filter(Boolean), LH = 46, slot = (W - 2 * M) / Math.max(ok.length, 1);
    ok.forEach((l, i) => {
      let h = LH, w = l.w * h / l.h; const mw = slot - 24;
      if (w > mw) { w = mw; h = w * l.h / l.w; }
      doc.addImage(l.data, 'PNG', M + slot * i + (slot - w) / 2, y + (LH - h) / 2, w, h);
    });
    if (ok.length) y += LH + 16;

    // centred titles
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(18, 32, 67);
    const nameLines = doc.splitTextToSize(s['conf.name'] || 'LVRMIC 2026', W - 2 * M);
    y += 12; doc.text(nameLines, mid, y, { align: 'center' }); y += (nameLines.length - 1) * 17;
    doc.setFontSize(12); doc.setTextColor(30); y += 18; doc.text(title, mid, y, { align: 'center', maxWidth: W - 2 * M });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(95);
    y += 15; doc.text(VR.ORG_1, mid, y, { align: 'center' });
    y += 12; doc.text(VR.ORG_2, mid, y, { align: 'center' });
    y += 10; doc.setDrawColor(18, 32, 67); doc.setLineWidth(1); doc.line(M, y, W - M, y);

    doc.autoTable({ head: [headers], body: rows.map(r => r.map(clean)), startY: y + 12, margin: { top: M, left: M, right: M, bottom: 52 },
      styles: { fontSize: opts.fontSize || 8, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: [18, 32, 67], textColor: 255 }, alternateRowStyles: { fillColor: [245, 246, 250] } });

    // footer on every page
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setDrawColor(190); doc.setLineWidth(0.5); doc.line(M, H - 40, W - M, H - 40);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
      doc.text('Generated ' + VR.now() + '  ·  ' + rows.length + ' record(s)', M, H - 26);
      doc.text('Page ' + i + ' of ' + n, W - M, H - 26, { align: 'right' });
    }
    doc.save(VR.fileName(base, 'pdf'));
  };

  VR.exportImage = async (base, el) => {
    await VR.load(CDN + 'html2canvas/1.4.1/html2canvas.min.js');
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    await new Promise(r => canvas.toBlob(b => { save(b, VR.fileName(base, 'png')); r(); }, 'image/png'));
  };

  // prints on a clean white page with the same letterhead; footer repeats on every page
  VR.printHtml = async (title, html, opts) => {
    opts = opts || {};
    const s = await VR.settings();
    const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
    const imgs = VR.LOGOS.map(u => '<img src="' + u + '" alt="">').join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + VR.esc(title) + '</title><style>'
      + '@page{size:A4 ' + (opts.orientation === 'landscape' ? 'landscape' : 'portrait') + ';margin:12mm 12mm 16mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9px Arial,sans-serif;color:#666}}'
      + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + 'body{font:12px/1.45 Arial,sans-serif;color:#111;margin:0}'
      + '.lay{width:100%;border-collapse:collapse}.lay>thead>tr>td,.lay>tbody>tr>td,.lay>tfoot>tr>td{border:0;padding:0}.lay>tfoot{display:table-footer-group}'
      + '.logos{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:10px}.logos img{height:54px;max-width:23%;object-fit:contain}'
      + '.hd{text-align:center;border-bottom:2px solid #122043;padding-bottom:8px;margin-bottom:12px}'
      + '.hd h1{font-size:17px;margin:0 0 4px;color:#122043}.hd h2{font-size:13px;margin:0 0 5px;font-weight:600}.hd .org{font-size:10.5px;color:#555;line-height:1.5}'
      + '.body table{border-collapse:collapse;width:100%}.body th,.body td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top;font-size:10.5px}.body th{background:#122043;color:#fff}.body tr{page-break-inside:avoid}.body img{max-width:100%}.noprint{display:none}'
      + '.ft{margin-top:10px;border-top:1px solid #bbb;padding-top:5px;font-size:9px;color:#666}'
      + '</style></head><body><table class="lay"><tbody><tr><td>'
      + '<div class="logos">' + imgs + '</div>'
      + '<div class="hd"><h1>' + VR.esc(s['conf.name'] || 'LVRMIC 2026') + '</h1><h2>' + VR.esc(title) + '</h2><div class="org">' + VR.esc(VR.ORG_1) + '<br>' + VR.esc(VR.ORG_2) + '</div></div>'
      + '<div class="body">' + html + '</div>'
      + '</td></tr></tbody><tfoot><tr><td><div class="ft">Generated ' + VR.now() + '</div></td></tr></tfoot></table></body></html>');
    w.document.close(); w.focus();
    // wait for the logos so they are not blank in the print preview
    await Promise.race([Promise.all([...w.document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 3000))]);
    setTimeout(() => { w.print(); }, 200);
  };
  VR.tableHtml = (headers, rows) => '<table><thead><tr>' + headers.map(h => '<th>' + VR.esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + VR.esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';

  // drop-in "Export" button group: VR.exportBar(containerEl, {name, title, getData: () => ({headers, rows}), imageEl: () => element, pdfOpts})
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
        else if (k === 'print') { if (cfg.print) await cfg.print(); else await VR.printHtml(cfg.title, VR.tableHtml(d.headers, d.rows), cfg.pdfOpts); }
      } catch (er) { alert(er.message || 'Export failed.'); } finally { b.disabled = false; b.innerHTML = old; }
    };
  };
})();
