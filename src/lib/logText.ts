/**
 * Log text as people should read it: no database product name, no server
 * addresses, and request paths shortened to what they're about —
 * "GET [POCKETBASE_URL]/api/collections/screens/records/abc" reads as
 * "GET /screens/abc". Older logs were stored with those placeholders, so
 * this runs when they're shown. server/db.ts does the same as logs are
 * written; keep the two in step.
 */
export function tidyLogText(text?: string): string {
  if (!text) return text || '';
  return text
    .replace(/\[(POCKETBASE|SERVER)_URL\]/g, '')
    .replace(/\[(POCKETBASE|SERVER)_HOST\]/g, 'the server')
    .replace(/\/api\/collections\/([\w-]+)\/records/g, '/$1')
    .replace(/\/api\/v1\//g, '/')
    .replace(/pocket\s?base/gi, 'database');
}
