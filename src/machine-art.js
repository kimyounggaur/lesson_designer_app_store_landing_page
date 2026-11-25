// 기계 그림 SVG (설계서 4장). viewBox 480×720, 뒤 레이어(몸체·유리창 바탕)와 앞 레이어(반사광·틀·배출구 문).
// 참고 이미지는 구성만 따랐고, 그림은 새로 그렸다.

export const VIEWBOX = { w: 480, h: 720 };

// 영역(viewBox 기준). element.js가 캔버스와 HTML 버튼을 이 좌표에 겹친다.
export const AREAS = Object.freeze({
  sign: { x: 40, y: 12, w: 400, h: 60 },
  glass: { x: 36, y: 88, w: 408, h: 380 },
  chute: { x: 36, y: 380, w: 88, h: 88 },
  panel: { x: 36, y: 488, w: 408, h: 80 },
  coin: { x: 330, y: 596, w: 50, h: 16 },
  door: { x: 52, y: 600, w: 120, h: 90 },
});

export const COLORS = Object.freeze({
  body: '#F2A7C3',
  bodyShade: '#E58DB0',
  signBg: '#FFF6E5',
  signText: '#274458',
  glassTop: '#EAF5F8',
  glassBottom: '#D7ECF2',
  floor: '#F7EFE3',
  panel: '#F7C948',
  panelTop: '#FBD96E',
  grab: '#E5484D',
  start: '#3E63DD',
  door: '#8DB8E8',
  line: '#3A3A48',
});

const c = COLORS;
const S = `stroke="${c.line}" stroke-width="3" stroke-linejoin="round"`;

// 바닥 사다리꼴: 투영식(5.2)과 같은 값. 앞 y = 유리 아래 4% 위, 깊이 상승 = 유리 높이 30%, 안쪽 크기 72%.
const g = AREAS.glass;
const floorFront = g.y + g.h * 0.96;
const floorBack = floorFront - g.h * 0.3;
const backHalf = (g.w / 2) * 0.72;
const cx = g.x + g.w / 2;

export function backLayer() {
  return `<svg class="art art-back" viewBox="0 0 480 720" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lcm-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.glassTop}"/><stop offset="1" stop-color="${c.glassBottom}"/></linearGradient>
  </defs>
  <rect x="64" y="690" width="44" height="24" rx="6" fill="${c.bodyShade}" ${S}/>
  <rect x="372" y="690" width="44" height="24" rx="6" fill="${c.bodyShade}" ${S}/>
  <rect x="112" y="68" width="16" height="22" fill="${c.bodyShade}" ${S}/>
  <rect x="352" y="68" width="16" height="22" fill="${c.bodyShade}" ${S}/>
  <rect x="18" y="80" width="444" height="618" rx="26" fill="${c.body}" ${S}/>
  <path d="M432 82 h4 a24 24 0 0 1 24 24 v566 a24 24 0 0 1 -24 24 h-4 z" fill="${c.bodyShade}"/>
  <rect x="18" y="80" width="444" height="618" rx="26" fill="none" ${S}/>
  <rect x="${AREAS.sign.x}" y="${AREAS.sign.y}" width="${AREAS.sign.w}" height="${AREAS.sign.h}" rx="18" fill="${c.signBg}" ${S}/>
  <g fill="${c.grab}" opacity=".85"><circle cx="66" cy="42" r="6"/><circle cx="414" cy="42" r="6"/></g>
  <g fill="${c.panel}"><circle cx="88" cy="42" r="4"/><circle cx="392" cy="42" r="4"/></g>
  <text x="240" y="54" text-anchor="middle" font-family="'Noto Sans KR','Malgun Gothic',system-ui,sans-serif" font-size="34" font-weight="800" fill="${c.signText}" letter-spacing="2">레슨디자이너</text>
  <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="url(#lcm-glass)"/>
  <path d="M${g.x} ${g.y} L${cx - backHalf} ${g.y} L${cx - backHalf} ${floorBack} L${g.x} ${floorFront} Z" fill="#fff" opacity=".22"/>
  <path d="M${g.x + g.w} ${g.y} L${cx + backHalf} ${g.y} L${cx + backHalf} ${floorBack} L${g.x + g.w} ${floorFront} Z" fill="#000" opacity=".04"/>
  <path d="M${g.x} ${floorFront} L${cx - backHalf} ${floorBack} L${cx + backHalf} ${floorBack} L${g.x + g.w} ${floorFront} L${g.x + g.w} ${g.y + g.h} L${g.x} ${g.y + g.h} Z" fill="${c.floor}"/>
  <rect x="18" y="468" width="444" height="20" fill="${c.bodyShade}"/>
  <path d="M${AREAS.panel.x} ${AREAS.panel.y} h${AREAS.panel.w} v${AREAS.panel.h} h-${AREAS.panel.w} z" fill="${c.panel}" ${S}/>
  <rect x="${AREAS.panel.x + 1.5}" y="${AREAS.panel.y + 1.5}" width="${AREAS.panel.w - 3}" height="12" fill="${c.panelTop}"/>
  <ellipse cx="140" cy="538" rx="20" ry="7" fill="#3A3A48" opacity=".9"/>
  <g class="stick" style="transform-origin:140px 538px">
    <rect x="136.5" y="522" width="7" height="16" rx="3" fill="#5B5B6E" ${S}/>
    <circle cx="140" cy="522" r="11" fill="${c.grab}" ${S}/>
    <circle cx="136" cy="518" r="3.5" fill="#fff" opacity=".55"/>
  </g>
  <circle cx="330" cy="528" r="28" fill="${c.grab}" ${S}/>
  <circle cx="405" cy="528" r="22" fill="${c.start}" ${S}/>
  <rect x="300" y="584" width="110" height="40" rx="10" fill="${c.bodyShade}" ${S}/>
  <rect x="${AREAS.coin.x}" y="${AREAS.coin.y}" width="${AREAS.coin.w}" height="${AREAS.coin.h}" rx="5" fill="#C9C9D6" ${S}/>
  <rect x="352" y="599" width="6" height="10" rx="2" fill="${c.line}"/>
  <circle cx="316" cy="604" r="7" fill="${c.panel}" ${S}/>
  <rect x="${AREAS.door.x - 10}" y="${AREAS.door.y - 10}" width="${AREAS.door.w + 20}" height="${AREAS.door.h + 14}" rx="12" fill="${c.bodyShade}" ${S}/>
  <rect x="${AREAS.door.x}" y="${AREAS.door.y}" width="${AREAS.door.w}" height="${AREAS.door.h}" rx="8" fill="#2E2E3C"/>
  <g fill="${c.bodyShade}"><circle cx="300" cy="660" r="5"/><circle cx="320" cy="660" r="5"/><circle cx="340" cy="660" r="5"/><circle cx="360" cy="660" r="5"/><circle cx="380" cy="660" r="5"/><circle cx="400" cy="660" r="5"/></g>
</svg>`;
}

export function frontLayer() {
  return `<svg class="art art-front" viewBox="0 0 480 720" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <path d="M${g.x + 40} ${g.y} L${g.x + 110} ${g.y} L${g.x + 20} ${g.y + g.h} L${g.x} ${g.y + g.h} L${g.x} ${g.y + 120} Z" fill="#fff" opacity=".25"/>
  <path d="M${g.x + 140} ${g.y} L${g.x + 160} ${g.y} L${g.x + 60} ${g.y + g.h} L${g.x + 40} ${g.y + g.h} Z" fill="#fff" opacity=".18"/>
  <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="none" ${S}/>
  <rect x="${g.x - 4}" y="${g.y - 4}" width="${g.w + 8}" height="${g.h + 8}" rx="6" fill="none" stroke="${c.bodyShade}" stroke-width="5"/>
  <circle class="coin" cx="355" cy="560" r="9" fill="${c.panel}" ${S}/>
  <g class="door" style="transform-origin:${AREAS.door.x + AREAS.door.w / 2}px ${AREAS.door.y}px">
    <rect x="${AREAS.door.x}" y="${AREAS.door.y}" width="${AREAS.door.w}" height="${AREAS.door.h}" rx="8" fill="${c.door}" ${S}/>
    <rect x="${AREAS.door.x + 30}" y="${AREAS.door.y + 12}" width="60" height="9" rx="4.5" fill="#fff" opacity=".6"/>
    <path d="M${AREAS.door.x + 44} ${AREAS.door.y + 46} l16 16 l16 -16" fill="none" stroke="${c.line}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}
