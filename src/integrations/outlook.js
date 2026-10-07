import { dueAt } from '../domain/model.js';
export class ManualOutlookProvider {
  capabilities = { readCalendar: false, writeCalendar: false };
  async getEvents() { return []; }
}
/** ローカル期限と将来のOutlook予定は共通CalendarEventとして表示します。 */
export function calendarEvents(items, externalEvents = []) {
  return [...items.filter(item => item.dueDate && !item.archived).map(item => ({ id: item.id, itemId: item.id, title: item.title, date: item.dueDate, time: item.dueTime, type: item.type, source: 'local', startsAt: dueAt(item) })), ...externalEvents];
}
