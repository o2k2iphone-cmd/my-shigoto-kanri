import { TYPES, createItem, completeItem, defaultAlarms, validateItem, shortDate, dateKey, safeLink } from '../domain/model.js';
import { escapeHtml as e, icon, dateTimeLabel } from './helpers.js';
import { showDialog, errorArea } from './dialog.js';
export function itemDetail(item) {
  const link = safeLink(item.teamsLink);
  return showDialog('詳細', `<div class="detail-header"><span class="type-tag ${item.type}">${e(TYPES[item.type])}</span>${item.completed ? '<span class="type-tag done">完了</span>' : ''}<h3 class="detail-title">${e(item.title)}</h3></div><dl class="detail-meta"><div><dt>期限</dt><dd>${item.dueDate ? `${e(item.dueDate)}　${e(item.dueTime)}` : '期限なし'}</dd></div>${item.completedAt ? `<div><dt>完了日</dt><dd>${e(new Date(item.completedAt).toLocaleString('ja-JP'))}</dd></div>` : ''}<div><dt>Teamsリンク</dt><dd>${link ? `<a class="inline-link" href="${e(link)}" target="_blank" rel="noopener noreferrer">${icon('link')}Teamsで開く</a>` : '<span class="muted">未登録</span>'}</dd></div></dl><section class="detail-section"><h3>メモ本文</h3><div class="body-text">${e(item.body || '本文はありません')}</div></section><section class="detail-section"><h3>${icon('bell')} アラーム</h3>${item.alarms.length ? item.alarms.map(a => `<div class="alarm-read"><span>${e(a.label)}</span><span>${a.enabled ? e(dateTimeLabel(a.at)) : 'OFF'}</span>${a.enabled ? `<small>${a.acknowledgedAt ? '確認済み' : item.archived ? '保管中は停止' : 'ON'}</small>` : ''}</div>`).join('') : '<p class="muted">未設定</p>'}</section><div class="dialog-actions"><button class="button danger" data-delete-item="${e(item.id)}">削除</button><div>${item.type === 'task' ? `<button class="button" data-complete="${e(item.id)}">${icon('check')}完了にする</button>` : item.completed ? `<button class="button" data-uncomplete="${e(item.id)}">未完了に戻す</button>` : ''}<button class="button primary" data-edit-item="${e(item.id)}">編集</button></div></div>`);
}
export function itemForm(existing, settings, defaults = {}) {
  const item = existing || { type: 'task', title: '', body: '', dueDate: dateKey(), dueTime: settings.defaultDueTime, teamsLink: '', completed: false, ...defaults };
  const alarms = existing?.alarms?.length ? existing.alarms : defaultAlarms(item.dueDate, item.dueTime || settings.defaultDueTime);
  const dialog = showDialog(existing ? '情報を編集' : '新規登録', `<form id="item-form"><div class="form-grid"><label>種類<select name="type" id="item-type">${Object.entries(TYPES).map(([key, name]) => `<option value="${key}" ${item.type === key ? 'selected' : ''}>${name}</option>`).join('')}</select></label><label class="span-2">タイトル <span class="required">必須</span><input name="title" id="item-title" required maxlength="200" value="${e(item.title)}" placeholder="例：資料提出"></label><label>期限日 <span class="required" id="due-required" ${item.type !== 'task' ? 'hidden' : ''}>必須</span><input type="date" name="dueDate" id="due-date" value="${e(item.dueDate || '')}" ${item.type === 'task' ? 'required' : ''}></label><label>期限時刻<input type="time" name="dueTime" id="due-time" value="${e(item.dueTime || settings.defaultDueTime)}"><small>一覧には日付だけ表示します</small></label><label class="span-2">Teamsリンク<input type="url" name="teamsLink" value="${e(item.teamsLink)}" placeholder="https://teams.microsoft.com/…" maxlength="4000"><small>Teamsの「リンクをコピー」から貼り付け</small></label><label class="span-2">メモ本文<textarea name="body" rows="6" maxlength="50000" placeholder="作業の内容や、残しておきたい情報">${e(item.body)}</textarea></label></div><fieldset class="alarm-fieldset"><legend>${icon('bell')} アラーム設定</legend><p class="field-hint">ONにすると、指定日時以降にアプリ内でお知らせします。</p>${alarms.map((alarm, index) => `<div class="alarm-edit" data-alarm-index="${index}" data-alarm-id="${e(alarm.id)}"><label class="switch-label"><input type="checkbox" name="alarm-on-${index}" ${alarm.enabled ? 'checked' : ''}>${e(alarm.label)}</label><input type="datetime-local" name="alarm-at-${index}" value="${e(alarm.at)}" aria-label="${e(alarm.label)}のアラーム日時" ${alarm.enabled ? 'required' : ''}></div>`).join('')}<button type="button" class="text-button" id="reset-alarm-times">期限から候補日時を再設定</button></fieldset><label class="checkbox-label" id="completion-field" ${item.type !== 'task' && !item.completed ? 'hidden' : ''}><input type="checkbox" name="completed" ${item.completed ? 'checked' : ''}>完了済み（アーカイブへ移動）</label>${errorArea}<div class="dialog-actions"><button type="button" class="button" data-cancel>キャンセル</button><button type="submit" class="button primary">保存する</button></div></form>`, { form: true });
  const form = dialog.querySelector('form');
  form.querySelector('#item-type').addEventListener('change', event => {
    const type = event.target.value;
    form.querySelector('#due-date').required = type === 'task'; form.querySelector('#due-required').hidden = type !== 'task';
    form.querySelector('#completion-field').hidden = type !== 'task' && !item.completed;
    if (type !== 'task' && !item.completed) form.elements.completed.checked = false;
  });
  const updateCandidates = (force = false) => {
    const suggested = defaultAlarms(form.elements.dueDate.value, form.elements.dueTime.value || settings.defaultDueTime);
    form.querySelectorAll('.alarm-edit').forEach((row, index) => {
      const input = row.querySelector('input[type=datetime-local]');
      if (force || !input.dataset.custom) input.value = suggested[index]?.at || '';
    });
  };
  form.querySelectorAll('input[type=datetime-local]').forEach(input => { if (existing) input.dataset.custom = 'true'; input.addEventListener('input', () => { input.dataset.custom = 'true'; }); });
  form.querySelector('#due-date').addEventListener('change', () => updateCandidates()); form.querySelector('#due-time').addEventListener('change', () => updateCandidates());
  form.querySelector('#reset-alarm-times').addEventListener('click', () => updateCandidates(true));
  form.querySelectorAll('.alarm-edit input[type=checkbox]').forEach(input => input.addEventListener('change', () => { input.closest('.alarm-edit').querySelector('input[type=datetime-local]').required = input.checked; }));
  return { form, read() {
    const data = new FormData(form); const type = data.get('type');
    const editedAlarms = alarms.map((alarm, index) => {
      const enabled = data.has(`alarm-on-${index}`), at = data.get(`alarm-at-${index}`);
      return { ...alarm, enabled, at, acknowledgedAt: at === alarm.at && enabled === alarm.enabled ? alarm.acknowledgedAt : null };
    });
    const now = new Date().toISOString();
    let result = { ...(existing || createItem({ type: 'memo', title: '仮の情報' })), type, title: data.get('title').trim(), dueDate: data.get('dueDate') || null, dueTime: data.get('dueTime') || settings.defaultDueTime, teamsLink: data.get('teamsLink').trim(), body: data.get('body'), alarms: editedAlarms, archived: type === 'archive', completed: false, completedAt: null, updatedAt: now };
    if (type === 'archive' && existing && existing.type !== 'archive') result.originalType = existing.type;
    if (data.has('completed')) result = completeItem(result, true, existing?.completedAt || now);
    return validateItem(result);
  } };
}
