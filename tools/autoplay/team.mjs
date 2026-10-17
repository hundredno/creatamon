// Building the team: which element and moves each Creatamon should have for the fights ahead, from the cards in hand.
// The plan is carried out through the Forge screen with clicks, as a player would.
import { CM } from '../../src/world.js';

const { CARDS, GYMS, GYM_ORDER, TEAMS, SPECIES } = CM;
export const ELEMENTS = Object.keys(CM.ELEMENTS).filter((e) => !CM.ELEMENTS[e].hidden);
// Names for the bot's Creatamon. Never the easter egg's.
export const NAMES = ['Ember', 'Bramble', 'Nova', 'Pip', 'Juno', 'Kestrel', 'Basil', 'Comet'];
const total = (m) => (m.power || 0) * (m.hits || 1);

// The elements of the Creatamon the bot expects to face next, with weights.
export function opponents(S) {
  const w = {};
  const add = (el, n) => { w[el] = (w[el] || 0) + n; };
  ELEMENTS.forEach((e) => add(e, 0.3));
  const n = CM.badgeCount(S);
  const team = (list, k) => list.forEach(([sp]) => add(SPECIES[sp].element, k));
  if (n < GYM_ORDER.length) {
    const gm = GYMS[n];
    add(gm.el, 4);
    team(gm.team, 0.5);
    if (GYMS[n + 1]) add(GYMS[n + 1].el, 1.2);
  } else {
    [TEAMS.vex, TEAMS.sterling, TEAMS.eternox1, TEAMS.brann2, TEAMS.finn4].forEach((t) => team(t, 0.8));
  }
  return w;
}

// How well a Creatamon of element `el` with these moves does against the expected opposition.
export function value(el, moves, opp) {
  let sum = 0;
  for (const [o, w] of Object.entries(opp)) {
    let best = 0, next = 0;
    for (const m of moves) {
      const c = CARDS[m];
      if (!c.power) continue;
      const v = total(c) * Math.min(100, c.acc) / 100 * CM.effectiveness(c.element, o) * (c.element === el ? 1.25 : 1) * (c.first ? 1.05 : 1) * (c.drain ? 1 + c.drain / 3 : 1);
      if (v > best) { next = best; best = v; } else if (v > next) next = v;
    }
    const guard = { 2: 0.7, 1: 1, 0.5: 1.3 }[CM.effectiveness(o, el)];
    sum += w * (best + 0.15 * next) * guard;
  }
  // One move that raises our own stats is worth having for long fights.
  if (moves.some((m) => !CARDS[m].power && CARDS[m].up)) sum *= 1.06;
  return sum;
}

// The best element and six moves from a pool of card counts. Returns { element, moves, score }.
// others: the elements of the rest of the team; sharing one costs a little, so the team does not share its weaknesses.
export function bestBuild(pool, opp, keep = [], others = []) {
  const ids = Object.keys(pool).filter((id) => pool[id] > 0 && CARDS[id].kind === 'move' && CARDS[id].tier < CM.SECRET);
  let best = null;
  for (const el of ELEMENTS) {
    const moves = [...keep];
    while (moves.length < CM.MOVE_SLOTS) {
      let pick = null, gain = -1;
      const now = value(el, moves, opp);
      for (const id of ids) {
        if (moves.includes(id)) continue;
        const g = value(el, [...moves, id], opp) - now + total(CARDS[id]) * 1e-4;
        if (g > gain) { gain = g; pick = id; }
      }
      if (!pick) break;
      moves.push(pick);
    }
    const score = value(el, moves, opp) * 0.85 ** others.filter((e) => e === el).length;
    if (!best || score > best.score) best = { element: el, moves, score };
  }
  return best;
}

// What to change now, at most one Creatamon at a time:
//   { kind: 'new', build } | { kind: 'rebuild', idx, build } | null
// checkpoint: the team is about to go into a big battle, the moment to make smaller improvements. Otherwise only
// a big step up is worth a Creataball (new cards drop all the time while training).
export function nextChange(S, { checkpoint = false } = {}) {
  const balls = S.items.creataball || 0;
  if (!balls) return null;
  const opp = opponents(S), cards = { ...S.cards };
  const hpUnused = Object.keys(cards).filter((id) => CARDS[id].kind === 'hp').reduce((n, id) => n + CARDS[id].amount * cards[id], 0);
  const moveCount = Object.keys(cards).filter((id) => CARDS[id].kind === 'move').reduce((n, id) => n + cards[id], 0)
    + S.party.reduce((n, c) => n + c.moves.length, 0);
  const want = moveCount >= 16 ? 3 : moveCount >= 8 ? 2 : 1;
  // A new Creatamon from the unused cards, if the team is short and there are cards enough to make it useful.
  if (S.party.length < want && (balls > 1 || !S.party.length)) {
    const build = bestBuild(cards, opp, [], S.party.map((c) => c.element));
    if (build && build.moves.length >= Math.min(3, moveCount)) return { kind: 'new', build: { ...build, hpCards: hpFor(cards, S, null) } };
  }
  // A rebuild that makes someone clearly stronger, or that puts a good pile of unused health cards to work.
  let pick = null;
  S.party.forEach((c, idx) => {
    const pool = { ...cards };
    c.moves.forEach((id) => { pool[id] = (pool[id] || 0) + 1; });
    const others = S.party.filter((o) => o !== c).map((o) => o.element);
    const build = bestBuild(pool, opp, [], others);
    const now = value(c.element, c.moves, opp) * 0.85 ** others.filter((e) => e === c.element).length;
    const gain = build.score / Math.max(1, now);
    const hp = hpFor(cards, S, c);
    // Health cards alone are worth a rebuild once they add a good share to its health.
    const bulk = checkpoint && hp.length > c.hpCards.length && hpUnused >= Math.max(100, CM.maxHp(c) * 0.4);
    if ((gain > (checkpoint ? 1.12 : 1.5) || bulk) && (!pick || gain > pick.gain)) pick = { kind: 'rebuild', idx, gain, build: { ...(gain > 1.05 ? build : { element: c.element, moves: c.moves }), hpCards: hp } };
  });
  return pick;
}
// The health cards a Creatamon should carry: its own, plus its share of the unused ones (the strongest get more).
function hpFor(cards, S, c) {
  const own = c ? [...c.hpCards] : [];
  const spare = [];
  Object.keys(cards).filter((id) => CARDS[id].kind === 'hp').forEach((id) => { for (let i = 0; i < cards[id]; i++) spare.push(id); });
  spare.sort((a, b) => CARDS[b].amount - CARDS[a].amount);
  const n = Math.max(1, S.party.length + (c ? 0 : 1));
  // A lone Creatamon takes them all; otherwise the lead gets half and the rest share what is left.
  const rank = c ? S.party.indexOf(c) : S.party.length;
  const share = n === 1 ? spare.length : rank === 0 ? Math.ceil(spare.length / 2) : Math.ceil(spare.length / (2 * (n - 1)));
  return [...own, ...spare.slice(0, share)];
}

// Carries out a change through the menu. The Forge must not be open yet unless `open` says it already is.
export async function forge(game, change, { open = false } = {}) {
  const { build } = change;
  if (!open) {
    await openMenu(game, 'party');
    await game.click(change.kind === 'new' ? '#menu [data-a="new"]' : `#menu [data-a="edit"][data-i="${change.idx}"]`);
    await game.think(400, 800);
  }
  await game.click(`#menu [data-el="${build.element}"]`);
  await game.think(200, 400);
  await game.click('#menu [data-shape="Beast"]');
  await game.think(200, 400);
  // Take off the moves that are not part of the plan, then slot the ones that are.
  for (let n = 0; n < 12; n++) {
    const off = await game.page.$$eval('#menu [data-un="moves"]', (els, keep) => els.findIndex((e) => !keep.includes(e.querySelector('b').textContent)),
      build.moves.map((id) => CARDS[id].name));
    if (off < 0) break;
    await game.click(`#menu [data-un="moves"] >> nth=${off}`);
    await game.think(150, 300);
  }
  for (const id of build.moves) {
    const slotted = await game.page.$$eval('#menu [data-un="moves"] b', (els) => els.map((e) => e.textContent));
    if (slotted.includes(CARDS[id].name)) continue;
    if (!await game.page.$(`#menu [data-add="${id}"]`)) continue;
    await game.click(`#menu [data-add="${id}"]`);
    await game.think(150, 300);
  }
  const have = await game.page.$$eval('#menu [data-un="hpCards"] b', (els) => els.map((e) => e.textContent));
  const need = {};
  build.hpCards.forEach((id) => { need[id] = (need[id] || 0) + 1; });
  for (const id of Object.keys(need)) {
    for (let k = have.filter((n) => n === CARDS[id].name).length; k < need[id]; k++) {
      if (!await game.page.$(`#menu [data-add="${id}"]`)) break;
      await game.click(`#menu [data-add="${id}"]`);
      await game.think(100, 200);
    }
  }
  if (change.kind === 'new') {
    const S = game.last.save;
    const name = NAMES.find((n) => !S.party.some((c) => c.name === n) && !S.storage.some((c) => c.name === n)) || `Mon${S.party.length + 1}`;
    await game.type('#fname', name);
    await game.think(300, 600);
  }
  await game.click('#menu [data-a="save"]');
  await game.think(500, 900);
}

// Opens the menu (from the world) on a page: party | map | bag ... Leaves it open.
const HEADS = { party: 'Creatamon', map: 'Town Map', card: 'Trainer Card' };
export async function openMenu(game, page) {
  let s = await game.look();
  if (!s.menu) {
    await game.press('m');
    s = await game.until((v) => v.menu, 2000);
    if (!s) return false;
  }
  await game.think(250, 500);
  if (!page || s.menu.head.startsWith(HEADS[page] || '?')) return true;
  if (!s.menu.cls.includes('home')) {
    await game.click('#menu [data-a="home"]');
    await game.think(250, 500);
  }
  if (page !== 'home') {
    await game.click(`#menu [data-page="${page}"]`);
    await game.think(300, 600);
  }
  return true;
}
export async function closeMenu(game) {
  for (let i = 0; i < 4; i++) {
    const s = await game.look();
    if (!s.menu) return;
    if (await game.page.$('#menu [data-a="close"]')) await game.click('#menu [data-a="close"]');
    else await game.press('Escape');
    await game.think(250, 450);
  }
}
