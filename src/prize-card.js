// 결과 카드 <dialog> (설계서 8.1). 스토어·앱 실행·외부 페이지로 가는 링크는 두지 않는다.

// 스토어 app.js와 같은 라벨.
export const CATEGORY_LABELS = { learning: '연주·악기 학습', coaches: '운지 코치', tools: '음악 도구', games: '음악 게임' };
export const AUDIENCE_LABELS = { teacher: '교사용', student: '학생용', both: '공용' };

export function cardMeta(app) {
  return [CATEGORY_LABELS[app.category], AUDIENCE_LABELS[app.audience]].filter(Boolean).join(' · ');
}

export function createPrizeCard(dialog, { iconUrl, onClosed }) {
  const icon = dialog.querySelector('.card-icon');
  const title = dialog.querySelector('.card-title');
  const meta = dialog.querySelector('.card-meta');
  const shot = dialog.querySelector('.card-shot');
  const desc = dialog.querySelector('.card-desc');
  let reason = 'close';

  icon.addEventListener('error', () => { icon.hidden = true; });
  shot.addEventListener('error', () => { shot.hidden = true; });
  dialog.querySelector('.card-again').addEventListener('click', () => { reason = 'again'; dialog.close(); });
  for (const button of dialog.querySelectorAll('.card-close')) button.addEventListener('click', () => { reason = 'close'; dialog.close(); });
  // 카드 바깥(배경) 누르기
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) { reason = 'close'; dialog.close(); }
  });
  dialog.addEventListener('cancel', () => { reason = 'close'; });
  dialog.addEventListener('close', () => onClosed(reason));

  return {
    open(app) {
      reason = 'close';
      icon.hidden = false;
      icon.src = iconUrl(app);
      title.textContent = app.name;
      meta.textContent = cardMeta(app);
      if (app.screenshot) {
        shot.hidden = false;
        shot.src = iconUrl({ icon: app.screenshot });
        shot.alt = `${app.name} 화면`;
      } else {
        shot.hidden = true;
        shot.removeAttribute('src');
      }
      desc.textContent = app.description || '';
      if (!dialog.open) dialog.showModal();
      title.focus();
    },
    close() { if (dialog.open) dialog.close(); },
    get isOpen() { return dialog.open; },
  };
}

export const CARD_HTML = `<dialog class="card" aria-labelledby="lcm-card-title">
  <button type="button" class="card-x card-close" aria-label="닫기">✕</button>
  <div class="card-head">
    <img class="card-icon" width="96" height="96" alt="">
    <div>
      <h2 class="card-title" id="lcm-card-title" tabindex="-1"></h2>
      <p class="card-meta"></p>
    </div>
  </div>
  <img class="card-shot" alt="" hidden>
  <p class="card-desc"></p>
  <div class="card-actions">
    <button type="button" class="btn btn-primary card-again">한 번 더 뽑기</button>
    <button type="button" class="btn card-close">닫기</button>
  </div>
</dialog>`;
