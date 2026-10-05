// Run with: node test/core.test.js
const assert = require('assert');
const CM = require('../js/world.js');

const { MAPS, NPCS, CHESTS, GYMS, TEAMS, CARDS, SPECIES } = CM;
const DIRS = Object.keys(CM.DIRS);
const key = (x, y) => `${x},${y}`;

// ---------- Data ----------
// Maps are rectangular.
Object.values(MAPS).forEach((m) => m.rows.forEach((row, y) => assert.strictEqual(row.length, m.rows[0].length, `${m.id} row ${y} width`)));

// Every card, species and outfit referenced anywhere exists.
const teams = [...Object.values(TEAMS), ...GYMS.map((g) => g.team), ...NPCS.filter((n) => n.team).map((n) => n.team)];
teams.flat().forEach(([name, level]) => assert.ok(SPECIES[name] && level > 0, `unknown species ${name}`));
Object.values(CM.WILD).flat().forEach(([name]) => assert.ok(SPECIES[name], `unknown wild species ${name}`));
Object.values(SPECIES).forEach((s) => {
  assert.ok(CM.ELEMENTS[s.element] && CM.SHAPES[s.shape], `bad species ${s.name}`);
  [...s.moves, ...s.hpCards].forEach((id) => assert.ok(CARDS[id], `${s.name}: unknown card ${id}`));
});
const rewards = [...CM.STARTER_CARDS, ...GYMS.flatMap((g) => g.reward), ...NPCS.flatMap((n) => n.reward || []),
  ...CHESTS.filter((c) => c.card).map((c) => c.card)];
rewards.forEach((id) => assert.ok(CARDS[id], `unknown card ${id}`));
CHESTS.forEach((c) => assert.strictEqual([c.card, c.outfit, c.item, c.spray].filter(Boolean).length, 1, `pickup at ${c.x},${c.y} needs exactly one thing in it`));
CHESTS.filter((c) => c.item).forEach((c) => assert.ok(CM.ITEMS[c.item], `unknown item ${c.item}`));
const outfits = [...CHESTS.filter((c) => c.outfit).map((c) => c.outfit), ...NPCS.flatMap((n) => n.outfit || [])];
outfits.forEach((id) => assert.ok(CM.CLOTHES[id] && CM.CLOTHES[id].locked, `bad outfit ${id}`));
assert.strictEqual(new Set(CHESTS.map((c) => `${c.map}:${c.x},${c.y}`)).size, CHESTS.length, 'duplicate chest position');
assert.strictEqual(new Set(NPCS.map((n) => n.id)).size, NPCS.length, 'duplicate npc id');

// One gym per element (the hidden Cursed element aside), each with a hall on the map.
const elements = Object.keys(CM.ELEMENTS).filter((e) => !CM.ELEMENTS[e].hidden);
assert.deepStrictEqual(GYMS.map((g) => g.el).sort(), elements.sort());
GYMS.forEach((g) => assert.ok(MAPS[`gym_${g.el}`].out && MAPS[`gym_${g.el}`].leader, `${g.el} gym is not placed`));
Object.keys(CM.ELEMENTS).forEach((a) => Object.keys(CM.ELEMENTS).forEach((b) => assert.ok(CM.effectiveness(a, b) > 0)));

// ---------- Creature maths ----------
const a = CM.create({ name: 'A', element: 'Water', shape: 'Blob', moves: ['tsunami_blast'], hpCards: ['hp100'] });
assert.strictEqual(CM.maxHp(a), 150);
const b = CM.create({ name: 'B', element: 'Fire', shape: 'Blob', moves: ['ember'] });
const r = CM.useMove(a, b, CARDS.tsunami_blast, () => 0.5);
assert.strictEqual(r.eff, 2);
assert.ok(b.hp < 50 && b.hp >= 0);
assert.deepStrictEqual(CM.useMove(a, b, CARDS.tsunami_blast, () => 0.99), { miss: true });
assert.strictEqual(CM.gainXp(a, 25 + 40), 2);
// Growth stops at the level cap, which rises with every badge and always clears the next Leader's best.
{
  const c = CM.create({ name: 'Cap', element: 'Fire', shape: 'Beast', moves: ['ember'] });
  CM.gainXp(c, 1e6, CM.levelCap(0));
  assert.strictEqual(c.level, CM.levelCap(0));
  assert.strictEqual(CM.gainXp(c, 1e6, CM.levelCap(0)), 0, 'no growth past the cap');
  GYMS.forEach((g, i) => {
    assert.ok(CM.levelCap(i) >= Math.max(...g.team.map((t) => t[1])), `${g.el}: cap below the Leader`);
    assert.ok(CM.levelCap(i + 1) > CM.levelCap(i));
  });
  assert.ok(CM.MOVE_SLOTS >= CM.STARTER_CARDS.filter((id) => CARDS[id].kind === 'move').length);
}
assert.strictEqual(a.level, 3);
a.hp = 10;
assert.ok(CM.useMove(a, b, CARDS.mend, () => 0).heal > 0);
assert.ok(CM.spawn('Fluffin', 40).moves.includes('hyper_burst'), 'high-level spawns learn stronger moves');

// The easter egg needs the name, the element and the body.
const yuji = (element, shape) => CM.create({ name: 'Modulo Yuji', element, shape, moves: ['cleave'], hpCards: ['hp250'] });
assert.ok(CM.isEgg(yuji('Shadow', 'Beast')) && !CM.isEgg(yuji('Fire', 'Beast')) && !CM.isEgg(yuji('Shadow', 'Blob')));
// Its infinity: the attacker takes 100 and it takes nothing (when the roll lands).
// Held items and evolution.
const fist = CM.spawn('Emberpup', 20), plain = CM.spawn('Emberpup', 20), dummy = () => CM.spawn('Boulderon', 20);
fist.item = 'gloves';
assert.ok(CM.useMove(fist, dummy(), CARDS.tackle, () => 0.5).dmg > CM.useMove(plain, dummy(), CARDS.tackle, () => 0.5).dmg, 'gloves add damage');
const guarded = dummy(); guarded.item = 'shield';
assert.deepStrictEqual(CM.useMove(plain, guarded, CARDS.tackle, () => 0.2), { blocked: true });
assert.strictEqual(guarded.hp, CM.maxHp(guarded));
const kid = CM.create({ name: 'K', element: 'Fire', shape: 'Blob', moves: ['ember'], level: 16 }), kidHp = CM.maxHp(kid);
const kidDmg = CM.useMove(kid, dummy(), CARDS.ember, () => 0.5).dmg;
assert.ok(CM.canEvolve(kid)); CM.evolve(kid);
assert.ok(CM.maxHp(kid) === kidHp + 60 && kid.hp === CM.maxHp(kid) && !CM.canEvolve(kid), 'evolving builds in health');
assert.ok(CM.useMove(kid, dummy(), CARDS.ember, () => 0.5).dmg > kidDmg, 'evolved attacks hit harder');
// Trainers' Creatamon carry nicknames and keep their species for the Creatadex.
CM.makeTeam('Finn', CM.TEAMS.finn2).forEach((c) => assert.ok(SPECIES[c.species] && CM.NICKS.includes(c.name) && c.sketch));

const egg = yuji('Shadow', 'Beast'), bully = CM.spawn('Regalion', 40), before = bully.hp;
assert.deepStrictEqual(CM.useMove(bully, egg, CARDS.body_slam, () => 0.5), { infinity: 100 });
assert.ok(egg.hp === CM.maxHp(egg) && bully.hp === before - 100);
assert.ok(CM.useMove(bully, egg, CARDS.body_slam, () => 0.95).dmg > 0, 'the infinity can fail');
assert.ok(!CM.useMove(bully, yuji('Fire', 'Beast'), CARDS.body_slam, () => 0.5).infinity);
// Max Mode: more health, Max moves, and it comes off cleanly.
const big = CM.spawn('Cinderfox', 20), hp0 = CM.maxHp(big);
CM.setMax(big, true);
assert.strictEqual(CM.maxHp(big), Math.round(hp0 * 1.5));
assert.ok(CM.battleMoves(big).every((m) => m.heal || (m.acc === 100 && m.name.startsWith('Max '))));
assert.ok(CM.battleMoves(big).find((m) => m.element === 'Fire').power > CARDS.flame_wheel.power);
CM.setMax(big, false);
assert.ok(CM.maxHp(big) === hp0 && big.hp === hp0 && !('max' in big));
CM.setMax(egg, true);
assert.ok(CM.battleMoves(egg).some((m) => m.domain), 'Sukuna can open a domain');
assert.ok(CM.useMove(egg, bully, CM.DOMAIN_STRIKE, () => 0.99).dmg > 0, 'domain strikes cannot miss');
CM.setMax(egg, false);
for (let i = 0; i < 300; i++) {
  for (const z of Object.keys(CM.WILD)) {
    const c = CM.genWild(z, [5, 40]);
    assert.ok(c.hp > 0 && CM.pickMove(c, a).name);
    const d = CM.rollDrop([40, 40]);
    assert.ok(d === null || CARDS[d]);
    const sure = CARDS[CM.rollDrop([40, 40], Math.random, true)];
    assert.ok(sure.tier < 4 && !sure.key, 'key cards never drop');
  }
}

// ---------- Gym puzzles can all be solved ----------
const all = new Proxy({}, { get: () => true });
const canon = (P) => JSON.stringify([Object.keys(P.blocks).sort(), Object.keys(P.fill).sort(), Object.keys(P.lit).sort(), P.sw, P.fire, P.solved]);
// Search over (position, puzzle state) for a way to stand next to the Leader. Breadth-first, except the
// panel puzzle: its states are whole paths, so depth-first finds an answer without holding them all.
function solve(id) {
  const m = MAPS[id], S = { smashed: all, surf: false };
  const [lx, ly] = m.leader;
  const blocked = (x, y) => x === lx && y === ly;
  const start = { x: m.entry[0], y: m.entry[1], P: CM.initPuzzle(id), n: 0 };
  const seen = new Set(), stack = [start];
  const deep = m.puzzle === 'panels';
  for (let head = 0; deep ? stack.length : head < stack.length; head++) {
    const st = deep ? stack.pop() : stack[head];
    const k = `${st.x},${st.y}|${canon(st.P)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    assert.ok(seen.size < 3e6, `${id}: search too large`);
    if (Math.abs(st.x - lx) + Math.abs(st.y - ly) === 1) return st.n;
    const clone = () => JSON.parse(JSON.stringify(st.P));
    for (const dir of DIRS) {
      const P = clone();
      const res = CM.step(id, P, S, st.x, st.y, dir, blocked);
      if (!res || CM.arrive(id, P, res.x, res.y) === 'shock') continue;
      const [tx, ty] = CM.teleAt(id, res.x, res.y) || [res.x, res.y];
      stack.push({ x: tx, y: ty, P, n: st.n + 1 });
    }
    m.fires.forEach((fk, i) => {
      const [fx, fy] = fk.split(',').map(Number);
      if (Math.abs(st.x - fx) + Math.abs(st.y - fy) !== 1) return;
      const P = clone();
      CM.toggleFire(id, P, i);
      stack.push({ x: st.x, y: st.y, P, n: st.n + 1 });
    });
  }
  return -1;
}
GYMS.forEach((g) => {
  const id = `gym_${g.el}`, m = MAPS[id];
  const t0 = Date.now(), n = solve(id);
  if (process.env.VERBOSE) console.log(id, 'solved, path length', n, `${Date.now() - t0}ms`);
  assert.ok(n >= 0, `${id} cannot be solved`);
  // ...and the Leader is walled off until it is (the quiz gym uses gatekeepers instead).
  if (m.puzzle === 'quiz') return;
  const P = CM.initPuzzle(id), S = { smashed: all, surf: false }, seen = new Set([key(...m.entry)]), queue = [m.entry];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of Object.values(CM.DIRS)) {
      const nx = x + dx, ny = y + dy;
      if (seen.has(key(nx, ny)) || 'i<>AV'.includes(CM.charAt(id, nx, ny)) || !CM.passable(id, nx, ny, P, S) || P.blocks[key(nx, ny)]) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  assert.ok(!seen.has(key(m.leader[0], m.leader[1] + 1)), `${id}: Leader reachable without doing the challenge`);
});
// Solved puzzles stay open.
GYMS.forEach((g) => {
  const id = `gym_${g.el}`, P = CM.initPuzzle(id, true);
  assert.ok(P.solved && MAPS[id].pits.every((k) => P.fill[k]));
});

// ---------- The whole story can be walked ----------
const newS = () => ({ map: 'world', f: { start: true }, badges: {}, smashed: {}, solved: {}, quiz: 0, surf: false, chests: {}, beaten: all });
// Everything reachable from home across all maps, with puzzles treated as solved.
function reach(S, surf) {
  const seen = new Set(), queue = [['world', CM.START.x, CM.START.y]];
  const P = {};
  const Sx = { ...S, surf };
  const there = new Set(NPCS.filter((n) => !n.show || n.show(S)).map((e) => `${e.map}:${e.x},${e.y}`));
  const solid = (id, x, y) => there.has(`${id}:${x},${y}`);
  seen.add(`world:${CM.START.x},${CM.START.y}`);
  while (queue.length) {
    const [id, x, y] = queue.shift();
    P[id] = P[id] || CM.initPuzzle(id, true);
    const push = (m, a, c) => { const k = `${m}:${a},${c}`; if (!seen.has(k)) { seen.add(k); queue.push([m, a, c]); } };
    const warp = CM.WARPS[`${id}:${x},${y}`];
    if (warp) { push(warp.map, ...MAPS[warp.map].entry); continue; }
    if (CM.charAt(id, x, y) === 'E') { push(...MAPS[id].out); continue; }
    const twin = CM.teleAt(id, x, y);
    if (twin) push(id, ...twin);
    for (const [dx, dy] of Object.values(CM.DIRS)) {
      const nx = x + dx, ny = y + dy;
      const w = CM.WARPS[`${id}:${nx},${ny}`];
      if (w && w.need && w.need(S)) continue;
      // Valve gates count as open here: the valve puzzle is checked by solve() above.
      if (!(CM.GATE[CM.charAt(id, nx, ny)] || CM.passable(id, nx, ny, P[id], Sx)) || solid(id, nx, ny)) continue;
      push(id, nx, ny);
    }
  }
  return seen;
}
const touch = (seen, map, x, y) => Object.values(CM.DIRS).some(([dx, dy]) => seen.has(`${map}:${x + dx},${y + dy}`));
const S = newS();
let surf = false;
const can = (id) => { const n = NPCS.find((p) => p.id === id); assert.ok(n, `no npc ${id}`); return touch(reach(S, surf), n.map, n.x, n.y); };
// Each stage: who must be reachable now, then what meeting them changes.
const stages = [
  ['finn_home', () => { S.f.rival1 = true; }],
  ['beast', () => { S.f.grove = true; }],
  ['finn_wedge', () => { S.f.endorsed = true; }],
  ['staff', () => { S.f.ceremony = true; }],
  ['cyril_mine', () => { S.f.cyril1 = true; }, () => { S.smashed = all; }],
  ['leader_Grass', () => { S.badges.Grass = true; }],
  ['leader_Water', () => { S.badges.Water = true; }],
  ['nettie_kiln', () => { S.f.nettie1 = true; }],
  ['leader_Fire', () => { S.badges.Fire = true; }],
  ['leader_Wind', () => { S.badges.Wind = true; }],
  ['leader_Rock', () => { S.badges.Rock = true; }],
  ['cyril_mural', () => { S.f.mural = true; }],
  ['leader_Electric', () => { S.badges.Electric = true; }],
  ['leader_Metal', () => { S.badges.Metal = true; }],
  ['finn_r7', () => { S.f.rival3 = true; }],
  ['leader_Ice', () => { S.badges.Ice = true; }],
  ['wren_bath', () => { S.f.surf = true; }],
  ['holler_gate', () => { S.f.holler = true; }, () => { surf = true; }],
  ['nettie_thorn', () => { S.f.nettie2 = true; }],
  ['leader_Shadow', () => { S.badges.Shadow = true; }],
  ['leader_Mind', () => { S.badges.Mind = true; }],
  ['quiz1', () => { S.quiz = 5; }],
  ['leader_Normal', () => { S.badges.Normal = true; }],
  ['registrar', () => { S.f.semis = true; }],
  ['opaline', () => { S.f.opaline = true; }],
  ['gate_summit', () => { S.f.shortcut = true; S.f.night = true; }],
  ['altar', () => { S.f.blade = true; }],
  ['sterling', () => { S.f.sterling = true; }],
  ['eternox', () => { S.f.dawn = true; }],
  ['registrar', () => { S.f.champion = true; }],
];
// The next few story beats must be out of reach until the current one is done.
const LOCKED_AHEAD = ['leader_Grass', 'leader_Water', 'leader_Fire', 'leader_Wind', 'leader_Rock', 'leader_Electric', 'leader_Metal',
  'leader_Ice', 'leader_Shadow', 'leader_Mind', 'leader_Normal', 'registrar', 'sterling'];
stages.forEach(([id, done, before], i) => {
  const met = stages.slice(0, i + 1).map((st) => st[0]);
  const later = stages.slice(i + 1).map((st) => st[0]).filter((n) => LOCKED_AHEAD.includes(n) && !met.includes(n));
  // Rock Smash and Surf arrive just before they are needed; without them the way is shut.
  if (before) { assert.ok(!can(id), `${id} reachable without the field move`); before(); }
  assert.ok(can(id), `stage ${i}: cannot reach ${id}`);
  later.slice(0, 1).forEach((n) => assert.ok(!can(n), `stage ${i}: ${n} reachable too early`));
  done();
});
// Nobody gets ahead of a gym: the road on from each town stays shut until its badge is won.
{
  const early = { ...newS(), beaten: { b1: true }, f: { start: true, rival1: true, grove: true, endorsed: true, ceremony: true, cyril1: true }, smashed: all };
  const jo = NPCS.find((n) => n.id === 'b2');
  assert.ok(jo.need(early) && !jo.need({ ...early, badges: { Grass: true } }), 'Farmhand Jo waits for the Grass Badge');
  assert.ok(!reach(early, false).has('world:16,12'), 'Brinemouth reachable without the Grass Badge');
  const one = { ...early, badges: { Grass: true }, beaten: { b1: true, b2: true } };
  assert.ok(reach(one, false).has('world:16,12') && !reach(one, false).has('world:27,9'), 'Brinecut Tunnel open without the Water Badge');
}
// Every gym is flagged by a pair of banners that do not shut its door.
GYMS.forEach((g) => {
  const [dx, dy] = CM.gymDoor(g.el);
  assert.strictEqual(NPCS.filter((n) => n.kind === 'banner' && n.el === g.el).length, 2);
  assert.ok(!NPCS.some((n) => n.kind === 'banner' && n.x === dx && n.y === dy + 1), `${g.el}: banner in the doorway`);
});
// By the end every chest and every person can be reached.
const end = reach(S, true);
CHESTS.forEach((c) => {
  assert.ok(!'#^TRGWMI '.includes(CM.charAt(c.map, c.x, c.y)), `chest in a wall at ${c.x},${c.y}`);
  assert.ok(end.has(`${c.map}:${c.x},${c.y}`), `pickup unreachable at ${c.x},${c.y}`);
});
NPCS.filter((n) => n.team).forEach((n) => assert.ok(touch(end, n.map, n.x, n.y), `${n.name} unreachable`));
// Every wild habitat appears somewhere with a level range.
Object.keys(CM.WILD).filter((z) => z !== '5').forEach((z) => assert.ok(MAPS.world.rows.some((row, y) => [...row].some((ch, x) =>
  CM.ZONE_OF[ch] === +z && CM.areaAt('world', x, y).lv)), `habitat ${z} missing from the map`));

console.log('core ok');
