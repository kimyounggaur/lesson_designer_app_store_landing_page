// 유리창 속 세계: 좌표계, 투영, 더미 생성, 정착 규칙. 화면과 무관한 순수 로직(설계서 5장).
import { mulberry32, shuffle } from './rng.js';

export const WORLD = Object.freeze({
  X: 100, // 왼쪽 → 오른쪽
  Z: 60, // 0 = 앞(유리 쪽), 60 = 안쪽 벽
  Y: 70, // 0 = 바닥, 70 = 집게 레일
  D: 13, // 아이콘 지름
  H: 6, // 아이콘 두께
  MAX_PILE: 18,
  GRAVITY: 220,
  CHUTE: Object.freeze({ x0: 0, x1: 20, z0: 0, z1: 18, wall: 14 }),
  HOME: Object.freeze({ x: 10, z: 9, y: 70 }),
});

const R = WORLD.D / 2;
const STACK_REACH = WORLD.D * 0.8;
const SLIDE_TIME = 0.3;
const MAX_SLIDES = 3;
const SPAWN = { x0: 7, x1: 93, z0: 7, z1: 53 };
const BASE_QUOTA = { learning: 7, games: 7, tools: 7, coaches: 6 }; // 28개 기준

export const distXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// 아이콘 바닥면(원)이 배출구 구역과 겹치는가.
export function overlapsChute(x, z) {
  const { x1, z1 } = WORLD.CHUTE;
  return x < x1 + R && z < z1 + R;
}

// 5.2 투영식. view = { w, h } (캔버스 픽셀)
export function project(view, x, y, z) {
  const unitX = view.w / 100;
  const unitY = unitX * 0.9;
  const depthT = z / WORLD.Z;
  const scale = 1 - 0.28 * depthT;
  return {
    x: view.w / 2 + (x - 50) * unitX * scale,
    y: view.h * 0.96 - depthT * view.h * 0.3 - y * unitY * scale,
    scale,
    unitX,
  };
}

// 5.4-1 분류별로 고르게 고른다.
export function pickApps(apps, size, rng) {
  const count = Math.min(size, apps.length);
  const byCategory = new Map();
  for (const app of shuffle(apps, rng)) {
    if (!byCategory.has(app.category)) byCategory.set(app.category, []);
    byCategory.get(app.category).push(app);
  }
  const picked = [];
  for (const [category, base] of Object.entries(BASE_QUOTA)) {
    const quota = Math.floor((base * count) / 28);
    picked.push(...(byCategory.get(category) || []).splice(0, quota));
  }
  const rest = shuffle([...byCategory.values()].flat(), rng);
  while (picked.length < count && rest.length) picked.push(rest.pop());
  return shuffle(picked, rng);
}

const isSolid = (item) => item.state !== 'held' && item.state !== 'chute' && item.delay <= 0;

// (x, z) 둘레 reach 안에서 가장 높은 윗면. below가 있으면 그 높이보다 아래에 있는 것만 본다.
export function surfaceAt(items, x, z, reach = STACK_REACH, { exclude = null, below = Infinity } = {}) {
  let height = 0;
  let top = null;
  for (const item of items) {
    if (item === exclude || !isSolid(item) || item.y >= below - 1e-6) continue;
    if (distXZ(x, z, item.x, item.z) >= reach) continue;
    const surface = item.y + WORLD.H;
    if (surface > height) { height = surface; top = item; }
  }
  return { height, item: top };
}

function findSpot(items, rng) {
  let best = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const x = SPAWN.x0 + rng() * (SPAWN.x1 - SPAWN.x0);
    const z = SPAWN.z0 + rng() * (SPAWN.z1 - SPAWN.z0);
    if (overlapsChute(x, z)) continue;
    const { height } = surfaceAt(items, x, z);
    if (height <= WORLD.MAX_PILE) return { x, z, y: height };
    if (!best || height < best.y) best = { x, z, y: height };
  }
  return best || { x: 60, z: 40, y: surfaceAt(items, 60, 40).height };
}

let uidCounter = 0;
function makeItem(app, spot, rng, { drop = false, delay = 0 } = {}) {
  uidCounter += 1;
  return {
    uid: uidCounter,
    app,
    x: spot.x,
    z: spot.z,
    y: drop ? WORLD.Y + 8 : spot.y,
    vy: 0,
    tilt: (rng() * 28 - 14) * (Math.PI / 180),
    state: drop ? 'falling' : 'settled',
    delay,
    fallFrom: WORLD.Y + 8,
    bounced: false,
    slides: 0,
    slide: null,
  };
}

// 더미를 만든다. intro면 위에서 0.04초 간격으로 떨어지는 상태로 시작한다.
export function createWorld({ apps, size = 28, seed = 1, intro = false }) {
  const rng = mulberry32(seed);
  const picked = pickApps(apps, size, rng);
  const items = [];
  picked.forEach((app, index) => {
    const spot = findSpot(items, rng);
    items.push(makeItem(app, spot, rng, { drop: intro, delay: intro ? index * 0.04 : 0 }));
  });
  const world = { items, apps, rng, shown: new Set(picked.map((app) => app.id)) };
  if (!intro) settleAll(world);
  return world;
}

function clampToWalls(item) {
  item.x = Math.min(WORLD.X - R, Math.max(R, item.x));
  item.z = Math.min(WORLD.Z - R, Math.max(R, item.z));
  if (overlapsChute(item.x, item.z)) {
    const pushX = WORLD.CHUTE.x1 + R - item.x;
    const pushZ = WORLD.CHUTE.z1 + R - item.z;
    if (pushX < pushZ) item.x += pushX + 0.01; else item.z += pushZ + 0.01;
  }
}

function land(item, support) {
  const below = support.item;
  if (below && item.slides < MAX_SLIDES) {
    const d = distXZ(item.x, item.z, below.x, below.z);
    if (d > R * 0.7) {
      const nx = d > 1e-6 ? (item.x - below.x) / d : 1;
      const nz = d > 1e-6 ? (item.z - below.z) / d : 0;
      const distance = STACK_REACH - d + 0.6;
      item.state = 'sliding';
      item.slides += 1;
      item.slide = { nx, nz, speed: distance / SLIDE_TIME, t: 0 };
      return;
    }
  }
  item.state = 'settled';
  item.vy = 0;
}

// 5.5 가벼운 물리 한 걸음.
export function stepWorld(world, dt) {
  const ordered = [...world.items].sort((a, b) => a.y - b.y);
  for (const item of ordered) {
    if (item.delay > 0) { item.delay -= dt; continue; }
    if (item.state === 'held') continue;
    if (item.state === 'chute') {
      item.vy -= WORLD.GRAVITY * dt;
      item.y += item.vy * dt;
      if (item.y <= -WORLD.H) item.state = 'gone';
      continue;
    }
    if (item.state === 'gone') continue;
    if (item.state === 'sliding') {
      const { slide } = item;
      const step = Math.min(dt, SLIDE_TIME - slide.t);
      item.x += slide.nx * slide.speed * step;
      item.z += slide.nz * slide.speed * step;
      slide.t += step;
      clampToWalls(item);
      if (slide.t >= SLIDE_TIME - 1e-9) {
        item.slide = null;
        item.state = 'falling';
        item.vy = 0;
        item.fallFrom = item.y;
        item.bounced = false;
      }
      continue;
    }
    const support = surfaceAt(world.items, item.x, item.z, STACK_REACH, { exclude: item, below: item.y });
    if (item.state === 'settled') {
      if (support.height < item.y - 0.01) {
        item.state = 'falling';
        item.vy = 0;
        item.fallFrom = item.y;
        item.bounced = false;
      }
      continue;
    }
    // falling
    item.vy -= WORLD.GRAVITY * dt;
    item.y += item.vy * dt;
    if (item.y <= support.height) {
      const fallHeight = item.fallFrom - support.height;
      item.y = support.height;
      if (!item.bounced && fallHeight > 1) {
        item.bounced = true;
        item.vy = Math.sqrt(2 * WORLD.GRAVITY * fallHeight * 0.15);
        item.fallFrom = support.height + fallHeight * 0.15;
      } else {
        land(item, support);
      }
    }
  }
  world.items = world.items.filter((item) => item.state !== 'gone');
}

export const isAnimating = (world) => world.items.some((item) => item.delay > 0 || ['falling', 'sliding', 'chute'].includes(item.state));

export function settleAll(world, maxSeconds = 20) {
  for (let t = 0; t < maxSeconds && isAnimating(world); t += 1 / 60) stepWorld(world, 1 / 60);
}

// 집게 바로 아래(기본 오프셋 1 이내)에서 가장 위에 있는 아이콘.
export function topItemAt(world, x, z, maxOffset = 1) {
  let best = null;
  for (const item of world.items) {
    if (!isSolid(item)) continue;
    const offset = distXZ(x, z, item.x, item.z) / R;
    if (offset > maxOffset) continue;
    if (!best || item.y > best.item.y) best = { item, offset };
  }
  return best;
}

function lensArea(d, r) {
  if (d >= 2 * r) return 0;
  return 2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);
}

// 윗면이 위 아이콘들에 덮인 비율(0~1).
export function coveredRatio(world, target) {
  let area = 0;
  for (const item of world.items) {
    if (item === target || !isSolid(item) || item.y <= target.y + 0.01) continue;
    area += lensArea(distXZ(item.x, item.z, target.x, target.z), R);
  }
  return Math.min(1, area / (Math.PI * R * R));
}

export function removeItem(world, item) {
  world.items = world.items.filter((other) => other !== item);
}

// 7.3 아직 더미에 없는 앱 하나를 위에서 떨어뜨려 채운다. 모두 한 번씩 보였으면 다시 전체에서.
export function refill(world, rng = world.rng) {
  const inPile = new Set(world.items.map((item) => item.app.id));
  let candidates = world.apps.filter((app) => !inPile.has(app.id) && !world.shown.has(app.id));
  if (!candidates.length) {
    world.shown = new Set(inPile);
    candidates = world.apps.filter((app) => !inPile.has(app.id));
  }
  if (!candidates.length) return null;
  const app = candidates[Math.floor(rng() * candidates.length)];
  world.shown.add(app.id);
  const item = makeItem(app, findSpot(world.items, rng), rng, { drop: true });
  world.items.push(item);
  return item;
}
