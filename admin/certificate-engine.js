/* LVRMIC26 Attendance Certificate engine — shared by config, generate and report pages.
   A4 landscape = 297 x 210 mm. Everything is laid out in mm so print/PDF match the preview. */
(function (w) {
  'use strict';
  var DEFAULTS = {
    theme: { primary: '#6b1020', accent: '#b08a2e', ink: '#1d1d1f' },
    orientation: 'landscape',            // landscape | portrait
    logos: [                              // both logos stay on ONE side (left)
      { src: '', alt: 'Loyola College' },
      { src: '', alt: 'CIMSER' }
    ],
    logoSide: 'left',                     // left | right
    logoMm: 24,
    background: '',                       // optional full-page image (A4 300dpi)
    watermark: true,
    org: {
      topLine: 'LIFE SCIENCES AND VECTOR RISK MANAGEMENT',
      topLine2: 'FOR A SUSTAINABLE HEALTHY ENVIRONMENT',
      dept: 'Advanced Zoology and Biotechnology',
      cimser: 'Centre for Insect Molecular Studies and Environmental Research (CIMSER)',
      college: 'Loyola College (Autonomous)',
      address: 'Chennai-600 034, Tamil Nadu, India.'
    },
    heading: 'ATTENDANCE CERTIFICATE',
    body: 'This is to certify that {{name}} of {{institution}} has attended the {{conference}} conducted by {{department}}, Loyola College, Chennai held during {{dates}}.',
    conference: 'LIFE SCIENCES AND VECTOR RISK MANAGEMENT FOR A SUSTAINABLE HEALTHY ENVIRONMENT',
    department: 'Advanced Zoology and Biotechnology',
    dates: '',                            // blank = taken from Settings start/end date (dd-mm-yyyy to dd-mm-yyyy)
    font: { family: 'serif', body: 5.2, name: 8, heading: 9 }, // mm-ish scale in pt below
    bodyPt: 17, headingPt: 27, titlePt: 19, align: 'center',
    nudge: { header: 0, heading: 0, body: 0, signs: 0, footer: 0 }, // mm offsets
    signMode: 'none',                     // none | signed | blank   (none = computer-generated line)
    slots: [
      { id: 'convener',   label: 'Convener',                 on: false, name: 'Dr. M. Raja',  title: 'Convener',                       src: '' },
      { id: 'coconvener', label: 'Co-Convener',              on: false, name: '',             title: 'Co-Convener',                    src: '' },
      { id: 'hod',        label: 'Head of the Department',   on: false, name: '',             title: 'Head, Advanced Zoology and Biotechnology', src: '' },
      { id: 'principal',  label: 'Principal',                on: false, name: '',             title: 'Principal, Loyola College (Autonomous)', src: '' }
    ],
    signMm: { w: 42, h: 18 },
    noSignLine: 'This is a computer-generated certificate. No signature is required.',
    showCertNo: true,
    mail: {
      subject: 'LVRMIC 2026 — Your Attendance Certificate ({{certNo}})',
      body: 'Dear {{name}},\n\nThank you for attending {{conference}}. Your attendance certificate ({{certNo}}) is attached to this email.\n\nYou can also open it here: {{link}}\n\nWith regards,\nOrganising Committee, LVRMIC 2026\nAdvanced Zoology and Biotechnology, Loyola College (Autonomous), Chennai'
    }
  };

  function merge(a, b) {
    if (Array.isArray(a)) return b === undefined ? a.slice() : b;
    if (a && typeof a === 'object') {
      var o = {}, k;
      for (k in a) o[k] = merge(a[k], b ? b[k] : undefined);
      if (b) for (k in b) if (!(k in o)) o[k] = b[k];
      return o;
    }
    return b === undefined ? a : b;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function bodyHtml(cfg, d) {
    var map = { name: d.name, institution: d.institution, id: d.id, conference: cfg.conference, department: cfg.department, dates: cfg.dates, type: 'Participant' };
    return esc(cfg.body).replace(/\{\{(\w+)\}\}/g, function (m, k) {
      var v = map[k]; if (v == null) return m;
      var strong = (k === 'name' || k === 'institution' || k === 'conference');
      return strong ? '<b class="v v-' + k + '">' + esc(v) + '</b>' : (k === 'dates' ? '<span style="white-space:nowrap">' + esc(v) + '</span>' : esc(v));
    });
  }

  function css(cfg) {
    var t = cfg.theme, L = cfg.orientation !== 'portrait', W = L ? 297 : 210, H = L ? 210 : 297, n = cfg.nudge;
    return '' +
      '.lv-cert{position:relative;width:' + W + 'mm;height:' + H + 'mm;background:#fff;color:' + t.ink + ';overflow:hidden;box-sizing:border-box;font-family:"Cormorant Garamond","EB Garamond",Garamond,"Times New Roman",Times,serif}' +
      '.lv-cert *{box-sizing:border-box;margin:0;padding:0}' +
      '.lv-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
      '.lv-b1{position:absolute;inset:6mm;border:1.6mm solid ' + t.primary + '}' +
      '.lv-b2{position:absolute;inset:9.2mm;border:.45mm solid ' + t.accent + '}' +
      '.lv-corner{position:absolute;width:9mm;height:9mm;border:.45mm solid ' + t.accent + ';background:#fff}' +
      '.lv-wm{position:absolute;left:50%;top:52%;width:' + (L ? 120 : 130) + 'mm;transform:translate(-50%,-50%);opacity:.06}' +
      '.lv-in{position:absolute;inset:14mm 16mm 12mm 16mm;display:flex;flex-direction:column}' +
      '.lv-head{position:relative;display:flex;align-items:center;justify-content:center;min-height:' + (cfg.logoMm + 2) + 'mm;margin-top:' + n.header + 'mm}' +
      '.lv-logos{position:absolute;top:0;' + (cfg.logoSide === 'right' ? 'right' : 'left') + ':0;display:flex;gap:4mm;align-items:center}' +
      '.lv-logos img{height:' + cfg.logoMm + 'mm;width:auto;max-width:' + (cfg.logoMm * 1.4) + 'mm;object-fit:contain}' +
      '.lv-org{text-align:center;line-height:1.28;padding:0 ' + (cfg.logoMm * 2 + 8) + 'mm}' +
      '.lv-t1{font-weight:700;font-size:' + (cfg.titlePt - 5) + 'pt;letter-spacing:.25mm;color:' + t.primary + '}' +
      '.lv-t2{font-weight:600;font-size:' + (cfg.titlePt - 9) + 'pt;color:' + t.ink + ';margin-top:1mm}' +
      '.lv-t3{font-weight:600;font-size:' + (cfg.titlePt - 10) + 'pt;color:' + t.ink + '}' +
      '.lv-t4{font-style:italic;font-size:' + (cfg.titlePt - 10) + 'pt;color:#444}' +
      '.lv-rule{height:.5mm;margin:3.5mm 0 0;background:linear-gradient(90deg,transparent,' + t.accent + ' 20%,' + t.accent + ' 80%,transparent)}' +
      '.lv-h{text-align:center;margin-top:' + (7 + n.heading) + 'mm;font-weight:700;font-size:' + cfg.headingPt + 'pt;letter-spacing:1.1mm;color:' + t.primary + '}' +
      '.lv-h:after{content:"";display:block;width:34mm;height:.7mm;margin:2.2mm auto 0;background:' + t.accent + '}' +
      '.lv-mid{flex:1;display:flex;align-items:center;justify-content:center;padding-top:' + Math.max(0, n.body) + 'mm}' +
      '.lv-body{margin:0 auto;width:' + (L ? 232 : 160) + 'mm;text-align:' + cfg.align + ';font-size:' + cfg.bodyPt + 'pt;line-height:1.75;font-weight:500;text-align-last:' + (cfg.align === 'justify' ? 'center' : cfg.align) + '}' +
      '.lv-body b{font-weight:700}' +
      '.lv-body .v-name{font-size:' + (cfg.bodyPt + 3) + 'pt;color:' + t.primary + '}' +
            '.lv-signs{display:flex;justify-content:' + (cfg.slots.filter(function (s) { return s.on; }).length > 1 ? 'space-between' : 'center') + ';align-items:flex-start;margin-bottom:' + (3 - n.signs) + 'mm;padding:0 6mm}' +
      '.lv-sg{width:' + (cfg.signMm.w + 22) + 'mm;text-align:center}' +
      '.lv-sg .im{height:' + cfg.signMm.h + 'mm;display:flex;align-items:flex-end;justify-content:center}' +
      '.lv-sg img{max-height:' + cfg.signMm.h + 'mm;max-width:' + cfg.signMm.w + 'mm;object-fit:contain}' +
      '.lv-sg .ln{border-top:.35mm solid ' + t.ink + ';margin-top:1mm;padding-top:1.4mm}' +
      '.lv-sg .nm{font-weight:700;font-size:12pt;line-height:1.2}' +
      '.lv-sg .tt{font-size:10.5pt;line-height:1.2;color:#333}' +
      '.lv-foot{display:flex;justify-content:space-between;align-items:center;border-top:.3mm solid ' + t.accent + ';padding-top:2.2mm;font-size:10pt;color:#333;margin-top:' + (2 - n.footer) + 'mm}' +
      '.lv-foot .no{font-weight:700;letter-spacing:.2mm;color:' + t.primary + '}' +
      '.lv-foot .cg{font-style:italic;text-align:right}' +
      '.lv-print{page-break-after:always}';
  }

  /* d = {id,name,institution,certNo}; returns an HTML string for ONE certificate */
  function render(cfgIn, d) {
    var cfg = merge(DEFAULTS, cfgIn || {}), o = cfg.org, on = cfg.slots.filter(function (s) { return s.on; });
    var signed = cfg.signMode === 'signed', blank = cfg.signMode === 'blank', hasSigns = (signed || blank) && on.length;
    var img = function (s, cls) { return s ? '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + esc(s) + '" crossorigin="anonymous" onerror="this.style.display=\'none\'">' : ''; };
    var logos = cfg.logos.filter(function (l) { return l && l.src; }).map(function (l) { return img(l.src); }).join('');
    var signs = hasSigns ? '<div class="lv-signs">' + on.map(function (s) {
      return '<div class="lv-sg"><div class="im">' + (signed && s.src ? img(s.src) : '') + '</div><div class="ln"><div class="nm">' + esc(s.name || s.label) + '</div><div class="tt">' + esc(s.title) + '</div></div></div>';
    }).join('') + '</div>' : '';
    var foot = '<div class="lv-foot"><div class="no">' + (cfg.showCertNo ? 'Certificate No.: ' + esc(d.certNo || 'LVRMIC26-AC-0000') : '') + '</div>' +
      '<div class="cg">' + (hasSigns ? '' : esc(cfg.noSignLine)) + '</div></div>';
    return '<div class="lv-cert"><style>' + css(cfg) + '</style>' +
      (cfg.background ? '<img class="lv-bg" crossorigin="anonymous" src="' + esc(cfg.background) + '">' : '<div class="lv-b1"></div><div class="lv-b2"></div>') +
      (cfg.watermark && cfg.logos[1] && cfg.logos[1].src ? '<img class="lv-wm" crossorigin="anonymous" src="' + esc(cfg.logos[1].src) + '" onerror="this.style.display=\'none\'">' : '') +
      '<div class="lv-in">' +
      '<div class="lv-head"><div class="lv-logos">' + logos + '</div><div class="lv-org">' +
      '<div class="lv-t1">' + esc(o.topLine) + '</div><div class="lv-t1" style="font-size:' + (cfg.titlePt - 8) + 'pt">' + esc(o.topLine2) + '</div>' +
      '<div class="lv-t2">' + esc(o.dept) + '</div><div class="lv-t3">' + esc(o.cimser) + '</div>' +
      '<div class="lv-t4">' + esc(o.college) + ', ' + esc(o.address) + '</div></div></div>' +
      '<div class="lv-rule"></div>' +
      '<div class="lv-h">' + esc(cfg.heading) + '</div>' +
      '<div class="lv-mid"><div class="lv-body" data-fit>' + bodyHtml(cfg, d) + '</div></div>' + signs + foot + '</div></div>';
  }

  /* shrink the name/institution if the body would overflow its space */
  function fit(root) {
    var mid = root.querySelector('.lv-mid'), n = 0, nm = root.querySelector('.v-name');
    while (mid && mid.querySelector('.lv-body').getBoundingClientRect().height > mid.getBoundingClientRect().height - 4 && n++ < 14) {
      var b = root.querySelector('.lv-body'), fs = parseFloat(getComputedStyle(b).fontSize);
      b.style.fontSize = (fs - 0.6) + 'px'; if (nm) nm.style.fontSize = (parseFloat(getComputedStyle(nm).fontSize) - 0.6) + 'px';
    }
  }

  /* load an <img>-safe src: 'asset:<driveId>' goes through the API, others pass through */
  function resolveAssets(cfg, fetchAsset) {
    var jobs = [];
    function one(obj, key) {
      var v = obj[key];
      if (typeof v === 'string' && v.indexOf('asset:') === 0 && fetchAsset)
        jobs.push(fetchAsset(v.slice(6)).then(function (u) { obj[key] = u; }).catch(function () { obj[key] = ''; }));
    }
    cfg.logos.forEach(function (l) { one(l, 'src'); });
    cfg.slots.forEach(function (s) { one(s, 'src'); });
    one(cfg, 'background');
    return Promise.all(jobs).then(function () { return cfg; });
  }

  /* downscale an uploaded image to the recommended pixel size; keeps PNG transparency */
  function shrinkImage(file, maxW, maxH, type) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onerror = rej;
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, maxW / im.width, maxH / im.height), c = document.createElement('canvas');
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res({ dataUrl: c.toDataURL(type || 'image/png', 0.92), w: c.width, h: c.height, ow: im.width, oh: im.height });
        };
        im.onerror = rej; im.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  function pdfFrom(cfg, items, onProgress) {            // returns Promise<{pdf, blobs?}> using jsPDF + html2canvas
    var L = cfg.orientation !== 'portrait', jsPDF = w.jspdf.jsPDF;
    var host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:0';
    document.body.appendChild(host);
    var pdf = new jsPDF({ orientation: L ? 'l' : 'p', unit: 'mm', format: 'a4', compress: true });
    var i = 0;
    function next() {
      if (i >= items.length) { host.remove(); return Promise.resolve(pdf); }
      host.innerHTML = render(cfg, items[i]);
      var el = host.firstChild; fit(el);
      var imgs = Array.prototype.slice.call(el.querySelectorAll('img')).map(function (m) { return m.complete ? 0 : new Promise(function (r) { m.onload = m.onerror = r; }); });
      return Promise.all(imgs).then(function () { return (document.fonts ? document.fonts.ready : 0); }).then(function () {
        return w.html2canvas(el, { scale: 2.2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      }).then(function (cv) {
        if (i > 0) pdf.addPage('a4', L ? 'l' : 'p');
        pdf.addImage(cv.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, L ? 297 : 210, L ? 210 : 297, undefined, 'FAST');
        i++; if (onProgress) onProgress(i, items.length); return next();
      });
    }
    return next();
  }

  function printHtml(cfg, items, perSheet) {            // direct print / "Save as PDF" from the browser dialog
    var L = cfg.orientation !== 'portrait';
    var pages = items.map(function (d) { return '<div class="pg">' + render(cfg, d) + '</div>'; }).join('');
    var wnd = w.open('', '_blank');
    wnd.document.write('<!doctype html><html><head><meta charset="utf-8"><title>LVRMIC26 Certificates</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&display=swap" rel="stylesheet">' +
      '<style>@page{size:A4 ' + (L ? 'landscape' : 'portrait') + ';margin:0}html,body{margin:0;background:#fff}.pg{width:' + (L ? 297 : 210) + 'mm;height:' + (L ? 210 : 297) + 'mm;page-break-after:always;overflow:hidden}' +
      '@media screen{body{background:#888;padding:10px}.pg{margin:0 auto 10px;box-shadow:0 0 8px #000}}</style></head><body>' + pages +
      '<script>window.onload=function(){setTimeout(function(){window.print()},700)}<\/script></body></html>');
    wnd.document.close();
  }

  w.LVCert = { DEFAULTS: DEFAULTS, merge: merge, render: render, fit: fit, resolveAssets: resolveAssets, shrinkImage: shrinkImage, pdfFrom: pdfFrom, printHtml: printHtml, esc: esc };
})(window);
