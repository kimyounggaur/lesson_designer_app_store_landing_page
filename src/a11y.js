// 안내 문구(aria-live)와 화면 낭독기·키보드 대체 경로 (설계서 9.1).
import { WORLD } from './world.js';

export function createAnnouncer(region) {
  let timer = 0;
  let last = '';
  return {
    say(text) {
      if (!text) return;
      clearTimeout(timer);
      // 같은 문장을 다시 읽게 하려고 한 번 비운 뒤 채운다.
      region.textContent = '';
      timer = setTimeout(() => { region.textContent = text; last = text; }, 60);
    },
    get last() { return last; },
  };
}

export function describePosition(x, z, name) {
  const horizontal = x < WORLD.X / 3 ? '왼쪽' : x > (WORLD.X * 2) / 3 ? '오른쪽' : '가운데';
  const depth = z < WORLD.Z / 3 ? '앞쪽' : z > (WORLD.Z * 2) / 3 ? '안쪽' : '가운데';
  const where = horizontal === depth ? '한가운데' : `${horizontal}, ${depth}`;
  return `집게 위치: ${where}. ${name ? `아래에 ${name}` : '아래에 아이콘 없음'}`;
}

// "목록에서 앱 고르기": 지금 더미에 있는 앱을 버튼 목록으로 보여준다.
export function renderAltList(list, apps, onPick) {
  list.replaceChildren(...apps.map((app) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = app.name;
    button.addEventListener('click', () => onPick(app));
    li.append(button);
    return li;
  }));
}
