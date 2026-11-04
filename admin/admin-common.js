/* LVRMIC 2026 admin — shared helpers. Include with: <script src="admin-common.js"></script>
 *  VR.api(action, payload)            call the backend (adds token + visitor IP)
 *  VR.settings()                      public settings (cached 5 min) -> {conf name, dates, venues...}
 *  VR.confDays()                      ["26 Nov 2026", "27 Nov 2026", ...] built from the Settings dates
 *  VR.exportCSV / exportExcel / exportPDF / exportImage / printHtml   formatted exports
 *  Every export (CSV, Excel, PDF, Image, Print) carries the same letterhead: logos (where the format allows),
 *  centred conference name + report title, organiser lines, and a footer with generated-on + record count.
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
  VR.load = src => libs[src] || (libs[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete libs[src]; rej(new Error('Could not load export tool. Check your internet connection.')); }; document.head.appendChild(s); }));
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const clean = v => (v == null ? '' : String(v));
  VR.fileName = (base, ext) => 'LVRMIC2026_' + base.replace(/[^A-Za-z0-9]+/g, '_') + '_' + stamp() + '.' + ext;

  // ---- letterhead shared by every export ----
  VR.LOGOS = [
    'https://lvrmic26.vercel.app/assets/loyola-crest.png',
    'https://lvrmic26.vercel.app/assets/cimser-logo.png',
    'https://lvrmic26.vercel.app/assets/iaes-logo.png',
    'https://lvrmic26.vercel.app/assets/ahcf-logo.png'
  ];
  VR.ORG_1 = 'Organized by CIMSER, Loyola College';
  VR.ORG_2 = 'in association with IAES, Haridwar and AHCF, New Delhi';
  const confName = s => s['conf.name'] || 'LVRMIC 2026';
  const footTxt = n => 'Generated ' + VR.now() + '  ·  ' + n + ' record(s)';

  // loads the logos once and converts them to PNG data (a failed logo is skipped, never blocks the export)
  const logoCache = {};
  VR.logoData = () => logoCache.p || (logoCache.p = Promise.all(VR.LOGOS.map(src => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); res({ data: c.toDataURL('image/png'), w: c.width, h: c.height }); } catch (e) { res(null); } };
    im.onerror = () => res(null);
    im.src = src;
  }))).then(r => { if (!r.some(Boolean)) logoCache.p = null; return r; }));

  // HTML letterhead + styles, used by Print and Image (everything is scoped under .vrx)
  const LH_CSS = '.vrx{font:12px/1.45 Arial,sans-serif;color:#111;background:#fff}'
    + '.vrx .logos{display:flex;justify-content:center;align-items:center;gap:28px;margin-bottom:10px}.vrx .logos img{height:54px;width:auto;max-width:22%;object-fit:contain}'
    + '.vrx .hd{text-align:center;border-bottom:2px solid #122043;padding-bottom:8px;margin-bottom:12px}'
    + '.vrx .hd h1{font-size:17px;margin:0 0 4px;color:#122043}.vrx .hd h2{font-size:13px;margin:0 0 5px;font-weight:600;color:#111}.vrx .hd .org{font-size:10.5px;color:#555;line-height:1.5}'
    + '.vrx table{border-collapse:collapse;width:100%}.vrx th,.vrx td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top;font-size:10.5px;color:#111;background:#fff}.vrx th{background:#122043;color:#fff}.vrx tr{page-break-inside:avoid}.vrx img{max-width:100%}.vrx .noprint{display:none}'
    + '.vrx .ft{border-top:1px solid #bbb;padding-top:5px;font-size:9px;color:#666}';
  const lhHtml = (s, title) => '<div class="logos">' + VR.LOGOS.map(u => '<img src="' + u + '" alt="" crossorigin="anonymous">').join('') + '</div>'
    + '<div class="hd"><h1>' + VR.esc(confName(s)) + '</h1><h2>' + VR.esc(title) + '</h2><div class="org">' + VR.esc(VR.ORG_1) + '<br>' + VR.esc(VR.ORG_2) + '</div></div>';
  const imagesReady = (doc, ms) => Promise.race([Promise.all([...doc.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, ms || 3000))]);

  // ---- CSV: letterhead rows on top, generated line at the bottom ----
  VR.exportCSV = async (base, headers, rows, title) => {
    const s = await VR.settings();
    const q = c => '"' + clean(c).replace(/"/g, '""') + '"';
    const top = [[confName(s)], [title || base], [VR.ORG_1], [VR.ORG_2], []];
    const all = top.concat([headers], rows, [[]], [[footTxt(rows.length)]]);
    save(new Blob(['\ufeff' + all.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }), VR.fileName(base, 'csv'));
  };

  // ---- Excel: logos + centred titles + styled table + footer (built with ExcelJS so the logos can be embedded) ----
  VR.exportExcel = async (base, title, headers, rows) => {
    await VR.load(CDN + 'exceljs/4.4.0/exceljs.min.js');
    const [s, logos] = await Promise.all([VR.settings(), VR.logoData()]);
    const n = Math.max(headers.length, 1), px = w => Math.round(w * 7 + 5);
    const wch = headers.map((h, i) => Math.min(48, Math.max(String(h).length, ...rows.slice(0, 200).map(r => clean(r[i]).length)) + 2));
    const sheetPx = wch.reduce((t, w) => t + px(w), 0);
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '), {
      pageSetup: { orientation: n > 6 ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .4, right: .4, top: .5, bottom: .7, header: .3, footer: .3 } },
      headerFooter: { oddFooter: '&L&8' + footTxt(rows.length).replace(/&/g, '&&') + '&R&8Page &P of &N' }
    });
    wch.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    // rows 1-3: logo band · 4: conference · 5: report title · 6-7: organiser · 8: spacer · 9: table header
    [1, 2, 3].forEach(r => { ws.getRow(r).height = 18; });
    const band = (r, text, font, ht) => { ws.mergeCells(r, 1, r, n); const c = ws.getCell(r, 1); c.value = text; c.font = font; c.alignment = { horizontal: 'center', vertical: 'middle' }; if (ht) ws.getRow(r).height = ht; };
    band(4, confName(s), { name: 'Arial', size: 15, bold: true, color: { argb: 'FF122043' } }, 24);
    band(5, title, { name: 'Arial', size: 12, bold: true }, 20);
    band(6, VR.ORG_1, { name: 'Arial', size: 9, color: { argb: 'FF555555' } }, 14);
    band(7, VR.ORG_2, { name: 'Arial', size: 9, color: { argb: 'FF555555' } }, 14);
    for (let c = 1; c <= n; c++) ws.getCell(7, c).border = { bottom: { style: 'medium', color: { argb: 'FF122043' } } };
    ws.getRow(8).height = 8;

    // logos side by side as one centred group
    const ok = logos.filter(Boolean);
    if (ok.length) {
      const LHp = 54, GAP = 24; let total = ok.reduce((t, l) => t + l.w * LHp / l.h, 0) + GAP * (ok.length - 1), sc = 1;
      if (total > sheetPx - 20) { sc = (sheetPx - 20) / total; total = sheetPx - 20; }
      let x = Math.max(0, (sheetPx - total) / 2); const h = LHp * sc;
      const colAt = p => { let i = 0, acc = 0; for (; i < n; i++) { const w = px(wch[i]); if (p < acc + w) break; acc += w; } return i < n ? i + (p - acc) / px(wch[i]) : n - 0.001; };
      ok.forEach(l => {
        const w = l.w * h / l.h, id = wb.addImage({ base64: l.data, extension: 'png' });
        ws.addImage(id, { tl: { col: colAt(x), row: 0.08 }, ext: { width: w, height: h } });
        x += w + GAP * sc;
      });
    }

    const hr = ws.getRow(9); hr.height = 20;
    headers.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = clean(h); c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF122043' } }; c.alignment = { vertical: 'middle', wrapText: true }; c.border = { top: { style: 'thin', color: { argb: 'FFBBBBBB' } }, left: { style: 'thin', color: { argb: 'FFBBBBBB' } }, bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } }, right: { style: 'thin', color: { argb: 'FFBBBBBB' } } }; });
    rows.forEach((r, ri) => {
      const row = ws.getRow(10 + ri);
      for (let i = 0; i < n; i++) { const c = row.getCell(i + 1); c.value = clean(r[i]); c.font = { name: 'Arial', size: 10 }; c.alignment = { vertical: 'top', wrapText: true }; c.border = { top: { style: 'thin', color: { argb: 'FFDDDDDD' } }, left: { style: 'thin', color: { argb: 'FFDDDDDD' } }, bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } }, right: { style: 'thin', color: { argb: 'FFDDDDDD' } } }; if (ri % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6FA' } }; }
    });
    const fr = 10 + rows.length + 1; ws.mergeCells(fr, 1, fr, n);
    const fc = ws.getCell(fr, 1); fc.value = footTxt(rows.length); fc.font = { name: 'Arial', size: 9, color: { argb: 'FF666666' } }; fc.alignment = { horizontal: 'left' };
    ws.views = [{ state: 'frozen', ySplit: 9 }];
    ws.pageSetup.printTitlesRow = '9:9';

    const buf = await wb.xlsx.writeBuffer();
    save(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), VR.fileName(base, 'xlsx'));
  };

  // ---- PDF: logos row, centred titles, organiser lines, table, footer (generated on / records / page x of y) on every page ----
  VR.exportPDF = async (base, title, headers, rows, opts) => {
    opts = opts || {};
    await VR.load(CDN + 'jspdf/2.5.1/jspdf.umd.min.js'); await VR.load(CDN + 'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    const [s, logos] = await Promise.all([VR.settings(), VR.logoData()]);
    const doc = new window.jspdf.jsPDF({ orientation: opts.orientation || (headers.length > 6 ? 'landscape' : 'portrait'), unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36, mid = W / 2;
    let y = M;

    // logos side by side as one centred group, same height, fixed gap between them
    const ok = logos.filter(Boolean), GAP = 28, LH = 46;
    if (ok.length) {
      let sc = 1, total = ok.reduce((t, l) => t + l.w * LH / l.h, 0) + GAP * (ok.length - 1);
      if (total > W - 2 * M) { sc = (W - 2 * M) / total; total = W - 2 * M; }
      let x = mid - total / 2; const h = LH * sc;
      ok.forEach(l => { const w = l.w * h / l.h; doc.addImage(l.data, 'PNG', x, y + (LH - h) / 2, w, h); x += w + GAP * sc; });
      y += LH + 16;
    }

    // centred titles
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(18, 32, 67);
    const nameLines = doc.splitTextToSize(confName(s), W - 2 * M);
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
      doc.text(footTxt(rows.length), M, H - 26);
      doc.text('Page ' + i + ' of ' + n, W - M, H - 26, { align: 'right' });
    }
    doc.save(VR.fileName(base, 'pdf'));
  };

  // ---- Image (PNG): same letterhead + a clean white table. Uses the data when given, else captures the element ----
  VR.exportImage = async (base, el, title, d) => {
    await VR.load(CDN + 'html2canvas/1.4.1/html2canvas.min.js');
    const s = await VR.settings();
    const host = document.createElement('div');
    host.className = 'vrx';
    host.style.cssText = 'position:fixed;left:-20000px;top:0;padding:24px;box-sizing:border-box;width:' + Math.max(1100, ((d && d.headers.length) || 8) * 120) + 'px;';
    host.innerHTML = '<style>' + LH_CSS + '</style>' + lhHtml(s, title || base)
      + (d ? VR.tableHtml(d.headers, d.rows) : '<div id="vrx-el"></div>')
      + '<div class="ft" style="margin-top:12px;">' + VR.esc(footTxt(d ? d.rows.length : '—')) + '</div>';
    document.body.appendChild(host);
    try {
      if (!d && el) { const c = el.cloneNode(true); c.style.overflow = 'visible'; host.querySelector('#vrx-el').appendChild(c); }
      await imagesReady(document, 4000);
      const canvas = await html2canvas(host, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      await new Promise(r => canvas.toBlob(b => { save(b, VR.fileName(base, 'png')); r(); }, 'image/png'));
    } finally { host.remove(); }
  };

  // ---- Print: clean white page with the same letterhead; "Generated" footer fixed at the bottom of EVERY page ----
  VR.printHtml = async (title, html, opts) => {
    opts = opts || {};
    const s = await VR.settings();
    const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to print.'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + VR.esc(title) + '</title><style>'
      + '@page{size:A4 ' + (opts.orientation === 'landscape' ? 'landscape' : 'portrait') + ';margin:12mm 12mm 18mm;@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9px Arial,sans-serif;color:#666}}'
      + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}'
      + LH_CSS
      + '.lay{width:100%;border-collapse:collapse}.lay>tbody>tr>td,.lay>tfoot>tr>td{border:0;padding:0;background:none}.lay>tfoot{display:table-footer-group}.lay .sp{height:9mm}'
      + '.vrx .ft.fix{position:fixed;left:0;right:0;bottom:0;background:#fff}'
      + '</style></head><body><div class="vrx">'
      + '<table class="lay"><tbody><tr><td>' + lhHtml(s, title) + '<div class="body">' + html + '</div></td></tr></tbody>'
      + '<tfoot><tr><td><div class="sp"></div></td></tr></tfoot></table>'
      + '<div class="ft fix">' + VR.esc(footTxt(opts.count != null ? opts.count : (html.match(/<tbody>[\s\S]*<\/tbody>/) || [''])[0].split('<tr>').length - 1)) + '</div>'
      + '</div></body></html>');
    w.document.close(); w.focus();
    await imagesReady(w.document, 3000);   // wait for the logos so they are not blank in the print preview
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
        if (k === 'csv') await VR.exportCSV(cfg.name, d.headers, d.rows, cfg.title);
        else if (k === 'xlsx') await VR.exportExcel(cfg.name, cfg.title, d.headers, d.rows);
        else if (k === 'pdf') { if (cfg.pdf) await cfg.pdf(); else await VR.exportPDF(cfg.name, cfg.title, d.headers, d.rows, cfg.pdfOpts); }
        else if (k === 'img') await VR.exportImage(cfg.name, cfg.imageEl(), cfg.title, d);
        else if (k === 'print') { if (cfg.print) await cfg.print(); else await VR.printHtml(cfg.title, VR.tableHtml(d.headers, d.rows), Object.assign({ count: d.rows.length }, cfg.pdfOpts)); }
      } catch (er) { alert(er.message || 'Export failed.'); } finally { b.disabled = false; b.innerHTML = old; }
    };
  };
})();
