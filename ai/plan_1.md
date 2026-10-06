# Plan 1: answers ai/prompt_1.md

"More moves and rarities of power cards."

## Where we start

- 57 cards in `src/core.js`: 54 move cards and 3 health cards, in tiers ★ Common, ★★ Rare, ★★★ Epic, plus tier 4 "Secret"
  for the easter egg's bound cards.
- Every move is just element, power and accuracy; Mend (and the egg's Reverse Cursed Technique) heal instead.
- Cards come from sparkles, trainers, Leaders, wild drops (`area.drops` = % chances per tier) and Creatastops
  (`cardPrice` / `cardNeed` by tier). Tier 4 is hard-coded as "secret" in about ten places in `game.js`.

## How I read the prompt

1. **More rarities:** two new tiers above Epic: ★★★★ **Legendary** and ★★★★★ **Mythic**. Secret moves to its own tier
   number (6, shown as "✦ Secret") so the stars keep counting up with power.
2. **More moves:** moves that do more than deal damage, so new cards are worth having for what they do, not only for
   a bigger number. One new move per element in every tier (14 × 5 = 70), plus one new health card per new tier.
3. **Leave existing cards, foes and rewards alone.** No existing card changes, no trainer or wild Creatamon gets new
   moves, and existing rewards stay. New cards only add to what the player can find.

## Move effects

| Field | Effect | Card text |
| --- | --- | --- |
| `first` | Goes before a move without it, whatever the speeds | Strikes first |
| `hits: n` | Strikes n times, each hit rolled on its own; `power` is per hit | Pow 25×3 |
| `drain` | Heals the user by that share of the damage dealt | Drains 50% |
| `recoil` | The user takes that share of the damage dealt | Recoil 33% |
| `crit` | Critical-hit chance for this move (the higher of it and the holder's) | Crit 50% |
| `up: {atk, def, spd}` | Raises the user's stat stages | Self ATK+2 |
| `down: {…}` | Lowers the foe's stat stages | Foe DEF−1 |
| `inflict: 'burn' \| 'poison'` | The foe loses 1/10 of its max HP at the end of every turn | Burns / Poisons |
| `chance` | % chance for `up` / `down` / `inflict` on a damaging move | (30%) |

- **Stages:** ±1 per step, capped at ±3. Each step up is +25% on that stat, each step down is the reverse (÷1.25 per
  step). Stages, burns and poison last while the Creatamon stays in: they clear when it switches out, faints, or the
  battle ends. They never reach the save.
- **Status moves** (power 0, not a heal): just the effect. Ones aimed at the foe can be stopped by the egg's infinity,
  like attacks. They say "But nothing happened!" when there is nothing left to change.
- **Max Mode:** the Max move for each element comes from the strongest damaging move by total power (power × hits).
  Status moves stay usable as they are, as heal moves already do.
- **Computer players:** `pickMove` counts total power for multi-hit moves and gives a status move a fair score while it
  would still change something, so it is safe for foes to use them later. No foe has them yet.
- **Battle screen:** the level line shows stages and status, e.g. `Lv 30 · Fire · ATK+2 · BRN`. New messages for
  hits, drain, recoil, stat changes, burn and poison. New arrow effects for raising and lowering stats, and two new
  sounds.
- **Turn order:** `first` beats no `first`; otherwise speed decides as today. Burn and poison tick after the domain,
  before Mending Leaf, and anyone they knock out faints properly. If recoil knocks out the user in the same hit that
  knocks out the foe, both faint.

## The new cards

| | ★ Common | ★★ Rare | ★★★ Epic | ★★★★ Legendary | ★★★★★ Mythic |
| --- | --- | --- | --- | --- | --- |
| Normal | Quick Jab 30, first | Fury Flurry 25×3 | Rally Cry: self ATK/DEF/SPD+1 | Stampede 40×4 | Genesis Strike 150, first |
| Fire | Singe 35, burn 30% | Kindle: self ATK+2 | Wildfire 95, burn 50% | Phoenix Dive 140, recoil 25%, burn 30% | Worldfire 160, burn 50% |
| Water | Bubble Volley 15×3 | Undertow 60, drain 50% | Riptide Barrage 40×3 | Maelstrom 130, self SPD+1 | Abyssal Deluge 45×4 |
| Grass | Leech Sprout 35, drain 50% | Spore Cloud: foe ATK/SPD−1 | Lifebloom 80, drain 75% | Verdant Wrath 130, drain 50% | Worldroot Surge 140, drain 50%, self DEF+1 |
| Electric | Static Jolt 35, foe SPD−1 30% | Volt Dash 50, first | Chain Lightning 35×3 | Railgun 140, crit 30% | Storm Sovereign 160, crit 30%, foe SPD−1 |
| Rock | Stone Skin: self DEF+1 | Pebble Storm 20×4 | Boulder Crash 140, recoil 33% | Mountain Breaker 135, self DEF+1 | Primeval Quake 160, foe DEF−1 |
| Ice | Rime Needle 35, crit 30% | Frostbite 55, foe SPD−1 50% | Glacial Lance 95, crit 50% | Absolute Zero 130, foe SPD−1 | Eternal Winter 150, crit 50%, foe SPD−1 |
| Shadow | Snarl: foe ATK−1 | Ambush 55, crit 50% | Soul Siphon 85, drain 50% | Nightfall 130, foe ATK−1 | Void Requiem 150, drain 50%, crit 30% |
| Wind | Updraft: self SPD+2 | Slipstream 55, self SPD+1 | Gale Flurry 30×4 | Jetstream Lance 110, first | Skyrend Tempest 150, crit 30%, self SPD+1 |
| Metal | Twin Rivets 22×2 | Iron Wall: self DEF+2 | Bulwark Bash 95, self DEF+1 | Meteor Hammer 165, recoil 33% | Starforged Blade 160, self ATK/DEF+1 |
| Mind | Unsettle: foe DEF−1 | Meditate: self ATK/DEF+1 | Psy Lance 95, foe DEF−1 50% | Thought Shatter 130, foe DEF−1 | Astral Dominion 150, foe ATK/DEF−1 |
| Robot | Calibrate: self ATK+1 | Piston Punch 80, recoil 25% | Missile Swarm 25×5 | Omega Cannon 135, self ATK+1 | Singularity Engine 160, self ATK/SPD+1 |
| Light | Dazzle 35, foe ATK−1 30% | Halo Strike 55, drain 50% | Searing Halo 90, foe ATK−1 50% | Judgement Ray 130, drain 33% | Celestial Dawn 140, drain 50%, foe ATK−1 |
| Toxic | Toxic Prick 30, poison 40% | Noxious Fumes: poison | Acid Deluge 95, poison 50% | Caustic Ruin 130, poison + foe DEF−1 40% | Miasmic Doom 150, poison + foe DEF−1 |
| Health | | | | Colossus Heart +400 HP | Eternal Heart +600 HP |

Accuracy runs from 85% to 100%, lower on the hardest hitters, as with today's cards.

## Where the new rarities come from

- **Wild drops:** the late areas (level 39 and up) get a 1–2% Legendary share in their drop table. `rollDrop` reads any
  number of tiers, and the result for today's three-entry tables is unchanged.
- **Alphas:** one drop in ten is Legendary. Once you are Champion, one in thirty is Mythic.
- **Creatastops:** Legendary cards of the town's element, and Colossus Heart, go on sale at 12 badges for ◎4000.
  Mythic cards are never sold.
- **The Champion:** beating Vex also gives the Mythic move of your lead Creatamon's element. The existing rewards stay.
- A Legendary or Mythic card gets the badge fanfare and its rarity named in the "You got" line.

## Card look

- Legendary: a fiery orange-to-red card with a warm glow. Mythic: a pale prismatic card with a violet glow. Secret keeps
  its purple card under the new class.
- The rarity line on a card stays on one line for all six rarities, so cards keep their size.

## Files

- `src/core.js`: tiers, effects, the 72 new cards, stages/status rules, `useMove`, `battleMoves`, `pickMove`,
  `rollDrop`, new `alphaDrop`, prices.
- `src/game.js`: secret checks by tier name, battle messages and turn order, status ticks, level-line tags, rewards.
- `src/draw.js`: the stat-change arrows. `src/sfx.js`: two sounds. `src/style.css`: the two new card looks.
- `src/world.js`: late-area drop tables.
- `test/core.test.js`: card data checks and rules for every effect, drops and prices.
- `README.md`, the How to play page: rarities and effects.

## Checks

- `npm test` passes with the new tests.
- A scratch script runs the old and new `core.js` side by side with seeded randomness: for existing cards `useMove`,
  `pickMove`, `battleMoves`, `spawn` and every gym and trainer team must give identical results.
- Build, then play it in headless Chrome: cards of all six rarities in the Bag and Forge, a battle using each kind of
  effect, the level-line tags, and the touch layout.
- `next_1.md`: what was done and what to do next.
