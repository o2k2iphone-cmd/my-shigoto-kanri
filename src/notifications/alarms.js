export function activeAlarms(state, now = Date.now()) {
  if (!state.settings.alarmsEnabled) return [];
  return state.items.filter(item => !item.archived && !item.completed).flatMap(item => item.alarms.filter(alarm => alarm.enabled && alarm.at && !alarm.acknowledgedAt && new Date(alarm.at).getTime() <= now).map(alarm => ({ item, alarm })));
}
export function dueReservations(state, now = Date.now()) { return state.reservations.filter(r => r.status === 'pending' && new Date(r.scheduledAt).getTime() <= now).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)); }
/** アプリを開いている間・復帰時に確認。バックグラウンド送信やプッシュは行いません。 */
export function startAlarmClock(onTick) {
  const timer = setInterval(onTick, 30000);
  const wake = () => { if (!document.hidden) onTick(); };
  document.addEventListener('visibilitychange', wake); window.addEventListener('focus', onTick);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', onTick); };
}
