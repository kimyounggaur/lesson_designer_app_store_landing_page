# 인형 뽑기 기계 부품 `<lesson-claw-machine>`

외주 소개 사이트 1면에 태그 하나로 끼워 넣는 독립 부품입니다. 앱스토어 저장소(`kimyounggaur/lesson_designer_app_store`) PR #12에서 만든 부품을 단독 저장소로 옮긴 것입니다. 설계서: 프로젝트 파일 `landing-claw/claw-machine-landing-spec.md` (v1.1).

## 끼워 넣기

```html
<script type="module" src="https://<배포 주소>/claw-machine.js"></script>

<lesson-claw-machine
  apps-src="https://<배포 주소>/apps.json"
  sound="off">
  <!-- 자바스크립트가 꺼져 있거나 앱 목록을 못 불러오면 이 안의 내용(정지 그림, 링크)이 보입니다 -->
</lesson-claw-machine>
```

`<배포 주소>`는 이 저장소를 배포한 곳입니다(아직 배포 전). 모든 파일에 `Access-Control-Allow-Origin: *` 헤더가 붙도록 `vercel.json`에 적어 두었습니다.

기계 높이는 CSS 변수로 정합니다(가로:세로 = 2:3).

```css
lesson-claw-machine { --lcm-machine-height: calc(min(100svh - 64px - 48px, 820px) - 88px); }
```

부품 폭이 600px 이상이면 "내가 뽑은 앱" 선반이 기계 오른쪽에, 그보다 좁으면 기계 아래에 놓입니다.

## 속성

| 속성 | 기본값 | 설명 |
| --- | --- | --- |
| `apps-src` | `./apps.json` | 앱 목록 JSON 주소 |
| `icons-base` | `apps-src`와 같은 폴더의 `icons/` | 아이콘 SVG 폴더 |
| `pit-size` | `28` | 유리창 안 아이콘 수 (12~36) |
| `sound` | `off` | `on`이면 효과음 |
| `seed` | 없음 | 더미 배치 고정(테스트·스크린샷용) |
| `data-time-limit` | `0` | 한 판 시간 제한(초). 0이면 없음 |

## 이벤트 (부품 → 사이트)

| 이벤트 | `detail` | 용도 |
| --- | --- | --- |
| `claw:start` | `{}` | 첫 조작 시 1회 |
| `claw:prize` | `{ appId, name, category }` (목록·무작위로 고르면 `via: 'list' \| 'random'` 추가) | 뽑기 성공 |
| `claw:miss` | `{ streak }` | 실패 |
| `claw:error` | `{ message }` | 앱 목록을 못 불러옴 |

## 조작

- 데스크톱: 조작판 위 버튼(마우스) 또는 키보드(부품에 포커스가 있을 때). ←→ / A D 좌우, ↑↓ / W S 안쪽·앞쪽, 스페이스 잡기, Enter 시작, Esc 포커스 놓기.
- 휴대폰·태블릿(터치 기기 또는 기계 폭 360px 미만): 기계 아래 큰 버튼.
- "목록에서 앱 고르기": 화면 낭독기·키보드 대체 경로. 움직임 줄이기 설정이면 "무작위로 하나 뽑기"도 보입니다.

## 폴더 구성

| 경로 | 내용 |
| --- | --- |
| `claw-machine.js`, `src/`, `styles.css` | 부품 본체(외부 라이브러리 없음) |
| `demo.html` | 단독 확인용 페이지 |
| `catalog/data.json`, `catalog/icons/` | 앱스토어 저장소에서 가져온 앱 목록·아이콘 원본 |
| `scripts/` | 빌드·데이터 생성·카탈로그 동기화 |
| `tests/` | `node --test` 테스트 |

## 개발 (Node 22 이상, 설치할 의존성 없음)

- `npm run build` → `dist/` (부품 파일 + `catalog/data.json`에서 공개 필드만 뽑은 `apps.json` + `icons/`)
- 단독 확인: 빌드 후 `dist/`를 정적 서버로 열고 `demo.html?seed=42`
- 테스트: `npm test`
- 앱 목록 갱신: `npm run sync-catalog -- ../lesson_designer_app_store` (앱스토어 저장소의 `data.json`·`icons/`를 `catalog/`로 복사) 후 빌드
- 더미에서 앱을 빼려면 `scripts/build-data.mjs`의 `LANDING_EXCLUDED_APP_IDS`에 app_id를 한 줄 추가합니다.
