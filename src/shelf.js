// 내가 뽑은 앱 선반 (설계서 8.2). sessionStorage에는 앱 ID 목록만 저장한다.
const KEY = 'lesson-claw-machine:shelf';
const MAX = 6;

function readIds(getStorage) {
  try {
    const ids = JSON.parse(getStorage()?.getItem(KEY) || '[]');
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(getStorage, ids) {
  try { getStorage()?.setItem(KEY, JSON.stringify(ids)); } catch { /* 저장이 막혀도 화면은 동작 */ }
}

export function addToShelf(ids, id) {
  return [id, ...ids.filter((other) => other !== id)].slice(0, MAX);
}

export function createShelf(container, { getStorage = () => globalThis.sessionStorage, appsById, iconUrl, onOpen }) {
  const list = container.querySelector('.shelf-list');
  const empty = container.querySelector('.shelf-empty');
  let ids = readIds(getStorage).filter((id) => appsById.has(id)).slice(0, MAX);

  function render() {
    empty.hidden = ids.length > 0;
    list.hidden = ids.length === 0;
    list.replaceChildren(...ids.map((id) => {
      const app = appsById.get(id);
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shelf-item';
      button.setAttribute('aria-label', `${app.name} 소개 다시 보기`);
      const img = document.createElement('img');
      img.src = iconUrl(app);
      img.alt = '';
      img.width = 48;
      img.height = 48;
      img.addEventListener('error', () => img.classList.add('is-broken'));
      const name = document.createElement('span');
      name.textContent = app.name;
      button.append(img, name);
      button.addEventListener('click', () => onOpen(app));
      li.append(button);
      return li;
    }));
  }

  render();
  return {
    add(app) {
      ids = addToShelf(ids, app.id);
      writeIds(getStorage, ids);
      render();
    },
    get ids() { return [...ids]; },
  };
}
