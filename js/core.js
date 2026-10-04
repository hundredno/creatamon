// Creatamon core: cards, creatures and battle rules. No DOM in here so it can be tested under node.
const CM = (() => {
  const ELEMENTS = {
    Normal: { color: '#cfc6b4', dark: '#7d7462' },
    Fire: { color: '#f47a45', dark: '#a23a14' },
    Water: { color: '#55a8ee', dark: '#1f5f9e' },
    Grass: { color: '#72cc5c', dark: '#2f7a2c' },
    Electric: { color: '#f6d643', dark: '#a08312' },
    Rock: { color: '#b39474', dark: '#6a5038' },
    Ice: { color: '#9fe3ef', dark: '#3d8ea0' },
    Shadow: { color: '#8a78bd', dark: '#33284f' },
    Wind: { color: '#b4e6c6', dark: '#4a9474' },
    Metal: { color: '#b9c0cc', dark: '#566070' },
    Mind: { color: '#f29ad0', dark: '#9c3a78' },
    // Not selectable in the Forge; only the secret cards use it.
    Cursed: { color: '#9b3fd6', dark: '#3d0f5e', hidden: true },
  };
  const STRONG = {
    Normal: [], Fire: ['Grass', 'Ice', 'Metal'], Water: ['Fire', 'Rock'], Grass: ['Water', 'Rock'],
    Electric: ['Water', 'Shadow', 'Wind'], Rock: ['Fire', 'Electric', 'Ice'], Ice: ['Grass', 'Wind'],
    Shadow: ['Shadow', 'Normal', 'Mind'], Wind: ['Grass', 'Fire'], Metal: ['Ice', 'Rock'], Mind: ['Normal', 'Wind'], Cursed: [],
  };
  const WEAK = {
    Normal: ['Shadow', 'Metal'], Fire: ['Fire', 'Water', 'Rock'], Water: ['Water', 'Grass'], Grass: ['Grass', 'Fire', 'Metal'],
    Electric: ['Electric', 'Grass', 'Rock'], Rock: ['Rock', 'Grass', 'Metal'], Ice: ['Ice', 'Fire', 'Water', 'Metal'],
    Shadow: ['Rock'], Wind: ['Wind', 'Rock', 'Metal'], Metal: ['Metal', 'Fire', 'Water', 'Electric'],
    Mind: ['Mind', 'Shadow', 'Metal'], Cursed: [],
  };
  const effectiveness = (att, def) => (STRONG[att].includes(def) ? 2 : WEAK[att].includes(def) ? 0.5 : 1);

  const SHAPES = {
    Blob: { atk: 10, def: 10, spd: 10, hint: 'Balanced' },
    Beast: { atk: 12, def: 9, spd: 9, hint: 'Hits hard' },
    Bird: { atk: 9, def: 8, spd: 13, hint: 'Strikes first' },
    Shell: { atk: 8, def: 13, spd: 7, hint: 'Tough' },
    Serpent: { atk: 11, def: 8, spd: 11, hint: 'Fast and fierce' },
    Bug: { atk: 9, def: 11, spd: 10, hint: 'Sturdy and steady' },
  };

  const TIER_NAMES = { 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Secret' };
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
    frost_nip: mv('Frost Nip', 1, 'Ice', 40),
    shade_jab: mv('Shade Jab', 1, 'Shadow', 40),
    gust: mv('Gust', 1, 'Wind', 40),
    rivet_toss: mv('Rivet Toss', 1, 'Metal', 40),
    brain_poke: mv('Brain Poke', 1, 'Mind', 40),
    hp30: hp('Vitality Shard', 1, 30),
    // Mid range
    flame_wheel: mv('Flame Wheel', 2, 'Fire', 65),
    aqua_jet: mv('Aqua Jet', 2, 'Water', 65),
    vine_lash: mv('Vine Lash', 2, 'Grass', 65),
    thunder_fang: mv('Thunder Fang', 2, 'Electric', 65),
    rock_slide: mv('Rock Slide', 2, 'Rock', 70, 90),
    ice_shard: mv('Ice Shard', 2, 'Ice', 65),
    night_claw: mv('Night Claw', 2, 'Shadow', 65),
    whirlwind: mv('Whirlwind', 2, 'Wind', 65),
    iron_bash: mv('Iron Bash', 2, 'Metal', 70, 90),
    psy_wave: mv('Psy Wave', 2, 'Mind', 65),
    body_slam: mv('Body Slam', 2, 'Normal', 70),
    mend: { kind: 'move', name: 'Mend', tier: 2, element: 'Normal', power: 0, acc: 100, heal: 0.5 },
    hp100: hp('Vitality Core', 2, 100),
    // Field moves: also usable in the overworld. Key cards are never dropped by wild Creatamon.
    rock_smash: { ...mv('Rock Smash', 2, 'Rock', 55), key: true, field: 'Breaks cracked rocks' },
    surf: { ...mv('Surf', 2, 'Water', 80), key: true, field: 'Crosses water' },
    // High end
    tsunami_blast: mv('Tsunami Blast', 3, 'Water', 110, 85),
    inferno_crash: mv('Inferno Crash', 3, 'Fire', 110, 85),
    thunderstorm: mv('Thunderstorm', 3, 'Electric', 110, 85),
    earthshatter: mv('Earthshatter', 3, 'Rock', 110, 85),
    solar_bloom: mv('Solar Bloom', 3, 'Grass', 110, 85),
    blizzard: mv('Blizzard', 3, 'Ice', 110, 85),
    eclipse: mv('Eclipse', 3, 'Shadow', 110, 85),
    hurricane: mv('Hurricane', 3, 'Wind', 110, 85),
    titan_hammer: mv('Titan Hammer', 3, 'Metal', 110, 85),
    mind_break: mv('Mind Break', 3, 'Mind', 110, 85),
    hyper_burst: mv('Hyper Burst', 3, 'Normal', 120, 80),
    hp250: hp('Titan Heart', 3, 250),
    dawnblade: { ...mv('Dawnblade', 3, 'Normal', 130, 90), key: true },
    endless_ray: { ...mv('Endless Ray', 3, 'Shadow', 125, 90), key: true },
    // Secret (tier 4): never dropped, bound to the easter-egg Creatamon
    divergent_fist: mv('Divergent Fist', 4, 'Cursed', 70),
    dismantle: mv('Dismantle', 4, 'Cursed', 90),
    piercing_blood: mv('Piercing Blood', 4, 'Cursed', 105, 95),
    cleave: mv('Cleave', 4, 'Cursed', 130, 85),
    black_flash: mv('Black Flash', 4, 'Cursed', 160, 70),
    reverse_cursed: { kind: 'move', name: 'Reverse Cursed Technique', tier: 4, element: 'Cursed', power: 0, acc: 100, heal: 0.6 },
  };
  // A Shadow Beast named exactly this unlocks a special look and the secret cards.
  const EGG = {
    name: 'Modulo Yuji', element: 'Shadow', shape: 'Beast',
    moves: ['divergent_fist', 'dismantle', 'piercing_blood', 'cleave', 'black_flash', 'reverse_cursed'],
    // Its Max Mode form is someone else entirely.
    maxName: 'Sukuna',
    maxMoves: [
      { kind: 'move', name: 'Dismantle', element: 'Cursed', power: 140, acc: 100 },
      { kind: 'move', name: 'Cleave', element: 'Cursed', power: 190, acc: 100 },
      { kind: 'move', name: 'Divine Flame', element: 'Fire', power: 210, acc: 90 },
      { kind: 'move', name: 'Domain Expansion', element: 'Cursed', power: 0, acc: 100, domain: 8 },
      { kind: 'move', name: 'Reverse Cursed Technique', element: 'Cursed', power: 0, acc: 100, heal: 0.6 },
    ],
  };
  const isEgg = (c) => c.name.trim() === EGG.name && c.element === EGG.element && c.shape === EGG.shape;
  // The "custom infinity": attacks on the egg usually stop short and rebound on the attacker.
  const INFINITY_RATE = 0.9, INFINITY_DAMAGE = 100;
  // While a domain is open, its owner lands this on the foe every turn. It cannot miss.
  const DOMAIN_STRIKE = { kind: 'move', name: 'Malevolent Shrine', element: 'Cursed', power: 90, acc: 1000 };
  const cardDesc = (c) =>
    c.kind === 'hp' ? `+${c.amount} max HP`
      : c.domain ? `Sure-hit slashes for ${c.domain} turns`
      : c.heal ? `Restores ${c.heal * 100}% HP`
        : `${c.element} · Pow ${c.power} · Acc ${c.acc}%${c.field ? ` · ${c.field}` : ''}`;

  const MAX_PARTY = 6, BASE_HP = 50, CRIT_RATE = 1 / 16;

  // ---- Items ----
  // ball: spent to forge a new Creatamon. heal / revive: used from the Bag, in battle too.
  // held: one can be given to each Creatamon (atk: damage dealt, block: chance to nullify a hit,
  // crit: critical-hit chance, spd: speed bonus, regen: share of health restored each turn).
  const ITEMS = {
    creataball: { name: 'Creataball', ball: true, desc: 'Needed to forge a new Creatamon' },
    potion: { name: 'Potion', heal: 60, desc: 'Restores 60 HP' },
    super_potion: { name: 'Super Potion', heal: 200, desc: 'Restores 200 HP' },
    max_potion: { name: 'Max Potion', heal: 9999, desc: 'Restores all HP' },
    revive: { name: 'Revive', revive: true, desc: 'Wakes a fainted Creatamon at half HP' },
    gloves: { name: 'Punching Gloves', held: true, atk: 1.2, desc: 'Holder\'s attacks deal 20% more damage' },
    shield: { name: 'Guard Shield', held: true, block: 0.3, desc: '30% chance to nullify a hit on the holder' },
    charm: { name: 'Lucky Charm', held: true, crit: 0.25, desc: 'Holder lands critical hits far more often' },
    boots: { name: 'Swift Boots', held: true, spd: 6, desc: 'Holder is much faster' },
    leaf: { name: 'Mending Leaf', held: true, regen: 1 / 12, desc: 'Holder recovers a little HP every turn' },
  };
  const held = (c) => (c.item && ITEMS[c.item]) || {};

  // ---- Evolution ----
  // A Creatamon can evolve twice. Each stage builds in free health and makes every attack hit harder.
  const EVOLVE_AT = [16, 36], STAGE_HP = [0, 60, 160], STAGE_DMG = [1, 1.15, 1.3];
  const STAGE_NAMES = ['Basic', 'Evolved', 'Final form'];
  const canEvolve = (c) => (c.stage || 0) < 2 && c.level >= EVOLVE_AT[c.stage || 0];
  const evolve = (c) => {
    const before = STAGE_HP[c.stage || 0];
    c.stage = (c.stage || 0) + 1;
    c.hp += STAGE_HP[c.stage] - before;
  };

  // ---- Creatures ----
  const MAX_BOOST = 1.5;
  const maxHp = (c) => Math.round((BASE_HP + 6 * (c.level - 1) + STAGE_HP[c.stage || 0]
    + c.hpCards.reduce((s, id) => s + CARDS[id].amount, 0)) * (c.max ? MAX_BOOST : 1));
  // Max Mode (c.max) lasts for one battle: half again the health, and every attack becomes a Max move.
  const setMax = (c, on) => {
    if (!!c.max === on) return;
    const f = c.hp / maxHp(c);
    c.max = on;
    if (!on) delete c.max;
    c.hp = c.hp > 0 ? Math.max(1, Math.round(maxHp(c) * f)) : 0;
  };
  const MAX_NAMES = {
    Normal: 'Max Strike', Fire: 'Max Flare', Water: 'Max Geyser', Grass: 'Max Overgrowth', Electric: 'Max Lightning',
    Rock: 'Max Rockfall', Ice: 'Max Hailstorm', Shadow: 'Max Darkness', Wind: 'Max Tempest', Metal: 'Max Steelstrike',
    Mind: 'Max Mindstorm', Cursed: 'Max Curse',
  };
  // The moves a Creatamon can use right now, as move objects.
  const battleMoves = (c) => {
    const moves = c.moves.map((id) => CARDS[id]);
    if (!c.max) return moves;
    if (isEgg(c)) return EGG.maxMoves;
    const best = {};
    moves.filter((m) => !m.heal).forEach((m) => { if (!best[m.element] || m.power > best[m.element].power) best[m.element] = m; });
    return [
      ...Object.values(best).map((m) => ({ kind: 'move', name: MAX_NAMES[m.element], element: m.element, power: Math.round(m.power * 1.5) + 20, acc: 100 })),
      ...moves.filter((m) => m.heal),
    ];
  };
  const stats = (c) => {
    const s = SHAPES[c.shape], g = c.level - 1;
    return { atk: s.atk + g, def: s.def + g, spd: s.spd + g + (held(c).spd || 0) };
  };
  const create = (spec) => {
    const c = {
      name: spec.name, element: spec.element, shape: spec.shape,
      moves: [...spec.moves], hpCards: [...(spec.hpCards || [])],
      level: spec.level || 1, xp: 0, art: spec.art || null, stage: spec.stage || 0, item: spec.item || null,
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
  // Mutates hp. Returns {miss} | {heal} | {domain} | {infinity} | {blocked} | {dmg, eff, crit}.
  const useMove = (att, def, move, rng = Math.random) => {
    if (rng() * 100 >= move.acc) return { miss: true };
    if (move.heal) {
      const heal = Math.min(maxHp(att) - att.hp, Math.round(maxHp(att) * move.heal));
      att.hp += heal;
      return { heal };
    }
    if (move.domain) return { domain: move.domain };
    if (isEgg(def) && rng() < INFINITY_RATE) {
      att.hp = Math.max(0, att.hp - INFINITY_DAMAGE);
      return { infinity: INFINITY_DAMAGE };
    }
    const eff = effectiveness(move.element, def.element);
    const stab = move.element === att.element ? 1.25 : 1;
    const ratio = stats(att).atk / stats(def).def;
    const scale = 0.4 + 0.06 * att.level;
    const roll = 0.85 + rng() * 0.15;
    const crit = rng() < (held(att).crit || CRIT_RATE);
    if (held(def).block && rng() < held(def).block) return { blocked: true };
    const boost = STAGE_DMG[att.stage || 0] * (held(att).atk || 1);
    const dmg = Math.max(1, Math.round(move.power * ratio * scale * stab * eff * roll * boost * (crit ? 1.5 : 1)));
    def.hp = Math.max(0, def.hp - dmg);
    return { dmg, eff, crit };
  };
  // The move (object) a computer-run Creatamon uses.
  const pickMove = (foe, target, rng = Math.random) => {
    const moves = battleMoves(foe);
    const heals = moves.filter((m) => m.heal);
    const attacks = moves.filter((m) => !m.heal);
    if (heals.length && foe.hp < maxHp(foe) * 0.35 && rng() < 0.5) return heals[0];
    const pool = attacks.length ? attacks : moves;
    if (rng() < 0.6) {
      const score = (m) => {
        return m.power * m.acc * effectiveness(m.element, target.element) * (m.element === foe.element ? 1.25 : 1);
      };
      return pool.reduce((best, m) => (score(m) > score(best) ? m : best));
    }
    return pool[Math.floor(rng() * pool.length)];
  };

  // ---- Clothes ----
  // What the player can wear. Locked pieces are found in chests or won from trainers;
  // fixed pieces keep their own colours instead of taking the player's pick.
  const cl = (slot, name, flags = '') => ({ slot, name, locked: flags.includes('L'), fixed: flags.includes('F') });
  const CLOTHES = {
    none: cl('hat', 'No hat', 'F'),
    cap: cl('hat', 'Cap'),
    beanie: cl('hat', 'Beanie'),
    bow: cl('hat', 'Bow'),
    straw_hat: cl('hat', 'Straw Hat', 'LF'),
    wizard_hat: cl('hat', 'Wizard Hat', 'LF'),
    ranger_hat: cl('hat', 'Ranger Hat', 'LF'),
    miner_helmet: cl('hat', 'Miner Helmet', 'LF'),
    crown: cl('hat', 'Champion Crown', 'LF'),
    tophat: cl('hat', 'Top Hat'),
    headband: cl('hat', 'Headband'),
    bucket: cl('hat', 'Bucket Hat'),
    visor: cl('hat', 'Visor'),
    headphones: cl('hat', 'Headphones'),
    flower_crown: cl('hat', 'Flower Crown', 'F'),
    cat_ears: cl('hat', 'Cat Ears', 'L'),
    pirate: cl('hat', 'Pirate Hat', 'LF'),
    halo: cl('hat', 'Halo', 'LF'),
    tee: cl('top', 'T-Shirt'),
    stripes: cl('top', 'Striped Shirt'),
    hoodie: cl('top', 'Hoodie'),
    dress: cl('top', 'Dress'),
    jersey: cl('top', 'Challenger Jersey', 'L'),
    varsity: cl('top', 'Varsity Jacket', 'L'),
    scout_vest: cl('top', 'Scout Vest', 'LF'),
    champion_cape: cl('top', 'Champion Cape', 'L'),
    tank: cl('top', 'Tank Top'),
    polka: cl('top', 'Polka Shirt'),
    overalls: cl('top', 'Overalls'),
    suit: cl('top', 'Suit'),
    poncho: cl('top', 'Poncho'),
    puffer: cl('top', 'Puffer Jacket'),
    kimono: cl('top', 'Kimono'),
    labcoat: cl('top', 'Lab Coat', 'F'),
    pants: cl('bottom', 'Trousers'),
    shorts: cl('bottom', 'Shorts'),
    skirt: cl('bottom', 'Skirt'),
    jeans: cl('bottom', 'Jeans'),
    leggings: cl('bottom', 'Leggings'),
    joggers: cl('bottom', 'Joggers'),
    cargo: cl('bottom', 'Cargo Shorts'),
    long_skirt: cl('bottom', 'Long Skirt'),
  };

  // ---- Species ----
  const SPECIES = {};
  const sp = (name, element, shape, moves, hpCards = []) => { SPECIES[name] = { name, element, shape, moves, hpCards }; };
  sp('Fluffin', 'Normal', 'Blob', ['tackle']);
  sp('Emberpup', 'Fire', 'Beast', ['ember', 'tackle']);
  sp('Puddlit', 'Water', 'Blob', ['splash_shot']);
  sp('Sproutle', 'Grass', 'Blob', ['leaf_flick', 'tackle']);
  sp('Chirple', 'Normal', 'Bird', ['scratch']);
  sp('Pebblit', 'Rock', 'Shell', ['pebble_toss']);
  sp('Slitherling', 'Grass', 'Serpent', ['leaf_flick', 'scratch']);
  sp('Voltmite', 'Electric', 'Bug', ['spark', 'tackle'], ['hp30']);
  sp('Zapwing', 'Electric', 'Bird', ['spark', 'scratch'], ['hp30']);
  sp('Thornback', 'Grass', 'Shell', ['vine_lash', 'leaf_flick'], ['hp30']);
  sp('Cinderfox', 'Fire', 'Beast', ['flame_wheel', 'scratch'], ['hp30']);
  sp('Mossowl', 'Grass', 'Bird', ['leaf_flick', 'scratch'], ['hp30']);
  sp('Barkadder', 'Grass', 'Serpent', ['vine_lash', 'scratch'], ['hp30']);
  sp('Gloomoth', 'Shadow', 'Bug', ['shade_jab', 'scratch'], ['hp30']);
  sp('Antlerox', 'Normal', 'Beast', ['body_slam', 'tackle'], ['hp30']);
  sp('Frostfinch', 'Ice', 'Bird', ['frost_nip', 'scratch'], ['hp30']);
  sp('Duskfang', 'Shadow', 'Beast', ['night_claw', 'shade_jab'], ['hp100']);
  sp('Boulderon', 'Rock', 'Shell', ['rock_slide', 'pebble_toss'], ['hp100']);
  sp('Tidewyrm', 'Water', 'Beast', ['aqua_jet', 'splash_shot'], ['hp100']);
  sp('Stormcrow', 'Electric', 'Bird', ['thunder_fang', 'spark'], ['hp30', 'hp30']);
  sp('Gravlet', 'Rock', 'Blob', ['pebble_toss', 'body_slam'], ['hp100']);
  sp('Echobat', 'Shadow', 'Bird', ['night_claw', 'shade_jab'], ['hp30', 'hp30']);
  sp('Stoneviper', 'Rock', 'Serpent', ['rock_slide', 'scratch'], ['hp100']);
  sp('Magmite', 'Fire', 'Bug', ['flame_wheel', 'ember'], ['hp100']);
  sp('Glimmershell', 'Ice', 'Shell', ['ice_shard', 'frost_nip'], ['hp100']);
  sp('Cavernking', 'Rock', 'Beast', ['earthshatter', 'body_slam'], ['hp100', 'hp100']);
  sp('Buzzlebee', 'Electric', 'Bug', ['spark', 'tackle']);
  sp('Petalwing', 'Grass', 'Bird', ['leaf_flick', 'scratch']);
  sp('Ladybop', 'Fire', 'Bug', ['ember', 'scratch']);
  sp('Nectarslug', 'Water', 'Blob', ['splash_shot', 'tackle'], ['hp30']);
  sp('Honeycub', 'Normal', 'Beast', ['scratch', 'tackle'], ['hp30']);
  sp('Dewsnake', 'Water', 'Serpent', ['splash_shot', 'scratch'], ['hp30']);
  sp('Bloomoth', 'Grass', 'Bug', ['vine_lash', 'leaf_flick'], ['hp30', 'hp30']);
  sp('Crystalisk', 'Ice', 'Serpent', ['ice_shard', 'frost_nip'], ['hp100']);
  sp('Frostmaw', 'Ice', 'Beast', ['ice_shard', 'body_slam'], ['hp100', 'hp100']);
  sp('Voidling', 'Shadow', 'Blob', ['night_claw', 'mend'], ['hp100']);
  sp('Shardwing', 'Rock', 'Bird', ['rock_slide', 'thunder_fang'], ['hp100']);
  sp('Prismite', 'Electric', 'Bug', ['thunder_fang', 'ice_shard'], ['hp100']);
  sp('Glacierback', 'Ice', 'Shell', ['blizzard', 'ice_shard'], ['hp250']);
  sp('Umbrawyrm', 'Shadow', 'Serpent', ['eclipse', 'night_claw'], ['hp250']);
  sp('Gullwave', 'Water', 'Bird', ['splash_shot', 'scratch']);
  sp('Rivermaw', 'Water', 'Beast', ['aqua_jet', 'body_slam'], ['hp100']);
  sp('Snowpuff', 'Ice', 'Blob', ['frost_nip', 'tackle']);
  sp('Breezlet', 'Wind', 'Bird', ['gust', 'scratch']);
  sp('Gustail', 'Wind', 'Serpent', ['gust', 'tackle']);
  sp('Zephyrfox', 'Wind', 'Beast', ['whirlwind', 'scratch'], ['hp30']);
  sp('Stormkite', 'Wind', 'Bird', ['hurricane', 'whirlwind'], ['hp100']);
  sp('Boltnut', 'Metal', 'Bug', ['rivet_toss', 'tackle']);
  sp('Cogshell', 'Metal', 'Shell', ['rivet_toss', 'tackle'], ['hp30']);
  sp('Ironclaw', 'Metal', 'Beast', ['iron_bash', 'scratch'], ['hp100']);
  sp('Anviltusk', 'Metal', 'Beast', ['titan_hammer', 'iron_bash'], ['hp250']);
  sp('Dreamote', 'Mind', 'Blob', ['brain_poke']);
  sp('Thinkling', 'Mind', 'Bird', ['brain_poke', 'scratch']);
  sp('Mesmoth', 'Mind', 'Bug', ['psy_wave', 'brain_poke'], ['hp30']);
  sp('Oraclynx', 'Mind', 'Beast', ['mind_break', 'psy_wave'], ['hp100']);
  // Only trainers have these.
  sp('Magmaw', 'Fire', 'Beast', ['flame_wheel', 'body_slam'], ['hp100']);
  sp('Leviadon', 'Water', 'Shell', ['aqua_jet', 'mend'], ['hp100']);
  sp('Nightshade', 'Shadow', 'Serpent', ['night_claw', 'shade_jab'], ['hp100']);
  sp('Grizzlord', 'Normal', 'Beast', ['body_slam', 'scratch'], ['hp100']);
  sp('Fluffalo', 'Normal', 'Blob', ['body_slam', 'mend'], ['hp100']);
  sp('Skylord', 'Normal', 'Bird', ['body_slam', 'scratch'], ['hp100']);
  sp('Regalion', 'Normal', 'Beast', ['hyper_burst', 'body_slam'], ['hp250']);
  sp('Pyreking', 'Fire', 'Bird', ['inferno_crash', 'flame_wheel'], ['hp250']);
  sp('Ironhide', 'Rock', 'Shell', ['earthshatter', 'rock_slide'], ['hp250']);
  sp('Eternox', 'Shadow', 'Serpent', ['endless_ray', 'eclipse', 'night_claw'], ['hp250', 'hp250']);

  // Wild habitats, picked by the tile underfoot: [species, weight] with 4 common, 2 uncommon, 1 rare.
  // 1 meadow  2 forest  3 cave  4 flowers  5 crystals  6 water  7 snow
  const ZONE_OF = { ',': 1, ';': 2, ':': 3, '*': 4, '!': 5, '~': 6, '"': 7 };
  const WILD = {
    1: [['Fluffin', 4], ['Emberpup', 4], ['Puddlit', 4], ['Sproutle', 4], ['Chirple', 4], ['Breezlet', 4], ['Pebblit', 2], ['Slitherling', 2], ['Dreamote', 2], ['Voltmite', 1]],
    2: [['Zapwing', 4], ['Thornback', 4], ['Cinderfox', 4], ['Mossowl', 4], ['Barkadder', 4], ['Gloomoth', 4], ['Antlerox', 2], ['Frostfinch', 2], ['Thinkling', 2], ['Zephyrfox', 2], ['Duskfang', 1]],
    3: [['Boulderon', 4], ['Tidewyrm', 4], ['Stormcrow', 4], ['Gravlet', 4], ['Echobat', 4], ['Stoneviper', 4], ['Boltnut', 4], ['Cogshell', 4], ['Magmite', 2], ['Glimmershell', 2], ['Ironclaw', 2], ['Cavernking', 1]],
    4: [['Buzzlebee', 4], ['Petalwing', 4], ['Ladybop', 4], ['Nectarslug', 4], ['Gustail', 4], ['Honeycub', 2], ['Dewsnake', 2], ['Mesmoth', 2], ['Bloomoth', 1]],
    5: [['Crystalisk', 4], ['Frostmaw', 4], ['Voidling', 4], ['Shardwing', 4], ['Prismite', 2], ['Glacierback', 1], ['Umbrawyrm', 1]],
    6: [['Puddlit', 4], ['Dewsnake', 4], ['Gullwave', 4], ['Tidewyrm', 2], ['Rivermaw', 1]],
    7: [['Snowpuff', 4], ['Frostfinch', 4], ['Glimmershell', 4], ['Crystalisk', 2], ['Frostmaw', 2], ['Stormkite', 2], ['Oraclynx', 1], ['Glacierback', 1]],
  };
  const DEX = Object.values(SPECIES).map((m) => ({ name: m.name, element: m.element }));

  const elementMove = (element, tier) => Object.keys(CARDS).find((id) => {
    const c = CARDS[id];
    return c.kind === 'move' && c.element === element && c.tier === tier && c.power && !c.key;
  });
  // A species at a level. Stronger moves and more health come with level, so one species suits any route.
  const spawn = (name, level, extra = []) => {
    const s = SPECIES[name], moves = [...s.moves];
    const add = (id) => { if (id && !moves.includes(id)) moves.push(id); };
    if (level >= 16) add(elementMove(s.element, 2));
    if (level >= 34) add(elementMove(s.element, 3));
    extra.forEach(add);
    const hpCards = [...s.hpCards, ...(level >= 14 ? ['hp100'] : []), ...(level >= 30 ? ['hp250'] : []), ...(level >= 44 ? ['hp250'] : [])];
    // They come already evolved for their level.
    const stage = level >= EVOLVE_AT[1] ? 2 : level >= EVOLVE_AT[0] ? 1 : 0;
    return create({ name, element: s.element, shape: s.shape, moves, hpCards, level, stage });
  };
  const randInt = (a, b, rng) => a + Math.floor(rng() * (b - a + 1));
  const genWild = (habitat, levels, rng = Math.random) => {
    const list = WILD[habitat];
    let r = rng() * list.reduce((sum, m) => sum + m[1], 0);
    const [name, weight] = list.find((m) => (r -= m[1]) < 0) || list[0];
    const c = spawn(name, randInt(levels[0], levels[1], rng));
    if (weight === 1) c.rare = true;
    return c;
  };
  // drops: percent chance of a [common, rare] card, the rest epic. Returns a card id or null. Rare Creatamon always drop (sure).
  const rollDrop = (drops, rng = Math.random, sure = false) => {
    if (!sure && rng() >= 0.5) return null;
    const [a, b] = drops;
    const r = rng() * 100;
    const tier = r < a ? 1 : r < a + b ? 2 : 3;
    const ids = Object.keys(CARDS).filter((id) => CARDS[id].tier === tier && !CARDS[id].key);
    return ids[Math.floor(rng() * ids.length)];
  };
  // Chance of a wild Creatamon per step in an encounter tile.
  const ENCOUNTER_RATE = 0.22;

  const STARTER_CARDS = ['tackle', 'ember', 'splash_shot', 'leaf_flick', 'hp30', 'hp30'];

  return {
    ELEMENTS, STRONG, SHAPES, CARDS, TIER_NAMES, EGG, MAX_PARTY, CLOTHES, SPECIES, DEX, WILD, ZONE_OF,
    STARTER_CARDS, ENCOUNTER_RATE,
    isEgg, setMax, battleMoves, DOMAIN_STRIKE, ITEMS, held, EVOLVE_AT, STAGE_NAMES, STAGE_DMG, STAGE_HP, canEvolve, evolve,
    effectiveness, cardDesc, maxHp, stats, create, xpToNext, xpYield, gainXp,
    useMove, pickMove, spawn, genWild, rollDrop,
  };
})();
if (typeof module !== 'undefined') module.exports = CM;
