// 画面やモジュールを変更したらバージョンも更新してください。
const VERSION = 'my-work-v1.4.4';
const SCOPE = new URL(self.registration.scope).pathname;
const CACHE = `${VERSION}:${SCOPE}`;
const ASSETS = [ './', './index.html', './styles.css', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable.png', './assets/apple-touch-icon.png', './src/app.js', './src/domain/model.js', './src/domain/actions.js', './src/domain/json-cleanup.js', './src/domain/reservation-export.js', './src/storage/repository.js', './src/storage/backup.js', './src/storage/import-folder.js', './src/notifications/alarms.js', './src/integrations/teams.js', './src/integrations/reservation-export.js', './src/integrations/planner.js', './src/integrations/todo-import.js', './src/integrations/todo-files.js', './src/integrations/import-folder.js', './src/integrations/outlook.js', './src/integrations/onedrive.js', './src/ui/helpers.js', './src/ui/layout.js', './src/ui/manage.js', './src/ui/schedule.js', './src/ui/item-detail.js', './src/ui/planner-import.js', './src/ui/todo-import.js', './src/ui/reservations.js', './src/ui/reservation-export.js', './src/ui/other.js', './src/ui/dialog.js', './src/ui/alerts.js', './src/pwa.js', './src/webmcp.js' ];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
// 開いている画面の未保存編集を守るため、skipWaitingによる強制更新はしません。
self.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(key => key.startsWith('my-work-') && key.endsWith(`:${SCOPE}`) && key !== CACHE).map(key => caches.delete(key))); await self.clients.claim(); })()); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  const assetURLs = ASSETS.map(asset => new URL(asset, self.registration.scope).href);
  // ハッシュで画面を切り替えるアプリなので、テスト等の別HTMLは横取りしません。
  if (!assetURLs.includes(url.origin + url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') return await cache.match(new URL('./index.html', self.registration.scope)) || fetch(request);
    return await cache.match(url.origin + url.pathname) || fetch(request);
  })());
});
