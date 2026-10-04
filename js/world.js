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
  const SOLID = '#^TRGWMIlBk ';
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
      m.targets.forEach((k) => { P.blocks[k] = 'o'; });
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
      if (!'FpoOv'.includes(bch) || blocked(bx, by) || (!pit && !free(bx, by))) return null;
      const kind = P.blocks[k];
      delete P.blocks[k];
      if (pit) P.fill[bk] = true; else P.blocks[bk] = kind;
      return { x: nx, y: ny, n: 1, pushed: true };
    }
    if (!free(nx, ny)) return null;
    let n = 1;
    while (charAt(id, nx, ny) === 'i' && free(nx + dx, ny + dy)) { nx += dx; ny += dy; n++; }
    return { x: nx, y: ny, n };
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
    const m = { id, name, rows, puzzle: null, fire0: [], targets: [], marks: [], pits: [], fires: [], blocks: {}, ...meta };
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const k = `${x},${y}`;
      if (ch === 'E') { m.exit = [x, y]; m.entry = [x, y - 1]; }
      if (ch === 'L') m.leader = [x, y];
      if (ch === 'p') m.targets.push(k);
      if (ch === 'z' || ch === 't') m.marks.push(k);
      if (ch === 'v') m.pits.push(k);
      if (ch === 'B') m.fires.push(k);
      if (ch === 'o' || ch === 'O') m.blocks[k] = ch;
    }));
    MAPS[id] = m;
  };

  interior('gym_Grass', 'Furrowfield Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIgIIII',
    'IFFFFFFFI',
    'IpFFoFFpI',
    'IFFoFoFFI',
    'IFFFFFFFI',
    'IHFFFFpFI',
    'IIIIEIIII',
  ], { puzzle: 'herd', hint: 'Gym challenge: the Fluffin have wandered off! Nudge all three into the hay pens to open the gate.' });

  interior('gym_Water', 'Brinemouth Gym', [
    'IIIIIIIIIIIII',
    'IFFFFFLFFFFFI',
    'IFFFFFFFFFFFI',
    'IIyIIIIIIIuII',
    'IFFFFFIFFFFFI',
    'IF3FFFIFFF2FI',
    'IFFFFFIFFFFFI',
    'IIrIIIIIIIqII',
    'IFFFFFFFFFFFI',
    'IFF1FFFFFFFFI',
    'IHFFFFFFFFFFI',
    'IIIIIIEIIIIII',
  ], { puzzle: 'valves', hint: 'Gym challenge: step on a coloured valve to switch every waterfall of that colour. Open a way to the Leader.' });

  interior('gym_Fire', 'Kilnford Gym', [
    'IIIIIIIIIIIII',
    'IFFFFFLFFFFFI',
    'IFFFFFFFFFFFI',
    'IIIIIIgIIIIII',
    'IFFFFFFFFFFFI',
    'IFBlBlBlBlBFI',
    'IFFFFFFFFFFFI',
    'IllllFFFllllI',
    'IFFFFFFFFFFFI',
    'IHFFFFFFFFFFI',
    'IIIIIIEIIIIII',
  ], { puzzle: 'fire', fire0: [false, true, true, true, false], hint: 'Gym challenge: light all five braziers. Touching one flips it and its neighbours.' });

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
    'IHFFFFFFFFI',
    'IIIIIEIIIII',
  ], { puzzle: 'pits', hint: 'Gym challenge: the way is broken by pits. Push boulders into them to make a path.' });

  interior('gym_Electric', 'Lumenlea Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIgIIII',
    'IFFFFFFFI',
    'IzzzIzzzI',
    'IzIzzzIzI',
    'IzzzzzzzI',
    'IzzIzzzzI',
    'IFFFFFFFI',
    'IHFFFFFFI',
    'IIIIEIIII',
  ], { puzzle: 'panels', hint: 'Gym challenge: charge every floor panel by stepping on it once. Step on a charged panel and the whole grid resets.' });

  interior('gym_Ice', 'Frosthollow Gym', [
    'IIIIIIIII',
    'IFFFLFFFI',
    'IFFFFFFFI',
    'IIIIFIIII',
    'IiiiikiiI',
    'IiiiiiikI',
    'IkiikiiiI',
    'IiiiiiiiI',
    'IiikiiikI',
    'IiiiiikiI',
    'IFFFFFFFI',
    'IHFFFFFFI',
    'IIIIEIIII',
  ], { puzzle: 'ice', hint: 'Gym challenge: the floor is sheer ice. You slide until something stops you. Find a way to the far door.' });

  interior('gym_Shadow', 'Thornmuth Gym', [
    'IIIIIIIIIIIII',
    'IFFFFFLFFFFFI',
    'IFFFFFFFFFFFI',
    'IIIIIIIIIIgII',
    'IFtFIFFFFFFFI',
    'IFIFIFIIIIIFI',
    'IFIFFFIFFtFFI',
    'IFIIIIIFIIIII',
    'IFFFFFFFFFFFI',
    'IIIFIIIIIIIFI',
    'IFFFFFFFFFFFI',
    'IHFFFFFFFFFtI',
    'IIIIIIEIIIIII',
  ], { puzzle: 'seals', dark: true, hint: 'Gym challenge: the lights are out. Somewhere in the dark are three seals. Step on each to open the gate.' });

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
    'IHFFFFFFI',
    'IIIIEIIII',
  ], { puzzle: 'quiz', hint: 'Gym challenge: three gatekeepers test what you know. Answer wrong and you must battle before trying again.' });

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
  ], { fog: true, area: { name: 'Drowsing Grove', lv: [3, 5], drops: [90, 10, 0] } });

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
  const W = 100, H = 96;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const rect = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch; };
  const set = (x, y, ch) => { g[y][x] = ch; };
  const area = (name, x0, y0, x1, y1, lv, drops) => AREAS.push({ name, x0, y0, x1, y1, lv, drops });
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
  const GYM_ORDER = ['Grass', 'Water', 'Fire', 'Rock', 'Electric', 'Ice', 'Shadow', 'Normal'];
  const gymHall = (x, y, el) => {
    const n = GYM_ORDER.indexOf(el);
    hall(x, y, el, `gym_${el}`, (S) => (badgeCount(S) >= n ? null
      : `The gym doors are shut. A notice reads: "Challengers need ${n} badge${n === 1 ? '' : 's'}."`));
  };

  rect(56, 0, 99, 24, 'T');   // the snowy north-east
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
  // Furrowfield
  rect(3, 22, 22, 33, '.'); gymHall(10, 23, 'Grass'); house(17, 23); set(18, 28, 'H'); rect(14, 30, 21, 32, '*');
  rect(7, 27, 16, 27, '='); rect(7, 27, 7, 33, '='); rect(16, 21, 16, 27, '=');
  area('Furrowfield', 3, 21, 22, 33);
  // Route 5: a river with one bridge
  rect(14, 14, 18, 20, '.'); rect(6, 17, 23, 18, '~'); rect(16, 17, 16, 18, 'b');
  rect(14, 14, 15, 16, ','); rect(17, 19, 18, 20, ','); rect(17, 14, 18, 15, '*'); set(16, 13, '=');
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
  area('The Forgeway', 48, 44, 56, 52, [18, 21], [45, 48, 7]);
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
  area('Route 6', 78, 39, 97, 45, [20, 23], [40, 50, 10]);
  // Gloamwood and Lumenlea
  rect(88, 46, 97, 61, ';'); rect(90, 48, 91, 50, '#'); rect(94, 52, 95, 55, '#'); rect(89, 57, 90, 58, '#');
  rect(92, 46, 93, 49, '.'); rect(91, 53, 92, 55, '.'); rect(93, 58, 94, 61, '.');
  [[93, 47], [91, 54], [94, 59], [89, 52], [96, 57]].forEach(([x, y]) => set(x, y, 'm'));
  set(92, 62, '.');
  area('Gloamwood', 88, 46, 97, 62, [24, 27], [30, 55, 15]);
  rect(80, 63, 97, 75, '.'); gymHall(86, 64, 'Electric'); house(81, 69); house(93, 65); set(92, 70, 'H');
  [[82, 64], [84, 73], [90, 72], [96, 74], [80, 67], [95, 69]].forEach(([x, y]) => set(x, y, 'm'));
  area('Lumenlea', 80, 63, 97, 75);
  // Route 7 and Frosthollow
  rect(64, 22, 70, 32, '.'); rect(64, 22, 70, 26, 's'); rect(64, 27, 70, 27, '^'); set(66, 27, 'x');
  rect(68, 28, 70, 31, ','); rect(64, 23, 66, 25, '"'); set(67, 21, 's');
  area('Route 7', 64, 21, 70, 32, [28, 32], [25, 55, 20]);
  rect(58, 8, 76, 20, 's'); gymHall(60, 9, 'Ice'); house(66, 9); rect(70, 10, 73, 12, '~'); house(59, 15); set(66, 16, 'H'); set(77, 14, 's');
  area('Frosthollow', 58, 8, 77, 20);
  // Route 9: a wide river, and Thornmuth beyond it
  rect(78, 10, 83, 18, 's'); rect(80, 11, 82, 13, '"'); rect(79, 15, 82, 17, '"');
  rect(84, 3, 88, 23, '~'); rect(89, 10, 91, 18, 's'); set(92, 14, 'c');
  area('Route 9', 78, 3, 92, 23, [33, 37], [15, 55, 30]);
  rect(93, 6, 98, 21, 'c'); gymHall(93, 6, 'Shadow'); set(97, 16, 'H');
  area('Thornmuth', 93, 6, 98, 21);
  // Route 10 and Summit City
  rect(70, 52, 74, 78, '.'); rect(70, 58, 74, 74, 's'); rect(70, 53, 71, 56, ','); rect(73, 60, 74, 66, '"'); rect(70, 68, 71, 72, '"');
  set(72, 79, 'c');
  area('Route 10', 70, 52, 74, 79, [42, 46], [10, 50, 40]);
  rect(64, 80, 97, 94, 'c'); hall(77, 81, 'League', null, null, 7); hall(90, 81, 'Plant'); house(65, 82); house(86, 89); set(70, 88, 'H');
  area('Summit City', 64, 80, 97, 94);

  MAPS.world = {
    id: 'world', name: 'Galdra', rows: g.map((row) => row.join('')),
    puzzle: null, fire0: [], targets: [], marks: [], pits: [], fires: [], blocks: {},
  };
  const START = { x: 10, y: 89 };
  const areaAt = (id, x, y) => (id === 'world'
    ? AREAS.find((a) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1) || { name: 'Galdra' }
    : MAPS[id].area || { name: MAPS[id].name });

  // ---------- Chests ----------
  const chest = (x, y, what, map = 'world') => CHESTS.push({ map, x, y, ...(CM.CARDS[what] ? { card: what } : { outfit: what }) });
  chest(21, 85, 'hp30'); chest(7, 94, 'scratch'); chest(43, 88, 'pebble_toss'); chest(24, 92, 'spark');
  chest(59, 94, 'straw_hat'); chest(45, 83, 'frost_nip'); chest(50, 73, 'hp30');
  chest(25, 57, 'shade_jab'); chest(65, 71, 'hp100'); chest(44, 63, 'tsunami_blast'); chest(25, 70, 'body_slam'); chest(65, 57, 'varsity');
  chest(13, 50, 'hp30'); chest(10, 35, 'rock_slide'); chest(4, 49, 'hp100'); chest(21, 33, 'mend'); chest(18, 14, 'hp100');
  chest(22, 2, 'solar_bloom'); chest(27, 11, 'thunder_fang'); chest(40, 5, 'hp100'); chest(41, 22, 'ice_shard'); chest(36, 40, 'wizard_hat');
  chest(48, 44, 'night_claw'); chest(76, 50, 'hp100'); chest(78, 44, 'hp100'); chest(96, 40, 'inferno_crash'); chest(84, 38, 'hp250');
  chest(88, 46, 'hp250'); chest(97, 61, 'hp100'); chest(80, 75, 'hp250'); chest(64, 22, 'hp250'); chest(76, 20, 'hp250');
  chest(89, 18, 'hp250'); chest(98, 21, 'hp250'); chest(70, 78, 'hp250'); chest(74, 52, 'earthshatter'); chest(97, 94, 'hp250');

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
    finn3: [['Fluffalo', 29], ['Skylord', 29], ['Thornback', 30], ['Stormcrow', 30]],
    finn4: [['Fluffalo', 46], ['Skylord', 46], ['Thornback', 46], ['Stormcrow', 47], ['Tidewyrm', 47]],
    cyril1: [['Frostfinch', 9], ['Gloomoth', 9], ['Voltmite', 10]],
    cyril2: [['Frostfinch', 23], ['Gloomoth', 23], ['Prismite', 24], ['Voidling', 24]],
    cyril3: [['Frostmaw', 47], ['Voidling', 47], ['Prismite', 48], ['Glacierback', 48]],
    nettie1: [['Gloomoth', 16], ['Echobat', 16], ['Duskfang', 17]],
    nettie2: [['Echobat', 37], ['Nightshade', 37], ['Duskfang', 38], ['Umbrawyrm', 38]],
    nettie3: [['Echobat', 45], ['Nightshade', 45], ['Duskfang', 46], ['Umbrawyrm', 46]],
    holler: [['Gloomoth', 35], ['Duskfang', 36]],
    opaline: [['Glimmershell', 47], ['Stormcrow', 47], ['Magmite', 48], ['Leviadon', 48]],
    marina2: [['Dewsnake', 47], ['Rivermaw', 47], ['Tidewyrm', 48], ['Leviadon', 48]],
    gneiss2: [['Stoneviper', 48], ['Shardwing', 48], ['Boulderon', 49], ['Ironhide', 49]],
    brann2: [['Grizzlord', 49], ['Skylord', 49], ['Fluffalo', 49], ['Regalion', 50]],
    sterling: [['Boulderon', 49], ['Shardwing', 49], ['Stoneviper', 49], ['Cavernking', 50], ['Ironhide', 51]],
    eternox1: [['Eternox', 52]],
    eternox2: [['Eternox', 55]],
    vex: [['Stormcrow', 53], ['Nightshade', 53], ['Magmaw', 54], ['Leviadon', 54], ['Glacierback', 54], ['Pyreking', 56]],
    quiz: [['Antlerox', 40], ['Skylord', 40]],
  };

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
    { el: 'Rock', town: 'Cairnside', name: 'Leader Gneiss', team: [['Pebblit', 22], ['Gravlet', 23], ['Stoneviper', 23], ['Boulderon', 25]], reward: ['earthshatter', 'hp100'],
      look: { skin: '#d9a066', hair: '#f3e2a0', hairStyle: 'spiky', top: 'tee', topColor: '#8a5a2b', bottomColor: '#2c2c3c' },
      pre: 'You shifted my boulders. You will not shift me!', post: 'Cracked clean through. Here: the Rock Badge.' },
    { el: 'Electric', town: 'Lumenlea', name: 'Madame Ohm', team: [['Voltmite', 27], ['Zapwing', 28], ['Prismite', 28], ['Stormcrow', 30]], reward: ['thunderstorm', 'hp250'],
      look: { hair: '#f4f4f4', hairStyle: 'bob', hat: 'wizard_hat', top: 'dress', topColor: '#f6d643' },
      pre: 'Seventy years I have led this gym, dearie. Do try to be a little shocking.', post: 'Oh, what a spark! The Electric Badge, with my compliments.' },
    { el: 'Ice', town: 'Frosthollow', name: 'Leader Rime', team: [['Snowpuff', 32], ['Glimmershell', 33], ['Frostmaw', 33], ['Glacierback', 35]], reward: ['blizzard', 'hp250'],
      look: { hair: '#9fe3ef', hairStyle: 'long', hat: 'beanie', hatColor: '#f4f4f4', top: 'hoodie', topColor: '#55a8ee', bottomColor: '#f4f4f4' },
      pre: 'You kept your footing. Now keep your nerve!', post: 'You have melted my defence. The Ice Badge is yours.' },
    { el: 'Shadow', town: 'Thornmuth', name: 'Leader Rook', team: [['Gloomoth', 37], ['Echobat', 38], ['Duskfang', 38], ['Umbrawyrm', 40]], reward: ['eclipse', 'hp250'],
      look: { hair: '#1c1c28', hairStyle: 'long', top: 'hoodie', topColor: '#2c2c3c', bottomColor: '#2c2c3c' },
      pre: 'Thornmuth has no grand stadium. Just me, the dark, and a town that still believes. Come on, then.', post: 'Heh. Lights up. Take the Shadow Badge, and look after my sister out there.' },
    { el: 'Normal', town: 'Anvilgate', name: 'Leader Brann', team: [['Antlerox', 42], ['Skylord', 43], ['Fluffalo', 43], ['Grizzlord', 43], ['Regalion', 45]], reward: ['hyper_burst', 'hp250'],
      look: { skin: '#a86b3c', hair: '#1c1c28', hat: 'cap', hatColor: '#f47a45', top: 'hoodie', topColor: '#1f5f9e', bottom: 'shorts', bottomColor: '#2c2c3c' },
      pre: 'Only the Champion has ever beaten me. No tricks, no weakness to lean on. Just strength!', post: 'Ha! Finally someone worth losing to. The eighth badge is yours. Go and claim the Cup.' },
  ];
  GYMS.forEach((gm) => {
    const map = `gym_${gm.el}`, [x, y] = MAPS[map].leader;
    MAPS[map].el = gm.el;
    person(`leader_${gm.el}`, map, x, y, gm.name, gm.look, { gym: gm });
  });
  [[4, 7], [4, 5], [4, 3]].forEach(([x, y], i) => person(`quiz${i + 1}`, 'gym_Normal', x, y, 'Gatekeeper', LOOKS.staff,
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
  person('holler_r4', 'world', 40, 41, 'Team Holler Grunt', LOOKS.holler, { show: (S) => !S.badges.Water });
  // Gritstone Mine, Furrowfield, Brinemouth
  person('cyril_mine', 'world', 4, 40, 'Cyril', LOOKS.cyril, { show: (S) => !f(S).cyril1 });
  person('wren_glyph', 'world', 15, 29, 'Wren', LOOKS.wren, { show: (S) => !S.badges.Water });
  person('sterling_brine', 'world', 12, 9, 'Chairman Sterling', LOOKS.sterling, { show: (S) => S.badges.Water && !S.badges.Fire });
  // Anvilgate
  person('guard_anvil', 'world', 57, 48, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < 3 });
  person('wren_vault', 'world', 71, 39, 'Wren', LOOKS.wren, { show: (S) => !f(S).night });
  person('sterling_anvil', 'world', 63, 39, 'Chairman Sterling', LOOKS.sterling, { show: (S) => badgeCount(S) === 3 });
  person('finn_r7', 'world', 67, 33, 'Finn', LOOKS.finn, { show: (S) => !f(S).rival3 });
  person('guard_r10', 'world', 72, 51, 'League Staff', LOOKS.staff, { show: (S) => badgeCount(S) < 8 });
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
    [['Bloomoth', 19], ['Petalwing', 19], ['Honeycub', 20]], 'Mind the flowers! Or battle me for them.', 'You walk gently and hit hard.', ['hp100', 'vine_lash']);
  trainer('ruin', 81, 43, 'Ruin Hunter Sol', { skin: '#a86b3c', hair: '#1c1c28', hat: 'straw_hat', topColor: '#f3e2a0', bottomColor: '#8a5a2b' },
    [['Stoneviper', 21], ['Shardwing', 22]], 'They say two heroes are carved somewhere in these cliffs. Battle me while I look!',
    'Two heroes... or was it two beasts?', ['hp100', 'thunder_fang']);
  trainer('mystic', 90, 54, 'Mystic Luma', { hair: '#9b3fd6', hairStyle: 'long', hat: 'wizard_hat', top: 'dress', topColor: '#9b3fd6' },
    [['Gloomoth', 25], ['Voidling', 26], ['Echobat', 26]], 'The mushrooms light the way. I will dim yours.', 'Your light is stronger.', ['night_claw', 'hp100']);
  trainer('skier', 65, 24, 'Skier Elke', { hair: '#f3e2a0', hairStyle: 'bob', hat: 'beanie', hatColor: '#e0483c', top: 'hoodie', topColor: '#e0483c', bottomColor: '#1f5f9e' },
    [['Frostfinch', 30], ['Snowpuff', 30], ['Frostmaw', 31]], 'First snow of the route! First battle too!', 'Brrr. You are ice cold.', ['ice_shard', 'hp250']);
  trainer('angler', 79, 14, 'Angler Brook', { hair: '#3a2412', hat: 'straw_hat', topColor: '#55a8ee', bottom: 'shorts', bottomColor: '#8a5a2b' },
    [['Gullwave', 34], ['Rivermaw', 35], ['Tidewyrm', 35]], 'The river only lets strong swimmers cross. Are yours?', 'Go on, then. Thornmuth is on the far bank.', ['hp250']);
  trainer('ace1', 73, 55, 'Ace Trainer Vale', { hair: '#55a8ee', hairStyle: 'spiky', top: 'varsity', topColor: '#9b3fd6', bottomColor: '#2c2c3c' },
    [['Cavernking', 43], ['Stormcrow', 43], ['Glacierback', 44]], 'Eight badges? Me too. Only one of us reaches the Cup.', 'It is you. Go.', ['hp250', 'solar_bloom']);
  trainer('ace2', 71, 75, 'Ace Trainer Wynn', { skin: '#6e4424', hair: '#1c1c28', hairStyle: 'long', top: 'varsity', topColor: '#e0483c', bottomColor: '#2c2c3c' },
    [['Umbrawyrm', 45], ['Magmaw', 45], ['Leviadon', 45]], 'Summit City is just ahead. Last chance to turn back!', 'No turning back for you, then.', ['hp250', 'tsunami_blast']);

  Object.assign(CM, {
    MAPS, WARPS, TINT, AREAS, CHESTS, NPCS, GYMS, TEAMS, LOOKS, START, DIRS, GATE, GYM_ORDER,
    badgeCount, charAt, gateOpen, passable, groundAt, areaAt, initPuzzle, checkSolved, step, arrive, toggleFire,
  });
})(typeof module !== 'undefined' ? require('./core.js') : CM);
if (typeof module !== 'undefined') module.exports = require('./core.js');
