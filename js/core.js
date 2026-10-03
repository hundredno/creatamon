// Creatamon core: data + rules. No DOM in here so it can be tested under node.
const CM = (() => {
  const ELEMENTS = {
    Normal: { color: '#cfc6b4', dark: '#7d7462' },
    Fire: { color: '#f47a45', dark: '#a23a14' },
    Water: { color: '#55a8ee', dark: '#1f5f9e' },
    Grass: { color: '#72cc5c', dark: '#2f7a2c' },
    Electric: { color: '#f6d643', dark: '#a08312' },
    Rock: { color: '#b39474', dark: '#6a5038' },
  };
  const STRONG = {
    Normal: [], Fire: ['Grass'], Water: ['Fire', 'Rock'], Grass: ['Water', 'Rock'],
    Electric: ['Water'], Rock: ['Fire', 'Electric'],
  };
  const WEAK = {
    Normal: [], Fire: ['Fire', 'Water', 'Rock'], Water: ['Water', 'Grass'], Grass: ['Grass', 'Fire'],
    Electric: ['Electric', 'Grass', 'Rock'], Rock: ['Rock', 'Grass'],
  };
  const effectiveness = (att, def) => (STRONG[att].includes(def) ? 2 : WEAK[att].includes(def) ? 0.5 : 1);

  const SHAPES = {
    Blob: { atk: 10, def: 10, spd: 10, hint: 'Balanced' },
    Beast: { atk: 12, def: 9, spd: 9, hint: 'Hits hard' },
    Bird: { atk: 9, def: 8, spd: 13, hint: 'Strikes first' },
    Shell: { atk: 8, def: 13, spd: 7, hint: 'Tough' },
  };

  const TIER_NAMES = { 1: 'Common', 2: 'Rare', 3: 'Epic' };
  const mv = (name, tier, element, power, acc = 100) => ({ kind: 'move', name, tier, element, power, acc });
  const hp = (name, tier, amount) => ({ kind: 'hp', name, tier, amount });
  const CARDS = {
    // Low end
    tackle: mv('Tackle', 1, 'Normal', 35),
    scratch: mv('Scratch', 1, 'Normal', 40, 95),
    ember: mv('Ember', 1, 'Fire', 40),
    splash_shot: mv('Splash Shot', 1, 'Water', 40),
    leaf_flick: mv('Leaf Flick', 1, 'Grass', 40),
    spark: mv('Spark', 1, 'Electric', 40),
    pebble_toss: mv('Pebble Toss', 1, 'Rock', 40),
    hp30: hp('Vitality Shard', 1, 30),
    // Mid range
    flame_wheel: mv('Flame Wheel', 2, 'Fire', 65),
    aqua_jet: mv('Aqua Jet', 2, 'Water', 65),
    vine_lash: mv('Vine Lash', 2, 'Grass', 65),
    thunder_fang: mv('Thunder Fang', 2, 'Electric', 65),
    rock_slide: mv('Rock Slide', 2, 'Rock', 70, 90),
    body_slam: mv('Body Slam', 2, 'Normal', 70),
    mend: { kind: 'move', name: 'Mend', tier: 2, element: 'Normal', power: 0, acc: 100, heal: 0.5 },
    hp100: hp('Vitality Core', 2, 100),
    // High end
    tsunami_blast: mv('Tsunami Blast', 3, 'Water', 110, 85),
    inferno_crash: mv('Inferno Crash', 3, 'Fire', 110, 85),
    thunderstorm: mv('Thunderstorm', 3, 'Electric', 110, 85),
    earthshatter: mv('Earthshatter', 3, 'Rock', 110, 85),
    solar_bloom: mv('Solar Bloom', 3, 'Grass', 110, 85),
    hyper_burst: mv('Hyper Burst', 3, 'Normal', 120, 80),
    hp250: hp('Titan Heart', 3, 250),
  };
  const cardDesc = (c) =>
    c.kind === 'hp' ? `+${c.amount} max HP`
      : c.heal ? `Restores ${c.heal * 100}% HP`
        : `${c.element} · Pow ${c.power} · Acc ${c.acc}%`;

  const MAX_MOVES = 4, MAX_HP_CARDS = 3, MAX_PARTY = 6, BASE_HP = 50;

  // ---- Creatures ----
  const maxHp = (c) => BASE_HP + 6 * (c.level - 1) + c.hpCards.reduce((s, id) => s + CARDS[id].amount, 0);
  const stats = (c) => {
    const s = SHAPES[c.shape], g = c.level - 1;
    return { atk: s.atk + g, def: s.def + g, spd: s.spd + g };
  };
  const create = (spec) => {
    const c = {
      name: spec.name, element: spec.element, shape: spec.shape,
      moves: [...spec.moves], hpCards: [...(spec.hpCards || [])],
      level: spec.level || 1, xp: 0,
    };
    c.hp = maxHp(c);
    return c;
  };
  const xpToNext = (level) => 15 * level + 10;
  const xpYield = (foe) => 15 * foe.level;
  // Returns number of levels gained.
  const gainXp = (c, amount) => {
    let gained = 0;
    c.xp += amount;
    while (c.xp >= xpToNext(c.level)) {
      c.xp -= xpToNext(c.level);
      c.level++;
      c.hp += 6;
      gained++;
    }
    return gained;
  };

  // ---- Battle rules ----
  // Mutates hp. Returns {miss} | {heal} | {dmg, eff}.
  const useMove = (att, def, move, rng = Math.random) => {
    if (rng() * 100 >= move.acc) return { miss: true };
    if (move.heal) {
      const heal = Math.min(maxHp(att) - att.hp, Math.round(maxHp(att) * move.heal));
      att.hp += heal;
      return { heal };
    }
    const eff = effectiveness(move.element, def.element);
    const stab = move.element === att.element ? 1.25 : 1;
    const ratio = stats(att).atk / stats(def).def;
    const scale = 0.4 + 0.06 * att.level;
    const dmg = Math.max(1, Math.round(move.power * ratio * scale * stab * eff * (0.85 + rng() * 0.15)));
    def.hp = Math.max(0, def.hp - dmg);
    return { dmg, eff };
  };
  const pickMove = (foe, target, rng = Math.random) => {
    const heals = foe.moves.filter((id) => CARDS[id].heal);
    const attacks = foe.moves.filter((id) => !CARDS[id].heal);
    if (heals.length && foe.hp < maxHp(foe) * 0.35 && rng() < 0.5) return heals[0];
    const pool = attacks.length ? attacks : foe.moves;
    if (rng() < 0.6) {
      const score = (id) => {
        const m = CARDS[id];
        return m.power * m.acc * effectiveness(m.element, target.element) * (m.element === foe.element ? 1.25 : 1);
      };
      return pool.reduce((best, id) => (score(id) > score(best) ? id : best));
    }
    return pool[Math.floor(rng() * pool.length)];
  };

  // ---- World ----
  // # tree  ^ rock  ~ water  . ground  = path  H heal pad  _ cave floor
  // Encounter tiles: , meadow (zone 1)  ; forest (zone 2)  : cave (zone 3)
  const MAP = [
    '########################################',
    '#^^^^^^^^^^^^^^^^^^#;;;;;;;;.....;;;;;;#',
    '#^___::::::___^^^^^#;;;;;;;;.....;;;;;;#',
    '#^___::::::::_^^^^^#;;;###;;;;;;;;;##;;#',
    '#^___^^^::::::__^^^#;;;###;;..;;;;;##;;#',
    '#^^_^^^^^^:::::_^^^#;;;;;;;;..;;;;;;;;;#',
    '#^^_^^^^^^^^::::___=.H.;;;;;..;;;;;;;;;#',
    '#^___^^^^^^^^^:::^^#;;;;;##;;;;;;;;;;;;#',
    '#^___^^^^^^^^^^^^^^#;;;;;##;;;;;..;;;;;#',
    '#^^^^^^^^^^^^^^^^^^#;;;;;;;;;;;;..;;;;;#',
    '##################################=#####',
    '#......,,,,,,..#~~~~~#,,,,,,,,....=....#',
    '#......,,,,,,..#~~~~~#,,,,,,,,....=....#',
    '#..............#~~~~~#,,,,,,......=....#',
    '#...=======....##~~~##......,,,,,.=....#',
    '#...=.....=.....#####.......,,,,,.=....#',
    '#...=..H..==========================...#',
    '#...=.....=.......,,,,,,......,,,,,,...#',
    '#...=======.......,,,,,,......,,,,,,...#',
    '#.................,,,,,,......,,,,,,...#',
    '#....,,,,....##...........##...........#',
    '#....,,,,....##...........##....,,,,...#',
    '#....,,,,.................,,,,..,,,,...#',
    '#.........................,,,,.........#',
    '########################################',
  ];
  const SOLID = '#^~';
  const ZONE_OF = { ',': 1, ';': 2, ':': 3 };
  const START = { x: 7, y: 17 };
  const PROFESSOR = { x: 6, y: 15, name: 'Prof. Willow' };

  const CHESTS = [
    { x: 13, y: 12, card: 'hp30' },
    { x: 2, y: 22, card: 'scratch' },
    { x: 12, y: 20, card: 'pebble_toss' },
    { x: 24, y: 14, card: 'spark' },
    { x: 37, y: 12, card: 'flame_wheel' },
    { x: 38, y: 19, card: 'body_slam' },
    { x: 37, y: 22, card: 'hp100' },
    { x: 30, y: 1, card: 'hp100' },
    { x: 38, y: 3, card: 'thunder_fang' },
    { x: 37, y: 8, card: 'vine_lash' },
    { x: 20, y: 9, card: 'mend' },
    { x: 15, y: 7, card: 'rock_slide' },
    { x: 13, y: 2, card: 'hp100' },
    { x: 2, y: 2, card: 'tsunami_blast' },
    { x: 2, y: 7, card: 'hp250' },
  ];

  const w = (name, element, shape, moves, hpCards = []) => ({ name, element, shape, moves, hpCards });
  const WILD = {
    1: { levels: [1, 3], drops: [90, 10, 0], list: [
      w('Fluffin', 'Normal', 'Blob', ['tackle']),
      w('Emberpup', 'Fire', 'Beast', ['ember', 'tackle']),
      w('Puddlit', 'Water', 'Blob', ['splash_shot']),
      w('Sproutle', 'Grass', 'Blob', ['leaf_flick', 'tackle']),
    ] },
    2: { levels: [4, 7], drops: [50, 45, 5], list: [
      w('Zapwing', 'Electric', 'Bird', ['spark', 'scratch'], ['hp30']),
      w('Thornback', 'Grass', 'Shell', ['vine_lash', 'leaf_flick'], ['hp30']),
      w('Cinderfox', 'Fire', 'Beast', ['flame_wheel', 'scratch'], ['hp30']),
      w('Mossowl', 'Grass', 'Bird', ['leaf_flick', 'scratch'], ['hp30']),
    ] },
    3: { levels: [8, 11], drops: [25, 55, 20], list: [
      w('Boulderon', 'Rock', 'Shell', ['rock_slide', 'pebble_toss'], ['hp100']),
      w('Tidewyrm', 'Water', 'Beast', ['aqua_jet', 'splash_shot'], ['hp100']),
      w('Stormcrow', 'Electric', 'Bird', ['thunder_fang', 'spark'], ['hp30', 'hp30']),
      w('Gravlet', 'Rock', 'Blob', ['pebble_toss', 'body_slam'], ['hp100']),
    ] },
  };
  const randInt = (a, b, rng) => a + Math.floor(rng() * (b - a + 1));
  const genWild = (zone, rng = Math.random) => {
    const z = WILD[zone];
    const spec = z.list[Math.floor(rng() * z.list.length)];
    return create({ ...spec, level: randInt(z.levels[0], z.levels[1], rng) });
  };
  // Returns a card id or null.
  const rollDrop = (zone, rng = Math.random) => {
    if (rng() >= 0.5) return null;
    const [a, b] = WILD[zone].drops;
    const r = rng() * 100;
    const tier = r < a ? 1 : r < a + b ? 2 : 3;
    const ids = Object.keys(CARDS).filter((id) => CARDS[id].tier === tier);
    return ids[Math.floor(rng() * ids.length)];
  };

  const TRAINERS = [
    {
      id: 't1', name: 'Scout Mira', x: 34, y: 10, aside: [35, 11],
      pre: 'The forest ahead is no place for a flimsy Creatamon. Show me what you built!',
      post: 'Solid build! Take these. Health cards go a long way in the forest.',
      reward: ['hp100', 'hp30'],
      team: [
        { ...w('Fluffin', 'Normal', 'Blob', ['tackle', 'scratch']), level: 3 },
        { ...w('Emberpup', 'Fire', 'Beast', ['ember', 'tackle'], ['hp30']), level: 4 },
      ],
    },
    {
      id: 't2', name: 'Ranger Oak', x: 19, y: 6, aside: [20, 5],
      pre: 'Beyond me lies Stonemaw Cave. I only let strong creators through.',
      post: 'You earned passage. The heal pad here is yours to use.',
      reward: ['aqua_jet', 'hp100'],
      team: [
        { ...w('Zapwing', 'Electric', 'Bird', ['thunder_fang', 'spark'], ['hp30']), level: 7 },
        { ...w('Thornback', 'Grass', 'Shell', ['vine_lash', 'leaf_flick'], ['hp100']), level: 8 },
      ],
    },
    {
      id: 't3', name: 'Miner Flint', x: 3, y: 5, aside: [4, 4],
      pre: 'The Champion waits below. Nobody gets past my rock-solid crew!',
      post: 'Cracked like shale... Here, the best card I ever dug up.',
      reward: ['earthshatter', 'hp100'],
      team: [
        { ...w('Boulderon', 'Rock', 'Shell', ['rock_slide', 'pebble_toss', 'body_slam'], ['hp100']), level: 10 },
        { ...w('Tidewyrm', 'Water', 'Beast', ['aqua_jet', 'splash_shot'], ['hp100']), level: 10 },
        { ...w('Cinderfox', 'Fire', 'Beast', ['flame_wheel', 'body_slam'], ['hp100']), level: 11 },
      ],
    },
    {
      id: 'champ', name: 'Champion Vex', x: 3, y: 8, champion: true,
      pre: 'So you are the creator everyone is whispering about. My Creatamon were forged from the rarest Power Cards. Come!',
      post: 'Magnificent. You are the new Creatamon Champion! Take my finest cards.',
      reward: ['inferno_crash', 'hyper_burst', 'hp250'],
      team: [
        { ...w('Stormcrow', 'Electric', 'Bird', ['thunderstorm', 'thunder_fang'], ['hp100', 'hp100']), level: 13 },
        { ...w('Magmaw', 'Fire', 'Beast', ['inferno_crash', 'flame_wheel', 'body_slam'], ['hp250']), level: 13 },
        { ...w('Leviadon', 'Water', 'Shell', ['tsunami_blast', 'aqua_jet', 'mend'], ['hp250', 'hp100']), level: 14 },
      ],
    },
  ];

  const STARTER_CARDS = ['tackle', 'ember', 'splash_shot', 'leaf_flick', 'hp30', 'hp30'];

  return {
    ELEMENTS, SHAPES, CARDS, TIER_NAMES, MAX_MOVES, MAX_HP_CARDS, MAX_PARTY,
    MAP, SOLID, ZONE_OF, START, PROFESSOR, CHESTS, WILD, TRAINERS, STARTER_CARDS,
    effectiveness, cardDesc, maxHp, stats, create, xpToNext, xpYield, gainXp,
    useMove, pickMove, genWild, rollDrop,
  };
})();
if (typeof module !== 'undefined') module.exports = CM;
