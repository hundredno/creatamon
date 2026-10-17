// Finding the way: shortest routes across the overworld and every interior, using the game's own movement rules
// (CM.step), so ice slides, vents, warp pads, doors and exits come out exactly as the game plays them.
import { CM } from '../../src/world.js';
import { STEP_MS } from './game.mjs';

const { MAPS, WARPS, NPCS, DIRS } = CM;
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
export const keyOf = (dir) => KEY[dir];
export const nodeKey = (map, x, y) => `${map}:${x},${y}`;
// Extra cost (ms) of a tile where wild Creatamon can jump out: a battle costs far more than a few steps round.
const GRASS = 2500, SMASH = 5000, WARP = 700, FLY = 6000, TALK = 25000;

export const isDone = (S, id) => !!(S.solved[id] || (MAPS[id].el && S.badges[MAPS[id].el]));
export const isGrass = (map, x, y) => { const ch = CM.charAt(map, x, y); return !!CM.ZONE_OF[ch] && !!CM.areaAt(map, x, y).lv; };
// People standing in the world right now (who is about depends on the story).
export const npcAt = (S, map, x, y) => NPCS.find((n) => n.map === map && n.x === x && n.y === y && (!n.show || n.show(S)));
export const canSmash = (S) => S.party.some((c) => c.moves.includes('rock_smash')) || S.cards.rock_smash > 0;

// Dijkstra from `from` over (map, x, y). opts:
//   P: { [map]: puzzle state } for maps whose state the bot is tracking (gyms part-way through)
//   avoidGrass: long grass costs extra; through: people in the way may be walked "through" at a high cost (to find
//   who has to be talked to); fly: from outdoors, the Town Map's fast travel counts as a move; goal(map, x, y): stop there.
export function search(S, from, opts = {}) {
  const bike = !!S.f.bike, hydro = !!S.f.hydro;
  const Sx = { ...S, surf: hydro };
  const puzzles = {};
  const P = (map) => puzzles[map] || (puzzles[map] = (opts.P && opts.P[map]) || CM.initPuzzle(map, isDone(S, map)));
  const dist = new Map(), prev = new Map(), heap = [];
  const push = (k, d, node, edge) => {
    if (dist.has(k) && dist.get(k) <= d) return;
    dist.set(k, d); prev.set(k, edge); heap.push([d, k, node]);
    for (let i = heap.length - 1; i > 0;) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]]; i = m;
      }
    }
    return top;
  };
  const start = nodeKey(from.map, from.x, from.y);
  push(start, 0, from, null);
  const done = new Set();
  let found = null;
  while (heap.length) {
    const [d, k, node] = pop();
    if (done.has(k)) continue;
    done.add(k);
    const { map, x, y } = node;
    if (opts.goal && opts.goal(map, x, y)) { found = k; break; }
    if (opts.limit && d > opts.limit) break;
    const pz = P(map), stepMs = map === 'world' && bike ? STEP_MS.bike : STEP_MS.walk;
    for (const dir of Object.keys(DIRS)) {
      const [dx, dy] = DIRS[dir], nx = x + dx, ny = y + dy, ch = CM.charAt(map, nx, ny);
      if (map === 'world' && CM.STOP_AT[`${nx},${ny}`]) continue;
      const warp = WARPS[nodeKey(map, nx, ny)];
      if (warp && warp.need && warp.need(S)) continue;
      if (pz.blocks[`${nx},${ny}`]) continue;
      const who = npcAt(S, map, nx, ny);
      if (who) {
        if (opts.through && who.kind !== 'banner') push(nodeKey(map, nx, ny), d + TALK, { map, x: nx, y: ny }, { from: k, dir, talk: who.id, to: { map, x: nx, y: ny } });
        continue;
      }
      if (ch === 'x' && !S.smashed[nodeKey(map, nx, ny)]) {
        if (canSmash(S)) push(nodeKey(map, nx, ny), d + SMASH, { map, x: nx, y: ny }, { from: k, dir, smash: true, to: { map, x: nx, y: ny } });
        continue;
      }
      if (ch === '~' && !(hydro && map === 'world')) continue;
      const res = CM.step(map, pz, Sx, x, y, dir, (a, b) => !!npcAt(S, map, a, b));
      if (!res || res.pushed) continue;
      let to = { map, x: res.x, y: res.y }, cost = res.n * stepMs;
      if (opts.avoidGrass && res.path.some(([a, b]) => isGrass(map, a, b))) cost += GRASS;
      const landWarp = WARPS[nodeKey(map, res.x, res.y)];
      if (landWarp) { to = { map: landWarp.map, x: MAPS[landWarp.map].entry[0], y: MAPS[landWarp.map].entry[1] }; cost += WARP; }
      else if (CM.charAt(map, res.x, res.y) === 'E') { const [m2, x2, y2] = MAPS[map].out; to = { map: m2, x: x2, y: y2 }; cost += WARP; }
      else { const twin = CM.teleAt(map, res.x, res.y); if (twin) to = { map, x: twin[0], y: twin[1] }; }
      push(nodeKey(to.map, to.x, to.y), d + cost, to, { from: k, dir, to, n: res.n, land: { x: res.x, y: res.y } });
    }
    if (opts.fly && k === start && map === 'world') {
      for (const at of Object.keys(S.visited || {})) {
        const [fx, fy] = at.split(',').map(Number);
        push(nodeKey('world', fx, fy), d + FLY, { map: 'world', x: fx, y: fy }, { from: k, fly: at, to: { map: 'world', x: fx, y: fy } });
      }
    }
  }
  const route = (k) => {
    const out = [];
    for (let e = prev.get(k); e; e = prev.get(e.from)) out.unshift(e);
    return out;
  };
  return { dist, route, found, cost: found ? dist.get(found) : Infinity };
}

// The route to the first place where goal(map, x, y) holds, or null.
export function routeTo(S, from, goal, opts = {}) {
  const r = search(S, from, { ...opts, goal });
  return r.found ? { steps: r.route(r.found), cost: r.cost, end: r.found } : null;
}
// Standing next to (map, x, y), on a side the bot can stand on.
export const besideOf = (map, x, y) => (m, a, b) => m === map && Math.abs(a - x) + Math.abs(b - y) === 1;
// Which way to face from (x, y) to look at (tx, ty).
export const facing = (x, y, tx, ty) => (tx > x ? 'right' : tx < x ? 'left' : ty > y ? 'down' : 'up');
