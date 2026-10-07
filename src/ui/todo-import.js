import { hasNaiveDueDate, importedTodoIds, parseTodoDueDate } from '../integrations/todo-import.js';
import { readTodoFiles, MAX_IMPORT_FILES } from '../integrations/todo-files.js';
import { escapeHtml as e } from './helpers.js';
import { showDialog, formError, errorArea } from './dialog.js';

/** 管理画面の通常取込は保存済みの解釈と独立してUTC相当を使います。 */
export async function quickTodoFolderImport({ folder, onCommit, onNeedsSetup, onReport }) {
  if (!folder.supported) return onNeedsSetup('このブラウザではフォルダー取込を利用できません。「JSONファイルを選択」を使ってください。');
  if (!folder.handle) return onNeedsSetup('取込フォルダーが未設定です。「取込フォルダーを設定」からOneDrive同期フォルダーを選択してください。');
  let entries;
  try { entries = await folder.read({ requireGranted: true }); }
  catch (error) { if (error.requiresFolderSetup) return onNeedsSetup(error.message); throw error; }
  const report = entries.length ? await onCommit(entries, { naiveTimezone: 'utc' }) : { results: [], counts: { new: 0, review: 0, duplicate: 0, error: 0 } };
  onReport(report);
  return report;
}

export function todoImportResult(report) {
  return `<div class="todo-result-summary"><strong>取込結果</strong><span>新規登録：${report.counts.new}件</span><span>うち、あとで確認として登録：${report.counts.review}件</span><span>重複スキップ：${report.counts.duplicate}件</span><span>エラー：${report.counts.error}件</span></div>${report.results.length ? `<details class="todo-result-details"><summary>ファイルごとの結果を見る</summary>${report.results.map(result => `<div><strong>${e(result.name)}</strong><span>${result.title ? `${e(result.title)} · ` : ''}${e(result.detail)}</span></div>`).join('')}</details>` : '<p class="field-hint">取込対象のJSONはありません。</p>'}`;
}

export function todoImportDialog({ getState, folder, onPreference, onCommit, notice = '' }) {
  const settings = getState().settings;
  const dialog = showDialog('To Do / Planner取込', `<p class="planner-intro">OneDriveの「MY仕事管理/ToDo取込」にあるJSONを取り込みます。期限ありは期限付き作業、期限なしはあとで確認に登録します。元ファイルは変更しません。</p>
    ${notice ? `<p class="info-note" role="status">${e(notice)}</p>` : ''}<form id="todo-import-form">
      ${folder.supported ? `<section class="todo-folder-panel"><h3>PCの取込フォルダー</h3><p id="todo-folder-status" class="field-hint" aria-live="polite">設定を確認中…</p><div class="todo-folder-buttons"><button class="button" type="button" id="todo-folder-set" disabled>取込フォルダーを設定</button><button class="button primary" type="button" id="todo-folder-read" disabled>フォルダーから一括取込</button></div><p class="field-hint">選択したフォルダー直下のJSONが対象です。再許可を求められたら、ブラウザの確認に従ってください。</p></section>` : '<p class="info-note">このブラウザではファイル選択で取り込みます。iPhone・iPadはファイル選択画面の「ブラウズ」からOneDriveを選択してください。</p>'}
      <label class="todo-file-picker">JSONファイルを選択<input id="todo-files" type="file" accept=".json,application/json" multiple aria-label="取込用JSONファイルを選択"></label><p class="field-hint">複数選択可・1回${MAX_IMPORT_FILES}ファイルまで・1ファイル1MBまで</p>
      <fieldset class="todo-timezone"><legend>時差のない期限日時の解釈</legend><p class="field-hint">初回はMicrosoft To Doの期限日と下のプレビューを照合して選択してください。設定を保存し、次回からフォルダー取込に使用します。Zや時差がある日時は自動で日本時間へ変換します。</p><label><input type="radio" name="naiveTimezone" value="utc" ${settings.todoImportTimezone === 'utc' ? 'checked' : ''}> UTC相当 → 日本時間へ変換</label><label><input type="radio" name="naiveTimezone" value="jst" ${settings.todoImportTimezone === 'jst' ? 'checked' : ''}> 日本時間として保持</label></fieldset>
      <div id="todo-preview" aria-live="polite"></div>${errorArea}<div class="dialog-actions"><button class="button" type="button" data-cancel>閉じる</button><button class="button primary" id="todo-register" type="submit" disabled>この内容で取り込む</button></div><div id="todo-results" aria-live="polite"></div><p class="field-hint"><button class="text-button" type="button" data-planner-import>JSONがない場合は手動貼り付け</button></p>
    </form>`, { wide: true });
  const form = dialog.querySelector('form'), preview = dialog.querySelector('#todo-preview'), output = dialog.querySelector('#todo-results');
  const submit = dialog.querySelector('#todo-register'), picker = dialog.querySelector('#todo-files');
  let entries = [], busy = false, initialized = false;
  const mode = () => form.elements.namedItem('naiveTimezone').value || null;
  const seenIds = () => importedTodoIds(getState().items, getState().jsonDeletionHistory);
  const needsMode = () => { const seen = seenIds(); return entries.some(entry => entry.record && !seen.has(entry.record.externalId) && hasNaiveDueDate(entry.record.sourceDueDate)); };
  function updateFolder() {
    if (!folder.supported) return;
    const name = folder.handle?.name;
    dialog.querySelector('#todo-folder-set').textContent = (name || getState().settings.todoImportFolderName) ? '取込フォルダーを再設定' : '取込フォルダーを設定';
    dialog.querySelector('#todo-folder-set').disabled = busy || !initialized;
    dialog.querySelector('#todo-folder-read').disabled = busy || !name;
    dialog.querySelector('#todo-folder-status').textContent = folder.warning || (name ? `設定済み：${name}${folder.permission !== 'granted' ? '（次の取込で再許可が必要です）' : ''}` : getState().settings.todoImportFolderName ? `以前の設定：${getState().settings.todoImportFolderName}。このブラウザでは再設定してください。` : 'OneDrive同期フォルダーの「MY仕事管理/ToDo取込」を選択してください。');
  }
  function renderPreview() {
    const seen = seenIds();
    preview.innerHTML = entries.length ? `${needsMode() && !mode() ? '<p class="info-note">日時の解釈を選び、期限日を照合してから「この内容で取り込む」を押してください。</p>' : ''}<details class="todo-result-details" open><summary>確認したファイル：${entries.length}件</summary>${entries.map(entry => {
      const record = entry.record;
      let detail = entry.error || '';
      if (record) {
        if (seen.has(record.externalId)) detail = '重複：スキップ';
        else if (!record.sourceDueDate) detail = '期限なし → あとで確認';
        else { try { detail = `期限：${parseTodoDueDate(record.sourceDueDate, mode()).dueDate} → 期限付き作業`; } catch (error) { detail = error.message; } }
      }
      return `<div><strong>${e(entry.name)}</strong><span>${record ? `${e(record.title)} · ` : ''}${e(detail)}</span></div>`;
    }).join('')}</details>` : '<p class="field-hint">取込対象のJSONはありません。</p>';
    submit.disabled = busy || !entries.length || needsMode() && !mode();
  }
  function showReport(report) {
    output.innerHTML = todoImportResult(report);
    output.scrollIntoView({ block: 'nearest' });
  }
  async function commit() {
    if (!entries.length) return;
    if (needsMode() && !mode()) throw new Error('Microsoft To Doの期限日と照合し、日時の解釈を選択してください。');
    await onPreference({ todoImportTimezone: mode() });
    showReport(await onCommit(entries, { naiveTimezone: mode() }));
    renderPreview();
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    form.querySelector('[data-form-error]').hidden = true;
    picker.disabled = true; submit.disabled = true; form.querySelectorAll('input[type=radio]').forEach(input => { input.disabled = true; }); updateFolder();
    try { await action(); } catch (error) { if (error.name !== 'AbortError' && dialog.isConnected) { if (!entries.length) preview.textContent = ''; formError(form, error); } }
    finally { busy = false; if (dialog.isConnected) { picker.disabled = false; form.querySelectorAll('input[type=radio]').forEach(input => { input.disabled = false; }); updateFolder(); if (entries.length) renderPreview(); } }
  }
  picker.addEventListener('change', () => run(async () => {
    entries = []; output.innerHTML = ''; preview.textContent = 'JSONを確認中…';
    entries = await readTodoFiles(picker.files); renderPreview();
  }));
  form.addEventListener('change', event => { if (event.target.name === 'naiveTimezone' && !busy) renderPreview(); });
  form.addEventListener('submit', event => { event.preventDefault(); run(commit); });
  if (folder.supported) {
    dialog.querySelector('#todo-folder-set').addEventListener('click', () => run(async () => {
      const name = await folder.choose(); await onPreference({ todoImportFolderName: name }); updateFolder();
    }));
    dialog.querySelector('#todo-folder-read').addEventListener('click', () => run(async () => {
      entries = []; output.innerHTML = ''; preview.textContent = 'フォルダー内のJSONを確認中…';
      entries = await folder.read(); renderPreview();
      if (!entries.length) return;
      if (needsMode() && !mode()) return;
      await commit();
    }));
    folder.initialize().finally(() => { initialized = true; if (dialog.isConnected) updateFolder(); });
  }
  return dialog;
}
