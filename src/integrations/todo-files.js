import { parseTodoJson } from './todo-import.js';

export const MAX_IMPORT_FILES = 200;
export const MAX_IMPORT_FILE_BYTES = 1024 * 1024;

async function readFile(file) {
  if (!/\.json$/i.test(file.name)) throw new Error('JSONファイルを選択してください。');
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error('1ファイルは1MB以内にしてください。');
  return parseTodoJson(await file.text());
}

async function readSources(sources) {
  if (sources.length > MAX_IMPORT_FILES) throw new Error(`一度に取り込めるJSONは${MAX_IMPORT_FILES}ファイルまでです。ファイル選択で分けて取り込んでください。`);
  // 同時に読む数を抑え、ファイルごとの失敗を独立させます。
  const entries = new Array(sources.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, sources.length) }, async () => {
    while (next < sources.length) {
      const index = next++, source = sources[index];
      try { entries[index] = { name: source.name, record: await readFile(await source.getFile()) }; }
      catch (error) { entries[index] = { name: source.name, error: error.message || 'ファイルを読み取れませんでした。' }; }
    }
  }));
  return entries;
}

export function readTodoFiles(files) {
  return readSources(Array.from(files, file => ({ name: file.name, getFile: () => file })));
}

/** 選択したフォルダー直下だけを読みます。元ファイルへの書込APIは使用しません。 */
export async function readTodoDirectory(handle) {
  const sources = [];
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== 'file' || !/\.json$/i.test(name)) continue;
    sources.push({ name, getFile: () => entry.getFile() });
    if (sources.length > MAX_IMPORT_FILES) throw new Error(`フォルダー内のJSONが${MAX_IMPORT_FILES}件を超えています。「JSONファイルを選択」で分けて取り込んでください。`);
  }
  sources.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return readSources(sources);
}
