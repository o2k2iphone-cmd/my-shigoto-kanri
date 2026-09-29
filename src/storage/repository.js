import { emptyState, validateState } from '../domain/model.js';
const DATABASE = 'my-shigoto-kanri-v1';
const KEY = 'my-shigoto-kanri-state-v1';
const STORAGE_MODE = 'my-shigoto-kanri-storage-mode-v1';

/** 保存層の契約。将来のOneDriveRepositoryも同じload/update/replaceを実装します。 */
export class Repository {
  async load() { throw new Error('未実装'); }
  async update(mutator) { throw new Error('未実装'); }
  async replace(state) { return this.update(() => validateState(state)); }
}
export class IndexedDBRepository extends Repository {
  constructor(db) { super(); this.db = db; this.kind = 'IndexedDB'; }
  static async open() {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('別のタブを閉じて再読み込みしてください。'));
    });
    db.onversionchange = () => db.close();
    return new IndexedDBRepository(db);
  }
  async load() { return new Promise((resolve, reject) => {
    const transaction = this.db.transaction('documents', 'readonly');
    const request = transaction.objectStore('documents').get('state');
    request.onsuccess = () => { try { resolve(request.result ? validateState(request.result) : emptyState()); } catch (error) { reject(error); } };
    request.onerror = () => reject(request.error);
  }); }
  async update(mutator) { return new Promise((resolve, reject) => {
    const transaction = this.db.transaction('documents', 'readwrite');
    const store = transaction.objectStore('documents');
    const request = store.get('state'); let next, failure;
    request.onsuccess = () => { try {
      const current = request.result ? validateState(request.result) : emptyState();
      next = validateState(mutator(current)); next.updatedAt = new Date().toISOString(); store.put(next, 'state');
    } catch (error) { failure = error; transaction.abort(); } };
    transaction.oncomplete = () => resolve(next);
    transaction.onerror = () => reject(failure || transaction.error || new Error('保存できませんでした。'));
    transaction.onabort = () => reject(failure || transaction.error || new Error('保存が中断されました。'));
  }); }
}
export class LocalStorageRepository extends Repository {
  constructor(storage = globalThis.localStorage) { super(); this.kind = 'LocalStorage'; this.storage = storage; }
  async load() { const value = this.storage.getItem(KEY); return value ? validateState(JSON.parse(value)) : emptyState(); }
  async update(mutator) {
    const write = async () => { const next = validateState(mutator(await this.load())); next.updatedAt = new Date().toISOString(); this.storage.setItem(KEY, JSON.stringify(next)); return next; };
    return globalThis.navigator?.locks ? navigator.locks.request(KEY, write) : write();
  }
}
export async function openRepository() {
  let selected;
  try { selected = localStorage.getItem(STORAGE_MODE); } catch { /* IndexedDBのみ許可された環境も利用可能 */ }
  if (selected === 'localStorage') return new LocalStorageRepository();
  try {
    const repository = await IndexedDBRepository.open();
    try { localStorage.setItem(STORAGE_MODE, 'indexedDB'); } catch { /* 保存先の目印は任意 */ }
    return repository;
  } catch (error) {
    // 既存のIndexedDB利用者には、空の代替DBを見せずエラーを伝えます。
    if (selected === 'indexedDB') throw error;
    const repository = new LocalStorageRepository();
    const probe = KEY + '-probe'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe);
    localStorage.setItem(STORAGE_MODE, 'localStorage');
    return repository;
  }
}
