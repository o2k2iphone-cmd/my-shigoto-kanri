import { completeItem, validateItem, validateReservation } from './model.js';
function put(array, record, expectedUpdatedAt) {
  const index = array.findIndex(row => row.id === record.id);
  if (expectedUpdatedAt && (index < 0 || array[index].updatedAt !== expectedUpdatedAt)) throw new Error('別の画面で変更されています。詳細を開き直してから編集してください。');
  if (index < 0) array.push(record); else array[index] = record;
}
export function saveItem(state, item, expectedUpdatedAt) { put(state.items, validateItem(item), expectedUpdatedAt); return state; }
export function setCompleted(state, itemId, completed = true) {
  const index = state.items.findIndex(item => item.id === itemId);
  if (index < 0) throw new Error('この作業は削除されています。');
  state.items[index] = completeItem(state.items[index], completed); return state;
}
export function removeRecord(state, collection, recordId, now = new Date().toISOString()) {
  if (!['items', 'reservations'].includes(collection)) throw new Error('対象が正しくありません。');
  const item = collection === 'items' ? state.items.find(row => row.id === recordId) : null;
  const meta = item?.extensions?.microsoftTodo;
  if (item?.source === 'microsoft-todo' && meta?.externalId) {
    state.jsonDeletionHistory ??= [];
    if (!state.jsonDeletionHistory.some(row => row.externalId === meta.externalId)) state.jsonDeletionHistory.push({ externalId: meta.externalId, sourceFileName: meta.sourceFileName || null, deleteRequestedAt: now, completedAt: item.completedAt });
  }
  const reservation = collection === 'reservations' ? state.reservations.find(row => row.id === recordId) : null;
  if (reservation) {
    state.reservationDeletionHistory ??= [];
    state.reservationDeletionHistory.push({ ...structuredClone(reservation), deletedAt: now });
  }
  state[collection] = state[collection].filter(row => row.id !== recordId);
  return state;
}
export function saveReservation(state, reservation, expectedUpdatedAt) {
  if (state.reservationDeletionHistory?.some(row => row.id === reservation.id)) throw new Error('この予約IDは削除済みです。新しい予約として登録してください。');
  put(state.reservations, validateReservation(reservation), expectedUpdatedAt); return state;
}
export function setReservationSent(state, recordId, sent) {
  const r = state.reservations.find(r => r.id === recordId);
  if (!r) throw new Error('この予約は削除されています。');
  r.status = sent ? 'sent' : 'pending'; r.sentAt = sent ? new Date().toISOString() : null; r.updatedAt = new Date().toISOString(); return state;
}
export function acknowledgeAlarms(state, pairs) {
  for (const { itemId, alarmId } of pairs) {
    const alarm = state.items.find(i => i.id === itemId)?.alarms.find(a => a.id === alarmId);
    if (alarm) alarm.acknowledgedAt = new Date().toISOString();
  }
  return state;
}
