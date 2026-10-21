/* VRMIC 2026 — spot registration shared helpers. Include AFTER admin-common.js and admin-page.js. */
window.SPOT = (function () {
  const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const uid = () => 'RQ' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const qrPng = async text => {
    await VR.load(QR_URL);
    const d = document.createElement('div');
    new QRCode(d, { text: text, width: 360, height: 360, correctLevel: QRCode.CorrectLevel.M });
    return d.querySelector('canvas').toDataURL('image/png');
  };

  // Fee, amount, mode, reference and reason fields. cfg = result of adminSpotConfig.
  function payFields(host, cfg) {
    host.innerHTML = '<div class="grid">'
      + '<div><label>Fee category *</label><select id="pf-cat"><option value="">Choose…</option>' + cfg.fees.map(f => '<option>' + esc(f.category) + '</option>').join('') + '</select></div>'
      + '<div><label>Amount to collect (₹) *</label><input id="pf-amt" type="number" min="0" step="1"><div class="hint" id="pf-std"></div></div>'
      + '<div><label>Payment mode *</label><select id="pf-mode">' + cfg.payModes.map(m => '<option>' + esc(m) + '</option>').join('') + '</select></div>'
      + '<div id="pf-refbox" style="display:none;"><label>Transaction ID / reference *</label><input id="pf-ref" maxlength="80" autocomplete="off"></div>'
      + '<div class="full" id="pf-rsnbox" style="display:none;"><label id="pf-rsnl">Reason *</label><input id="pf-rsn" maxlength="200" autocomplete="off"></div></div>';
    const cat = $('pf-cat'), amt = $('pf-amt'), mode = $('pf-mode');
    const cur = () => cfg.fees.find(f => f.category === cat.value) || null;
    const std = () => { const f = cur(); return f && f.inr != null ? f.inr : null; };
    const needReason = () => mode.value === 'Waived' || (std() != null && Number(amt.value) !== std());
    function sync() {
      const f = cur(), s = std(), m = mode.value, waived = m === 'Waived';
      $('pf-std').textContent = !f ? '' : s == null ? 'Set the USD to INR rate in Settings to use this category.'
        : f.usd ? 'On-spot fee $' + f.native + ' × ₹' + cfg.fx + ' = ' + inr(s) : 'On-spot fee ' + inr(s);
      amt.disabled = waived; if (waived) amt.value = 0;
      $('pf-refbox').style.display = (m === 'Cash' || waived) ? 'none' : '';
      $('pf-rsnbox').style.display = needReason() ? '' : 'none';
      $('pf-rsnl').textContent = waived ? 'Reason for the waiver *' : 'Reason for changing the fee *';
    }
    cat.onchange = () => { if (mode.value !== 'Waived') amt.value = std() == null ? '' : std(); sync(); };
    mode.onchange = () => { if (mode.value !== 'Waived' && amt.value === '0' && std() != null) amt.value = std(); sync(); };
    amt.oninput = sync;
    sync();
    return {
      get() {
        return { feeCategory: cat.value, amount: Number(amt.value), paymentMode: mode.value,
          paymentRef: $('pf-refbox').style.display === 'none' ? '' : $('pf-ref').value.trim(),
          feeNote: needReason() ? $('pf-rsn').value.trim() : '' };
      },
      check() {
        const v = this.get();
        if (!v.feeCategory) return 'Choose a fee category.';
        if (std() == null) return 'The fee for this category is not set. Check Settings.';
        if (v.paymentMode !== 'Waived' && !(v.amount > 0)) return 'Enter the amount collected.';
        if (v.paymentRef === '' && v.paymentMode !== 'Cash' && v.paymentMode !== 'Waived') return 'Enter the transaction ID / reference number.';
        if (needReason() && v.feeNote.length < 5) return 'Enter a reason (at least 5 characters).';
        return '';
      },
      reset() { cat.value = ''; mode.value = 'Cash'; $('pf-ref').value = ''; $('pf-rsn').value = ''; amt.value = ''; sync(); }
    };
  }

  // Step: send the QR by email (or show it on screen if the mail fails). cb('mail' | 'screen') runs when done.
  function mailFlow(host, r, cb) {
    host.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;"><button type="button" class="btn btn-gold" id="sm-send"><i class="fa-solid fa-envelope"></i> Send QR code by email</button>'
      + '<button type="button" class="btn" id="sm-show"><i class="fa-solid fa-qrcode"></i> Show QR on screen instead</button></div>'
      + '<div class="hint" id="sm-msg">Goes to <b>' + esc(r.email || 'the participant’s email') + '</b>. This is the only copy of the QR the participant gets.</div>'
      + '<div id="sm-qr" style="display:none;text-align:center;margin-top:14px;"></div>';
    $('sm-send').onclick = function () {
      return VR.busy(this, 'Sending…', async () => {
        try {
          const x = await VR.api('adminSpotSendMail', { id: r.id, qrPng: await qrPng(r.qr) });
          if (x.ok && x.mailSent) { $('sm-msg').innerHTML = '<span style="color:var(--teal-light);"><i class="fa-solid fa-circle-check"></i> QR code sent to ' + esc(r.email) + '.</span>' + (x.quota != null ? ' Mails left today: ' + x.quota + '.' : ''); cb('mail'); }
          else $('sm-msg').innerHTML = '<span style="color:#e8988c;">' + esc(x.error || 'The email could not be sent.') + '</span> Try again, or show the QR on screen.';
        } catch (e) { $('sm-msg').textContent = 'Could not reach the server. Try again.'; }
      });
    };
    $('sm-show').onclick = async () => {
      $('sm-qr').style.display = '';
      $('sm-qr').innerHTML = '<div style="display:inline-block;background:#fff;padding:12px;border-radius:10px;"><img alt="QR code" width="240" height="240" src="' + await qrPng(r.qr) + '"></div>'
        + '<div style="margin-top:12px;"><button type="button" class="btn" id="sm-ok"><i class="fa-solid fa-check"></i> Participant has the QR code, continue</button></div>';
      $('sm-ok').onclick = () => cb('screen');
    };
  }

  // What to write on the blank card
  function cardHtml(r) {
    const row = (k, v, big) => '<div style="display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px dashed var(--navy-border);"><span style="color:var(--text-3);">' + k + '</span><b style="font-size:' + (big ? '22px' : '17px') + ';text-align:right;' + (big ? 'font-family:\'IBM Plex Mono\',monospace;color:var(--gold-light);' : '') + '">' + esc(v || '—') + '</b></div>';
    return '<div style="max-width:520px;">' + row('VRMIC ID', r.id, true) + row('Name', r.name) + row('Institution', r.institution) + row('Category', 'Delegate') + '</div>';
  }

  // Mark today's attendance with the same server rules as scanning
  async function attendance(host, id) {
    host.innerHTML = '<span class="spinner"></span> Loading today’s sessions…';
    const c = await VR.api('adminAttendanceContext', { kind: 'participant' });
    if (!c.ok) { host.innerHTML = '<div class="hint">' + esc(c.error || 'Attendance is not available.') + '</div>'; return; }
    const ss = (c.sessions || []).filter(s => s.date === c.today);
    if (!ss.length) { host.innerHTML = '<div class="hint">No attendance session is scheduled for today.</div>'; return; }
    host.innerHTML = '<label>Mark today’s attendance (entry)</label><div style="display:flex;gap:10px;flex-wrap:wrap;"><select id="at-s" style="width:auto;min-width:240px;">'
      + ss.map(s => '<option value="' + esc(s.id) + '">' + esc(s.title) + ' (' + hm12(s.entry) + ')</option>').join('') + '</select>'
      + '<button type="button" class="btn btn-gold" id="at-go"><i class="fa-solid fa-user-check"></i> Mark present</button></div><div class="hint" id="at-msg"></div>';
    $('at-go').onclick = function () {
      return VR.busy(this, 'Marking…', async () => {
        const r = await VR.api('adminRecordAttendance', { kind: 'participant', sessionId: $('at-s').value, direction: 'in', source: 'manual', personId: id, reason: 'Marked at spot registration desk' });
        $('at-msg').innerHTML = r.ok ? '<span style="color:var(--teal-light);"><i class="fa-solid fa-circle-check"></i> ' + esc(r.status) + ' at ' + esc(r.time) + ' · ' + esc(r.session) + '</span>'
          : '<span style="color:#e8988c;">' + esc(r.error || 'Could not mark attendance.') + '</span>';
      });
    };
  }

  // b = { bill, id, name, institution, category, amount, mode, ref, time }
  function printBill(b) {
    const rows = [['Bill no.', b.bill], ['VRMIC ID', b.id], ['Name', b.name], ['Institution', b.institution], ['Fee category', b.category],
      ['Amount', b.mode === 'Waived' ? 'WAIVED (₹0)' : inr(b.amount)], ['Payment mode', b.mode], ['Reference', b.ref || '—'], ['Date and time', String(b.time || '').replace('T', ' ').slice(0, 16) + ' IST']];
    VR.printHtml('Payment bill ' + b.bill, '<div style="max-width:420px;border:1.5px solid #222;padding:14px 18px;">'
      + rows.map(x => '<div style="display:flex;justify-content:space-between;gap:14px;padding:5px 0;border-bottom:1px solid #ddd;font-size:12.5px;"><span style="color:#555;">' + VR.esc(x[0]) + '</span><b>' + VR.esc(x[1]) + '</b></div>').join('')
      + '<p style="font-size:10px;color:#555;margin-top:10px;">This bill acknowledges the payment. An official receipt can be requested from the participant portal.</p></div>');
  }

  return { inr: inr, uid: uid, qrPng: qrPng, payFields: payFields, mailFlow: mailFlow, cardHtml: cardHtml, attendance: attendance, printBill: printBill };
})();
