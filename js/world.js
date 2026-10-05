// Creatamon world: the overworld, gym interiors and their puzzles, and everyone you meet. No DOM.
((CM) => {
  const MAPS = {}, WARPS = {}, TINT = {}, AREAS = [], CHESTS = [], NPCS = [];
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const badgeCount = (S) => Object.keys(S.badges).length;

  // ---------- Tiles ----------
  // Outdoors: # tree  T snowy tree  ^ cliff  ~ water (needs Surf)  x cracked rock (needs Rock Smash)  b bridge
  //   . grass  = path  c cobbles  S sand  s snow  _ cave floor  H heal pad  m glowing mushroom
  //   R roof  G hall roof  W wall  D door  M mural
  //   Encounter tiles: , meadow  ; forest  : cave rubble  * flowers  " snowy grass  (and ~ while surfing)
  // Indoors: F floor  I wall  E exit mat  L leader's spot  g gate (opens when the puzzle is solved)
  //   o Fluffin to herd  p pen  O boulder  v pit  i ice  k ice rock  z floor panel  t seal
  //   1 2 3 valves  r y u gates that start shut  q j n gates that start open  B brazier  l lava
  //   < > A V gusts that blow you along  C crate  P pressure plate  4-9 warp pads (each digit is a pair)
  const SOLID = '#^TRGWMIlBk ';
  const GUSTS = { '<': 'left', '>': 'right', A: 'up', V: 'down' };
  // gate char -> [valve, starts open]
  const GATE = { r: ['1', 0], y: ['2', 0], u: ['3', 0], q: ['1', 1], j: ['2', 1], n: ['3', 1] };
  // Past the edge of the overworld is more forest; past the edge of a room is nothing.
  const charAt = (id, x, y) => { const row = MAPS[id].rows[y]; return (row && row[x]) || (id === 'world' ? '#' : ' '); };
  const gateOpen = (ch, P) => !!GATE[ch][1] !== !!P.sw[GATE[ch][0]];
  const passable = (id, x, y, P, S) => {
    const ch = charAt(id, x, y), k = `${x},${y}`;
    if (SOLID.includes(ch)) return false;
    if (ch === 'x') return !!S.smashed[`${id}:${k}`];
    if (ch === '~') return !!S.surf;
    if (ch === 'v') return !!P.fill[k];
    if (ch === 'g') return P.solved;
    if (GATE[ch]) return gateOpen(ch, P);
    return true;
  };
  // The plain ground under a tile that sits on top of it (heal pad, cracked rock, mushroom).
  const groundAt = (id, x, y) => {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
      const ch = charAt(id, x + dx, y + dy);
      if ('.=cSs_F'.includes(ch)) return ch;
    }
    return id === 'world' ? '.' : 'F';
  };

  // ---------- Puzzles ----------
  // P is the live state of the current map's puzzle. done = already solved, so everything starts finished.
  const initPuzzle = (id, done = false) => {
    const m = MAPS[id];
    const P = { blocks: {}, fill: {}, sw: {}, lit: {}, fire: m.fire0.slice(), solved: done };
    if (done) {
      m.targets.forEach((k) => { P.blocks[k] = charAt(id, ...k.split(',').map(Number)) === 'P' ? 'C' : 'o'; });
      m.pits.forEach((k) => { P.fill[k] = true; });
      m.marks.forEach((k) => { P.lit[k] = true; });
      P.fire = P.fire.map(() => true);
    } else Object.assign(P.blocks, m.blocks);
    return P;
  };
  const checkSolved = (id, P) => {
    const m = MAPS[id];
    if (P.solved) return false;
    const ok = m.puzzle === 'herd' ? m.targets.every((k) => P.blocks[k])
      : m.puzzle === 'panels' || m.puzzle === 'seals' ? m.marks.every((k) => P.lit[k])
        : m.puzzle === 'fire' ? P.fire.every(Boolean) : false;
    if (ok) P.solved = true;
    return ok;
  };
  // One step from x,y: a plain move, a push, or a slide across ice. Mutates P.
  // blocked(x, y) reports people and chests. Returns the landing spot, or null if the way is shut.
  const step = (id, P, S, x, y, dir, blocked = () => false) => {
    const [dx, dy] = DIRS[dir];
    const free = (a, b) => passable(id, a, b, P, S) && !P.blocks[`${a},${b}`] && !blocked(a, b);
    let nx = x + dx, ny = y + dy;
    const k = `${nx},${ny}`;
    if (P.blocks[k]) {
      const bx = nx + dx, by = ny + dy, bk = `${bx},${by}`, bch = charAt(id, bx, by);
      const pit = bch === 'v' && !P.fill[bk];
      if (!'FpPoOCv'.includes(bch) || blocked(bx, by) || (!pit && !free(bx, by))) return null;
      const kind = P.blocks[k];
      delete P.blocks[k];
      if (pit) P.fill[bk] = true; else P.blocks[bk] = kind;
      return { x: nx, y: ny, n: 1, path: [[nx, ny]], pushed: true };
    }
    if (!free(nx, ny)) return null;
    // Ice carries you on the way you were going; a gust blows you its own way. path lists every tile crossed.
    const path = [[nx, ny]];
    let d = [dx, dy];
    for (let i = 0; i < 200; i++) {
      const ch = charAt(id, nx, ny);
      if (GUSTS[ch]) d = DIRS[GUSTS[ch]]; else if (ch !== 'i') break;
      if (!free(nx + d[0], ny + d[1])) break;
      nx += d[0]; ny += d[1];
      path.push([nx, ny]);
    }
    return { x: nx, y: ny, n: path.length, path };
  };
  // Standing on a warp pad sends you to its twin. Returns the twin's spot, or null.
  const teleAt = (id, x, y) => {
    const pads = MAPS[id].pads[charAt(id, x, y)];
    return pads ? pads.find((p) => p[0] !== x || p[1] !== y) : null;
  };
  // Called after landing on a tile. Returns 'switch' | 'shock' | 'lit' | 'solved' | null.
  const arrive = (id, P, x, y) => {
    const ch = charAt(id, x, y), k = `${x},${y}`;
    let ev = null;
    if ('123'.includes(ch)) { P.sw[ch] = !P.sw[ch]; ev = 'switch'; }
    if (ch === 'z' && !P.solved) {
      if (P.lit[k]) { P.lit = {}; return 'shock'; }
      P.lit[k] = true; ev = 'lit';
    }
    if (ch === 't' && !P.lit[k]) { P.lit[k] = true; ev = 'lit'; }
    return checkSolved(id, P) ? 'solved' : ev;
  };
  // Lighting or dousing a brazier flips its neighbours too.
  const toggleFire = (id, P, i) => {
    [i - 1, i, i + 1].forEach((j) => { if (j >= 0 && j < P.fire.length) P.fire[j] = !P.fire[j]; });
    return checkSolved(id, P);
  };

  // ---------- Interiors ----------
  const interior = (id, name, rows, meta = {}) => {
    const m = { id, name, rows, puzzle: null, fire0: [], targets: [], marks: [], pits: [], fires: [], blocks: {}, pads: {}, ...meta };
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const k = `${x},${y}`;
      if (ch === 'E') { m.exit = [x, y]; m.entry = [x, y - 1]; }
      if (ch === 'L') m.leader = [x, y];
      if (ch === 'p' || ch === 'P') m.targets.push(k);
      if ('456789'.includes(ch)) (m.pads[ch] = m.pads[ch] || []).push([x, y]);
      if (ch === 'z' || ch === 't') m.marks.push(k);
      if (ch === 'v') m.pits.push(k);
      if (ch === 'B') m.fires.push(k);
      if ('oOC'.includes(ch)) m.blocks[k] = ch;
    }));
    MAPS[id] = m;
  };

  interior('gym_Grass', 'Furrowfield Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIgIIII',
    'IpFFFFFpI',
    'IFIFoFFFI',
    'IFFoFoFFI',
    'IFFFFFFFI',
    'IHFFFIpII',
    'IIIIEIIII',
  ], { puzzle: 'herd', hint: 'Gym challenge: the Fluffin have wandered off! Nudge all three into the hay pens to open the gate.' });

  interior('gym_Water', 'Brinemouth Gym', [
    'IIIIIIIIIIIII',
    'IFFFFFLFFFFFI',
    'IFFFFFFFFFFFI',
    'IIqIIIIIIIjII',
    'IF1FFFIFFF3FI',
    'IIyIIIIIIIuII',
    'IFFFFFIFFFFFI',
    'IF3FFFIFFF2FI',
    'IFFFFFIFFFFFI',
    'IIrIIIIIIIqII',
    'IFFFFFFFFFFFI',
    'IFF1FFFFFFFFI',
    'IHFFFFFFFFFFI',
    'IIIIIIEIIIIII',
  ], { puzzle: 'valves', hint: 'Gym challenge: step on a coloured valve to switch every waterfall of that colour. Some open as others shut. Find an order that gets you through.' });

  interior('gym_Fire', 'Kilnford Gym', [
    'IIIIIIIIIIIIIIIII',
    'IFFFFFFFLFFFFFFFI',
    'IFFFFFFFFFFFFFFFI',
    'IIIIIIIIgIIIIIIII',
    'IFFFFFFFFFFFFFFFI',
    'IFBlBlBlBlBlBlBFI',
    'IFFFFFFFFFFFFFFFI',
    'IlllllFFFFFlllllI',
    'IFFFFFFFFFFFFFFFI',
    'IHFFFFFFFFFFFFFFI',
    'IIIIIIIIEIIIIIIII',
  ], { puzzle: 'fire', fire0: [true, false, false, true, false, true, false], hint: 'Gym challenge: light all seven braziers. Touching one flips it and its neighbours.' });

  interior('gym_Wind', 'Galeholt Gym', [
    'IIIIIIIIIII',
    'IFFFFLFFFFI',
    'IFFFFFFFFFI',
    'IIIIIFIIIII',
    'IVI<><<>>>I',
    'IA<A>>V><AI',
    'I>><>F<IAFI',
    'II<IFF>VIAI',
    'I>AFFVIAAFI',
    'IV>>AFVA>FI',
    'IVV<V<F<VFI',
    'IFFFFFFFFFI',
    'IHFFFFFFFFI',
    'IIIIIEIIIII',
  ], { puzzle: 'gusts', hint: 'Gym challenge: the floor vents blow you wherever they point until something stops you. Ride the gusts to the far door.' });

  interior('gym_Rock', 'Cairnside Gym', [
    'IIIIIIIIIII',
    'IFFFFLFFFFI',
    'IFFFFFFFFFI',
    'IIIIIvIIIII',
    'IFFOFFFOFFI',
    'IFFFFFFFFFI',
    'IIvIIIIIIII',
    'IFFFFFFFFFI',
    'IFFOFFFFOFI',
    'IFFFFFFFFFI',
    'IIIIIIIvIII',
    'IFFOFFFFFFI',
    'IHFFFFFFFFI',
    'IIIIIEIIIII',
  ], { puzzle: 'pits', hint: 'Gym challenge: three pits break the way. Push boulders into them to make a path. A boulder against a wall is stuck for good.' });

  interior('gym_Electric', 'Lumenlea Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIgIIII',
    'IFFFFFFFI',
    'IzzzzzzzI',
    'IzIzzzIzI',
    'IzzzzzzzI',
    'IzzzIzzzI',
    'IzIzzzIzI',
    'IzzzzzzzI',
    'IFFFFFFFI',
    'IHFFFFFFI',
    'IIIIEIIII',
  ], { puzzle: 'panels', hint: 'Gym challenge: charge every floor panel by stepping on it once. Step on a charged panel and the whole grid resets.' });

  interior('gym_Metal', 'Steelspire Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIgIIII',
    'IFFPFFFFI',
    'IFCFFICFI',
    'IFFIFFFFI',
    'IPFFCFFPI',
    'IHFFFFFFI',
    'IIIIEIIII',
  ], { puzzle: 'herd', hint: 'Gym challenge: three steel crates, three pressure plates. Hold every plate down to open the gate.' });

  interior('gym_Ice', 'Frosthollow Gym', [
    'IIIIIIIIIII',
    'IFFFFLFFFFI',
    'IFFFFFFFFFI',
    'IIIIIFIIIII',
    'IkikiiiikiI',
    'IiiiiikiiiI',
    'IikiiiiiiiI',
    'IkikikikiiI',
    'IiiiiikiiiI',
    'IiikiiiikiI',
    'IiikikikiiI',
    'IiikkkkkiiI',
    'IFFFFFFFFFI',
    'IHFFFFFFFFI',
    'IIIIIEIIIII',
  ], { puzzle: 'ice', hint: 'Gym challenge: the floor is sheer ice. You slide until something stops you. Find a way to the far door.' });

  interior('gym_Shadow', 'Thornmuth Gym', [
    'IIIIIIIIIIIIIII',
    'IFFFFFFLFFFFFFI',
    'IFFFFFFFFFFFFFI',
    'IIIIIIIIIIIIgII',
    'IFFFIFFFFFIFFFI',
    'IFIFIFIIIFIFItI',
    'IFIFFFIFFFIFIFI',
    'IFIIIIIFIIIFIFI',
    'IFFFFFFFItFFIFI',
    'IIIFIIIFIIIFIFI',
    'ItFFIFFFFFFFIFI',
    'IIIFIFIIIIIIIFI',
    'IFIIIFItIIIFIFI',
    'IHFFFFFFFFFFFtI',
    'IIIIIIIEIIIIIII',
  ], { puzzle: 'seals', dark: true, hint: 'Gym challenge: the lights are out. Somewhere in the dark are five seals. Step on each to open the gate.' });

  interior('gym_Mind', 'Reverie Gym', [
    'IIIIIIIIIIIII',
    'IFFFFFLFFFFFI',
    'IFFFFFFFFFF9I',
    'IIIIIIIIIIIII',
    'IIIIIIIIIIIII',
    'I4F6I6F8I8F9I',
    'IIIIIIIIIIIII',
    'I5F7I7FFIIIII',
    'IIIIIIIIIIIII',
    'IFFFFFFFFFFFI',
    'IH4FFFFFFF5FI',
    'IIIIIIEIIIIII',
  ], { puzzle: 'warps', hint: 'Gym challenge: the rooms have no doors. Each warp pad leads to its twin somewhere else. Find the chain that reaches the Leader.' });

  interior('gym_Normal', 'Anvilgate Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIFIIII',
    'IFFFFFFFI',
    'IIIIFIIII',
    'IFFFFFFFI',
    'IIIIFIIII',
    'IFFFFFFFI',
    'IIIIFIIII',
    'IFFFFFFFI',
    'IIIIFIIII',
    'IFFFFFFFI',
    'IHFFFFFFI',
    'IIIIEIIII',
  ], { puzzle: 'quiz', hint: 'Gym challenge: five gatekeepers test what you know. Answer wrong and you must battle before trying again.' });

  // The three gyms of the far east reuse earlier kinds of challenge on fresh floors.
  const flip = { '<': '>', '>': '<' };
  const mirror = (rows) => rows.map((row) => [...row].reverse().map((ch) => flip[ch] || ch).join(''));
  interior('gym_Robot', 'Cogsworth Gym', mirror(MAPS.gym_Wind.rows),
    { puzzle: 'gusts', hint: 'Gym challenge: the factory floor is all conveyor belts. Step on one and it carries you wherever it points. Ride them to the far door.' });
  interior('gym_Light', 'Solhaven Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIgIIII',
    'IFFFFFFFI',
    'IIzzzzzzI',
    'IzzzzzzzI',
    'IzzzzzzzI',
    'IzzzzzzzI',
    'IzzzzzzzI',
    'IFFFFFFFI',
    'IHFFFFFFI',
    'IIIIEIIII',
  ], { puzzle: 'panels', hint: 'Gym challenge: light every floor lamp by stepping on it once. Step on a lit lamp and they all go dark again.' });
  interior('gym_Toxic', 'Mirefen Gym', mirror(MAPS.gym_Rock.rows),
    { puzzle: 'pits', hint: 'Gym challenge: three sludge pits block the way. Push boulders into them to make a path. A boulder against a wall is stuck for good.' });

  interior('grove', 'Drowsing Grove', [
    '#############',
    '#####...#####',
    '####.....####',
    '####.....####',
    '######.######',
    '####;;;;;####',
    '###;;;.;;;###',
    '###;;...;;###',
    '####;;.;;####',
    '#####...#####',
    '####..;;.####',
    '###;;;.;;;###',
    '###;;;.;;;###',
    '######E######',
    '#############',
  ], { fog: true, area: { name: 'Drowsing Grove', lv: [2, 4], drops: [90, 10, 0], wild: 'grove' } });

  interior('plant', 'Anvilgate Energy Plant', [
    'IIIIIIIII',
    'IFFFFFFFI',
    'IFFFFFFFI',
    'IFFFFFFFI',
    'IIIIFIIII',
    'IFFFFFFFI',
    'IFFFFFFFI',
    'IHFFFFFFI',
    'IIIIEIIII',
  ]);

  // ---------- Overworld ----------
  const W = 124, H = 96;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
  const set = (x, y, ch) => { g[y][x] = ch; };
  // wild: a named list of wild Creatamon that replaces the usual ones for the ground underfoot.
  const area = (name, x0, y0, x1, y1, lv, drops, wild) => AREAS.push({ name, x0, y0, x1, y1, lv, drops, wild });
  const house = (x, y, w = 4) => { rect(x, y, x + w - 1, y + 1, 'R'); rect(x, y + 2, x + w - 1, y + 2, 'W'); };
  // A five-wide hall in an element's colours. With `to`, its door leads to that map.
  const hall = (x, y, tint, to, need, w = 5) => {
    rect(x, y, x + w - 1, y + 1, 'G'); rect(x, y + 2, x + w - 1, y + 2, 'W');
    for (let j = y; j <= y + 2; j++) for (let i = x; i < x + w; i++) TINT[`${i},${j}`] = tint;
    if (!to) return;
    set(x + 2, y + 2, 'D');
    WARPS[`world:${x + 2},${y + 2}`] = { map: to, need };
    MAPS[to].out = ['world', x + 2, y + 3];
  };
  const GYM_ORDER = ['Grass', 'Water', 'Fire', 'Wind', 'Rock', 'Electric', 'Metal', 'Ice', 'Shadow', 'Mind', 'Robot', 'Light', 'Toxic', 'Normal'];
  const gymHall = (x, y, el) => {
    const n = GYM_ORDER.indexOf(el);
    hall(x, y, el, `gym_${el}`, (S) => (badgeCount(S) >= n ? null
      : `The gym doors are shut. A notice reads: "Challengers need ${n} badge${n === 1 ? '' : 's'}."`));
  };

  rect(56, 0, 123, 24, 'T');  // the snowy north-east
  rect(77, 25, 99, 45, '^');  // Cairnside cliffs
  rect(2, 33, 12, 51, '^');   // Gritstone Mine
  rect(26, 3, 42, 20, '^');   // Brinecut Tunnel

  // Hearthwick, home
  rect(6, 84, 22, 94, '.'); rect(6, 90, 22, 90, '='); house(8, 85); house(15, 85); set(13, 92, 'H');
  set(5, 90, 'D');
  WARPS['world:5,90'] = { map: 'grove', need: (S) => (S.f.rival1 ? null : 'The gate to the Drowsing Grove is shut tight. Nobody is allowed in.') };
  MAPS.grove.out = ['world', 6, 90];
  area('Hearthwick', 5, 84, 22, 94);
  // Route 1
  rect(23, 88, 43, 92, '.'); rect(23, 90, 43, 90, '='); rect(26, 88, 31, 89, ','); rect(33, 91, 39, 92, ','); rect(36, 88, 40, 88, '*');
  area('Route 1', 23, 88, 43, 92, [2, 4], [90, 10, 0]);
  // Wedgemoor
  rect(44, 82, 60, 94, '.'); rect(44, 90, 60, 90, '='); rect(52, 82, 52, 90, '='); house(46, 84, 5); house(55, 84); set(56, 92, 'H');
  rect(61, 90, 63, 90, '=');
  area('Wedgemoor', 44, 82, 63, 94);
  // Route 2
  rect(50, 72, 54, 80, '.'); rect(52, 72, 52, 81, '='); rect(50, 74, 51, 79, ','); rect(53, 75, 54, 78, '*');
  area('Route 2', 50, 72, 54, 81, [4, 6], [85, 15, 0]);
  // The Wildlands
  rect(24, 56, 66, 71, '.'); rect(38, 60, 50, 66, '~'); rect(43, 62, 45, 64, '.');
  rect(26, 58, 34, 62, ','); rect(27, 65, 35, 70, ';'); rect(54, 58, 64, 62, '*'); rect(56, 66, 64, 70, ',');
  rect(30, 63, 31, 64, '#'); rect(60, 63, 61, 64, '#'); rect(52, 67, 52, 71, '='); set(37, 55, '=');
  area('The Wildlands', 24, 55, 66, 71, [6, 10], [70, 28, 2]);
  // Kilnford
  rect(28, 42, 46, 54, 'c'); gymHall(35, 43, 'Fire'); house(29, 43); house(42, 43); house(29, 49); house(42, 49); set(33, 52, 'H');
  set(27, 48, 'c'); set(47, 48, 'c'); set(40, 41, '=');
  area('Kilnford', 27, 41, 47, 54);
  // Route 3 and Gritstone Mine
  rect(12, 46, 26, 50, '.'); rect(12, 48, 26, 48, '='); rect(14, 46, 19, 47, ','); rect(20, 49, 25, 50, ',');
  area('Route 3', 12, 46, 26, 50, [7, 9], [80, 20, 0]);
  rect(4, 35, 10, 49, '_'); set(11, 48, '_'); rect(4, 44, 10, 44, '^'); set(9, 44, 'x'); rect(5, 40, 10, 40, '^');
  rect(5, 46, 8, 48, ':'); rect(6, 41, 9, 43, ':'); rect(4, 36, 7, 38, ':'); set(7, 34, '_');
  area('Gritstone Mine', 2, 33, 12, 51, [8, 11], [60, 38, 2]);
  // Route 12, the Windswept Steppe, and Galeholt
  set(20, 51, '.'); rect(4, 52, 22, 66, '.'); rect(4, 55, 18, 55, '#'); rect(8, 59, 22, 59, '#'); rect(4, 63, 18, 63, '#');
  rect(6, 52, 12, 54, ','); rect(10, 56, 20, 58, '*'); rect(5, 60, 12, 62, ','); rect(12, 64, 20, 66, '*'); set(6, 67, '.');
  area('Route 12', 4, 51, 22, 67, [19, 22], [45, 48, 7]);
  rect(4, 68, 22, 80, '.'); gymHall(10, 69, 'Wind'); house(17, 70); house(5, 75); set(14, 76, 'H'); rect(6, 72, 16, 72, '=');
  area('Galeholt', 4, 68, 22, 80);
  // Furrowfield
  rect(3, 22, 22, 33, '.'); gymHall(10, 23, 'Grass'); house(17, 23); set(18, 28, 'H'); rect(14, 30, 21, 32, '*');
  rect(7, 27, 16, 27, '='); rect(7, 27, 7, 33, '='); rect(16, 21, 16, 27, '=');
  area('Furrowfield', 3, 21, 22, 33);
  // Route 5: a river with one bridge, at the far end of the bank
  rect(8, 14, 18, 20, '.'); rect(6, 17, 23, 18, '~'); rect(9, 17, 9, 18, 'b');
  rect(14, 14, 15, 16, ','); rect(17, 19, 18, 20, ','); rect(17, 14, 18, 15, '*'); set(16, 13, '=');
  rect(10, 19, 13, 20, ','); rect(10, 14, 12, 15, '*');
  area('Route 5', 6, 13, 23, 20, [10, 13], [70, 28, 2]);
  // Brinemouth, by the sea
  rect(2, 1, 25, 3, '~'); rect(3, 4, 24, 12, 'c'); gymHall(6, 5, 'Water'); house(19, 5); set(14, 10, 'H'); set(22, 2, '.'); set(25, 9, 'c');
  area('Brinemouth', 2, 1, 25, 12, [10, 13], [60, 35, 5]);
  // Brinecut Tunnel and Route 4, back down to Kilnford
  rect(27, 5, 40, 11, '_'); set(26, 9, '_'); rect(36, 12, 40, 19, '_'); rect(31, 5, 31, 11, '^'); set(31, 8, 'x');
  rect(27, 6, 30, 7, ':'); rect(33, 9, 38, 11, ':'); rect(37, 14, 40, 17, ':'); set(38, 20, '_');
  area('Brinecut Tunnel', 26, 3, 42, 20, [13, 16], [55, 40, 5]);
  rect(36, 21, 41, 40, '.'); rect(36, 23, 38, 27, ','); rect(39, 30, 41, 35, ';'); rect(37, 37, 38, 38, '~');
  area('Route 4', 36, 21, 41, 41, [14, 17], [50, 45, 5]);
  // The Forgeway and Anvilgate
  rect(48, 44, 56, 52, '.'); rect(48, 48, 56, 48, '='); rect(49, 45, 55, 46, ','); rect(49, 50, 55, 51, '*');
  area('The Forgeway', 48, 44, 56, 52, [22, 25], [45, 48, 7]);
  // Route 13, the Ironway, and Steelspire
  rect(52, 41, 52, 43, '='); rect(47, 22, 55, 40, '.'); rect(47, 36, 54, 36, '^'); set(55, 36, 'x'); rect(49, 31, 55, 31, '^'); rect(47, 26, 53, 26, '^');
  rect(48, 37, 53, 39, ':'); rect(50, 32, 55, 35, ','); rect(47, 27, 52, 30, ':'); rect(48, 22, 54, 25, ','); set(50, 21, 'c');
  area('Route 13', 47, 21, 55, 43, [31, 34], [25, 55, 20]);
  rect(44, 6, 55, 20, 'c'); gymHall(47, 7, 'Metal'); house(44, 13); set(53, 16, 'H');
  area('Steelspire', 44, 6, 55, 20);
  rect(58, 34, 76, 50, 'c'); gymHall(65, 35, 'Normal');
  hall(59, 35, 'Plant', 'plant', (S) => (S.f.blade ? null : 'The Energy Plant is sealed. League staff only.'));
  house(72, 35); house(59, 42); house(72, 44); set(62, 46, 'H');
  set(57, 48, 'c'); set(77, 42, 'c'); set(67, 33, 'c'); set(72, 51, 'c');
  area('Anvilgate', 57, 33, 77, 51);
  // Route 6 and Cairnside
  rect(78, 40, 96, 44, 'S'); rect(86, 40, 86, 44, '^'); set(86, 42, 'x'); rect(80, 40, 84, 41, ','); rect(88, 43, 91, 44, ':');
  set(92, 39, 'S'); set(94, 45, 'S');
  rect(84, 26, 97, 38, 'S'); gymHall(86, 27, 'Rock'); rect(93, 27, 96, 28, 'M'); house(92, 32); set(90, 35, 'H');
  area('Cairnside', 84, 26, 97, 38);
  area('Route 6', 78, 39, 97, 45, [24, 27], [40, 50, 10]);
  // Gloamwood and Lumenlea
  rect(88, 46, 97, 61, ';'); rect(90, 48, 91, 50, '#'); rect(94, 52, 95, 55, '#'); rect(89, 57, 90, 58, '#');
  rect(92, 46, 93, 49, '.'); rect(91, 53, 92, 55, '.'); rect(93, 58, 94, 61, '.');
  [[93, 47], [91, 54], [94, 59], [89, 52], [96, 57]].forEach(([x, y]) => set(x, y, 'm'));
  set(92, 62, '.');
  area('Gloamwood', 88, 46, 97, 62, [27, 30], [30, 55, 15]);
  rect(80, 63, 97, 75, '.'); gymHall(86, 64, 'Electric'); house(81, 69); house(93, 65); set(92, 70, 'H');
  [[82, 64], [84, 73], [90, 72], [96, 74], [80, 67], [95, 69]].forEach(([x, y]) => set(x, y, 'm'));
  area('Lumenlea', 80, 63, 97, 75);
  // Route 7 and Frosthollow
  rect(64, 22, 70, 32, '.'); rect(64, 22, 70, 26, 's'); rect(64, 27, 70, 27, '^'); set(66, 27, 'x');
  rect(68, 28, 70, 31, ','); rect(64, 23, 66, 25, '"'); set(67, 21, 's');
  area('Route 7', 64, 21, 70, 32, [35, 38], [25, 55, 20]);
  rect(58, 8, 76, 20, 's'); gymHall(60, 9, 'Ice'); house(66, 9); rect(70, 10, 73, 12, '~'); house(59, 15); set(66, 16, 'H'); set(77, 14, 's');
  area('Frosthollow', 58, 8, 77, 20);
  // Route 9: a wide river, and Thornmuth beyond it
  rect(78, 10, 83, 18, 's'); rect(80, 11, 82, 13, '"'); rect(79, 15, 82, 17, '"');
  rect(84, 3, 88, 23, '~'); rect(89, 10, 91, 18, 's'); set(92, 14, 'c');
  area('Route 9', 78, 3, 92, 23, [39, 42], [15, 55, 30]);
  rect(93, 6, 98, 21, 'c'); gymHall(93, 6, 'Shadow'); set(97, 16, 'H');
  area('Thornmuth', 93, 6, 98, 21);
  // Route 14 and Reverie
  set(99, 18, 'c'); set(100, 18, 's'); rect(101, 8, 110, 22, 's'); rect(101, 12, 107, 12, 'T'); rect(104, 17, 110, 17, 'T');
  rect(102, 9, 106, 11, '"'); rect(103, 13, 109, 16, '"'); rect(101, 19, 105, 21, '"'); set(111, 10, 's');
  area('Route 14', 99, 8, 111, 22, [43, 46], [12, 53, 35]);
  rect(112, 4, 122, 20, 'c'); gymHall(114, 5, 'Mind'); house(113, 13); set(120, 16, 'H');
  area('Reverie', 112, 4, 122, 20);
  // Route 10 and Summit City
  rect(70, 52, 74, 78, '.'); rect(70, 58, 74, 74, 's'); rect(70, 53, 71, 56, ','); rect(73, 60, 74, 66, '"'); rect(70, 68, 71, 72, '"');
  set(72, 79, 'c');
  area('Route 10', 70, 52, 74, 79, [58, 62], [10, 50, 40]);
  rect(64, 80, 97, 94, 'c'); hall(77, 81, 'League', null, null, 7); hall(90, 81, 'Plant'); house(65, 82); house(86, 89); set(70, 88, 'H');
  area('Summit City', 64, 80, 97, 94);

  // ---------- The far east: Cogsworth, Solhaven and Mirefen ----------
  // Route 15 runs south out of Reverie.
  set(117, 21, 'c'); rect(113, 22, 121, 24, 's'); rect(113, 25, 121, 33, '.');
  rect(115, 24, 121, 24, 'T'); rect(113, 28, 119, 28, '#'); rect(115, 31, 121, 31, '#');
  rect(114, 26, 119, 27, ','); rect(115, 29, 120, 30, ':'); rect(114, 32, 119, 33, ','); set(117, 34, '.');
  area('Route 15', 113, 21, 121, 34, [47, 50], [12, 53, 35], 'east1');
  rect(106, 35, 122, 47, 'c'); gymHall(108, 36, 'Robot'); house(116, 36); house(107, 43); set(118, 42, 'H'); set(114, 48, 'c');
  area('Cogsworth', 106, 35, 122, 48);
  // Route 16
  rect(110, 49, 118, 57, '.'); rect(110, 51, 116, 51, '#'); rect(112, 54, 118, 54, '#');
  rect(111, 49, 113, 50, '*'); rect(111, 52, 117, 53, ','); rect(113, 55, 117, 56, '*'); set(114, 58, 'S');
  area('Route 16', 110, 49, 118, 58, [49, 52], [12, 50, 38], 'east2');
  rect(104, 59, 122, 70, 'S'); gymHall(109, 60, 'Light'); house(117, 60); house(105, 65); set(118, 66, 'H'); rect(98, 68, 103, 68, 'S'); set(113, 71, '.');
  area('Solhaven', 98, 59, 122, 70);
  // Route 17, down into the fen
  rect(109, 72, 117, 78, '.'); rect(109, 74, 115, 74, '#'); rect(111, 76, 117, 76, '#');
  rect(110, 72, 112, 73, ';'); rect(110, 75, 116, 75, ';'); rect(112, 77, 116, 78, ';');
  area('Route 17', 109, 71, 117, 78, [51, 54], [10, 50, 40], 'east3');
  rect(100, 79, 122, 91, '.'); rect(101, 88, 105, 90, '~'); rect(116, 80, 120, 82, '~'); rect(112, 86, 121, 90, ';');
  gymHall(105, 80, 'Toxic'); house(110, 84); set(108, 87, 'H'); rect(98, 86, 99, 86, 'c');
  area('Mirefen', 98, 79, 122, 91, [52, 55], [10, 50, 40], 'east3');

  // ---------- Winding roads ----------
  // Hedges, ridges and thickets laid across the routes so that each one doubles back on itself.
  // Every barrier leaves a gap at one end; the gaps alternate, so the way through is a zigzag.
  const PLAIN = '.';
  // Lays a footpath along a line of corners, over open grass only (encounter tiles stay as they are).
  const trail = (...pts) => pts.slice(1).forEach(([bx, by], i) => {
    const [ax, ay] = pts[i];
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) if (g[y][x] === PLAIN) g[y][x] = '=';
  });
  // Route 1
  rect(23, 90, 43, 90, '.'); rect(27, 88, 27, 91, '#'); rect(32, 89, 32, 92, '#'); rect(37, 88, 37, 91, '#'); rect(41, 89, 41, 92, '#');
  trail([23, 90], [26, 90], [26, 92], [28, 92], [28, 88], [33, 88], [33, 92], [38, 92], [38, 88], [42, 88], [42, 90], [43, 90]);
  // Route 2
  rect(52, 72, 52, 80, '.'); rect(50, 78, 53, 78, '#'); rect(51, 76, 54, 76, '#'); rect(50, 74, 53, 74, '#');
  trail([52, 80], [52, 79], [54, 79], [54, 77], [50, 77], [50, 75], [54, 75], [54, 73], [52, 73], [52, 72]);
  // The Wildlands: the lake is walled off to the west, and the east bank is the long way round
  rect(37, 60, 37, 71, '#'); rect(51, 64, 64, 64, '#'); rect(53, 58, 53, 63, '#');
  // Route 3 and Gritstone Mine
  rect(12, 48, 26, 48, '.'); rect(23, 47, 23, 50, '#'); rect(19, 46, 19, 49, '#'); rect(15, 47, 15, 50, '#');
  trail([26, 48], [24, 48], [24, 46], [20, 46], [20, 50], [18, 50], [18, 48], [16, 48], [16, 46], [14, 46], [14, 48], [12, 48]);
  rect(6, 46, 10, 46, '^'); rect(4, 37, 8, 37, '^');
  // Route 12: baffles inside each sweep of the steppe
  rect(16, 56, 16, 57, '#'); rect(8, 57, 8, 58, '#'); rect(8, 60, 8, 61, '#'); rect(14, 61, 14, 62, '#'); rect(16, 64, 16, 65, '#'); rect(10, 65, 10, 66, '#');
  // Brinecut Tunnel and Route 4
  rect(37, 14, 40, 14, '^'); rect(36, 17, 39, 17, '^');
  rect(37, 25, 41, 25, '#'); rect(36, 28, 40, 28, '#'); rect(37, 32, 41, 32, '#'); rect(36, 36, 40, 36, '#');
  // The Forgeway
  rect(48, 48, 56, 48, '.'); rect(50, 45, 50, 52, '#'); rect(54, 44, 54, 51, '#');
  trail([48, 48], [49, 48], [49, 44], [52, 44], [51, 44], [51, 48], [53, 48], [53, 52], [55, 52], [55, 48], [56, 48]);
  // Route 6 and Gloamwood
  rect(82, 40, 82, 43, '^'); rect(89, 41, 89, 44, '^');
  rect(90, 51, 97, 51, '#'); rect(88, 56, 92, 56, '#'); rect(88, 59, 95, 59, '#');
  // Route 7
  rect(65, 30, 70, 30, '#'); rect(64, 25, 69, 25, 'T');
  // Route 9, on both banks
  rect(81, 10, 81, 16, 'T'); rect(90, 11, 90, 18, 'T');
  // Route 14
  rect(109, 12, 110, 12, 'T'); rect(109, 9, 109, 11, 'T'); rect(101, 17, 102, 17, 'T'); rect(102, 18, 102, 20, 'T'); rect(106, 14, 106, 16, 'T');
  // Route 10
  rect(70, 57, 73, 57, '#'); rect(71, 62, 74, 62, 'T'); rect(70, 67, 73, 67, 'T'); rect(71, 73, 74, 73, 'T');

  MAPS.world = {
    id: 'world', name: 'Galdra', rows: g.map((row) => row.join('')),
    puzzle: null, fire0: [], targets: [], marks: [], pits: [], fires: [], blocks: {}, pads: {},
  };
  const START = { x: 10, y: 89 };
  const areaAt = (id, x, y) => (id === 'world'
    ? AREAS.find((a) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1) || { name: 'Galdra' }
    : MAPS[id].area || { name: MAPS[id].name });

  // ---------- Pickups ----------
  // Sparkles on the ground, collected by walking over them: a card, clothes, an item, or a spray design ('spray:<id>').
  const chest = (x, y, what, map = 'world') => CHESTS.push({ map, x, y,
    ...(what.startsWith('spray:') ? { spray: what.slice(6) } : CM.CARDS[what] ? { card: what } : CM.ITEMS[what] ? { item: what } : { outfit: what }) });
  chest(21, 85, 'hp30'); chest(7, 94, 'scratch'); chest(43, 88, 'pebble_toss'); chest(24, 92, 'spark');
  chest(59, 94, 'straw_hat'); chest(45, 83, 'frost_nip'); chest(50, 73, 'hp30');
  chest(25, 57, 'shade_jab'); chest(65, 71, 'hp100'); chest(44, 63, 'tsunami_blast'); chest(25, 70, 'body_slam'); chest(65, 57, 'varsity');
  chest(13, 50, 'hp30'); chest(10, 35, 'rock_slide'); chest(4, 49, 'hp100'); chest(21, 33, 'mend'); chest(18, 14, 'hp100');
  chest(22, 2, 'solar_bloom'); chest(27, 11, 'thunder_fang'); chest(40, 5, 'hp100'); chest(41, 22, 'ice_shard'); chest(36, 40, 'wizard_hat');
  chest(48, 44, 'night_claw'); chest(76, 50, 'hp100'); chest(78, 44, 'hp100'); chest(96, 40, 'inferno_crash'); chest(84, 38, 'hp250');
  chest(88, 46, 'hp250'); chest(97, 61, 'hp100'); chest(80, 75, 'hp250'); chest(64, 22, 'hp250'); chest(76, 20, 'hp250');
  chest(89, 18, 'hp250'); chest(98, 21, 'hp250'); chest(70, 78, 'hp250'); chest(74, 52, 'earthshatter'); chest(97, 94, 'hp250');
  chest(20, 93, 'creataball'); chest(58, 83, 'potion'); chest(26, 71, 'potion'); chest(64, 58, 'creataball'); chest(45, 53, 'potion');
  chest(5, 53, 'spray:heart'); chest(21, 65, 'super_potion'); chest(5, 79, 'gloves'); chest(21, 79, 'creataball'); chest(22, 12, 'potion');
  chest(40, 39, 'potion'); chest(55, 52, 'spray:bolt'); chest(48, 40, 'super_potion'); chest(55, 23, 'shield'); chest(44, 19, 'creataball');
  chest(59, 50, 'spray:skull'); chest(95, 44, 'super_potion'); chest(97, 38, 'charm'); chest(97, 47, 'spray:flower'); chest(81, 74, 'creataball');
  chest(70, 31, 'super_potion'); chest(59, 20, 'boots'); chest(83, 18, 'max_potion'); chest(93, 21, 'spray:paw'); chest(110, 22, 'leaf');
  chest(122, 20, 'creataball'); chest(112, 20, 'spray:crown'); chest(74, 77, 'max_potion'); chest(64, 94, 'revive'); chest(97, 80, 'spray:swirl');
  chest(24, 56, 'revive'); chest(10, 49, 'potion'); chest(4, 80, 'gust'); chest(55, 6, 'iron_bash'); chest(122, 4, 'psy_wave');
  chest(4, 2, 'spray:wolf', 'grove');
  chest(121, 22, 'hp250'); chest(121, 33, 'gear_toss'); chest(122, 47, 'max_potion'); chest(106, 47, 'creataball'); chest(118, 49, 'glint');
  chest(110, 57, 'hp250'); chest(104, 59, 'revive'); chest(122, 70, 'hp250'); chest(117, 72, 'sludge_flick'); chest(109, 78, 'max_potion');
  chest(122, 91, 'hp250'); chest(100, 79, 'creataball'); chest(121, 79, 'hp250');
  chest(3, 12, 'pirate'); chest(118, 20, 'halo'); chest(96, 60, 'cat_ears');

  // ---------- People ----------
  // look: the parts of an outfit that differ from the default. show(S): whether they are around right now.
  const person = (id, map, x, y, name, look, more = {}) => NPCS.push({ id, map, x, y, name, look, ...more });
  const LOOKS = {
    vex: { hair: '#f3e2a0', hairStyle: 'spiky', hat: 'crown', top: 'champion_cape', topColor: '#2c2c3c', bottomColor: '#2c2c3c' },
    finn: { skin: '#d9a066', hair: '#3a2412', hairStyle: 'spiky', top: 'varsity', topColor: '#55a8ee', bottomColor: '#2c2c3c' },
    cyril: { hair: '#f4f4f4', hairStyle: 'bob', top: 'hoodie', topColor: '#f08aa0', bottomColor: '#9a9a9a' },
    nettie: { hair: '#1c1c28', hairStyle: 'long', hat: 'bow', hatColor: '#f08aa0', top: 'dress', topColor: '#2c2c3c' },
    wren: { hair: '#f47a45', hairStyle: 'long', top: 'hoodie', topColor: '#f4f4f4', bottom: 'shorts', bottomColor: '#55a8ee' },
    willow: { hair: '#9a9a9a', top: 'hoodie', topColor: '#f4f4f4', bottomColor: '#8a5a2b' },
    sterling: { skin: '#d9a066', hair: '#1c1c28', top: 'varsity', topColor: '#9a9a9a', bottomColor: '#9a9a9a' },
    opaline: { hair: '#f3e2a0', hairStyle: 'long', top: 'dress', topColor: '#e0483c' },
    staff: { hat: 'cap', hatColor: '#1f5f9e', top: 'jersey', topColor: '#1f5f9e', bottomColor: '#2c2c3c' },
    holler: { hair: '#f08aa0', hairStyle: 'spiky', top: 'hoodie', topColor: '#2c2c3c', bottomColor: '#2c2c3c' },
    mum: { hair: '#8a5a2b', hairStyle: 'bob', top: 'dress', topColor: '#72cc5c' },
  };

  // Story battles. A team is a list of [species, level].
  const TEAMS = {
    finn1: [['Fluffin', 1], ['Sproutle', 2]],
    finn2: [['Fluffin', 4], ['Chirple', 4], ['Sproutle', 5]],
    finn3: [['Fluffalo', 37], ['Skylord', 37], ['Thornback', 38], ['Stormkite', 38]],
    finn4: [['Fluffalo', 62], ['Skylord', 62], ['Thornback', 62], ['Stormkite', 63], ['Tidewyrm', 63]],
    cyril1: [['Frostfinch', 9], ['Dreamote', 9], ['Voltmite', 10]],
    cyril2: [['Frostfinch', 26], ['Mesmoth', 26], ['Prismite', 27], ['Voidling', 27]],
    cyril3: [['Frostmaw', 63], ['Oraclynx', 63], ['Prismite', 64], ['Glacierback', 64]],
    nettie1: [['Gloomoth', 16], ['Echobat', 16], ['Duskfang', 17]],
    nettie2: [['Echobat', 42], ['Nightshade', 42], ['Duskfang', 43], ['Umbrawyrm', 43]],
    nettie3: [['Echobat', 61], ['Nightshade', 61], ['Duskfang', 62], ['Umbrawyrm', 62]],
    holler: [['Gloomoth', 40], ['Duskfang', 41]],
    opaline: [['Glimmershell', 63], ['Stormcrow', 63], ['Ironclaw', 64], ['Leviadon', 64]],
    marina2: [['Dewsnake', 63], ['Rivermaw', 63], ['Tidewyrm', 64], ['Leviadon', 64]],
    gneiss2: [['Stoneviper', 64], ['Shardwing', 64], ['Boulderon', 65], ['Ironhide', 65]],
    brann2: [['Grizzlord', 65], ['Skylord', 65], ['Fluffalo', 65], ['Regalion', 66]],
    sterling: [['Cogshell', 67], ['Ironclaw', 67], ['Cavernking', 68], ['Anviltusk', 68], ['Ironhide', 69]],
    eternox1: [['Eternox', 70]],
    eternox2: [['Eternox', 73]],
    vex: [['Stormcrow', 71], ['Nightshade', 71], ['Magmaw', 72], ['Leviadon', 72], ['Glacierback', 72], ['Pyreking', 74]],
    quiz: [['Antlerox', 54], ['Skylord', 54]],
  };

  // Trainers nickname their Creatamon and draw their own looks for them.
  const NICKS = ['Biscuit', 'Mossy', 'Sir Chomp', 'Pickle', 'Noodle', 'Captain', 'Bramble', 'Dot', 'Waffles', 'Tugboat', 'Pepper', 'Fig',
    'Moonpie', 'Rascal', 'Old Blue', 'Thimble', 'Jinx', 'Marbles', 'Scout', 'Doodle', 'Gizmo', 'Peanut', 'Queenie', 'Rumble',
    'Sprocket', 'Tofu', 'Velvet', 'Widget', 'Yam', 'Zigzag', 'Acorn', 'Button', 'Clover', 'Dumpling', 'Echo', 'Fidget',
    'Goblin', 'Hiccup', 'Inky', 'Jellybean', 'Kipper', 'Lumpy', 'Mittens', 'Nugget', 'Otto', 'Pudding', 'Quill', 'Radish',
    'Smudge', 'Truffle', 'Ugly Bob', 'Vinnie', 'Wobble', 'Bandit', 'Cricket', 'Dizzy', 'Ember Jr', 'Flapjack', 'Gus', 'Hazel',
    'Ivy', 'Juno', 'Koko', 'Lentil', 'Mango', 'Nibbles', 'Olive', 'Pip', 'Rocket', 'Sunny', 'Tank', 'Bubbles'];
  const strHash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  // The Creatamon a trainer brings: each has a nickname and a hand-drawn look (sketch), seeded by who owns it.
  const makeTeam = (owner, team) => team.map(([species, level, extra], i) => {
    const c = CM.spawn(species, level, extra);
    const seed = strHash(`${owner}/${species}/${i}`);
    return Object.assign(c, { species, name: NICKS[(seed + i * 7) % NICKS.length], sketch: seed || 1 });
  });

  // items: handed over with the badge, on top of the reward cards.
  const GYMS = [
    { el: 'Grass', town: 'Furrowfield', name: 'Leader Thatch', team: [['Sproutle', 8], ['Slitherling', 8], ['Thornback', 10]], reward: ['vine_lash', 'hp100'],
      look: { hair: '#72cc5c', hat: 'straw_hat', top: 'tee', topColor: '#2f7a2c', bottom: 'shorts', bottomColor: '#8a5a2b' },
      pre: 'Good herding out there! Now see how my Grass Creatamon grow on you.', post: 'You reaped what you sowed. The Grass Badge is yours!' },
    { el: 'Water', town: 'Brinemouth', name: 'Leader Marina', team: [['Puddlit', 12], ['Dewsnake', 13], ['Tidewyrm', 15]], reward: ['aqua_jet', 'hp100'],
      look: { skin: '#a86b3c', hair: '#1f5f9e', hairStyle: 'long', top: 'tee', topColor: '#55a8ee', bottom: 'shorts', bottomColor: '#f4f4f4' },
      pre: 'You kept a cool head with my valves. Let us see if you sink or swim!', post: 'Washed away... Take the Water Badge. You earned it.' },
    { el: 'Fire', town: 'Kilnford', name: 'Leader Cinder', team: [['Emberpup', 17], ['Ladybop', 17], ['Magmite', 18], ['Cinderfox', 20]], reward: ['flame_wheel', 'hp100'],
      look: { hair: '#9a9a9a', top: 'tee', topColor: '#e0483c', bottom: 'shorts', bottomColor: '#f4f4f4' },
      pre: 'Every challenger who gives up does it at my gym. Show me you burn hotter!', post: 'A fine blaze. The Fire Badge. Wear it proudly.' },
    { el: 'Wind', town: 'Galeholt', name: 'Leader Zephyra', team: [['Breezlet', 22], ['Gustail', 22], ['Zephyrfox', 23], ['Stormkite', 24]], reward: ['whirlwind', 'hp100'],
      look: { skin: '#fbe0c8', hair: '#b4e6c6', hairStyle: 'ponytail', top: 'poncho', topColor: '#55a8ee', bottom: 'leggings', bottomColor: '#f4f4f4' },
      pre: 'You rode my gusts all the way here? Then hold on tight. This is the real storm!', post: 'You never lost your footing. The Wind Badge goes with you.' },
    { el: 'Rock', town: 'Cairnside', name: 'Leader Gneiss', team: [['Pebblit', 26], ['Gravlet', 26], ['Stoneviper', 27], ['Boulderon', 28]], reward: ['earthshatter', 'hp100'],
      look: { skin: '#d9a066', hair: '#f3e2a0', hairStyle: 'spiky', top: 'tank', topColor: '#8a5a2b', bottomColor: '#2c2c3c' },
      pre: 'You shifted my boulders. You will not shift me!', post: 'Cracked clean through. Here: the Rock Badge.' },
    { el: 'Electric', town: 'Lumenlea', name: 'Madame Ohm', team: [['Voltmite', 30], ['Zapwing', 31], ['Prismite', 31], ['Stormcrow', 32]], reward: ['thunderstorm', 'hp250'],
      look: { hair: '#f4f4f4', hairStyle: 'bun', hat: 'wizard_hat', top: 'dress', topColor: '#f6d643' },
      pre: 'Seventy years I have led this gym, dearie. Do try to be a little shocking.', post: 'Oh, what a spark! The Electric Badge, with my compliments.' },
    { el: 'Metal', town: 'Steelspire', name: 'Leader Forge', team: [['Boltnut', 34], ['Cogshell', 35], ['Ironclaw', 35], ['Anviltusk', 36]], reward: ['titan_hammer', 'hp250'],
      look: { skin: '#6e4424', hair: '#1c1c28', hairStyle: 'mohawk', hat: 'visor', top: 'overalls', topColor: '#566070', bottomColor: '#2c2c3c' },
      pre: 'Every crate in its place. I like a tidy mind. Now let me hammer it flat!', post: 'Well struck! The Metal Badge. I forged it myself.' },
    { el: 'Ice', town: 'Frosthollow', name: 'Leader Rime', team: [['Snowpuff', 38], ['Glimmershell', 39], ['Frostmaw', 39], ['Glacierback', 40]], reward: ['blizzard', 'hp250'],
      look: { hair: '#9fe3ef', hairStyle: 'long', hat: 'beanie', hatColor: '#f4f4f4', top: 'puffer', topColor: '#55a8ee', bottomColor: '#f4f4f4' },
      pre: 'You kept your footing. Now keep your nerve!', post: 'You have melted my defence. The Ice Badge is yours.' },
    { el: 'Shadow', town: 'Thornmuth', name: 'Leader Rook', team: [['Gloomoth', 42], ['Echobat', 43], ['Duskfang', 43], ['Umbrawyrm', 44]], reward: ['eclipse', 'hp250'],
      look: { hair: '#1c1c28', hairStyle: 'long', top: 'hoodie', topColor: '#2c2c3c', bottomColor: '#2c2c3c' },
      pre: 'Thornmuth has no grand stadium. Just me, the dark, and a town that still believes. Come on, then.', post: 'Heh. Lights up. Take the Shadow Badge, and look after my sister out there.' },
    { el: 'Mind', town: 'Reverie', name: 'Leader Sibyl', team: [['Dreamote', 46], ['Thinkling', 46], ['Mesmoth', 47], ['Oraclynx', 48]], reward: ['mind_break', 'hp250'],
      look: { hair: '#f29ad0', hairStyle: 'pigtails', hat: 'halo', top: 'kimono', topColor: '#9b3fd6', bottom: 'long_skirt', bottomColor: '#5b3fa8' },
      pre: 'I knew you would find the right pads. I did not foresee how this ends. How exciting!', post: 'So that is how it ends. The Mind Badge is yours.' },
    { el: 'Robot', town: 'Cogsworth', name: 'Leader Axle', team: [['Gearling', 48], ['Dronefly', 49], ['Servopup', 49], ['Mechadon', 50]], reward: ['overclock', 'hp250'],
      look: { skin: '#d9a066', hair: '#5fd0c5', hairStyle: 'mohawk', hat: 'goggles', top: 'overalls', topColor: '#1f6f68', bottomColor: '#2c2c3c' },
      pre: 'You rode my conveyors without losing a bolt. Let us see how you handle the machines themselves!', post: 'Does not compute... in the best way. The Robot Badge is yours.' },
    { el: 'Light', town: 'Solhaven', name: 'Leader Aurelia', team: [['Glimmerbug', 50], ['Sunpup', 51], ['Halowing', 51], ['Solarion', 52]], reward: ['supernova', 'hp250'],
      look: { skin: '#fbe0c8', hair: '#f6d643', hairStyle: 'long', hat: 'tiara', top: 'dress', topColor: '#fff3a8' },
      pre: 'Every lamp lit, and not one twice. You shine! But can you stand the glare?', post: 'Outshone at last. Take the Light Badge, and keep it polished.' },
    { el: 'Toxic', town: 'Mirefen', name: 'Leader Brack', team: [['Sludgel', 52], ['Venomite', 53], ['Toxitoad', 53], ['Miasmander', 54]], reward: ['toxic_tide', 'hp250'],
      look: { skin: '#a86b3c', hair: '#56751a', hairStyle: 'curly', hat: 'bandana', hatColor: '#56751a', top: 'hoodie', topColor: '#56751a', bottomColor: '#3a2412' },
      pre: 'Plugged my pits, did you? The fen has plenty more nasty surprises.', post: 'Bleh. Cleaned out. The Toxic Badge. Mind the smell.' },
    { el: 'Normal', town: 'Anvilgate', name: 'Leader Brann', team: [['Antlerox', 56], ['Skylord', 57], ['Fluffalo', 57], ['Grizzlord', 57], ['Regalion', 58]], reward: ['hyper_burst', 'hp250'],
      look: { skin: '#a86b3c', hair: '#1c1c28', hat: 'cap', hatColor: '#f47a45', top: 'hoodie', topColor: '#1f5f9e', bottom: 'shorts', bottomColor: '#2c2c3c' },
      pre: 'Only the Champion has ever beaten me. No tricks, no weakness to lean on. Just strength!', post: 'Ha! Finally someone worth losing to. The last badge is yours. Go and claim the Cup.' },
  ];
  // Gyms get harder the further along they are. From the third on, the Leader's gym trainers must be beaten first, one
  // after another with no rest (more of them at later gyms). Leaders bring bigger teams, tougher Creatamon that hold
  // items, and choose their moves more shrewdly.
  GYMS.forEach((gm, n) => {
    const own = Object.values(CM.SPECIES).filter((sp) => sp.element === gm.el).map((sp) => sp.name);
    const low = Math.min(...gm.team.map((t) => t[1])), high = Math.max(...gm.team.map((t) => t[1]));
    for (let extra = n >= 11 ? 2 : n >= 7 ? 1 : 0; extra > 0 && gm.team.length < 6; extra--) {
      gm.team.splice(gm.team.length - 1, 0, [own.find((name) => !gm.team.some((t) => t[0] === name)) || gm.team[0][0], high - 1]);
    }
    gm.skill = Math.min(0.97, 0.6 + n * 0.03);
    // Health cards and held items handed to the Leader's team as it is sent out.
    gm.bulk = [...Array(Math.floor(n / 3)).fill('hp100'), ...(n >= 8 ? ['hp250'] : []), ...(n >= 12 ? ['hp250'] : [])];
    gm.items = n >= 9 ? ['gloves', 'shield'] : n >= 4 ? ['leaf'] : [];
    gm.trainers = Array.from({ length: n < 2 ? 0 : n < 5 ? 1 : n < 9 ? 2 : 3 }, (_, i) => [[own[i % own.length], low - 2], [own[(i + 1) % own.length], low - 1]]);
  });
  // Dresses a Leader's team for battle: the last one out holds the best item.
  const gymTeam = (gm) => makeTeam(gm.name, gm.team).map((c, i, all) => {
    c.hpCards.push(...gm.bulk);
    c.item = i === all.length - 1 ? gm.items[gm.items.length - 1] || null : gm.items[0] || null;
    c.hp = CM.maxHp(c);
    return c;
  });
  GYMS.forEach((gm) => {
    const map = `gym_${gm.el}`, [x, y] = MAPS[map].leader;
    MAPS[map].el = gm.el;
    person(`leader_${gm.el}`, map, x, y, gm.name, gm.look, { gym: gm });
  });
  // A banner stands either side of every gym door, so the hall is easy to pick out from across town.
  const gymDoor = (el) => Object.keys(WARPS).find((k) => WARPS[k].map === `gym_${el}`).split(':')[1].split(',').map(Number);
  GYMS.forEach((gm) => {
    const [dx, dy] = gymDoor(gm.el);
    [-1, 1].forEach((side) => person(`banner_${gm.el}_${side}`, 'world', dx + side, dy + 1, `${gm.town} Gym`, null, { kind: 'banner', el: gm.el, sign: gm }));
  });
  [[4, 11], [4, 9], [4, 7], [4, 5], [4, 3]].forEach(([x, y], i) => person(`quiz${i + 1}`, 'gym_Normal', x, y, 'Gatekeeper', LOOKS.staff,
    { quiz: i + 1, show: (S) => S.quiz <= i }));

  const f = (S) => S.f;
  // Hearthwick
  person('mum', 'world', 8, 88, 'Mum', LOOKS.mum);
  person('vex_home', 'world', 12, 89, 'Champion Vex', LOOKS.vex, { show: (S) => !f(S).rival1 });
  person('finn_home', 'world', 13, 91, 'Finn', LOOKS.finn, { show: (S) => !f(S).rival1 });
  // Drowsing Grove
  person('finn_grove', 'grove', 5, 10, 'Finn', LOOKS.finn, { show: (S) => !f(S).grove });
  person('beast', 'grove', 6, 4, '???', null, { kind: 'beast', show: (S) => !f(S).grove });
  person('fogwall', 'grove', 6, 4, 'Fog', null, { kind: 'fog', show: (S) => f(S).grove && !f(S).night });
  person('altar', 'grove', 6, 2, 'Altar', null, { kind: 'altar' });
  person('finn_altar', 'grove', 5, 3, 'Finn', LOOKS.finn, { show: (S) => f(S).night && !f(S).blade });
  // Wedgemoor
  person('willow', 'world', 48, 87, 'Prof. Willow', LOOKS.willow);
  person('finn_wedge', 'world', 53, 86, 'Finn', LOOKS.finn, { show: (S) => f(S).grove && !f(S).endorsed });
  person('guard_r2', 'world', 52, 81, 'League Staff', LOOKS.staff, { show: (S) => !f(S).endorsed });
  person('gate_summit', 'world', 62, 90, 'Gatekeeper', LOOKS.staff, { show: (S) => !f(S).shortcut });
  // Kilnford
  person('staff', 'world', 37, 46, 'League Staff', LOOKS.staff, { show: (S) => !f(S).ceremony });
  person('nettie_kiln', 'world', 37, 46, 'Nettie', LOOKS.nettie, { show: (S) => f(S).ceremony && S.badges.Water && !f(S).nettie1 });
  person('guard_r3', 'world', 27, 48, 'League Staff', LOOKS.staff, { show: (S) => !f(S).ceremony });
  person('guard_tunnel', 'world', 26, 9, 'League Staff', LOOKS.staff, { show: (S) => !S.badges.Water });
  person('holler_r4', 'world', 40, 41, 'Team Holler Grunt', LOOKS.holler, { show: (S) => !S.badges.Water });
  // Gritstone Mine, Furrowfield, Brinemouth
  person('cyril_mine', 'world', 4, 40, 'Cyril', LOOKS.cyril, { show: (S) => !f(S).cyril1 });
  person('wren_glyph', 'world', 15, 29, 'Wren', LOOKS.wren, { show: (S) => !S.badges.Water });
  person('sterling_brine', 'world', 12, 9, 'Chairman Sterling', LOOKS.sterling, { show: (S) => S.badges.Water && !S.badges.Fire });
  // Anvilgate
  person('guard_anvil', 'world', 57, 48, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < 4 });
  person('wren_vault', 'world', 71, 39, 'Wren', LOOKS.wren, { show: (S) => !f(S).night });
  person('sterling_anvil', 'world', 63, 39, 'Chairman Sterling', LOOKS.sterling, { show: (S) => badgeCount(S) === 4 });
  person('guard_steppe', 'world', 20, 51, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < 3 });
  person('guard_iron', 'world', 52, 43, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < 6 });
  person('holler_east', 'world', 99, 18, 'Team Holler Grunt', LOOKS.holler, { show: (S) => !S.badges.Shadow });
  person('finn_r7', 'world', 67, 33, 'Finn', LOOKS.finn, { show: (S) => !f(S).rival3 });
  person('guard_r10', 'world', 72, 51, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < GYM_ORDER.length });
  // Cairnside and beyond
  person('cyril_mural', 'world', 94, 29, 'Cyril', LOOKS.cyril, { show: (S) => S.badges.Rock && !f(S).mural });
  person('holler_gloam', 'world', 94, 45, 'Team Holler Grunt', LOOKS.holler, { show: (S) => !f(S).mural });
  person('wren_bath', 'world', 71, 13, 'Wren', LOOKS.wren, { show: (S) => !f(S).night });
  person('holler_gate', 'world', 92, 14, 'Team Holler Grunt', LOOKS.holler, { show: (S) => !f(S).holler });
  person('nettie_thorn', 'world', 95, 9, 'Nettie', LOOKS.nettie, { show: (S) => !f(S).nettie2 });
  // Summit City and the Energy Plant
  person('registrar', 'world', 80, 84, 'Cup Registrar', LOOKS.staff);
  person('opaline', 'world', 92, 84, 'Opaline', LOOKS.opaline, { show: (S) => f(S).semis && !f(S).opaline });
  person('sterling', 'plant', 4, 4, 'Chairman Sterling', LOOKS.sterling, { show: (S) => !f(S).sterling });
  person('eternox', 'plant', 4, 1, 'Eternox', null, { kind: 'boss', show: (S) => !f(S).dawn });

  // The far east. A guard with a `line` simply says it and stays put.
  const n13 = GYM_ORDER.indexOf('Toxic') + 1;
  person('guard_east', 'world', 117, 21, 'League Staff', LOOKS.staff, { show: (S) => !S.badges.Mind,
    line: 'League Staff: The road south to Cogsworth is for challengers holding the Mind Badge.' });
  person('guard_r16', 'world', 114, 48, 'League Staff', LOOKS.staff, { show: (S) => !S.badges.Robot,
    line: 'League Staff: Solhaven is that way, once you have beaten Leader Axle here in Cogsworth.' });
  person('guard_r17', 'world', 113, 71, 'League Staff', LOOKS.staff, { show: (S) => !S.badges.Light,
    line: 'League Staff: The fen road is dangerous. Win the Light Badge and I will let you down it.' });
  person('guard_lumen', 'world', 99, 68, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < n13,
    line: 'League Staff: This is the short cut between Solhaven and Lumenlea. It opens to holders of the Toxic Badge.' });
  person('guard_fen', 'world', 98, 86, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < GYM_ORDER.length,
    line: 'League Staff: Summit City is through here, for those with every badge in Galdra.' });

  // Trainers along the way. They only battle if you talk to them.
  const trainer = (id, x, y, name, look, team, pre, post, reward, outfit) =>
    person(id, 'world', x, y, name, look, { team, pre, post, reward, outfit });
  trainer('mira', 30, 91, 'Scout Mira', { hair: '#8a5a2b', hairStyle: 'long', hat: 'cap', hatColor: '#2f7a2c', top: 'scout_vest', bottom: 'shorts', bottomColor: '#8a5a2b' },
    [['Fluffin', 3], ['Emberpup', 4]], 'The road north is no place for a flimsy Creatamon. Show me what you built!',
    'Solid build! Health cards go a long way out here.', ['hp30', 'hp30'], ['scout_vest']);
  trainer('oak', 36, 57, 'Ranger Oak', { skin: '#a86b3c', hair: '#1c1c28', hat: 'ranger_hat', topColor: '#2f7a2c', bottomColor: '#8a5a2b' },
    [['Zapwing', 8], ['Thornback', 9]], 'The Wildlands belong to the wild. Prove you can handle them.',
    'You will do fine out here. Take my spare hat.', ['hp100'], ['ranger_hat']);
  trainer('flint', 9, 37, 'Miner Flint', { skin: '#d9a066', hair: '#c0452c', hat: 'miner_helmet', top: 'hoodie', topColor: '#9a9a9a', bottomColor: '#2c2c3c' },
    [['Pebblit', 9], ['Gravlet', 10]], 'Nobody gets past my rock-solid crew!', 'Cracked like shale... Here, a helmet for the tunnels.', ['pebble_toss', 'hp30'], ['miner_helmet']);
  trainer('finn_r5', 15, 19, 'Finn', LOOKS.finn, [['Fluffin', 11], ['Chirple', 11], ['Thornback', 12]],
    'There you are! One badge each. Let us see who is ahead!', 'Argh! I will catch you up at the next gym. Just you watch.', ['hp100']);
  trainer('holler1', 29, 9, 'Team Holler Grunt', LOOKS.holler, [['Gloomoth', 13], ['Duskfang', 14]],
    'Oi! Only Nettie fans in this tunnel. Give us a cheer or give us a battle!', 'All right, all right. You can walk through.', ['shade_jab']);
  trainer('holler2', 37, 16, 'Team Holler Grunt', LOOKS.holler, [['Echobat', 14], ['Gloomoth', 15]],
    'NETTIE! NETTIE! ...You are not cheering.', 'We only wanted her to win...', ['hp100']);
  trainer('hiker', 37, 30, 'Hiker Tor', { hair: '#8a5a2b', hat: 'ranger_hat', topColor: '#f47a45', bottomColor: '#8a5a2b' },
    [['Boulderon', 15], ['Gravlet', 16]], 'These hills made my Creatamon tough. Feel it!', 'Tougher than the hills, you are.', ['rock_slide']);
  trainer('lass', 52, 49, 'Florist Posy', { hair: '#f08aa0', hairStyle: 'long', hat: 'bow', hatColor: '#f6d643', top: 'dress', topColor: '#f08aa0' },
    [['Bloomoth', 23], ['Petalwing', 23], ['Honeycub', 24]], 'Mind the flowers! Or battle me for them.', 'You walk gently and hit hard.', ['hp100', 'vine_lash']);
  trainer('ruin', 81, 43, 'Ruin Hunter Sol', { skin: '#a86b3c', hair: '#1c1c28', hat: 'straw_hat', topColor: '#f3e2a0', bottomColor: '#8a5a2b' },
    [['Stoneviper', 25], ['Shardwing', 26]], 'They say two heroes are carved somewhere in these cliffs. Battle me while I look!',
    'Two heroes... or was it two beasts?', ['hp100', 'thunder_fang']);
  trainer('mystic', 90, 54, 'Mystic Luma', { hair: '#9b3fd6', hairStyle: 'long', hat: 'wizard_hat', top: 'dress', topColor: '#9b3fd6' },
    [['Gloomoth', 28], ['Voidling', 29], ['Echobat', 29]], 'The mushrooms light the way. I will dim yours.', 'Your light is stronger.', ['night_claw', 'hp100']);
  trainer('skier', 65, 24, 'Skier Elke', { hair: '#f3e2a0', hairStyle: 'bob', hat: 'beanie', hatColor: '#e0483c', top: 'hoodie', topColor: '#e0483c', bottomColor: '#1f5f9e' },
    [['Frostfinch', 36], ['Snowpuff', 36], ['Frostmaw', 37]], 'First snow of the route! First battle too!', 'Brrr. You are ice cold.', ['ice_shard', 'hp250']);
  trainer('angler', 79, 14, 'Angler Brook', { hair: '#3a2412', hat: 'straw_hat', topColor: '#55a8ee', bottom: 'shorts', bottomColor: '#8a5a2b' },
    [['Gullwave', 40], ['Rivermaw', 41], ['Tidewyrm', 41]], 'The river only lets strong swimmers cross. Are yours?', 'Go on, then. Thornmuth is on the far bank.', ['hp250']);
  trainer('ace1', 73, 55, 'Ace Trainer Vale', { hair: '#55a8ee', hairStyle: 'spiky', top: 'varsity', topColor: '#9b3fd6', bottomColor: '#2c2c3c' },
    [['Cavernking', 59], ['Stormcrow', 59], ['Glacierback', 60]], 'Every badge? Me too. Only one of us reaches the Cup.', 'It is you. Go.', ['hp250', 'solar_bloom']);
  trainer('ace2', 71, 75, 'Ace Trainer Wynn', { skin: '#6e4424', hair: '#1c1c28', hairStyle: 'long', top: 'varsity', topColor: '#e0483c', bottomColor: '#2c2c3c' },
    [['Umbrawyrm', 61], ['Magmaw', 61], ['Leviadon', 61]], 'Summit City is just ahead. Last chance to turn back!', 'No turning back for you, then.', ['hp250', 'tsunami_blast']);

  trainer('kite', 13, 57, 'Kite Flyer Wim', { hair: '#f3e2a0', hairStyle: 'ponytail', top: 'tank', topColor: '#55a8ee', bottom: 'shorts', bottomColor: '#f4f4f4' },
    [['Breezlet', 20], ['Zephyrfox', 21]], 'The steppe wind carries my Creatamon. Can yours keep up?', 'Blown away!', ['gust', 'hp100']);
  trainer('smith', 50, 33, 'Smith Bex', { skin: '#a86b3c', hair: '#c0452c', hairStyle: 'bun', top: 'overalls', topColor: '#8a5a2b', bottomColor: '#2c2c3c' },
    [['Cogshell', 32], ['Ironclaw', 33]], 'Fresh off the anvil! Want to test their temper?', 'You have got mettle.', ['rivet_toss', 'hp250']);
  trainer('seer', 105, 15, 'Seer Ombra', { hair: '#f29ad0', hairStyle: 'curly', hat: 'flower_crown', top: 'kimono', topColor: '#9b3fd6', bottom: 'long_skirt', bottomColor: '#5b3fa8' },
    [['Thinkling', 44], ['Mesmoth', 45], ['Oraclynx', 45]], 'I dreamed you would lose. Shall we check?', 'My dreams are not what they were.', ['psy_wave', 'hp250']);

  trainer('tinker', 116, 29, 'Tinkerer Jib', { hair: '#5fd0c5', hairStyle: 'bun', hat: 'goggles', top: 'overalls', topColor: '#f5b942', bottomColor: '#2c2c3c' },
    [['Gearling', 48], ['Dronefly', 48], ['Servopup', 49]], 'Beep boop! That is robot for "battle me".', 'Powering down...', ['laser_beam', 'hp250']);
  trainer('sunny', 114, 53, 'Sunbather Sol', { skin: '#b97d48', hair: '#f6d643', hairStyle: 'ponytail', hat: 'visor', hatColor: '#fff3a8', top: 'tank', topColor: '#f47a45', bottom: 'shorts', bottomColor: '#55a8ee' },
    [['Sunpup', 50], ['Halowing', 51]], 'You are standing in my light!', 'Fine, fine. Plenty of sun for both of us.', ['sunbeam', 'hp250']);
  trainer('bogger', 113, 77, 'Bog Wader Fenn', { hair: '#56751a', hairStyle: 'short', hat: 'bucket', hatColor: '#56751a', top: 'puffer', topColor: '#8a5a2b', bottomColor: '#3a2412' },
    [['Sludgel', 52], ['Venomite', 52], ['Toxitoad', 53]], 'Mind the mud. And mind ME.', 'Stuck in the mud, I am.', ['venom_fang', 'hp250']);

  // Trainers who stand in the road. They must be beaten to get past, and then move on.
  // need(S): a reason they will not battle yet (and so will not move), or null.
  const blocker = (id, x, y, name, look, team, pre, post, need) =>
    person(id, 'world', x, y, name, look, { team, pre, post, need, reward: ['hp30'], show: (S) => !S.beaten[id] });
  blocker('b1', 37, 55, 'Gate Trainer Hale', { hair: '#3a2412', hat: 'headband', hatColor: '#e0483c', top: 'tank', topColor: '#f4f4f4', bottomColor: '#1f5f9e' },
    [['Breezlet', 7], ['Pebblit', 8]], 'Kilnford is through here, and so am I. Nobody walks in without a battle!', 'In you go. Mind the ceremony crowds.');
  blocker('b2', 16, 21, 'Farmhand Jo', { skin: '#d9a066', hair: '#8a5a2b', hairStyle: 'pigtails', hat: 'straw_hat', top: 'overalls', topColor: '#55a8ee', bottomColor: '#1f5f9e' },
    [['Honeycub', 10], ['Gustail', 11]], 'Hold it! Leader Thatch says badge winners owe me a battle on the way out.', 'Fair and square. The bridge is at the far end of the bank.',
    (S) => (S.badges.Grass ? null : 'Farmhand Jo: Nobody leaves Furrowfield for the bridge without the Grass Badge. Go and see Leader Thatch first!'));
  blocker('b3', 38, 20, 'Tunnel Rat Pim', { hair: '#9a9a9a', hairStyle: 'mohawk', hat: 'miner_helmet', top: 'overalls', topColor: '#566070', bottomColor: '#2c2c3c' },
    [['Boltnut', 15], ['Cogshell', 16]], 'You made it through my tunnel? Not without paying the toll: one battle!', 'Toll paid. Kilnford is down the hill.');
  blocker('b4', 92, 39, 'Pilgrim Asha', { skin: '#a86b3c', hair: '#1c1c28', hairStyle: 'bun', top: 'poncho', topColor: '#e3c98a', bottom: 'long_skirt', bottomColor: '#8a5a2b' },
    [['Stoneviper', 25], ['Ironclaw', 26]], 'Cairnside is sacred ground. Prove you are worthy of the climb.', 'Walk on, worthy one.');
  blocker('b5', 92, 62, 'Lamplighter Odo', { hair: '#f6d643', hairStyle: 'curly', hat: 'tophat', hatColor: '#2c2c3c', top: 'suit', topColor: '#2c2c3c', bottomColor: '#2c2c3c' },
    [['Mesmoth', 29], ['Thinkling', 29], ['Voidling', 30]], 'Few come out of the Gloamwood. Fewer get past me!', 'Lumenlea welcomes you. Mind the mushrooms.');
  blocker('b6', 67, 21, 'Snowguard Ilse', { hair: '#f4f4f4', hairStyle: 'ponytail', hat: 'beanie', hatColor: '#1f5f9e', top: 'puffer', topColor: '#f4f4f4', bottom: 'joggers', bottomColor: '#1f5f9e' },
    [['Frostmaw', 37], ['Stormkite', 38]], 'Halt! Frosthollow is snowed in for all but the strong.', 'Strong enough. Go and get warm.');
  blocker('b7', 111, 10, 'Dreamer Quill', { hair: '#b58cf0', hairStyle: 'afro', hat: 'headphones', hatColor: '#f29ad0', top: 'polka', topColor: '#9b3fd6', bottom: 'leggings', bottomColor: '#2c2c3c' },
    [['Oraclynx', 45], ['Mesmoth', 45]], 'Is this a dream? Battle me and we will find out.', 'Ouch. Awake, then. Reverie is right here.');
  blocker('b8', 72, 79, 'Cup Hopeful Rey', { skin: '#6e4424', hair: '#e0483c', hairStyle: 'afro', top: 'jersey', topColor: '#e0483c', bottom: 'joggers', bottomColor: '#2c2c3c' },
    [['Anviltusk', 60], ['Pyreking', 60], ['Oraclynx', 61]], 'One of us walks into Summit City. I trained all year for this!', 'All year, and it is you. Win it for both of us.');

  blocker('b9', 117, 34, 'Line Worker Rivet', { skin: '#6e4424', hair: '#1c1c28', hat: 'miner_helmet', top: 'overalls', topColor: '#1f6f68', bottomColor: '#2c2c3c' },
    [['Servopup', 49], ['Mechadon', 49]], 'Cogsworth runs on schedule, and you are not on it. Battle first!', 'Clocked out. In you go.');
  blocker('b10', 114, 58, 'Lamp Keeper Ray', { hair: '#f4f4f4', hairStyle: 'bob', hat: 'tophat', hatColor: '#b8962a', top: 'suit', topColor: '#fff3a8', bottomColor: '#b8962a' },
    [['Halowing', 51], ['Solarion', 51]], 'Solhaven never goes dark, and nobody dims it on my watch!', 'Brilliant. Go on through.');
  blocker('b11', 113, 78, 'Fen Guide Moss', { skin: '#d9a066', hair: '#3a2412', hairStyle: 'long', hat: 'straw_hat', top: 'poncho', topColor: '#56751a', bottom: 'long_skirt', bottomColor: '#3a2412' },
    [['Toxitoad', 53], ['Miasmander', 53]], 'One wrong step in Mirefen and you sink. Prove you can keep your feet!', 'Sure-footed. The town is just ahead.');

  // ---------- Creatastops ----------
  // A little red-roofed shop in every town past the first. Each sells the basics, cards of its own element, and its
  // share of the clothes. The shop is three tiles wide and three deep, with its door in the middle of the south wall;
  // it is built on the nearest clear plot to the spot given, leaving the tile in front of the door open.
  const STOPS = [], STOP_AT = {};
  const wares = Object.keys(CM.CLOTHES).filter((id) => CM.CLOTHES[id].sold);
  const taken = (x, y) => NPCS.some((n) => n.map === 'world' && n.x === x && n.y === y) || CHESTS.some((c) => c.map === 'world' && c.x === x && c.y === y);
  const plot = (dx, dy) => {
    // The building itself, plus the row in front of it, must be bare ground that nobody and nothing is using.
    for (let y = dy - 2; y <= dy + 1; y++) for (let x = dx - 1; x <= dx + 1; x++) if (!'c.Ss'.includes(charAt('world', x, y)) || taken(x, y)) return false;
    // Keep a clear walkway all the way round, so a shop never plugs a street.
    for (let y = dy - 3; y <= dy + 1; y++) for (const x of [dx - 2, dx + 2]) if (SOLID.includes(charAt('world', x, y)) || taken(x, y)) return false;
    for (let x = dx - 2; x <= dx + 2; x++) if (SOLID.includes(charAt('world', x, dy - 3)) || taken(x, dy - 3)) return false;
    return true;
  };
  const build = (x, y, ch) => { const rows = MAPS.world.rows; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); TINT[`${x},${y}`] = 'Stop'; };
  [[58, 92, 'Normal'], [35, 52, 'Fire'], [20, 28, 'Grass'], [16, 10, 'Water'], [16, 76, 'Wind'], [64, 46, 'Normal'], [88, 35, 'Rock'], [94, 70, 'Electric'],
    [51, 16, 'Metal'], [68, 16, 'Ice'], [95, 16, 'Shadow'], [118, 16, 'Mind'], [120, 42, 'Robot'], [120, 66, 'Light'], [106, 87, 'Toxic'], [72, 88, 'Normal']].forEach(([hx, hy, el], i, all) => {
    const town = areaAt('world', hx, hy).name;
    let door = null;
    for (let r = 0; r < 9 && !door; r++) {
      for (let dy = hy - r; dy <= hy + r && !door; dy++) for (let dx = hx - r; dx <= hx + r && !door; dx++) {
        if (Math.max(Math.abs(dx - hx), Math.abs(dy - hy)) === r && areaAt('world', dx, dy).name === town && plot(dx, dy)) door = [dx, dy];
      }
    }
    if (!door) throw new Error(`no room for a Creatastop in ${town}`);
    const [dx, dy] = door;
    for (let x = dx - 1; x <= dx + 1; x++) { build(x, dy - 2, 'G'); build(x, dy - 1, 'G'); build(x, dy, x === dx ? 'D' : 'W'); }
    const stop = { id: `stop${i}`, el, town, door, clothes: wares.filter((_, k) => k % all.length === i) };
    STOPS.push(stop);
    STOP_AT[`${dx},${dy}`] = stop;
  });

  Object.assign(CM, {
    STOPS, STOP_AT, MAPS, WARPS, TINT, AREAS, CHESTS, NPCS, GYMS, TEAMS, LOOKS, START, DIRS, GATE, GYM_ORDER, NICKS, makeTeam, gymTeam, gymDoor,
    badgeCount, charAt, gateOpen, passable, groundAt, areaAt, initPuzzle, checkSolved, step, arrive, toggleFire, teleAt, GUSTS,
  });
})(typeof module !== 'undefined' ? require('./core.js') : CM);
if (typeof module !== 'undefined') module.exports = require('./core.js');
