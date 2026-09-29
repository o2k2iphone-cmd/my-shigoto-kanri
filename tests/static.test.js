import { test, assert } from './harness.js';
const root = new URL('../', import.meta.url);
const texts = new Map();
async function resource(path, base = root) {
  const url = new URL(path, base);
  assert.equal(url.origin, root.origin);
  assert.ok(url.pathname.startsWith(root.pathname));
  const response = await fetch(url, { cache: 'no-store' });
  assert.ok(response.ok);
  return response;
}
async function textResource(path, base = root) {
  const key = new URL(path, base).href;
  if (!texts.has(key)) texts.set(key, await (await resource(path, base)).text());
  return texts.get(key);
}
test('HTML・manifest・アイコンが公開フォルダー内の相対参照で動く', async () => {
  const html = await textResource('index.html');
  for (const match of html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)) await resource(match[1]);
  const manifest = JSON.parse(await textResource('manifest.webmanifest'));
  assert.equal(manifest.name, 'MY仕事管理');
  assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    const response = await resource(icon.src); assert.ok(response.headers.get('content-type')?.includes('image/png'));
  }
});
test('全32件のPWA資材・モジュール参照・JavaScriptの配信形式を確認', async () => {
  const sw = await textResource('sw.js');
  const assetBlock = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(assetBlock);
  const assets = [...assetBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.equal(assets.length, 32);
  const assetURLs = new Set(assets.map(asset => new URL(asset, root).href));
  for (const asset of assets) {
    const response = await resource(asset);
    if (!asset.endsWith('.js')) continue;
    assert.ok(/(?:text|application)\/javascript/.test(response.headers.get('content-type') || ''));
    const body = await response.text();
    assert.ok(!/\b(?:node:|require\(|process\.)/.test(body));
    for (const match of body.matchAll(/(?:from\s+|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)) {
      const dependency = new URL(match[2], new URL(asset, root));
      assert.ok(assetURLs.has(dependency.href));
      await resource(dependency.href);
    }
    // 実際のブラウザで構文とimportの解決を確認。UI本体とSWはここでは起動しません。
    if (asset !== './src/app.js') await import(new URL(asset, root).href);
  }
});
