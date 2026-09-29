import { escapeHtml as e, icon } from './helpers.js';
let dirty = false;
let cleanup;
let previousFocus;
let originalOverflow;
export function showDialog(title, content, { wide = false, form = false } = {}) {
  closeDialog(true);
  dirty = false;
  const host = document.querySelector('#dialogs');
  previousFocus = document.activeElement;
  originalOverflow = document.body.style.overflow;
  host.innerHTML = `<div class="modal-backdrop"><div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><div class="dialog-top"><h2 id="dialog-title">${e(title)}</h2><button class="icon-button" data-close-dialog aria-label="閉じる">${icon('close')}</button></div><div class="dialog-content">${content}</div></div></div>`;
  const dialog = host.querySelector('.dialog');
  dialog.querySelector('[data-close-dialog]').addEventListener('click', () => closeDialog());
  if (form) { dialog.addEventListener('input', () => { dirty = true; }); dialog.addEventListener('change', () => { dirty = true; }); }
  const leave = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  const keydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); }
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  window.addEventListener('beforeunload', leave); document.addEventListener('keydown', keydown);
  document.querySelector('#app').inert = true; document.body.style.overflow = 'hidden';
  cleanup = () => { window.removeEventListener('beforeunload', leave); document.removeEventListener('keydown', keydown); document.querySelector('#app').inert = false; document.body.style.overflow = originalOverflow; };
  dialog.querySelector('[data-close-dialog]').focus();
  return dialog;
}
export function closeDialog(force = false) {
  if (!force && dirty && !window.confirm('編集内容はまだ保存されていません。閉じますか？')) return false;
  cleanup?.(); cleanup = null;
  document.querySelector('#dialogs').innerHTML = ''; dirty = false;
  if (previousFocus?.isConnected) previousFocus.focus(); previousFocus = null; return true;
}
export function formError(form, error) { const target = form.querySelector('[data-form-error]'); target.textContent = error.message || '保存できませんでした。'; target.hidden = false; target.scrollIntoView({ block: 'nearest' }); }
export async function submitForm(form, action) {
  const buttons = form.querySelectorAll('button[type="submit"]');
  buttons.forEach(button => { button.disabled = true; });
  try { await action(); } catch (error) { formError(form, error); } finally { buttons.forEach(button => { button.disabled = false; }); }
}
export const errorArea = '<p class="form-error" data-form-error role="alert" hidden></p>';
