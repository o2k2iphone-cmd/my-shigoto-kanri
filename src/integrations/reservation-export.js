import { ImportFolderStore } from '../storage/import-folder.js';
import { reservationJSON, reservationFileName } from '../domain/reservation-export.js';

/** クラウド通信なし。To Do取込とは別のDBに書込用ハンドルだけを保存します。 */
export class ReservationExportFolder {
  constructor({ environment = globalThis, store = new ImportFolderStore('my-shigoto-reservation-export-folder-v1') } = {}) {
    this.environment = environment; this.store = store; this.handle = null; this.warning = ''; this.permission = 'prompt';
    this.supported = !!environment.isSecureContext && typeof environment.showDirectoryPicker === 'function';
  }
  async initialize() {
    if (!this.supported) return;
    try {
      const handle = await this.store.load();
      if (handle?.kind === 'directory' && typeof handle.getFileHandle === 'function' && typeof handle.queryPermission === 'function' && typeof handle.requestPermission === 'function') {
        this.handle = handle; this.permission = await handle.queryPermission({ mode: 'readwrite' });
      }
    } catch { this.warning = '保存フォルダー設定を開けません。フォルダーを再設定してください。'; }
  }
  async choose() {
    if (!this.supported) throw new Error('フォルダー保存に対応していません。予約の詳細からJSONをダウンロードしてください。');
    const handle = await this.environment.showDirectoryPicker({ id: 'my-work-teams-export', mode: 'readwrite' });
    this.handle = handle; this.permission = 'granted'; this.warning = '';
    try { await this.store.save(handle); }
    catch { this.warning = 'フォルダー設定を永続保存できませんでした。次回は再設定してください。'; }
    return handle.name;
  }
  async authorize() {
    if (!this.handle) throw new Error('「保存フォルダー設定」でOneDrive同期フォルダーの「Teams送信予約」を選択してください。');
    // 書き出しボタンから、業務DBの読込より先に呼びます。
    this.permission = await this.handle.requestPermission({ mode: 'readwrite' });
    if (this.permission !== 'granted') throw new Error('フォルダーへの書込が許可されていません。保存フォルダーを再設定するか、再度書き出して許可してください。');
  }
  async write(entries) {
    const locks = this.environment.navigator?.locks;
    if (locks) return locks.request('my-work-reservation-json-export', () => this.writeUnlocked(entries));
    return this.writeUnlocked(entries);
  }
  async writeUnlocked(entries) {
    const handle = this.handle;
    if (!handle || await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('保存フォルダーの書込権限を確認してください。');
    const report = { written: 0, cancelled: 0, error: 0, results: [] };
    for (const entry of entries) {
      let fileName;
      try {
        fileName = reservationFileName(entry.id);
        const payload = reservationJSON(entry.reservation, entry.deletedAt);
        const file = await handle.getFileHandle(fileName, { create: true });
        const existing = await file.getFile();
        if (existing.size) {
          if (existing.size > 1024 * 1024) throw new Error('同名ファイルが大きすぎるため上書きしません。');
          let previous;
          try { previous = JSON.parse(await existing.text()); } catch { throw new Error('同名ファイルを確認できないため上書きしません。'); }
          if (previous.source !== payload.source || previous.schemaVersion !== 1 || previous.id !== payload.id) throw new Error('同名の別ファイルがあるため上書きしません。');
          const previousTime = Date.parse(previous.updatedAt), nextTime = Date.parse(payload.updatedAt);
          if (!Number.isFinite(previousTime) || previousTime > nextTime || (previous.deleted && !payload.deleted && previousTime >= nextTime)) throw new Error('保存先に新しい内容または取消済みデータがあります。古い予約で上書きしません。');
        }
        const writable = await file.createWritable({ keepExistingData: false });
        try { await writable.write(JSON.stringify(payload, null, 2) + '\n'); await writable.close(); }
        catch (error) { try { await writable.abort(); } catch { /* 元の書込エラーを表示 */ } throw error; }
        report.written++; if (payload.deleted) report.cancelled++;
        report.results.push({ id: entry.id, fileName, ok: true });
      } catch (error) {
        report.error++; report.results.push({ id: entry.id, fileName: fileName || entry.id, ok: false, message: error.message || '書き込めませんでした。' });
      }
    }
    return report;
  }
  async reset() {
    this.handle = null; this.permission = 'prompt'; this.warning = '';
    await this.store.clear();
  }
}
