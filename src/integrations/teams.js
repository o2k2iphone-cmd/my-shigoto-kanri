import { createItem } from '../domain/model.js';
/** Graph許可後はこのプロバイダーを差し替えます。現在はネットワーク通信なし。 */
export class ManualTeamsProvider {
  capabilities = { importMessage: false, sendMessage: false };
  async getMessage() { throw new Error('Teams本文は手動で入力してください。'); }
  async sendMessage() { throw new Error('自動送信は未接続です。Teamsで手動送信してください。'); }
}
export function itemFromTeamsMessage(message, { type = 'memo', dueDate = null, dueTime = null } = {}) {
  const body = message.plainText || '';
  return createItem({ type, title: body.split(/\r?\n/).find(line => line.trim())?.trim().slice(0, 200) || 'Teamsメッセージ', body, dueDate, dueTime, teamsLink: message.webUrl || '', source: 'teams', extensions: { teams: { messageId: message.id || null, chatId: message.chatId || null, tenantId: message.tenantId || null } } });
}
