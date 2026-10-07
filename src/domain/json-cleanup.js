export const JSON_RETENTION_DAYS = 180;
const RETENTION_MS = JSON_RETENTION_DAYS * 86400000;

/** OneDriveへの操作は行わず、元JSONの整理候補だけを返します。 */
export function jsonDeletionCandidates(state, now = Date.now()) {
  const candidates = new Map();
  for (const row of state.jsonDeletionHistory || []) {
    candidates.set(row.externalId, { id: row.externalId, fileName: row.sourceFileName || null, deleteRequestedAt: row.deleteRequestedAt, completedAt: row.completedAt || null, reason: 'manual-delete' });
  }
  for (const item of state.items) {
    const meta = item.extensions?.microsoftTodo;
    if (item.source !== 'microsoft-todo' || !meta?.externalId || !item.completed || !item.completedAt || candidates.has(meta.externalId)) continue;
    if (now - Date.parse(item.completedAt) >= RETENTION_MS) candidates.set(meta.externalId, { id: meta.externalId, fileName: meta.sourceFileName || null, deleteRequestedAt: null, completedAt: item.completedAt, reason: 'completed-over-180-days' });
  }
  return [...candidates.values()];
}
