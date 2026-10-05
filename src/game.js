// Creatamon UI: overworld, gym puzzles, story, battles, menu, wardrobe and the Forge.
// The imports run in the order the classic <script> tags used to: sfx, core, world, draw, gl, then this file.
import { SFX } from './sfx.js';
import { CM } from './world.js';
import { GFX } from './draw.js';
import { GL3D } from './gl.js';

(() => {
  const { CARDS, ELEMENTS, SHAPES, CLOTHES, MAPS, NPCS, CHESTS, TEAMS } = CM;
  const { drawTile, drawPerson, drawProp, drawCreature, drawSpray, playFx, SPRAYS } = GFX;
  const ITEMS = CM.ITEMS, TOTAL = CM.GYM_ORDER.length, COIN = '◎';
  const $ = (id) => document.getElementById(id);
  const $game = $('game'), $world = $('world'), $battle = $('battle'), $dialog = $('dialog');
  const $actions = $('actions'), $menu = $('menu'), $title = $('title'), $hud = $('hud');
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const SAVE_KEY = 'creatamon-save-v1';
  // The world canvas holds SCALE pixels per unit, so tiles stay 32 units but carry finer detail.
  const TILE = 32, VIEW_W = 480, VIEW_H = 352, SCALE = 3;
  const DIRS = CM.DIRS;

  let S = null;          // saved game state
  let P = null;          // puzzle state of the current map (not saved)
  let mode = 'title';    // title | world | busy | menu
  let move = null;       // in-progress step {pts: tiles passed through, t: 0..1, n: steps}
  let help = false;      // the How to play page is open
  let inv = false;       // the inventory page is open
  let page = 'home';     // which menu page is showing: home | party | storage | dex | map | sprays | shop
  let shop = null;       // the Creatastop being browsed
  let forge = null;      // open Forge editor {idx, draft, avail}
  let wardrobe = null;   // open character editor {isNew, draft}
  let B = null;          // current battle {me, foe}
  let grace = 0;         // encounter-free steps left after a battle
  const keys = {};

  // ---------- State ----------
  const newState = () => ({
    v: 2, map: 'world', x: CM.START.x, y: CM.START.y, dir: 'down', heal: ['world', CM.START.x, CM.START.y], surf: false,
    cards: {}, party: [], chests: {}, beaten: {}, f: {}, badges: {}, smashed: {}, solved: {}, quiz: 0,
    player: null, wardrobe: {}, seen: {},
    items: {}, sprays: {}, sprayOwned: { star: true, smile: true }, spray: 'star', tips: {},
    money: 0, storage: [], explored: '', alphaWins: 0, champAt: null, dev: null,
    stats: { wins: 0, trainers: 0, steps: 0, time: 0, shinies: 0 }, trophies: {}, visited: {}, daily: null, streak: 0, trials: {},
  });
  // packSeen: the explored map, defined with the minimap below.
  const save = () => { try { S.explored = packSeen(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
  const load = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.v === 2) {
        // Saves from before items and sprays: start them off with a ball and a few potions.
        if (!s.items) s.items = { creataball: 1, potion: 3 };
        // Saves from before the bike: it comes with the endorsement, and its floats with Surf.
        if (s.f && s.f.endorsed) s.f.bike = true;
        if (s.f && s.f.surf) s.f.hydro = true;
        // Champions from before Champion rank had numerals start counting from here.
        if (s.f && s.f.champion && s.champAt == null) s.champAt = s.alphaWins || 0;
        return { ...newState(), ...s };
      }
      if (!s) return s;
      // A save from before the Gym Challenge: the world is new, so the journey restarts from home,
      // but the team, cards, clothes and Creatadex come along.
      const kept = { ...newState(), items: { creataball: 1, potion: 3 }, cards: s.cards || {}, party: s.party || [], player: s.player || null, wardrobe: s.wardrobe || {}, seen: s.seen || {} };
      kept.party.forEach((c) => { c.hp = CM.maxHp(c); });
      kept.f.start = kept.party.length > 0 || Object.keys(kept.cards).length > 0;
      // The easter egg now needs the right element and body too; without them its bound cards fall away.
      kept.party.filter((c) => !CM.isEgg(c)).forEach((c) => {
        c.moves = c.moves.filter((id) => CARDS[id].tier !== 4);
        if (!c.moves.length) c.moves = ['tackle'];
      });
      return kept;
    } catch (e) { return null; }
  };
  const addCard = (id, n = 1) => { S.cards[id] = (S.cards[id] || 0) + n; };
  const cardLabel = (id) => `${'★'.repeat(CARDS[id].tier)} ${CARDS[id].name}`;
  const healAll = () => S.party.forEach((c) => { c.hp = CM.maxHp(c); });
  const badgeCount = () => CM.badgeCount(S);
  const myTitle = () => CM.title(S.alphaWins, S.f.champion, S.champAt);
  const isDone = (id) => !!(S.solved[id] || (MAPS[id].el && S.badges[MAPS[id].el]));

  // ---------- Dialog ----------
  let advance = null, advanceAt = 0;
  // Lines that open with a known speaker's name get it on a tab above the box.
  const SPEAKERS = new Set([...CM.NPCS.map((n) => n.name), 'Finn', 'Wren', 'Nettie', 'Cyril', 'Rook', 'Opaline', 'Mum', 'Champion Vex', 'Chairman Sterling',
    'Prof. Willow', 'Gatekeeper', 'Cup Registrar', 'League Staff', 'Team Holler Grunt', 'Madame Ohm']);
  const say = (text) => new Promise((resolve) => {
    const m = /^([^:]{2,28}): ([\s\S]*)$/.exec(text);
    if (m && SPEAKERS.has(m[1])) $dialog.innerHTML = `<span class="who">${esc(m[1])}</span>${esc(m[2])}`;
    else $dialog.textContent = text;
    $dialog.hidden = false;
    advanceAt = performance.now();
    const mine = advance = () => { advance = null; resolve(); };
    // In battle, ordinary lines move on by themselves after a moment (longer lines wait longer). Tips never do.
    if (SFX.opts.auto && !$battle.hidden && !holding) setTimeout(() => { if (advance === mine) mine(); }, Math.min(6000, 700 + text.length * 40));
  });
  const tryAdvance = () => {
    // The short guard stops the click/keypress that opened a message from also dismissing it.
    if (advance && performance.now() - advanceAt > 120) { SFX.play('blip'); advance(); }
  };
  const sayAll = async (lines) => { for (const line of [].concat(lines)) await say(line); };
  // Runs a conversation or event with the world paused, then hands control back.
  async function run(fn) {
    mode = 'busy';
    try { await fn(); } finally {
      $battle.hidden = true;
      $actions.hidden = true;
      $dialog.hidden = true;
      if (mode === 'busy') mode = 'world';
      updateHud();
      save();
    }
  }
  const talk = (lines) => run(() => sayAll(lines));
  const giveCards = async (ids) => {
    for (const id of ids) {
      addCard(id);
      SFX.play('item');
      await say(`You got a Power Card: ${cardLabel(id)}! (${CM.cardDesc(CARDS[id])})`);
    }
  };
  const addItem = (id, n = 1) => { S.items[id] = (S.items[id] || 0) + n; };
  const giveItems = async (ids) => {
    for (const id of ids) {
      addItem(id);
      SFX.play('item');
      await say(`You got ${/^[aeiou]/i.test(ITEMS[id].name) ? 'an' : 'a'} ${ITEMS[id].name}! (${ITEMS[id].desc})`);
    }
  };
  // The first time something new comes up, explain it once.
  let holding = false;   // a tip is on screen: it waits for the player however long that takes
  const tip = async (id, lines) => { if (!S.tips[id]) { S.tips[id] = true; holding = true; try { await sayAll(lines); } finally { holding = false; } } };
  const giveClothes = async (ids) => {
    for (const id of ids) {
      S.wardrobe[id] = true;
      SFX.play('item');
      await say(`You got new clothes: ${CLOTHES[id].name}! Try them on in the Wardrobe (press M).`);
    }
  };

  // ---------- World ----------
  const index = (list) => {
    const out = {};
    list.forEach((e) => { const m = out[e.map] = out[e.map] || {}; (m[`${e.x},${e.y}`] = m[`${e.x},${e.y}`] || []).push(e); });
    return out;
  };
  const npcIndex = index(NPCS), chestIndex = index(CHESTS);
  const here = (idx, x, y) => (idx[S.map] && idx[S.map][`${x},${y}`]) || [];
  const npcAt = (x, y) => here(npcIndex, x, y).find((n) => !n.show || n.show(S));
  const chestAt = (x, y) => here(chestIndex, x, y)[0];
  const pickupAt = (x, y) => { const c = chestAt(x, y); return c && !S.chests[`${S.map}:${x},${y}`] ? c : null; };
  const blocked = (x, y) => !!npcAt(x, y);
  const hasFighter = () => S.party.some((c) => c.hp > 0);
  // ---------- Alphas ----------
  // Big, strong wild Creatamon that prowl the open ground beside long grass. They wander until they spot the player,
  // then give chase; if one catches up, it is a battle. They are not saved: fresh ones turn up as the player travels.
  const alphas = [];
  const ALPHA_MAX = 2, ALPHA_SIGHT = 6, ALPHA_WALK = 430, ALPHA_RUN = 165;
  // How often a new one may turn up (ms), and the chance that it does.
  const ALPHA_EVERY = 5000, ALPHA_CHANCE = 0.3;
  let alphaSpawn = 0;
  const isGrass = (x, y) => { const ch = CM.charAt('world', x, y); return ch !== '~' && !!CM.ZONE_OF[ch]; };
  const grassNear = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (isGrass(x + i, y + j)) return [x + i, y + j]; return null; };
  // Open ground an alpha may stand on: out on a route, not in the grass itself, with nobody and nothing in the way.
  const alphaSpot = (x, y, chasing) => {
    const ch = CM.charAt('world', x, y);
    if (!('.=sS_'.includes(ch) || (chasing && isGrass(x, y)))) return false;
    return !!CM.areaAt('world', x, y).lv && !npcAt(x, y) && !pickupAt(x, y) && !alphas.some((a) => a.x === x && a.y === y);
  };
  // An alpha: six levels over the local wildlife (a little past the level limit at most), three extra health cards,
  // punching gloves, and one in twenty is shiny.
  function makeAlpha(species, area) {
    const c = CM.spawn(species, Math.min((area.lv || [5, 5])[1] + 6, CM.levelCap(badgeCount()) + 3));
    c.hpCards.push('hp250', 'hp250', 'hp100');
    Object.assign(c, { species, name: `Alpha ${species}`.slice(0, 18), alpha: true, item: 'gloves', shiny: Math.random() < 0.05 });
    c.hp = CM.maxHp(c);
    return c;
  }
  function spawnAlpha(x, y) {
    const area = CM.areaAt('world', x, y), near = grassNear(x, y, 2);
    const list = CM.WILD[area.wild || CM.ZONE_OF[CM.charAt('world', ...near)]];
    const species = list[Math.floor(Math.random() * list.length)][0];
    alphas.push({ c: makeAlpha(species, area), x, y, px: x, py: y, t: 1, dur: ALPHA_WALK, wait: 400 + Math.random() * 800, rest: 0, chase: false, cv: null });
  }
  function updateAlphas(dt) {
    if (S.map !== 'world' || !S.f.ceremony || !hasFighter() || (S.dev && S.dev.noWild)) { alphas.length = 0; return; }
    // Fresh ones appear a little way off, on open ground next to long grass; ones left far behind are forgotten.
    if ((alphaSpawn -= dt) <= 0) {
      alphaSpawn = ALPHA_EVERY;
      for (let i = alphas.length - 1; i >= 0; i--) if (Math.abs(alphas[i].x - S.x) + Math.abs(alphas[i].y - S.y) > 30) alphas.splice(i, 1);
      for (let tries = Math.random() < ALPHA_CHANCE ? 0 : 99; tries < 24 && alphas.length < ALPHA_MAX; tries++) {
        const x = S.x + Math.floor(Math.random() * 31) - 15, y = S.y + Math.floor(Math.random() * 23) - 11;
        if (Math.abs(x - S.x) + Math.abs(y - S.y) >= 10 && alphaSpot(x, y) && grassNear(x, y, 2)) { spawnAlpha(x, y); break; }
      }
    }
    for (const a of alphas) {
      a.t = Math.min(1, a.t + dt / a.dur);
      a.rest -= dt;
      if (a.t < 1) continue;
      // Caught: it is standing where the player is.
      if (!move && a.rest <= 0 && a.x === S.x && a.y === S.y) return void fightAlpha(a);
      if ((a.wait -= dt) > 0) continue;
      const dx = S.x - a.x, dy = S.y - a.y;
      const calm = !a.chase;
      a.chase = a.rest <= 0 && Math.abs(dx) + Math.abs(dy) <= ALPHA_SIGHT;
      if (a.chase && calm) SFX.play('alert');
      let step = null;
      if (a.chase) {
        // Close the larger gap first; if that way is shut, try the other.
        const ways = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
        step = ways.find(([i, j]) => (i || j) && ((a.x + i === S.x && a.y + j === S.y) || alphaSpot(a.x + i, a.y + j, true)));
      } else {
        const [i, j] = Object.values(DIRS)[Math.floor(Math.random() * 4)];
        if (alphaSpot(a.x + i, a.y + j) && grassNear(a.x + i, a.y + j, 3)) step = [i, j];
      }
      a.dur = a.chase ? ALPHA_RUN : ALPHA_WALK;
      a.wait = a.chase ? 0 : 300 + Math.random() * 900;
      if (step) Object.assign(a, { px: a.x, py: a.y, x: a.x + step[0], y: a.y + step[1], t: 0 });
    }
  }
  function fightAlpha(a) {
    run(async () => {
      await say(`The ${a.c.name} caught you! It roars and attacks!`);
      await tip('alpha', ['Alphas are far stronger than ordinary wild Creatamon: higher level, with much more health.',
        'You can Run, and it will lose interest for a moment. Beat it and you earn Champion rank, coins and a sure Power Card.']);
      const result = await battle([a.c], { zone: bgZone(), alpha: true, skill: 0.9 });
      $battle.hidden = true;
      if (result === 'lose') { alphas.length = 0; return whiteout(); }
      if (result !== 'win') { Object.assign(a, { rest: 6000, chase: false }); return; }
      alphas.splice(alphas.indexOf(a), 1);
      if (a.c.shiny) await shinyPrize(a.c);
      const before = myTitle(), coins = a.c.level * 40;
      S.alphaWins = (S.alphaWins || 0) + 1;
      S.money += coins;
      await say(`You defeated an alpha! That is ${S.alphaWins} so far. You found ${COIN}${coins} where it fell.`);
      await giveCards([CM.rollDrop(CM.areaAt('world', S.x, S.y).drops || [40, 45, 15], Math.random, true)]);
      const now = myTitle();
      if (now !== before) await sayAll([`Your Champion rank rose to ${now}!`, 'Stand still for a few seconds and your title shows above your head.']);
      else { const next = CM.nextRank(S.alphaWins, S.f.champion, S.champAt); if (next) await say(`${next.left} more alpha win${next.left === 1 ? '' : 's'} to reach ${next.name}.`); }
    });
  }
  // An alpha out in the world: its own portrait, larger than a person, in a pulsing red glow.
  // k: scale, for views that cannot enlarge the sprite themselves.
  function drawAlpha(g, a, sx, sy, time, k = 1) {
    if (!a.cv) { a.cv = document.createElement('canvas'); a.cv.width = a.cv.height = 120; drawCreature(a.cv, a.c, false); }
    const pulse = 0.5 + 0.5 * Math.sin(time / 240), bob = a.t < 1 ? Math.abs(Math.sin(a.t * Math.PI)) * 2 : 0;
    const cx = sx + 16, foot = sy + 31, w = 32 * k;
    const glow = g.createRadialGradient(cx, foot - w * 0.45, w * 0.12, cx, foot - w * 0.45, w * 0.5);
    glow.addColorStop(0, `rgba(255,70,60,${0.55 + 0.25 * pulse})`); glow.addColorStop(1, 'rgba(255,70,60,0)');
    g.fillStyle = glow; g.fillRect(cx - w / 2, foot - w * 0.95, w, w);
    g.drawImage(a.cv, cx - w / 2, foot - w - bob * k, w, w);
  }

  // ---------- Developer mode ----------
  // Opened by typing the secret word in the menu. Shortcuts for testing: nothing here is part of normal play.
  const TOWNS = [];
  MAPS.world.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'H') TOWNS.push([CM.areaAt('world', x, y).name, x, y]); }));
  function renderDev() {
    const dv = S.dev, b = (act, text, v = '') => `<button class="plain" data-dev="${act}" data-v="${v}">${text}</button>`;
    const sw = (key, text) => `<button class="plain ${dv[key] ? 'on' : ''}" data-dev="toggle" data-v="${key}">${text}: ${dv[key] ? 'ON' : 'off'}</button>`;
    $menu.className = '';
    $menu.innerHTML = `${head('Developer mode')}
      <p class="empty">Testing tools. At ${S.map} ${S.x},${S.y} · ${badgeCount()} badges · ${S.alphaWins || 0} alpha wins · next: ${esc(objective())}</p>
      <h3>Switches</h3><div class="pick">${sw('noWild', 'No wild battles or alphas')}${sw('noclip', 'Walk through walls (not people)')}${sw('ohko', 'One-hit wins')}</div>
      <h3>Story</h3><div class="pick">${b('skip', 'Complete the current objective')}${b('skipall', 'Skip to the Champion match')}${b('alphawin', '+1 alpha win')}${b('alpha', 'Spawn an alpha nearby')}</div>
      <h3>Give</h3><div class="pick">${b('heal', 'Heal party')}${b('coins', `+${COIN}5000`)}${b('balls', '+10 Creataballs')}${b('potions', '+10 of each potion')}${b('cards', 'One of every card')}${b('health', '+10 Titan Hearts')}${b('clothes', 'All clothes')}${b('level', 'Lead to the level limit')}${b('map', 'Reveal the map')}</div>
      <h3>Teleport</h3><div class="pick">${TOWNS.map(([name, x, y]) => b('tp', name, `${x},${y}`)).join('')}</div>`;
  }
  function devSkip() {
    const f = S.f, b = S.badges;
    const badge = (el, also = []) => [!b[el], () => { b[el] = true; S.solved[`gym_${el}`] = true; also.forEach(flag); }];
    const steps = [
      [!f.rival1, () => flag('rival1')], [!f.grove, () => flag('grove')], [!f.endorsed, () => { flag('endorsed'); flag('bike'); }],
      [!f.ceremony, () => { flag('ceremony'); addCard('rock_smash'); }],
      badge('Grass', ['cyril1']), badge('Water'), badge('Fire', ['nettie1']), badge('Wind'), badge('Rock'), [!f.mural, () => flag('mural')],
      badge('Electric'), badge('Metal'), [!f.rival3, () => flag('rival3')], badge('Ice'), [!f.surf, () => { flag('surf'); flag('hydro'); addCard('surf'); }],
      badge('Shadow', ['holler', 'nettie2']), badge('Mind'), badge('Robot'), badge('Light'), badge('Toxic'), [!b.Normal, () => { S.quiz = 5; badge('Normal')[1](); }],
      [!f.semis, () => { flag('semi1'); flag('semis'); }], [!f.opaline, () => flag('opaline')], [!f.night, () => { f.finals = 4; flag('night'); }],
      [!f.blade, () => { flag('blade'); flag('shortcut'); }], [!f.dawn, () => { flag('sterling'); flag('dawn'); }],
      [CM.alphaRank(S.alphaWins) < CM.CUP_RANK, () => { S.alphaWins = CM.ALPHA_NEED[CM.CUP_RANK - 1]; }], [!f.champion, () => { flag('champion'); S.champAt = S.alphaWins || 0; }],
    ];
    const next = steps.find((st) => st[0]);
    if (next) next[1]();
    return !!next;
  }
  function devDo(act, v) {
    if (act === 'toggle') S.dev[v] = !S.dev[v];
    else if (act === 'skip') devSkip();
    else if (act === 'skipall') { for (let i = 0; i < 60 && !S.f.dawn; i++) devSkip(); devSkip(); }
    else if (act === 'alphawin') S.alphaWins = (S.alphaWins || 0) + 1;
    else if (act === 'heal') healAll();
    else if (act === 'coins') S.money += 5000;
    else if (act === 'balls') addItem('creataball', 10);
    else if (act === 'potions') ['potion', 'super_potion', 'max_potion', 'revive'].forEach((id) => addItem(id, 10));
    else if (act === 'cards') Object.keys(CARDS).filter((id) => CARDS[id].tier < 4).forEach((id) => addCard(id));
    else if (act === 'health') addCard('hp250', 10);
    else if (act === 'clothes') Object.keys(CLOTHES).forEach((id) => { S.wardrobe[id] = true; });
    else if (act === 'level' && S.party[0]) { CM.gainXp(S.party[0], 1e7, CM.levelCap(badgeCount())); S.party[0].hp = CM.maxHp(S.party[0]); }
    else if (act === 'map') { loadSeen('o'.repeat(Math.ceil(MW * MH / 6))); }
    else if (act === 'tp' || act === 'alpha') {
      if (act === 'tp') { const [x, y] = v.split(',').map(Number); goTo('world', x, y, 'down'); }
      else {
        if (S.map !== 'world') return alert('Alphas only live outdoors.');
        flag('ceremony');
        for (let r = 2; r < 7; r++) for (const [i, j] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (alphas.length < 6 && alphaSpot(S.x + i, S.y + j, true) && !alphas.some((a) => a.fresh)) { alphaSpawnAt(S.x + i, S.y + j); }
      }
      alphas.forEach((a) => { delete a.fresh; });
      closeMenu();
      return updateHud();
    }
    save();
    updateHud();
    renderMenu();
  }
  // Developer spawn: an alpha on any open tile, grass nearby or not.
  function alphaSpawnAt(x, y) {
    const area = CM.areaAt('world', x, y), species = CM.WILD[area.wild || 1][0][0];
    alphas.push({ c: makeAlpha(species, area), x, y, px: x, py: y, t: 1, dur: ALPHA_WALK, wait: 1500, rest: 0, chase: false, cv: null, fresh: true });
  }

  // ---------- Minimap ----------
  // The world is drawn one pixel per tile, and only the parts the player has walked near are filled in.
  const MW = MAPS.world.rows[0].length, MH = MAPS.world.rows.length, SIGHT = 7;
  const seenMap = new Uint8Array(MW * MH);
  const mapCv = document.createElement('canvas');
  mapCv.width = MW; mapCv.height = MH;
  const MAP_COLORS = { '#': '#2f6b3a', T: '#7fa89a', '^': '#8a7458', '~': '#4a90d9', b: '#a9744a', '.': '#7ec850', ',': '#5fae45', ';': '#3f8f4a', ':': '#8d8496',
    '*': '#a6d977', '"': '#cfe6ee', '=': '#e3c98a', c: '#b9b4a8', S: '#e8d9a0', s: '#f2f7fb', _: '#77707f', H: '#f08aa0', m: '#3f8f4a', x: '#6d5a48',
    R: '#b8553c', W: '#efe6d2', D: '#5a4632', M: '#c9a468' };
  const mapColor = (x, y) => {
    const ch = MAPS.world.rows[y][x], tint = CM.TINT[`${x},${y}`];
    return tint && 'GWD'.includes(ch) ? (ELEMENTS[tint] || { color: tint === 'League' ? '#e0483c' : tint === 'Stop' ? '#ffd24a' : '#7d8496' }).color : MAP_COLORS[ch] || '#7ec850';
  };
  const paintSeen = (x, y) => { const g = mapCv.getContext('2d'); g.fillStyle = mapColor(x, y); g.fillRect(x, y, 1, 1); };
  const packSeen = () => { let out = ''; for (let i = 0; i < seenMap.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v |= (seenMap[i + k] || 0) << k; out += String.fromCharCode(48 + v); } return out; };
  function loadSeen(str) {
    seenMap.fill(0);
    mapCv.getContext('2d').clearRect(0, 0, MW, MH);
    for (let i = 0; i < (str || '').length; i++) {
      const v = str.charCodeAt(i) - 48;
      for (let k = 0; k < 6; k++) if (v >> k & 1 && i * 6 + k < seenMap.length) { seenMap[i * 6 + k] = 1; paintSeen((i * 6 + k) % MW, Math.floor((i * 6 + k) / MW)); }
    }
  }
  // Where the player counts as standing on the world map (the door they came in by, when indoors).
  const worldSpot = () => (S.map === 'world' ? [S.x, S.y] : MAPS[S.map].out.slice(1));
  function reveal() {
    const [px, py] = worldSpot();
    for (let y = Math.max(0, py - SIGHT); y <= Math.min(MH - 1, py + SIGHT); y++) {
      for (let x = Math.max(0, px - SIGHT); x <= Math.min(MW - 1, px + SIGHT); x++) {
        if (seenMap[y * MW + x] || (x - px) ** 2 + (y - py) ** 2 > SIGHT * SIGHT + 2) continue;
        seenMap[y * MW + x] = 1;
        paintSeen(x, y);
      }
    }
  }
  // Draws the map so far onto a canvas, with the player, the gyms found so far and the next goal marked.
  // span: how many tiles across to show, centred on the player (the corner minimap); left out, the whole world (the Town Map).
  function drawMap(cv, span = MW) {
    const g = cv.getContext('2d'), k = cv.width / span, rows = cv.height / k, [px, py] = worldSpot();
    const x0 = Math.max(0, Math.min(MW - span, px + 0.5 - span / 2)), y0 = Math.max(0, Math.min(MH - rows, py + 0.5 - rows / 2));
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#141a2b'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(mapCv, x0, y0, span, rows, 0, 0, cv.width, cv.height);
    // Marks stay on the rim of the picture when what they mark is out of frame.
    const dot = (x, y, r, fill, line) => {
      const cx = Math.max(r + 2, Math.min(cv.width - r - 2, (x + 0.5 - x0) * k)), cy = Math.max(r + 2, Math.min(cv.height - r - 2, (y + 0.5 - y0) * k));
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1.5, r * 0.35); g.strokeStyle = line; g.stroke();
    };
    const [, map, qx, qy] = quest();
    if (map) {
      const door = map === 'world' ? null : Object.keys(CM.WARPS).find((key) => CM.WARPS[key].map === map);
      const [gx, gy] = map === 'world' ? [qx, qy] : door.split(':')[1].split(',').map(Number);
      dot(gx, gy, span === MW ? k * 2.6 : 6, '#ffd24a', '#e8384f');
    }
    if (span !== MW) alphas.forEach((a) => dot(a.x, a.y, 3.2, '#e8384f', '#fff'));
    dot(px, py, span === MW ? k * 1.8 : 4.5, '#ffffff', '#1d2437');
  }

  // ---------- Trophies ----------
  // Small goals with a coin prize each. They are checked as the player goes, and pop up as a toast when earned.
  const seenCount = () => CM.DEX.filter((m) => S.seen[m.name]).length;
  const TROPHIES = [
    ['first', '🐣', 'First Friend', 'Forge your first Creatamon', () => S.party.length + S.storage.length >= 1],
    ['team', '🐾', 'Full House', 'Have a full party of six', () => S.party.length >= CM.MAX_PARTY],
    ['evolve', '🌟', 'All Grown Up', 'Evolve a Creatamon to its final form', () => [...S.party, ...S.storage].some((c) => c.stage === 2)],
    ['badge1', '🥉', 'On the Board', 'Win your first badge', () => badgeCount() >= 1],
    ['badge5', '🥈', 'Halfway Hero', 'Win five badges', () => badgeCount() >= 5],
    ['badge10', '🥇', 'Badge Collector', 'Win ten badges', () => badgeCount() >= 10],
    ['badges', '🏅', 'Clean Sweep', `Win all ${TOTAL} badges`, () => badgeCount() >= TOTAL],
    ['champion', '👑', 'Champion of Galdra', 'Beat Champion Vex', () => !!S.f.champion],
    ['alpha1', '🔥', 'Alpha Slayer', 'Defeat an alpha', () => S.alphaWins >= 1],
    ['king', '⚔', 'Royalty', 'Reach the rank of King I', () => !!S.f.champion || CM.alphaRank(S.alphaWins) >= 4],
    ['mythic', '🐉', 'Stuff of Myth', 'Reach the rank of Mythic I', () => CM.alphaRank(S.alphaWins) >= 19],
    ['shiny', '✨', 'Ooh, Shiny', 'Defeat a shiny Creatamon', () => S.stats.shinies >= 1],
    ['dex20', '📖', 'Field Notes', 'See 20 kinds of Creatamon', () => seenCount() >= 20],
    ['dex60', '📚', 'Naturalist', 'See 60 kinds of Creatamon', () => seenCount() >= 60],
    ['dexall', '🎓', 'Professor', 'See every kind of Creatamon', () => seenCount() >= CM.DEX.length],
    ['wins50', '💪', 'Battle Hardened', 'Win 50 battles', () => S.stats.wins >= 50],
    ['wins250', '🏆', 'Unstoppable', 'Win 250 battles', () => S.stats.wins >= 250],
    ['steps', '👟', 'Marathon', 'Walk 5,000 steps', () => S.stats.steps >= 5000],
    ['rich', '💰', 'Moneybags', `Hold ${COIN}5,000 at once`, () => S.money >= 5000],
    ['style', '👒', 'Fashionista', 'Own 15 pieces of bought or found clothing', () => Object.keys(S.wardrobe).length >= 15],
    ['towns', '🧭', 'Globetrotter', 'Use the heal pad in 10 different towns', () => Object.keys(S.visited).length >= 10],
    ['streak', '📅', 'Regular', 'Play three days in a row', () => S.streak >= 3],
  ];
  const TROPHY_PRIZE = 200;
  const toasts = [];
  let toasting = false;
  function toast(icon, title, text) {
    toasts.push([icon, title, text]);
    if (toasting) return;
    toasting = true;
    const next = () => {
      const t = toasts.shift(), $toast = $('toast');
      if (!t) { toasting = false; return; }
      $toast.innerHTML = `<i>${t[0]}</i><div><b>${esc(t[1])}</b><small>${esc(t[2])}</small></div>`;
      $toast.classList.remove('show'); void $toast.offsetWidth; $toast.classList.add('show');
      SFX.play('level');
      setTimeout(next, 3400);
    };
    next();
  }
  function checkTrophies() {
    for (const [id, icon, name, , earned] of TROPHIES) {
      if (S.trophies[id] || !earned()) continue;
      S.trophies[id] = true;
      S.money += TROPHY_PRIZE;
      toast(icon, `Trophy: ${name}`, `+${COIN}${TROPHY_PRIZE}`);
    }
  }
  // Coming back on a new day earns a small gift, bigger for each day in a row (up to a week).
  function dailyGift() {
    const day = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, today = day(new Date());
    if (!S.f.start || S.daily === today) return;
    S.streak = S.daily === day(new Date(Date.now() - 864e5)) ? (S.streak || 0) + 1 : 1;
    S.daily = today;
    const coins = 100 * Math.min(7, S.streak);
    S.money += coins;
    addItem('potion');
    toast('🎁', `Daily gift · day ${S.streak}`, `+${COIN}${coins} and a Potion`);
  }

  // ---------- HUD ----------
  let lastArea = null;
  function updateHud() {
    const name = CM.areaAt(S.map, S.x, S.y).name;
    $('area').textContent = name;
    // Any developer switch left on is spelled out, so it cannot be mistaken for how the game normally behaves.
    const cheats = S.dev ? [['noclip', 'walls off'], ['noWild', 'no wilds'], ['ohko', 'one-hit wins']].filter(([k]) => S.dev[k]).map(([, text]) => text) : [];
    $('coins').textContent = `${badgeCount()}/${TOTAL} badges · ${COIN}${S.money}${cheats.length ? ` · DEV: ${cheats.join(', ')}` : ''}`;
    $('goal').textContent = objective();
    // Walking into somewhere new announces it.
    if (name !== lastArea) {
      lastArea = name;
      const $place = $('place');
      $place.textContent = name;
      $place.classList.remove('show'); void $place.offsetWidth; $place.classList.add('show');
    }
    reveal();
    drawMap($('minimap'), 46);
    checkTrophies();
  }

  function goTo(map, x, y, dir = S.dir) {
    Object.assign(S, { map, x, y, dir, surf: false, bike: !!S.bike && map === 'world' });
    move = null;
    P = CM.initPuzzle(map, isDone(map));
    updateHud();
  }

  let idleSince = 0;     // when the player last moved or was busy; the title shows after standing still a while
  function update(dt) {
    if (mode !== 'world') { idleSince = performance.now(); return; }
    updateAlphas(dt);
    if (mode !== 'world') return;
    if (move) {
      idleSince = performance.now();
      move.t += dt / ((S.bike ? BIKE_STEP : WALK_STEP) * move.n);
      if (move.t >= 1) { [S.x, S.y] = move.pts[move.pts.length - 1]; move = null; onStep(); }
      return;
    }
    const dir = keys.arrowup || keys.w ? 'up' : keys.arrowdown || keys.s ? 'down'
      : keys.arrowleft || keys.a ? 'left' : keys.arrowright || keys.d ? 'right' : null;
    if (!dir) return;
    S.dir = dir;
    const warp = CM.WARPS[`${S.map}:${S.x + DIRS[dir][0]},${S.y + DIRS[dir][1]}`];
    if (warp && warp.need && warp.need(S)) return;
    // Walking in at a Creatastop's door opens the shop.
    const store = S.map === 'world' && CM.STOP_AT[`${S.x + DIRS[dir][0]},${S.y + DIRS[dir][1]}`];
    if (store) { for (const k in keys) keys[k] = false; shop = store; page = 'shop'; return openMenu(); }
    // A bike with floats rides straight out onto water.
    const afloat = S.bike && S.f.hydro && !S.surf && CM.charAt(S.map, S.x + DIRS[dir][0], S.y + DIRS[dir][1]) === '~';
    if (afloat) S.surf = true;
    let res = CM.step(S.map, P, S, S.x, S.y, dir, blocked);
    // Developer mode: walk through walls, water and locked gates. People still stand in the way.
    if (!res && S.dev && S.dev.noclip && !blocked(S.x + DIRS[dir][0], S.y + DIRS[dir][1])
      && MAPS[S.map].rows[S.y + DIRS[dir][1]] && MAPS[S.map].rows[S.y + DIRS[dir][1]][S.x + DIRS[dir][0]]) {
      res = { path: [[S.x + DIRS[dir][0], S.y + DIRS[dir][1]]], n: 1 };
    }
    if (res) move = { pts: [[S.x, S.y], ...res.path], t: 0, n: res.n };
    else if (afloat) S.surf = false;
  }
  // Milliseconds per tile on foot and on the bike.
  const WALK_STEP = 130, BIKE_STEP = 65;
  // Q hops on or off the bike. It is for the open road: not indoors, and no getting off in the middle of a lake.
  function toggleBike() {
    if (move) return;
    if (!S.f.bike) return talk('You do not have a bike yet.');
    if (S.map !== 'world') return talk('No cycling indoors!');
    if (S.surf && S.bike) return talk('You cannot get off your bike out on the water. Ride back to dry land first.');
    if (S.surf && !S.f.hydro) return talk('A bike would sink out here.');
    S.bike = !S.bike;
    save();
  }
  // Where the player is drawn right now, in tiles.
  const where = () => {
    if (!move) return [S.x, S.y];
    const at = Math.min(move.n - 1e-6, Math.max(0, move.t) * move.n), i = Math.floor(at), f = at - i;
    const [ax, ay] = move.pts[i], [bx, by] = move.pts[i + 1];
    return [ax + (bx - ax) * f, ay + (by - ay) * f];
  };

  async function onStep() {
    S.stats.steps++;
    const m = MAPS[S.map], ch = CM.charAt(S.map, S.x, S.y);
    if (S.surf && ch !== '~') S.surf = false;
    const warp = CM.WARPS[`${S.map}:${S.x},${S.y}`];
    if (warp || ch === 'E') {
      if (warp) goTo(warp.map, ...MAPS[warp.map].entry, 'up'); else goTo(...m.out, 'down');
      const to = MAPS[S.map];
      if (to.hint && !isDone(S.map)) await talk([to.hint, 'Press R to start the challenge over.']);
      return save();
    }
    updateHud();
    if (ch === 'H') {
      S.heal = [S.map, S.x, S.y];
      // A town whose heal pad you have stood on can be travelled back to from the Town Map.
      if (S.map === 'world') S.visited[`${S.x},${S.y}`] = CM.areaAt('world', S.x, S.y).name;
      if (S.party.some((c) => c.hp < CM.maxHp(c))) {
        healAll();
        SFX.play('heal');
        if (!S.tips.pad) { S.tips.pad = true; await talk('This is a heal pad. Step on one any time to restore your Creatamon for free. It also becomes the place you return to if you lose a battle.'); }
        await talk('The heal pad hums... your Creatamon are fully restored!');
      }
    }
    const found = pickupAt(S.x, S.y);
    if (found) {
      S.chests[`${S.map}:${S.x},${S.y}`] = true;
      await run(async () => {
        await tip('pickup', 'Sparkles on the ground are things to pick up. Just walk over them!');
        if (found.card) await giveCards([found.card]);
        else if (found.outfit) await giveClothes([found.outfit]);
        else if (found.item) await giveItems([found.item]);
        else {
          S.sprayOwned[found.spray] = true;
          await sayAll([`You found a spray-paint design: ${SPRAYS[found.spray]}!`, 'Pick a design in the menu, then press G to spray it on the ground in front of you.']);
        }
      });
    }
    const ev = CM.arrive(S.map, P, S.x, S.y);
    const twin = CM.teleAt(S.map, S.x, S.y);
    if (twin) { [S.x, S.y] = twin; $world.classList.remove('shake'); void $world.offsetWidth; $world.classList.add('shake'); }
    if (ev === 'shock') {
      await talk('Bzzt! You stepped on a charged panel. The whole grid resets!');
      [S.x, S.y] = m.entry;
    } else if (ev === 'solved') {
      S.solved[S.map] = true;
      await talk('Clunk! The gate to the Leader swings open.');
    }
    // Trainers have a field of view: step next to one, or within three clear tiles in front of them, and they challenge you.
    const eyes = hasFighter() && NPCS.find((n) => {
      if (n.map !== S.map || !n.team || S.beaten[n.id] || (n.show && !n.show(S)) || (n.need && n.need(S))) return false;
      const dx = S.x - n.x, dy = S.y - n.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) return true;
      if (dx || dy < 2 || dy > 3) return false;
      for (let y = n.y + 1; y < S.y; y++) if (!CM.passable(S.map, n.x, y, P, S) || npcAt(n.x, y)) return false;
      return true;
    });
    if (eyes) {
      SFX.play('alert');
      S.dir = eyes.x > S.x ? 'right' : eyes.x < S.x ? 'left' : eyes.y > S.y ? 'down' : 'up';
      await run(async () => { await say(`${eyes.name} spotted you!`); await trainer(eyes); });
      return save();
    }
    const habitat = CM.ZONE_OF[ch], area = CM.areaAt(S.map, S.x, S.y);
    if (habitat && area.lv && hasFighter() && !(S.dev && S.dev.noWild) && grace-- <= 0 && Math.random() < CM.ENCOUNTER_RATE) {
      grace = 3;
      await run(async () => {
        await tip('wild', ['Something rustles! Tall grass, flowers, forest floor and cave rubble hide wild Creatamon. Walking through them can start a battle at any step.',
          'Wild battles are how your Creatamon earn XP and grow, and wild Creatamon sometimes drop Power Cards. If yours is hurt, press Run to get away, and keep to the paths to avoid them.']);
        const foe = CM.genWild(area.wild || habitat, area.lv);
        // One in forty is shiny: strangely coloured, and it always leaves a card and a purse of coins.
        if (Math.random() < 1 / 40) foe.shiny = true;
        const result = await battle([foe], { zone: habitat });
        if (result === 'win') {
          if (foe.shiny) await shinyPrize(foe);
          const drop = CM.rollDrop(area.drops, Math.random, foe.rare || foe.shiny);
          if (drop) { await say(`The wild ${foe.name} dropped something...`); await giveCards([drop]); }
          // Now and then they leave a potion behind, or even a Creataball.
          const luck = Math.random();
          if (luck < 0.07) await giveItems(['creataball']);
          else if (luck < 0.35) await giveItems([area.lv[0] >= 44 ? 'max_potion' : area.lv[0] >= 22 ? 'super_potion' : 'potion']);
        } else if (result === 'lose') await whiteout();
      });
    }
    save();
  }

  async function shinyPrize(foe) {
    S.stats.shinies++;
    S.money += 500;
    SFX.play('coin');
    await say(`The shiny ${foe.name} left ${COIN}500 glittering in the grass!`);
  }
  async function whiteout() {
    $battle.hidden = true;
    await say('All your Creatamon fainted! You hurry back to the last heal pad...');
    await tip('lost', ['Losing costs you nothing: your Creatamon are healed and you can try again.',
      'To do better next time: use Potions from the Bag during battle, pick attacks the foe is weak to, slot more health cards at the Forge, or win a few easy battles first to level up.']);
    goTo(...S.heal, 'down');
    healAll();
  }

  // A battle against someone. Resolves true on a win; a loss sends the player back to the heal pad.
  async function duel(name, team, opts = {}) {
    const foes = opts.foes || (opts.boss ? team.map((t) => CM.spawn(...t)) : CM.makeTeam(name, team));
    const result = await battle(foes, { trainer: name, zone: bgZone(), max: S.map.startsWith('gym_'), ...opts });
    $battle.hidden = true;
    if (result === 'win') {
      S.stats.trainers++;
      if (!opts.boss) {
        const won = CM.prize(team, opts.big);
        S.money += won;
        SFX.play('coin');
        await say(`${name} paid out ${COIN}${won} for the win!`);
        await tip('money', `Beating trainers earns coins (${COIN}). Spend them at a Creatastop, the little red-roofed shop in most towns (walk in at its door), on potions, Creataballs, Power Cards and clothes.`);
      }
      return true;
    }
    await whiteout();
    return false;
  }
  // Battle backdrop for where the player is standing.
  const bgZone = () => {
    if (S.f.night && !S.f.dawn) return 'night';
    if (S.map !== 'world') return S.map === 'grove' ? 2 : 'in';
    const ground = CM.groundAt('world', S.x, S.y);
    return ground === 's' ? 7 : 'S_'.includes(ground) ? 3 : 1;
  };

  // Field moves: a Creatamon in the party that knows the move is summoned to use it.
  async function fieldMove(id, need, act) {
    // Whoever knows the move does it; failing that, holding the card is enough for the lead to manage.
    const user = S.party.find((c) => c.moves.includes(id)) || (S.cards[id] > 0 && S.party[0]);
    if (!user) return talk(`${need} You need the ${CARDS[id].name} card to get past.`);
    await run(async () => {
      await sayAll([`${S.player.name} summoned ${user.name}!`, `${user.name} used ${CARDS[id].name}!`]);
      $world.classList.remove('shake');
      void $world.offsetWidth;
      $world.classList.add('shake');
      act();
    });
  }

  async function interact() {
    if (move) return;
    const tx = S.x + DIRS[S.dir][0], ty = S.y + DIRS[S.dir][1], k = `${tx},${ty}`;
    const npc = npcAt(tx, ty);
    if (S.map === 'world' && CM.STOP_AT[k]) { shop = CM.STOP_AT[k]; page = 'shop'; return openMenu(); }
    if (npc) return run(() => meet(npc));
    const ch = CM.charAt(S.map, tx, ty);
    const warp = CM.WARPS[`${S.map}:${k}`], why = warp && warp.need && warp.need(S);
    if (why) return talk(why);
    if (P.blocks[k]) return talk({ o: 'A Fluffin from the gym flock. Walk into it to nudge it along.', C: 'A steel crate. Walk into it to push it.' }[P.blocks[k]] || 'A heavy boulder. Walk into it to push it.');
    if (ch === 'x' && !S.smashed[`${S.map}:${k}`]) {
      return fieldMove('rock_smash', 'The rock is riddled with cracks.', () => { S.smashed[`${S.map}:${k}`] = true; });
    }
    if (ch === '~' && !S.surf && S.f.hydro) return talk('Your bike has floats now. Press Q to hop on, then ride straight onto the water.');
    if (ch === '~' && !S.surf) {
      return fieldMove('surf', 'The water is deep and the current is strong.', () => {
        S.surf = true;
        S.bike = false;
        move = { pts: [[S.x, S.y], [tx, ty]], t: 0, n: 1 };
      });
    }
    if (ch === 'B') {
      const solved = CM.toggleFire(S.map, P, MAPS[S.map].fires.indexOf(k));
      if (solved) { S.solved[S.map] = true; return talk('All seven braziers roar to life. The gate to the Leader swings open!'); }
      return save();
    }
    if (ch === 'v' && !P.fill[k]) return talk('A deep pit. Something heavy might fill it.');
    if (ch === 'g' && !P.solved) return talk('The gate is locked until the gym challenge is complete.');
    if (ch === 'M') {
      return talk(S.f.mural
        ? 'Behind the broken mural stand statues far older: two young heroes, and at their sides two great wolves, one bearing a blade, one a guard.'
        : 'A grand mural of two young heroes facing a storm in the sky.');
    }
  }

  // Spray the chosen design on the ground ahead. Spraying over the same design cleans it off.
  const SPRAYABLE = '.=cSs_F';
  function spray() {
    if (move) return;
    const tx = S.x + DIRS[S.dir][0], ty = S.y + DIRS[S.dir][1], key = `${S.map}:${tx},${ty}`;
    if (!SPRAYABLE.includes(CM.charAt(S.map, tx, ty)) || blocked(tx, ty) || pickupAt(tx, ty)) return talk('There is no flat ground to spray on there.');
    if (S.sprays[key] === S.spray) delete S.sprays[key]; else S.sprays[key] = S.spray;
    save();
  }

  function resetPuzzle() {
    const m = MAPS[S.map];
    if (!m.puzzle || isDone(S.map) || move) return;
    P = CM.initPuzzle(S.map);
    [S.x, S.y] = m.entry;
    talk('You start the gym challenge over.');
  }

  // ---------- Story ----------
  const flag = (name) => { S.f[name] = true; };
  const you = () => S.player.name;

  // What to do next, shown in the menu.
  // What to do next, and where: [text, map, x, y]. The spot drives the guide arrow and the map marker.
  function quest() {
    const f = S.f, b = S.badges, at = (id) => { const n = CM.NPCS.find((p) => p.id === id); return [n.map, n.x, n.y]; };
    const gym = (el) => [`gym_${el}`, ...MAPS[`gym_${el}`].leader];
    const steps = [
      [!S.party.length, 'Forge your first Creatamon from your Power Cards.'],
      [!f.rival1, 'Battle Finn outside your house in Hearthwick.', ...at('finn_home')],
      [!f.grove, 'A Fluffin broke through the gate west of Hearthwick. Follow it into the Drowsing Grove.', ...at('beast')],
      [!f.endorsed, 'Take Route 1 east to Wedgemoor and battle Finn in front of the Champion.', ...at('finn_wedge')],
      [!f.ceremony, 'Go north through the Wildlands to Kilnford for the opening ceremony.', ...at('staff')],
      [!b.Grass, 'Head west from Kilnford through Gritstone Mine to the Grass gym in Furrowfield.', ...gym('Grass')],
      [!b.Water, 'Cross the bridge north of Furrowfield to the Water gym in Brinemouth.', ...gym('Water')],
      [!b.Fire, 'Take Brinecut Tunnel east of Brinemouth back to Kilnford and its Fire gym.', ...gym('Fire')],
      [!b.Wind, 'Cross the Windswept Steppe, south off Route 3, to the Wind gym in Galeholt.', ...gym('Wind')],
      [!b.Rock, 'Go east through Anvilgate and along Route 6 to the Rock gym in Cairnside.', ...gym('Rock')],
      [!f.mural, 'Something crashed by the old mural in Cairnside. Take a look.', ...at('cyril_mural')],
      [!b.Electric, 'Cross the Gloamwood, south off Route 6, to the Electric gym in Lumenlea.', ...gym('Electric')],
      [!b.Metal, 'Climb the Ironway, north off the Forgeway, to the Metal gym in Steelspire. Bring Rock Smash.', ...gym('Metal')],
      [!f.rival3, 'Finn is waiting at the north gate of Anvilgate.', ...at('finn_r7')],
      [!b.Ice, 'Follow Route 7 north from Anvilgate to the Ice gym in Frosthollow.', ...gym('Ice')],
      [!f.surf, 'Talk to Wren by the Hero\'s Bath in Frosthollow.', ...at('wren_bath')],
      [!b.Shadow, 'Ride your bike (press Q) across the river on Route 9, east of Frosthollow, to the Shadow gym in Thornmuth.', ...gym('Shadow')],
      [!b.Mind, 'Take Route 14 east out of Thornmuth to the Mind gym in Reverie.', ...gym('Mind')],
      [!b.Robot, 'Leave Reverie by its south gate and follow Route 15 to the Robot gym in Cogsworth.', ...gym('Robot')],
      [!b.Light, 'Take Route 16 south from Cogsworth to the Light gym in Solhaven.', ...gym('Light')],
      [!b.Toxic, 'Follow Route 17 down into the fen to the Toxic gym in Mirefen.', ...gym('Toxic')],
      [!b.Normal, 'Go back through Solhaven and west past Lumenlea to Anvilgate for the final badge.', ...gym('Normal')],
      [!f.semis, 'Take Route 10 south from Anvilgate to Summit City and enter the Champion Cup.', ...at('registrar')],
      [!f.opaline, 'Champion Vex is at Sterling Tower in the east of Summit City.', ...at('opaline')],
      [!f.night, 'Win the Champion Cup finals at the Summit City stadium.', ...at('registrar')],
      [!f.blade, 'Leave Summit City by the west gate and hurry to the altar deep in the Drowsing Grove.', ...at('altar')],
      [!f.dawn, 'Stop Chairman Sterling at the Energy Plant in Anvilgate.', ...at(f.sterling ? 'eternox' : 'sterling')],
      [CM.alphaRank(S.alphaWins) < CM.CUP_RANK, `The Champion only faces challengers ranked ${CM.ALPHA_TITLES[CM.CUP_RANK - 1]} or higher. Defeat alpha Creatamon, the big red ones that roam near long grass (${S.alphaWins || 0}/${CM.ALPHA_NEED[CM.CUP_RANK - 1]}).`],
      [!f.champion, 'Champion Vex is waiting for you at the Summit City stadium.', ...at('registrar')],
    ];
    const next = steps.find((st) => st[0]);
    return next ? next.slice(1) : ['You are the Champion of Galdra! Keep collecting cards and filling the Creatadex.'];
  }
  const objective = () => quest()[0];
  // Where the guide should point on the map the player is standing in: the goal itself, or the door on the way to it.
  function waypoint() {
    const [, map, x, y] = quest();
    if (!map) return null;
    if (map === S.map) return [x, y];
    if (S.map !== 'world') return MAPS[S.map].exit;
    const door = Object.keys(CM.WARPS).find((k) => CM.WARPS[k].map === map);
    return door ? door.split(':')[1].split(',').map(Number) : null;
  }

  // What happens right after each badge.
  const AFTER_BADGE = {
    Grass: ['Wren: Nicely done! Did you see the hill carving outside? A giant in a storm of black cloud. The old stories call it the Blackest Night.',
      'Wren: Brinemouth and the Water gym are north, over the bridge.'],
    Water: ['Chairman Sterling was watching from the stands. "A splendid match! Do come and see me in Brinemouth."'],
    Fire: ['Three badges! The Windswept Steppe is open to you now: head west along Route 3, then south. Galeholt lies beyond it.'],
    Wind: ['Four badges! The League staff at Anvilgate, east of Kilnford, will let you through now.'],
    Metal: ['Leader Forge: Finn came through here asking after you. Said he would wait at the north gate of Anvilgate.'],
    Mind: ['Leader Sibyl: I see a road south of Reverie, and three towns you have never heard of: Cogsworth, Solhaven and Mirefen.',
      'Leader Sibyl: The League staff at our south gate will let you through now.'],
    Robot: ['Leader Axle: Solhaven is south of here, down Route 16. Bring something to shade your eyes.'],
    Light: ['Leader Aurelia: The fen road to Mirefen is open to you. It is as dark down there as it is bright up here.'],
    Toxic: ['Leader Brack: One badge left, and it is the hard one. Brann, in Anvilgate.',
      'Leader Brack: The short cut west of Solhaven is open to you now: it comes out in Lumenlea.'],
    Rock: ['CRASH! Something shakes the cliffs outside. It came from the old mural.'],
    Electric: ['Madame Ohm: I have been looking for a successor, you know. That sulky boy Cyril has just the right amount of spite.',
      'Madame Ohm: Off you go, dearie. Steelspire next: north off the Forgeway. Mind the Ironway, it is all rock.'],
    Ice: ['Wren sent word: she has found something at the Hero\'s Bath, here in Frosthollow.'],
    Shadow: ['As you step outside, the ground shudders. Far off, a red glow pulses over Anvilgate, then fades.',
      'Rook: That is the third quake this week. Something is wrong at the Energy Plant.',
      'Rook: Team Holler will let you out the east side now. Reverie and its gym are that way.'],
    Normal: ['Every badge in Galdra! Route 10, south of Anvilgate, is open to you. Summit City and the Champion Cup await.'],
  };

  async function leader(npc) {
    const gm = npc.gym;
    if (S.badges[gm.el]) return sayAll(`${gm.name}: That battle of ours is still the talk of ${gm.town}.`);
    // Later gyms make you get through the Leader's trainers first, back to back. Ones already beaten stay beaten.
    for (let i = S.trials[gm.el] || 0; i < gm.trainers.length; i++) {
      await say(i ? `${gm.name}: And the next! No rest in my gym.`
        : `${gm.name}: Not so fast. Nobody battles me without getting past my gym trainer${gm.trainers.length > 1 ? `s, all ${gm.trainers.length} of them` : ''}!`);
      if (!await duel(`${gm.town} Gym Trainer`, gm.trainers[i], { zone: 'in', skill: gm.skill })) return;
      S.trials[gm.el] = i + 1;
      save();
    }
    await say(`${gm.name}: ${gm.pre}`);
    if (!await duel(gm.name, gm.team, { zone: 'in', foeMax: true, big: true, skill: gm.skill, foes: CM.gymTeam(gm) })) return;
    S.badges[gm.el] = true;
    SFX.play('badge');
    S.solved[S.map] = true;
    await sayAll([`${gm.name}: ${gm.post}`, `You received the ${gm.el} Badge! That makes ${badgeCount()} of ${TOTAL}.`]);
    await giveCards(gm.reward);
    const n = CM.GYM_ORDER.indexOf(gm.el), brew = n >= 8 ? 'max_potion' : n >= 3 ? 'super_potion' : 'potion';
    await giveItems(['creataball', brew, brew]);
    await sayAll(AFTER_BADGE[gm.el]);
  }

  async function trainer(npc) {
    if (S.beaten[npc.id]) return say(`${npc.name}: ${npc.post}`);
    if (!hasFighter()) return say(`${npc.name}: Come back with a Creatamon that can fight.`);
    const wait = npc.need && npc.need(S);
    if (wait) return say(wait);
    await say(`${npc.name}: ${npc.pre}`);
    if (!await duel(npc.name, npc.team)) return;
    S.beaten[npc.id] = true;
    await say(`${npc.name}: ${npc.post}`);
    await giveCards(npc.reward || []);
    if (npc.outfit) await giveClothes(npc.outfit);
  }

  // The Normal gym's challenge: a question from the type chart. A wrong answer costs a battle.
  async function quiz(npc) {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const els = Object.keys(ELEMENTS).filter((e) => !ELEMENTS[e].hidden);
    const att = pick(els.filter((e) => CM.STRONG[e].length)), target = pick(CM.STRONG[att]);
    const wrong = els.filter((e) => !CM.STRONG[e].includes(target)).sort(() => Math.random() - 0.5).slice(0, 2);
    const options = [att, ...wrong].sort(() => Math.random() - 0.5);
    const d = await pickButton(`<div class="moves ask"><p>Gatekeeper: Which of these hits <b>${target}</b> Creatamon for super-effective damage?</p>${options.map((o) =>
      `<button data-pick="${o}" style="border-left-color:${ELEMENTS[o].color}"><b>${o}</b></button>`).join('')}</div>`);
    if (d.pick === att) {
      S.quiz = npc.quiz;
      return say('Gatekeeper: Correct! On you go.');
    }
    await say(`Gatekeeper: Wrong! ${att} was the answer. A battle should sharpen you up.`);
    if (await duel('Gatekeeper', TEAMS.quiz, { zone: 'in' })) await say('Gatekeeper: Now, ask me again and I shall have a new question.');
  }

  // Stadium matches allow Max Mode on both sides, like a gym.
  const CUP = { max: true, foeMax: true };
  const SCRIPTS = {
    mum: async () => {
      healAll();
      await sayAll(['Mum: You look worn out, love. Sit down a minute.', 'Your Creatamon are fully rested!',
        S.f.champion ? 'Mum: My child, the Champion. I always knew.' : 'Mum: Off you go, then. Make Hearthwick proud.']);
    },
    vex_home: () => say(S.party.length
      ? 'Champion Vex: Finn is itching for a battle. Go and show him what you forged.'
      : 'Champion Vex: Open the menu (press M) and forge a Creatamon from those cards first.'),
    finn_home: async () => {
      if (!hasFighter()) return say('Finn: Forge your Creatamon first! Press M.');
      await say('Finn: I forged mine already. Our first ever battle. Ready?');
      if (!await duel('Finn', TEAMS.finn1)) return;
      await sayAll(['Finn: Whoa. You are good at this!', 'Champion Vex: A fine first battle, both of you.',
        'BANG! Something slams into the old gate at the edge of town.',
        'Finn: A Fluffin just rammed the gate to the Drowsing Grove and ran inside! Nobody is allowed in there. Come on!']);
      flag('rival1');
    },
    finn_grove: () => say('Finn: The Fluffin went deeper in. This fog is getting thick... stay close, yeah?'),
    beast: async () => {
      await sayAll(['The fog closes in until you cannot see Finn at all.', 'Something is standing in it. Watching you.']);
      const ghost = CM.create({ name: '???', element: 'Normal', shape: 'Beast', moves: ['tackle'], level: 70 });
      await battle([ghost], { zone: 2, phantom: true });
      $battle.hidden = true;
      await sayAll(['The fog swallows everything...', '...', `Champion Vex: Finn! ${you()}! There you are.`,
        'Champion Vex: The Fluffin is safe. But nobody goes into the Grove, and now you know why.',
        'Finn: There was a creature in the fog. Our attacks went straight through it!',
        'Champion Vex: Hm. You both stood your ground. I like that.',
        'Champion Vex: Come to Prof. Willow\'s lab in Wedgemoor, east along Route 1. Show me one great battle and I will endorse you both for the Gym Challenge.']);
      flag('grove');
      goTo('world', 6, 90, 'right');
      healAll();
    },
    fogwall: () => say('The fog here is too thick to walk through.'),
    altar: async () => {
      if (!S.f.night) return say('A worn stone altar, deep in the fog. Two shapes lie on it, rusted and forgotten: a blade and a guard.');
      if (S.f.blade) return say('The altar is bare now.');
      await sayAll(['Finn: This is it. The blade and the guard from the old stories. They look like scrap...',
        'You lift the Rusted Blade. It is heavier than it looks, and faintly warm.', 'Finn takes the Rusted Guard.',
        'For a moment, two wolf-shaped shadows stand in the fog. Then they are gone.',
        'Finn: Even if they are just rusty junk, they are all we have. Sterling is at the Energy Plant in Anvilgate. Let us go!']);
      flag('blade');
    },
    finn_altar: () => say('Finn: The fog has lifted. Look, on the altar!'),
    willow: async () => {
      if (S.f.grove && !S.f.endorsed) {
        return sayAll(['Prof. Willow: So you two met something in the Grove. My granddaughter Wren studies those old legends.',
          'Prof. Willow: Finn is outside with his brother. The Champion wants to see you battle.']);
      }
      await sayAll(['Prof. Willow: Power Cards hide in chests, and wild Creatamon sometimes drop them. Rare ones always do.',
        'Match a move\'s element to your Creatamon\'s element for extra power.',
        'Some cards work outside battle too. Rock Smash breaks cracked rocks, and Surf carries you over water.',
        'You can rebuild a Creatamon at the Forge for a Creataball, and even give it a picture of your own. Press M.']);
    },
    finn_wedge: async () => {
      await say('Finn: My brother is watching. I am not holding back this time!');
      if (!await duel('Finn', TEAMS.finn2)) return;
      await sayAll(['Finn: Two losses! You are going to make me a better trainer whether I like it or not.',
        'Champion Vex: THAT is what I wanted to see. You have my endorsement, both of you.',
        'Champion Vex: The Gym Challenge opens in Kilnford. Go north by Route 2 and across the Wildlands. I will be watching.',
        'You received a Letter of Endorsement!']);
      await giveCards(['hp30', 'scratch']);
      flag('endorsed');
      flag('bike');
      await sayAll(['Champion Vex: One more thing. Galdra is a big place, and the roads between gyms are long. Take this.',
        'You got a Bike!',
        'Press Q to hop on your bike, and Q again to get off. Riding is twice as fast as walking.',
        'You steer it just like walking, and you can still talk to people and pick things up. Wild Creatamon can still jump out at you in tall grass.',
        'The bike is for outdoors only: you get off by yourself when you go through a door.']);
    },
    guard_r2: () => say('League Staff: Route 2 leads to the Wildlands and Kilnford. Only endorsed challengers may pass.'),
    gate_summit: async () => {
      if (badgeCount() < TOTAL) return say(`Gatekeeper: Beyond this gate lies Summit City, home of the Champion Cup. It opens only for holders of all ${TOTAL} badges.`);
      await say('Gatekeeper: Every badge! The gate between Wedgemoor and Summit City is open to you now.');
      flag('shortcut');
    },
    staff: async () => {
      await sayAll(['League Staff: Endorsed challengers, this way! The opening ceremony is starting.',
        'You walk out onto the pitch. The crowd roars.',
        `Chairman Sterling: Welcome, one and all, to the Gym Challenge! ${TOTAL} gyms. ${TOTAL} badges. One Champion Cup!`,
        'One by one the Gym Leaders take the field: Thatch, Marina, Cinder, Zephyra, Gneiss, Madame Ohm, Forge, Rime, Sibyl, Axle, Aurelia, Brack and Brann. The Thornmuth Leader has not turned up.',
        'Cyril: So you are the Champion\'s pick. I was endorsed by the Chairman himself. Try not to get in my way.',
        'Nettie: Ignore him. I am Nettie. Sorry about the noisy lot in pink, that is Team Holler. They... sort of follow me around.',
        'Wren: I am Wren, Prof. Willow\'s granddaughter. The mine to the west is full of cracked rocks, so take this.']);
      await giveCards(['rock_smash']);
      await giveClothes(['jersey']);
      await say('Wren: Slot Rock Smash onto a Creatamon and it can break those rocks. The Grass gym in Furrowfield is past the mine. Good luck!');
      flag('ceremony');
    },
    guard_tunnel: () => say('League Staff: Brinecut Tunnel is for challengers who have beaten Leader Marina. Win the Water Badge and I will let you through.'),
    guard_r3: () => say('League Staff: The opening ceremony is about to begin at the gym hall. Every challenger must attend!'),
    holler_r4: () => say('Team Holler Grunt: Route 4 is SHUT. We are rehearsing our cheers for Nettie! Come back when you have the Water Badge or something.'),
    nettie_kiln: async () => {
      await say('Nettie: Before you take on Cinder, battle me. I need to know how far I have got to go.');
      if (!await duel('Nettie', TEAMS.nettie1)) return;
      await sayAll(['Nettie: ...Further than I thought. Fine. I will be Champion anyway, for Thornmuth.', 'Nettie: Go on. The gym is right behind me.']);
      await giveCards(['night_claw']);
      flag('nettie1');
    },
    cyril_mine: async () => {
      await say('Cyril: The Chairman asked me to gather star shards from this mine. You are in my way. Shall I show you how weak you are?');
      if (!await duel('Cyril', TEAMS.cyril1)) return;
      await say('Cyril: I see. I was only testing you, of course. The Chairman chose ME. Remember that.');
      flag('cyril1');
    },
    wren_glyph: () => sayAll(['Wren: See the carving on the hill? Thousands of years old. A giant Creatamon, and a storm of black cloud.',
      'Wren: Gran says it shows the Blackest Night, when something terrible nearly ended Galdra. Two heroes stopped it. Or so the story goes.']),
    sterling_brine: () => sayAll(['Chairman Sterling: Ah, our promising challenger! I watched your match with Marina.',
      'Chairman Sterling: Do you know how Galdra is powered? In a thousand years the energy will run dry. A thousand years is no time at all.']),
    guard_anvil: () => say('League Staff: Anvilgate admits only challengers holding four badges.'),
    guard_steppe: () => say('League Staff: The Windswept Steppe is no place for beginners. Three badges, then we talk.'),
    guard_iron: () => say('League Staff: The Ironway is closed to anyone with fewer than six badges. Falling rocks, you understand.'),
    holler_east: () => say('Team Holler Grunt: Nobody leaves Thornmuth by the east road till our Rook has had his match with you!'),
    wren_vault: async () => {
      await sayAll(['Wren: The Anvilgate vault holds four old tapestries. Two youths see a falling star. Disaster comes. They take up a blade and a guard. They are crowned.',
        'Wren: Everyone says ONE hero saved Galdra. So why do the tapestries show two?']);
      flag('vault');
    },
    sterling_anvil: () => sayAll(['Chairman Sterling: This Energy Plant keeps every light in Galdra burning.',
      'Champion Vex: And it can wait until after the Cup, Chairman.', 'Chairman Sterling: Can it, though?']),
    finn_r7: async () => {
      if (badgeCount() < 7) {
        return sayAll(['Finn: Cyril beat me. Said I was dragging my brother\'s name through the mud.',
          'Finn: I need to work out what kind of trainer I am. Come back with seven badges and I will give you a proper battle.']);
      }
      await say('Finn: I have stopped trying to be my brother. This is MY team now. Have at you!');
      if (!await duel('Finn', TEAMS.finn3)) return;
      await sayAll(['Finn: Ha! Still cannot beat you. But that felt like me out there.', 'Finn: Frosthollow is up the hill. Race you to the Cup!']);
      await giveCards(['hp250']);
      flag('rival3');
    },
    guard_r10: () => say(`League Staff: Route 10 leads to Summit City and the Champion Cup. All ${TOTAL} badges, no exceptions.`),
    cyril_mural: async () => {
      await sayAll(['A huge Creatamon is ramming the ancient mural. Cyril is urging it on.',
        'Cyril: There are star shards behind this wall. The Chairman needs them. Stay out of it!']);
      if (!await duel('Cyril', TEAMS.cyril2)) return;
      flag('mural');
      await sayAll(['The mural cracks from top to bottom and crashes down.',
        'Behind it stand statues far older: two young heroes, and two great wolves, one bearing a blade, one a guard.',
        'Opaline: Cyril. The Chairman is deeply embarrassed. Hand over your challenge band. You are out.',
        'Wren: Two heroes AND two Creatamon. The blade and the guard were never weapons. They were beasts!']);
    },
    holler_gloam: () => say('Team Holler Grunt: Gloamwood is closed, mate! Nettie is training in there. ...Did you hear something break in Cairnside?'),
    wren_bath: async () => {
      if (!S.badges.Ice) {
        return sayAll(['Wren: This pool is the Hero\'s Bath. They say the two heroes rested here after the Blackest Night.',
          'Wren: I am close to something. Beat the gym and come back.']);
      }
      if (S.f.surf) return say('Wren: The beasts of the blade and guard fell asleep somewhere after the battle. Where would be quiet enough?');
      await sayAll(['Wren: Listen to this. The heroes and their two beasts beat the Blackest Night together, and then the beasts went to sleep. Somewhere foggy and forgotten.',
        'Wren: Thornmuth is across the river and there is no bridge. Take this.']);
      await giveCards(['surf']);
      flag('surf');
      flag('hydro');
      await sayAll(['Wren: And lend me your bike a second. ...There! I have fitted it with floats.',
        'Your Bike was upgraded: it can now ride on water!',
        'To cross water, press Q to get on your bike and simply ride onto it. You cannot get off until you are back on land.',
        'Wren: Or slot that Surf card onto a Creatamon, face the water and press Enter, and it will carry you instead. Your choice.']);
    },
    holler_gate: async () => {
      await say('Team Holler Grunt: Thornmuth is CLOSED! If no challengers get in, only Nettie gets the badge. Genius, right? ...You want to fight about it?');
      if (!await duel('Team Holler Grunt', TEAMS.holler)) return;
      await say('Team Holler Grunt: All right! We just wanted folk to notice our town again...');
      flag('holler');
    },
    nettie_thorn: async () => {
      await say('Nettie: You got past them? Sorry. Team Holler are just the gym trainers here. My brother Rook is the Leader. Battle me first, though.');
      if (!await duel('Nettie', TEAMS.nettie2)) return;
      await say('Nettie: Yeah. You are the real thing. Go and wake my brother up.');
      flag('nettie2');
    },
    registrar: async () => {
      const f = S.f;
      if (f.champion) return say('Cup Registrar: Champion! All of Galdra is still cheering.');
      if (!f.semis) {
        await say('Cup Registrar: Welcome to the Champion Cup! Your semi-final bracket: Nettie of Thornmuth, then Finn of Hearthwick.');
        if (!f.semi1) {
          await say('Nettie: For Thornmuth. No hard feelings.');
          if (!await duel('Nettie', TEAMS.nettie3, CUP)) return;
          flag('semi1'); healAll(); save();
          await say('Nettie: Win it all, then. Or I will be cross.');
        }
        await say('Finn: I always knew it would be us two. Everything I have got!');
        if (!await duel('Finn', TEAMS.finn4, CUP)) return;
        flag('semis'); healAll();
        return sayAll(['Finn: Beat my brother for me. I mean it.', 'That evening Champion Vex was meant to take you both to dinner. He never came.',
          'Cup Registrar: The Champion was called to Sterling Tower, on the east side of the city.']);
      }
      if (!f.opaline) return say('Cup Registrar: The finals are tomorrow. The Champion is still at Sterling Tower, east of here.');
      if (!f.night) {
        const rounds = [
          ['Cyril', TEAMS.cyril3, 'Cyril bursts onto the pitch. "I was thrown out! But Madame Ohm trained me, and I will prove it. One match!"'],
          ['Leader Marina', TEAMS.marina2, 'Cup Registrar: Finals, round one: Leader Marina!'],
          ['Leader Gneiss', TEAMS.gneiss2, 'Cup Registrar: Round two: Leader Gneiss!'],
          ['Leader Brann', TEAMS.brann2, 'Cup Registrar: The last round before the Champion: Leader Brann!'],
        ];
        f.finals = f.finals || 0;
        while (f.finals < rounds.length) {
          const [name, team, pre] = rounds[f.finals];
          await say(pre);
          if (!await duel(name, team, CUP)) return;
          f.finals++; healAll(); save();
        }
        await sayAll(['Champion Vex walks out to face you. The crowd is deafening.', 'Then every screen in the stadium flickers.',
          'Chairman Sterling: Forgive the interruption. I have woken Eternox, and brought about the Blackest Night, to secure our energy for all time.',
          'Chairman Sterling: Unfortunately it is... rather beyond my control. Champion, do come and help.',
          'The sky turns black. Red light pours from the direction of Anvilgate. Vex runs for the exit.',
          'Finn: The blade and the guard! Wren said the beasts went to sleep somewhere foggy. The GROVE! Come on, the west gate!']);
        return flag('night');
      }
      if (!f.dawn) return say('Cup Registrar: The final is suspended! Your friend Finn ran for the west gate, shouting about the Drowsing Grove.');
      if (CM.alphaRank(S.alphaWins) < CM.CUP_RANK) {
        return sayAll([`Cup Registrar: The Champion only accepts challengers who hold the rank of ${CM.ALPHA_TITLES[CM.CUP_RANK - 1]} or higher.`,
          `Cup Registrar: You are ${myTitle() || 'unranked'}. Rank is earned by defeating alpha Creatamon, the huge ones that prowl near long grass. You have beaten ${S.alphaWins || 0} of the ${CM.ALPHA_NEED[CM.CUP_RANK - 1]} you need.`]);
      }
      await sayAll(['Three days later, the stadium is full to the rafters.',
        'Champion Vex: You saved Galdra. But that is not why they are here. They came to see whether anyone can beat me. Let us give them a Champion-time match!']);
      if (!await duel('Champion Vex', TEAMS.vex, CUP)) return;
      flag('champion');
      S.champAt = S.alphaWins || 0;
      await sayAll(['Champion Vex: ...My unbeaten run ends here. I could not be prouder to lose.', `${you()} is the new Champion of Galdra!`,
        'Your title is now Champion I! Every five alphas you beat from here adds a numeral: Champion II, III, IV and on, for as long as you keep winning.']);
      await giveCards(['inferno_crash', 'hyper_burst', 'hp250']);
      await giveClothes(['crown', 'champion_cape']);
      await say('Thank you for playing Creatamon! The world stays open: keep forging, collecting and exploring.');
    },
    opaline: async () => {
      await say('Opaline: The Chairman is in a private meeting with the Champion. I cannot allow anyone up. Especially not you.');
      if (!await duel('Opaline', TEAMS.opaline)) return;
      await sayAll(['At the top of the tower, Sterling and Vex are arguing.',
        'Chairman Sterling: The energy crisis cannot wait one more day! With enough star shards I can wake Eternox tonight.',
        'Champion Vex: It can wait until after the final. I will help you then. You have my word.',
        'Champion Vex: Sorry about dinner. Get some sleep. Tomorrow you win the finals, and then you face me.']);
      flag('opaline');
    },
    sterling: async () => {
      await sayAll(['Chairman Sterling: You came all this way. Even the Champion could not hold it. He is on the roof now, buying us minutes.',
        'Chairman Sterling: I did this for Galdra\'s future. I will not be stopped by children with scrap metal!']);
      if (!await duel('Chairman Sterling', TEAMS.sterling, { zone: 'night' })) return;
      await say('Chairman Sterling: ...Go. Whatever you can do up there, do it.');
      flag('sterling');
    },
    eternox: async () => {
      await sayAll(['On the roof, Champion Vex is on one knee. Above him coils a vast, skeletal serpent wrapped in red light.',
        'Champion Vex: I could not hold it. Be careful!']);
      if (!await duel('Eternox', TEAMS.eternox1, { boss: true, zone: 'night' })) return;
      healAll();
      await sayAll(['Eternox drinks in the energy of the whole plant and swells until it blots out the sky.',
        'Your Creatamon attack, but nothing lands. The air itself is too heavy to move in.',
        'Finn: The blade! The guard! Hold them up!', 'The rust burns away in a flash of light. A howl answers from far off.',
        'Two great wolves bound across the rooftops, one with a blade in its jaws, one maned like a shield. They stand beside you.',
        'Your Creatamon are fully restored!']);
      if (!await duel('Eternox', TEAMS.eternox2, { boss: true, zone: 'night', ally: 'The wolves of blade and guard strike alongside you!' })) return;
      flag('dawn');
      await sayAll(['Eternox bursts into light and scatters. The black sky tears open and the sun comes through.',
        'The two wolves look at you for a long moment, then turn and vanish into the morning.',
        'What is left of Eternox settles into your hands as Power Cards.']);
      await giveCards(['endless_ray', 'dawnblade', 'hp250']);
      await say('Champion Vex: You did what I could not. Rest up. In three days, we finish our final at Summit City.');
      goTo('world', 61, 38, 'down');
    },
  };

  async function meet(npc) {
    if (npc.line) return say(npc.line);
    if (npc.sign) {
      const n = CM.GYM_ORDER.indexOf(npc.el), short = n - badgeCount();
      return say(`${npc.name}. ${npc.sign.name} awaits challengers. ${S.badges[npc.el] ? 'Your name is already on the roll of winners!'
        : short > 0 ? `Challengers need ${n} badge${n === 1 ? '' : 's'}: you are ${short} short.` : 'The doors are open to you.'}`);
    }
    if (npc.gym) return leader(npc);
    if (npc.quiz) return quiz(npc);
    if (SCRIPTS[npc.id]) return SCRIPTS[npc.id](npc);
    if (npc.team) return trainer(npc);
  }

  // The controls, shown at the very start and again from the menu's How to play button.
  const HOW_TO = [
    ['The idea', 'Creatamon are creatures that battle for you by trading attacks in turns. Beat the Leader of all 14 gyms, then win the Champion Cup.'],
    ['Words', 'HP is health: at 0 a Creatamon faints. XP is experience: enough of it raises a level, which makes a Creatamon stronger. A badge is the prize for beating a gym.'],
    ['Move', 'Arrow keys or W A S D.'],
    ['Talk, read, use', 'Face something and press Enter (or Space, or Z). The same key moves text along.'],
    ['Inventory', 'Press E to see your items and unused Power Cards at any time.'],
    ['Menu', 'Press M or Esc. Your next goal is at the top; your party, Forge, Bag, Wardrobe and sprays are below it.'],
    ['Forge', 'Creatamon are built, not caught. Each holds up to six move cards and as many health cards as you like. Forging a new Creatamon costs a Creataball, and so does rebuilding one.'],
    ['Battle', 'Pick a move. Matching a move to your Creatamon\'s element hits harder, and so does hitting a weakness. Bag uses a potion; Switch swaps Creatamon.'],
    ['Grow', 'Every Creatamon of yours that attacked a foe earns XP when it faints (and any party member under level 10 earns it too, without fighting), up to a level limit that rises with each badge. At levels 16 and 36 a Creatamon can Evolve from the menu for free health and stronger attacks. Give each one an item to hold.'],
    ['Pick-ups', 'Sparkles on the ground are cards, items, clothes and spray designs. Walk over them.'],
    ['Heal', 'Step on a pink heal pad to restore your whole party. If everyone faints you return to the last pad you used.'],
    ['Gyms', 'Each town\'s gym has a puzzle before its Leader. Press R to start a puzzle over. In gyms you can use Max Mode once per battle.'],
    ['Bike', 'Once the Champion gives you a bike, press Q outdoors to hop on or off. It is twice as fast as walking. Later it gets floats: then just ride onto water to cross it.'],
    ['Alphas', 'Huge red-glowing alpha Creatamon prowl near long grass. If one spots you it charges; if it touches you, you battle. They are tough, but beating them raises your Champion rank (Alpha I up through King, Emperor, Conqueror, Warlord, Legend and Mythic), which the Champion demands. Champions keep climbing: Champion II, III, IV... Stand still to show your title.'],
    ['Trainers', 'Trainers on the routes watch the road. Step right beside one, or up to three tiles in front of them, and they challenge you. Once beaten they leave you alone.'],
    ['Fast travel', 'Once you have stood on a town\'s heal pad, the Town Map in the menu can take you straight back there.'],
    ['Extras', 'Trophies pay coins for milestones. One wild Creatamon in forty is shiny and leaves a purse of coins. Come back each day for a small gift. Your Trainer Card keeps your records.'],
    ['Field moves', 'Rock Smash breaks cracked rocks and Surf crosses water: once you hold the card (no need to slot it), face the obstacle and press Enter.'],
    ['Spray paint', 'Press G to spray your chosen design on the ground in front of you.'],
  ];
  async function intro() {
    await run(async () => {
      await sayAll(['Welcome to Creatamon! Press Enter, or click or tap this box, to read on.',
        'Creatamon are creatures that battle for you. Your goal: beat the Leader of all 14 gyms, then win the Champion Cup.',
        'Walk with the arrow keys or W A S D. To talk to someone, face them and press Enter. The bar at the top always says where to go next, and a red arrow points the way.']);
      await sayAll([`Finn: ${you()}! There you are! My big brother is home. THE Champion Vex!`,
        'Champion Vex: So this is the friend Finn never stops talking about.',
        'Champion Vex: In Galdra, Creatamon are not caught. They are created: you build one yourself out of Power Cards.',
        'There are two kinds of card. A move card is an attack your Creatamon can use in battle. A health card gives it more HP, so it can take more hits before it faints.',
        `Champion Vex: I brought a starter set for each of you. Go on, ${GENDERS[S.player.gender].title}: forge your very first Creatamon!`]);
      CM.STARTER_CARDS.forEach((id) => addCard(id));
      addItem('creataball', 2);
      addItem('potion', 3);
      await sayAll(['You got 6 Power Cards, 2 Creataballs and 3 Potions!',
        'Champion Vex: A Creataball is what a new Creatamon is forged inside. Each new one you make uses up a ball, and so does rebuilding one, so spend them wisely.',
        'The Forge is about to open. Follow the numbered steps at the top of it.']);
      flag('start');
      openMenu();
      openForge(null);
    });
  }

  // ---------- Battle ----------
  // In Max Mode the easter egg is someone else.
  const shownName = (c) => (c.max && CM.isEgg(c) ? CM.EGG.maxName : c.name);
  const hpClass = (f) => (f > 0.5 ? '' : f > 0.2 ? 'mid' : 'low');
  function renderBattle() {
    const { me, foe } = B;
    $('foeName').textContent = `${foe.shiny ? '✨ ' : foe.rare ? '✦ ' : ''}${shownName(foe)}`;
    $('foeSprite').classList.toggle('shiny', !!foe.shiny);
    $('foeLv').textContent = `Lv ${foe.level} · ${foe.element}${foe.max ? ' · MAX' : ''}`;
    $('meName').textContent = shownName(me);
    $('meLv').textContent = `Lv ${me.level} · ${me.element}${me.max ? ' · MAX' : ''}`;
    $('foeSprite').classList.toggle('max', !!foe.max);
    $('foeSprite').classList.toggle('alpha', !!foe.alpha && !foe.max);
    $('meSprite').classList.toggle('max', !!me.max);
    drawCreature($('foeSprite'), foe, false);
    drawCreature($('meSprite'), me, true);
    updateBars();
  }
  function updateBars() {
    for (const [c, bar] of [[B.foe, $('foeBar')], [B.me, $('meBar')]]) {
      const f = c.hp / CM.maxHp(c);
      bar.style.width = `${f * 100}%`;
      bar.className = hpClass(f);
    }
    $('meHp').textContent = `${B.me.hp} / ${CM.maxHp(B.me)} HP`;
    $('meXp').style.width = `${B.me.xp / CM.xpToNext(B.me.level) * 100}%`;
  }
  function flash(el) {
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
    // Dropping the class afterwards lets the idle bob resume.
    el.addEventListener('animationend', () => el.classList.remove('hit'), { once: true });
  }

  // Centres of the two sprites on the battle screen, for effects to fly between.
  const SPOT = { me: { x: 160, y: 302 }, foe: { x: 560, y: 120 } };
  // The attacker lunges, the move's effect plays, then the result lands.
  async function animate(who, kind) {
    const sprite = $(`${who}Sprite`);
    sprite.classList.add('lunge');
    await playFx($('fx'), kind, SPOT[who], SPOT[who === 'me' ? 'foe' : 'me']);
    sprite.classList.remove('lunge');
  }
  async function attack(who, m) {
    const other = who === 'me' ? 'foe' : 'me';
    const att = B[who], def = B[other];
    await say(`${shownName(att)} used ${m.name}!`);
    const r = CM.useMove(att, def, m);
    if (who === 'me' && S.dev && S.dev.ohko && r.dmg) def.hp = 0;
    if (r.miss) { SFX.play('miss'); return say('But it missed!'); }
    if (r.domain) {
      B.domain = { owner: att, turns: r.domain };
      $battle.classList.add('domain');
      await animate(who, 'Cursed');
      return sayAll(['The world goes dark. A shrine of bone and teeth rises out of nothing.', 'Domain Expansion: Malevolent Shrine!']);
    }
    await animate(who, r.heal != null ? 'heal' : m.element);
    updateBars();
    if (r.heal != null) { SFX.play('heal'); return say(`${shownName(att)} recovered ${r.heal} HP!`); }
    if (r.blocked) return say(`${shownName(def)}'s ${ITEMS[def.item].name} nullified the hit!`);
    if (r.infinity) {
      flash($(`${who}Sprite`));
      return say(`The attack stops dead in the infinity around ${def.name}! ${shownName(att)} takes ${r.infinity} damage instead!`);
    }
    flash($(`${other}Sprite`));
    SFX.play(r.eff > 1 || r.crit ? 'strong' : r.eff < 1 ? 'weak' : 'hit');
    if (r.crit) await say('A critical hit!');
    if (r.eff > 1) await say("It's super effective!");
    else if (r.eff < 1) await say("It's not very effective...");
  }

  async function goMax(who) {
    const c = B[who];
    CM.setMax(c, true);
    renderBattle();
    flash($(`${who}Sprite`));
    await sayAll(CM.isEgg(c)
      ? [`${c.name}'s eyes roll back. Black markings spread across his face...`, 'Sukuna has taken over!']
      : `${c.name} surges with power and grows enormous! Max Mode!`);
  }
  function closeDomain() {
    B.domain = null;
    $battle.classList.remove('domain');
  }
  // Max Mode ends when its Creatamon leaves the fight; a domain goes with its owner.
  function endMax(c) {
    if (B.domain && B.domain.owner === c) closeDomain();
    CM.setMax(c, false);
  }
  async function domainTick() {
    const { owner } = B.domain;
    const who = owner === B.me ? 'me' : 'foe', other = who === 'me' ? 'foe' : 'me';
    if (B[who] !== owner) return closeDomain();
    await say(`Slashes rain down on ${shownName(B[other])} from every side!`);
    await animate(who, 'Cursed');
    CM.useMove(owner, B[other], CM.DOMAIN_STRIKE);
    updateBars();
    flash($(`${other}Sprite`));
    if (--B.domain.turns <= 0) { closeDomain(); await say('The domain collapses.'); }
  }

  // cls: 'menu' lays the buttons out as a column down the right-hand side; otherwise they fill the bottom panel.
  function pickButton(html, cls = '') {
    $dialog.hidden = true;
    $actions.className = cls;
    $actions.innerHTML = html;
    $actions.hidden = false;
    return new Promise((resolve) => {
      $actions.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        $actions.onclick = null;
        $actions.hidden = true;
        SFX.play(b.dataset.back ? 'back' : 'select');
        resolve(b.dataset);
      };
    });
  }
  // Returns a party index, or null if the player backed out.
  async function chooseParty(forced) {
    const html = S.party.map((c, i) =>
      `<button data-idx="${i}" style="border-left-color:${ELEMENTS[c.element].color}" ${c.hp <= 0 || c === B.me ? 'disabled' : ''}>
        <b>${esc(c.name)}</b> Lv ${c.level}<small>${c.hp} / ${CM.maxHp(c)} HP</small></button>`).join('')
      ;
    const d = await pickButton(`<div class="moves">${html}</div>${forced ? '' : '<div class="side"><button data-back="1"><b>Back</b></button></div>'}`);
    return d.back ? null : +d.idx;
  }
  async function chooseAction(canRun, canMax) {
    for (;;) {
      const list = CM.battleMoves(B.me);
      const canSwitch = S.party.some((c) => c.hp > 0 && c !== B.me);
      const usable = Object.keys(ITEMS).some((id) => (ITEMS[id].heal || ITEMS[id].revive) && S.items[id] > 0);
      const d = await pickButton(`<p class="prompt">What will <b>${esc(shownName(B.me))}</b> do?</p><div class="cmd">
        <button class="fight" data-act="fight"><i>⚔</i><b>Fight</b></button>
        ${canMax() ? '<button class="maxbtn" data-act="max"><i>✦</i><b>Max Mode</b></button>' : ''}
        <button data-act="switch" ${canSwitch ? '' : 'disabled'}><i>⟳</i><b>Creatamon</b></button>
        <button data-act="bag" ${usable ? '' : 'disabled'}><i>✚</i><b>Bag</b></button>
        <button data-act="run"><i>➜</i><b>Run</b></button></div>`, 'menu');
      if (d.act === 'fight') {
        const m = await pickButton(`<div class="cmd movelist">${list.map((mv, i) => `<button data-move="${i}" style="--c:${ELEMENTS[mv.element].color}">
          <b>${mv.name}</b><small>${CM.cardDesc(mv)}</small></button>`).join('')}<button class="back" data-back="1"><b>Back</b></button></div>`, 'menu');
        if (m.move) return { type: 'move', move: list[+m.move] };
      } else if (d.act === 'max') {
        if (!CM.isEgg(B.me)) B.maxUsed = true;
        await goMax('me');
      } else if (d.act === 'switch') {
        const idx = await chooseParty(false);
        if (idx != null) return { type: 'switch', idx };
      } else if (d.act === 'bag') {
        const use = await chooseItem();
        if (use) return { type: 'item', ...use };
      } else if (!canRun) {
        await say("There's no running from this battle!");
      } else {
        return { type: 'run' };
      }
    }
  }

  // Pick a potion or revive from the Bag, then who gets it. Returns { id, idx } or null if the player backs out.
  async function chooseItem() {
    const ids = Object.keys(ITEMS).filter((id) => (ITEMS[id].heal || ITEMS[id].revive) && S.items[id] > 0);
    const a = await pickButton(`<div class="moves">${ids.map((id) => `<button data-id="${id}" style="border-left-color:#f08aa0">
      <b>${ITEMS[id].name} ×${S.items[id]}</b><small>${ITEMS[id].desc}</small></button>`).join('')}</div>
      <div class="side"><button class="wide" data-back="1"><b>Back</b></button></div>`);
    if (a.back) return null;
    const it = ITEMS[a.id];
    const ok = (c) => (it.revive ? c.hp <= 0 : c.hp > 0 && c.hp < CM.maxHp(c));
    const b = await pickButton(`<div class="moves">${S.party.map((c, i) => `<button data-idx="${i}" style="border-left-color:${ELEMENTS[c.element].color}" ${ok(c) ? '' : 'disabled'}>
      <b>${esc(c.name)}</b> Lv ${c.level}<small>${c.hp} / ${CM.maxHp(c)} HP</small></button>`).join('')}</div>
      <div class="side"><button class="wide" data-back="1"><b>Back</b></button></div>`);
    return b.back ? null : { id: a.id, idx: +b.idx };
  }
  function useItem(id, c) {
    const it = ITEMS[id], full = CM.maxHp(c), before = c.hp;
    S.items[id]--;
    c.hp = it.revive ? Math.floor(full / 2) : Math.min(full, c.hp + it.heal);
    return c.hp - before;
  }

  const TRAINEE = 10;   // below this level a party member earns XP from every battle
  async function grantXp(me, foe, bonus) {
    const xp = Math.round(CM.xpYield(foe) * (bonus ? 1.5 : 1));
    const from = me.level, cap = CM.levelCap(badgeCount()), badges = badgeCount();
    if (from >= cap) {
      CM.gainXp(me, 0, cap);
      updateBars();
      return tip('cap', `${me.name} is at level ${from}. With ${badges} badge${badges === 1 ? '' : 's'} a Creatamon cannot grow past level ${cap}. The next badge lifts the limit.`);
    }
    await say(`${me.name} gained ${xp} XP!`);
    const down = me.hp <= 0;
    const levelled = CM.gainXp(me, xp, cap);
    if (down) me.hp = 0;   // growing does not wake a fainted Creatamon
    updateBars();
    if (levelled) {
      if (me === B.me) renderBattle();
      SFX.play('level');
      for (let l = from + 1; l <= me.level; l++) await say(`${me.name} grew to level ${l}!`);
      await tip('level', ['Level up! XP comes from beating other Creatamon. Every level makes a Creatamon stronger, faster and tougher.',
        'Every Creatamon of yours that attacked the foe gets the XP. Until they reach level 10, the rest of your party gets it too, even without fighting.']);
      if (CM.canEvolve(me)) await say(`${me.name} is ready to evolve! Open the menu (M) after the battle.`);
    }
  }

  // Resolves to 'win' | 'lose' | 'run'. Leaves the battle screen up for the caller to close.
  // opts: zone (backdrop), trainer (their name), boss (a lone story foe), phantom (the Grove beast: nothing
  // lands and the fight ends by itself), ally (a line shown as helpers add damage after each of your hits),
  // max (the player may use Max Mode once), foeMax (their last Creatamon enters Max Mode).
  async function battle(foes, opts) {
    mode = 'busy';
    B = { foe: foes[0], me: S.party.find((c) => c.hp > 0), maxUsed: false, domain: null, hit: new Set() };
    SFX.play('battle');
    SFX.music('battle');
    try {
      const result = await fight(foes, opts);
      if (result === 'win') S.stats.wins++;
      return result;
    } finally {
      $('foeSprite').classList.remove('shiny');
      SFX.music('world');
      S.party.forEach((c) => CM.setMax(c, false));
      closeDomain();
      $('meSprite').classList.remove('max');
      $('foeSprite').classList.remove('max');
    }
  }
  async function fight(foes, opts) {
    S.seen[B.foe.species || B.foe.name] = true;
    $battle.className = `z${opts.zone}`;
    $battle.hidden = false;
    renderBattle();
    const set = opts.trainer && !opts.boss;
    const foeTag = set ? `${opts.trainer}'s ` : opts.boss ? '' : 'The wild ';
    const lastStand = async () => { if (opts.foeMax && foes.filter((f) => f.hp > 0).length === 1) await goMax('foe'); };
    if (set) {
      await say(`${opts.trainer} wants to battle!`);
      await say(`${opts.trainer} sent out ${B.foe.name}!`);
      await lastStand();
    } else if (opts.boss) {
      await say(`${B.foe.name} looms over you!`);
    } else {
      await say(opts.phantom ? 'A shape in the fog blocks the way!'
        : B.foe.shiny ? `✨ It sparkles... a SHINY ${B.foe.name} appeared! ✨` : B.foe.rare ? `Whoa! A rare ${B.foe.name} appeared!` : `A wild ${B.foe.name} appeared!`);
    }
    await say(`Go, ${B.me.name}!`);
    await tip('battle', ['Your first battle! Your Creatamon is at the bottom left, the foe at the top right. The bar by each is its HP: at zero it faints.',
      'Press Fight and pick an attack. You and the foe take turns. Elements work like rock-paper-scissors: Water beats Fire, Fire beats Grass, Grass beats Water.',
      'Bag heals with a Potion, Creatamon swaps in another of yours, Run escapes a wild one. If all of yours faint you just wake up at the last heal pad.']);

    // Deals with anyone who has fainted. Returns 'win' | 'lose', 'next' if someone new came out, or null.
    const settle = async () => {
      if (B.foe.hp <= 0) {
        SFX.play('faint');
        await say(`${foeTag}${shownName(B.foe)} fainted!`);
        endMax(B.foe);
        // Everyone still standing who attacked this foe earns the XP, starting with whoever is out now.
        // Beginners get a hand: anyone in the party still under level 10 shares in it too, whether or not they fought.
        const earners = S.party.filter((c) => (c.hp > 0 && B.hit.has(c)) || c.level < TRAINEE).sort((a, b) => (b === B.me) - (a === B.me));
        for (const c of earners.length ? earners : [B.me]) await grantXp(c, B.foe, !!opts.trainer || !!opts.alpha);
        B.hit.clear();
        const next = foes.find((f) => f.hp > 0);
        if (!next) return 'win';
        B.foe = next;
        S.seen[next.species || next.name] = true;
        renderBattle();
        await say(`${opts.trainer} sent out ${next.name}!`);
        await lastStand();
        return 'next';
      }
      if (B.me.hp <= 0) {
        SFX.play('faint');
        await say(`${shownName(B.me)} fainted!`);
        endMax(B.me);
        if (!hasFighter()) return 'lose';
        B.me = S.party[await chooseParty(true)];
        renderBattle();
        await say(`Go, ${B.me.name}!`);
        return 'next';
      }
      return null;
    };

    for (let turn = 1; ; turn++) {
      // Max Mode is for gyms and the Cup, once a battle. The easter egg may use it anywhere, as often as it likes.
      const canMax = () => !B.me.max && (CM.isEgg(B.me) || (!!opts.max && !B.maxUsed));
      const act = await chooseAction(!opts.trainer && !opts.phantom, canMax);
      let myMove = null;
      if (act.type === 'run') {
        if (Math.random() < 0.8) { await say('Got away safely!'); return 'run'; }
        await say("Couldn't get away!");
      } else if (act.type === 'switch') {
        if (B.me.max) await say(`${shownName(B.me)} shrinks back to normal.`);
        endMax(B.me);
        B.me = S.party[act.idx];
        renderBattle();
        await say(`Go, ${B.me.name}!`);
      } else if (act.type === 'item') {
        const target = S.party[act.idx], gained = useItem(act.id, target);
        await say(`${you()} used ${/^[aeiou]/i.test(ITEMS[act.id].name) ? 'an' : 'a'} ${ITEMS[act.id].name}.`);
        if (target === B.me) await animate('me', 'heal');
        updateBars();
        await say(ITEMS[act.id].revive ? `${target.name} is back on its feet!` : `${target.name} recovered ${gained} HP!`);
      } else {
        myMove = act.move;
      }
      if (opts.phantom) {
        if (myMove) {
          await say(`${B.me.name} used ${myMove.name}!`);
          await animate('me', myMove.heal ? 'heal' : myMove.element);
          await say('The attack passed right through it!');
        }
        if (turn >= 3) return 'fog';
        await say('The shape does not move. The fog grows thicker...');
        continue;
      }
      const foeMove = CM.pickMove(B.foe, B.me, Math.random, opts.skill);
      const mySpd = CM.stats(B.me).spd, foeSpd = CM.stats(B.foe).spd;
      const meFirst = mySpd > foeSpd || (mySpd === foeSpd && Math.random() < 0.5);
      const order = !myMove ? ['foe'] : meFirst ? ['me', 'foe'] : ['foe', 'me'];

      let result = null;
      for (const who of order) {
        if (who === 'me' && !myMove.heal) B.hit.add(B.me);
        await attack(who, who === 'me' ? myMove : foeMove);
        if (who === 'me' && opts.ally && B.foe.hp > 0) {
          await say(opts.ally);
          await animate('me', 'Normal');
          B.foe.hp = Math.max(0, B.foe.hp - Math.round(CM.maxHp(B.foe) * 0.12));
          updateBars();
          flash($('foeSprite'));
        }
        result = await settle();
        if (result) break;
      }
      if (!result && B.domain) {
        await domainTick();
        result = await settle();
      }
      // Held items that mend their holder a little every turn.
      if (!result) {
        for (const who of ['me', 'foe']) {
          const c = B[who], regen = CM.held(c).regen;
          if (!regen || c.hp <= 0 || c.hp >= CM.maxHp(c)) continue;
          c.hp = Math.min(CM.maxHp(c), c.hp + Math.ceil(CM.maxHp(c) * regen));
          updateBars();
          await say(`${shownName(c)}'s ${ITEMS[c.item].name} restored a little HP.`);
        }
      }
      if (result === 'win' || result === 'lose') return result;
    }
  }

  // ---------- Menu & Forge ----------
  const cardHTML = (id, n, attrs = '', tag = 'button') => {
    const c = CARDS[id];
    const stripe = c.kind === 'move' ? `style="border-top-color:${ELEMENTS[c.element].color}"` : '';
    return `<${tag} class="card t${c.tier}" ${stripe} ${attrs}>
      <span class="tier">${'★'.repeat(c.tier)} ${CM.TIER_NAMES[c.tier]}</span>
      <b>${c.name}</b><small>${CM.cardDesc(c)}</small>${n > 1 ? `<em>×${n}</em>` : ''}</${tag}>`;
  };
  const sortedCards = (counts) => Object.keys(CARDS).filter((id) => counts[id] > 0);

  function openMenu() {
    SFX.play('select');
    if (!shop && page === 'shop') page = 'home';
    mode = 'menu';
    $menu.hidden = false;
    renderMenu();
  }
  function closeMenu() {
    forge = wardrobe = shop = null;
    help = inv = false;
    page = 'home';
    $menu.hidden = true;
    mode = 'world';
    // Straight after the very first Creatamon is made, point the way to the first battle.
    if (S.party.length && S.f.start && !S.f.rival1 && !S.tips.made) {
      S.tips.made = true;
      talk([`${S.party[0].name} is ready! It follows you everywhere, out of sight until a battle starts.`,
        'Finn is standing just below you, next to the pink heal pad. Walk up to him, face him and press Enter to have your first battle.',
        'Press M whenever you want to see your Creatamon, change its cards or check where to go next.']);
    }
    save();
  }

  const head = (title, extra = '') => `<header><h2>${title}</h2><span>${extra}<button data-a="home">◀ Menu</button> <button data-a="close">Close</button></span></header>`;
  const monLine = (c) => `<b>${esc(c.name)}</b> Lv ${c.level} <small>· ${CM.STAGE_NAMES[c.stage || 0]} ${c.element} ${c.shape} · ${c.hp} / ${CM.maxHp(c)} HP</small><br>
    <small>${c.moves.map((id) => CARDS[id].name).join(', ')}${c.hpCards.length ? ` · ${c.hpCards.length} health card${c.hpCards.length === 1 ? '' : 's'}` : ''}</small>`;
  const itemList = () => Object.keys(ITEMS).filter((id) => S.items[id] > 0);

  function renderMenu() {
    if (inv) return renderInv();
    if (help) return renderHelp();
    if (wardrobe) return renderWardrobe();
    if (forge) return renderForge();
    ({ party: renderParty, storage: renderStorage, dex: renderDex, map: renderMapPage, sprays: renderSprays, shop: renderShop, dev: renderDev, options: renderOptions, card: renderCard, trophies: renderTrophies }[page] || renderHome)();
  }
  // The front page: a grid of big tiles, one for each thing the menu can do.
  function renderHome() {
    const tile = (attr, icon, label, color, note = '') => `<button class="tile" ${attr} style="--c:${color}"><i>${icon}</i><b>${label}</b><small>${note}</small></button>`;
    $menu.className = 'home';
    $menu.innerHTML = `
      <header><h2>${esc(S.player.name)}${myTitle() ? ` <small class="rank">★ ${myTitle()}</small>` : ''}</h2><span class="purse">${COIN}${S.money} &nbsp;·&nbsp; ${badgeCount()}/${TOTAL} badges &nbsp;<button data-a="close">Close</button></span></header>
      <p class="goal"><b>Next:</b> ${esc(objective())}</p>
      <div class="tiles">
        ${tile('data-page="party"', '🐾', 'Creatamon', '#e8384f', `${S.party.length}/${CM.MAX_PARTY} in party`)}
        ${tile('data-page="storage"', '📦', 'Storage', '#f08a24', `${S.storage.length} stored`)}
        ${tile('data-page="bag"', '🎒', 'Bag', '#f5b942', 'Items and cards')}
        ${tile('data-a="new"', '⚒', 'Forge', '#72b84a', `${S.items.creataball || 0} Creataball${S.items.creataball === 1 ? '' : 's'}`)}
        ${tile('data-page="dex"', '📖', 'Creatadex', '#2bb6a8', `${CM.DEX.filter((m) => S.seen[m.name]).length}/${CM.DEX.length} seen`)}
        ${tile('data-page="map"', '🗺', 'Town Map', '#3f8fe0', 'Where you have been')}
        ${tile('data-a="wardrobe"', '👕', 'Wardrobe', '#7a6cf0', 'Change your look')}
        ${tile('data-page="sprays"', '🎨', 'Sprays', '#c05ad6', 'Pick a design')}
        ${tile('data-a="howto"', '❓', 'How to play', '#7d8496', 'Controls and tips')}
        ${tile('data-page="card"', '🪪', 'Trainer Card', '#e06aa0', myTitle() || 'Your record')}
        ${tile('data-page="trophies"', '🏆', 'Trophies', '#c79a12', `${Object.keys(S.trophies).length}/${TROPHIES.length} earned`)}
        ${tile('data-page="options"', '⚙', 'Options', '#3a4258', 'Sound and text')}
      </div>
      <div class="badges">${CM.GYM_ORDER.map((el) => `<span class="${S.badges[el] ? 'won' : ''}" style="--c:${ELEMENTS[el].color}" title="${el} Badge">${el}</span>`).join('')}</div>`;
  }
  function renderParty() {
    const heldItems = Object.keys(ITEMS).filter((id) => ITEMS[id].held);
    // An item can be given if there is a spare one that nobody else is holding.
    const spare = (id) => (S.items[id] || 0) - S.party.filter((c) => c.item === id).length;
    $menu.className = '';
    $menu.innerHTML = `${head('Creatamon')}
      <h3>Party (${S.party.length}/${CM.MAX_PARTY}) · level limit ${CM.levelCap(badgeCount())}, raised by each badge</h3>
      ${S.party.map((c, i) => `
      <div class="mon">
        <canvas data-sprite="${i}" width="96" height="96"></canvas>
        <div>${monLine(c)} <small>· ${c.xp}/${CM.xpToNext(c.level)} XP</small><br>
          <small>Holding: <select data-give="${i}"><option value="">nothing</option>${heldItems.filter((id) => c.item === id || spare(id) > 0).map((id) =>
    `<option value="${id}" ${c.item === id ? 'selected' : ''}>${ITEMS[id].name}</option>`).join('')}</select>
          ${c.item ? ITEMS[c.item].desc : (c.stage || 0) < 2 ? `Evolves at level ${CM.EVOLVE_AT[c.stage || 0]}` : ''}</small></div>
        <div class="btns">
          ${CM.canEvolve(c) ? `<button class="plain evolve" data-a="evolve" data-i="${i}">Evolve!</button>` : ''}
          ${i ? `<button class="plain" data-a="lead" data-i="${i}">Make lead</button>` : ''}
          <button class="plain" data-a="edit" data-i="${i}">Rebuild</button>
          ${S.party.length > 1 ? `<button class="plain" data-store="${i}">To Storage</button>` : ''}
          <button class="plain" data-a="dismantle" data-i="${i}">Dismantle</button>
        </div>
      </div>`).join('') || '<p class="empty">No Creatamon yet. Forge one from your Power Cards!</p>'}
      <button class="plain primary" data-a="new" ${S.items.creataball ? '' : 'disabled'}>＋ Forge a new Creatamon (uses 1 Creataball, you have ${S.items.creataball || 0})</button>
      <small class="empty">Rebuilding also uses 1 Creataball. A party holds ${CM.MAX_PARTY}; any more go to Storage.</small>`;
    $menu.querySelectorAll('[data-sprite]').forEach((cv) => drawCreature(cv, S.party[cv.dataset.sprite], false));
  }
  // Creatamon beyond the six in the party wait here.
  function renderStorage() {
    const full = S.party.length >= CM.MAX_PARTY;
    $menu.className = '';
    $menu.innerHTML = `${head('Storage')}
      <p class="empty">Your party holds ${CM.MAX_PARTY} Creatamon. The rest rest here, and can be swapped in any time. ${full ? 'Your party is full: send one to Storage from the Creatamon page to make room.' : ''}</p>
      ${S.storage.map((c, i) => `
      <div class="mon">
        <canvas data-stored="${i}" width="96" height="96"></canvas>
        <div>${monLine(c)}</div>
        <div class="btns"><button class="plain" data-take="${i}" ${full ? 'disabled' : ''}>To party</button></div>
      </div>`).join('') || '<p class="empty">Nothing in Storage yet.</p>'}`;
    $menu.querySelectorAll('[data-stored]').forEach((cv) => drawCreature(cv, S.storage[cv.dataset.stored], false));
  }
  function renderDex() {
    $menu.className = '';
    $menu.innerHTML = `${head(`Creatadex · ${CM.DEX.filter((m) => S.seen[m.name]).length}/${CM.DEX.length} seen`)}
      <div class="dex">${CM.DEX.map((m) => (S.seen[m.name]
    ? `<span style="border-color:${ELEMENTS[m.element].color}" title="${m.element}">${m.name} <small>${m.element}</small></span>`
    : '<span class="unseen">???</span>')).join('')}</div>`;
  }
  function renderMapPage() {
    const towns = Object.entries(S.visited);
    $menu.className = '';
    $menu.innerHTML = `${head('Town Map')}
      <canvas id="bigmap" width="${MW * 5}" height="${MH * 5}"></canvas>
      <p class="empty">The map fills in as you explore. White dot: you. Gold ring: your next goal. Coloured roofs are gyms.</p>
      <h3>Fast travel</h3>
      <div class="pick">${towns.map(([at, name]) => `<button class="plain" data-fly="${at}">✈ ${esc(name)}</button>`).join('')
        || '<p class="empty">Step on a town\'s pink heal pad and you can travel straight back to it from here.</p>'}</div>`;
    drawMap($('bigmap'));
  }
  // The player's record: who they are, how far they have come, and what they have done along the way.
  function renderCard() {
    const mins = Math.floor(S.stats.time / 60000), next = CM.nextRank(S.alphaWins, S.f.champion, S.champAt);
    const line = (k, v) => `<div class="ware"><div><b>${k}</b></div><span>${v}</span></div>`;
    $menu.className = '';
    $menu.innerHTML = `${head('Trainer Card')}
      <div class="forge"><div class="left"><canvas id="pprev" width="288" height="320"></canvas></div>
      <div class="right">
        <h2>${esc(S.player.name)} ${myTitle() ? `<small class="rank">★ ${myTitle()}</small>` : ''}</h2>
        <p class="empty">${next ? `${next.left} more alpha win${next.left === 1 ? '' : 's'} to ${next.name}.` : 'Beat the Champion for the last title of all.'}</p>
        ${line('Badges', `${badgeCount()} / ${TOTAL}`)}${line('Champion rank', `${myTitle() || 'Unranked'} · ${S.alphaWins || 0} alphas beaten`)}
        ${line('Time played', `${Math.floor(mins / 60)} h ${mins % 60} min`)}${line('Battles won', S.stats.wins)}${line('Trainers beaten', S.stats.trainers)}
        ${line('Creatadex', `${seenCount()} / ${CM.DEX.length}`)}${line('Shiny Creatamon beaten', S.stats.shinies)}${line('Steps walked', S.stats.steps)}
        ${line('Coins', `${COIN}${S.money}`)}${line('Trophies', `${Object.keys(S.trophies).length} / ${TROPHIES.length}`)}${line('Days in a row', S.streak || 1)}
      </div></div>`;
    const g = $('pprev').getContext('2d');
    g.setTransform(8, 0, 0, 8, 0, 0);
    drawPerson(g, 2, 8, S.player, 'down');
  }
  function renderTrophies() {
    $menu.className = '';
    $menu.innerHTML = `${head(`Trophies · ${Object.keys(S.trophies).length}/${TROPHIES.length}`)}
      <p class="empty">Each trophy pays ${COIN}${TROPHY_PRIZE} when you earn it.</p>
      <div class="trophies">${TROPHIES.map(([id, icon, name, what]) => `<div class="trophy ${S.trophies[id] ? 'won' : ''}"><i>${S.trophies[id] ? icon : '🔒'}</i><div><b>${name}</b><small>${what}</small></div></div>`).join('')}</div>`;
  }
  function renderSprays() {
    $menu.className = '';
    $menu.innerHTML = `${head('Spray paint')}
      <p class="empty">Pick a design, then press G out in the world to spray it on the ground in front of you.</p>
      <div class="sprays">${Object.keys(SPRAYS).map((id) => (S.sprayOwned[id]
    ? `<button class="${S.spray === id ? 'on' : ''}" data-spray="${id}" title="${SPRAYS[id]}"><canvas data-spraycv="${id}" width="64" height="64"></canvas></button>`
    : '<button disabled title="Not found yet">?</button>')).join('')}</div>`;
    $menu.querySelectorAll('[data-spraycv]').forEach((cv) => { const g = cv.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0); drawSpray(g, cv.dataset.spraycv, 0, 0); });
  }
  function renderOptions() {
    const sw = (key, name, what) => `<div class="ware"><div><b>${name}</b> <small>${what}</small></div>
      <button class="plain ${SFX.opts[key] ? 'on' : ''}" data-opt="${key}">${SFX.opts[key] ? 'On' : 'Off'}</button></div>`;
    $menu.className = '';
    $menu.innerHTML = `${head('Options')}
      ${sw('sfx', 'Sound effects', 'Hits, pick-ups, menu clicks')}
      ${sw('music', 'Music', 'A quiet tune while you explore and a livelier one in battle')}
      ${sw('auto', 'Battle text moves on by itself', 'Off: press Enter after every battle message')}
      <p class="empty">These are kept for this browser, not per save.</p>`;
  }
  // A Creatastop: the basics, Power Cards of the town's element, and a rack of clothes.
  function renderShop() {
    const n = badgeCount(), can = (price) => (S.money >= price ? '' : 'disabled');
    const goods = Object.keys(ITEMS).filter((id) => ITEMS[id].price && (ITEMS[id].need || 0) <= n);
    const cards = Object.keys(CARDS).filter((id) => { const c = CARDS[id]; return c.tier < 4 && !c.key && CM.cardNeed(id) <= n && (c.kind === 'hp' || c.element === shop.el); });
    const rack = shop.clothes.filter((id) => !S.wardrobe[id]);
    const row = (kind, id, name, desc, price, have) => `<div class="ware"><div><b>${name}</b> <small>${desc}${have ? ` · you have ${have}` : ''}</small></div>
      <button class="plain" data-buy="${kind}:${id}" ${can(price)}>${COIN}${price}</button></div>`;
    $menu.className = '';
    $menu.innerHTML = `<header><h2>${esc(shop.town)} Creatastop</h2><span><span class="purse dark">${COIN}${S.money}</span> <button data-a="close">Leave</button></span></header>
      <p class="empty">Welcome! Coins come from beating trainers. More goods arrive as you win badges.</p>
      <h3>Items</h3>${goods.map((id) => row('item', id, ITEMS[id].name, ITEMS[id].desc, ITEMS[id].price, S.items[id] || 0)).join('')}
      <h3>Power Cards · ${shop.el}</h3>${cards.map((id) => row('card', id, cardLabel(id), CM.cardDesc(CARDS[id]), CM.cardPrice(id), S.cards[id] || 0)).join('')}
      <h3>Clothes</h3>${rack.map((id) => row('wear', id, CLOTHES[id].name, { hat: 'Hat', top: 'Top', bottom: 'Bottoms' }[CLOTHES[id].slot], CM.CLOTHES_PRICE)).join('') || '<p class="empty">You have bought everything on this rack. Other towns stock different clothes.</p>'}`;
  }
  // Everything the player is carrying: items (potions can be used right here), then unused cards. Opened with E.
  function renderInv() {
    const ids = sortedCards(S.cards);
    const usable = (it, c) => (it.revive ? c.hp <= 0 : it.heal ? c.hp > 0 && c.hp < CM.maxHp(c) : false);
    $menu.className = '';
    $menu.innerHTML = `<header><h2>Bag</h2><span><span class="purse dark">${COIN}${S.money}</span> <button data-a="home">◀ Menu</button> <button data-a="close">Close (E)</button></span></header>
      <h3>Items</h3>
      ${itemList().map((id) => `<div class="ware"><div><b>${ITEMS[id].name}</b> ×${S.items[id]} <small>${ITEMS[id].desc}</small></div>
        ${ITEMS[id].heal || ITEMS[id].revive ? `<span class="useon">Use on ${S.party.map((c, i) =>
    `<button class="plain" data-use="${id}" data-i="${i}" ${usable(ITEMS[id], c) ? '' : 'disabled'} title="${c.hp} / ${CM.maxHp(c)} HP">${esc(c.name)} <small>${c.hp}/${CM.maxHp(c)}</small></button>`).join('')}</span>` : ''}</div>`).join('') || '<p class="empty">Empty.</p>'}
      <h3>Unused Power Cards</h3>
      <div class="cards">${ids.map((id) => cardHTML(id, S.cards[id], '', 'div')).join('') || '<p class="empty">None. Look for sparkles and battle wild Creatamon.</p>'}</div>`;
  }
  function renderHelp() {
    $menu.className = '';
    $menu.innerHTML = `${head('How to play')}
      <dl class="howto">${HOW_TO.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }
  // Giving or taking a held item.
  $menu.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-give]');
    if (!sel) return;
    S.party[+sel.dataset.give].item = sel.value || null;
    save();
    renderMenu();
  });

  const GRID = 32;
  const PALETTE = ['#1c1c28', '#5a5a6e', '#9a9a9a', '#d8d8d8', '#ffffff', '#8c231b', '#e0483c', '#f47a45',
    '#f5b942', '#f6d643', '#fff3a8', '#2f7a2c', '#72cc5c', '#b4e6c6', '#1f5f9e', '#55a8ee',
    '#bfe3fb', '#5b3fa8', '#9b3fd6', '#f29ad0', '#f08aa0', '#f3c9a0', '#8a5a2b', '#3a2412'];
  const isEgg = CM.isEgg;
  // Secret cards come and go with the name; they never touch the card collection.
  function syncEgg(draft) {
    draft.moves = draft.moves.filter((id) => CARDS[id].tier !== 4);
    if (isEgg(draft)) draft.moves.push(...CM.EGG.moves);
  }

  function openForge(idx) {
    const src = idx == null ? null : S.party[idx];
    const pix = document.createElement('canvas');
    pix.width = pix.height = GRID;
    const up = !!(src && src.art && src.artUp);
    forge = {
      idx, pix,
      avail: { ...S.cards },
      // look: auto (generated) | draw (pixel editor) | upload (the player's own image)
      look: !src || !src.art ? 'auto' : up ? 'upload' : 'draw', upload: up ? src.art : null,
      tool: 'pen', color: PALETTE[0], size: 1, mirror: false, undo: [],
      draft: src
        ? { name: src.name, element: src.element, shape: src.shape, moves: [...src.moves], hpCards: [...src.hpCards] }
        : { name: '', element: 'Normal', shape: 'Blob', moves: [], hpCards: [] },
    };
    if (src && src.art && !up) {
      const im = new Image();
      im.onload = () => { pix.getContext('2d').drawImage(im, 0, 0); if (forge && forge.pix === pix) paintPreview(); };
      im.src = src.art;
    }
    renderMenu();
  }

  // Free card slots on a draft. Secret cards are bound to their owner and take no slot.
  const moveRoom = (draft) => CM.MOVE_SLOTS - draft.moves.filter((id) => CARDS[id].tier !== 4).length;
  const forgeLevel = () => (forge.idx == null ? 1 : S.party[forge.idx].level);
  const drawingNow = () => forge.look === 'draw' && !isEgg(forge.draft);
  function paintPreview() {
    const cv = $('preview');
    if (!cv) return;
    if (!drawingNow()) {
      const art = forge.look === 'upload' ? forge.upload : null;
      return drawCreature(cv, { ...forge.draft, name: forge.draft.name.trim(), level: forgeLevel(), art, artUp: true }, false);
    }
    const g = cv.getContext('2d'), cell = cv.width / GRID;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(forge.pix, 0, 0, cv.width, cv.height);
    // A faint grid to count squares by, with the middle marked when mirroring.
    g.fillStyle = '#00000014';
    for (let i = 1; i < GRID; i++) { g.fillRect(i * cell, 0, 1, cv.height); g.fillRect(0, i * cell, cv.width, 1); }
    g.fillStyle = forge.mirror ? '#e0483c' : '#00000030';
    g.fillRect(cv.width / 2 - 1, 0, 2, cv.height);
  }
  function floodFill(g, x, y, hex) {
    const img = g.getImageData(0, 0, GRID, GRID), p = img.data;
    const to = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
    const start = (y * GRID + x) * 4, from = [...p.slice(start, start + 4)];
    if (from.every((v, i) => v === to[i])) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) continue;
      const i = (cy * GRID + cx) * 4;
      if (!from.every((v, k) => p[i + k] === v)) continue;
      to.forEach((v, k) => { p[i + k] = v; });
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    g.putImageData(img, 0, 0);
  }
  // Remember the picture so the next change can be undone.
  function snapshot() {
    forge.undo.push(forge.pix.getContext('2d').getImageData(0, 0, GRID, GRID));
    if (forge.undo.length > 40) forge.undo.shift();
  }
  function stroke(e) {
    const cv = e.currentTarget, g = forge.pix.getContext('2d');
    const x = Math.floor(e.offsetX / cv.clientWidth * GRID), y = Math.floor(e.offsetY / cv.clientHeight * GRID);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    if (forge.tool === 'pick') {
      const [r, gg, b, a] = g.getImageData(x, y, 1, 1).data;
      if (a) { forge.color = `#${[r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`; forge.tool = 'pen'; renderForge(); }
      return;
    }
    // The brush is a square of `size`; mirroring repeats it on the other half.
    const o = Math.floor((forge.size - 1) / 2);
    for (const bx of forge.mirror ? [x - o, GRID - 1 - x - (forge.size - 1 - o)] : [x - o]) {
      if (forge.tool === 'erase') g.clearRect(bx, y - o, forge.size, forge.size);
      else if (forge.tool === 'fill') floodFill(g, Math.max(0, Math.min(GRID - 1, bx + o)), y, forge.color);
      else { g.fillStyle = forge.color; g.fillRect(bx, y - o, forge.size, forge.size); }
    }
    paintPreview();
  }
  // Copies the generated look into the editor as something to draw over.
  function stampAuto() {
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 128;
    drawCreature(tmp, { ...forge.draft, name: '', level: forgeLevel(), art: null, stage: 2 }, false);
    const g = forge.pix.getContext('2d');
    g.clearRect(0, 0, GRID, GRID);
    g.imageSmoothingEnabled = true;
    g.drawImage(tmp, 0, 0, GRID, GRID);
    // Hard edges only: a pixel is either there or not.
    const img = g.getImageData(0, 0, GRID, GRID);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 110 ? 255 : 0;
    g.putImageData(img, 0, 0);
  }

  // Shrinks the chosen picture so it stays small in the save file.
  const UPLOAD_MAX = 128;
  function loadUpload(file) {
    const f = forge, url = URL.createObjectURL(file), im = new Image();
    const fail = () => { URL.revokeObjectURL(url); alert("That file couldn't be read as an image."); };
    im.onload = () => {
      if (!im.naturalWidth) return fail();
      URL.revokeObjectURL(url);
      if (forge !== f) return;
      const k = Math.min(1, UPLOAD_MAX / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.naturalWidth * k));
      cv.height = Math.max(1, Math.round(im.naturalHeight * k));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      f.upload = cv.toDataURL();
      renderForge();
    };
    im.onerror = fail;
    im.src = url;
  }

  function renderForge() {
    const { draft, avail, idx } = forge;
    $menu.className = '';
    const egg = isEgg(draft);
    const preview = { ...draft, level: forgeLevel() };
    const st = CM.stats(preview);
    const left = (kind) => (kind === 'moves' ? moveRoom(draft) : Infinity);
    const slots = (list, kind) => list.map((id, i) => (CARDS[id].tier === 4
      ? cardHTML(id, 1, 'title="Bound to this Creatamon"', 'div')
      : cardHTML(id, 1, `data-un="${kind}" data-i="${i}" title="Click to remove"`))).join('')
      + (kind !== 'moves' ? '<div class="slot">no limit,<br>add more below</div>' : left(kind) > 0 ? `<div class="slot">${left(kind)} free slot${left(kind) === 1 ? '' : 's'},<br>add below</div>` : '<div class="slot">full</div>');
    const pick = (attr, names, cur, hint) => names.map((n) =>
      `<button class="plain ${n === cur ? 'on' : ''}" data-${attr}="${n}" title="${hint(n)}">${n}</button>`).join('');
    const tools = forge.look === 'upload' ? `
      <label class="filebtn">${forge.upload ? 'Change image…' : 'Choose image…'}<input type="file" id="fart" accept="image/*" hidden></label>
      <small class="empty">Any picture from your device. See-through PNGs facing left look best.</small>`
      : forge.look !== 'draw' ? '' : `
      <div class="palette">${PALETTE.map((c) => `<button data-color="${c}" class="${c === forge.color ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
      <label class="anycolor">Any colour <input type="color" id="fcolor" value="${forge.color}"></label>
      <div class="pick">${pick('tool', ['pen', 'fill', 'erase', 'pick'], forge.tool, (n) => ({ pen: 'Draw', fill: 'Fill an area', erase: 'Rub out', pick: 'Pick a colour from the picture' }[n]))}</div>
      <div class="pick">${[1, 2, 3].map((n) => `<button class="plain ${forge.size === n ? 'on' : ''}" data-size="${n}" title="Brush size">${['small', 'medium', 'big'][n - 1]}</button>`).join('')}
        <button class="plain ${forge.mirror ? 'on' : ''}" data-a="mirror" title="Draw both halves at once">mirror</button></div>
      <div class="pick"><button class="plain" data-a="undo" ${forge.undo.length ? '' : 'disabled'}>undo</button>
        <button class="plain" data-a="stamp" title="Copy the generated look in, then change it">start from auto look</button>
        <button class="plain" data-a="clearart">clear</button></div>
      <small class="empty">Draw it facing left. Hold and drag to paint.</small>`;
    const near = draft.name.trim() === CM.EGG.name ? '<small class="secret">✦ The name stirs something, but this body is wrong for it...</small>' : '';
    const look = egg ? '<small class="secret">✦ A cursed presence answers to that name...</small>' : `${near}
      <div class="pick">${[['auto', 'Auto look'], ['draw', 'Draw my own'], ['upload', 'Upload image']].map(([v, text]) =>
    `<button class="plain ${forge.look === v ? 'on' : ''}" data-look="${v}">${text}</button>`).join('')}</div>${tools}`;
    const ids = sortedCards(avail);
    $menu.innerHTML = `
      <header><h2>The Forge · ${idx == null ? 'new Creatamon' : 'rebuild'}</h2><button data-a="cancel">Cancel</button></header>
      ${S.party.length ? '' : `<ol class="goal steps"><li><b>Pick an element</b> (Fire, Water, Grass...) and a body shape on the left. The element decides what it is strong against.</li>
        <li><b>Click each card</b> under "Your Power Cards" to slot it in. Move cards are its attacks; Vitality cards give it more health. Use them all!</li>
        <li><b>Type a name</b> for it.</li><li>Press the red <b>Create!</b> button.</li></ol>`}
      <div class="forge ${drawingNow() ? 'wide' : ''}">
        <div class="left">
          <canvas id="preview" width="${drawingNow() ? 512 : 160}" height="${drawingNow() ? 512 : 160}" class="${drawingNow() ? 'drawing' : ''}"></canvas>
          ${look}
          <input id="fname" maxlength="12" placeholder="Name it..." value="${esc(draft.name)}">
          <div class="pick">${pick('el', Object.keys(ELEMENTS).filter((n) => !ELEMENTS[n].hidden), draft.element,
    (n) => `Strong vs ${CM.STRONG[n].join(', ') || 'nothing in particular'}`)}</div>
          <div class="pick">${pick('shape', Object.keys(SHAPES), draft.shape, (n) => SHAPES[n].hint)}</div>
          <div class="statline"><b>${CM.maxHp(preview)} HP</b> · ATK ${st.atk} · DEF ${st.def} · SPD ${st.spd}<br>${SHAPES[draft.shape].hint}. Same-element moves hit 25% harder.</div>
          <button class="plain primary" data-a="save" ${draft.moves.length && S.items.creataball ? '' : 'disabled'}>${idx == null ? 'Create!' : 'Save changes'} (uses a Creataball)</button>
          ${draft.moves.length ? '' : '<small class="empty">Needs at least one move card.</small>'}
          ${!S.items.creataball ? '<small class="empty">You have no Creataballs. Look for sparkles, win badges, or battle wild Creatamon.</small>' : ''}
        </div>
        <div class="right">
          <h3>Moves (${draft.moves.filter((id) => CARDS[id].tier !== 4).length}/${CM.MOVE_SLOTS})</h3>
          <div class="cards">${slots(draft.moves, 'moves')}</div>
          <h3>Health (${draft.hpCards.length})</h3>
          <div class="cards">${slots(draft.hpCards, 'hpCards')}</div>
          <h3>Your Power Cards · click to slot</h3>
          <div class="cards">${ids.map((id) => cardHTML(id, avail[id], `data-add="${id}"`)).join('') || '<p class="empty">No unused cards.</p>'}</div>
        </div>
      </div>`;
    paintPreview();
    const cv = $('preview');
    cv.onpointerdown = (e) => {
      if (!drawingNow()) return;
      cv.setPointerCapture(e.pointerId);
      if (forge.tool !== 'pick') snapshot();
      stroke(e);
      if (forge.tool === 'pen' || forge.tool === 'erase') cv.onpointermove = stroke;
    };
    if ($('fcolor')) $('fcolor').oninput = (e) => { forge.color = e.target.value; if (forge.tool === 'erase' || forge.tool === 'pick') forge.tool = 'pen'; };
    cv.onpointerup = cv.onpointercancel = () => { if (cv.onpointermove) { cv.onpointermove = null; renderForge(); } };
    const file = $('fart');
    if (file) file.onchange = () => { if (file.files[0]) loadUpload(file.files[0]); };
    $('fname').oninput = (e) => {
      // Re-render only when the name starts or stops matching the easter egg.
      const state = () => `${isEgg(draft)}${draft.name.trim() === CM.EGG.name}`;
      const was = state();
      draft.name = e.target.value;
      if (state() === was) return;
      syncEgg(draft);
      renderForge();
      $('fname').focus();
      $('fname').setSelectionRange(draft.name.length, draft.name.length);
    };
  }

  function saveForge() {
    const { draft, avail, idx, pix } = forge;
    const name = draft.name.trim() || `${draft.element === 'Normal' ? 'Plain' : draft.element}${draft.shape.toLowerCase()}`.slice(0, 12);
    const artUp = forge.look === 'upload' && !!forge.upload;
    const drawn = forge.look === 'draw' && pix.getContext('2d').getImageData(0, 0, GRID, GRID).data.some((v, i) => i % 4 === 3 && v);
    const art = artUp ? forge.upload : drawn ? pix.toDataURL() : null;
    S.items.creataball--;
    if (idx == null) {
      const made = Object.assign(CM.create({ ...draft, name, art }), { artUp });
      if (S.party.length < CM.MAX_PARTY) S.party.push(made);
      else { S.storage.push(made); alert(`Your party is full, so ${name} was sent to Storage.\n\nOpen Storage from the menu to swap it in.`); }
    } else {
      const c = S.party[idx];
      const before = CM.maxHp(c);
      Object.assign(c, { name, art, artUp, element: draft.element, shape: draft.shape, moves: draft.moves, hpCards: draft.hpCards });
      const after = CM.maxHp(c);
      c.hp = Math.min(after, c.hp + Math.max(0, after - before));
    }
    S.cards = avail;
    forge = null;
    page = 'party';
    save();
    renderMenu();
  }

  $menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a],[data-el],[data-shape],[data-add],[data-un],[data-look],[data-color],[data-tool],[data-w],[data-size],[data-spray],[data-page],[data-buy],[data-use],[data-store],[data-take],[data-dev],[data-opt],[data-fly]');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.a === 'home' || d.page) {
      forge = wardrobe = shop = null;
      help = false;
      inv = d.page === 'bag';
      page = d.page && d.page !== 'bag' ? d.page : 'home';
      return renderMenu();
    }
    if (d.use) {
      useItem(d.use, S.party[+d.i]);
      save();
      return renderMenu();
    }
    if (d.buy) {
      const [kind, id] = d.buy.split(':');
      const price = kind === 'item' ? ITEMS[id].price : kind === 'card' ? CM.cardPrice(id) : CM.CLOTHES_PRICE;
      if (S.money < price) return;
      S.money -= price;
      if (kind === 'item') addItem(id); else if (kind === 'card') addCard(id); else S.wardrobe[id] = true;
      save();
      updateHud();
      return renderMenu();
    }
    if (d.opt) { SFX.set(d.opt, !SFX.opts[d.opt]); SFX.play('select'); return renderMenu(); }
    if (d.fly) {
      if (S.map !== 'world') return alert('You can only travel from outdoors. Step outside first.');
      const [x, y] = d.fly.split(',').map(Number);
      goTo('world', x, y, 'down');
      S.heal = ['world', x, y];
      alphas.length = 0;
      return closeMenu();
    }
    if (d.dev) return devDo(d.dev, d.v);
    if (d.store) { S.storage.push(S.party.splice(+d.store, 1)[0]); save(); return renderMenu(); }
    if (d.take) { if (S.party.length < CM.MAX_PARTY) S.party.push(S.storage.splice(+d.take, 1)[0]); save(); return renderMenu(); }
    if (inv && d.a === 'close') return closeMenu();
    if (help) { help = false; return renderMenu(); }
    if (wardrobe) {
      const { draft } = wardrobe;
      if (d.a === 'cancel') wardrobe = null;
      else if (d.a === 'save') return saveWardrobe();
      else if (d.w) {
        draft[d.w] = d.v;
        if (d.w === 'gender' && wardrobe.isNew) Object.assign(draft, GENDERS[d.v].look);
      }
      return renderMenu();
    }
    if (forge) {
      const { draft, avail } = forge;
      if (d.a === 'cancel') forge = null;
      else if (d.a === 'save') return saveForge();
      else if (d.a === 'clearart') { snapshot(); forge.pix.getContext('2d').clearRect(0, 0, GRID, GRID); }
      else if (d.a === 'undo') forge.pix.getContext('2d').putImageData(forge.undo.pop(), 0, 0);
      else if (d.a === 'stamp') { snapshot(); stampAuto(); }
      else if (d.a === 'mirror') forge.mirror = !forge.mirror;
      else if (d.size) forge.size = +d.size;
      else if (d.look) forge.look = d.look;
      else if (d.color) { forge.color = d.color; if (forge.tool === 'erase') forge.tool = 'pen'; }
      else if (d.tool) forge.tool = d.tool;
      else if (d.el) { draft.element = d.el; syncEgg(draft); }
      else if (d.shape) { draft.shape = d.shape; syncEgg(draft); }
      else if (d.add) {
        const isHp = CARDS[d.add].kind === 'hp';
        const list = isHp ? draft.hpCards : draft.moves;
        if (!isHp && list.includes(d.add)) return;
        if (!isHp && moveRoom(draft) <= 0) return;
        list.push(d.add);
        avail[d.add]--;
      } else if (d.un) {
        const [id] = draft[d.un].splice(+d.i, 1);
        avail[id] = (avail[id] || 0) + 1;
      }
      return renderMenu();
    }
    if (d.a === 'close') return closeMenu();
    if (d.a === 'wardrobe') return openWardrobe(false);
    if (d.a === 'howto') { help = true; return renderMenu(); }
    if (d.spray) S.spray = d.spray;
    if (d.a === 'evolve') {
      const c = S.party[+d.i], was = CM.maxHp(c);
      CM.evolve(c);
      alert(`${c.name} evolved${c.stage === 2 ? ' into its final form' : ''}!\n\n+${CM.maxHp(c) - was} max HP, and its attacks now deal ${Math.round((CM.STAGE_DMG[c.stage] - 1) * 100)}% extra damage.`);
    }
    if (d.a === 'new') return openForge(null);
    if (d.a === 'edit') return openForge(+d.i);
    if (d.a === 'lead') S.party.unshift(S.party.splice(+d.i, 1)[0]);
    if (d.a === 'dismantle') {
      const c = S.party[+d.i];
      if (!confirm(`Dismantle ${c.name}? Its Power Cards return to you, but its levels are lost.`)) return;
      [...c.moves, ...c.hpCards].filter((id) => CARDS[id].tier !== 4).forEach((id) => addCard(id));
      S.party.splice(+d.i, 1);
    }
    save();
    renderMenu();
  });

  // ---------- Character & wardrobe ----------
  // Picking a gender at the start sets a default hairstyle and outfit; everything stays changeable.
  const GENDERS = {
    boy: { label: 'Boy', title: 'young man', look: { hairStyle: 'short', top: 'tee', bottom: 'pants' } },
    girl: { label: 'Girl', title: 'young lady', look: { hairStyle: 'long', top: 'tee', bottom: 'skirt' } },
    other: { label: 'Non-binary', title: 'young creator', look: { hairStyle: 'bob', top: 'hoodie', bottom: 'shorts' } },
  };
  const HAIR_STYLES = { short: 'Short', spiky: 'Spiky', bob: 'Bob', long: 'Long', ponytail: 'Ponytail', pigtails: 'Pigtails', bun: 'Bun',
    curly: 'Curly', afro: 'Afro', mohawk: 'Mohawk', bald: 'Bald' };
  const SKIN_TONES = ['#fbe0c8', '#f3c9a0', '#e8b384', '#d9a066', '#b97d48', '#a86b3c', '#6e4424', '#4a2c16'];
  const HAIR_COLORS = ['#1c1c28', '#3a2412', '#5c3a1e', '#8a5a2b', '#b8823c', '#d8a03a', '#f3e2a0', '#f4f4f4', '#9a9a9a', '#c0452c',
    '#e0483c', '#f47a45', '#f08aa0', '#f29ad0', '#9b3fd6', '#5b3fa8', '#55a8ee', '#1f5f9e', '#39c7b3', '#72cc5c'];
  const CLOTH_COLORS = ['#e0483c', '#8c231b', '#f47a45', '#f5b942', '#f6d643', '#fff3a8', '#72cc5c', '#2f7a2c', '#39c7b3', '#b4e6c6',
    '#55a8ee', '#1f5f9e', '#bfe3fb', '#9b3fd6', '#5b3fa8', '#f29ad0', '#f08aa0', '#f4f4f4', '#d8d8d8', '#9a9a9a', '#566070',
    '#e3c98a', '#8a5a2b', '#3a2412', '#2c2c3c'];
  const NEW_LOOK = {
    name: '', gender: null, skin: SKIN_TONES[1], hair: HAIR_COLORS[1], hairStyle: 'short',
    hat: 'none', hatColor: '#e0483c', top: 'tee', topColor: '#e0483c', bottom: 'pants', bottomColor: '#1f5f9e',
  };
  function openWardrobe(isNew) {
    wardrobe = { isNew, draft: { ...(S.player || NEW_LOOK) } };
    renderMenu();
  }
  function paintPerson() {
    const g = $('pprev').getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 288, 320);
    g.setTransform(8, 0, 0, 8, 0, 0);
    drawPerson(g, 2, 8, wardrobe.draft, 'down');
  }
  function renderWardrobe() {
    const { draft, isNew } = wardrobe;
    $menu.className = '';
    const btn = (field, v, text, attrs = '') =>
      `<button class="plain ${draft[field] === v ? 'on' : ''}" data-w="${field}" data-v="${v}" ${attrs}>${text}</button>`;
    // A row of ready-made colours, then a picker for any colour at all.
    const swatches = (field, colors) => `<div class="swatches">${colors.map((c) =>
      `<button data-w="${field}" data-v="${c}" class="${draft[field] === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}
      <input type="color" data-wc="${field}" value="${draft[field]}" title="Any colour"></div>`;
    const slot = (name) => {
      const items = Object.keys(CLOTHES).filter((id) => CLOTHES[id].slot === name && (!CLOTHES[id].locked || S.wardrobe[id] || draft[name] === id)).map((id) => {
        const locked = CLOTHES[id].locked && !S.wardrobe[id];
        return btn(name, id, (locked ? '🔒 ' : '') + CLOTHES[id].name, locked ? 'disabled title="Not found yet"' : '');
      }).join('');
      return `<div class="pick">${items}</div>${CLOTHES[draft[name]].fixed ? '' : swatches(`${name}Color`, CLOTH_COLORS)}`;
    };
    $menu.innerHTML = `
      <header><h2>${isNew ? 'Who are you?' : 'Wardrobe'}</h2>${isNew ? '' : '<button data-a="cancel">Cancel</button>'}</header>
      <div class="forge">
        <div class="left">
          <canvas id="pprev" width="288" height="320"></canvas>
          <input id="pname" maxlength="12" placeholder="Your name..." value="${esc(draft.name)}">
          <button class="plain primary" data-a="save" ${draft.gender ? '' : 'disabled'}>${isNew ? 'Start adventure!' : 'Save look'}</button>
          ${draft.gender ? '' : '<small class="empty">Choose a gender to begin.</small>'}
          <small class="empty">More clothes are sold at Creatastops, hidden among the sparkles and won from trainers. They appear here once they are yours.</small>
        </div>
        <div class="right">
          <h3>Gender</h3>
          <div class="pick">${Object.keys(GENDERS).map((id) => btn('gender', id, GENDERS[id].label)).join('')}</div>
          <h3>Skin</h3>${swatches('skin', SKIN_TONES)}
          <h3>Hair</h3>
          <div class="pick">${Object.keys(HAIR_STYLES).map((id) => btn('hairStyle', id, HAIR_STYLES[id])).join('')}</div>
          ${swatches('hair', HAIR_COLORS)}
          <h3>Hat</h3>${slot('hat')}
          <h3>Top</h3>${slot('top')}
          <h3>Bottom</h3>${slot('bottom')}
        </div>
      </div>`;
    paintPerson();
    $('pname').oninput = (e) => { draft.name = e.target.value; };
    $menu.querySelectorAll('[data-wc]').forEach((el) => { el.oninput = () => { draft[el.dataset.wc] = el.value; paintPerson(); }; });
  }
  function saveWardrobe() {
    const { draft, isNew } = wardrobe;
    S.player = { ...draft, name: draft.name.trim() || 'Creator' };
    wardrobe = null;
    save();
    if (!isNew) return renderMenu();
    closeMenu();
    if (!S.f.start) intro();
  }

  // ---------- Drawing ----------
  NPCS.forEach((n) => { n.drawn = n.look && { ...NEW_LOOK, ...n.look }; });

  // 3D when WebGL is available; otherwise the flat view below.
  const gl3d = GL3D.create($world), $overlay = $('overlay');

  // Darkness, fog and the Blackest Night, drawn over the view. sx, sy: the player's tile corner on screen.
  function overlays(g, sx, sy, time) {
    const m = MAPS[S.map];
    if (m.dark) {
      const glow = g.createRadialGradient(sx + 16, sy + 16, 26, sx + 16, sy + 16, 84);
      glow.addColorStop(0, '#06040c00'); glow.addColorStop(1, '#06040cfa');
      g.fillStyle = glow; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (m.fog && !S.f.night) {
      for (let i = 0; i < 7; i++) {
        g.fillStyle = 'rgba(240,244,255,.22)';
        g.beginPath(); g.ellipse(((i * 131 + time / (30 + i * 4)) % (VIEW_W + 300)) - 150, 30 + i * 50, 150, 30, 0, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(230,236,250,.18)'; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (S.f.night && !S.f.dawn) {
      g.fillStyle = `rgba(60,0,45,${0.34 + 0.06 * Math.sin(time / 600)})`; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
  const spriteFor = (x, y, time) => {
    const k = `${x},${y}`, found = pickupAt(x, y), npc = npcAt(x, y);
    if (P.blocks[k]) return (g, sx, sy) => drawProp(g, P.blocks[k], sx, sy, time);
    if (!npc) return found ? (g, sx, sy) => drawProp(g, 'sparkle', sx, sy, time, found) : null;
    return npc.kind ? (g, sx, sy) => drawProp(g, npc.kind, sx, sy, time, { taken: S.f.blade, el: npc.el, won: !!S.badges[npc.el] })
      : Object.assign((g, sx, sy) => drawPerson(g, sx, sy, npc.drawn, 'down'), { fig: true });
  };

  // Painted over the view: the name of whoever the player is facing, and an arrow to the next goal. The arrow hangs
  // over the goal when it is in sight and otherwise sits at the edge of the screen pointing the way.
  // at(x, y, h) gives the screen position of a point h tiles above the middle of tile x, y.
  function guide(g, at, time) {
    const pill = (text, cx, cy, fill) => {
      g.font = 'bold 9px "Trebuchet MS", Verdana, sans-serif';
      const w = g.measureText(text).width + 10;
      g.fillStyle = fill; g.beginPath(); g.roundRect(cx - w / 2, cy - 7, w, 13, 6.5); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cx, cy);
    };
    // dir: the way the arrow points, as an angle (0 = right, a quarter turn = down)
    const arrow = (cx, cy, dir) => {
      g.save(); g.translate(cx, cy); g.rotate(dir);
      g.beginPath(); g.moveTo(11, 0); g.lineTo(-3, -9); g.lineTo(-3, -4); g.lineTo(-11, -4); g.lineTo(-11, 4); g.lineTo(-3, 4); g.lineTo(-3, 9); g.closePath();
      g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = '#1d2437'; g.stroke();
      g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.fillStyle = '#e8384f'; g.fill(); g.stroke();
      g.restore();
    };
    const fx = S.x + DIRS[S.dir][0], fy = S.y + DIRS[S.dir][1], facing = !move && npcAt(fx, fy);
    if (facing) pill(facing.name, ...at(fx, fy, 1.95), '#1d2437e6');
    else if (S.map === 'world' && CM.STOP_AT[`${fx},${fy}`]) pill('Creatastop', ...at(fx, fy, 1.6), '#e8384fe6');
    // Stand still for a few seconds and your title shows over your head.
    const rank = myTitle();
    if (rank && mode === 'world' && performance.now() - idleSince > 3000) pill(`★ ${rank} ★`, ...at(S.x, S.y, 2.2), '#b8860bf0');
    alphas.forEach((a) => { if (a.chase) pill('!', ...at(a.px + (a.x - a.px) * a.t, a.py + (a.y - a.py) * a.t, 1.9), '#e8384ff0'); });
    const wp = waypoint();
    if (!wp) return;
    const [tx, ty] = where(), [sx, sy] = at(wp[0], wp[1], 1.9), far = Math.abs(wp[0] - S.x) + Math.abs(wp[1] - S.y);
    const near = Math.abs(wp[0] - tx) < 9 && wp[1] - ty < 5 && ty - wp[1] < 9;
    if (near && sx > 20 && sx < VIEW_W - 20 && sy > 46 && sy < VIEW_H - 40) {
      if (!(facing && fx === wp[0] && fy === wp[1])) arrow(sx, sy - 6 + Math.sin(time / 220) * 3, Math.PI / 2);
    } else {
      const a = Math.atan2(wp[1] - ty, wp[0] - tx), cx = VIEW_W / 2 + Math.cos(a) * 196, cy = VIEW_H / 2 + 14 + Math.sin(a) * 118;
      arrow(cx + Math.cos(a) * Math.sin(time / 220) * 3, cy + Math.sin(a) * Math.sin(time / 220) * 3, a);
      pill(`${far} steps`, cx - Math.cos(a) * 26, cy - Math.sin(a) * 20, '#1d2437cc');
    }
  }

  function draw(time) {
    const m = MAPS[S.map], w = m.rows[0].length, h = m.rows.length;
    const [tx, ty] = where();
    // Alternate feet from one step to the next.
    const frame = move && move.n === 1 && move.t > 0.15 && move.t < 0.85 ? ((move.pts[0][0] + move.pts[0][1]) & 1) + 1 : 0;
    const me = (g, sx, sy) => drawPerson(g, sx, sy, S.player || NEW_LOOK, S.dir, frame, S.surf, S.bike);

    if (gl3d) {
      // The camera follows the player but stops short of the map's edge; small rooms sit in the middle.
      const cx = w <= 15 ? w / 2 : Math.max(7.5, Math.min(w - 7.5, tx + 0.5));
      const cy = h <= 14 ? h / 2 + 1.5 : Math.max(8.5, Math.min(h - 5.5, ty + 0.5));
      const sprites = [{ x: tx, y: ty, draw: me, fig: true }];
      alphas.forEach((a) => sprites.push({ x: a.px + (a.x - a.px) * a.t, y: a.py + (a.y - a.py) * a.t, big: 1.8, draw: (g, sx, sy) => drawAlpha(g, a, sx, sy, time) }));
      for (let y = Math.floor(cy) - 11; y <= Math.floor(cy) + 7; y++) {
        for (let x = Math.floor(cx) - 12; x <= Math.floor(cx) + 12; x++) {
          const fn = spriteFor(x, y, time);
          if (fn) sprites.push({ x, y, draw: fn, fig: fn.fig });
        }
      }
      const project = gl3d.render({ id: S.map, P, S, cx, cy, time, sprites });
      const o = $overlay.getContext('2d');
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.clearRect(0, 0, $overlay.width, $overlay.height);
      o.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      const [sx, sy] = project(tx + 0.5, 0.7, ty + gl3d.FOOT);
      overlays(o, sx - 16, sy - 16, time);
      return guide(o, (x, y, up) => project(x + 0.5, up, y + 0.62), time);
    }

    const g = $world.getContext('2d');
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    g.imageSmoothingEnabled = false;
    const px = tx * TILE, py = ty * TILE;
    // Small rooms sit in the middle of the screen; big maps scroll, snapped to the finer pixel grid.
    const cam = (p, size, view) => (size <= view ? (size - view) / 2
      : Math.round(Math.max(0, Math.min(size - view, p - view / 2 + 16)) * SCALE) / SCALE);
    const camX = cam(px, w * TILE, VIEW_W), camY = cam(py, h * TILE, VIEW_H);
    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    const each = (fn) => {
      for (let y = y0; y <= y0 + 11; y++) for (let x = x0; x <= x0 + 15; x++) fn(x, y, x * TILE - camX, y * TILE - camY);
    };
    each((x, y, sx, sy) => drawTile(g, S.map, x, y, sx, sy, time, P, S));
    each((x, y, sx, sy) => { const fn = spriteFor(x, y, time); if (fn) fn(g, sx, sy); });
    alphas.forEach((a) => drawAlpha(g, a, (a.px + (a.x - a.px) * a.t) * TILE - camX, (a.py + (a.y - a.py) * a.t) * TILE - camY, time, 1.6));
    me(g, px - camX, py - camY);
    overlays(g, px - camX, py - camY, time);
    guide(g, (x, y, up) => [x * TILE - camX + 16, y * TILE - camY + 28 - up * 26], time);
  }

  // ---------- Input & loop ----------
  const DEV_CODE = 'iam100';
  let typed = '';   // the last few keys pressed in the menu
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase();
    const confirmKey = k === 'enter' || k === ' ' || k === 'z';
    if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    if (advance) { if (confirmKey && !e.repeat) { e.preventDefault(); tryAdvance(); } return; }
    if (!$actions.hidden && k >= '1' && k <= '9') {
      const b = $actions.querySelectorAll('button')[+k - 1];
      if (b) b.click();
      return;
    }
    if (mode === 'world') {
      if (k === 'm' || k === 'escape') return openMenu();
      if (k === 'e') { inv = true; return openMenu(); }
      if (k === 'q') return toggleBike();
      if (k === 'r') return resetPuzzle();
      if (k === 'g') return spray();
      if (confirmKey && !e.repeat) return interact();
    } else if (mode === 'menu' && k.length === 1 && (typed = (typed + k).slice(-DEV_CODE.length)) === DEV_CODE) {
      // The secret word, typed anywhere in the menu, opens the developer tools.
      typed = '';
      forge = wardrobe = shop = null;
      help = inv = false;
      S.dev = S.dev || {};
      page = 'dev';
      return renderMenu();
    } else if (mode === 'menu' && inv && (k === 'escape' || k === 'e')) {
      return closeMenu();
    } else if (mode === 'menu' && k === 'escape') {
      if (page !== 'home' && !forge && !wardrobe && !help && !shop) { page = 'home'; renderMenu(); }
      else if (help) { help = false; renderMenu(); }
      else if (wardrobe) { if (wardrobe.isNew) return; wardrobe = null; renderMenu(); }
      else if (forge) { forge = null; renderMenu(); } else closeMenu();
      return;
    }
    keys[k] = true;
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  // ---- Touch controls ----
  // A direction pad and a few buttons, shown on touch screens while walking around. Everything else is already tappable.
  const $pad = $('pad');
  let touch = matchMedia('(pointer: coarse)').matches;
  addEventListener('touchstart', () => { touch = true; }, { passive: true });
  const letGo = () => $pad.querySelectorAll('[data-hold]').forEach((b) => { keys[b.dataset.hold] = false; b.classList.remove('down'); });
  $pad.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.tap) return void dispatchEvent(new KeyboardEvent('keydown', { key: b.dataset.tap }));
    letGo();
    keys[b.dataset.hold] = true;
    b.classList.add('down');
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => $pad.addEventListener(ev, letGo));
  $pad.addEventListener('contextmenu', (e) => e.preventDefault());

  $dialog.addEventListener('click', tryAdvance);
  $battle.addEventListener('click', tryAdvance);
  $hud.addEventListener('click', () => { if (mode === 'world') openMenu(); });

  let last = 0;
  function frame(time) {
    const dt = Math.min(50, time - last);
    last = time;
    if (S && mode !== 'title') { S.stats.time += dt; update(dt); if ($battle.hidden && $menu.hidden) draw(time); }
    const pad = touch && mode === 'world' && $dialog.hidden;
    if ($pad.hidden === pad) { $pad.hidden = !pad; if (!pad) letGo(); $game.classList.toggle('touch', touch); }
    requestAnimationFrame(frame);
  }

  function fit() {
    const s = Math.min(innerWidth / 740, innerHeight / 548, 1.75);
    $game.style.transform = `scale(${s})`;
    // Crisp pixels when the canvas is shown at or above its own resolution, smooth when shrunk.
    $world.style.imageRendering = !gl3d && s * 720 >= $world.width ? 'pixelated' : 'auto';
  }
  addEventListener('resize', fit);

  function start(state) {
    S = state;
    loadSeen(S.explored);
    lastArea = null;
    goTo(S.map, S.x, S.y);
    // Puzzles are not saved part-way: an unfinished one starts over from the gym door.
    if (MAPS[S.map].puzzle && !isDone(S.map)) [S.x, S.y] = MAPS[S.map].entry;
    $title.hidden = true;
    mode = 'world';
    SFX.music('world');
    draw(0);
    if (!S.player) {
      // New game, or a save from before characters existed: pick a look first.
      mode = 'menu';
      $menu.hidden = false;
      openWardrobe(true);
    } else if (!S.f.start) intro();
    dailyGift();
  }

  $('btnNew').onclick = () => {
    if (load() && !confirm('Start over? Your saved game will be erased.')) return;
    start(newState());
  };
  $('btnContinue').onclick = () => start(load());
  $('btnContinue').hidden = !load();
  fit();
  requestAnimationFrame(frame);
})();
