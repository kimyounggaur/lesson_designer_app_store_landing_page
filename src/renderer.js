// 캔버스 2.5D 그리기 (설계서 5.2, 5.3, 6.4).
import { WORLD, project, surfaceAt, topItemAt } from './world.js';

const R = WORLD.D / 2;
export const TILE_SCALE = 1.3; // 그림 타일은 바닥 원(지름 13칸)보다 30% 크게 그려 안쪽 아이콘도 44px 이상이 되게 한다.
const RAIL_Y = WORLD.Y + 18;
const LINE = '#3A3A48';
const HIGHLIGHT = '#F5B700';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FALLBACK_COLORS = { learning: '#F7BFC8', coaches: '#BFD8F7', tools: '#C8EBC9', games: '#FFE1A8' };

// 아이콘을 못 불러왔을 때: 이름 첫 글자가 들어간 단색 타일(9.3).
export function fallbackTile(app, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = FALLBACK_COLORS[app.category] || '#E8E2F4';
  roundRect(ctx, 0, 0, size, size, size * 0.2);
  ctx.fill();
  ctx.fillStyle = '#274458';
  ctx.font = `800 ${Math.round(size * 0.5)}px 'Noto Sans KR','Malgun Gothic',system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Array.from(app.name || '?')[0], size / 2, size / 2 + size * 0.03);
  return canvas;
}

export function tileSizeFor(view) {
  return R * 2 * TILE_SCALE * (view.w / 100);
}

function drawGrid(ctx, view) {
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.X; x += 4) {
    const a = project(view, x, 0, 0);
    const b = project(view, x, 0, WORLD.Z);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  for (let z = 0; z <= WORLD.Z; z += 4) {
    const a = project(view, 0, 0, z);
    const b = project(view, WORLD.X, 0, z);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}

function quad(ctx, view, points) {
  ctx.beginPath();
  points.forEach(([x, y, z], index) => {
    const p = project(view, x, y, z);
    if (index) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
}

function drawChuteBack(ctx, view) {
  const { x0, x1, z0, z1, wall } = WORLD.CHUTE;
  ctx.fillStyle = 'rgba(46,46,60,.75)';
  quad(ctx, view, [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.strokeStyle = 'rgba(58,58,72,.55)';
  ctx.lineWidth = 1.5;
  quad(ctx, view, [[x0, 0, z1], [x1, 0, z1], [x1, wall, z1], [x0, wall, z1]]);
  ctx.fill();
  ctx.stroke();
}

function drawChuteFront(ctx, view) {
  const { x0, x1, z0, z1, wall } = WORLD.CHUTE;
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.strokeStyle = 'rgba(58,58,72,.55)';
  ctx.lineWidth = 1.5;
  quad(ctx, view, [[x1, 0, z0], [x1, 0, z1], [x1, wall, z1], [x1, wall, z0]]);
  ctx.fill();
  ctx.stroke();
  quad(ctx, view, [[x0, 0, z0], [x1, 0, z0], [x1, wall, z0], [x0, wall, z0]]);
  ctx.fill();
  ctx.stroke();
}

function drawShadow(ctx, view, x, y, z, radius, color) {
  const p = project(view, x, y, z);
  const rx = radius * p.unitX * p.scale;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, rx, rx * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  return { p, rx };
}

function drawItem(ctx, view, item, tiles, highlighted) {
  const p = project(view, item.x, item.y + WORLD.H / 2, item.z);
  const size = tileSizeFor(view) * p.scale;
  const tile = tiles(item.app);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(item.tilt);
  ctx.fillStyle = 'rgba(58,58,72,.28)';
  roundRect(ctx, -size / 2, -size / 2 + size * 0.07, size, size, size * 0.2);
  ctx.fill();
  if (tile) ctx.drawImage(tile, -size / 2, -size / 2, size, size);
  if (highlighted) {
    ctx.strokeStyle = HIGHLIGHT;
    ctx.lineWidth = 3;
    roundRect(ctx, -size / 2 - 2, -size / 2 - 2, size + 4, size + 4, size * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRails(ctx, view, claw) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(58,58,72,.75)';
  ctx.lineWidth = 3;
  let a = project(view, 2, RAIL_Y, claw.z);
  let b = project(view, 98, RAIL_Y, claw.z);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  a = project(view, claw.x, RAIL_Y, 0);
  b = project(view, claw.x, RAIL_Y, WORLD.Z);
  ctx.strokeStyle = 'rgba(58,58,72,.5)';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawClaw(ctx, view, claw, tiles) {
  const top = project(view, claw.x, RAIL_Y, claw.z);
  const head = project(view, claw.x, claw.y + 6, claw.z);
  const s = head.unitX * head.scale; // 1칸의 화면 크기
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.rotate(claw.sway);
  const len = head.y - top.y;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1.5, s * 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, len);
  ctx.stroke();
  // 레일 위 이동 상자
  ctx.fillStyle = '#9AA3B5';
  ctx.lineWidth = 2;
  roundRect(ctx, -s * 3, -s * 1.6, s * 6, s * 3.2, s);
  ctx.fill();
  ctx.stroke();
  if (claw.held) {
    const item = claw.held;
    const size = tileSizeFor(view) * head.scale;
    const tile = tiles(item.app);
    ctx.save();
    ctx.translate(0, len + s * 6.5);
    ctx.rotate(item.tilt * 0.5);
    if (tile) ctx.drawImage(tile, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  // 집게 머리와 두 갈래
  ctx.translate(0, len);
  const spread = (12 + 26 * claw.open) * (Math.PI / 180);
  ctx.lineWidth = Math.max(2.5, s * 0.75);
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * spread);
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 5.5);
    ctx.quadraticCurveTo(0, s * 7.8, -side * s * 2.2, s * 8.4);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#C3C9D6';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  roundRect(ctx, -s * 2.6, -s * 2.2, s * 5.2, s * 3.6, s * 1.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 전체 한 장면 그리기.
export function render(ctx, view, world, claw, tiles) {
  ctx.clearRect(0, 0, view.w, view.h);
  drawGrid(ctx, view);
  drawRails(ctx, view, claw);
  drawChuteBack(ctx, view);

  const aiming = claw.state === 'ready' || claw.state === 'moving';
  const target = aiming ? topItemAt(world, claw.x, claw.z) : null;
  const visible = world.items.filter((item) => item.delay <= 0 && item.state !== 'held' && item.state !== 'gone');
  const chuteItems = visible.filter((item) => item.state === 'chute');
  const pile = visible.filter((item) => item.state !== 'chute').sort((a, b) => b.z - a.z || a.y - b.y);

  for (const item of chuteItems) drawItem(ctx, view, item, tiles, false);
  let chuteDrawn = false;
  for (const item of pile) {
    if (!chuteDrawn && item.z < WORLD.CHUTE.z1) { drawChuteFront(ctx, view); chuteDrawn = true; }
    const support = surfaceAt(world.items, item.x, item.z, WORLD.D * 0.8, { exclude: item, below: item.y + 0.01 });
    drawShadow(ctx, view, item.x, support.height, item.z, R * 0.95, 'rgba(0,0,0,.18)');
    drawItem(ctx, view, item, tiles, target?.item === item);
  }
  if (!chuteDrawn) drawChuteFront(ctx, view);

  // 6.4 집게 그림자: 집게 바로 아래 표면에 진한 타원 + 노란 테두리.
  if (claw.state !== 'attract') {
    const floor = surfaceAt(world.items, claw.x, claw.z, R).height;
    const { p, rx } = drawShadow(ctx, view, claw.x, Math.min(floor, claw.y), claw.z, R * 0.55, 'rgba(0,0,0,.30)');
    ctx.strokeStyle = HIGHLIGHT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, rx * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawClaw(ctx, view, claw, tiles);
  return target;
}
