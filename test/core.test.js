// Run with: node test/core.test.js
const assert = require('assert');
const CM = require('../js/core.js');

// Map is rectangular and fully walled.
const W = CM.MAP[0].length, H = CM.MAP.length;
CM.MAP.forEach((row, y) => assert.strictEqual(row.length, W, `row ${y} width`));
const tile = (x, y) => CM.MAP[y][x];
const open = (x, y) => !CM.SOLID.includes(tile(x, y));

// Every card referenced anywhere exists.
const ids = [
  ...CM.STARTER_CARDS,
  ...CM.CHESTS.map((c) => c.card),
  ...CM.TRAINERS.flatMap((t) => [...t.reward, ...t.team.flatMap((m) => [...m.moves, ...m.hpCards])]),
  ...Object.values(CM.WILD).flatMap((z) => z.list.flatMap((m) => [...m.moves, ...m.hpCards])),
];
ids.forEach((id) => assert.ok(CM.CARDS[id], `unknown card ${id}`));

// Everything sits on open ground and is reachable from the start (chests block, trainers step aside).
const chestAt = new Set(CM.CHESTS.map((c) => `${c.x},${c.y}`));
assert.strictEqual(chestAt.size, CM.CHESTS.length, 'duplicate chest position');
const seen = new Set([`${CM.START.x},${CM.START.y}`]);
const queue = [[CM.START.x, CM.START.y]];
const champ = CM.TRAINERS.find((t) => t.champion);
while (queue.length) {
  const [x, y] = queue.shift();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
    if (seen.has(k) || !open(nx, ny) || chestAt.has(k)) continue;
    if (nx === champ.x && ny === champ.y) continue;
    if (nx === CM.PROFESSOR.x && ny === CM.PROFESSOR.y) continue;
    seen.add(k);
    queue.push([nx, ny]);
  }
}
const touchable = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
for (const c of CM.CHESTS) {
  assert.ok(open(c.x, c.y), `chest in wall at ${c.x},${c.y}`);
  assert.ok(touchable(c.x, c.y), `chest unreachable at ${c.x},${c.y}`);
}
for (const t of CM.TRAINERS) {
  assert.ok(open(t.x, t.y), `${t.name} in wall`);
  assert.ok(touchable(t.x, t.y), `${t.name} unreachable`);
  if (t.aside) assert.ok(open(...t.aside) && !chestAt.has(t.aside.join()), `${t.name} aside blocked`);
}
assert.ok(touchable(CM.PROFESSOR.x, CM.PROFESSOR.y));

// Creature maths.
const a = CM.create({ name: 'A', element: 'Water', shape: 'Blob', moves: ['tsunami_blast'], hpCards: ['hp100'] });
assert.strictEqual(CM.maxHp(a), 150);
const b = CM.create({ name: 'B', element: 'Fire', shape: 'Blob', moves: ['ember'] });
const r = CM.useMove(a, b, CM.CARDS.tsunami_blast, () => 0.5);
assert.strictEqual(r.eff, 2);
assert.ok(b.hp < 50 && b.hp >= 0);
assert.deepStrictEqual(CM.useMove(a, b, CM.CARDS.tsunami_blast, () => 0.99), { miss: true });
assert.strictEqual(CM.gainXp(a, 25 + 40), 2);
assert.strictEqual(a.level, 3);
a.hp = 10;
assert.ok(CM.useMove(a, b, CM.CARDS.mend, () => 0).heal > 0);

// Wild generation and drops are always valid.
for (let i = 0; i < 500; i++) {
  for (const z of [1, 2, 3]) {
    const c = CM.genWild(z);
    assert.ok(c.hp > 0 && CM.CARDS[CM.pickMove(c, a)]);
    const d = CM.rollDrop(z);
    assert.ok(d === null || CM.CARDS[d]);
  }
}
console.log('core ok');
