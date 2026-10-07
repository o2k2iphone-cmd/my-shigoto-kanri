import { plannerRegistrationDefaults, parsePlannerPaste } from '../integrations/planner.js';
import { itemForm } from './item-detail.js';

export function plannerForm(settings) {
  const helper = `<section class="planner-paste"><label for="planner-paste-text">まとめて貼り付け（任意）</label><textarea id="planner-paste-text" rows="3" maxlength="50000" placeholder="資料提出&#10;期限：2026-10-03&#10;作業のメモやTeamsリンク"></textarea><p class="field-hint">先頭行をタイトル、全文をメモへ。年を含む「期限：」とTeamsリンクも読み取ります。</p><div class="planner-paste-actions"><button type="button" class="button small" id="planner-apply-paste">空欄に取り込む</button><button type="button" class="text-button" id="planner-read-clipboard">クリップボードから取り込む</button></div><p id="planner-paste-status" role="status" class="field-hint" aria-live="polite"></p></section>`;
  const result = itemForm(null, settings, plannerRegistrationDefaults(), {
    title: '手動取込（Plannerのコピー）', compact: true,
    introduction: '<p class="planner-intro">Plannerのタスク名・メモをコピーして登録します。Teams本文を直接貼り付けても使えます。</p>',
    extraFields: helper,
  });
  const { form } = result;
  const paste = form.querySelector('#planner-paste-text');
  const status = form.querySelector('#planner-paste-status');
  const clipboard = form.querySelector('#planner-read-clipboard');
  form.elements.dueTime.addEventListener('input', () => { form.elements.dueTime.dataset.userEdited = 'true'; });
  function apply(text) {
    const draft = parsePlannerPaste(text);
    const applied = [];
    for (const [key, label] of [['title', 'タイトル'], ['body', 'メモ'], ['dueDate', '期限'], ['teamsLink', 'Teamsリンク']]) {
      const field = form.elements.namedItem(key);
      if (field.value.trim() || !draft[key]) continue;
      field.value = draft[key]; applied.push(label);
      if (key === 'dueDate' && draft.dueTime && !form.elements.dueTime.dataset.userEdited) form.elements.dueTime.value = draft.dueTime;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    status.textContent = `${applied.length ? `${applied.join('・')}に取り込みました。` : '取り込める空欄がありません。'}入力済みの項目はそのままです。${draft.warnings.join(' ')}`;
    status.classList.toggle('danger-text', draft.warnings.length > 0);
  }
  form.querySelector('#planner-apply-paste').addEventListener('click', () => {
    try { apply(paste.value); } catch (error) { status.textContent = error.message; status.classList.add('danger-text'); }
  });
  clipboard.hidden = !navigator.clipboard?.readText || !window.isSecureContext;
  clipboard.addEventListener('click', async () => {
    clipboard.disabled = true;
    try {
      const text = await navigator.clipboard.readText();
      // 手動貼り付けと同じ上限を守り、読み取った内容を確認できるよう表示します。
      parsePlannerPaste(text); paste.value = text; paste.dispatchEvent(new Event('input', { bubbles: true })); apply(text);
    } catch { status.textContent = '読み取れませんでした。上の欄へコピーした内容を貼り付けてください。'; status.classList.add('danger-text'); paste.focus(); }
    finally { clipboard.disabled = false; }
  });
  return result;
}
