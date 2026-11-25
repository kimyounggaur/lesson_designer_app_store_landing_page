// 앱스토어 저장소의 data.json·icons/를 catalog/로 가져온다.
// 사용: npm run sync-catalog -- ../lesson_designer_app_store
import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = process.argv[2];
if (!source) {
  console.error('앱스토어 저장소 경로를 주세요. 예: npm run sync-catalog -- ../lesson_designer_app_store');
  process.exit(1);
}
const from = pathToFileURL(`${resolve(source)}/`);
const catalog = new URL('../catalog/', import.meta.url);
await cp(new URL('data.json', from), new URL('data.json', catalog));
await rm(new URL('icons/', catalog), { recursive: true, force: true });
await cp(new URL('icons/', from), new URL('icons/', catalog), { recursive: true });
console.log('catalog/ 갱신 완료');
