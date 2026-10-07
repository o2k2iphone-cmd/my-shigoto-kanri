import { validateReservation } from './model.js';

/** 日時入力は日本時間の壁時計として扱い、端末のタイムゾーンでは変換しません。 */
export function reservationJSON(reservation, deletedAt = null) {
  const r = validateReservation(reservation);
  return {
    schemaVersion: 1, source: 'my-shigoto-kanri', id: r.id,
    scheduledAt: `${r.scheduledAt}:00+09:00`, timeZone: 'Asia/Tokyo',
    destinationName: r.groupName, destinationType: 'chat',
    destinationId: typeof r.extensions?.teams?.chatId === 'string' ? r.extensions.teams.chatId || null : null,
    teamsLink: r.teamsLink, body: r.body,
    status: deletedAt ? 'cancelled' : r.status, sentAt: r.sentAt,
    deleted: !!deletedAt, deletedAt,
    createdAt: r.createdAt, updatedAt: deletedAt || r.updatedAt,
    extensions: structuredClone(r.extensions)
  };
}
export function reservationFileName(recordId) {
  // 旧データの任意IDをパスとして解釈しない。通常のUUIDはそのまま使用します。
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(recordId || '') || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(recordId)) throw new Error('予約IDを安全なファイル名にできません。');
  return `${recordId}.json`;
}
export function reservationExportEntries(state, recordId = null) {
  const reservations = recordId ? state.reservations.filter(r => r.id === recordId) : state.reservations;
  if (recordId && !reservations.length) throw new Error('この予約は削除されています。');
  return [
    ...reservations.map(r => ({ id: r.id, reservation: r, deletedAt: null })),
    ...(recordId ? [] : (state.reservationDeletionHistory || []).map(r => ({ id: r.id, reservation: r, deletedAt: r.deletedAt })))
  ];
}
