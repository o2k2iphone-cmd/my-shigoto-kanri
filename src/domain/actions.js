import { completeItem, validateItem, validateMember, validateReservation, validateState } from './model.js';
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
export function removeRecord(state, collection, recordId) { if (!['items', 'members', 'reservations'].includes(collection)) throw new Error('対象が正しくありません。'); state[collection] = state[collection].filter(r => r.id !== recordId); return state; }
export function saveMember(state, member, expectedUpdatedAt) { put(state.members, validateMember(member), expectedUpdatedAt); return validateState(state); }
export function saveReservation(state, reservation, expectedUpdatedAt) { put(state.reservations, validateReservation(reservation), expectedUpdatedAt); return state; }
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
