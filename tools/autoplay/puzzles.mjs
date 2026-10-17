// Gym puzzles: a search over (position, puzzle state) for a way to stand next to the Leader, returned as the moves to
// make. test/core.test.js runs it on every gym, so the bot's answers are proved to exist.
import { CM } from '../../src/world.js';

const { MAPS } = CM;
const DIRS = Object.keys(CM.DIRS);
const all = new Proxy({}, { get: () => true });
const canon = (P) => JSON.stringify([Object.keys(P.blocks).sort(), Object.keys(P.fill).sort(), Object.keys(P.lit).sort(), P.sw, P.fire, P.solved]);
const facing = (x, y, tx, ty) => (tx > x ? 'right' : tx < x ? 'left' : ty > y ? 'down' : 'up');

// Breadth-first (shortest), except for the panel puzzle's way to the Leader: its states are whole paths, so depth-first
// finds an answer without holding them all. Returns { moves: [{ dir } | { fire: i, dir }], n } or null.
//   from / P: where the search starts (default: the gym door and a fresh puzzle); S: the save (for cracked rocks);
//   blocked(x, y): people in the way (default: just the Leader); goal(x, y, P): where it may stop.
export function solvePuzzle(id, opts = {}) {
  const m = MAPS[id], S = opts.S || { smashed: all, surf: false };
  const [lx, ly] = m.leader;
  const blocked = opts.blocked || ((x, y) => x === lx && y === ly);
  const goal = opts.goal || ((x, y) => Math.abs(x - lx) + Math.abs(y - ly) === 1);
  const from = opts.from || { x: m.entry[0], y: m.entry[1] };
  const nodes = [{ x: from.x, y: from.y, P: opts.P ? JSON.parse(JSON.stringify(opts.P)) : CM.initPuzzle(id), parent: -1, act: null }];
  const seen = new Set(), stack = [0];
  const deep = opts.deep ?? (m.puzzle === 'panels' && !opts.goal);
  const moves = (i) => { const out = []; for (; nodes[i].parent >= 0; i = nodes[i].parent) out.unshift(nodes[i].act); return out; };
  for (let head = 0; deep ? stack.length : head < stack.length; head++) {
    const i = deep ? stack.pop() : stack[head], st = nodes[i];
    const k = `${st.x},${st.y}|${canon(st.P)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (seen.size > 3e6) return null;
    if (goal(st.x, st.y, st.P)) { const list = moves(i); return { moves: list, n: list.length }; }
    const clone = () => JSON.parse(JSON.stringify(st.P));
    const add = (x, y, P, act) => { nodes.push({ x, y, P, parent: i, act }); stack.push(nodes.length - 1); };
    for (const dir of DIRS) {
      const P = clone();
      const res = CM.step(id, P, S, st.x, st.y, dir, blocked);
      if (!res || CM.arrive(id, P, res.x, res.y) === 'shock') continue;
      const [tx, ty] = CM.teleAt(id, res.x, res.y) || [res.x, res.y];
      add(tx, ty, P, { dir });
    }
    m.fires.forEach((fk, f) => {
      const [fx, fy] = fk.split(',').map(Number);
      if (Math.abs(st.x - fx) + Math.abs(st.y - fy) !== 1) return;
      const P = clone();
      CM.toggleFire(id, P, f);
      add(st.x, st.y, P, { fire: f, dir: facing(st.x, st.y, fx, fy) });
    });
    // Nodes no longer needed for an answer are dropped from memory in the breadth-first case.
    if (!deep) st.P = null;
  }
  return null;
}
