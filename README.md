# Creatamon

A creature-battling RPG where you don't catch your team, you **create** it.
Find **Power Cards**, slot them into a Creatamon at the Forge, and battle your way to the Champion.

## Play

Open `index.html` in a browser. No build step, no dependencies. Progress saves automatically in the browser.

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Enter / Space | Interact, advance text |
| M / Esc | Menu and the Forge |
| 1-9 | Pick a battle option |

## Power Cards

Every Creatamon is built from cards: as many move and health cards as you like, plus a free choice of element and body.
You can keep the generated look or pick **Draw my own** in the Forge and paint a 32x32 sprite.

| Tier | Examples |
| --- | --- |
| ★ Common | Tackle, Ember, Vitality Shard (+30 HP) |
| ★★ Rare | Aqua Jet, Mend, Vitality Core (+100 HP) |
| ★★★ Epic | Tsunami Blast, Hyper Burst, Titan Heart (+250 HP) |

Cards come from chests, trainer rewards, and drops from wild Creatamon (deeper areas drop better tiers).
Rebuilding a Creatamon at the Forge is free, and dismantling one returns its cards.

## Development

- `js/core.js` holds data and rules (cards, creatures, damage, map) with no DOM
- `js/game.js` holds the overworld, battles, menu and Forge
- `node test/core.test.js` checks the rules and that the map is fully reachable
