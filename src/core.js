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
    Robot: { color: '#5fd0c5', dark: '#1f6f68' },
    Light: { color: '#fbf0b0', dark: '#b8962a' },
    Toxic: { color: '#a8d93f', dark: '#56751a' },
    // Not selectable in the Forge; only the secret cards use it.
    Cursed: { color: '#9b3fd6', dark: '#3d0f5e', hidden: true },
  };
  const STRONG = {
    Normal: [], Fire: ['Grass', 'Ice', 'Metal'], Water: ['Fire', 'Rock', 'Robot'], Grass: ['Water', 'Rock', 'Light'],
    Electric: ['Water', 'Shadow', 'Wind', 'Robot'], Rock: ['Fire', 'Electric', 'Ice'], Ice: ['Grass', 'Wind'],
    Shadow: ['Shadow', 'Normal', 'Mind'], Wind: ['Grass', 'Fire'], Metal: ['Ice', 'Rock'], Mind: ['Normal', 'Wind', 'Toxic'],
    Robot: ['Ice', 'Wind', 'Toxic'], Light: ['Shadow', 'Ice', 'Mind'], Toxic: ['Grass', 'Water', 'Normal'], Cursed: [],
  };
  const WEAK = {
    Normal: ['Shadow', 'Metal'], Fire: ['Fire', 'Water', 'Rock'], Water: ['Water', 'Grass'], Grass: ['Grass', 'Fire', 'Metal'],
    Electric: ['Electric', 'Grass', 'Rock'], Rock: ['Rock', 'Grass', 'Metal'], Ice: ['Ice', 'Fire', 'Water', 'Metal'],
    Shadow: ['Rock'], Wind: ['Wind', 'Rock', 'Metal'], Metal: ['Metal', 'Fire', 'Water', 'Electric'],
    Mind: ['Mind', 'Shadow', 'Metal'], Robot: ['Robot', 'Metal', 'Rock'], Light: ['Light', 'Grass', 'Metal'],
    Toxic: ['Toxic', 'Rock', 'Metal', 'Robot'], Cursed: [],
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

  // Secret cards sit apart from the five rarities: they are never found, only bound to the easter egg.
  const TIER_NAMES = { 1: 'Common', 2: 'Rare', 3: 'Epic', 4: 'Legendary', 5: 'Mythic', 6: 'Secret' };
  const SECRET = 6;
  const stars = (c) => (c.tier === SECRET ? '✦' : '★'.repeat(c.tier));
  const mv = (name, tier, element, power, acc = 100) => ({ kind: 'move', name, tier, element, power, acc });
  // A move that does more than hit. fx: first (strikes first), hits (strikes that many times; power is per hit),
  // drain / recoil (share of the damage dealt that the user regains / takes), crit (critical-hit chance),
  // up / down (stat stages raised on the user / lowered on the foe, e.g. {atk: 1}), inflict ('burn' | 'poison'),
  // chance (percent chance of up, down and inflict on a move that deals damage). Power 0 makes it a status move.
  const fx = (name, tier, element, power, acc, effects) => ({ ...mv(name, tier, element, power, acc), ...effects });
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
    gear_toss: mv('Gear Toss', 1, 'Robot', 40),
    glint: mv('Glint', 1, 'Light', 40),
    sludge_flick: mv('Sludge Flick', 1, 'Toxic', 40),
    quick_jab: fx('Quick Jab', 1, 'Normal', 30, 100, { first: true }),
    singe: fx('Singe', 1, 'Fire', 35, 100, { inflict: 'burn', chance: 30 }),
    bubble_volley: fx('Bubble Volley', 1, 'Water', 15, 100, { hits: 3 }),
    leech_sprout: fx('Leech Sprout', 1, 'Grass', 35, 100, { drain: 0.5 }),
    static_jolt: fx('Static Jolt', 1, 'Electric', 35, 100, { down: { spd: 1 }, chance: 30 }),
    stone_skin: fx('Stone Skin', 1, 'Rock', 0, 100, { up: { def: 1 } }),
    rime_needle: fx('Rime Needle', 1, 'Ice', 35, 100, { crit: 0.3 }),
    snarl: fx('Snarl', 1, 'Shadow', 0, 100, { down: { atk: 1 } }),
    updraft: fx('Updraft', 1, 'Wind', 0, 100, { up: { spd: 2 } }),
    twin_rivets: fx('Twin Rivets', 1, 'Metal', 22, 100, { hits: 2 }),
    unsettle: fx('Unsettle', 1, 'Mind', 0, 100, { down: { def: 1 } }),
    calibrate: fx('Calibrate', 1, 'Robot', 0, 100, { up: { atk: 1 } }),
    dazzle: fx('Dazzle', 1, 'Light', 35, 100, { down: { atk: 1 }, chance: 30 }),
    toxic_prick: fx('Toxic Prick', 1, 'Toxic', 30, 100, { inflict: 'poison', chance: 40 }),
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
    laser_beam: mv('Laser Beam', 2, 'Robot', 65),
    sunbeam: mv('Sunbeam', 2, 'Light', 65),
    venom_fang: mv('Venom Fang', 2, 'Toxic', 65),
    body_slam: mv('Body Slam', 2, 'Normal', 70),
    mend: { kind: 'move', name: 'Mend', tier: 2, element: 'Normal', power: 0, acc: 100, heal: 0.5 },
    fury_flurry: fx('Fury Flurry', 2, 'Normal', 25, 90, { hits: 3 }),
    kindle: fx('Kindle', 2, 'Fire', 0, 100, { up: { atk: 2 } }),
    undertow: fx('Undertow', 2, 'Water', 60, 100, { drain: 0.5 }),
    spore_cloud: fx('Spore Cloud', 2, 'Grass', 0, 100, { down: { atk: 1, spd: 1 } }),
    volt_dash: fx('Volt Dash', 2, 'Electric', 50, 100, { first: true }),
    pebble_storm: fx('Pebble Storm', 2, 'Rock', 20, 90, { hits: 4 }),
    frostbite: fx('Frostbite', 2, 'Ice', 55, 100, { down: { spd: 1 }, chance: 50 }),
    ambush: fx('Ambush', 2, 'Shadow', 55, 100, { crit: 0.5 }),
    slipstream: fx('Slipstream', 2, 'Wind', 55, 100, { up: { spd: 1 } }),
    iron_wall: fx('Iron Wall', 2, 'Metal', 0, 100, { up: { def: 2 } }),
    meditate: fx('Meditate', 2, 'Mind', 0, 100, { up: { atk: 1, def: 1 } }),
    piston_punch: fx('Piston Punch', 2, 'Robot', 80, 95, { recoil: 0.25 }),
    halo_strike: fx('Halo Strike', 2, 'Light', 55, 100, { drain: 0.5 }),
    noxious_fumes: fx('Noxious Fumes', 2, 'Toxic', 0, 90, { inflict: 'poison' }),
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
    overclock: mv('Overclock Cannon', 3, 'Robot', 110, 85),
    supernova: mv('Supernova', 3, 'Light', 110, 85),
    toxic_tide: mv('Toxic Tide', 3, 'Toxic', 110, 85),
    hyper_burst: mv('Hyper Burst', 3, 'Normal', 120, 80),
    rally_cry: fx('Rally Cry', 3, 'Normal', 0, 100, { up: { atk: 1, def: 1, spd: 1 } }),
    wildfire: fx('Wildfire', 3, 'Fire', 95, 90, { inflict: 'burn', chance: 50 }),
    riptide_barrage: fx('Riptide Barrage', 3, 'Water', 40, 90, { hits: 3 }),
    lifebloom: fx('Lifebloom', 3, 'Grass', 80, 100, { drain: 0.75 }),
    chain_lightning: fx('Chain Lightning', 3, 'Electric', 35, 95, { hits: 3 }),
    boulder_crash: fx('Boulder Crash', 3, 'Rock', 140, 85, { recoil: 0.33 }),
    glacial_lance: fx('Glacial Lance', 3, 'Ice', 95, 95, { crit: 0.5 }),
    soul_siphon: fx('Soul Siphon', 3, 'Shadow', 85, 100, { drain: 0.5 }),
    gale_flurry: fx('Gale Flurry', 3, 'Wind', 30, 90, { hits: 4 }),
    bulwark_bash: fx('Bulwark Bash', 3, 'Metal', 95, 95, { up: { def: 1 } }),
    psy_lance: fx('Psy Lance', 3, 'Mind', 95, 95, { down: { def: 1 }, chance: 50 }),
    missile_swarm: fx('Missile Swarm', 3, 'Robot', 25, 90, { hits: 5 }),
    searing_halo: fx('Searing Halo', 3, 'Light', 90, 95, { down: { atk: 1 }, chance: 50 }),
    acid_deluge: fx('Acid Deluge', 3, 'Toxic', 95, 90, { inflict: 'poison', chance: 50 }),
    hp250: hp('Titan Heart', 3, 250),
    dawnblade: { ...mv('Dawnblade', 3, 'Normal', 130, 90), key: true },
    endless_ray: { ...mv('Endless Ray', 3, 'Shadow', 125, 90), key: true },
    // Legendary: dropped by alphas and the last routes, and sold late in the game
    stampede: fx('Stampede', 4, 'Normal', 40, 90, { hits: 4 }),
    phoenix_dive: fx('Phoenix Dive', 4, 'Fire', 140, 95, { recoil: 0.25, inflict: 'burn', chance: 30 }),
    maelstrom: fx('Maelstrom', 4, 'Water', 130, 95, { up: { spd: 1 } }),
    verdant_wrath: fx('Verdant Wrath', 4, 'Grass', 130, 95, { drain: 0.5 }),
    railgun: fx('Railgun', 4, 'Electric', 140, 90, { crit: 0.3 }),
    mountain_breaker: fx('Mountain Breaker', 4, 'Rock', 135, 90, { up: { def: 1 } }),
    absolute_zero: fx('Absolute Zero', 4, 'Ice', 130, 90, { down: { spd: 1 } }),
    nightfall: fx('Nightfall', 4, 'Shadow', 130, 90, { down: { atk: 1 } }),
    jetstream_lance: fx('Jetstream Lance', 4, 'Wind', 110, 100, { first: true }),
    meteor_hammer: fx('Meteor Hammer', 4, 'Metal', 165, 85, { recoil: 0.33 }),
    thought_shatter: fx('Thought Shatter', 4, 'Mind', 130, 95, { down: { def: 1 } }),
    omega_cannon: fx('Omega Cannon', 4, 'Robot', 135, 90, { up: { atk: 1 } }),
    judgement_ray: fx('Judgement Ray', 4, 'Light', 130, 95, { drain: 0.33 }),
    caustic_ruin: fx('Caustic Ruin', 4, 'Toxic', 130, 90, { inflict: 'poison', down: { def: 1 }, chance: 40 }),
    hp400: hp('Colossus Heart', 4, 400),
    // Mythic: only alphas (once you are Champion) and the Champion himself give these
    genesis_strike: fx('Genesis Strike', 5, 'Normal', 150, 100, { first: true }),
    worldfire: fx('Worldfire', 5, 'Fire', 160, 95, { inflict: 'burn', chance: 50 }),
    abyssal_deluge: fx('Abyssal Deluge', 5, 'Water', 45, 100, { hits: 4 }),
    worldroot_surge: fx('Worldroot Surge', 5, 'Grass', 140, 100, { drain: 0.5, up: { def: 1 } }),
    storm_sovereign: fx('Storm Sovereign', 5, 'Electric', 160, 95, { crit: 0.3, down: { spd: 1 } }),
    primeval_quake: fx('Primeval Quake', 5, 'Rock', 160, 95, { down: { def: 1 } }),
    eternal_winter: fx('Eternal Winter', 5, 'Ice', 150, 100, { crit: 0.5, down: { spd: 1 } }),
    void_requiem: fx('Void Requiem', 5, 'Shadow', 150, 100, { drain: 0.5, crit: 0.3 }),
    skyrend_tempest: fx('Skyrend Tempest', 5, 'Wind', 150, 100, { crit: 0.3, up: { spd: 1 } }),
    starforged_blade: fx('Starforged Blade', 5, 'Metal', 160, 95, { up: { atk: 1, def: 1 } }),
    astral_dominion: fx('Astral Dominion', 5, 'Mind', 150, 100, { down: { atk: 1, def: 1 } }),
    singularity_engine: fx('Singularity Engine', 5, 'Robot', 160, 95, { up: { atk: 1, spd: 1 } }),
    celestial_dawn: fx('Celestial Dawn', 5, 'Light', 140, 100, { drain: 0.5, down: { atk: 1 } }),
    miasmic_doom: fx('Miasmic Doom', 5, 'Toxic', 150, 100, { inflict: 'poison', down: { def: 1 } }),
    hp600: hp('Eternal Heart', 5, 600),
    // Secret: never dropped, bound to the easter-egg Creatamon
    divergent_fist: mv('Divergent Fist', SECRET, 'Cursed', 70),
    dismantle: mv('Dismantle', SECRET, 'Cursed', 90),
    piercing_blood: mv('Piercing Blood', SECRET, 'Cursed', 105, 95),
    cleave: mv('Cleave', SECRET, 'Cursed', 130, 85),
    black_flash: mv('Black Flash', SECRET, 'Cursed', 160, 70),
    reverse_cursed: { kind: 'move', name: 'Reverse Cursed Technique', tier: SECRET, element: 'Cursed', power: 0, acc: 100, heal: 0.6 },
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
  const STAT_TAGS = { atk: 'ATK', def: 'DEF', spd: 'SPD' };
  // {atk: 1, def: 1} -> "ATK/DEF+1"
  const stagesText = (by, sign) => {
    const ks = Object.keys(by);
    return ks.every((k) => by[k] === by[ks[0]]) ? `${ks.map((k) => STAT_TAGS[k]).join('/')}${sign}${by[ks[0]]}`
      : ks.map((k) => `${STAT_TAGS[k]}${sign}${by[k]}`).join(' ');
  };
  const effectText = (c) => {
    const pct = (f) => `${Math.round(f * 100)}%`;
    const extra = [c.inflict && (c.inflict === 'burn' ? 'Burns' : 'Poisons'), c.up && `Self ${stagesText(c.up, '+')}`,
      c.down && `Foe ${stagesText(c.down, '−')}`].filter(Boolean).join(', ');
    return [c.first && 'Strikes first', c.drain && `Drains ${pct(c.drain)}`, c.recoil && `Recoil ${pct(c.recoil)}`,
      c.crit && `Crit ${pct(c.crit)}`, extra && (c.chance ? `${extra} (${c.chance}%)` : extra)].filter(Boolean).join(' · ');
  };
  const cardDesc = (c) =>
    c.kind === 'hp' ? `+${c.amount} max HP`
      : c.domain ? `Sure-hit slashes for ${c.domain} turns`
      : c.heal ? `Restores ${c.heal * 100}% HP`
      : !c.power ? `${c.element}${c.acc < 100 ? ` · Acc ${c.acc}%` : ''} · ${effectText(c)}`
        : `${c.element} · Pow ${c.power}${c.hits ? `×${c.hits}` : ''} · Acc ${c.acc}%${c.field ? ` · ${c.field}` : ''}${effectText(c) ? ` · ${effectText(c)}` : ''}`;

  const MAX_PARTY = 6, BASE_HP = 50, CRIT_RATE = 1 / 16;

  // ---- Items ----
  // ball: spent to forge a new Creatamon. heal / revive: used from the Bag, in battle too.
  // held: one can be given to each Creatamon (atk: damage dealt, block: chance to nullify a hit,
  // crit: critical-hit chance, spd: speed bonus, regen: share of health restored each turn).
  const ITEMS = {
    creataball: { name: 'Creataball', ball: true, price: 300, desc: 'Needed to forge or rebuild a Creatamon' },
    potion: { name: 'Potion', heal: 60, price: 60, desc: 'Restores 60 HP' },
    super_potion: { name: 'Super Potion', heal: 200, price: 200, need: 3, desc: 'Restores 200 HP' },
    max_potion: { name: 'Max Potion', heal: 9999, price: 600, need: 7, desc: 'Restores all HP' },
    revive: { name: 'Revive', revive: true, price: 400, need: 2, desc: 'Wakes a fainted Creatamon at half HP' },
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
    Mind: 'Max Mindstorm', Robot: 'Max Overdrive', Light: 'Max Radiance', Toxic: 'Max Miasma', Cursed: 'Max Curse',
  };
  // The moves a Creatamon can use right now, as move objects.
  const battleMoves = (c) => {
    const moves = c.moves.map((id) => CARDS[id]);
    if (!c.max) return moves;
    if (isEgg(c)) return EGG.maxMoves;
    // Each element's strongest attack, by its total over all hits, becomes a Max move. Heals and status moves stay as they are.
    const best = {}, total = (m) => m.power * (m.hits || 1);
    moves.filter((m) => m.power).forEach((m) => { if (!best[m.element] || total(m) > total(best[m.element])) best[m.element] = m; });
    return [
      ...Object.values(best).map((m) => ({ kind: 'move', name: MAX_NAMES[m.element], element: m.element, power: Math.round(total(m) * 1.5) + 20, acc: 100 })),
      ...moves.filter((m) => !m.power),
    ];
  };
  // ---- Stat stages, burns and poison ----
  // Moves can raise or lower a stat by stages, up to three either way: each stage up is +25%, each one down the
  // reverse. Stages, burns and poison all last only while the Creatamon stays in the battle.
  const STAGE_STEP = 0.25, STAGE_CAP = 3, STATUS_DAMAGE = 1 / 10;
  const STATUS_NAMES = { burn: 'burned', poison: 'poisoned' };
  const stage = (c, k) => (c.boost && c.boost[k]) || 0;
  const stageMul = (n) => (n >= 0 ? 1 + STAGE_STEP * n : 1 / (1 - STAGE_STEP * n));
  // Moves c's stages by `by` ({atk: 1, ...}) times sign. Returns how far each one really moved (0 at the cap).
  const shift = (c, by, sign) => {
    const moved = {};
    for (const k of Object.keys(by)) {
      const was = stage(c, k), now = Math.max(-STAGE_CAP, Math.min(STAGE_CAP, was + sign * by[k]));
      moved[k] = now - was;
      if (now !== was) c.boost = { ...c.boost, [k]: now };
    }
    return moved;
  };
  // Leaving the battle (switched out, fainted, or the battle is over) clears stages and status.
  const calm = (c) => { delete c.boost; delete c.status; };
  // Burn and poison: the end-of-turn damage. Returns the HP lost.
  const statusTick = (c) => {
    const lost = Math.min(c.hp, Math.max(1, Math.round(maxHp(c) * STATUS_DAMAGE)));
    c.hp -= lost;
    return lost;
  };
  const stats = (c) => {
    const s = SHAPES[c.shape], g = c.level - 1;
    const st = { atk: s.atk + g, def: s.def + g, spd: s.spd + g + (held(c).spd || 0) };
    if (c.boost) Object.keys(st).forEach((k) => { st[k] *= stageMul(stage(c, k)); });
    return st;
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
  // ---- Limits that rise with each badge ----
  // A Creatamon will not grow past the level cap: a little above the next Leader's best, so no gym can be out-levelled.
  const LEVEL_CAPS = [11, 16, 21, 25, 29, 33, 37, 41, 45, 49, 51, 53, 55, 59, 76];
  const levelCap = (badges) => LEVEL_CAPS[Math.min(badges, LEVEL_CAPS.length - 1)];
  // How many move cards one Creatamon can hold. Bound secret cards do not take up a slot. Health cards have no limit.
  const MOVE_SLOTS = 6;
  // Returns number of levels gained. XP is not banked at the cap.
  const gainXp = (c, amount, cap = Infinity) => {
    let gained = 0;
    if (c.level >= cap) { c.xp = 0; return 0; }
    c.xp += amount;
    while (c.xp >= xpToNext(c.level)) {
      c.xp -= xpToNext(c.level);
      c.level++;
      c.hp += 6;
      gained++;
      if (c.level >= cap) { c.xp = 0; break; }
    }
    return gained;
  };

  // ---- Battle rules ----
  // Applies a move's stage changes and status to the user and foe, adding what happened to `out`:
  // up / down (how far each stat moved; 0 means it was already at the cap) and inflict (a status that took hold).
  const sideEffects = (att, def, move, out) => {
    if (move.up && att.hp > 0) out.up = shift(att, move.up, 1);
    if (def.hp <= 0) return out;
    if (move.down) out.down = shift(def, move.down, -1);
    if (move.inflict && !def.status) { def.status = move.inflict; out.inflict = move.inflict; }
    return out;
  };
  // Mutates hp, stages and status. Returns {miss} | {heal} | {domain} | {infinity} | {blocked} | {dmg, eff, crit},
  // where a hit can also carry hits (how many landed), drained, recoil, up, down and inflict. A status move returns
  // only its up / down / inflict, or {failed} when it changed nothing.
  const useMove = (att, def, move, rng = Math.random) => {
    if (rng() * 100 >= move.acc) return { miss: true };
    if (move.heal) {
      const heal = Math.min(maxHp(att) - att.hp, Math.round(maxHp(att) * move.heal));
      att.hp += heal;
      return { heal };
    }
    if (move.domain) return { domain: move.domain };
    const aimed = move.power || move.down || move.inflict;
    if (aimed && isEgg(def) && rng() < INFINITY_RATE) {
      att.hp = Math.max(0, att.hp - INFINITY_DAMAGE);
      return { infinity: INFINITY_DAMAGE };
    }
    if (!move.power) {
      const out = sideEffects(att, def, move, {});
      const moved = [out.up, out.down].some((m) => m && Object.values(m).some(Boolean));
      return moved || out.inflict ? out : { failed: true };
    }
    const eff = effectiveness(move.element, def.element);
    const stab = move.element === att.element ? 1.25 : 1;
    const ratio = stats(att).atk / stats(def).def;
    const scale = 0.4 + 0.06 * att.level;
    const critRate = Math.max(move.crit || 0, held(att).crit || CRIT_RATE);
    const roll = 0.85 + rng() * 0.15;
    const crit = rng() < critRate;
    if (held(def).block && rng() < held(def).block) return { blocked: true };
    const boost = STAGE_DMG[att.stage || 0] * (held(att).atk || 1);
    const strike = (r, c) => {
      const d = Math.max(1, Math.round(move.power * ratio * scale * stab * eff * r * boost * (c ? 1.5 : 1)));
      def.hp = Math.max(0, def.hp - d);
      return d;
    };
    const out = { dmg: strike(roll, crit), eff, crit };
    // Multi-hit moves keep striking until they run out of hits or the foe faints; each hit rolls its own damage.
    if (move.hits) {
      out.hits = 1;
      for (; out.hits < move.hits && def.hp > 0; out.hits++) {
        const r = 0.85 + rng() * 0.15, c = rng() < critRate;
        out.dmg += strike(r, c);
        out.crit = out.crit || c;
      }
    }
    if (move.drain) {
      out.drained = Math.min(maxHp(att) - att.hp, Math.max(1, Math.round(out.dmg * move.drain)));
      att.hp += out.drained;
    }
    if (move.recoil) {
      out.recoil = Math.min(att.hp, Math.max(1, Math.round(out.dmg * move.recoil)));
      att.hp -= out.recoil;
    }
    if ((move.up || move.down || move.inflict) && (!move.chance || rng() * 100 < move.chance)) sideEffects(att, def, move, out);
    return out;
  };
  // Whether a status move would still change anything.
  const worthUsing = (m, user, target) => (m.up && Object.keys(m.up).some((k) => stage(user, k) < STAGE_CAP))
    || (m.down && Object.keys(m.down).some((k) => stage(target, k) > -STAGE_CAP)) || (m.inflict && !target.status);
  // The move (object) a computer-run Creatamon uses.
  // skill: how often it picks its best move rather than a random one.
  const pickMove = (foe, target, rng = Math.random, skill = 0.6) => {
    const moves = battleMoves(foe);
    const heals = moves.filter((m) => m.heal);
    const attacks = moves.filter((m) => !m.heal);
    if (heals.length && foe.hp < maxHp(foe) * 0.35 && rng() < 0.5) return heals[0];
    const pool = attacks.length ? attacks : moves;
    if (rng() < skill) {
      // A status move is worth about a middling attack, as long as it would still change something.
      const score = (m) => {
        if (!m.power) return worthUsing(m, foe, target) ? 5000 : 0;
        return m.power * (m.hits || 1) * m.acc * effectiveness(m.element, target.element) * (m.element === foe.element ? 1.25 : 1);
      };
      return pool.reduce((best, m) => (score(m) > score(best) ? m : best));
    }
    return pool[Math.floor(rng() * pool.length)];
  };

  // ---- Clothes ----
  // What the player can wear. Locked pieces are found in chests or won from trainers;
  // fixed pieces keep their own colours instead of taking the player's pick.
  // sold pieces are bought at Creatastops. base: the shape it is cut from; mark: the design printed on it.
  const cl = (slot, name, flags = '', base = null, mark = null) => ({ slot, name, locked: flags.includes('L') || flags.includes('S'),
    fixed: flags.includes('F'), sold: flags.includes('S'), base, mark });
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
    // Hats sold at Creatastops
    party_hat: cl('hat', 'Party Hat', 'S'), bunny_ears: cl('hat', 'Bunny Ears', 'S'), horns: cl('hat', 'Little Horns', 'SF'),
    antenna: cl('hat', 'Antenna', 'SF'), chef_hat: cl('hat', 'Chef Hat', 'SF'), viking: cl('hat', 'Viking Helm', 'SF'),
    tiara: cl('hat', 'Tiara', 'SF'), propeller: cl('hat', 'Propeller Cap', 'S'), mushroom: cl('hat', 'Mushroom Cap', 'S'),
    santa: cl('hat', 'Winter Hat', 'SF'), feather: cl('hat', 'Feather Band', 'S'), goggles: cl('hat', 'Goggles', 'SF'),
    bandana: cl('hat', 'Bandana', 'S'), fez: cl('hat', 'Fez', 'SF'), sombrero: cl('hat', 'Sombrero', 'SF'), jester: cl('hat', 'Jester Hat', 'S'),
  };
  // The rest of the shop stock: familiar shapes with a design printed on them.
  const MARKS = { star: 'Star', heart: 'Heart', bolt: 'Bolt', flame: 'Flame', wave: 'Wave', leaf: 'Leaf', skull: 'Skull', rainbow: 'Rainbow', stripe: 'Racing', camo: 'Camo' };
  const printed = (slot, bases, marks) => bases.forEach((b) => marks.forEach((m) => {
    CLOTHES[`${b}_${m}`] = cl(slot, `${MARKS[m]} ${CLOTHES[b].name}`, 'S', b, m);
  }));
  printed('hat', ['cap', 'beanie', 'bucket', 'tophat', 'headband'], ['star', 'heart', 'bolt', 'flame']);
  printed('top', ['tee', 'hoodie', 'tank', 'puffer'], ['star', 'heart', 'bolt', 'flame', 'wave', 'leaf', 'skull', 'rainbow']);
  printed('bottom', ['pants', 'shorts', 'skirt', 'joggers'], ['stripe', 'flame', 'star', 'camo']);

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
  sp('Gearling', 'Robot', 'Blob', ['gear_toss', 'tackle'], ['hp30']);
  sp('Dronefly', 'Robot', 'Bird', ['gear_toss', 'spark'], ['hp30']);
  sp('Servopup', 'Robot', 'Beast', ['laser_beam', 'gear_toss'], ['hp100']);
  sp('Mechadon', 'Robot', 'Shell', ['overclock', 'laser_beam'], ['hp250']);
  sp('Glimmerbug', 'Light', 'Bug', ['glint', 'tackle'], ['hp30']);
  sp('Sunpup', 'Light', 'Beast', ['glint', 'scratch'], ['hp30']);
  sp('Halowing', 'Light', 'Bird', ['sunbeam', 'glint'], ['hp100']);
  sp('Solarion', 'Light', 'Serpent', ['supernova', 'sunbeam'], ['hp250']);
  sp('Sludgel', 'Toxic', 'Blob', ['sludge_flick', 'tackle'], ['hp30']);
  sp('Venomite', 'Toxic', 'Bug', ['sludge_flick', 'scratch'], ['hp30']);
  sp('Toxitoad', 'Toxic', 'Beast', ['venom_fang', 'sludge_flick'], ['hp100']);
  sp('Miasmander', 'Toxic', 'Serpent', ['toxic_tide', 'venom_fang'], ['hp250']);
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
    // The Drowsing Grove comes right at the start of the game, so only gentle Creatamon live there.
    grove: [['Fluffin', 4], ['Chirple', 4], ['Sproutle', 4], ['Puddlit', 4], ['Breezlet', 2], ['Dreamote', 2]],
    // The far east has its own wildlife, whatever the ground.
    east1: [['Gearling', 4], ['Dronefly', 4], ['Boltnut', 4], ['Servopup', 2], ['Ironclaw', 2], ['Mechadon', 1]],
    east2: [['Glimmerbug', 4], ['Sunpup', 4], ['Petalwing', 4], ['Halowing', 2], ['Zapwing', 2], ['Solarion', 1]],
    east3: [['Sludgel', 4], ['Venomite', 4], ['Gloomoth', 4], ['Toxitoad', 2], ['Dewsnake', 2], ['Miasmander', 1]],
    7: [['Snowpuff', 4], ['Frostfinch', 4], ['Glimmershell', 4], ['Crystalisk', 2], ['Frostmaw', 2], ['Stormkite', 2], ['Oraclynx', 1], ['Glacierback', 1]],
  };
  // ---- Champion rank ----
  // Beating alpha Creatamon earns Champion rank. Seven tiers of three steps each, and every tier costs more wins per
  // step than the one before. Above Mythic III comes the Champion title, but only for a player who has beaten the
  // Champion: Champion I a few wins past Mythic III, and from there every few alpha wins adds another numeral, without end.
  const RANK_TIERS = ['Alpha', 'King', 'Emperor', 'Conqueror', 'Warlord', 'Legend', 'Mythic'];
  const roman = (n) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
    .reduce((out, [v, r]) => { while (n >= v) { out += r; n -= v; } return out; }, '');
  const ALPHA_TITLES = RANK_TIERS.flatMap((t) => [1, 2, 3].map((n) => `${t} ${roman(n)}`));
  // Wins needed for each title: 2 a step in the first tier, 3 in the second, and so on up.
  const ALPHA_NEED = ALPHA_TITLES.reduce((need, _, i) => [...need, (need[i - 1] || 0) + 2 + Math.floor(i / 3)], []);
  const alphaRank = (wins) => ALPHA_NEED.filter((n) => (wins || 0) >= n).length;
  const CHAMPION_STEP = 5;
  // Alpha wins for Champion I: one step past Mythic III.
  const CHAMPION_AT = ALPHA_NEED[ALPHA_NEED.length - 1] + CHAMPION_STEP;
  // 0 until the player has beaten the Champion and reached Champion I, then 1, 2, 3...
  const championLevel = (wins, champion) => (champion && (wins || 0) >= CHAMPION_AT ? 1 + Math.floor(((wins || 0) - CHAMPION_AT) / CHAMPION_STEP) : 0);
  const title = (wins, champion) => {
    const lv = championLevel(wins, champion);
    return lv ? `Champion ${roman(lv)}` : ALPHA_TITLES[alphaRank(wins) - 1] || '';
  };
  // The next title up and how many more alpha wins it takes; null once Mythic III is reached without beating the Champion.
  const nextRank = (wins, champion) => {
    const r = alphaRank(wins);
    if (r < ALPHA_TITLES.length) return { name: ALPHA_TITLES[r], left: ALPHA_NEED[r] - (wins || 0) };
    if (!champion) return null;
    const lv = championLevel(wins, champion);
    return { name: `Champion ${roman(lv + 1)}`, left: CHAMPION_AT + lv * CHAMPION_STEP - (wins || 0) };
  };
  // The rank the Champion demands of a challenger (an index into ALPHA_TITLES, plus one): Warlord I, 48 alpha wins.
  const CUP_RANK = 13;
  // ---- Money ----
  // Beating a trainer pays out by their strongest Creatamon; Leaders pay triple.
  const prize = (team, big) => Math.max(...team.map((t) => t[1])) * 14 * (big ? 3 : 1);
  // What a Power Card costs at a Creatastop, and how many badges it takes before one is sold. Mythic and secret
  // cards are never sold.
  const cardPrice = (id) => [0, 150, 450, 1300, 4000][CARDS[id].tier];
  const cardNeed = (id) => [0, 0, 2, 6, 12][CARDS[id].tier] ?? Infinity;
  const CLOTHES_PRICE = 250;
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
  // A random card of one tier. Key cards are never handed out at random.
  const cardOfTier = (tier, rng = Math.random) => {
    const ids = Object.keys(CARDS).filter((id) => CARDS[id].tier === tier && !CARDS[id].key);
    return ids[Math.floor(rng() * ids.length)];
  };
  // drops: percent chance of each tier from Common up ([common, rare] or [common, rare, epic, legendary]); whatever is
  // left over goes to the next tier up. Returns a card id or null. Rare Creatamon always drop (sure).
  const rollDrop = (drops, rng = Math.random, sure = false) => {
    if (!sure && rng() >= 0.5) return null;
    const r = rng() * 100;
    let tier = 1, below = 0;
    while (tier <= drops.length && r >= (below += drops[tier - 1])) tier++;
    return cardOfTier(tier, rng);
  };
  // Alphas always drop a card, and a better one: one in ten is Legendary, and for a Champion one in thirty is Mythic.
  const ALPHA_LEGENDARY = 0.1, ALPHA_MYTHIC = 1 / 30;
  const alphaDrop = (drops, champion, rng = Math.random) => {
    const r = rng();
    if (champion && r < ALPHA_MYTHIC) return cardOfTier(5, rng);
    if (r < ALPHA_MYTHIC + ALPHA_LEGENDARY) return cardOfTier(4, rng);
    return rollDrop(drops, rng, true);
  };
  // Chance of a wild Creatamon per step in an encounter tile.
  const ENCOUNTER_RATE = 0.22;

  const STARTER_CARDS = ['tackle', 'ember', 'splash_shot', 'leaf_flick', 'hp30', 'hp30'];

  return {
    ELEMENTS, STRONG, SHAPES, CARDS, TIER_NAMES, SECRET, stars, EGG, MAX_PARTY, CLOTHES, SPECIES, DEX, WILD, ZONE_OF,
    STARTER_CARDS, ENCOUNTER_RATE,
    isEgg, setMax, battleMoves, DOMAIN_STRIKE, ITEMS, held, EVOLVE_AT, STAGE_NAMES, STAGE_DMG, STAGE_HP, canEvolve, evolve,
    STAT_TAGS, STAGE_CAP, STATUS_NAMES, stage, calm, statusTick,
    effectiveness, cardDesc, maxHp, stats, create, xpToNext, xpYield, gainXp, levelCap, MOVE_SLOTS, ALPHA_TITLES, ALPHA_NEED, alphaRank, CHAMPION_AT, title, nextRank, roman, CUP_RANK, prize, cardPrice, cardNeed, CLOTHES_PRICE,
    useMove, pickMove, spawn, genWild, rollDrop, cardOfTier, alphaDrop,
  };
})();
export { CM };
