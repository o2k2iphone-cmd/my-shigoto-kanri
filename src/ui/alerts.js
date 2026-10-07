import { activeAlarms, dueReservations } from '../notifications/alarms.js';
import { escapeHtml as e, icon } from './helpers.js';
export function alerts(state) {
  const alarms = activeAlarms(state);
  return alarms.length ? `<div class="alert-banner" role="status">${icon('bell')}<div><strong>アラームのお知らせ <span>${alarms.length}件</span></strong><p>${e(alarms.slice(0, 2).map(({ item }) => item.title).join('、'))}</p></div><button class="button small" data-show-alarms>確認する</button></div>` : '';
}
/** 送信予定通知は予定画面だけで使用します。 */
export function reservationAlerts(state) {
  const reservations = dueReservations(state);
  return reservations.length ? `<div class="alert-banner send-alert" role="status">${icon('send')}<div><strong>送信予定があります <span>${reservations.length}件</span></strong><p>${e(reservations.slice(0, 2).map(r => r.groupName).join('、'))} — Teamsで送信してください</p></div><button class="button small" data-show-due-reservations>確認する</button></div>` : '';
}
