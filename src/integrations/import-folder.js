import { ImportFolderStore } from '../storage/import-folder.js';
import { readTodoDirectory } from './todo-files.js';

export class ImportFolder {
  constructor({ environment = globalThis, store = new ImportFolderStore() } = {}) {
    this.environment = environment; this.store = store; this.handle = null; this.warning = ''; this.permission = 'prompt'; this.requireReset = false;
    this.supported = !!environment.isSecureContext && typeof environment.showDirectoryPicker === 'function';
  }
  async initialize() {
    if (!this.supported || this.handle || this.requireReset) return;
    try {
      const handle = await this.store.load();
      if (handle?.kind === 'directory' && typeof handle.entries === 'function' && typeof handle.queryPermission === 'function' && typeof handle.requestPermission === 'function') {
        this.handle = handle; this.permission = await handle.queryPermission({ mode: 'read' });
      }
    } catch { this.warning = '保存したフォルダー設定を開けません。取込フォルダーを再設定してください。'; }
  }
  async choose() {
    if (!this.supported) throw new Error('このブラウザではフォルダー設定を利用できません。JSONファイルを選択してください。');
    // ボタン操作の直後に呼び、ユーザー操作に必要な権限を維持します。
    let handle;
    try { handle = await this.environment.showDirectoryPicker({ id: 'my-work-todo-import', mode: 'read' }); }
    catch (error) {
      if (['NotAllowedError', 'SecurityError'].includes(error.name)) throw new Error('フォルダー選択が許可されていません。ブラウザの設定を確認するか「JSONファイルを選択」を使ってください。');
      throw error;
    }
    this.handle = handle; this.permission = 'granted'; this.warning = ''; this.requireReset = false;
    try { await this.store.save(handle); }
    catch { this.warning = 'フォルダー設定を永続保存できませんでした。この画面では利用できますが、次回は再設定してください。'; }
    return handle.name;
  }
  async read({ requireGranted = false } = {}) {
    if (!this.handle) throw new Error('取込フォルダーを設定してください。');
    try {
      this.permission = await this.handle[requireGranted ? 'queryPermission' : 'requestPermission']({ mode: 'read' });
      if (this.permission !== 'granted') throw folderSetupError('フォルダーの読取が許可されていません。「To Do / Planner取込」で再許可するか、取込フォルダーを再設定してください。');
      return await readTodoDirectory(this.handle);
    } catch (error) {
      if (['NotAllowedError', 'NotFoundError', 'SecurityError'].includes(error.name)) throw folderSetupError('フォルダーにアクセスできません。「To Do / Planner取込」で再許可するか、取込フォルダーを再設定してください。');
      throw error;
    }
  }
  async reset() {
    this.handle = null; this.permission = 'prompt'; this.warning = ''; this.requireReset = true;
    await this.store.clear();
  }
}
function folderSetupError(message) { return Object.assign(new Error(message), { requiresFolderSetup: true }); }
