import { TYPES, searchItems, sortItems, shortDate, isOverdue } from '../domain/model.js';
import { escapeHtml as e, icon, empty } from './helpers.js';
export function itemRow(item) {
  const overdue = isOverdue(item);
  const prefix = item.type === 'task' ? shortDate(item.dueDate) : { memo: 'メモ', review: 'あとで確認', archive: 'アーカイブ' }[item.type];
  return `<div class="item-row ${overdue ? 'overdue' : ''}" data-item="${e(item.id)}">${item.type === 'task' ? `<input type="checkbox" class="complete-check" data-complete="${e(item.id)}" aria-label="${e(item.title)}を完了する">` : `<span class="row-kind ${item.type}">${icon(item.type === 'archive' ? 'archive' : item.type === 'memo' ? 'memo' : 'review')}</span>`}<span class="item-title" title="${e(item.title)}"><span class="prefix">【${e(prefix)}】</span>${e(item.title)}</span>${overdue ? '<span class="overdue-label">期限超過</span>' : ''}<span class="row-source">${item.teamsLink ? 'Teams' : '手動'}</span><button class="detail-link" data-detail="${e(item.id)}">詳細</button></div>`;
}
export function managePage(state, { query = '', filter = 'all' } = {}) {
  const filtered = searchItems(state.items, query, filter);
  const tasks = state.items.filter(i => i.type === 'task');
  const overdue = tasks.filter(i => isOverdue(i)).length;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const near = tasks.filter(i => !isOverdue(i) && new Date(`${i.dueDate}T00:00:00`) < end).length;
  return `<div class="page-heading"><div><p class="eyebrow">MY WORKSPACE</p><h1>管理</h1><p class="page-description">作業も、気になる情報も。ここから確認。</p></div><button class="button primary" data-new-item="task">${icon('plus')}新規登録</button></div><div id="alerts"></div><div class="summary-strip"><div>${icon('list')}<span>未完了の作業</span><strong>${tasks.length}<small>件</small></strong></div><div class="${overdue ? 'danger-text' : ''}">${icon('clock')}<span>期限超過</span><strong>${overdue}<small>件</small></strong></div><div>${icon('calendar')}<span>7日以内の期限</span><strong>${near}<small>件</small></strong></div></div><div class="search-toolbar"><label class="search-box">${icon('search')}<input id="item-search" type="search" placeholder="タイトル・本文・人名・期限を検索" value="${e(query)}" aria-label="管理データを検索"></label><select id="type-filter" aria-label="種類で絞り込み"><option value="all">すべての種類</option>${Object.entries(TYPES).map(([key, label]) => `<option value="${key}" ${filter === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div id="item-sections">${sections(filtered, query, filter)}</div>`;
}
export function sections(items, query, filter) {
  return Object.entries(TYPES).filter(([key]) => filter === 'all' || filter === key).map(([type, title]) => {
    const rows = type === 'task' ? sortItems(items.filter(i => i.type === type)) : items.filter(i => i.type === type).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return `<section class="list-section ${type}"><header class="section-heading"><h2><span class="section-icon">${icon(type === 'task' ? 'list' : type)}</span>${title}<span class="count-badge">${rows.length}</span></h2><span class="section-note">${{ task: '期限が近い順', memo: '自由に書き留める', review: '時間があるときに', archive: '完了した作業と保管情報' }[type]}</span><button class="add-inline" data-new-item="${type}" aria-label="${title}を追加">${icon('plus')}</button></header>${rows.length ? rows.map(itemRow).join('') : empty(query ? '該当する情報はありません' : `${title}はまだありません`, query ? 'キーワードを変えて検索してください' : '右上の＋から登録できます')}</section>`;
  }).join('');
}
