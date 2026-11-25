// <lesson-claw-machine>: Shadow DOM, 속성, 생명주기, 크기 대응, 게임 루프 (설계서 3장).
import { backLayer, frontLayer } from './machine-art.js';
import { createWorld, stepWorld, isAnimating, removeItem, refill, settleAll, topItemAt } from './world.js';
import { createClaw, startGame, grab, updateClaw, finishPrize, isLocked, isIdle } from './claw.js';
import { render, fallbackTile, tileSizeFor } from './renderer.js';
import { createInput } from './input.js';
import { createPrizeCard, CARD_HTML } from './prize-card.js';
import { createShelf } from './shelf.js';
import { createAnnouncer, describePosition, renderAltList } from './a11y.js';
import { mulberry32, toSeed } from './rng.js';
import { playSound } from './sound.js';

const STYLES_URL = new URL('../styles.css', import.meta.url).href;
const LABEL = '인형 뽑기 기계: 앱 아이콘을 뽑아 앱을 알아보세요';

const dirButtons = (prefix) => `
  <button type="button" class="dir dir-back ${prefix}" data-dir="back"><span aria-hidden="true">▲</span> 안쪽</button>
  <button type="button" class="dir dir-left ${prefix}" data-dir="left"><span aria-hidden="true">◀</span> 왼쪽</button>
  <button type="button" class="dir dir-right ${prefix}" data-dir="right"><span aria-hidden="true">▶</span> 오른쪽</button>
  <button type="button" class="dir dir-front ${prefix}" data-dir="front"><span aria-hidden="true">▼</span> 앞쪽</button>`;

const TEMPLATE = `
<div class="root" role="group" aria-label="${LABEL}" tabindex="0" data-state="loading">
  <div class="layout wide-grid">
  <div class="machine">
    ${backLayer()}
    <canvas class="pit" aria-hidden="true"></canvas>
    ${frontLayer()}
    <p class="banner" aria-hidden="true"></p>
    <img class="pop" alt="" aria-hidden="true">
    <div class="coin-hit" aria-hidden="true"></div>
    <div class="panel-controls">
      ${dirButtons('on-panel')}
      <button type="button" class="action grab on-panel" data-action="grab"><span class="chip">잡기</span></button>
      <button type="button" class="action start on-panel" data-action="start"><span class="chip">시작</span></button>
    </div>
  </div>
  <p class="guide" aria-hidden="true"></p>
  <div class="touch-controls">
    <div class="dpad">${dirButtons('on-touch')}</div>
    <div class="touch-actions">
      <button type="button" class="action grab" data-action="grab"><span class="chip">잡기</span></button>
      <button type="button" class="action start" data-action="start"><span class="chip">시작</span></button>
    </div>
  </div>
  <div class="side">
  <div class="extras">
    <button type="button" class="link-btn alt-toggle" aria-expanded="false" aria-controls="lcm-alt">목록에서 앱 고르기</button>
    <button type="button" class="link-btn random-pick" hidden>무작위로 하나 뽑기</button>
  </div>
  <div class="alt" id="lcm-alt" hidden>
    <p class="alt-title">지금 기계 안에 있는 앱이에요. 고르면 소개 카드가 열려요.</p>
    <ul class="alt-list"></ul>
  </div>
  <section class="shelf" aria-labelledby="lcm-shelf-title">
    <h2 class="shelf-title" id="lcm-shelf-title">내가 뽑은 앱</h2>
    <p class="shelf-empty">뽑은 앱이 여기에 모여요</p>
    <ul class="shelf-list" hidden></ul>
  </section>
  </div>
  </div>
  <div class="fallback" hidden><slot></slot><p class="fallback-msg">앱 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p></div>
  <p class="sr-only" aria-live="polite"></p>
  ${CARD_HTML}
</div>`;

const GUIDE = {
  attract: '시작을 눌러 보세요',
  dropping: '집게가 내려가요…',
  closing: '집게를 오므려요…',
  lifting: '집게가 올라가요…',
  returning: '배출구로 돌아가요…',
  releasing: '집게를 벌려요…',
  miss: '아깝네요! 다시 해 보세요',
};

function parsePitSize(value) {
  const number = Number.parseInt(value ?? '28', 10);
  return Number.isFinite(number) ? Math.min(36, Math.max(12, number)) : 28;
}

function reducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export class LessonClawMachine extends HTMLElement {
  static observedAttributes = ['apps-src', 'icons-base', 'pit-size', 'sound', 'seed'];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLES_URL;
    shadow.append(link);
    const template = document.createElement('template');
    template.innerHTML = TEMPLATE;
    shadow.append(template.content);
    this.$ = (selector) => shadow.querySelector(selector);
    this.$$ = (selector) => [...shadow.querySelectorAll(selector)];
    this.root = this.$('.root');
    this.canvas = this.$('.pit');
    this.ctx = this.canvas.getContext('2d');
    this.view = { w: 0, h: 0 };
    this.dpr = 1;
    this.images = new Map(); // appId → HTMLImageElement | null(실패)
    this.tiles = new Map(); // appId → canvas
    this.tilePx = 0;
    this.frame = 0;
    this.visible = true;
    this.loadToken = 0;
    this.started = false;
    this.lastGuide = '';
    this.tile = (app) => this.getTile(app);
  }

  connectedCallback() {
    this.announcer ||= createAnnouncer(this.$('.sr-only'));
    if (!this.wired) this.wire();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resizeObserver.observe(this.root);
    this.intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting && entry.intersectionRatio >= 0.3;
      this.wake();
    }, { threshold: [0, 0.3, 0.6] });
    this.intersection.observe(this);
    this.onVisibility = () => { if (document.hidden) this.input.release(); this.wake(); };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.onMotion = () => this.applyMotion();
    this.motionQuery?.addEventListener?.('change', this.onMotion);
    this.pointerQuery = globalThis.matchMedia?.('(pointer: coarse)');
    this.onPointer = () => this.updateMode();
    this.pointerQuery?.addEventListener?.('change', this.onPointer);
    if (!this.world) this.load();
    else this.wake();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver?.disconnect();
    this.intersection?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motionQuery?.removeEventListener?.('change', this.onMotion);
    this.pointerQuery?.removeEventListener?.('change', this.onPointer);
  }

  attributeChangedCallback(name, before, after) {
    if (before === after || name === 'sound' || !this.isConnected || !this.world) return;
    this.world = null;
    this.load();
  }

  get soundOn() { return this.getAttribute('sound') === 'on'; }

  // ---- 화면 연결 ---------------------------------------------------------
  wire() {
    this.wired = true;
    this.input = createInput({
      root: this.root,
      ignore: (event) => event.composedPath().some((node) => node.classList?.contains('card') || node.classList?.contains('alt')),
      onCommand: (command) => this.command(command),
      onChange: (vector) => { this.tiltStick(vector); this.wake(); },
    });
    for (const button of this.$$('[data-dir]')) this.input.bindDirectionButton(button, button.dataset.dir);
    for (const button of this.$$('[data-action]')) button.addEventListener('click', () => this.command(button.dataset.action));
    this.$('.coin-hit').addEventListener('click', () => this.command('start'));
    this.root.addEventListener('pointerdown', (event) => {
      const path = event.composedPath();
      if (path.some((node) => node.classList?.contains('machine') || node.classList?.contains('touch-controls'))) {
        if (!path.some((node) => node.tagName === 'BUTTON')) this.root.focus({ preventScroll: true });
      }
    });
    this.$('.alt-toggle').addEventListener('click', () => this.toggleAlt());
    this.$('.random-pick').addEventListener('click', () => {
      const items = this.world?.items.filter((item) => item.state === 'settled') || [];
      if (items.length) this.pick(items[Math.floor(Math.random() * items.length)].app, 'random');
    });
    this.card = createPrizeCard(this.$('.card'), {
      iconUrl: (app) => this.iconUrl(app),
      onClosed: (reason) => this.cardClosed(reason),
    });
  }

  updateMode() {
    const machineWidth = this.$('.machine').getBoundingClientRect().width;
    const touch = Boolean(this.pointerQuery?.matches) || (machineWidth > 0 && machineWidth < 360);
    this.root.classList.toggle('touch-mode', touch);
  }

  applyMotion() {
    this.reduced = reducedMotion();
    this.root.classList.toggle('reduced', this.reduced);
    this.$('.random-pick').hidden = !this.reduced;
    if (this.reduced && this.world) settleAll(this.world);
    this.wake();
  }

  // ---- 데이터와 아이콘 -----------------------------------------------------
  appsUrl() {
    return new URL(this.getAttribute('apps-src') || './apps.json', document.baseURI);
  }

  iconsBase() {
    const attr = this.getAttribute('icons-base');
    if (attr) return new URL(attr.endsWith('/') ? attr : `${attr}/`, document.baseURI);
    return new URL('icons/', this.appsUrl());
  }

  iconUrl(app) {
    return new URL(app.icon, this.iconsBase()).href;
  }

  async load() {
    const token = ++this.loadToken;
    this.root.dataset.state = 'loading';
    this.applyMotion();
    try {
      const response = await fetch(this.appsUrl());
      if (!response.ok) throw new Error(`apps.json ${response.status}`);
      const data = await response.json();
      const apps = (Array.isArray(data) ? data : data.apps || []).filter((app) => app && app.id && app.name && app.icon);
      if (!apps.length) throw new Error('앱 목록이 비어 있음');
      if (token !== this.loadToken) return;
      this.apps = apps;
      this.appsById = new Map(apps.map((app) => [app.id, app]));
      const seedAttr = this.getAttribute('seed');
      this.seed = toSeed(seedAttr);
      this.rng = mulberry32(this.seed ^ 0x9e3779b9);
      const world = createWorld({ apps, size: parsePitSize(this.getAttribute('pit-size')), seed: this.seed, intro: !this.reduced });
      await Promise.all(world.items.map((item) => this.loadImage(item.app)));
      if (token !== this.loadToken) return;
      this.world = world;
      this.claw = createClaw({ timeLimit: Number(this.dataset.timeLimit) || 0 });
      this.shelf = createShelf(this.$('.shelf'), {
        appsById: this.appsById,
        iconUrl: (app) => this.iconUrl(app),
        onOpen: (app) => this.openCard(app),
      });
      this.root.dataset.state = 'ready';
      this.resize();
      this.updateGuide(true);
      this.wake();
    } catch (error) {
      if (token !== this.loadToken) return;
      this.root.dataset.state = 'error';
      this.$('.fallback').hidden = false;
      this.root.classList.toggle('has-fallback', this.$('slot').assignedNodes().some((node) => node.nodeType === 1 || node.textContent.trim()));
      this.dispatchEvent(new CustomEvent('claw:error', { detail: { message: String(error?.message || error) }, bubbles: true, composed: true }));
    }
  }

  loadImage(app) {
    if (this.images.has(app.id)) return Promise.resolve(this.images.get(app.id));
    const img = new Image();
    img.decoding = 'async';
    const done = new Promise((resolve) => {
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    }).then((result) => {
      this.images.set(app.id, result);
      this.tiles.delete(app.id);
      return result;
    });
    this.images.set(app.id, undefined);
    img.src = this.iconUrl(app);
    this.pendingImages ||= new Map();
    this.pendingImages.set(app.id, done);
    return done;
  }

  preloadRest() {
    if (this.preloaded) return;
    this.preloaded = true;
    for (const app of this.apps) if (!this.images.has(app.id)) this.loadImage(app);
  }

  getTile(app) {
    let tile = this.tiles.get(app.id);
    if (tile) return tile;
    const size = this.tilePx || 128;
    const img = this.images.get(app.id);
    if (img === undefined) return null; // 아직 불러오는 중
    if (img === null) {
      tile = fallbackTile(app, size);
    } else {
      tile = document.createElement('canvas');
      tile.width = size;
      tile.height = size;
      try { tile.getContext('2d').drawImage(img, 0, 0, size, size); } catch { tile = fallbackTile(app, size); }
    }
    this.tiles.set(app.id, tile);
    return tile;
  }

  // ---- 크기 ---------------------------------------------------------------
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.updateMode();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.view = { w: rect.width, h: rect.height };
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    const needed = Math.min(192, Math.ceil((tileSizeFor(this.view) * this.dpr) / 16) * 16);
    if (Math.abs(needed - this.tilePx) > this.tilePx * 0.2) {
      this.tilePx = needed;
      this.tiles.clear();
    }
    this.dirty = true;
    this.wake();
  }

  // ---- 루프 ---------------------------------------------------------------
  wake() {
    if (this.frame || !this.world || !this.isConnected) return;
    if (!this.visible || document.hidden) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame((now) => this.tick(now));
  }

  tick(now) {
    this.frame = 0;
    if (!this.world || !this.visible || document.hidden) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const { world, claw } = this;
    const input = isLocked(claw) || this.card.isOpen ? { dx: 0, dz: 0 } : this.input.vector();
    const frozen = this.reduced && claw.state === 'attract';
    const events = frozen ? [] : updateClaw(claw, world, input, dt, this.rng);
    if (this.reduced) { claw.sway = 0; claw.swayV = 0; }
    stepWorld(world, dt);
    for (const event of events) this.handle(event);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const target = render(this.ctx, this.view, world, claw, this.tile);
    this.target = target?.item || null;
    this.updateGuide();
    const busy = !isIdle(claw) || isAnimating(world) || this.input.vector().dx || this.input.vector().dz;
    if (busy || this.dirty) {
      this.dirty = false;
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }
  }

  // ---- 명령과 이벤트 ---------------------------------------------------------
  command(command) {
    if (!this.world || this.card.isOpen) return;
    const { claw } = this;
    if (command === 'blur') { this.root.blur(); return; }
    if (!this.started && command !== 'blur') {
      this.started = true;
      this.emit('claw:start', {});
    }
    if (claw.state === 'attract' && (command === 'start' || command === 'move' || command === 'grab')) {
      startGame(claw);
      this.root.classList.remove('coin-drop');
      void this.root.offsetWidth;
      this.root.classList.add('coin-drop');
      if (this.soundOn) playSound('coin');
      this.announcer.say('동전을 넣었어요. 방향키로 집게를 움직이고 스페이스로 잡아요.');
    } else if (command === 'grab') {
      const events = grab(claw, this.world, this.rng, { quick: this.reduced });
      events.forEach((event) => this.handle(event));
    }
    this.wake();
  }

  handle(event) {
    const { claw } = this;
    switch (event.type) {
      case 'grab':
        try { navigator.vibrate?.(20); } catch { /* 진동 없음 */ }
        if (this.soundOn) playSound('grab');
        break;
      case 'state':
        if (event.from === 'moving' && event.to === 'ready') {
          const hit = topItemAt(this.world, claw.x, claw.z);
          this.announcer.say(describePosition(claw.x, claw.z, hit?.item.app.name));
        }
        if (event.to === 'attract') this.announcer.say('시작을 눌러 보세요.');
        break;
      case 'slip':
        this.showBanner('앗, 미끄러졌어요!');
        break;
      case 'miss':
        this.showBanner('아깝네요!');
        this.announcer.say('놓쳤어요. 다시 해 보세요.');
        this.emit('claw:miss', { streak: event.streak });
        break;
      case 'assist':
        setTimeout(() => {
          this.showBanner('이번엔 집게가 꽉 잡아요!', 2200);
          this.announcer.say('이번엔 집게가 꽉 잡아요!');
        }, 1300);
        break;
      case 'prize':
        this.prize(event.item);
        break;
      default:
        break;
    }
  }

  prize(item) {
    const { app } = item;
    removeItem(this.world, item);
    this.shelf.add(app);
    if (this.soundOn) playSound('prize');
    this.announcer.say(`잡았어요! ${app.name}`);
    this.emit('claw:prize', { appId: app.id, name: app.name, category: app.category });
    this.refillOne();
    this.preloadRest();
    if (this.reduced) { this.openCard(app); return; }
    const pop = this.$('.pop');
    pop.src = this.iconUrl(app);
    this.root.classList.remove('door-open');
    void this.root.offsetWidth;
    this.root.classList.add('door-open');
    clearTimeout(this.popTimer);
    this.popTimer = setTimeout(() => {
      this.root.classList.remove('door-open');
      this.openCard(app);
    }, 700);
  }

  refillOne() {
    const item = refill(this.world);
    if (!item) return;
    if (this.reduced) { item.y = 0; item.state = 'falling'; }
    const ready = this.images.get(item.app.id);
    if (ready === undefined || !this.images.has(item.app.id)) {
      item.delay = Infinity;
      (this.pendingImages?.get(item.app.id) || this.loadImage(item.app)).then(() => {
        item.delay = 0;
        if (this.reduced) settleAll(this.world);
        this.wake();
      });
    } else if (this.reduced) {
      settleAll(this.world);
    }
  }

  pick(app, via) {
    this.shelf.add(app);
    this.emit('claw:prize', { appId: app.id, name: app.name, category: app.category, via });
    this.openCard(app);
  }

  openCard(app) {
    this.card.open(app);
  }

  cardClosed() {
    finishPrize(this.claw);
    this.root.focus({ preventScroll: true });
    this.dirty = true;
    this.wake();
  }

  toggleAlt() {
    const panel = this.$('.alt');
    const toggle = this.$('.alt-toggle');
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      const seen = new Set();
      const apps = this.world.items
        .filter((item) => item.state !== 'chute' && item.delay !== Infinity)
        .map((item) => item.app)
        .filter((app) => !seen.has(app.id) && seen.add(app.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      renderAltList(this.$('.alt-list'), apps, (app) => this.pick(app, 'list'));
      this.$('.alt-list button')?.focus();
    }
  }

  showBanner(text, ms = 1200) {
    const banner = this.$('.banner');
    banner.textContent = text;
    banner.classList.add('is-on');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => banner.classList.remove('is-on'), ms);
  }

  tiltStick({ dx, dz }) {
    const stick = this.$('.stick');
    if (stick) stick.style.transform = `rotate(${dx * 12}deg) translateY(${-dz * 2}px)`;
  }

  updateGuide(force = false) {
    const { claw } = this;
    if (!claw) return;
    let text = GUIDE[claw.state] || '';
    if (claw.state === 'ready' || claw.state === 'moving') {
      if (claw.homing) text = '집게가 제자리로 가요…';
      else {
        const name = this.target?.app.name;
        text = name ? `지금 위치: ${name}` : '집게를 아이콘 위로 옮겨 보세요';
        if (claw.assist) text = `이번엔 집게가 꽉 잡아요! ${text}`;
      }
    }
    if (claw.state === 'prize') text = '잡았어요!';
    if (force || text !== this.lastGuide) {
      this.lastGuide = text;
      this.$('.guide').textContent = text;
      this.root.dataset.claw = claw.state;
    }
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}
