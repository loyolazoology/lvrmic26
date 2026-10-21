/****************************************************************
 * VRMIC 2026 — TRASH (soft delete) + BACKUPS
 * ----------------------------------------------------------------
 * PASTE THIS AT THE END of Code.gs, then apply every edit in CODE-GS-EDITS.md.
 * Then: Deploy > Manage deployments > Edit > New version.
 * Then run installBackupTrigger once from the editor (Run menu) to start the 2 AM backup.
 ****************************************************************/

const PURGE_SUPER_ONLY_ = true;        // only the Administrator (1001) may delete permanently
const BACKUP_HEADERS_ = ['BackupID','Time','Status','Trigger','By','FileName','FileId','Url','SizeBytes','Note'];
const BACKUP_FOLDER_NAME_ = 'VRMIC Backups';

/* ---------- what can sit in Trash ---------- */
const TRASH_TYPES_ = {
  participant: { label: 'Participants', module: 'participants', idKey: 'ID',
    sheet: () => getSheet('Participants'),
    title: r => String(r.Name || ''), sub: r => [r.Email, r.Institution].filter(Boolean).join(' · ') },
  student: { label: 'Students', module: 'students', idKey: 'StudentID',
    sheet: () => getTab_('Students', STUDENT_HEADERS_),
    title: r => String(r.Name || ''), sub: r => [r.Class, r.DeptNo ? 'Dept ' + r.DeptNo : ''].filter(Boolean).join(' · ') },
  announcement: { label: 'Announcements', module: 'announcements', idKey: 'ID',
    sheet: () => getSheet('Announcements'),
    title: r => String(r.Title || ''), sub: r => clip_(r.Message, 90) },
  session: { label: 'Sessions', module: '', idKey: 'SessionID',
    sheet: () => getTab_('AttendanceSessions', SESSION_HEADERS_),
    title: r => String(r.Title || ''), sub: r => (String(r.Kind) === 'student' ? 'Student' : 'Participant') + ' · ' + isoDate_(r.Date) }
};
// a session belongs to the Participant or Student attendance-config module
function trashModuleOf_(type, rec) {
  if (type === 'session') return String(rec.Kind) === 'student' ? 'studentConfig' : 'attendanceConfig';
  return TRASH_TYPES_[type].module;
}
function isDeleted_(r) { return String(r && r.Deleted).toUpperCase() === 'TRUE'; }
function toStamp_(v) { return v instanceof Date ? stampOf_(v) : String(v == null ? '' : v); }

function setDeleteCols_(sh, row, vals) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  DELETE_COLS_.forEach(h => {
    const c = headers.indexOf(h) + 1;
    if (c > 0) sh.getRange(row, c).setNumberFormat('@').setValue(vals[h] === undefined ? '' : vals[h]);   // text format keeps the ISO stamp as typed
  });
}

// Hides the record (it keeps every value, file and ID). Call inside a script lock.
function softDeleteRow_(type, rec, admin, reason, ip) {
  const t = TRASH_TYPES_[type], sh = t.sheet();
  const why = clip_(reason, 300) || '(no reason given)';
  setDeleteCols_(sh, rec._row, { Deleted: 'true', DeletedBy: admin.Name + ' (' + admin.ID + ')', DeletedAt: istStamp_(), DeleteReason: why });
  writeAudit_(admin, 'Trash', 'delete', rec[t.idKey], t.title(rec), type, why, ip);
}

// Finds a record that is currently IN Trash, and checks the row still holds the same ID.
function findTrashRec_(type, row, id) {
  const t = TRASH_TYPES_[type]; if (!t) return null;
  const rec = sheetToObjectsAll_(t.sheet()).find(r => r._row === Number(row));
  return rec && isDeleted_(rec) && String(rec[t.idKey]).trim() === String(id).trim() ? rec : null;
}
function findParticipantFolder_(id) {   // like getOrCreateParticipantFolder, but never creates one
  const parent = DriveApp.getFolderById(getBootConfig_().DRIVE_FOLDER_ID);
  const it = parent.searchFolders("title contains '" + String(id).replace(/'/g, '') + "_'");
  while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf(id + '_') === 0) return f; }
  return null;
}

/* ---------- students: soft delete (new action) ---------- */
function adminDeleteStudent(p) {
  const check = requireAdminPermission(p.token, 'students', 'transaction');
  if (!check.ok) return check;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const rec = sheetToObjects(getTab_('Students', STUDENT_HEADERS_)).find(r => String(r.StudentID).trim() === String(p.id || '').trim());
    if (!rec) return { ok: false, error: 'Student not found. Refresh the list.' };
    softDeleteRow_('student', rec, check.record, p.reason, p.ip);
    return { ok: true, softDeleted: true };
  } finally { lock.releaseLock(); }
}

// What is attached to a participant / student: shown in the "are you sure?" box before deleting.
function adminDeletePreview(p) {
  const type = String(p.type || 'participant');
  if (type !== 'participant' && type !== 'student') return { ok: false, error: 'Invalid request.' };
  const check = requireAdminPermission(p.token, type === 'student' ? 'students' : 'participants', 'transaction');
  if (!check.ok) return check;
  const id = String(p.id || '').trim();
  const logs = attLogs_(type).filter(l => String(l.PersonID).trim() === id), sess = {};
  logs.forEach(l => { sess[String(l.SessionID)] = 1; });
  const out = { ok: true, type: type, id: id, attendance: logs.length, sessions: Object.keys(sess).length };
  if (type === 'participant') {
    const rec = sheetToObjects(getSheet('Participants')).find(r => String(r.ID).trim() === id);
    if (!rec) return { ok: false, error: 'Participant not found.' };
    out.name = rec.Name; out.slot = !!String(rec.SlotVenue || '').trim(); out.abstract = !!rec.AbstractDocId;
    out.abstractRevisions = Number(rec.AbstractRevision) || 0; out.ppt = !!rec.PPTDocId;
    out.feedback = String(rec.FeedbackSubmitted).toUpperCase() === 'TRUE';
    out.certificate = String(rec.CertificateRequested).toUpperCase() === 'TRUE'; out.amountPaid = rec.AmountPaid;
  } else {
    const rec = sheetToObjects(getTab_('Students', STUDENT_HEADERS_)).find(r => String(r.StudentID).trim() === id);
    if (!rec) return { ok: false, error: 'Student not found.' };
    out.name = rec.Name;
  }
  return out;
}

/* ---------- Trash page ---------- */
function adminListTrash(p) {
  const check = requireAdminPermission(p.token, 'trash', 'transaction', 'trash-manage');
  if (!check.ok) return check;
  const sup = isSuper_(check.record), now = Date.now(), types = {};
  Object.keys(TRASH_TYPES_).forEach(k => {
    const t = TRASH_TYPES_[k], items = [];
    sheetToObjectsAll_(t.sheet()).forEach(r => {
      if (!isDeleted_(r)) return;
      const at = toStamp_(r.DeletedAt), ms = new Date(at).getTime();
      items.push({ row: r._row, id: String(r[t.idKey]), title: t.title(r), sub: t.sub(r),
        deletedBy: String(r.DeletedBy || ''), deletedAt: at, reason: String(r.DeleteReason || ''),
        days: isNaN(ms) ? 0 : Math.max(0, Math.floor((now - ms) / 86400000)),
        canRestore: sup || permissionAllows_(check.perms, trashModuleOf_(k, r), 'transaction') });
    });
    items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    types[k] = { label: t.label, items: items };
  });
  return { ok: true, types: types, canPurge: PURGE_SUPER_ONLY_ ? sup : true };
}

function adminRestoreTrash(p) {
  const check = requireAdminPermission(p.token, 'trash', 'transaction', 'trash-manage');
  if (!check.ok) return check;
  const type = String(p.type || ''), t = TRASH_TYPES_[type];
  if (!t) return { ok: false, error: 'Invalid request.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const rec = findTrashRec_(type, p.row, p.id);
    if (!rec) return { ok: false, error: 'This item is no longer in Trash. Refresh the list.' };
    // needs Trash (Transaction) AND Transaction on the record's own module
    if (!isSuper_(check.record) && !permissionAllows_(check.perms, trashModuleOf_(type, rec), 'transaction'))
      return { ok: false, error: 'You also need edit permission on ' + t.label.toLowerCase() + ' to restore this.' };

    const live = sheetToObjects(t.sheet());
    let clash = null, what = '';
    if (type === 'participant') {
      const em = String(rec.Email).trim().toLowerCase(), ph = String(rec.Phone).replace(/\s+/g, '');
      clash = live.find(r => String(r.Email).trim().toLowerCase() === em); what = 'email ' + rec.Email;
      if (!clash && ph) { clash = live.find(r => String(r.Phone).replace(/\s+/g, '') === ph); what = 'phone number ' + ph; }
    } else if (type === 'student') {
      const d = String(rec.DeptNo).trim().toLowerCase();
      clash = live.find(r => String(r.DeptNo).trim().toLowerCase() === d); what = 'department number ' + rec.DeptNo;
    } else if (type === 'session') {
      clash = live.find(r => String(r.Kind) === String(rec.Kind) && isoDate_(r.Date) === isoDate_(rec.Date) && String(r.Title).trim().toLowerCase() === String(rec.Title).trim().toLowerCase());
      what = 'title on ' + isoDate_(rec.Date);
    }
    if (clash) return { ok: false, conflict: true, error: 'Cannot restore: the ' + what + ' is now used by ' + (clash.Name || clash.Title) + ' (' + clash[t.idKey] + '). Change or remove that record first.' };

    setDeleteCols_(t.sheet(), rec._row, {});
    writeAudit_(check.record, 'Trash', 'restore', rec[t.idKey], '', t.title(rec) + ' · ' + type, '', p.ip);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function adminPurgeTrash(p) {
  const check = requireAdminPermission(p.token, 'trash', 'transaction', 'trash-manage');
  if (!check.ok) return check;
  if (PURGE_SUPER_ONLY_ && !isSuper_(check.record)) return { ok: false, error: 'Only the Administrator (' + SUPER_ADMIN_ID_ + ') can delete permanently.' };
  const type = String(p.type || ''), t = TRASH_TYPES_[type];
  if (!t) return { ok: false, error: 'Invalid request.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const rec = findTrashRec_(type, p.row, p.id);
    if (!rec) return { ok: false, error: 'This item is no longer in Trash. Refresh the list.' };
    if (String(p.confirmId || '').trim() !== String(rec[t.idKey]).trim()) return { ok: false, error: 'The ID you typed does not match.' };
    let filesTrashed = false;
    if (type === 'participant' && p.deleteFiles) {
      try { const f = findParticipantFolder_(rec.ID); if (f) { f.setTrashed(true); filesTrashed = true; } } catch (e) {}
    }
    t.sheet().deleteRow(rec._row);          // attendance history is NOT touched, so reports stay correct
    writeAudit_(check.record, 'Trash', 'purge', rec[t.idKey], t.title(rec), type + (filesTrashed ? ' + Drive folder' : ''), '', p.ip);
    return { ok: true, filesTrashed: filesTrashed };
  } finally { lock.releaseLock(); }
}

/* ====================== BACKUPS ====================== */
function backupFolder_() {
  const props = PropertiesService.getScriptProperties(), saved = props.getProperty('BACKUP_FOLDER_ID');
  if (saved) { try { return DriveApp.getFolderById(saved); } catch (e) {} }
  const root = DriveApp.getRootFolder(), it = root.getFoldersByName(BACKUP_FOLDER_NAME_);
  const f = it.hasNext() ? it.next() : root.createFolder(BACKUP_FOLDER_NAME_);
  props.setProperty('BACKUP_FOLDER_ID', f.getId());
  return f;
}

// Removes backups older than the retention setting (the Drive copy goes to Drive's trash; the log row stays as "Expired").
function pruneBackups_() {
  const days = Number(getSettingsMap_()['bk.retentionDays']) || 14, cutoff = Date.now() - days * 86400000;
  const sh = getTab_('BackupLog', BACKUP_HEADERS_), col = BACKUP_HEADERS_.indexOf('Status') + 1;
  let n = 0;
  sheetToObjects(sh).forEach(r => {
    if (String(r.Status) !== 'Success') return;
    const t = new Date(String(r.Time)).getTime(); if (isNaN(t) || t > cutoff) return;
    try { DriveApp.getFileById(String(r.FileId)).setTrashed(true); } catch (e) {}
    sh.getRange(r._row, col).setValue('Expired'); n++;
  });
  return n;
}

// trigger: 'Auto' | 'Manual'.  Returns { ok, fileName, url, ... } and always writes one BackupLog row.
function runBackup_(trigger, by) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  const now = new Date(), stamp = Utilities.formatDate(now, 'Asia/Kolkata', 'yyyy-MM-dd_HHmm');
  try {
    const sheetId = getBootConfig_().SHEET_ID;
    const copy = DriveApp.getFileById(sheetId).makeCopy('VRMIC2026_Backup_' + stamp, backupFolder_());
    const tabs = SpreadsheetApp.openById(sheetId).getSheets();
    let rows = 0; tabs.forEach(s => { rows += Math.max(0, s.getLastRow() - 1); });
    let size = 0; try { size = copy.getSize(); } catch (e) {}      // Google Sheets often report 0
    getTab_('BackupLog', BACKUP_HEADERS_).appendRow([newId_('BK'), stampOf_(now), 'Success', trigger, by, copy.getName(), copy.getId(), copy.getUrl(), size, tabs.length + ' tabs · ' + rows + ' rows']);
    const expired = pruneBackups_();
    return { ok: true, fileName: copy.getName(), url: copy.getUrl(), expired: expired, note: tabs.length + ' tabs · ' + rows + ' rows' };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    try { getTab_('BackupLog', BACKUP_HEADERS_).appendRow([newId_('BK'), stampOf_(now), 'Failed', trigger, by, '', '', '', 0, msg]); } catch (e) {}
    try {
      const to = getConfig().ADMIN_EMAIL;
      if (to) safeMail_({ to: to, subject: 'VRMIC 2026 — Backup FAILED', htmlBody: '<p>The ' + escapeHtml(trigger.toLowerCase()) + ' backup of the VRMIC 2026 portal sheet failed.</p><p><b>Error:</b> ' + escapeHtml(msg) + '</p><p>Open Trash and Backups &gt; Backup list in the admin portal and use <b>Backup now</b> once the cause is fixed.</p>' });
    } catch (e) {}
    return { ok: false, error: 'Backup failed: ' + msg };
  } finally { lock.releaseLock(); }
}

// Time-driven trigger target (installed by installBackupTrigger). Does nothing when the Settings switch is off.
function dailyBackupJob() {
  if (getSettingsMap_()['bk.enabled'] !== 'true') return;
  const r = runBackup_('Auto', 'system');
  writeAudit_({ ID: 'system', Name: 'Backup job', Category: 'System' }, 'Backup', r.ok ? 'auto-backup' : 'auto-backup-failed', '', '', r.ok ? r.fileName : r.error, '', '');
}

// Run ONCE from the Apps Script editor (Run > installBackupTrigger). Safe to run again: it replaces the old trigger.
function installBackupTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailyBackupJob').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyBackupJob').timeBased().everyDays(1).atHour(2).inTimezone('Asia/Kolkata').create();
  return 'Daily backup trigger installed (runs about 2 AM IST when the Settings switch is on).';
}

function adminListBackups(p) {
  const check = requireAdminPermission(p.token, 'trash', 'report', 'backups-report');
  if (!check.ok) return check;
  const rows = sheetToObjects(getTab_('BackupLog', BACKUP_HEADERS_)).filter(r => String(r.BackupID) !== '').reverse().slice(0, 200).map(r => ({
    id: String(r.BackupID), time: String(r.Time), status: String(r.Status), trigger: String(r.Trigger), by: String(r.By),
    fileName: String(r.FileName), url: String(r.Url), size: Number(r.SizeBytes) || 0, note: String(r.Note || '') }));
  let triggerInstalled = false, folderUrl = '';
  try { triggerInstalled = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'dailyBackupJob'); } catch (e) {}
  try { folderUrl = backupFolder_().getUrl(); } catch (e) {}
  const S = getSettingsMap_();
  return { ok: true, backups: rows, enabled: S['bk.enabled'] === 'true', retentionDays: Number(S['bk.retentionDays']) || 14,
    triggerInstalled: triggerInstalled, folderUrl: folderUrl,
    canRun: isSuper_(check.record) || permissionAllows_(check.perms, 'trash', 'transaction') };
}

function adminRunBackup(p) {
  const check = requireAdminPermission(p.token, 'trash', 'transaction');
  if (!check.ok) return check;
  const r = runBackup_('Manual', check.record.Name + ' (' + check.record.ID + ')');
  writeAudit_(check.record, 'Backup', r.ok ? 'backup-now' : 'backup-failed', '', '', r.ok ? r.fileName : r.error, '', p.ip);
  return r;
}
