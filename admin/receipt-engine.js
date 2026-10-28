/* LVRMIC26 payment receipt engine (A4 portrait, 210 x 297 mm). Shared by the generate page and the report page. */
(function (w) {
  'use strict';
  var DEFAULTS = {
    theme: { primary: '#6b1020', accent: '#b08a2e', ink: '#1d1d1f' },
    logos: [{ src: '' }, { src: '' }],
    logoMm: 22,
    title: 'PAYMENT RECEIPT',
    org: { topLine: 'LIFE SCIENCES AND VECTOR RISK MANAGEMENT', topLine2: 'FOR A SUSTAINABLE HEALTHY ENVIRONMENT',
      dept: 'Advanced Zoology and Biotechnology', cimser: 'Centre for Insect Molecular Studies and Environmental Research (CIMSER)',
      college: 'Loyola College (Autonomous)', address: 'Chennai-600 034, Tamil Nadu, India.' },
    purpose: 'Registration fee ({{category}}) for {{conference}}',
    signMode: 'blank',                                  // signed | blank | none
    signatory: { name: 'Dr. M. Raja', title: 'Convener', src: '' },
    signMm: { w: 44, h: 19 },
    note: 'This is a computer-generated receipt.',
    mail: { subject: 'LVRMIC 2026 — Payment receipt {{receiptNo}}',
      body: 'Dear {{name}},\n\nThank you for registering for {{conference}}. Your payment receipt ({{receiptNo}}) is attached to this e-mail.\n\nWith regards,\nOrganising Committee, LVRMIC 2026\nAdvanced Zoology and Biotechnology, Loyola College (Autonomous), Chennai' }
  };
  function merge(a, b) {
    if (Array.isArray(a)) return b === undefined ? a.slice() : b;
    if (a && typeof a === 'object') { var o = {}, k; for (k in a) o[k] = merge(a[k], b ? b[k] : undefined); if (b) for (k in b) if (!(k in o)) o[k] = b[k]; return o; }
    return b === undefined ? a : b;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fill(t, d) { return String(t || '').replace(/\{\{(\w+)\}\}/g, function (m, k) { return d[k] !== undefined ? d[k] : m; }); }

  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'],
    TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
  function three(n) { return (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : ''); }
  function words(n) {                                   // Indian numbering: crore, lakh, thousand
    n = Math.floor(n); if (n === 0) return 'Zero';
    var parts = [], cr = Math.floor(n / 1e7), lk = Math.floor(n / 1e5) % 100, th = Math.floor(n / 1e3) % 100, rest = n % 1000;
    if (cr) parts.push(words(cr) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (rest) parts.push(three(rest));
    return parts.join(' ');
  }
  function amountWords(amount, cur) {
    var a = Math.round(Number(amount) * 100) / 100, r = Math.floor(a), p = Math.round((a - r) * 100), main = cur === 'USD' ? 'US Dollars' : 'Rupees', sub = cur === 'USD' ? 'Cents' : 'Paise';
    return main + ' ' + words(r) + (p ? ' and ' + words(p) + ' ' + sub : '') + ' Only';
  }
  function money(n, cur) { var s = Number(n).toLocaleString('en-IN', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }); return (cur === 'USD' ? 'USD ' : '₹ ') + s; }
  function dmy(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(iso || ''); }

  function css(t, logoMm, hasLogos) {
    return '.rc{position:relative;width:210mm;height:297mm;background:#fff;color:' + t.ink + ';overflow:hidden;box-sizing:border-box;font-family:"Cormorant Garamond","EB Garamond",Garamond,"Times New Roman",Times,serif}' +
      '.rc *{box-sizing:border-box;margin:0;padding:0}' +
      '.rc-b1{position:absolute;inset:7mm;border:1.4mm solid ' + t.primary + '}.rc-b2{position:absolute;inset:10mm;border:.4mm solid ' + t.accent + '}' +
      '.rc-wm{position:absolute;left:50%;top:50%;width:120mm;transform:translate(-50%,-50%);opacity:.05}' +
      '.rc-in{position:absolute;inset:15mm 17mm 13mm 17mm;display:flex;flex-direction:column}' +
      '.rc-head{position:relative;display:flex;align-items:center;justify-content:center;min-height:' + (logoMm + 2) + 'mm}' +
      '.rc-logos{position:absolute;left:0;top:0;display:flex;gap:3.5mm}.rc-logos img{height:' + logoMm + 'mm;width:auto;max-width:' + (logoMm * 1.3) + 'mm;object-fit:contain}' +
      '.rc-org{text-align:center;line-height:1.3;padding:0 0 0 ' + (hasLogos ? logoMm * 2 + 6 : 0) + 'mm}' +
      '.rc-t1{font-weight:700;font-size:12.5pt;letter-spacing:.2mm;color:' + t.primary + '}.rc-t2{font-weight:600;font-size:10.5pt;margin-top:.8mm}.rc-t3{font-weight:600;font-size:9.5pt}.rc-t4{font-style:italic;font-size:9pt;color:#444}' +
      '.rc-rule{height:.5mm;margin:4mm 0 0;background:linear-gradient(90deg,transparent,' + t.accent + ' 20%,' + t.accent + ' 80%,transparent)}' +
      '.rc-h{text-align:center;margin-top:7mm;font-weight:700;font-size:22pt;letter-spacing:1mm;color:' + t.primary + '}.rc-h:after{content:"";display:block;width:30mm;height:.7mm;margin:2mm auto 0;background:' + t.accent + '}' +
      '.rc-meta{display:flex;justify-content:space-between;margin-top:8mm;font-size:12.5pt}.rc-meta b{color:' + t.primary + '}' +
      '.rc-tb{width:100%;border-collapse:collapse;margin-top:6mm;font-size:12.5pt}.rc-tb td{border:.3mm solid #c9c0a8;padding:2.6mm 3.2mm;vertical-align:top;line-height:1.35}' +
      '.rc-tb td:first-child{width:46mm;background:#f7f3ea;font-weight:700;color:' + t.primary + '}' +
      '.rc-amt{margin-top:6mm;border:.5mm solid ' + t.primary + ';padding:4mm 5mm;display:flex;justify-content:space-between;align-items:center;gap:6mm}' +
      '.rc-amt .fig{font-size:21pt;font-weight:700;color:' + t.primary + ';white-space:nowrap}.rc-amt .wd{font-size:12pt;font-style:italic;line-height:1.35}' +
      '.rc-conf{margin-top:6mm;font-size:11pt;line-height:1.45;text-align:center;color:#333}.rc-conf b{color:' + t.ink + '}' +
      '.rc-sp{flex:1}' +
      '.rc-sign{align-self:flex-end;width:62mm;text-align:center;margin-bottom:4mm}.rc-sign .im{height:19mm;display:flex;align-items:flex-end;justify-content:center}.rc-sign img{max-height:19mm;max-width:44mm;object-fit:contain}' +
      '.rc-sign .ln{border-top:.35mm solid ' + t.ink + ';margin-top:1mm;padding-top:1.4mm}.rc-sign .nm{font-weight:700;font-size:12pt}.rc-sign .tt{font-size:10.5pt;color:#333}' +
      '.rc-foot{display:flex;justify-content:space-between;border-top:.3mm solid ' + t.accent + ';padding-top:2mm;font-size:9.5pt;color:#333}.rc-foot .no{font-weight:700;color:' + t.primary + ';letter-spacing:.2mm}.rc-foot i{text-align:right}';
  }
  /* d: {receiptNo,name,id,institution,email,category,type,txnDate,erpNo,txnId,amount,currency,mode,reference,purpose,billNo,conference,confDates,venue,site,contact} */
  function render(cfgIn, d) {
    var cfg = merge(DEFAULTS, cfgIn || {}), o = cfg.org, s = cfg.signatory, img = function (src) { return src ? '<img crossorigin="anonymous" src="' + esc(src) + '" onerror="this.style.display=\'none\'">' : ''; };
    var rows = [['Received with thanks from', '<b>' + esc(d.name) + '</b>'], ['Participant ID', esc(d.id)], ['Institution', esc(d.institution || '—')],
      ['Towards', esc(d.purpose || fill(cfg.purpose, { conference: d.conference || '' }))],
      d.type === 'ERP' ? ['ERP receipt number', esc(d.erpNo)] : ['Transaction ID', esc(d.txnId)],
      ['Mode of payment', esc(d.type === 'ERP' ? 'Online (Loyola ERP portal)' : (d.mode || '')) + (d.type !== 'ERP' && d.reference ? ' — ' + esc(d.reference) : '')],
      ['Date of transaction', esc(dmy(d.txnDate))]];
    if (d.currencyNote) rows.push(['Fee details', esc(d.currencyNote)]);
    var signed = cfg.signMode === 'signed', showSign = cfg.signMode !== 'none';
    var sign = showSign ? '<div class="rc-sign"><div class="im">' + (signed ? img(s.src) : '') + '</div><div class="ln"><div class="nm">' + esc(s.name) + '</div><div class="tt">' + esc(s.title) + '</div></div></div>' : '';
    return '<div class="rc"><style>' + css(cfg.theme, cfg.logoMm, cfg.logos.some(function (l) { return l && l.src; })) + '</style><div class="rc-b1"></div><div class="rc-b2"></div>' +
      (cfg.logos[1] && cfg.logos[1].src ? '<img class="rc-wm" crossorigin="anonymous" src="' + esc(cfg.logos[1].src) + '" onerror="this.style.display=\'none\'">' : '') +
      '<div class="rc-in"><div class="rc-head"><div class="rc-logos">' + cfg.logos.map(function (l) { return img(l && l.src); }).join('') + '</div><div class="rc-org">' +
      '<div class="rc-t1">' + esc(o.topLine) + '</div><div class="rc-t1" style="font-size:11pt">' + esc(o.topLine2) + '</div><div class="rc-t2">' + esc(o.dept) + '</div><div class="rc-t3">' + esc(o.cimser) + '</div><div class="rc-t4">' + esc(o.college) + ', ' + esc(o.address) + '</div></div></div>' +
      '<div class="rc-rule"></div><div class="rc-h">' + esc(cfg.title) + '</div>' +
      '<div class="rc-meta"><div><b>Receipt No.:</b> ' + esc(d.receiptNo) + '</div><div><b>Date:</b> ' + esc(dmy(d.txnDate)) + '</div></div>' +
      '<table class="rc-tb">' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
      '<div class="rc-amt"><div class="fig">' + esc(money(d.amount, d.currency)) + '</div><div class="wd">' + esc(amountWords(d.amount, d.currency)) + '</div></div>' +
      '<div class="rc-conf"><b>' + esc(d.conference || '') + '</b><br>' + esc(d.confDates || '') + (d.venue ? ' · ' + esc(d.venue) : '') + (d.site ? '<br>' + esc(d.site) : '') + (d.contact ? ' · ' + esc(d.contact) : '') + '</div>' +
      '<div class="rc-sp"></div>' + sign +
      '<div class="rc-foot"><div class="no">' + esc(d.receiptNo) + '</div><i>' + (cfg.signMode === 'none' || !cfg.note ? esc(cfg.note) : '') + '</i></div></div></div>';
  }
  function resolveAssets(cfg, fetchAsset) {
    var jobs = [];
    function one(obj, key) { var v = obj[key]; if (typeof v === 'string' && v.indexOf('asset:') === 0 && fetchAsset) jobs.push(fetchAsset(v.slice(6)).then(function (u) { obj[key] = u; }).catch(function () { obj[key] = ''; })); }
    cfg.logos.forEach(function (l) { one(l, 'src'); }); one(cfg.signatory, 'src'); return Promise.all(jobs).then(function () { return cfg; });
  }
  function shrinkImage(file, maxW, maxH, type) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onerror = rej; r.onload = function () { var im = new Image(); im.onload = function () {
      var k = Math.min(1, maxW / im.width, maxH / im.height), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ dataUrl: c.toDataURL(type || 'image/png', 0.92), w: c.width, h: c.height, ow: im.width, oh: im.height }); }; im.onerror = rej; im.src = r.result; }; r.readAsDataURL(file); });
  }
  function pdfFrom(cfg, items, onProgress) {
    var jsPDF = w.jspdf.jsPDF, host = document.createElement('div'), i = 0, pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    host.style.cssText = 'position:fixed;left:-99999px;top:0'; document.body.appendChild(host);
    function next() {
      if (i >= items.length) { host.remove(); return Promise.resolve(pdf); }
      host.innerHTML = render(cfg, items[i]); var el = host.firstChild;
      var imgs = Array.prototype.slice.call(el.querySelectorAll('img')).map(function (m) { return m.complete ? 0 : new Promise(function (r) { m.onload = m.onerror = r; }); });
      return Promise.all(imgs).then(function () { return document.fonts ? document.fonts.ready : 0; }).then(function () { return w.html2canvas(el, { scale: 2.2, useCORS: true, backgroundColor: '#ffffff', logging: false }); })
        .then(function (cv) { if (i > 0) pdf.addPage('a4', 'p'); pdf.addImage(cv.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST'); i++; if (onProgress) onProgress(i, items.length); return next(); });
    }
    return next();
  }
  function printHtml(cfg, items) {
    var pages = items.map(function (d) { return '<div class="pg">' + render(cfg, d) + '</div>'; }).join(''), wnd = w.open('', '_blank');
    wnd.document.write('<!doctype html><html><head><meta charset="utf-8"><title>LVRMIC26 Receipt</title><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">' +
      '<style>@page{size:A4 portrait;margin:0}html,body{margin:0;background:#fff}.pg{width:210mm;height:297mm;page-break-after:always;overflow:hidden}@media screen{body{background:#888;padding:10px}.pg{margin:0 auto 10px;box-shadow:0 0 8px #000}}</style></head><body>' + pages +
      '<script>window.onload=function(){setTimeout(function(){window.print()},700)}<\/script></body></html>'); wnd.document.close();
  }
  w.LVReceipt = { DEFAULTS: DEFAULTS, merge: merge, render: render, resolveAssets: resolveAssets, shrinkImage: shrinkImage, pdfFrom: pdfFrom, printHtml: printHtml, amountWords: amountWords, money: money, dmy: dmy, fill: fill, esc: esc };
})(window);
