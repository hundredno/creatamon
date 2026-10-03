// Creatamon UI: overworld, battles, menu and the Forge.
(() => {
  const { CARDS, ELEMENTS, SHAPES, MAP, TRAINERS, CHESTS, PROFESSOR } = CM;
  const $ = (id) => document.getElementById(id);
  const $game = $('game'), $world = $('world'), $battle = $('battle'), $dialog = $('dialog');
  const $actions = $('actions'), $menu = $('menu'), $title = $('title'), $hud = $('hud');
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const SAVE_KEY = 'creatamon-save-v1';
  const TILE = 32, VIEW_W = 480, VIEW_H = 352;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  let S = null;          // saved game state
  let mode = 'title';    // title | world | busy | menu
  let move = null;       // in-progress step {fx, fy, tx, ty, t}
  let forge = null;      // open Forge editor {idx, draft, avail}
  let B = null;          // current battle {me, foe}
  const keys = {};

  // ---------- State ----------
  const newState = () => ({
    x: CM.START.x, y: CM.START.y, dir: 'down', heal: [CM.START.x, CM.START.y],
    cards: {}, party: [], chests: {}, trainers: {}, intro: false,
  });
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
  const load = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } };
  const addCard = (id, n = 1) => { S.cards[id] = (S.cards[id] || 0) + n; };
  const cardLabel = (id) => `${'★'.repeat(CARDS[id].tier)} ${CARDS[id].name}`;
  const healAll = () => S.party.forEach((c) => { c.hp = CM.maxHp(c); });

  // ---------- Dialog ----------
  let advance = null, advanceAt = 0;
  const say = (text) => new Promise((resolve) => {
    $dialog.textContent = text;
    $dialog.hidden = false;
    advanceAt = performance.now();
    advance = () => { advance = null; resolve(); };
  });
  const tryAdvance = () => {
    // The short guard stops the click/keypress that opened a message from also dismissing it.
    if (advance && performance.now() - advanceAt > 120) advance();
  };
  const talk = async (lines) => {
    const prev = mode;
    mode = 'busy';
    for (const line of [].concat(lines)) await say(line);
    $dialog.hidden = true;
    mode = prev === 'busy' ? 'busy' : 'world';
  };
  const giveCards = async (ids) => {
    for (const id of ids) {
      addCard(id);
      await say(`You got a Power Card: ${cardLabel(id)}! (${CM.cardDesc(CARDS[id])})`);
    }
  };

  // ---------- World ----------
  const trainerPos = (t) => (S.trainers[t.id] && t.aside ? t.aside : [t.x, t.y]);
  const entityAt = (x, y) => {
    const chest = CHESTS.find((c) => c.x === x && c.y === y);
    if (chest) return { type: 'chest', chest };
    if (PROFESSOR.x === x && PROFESSOR.y === y) return { type: 'prof' };
    const trainer = TRAINERS.find((t) => { const p = trainerPos(t); return p[0] === x && p[1] === y; });
    return trainer ? { type: 'trainer', trainer } : null;
  };
  const walkable = (x, y) => !CM.SOLID.includes(MAP[y][x]) && !entityAt(x, y);
  const hasFighter = () => S.party.some((c) => c.hp > 0);

  function update(dt) {
    if (mode !== 'world') return;
    if (move) {
      move.t += dt / 130;
      if (move.t >= 1) { S.x = move.tx; S.y = move.ty; move = null; onStep(); }
      return;
    }
    const dir = keys.arrowup || keys.w ? 'up' : keys.arrowdown || keys.s ? 'down'
      : keys.arrowleft || keys.a ? 'left' : keys.arrowright || keys.d ? 'right' : null;
    if (!dir) return;
    S.dir = dir;
    const tx = S.x + DIRS[dir][0], ty = S.y + DIRS[dir][1];
    if (walkable(tx, ty)) move = { fx: S.x, fy: S.y, tx, ty, t: 0 };
  }

  async function onStep() {
    const ch = MAP[S.y][S.x];
    if (ch === 'H') {
      S.heal = [S.x, S.y];
      if (S.party.some((c) => c.hp < CM.maxHp(c))) {
        healAll();
        await talk('The heal pad hums... your Creatamon are fully restored!');
      }
    }
    const zone = CM.ZONE_OF[ch];
    if (zone && hasFighter() && Math.random() < 0.13) {
      const foe = CM.genWild(zone);
      const result = await battle([foe], { zone });
      if (result === 'win') {
        const drop = CM.rollDrop(zone);
        if (drop) { await say(`The wild ${foe.name} dropped something...`); await giveCards([drop]); }
      }
      await endBattle(result);
    }
    save();
  }

  async function endBattle(result) {
    $battle.hidden = true;
    $actions.hidden = true;
    if (result === 'lose') {
      await say('All your Creatamon fainted! You hurry back to the last heal pad...');
      [S.x, S.y] = S.heal;
      S.dir = 'down';
      healAll();
    }
    $dialog.hidden = true;
    mode = 'world';
    save();
  }

  async function interact() {
    if (move) return;
    const e = entityAt(S.x + DIRS[S.dir][0], S.y + DIRS[S.dir][1]);
    if (!e) return;
    if (e.type === 'chest') {
      const key = `${e.chest.x},${e.chest.y}`;
      if (S.chests[key]) return talk('The chest is empty.');
      S.chests[key] = true;
      mode = 'busy';
      await say('You opened the chest!');
      await giveCards([e.chest.card]);
      $dialog.hidden = true;
      mode = 'world';
    } else if (e.type === 'prof') {
      await talk(S.party.length
        ? ['Power Cards hide in chests, and wild Creatamon sometimes drop them.',
          'Match a move\'s element to your Creatamon\'s element for extra power.',
          'You can rebuild a Creatamon at the Forge any time. Press M.']
        : 'You have Power Cards but no Creatamon! Press M and forge one.');
    } else {
      await challenge(e.trainer);
    }
    save();
  }

  async function challenge(t) {
    if (S.trainers[t.id]) {
      return talk(`${t.name}: ${t.champion ? 'All hail the new Champion!' : 'Keep forging. The Champion is no pushover.'}`);
    }
    if (!hasFighter()) return talk(`${t.name}: Come back with a Creatamon that can fight.`);
    await talk(`${t.name}: ${t.pre}`);
    const result = await battle(t.team.map(CM.create), { trainer: t.name, zone: t.y < 10 ? (t.x < 19 ? 3 : 2) : 1 });
    if (result === 'win') {
      S.trainers[t.id] = true;
      $battle.hidden = true;
      await say(`${t.name}: ${t.post}`);
      await giveCards(t.reward);
      if (t.champion) await say('You beat the Champion! Keep collecting cards and forging the ultimate Creatamon.');
    }
    await endBattle(result);
  }

  // ---------- Battle ----------
  const hpClass = (f) => (f > 0.5 ? '' : f > 0.2 ? 'mid' : 'low');
  function renderBattle() {
    const { me, foe } = B;
    $('foeName').textContent = foe.name;
    $('foeLv').textContent = `Lv ${foe.level} · ${foe.element}`;
    $('meName').textContent = me.name;
    $('meLv').textContent = `Lv ${me.level} · ${me.element}`;
    drawCreature($('foeSprite'), foe, false);
    drawCreature($('meSprite'), me, true);
    updateBars();
  }
  function updateBars() {
    for (const [c, bar] of [[B.foe, $('foeBar')], [B.me, $('meBar')]]) {
      const f = c.hp / CM.maxHp(c);
      bar.style.width = `${f * 100}%`;
      bar.className = hpClass(f);
    }
    $('meHp').textContent = `${B.me.hp} / ${CM.maxHp(B.me)} HP`;
  }
  function flash(el) {
    el.classList.remove('hit');
    void el.offsetWidth;
    el.classList.add('hit');
  }

  async function attack(att, def, moveId, targetSprite) {
    const m = CARDS[moveId];
    await say(`${att.name} used ${m.name}!`);
    const r = CM.useMove(att, def, m);
    if (r.miss) return say('But it missed!');
    updateBars();
    if (r.heal != null) return say(`${att.name} recovered ${r.heal} HP!`);
    flash(targetSprite);
    if (r.eff > 1) await say("It's super effective!");
    else if (r.eff < 1) await say("It's not very effective...");
  }

  function pickButton(html) {
    $dialog.hidden = true;
    $actions.innerHTML = html;
    $actions.hidden = false;
    return new Promise((resolve) => {
      $actions.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        $actions.onclick = null;
        $actions.hidden = true;
        resolve(b.dataset);
      };
    });
  }
  // Returns a party index, or null if the player backed out.
  async function chooseParty(forced) {
    const html = S.party.map((c, i) =>
      `<button data-idx="${i}" style="border-left-color:${ELEMENTS[c.element].color}" ${c.hp <= 0 || c === B.me ? 'disabled' : ''}>
        <b>${esc(c.name)}</b> Lv ${c.level}<small>${c.hp} / ${CM.maxHp(c)} HP</small></button>`).join('')
      ;
    const d = await pickButton(`<div class="moves">${html}</div>${forced ? '' : '<div class="side"><button data-back="1"><b>Back</b></button></div>'}`);
    return d.back ? null : +d.idx;
  }
  async function chooseAction(isTrainer) {
    for (;;) {
      const moves = B.me.moves.map((id) => {
        const m = CARDS[id];
        return `<button data-move="${id}" style="border-left-color:${ELEMENTS[m.element].color}">
          <b>${m.name}</b><small>${CM.cardDesc(m)}</small></button>`;
      }).join('');
      const canSwitch = S.party.some((c) => c.hp > 0 && c !== B.me);
      const d = await pickButton(`<div class="moves">${moves}</div><div class="side">
        <button data-act="switch" ${canSwitch ? '' : 'disabled'}><b>Switch</b><small>Swap Creatamon</small></button>
        <button data-act="run"><b>Run</b><small>Flee the battle</small></button></div>`);
      if (d.move) return { type: 'move', move: d.move };
      if (d.act === 'switch') {
        const idx = await chooseParty(false);
        if (idx != null) return { type: 'switch', idx };
      } else if (isTrainer) {
        await say("You can't run from a trainer battle!");
      } else {
        return { type: 'run' };
      }
    }
  }

  async function grantXp(me, foe, isTrainer) {
    const xp = Math.round(CM.xpYield(foe) * (isTrainer ? 1.5 : 1));
    await say(`${me.name} gained ${xp} XP!`);
    const from = me.level;
    if (CM.gainXp(me, xp)) {
      renderBattle();
      for (let l = from + 1; l <= me.level; l++) await say(`${me.name} grew to level ${l}!`);
    }
  }

  // Resolves to 'win' | 'lose' | 'run'. Leaves the battle screen up for the caller to close.
  async function battle(foes, opts) {
    mode = 'busy';
    B = { foe: foes[0], me: S.party.find((c) => c.hp > 0) };
    $battle.className = `z${opts.zone}`;
    $battle.hidden = false;
    renderBattle();
    const foeTag = opts.trainer ? `${opts.trainer}'s ` : 'The wild ';
    if (opts.trainer) {
      await say(`${opts.trainer} wants to battle!`);
      await say(`${opts.trainer} sent out ${B.foe.name}!`);
    } else {
      await say(`A wild ${B.foe.name} appeared!`);
    }
    await say(`Go, ${B.me.name}!`);

    for (;;) {
      const act = await chooseAction(!!opts.trainer);
      let myMove = null;
      if (act.type === 'run') {
        if (Math.random() < 0.8) { await say('Got away safely!'); return 'run'; }
        await say("Couldn't get away!");
      } else if (act.type === 'switch') {
        B.me = S.party[act.idx];
        renderBattle();
        await say(`Go, ${B.me.name}!`);
      } else {
        myMove = act.move;
      }
      const foeMove = CM.pickMove(B.foe, B.me);
      const mySpd = CM.stats(B.me).spd, foeSpd = CM.stats(B.foe).spd;
      const meFirst = mySpd > foeSpd || (mySpd === foeSpd && Math.random() < 0.5);
      const order = !myMove ? ['foe'] : meFirst ? ['me', 'foe'] : ['foe', 'me'];

      for (const who of order) {
        if (who === 'me') await attack(B.me, B.foe, myMove, $('foeSprite'));
        else await attack(B.foe, B.me, foeMove, $('meSprite'));

        if (B.foe.hp <= 0) {
          await say(`${foeTag}${B.foe.name} fainted!`);
          await grantXp(B.me, B.foe, !!opts.trainer);
          const next = foes.find((f) => f.hp > 0);
          if (!next) return 'win';
          B.foe = next;
          renderBattle();
          await say(`${opts.trainer} sent out ${next.name}!`);
          break;
        }
        if (B.me.hp <= 0) {
          await say(`${B.me.name} fainted!`);
          if (!hasFighter()) return 'lose';
          B.me = S.party[await chooseParty(true)];
          renderBattle();
          await say(`Go, ${B.me.name}!`);
          break;
        }
      }
    }
  }

  // ---------- Menu & Forge ----------
  const cardHTML = (id, n, attrs = '', tag = 'button') => {
    const c = CARDS[id];
    const stripe = c.kind === 'move' ? `style="border-top-color:${ELEMENTS[c.element].color}"` : '';
    return `<${tag} class="card t${c.tier}" ${stripe} ${attrs}>
      <span class="tier">${'★'.repeat(c.tier)} ${CM.TIER_NAMES[c.tier]}</span>
      <b>${c.name}</b><small>${CM.cardDesc(c)}</small>${n > 1 ? `<em>×${n}</em>` : ''}</${tag}>`;
  };
  const sortedCards = (counts) => Object.keys(CARDS).filter((id) => counts[id] > 0);

  function openMenu() {
    mode = 'menu';
    $menu.hidden = false;
    renderMenu();
  }
  function closeMenu() {
    forge = null;
    $menu.hidden = true;
    mode = 'world';
    save();
  }

  function renderMenu() {
    if (forge) return renderForge();
    const party = S.party.map((c, i) => `
      <div class="mon">
        <canvas data-sprite="${i}" width="96" height="96"></canvas>
        <div><b>${esc(c.name)}</b> Lv ${c.level} <small>· ${c.element} ${c.shape} · ${c.hp} / ${CM.maxHp(c)} HP · ${c.xp}/${CM.xpToNext(c.level)} XP</small><br>
          <small>${c.moves.map((id) => CARDS[id].name).join(', ')}${c.hpCards.length ? ' · ' + c.hpCards.map((id) => CARDS[id].name).join(', ') : ''}</small></div>
        <div class="btns">
          ${i ? `<button class="plain" data-a="lead" data-i="${i}">Make lead</button>` : ''}
          <button class="plain" data-a="edit" data-i="${i}">Rebuild</button>
          <button class="plain" data-a="dismantle" data-i="${i}">Dismantle</button>
        </div>
      </div>`).join('');
    const ids = sortedCards(S.cards);
    $menu.innerHTML = `
      <header><h2>Creatamon</h2><button data-a="close">Close (Esc)</button></header>
      <h3>Party (${S.party.length}/${CM.MAX_PARTY})</h3>
      ${party || '<p class="empty">No Creatamon yet. Forge one from your Power Cards!</p>'}
      <button class="plain primary" data-a="new" ${S.party.length >= CM.MAX_PARTY ? 'disabled' : ''}>＋ Forge a new Creatamon</button>
      <h3>Unused Power Cards</h3>
      <div class="cards">${ids.map((id) => cardHTML(id, S.cards[id], '', 'div')).join('') || '<p class="empty">None. Look for chests and battle wild Creatamon.</p>'}</div>`;
    $menu.querySelectorAll('[data-sprite]').forEach((cv) => drawCreature(cv, S.party[cv.dataset.sprite], false));
  }

  const GRID = 32;
  const PALETTE = ['#1c1c28', '#ffffff', '#9a9a9a', '#e0483c', '#f47a45', '#f6d643', '#72cc5c', '#2f7a2c',
    '#55a8ee', '#1f5f9e', '#9b3fd6', '#f08aa0', '#f3c9a0', '#8a5a2b'];
  const isEgg = (c) => c.name.trim() === CM.EGG.name;
  // Secret cards come and go with the name; they never touch the card collection.
  function syncEgg(draft) {
    draft.moves = draft.moves.filter((id) => CARDS[id].tier !== 4);
    if (isEgg(draft)) draft.moves.push(...CM.EGG.moves);
  }

  function openForge(idx) {
    const src = idx == null ? null : S.party[idx];
    const pix = document.createElement('canvas');
    pix.width = pix.height = GRID;
    forge = {
      idx, pix,
      avail: { ...S.cards },
      drawMode: !!(src && src.art), tool: 'pen', color: PALETTE[0],
      draft: src
        ? { name: src.name, element: src.element, shape: src.shape, moves: [...src.moves], hpCards: [...src.hpCards] }
        : { name: '', element: 'Normal', shape: 'Blob', moves: [], hpCards: [] },
    };
    if (src && src.art) {
      const im = new Image();
      im.onload = () => { pix.getContext('2d').drawImage(im, 0, 0); if (forge && forge.pix === pix) paintPreview(); };
      im.src = src.art;
    }
    renderMenu();
  }

  const forgeLevel = () => (forge.idx == null ? 1 : S.party[forge.idx].level);
  const drawingNow = () => forge.drawMode && !isEgg(forge.draft);
  function paintPreview() {
    const cv = $('preview');
    if (!cv) return;
    if (!drawingNow()) return drawCreature(cv, { ...forge.draft, name: forge.draft.name.trim(), level: forgeLevel(), art: null }, false);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(forge.pix, 0, 0, cv.width, cv.height);
  }
  function floodFill(g, x, y, hex) {
    const img = g.getImageData(0, 0, GRID, GRID), p = img.data;
    const to = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);
    const start = (y * GRID + x) * 4, from = [...p.slice(start, start + 4)];
    if (from.every((v, i) => v === to[i])) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) continue;
      const i = (cy * GRID + cx) * 4;
      if (!from.every((v, k) => p[i + k] === v)) continue;
      to.forEach((v, k) => { p[i + k] = v; });
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    g.putImageData(img, 0, 0);
  }
  function stroke(e) {
    const cv = e.currentTarget, g = forge.pix.getContext('2d');
    const x = Math.floor(e.offsetX / cv.clientWidth * GRID), y = Math.floor(e.offsetY / cv.clientHeight * GRID);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    if (forge.tool === 'erase') g.clearRect(x, y, 1, 1);
    else if (forge.tool === 'fill') floodFill(g, x, y, forge.color);
    else { g.fillStyle = forge.color; g.fillRect(x, y, 1, 1); }
    paintPreview();
  }

  function renderForge() {
    const { draft, avail, idx } = forge;
    const egg = isEgg(draft);
    const preview = { ...draft, level: forgeLevel() };
    const st = CM.stats(preview);
    const slots = (list, kind) => list.map((id, i) => (CARDS[id].tier === 4
      ? cardHTML(id, 1, 'title="Bound to this Creatamon"', 'div')
      : cardHTML(id, 1, `data-un="${kind}" data-i="${i}" title="Click to remove"`))).join('')
      + '<div class="slot">no limit,<br>add more below</div>';
    const pick = (attr, names, cur, hint) => names.map((n) =>
      `<button class="plain ${n === cur ? 'on' : ''}" data-${attr}="${n}" title="${hint(n)}">${n}</button>`).join('');
    const tools = !forge.drawMode ? '' : `
      <div class="palette">${PALETTE.map((c) => `<button data-color="${c}" class="${c === forge.color ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
      <div class="pick">${pick('tool', ['pen', 'fill', 'erase'], forge.tool, () => 'Tool')}<button class="plain" data-a="clearart">clear</button></div>
      <small class="empty">Draw it facing left.</small>`;
    const look = egg ? '<small class="secret">✦ A cursed presence answers to that name...</small>' : `
      <div class="pick">
        <button class="plain ${forge.drawMode ? '' : 'on'}" data-look="auto">Auto look</button>
        <button class="plain ${forge.drawMode ? 'on' : ''}" data-look="draw">Draw my own</button>
      </div>${tools}`;
    const ids = sortedCards(avail);
    $menu.innerHTML = `
      <header><h2>The Forge · ${idx == null ? 'new Creatamon' : 'rebuild'}</h2><button data-a="cancel">Cancel</button></header>
      <div class="forge">
        <div class="left">
          <canvas id="preview" width="160" height="160" class="${drawingNow() ? 'drawing' : ''}"></canvas>
          ${look}
          <input id="fname" maxlength="12" placeholder="Name it..." value="${esc(draft.name)}">
          <div class="pick">${pick('el', Object.keys(ELEMENTS).filter((n) => !ELEMENTS[n].hidden), draft.element, () => 'Element')}</div>
          <div class="pick">${pick('shape', Object.keys(SHAPES), draft.shape, (n) => SHAPES[n].hint)}</div>
          <div class="statline"><b>${CM.maxHp(preview)} HP</b> · ATK ${st.atk} · DEF ${st.def} · SPD ${st.spd}<br>${SHAPES[draft.shape].hint}. Same-element moves hit 25% harder.</div>
          <button class="plain primary" data-a="save" ${draft.moves.length ? '' : 'disabled'}>${idx == null ? 'Create!' : 'Save changes'}</button>
          ${draft.moves.length ? '' : '<small class="empty">Needs at least one move card.</small>'}
        </div>
        <div class="right">
          <h3>Moves (${draft.moves.length})</h3>
          <div class="cards">${slots(draft.moves, 'moves')}</div>
          <h3>Health (${draft.hpCards.length})</h3>
          <div class="cards">${slots(draft.hpCards, 'hpCards')}</div>
          <h3>Your Power Cards · click to slot</h3>
          <div class="cards">${ids.map((id) => cardHTML(id, avail[id], `data-add="${id}"`)).join('') || '<p class="empty">No unused cards.</p>'}</div>
        </div>
      </div>`;
    paintPreview();
    const cv = $('preview');
    cv.onpointerdown = (e) => {
      if (!drawingNow()) return;
      cv.setPointerCapture(e.pointerId);
      stroke(e);
      if (forge.tool !== 'fill') cv.onpointermove = stroke;
    };
    cv.onpointerup = cv.onpointercancel = () => { cv.onpointermove = null; };
    $('fname').oninput = (e) => {
      const was = isEgg(draft);
      draft.name = e.target.value;
      if (isEgg(draft) === was) return;
      syncEgg(draft);
      renderForge();
      $('fname').focus();
      $('fname').setSelectionRange(draft.name.length, draft.name.length);
    };
  }

  function saveForge() {
    const { draft, avail, idx, pix } = forge;
    const name = draft.name.trim() || `${draft.element === 'Normal' ? 'Plain' : draft.element}${draft.shape.toLowerCase()}`.slice(0, 12);
    const drawn = forge.drawMode && pix.getContext('2d').getImageData(0, 0, GRID, GRID).data.some((v, i) => i % 4 === 3 && v);
    const art = drawn ? pix.toDataURL() : null;
    if (idx == null) {
      S.party.push(CM.create({ ...draft, name, art }));
    } else {
      const c = S.party[idx];
      const before = CM.maxHp(c);
      Object.assign(c, { name, art, element: draft.element, shape: draft.shape, moves: draft.moves, hpCards: draft.hpCards });
      const after = CM.maxHp(c);
      c.hp = Math.min(after, c.hp + Math.max(0, after - before));
    }
    S.cards = avail;
    forge = null;
    save();
    renderMenu();
  }

  $menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a],[data-el],[data-shape],[data-add],[data-un],[data-look],[data-color],[data-tool]');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (forge) {
      const { draft, avail } = forge;
      if (d.a === 'cancel') forge = null;
      else if (d.a === 'save') return saveForge();
      else if (d.a === 'clearart') forge.pix.getContext('2d').clearRect(0, 0, GRID, GRID);
      else if (d.look) forge.drawMode = d.look === 'draw';
      else if (d.color) { forge.color = d.color; if (forge.tool === 'erase') forge.tool = 'pen'; }
      else if (d.tool) forge.tool = d.tool;
      else if (d.el) draft.element = d.el;
      else if (d.shape) draft.shape = d.shape;
      else if (d.add) {
        const isHp = CARDS[d.add].kind === 'hp';
        const list = isHp ? draft.hpCards : draft.moves;
        if (!isHp && list.includes(d.add)) return;
        list.push(d.add);
        avail[d.add]--;
      } else if (d.un) {
        const [id] = draft[d.un].splice(+d.i, 1);
        avail[id] = (avail[id] || 0) + 1;
      }
      return renderMenu();
    }
    if (d.a === 'close') return closeMenu();
    if (d.a === 'new') return openForge(null);
    if (d.a === 'edit') return openForge(+d.i);
    if (d.a === 'lead') S.party.unshift(S.party.splice(+d.i, 1)[0]);
    if (d.a === 'dismantle') {
      const c = S.party[+d.i];
      if (!confirm(`Dismantle ${c.name}? Its Power Cards return to you, but its levels are lost.`)) return;
      [...c.moves, ...c.hpCards].filter((id) => CARDS[id].tier !== 4).forEach((id) => addCard(id));
      S.party.splice(+d.i, 1);
    }
    save();
    renderMenu();
  });

  // ---------- Drawing ----------
  // Sprites are drawn in a 100x100 box facing left; flip makes them face right.
  // The easter egg uses img/modulo-yuji.png when that file exists, else a drawn stand-in.
  const eggImg = new Image();
  eggImg.src = 'img/modulo-yuji.png';
  const artCache = new Map();
  function artImage(src, onLoad) {
    let im = artCache.get(src);
    if (!im) { im = new Image(); im.src = src; artCache.set(src, im); }
    if (!im.complete) im.addEventListener('load', onLoad, { once: true });
    return im;
  }

  function drawCreature(cv, c, flip) {
    const g = cv.getContext('2d'), s = cv.width / 100;
    cv.shown = c;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const egg = c.name === CM.EGG.name;
    const im = egg ? (eggImg.naturalWidth ? eggImg : null)
      : c.art ? artImage(c.art, () => { if (cv.shown === c) drawCreature(cv, c, flip); }) : null;
    if (im) {
      if (!im.naturalWidth) return;
      g.imageSmoothingEnabled = egg;
      g.setTransform(flip ? -1 : 1, 0, 0, 1, flip ? cv.width : 0, 0);
      const k = Math.min(cv.width / im.naturalWidth, cv.height / im.naturalHeight);
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      g.drawImage(im, (cv.width - w) / 2, cv.height - h, w, h);
      return;
    }
    g.setTransform(flip ? -s : s, 0, 0, s, flip ? cv.width : 0, 0);
    const { color, dark } = ELEMENTS[c.element];
    g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = egg ? '#1c1c28' : dark;
    const ell = (x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fillStyle = fill; g.fill(); g.stroke(); };
    const poly = (pts, fill) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath(); g.fillStyle = fill; g.fill(); g.stroke();
    };
    if (egg) {
      const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
      poly([[24, 99], [27, 72], [40, 62], [60, 62], [73, 72], [76, 99]], '#1d2233');
      poly([[38, 63], [50, 74], [62, 63], [58, 58], [42, 58]], '#c0392b');
      ell(20, 84, 8, 8, '#f3c9a0'); ell(80, 84, 8, 8, '#f3c9a0');
      ell(50, 42, 18, 20, '#f3c9a0');
      poly([[31, 34], [33, 44], [36, 30]], '#3a2a2e'); poly([[69, 34], [67, 44], [64, 30]], '#3a2a2e');
      poly([[31, 36], [26, 20], [36, 25], [37, 9], [46, 19], [52, 5], [57, 19], [67, 10], [65, 25], [75, 21], [69, 36], [62, 28], [50, 31], [38, 28]], '#f08aa0');
      g.lineWidth = 2;
      line(37, 40, 46, 41); line(54, 41, 63, 40);
      line(38, 50, 45, 51); line(55, 51, 62, 50);
      line(45, 56, 55, 56);
      for (const x of [42, 58]) { g.beginPath(); g.arc(x, 45, 2.4, 0, 7); g.fillStyle = '#6b3a1e'; g.fill(); }
      return;
    }
    let eyes, top;
    if (c.shape === 'Beast') {
      poly([[80, 62], [97, 46], [90, 68]], color);
      for (const x of [40, 52, 66, 78]) poly([[x - 4, 74], [x + 4, 74], [x + 4, 90], [x - 4, 90]], dark);
      ell(60, 64, 27, 17, color);
      poly([[20, 38], [18, 18], [31, 31]], color);
      poly([[36, 31], [45, 15], [47, 36]], color);
      ell(32, 48, 18, 16, color);
      eyes = [[25, 46], [38, 46]]; top = [66, 48];
    } else if (c.shape === 'Bird') {
      poly([[72, 62], [96, 54], [92, 74]], dark);
      poly([[44, 80], [44, 92], [38, 92]], '#f5b942');
      poly([[58, 80], [58, 92], [52, 92]], '#f5b942');
      ell(50, 58, 25, 23, color);
      poly([[48, 54], [84, 36], [70, 68]], dark);
      poly([[28, 54], [10, 60], [28, 65]], '#f5b942');
      eyes = [[36, 48]]; top = [50, 36];
    } else if (c.shape === 'Shell') {
      ell(34, 84, 8, 6, dark); ell(74, 84, 8, 6, dark);
      ell(22, 66, 13, 11, color);
      g.beginPath(); g.arc(56, 80, 31, Math.PI, 0); g.closePath(); g.fillStyle = dark; g.fill(); g.stroke();
      g.beginPath(); g.arc(56, 80, 19, Math.PI, 0); g.closePath(); g.fillStyle = color; g.fill(); g.stroke();
      eyes = [[17, 63]]; top = [56, 50];
    } else {
      ell(36, 88, 10, 5, dark); ell(64, 88, 10, 5, dark);
      ell(50, 62, 32, 28, color);
      g.beginPath(); g.arc(46, 70, 7, 0.2, Math.PI - 0.2); g.stroke();
      eyes = [[36, 56], [56, 56]]; top = [50, 35];
    }
    for (const [x, y] of eyes) {
      g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fillStyle = '#fff'; g.fill();
      g.beginPath(); g.arc(x - 1.5, y, 2.6, 0, 7); g.fillStyle = '#1c1c28'; g.fill();
    }
    const [ax, ay] = top;
    g.lineWidth = 2;
    if (c.element === 'Fire') poly([[ax - 8, ay], [ax - 4, ay - 11], [ax, ay - 5], [ax + 4, ay - 18], [ax + 9, ay]], '#ffd24a');
    if (c.element === 'Water') poly([[ax, ay - 18], [ax + 6, ay - 6], [ax, ay], [ax - 6, ay - 6]], '#c9ecff');
    if (c.element === 'Grass') poly([[ax, ay], [ax - 12, ay - 10], [ax + 1, ay - 18], [ax + 5, ay - 8]], '#2f9a3c');
    if (c.element === 'Electric') poly([[ax - 2, ay], [ax + 5, ay - 9], [ax, ay - 9], [ax + 5, ay - 20], [ax - 6, ay - 6], [ax - 1, ay - 6]], '#fff9a8');
    if (c.element === 'Rock') poly([[ax - 9, ay], [ax - 5, ay - 10], [ax, ay - 3], [ax + 5, ay - 13], [ax + 10, ay]], '#6d5a48');
  }

  function drawTile(g, ch, x, y, sx, sy, time) {
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const R = (c, a, b, w, hh) => { g.fillStyle = c; g.fillRect(sx + a, sy + b, w, hh); };
    const blades = (c) => { for (let i = 0; i < 4; i++) { R(c, 2 + i * 8, 6 + ((h >> i) & 3) * 2, 3, 9); R(c, 6 + i * 8, 18 + ((h >> (i + 4)) & 3) * 2, 3, 9); } };
    switch (ch) {
      case '#':
        R('#7ec850', 0, 0, 32, 32); R('#6b4a2b', 13, 20, 6, 11);
        g.fillStyle = '#2f7d3a'; g.beginPath(); g.arc(sx + 16, sy + 13, 13, 0, 7); g.fill();
        g.fillStyle = '#48a653'; g.beginPath(); g.arc(sx + 12, sy + 9, 6, 0, 7); g.fill();
        break;
      case '^': R('#4a4452', 0, 0, 32, 32); R('#5d5666', 2, 2, 28, 12); R('#3a3542', 0, 28, 32, 4); R('#6f6878', 6 + (h & 7), 5, 8, 3); break;
      case '~': R('#3d8fe0', 0, 0, 32, 32); R('#7fc0f5', ((h & 15) + Math.floor(time / 300)) % 24, 8 + (h >> 4 & 7), 8, 2); R('#7fc0f5', ((h >> 8 & 15) + Math.floor(time / 400)) % 24, 22, 6, 2); break;
      case '=': R('#dcc48e', 0, 0, 32, 32); R('#cdb27a', h & 15, 6 + (h >> 4 & 15), 4, 3); break;
      case 'H':
        R('#dcc48e', 0, 0, 32, 32); R('#fff', 3, 3, 26, 26); R('#f2a0b8', 5, 5, 22, 22);
        R('#fff', 14, 8, 4, 16); R('#fff', 8, 14, 16, 4);
        break;
      case ',': R('#7ec850', 0, 0, 32, 32); blades('#3f9a3a'); break;
      case ';': R('#5aa846', 0, 0, 32, 32); blades('#226b33'); break;
      case ':': R('#6b6470', 0, 0, 32, 32); R('#8fd9e8', 5 + (h & 7), 8, 4, 6); R('#8fd9e8', 18 + (h >> 3 & 7), 19, 4, 6); R('#57515c', 12, 4 + (h >> 6 & 15), 5, 3); break;
      case '_': R('#7a7380', 0, 0, 32, 32); R('#6b6470', h & 15, 8 + (h >> 4 & 15), 5, 3); break;
      default: R('#7ec850', 0, 0, 32, 32); R('#6fb845', h & 15, 4 + (h >> 4 & 15), 3, 3); R('#6fb845', 14 + (h >> 8 & 15), h >> 12 & 15, 3, 3);
    }
  }

  function drawPerson(g, sx, sy, shirt, hair, dir) {
    const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(sx + a, sy + b, w, h); };
    R('#0003', 7, 27, 18, 4);
    R('#2c2c3c', 10, 22, 5, 7); R('#2c2c3c', 17, 22, 5, 7);
    R(shirt, 8, 13, 16, 11);
    R('#f3c9a0', 9, 3, 14, 11);
    R(hair, 9, 2, 14, dir === 'up' ? 9 : 4);
    g.fillStyle = '#1c1c28';
    if (dir === 'down') { g.fillRect(sx + 12, sy + 8, 2, 3); g.fillRect(sx + 18, sy + 8, 2, 3); }
    if (dir === 'left') g.fillRect(sx + 11, sy + 8, 2, 3);
    if (dir === 'right') g.fillRect(sx + 19, sy + 8, 2, 3);
  }

  function draw(time) {
    const g = $world.getContext('2d');
    const px = (move ? move.fx + (move.tx - move.fx) * move.t : S.x) * TILE;
    const py = (move ? move.fy + (move.ty - move.fy) * move.t : S.y) * TILE;
    const camX = Math.round(Math.max(0, Math.min(MAP[0].length * TILE - VIEW_W, px - VIEW_W / 2 + 16)));
    const camY = Math.round(Math.max(0, Math.min(MAP.length * TILE - VIEW_H, py - VIEW_H / 2 + 16)));
    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    for (let y = y0; y <= y0 + 11 && y < MAP.length; y++) {
      for (let x = x0; x <= x0 + 15 && x < MAP[0].length; x++) {
        const sx = x * TILE - camX, sy = y * TILE - camY;
        drawTile(g, MAP[y][x], x, y, sx, sy, time);
        const e = entityAt(x, y);
        if (!e) continue;
        if (e.type === 'chest') {
          const opened = S.chests[`${x},${y}`];
          g.fillStyle = '#3a2412'; g.fillRect(sx + 5, sy + 9, 22, 18);
          g.fillStyle = opened ? '#6d5a48' : '#b5772e'; g.fillRect(sx + 7, sy + 11, 18, 14);
          g.fillStyle = opened ? '#3a2412' : '#ffd24a'; g.fillRect(sx + 14, sy + (opened ? 11 : 15), 4, opened ? 5 : 5);
        } else if (e.type === 'prof') {
          drawPerson(g, sx, sy, '#f4f4f4', '#9a9a9a', 'down');
        } else {
          drawPerson(g, sx, sy, e.trainer.champion ? '#7a3fc4' : '#3d6fd0', e.trainer.champion ? '#f1c93a' : '#5a3a1c', 'down');
        }
      }
    }
    drawPerson(g, Math.round(px) - camX, Math.round(py) - camY, '#e0483c', '#3a2412', S.dir);
  }

  // ---------- Input & loop ----------
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase();
    const confirmKey = k === 'enter' || k === ' ' || k === 'z';
    if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    if (advance) { if (confirmKey && !e.repeat) { e.preventDefault(); tryAdvance(); } return; }
    if (!$actions.hidden && k >= '1' && k <= '9') {
      const b = $actions.querySelectorAll('button')[+k - 1];
      if (b) b.click();
      return;
    }
    if (mode === 'world') {
      if (k === 'm' || k === 'escape') return openMenu();
      if (confirmKey && !e.repeat) return interact();
    } else if (mode === 'menu' && k === 'escape') {
      if (forge) { forge = null; renderMenu(); } else closeMenu();
      return;
    }
    keys[k] = true;
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  $dialog.addEventListener('click', tryAdvance);
  $battle.addEventListener('click', tryAdvance);
  $hud.addEventListener('click', () => { if (mode === 'world') openMenu(); });

  let last = 0;
  function frame(time) {
    const dt = Math.min(50, time - last);
    last = time;
    if (S && mode !== 'title') { update(dt); if ($battle.hidden && $menu.hidden) draw(time); }
    requestAnimationFrame(frame);
  }

  function fit() {
    const s = Math.min(innerWidth / 740, innerHeight / 548, 1.75);
    $game.style.transform = `scale(${s})`;
  }
  addEventListener('resize', fit);

  async function start(state) {
    S = state;
    $title.hidden = true;
    mode = 'world';
    draw(0);
    if (!S.intro) {
      await talk([
        'Prof. Willow: Welcome to the world of Creatamon!',
        'Here, creatures are not caught. They are created, forged from Power Cards.',
        'Move cards teach a Creatamon its attacks. Health cards make it tougher.',
        'Common cards are everywhere. Rare and Epic ones take some finding.',
        'Take this starter set and forge your very first Creatamon!',
      ]);
      CM.STARTER_CARDS.forEach((id) => addCard(id));
      S.intro = true;
      save();
      openMenu();
      openForge(null);
    }
  }

  $('btnNew').onclick = () => {
    if (load() && !confirm('Start over? Your saved game will be erased.')) return;
    start(newState());
  };
  $('btnContinue').onclick = () => start(load());
  $('btnContinue').hidden = !load();
  fit();
  requestAnimationFrame(frame);
})();
