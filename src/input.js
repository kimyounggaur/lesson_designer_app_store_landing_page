// 키보드, 포인터, 터치 입력 → left/right/back/front(누르는 동안) + grab/start(한 번) 명령 (설계서 6.2, 6.3).

const KEY_DIRECTIONS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'back', KeyW: 'back',
  ArrowDown: 'front', KeyS: 'front',
};

export function directionFromKey(event) {
  return KEY_DIRECTIONS[event.code] || KEY_DIRECTIONS[event.key] || null;
}

export function createInput({ root, ignore = () => false, onCommand = () => {}, onChange = () => {} }) {
  const keys = new Set();
  const pointers = new Map(); // pointerId → direction

  const held = () => {
    const set = new Set(keys);
    for (const direction of pointers.values()) set.add(direction);
    return set;
  };

  const vector = () => {
    const set = held();
    return {
      dx: (set.has('right') ? 1 : 0) - (set.has('left') ? 1 : 0),
      dz: (set.has('back') ? 1 : 0) - (set.has('front') ? 1 : 0),
    };
  };

  const changed = () => onChange(vector(), held());

  function onKeyDown(event) {
    if (event.defaultPrevented || ignore(event)) return;
    const direction = directionFromKey(event);
    const origin = event.composedPath()[0];
    // 조작 버튼(방향·잡기·시작) 위에서도 스페이스 = 잡기, 엔터 = 시작. 다른 버튼(목록, 선반)은 브라우저가 누른 것으로 처리.
    const onButton = origin?.tagName === 'BUTTON' && !origin.dataset?.dir && !origin.dataset?.action;
    if (direction) {
      event.preventDefault();
      if (!keys.has(direction)) { keys.add(direction); changed(); }
      onCommand('move');
      return;
    }
    if (event.code === 'Space' || event.key === ' ') {
      if (onButton) return; // 버튼 위에서는 브라우저가 그 버튼을 누른 것으로 처리한다
      event.preventDefault();
      if (!event.repeat) onCommand('grab');
      return;
    }
    if (event.key === 'Enter') {
      if (onButton) return;
      event.preventDefault();
      onCommand('start');
      return;
    }
    if (event.key === 'Escape') {
      release();
      onCommand('blur');
    }
  }

  function onKeyUp(event) {
    const direction = directionFromKey(event);
    if (direction && keys.delete(direction)) changed();
  }

  function release() {
    if (!keys.size && !pointers.size) return;
    keys.clear();
    pointers.clear();
    changed();
  }

  // 방향 버튼: pointerdown에서 시작, pointerup/cancel/leave에서 멈춤.
  function bindDirectionButton(button, direction) {
    const stop = (event) => {
      if (pointers.delete(event.pointerId)) {
        button.classList.remove('is-pressed');
        changed();
      }
    };
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      pointers.set(event.pointerId, direction);
      button.classList.add('is-pressed');
      onCommand('move');
      changed();
    });
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('pointerleave', stop);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('keyup', onKeyUp);
  root.addEventListener('focusout', (event) => {
    if (!event.relatedTarget || !root.contains(event.relatedTarget)) release();
  });

  return { vector, held, release, bindDirectionButton };
}
