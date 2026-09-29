import { TYPES } from './domain/model.js';
/** 対応ブラウザのみ。UIと同じ検索・登録開始フローを公開します。 */
export function registerAgentTools(actions) {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tools = [
    { name: 'search_work_items', title: '管理情報を検索', description: 'この端末のMY仕事管理の情報を検索します。', inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 500 } }, required: ['query'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute(input) { if (!input || typeof input.query !== 'string' || input.query.length > 500) throw new Error('検索語が正しくありません。'); return actions.search(input.query); } },
    { name: 'start_work_item_creation', title: '登録画面を開く', description: '指定した種類の新規登録フォームを開きます。保存は行いません。', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: Object.keys(TYPES) } }, required: ['type'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (!input || !Object.hasOwn(TYPES, input.type)) throw new Error('種類が正しくありません。'); actions.startCreation(input.type); return { status: 'form_opened', type: input.type }; } }
  ];
  for (const tool of tools) { try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(error => console.warn('WebMCP登録をスキップしました', error)); } catch (error) { console.warn('WebMCP登録をスキップしました', error); } }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
