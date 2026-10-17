// The player: looks at the screen, decides, and acts, one moment at a time.
import { CM } from '../../src/world.js';
import { routeTo, search, besideOf, facing, keyOf, isGrass, npcAt, nodeKey, isDone } from './nav.mjs';
import { solvePuzzle } from './puzzles.mjs';
import { BattleBrain, moveOf } from './battle.mjs';
import { nextChange, forge, openMenu, closeMenu } from './team.mjs';
import { nextGoal, placeOf, foeLevel } from './story.mjs';

const { MAPS, CHESTS, CARDS, ITEMS } = CM;
// What a pick-up is worth, as the extra travel (ms) the bot will make to fetch it.
const worth = (c) => (c.card ? (CARDS[c.card].kind === 'hp' ? CARDS[c.card].amount * 60 : [0, 6000, 12000, 25000, 40000, 60000][CARDS[c.card].tier])
  : c.item ? ({ creataball: 20000, potion: 4000, super_potion: 7000, max_potion: 12000, revive: 9000 }[c.item] || 30000) : 2500);

// A line's kind, for knowing when it has been read before: its first words, numbers left out.
const shapeOf = (text) => text.toLowerCase().replace(/[0-9]+/g, '#').split(/\s+/).slice(0, 4).join(' ');

export class Brain {
  constructor(game, log, opts = {}) {
    Object.assign(this, { game, log, opts });
    this.P = {};              // puzzle states of the gym the bot is in, tracked move by move
    this.map = null;
    this.line = null;         // the dialog line on screen, and when it appeared
    this.lineAt = 0;
    this.presses = 0;
    this.battle = null;
    this.plan = null;         // what the bot chose on the battle's command screen
    this.noTalk = new Set();  // people who would not move out of the way, by id and story state
    this.lastSig = null;
    this.idleSince = 0;
    this.focus = null;        // what the bot is doing in the world: for the log and the video
    this.patrol = 0;
    this.shapes = new Map();  // how often each kind of line has been read
  }

  get clock() { return this.game.clock(); }
  wait(ms) { return this.game.wait(ms); }

  // ---- One moment ----
  async step() {
    const s = await this.game.look();
    this.watch(s);
    if (s.screen === 'title') return this.title(s);
    if (s.screen === 'choice') return this.choice(s);
    if (s.screen === 'dialog') return this.dialog(s);
    if (s.screen === 'menu') return this.menu(s);
    if (s.screen === 'battle') return this.wait(60);
    if (this.battle) this.endBattle(s);
    return this.world(s);
  }

  // Notices the map changing and progress stalling.
  watch(s) {
    const S = s.save;
    if (S && S.map !== this.map) {
      this.map = S.map;
      this.P = MAPS[S.map].puzzle ? { [S.map]: CM.initPuzzle(S.map, isDone(S, S.map)) } : {};
      this.log.event('map', { map: S.map, x: S.x, y: S.y });
    }
    const sig = JSON.stringify([s.screen, s.dialog, S && [S.map, S.x, S.y, S.stats.wins, Object.keys(S.f).length, S.money]]);
    if (sig !== this.lastSig) { this.lastSig = sig; this.idleSince = this.clock; }
    if (this.clock - this.idleSince > 90000) {
      this.idleSince = this.clock;
      this.log.event('stuck', { screen: s.screen, dialog: s.dialog, at: S && [S.map, S.x, S.y], focus: this.focus });
      this.stuck = (this.stuck || 0) + 1;
    }
  }

  // ---- Title and the character ----
  async title(s) {
    await this.game.think(800, 1400);
    if (s.save && this.opts.resume) await this.game.click('#btnContinue');
    else await this.game.click('#btnNew');
    await this.wait(600);
  }
  async character() {
    const g = this.game;
    this.log.event('character', {});
    for (const [sel, pause] of [['[data-w="gender"][data-v="girl"]', 500], ['[data-w="hairStyle"][data-v="ponytail"]', 400],
      ['[data-w="hair"][data-v="#f47a45"]', 400], ['[data-w="topColor"][data-v="#55a8ee"]', 400], ['[data-w="bottomColor"][data-v="#2c2c3c"]', 400]]) {
      await g.click(`#menu ${sel}`);
      await g.think(pause, pause * 2);
    }
    await g.type('#pname', this.opts.name || 'Robin');
    await g.think(600, 1000);
    await g.click('#menu [data-a="save"]');
    await this.wait(500);
  }

  // ---- Text ----
  async dialog(s) {
    const text = s.dialog;
    const inBattle = !!s.battle;
    if (text !== this.line) {
      this.line = text;
      this.lineAt = this.clock;
      this.presses = 0;
      this.shapes.set(shapeOf(text), (this.shapes.get(shapeOf(text)) || 0) + 1);
      this.hear(text, s);
    }
    // Long enough to read a new line; battle chatter goes quicker, and a kind of line seen many times before is skimmed.
    const known = (this.shapes.get(shapeOf(text)) || 0) > 2;
    const read = known ? 450 + (text.length % 5) * 60 : inBattle ? 350 + Math.min(900, text.length * 12) : Math.min(4200, Math.max(1100, text.length * 55));
    const left = this.lineAt + read + this.presses * 400 - this.clock;
    if (left > 0) return this.wait(Math.min(left, 120));
    this.presses++;
    await this.game.press('Enter');
    await this.wait(80);
  }
  // What the bot learns from a line of text.
  hear(text, s) {
    this.log.line(text);
    if (this.battle) this.battle.hear(text);
    const kind = / wants to battle!$/.test(text) ? 'trainer' : /caught you! It roars/.test(text) ? 'alpha' : / looms over you!$/.test(text) ? 'boss'
      : /^A shape in the fog/.test(text) ? 'phantom' : /appeared!/.test(text) ? 'wild' : null;
    if (kind && !this.battle) {
      this.battle = new BattleBrain(kind, { training: this.focus === 'train' || this.focus === 'alphas' });
      this.battleAt = this.clock;
      this.log.event('battle', { type: kind, line: text, at: s.save && [s.save.map, s.save.x, s.save.y] });
    }
    if (kind === 'alpha' && this.battle) this.battle.kind = 'alpha';
    if (/^All your Creatamon fainted/.test(text)) {
      this.log.event('whiteout', { focus: this.focus });
      this.P = {};
      this.map = null;
    }
    if (/^You received the (\w+) Badge/.test(text)) this.log.event('badge', { el: RegExp.$1 });
    if (/^Your Champion rank rose to (.+)!$/.test(text)) this.log.event('rank', { title: RegExp.$1 });
    if (/ grew to level (\d+)!$/.test(text)) this.log.event('level', { line: text });
    if (/^You got a .*Power Card/.test(text)) this.log.event('card', { line: text });
  }
  endBattle(s) {
    const S = s.save;
    this.log.event('battle_end', { type: this.battle.kind, ms: this.clock - this.battleAt, wins: S && S.stats.wins });
    this.battle = null;
    this.plan = null;
  }

  // ---- Choices (battle commands, party, items, quiz) ----
  async choice(s) {
    const S = s.save, b = s.actions.buttons;
    const pressAt = async (i) => {
      await this.game.think(250, 600);
      if (i < 9) await this.game.press(String(i + 1));
      else await this.game.click(`#actions button >> nth=${i}`);
      await this.wait(100);
    };
    const back = () => b.findIndex((x) => x.back);
    if (b.some((x) => x.pick)) {
      // The Normal gym's quiz: which element is super-effective against the one asked about.
      const target = /hits (\w+) Creatamon/.exec(s.actions.prompt);
      const i = b.findIndex((x) => target && CM.STRONG[x.pick].includes(target[1]));
      this.log.event('quiz', { prompt: s.actions.prompt, answer: b[i] && b[i].pick });
      return pressAt(Math.max(0, i));
    }
    if (!s.battle) return pressAt(Math.max(0, back()));
    if (!this.battle) this.battle = new BattleBrain('wild', { training: this.focus === 'train' });
    if (b.some((x) => x.act)) {
      this.plan = this.battle.command(s, S);
      if (this.plan.act === 'fight' && !b.some((x) => x.act === 'fight')) this.plan = { act: 'fight' };
      return pressAt(b.findIndex((x) => x.act === this.plan.act));
    }
    if (b.some((x) => x.move != null)) {
      const want = this.plan && this.plan.move && this.plan.move.name;
      let i = b.findIndex((x) => x.move != null && x.name === want);
      if (i < 0) {
        // Max Mode moves have their own names: take the hardest hitter against this foe.
        const foe = this.battle.foe(s), me = this.battle.me(s, S);
        const rate = (x) => { const m = moveOf(x); return m.power ? this.battle.share(m, me, foe) : 0; };
        i = b.reduce((bi, x, k) => (x.move != null && (bi < 0 || rate(x) > rate(b[bi])) ? k : bi), -1);
      }
      this.plan = null;
      return pressAt(i);
    }
    if (b.some((x) => x.id)) {
      const i = b.findIndex((x) => this.plan && x.id === this.plan.item);
      return pressAt(i >= 0 ? i : back());
    }
    if (b.some((x) => x.idx != null)) {
      if (this.plan && this.plan.act === 'bag') {
        const i = b.findIndex((x) => +x.idx === this.plan.target && !x.disabled);
        this.plan = null;
        return pressAt(i >= 0 ? i : back());
      }
      const prefer = this.plan && this.plan.to;
      const pick = this.battle.replacement(S, s, b, prefer);
      this.plan = null;
      if (pick) return pressAt(b.indexOf(pick));
      return pressAt(back() >= 0 ? back() : b.findIndex((x) => !x.disabled));
    }
    return pressAt(Math.max(0, back()));
  }

  // ---- Menus the bot did not open itself ----
  async menu(s) {
    const head = s.menu.head;
    if (head === 'Who are you?') return this.character();
    if (/^The Forge/.test(head)) {
      const change = nextChange(s.save);
      if (change && change.kind === 'new') {
        this.log.event('forge', { type: 'new', build: change.build });
        return forge(this.game, change, { open: true });
      }
      await this.game.click('#menu [data-a="cancel"]');
      return this.wait(300);
    }
    if (/Creatastop$/.test(head)) return this.shop(s);
    await closeMenu(this.game);
  }

  // ---- The world ----
  async world(s) {
    const S = s.save;
    if (!S || !S.player) return this.wait(100);
    if (await this.ride(S)) return;
    if (await this.maintain(S)) return;
    const goal = nextGoal(S);
    if (MAPS[S.map].puzzle && MAPS[S.map].puzzle !== 'quiz') {
      if (goal.gym && S.map === `gym_${goal.gym}`) return this.gym(S, goal);
      return this.leaveGym(S);
    }
    if (await this.heal(S, goal)) return;
    if (await this.shopping(S)) return;
    if (await this.pickups(S)) return;
    if (goal.done || goal.alphas) return this.hunt(S, goal);
    if (!this.ready(S, goal)) return this.train(S, goal);
    return this.pursue(S, goal);
  }

  // On the bike whenever outdoors, as soon as there is one.
  async ride(S) {
    if (S.map !== 'world' || !S.f.bike || S.bike || S.surf) return false;
    await this.game.think(200, 400);
    await this.game.press('q');
    await this.wait(200);
    return true;
  }

  // ---- Looking after the team ----
  async maintain(S) {
    const sig = JSON.stringify([S.cards, S.items, S.party.map((c) => [c.level, c.stage, c.item, c.moves.length]), CM.badgeCount(S)]);
    if (sig === this.maintained) return false;
    if (S.map !== 'world' && MAPS[S.map].puzzle) return false;
    const evolve = S.party.findIndex((c) => CM.canEvolve(c));
    const goal = nextGoal(S), ready = this.ready(S, goal);
    const change = nextChange(S, { checkpoint: ready && !!foeLevel(S, goal) });
    const give = this.heldPlan(S);
    const lead = this.leadPlan(S, goal, ready);
    if (evolve < 0 && !change && !give && lead < 0) { this.maintained = sig; return false; }
    this.focus = 'team';
    if (!await openMenu(this.game, 'party')) return false;
    if (evolve >= 0) {
      this.log.event('evolve', { name: S.party[evolve].name, level: S.party[evolve].level });
      await this.game.click(`#menu [data-a="evolve"][data-i="${evolve}"]`);
    } else if (give) {
      this.log.event('hold', give);
      await this.game.choose(`#menu select[data-give="${give.idx}"]`, give.item);
    } else if (lead >= 0 && !change) {
      this.log.event('lead', { name: S.party[lead].name, level: S.party[lead].level });
      await this.game.click(`#menu [data-a="lead"][data-i="${lead}"]`);
    } else {
      this.log.event('forge', { type: change.kind, idx: change.idx, build: change.build });
      await forge(this.game, change, { open: false });
    }
    await this.game.think(500, 900);
    await closeMenu(this.game);
    return true;
  }
  // Who should lead: while training, the one furthest behind (only those who attack earn XP); otherwise the strongest.
  // Returns a party index to move to the front, or -1.
  leadPlan(S, goal, ready) {
    const hunting = goal.alphas || goal.done;
    const need = hunting ? CM.levelCap(CM.badgeCount(S)) : this.target(S, goal) || CM.levelCap(CM.badgeCount(S));
    const ok = S.party.filter((c) => c.hp > CM.maxHp(c) * 0.5);
    let want;
    // Hunting alphas is training too: they fall easily, so whoever is still short of the level limit goes first.
    if (!ready || (hunting && ok.some((c) => c.level < need))) want = ok.filter((c) => c.level < need).sort((a, b) => a.level - b.level)[0];
    else want = [...ok].sort((a, b) => b.level - a.level || CM.maxHp(b) - CM.maxHp(a))[0];
    if (!want || want === S.party[0] || (ready && want.level === S.party[0].level)) return -1;
    return S.party.indexOf(want);
  }
  // Held items, best first, to the strongest Creatamon not holding one yet.
  heldPlan(S) {
    const order = ['gloves', 'leaf', 'shield', 'charm', 'boots'];
    const free = order.filter((id) => (S.items[id] || 0) > S.party.filter((c) => c.item === id).length);
    if (!free.length) return null;
    const ranked = S.party.map((c, idx) => ({ c, idx })).sort((a, b) => b.c.level - a.c.level);
    const empty = ranked.find((r) => !r.c.item);
    if (empty) return { idx: empty.idx, item: free[0] };
    // Swap a lesser item for a better one on someone.
    const worse = ranked.find((r) => order.indexOf(r.c.item) > order.indexOf(free[0]));
    return worse ? { idx: worse.idx, item: free[0] } : null;
  }

  // ---- Readiness and training ----
  fighters(S) { return [...S.party].sort((a, b) => b.level - a.level).slice(0, 3); }
  target(S, goal) {
    const cap = CM.levelCap(CM.badgeCount(S)), foe = foeLevel(S, goal);
    // The opening battles are meant to be fought straight away.
    if (foe <= 5) return 0;
    return goal.gym || goal.npc === 'registrar' ? cap : Math.min(cap, foe);
  }
  ready(S, goal) {
    const need = this.target(S, goal);
    if (!need) return true;
    const f = this.fighters(S);
    return f.every((c, i) => c.level >= need - [0, 2, 4][i]);
  }
  // Where to train: the reachable spot with the strongest wild Creatamon the team can handle, not too far away.
  async train(S, goal) {
    this.focus = 'train';
    const top = Math.max(...S.party.map((c) => c.level));
    const here = { map: S.map, x: S.x, y: S.y };
    if (isGrass(S.map, S.x, S.y) && this.trainLv && this.spotOk(S, top)) return this.grind(S);
    const r = search(S, here, { fly: true, avoidGrass: true, limit: 240000 });
    let best = null;
    for (const [k, d] of r.dist) {
      const [map, xy] = k.split(':'), [x, y] = xy.split(',').map(Number);
      if (!isGrass(map, x, y)) continue;
      const lv = CM.areaAt(map, x, y).lv, avg = (lv[0] + lv[1]) / 2;
      if (lv[1] > top + 4) continue;
      const score = avg - d / 45000;
      if (!best || score > best.score) best = { score, k, map, x, y, avg };
    }
    if (!best) return this.wanderTo(S, goal);
    this.trainLv = best.avg;
    if (this.trainAt !== best.k) { this.trainAt = best.k; this.log.event('train', { at: best.k, avg: best.avg, need: this.target(S, goal) }); }
    if (best.k === nodeKey(S.map, S.x, S.y)) return this.grind(S);
    return this.go(S, (m, x, y) => nodeKey(m, x, y) === best.k, { fly: true, avoidGrass: false });
  }
  spotOk(S, top) { const lv = CM.areaAt(S.map, S.x, S.y).lv; return lv && lv[1] <= top + 4 && (lv[0] + lv[1]) / 2 >= (this.trainLv || 0) - 0.5; }
  // Back and forth in the grass until something jumps out.
  async grind(S) {
    const dirs = Object.keys(CM.DIRS).filter((d) => { const [dx, dy] = CM.DIRS[d]; return isGrass(S.map, S.x + dx, S.y + dy) && !npcAt(S, S.map, S.x + dx, S.y + dy); });
    if (!dirs.length) { this.trainLv = null; return this.wait(100); }
    const dir = dirs[this.patrol++ % dirs.length];
    const [dx, dy] = CM.DIRS[dir];
    return this.walk(S, dir, [{ map: S.map, x: S.x + dx, y: S.y + dy }]);
  }
  async wanderTo(S, goal) { return this.pursue(S, goal); }

  // ---- Healing ----
  async heal(S, goal) {
    const f = this.fighters(S), frac = (c) => c.hp / CM.maxHp(c);
    const lead = S.party.find((c) => c.hp > 0);
    const low = !lead || frac(S.party[0]) < 0.35 || f.reduce((n, c) => n + frac(c), 0) / f.length < 0.5;
    // Before a big battle, everyone at full health.
    const before = this.ready(S, goal) && foeLevel(S, goal) && f.some((c) => frac(c) < 0.95) && this.near(S, goal);
    if (low || before) this.healing = true;
    if (this.healing && f.every((c) => frac(c) >= 0.95)) this.healing = false;
    if (!this.healing) return false;
    this.focus = 'heal';
    // On a pad already (fast travel lands on one): a pad only heals when stepped on, so step off and back.
    if (CM.charAt(S.map, S.x, S.y) === 'H') {
      const here = { map: S.map, x: S.x, y: S.y };
      for (const d of Object.keys(CM.DIRS)) {
        const [dx, dy] = CM.DIRS[d], to = { map: S.map, x: S.x + dx, y: S.y + dy };
        const r = routeTo(S, here, (m, x, y) => m === to.map && x === to.x && y === to.y, { limit: 400 });
        if (r && r.steps.length === 1 && !r.steps[0].fly) return this.walk(S, d, [to]);
      }
    }
    const done = await this.go(S, (m, x, y) => CM.charAt(m, x, y) === 'H', { fly: true, avoidGrass: true });
    return done !== false;
  }
  near(S, goal) { const at = placeOf(goal); return at && (at[0] === S.map || (S.map === 'world' && Math.abs(at[1] - S.x) + Math.abs(at[2] - S.y) < 12 && at[0] === 'world')); }

  // ---- Shopping ----
  async shopping(S) {
    const balls = S.items.creataball || 0, heals = (S.items.potion || 0) + (S.items.super_potion || 0) + (S.items.max_potion || 0);
    const want = balls < 2 || heals < 4 || S.money > 2500;
    if (!want || S.money < 400 || this.shopped === CM.badgeCount(S) + ':' + Math.floor(S.money / 3000)) return false;
    const here = { map: S.map, x: S.x, y: S.y };
    const r = routeTo(S, here, (m, x, y) => m === 'world' && !!CM.STOP_AT[`${x},${y - 1}`], { limit: 30000, avoidGrass: true });
    if (!r) return false;
    this.focus = 'shop';
    if (r.steps.length) return this.follow(S, r.steps);
    // Walking into the door opens the shop.
    await this.face(S, 'up');
    await this.game.until((v) => v.menu, 1500);
    return true;
  }
  async shop(s) {
    const S = s.save, n = CM.badgeCount(S);
    this.shopped = n + ':' + Math.floor(S.money / 3000);
    let money = S.money;
    const buy = async (kind, id, price, times) => {
      for (let i = 0; i < times && money - price >= 0; i++) {
        if (!await this.game.page.$(`#menu [data-buy="${kind}:${id}"]:not([disabled])`)) return;
        await this.game.click(`#menu [data-buy="${kind}:${id}"]`);
        money -= price;
        this.log.event('buy', { id, price });
        await this.game.think(250, 500);
      }
    };
    const potion = n >= 7 ? 'max_potion' : n >= 3 ? 'super_potion' : 'potion';
    await buy('item', 'creataball', ITEMS.creataball.price, Math.max(0, 3 - (S.items.creataball || 0)));
    await buy('item', potion, ITEMS[potion].price, Math.max(0, 6 - (S.items[potion] || 0)));
    if (n >= 2) await buy('item', 'revive', ITEMS.revive.price, Math.max(0, 2 - (S.items.revive || 0)));
    // Health cards and strong moves with what is left, keeping a little back.
    const cards = await this.game.page.$$eval('#menu [data-buy^="card:"]', (els) => els.map((e) => [e.dataset.buy.slice(5), +e.textContent.replace(/\D/g, '')]));
    cards.sort((a, b) => b[1] - a[1]);
    for (const [id, price] of cards) {
      const c = CARDS[id];
      const useful = c.kind === 'hp' || (c.tier >= 3 && !(S.cards[id] > 0) && !S.party.some((p) => p.moves.includes(id)));
      if (useful && money - price >= 500) await buy('card', id, price, c.kind === 'hp' ? Math.floor((money - 500) / price / 2) || 1 : 1);
    }
    await this.game.think(400, 800);
    await closeMenu(this.game);
  }

  // ---- Pick-ups worth a detour ----
  async pickups(S) {
    if (MAPS[S.map].puzzle) return false;
    const here = { map: S.map, x: S.x, y: S.y };
    const r = search(S, here, { avoidGrass: true, limit: 60000 });
    let best = null;
    for (const c of CHESTS) {
      const k = nodeKey(c.map, c.x, c.y);
      if (S.chests[k] || !r.dist.has(k)) continue;
      const d = r.dist.get(k), w = worth(c);
      if (d < w && (!best || w - d > best.gain)) best = { k, gain: w - d };
    }
    if (!best) return false;
    this.focus = 'pickup';
    const steps = r.route(best.k);
    return this.follow(S, steps);
  }

  // ---- Alphas: the Champion's entry requirement, and the score after the story ----
  async hunt(S, goal) {
    this.focus = 'alphas';
    if (goal.done && this.opts.stop && this.opts.stop(S)) { this.finished = true; return; }
    // Train up first if the team is behind the level limit.
    const cap = CM.levelCap(CM.badgeCount(S));
    if (this.fighters(S).some((c) => c.level < cap - 6)) return this.train(S, { gym: 'Normal' });
    const ground = this.huntGround(S);
    if (!ground) return this.train(S, { gym: 'Normal' });
    // An alpha in sight on the minimap: go and meet it (walking onto it starts the battle, and it charges once it sees
    // us). One that cannot be reached in 20 seconds (behind a hedge, across water) is left alone for a while.
    const ignored = this.ignored || (this.ignored = new Map());
    const dist = (a) => Math.abs(a.x - S.x) + Math.abs(a.y - S.y);
    const seen = (await this.game.alphasOnMap(S)).filter((a) => !(ignored.get(`${a.x},${a.y}`) > this.clock) && dist(a) < 24).sort((a, b) => dist(a) - dist(b));
    if (seen.length) {
      const a = seen[0], key = `${a.x},${a.y}`;
      if (this.chasing !== key) { this.chasing = key; this.chaseSince = this.clock; this.log.event('alpha_seen', { x: a.x, y: a.y }); }
      const near = (d) => (m, x, y) => m === 'world' && Math.abs(x - a.x) + Math.abs(y - a.y) <= d;
      const here = { map: S.map, x: S.x, y: S.y };
      const r = this.clock - this.chaseSince < 20000 && (routeTo(S, here, near(0), { limit: 40000 }) || routeTo(S, here, near(1), { limit: 40000 }));
      if (r) return r.steps.length ? this.follow(S, r.steps) : this.wait(300);
      ignored.set(key, this.clock + 60000);
      this.chasing = null;
    }
    const at = ground[this.patrol % ground.length];
    if (S.map === 'world' && S.x === at[0] && S.y === at[1]) { this.patrol++; return this.wait(400); }
    return this.go(S, (m, x, y) => m === 'world' && x === at[0] && y === at[1], { fly: true, avoidGrass: true, patrol: true });
  }
  // Where to hunt: alphas turn up on open ground near long grass, a little way from the player, so the best ground is
  // wherever such spots are thickest. Every alpha counts the same for rank, so any the team easily outclasses will do.
  // Returns two spots to walk between.
  huntGround(S) {
    if (this.ground && this.ground.badges === CM.badgeCount(S)) return this.ground.spots;
    const r = search(S, { map: S.map, x: S.x, y: S.y }, { fly: true, avoidGrass: true });
    const low = Math.min(...this.fighters(S).map((c) => c.level)), cap = CM.levelCap(CM.badgeCount(S));
    const near = (x, y) => { for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (isGrass('world', x + i, y + j)) return true; return false; };
    const spots = [];
    for (const [k] of r.dist) {
      const [map, xy] = k.split(':'), [x, y] = xy.split(',').map(Number);
      if (map !== 'world' || !'.=sS_'.includes(CM.charAt(map, x, y)) || npcAt(S, map, x, y) || !near(x, y)) continue;
      const lv = CM.areaAt(map, x, y).lv;
      if (lv && Math.min(lv[1] + 6, cap + 3) <= low - 4) spots.push([x, y]);
    }
    if (!spots.length) return null;
    // The spot with the most others in an alpha's spawning window around it (10 to 26 tiles away, within 15 x 11).
    const around = ([x, y]) => spots.filter(([a, b]) => Math.abs(a - x) <= 15 && Math.abs(b - y) <= 11 && Math.abs(a - x) + Math.abs(b - y) >= 10).length;
    const ranked = spots.map((p) => [p, around(p)]).sort((a, b) => b[1] - a[1]);
    const best = ranked[0][0];
    const far = ranked.find(([[x, y]]) => { const d = Math.abs(x - best[0]) + Math.abs(y - best[1]); return d >= 5 && d <= 10; });
    this.ground = { badges: CM.badgeCount(S), spots: [best, ...(far ? [far[0]] : [])] };
    this.log.event('hunt_ground', { area: CM.areaAt('world', ...best).name, spots: this.ground.spots, density: ranked[0][1] });
    return this.ground.spots;
  }

  // ---- Story goals ----
  async pursue(S, goal) {
    if (goal.forge) {
      if (!await openMenu(this.game, 'party')) return this.wait(300);
      await this.game.click('#menu [data-a="new"]');
      return this.wait(300);
    }
    const at = placeOf(goal);
    if (!at) return this.wait(200);
    this.focus = goal.gym ? `gym ${goal.gym}` : `talk ${goal.npc}`;
    const [map, x, y] = at;
    if (goal.gym && S.map !== map) {
      // Walk in at the gym door; inside, the puzzle takes over.
      return this.go(S, (m) => m === map, { fly: true, avoidGrass: true });
    }
    return this.talkTo(S, map, x, y);
  }
  async talkTo(S, map, x, y) {
    if (S.map === map && Math.abs(S.x - x) + Math.abs(S.y - y) === 1) {
      await this.face(S, facing(S.x, S.y, x, y));
      await this.game.think(200, 500);
      const who = npcAt(S, map, x, y);
      this.log.event('talk', { id: who && who.id, at: [map, x, y] });
      await this.game.press('Enter');
      await this.wait(300);
      return true;
    }
    return this.go(S, besideOf(map, x, y), { fly: true, avoidGrass: true });
  }

  // ---- Gyms ----
  async gym(S, goal) {
    const id = S.map, m = MAPS[id];
    this.focus = `gym ${goal.gym}`;
    const f = this.fighters(S), frac = (c) => c.hp / CM.maxHp(c);
    const [lx, ly] = m.leader;
    // Heal on the gym's own pad before the Leader, if it can still be reached.
    if (f.some((c) => frac(c) < 0.95)) {
      const r = await this.puzzleGo(S, 'pad', (x, y) => CM.charAt(id, x, y) === 'H');
      if (r !== null) return;
    }
    if (Math.abs(S.x - lx) + Math.abs(S.y - ly) === 1) { this.pz = null; return this.talkTo(S, id, lx, ly); }
    const r = await this.puzzleGo(S, 'leader');
    if (r === null) {
      this.log.event('puzzle_stuck', { id, at: [S.x, S.y] });
      await this.game.press('r');
      this.P[id] = CM.initPuzzle(id);
      this.pz = null;
      return this.wait(500);
    }
  }
  // Out of a gym by its door. The way back can need the puzzle again (the Water gym's valves), so the puzzle search finds it.
  async leaveGym(S) {
    this.focus = 'leave gym';
    const r = await this.puzzleGo(S, 'exit', (x, y) => CM.charAt(S.map, x, y) === 'E');
    if (r === null) {
      this.log.event('puzzle_stuck', { id: S.map, at: [S.x, S.y], leaving: true });
      await this.game.press('r');
      this.P[S.map] = CM.initPuzzle(S.map);
      this.pz = null;
      return this.wait(500);
    }
  }
  // Makes the next move of a puzzle plan towards `goal` (the Leader when left out), solving it first if there is no
  // plan or the bot is not where the plan expects. Resolves null if there is no way, false if already there, true after a move.
  async puzzleGo(S, key, goal) {
    const id = S.map;
    const P = this.P[id] || (this.P[id] = CM.initPuzzle(id, isDone(S, id)));
    let pl = this.pz;
    if (!pl || pl.key !== key || pl.map !== id || pl.x !== S.x || pl.y !== S.y) {
      const way = solvePuzzle(id, { from: { x: S.x, y: S.y }, P, S, blocked: (x, y) => !!npcAt(S, id, x, y), goal });
      if (!way) { this.pz = null; return null; }
      pl = this.pz = { key, map: id, moves: way.moves, i: 0, x: S.x, y: S.y };
      this.log.event('puzzle_plan', { id, key, moves: way.n });
    }
    if (pl.i >= pl.moves.length) { this.pz = null; return false; }
    const at = await this.puzzleMove(S, pl.moves[pl.i]);
    if (!at) { this.pz = null; return true; }
    pl.i++;
    [pl.x, pl.y] = at;
    return true;
  }
  // Makes one puzzle move and keeps the bot's copy of the puzzle in step with the game's. Resolves to where the bot
  // now stands, or null if the game did not follow (then the challenge is started over).
  async puzzleMove(S, mv) {
    const id = S.map, P = this.P[id];
    if (mv.fire != null) {
      await this.face(S, mv.dir);
      await this.game.press('Enter');
      CM.toggleFire(id, P, mv.fire);
      await this.wait(250);
      return [S.x, S.y];
    }
    const res = CM.step(id, P, S, S.x, S.y, mv.dir, (x, y) => !!npcAt(S, id, x, y));
    if (!res) return null;
    let [tx, ty] = [res.x, res.y];
    if (CM.arrive(id, P, tx, ty) === 'shock') [tx, ty] = MAPS[id].entry;
    const twin = CM.teleAt(id, tx, ty);
    if (twin) [tx, ty] = twin;
    if (await this.tap(S, mv.dir, { map: id, x: tx, y: ty }, res.n)) return [tx, ty];
    // Out of step with the game: start the challenge over.
    const now = this.game.where(await this.game.look());
    if (now && now.map === id && (now.x !== tx || now.y !== ty)) {
      this.log.event('puzzle_resync', { id, want: [tx, ty], got: [now.x, now.y] });
      await this.game.press('r');
      this.P[id] = CM.initPuzzle(id);
      await this.wait(400);
    }
    return null;
  }

  // ---- Moving ----
  // Goes towards the first place where goal(map, x, y) holds: one stretch of the route per call.
  async go(S, goal, opts = {}) {
    const here = { map: S.map, x: S.x, y: S.y };
    let r = routeTo(S, here, goal, { P: this.P, ...opts });
    if (!r) {
      // Somebody in the way? Find who, and talk to them.
      r = routeTo(S, here, goal, { P: this.P, ...opts, through: true });
      if (!r) { this.log.event('no_route', { from: here, focus: this.focus }); await this.wait(1000); return false; }
    }
    // Already there: let a moment pass (in turbo, time only moves when the bot waits).
    if (!r.steps.length) return this.wait(150);
    return this.follow(S, r.steps);
  }
  // Follows the start of a route, up to the first thing that needs more than walking.
  async follow(S, steps) {
    const first = steps[0];
    if (first.fly) return this.fly(S, first.fly);
    if (first.smash) {
      await this.face(S, first.dir);
      await this.game.press('Enter');
      return this.wait(300);
    }
    if (first.talk) {
      const key = `${first.talk}|${JSON.stringify(S.f)}|${CM.badgeCount(S)}`;
      if (this.noTalk.has(key)) { this.log.event('blocked', { by: first.talk }); return this.wait(2000); }
      this.noTalk.add(key);
      const n = CM.NPCS.find((p) => p.id === first.talk);
      return this.talkTo(S, n.map, n.x, n.y);
    }
    // A straight run of plain one-tile steps is walked holding the key; anything else, one press at a time.
    const run = [];
    for (const st of steps) {
      if (st.fly || st.smash || st.talk || st.dir !== first.dir || st.n !== 1 || st.to.map !== S.map || st.land.x !== st.to.x || st.land.y !== st.to.y) break;
      run.push(st.to);
    }
    if (run.length) return this.walk(S, first.dir, run);
    return this.tap(S, first.dir, first.to, first.n);
  }
  async fly(S, at) {
    this.log.event('fly', { to: at, name: S.visited[at], focus: this.focus });
    if (!await openMenu(this.game, 'map') || !await this.game.page.isVisible(`#menu [data-fly="${at}"]`)) {
      await closeMenu(this.game);
      return this.wait(300);
    }
    await this.game.click(`#menu [data-fly="${at}"]`);
    await this.game.until((v) => !v.menu, 2000);
    return true;
  }
  frame() { return this.game.turbo ? 50 : 1000 / 60; }
  stepTime(S) {
    const t = S.map === 'world' && S.bike ? 65 : 130, f = this.frame();
    return Math.ceil(t / f) * f;
  }
  // Holds the key for a run of tiles and lets go during the last step, as a player does.
  async walk(S, dir, tiles) {
    const g = this.game, step = this.stepTime(S), f = this.frame();
    const same = (p, t) => p && p.map === t.map && p.x === t.x && p.y === t.y;
    await g.down(keyOf(dir));
    let reached = -1, since = this.clock;
    // When we stand on the tile before the last, the last step starts on the next frame: let go half way through it.
    const letGo = async () => { await this.wait(f + step / 2); await g.up(); };
    if (tiles.length === 1) await letGo();
    while (g.held) {
      await this.wait(this.game.turbo ? f : 8);
      const s = await g.look();
      if (s.screen !== 'world') { await g.up(); return false; }
      const pos = g.where(s);
      const i = tiles.findIndex((t) => same(pos, t));
      if (i > reached) { reached = i; since = this.clock; }
      if (reached === tiles.length - 2) await letGo();
      else if (reached === tiles.length - 1 || this.clock - since > step * 4 + 400) await g.up();
    }
    // Wait for the last step to land.
    const end = await g.until((v) => v.screen !== 'world' || same(g.where(v), tiles[tiles.length - 1]), step * 3 + 300, this.game.turbo ? f : 16);
    return !!end && end.screen === 'world';
  }
  // One press: a single step, a slide, a push or a turn.
  async tap(S, dir, to, n = 1) {
    const g = this.game, step = this.stepTime(S), f = this.frame();
    await g.down(keyOf(dir));
    await this.wait(f + step / 2);
    await g.up();
    const end = await g.until((v) => { const p = g.where(v); return v.screen !== 'world' || (p && p.map === to.map && p.x === to.x && p.y === to.y); }, step * (n + 2) + 600, this.game.turbo ? f : 16);
    return !!end;
  }
  // Turns to face a way without moving (the tile that way must be blocked).
  async face(S, dir) {
    const g = this.game;
    await g.down(keyOf(dir));
    await this.wait(this.frame() * 2);
    await g.up();
    await this.wait(this.frame());
  }
}
