import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, stepWorld, settleAll, removeItem, refill, topItemAt, WORLD } from '../src/world.js';
import { createClaw, startGame, grab, judge, updateClaw, finishPrize, grabChance, CLAW } from '../src/claw.js';
import { mulberry32 } from '../src/rng.js';

const apps = JSON.parse(readFileSync(new URL('../catalog/data.json', import.meta.url), 'utf8'))
  .map((app) => ({ id: app.app_id, name: app.name, icon: app.icon, category: app.category }));
const DT = 1 / 60;
const still = { dx: 0, dz: 0 };

function readyClaw(world) {
  const claw = createClaw();
  startGame(claw);
  for (let i = 0; i < 120 && claw.homing; i += 1) updateClaw(claw, world, still, DT, mulberry32(1));
  return claw;
}

function runUntil(claw, world, rng, done, limit = 3000) {
  const all = [];
  for (let i = 0; i < limit; i += 1) {
    const events = updateClaw(claw, world, still, DT, rng);
    stepWorld(world, DT);
    all.push(...events);
    if (done(events)) return all;
  }
  throw new Error(`끝나지 않음: ${claw.state}`);
}

test('offset별 확률표(7.2)', () => {
  assert.equal(grabChance(0), 0.92);
  assert.equal(grabChance(0.35), 0.92);
  assert.ok(Math.abs(grabChance(0.525) - 0.735) < 1e-9);
  assert.ok(Math.abs(grabChance(0.7) - 0.55) < 1e-9);
  assert.ok(Math.abs(grabChance(0.85) - 0.35) < 1e-9);
  assert.ok(Math.abs(grabChance(1) - 0.15) < 1e-9);
  assert.equal(grabChance(1.01), 0);
});

test('상태 전이: attract → ready → moving → ready → dropping → closing → lifting → returning → releasing → prize/miss → ready', () => {
  const world = createWorld({ apps, seed: 5 });
  const claw = createClaw();
  assert.equal(claw.state, 'attract');
  updateClaw(claw, world, { dx: 1, dz: 0 }, 0.5, mulberry32(1));
  assert.equal(claw.state, 'attract', '시작 전에는 방향 입력으로 움직이지 않음');
  startGame(claw);
  assert.equal(claw.state, 'ready');
  const claw2 = readyClaw(world);
  updateClaw(claw2, world, { dx: 1, dz: 0 }, DT, mulberry32(1));
  assert.equal(claw2.state, 'moving');
  updateClaw(claw2, world, still, DT, mulberry32(1));
  assert.equal(claw2.state, 'ready');
  const target = world.items.reduce((a, b) => (b.y > a.y ? b : a));
  claw2.x = target.x;
  claw2.z = target.z;
  grab(claw2, world, mulberry32(1));
  assert.equal(claw2.state, 'dropping');
  const order = runUntil(claw2, world, mulberry32(2), (events) => events.some((e) => e.type === 'prize' || e.type === 'miss'))
    .filter((e) => e.type === 'state').map((e) => e.to);
  assert.deepEqual(order.slice(0, 5), ['closing', 'lifting', 'returning', 'releasing', order[4]]);
  assert.ok(['prize', 'miss'].includes(order[4]));
  if (claw2.state === 'prize') finishPrize(claw2);
  else runUntil(claw2, world, mulberry32(3), () => claw2.state === 'ready');
  assert.equal(claw2.state, 'ready');
});

test('30초 동안 조작이 없으면 attract로 돌아간다', () => {
  const world = createWorld({ apps, seed: 5 });
  const claw = readyClaw(world);
  for (let t = 0; t < 31; t += 0.5) updateClaw(claw, world, still, 0.5, mulberry32(1));
  assert.equal(claw.state, 'attract');
});

test('레일 범위 밖으로 나가지 않는다', () => {
  const world = createWorld({ apps, seed: 5 });
  const claw = readyClaw(world);
  for (let i = 0; i < 400; i += 1) updateClaw(claw, world, { dx: -1, dz: -1 }, DT, mulberry32(1));
  assert.deepEqual([claw.x, claw.z], [CLAW.RAIL.x0, CLAW.RAIL.z0]);
  for (let i = 0; i < 400; i += 1) updateClaw(claw, world, { dx: 1, dz: 1 }, DT, mulberry32(1));
  assert.deepEqual([claw.x, claw.z], [CLAW.RAIL.x1, CLAW.RAIL.z1]);
});

test('속도: 초당 x 32칸, z 24칸, 대각선 이동 허용', () => {
  const world = createWorld({ apps, seed: 5 });
  const claw = readyClaw(world);
  claw.x = 30; claw.z = 20;
  updateClaw(claw, world, { dx: 1, dz: 1 }, DT, mulberry32(1)); // ready → moving
  for (let i = 0; i < 30; i += 1) updateClaw(claw, world, { dx: 1, dz: 1 }, DT, mulberry32(1));
  assert.ok(Math.abs(claw.x - 46) < 0.01 && Math.abs(claw.z - 32) < 0.01, `${claw.x}, ${claw.z}`);
});

test('하강부터 놓기까지 방향 입력을 무시한다', () => {
  const world = createWorld({ apps, seed: 5 });
  const claw = readyClaw(world);
  claw.x = 50; claw.z = 30;
  grab(claw, world, mulberry32(1));
  const rng = mulberry32(4);
  while (claw.state !== 'returning') {
    updateClaw(claw, world, { dx: 1, dz: 1 }, DT, rng);
    if (claw.state !== 'returning') assert.deepEqual([claw.x, claw.z], [50, 30]);
  }
});

test('덮인 아이콘은 확률 절반, 도움 모드는 최소 95%', () => {
  const world = createWorld({ apps, seed: 11 });
  const [lower, left, right] = world.items;
  Object.assign(lower, { x: 50, z: 30, y: 0 });
  Object.assign(left, { x: 42, z: 30, y: WORLD.H });
  Object.assign(right, { x: 58, z: 30, y: WORLD.H });
  world.items = [lower, left, right];
  const claw = readyClaw(world);
  claw.x = 50; claw.z = 30;
  const covered = judge(claw, world, () => 0.99);
  assert.equal(covered.item, lower, '두 아이콘 사이에 깔린 아이콘이 집게 바로 아래');
  assert.ok(covered.covered >= 0.4, `덮인 비율 ${covered.covered}`);
  assert.ok(Math.abs(covered.chance - 0.46) < 1e-9);
  world.items = [lower];
  assert.ok(Math.abs(judge(claw, world, () => 0.99).chance - 0.92) < 1e-9);
  claw.assist = true;
  world.items = [lower, left, right];
  assert.ok(judge(claw, world, () => 0.99).chance >= 0.95);
  assert.equal(judge(claw, world, () => 0.5).success, true);
});

test('빈 곳에서 잡으면 빈손', () => {
  const world = createWorld({ apps, seed: 5 });
  world.items = [];
  const claw = readyClaw(world);
  claw.x = 60; claw.z = 40;
  grab(claw, world, mulberry32(1));
  const events = runUntil(claw, world, mulberry32(1), (e) => e.some((x) => x.type === 'miss'));
  const judged = events.find((e) => e.type === 'judge');
  assert.equal(judged.success, false);
  assert.equal(judged.item, null);
});

test('도움 모드: 3번 연속 실패하면 켜지고, 성공하면 꺼진다', () => {
  const world = createWorld({ apps, seed: 5 });
  const saved = world.items;
  const claw = readyClaw(world);
  for (let i = 1; i <= 3; i += 1) {
    world.items = [];
    claw.x = 60; claw.z = 40;
    grab(claw, world, mulberry32(i));
    const events = runUntil(claw, world, mulberry32(i), (e) => e.some((x) => x.type === 'miss'));
    assert.equal(events.find((e) => e.type === 'miss').streak, i);
    assert.equal(claw.assist, i >= 3);
    assert.equal(events.some((e) => e.type === 'assist'), i === 3);
    runUntil(claw, world, mulberry32(i), () => claw.state === 'ready');
  }
  world.items = saved;
  const target = world.items.reduce((a, b) => (b.y > a.y ? b : a));
  claw.x = target.x; claw.z = target.z;
  grab(claw, world, mulberry32(9));
  const events = runUntil(claw, world, mulberry32(9), (e) => e.some((x) => x.type === 'prize' || x.type === 'miss'));
  assert.ok(events.some((e) => e.type === 'prize'), '정중앙 + 도움 모드면 잡힌다');
  assert.equal(events.some((e) => e.type === 'slip'), false, '도움 모드에서는 미끄러지지 않음');
  assert.equal(claw.assist, false);
  assert.equal(claw.streak, 0);
});

test('약하게 잡히면(offset > 0.5) 미끄러질 수 있고, 미끄러진 아이콘은 다시 정착한다', () => {
  let slipped = 0;
  for (let seed = 1; seed <= 300 && slipped < 3; seed += 1) {
    const world = createWorld({ apps, seed });
    const claw = readyClaw(world);
    const target = world.items.reduce((a, b) => (b.y > a.y ? b : a));
    claw.x = Math.min(94, target.x + WORLD.D / 2 * 0.8);
    claw.z = target.z;
    grab(claw, world, mulberry32(seed));
    const events = runUntil(claw, world, mulberry32(seed), (e) => e.some((x) => x.type === 'prize' || x.type === 'miss'));
    const judged = events.find((e) => e.type === 'judge');
    const slip = events.find((e) => e.type === 'slip');
    if (slip) {
      slipped += 1;
      assert.equal(judged.weak, true);
      assert.ok(events.some((e) => e.type === 'miss'));
      settleAll(world);
      assert.equal(slip.item.state, 'settled');
      assert.ok(world.items.includes(slip.item));
    }
  }
  assert.ok(slipped >= 1);
});

test('움직임 줄이기: 잡기를 누르면 0.5초 안에 결과', () => {
  const world = createWorld({ apps, seed: 5 });
  const claw = readyClaw(world);
  const target = world.items[0];
  claw.x = target.x; claw.z = target.z;
  grab(claw, world, mulberry32(1), { quick: true });
  let t = 0;
  const rng = mulberry32(1);
  for (; t < 1; t += DT) {
    const events = updateClaw(claw, world, still, DT, rng);
    stepWorld(world, DT);
    if (events.some((e) => e.type === 'prize' || e.type === 'miss')) break;
  }
  assert.ok(t <= 0.5, `${t}s`);
});

// 6단계 완료 기준: "무작위 조준" = 아무 아이콘이나 하나 노리고, 처음 하는 사람의 조준 오차
// (좌우 표준편차 3칸, 앞뒤는 더 헷갈리므로 4칸)를 더한 위치에서 잡기.
function gauss(rng) { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }
function playRound(world, claw, rng, aim) {
  const candidates = world.items.filter((item) => item.state === 'settled');
  const target = candidates[Math.floor(aim() * candidates.length)];
  claw.x = Math.min(CLAW.RAIL.x1, Math.max(CLAW.RAIL.x0, target.x + gauss(aim) * 3));
  claw.z = Math.min(CLAW.RAIL.z1, Math.max(CLAW.RAIL.z0, target.z + gauss(aim) * 4));
  grab(claw, world, rng);
  for (let i = 0; i < 3000; i += 1) {
    const events = updateClaw(claw, world, still, DT, rng);
    stepWorld(world, DT);
    const prize = events.find((e) => e.type === 'prize');
    if (prize) {
      settleAll(world);
      removeItem(world, prize.item);
      refill(world, rng);
      settleAll(world);
      finishPrize(claw);
      return true;
    }
    if (events.some((e) => e.type === 'miss')) {
      while (claw.state !== 'ready') { updateClaw(claw, world, still, DT, rng); stepWorld(world, DT); }
      settleAll(world);
      return false;
    }
  }
  throw new Error('판이 끝나지 않음');
}

test('1,000판 시뮬레이션: 첫 판 성공률 40~50%, 4판 안에 1번 이상 성공 99% 이상', () => {
  const N = 1000;
  let first = 0;
  let withinFour = 0;
  for (let seed = 1; seed <= N; seed += 1) {
    const world = createWorld({ apps, seed });
    const claw = createClaw();
    startGame(claw);
    claw.homing = false;
    const rng = mulberry32(seed * 7 + 1);
    const aim = mulberry32(seed * 13 + 5);
    for (let round = 0; round < 4; round += 1) {
      const won = playRound(world, claw, rng, aim);
      if (won && round === 0) first += 1;
      if (won) { withinFour += 1; break; }
    }
  }
  const firstRate = first / N;
  const fourRate = withinFour / N;
  assert.ok(firstRate >= 0.4 && firstRate <= 0.5, `첫 판 성공률 ${firstRate}`);
  assert.ok(fourRate >= 0.99, `4판 안 성공률 ${fourRate}`);
});
