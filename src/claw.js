// 집게 상태 머신, 이동, 잡기 판정. 화면과 무관한 순수 로직(설계서 7장).
import { WORLD, topItemAt, coveredRatio, surfaceAt, overlapsChute, distXZ } from './world.js';

export const CLAW = Object.freeze({
  SPEED_X: 32,
  SPEED_Z: 24,
  RAIL: Object.freeze({ x0: 6, x1: 94, z0: 6, z1: 54 }),
  DROP: 45,
  LIFT: 35,
  RETURN: 40,
  HOMING: 80,
  CLOSE_TIME: 0.35,
  RELEASE_TIME: 0.3,
  MISS_TIME: 1.2,
  QUICK_TIME: 0.4,
  IDLE_TO_ATTRACT: 30,
  SLIP_CHANCE: 0.12,
  ASSIST_AFTER: 3,
  ASSIST_MIN: 0.95,
  ASSIST_REACH: 1.3, // 도움 모드에서는 집게가 조금 더 넓게 잡는다(가장자리를 살짝 벗어나도 잡힘)
  MAX_SWAY: (4 * Math.PI) / 180,
});

const R = WORLD.D / 2;
const LOCKED = new Set(['dropping', 'closing', 'lifting', 'returning', 'releasing']);

// 7.2 offset별 잡힘 확률(기본값).
export function grabChance(offset) {
  if (offset < 0 || offset > 1) return 0;
  if (offset <= 0.35) return 0.92;
  if (offset <= 0.7) return 0.92 - ((offset - 0.35) / 0.35) * (0.92 - 0.55);
  return 0.55 - ((offset - 0.7) / 0.3) * (0.55 - 0.15);
}

export function createClaw({ timeLimit = 0 } = {}) {
  return {
    state: 'attract',
    x: WORLD.HOME.x,
    z: WORLD.HOME.z,
    y: WORLD.Y,
    open: 1,
    held: null,
    judgement: null,
    slipPoint: null,
    streak: 0,
    assist: false,
    homing: false,
    t: 0,
    idle: 0,
    attractT: 0,
    roundT: 0,
    timeLimit,
    sway: 0,
    swayV: 0,
    vx: 0,
    vz: 0,
  };
}

function setState(claw, events, state) {
  events.push({ type: 'state', from: claw.state, to: state });
  claw.state = state;
  claw.t = 0;
}

export const isLocked = (claw) => LOCKED.has(claw.state);

export function startGame(claw) {
  if (claw.state !== 'attract') return [];
  const events = [];
  setState(claw, events, 'ready');
  claw.homing = true;
  claw.idle = 0;
  claw.roundT = 0;
  return events;
}

// 7.2 판정: closing 시점에 결과(잡힘·약하게 잡힘·미끄러질 때)를 모두 정한다.
export function judge(claw, world, rng) {
  const hit = topItemAt(world, claw.x, claw.z, claw.assist ? CLAW.ASSIST_REACH : 1);
  if (!hit) return { success: false, item: null, offset: null, chance: 0, weak: false, slip: null };
  let chance = grabChance(Math.min(1, hit.offset));
  const covered = coveredRatio(world, hit.item);
  if (covered >= 0.4) chance /= 2;
  if (claw.assist) chance = Math.max(chance, CLAW.ASSIST_MIN);
  const success = rng() < chance;
  const weak = success && !claw.assist && hit.offset > 0.5;
  const slipLift = rng() < CLAW.SLIP_CHANCE;
  const slipReturn = rng() < CLAW.SLIP_CHANCE;
  const slip = weak ? (slipLift ? 'lifting' : slipReturn ? 'returning' : null) : null;
  return { success, item: hit.item, offset: hit.offset, chance, covered, weak, slip };
}

export function grab(claw, world, rng, { quick = false } = {}) {
  if (claw.state !== 'ready' && claw.state !== 'moving') return [];
  if (claw.homing) return [];
  const events = [{ type: 'grab' }];
  if (!quick) {
    setState(claw, events, 'dropping');
    return events;
  }
  // 움직임 줄이기: 연출 없이 그 자리에서 판정하고 0.4초 뒤 결과로 간다.
  claw.judgement = judge(claw, world, rng);
  events.push({ type: 'judge', ...claw.judgement });
  const { success, slip, item } = claw.judgement;
  if (success && !slip) {
    claw.held = item;
    item.state = 'held';
  } else if (slip) {
    events.push({ type: 'slip', item });
  }
  claw.x = WORLD.HOME.x;
  claw.z = WORLD.HOME.z;
  claw.y = WORLD.Y;
  setState(claw, events, 'releasing');
  claw.quick = true;
  return events;
}

function holdItem(claw) {
  if (!claw.held) return;
  claw.held.x = claw.x;
  claw.held.z = claw.z;
  claw.held.y = claw.y - WORLD.H * 0.6;
}

function dropHeld(claw, events) {
  const item = claw.held;
  claw.held = null;
  item.state = 'falling';
  item.vy = 0;
  item.fallFrom = item.y;
  item.bounced = false;
  events.push({ type: 'slip', item });
}

function moveToward(claw, tx, tz, speed, dt) {
  const d = distXZ(claw.x, claw.z, tx, tz);
  const step = speed * dt;
  if (d <= step) { claw.x = tx; claw.z = tz; return true; }
  claw.x += ((tx - claw.x) / d) * step;
  claw.z += ((tz - claw.z) / d) * step;
  return false;
}

function updateSway(claw, prevX, prevZ, dt) {
  if (dt <= 0) return;
  const vx = (claw.x - prevX) / dt;
  const vz = (claw.z - prevZ) / dt;
  const accel = (vx - claw.vx) + (vz - claw.vz) * 0.5;
  claw.vx = vx;
  claw.vz = vz;
  const omega = (2 * Math.PI) / 0.8;
  const ropeFrac = 0.35 + 0.65 * ((WORLD.Y - claw.y) / WORLD.Y);
  claw.swayV += -omega * omega * claw.sway * dt - 2 * 0.55 * omega * claw.swayV * dt - accel * 0.0025;
  claw.sway += claw.swayV * dt;
  const max = CLAW.MAX_SWAY * ropeFrac;
  if (Math.abs(claw.sway) > max) { claw.sway = Math.sign(claw.sway) * max; claw.swayV *= 0.5; }
  if (Math.abs(claw.sway) < 1e-4 && Math.abs(claw.swayV) < 1e-3) { claw.sway = 0; claw.swayV = 0; }
}

// input = { dx: -1|0|1, dz: -1|0|1 } (dz +1 = 안쪽). 발생한 일을 이벤트 배열로 돌려준다.
export function updateClaw(claw, world, input, dt, rng) {
  const events = [];
  const prevX = claw.x;
  const prevZ = claw.z;
  const moving = Boolean(input && (input.dx || input.dz));
  claw.t += dt;

  switch (claw.state) {
    case 'attract':
      claw.attractT += dt;
      claw.x = 50 - 38 * Math.cos(claw.attractT * 0.6);
      claw.z = 24;
      break;
    case 'ready':
      if (claw.homing) {
        if (moveToward(claw, WORLD.HOME.x, WORLD.HOME.z, CLAW.HOMING, dt)) claw.homing = false;
        break;
      }
      claw.roundT += dt;
      if (moving) { setState(claw, events, 'moving'); claw.idle = 0; break; }
      claw.idle += dt;
      if (claw.idle >= CLAW.IDLE_TO_ATTRACT) { setState(claw, events, 'attract'); claw.attractT = 0; }
      break;
    case 'moving':
      claw.roundT += dt;
      claw.idle = 0;
      if (!moving) { setState(claw, events, 'ready'); break; }
      claw.x = Math.min(CLAW.RAIL.x1, Math.max(CLAW.RAIL.x0, claw.x + input.dx * CLAW.SPEED_X * dt));
      claw.z = Math.min(CLAW.RAIL.z1, Math.max(CLAW.RAIL.z0, claw.z + input.dz * CLAW.SPEED_Z * dt));
      break;
    case 'dropping': {
      claw.y -= CLAW.DROP * dt;
      const floor = surfaceAt(world.items, claw.x, claw.z, R).height;
      if (claw.y <= floor) {
        claw.y = floor;
        setState(claw, events, 'closing');
        claw.judgement = judge(claw, world, rng);
        events.push({ type: 'judge', ...claw.judgement });
      }
      break;
    }
    case 'closing':
      claw.open = Math.max(0, 1 - claw.t / CLAW.CLOSE_TIME);
      if (claw.t >= CLAW.CLOSE_TIME) {
        claw.open = claw.judgement.success ? 0 : 0.15;
        if (claw.judgement.success) {
          claw.held = claw.judgement.item;
          claw.held.state = 'held';
        }
        claw.slipY = claw.y + (WORLD.Y - claw.y) * 0.5;
        setState(claw, events, 'lifting');
      }
      break;
    case 'lifting':
      claw.y = Math.min(WORLD.Y, claw.y + CLAW.LIFT * dt);
      holdItem(claw);
      if (claw.held && claw.judgement.slip === 'lifting' && claw.y >= claw.slipY) dropHeld(claw, events);
      if (claw.y >= WORLD.Y) {
        // 2차 미끄러짐 지점: 돌아가는 길의 가운데. 배출구 위라면 출발점 쪽으로 당긴다.
        let frac = 0.5;
        let point;
        do {
          point = { x: claw.x + (WORLD.HOME.x - claw.x) * frac, z: claw.z + (WORLD.HOME.z - claw.z) * frac };
          frac -= 0.1;
        } while (overlapsChute(point.x, point.z) && frac > 0);
        claw.slipPoint = frac > 0 ? point : null;
        claw.returnFrom = { x: claw.x, z: claw.z };
        setState(claw, events, 'returning');
      }
      break;
    case 'returning': {
      const arrived = moveToward(claw, WORLD.HOME.x, WORLD.HOME.z, CLAW.RETURN, dt);
      holdItem(claw);
      if (claw.held && claw.judgement.slip === 'returning') {
        const total = distXZ(claw.returnFrom.x, claw.returnFrom.z, WORLD.HOME.x, WORLD.HOME.z);
        const done = distXZ(claw.returnFrom.x, claw.returnFrom.z, claw.x, claw.z);
        const target = claw.slipPoint ? distXZ(claw.returnFrom.x, claw.returnFrom.z, claw.slipPoint.x, claw.slipPoint.z) : 0;
        if (claw.slipPoint && done >= target && total > 0) dropHeld(claw, events);
        else if (!claw.slipPoint) dropHeld(claw, events);
      }
      if (arrived) setState(claw, events, 'releasing');
      break;
    }
    case 'releasing': {
      const duration = claw.quick ? CLAW.QUICK_TIME : CLAW.RELEASE_TIME;
      claw.open = Math.min(1, claw.t / CLAW.RELEASE_TIME);
      if (claw.held && claw.t >= CLAW.RELEASE_TIME * 0.4) {
        claw.prizeItem = claw.held;
        claw.held.state = 'chute';
        claw.held.vy = 0;
        claw.held = null;
      }
      if (claw.t >= duration) {
        claw.open = 1;
        claw.quick = false;
        if (claw.prizeItem) {
          const item = claw.prizeItem;
          claw.prizeItem = null;
          claw.streak = 0;
          claw.assist = false;
          setState(claw, events, 'prize');
          events.push({ type: 'prize', item });
        } else {
          claw.streak += 1;
          const wasAssist = claw.assist;
          claw.assist = claw.streak >= CLAW.ASSIST_AFTER;
          setState(claw, events, 'miss');
          events.push({ type: 'miss', streak: claw.streak });
          if (claw.assist && !wasAssist) events.push({ type: 'assist' });
        }
      }
      break;
    }
    case 'miss':
      if (claw.t >= CLAW.MISS_TIME) { setState(claw, events, 'ready'); claw.roundT = 0; claw.idle = 0; }
      break;
    case 'prize':
    default:
      break;
  }

  // 시간 제한(기본 0 = 없음): 넘으면 자동으로 잡기.
  if (claw.timeLimit > 0 && (claw.state === 'ready' || claw.state === 'moving') && !claw.homing && claw.roundT >= claw.timeLimit) {
    events.push(...grab(claw, world, rng));
  }
  updateSway(claw, prevX, prevZ, dt);
  return events;
}

// 카드를 닫으면 다시 준비 상태로.
export function finishPrize(claw) {
  if (claw.state !== 'prize') return [];
  const events = [];
  setState(claw, events, 'ready');
  claw.roundT = 0;
  claw.idle = 0;
  return events;
}

export const isIdle = (claw) => claw.state === 'prize' || (claw.state === 'ready' && !claw.homing && claw.sway === 0 && claw.swayV === 0);
