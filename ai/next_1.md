# Next 1: what prompt 1 changed, and what to do next

## Done

**Two new rarities**, above Epic: ★★★★ **Legendary** (orange card with a warm glow) and ★★★★★ **Mythic** (prismatic
card with a violet glow). The easter egg's bound cards moved from tier 4 to their own tier (`CM.SECRET` = 6, shown as
"✦ Secret"), and every hard-coded `tier === 4` in `game.js` now uses `CM.SECRET`.

**72 new cards** (57 → 129): one new move per element in each of the five rarities, plus Colossus Heart (+400 HP,
Legendary) and Eternal Heart (+600 HP, Mythic). The full table is in `plan_1.md`.

**Moves can now do more than hit.** Each effect is a field on the card, and any move can combine them:

| Field | Effect |
| --- | --- |
| `first` | Strikes first |
| `hits` | Hits several times, each hit rolled on its own |
| `drain` / `recoil` | The user regains / loses a share of the damage dealt |
| `crit` | The move's own critical-hit chance |
| `up` / `down` | Stat stages on the user / the foe: ±25% a stage, up to ±3 |
| `inflict` | Burn or poison: 1/10 of max HP lost each turn |
| `chance` | % chance of `up`, `down` and `inflict` on a move that deals damage |

- Power 0 makes a status move. It says "But nothing happened!" if there is nothing left to change.
- Stages and status clear when a Creatamon switches out, faints, or the battle ends, so they never reach the save.
- The battle screen shows them on the level line (`Lv 32 · Rock · ATK−1 · PSN`). There are new messages for each
  effect, rising/sinking arrow effects and two new sounds.
- If recoil or a burn knocks out both sides at once, both faint properly (`settle` now checks yours even after the
  foe's).
- Max Mode counts every hit when it picks the strongest attack, and keeps status moves as they are.
- `pickMove` counts every hit and gives a status move a fair score while it still changes something.

**Where the new rarities come from:**
- **Wild drops:** the seven areas from level 39 up have a 1–2% Legendary share. `rollDrop` reads any number of tiers.
- **Alphas:** one drop in ten is Legendary. For a Champion, one in thirty is Mythic (`CM.alphaDrop`).
- **Creatastops:** from 12 badges they sell their element's Legendary move and Colossus Heart for ◎4000. Mythic cards
  are never sold.
- **Champion Vex:** beating him adds the Mythic move of your lead Creatamon's element to the existing rewards.
- A Legendary or Mythic find gets the badge fanfare and "You got a Legendary Power Card: …".

**Docs:** two new How to play entries (Power Cards, Move effects), and the README's Power Cards section (rarities,
sources, effects).

## Changes from the plan

- **Cards grow to fit their text** (`min-height: 84px` instead of `height: 84px`). Two- and three-effect
  descriptions need more room, and many existing cards with two-line names (Flame Wheel, Tsunami Blast, …) already ran
  a few pixels past the bottom. A row now takes the height of its tallest card.
- **Battle move descriptions wrap** onto a second line instead of being cut off with "…". Every existing move still
  fits on one line, so those buttons look exactly as before.

## How it was checked

- **`npm test` passes.** New checks:
  - card data: every element has a move in every rarity, and the shop rules hold;
  - each effect's rule: hits, drain, recoil, crit, stage caps and their +25% steps, status moves failing, burn/poison
    ticks and chances;
  - leaving battle clears stages and status;
  - the egg's infinity stops status moves aimed at it;
  - Max Mode, and the AI's use of status moves;
  - every drop table adds up to 100, and the tiers that `rollDrop` / `alphaDrop` can return.
- **Old vs new rules, side by side** (a scratch script, not in the repo): the original `core.js` (from `c912c91`) and
  the new one run under the same seeded randomness, using only the old cards. 101,347 checks came out identical:
  - every old card and its description;
  - `spawn` for every species at levels 1–80, and every trainer and Leader team;
  - 20,000 random battles (6 turns each, with items, evolution stages, Max Mode and the egg);
  - drop tiers for every old drop table;
  - prices.

  So existing foes, rewards and battles behave exactly as before. Only new cards, the seven drop tables and the
  Champion's extra card are different.
- **Played in headless Chrome** (desktop 1280×900 and phone 844×390 touch) from a save with every card:
  - The Bag shows all six rarities with nothing spilling out of a card.
  - Wild battles used Kindle, Snarl, Noxious Fumes, Fury Flurry, Leech Sprout, Boulder Crash, Quick Jab, Spore Cloud,
    Rally Cry, Stampede, Genesis Strike and Phoenix Dive. Every message, tag and effect showed as intended.
  - No console errors.
  - The Fire Creatastop lists Phoenix Dive and Colossus Heart at 12 badges and not at 11.
- **Bundle:** JS 222 KB → 232 KB raw (88 KB gzip). That is far too little to affect the load-time target.

## Things to know

- **Rarer individual drops:** every tier now has about twice as many cards, so any one card (health cards included)
  drops about half as often as before. Vitality Shard was 1 in 16 Common drops; now it is 1 in 30.
- **No foe uses the new moves yet.** Trainers, Leaders, alphas and wild Creatamon keep their old move sets. The AI
  already handles the new moves.
- **Balance has not had a long playtest.** The numbers follow today's tiers: Epic ≈ 110 power, Legendary ≈ 130,
  Mythic ≈ 150, with lower power for strong effects. Poison and burn take 10% of max HP a turn, which makes them very
  strong against alphas, who carry +600 HP of health cards.
- **"Mythic" is also the top Champion rank tier** ("Mythic I"). In context it reads clearly, but the word is shared.

## Recommended next

1. **Let foes use the new moves:** for example, alphas carry one effect move of their element, and late Leaders and
   Champion Vex get Legendary moves. This changes difficulty, so it needs its own prompt and a playtest.
2. **Balance playtest:** a mid-game run and a post-Champion alpha grind, looking at poison against alphas, Rally Cry
   or Kindle setup, and Strikes-first moves.
3. **Sorting and filters** for the Bag and Forge (by rarity and element). With every card owned, the list is now 129
   cards long.
4. **Health-card drop share:** if health cards now feel too scarce, give each tier's health card a fixed share of
   that tier's drops.
5. **Trophies:** for a first Legendary card and a first Mythic card.
6. Still open from `next_0.md`: deploy, the readability bugs (title and Close button text, small text on phones),
   and the missing optional images and favicon.

## Follow-up (same session)

- **Champion Cup gate:** Champion Vex now needs **Warlord I (48 alpha wins)** as well as all 14 badges (was King I,
  9 wins). The request was "the rank nearest to 45": Conqueror III (42) and Warlord I (48) tie, and Warlord I starts a
  tier as King I did. One constant: `CUP_RANK = 13` in `src/core.js`.
- **Alpha spawn rate:** the chance per 5-second spawn check is now 40% (was 30%; `ALPHA_CHANCE` in `src/game.js`).
- **Champion title above Mythic:** beating Champion Vex no longer makes you Champion I. It unlocks the Champion
  title as the step above Mythic III: Champion I at 110 alpha wins (`CM.CHAMPION_AT`, five past Mythic III), then a
  numeral every 5 wins. Without beating Vex the ladder stops at Mythic III. `title` / `nextRank` no longer use
  `S.champAt`, which is gone from new saves (old saves keep the unused key). Players who were already Champion now show
  their ladder title until they reach 110 wins.
