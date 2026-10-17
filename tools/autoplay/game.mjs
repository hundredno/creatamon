// The bot's eyes and hands: what is on screen, and key presses and clicks at a human pace.
// It only reads (the page, and the save the game writes) and only sends input. It never changes game state.
import { CM } from '../../src/world.js';

const SAVE_KEY = 'creatamon-save-v1';
// Milliseconds a step takes on foot and on the bike (WALK_STEP and BIKE_STEP in game.js), plus the frame between steps.
export const STEP_MS = { walk: 150, bike: 83 };

export class Game {
  // turbo: the page runs on Playwright's clock, which the bot moves on itself, as fast as the page can draw.
  constructor(page, { turbo = false, log, rng = Math.random } = {}) {
    Object.assign(this, { page, turbo, log, rng, held: null, last: null, t: 0, t0: Date.now() });
  }
  // Game time gone by, ms: Playwright's clock in turbo, the wall clock otherwise.
  clock() { return this.turbo ? this.t : Date.now() - this.t0; }

  // ---- Time ----
  async wait(ms) {
    if (ms <= 0) return;
    if (this.turbo) { this.t += Math.round(ms); await this.page.clock.runFor(Math.round(ms)); }
    else await new Promise((r) => setTimeout(r, ms));
  }
  // A pause of between a and b ms, like a person taking a moment.
  think(a = 150, b = 450) { return this.wait(a + this.rng() * (b - a)); }
  // Polls until fn(snapshot) is truthy or `ms` of game time has gone by. Resolves to the snapshot, or null.
  async until(fn, ms = 3000, every = 16) {
    for (let t = 0; t <= ms; t += every) {
      const s = await this.look();
      if (fn(s)) return s;
      await this.wait(every);
    }
    return null;
  }

  // ---- Eyes ----
  // Everything the bot needs from one glance at the page, plus the save.
  async look() {
    const s = await this.page.evaluate((key) => {
      const $ = (id) => document.getElementById(id);
      const shown = (el) => !!el && !el.hidden;
      const text = (el) => (el ? el.textContent.trim() : '');
      const data = (el) => ({ ...el.dataset });
      const menu = $('menu'), actions = $('actions'), battle = $('battle'), dialog = $('dialog');
      let save = null;
      try { save = JSON.parse(localStorage.getItem(key)); } catch (e) { /* none yet */ }
      return {
        title: shown($('title')),
        dialog: shown(dialog) ? text(dialog) : null,
        menu: shown(menu) ? { cls: menu.className, head: text(menu.querySelector('header h2')) } : null,
        actions: shown(actions) ? {
          cls: actions.className,
          prompt: text(actions.querySelector('.prompt, .ask p')),
          buttons: [...actions.querySelectorAll('button')].map((b) => ({ text: text(b), disabled: b.disabled, ...data(b), name: text(b.querySelector('b')), desc: text(b.querySelector('small')) })),
        } : null,
        battle: shown(battle) ? {
          cls: battle.className,
          foeName: text($('foeName')), foeLv: text($('foeLv')), foeHp: parseFloat($('foeBar').style.width) / 100,
          foeMax: $('foeSprite').classList.contains('max'), foeAlpha: $('foeSprite').classList.contains('alpha'),
          meName: text($('meName')), meLv: text($('meLv')), meHp: text($('meHp')).split('/').map((v) => parseInt(v, 10)),
        } : null,
        save,
      };
    }, SAVE_KEY);
    s.screen = s.title ? 'title' : s.actions ? 'choice' : s.dialog != null ? 'dialog' : s.menu ? 'menu' : s.battle ? 'battle' : 'world';
    this.last = s;
    return s;
  }

  // ---- Hands ----
  async down(key) { if (this.held && this.held !== key) await this.up(); this.held = key; this.input('down', key); await this.page.keyboard.down(key); }
  async up() { if (!this.held) return; const key = this.held; this.held = null; this.input('up', key); await this.page.keyboard.up(key); }
  async press(key) { this.input('press', key); await this.page.keyboard.press(key); }
  async click(selector) {
    this.input('click', selector);
    const el = this.page.locator(selector).first();
    // Some buttons never sit still (Evolve! bobs up and down): a person clicks them anyway.
    try { await el.click({ timeout: 1500 }); } catch (e) { await el.click({ timeout: 4000, force: true }); }
  }
  async type(selector, text) {
    this.input('type', selector, text);
    const box = this.page.locator(selector).first();
    await box.click();
    await box.fill('');
    await this.page.keyboard.type(text, { delay: this.turbo ? 0 : 60 + this.rng() * 60 });
  }
  async choose(selector, value) { this.input('select', selector, value); await this.page.locator(selector).first().selectOption(value); }
  input(kind, what, value) { if (this.log) this.log.input(kind, what, value); }

  // Alphas the minimap shows (red dots with a white rim; the goal marker is yellow inside), as world tiles.
  // The minimap is 46 tiles across, centred on the player (drawMap in game.js).
  async alphasOnMap(S) {
    const dots = await this.page.evaluate(() => {
      const cv = document.getElementById('minimap'), g = cv.getContext('2d'), { width: w, height: h } = cv;
      const d = g.getImageData(0, 0, w, h).data, red = (x, y) => { const i = (y * w + x) * 4; return d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 110; };
      const yellow = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return false; const i = (y * w + x) * 4; return d[i] > 230 && d[i + 1] > 180 && d[i + 2] < 120; };
      const out = [], used = new Set();
      for (let y = 2; y < h - 2; y++) {
        for (let x = 2; x < w - 2; x++) {
          if (used.has(y * w + x) || !red(x, y) || !red(x - 1, y) || !red(x + 1, y) || !red(x, y - 1) || !red(x, y + 1)) continue;
          // The goal marker is a red ring around yellow: not an alpha.
          let ring = false;
          for (let j = -6; j <= 6 && !ring; j++) for (let i = -6; i <= 6 && !ring; i++) ring = yellow(x + i, y + j);
          if (ring) continue;
          for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) used.add((y + j) * w + x + i);
          out.push([x + 0.5, y + 1]);
        }
      }
      return { dots: out, w, h };
    });
    const MW = CM.MAPS.world.rows[0].length, MH = CM.MAPS.world.rows.length, span = 46, k = dots.w / span, rows = dots.h / k;
    if (S.map !== 'world') return [];
    const x0 = Math.max(0, Math.min(MW - span, S.x + 0.5 - span / 2)), y0 = Math.max(0, Math.min(MH - rows, S.y + 0.5 - rows / 2));
    return dots.dots.map(([cx, cy]) => ({ x: Math.round(cx / k + x0 - 0.5), y: Math.round(cy / k + y0 - 0.5) }));
  }
  // The tile the bot is on (from the save, which the game writes after every step).
  where(s = this.last) { return s && s.save ? { map: s.save.map, x: s.save.x, y: s.save.y } : null; }
}

// Our Creatamon, as the game would show them on the party page.
export const party = (S) => (S ? S.party : []);
export const maxHp = (c) => CM.maxHp(c);
export const capOf = (S) => CM.levelCap(CM.badgeCount(S));
