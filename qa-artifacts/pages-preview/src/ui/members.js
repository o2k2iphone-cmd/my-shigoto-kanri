import { GROUPS, id } from '../domain/model.js';
import { escapeHtml as e, icon } from './helpers.js';
import { showDialog, errorArea } from './dialog.js';
export function memberDetail(member, date) {
  return showDialog('メンバーの予定', `<div class="detail-header"><span class="type-tag">${e(GROUPS[member.group].label)}</span><h3 class="detail-title">${e(member.name)}</h3><p class="muted">${e(date)}</p></div><div class="body-text schedule-body">${e(member.schedules[date] || '予定なし')}</div><div class="dialog-actions"><span class="muted">手動で登録された予定です</span><button class="button primary" data-edit-member="${e(member.id)}">予定を編集</button></div>`);
}
export function memberForm(existing, date, group = 'sv') {
  const member = existing || { name: '', group, schedules: {} };
  const dialog = showDialog(existing ? 'メンバー・予定を編集' : 'メンバーを追加', `<form id="member-form"><div class="form-grid"><label>名前 <span class="required">必須</span><input name="name" required maxlength="100" value="${e(member.name)}" placeholder="例：山田"></label><label>グループ<select name="group">${Object.entries(GROUPS).map(([key, { label, limit }]) => `<option value="${key}" ${key === member.group ? 'selected' : ''}>${label}（最大${limit}名）</option>`).join('')}</select></label><label class="span-2">予定の日付<input name="scheduleDate" type="date" required value="${e(date)}"></label><label class="span-2">当日の予定<textarea name="body" rows="7" maxlength="10000" placeholder="1行目が一覧に表示されます。&#10;例：9:00 会議&#10;13:00 店舗訪問">${e(member.schedules[date] || '')}</textarea><small>空欄の場合は「予定なし」と表示します。日付ごとに保存します。</small></label></div>${errorArea}<div class="dialog-actions"><button class="button" type="button" data-cancel>キャンセル</button><button class="button primary" type="submit">保存する</button></div></form>`, { form: true });
  const form = dialog.querySelector('form'); let previousDate = date;
  const draftSchedules = { ...member.schedules };
  form.elements.scheduleDate.addEventListener('change', () => { draftSchedules[previousDate] = form.elements.body.value; previousDate = form.elements.scheduleDate.value; form.elements.body.value = draftSchedules[previousDate] || ''; });
  return { form, read() { const data = new FormData(form); return { ...(existing || { id: id(), extensions: {} }), name: data.get('name').trim(), group: data.get('group'), schedules: { ...draftSchedules, [data.get('scheduleDate')]: data.get('body') }, updatedAt: new Date().toISOString() }; } };
}
