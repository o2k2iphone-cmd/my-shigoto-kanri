import { openRepository } from './storage/repository.js';
import { serializeBackup, parseBackup, MAX_BACKUP_BYTES } from './storage/backup.js';
import { dateKey, searchItems } from './domain/model.js';
import { saveItem, setCompleted, saveReservation, setReservationSent, removeRecord, acknowledgeAlarms } from './domain/actions.js';
import { jsonDeletionCandidates } from './domain/json-cleanup.js';
import { activeAlarms, dueReservations, startAlarmClock } from './notifications/alarms.js';
import { ManualOutlookProvider } from './integrations/outlook.js';
import { shell } from './ui/layout.js';
import { managePage, sections } from './ui/manage.js';
import { schedulePage } from './ui/schedule.js';
import { otherPage } from './ui/other.js';
import { alerts, reservationAlerts } from './ui/alerts.js';
import { itemDetail, itemForm } from './ui/item-detail.js';
import { plannerForm } from './ui/planner-import.js';
import { todoImportDialog, quickTodoFolderImport, todoImportResult } from './ui/todo-import.js';
import { importTodoRecords } from './integrations/todo-import.js';
import { ImportFolder } from './integrations/import-folder.js';
import { reservationDetail, reservationForm } from './ui/reservations.js';
import { reservationJSON, reservationFileName, reservationExportEntries } from './domain/reservation-export.js';
import { ReservationExportFolder } from './integrations/reservation-export.js';
import { reservationExportSettings, reservationExportResult, reservationDownloadDialog } from './ui/reservation-export.js';
import { showDialog, closeDialog, submitForm, errorArea } from './ui/dialog.js';
import { escapeHtml as e, dateTimeLabel } from './ui/helpers.js';
import { registerPWA, showInstallInstructions, offlineStatus } from './pwa.js';
import { registerAgentTools } from './webmcp.js';

const app = document.querySelector('#app');
const dialogHost = document.querySelector('#dialogs');
const today = new Date();
const ui = { page: getPage(), query: '', filter: 'all', calendarYear: today.getFullYear(), calendarMonth: today.getMonth(), selectedDate: dateKey(), reservationFilter: 'pending', externalEvents: [], folderImportBusy: false };
let repository, state, toastTimer, pageBeforeRender;
const outlookProvider = new ManualOutlookProvider();
const importFolder = new ImportFolder();
const reservationExportFolder = new ReservationExportFolder();
let reservationExportBusy = false;
function reservationExportView() { return { supported: reservationExportFolder.supported, name: reservationExportFolder.handle?.name || '', busy: reservationExportBusy, warning: reservationExportFolder.warning }; }
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('my-shigoto-kanri') : null;
function getPage() { const hash = location.hash.slice(1); return ['manage', 'schedule', 'other'].includes(hash) ? hash : 'manage'; }
function toast(message, error = false) { const target = document.querySelector('#toast'); clearTimeout(toastTimer); target.textContent = message; target.className = `visible ${error ? 'error' : ''}`; toastTimer = setTimeout(() => { target.className = ''; }, error ? 7000 : 4000); }
function render() {
  if (!state) return;
  ui.reservationExport = reservationExportView();
  app.innerHTML = shell(ui.page, repository.kind, ui.page === 'manage' ? managePage(state, ui) : ui.page === 'schedule' ? schedulePage(state, ui) : otherPage(state, ui, repository.kind));
  renderAlerts();
  if (ui.page === 'manage') {
    document.querySelector('#item-search').addEventListener('input', event => { ui.query = event.target.value; renderSections(); });
    document.querySelector('#type-filter').addEventListener('change', event => { ui.filter = event.target.value; renderSections(); });
  }
  if (ui.page === 'schedule') {
    document.querySelector('#reservation-filter').addEventListener('change', event => { ui.reservationFilter = event.target.value; render(); });
  }
  if (ui.page === 'other') {
    document.querySelector('#restore-file').addEventListener('change', prepareRestore);
    document.querySelector('#settings-form').addEventListener('submit', event => {
      event.preventDefault(); const form = event.target;
      submitForm(form, async () => { const data = new FormData(form); await mutate(current => { current.settings = { ...current.settings, defaultDueTime: data.get('defaultDueTime'), alarmsEnabled: data.has('alarmsEnabled'), weekStartsMonday: data.has('weekStartsMonday') }; return current; }, '設定を保存しました'); });
    });
    updateOfflineStatus();
  }
  if (pageBeforeRender !== ui.page) { window.scrollTo(0, 0); pageBeforeRender = ui.page; }
}
function renderSections() {
  // 検索中は入力欄を作り直さず、カーソルと日本語入力の状態を保持します。
  const target = document.querySelector('#item-sections'); if (target) target.innerHTML = sections(searchItems(state.items, ui.query, ui.filter), ui.query, ui.filter);
}
function renderAlerts() { const target = document.querySelector('#alerts'); if (target) target.innerHTML = (ui.page === 'schedule' ? reservationAlerts(state) : '') + alerts(state); }
function updateOfflineStatus() { const target = document.querySelector('#offline-status'); if (target) target.textContent = offlineStatus(); }
async function mutate(mutator, message) {
  try {
    state = await repository.update(mutator);
    channel?.postMessage({ updatedAt: state.updatedAt }); render();
    if (message) toast(message);
    return state;
  } catch (error) {
    if (['QuotaExceededError', 'UnknownError'].includes(error.name)) throw new Error('端末の保存容量が不足しているか、保存が制限されています。編集内容を控えて、保存設定を確認してください。');
    throw error;
  }
}
function editItem(itemId, defaults = {}) {
  const existing = itemId ? state.items.find(item => item.id === itemId) : null;
  if (itemId && !existing) throw new Error('この情報は削除されています。');
  const { form, read } = itemForm(existing, state.settings, defaults);
  form.addEventListener('submit', event => { event.preventDefault(); submitForm(form, async () => { const item = read(); await mutate(current => saveItem(current, item, existing?.updatedAt), '保存しました'); closeDialog(true); }); });
}
function registerFromPlanner() {
  const { form, read } = plannerForm(state.settings);
  form.addEventListener('submit', event => {
    event.preventDefault();
    submitForm(form, async () => {
      const item = read();
      await mutate(current => saveItem(current, item), '手動で登録しました');
      closeDialog(true);
    });
  });
}
async function commitTodoJson(entries, options) {
  let report;
  await mutate(current => { report = importTodoRecords(current, entries, options); return report.state; });
  return report;
}
function registerFromTodoJson(notice = '') {
  todoImportDialog({ getState: () => state, folder: importFolder, onPreference: patch => mutate(current => { current.settings = { ...current.settings, ...patch }; return current; }), onCommit: commitTodoJson, notice });
}
async function registerFromTodoFolder() {
  if (ui.folderImportBusy) return;
  ui.folderImportBusy = true; render();
  try {
    await quickTodoFolderImport({ folder: importFolder, onCommit: commitTodoJson, onNeedsSetup: registerFromTodoJson, onReport: report => {
      showDialog('フォルダから一括取込', `<p class="field-hint">時差のない期限日時はUTC相当として日本時間へ変換しました。詳細設定の日時解釈は変更していません。</p>${todoImportResult(report)}<div class="dialog-actions"><button class="button" data-todo-import>詳細設定を開く</button><button class="button primary" data-cancel>閉じる</button></div>`, { wide: true });
    } });
  } finally { ui.folderImportBusy = false; render(); }
}
function editReservation(reservationId) {
  const existing = reservationId ? state.reservations.find(r => r.id === reservationId) : null;
  if (reservationId && !existing) throw new Error('この予約は削除されています。');
  const { form, read } = reservationForm(existing);
  form.addEventListener('submit', event => { event.preventDefault(); submitForm(form, async () => { const r = read(); await mutate(current => saveReservation(current, r, existing?.updatedAt), '送信予約を保存しました'); closeDialog(true); }); });
}
async function chooseReservationExportFolder(target) {
  target.disabled = true;
  try { await reservationExportFolder.choose(); render(); reservationExportSettings(reservationExportFolder); toast('予約JSONの保存フォルダーを設定しました'); }
  catch (error) {
    if (error.name !== 'AbortError') {
      const area = target.closest('.dialog')?.querySelector('[data-form-error]');
      if (area) { area.textContent = error.message || 'フォルダーを設定できませんでした。'; area.hidden = false; }
      else throw error;
    }
  } finally { target.disabled = false; }
}
async function exportReservationJSON(recordId = null) {
  if (reservationExportBusy) return;
  if (!reservationExportFolder.supported) {
    if (recordId) return downloadReservationJSON(recordId);
    return reservationDownloadDialog(reservationExportEntries(await repository.load()));
  }
  // 1件の書き出しは、保存フォルダー未設定でも画面から完了できるようにする。
  if (!reservationExportFolder.handle) {
    if (recordId) return downloadReservationJSON(recordId);
    return reservationExportSettings(reservationExportFolder);
  }
  reservationExportBusy = true;
  try {
    // ユーザー操作直後に書込の再許可を要求し、許可後に最新の予約を読みます。
    await reservationExportFolder.authorize(); render();
    const latest = await repository.load();
    const report = await reservationExportFolder.write(reservationExportEntries(latest, recordId));
    reservationExportResult(report);
  } finally { reservationExportBusy = false; render(); }
}
async function downloadReservationJSON(recordId) {
  const latest = await repository.load();
  const entry = reservationExportEntries(latest).find(row => row.id === recordId);
  if (!entry) throw new Error('この予約が見つかりません。');
  downloadJSON(JSON.stringify(reservationJSON(entry.reservation, entry.deletedAt), null, 2) + '\n', reservationFileName(recordId));
  toast('JSONのダウンロードを開始しました。OneDriveのTeams送信予約フォルダーへ保存してください');
}
function showAlarms() {
  const list = activeAlarms(state);
  showDialog('アラームのお知らせ', `${list.length ? list.map(({ item, alarm }) => `<div class="notification-row"><div><strong>${e(item.title)}</strong><p>${e(alarm.label)} · ${e(dateTimeLabel(alarm.at))}</p></div><button class="text-button" data-detail="${e(item.id)}">詳細</button><button class="button small" data-ack-alarm="${e(alarm.id)}" data-alarm-item="${e(item.id)}">確認済み</button></div>`).join('') : '<p class="muted">未確認のアラームはありません</p>'}<div class="dialog-actions"><span class="field-hint">確認済みにすると、お知らせから消えます。</span>${list.length ? '<button class="button" data-ack-all>すべて確認済みにする</button>' : ''}</div>`);
}
function showDueReservations() {
  const list = dueReservations(state);
  showDialog('送信予定があります', `${list.map(r => `<div class="notification-row"><div><strong>${e(r.groupName)}</strong><p>${e(dateTimeLabel(r.scheduledAt))}</p></div><button class="button small" data-reservation-detail="${e(r.id)}">本文を確認</button></div>`).join('')}<p class="info-note">Teamsで手動送信後、予約の詳細から送信済みにしてください。</p>`);
}
async function exportBackup() {
  const latest = await repository.load();
  const text = serializeBackup(latest);
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('バックアップが10MBを超えています。不要な本文を整理してから書き出してください。');
  downloadJSON(text, `MY仕事管理_${dateKey()}_${Date.now()}.json`);
  await mutate(current => { current.settings.lastBackupAt = new Date().toISOString(); return current; }, 'バックアップのダウンロードを開始しました');
}
function downloadJSON(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function prepareRestore(event) {
  const input = event.target, file = input.files[0]; if (!file) return;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('バックアップは10MB以内にしてください。');
    const incoming = parseBackup(await file.text());
    const dialog = showDialog('バックアップを復元', `<p>次のデータで、この端末の現在の情報を置き換えます。</p><div class="restore-preview"><div><span>管理データ</span><strong>${incoming.items.length}件</strong></div><div><span>削除対象履歴</span><strong>${incoming.jsonDeletionHistory.length}件</strong></div><div><span>送信予約</span><strong>${incoming.reservations.length}件</strong></div></div><p class="info-note">現在：管理データ ${state.items.length}件 / 削除対象履歴 ${state.jsonDeletionHistory.length}件 / 送信予約 ${state.reservations.length}件。<br>必要な情報は先にバックアップしてください。取消履歴 ${incoming.reservationDeletionHistory.length}件も復元します。復元後は取込・予約JSON保存フォルダーを再設定してください。</p><form id="restore-form"><label class="checkbox-label"><input type="checkbox" required name="confirm">現在のデータを置き換えることを確認しました</label>${errorArea}<div class="dialog-actions"><button type="button" class="button" id="backup-before-restore">現在のバックアップを保存</button><button type="submit" class="button primary">この内容で復元する</button></div></form>`);
    const form = dialog.querySelector('form');
    form.addEventListener('submit', event => { event.preventDefault(); submitForm(form, async () => {
      await mutate(() => incoming, 'バックアップを復元しました。取込・保存フォルダーを再設定してください');
      try { await importFolder.reset(); } catch { toast('復元は完了しました。フォルダー設定を解除できなかったため、次の取込前に必ず再設定してください。', true); }
      try { await reservationExportFolder.reset(); } catch { toast('復元は完了しました。予約JSONの保存フォルダーを次の書き出し前に再設定してください。', true); }
      render();
      closeDialog(true);
    }); });
    dialog.querySelector('#backup-before-restore').addEventListener('click', () => exportBackup().catch(error => toast(error.message, true)));
  } catch (error) { toast(error.message, true); } finally { input.value = ''; }
}
async function deleteRecord(collection, recordId) {
  const record = state[collection].find(r => r.id === recordId);
  if (!record) throw new Error('すでに削除されています。');
  const title = record.title || record.groupName;
  if (!window.confirm(`「${title}」を削除しますか？\n元に戻すにはバックアップからの復元が必要です。${collection === 'reservations' ? '\n書き出し済みJSONの取消を反映するには、削除後に「予約JSONを書き出す」を押してください。' : ''}`)) return;
  await mutate(current => removeRecord(current, collection, recordId), collection === 'reservations' ? '削除しました。予約JSONを書き出して取消を反映してください' : '削除しました'); closeDialog(true);
}
async function handleClick(event) {
  const target = event.target.closest('button,a,input[type=checkbox]'); if (!target) return;
  const data = target.dataset;
  try {
    if (data.cancel !== undefined) return closeDialog();
    if (data.reservationFolderSettings !== undefined) return reservationExportSettings(reservationExportFolder);
    if (data.reservationFolderChoose !== undefined) return await chooseReservationExportFolder(target);
    if (data.exportReservations !== undefined) return await exportReservationJSON();
    if (data.exportReservation) return await exportReservationJSON(data.exportReservation);
    if (data.downloadReservation) return await downloadReservationJSON(data.downloadReservation);
    if (data.todoFolderImport !== undefined) return await registerFromTodoFolder();
    if (data.todoImport !== undefined) return registerFromTodoJson();
    if (data.plannerImport !== undefined) return registerFromPlanner();
    if (data.newItem) return editItem(null, { type: data.newItem, dueDate: data.defaultDate || (data.newItem === 'task' ? dateKey() : null) });
    if (data.detail) return itemDetail(state.items.find(item => item.id === data.detail));
    if (data.editItem) return editItem(data.editItem);
    if (data.complete || data.uncomplete) { await mutate(current => setCompleted(current, data.complete || data.uncomplete, !!data.complete), data.complete ? '完了しました。アーカイブ保管に移動しました' : '未完了に戻しました'); closeDialog(true); return; }
    if (data.deleteItem) return await deleteRecord('items', data.deleteItem);
    if (data.monthStep) { const next = new Date(ui.calendarYear, ui.calendarMonth + Number(data.monthStep), 1); ui.calendarYear = next.getFullYear(); ui.calendarMonth = next.getMonth(); ui.selectedDate = dateKey(next); return render(); }
    if (data.calendarToday !== undefined) { const now = new Date(); ui.calendarYear = now.getFullYear(); ui.calendarMonth = now.getMonth(); ui.selectedDate = dateKey(now); return render(); }
    if (data.calendarDate) { ui.selectedDate = data.calendarDate; return render(); }
    if (data.newReservation !== undefined || data.editReservation) return editReservation(data.editReservation);
    if (data.reservationDetail) return reservationDetail(state.reservations.find(r => r.id === data.reservationDetail), reservationExportView());
    if (data.deleteReservation) return await deleteRecord('reservations', data.deleteReservation);
    if (data.reservationSent) { await mutate(current => setReservationSent(current, data.reservationSent, data.sent === 'true'), data.sent === 'true' ? '送信済みにしました' : '未送信に戻しました'); closeDialog(true); return; }
    if (data.copyReservation) {
      const r = state.reservations.find(r => r.id === data.copyReservation);
      try { await navigator.clipboard.writeText(r.body); toast('本文をコピーしました'); }
      catch { const dialog = showDialog('本文をコピー', `<p class="field-hint">本文を選択してコピーしてください。</p><textarea readonly rows="10" aria-label="コピーする送信本文">${e(r.body)}</textarea>`); const textarea = dialog.querySelector('textarea'); textarea.focus(); textarea.select(); }
      return;
    }
    if (data.showAlarms !== undefined) return showAlarms();
    if (data.showDueReservations !== undefined && ui.page === 'schedule') return showDueReservations();
    if (data.ackAlarm) { await mutate(current => acknowledgeAlarms(current, [{ itemId: data.alarmItem, alarmId: data.ackAlarm }]), 'アラームを確認済みにしました'); return showAlarms(); }
    if (data.ackAll !== undefined) { const pairs = activeAlarms(state).map(({ item, alarm }) => ({ itemId: item.id, alarmId: alarm.id })); await mutate(current => acknowledgeAlarms(current, pairs), 'すべて確認済みにしました'); return showAlarms(); }
    if (data.scroll) { event.preventDefault(); document.getElementById(data.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (target.id === 'export-backup') return await exportBackup();
    if (target.id === 'export-json-cleanup') {
      const candidates = jsonDeletionCandidates(await repository.load());
      downloadJSON(JSON.stringify(candidates, null, 2), `MY仕事管理_JSON削除対象_${dateKey()}.json`);
      toast(`JSON削除対象 ${candidates.length}件を書き出しました`); return;
    }
    if (target.id === 'install-app') return await showInstallInstructions();
  } catch (error) { if (target.matches('input[type=checkbox]')) target.checked = false; toast(error.message || '操作できませんでした。', true); }
}
app.addEventListener('click', handleClick); dialogHost.addEventListener('click', handleClick);
window.addEventListener('hashchange', () => { ui.page = getPage(); render(); });
window.addEventListener('online', () => { renderAlerts(); const el = document.querySelector('#connection'); if (el) el.textContent = 'オンライン'; });
window.addEventListener('offline', () => { const el = document.querySelector('#connection'); if (el) el.textContent = 'オフライン'; toast('オフラインです。端末内の情報を利用できます'); });
try {
  repository = await openRepository(); state = await repository.load(); await importFolder.initialize(); await reservationExportFolder.initialize(); render();
  if (repository.kind === 'LocalStorage') toast('IndexedDBを利用できないため、LocalStorageに保存します', true);
  channel?.addEventListener('message', async () => { try { state = await repository.load(); render(); } catch (error) { toast(error.message, true); } });
  window.addEventListener('storage', async event => { if (event.key === 'my-shigoto-kanri-state-v1') { try { state = await repository.load(); render(); } catch (error) { toast(error.message, true); } } });
  startAlarmClock(() => {
    renderAlerts();
    if (!document.querySelector('#dialogs .dialog') && !document.activeElement?.matches('input,textarea,select')) render();
  });
  registerPWA(updateOfflineStatus, message => toast(message));
  registerAgentTools({ search: query => searchItems(state.items, query).map(item => ({ id: item.id, type: item.type, title: item.title, dueDate: item.dueDate })), startCreation: type => editItem(null, { type, dueDate: type === 'task' ? dateKey() : null }) });
  ui.externalEvents = await outlookProvider.getEvents();
} catch (error) {
  console.error(error);
  app.innerHTML = `<main class="startup-error"><img src="./assets/icon.svg" width="48" alt=""><h1>MY仕事管理</h1><p>保存データを開けませんでした。</p><p>${e(error.message)}</p><p>ブラウザの保存設定と、他のタブを確認してください。保存データは自動で削除しません。</p><button class="button primary" id="retry-start">再読み込み</button></main>`;
  document.querySelector('#retry-start').addEventListener('click', () => location.reload());
}
