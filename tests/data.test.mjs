import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildLandingData, toLandingApps } from '../scripts/build-data.mjs';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('catalog/data.json', root), 'utf8'));

test('apps.json이 data.json과 개수·ID 일치, url 필드 없음, 모든 icon 파일 존재', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'landing-'));
  try {
    const target = pathToFileURL(`${dir}/`);
    await buildLandingData(root, target);
    const data = JSON.parse(await readFile(new URL('apps.json', target), 'utf8'));
    assert.equal(data.version, 1);
    assert.equal(data.apps.length, catalog.length);
    assert.deepEqual(data.apps.map((app) => app.id), catalog.map((app) => app.app_id));
    for (const app of data.apps) {
      assert.deepEqual(Object.keys(app), ['id', 'name', 'icon', 'category', 'audience', 'description', 'screenshot']);
      assert.equal('url' in app, false);
      assert.ok(existsSync(new URL(`icons/${app.icon}`, target)), app.icon);
    }
    assert.equal(readdirSync(new URL('icons/', target)).filter((name) => name.endsWith('.svg')).length, readdirSync(new URL('catalog/icons/', root)).filter((name) => name.endsWith('.svg')).length);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('제외 목록에 적은 앱은 빠진다', () => {
  const first = catalog[0].app_id;
  const data = toLandingApps(catalog, { excluded: [first], generatedAt: '2026-11-25' });
  assert.equal(data.apps.length, catalog.length - 1);
  assert.equal(data.apps.some((app) => app.id === first), false);
});

const landingFiles = () => ['claw-machine.js', 'styles.css', ...readdirSync(new URL('src/', root)).map((name) => `src/${name}`)];

test('부품에는 스토어·외부로 가는 링크가 없다', () => {
  for (const file of landingFiles()) {
    const source = readFileSync(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /<a\s|href=|window\.open|location\.(href|assign)|app\.url\b/, file);
  }
});

test('스크립트 전체 gzip 40KB 이하(아이콘·JSON 제외)', () => {
  const total = landingFiles().reduce((sum, file) => sum + gzipSync(readFileSync(new URL(file, root))).length, 0);
  assert.ok(total <= 40 * 1024, `${total} bytes`);
});
