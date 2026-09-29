const cases = [];
export function test(name, run) { cases.push({ name, run }); }
function fail(message) { throw new Error(message); }
function matches(error, expected) {
  return expected instanceof RegExp ? expected.test(String(error.message))
    : !expected || Object.entries(expected).every(([key, value]) => error[key] === value);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const assert = {
  equal(actual, expected) { if (!Object.is(actual, expected)) fail(`期待値 ${expected} / 実際 ${actual}`); },
  ok(value) { if (!value) fail('期待した条件を満たしていません。'); },
  deepEqual(actual, expected) { if (JSON.stringify(canonical(actual)) !== JSON.stringify(canonical(expected))) fail('内容が一致しません。'); },
  throws(run, expected) {
    let caught;
    try { run(); } catch (error) { caught = error; }
    if (!caught) fail('エラーになるべき入力が受理されました。');
    if (!matches(caught, expected)) throw caught;
  },
  async rejects(promise, expected) {
    let caught;
    try { await promise; } catch (error) { caught = error; }
    if (!caught) fail('失敗するべき操作が成功しました。');
    if (!matches(caught, expected)) throw caught;
  },
};
export async function runTests() {
  let passed = 0;
  const results = document.querySelector('#results');
  for (const entry of cases) {
    const row = document.createElement('li');
    try { await entry.run(); passed++; row.className = 'pass'; row.textContent = `成功：${entry.name}`; }
    catch (error) { row.className = 'fail'; row.textContent = `失敗：${entry.name} — ${error.message}`; }
    results.append(row);
  }
  const summary = document.querySelector('#summary');
  summary.textContent = `${cases.length}件中 ${passed}件成功・${cases.length - passed}件失敗`;
  summary.className = passed === cases.length ? 'pass' : 'fail';
}
