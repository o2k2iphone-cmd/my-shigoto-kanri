import { createItem, completeItem, dateKey, localDateTime, safeLink, validateDate, validateTime } from '../domain/model.js';

/** 将来のGraph providerもgetMyTasks/getTaskDetailsを実装。現在は通信しません。 */
export class ManualPlannerProvider {
  capabilities = { listMyTasks: false, getTaskDetails: false };
  async getMyTasks() { throw new Error('Plannerのタスクをコピーして登録してください。'); }
  async getTaskDetails() { throw new Error('Plannerのメモをコピーして登録してください。'); }
}

const teamsHosts = new Set(['teams.microsoft.com', 'teams.cloud.microsoft', 'teams.live.com']);
function teamsLinkIn(text) {
  for (const token of String(text).match(/https:\/\/[^\s<>"']+/gi) || []) {
    const candidate = token.replace(/[。、）)\]】]+$/, '');
    const link = safeLink(candidate);
    if (link && teamsHosts.has(new URL(link).hostname)) return link;
  }
  return '';
}
function pastedDeadline(value) {
  const normalized = value.normalize('NFKC').trim();
  const match = normalized.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?(?:\s+([0-2]?\d):([0-5]\d))?$/);
  if (!match) throw new Error('期限は年を含む日付（例：2026-10-03）にしてください。');
  const dueDate = validateDate(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`, '貼り付けた期限');
  const dueTime = match[4] ? validateTime(`${match[4].padStart(2, '0')}:${match[5]}`) : null;
  return { dueDate, dueTime };
}
/** Planner固有の画面レイアウトを推測せず、明記された項目だけを補います。 */
export function parsePlannerPaste(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('コピーした内容を貼り付けてください。');
  if (text.length > 50000) throw new Error('貼り付ける内容は50,000文字以内にしてください。');
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const warnings = [];
  const labeledTitle = lines.find(line => /^\s*(?:タイトル|タスク名)\s*[:：]/.test(line));
  const titleLine = labeledTitle?.replace(/^\s*(?:タイトル|タスク名)\s*[:：]\s*/, '').trim()
    || lines.find(line => line.trim() && !/^\s*(?:タイトル|タスク名|期限|期限日|メモ本文|本文|Teamsリンク)\s*[:：]/i.test(line) && !safeLink(line.trim()))?.trim() || '';
  if (titleLine.length > 200) warnings.push('タイトルは200文字まで取り込みました。元の全文はメモに残ります。');
  let dueDate = null, dueTime = null;
  const deadlineLine = lines.find(line => /^\s*(?:期限|期限日)\s*[:：]/.test(line));
  if (deadlineLine) {
    try { ({ dueDate, dueTime } = pastedDeadline(deadlineLine.replace(/^\s*(?:期限|期限日)\s*[:：]\s*/, ''))); }
    catch (error) { warnings.push(error.message); }
  }
  return { title: titleLine.slice(0, 200), body: text, dueDate, dueTime, teamsLink: teamsLinkIn(text), warnings };
}

/** 手動登録と将来のAPI取得で共通の入力形に正規化するための境界。 */
export function itemFromPlannerTask(task, details = {}, options = {}) {
  let dueDate = null, dueTime = null;
  if (task.dueDateTime) {
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(task.dueDateTime)) throw new Error('Plannerの期限日時が正しくありません。');
    validateDate(task.dueDateTime.slice(0, 10), 'Plannerの期限日');
    const due = new Date(task.dueDateTime);
    if (!Number.isFinite(due.getTime())) throw new Error('Plannerの期限日時が正しくありません。');
    dueDate = dateKey(due); dueTime = localDateTime(due).slice(11);
  }
  const body = options.body ?? details.description ?? '';
  const type = options.type ?? (dueDate ? 'task' : 'memo');
  const item = createItem({
    type, title: options.title ?? task.title ?? '', body,
    dueDate: options.dueDate !== undefined ? options.dueDate : dueDate,
    dueTime: options.dueTime !== undefined ? options.dueTime : dueTime,
    teamsLink: options.teamsLink ?? teamsLinkIn(body), archived: type === 'archive',
    source: 'planner',
    extensions: { planner: { taskId: task.id || null, planId: task.planId || null, bucketId: task.bucketId || null, etag: task['@odata.etag'] || null, detailsEtag: details['@odata.etag'] || null, importMethod: options.importMethod || 'graph', importedAt: new Date().toISOString() } },
  });
  return task.percentComplete === 100 ? completeItem(item, true, task.completedDateTime || new Date().toISOString()) : item;
}

/** 手入力した内容も同じモデルへ。仮IDやPlannerの完了状態を作りません。 */
export function plannerRegistrationDefaults() {
  const item = itemFromPlannerTask({}, {}, { type: 'memo', title: 'Plannerから登録', importMethod: 'manual' });
  return { type: 'task', dueDate: null, source: item.source, extensions: item.extensions };
}
