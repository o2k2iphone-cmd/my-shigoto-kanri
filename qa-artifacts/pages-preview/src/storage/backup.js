import { validateState } from '../domain/model.js';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export function serializeBackup(state) { return JSON.stringify({ app: 'MY仕事管理', backupVersion: 1, exportedAt: new Date().toISOString(), data: validateState(state) }, null, 2); }
export function parseBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('バックアップは10MB以内にしてください。');
  let backup; try { backup = JSON.parse(text); } catch { throw new Error('JSONファイルを読み取れません。'); }
  if (backup.app !== 'MY仕事管理' || backup.backupVersion !== 1) throw new Error('MY仕事管理のバックアップファイルを選択してください。');
  return validateState(backup.data);
}
