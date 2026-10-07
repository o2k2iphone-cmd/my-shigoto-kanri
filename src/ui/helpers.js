export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  check: '<path d="m5 12 4 4L19 6"/>', list: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m7 9 1 1 2-2m-3 7 1 1 2-2m3-6h4m-4 6h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h.01m4 0h.01m4 0h.01"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  memo: '<path d="M14 3H5v18h14V8zm0 0v5h5M8 12h8m-8 4h6"/>', review: '<path d="M9 3h6v18l-3-3-3 3zM5 3v18m14-18v18"/>', archive: '<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8m-10 5h6"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>', download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>', upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>', chevronRight: '<path d="m9 5 7 7-7 7"/>', link: '<path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>', settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>', send: '<path d="m3 3 18 9-18 9 4-9zm4 9h14"/>'
};
export function icon(name, className = '') { return `<svg class="icon ${className}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.list}</svg>`; }
export function empty(text, hint = '') { return `<div class="empty">${icon('list')}<p>${escapeHtml(text)}</p>${hint ? `<span>${escapeHtml(hint)}</span>` : ''}</div>`; }
export function dateTimeLabel(value) { return value ? new Date(value).toLocaleString('ja-JP', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未設定'; }
