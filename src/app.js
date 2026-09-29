import { openRepository } from './storage/repository.js';
import { serializeBackup, parseBackup, MAX_BACKUP_BYTES } from './storage/backup.js';
import { dateKey, validateDate, searchItems } from './domain/model.js';
import { saveItem, setCompleted, saveMember, saveReservation, setReservationSent, removeRecord, acknowledgeAlarms } from './domain/actions.js';
import { activeAlarms, dueReservations, startAlarmClock } from './notifications/alarms.js';
import { ManualOutlookProvider } from './integrations/outlook.js';
import { shell } from './ui/layout.js';
import { managePage, sections } from './ui/manage.js';
import { schedulePage } from './ui/schedule.js';
import { otherPage } from './ui/other.js';
import { alerts } from './ui/alerts.js';
import { itemDetail, itemForm } from './ui/item-detail.js';
import { plannerForm } from './ui/planner-import.js';
import { memberDetail, memberForm } from './ui/members.js';
import { reservationDetail, reservationForm } from './ui/reservations.js';
import { showDialog, closeDialog, submitForm, errorArea } from './ui/dialog.js';
import { escapeHtml as e, dateTimeLabel } from './ui/helpers.js';
import { registerPWA, showInstallInstructions, offlineStatus } from './pwa.js';
import { registerAgentTools } from './webmcp.js';

const app = document.querySelector('#app');
const dialogHost = document.querySelector('#dialogs');
const today = new Date();
const ui = { page: getPage(), query: '', filter: 'all', calendarYear: today.getFullYear(), calendarMonth: today.getMonth(), selectedDate: dateKey(), memberDate: dateKey(), memberGroup: 'sv', reservationFilter: 'pending', externalEvents: [] };
let repository, state, toastTimer, pageBeforeRender;
const outlookProvider = new ManualOutlookProvider();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('my-shigoto-kanri') : null;
function getPage() { const hash = location.hash.slice(1); return ['manage', 'schedule', 'other'].includes(hash) ? hash : 'manage'; }
function toast(message, error = false) { const target = document.querySelector('#toast'); clearTimeout(toastTimer); target.textContent = message; target.className = `visible ${error ? 'error' : ''}`; toastTimer = setTimeout(() => { target.className = ''; }, error ? 7000 : 4000); }
function render() {
  if (!state) return;
  app.innerHTML = shell(ui.page, repository.kind, ui.page === 'manage' ? managePage(state, ui) : ui.page === 'schedule' ? schedulePage(state, ui) : otherPage(state, ui, repository.kind));
  renderAlerts();
  if (ui.page === 'manage') {
    document.querySelector('#item-search').addEventListener('input', event => { ui.query = event.target.value; renderSections(); });
    document.querySelector('#type-filter').addEventListener('change', event => { ui.filter = event.target.value; renderSections(); });
  }
  if (ui.page === 'schedule') document.querySelector('#member-date').addEventListener('change', event => { try { ui.memberDate = validateDate(event.target.value); render(); } catch (error) { toast(error.message, true); } });
  if (ui.page === 'other') {
    document.querySelector('#reservation-filter').addEventListener('change', event => { ui.reservationFilter = event.target.value; render(); });
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
function renderAlerts() { const target = document.querySelector('#alerts'); if (target) target.innerHTML = alerts(state); }
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
function editMember(memberId) {
  const existing = memberId ? state.members.find(member => member.id === memberId) : null;
  if (memberId && !existing) throw new Error('このメンバーは削除されています。');
  const { form, read } = memberForm(existing, ui.memberDate, ui.memberGroup);
  form.addEventListener('submit', event => { event.preventDefault(); submitForm(form, async () => { const member = read(); await mutate(current => saveMember(current, member, existing?.updatedAt), 'メンバーと予定を保存しました'); closeDialog(true); }); });
}
function registerFromPlanner() {
  const { form, read } = plannerForm(state.settings);
  form.addEventListener('submit', event => {
    event.preventDefault();
    submitForm(form, async () => {
      const item = read();
      await mutate(current => saveItem(current, item), 'Plannerの内容を登録しました');
      closeDialog(true);
    });
  });
}
function editReservation(reservationId) {
  const existing = reservationId ? state.reservations.find(r => r.id === reservationId) : null;
  if (reservationId && !existing) throw new Error('この予約は削除されています。');
  const { form, read } = reservationForm(existing);
  form.addEventListener('submit', event => { event.preventDefault(); submitForm(form, async () => { const r = read(); await mutate(current => saveReservation(current, r, existing?.updatedAt), '送信予約を保存しました'); closeDialog(true); }); });
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
    const dialog = showDialog('バックアップを復元', `<p>次のデータで、この端末の現在の情報を置き換えます。</p><div class="restore-preview"><div><span>管理データ</span><strong>${incoming.items.length}件</strong></div><div><span>メンバー</span><strong>${incoming.members.length}名</strong></div><div><span>送信予約</span><strong>${incoming.reservations.length}件</strong></div></div><p class="info-note">現在：管理データ ${state.items.length}件 / メンバー ${state.members.length}名 / 送信予約 ${state.reservations.length}件。<br>必要な情報は先にバックアップしてください。</p><form id="restore-form"><label class="checkbox-label"><input type="checkbox" required name="confirm">現在のデータを置き換えることを確認しました</label>${errorArea}<div class="dialog-actions"><button type="button" class="button" id="backup-before-restore">現在のバックアップを保存</button><button type="submit" class="button primary">この内容で復元する</button></div></form>`);
    const form = dialog.querySelector('form');
    form.addEventListener('submit', event => { event.preventDefault(); submitForm(form, async () => { await mutate(() => incoming, 'バックアップを復元しました'); closeDialog(true); }); });
    dialog.querySelector('#backup-before-restore').addEventListener('click', () => exportBackup().catch(error => toast(error.message, true)));
  } catch (error) { toast(error.message, true); } finally { input.value = ''; }
}
async function deleteRecord(collection, recordId) {
  const record = state[collection].find(r => r.id === recordId);
  if (!record) throw new Error('すでに削除されています。');
  const title = record.title || record.name || record.groupName;
  if (!window.confirm(`「${title}」を削除しますか？\n元に戻すにはバックアップからの復元が必要です。`)) return;
  await mutate(current => removeRecord(current, collection, recordId), '削除しました'); closeDialog(true);
}
async function handleClick(event) {
  const target = event.target.closest('button,a,input[type=checkbox]'); if (!target) return;
  const data = target.dataset;
  try {
    if (data.cancel !== undefined) return closeDialog();
    if (data.plannerImport !== undefined) return registerFromPlanner();
    if (data.newItem) return editItem(null, { type: data.newItem, dueDate: data.defaultDate || (data.newItem === 'task' ? dateKey() : null) });
    if (data.detail) return itemDetail(state.items.find(item => item.id === data.detail));
    if (data.editItem) return editItem(data.editItem);
    if (data.complete || data.uncomplete) { await mutate(current => setCompleted(current, data.complete || data.uncomplete, !!data.complete), data.complete ? '完了しました。アーカイブ保管に移動しました' : '未完了に戻しました'); closeDialog(true); return; }
    if (data.deleteItem) return await deleteRecord('items', data.deleteItem);
    if (data.monthStep) { const next = new Date(ui.calendarYear, ui.calendarMonth + Number(data.monthStep), 1); ui.calendarYear = next.getFullYear(); ui.calendarMonth = next.getMonth(); ui.selectedDate = dateKey(next); return render(); }
    if (data.calendarToday !== undefined) { const now = new Date(); ui.calendarYear = now.getFullYear(); ui.calendarMonth = now.getMonth(); ui.selectedDate = dateKey(now); return render(); }
    if (data.calendarDate) { ui.selectedDate = data.calendarDate; return render(); }
    if (data.memberGroup) { ui.memberGroup = data.memberGroup; return render(); }
    if (data.memberDetail) return memberDetail(state.members.find(m => m.id === data.memberDetail), ui.memberDate);
    if (data.newMember !== undefined || data.editMember) return editMember(data.editMember);
    if (data.deleteMember) return await deleteRecord('members', data.deleteMember);
    if (data.newReservation !== undefined || data.editReservation) return editReservation(data.editReservation);
    if (data.reservationDetail) return reservationDetail(state.reservations.find(r => r.id === data.reservationDetail));
    if (data.deleteReservation) return await deleteRecord('reservations', data.deleteReservation);
    if (data.reservationSent) { await mutate(current => setReservationSent(current, data.reservationSent, data.sent === 'true'), data.sent === 'true' ? '送信済みにしました' : '未送信に戻しました'); closeDialog(true); return; }
    if (data.copyReservation) {
      const r = state.reservations.find(r => r.id === data.copyReservation);
      try { await navigator.clipboard.writeText(r.body); toast('本文をコピーしました'); }
      catch { const dialog = showDialog('本文をコピー', `<p class="field-hint">本文を選択してコピーしてください。</p><textarea readonly rows="10" aria-label="コピーする送信本文">${e(r.body)}</textarea>`); const textarea = dialog.querySelector('textarea'); textarea.focus(); textarea.select(); }
      return;
    }
    if (data.showAlarms !== undefined) return showAlarms();
    if (data.showDueReservations !== undefined) return showDueReservations();
    if (data.ackAlarm) { await mutate(current => acknowledgeAlarms(current, [{ itemId: data.alarmItem, alarmId: data.ackAlarm }]), 'アラームを確認済みにしました'); return showAlarms(); }
    if (data.ackAll !== undefined) { const pairs = activeAlarms(state).map(({ item, alarm }) => ({ itemId: item.id, alarmId: alarm.id })); await mutate(current => acknowledgeAlarms(current, pairs), 'すべて確認済みにしました'); return showAlarms(); }
    if (data.scroll) { event.preventDefault(); document.getElementById(data.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (target.id === 'export-backup') return await exportBackup();
    if (target.id === 'install-app') return await showInstallInstructions();
  } catch (error) { if (target.matches('input[type=checkbox]')) target.checked = false; toast(error.message || '操作できませんでした。', true); }
}
app.addEventListener('click', handleClick); dialogHost.addEventListener('click', handleClick);
window.addEventListener('hashchange', () => { ui.page = getPage(); render(); });
window.addEventListener('online', () => { renderAlerts(); const el = document.querySelector('#connection'); if (el) el.textContent = 'オンライン'; });
window.addEventListener('offline', () => { const el = document.querySelector('#connection'); if (el) el.textContent = 'オフライン'; toast('オフラインです。端末内の情報を利用できます'); });
try {
  repository = await openRepository(); state = await repository.load(); render();
  if (repository.kind === 'LocalStorage') toast('IndexedDBを利用できないため、LocalStorageに保存します', true);
  channel?.addEventListener('message', async () => { try { state = await repository.load(); render(); } catch (error) { toast(error.message, true); } });
  window.addEventListener('storage', async event => { if (event.key === 'my-shigoto-kanri-state-v1') { try { state = await repository.load(); render(); } catch (error) { toast(error.message, true); } } });
  let currentDate = dateKey();
  startAlarmClock(() => {
    const nextDate = dateKey(); if (currentDate !== nextDate) { if (ui.memberDate === currentDate) ui.memberDate = nextDate; currentDate = nextDate; }
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
