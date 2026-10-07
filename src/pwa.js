import { showDialog } from './ui/dialog.js';
let installPrompt, status = 'オフラインの準備を確認中…';
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
window.addEventListener('appinstalled', () => { installPrompt = null; });
export function offlineStatus() { return status; }
export async function registerPWA(onStatus, onMessage) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) { status = 'オフライン利用にはHTTPSまたはlocalhostが必要です。'; onStatus(); return; }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // 短時間の再公開でも、サーバー上の更新をその場で確認する。
    await registration.update();
    await navigator.serviceWorker.ready;
    status = 'オフラインの準備ができました。'; onStatus();
    const showUpdate = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller || document.querySelector('#pwa-update-banner')) return;
      onMessage('アプリの更新があります。編集を保存してから更新してください。');
      const banner = document.createElement('div');
      banner.id = 'pwa-update-banner';
      banner.className = 'pwa-update-banner';
      banner.innerHTML = '<span>アプリの更新があります。編集中の内容を保存してから更新してください。</span><button type="button" class="button small primary">アプリを更新</button>';
      banner.querySelector('button').addEventListener('click', () => {
        const waiting = registration.waiting;
        if (!waiting) { banner.remove(); return; }
        banner.querySelector('button').disabled = true;
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      });
      document.body.append(banner);
    };
    showUpdate();
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', showUpdate));
  } catch (error) { console.error(error); status = 'オフラインの準備に失敗しました。接続時に再読み込みしてください。'; onStatus(); }
}
export async function showInstallInstructions() {
  if (installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; return; }
  showDialog('ホーム画面に追加', `<div class="install-instructions"><h3>iPhone・iPad</h3><ol><li>公開したアプリをSafariで開きます。</li><li>共有メニューの「ホーム画面に追加」を選びます。</li><li>「MY仕事管理」の名前で追加します。</li></ol><h3>PC</h3><p>Edge・Chromeなどのアドレスバーのインストールアイコン、またはブラウザのメニューからインストールしてください。</p><p class="info-note">最初はオンラインで開いてください。準備後はオフラインでも閲覧・編集できます。端末やブラウザが異なると保存データは別になります。</p></div>`);
}
