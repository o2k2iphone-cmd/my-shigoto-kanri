import { createItem, defaultAlarms, validateDate, validateTime } from '../domain/model.js';

const TODO_SOURCE = 'microsoft-todo';
const TODO_HOSTS = new Set(['teams.microsoft.com', 'teams.cloud.microsoft']);

export function extractTeamsUrl(body) {
  for (const match of body.matchAll(/https:\/\/[^\s<>"']+/gi)) {
    const candidate = match[0].replace(/[.,;!?、。，）)\]]+$/u, '');
    try {
      const url = new URL(candidate);
      if (TODO_HOSTS.has(url.hostname.toLowerCase()) && !url.username && !url.password) return url.href;
    } catch { /* 次のURLを探す */ }
  }
  return '';
}

export function parseTodoJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSONが壊れています。'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSONの先頭はオブジェクトにしてください。');
  if (typeof data.id !== 'string' || !data.id.trim() || data.id.length > 1000) throw new Error('idがありません、または長すぎます。');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw new Error('titleがありません、または長すぎます。');
  if (!Object.hasOwn(data, 'body') || typeof data.body !== 'string' || data.body.length > 50000) throw new Error('bodyがありません、または長すぎます。');
  if (data.dueDate != null && typeof data.dueDate !== 'string') throw new Error('dueDateの形式が違います。');
  return { externalId: data.id.trim(), title: data.title.trim(), body: data.body, sourceDueDate: data.dueDate?.trim() || null, teamsUrl: extractTeamsUrl(data.body) };
}

export function hasNaiveDueDate(value) { return !!value && /^\d{4}-\d{2}-\d{2}T/.test(value) && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value); }

function tokyoParts(instant) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { dueDate: `${values.year}-${values.month}-${values.day}`, dueTime: `${values.hour}:${values.minute}` };
}

export function parseTodoDueDate(value, naiveTimezone) {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,7})?)?(Z|[+-]\d{2}:\d{2})?)?$/i.exec(value);
  if (!match) throw new Error('dueDateがISO形式ではありません。');
  validateDate(match[1], 'dueDate');
  if (!match[2]) return { dueDate: match[1], dueTime: null };
  validateTime(`${match[2]}:${match[3]}`);
  const [, date, hour, minute, second = '00', offset] = match;
  if (!offset && naiveTimezone !== 'utc' && naiveTimezone !== 'jst') throw new Error('タイムゾーンのないdueDateの時刻解釈を選択してください。');
  if (!offset && naiveTimezone === 'jst') return { dueDate: date, dueTime: `${hour}:${minute}` };
  const instant = new Date(`${value}${offset ? '' : 'Z'}`);
  if (Number.isNaN(instant.getTime())) throw new Error('dueDateの日時が正しくありません。');
  if (!offset && instant.toISOString().slice(0, 19) !== `${date}T${hour}:${minute}:${second}`) throw new Error('dueDateの日時が正しくありません。');
  return tokyoParts(instant);
}

export function importedTodoIds(items, history = []) {
  return new Set([...items.map(item => item.extensions?.microsoftTodo?.externalId), ...history.map(row => row.externalId)].filter(value => typeof value === 'string' && value));
}

/** Repository.update 内で呼ぶ。1ファイルの不備は他の正常なファイルを止めない。 */
export function importTodoRecords(state, entries, { naiveTimezone } = {}) {
  const seen = importedTodoIds(state.items, state.jsonDeletionHistory);
  const results = [];
  for (const [index, entry] of entries.entries()) {
    const name = entry.name || `${index + 1}件目`;
    if (entry.error) { results.push({ name, title: '', status: 'error', detail: entry.error }); continue; }
    const record = entry.record;
    if (!record) { results.push({ name, title: '', status: 'error', detail: 'JSONを読み取れませんでした。' }); continue; }
    if (seen.has(record.externalId)) {
      // 旧版の取込分には実際のファイル名だけを補完し、業務内容は上書きしません。
      const meta = state.items.find(item => item.extensions?.microsoftTodo?.externalId === record.externalId)?.extensions.microsoftTodo || state.jsonDeletionHistory?.find(row => row.externalId === record.externalId);
      if (meta && !meta.sourceFileName && entry.name) meta.sourceFileName = entry.name;
      results.push({ name, title: record.title, status: 'duplicate', detail: '登録済み、または削除履歴にあるTo Do IDです。' }); continue;
    }
    try {
      const parsedDue = parseTodoDueDate(record.sourceDueDate, naiveTimezone);
      const dueDate = parsedDue?.dueDate || null;
      const dueTime = parsedDue?.dueTime || '18:00';
      const type = dueDate ? 'task' : 'review';
      const importedAt = new Date().toISOString();
      if (state.items.length >= 20000) throw new Error('管理データは最大20,000件です。');
      const item = createItem({ type, title: record.title, body: record.body, dueDate, dueTime, alarms: defaultAlarms(dueDate, dueTime), teamsLink: record.teamsUrl, source: TODO_SOURCE, extensions: { microsoftTodo: { externalId: record.externalId, sourceFileName: entry.name || null, sourceDueDate: record.sourceDueDate, importedAt, completedAt: null, deleteRequestedAt: null } } });
      state.items.push(item); seen.add(record.externalId);
      results.push({ name, title: record.title, status: 'new', type, detail: `${type === 'task' ? '期限付き作業' : 'あとで確認'}に登録しました。`, dueDate: item.dueDate });
    } catch (error) { results.push({ name, title: record.title, status: 'error', detail: error.message }); }
  }
  const counts = { new: 0, review: 0, duplicate: 0, error: 0 };
  for (const result of results) { counts[result.status]++; if (result.status === 'new' && result.type === 'review') counts.review++; }
  return { state, results, counts };
}
