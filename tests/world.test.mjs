import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, stepWorld, settleAll, removeItem, refill, overlapsChute, surfaceAt, project, WORLD } from '../src/world.js';
import { mulberry32 } from '../src/rng.js';

const apps = JSON.parse(readFileSync(new URL('../catalog/data.json', import.meta.url), 'utf8'))
  .map((app) => ({ id: app.app_id, name: app.name, icon: app.icon, category: app.category }));
const snapshot = (world) => world.items.map((item) => [item.app.id, item.x.toFixed(3), item.z.toFixed(3), item.y.toFixed(3)]);

test('같은 시드면 같은 배치, 다른 시드면 다른 배치', () => {
  assert.deepEqual(snapshot(createWorld({ apps, seed: 42 })), snapshot(createWorld({ apps, seed: 42 })));
  assert.notDeepEqual(snapshot(createWorld({ apps, seed: 42 })), snapshot(createWorld({ apps, seed: 43 })));
});

test('배출구 구역에 아이콘이 없고, 벽 안에 있으며, 더미 높이는 18칸 이하', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const world = createWorld({ apps, seed });
    assert.equal(world.items.length, 28);
    for (const item of world.items) {
      assert.equal(overlapsChute(item.x, item.z), false, `seed ${seed}: ${item.app.name} 배출구 구역`);
      assert.ok(item.x >= WORLD.D / 2 && item.x <= WORLD.X - WORLD.D / 2);
      assert.ok(item.z >= WORLD.D / 2 && item.z <= WORLD.Z - WORLD.D / 2);
      assert.ok(item.y <= WORLD.MAX_PILE + 1e-6, `seed ${seed}: 높이 ${item.y}`);
      assert.equal(item.state, 'settled');
    }
  }
});

test('분류별 개수: 연주·악기 학습 7, 음악 게임 7, 음악 도구 7, 운지 코치 6 이상, 합계 28, 중복 없음', () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const world = createWorld({ apps, seed });
    const count = {};
    for (const item of world.items) count[item.app.category] = (count[item.app.category] || 0) + 1;
    assert.ok(count.learning >= 7 && count.games >= 7 && count.tools >= 7 && count.coaches >= 6, JSON.stringify(count));
    assert.equal(new Set(world.items.map((item) => item.app.id)).size, 28);
  }
});

test('pit-size만큼 고른다', () => {
  assert.equal(createWorld({ apps, size: 12, seed: 3 }).items.length, 12);
  assert.equal(createWorld({ apps, size: 36, seed: 3 }).items.length, 36);
});

test('첫 화면 낙하 연출: 위에서 차례로 떨어져 정착한다', () => {
  const world = createWorld({ apps, seed: 7, intro: true });
  assert.ok(world.items.every((item) => item.y > WORLD.Y));
  assert.ok(world.items.at(-1).delay > 1);
  settleAll(world);
  assert.ok(world.items.every((item) => item.state === 'settled' && item.y <= WORLD.MAX_PILE + WORLD.H));
});

test('받침이 사라진 아이콘은 낙하해 다시 정착한다', () => {
  let found = false;
  for (let seed = 1; seed <= 50 && !found; seed += 1) {
    const world = createWorld({ apps, seed });
    const upper = world.items.find((item) => item.y > 0);
    if (!upper) continue;
    found = true;
    const before = upper.y;
    const support = surfaceAt(world.items, upper.x, upper.z, WORLD.D * 0.8, { exclude: upper, below: upper.y });
    removeItem(world, support.item);
    stepWorld(world, 1 / 60);
    assert.equal(upper.state, 'falling');
    settleAll(world);
    assert.equal(upper.state, 'settled');
    assert.ok(upper.y < before);
    const now = surfaceAt(world.items, upper.x, upper.z, WORLD.D * 0.8, { exclude: upper, below: upper.y + 0.01 });
    assert.ok(Math.abs(now.height - upper.y) < 1e-6, '아래 표면 위에 놓인다');
  }
  assert.ok(found);
});

test('채우기: 아직 더미에 없는 앱이 떨어지고, 모두 보인 뒤에는 다시 전체에서 고른다', () => {
  const world = createWorld({ apps, seed: 9 });
  const rng = mulberry32(1);
  for (let round = 0; round < 80; round += 1) {
    const ids = new Set(world.items.map((item) => item.app.id));
    removeItem(world, world.items[0]);
    const added = refill(world, rng);
    assert.ok(added);
    assert.equal(ids.has(added.app.id) && added.app.id !== [...ids][0], false);
    settleAll(world);
    assert.equal(world.items.length, 28);
    assert.equal(new Set(world.items.map((item) => item.app.id)).size, 28);
  }
});

test('투영: 안쪽일수록 작고 위로, 높을수록 위로', () => {
  const view = { w: 408, h: 380 };
  const front = project(view, 50, 0, 0);
  const back = project(view, 50, 0, 60);
  assert.equal(front.scale, 1);
  assert.ok(Math.abs(back.scale - 0.72) < 1e-9);
  assert.ok(back.y < front.y);
  assert.ok(project(view, 50, 10, 0).y < front.y);
  assert.equal(front.x, 204);
  assert.ok(Math.abs(project(view, 0, 0, 0).x) < 1e-9);
});
