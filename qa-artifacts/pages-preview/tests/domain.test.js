import { test, assert } from './harness.js';
import { emptyState, createItem, completeItem, dateKey, defaultAlarms, sortItems, searchItems, validateState, validateDate, safeLink, GROUPS, id } from '../src/domain/model.js';
import { saveItem, saveMember, setCompleted, setReservationSent, acknowledgeAlarms } from '../src/domain/actions.js';
import { parseBackup, serializeBackup } from '../src/storage/backup.js';
import { activeAlarms, dueReservations } from '../src/notifications/alarms.js';
import { calendarEvents } from '../src/integrations/outlook.js';
import { itemFromTeamsMessage } from '../src/integrations/teams.js';
import { IndexedDBRepository, LocalStorageRepository } from '../src/storage/repository.js';
import { escapeHtml } from '../src/ui/helpers.js';

const task = (extra = {}) => createItem({ title: '資料提出', dueDate: '2026-10-03', dueTime: '18:00', ...extra });
test('期限必須、存在する日付、URLの安全性を検証する', () => {
  assert.throws(() => createItem({ title: '期限なし' }), /期限/);
  assert.throws(() => validateDate('2026-02-30'), /日付/);
  assert.equal(validateDate('2028-02-29'), '2028-02-29');
  assert.equal(safeLink('javascript:alert(1)'), '');
  assert.equal(safeLink('https://user:pass@example.com'), '');
  assert.throws(() => task({ teamsLink: 'javascript:alert(1)' }), /リンク/);
  assert.ok(escapeHtml('<img onerror="bad">').startsWith('&lt;'));
});
test('完了日と拡張情報を保持して保管し、元の種類へ戻す', () => {
  const original = task({ extensions: { teams: { messageId: 'message-1' } } });
  const completed = completeItem(original, true, '2026-09-29T02:00:00.000Z');
  assert.equal(completed.type, 'archive'); assert.equal(completed.completed, true); assert.equal(completed.completedAt, '2026-09-29T02:00:00.000Z');
  assert.equal(completed.extensions.teams.messageId, 'message-1');
  const restored = completeItem(completed, false); assert.equal(restored.type, 'task'); assert.equal(restored.archived, false); assert.equal(restored.completedAt, null);
  const memo = completeItem(createItem({ type: 'memo', title: 'メモ' })); assert.equal(completeItem(memo, false).type, 'memo');
});
test('期限が近い順、本文内の人名・店舗名・全角文字・期限・種類を検索する', () => {
  const a = task({ title: '企画A', body: '佐藤 新宿店 SV部 商品Ａ', dueDate: '2026-09-28' });
  const b = task({ title: '企画B' });
  assert.deepEqual(sortItems([b, a]).map(i => i.id), [a.id, b.id]);
  for (const query of ['佐藤', '新宿店', 'SV部', '商品A', '9月28日', '期限付き作業', '2026-09-28']) assert.equal(searchItems([a, b], query).length, query === '期限付き作業' ? 2 : 1);
  assert.equal(searchItems([a, b], '佐藤 新宿').length, 1);
  assert.equal(searchItems([a, b], '佐藤', 'memo').length, 0);
});
test('前日と1時間前はローカル日時で計算し、確認済み・保管済みは通知しない', () => {
  const alarms = defaultAlarms('2026-10-03', '00:30');
  assert.equal(alarms[0].at, '2026-10-02T00:30'); assert.equal(alarms[1].at, '2026-10-02T23:30');
  const state = emptyState(); alarms[0].enabled = true; alarms[1].enabled = true; state.items.push(task({ alarms }));
  assert.equal(activeAlarms(state, new Date('2026-10-04T00:00').getTime()).length, 2);
  acknowledgeAlarms(state, [{ itemId: state.items[0].id, alarmId: alarms[0].id }]); assert.equal(activeAlarms(state, new Date('2026-10-04T00:00').getTime()).length, 1);
  setCompleted(state, state.items[0].id); assert.equal(activeAlarms(state, Infinity).length, 0);
  state.settings.alarmsEnabled = false; assert.equal(activeAlarms(state, Infinity).length, 0);
});
test('自作カレンダーは期限付き3種を統合し、完了済みは非表示', () => {
  const items = [task(), createItem({ type: 'memo', title: '期限付きメモ', dueDate: '2026-10-04' }), createItem({ type: 'review', title: '確認', dueDate: '2026-10-05' }), createItem({ type: 'memo', title: '期限なし' }), completeItem(task())];
  assert.equal(calendarEvents(items).length, 3);
  assert.equal(calendarEvents(items, [{ id: 'outlook-1', source: 'outlook' }]).length, 4);
});
test('グループごとの人数上限と日付別予定を検証する', () => {
  for (const [group, { limit }] of Object.entries(GROUPS)) {
    const state = emptyState();
    for (let i = 0; i < limit; i++) saveMember(state, { id: id(), name: `メンバー${i}`, group, schedules: { '2026-09-29': '9:00 会議\n13:00 訪問' }, extensions: {}, updatedAt: new Date().toISOString() });
    assert.equal(state.members.length, limit);
    assert.throws(() => saveMember(state, { id: id(), name: '上限を超える', group, schedules: {}, extensions: {}, updatedAt: new Date().toISOString() }), /最大/);
  }
});
test('送信予定日時を判定し、送信済みは通知しない', () => {
  const state = emptyState(), now = new Date().toISOString();
  state.reservations = [{ id: id(), groupName: 'テストグループ', scheduledAt: '2026-09-28T09:00', body: '連絡', teamsLink: '', status: 'pending', sentAt: null, extensions: {}, createdAt: now, updatedAt: now }];
  assert.equal(dueReservations(state, new Date('2026-09-27T09:00').getTime()).length, 0);
  assert.equal(dueReservations(state, new Date('2026-09-29T09:00').getTime()).length, 1);
  setReservationSent(state, state.reservations[0].id, true); assert.ok(state.reservations[0].sentAt); assert.equal(dueReservations(state, Infinity).length, 0);
  setReservationSent(state, state.reservations[0].id, false); assert.equal(state.reservations[0].sentAt, null);
});
test('バックアップは全データを往復し、不正形式・重複ID・不整合を拒否', () => {
  const state = emptyState(); state.items.push(completeItem(task({ extensions: { teams: { messageId: '123' } } })));
  assert.deepEqual(parseBackup(serializeBackup(state)), state);
  assert.throws(() => parseBackup('{broken'), /JSON/);
  assert.throws(() => parseBackup('{"app":"other"}'), /バックアップ/);
  const duplicate = structuredClone(state); duplicate.items.push(duplicate.items[0]); assert.throws(() => validateState(duplicate), /重複/);
  const invalid = structuredClone(state); invalid.items[0].type = 'task'; assert.throws(() => validateState(invalid), /状態/);
  const future = structuredClone(state); future.schemaVersion = 2; assert.throws(() => validateState(future), /バージョン/);
});
test('古い編集内容は、別タブの更新を上書きしない', () => {
  const state = emptyState(), a = task({ updatedAt: '2026-09-29T01:00:00.000Z' }); state.items.push(a);
  saveItem(state, { ...a, title: '変更済み', updatedAt: '2026-09-29T02:00:00.000Z' }, a.updatedAt);
  assert.throws(() => saveItem(state, { ...a, title: '古い変更' }, a.updatedAt), /別の画面/); assert.equal(state.items[0].title, '変更済み');
});
test('Teams入力の変換は1行目・全文・元リンク・拡張IDを分離して保持', () => {
  const item = itemFromTeamsMessage({ id: 'm1', chatId: 'c1', webUrl: 'https://teams.microsoft.com/test', plainText: '売場変更\n棚の位置を確認' });
  assert.equal(item.title, '売場変更'); assert.equal(item.body, '売場変更\n棚の位置を確認'); assert.equal(item.source, 'teams'); assert.equal(item.extensions.teams.chatId, 'c1');
});
test('代替保存層でも保存が永続し、容量エラー時に元データを維持', async () => {
  const map = new Map(); let fail = false;
  const storage = { getItem: key => map.get(key) || null, setItem: (key, value) => { if (fail) throw new DOMException('容量超過', 'QuotaExceededError'); map.set(key, value); } };
  const repository = new LocalStorageRepository(storage);
  await repository.update(s => saveItem(s, task()));
  assert.equal((await new LocalStorageRepository(storage).load()).items.length, 1);
  fail = true; await assert.rejects(repository.update(s => { s.items = []; return s; }), { name: 'QuotaExceededError' });
  assert.equal((await repository.load()).items.length, 1);
});
test('IndexedDBの保存・再読み込み・全置き換えと不正更新時の保持', async () => {
  const databaseName = `my-work-test-${id()}`;
  const open = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  let db;
  try {
    db = await open();
    let repository = new IndexedDBRepository(db);
    await repository.update(state => saveItem(state, task()));
    db.close(); db = await open(); repository = new IndexedDBRepository(db);
    assert.equal((await repository.load()).items.length, 1);
    await assert.rejects(repository.update(state => { state.items[0].dueDate = null; return state; }), /期限/);
    assert.equal((await repository.load()).items.length, 1);
    const next = emptyState(); next.items.push(createItem({ type: 'memo', title: '置き換え' }));
    await repository.replace(next);
    assert.equal((await repository.load()).items[0].title, '置き換え');
  } finally {
    db?.close();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('確認用DBを閉じられませんでした。'));
    });
  }
});
