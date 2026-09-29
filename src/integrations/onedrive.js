import { Repository } from '../storage/repository.js';
/** 将来の実装場所。認証・App Folder入出力・競合解決をこのクラスに閉じ込めます。 */
export class OneDriveRepository extends Repository {
  async load() { throw new Error('OneDrive同期は未接続です。端末内保存を利用してください。'); }
  async update() { throw new Error('OneDrive同期は未接続です。'); }
}
