/** フォルダーハンドルはJSONバックアップと分離し、このブラウザ内だけに保存します。 */
export class ImportFolderStore {
  constructor(databaseName = 'my-shigoto-import-folder-v1') { this.databaseName = databaseName; }
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('settings');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('フォルダー設定の保存が別の画面で使用中です。'));
    });
  }
  async access(mode, operation) {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('settings', mode);
        const request = operation(tx.objectStore('settings'));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('フォルダー設定を保存できませんでした。'));
      });
    } finally { db.close(); }
  }
  load() { return this.access('readonly', store => store.get('directory')); }
  save(handle) { return this.access('readwrite', store => store.put(handle, 'directory')); }
  clear() { return this.access('readwrite', store => store.delete('directory')); }
}
