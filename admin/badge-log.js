/* VRMIC 2026 — records badge prints. Include AFTER admin-common.js and admin-page.js.
   BADGELOG.record(group, ids, source, opts) -> true when it is fine to go on (printed / PDF made), false when the user cancelled.
   group: 'participant' | 'student' | 'team'.  opts.manual = true for the register's own "Mark printed" button. */
window.BADGELOG = {
  async record(group, ids, source, opts) {
    ids = Array.from(new Set((ids || []).map(String))).filter(Boolean);
    if (!ids.length) return true;
    const manual = !!(opts && opts.manual);
    try {
      let r = await VR.api('adminLogBadgePrint', { group: group, ids: ids, source: source, reason: '' });
      if (r.needReason) {
        const why = prompt(r.reprints + ' badge(s) were printed before.\nReason for reprinting (at least 5 characters):');
        if (!why || why.trim().length < 5) return false;            // nothing was written, nothing is printed
        r = await VR.api('adminLogBadgePrint', { group: group, ids: ids, source: source, reason: why.trim() });
      }
      if (!r.ok) { if (manual) { alert(r.error || 'Could not record the print.'); return false; } return confirm((r.error || 'The print could not be recorded.') + '\n\nPrint anyway?'); }
      return true;
    } catch (e) {
      if (manual) { alert('Could not reach the server.'); return false; }
      return confirm('The print could not be recorded (no connection).\n\nPrint anyway?');
    }
  }
};
