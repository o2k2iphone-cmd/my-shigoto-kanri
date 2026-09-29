import { test, assert } from './harness.js';
import { ManualPlannerProvider, parsePlannerPaste, itemFromPlannerTask, plannerRegistrationDefaults } from '../src/integrations/planner.js';
import { emptyState, createItem, completeItem, searchItems } from '../src/domain/model.js';
import { saveItem } from '../src/domain/actions.js';
import { parseBackup, serializeBackup } from '../src/storage/backup.js';

test('Plannerのコピーを先頭行・全文・年付き期限・Teamsリンクへ分ける', () => {
  const text = '資料提出\r\n期限：２０２６年１０月３日 ９:３０\r\n佐藤さんへ確認\r\nhttps://teams.microsoft.com/l/message/test';
  const result = parsePlannerPaste(text);
  assert.equal(result.title, '資料提出'); assert.equal(result.body, text);
  assert.equal(result.dueDate, '2026-10-03'); assert.equal(result.dueTime, '09:30');
  assert.equal(result.teamsLink, 'https://teams.microsoft.com/l/message/test'); assert.equal(result.warnings.length, 0);
  assert.equal(parsePlannerPaste('タイトル：会議記録\n期限日：2026/10/4').title, '会議記録');
  assert.equal(parsePlannerPaste('タイトル：会議記録\n期限日：2026/10/4').dueDate, '2026-10-04');
});
test('本文中の日付を期限にせず、不正日付や年なしは全文を保持して知らせる', () => {
  assert.equal(parsePlannerPaste('打ち合わせ\n2026-10-03には売場変更').dueDate, null);
  for (const date of ['10月3日', '2026-02-30', '2026-10-03 25:00']) {
    const text = `企画\n期限：${date}`; const result = parsePlannerPaste(text);
    assert.equal(result.dueDate, null); assert.equal(result.body, text); assert.ok(result.warnings.length);
  }
  assert.equal(parsePlannerPaste('メモ\nhttps://example.com/\nhttp://teams.microsoft.com/test').teamsLink, '');
  assert.equal(parsePlannerPaste('メモ\nhttps://teams.microsoft.com.evil.example/test').teamsLink, '');
  assert.equal(parsePlannerPaste('メモ\nhttps://user:password@teams.microsoft.com/test').teamsLink, '');
  assert.throws(() => parsePlannerPaste(''), /貼り付け/); assert.throws(() => parsePlannerPaste('あ'.repeat(50001)), /50,000/);
  const long = parsePlannerPaste('あ'.repeat(201)); assert.equal(long.title.length, 200); assert.equal(long.body.length, 201); assert.ok(long.warnings.length);
});
test('手動Planner登録の4種は通常データとして検索・保管・バックアップできる', () => {
  const defaults = plannerRegistrationDefaults(), state = emptyState();
  assert.equal(defaults.dueDate, null); assert.equal(defaults.extensions.planner.taskId, null);
  for (const type of ['task', 'memo', 'review', 'archive']) {
    saveItem(state, createItem({ ...defaults, type, title: `Planner ${type}`, dueDate: type === 'task' ? '2026-10-03' : null, archived: type === 'archive' }));
  }
  assert.equal(searchItems(state.items, 'Planner').length, 4);
  const archive = completeItem(state.items[0]); assert.equal(archive.source, 'planner');
  assert.equal(completeItem(archive, false).extensions.planner.importMethod, 'manual');
  assert.deepEqual(parseBackup(serializeBackup(state)), state);
});
test('将来のPlanner task/detailsを変換し、UTC期限・元ID・完了状態を保持', async () => {
  const task = { id: 'task-1', title: '提出', planId: 'plan-1', bucketId: 'bucket-1', dueDateTime: '2026-10-03T09:00:00Z', '@odata.etag': 'task-etag' };
  const details = { description: 'メモ\nhttps://teams.cloud.microsoft/test', '@odata.etag': 'details-etag' };
  const item = itemFromPlannerTask(task, details);
  assert.equal(new Date(`${item.dueDate}T${item.dueTime}`).getTime(), Date.parse(task.dueDateTime));
  assert.equal(item.body, details.description); assert.equal(item.type, 'task'); assert.equal(item.source, 'planner');
  assert.equal(item.extensions.planner.taskId, 'task-1'); assert.equal(item.extensions.planner.detailsEtag, 'details-etag');
  assert.equal(item.teamsLink, 'https://teams.cloud.microsoft/test');
  const completed = itemFromPlannerTask({ ...task, percentComplete: 100, completedDateTime: '2026-10-02T03:00:00Z' }, details);
  assert.equal(completed.type, 'archive'); assert.equal(completed.completedAt, '2026-10-02T03:00:00Z');
  assert.equal(itemFromPlannerTask({ title: '期限なし' }).type, 'memo');
  assert.throws(() => itemFromPlannerTask({ ...task, dueDateTime: '2026-02-30T09:00:00Z' }), /日/);
  const provider = new ManualPlannerProvider(); assert.equal(provider.capabilities.listMyTasks, false);
  await assert.rejects(provider.getMyTasks(), /コピー/);
});
