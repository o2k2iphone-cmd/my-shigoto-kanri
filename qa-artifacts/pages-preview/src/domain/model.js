export const TYPES = { task: '期限付き作業', memo: 'メモ', review: 'あとで確認', archive: 'アーカイブ保管' };
export const GROUPS = { sv: { label: 'SV部', limit: 50 }, gn: { label: 'GN SV', limit: 20 }, other: { label: 'その他', limit: 20 } };
export const SCHEMA_VERSION = 1;
export const id = () => crypto.randomUUID();
export function dateKey(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function localDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function dueAt(item) { return item.dueDate ? new Date(`${item.dueDate}T${item.dueTime || '18:00'}`).getTime() : Infinity; }
export function isOverdue(item, now = Date.now()) { return !item.archived && !item.completed && dueAt(item) < now; }
export function shortDate(date) { return date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : ''; }
export function defaultAlarms(date, time = '18:00') {
  if (!date) return [ { id: id(), label: '前日', enabled: false, at: '', acknowledgedAt: null }, { id: id(), label: '当日1時間前', enabled: false, at: '', acknowledgedAt: null } ];
  const due = new Date(`${date}T${time}`);
  const previous = new Date(due); previous.setDate(previous.getDate() - 1);
  return [ { id: id(), label: '前日', enabled: false, at: localDateTime(previous), acknowledgedAt: null }, { id: id(), label: '当日1時間前', enabled: false, at: localDateTime(new Date(due.getTime() - 3600000)), acknowledgedAt: null } ];
}
export function emptyState() { return { schemaVersion: SCHEMA_VERSION, items: [], members: [], reservations: [], settings: { defaultDueTime: '18:00', alarmsEnabled: true, weekStartsMonday: true, lastBackupAt: null }, updatedAt: new Date().toISOString() }; }
export function createItem(input) {
  const now = new Date().toISOString();
  return validateItem({ id: id(), type: 'task', title: '', body: '', dueDate: null, dueTime: null, alarms: [], teamsLink: '', completed: false, completedAt: null, archived: false, originalType: null, source: 'manual', extensions: {}, createdAt: now, updatedAt: now, ...input });
}
export function completeItem(item, completed = true, now = new Date().toISOString()) {
  if (completed) return validateItem({ ...item, originalType: item.type === 'archive' ? item.originalType || 'task' : item.type, type: 'archive', archived: true, completed: true, completedAt: now, updatedAt: now });
  return validateItem({ ...item, type: item.originalType || 'task', archived: false, completed: false, completedAt: null, updatedAt: now });
}
export function searchItems(items, query = '', type = 'all') {
  const tokens = query.normalize('NFKC').trim().toLocaleLowerCase('ja').split(/\s+/).filter(Boolean);
  return items.filter(item => (type === 'all' || item.type === type) && tokens.every(token => [item.title, item.body, item.dueDate, shortDate(item.dueDate), TYPES[item.type], item.type === 'archive' ? 'アーカイブ' : '', item.teamsLink].join(' ').normalize('NFKC').toLocaleLowerCase('ja').includes(token)));
}
export function sortItems(items) { return [...items].sort((a, b) => dueAt(a) - dueAt(b) || b.updatedAt.localeCompare(a.updatedAt)); }
export function validateDate(value, name = '日付') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error(`${name}を正しく入力してください。`);
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime()) || dateKey(d) !== value) throw new Error(`${name}が正しくありません。`);
  return value;
}
export function validateTime(value) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) throw new Error('時刻を正しく入力してください。'); return value; }
export function validateDateTime(value, name = '日時') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error(`${name}を入力してください。`);
  validateDate(value.slice(0, 10), name); validateTime(value.slice(11));
  if (Number.isNaN(new Date(value).getTime())) throw new Error(`${name}が正しくありません。`);
  return value;
}
function text(value, name, limit, required = false) {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new Error(`${name}を確認してください（最大${limit}文字）。`);
  return value;
}
function timestamp(value, name, nullable = false) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${name}が正しくありません。`);
  return value;
}
export function safeLink(link) { if (!link) return ''; try { const url = new URL(link); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; } }
function extensionObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('拡張情報が正しくありません。');
  const serialized = JSON.stringify(value);
  if (serialized.length > 100000 || /"(?:__proto__|constructor|prototype)"\s*:/.test(serialized)) throw new Error('拡張情報が正しくありません。');
  return JSON.parse(serialized);
}
export function validateItem(item) {
  if (!item || !Object.hasOwn(TYPES, item.type)) throw new Error('種類が正しくありません。');
  const dueDate = item.dueDate ? validateDate(item.dueDate, '期限日') : null;
  const dueTime = dueDate ? validateTime(item.dueTime || '18:00') : null;
  if (item.type === 'task' && !dueDate) throw new Error('期限付き作業には期限が必要です。');
  if (typeof item.completed !== 'boolean' || typeof item.archived !== 'boolean' || item.archived !== (item.type === 'archive') || (item.completed && !item.archived)) throw new Error('完了・アーカイブ状態が正しくありません。');
  if (item.completed && !item.completedAt) throw new Error('完了日が必要です。');
  if (item.teamsLink && !safeLink(item.teamsLink)) throw new Error('Teamsリンクは https:// で始まるURLを入力してください。');
  if (!Array.isArray(item.alarms) || item.alarms.length > 10) throw new Error('アラーム設定が正しくありません。');
  const alarms = item.alarms.map(a => {
    if (typeof a.enabled !== 'boolean') throw new Error('アラーム設定が正しくありません。');
    if (a.at) validateDateTime(a.at, 'アラーム日時');
    if (a.enabled && !a.at) throw new Error('ONのアラームには日時が必要です。');
    return { id: text(a.id, 'アラームID', 100, true), label: text(a.label, 'アラーム名', 100), enabled: a.enabled, at: a.at || '', acknowledgedAt: timestamp(a.acknowledgedAt ?? null, 'アラーム確認日', true) };
  });
  uniqueIds(alarms);
  if (item.originalType !== null && !['task', 'memo', 'review'].includes(item.originalType)) throw new Error('元の種類が正しくありません。');
  return { id: text(item.id, 'ID', 100, true), type: item.type, title: text(item.title, 'タイトル', 200, true).trim(), body: text(item.body, '本文', 50000), dueDate, dueTime, alarms, teamsLink: text(item.teamsLink, 'Teamsリンク', 4000), completed: item.completed, completedAt: timestamp(item.completedAt, '完了日', true), archived: item.archived, originalType: item.originalType, source: text(item.source, '作成元', 100, true), extensions: extensionObject(item.extensions), createdAt: timestamp(item.createdAt, '作成日'), updatedAt: timestamp(item.updatedAt, '更新日') };
}
export function validateMember(member) {
  if (!Object.hasOwn(GROUPS, member.group)) throw new Error('メンバーのグループが正しくありません。');
  if (!member.schedules || typeof member.schedules !== 'object' || Array.isArray(member.schedules)) throw new Error('予定が正しくありません。');
  const schedules = {};
  for (const [date, body] of Object.entries(member.schedules)) { validateDate(date); schedules[date] = text(body, 'メンバー予定', 10000); }
  return { id: text(member.id, 'メンバーID', 100, true), name: text(member.name, '名前', 100, true).trim(), group: member.group, schedules, extensions: extensionObject(member.extensions), updatedAt: timestamp(member.updatedAt, '更新日') };
}
export function validateReservation(r) {
  if (!['pending', 'sent'].includes(r.status)) throw new Error('予約の状態が正しくありません。');
  if (r.status === 'sent' && !r.sentAt) throw new Error('送信済み日時が必要です。');
  if (r.teamsLink && !safeLink(r.teamsLink)) throw new Error('Teamsリンクは https:// で始まるURLを入力してください。');
  return { id: text(r.id, '予約ID', 100, true), groupName: text(r.groupName, '送信先グループ名', 200, true).trim(), scheduledAt: validateDateTime(r.scheduledAt, '送信予定日時'), body: text(r.body, '送信本文', 50000, true), teamsLink: text(r.teamsLink || '', 'Teamsリンク', 4000), status: r.status, sentAt: timestamp(r.sentAt, '送信済み日時', true), extensions: extensionObject(r.extensions), createdAt: timestamp(r.createdAt, '作成日'), updatedAt: timestamp(r.updatedAt, '更新日') };
}
function uniqueIds(entries) { const ids = new Set(); for (const entry of entries) { if (ids.has(entry.id)) throw new Error('重複するIDがあります。'); ids.add(entry.id); } }
export function validateState(data) {
  if (!data || data.schemaVersion !== SCHEMA_VERSION) throw new Error('このアプリで使えるバージョンのデータではありません。');
  for (const key of ['items', 'members', 'reservations']) if (!Array.isArray(data[key]) || data[key].length > 20000) throw new Error('データ形式または件数を確認してください。');
  const items = data.items.map(validateItem), members = data.members.map(validateMember), reservations = data.reservations.map(validateReservation);
  uniqueIds(items); uniqueIds(members); uniqueIds(reservations);
  for (const [group, { label, limit }] of Object.entries(GROUPS)) if (members.filter(m => m.group === group).length > limit) throw new Error(`${label}は最大${limit}名です。`);
  const s = data.settings;
  if (!s || typeof s.alarmsEnabled !== 'boolean' || typeof s.weekStartsMonday !== 'boolean') throw new Error('設定が正しくありません。');
  return { schemaVersion: SCHEMA_VERSION, items, members, reservations, settings: { defaultDueTime: validateTime(s.defaultDueTime), alarmsEnabled: s.alarmsEnabled, weekStartsMonday: s.weekStartsMonday, lastBackupAt: timestamp(s.lastBackupAt, 'バックアップ日', true) }, updatedAt: timestamp(data.updatedAt, '更新日') };
}
