// catalog/data.json → apps.json(공개 필드만), catalog/icons/ → icons/ 복사.
// 인형 뽑기 부품이 쓰는 데이터. 실행 URL(url)은 넣지 않는다.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

// 더미에서 빼고 싶은 앱의 app_id를 한 줄씩 적는다(설계서 0장 열린 항목 2).
// 예: '...반복기호 부루마블 (코덱스)의 app_id...',
export const LANDING_EXCLUDED_APP_IDS = [];

export function toLandingApps(catalog, { excluded = LANDING_EXCLUDED_APP_IDS, generatedAt = new Date().toISOString().slice(0, 10) } = {}) {
  const skip = new Set(excluded);
  return {
    version: 1,
    generatedAt,
    apps: catalog
      .filter((app) => !skip.has(app.app_id))
      .map((app) => ({
        id: app.app_id,
        name: app.name,
        icon: app.icon,
        category: app.category,
        audience: app.audience,
        description: app.description,
        screenshot: app.screenshot ?? null,
      })),
  };
}

export async function buildLandingData(root = new URL('../', import.meta.url), target = new URL('dist/', root)) {
  const catalog = JSON.parse(await readFile(new URL('catalog/data.json', root), 'utf8'));
  const data = toLandingApps(catalog);
  await mkdir(target, { recursive: true });
  await writeFile(new URL('apps.json', target), `${JSON.stringify(data, null, 2)}\n`);
  await rm(new URL('icons/', target), { recursive: true, force: true });
  await cp(new URL('catalog/icons/', root), new URL('icons/', target), { recursive: true });
  return data;
}
