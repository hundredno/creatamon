// Battle decisions, made the way a careful player would: from what the battle screen shows (names, levels,
// elements, HP bars, the moves on the buttons) and what the bot remembers of the fight so far.
import { CM } from '../../src/world.js';

const { CARDS } = CM;
const BY_NAME = {};
Object.keys(CARDS).forEach((id) => { BY_NAME[CARDS[id].name] = { id, ...CARDS[id] }; });

// "Lv 32 · Rock · MAX · ATK−1 · PSN" -> { level, element, max, stage: { atk: -1 }, status }
export function parseLv(text) {
  const parts = text.split(' · '), out = { level: parseInt(parts[0].slice(3), 10), element: parts[1], max: false, stage: {}, status: null };
  for (const p of parts.slice(2)) {
    if (p === 'MAX') out.max = true;
    else if (p === 'BRN') out.status = 'burn';
    else if (p === 'PSN') out.status = 'poison';
    else { const m = /^(ATK|DEF|SPD)([+−-])(\d)$/.exec(p); if (m) out.stage[m[1].toLowerCase()] = (m[2] === '+' ? 1 : -1) * +m[3]; }
  }
  return out;
}
// A move button: the card it is, or (for Max moves) what its description says.
export function moveOf(button) {
  const card = BY_NAME[button.name];
  if (card) return card;
  const pow = /Pow (\d+)/.exec(button.desc), acc = /Acc (\d+)%/.exec(button.desc);
  return { name: button.name, element: button.desc.split(' · ')[0], power: pow ? +pow[1] : 0, acc: acc ? +acc[1] : 100 };
}
const total = (m) => (m.power || 0) * (m.hits || 1);
// Health of a Creatamon of a level, as the game builds wild and trainer ones (see CM.spawn), before any extras.
const typicalHp = (lv) => 50 + 6 * (lv - 1) + CM.STAGE_HP[lv >= CM.EVOLVE_AT[1] ? 2 : lv >= CM.EVOLVE_AT[0] ? 1 : 0]
  + (lv >= 14 ? 100 : 0) + (lv >= 30 ? 250 : 0) + (lv >= 44 ? 250 : 0) + 30;
const stageMul = (n) => (n >= 0 ? 1 + 0.25 * n : 1 / (1 - 0.25 * n));

export class BattleBrain {
  constructor(kind, { training = false } = {}) {
    // kind: wild | trainer | alpha | boss | phantom
    Object.assign(this, { kind, training, turn: 0, foeKey: null, cal: 1, seen: [], lastHp: null, incoming: 0, plan: null, used: {}, switched: 0, sentOut: 1 });
  }
  important() { return this.kind !== 'wild'; }

  // Called on each new line of battle text.
  hear(line) {
    if (/ sent out /.test(line)) this.sentOut++;
  }

  // Our side, from the save and the screen.
  me(s, S) {
    const lv = parseLv(s.battle.meLv), c = S.party.find((p) => p.name === s.battle.meName) || S.party[0];
    return { c, ...lv, hp: s.battle.meHp[0], max: s.battle.meHp[1] || 1, frac: s.battle.meHp[0] / (s.battle.meHp[1] || 1) };
  }
  foe(s) {
    const lv = parseLv(s.battle.foeLv), name = s.battle.foeName.replace(/^[✨✦] /, '');
    let hp = typicalHp(lv.level) * (lv.max ? 1.5 : 1);
    if (s.battle.foeAlpha || /^Alpha /.test(name)) hp += 600;
    return { name, ...lv, frac: s.battle.foeHp, hp };
  }
  // Damage of move m from me on foe, as a share of the foe's whole health (before calibration by what we have seen).
  share(m, me, foe) {
    if (!m.power) return 0;
    const st = CM.stats({ ...me.c, level: me.level, boost: me.stage });
    const att = st.atk, def = (10 + foe.level - 1) * stageMul(foe.stage.def || 0);
    const eff = CM.effectiveness(m.element, foe.element), stab = m.element === me.element ? 1.25 : 1;
    const boost = CM.STAGE_DMG[me.c.stage || 0] * (me.c.item === 'gloves' ? 1.2 : 1);
    const dmg = total(m) * (att / def) * (0.4 + 0.06 * me.level) * stab * eff * 0.925 * boost;
    return dmg / foe.hp;
  }
  // How hard the foe can hit us, as a share of our health: what we have seen, or a guess from its level.
  threat(me, foe) {
    if (this.incoming) return this.incoming / me.max;
    const power = foe.level >= 34 ? 110 : foe.level >= 16 ? 75 : 45;
    const st = CM.stats({ ...me.c, level: me.level, boost: me.stage });
    const dmg = power * ((12 + foe.level - 1) / st.def) * (0.4 + 0.06 * foe.level) * 1.25 * CM.effectiveness(foe.element, me.element) * (foe.max ? 1.5 : 1);
    return dmg / me.max;
  }

  // The command screen: fight (with which move), max, switch, bag or run.
  command(s, S) {
    const plan = this.decide(s, S);
    this.lastMove = plan.act === 'fight' ? plan.move : null;
    return plan;
  }
  decide(s, S) {
    this.turn++;
    const me = this.me(s, S), foe = this.foe(s), b = s.actions.buttons;
    const can = (act) => b.some((x) => x.act === act && !x.disabled);
    // Keep track of how hard the foe has been hitting, and how far our hits have moved its bar.
    const key = `${foe.name}|${foe.level}`;
    if (this.foeKey !== key) { this.foeKey = key; this.cal = 1; this.lastFoe = null; this.used = {}; this.switched = 0; }
    if (this.lastMe && this.lastMe.name === me.c.name && me.hp < this.lastMe.hp) this.incoming = Math.max(this.incoming * 0.6, this.lastMe.hp - me.hp);
    if (this.lastFoe != null && this.lastMove && this.lastMove.power) {
      const seen = this.lastFoe - foe.frac, guess = this.share(this.lastMove, me, foe);
      if (seen > 0.005 && guess > 0) this.cal = Math.max(0.25, Math.min(4, seen / guess));
    }
    this.lastMe = { name: me.c.name, hp: me.hp };
    this.lastFoe = foe.frac;
    const moves = (me.c.moves || []).map((id) => ({ id, ...CARDS[id] }));
    const choice = this.pickMove(me, foe, moves);
    const danger = this.threat(me, foe) >= me.frac * 0.95;
    const ko = choice && choice.power && this.share(choice, me, foe) * this.cal >= foe.frac;
    const faster = CM.stats({ ...me.c, level: me.level, boost: me.stage }).spd >= 10 + foe.level - 1 + 3;

    if (this.kind === 'phantom') return { act: 'fight', move: choice };
    // Max Mode: on a Leader's or Cup rival's last Creatamon, or whenever we are in trouble in a battle that allows it.
    if (can('max') && (foe.max || me.frac < 0.6 || this.sentOut >= 3 || foe.level >= me.level + 2) && foe.frac > 0.25) return { act: 'max' };
    // Alphas are far tougher than they look: only take one on with a team that can, and get away when it goes badly.
    if (this.kind === 'alpha' && can('run') && (foe.level > this.best(S) + 2 || (danger && me.frac < 0.5 && !this.bench(S, foe, me.c)))) return { act: 'run' };
    if (danger && !(ko && (faster || choice.first))) {
      const heal = this.healItem(S, me);
      const other = this.bench(S, foe, me.c);
      if (this.kind === 'wild' && !this.training && can('run')) return { act: 'run' };
      if (heal && can('bag') && (this.important() || !other) && (this.used.heals || 0) < 3) {
        this.used.heals = (this.used.heals || 0) + 1;
        return { act: 'bag', item: heal, target: S.party.indexOf(me.c) };
      }
      if (other && can('switch') && this.switched < 2) { this.switched++; return { act: 'switch', to: other.name }; }
      if (this.kind === 'wild' && can('run')) return { act: 'run' };
    }
    // A bad matchup in an important battle: swap in someone better suited, once.
    if (this.important() && !this.switched && can('switch') && CM.effectiveness(foe.element, me.element) > 1 && !(ko && faster)) {
      const other = this.bench(S, foe, me.c, true);
      if (other) { this.switched++; return { act: 'switch', to: other.name }; }
    }
    // Wild Creatamon not worth the time while travelling: run, unless it falls in a hit or two.
    if (this.kind === 'wild' && !this.training && can('run') && choice && this.share(choice, me, foe) * this.cal < foe.frac / 2.2) return { act: 'run' };
    return { act: 'fight', move: choice };
  }

  // The best move now: finish the foe if we can, set up in long fights, otherwise the hardest expected hit.
  pickMove(me, foe, moves) {
    const attacks = moves.filter((m) => m.power), long = this.important() || this.kind === 'alpha';
    const score = (m) => this.share(m, me, foe) * this.cal * Math.min(100, m.acc) / 100;
    const best = attacks.reduce((a, m) => (!a || score(m) > score(a) ? m : a), null);
    if (best && score(best) >= foe.frac) {
      // Several moves would finish it: take the surest, and a first strike if we are in danger.
      const sure = attacks.filter((m) => this.share(m, me, foe) * this.cal >= foe.frac).sort((a, b) => (b.acc - a.acc) || ((b.first ? 1 : 0) - (a.first ? 1 : 0)));
      return sure[0];
    }
    const heal = moves.find((m) => m.heal);
    if (heal && me.frac < 0.4 && this.threat(me, foe) < m2h(heal)) return heal;
    if (long && foe.frac > 0.6 && me.frac > 0.7) {
      const setUp = moves.find((m) => !m.power && m.up && !this.used[m.name] && Object.keys(m.up).some((k) => (me.stage[k] || 0) < 2));
      if (setUp) { this.used[setUp.name] = 1; return setUp; }
      const sicken = moves.find((m) => !m.power && m.inflict && !foe.status && !this.used[m.name]);
      if (sicken && this.kind !== 'wild') { this.used[sicken.name] = 1; return sicken; }
    }
    return best || moves[0];
  }
  best(S) { return Math.max(...S.party.map((c) => c.level)); }
  // A potion worth using now, or null: the smallest one that makes a real difference.
  healItem(S, me) {
    const lack = me.max - me.hp, have = (id) => (S.items[id] || 0) > 0 && (this.spent[id] || 0) < S.items[id];
    const list = [['potion', 60], ['super_potion', 200], ['max_potion', 99999]].filter(([id]) => have(id));
    const good = list.find(([, n]) => Math.min(n, lack) >= Math.max(lack * 0.5, me.max * 0.25)) || list[list.length - 1];
    if (!good) return null;
    this.spent[good[0]] = (this.spent[good[0]] || 0) + 1;
    return good[0];
  }
  get spent() { return this._spent || (this._spent = {}); }
  // Who on the bench would do best against this foe (healthy, not weak to it, able to hit it hard).
  bench(S, foe, current, strict = false) {
    const rate = (c) => {
      const frac = c.hp / CM.maxHp(c);
      const hit = Math.max(...c.moves.map((id) => CARDS[id]).filter((m) => m.power).map((m) => total(m) * CM.effectiveness(m.element, foe.element) * (m.element === c.element ? 1.25 : 1)), 1);
      return frac * hit * c.level / CM.effectiveness(foe.element, c.element);
    };
    const options = S.party.filter((c) => c !== current && c.name !== current.name && c.hp > CM.maxHp(c) * 0.4);
    if (strict) {
      const now = rate(current);
      const better = options.filter((c) => CM.effectiveness(foe.element, c.element) <= 1 && rate(c) > now * 1.3 && c.level >= current.level - 4);
      return better.sort((a, b) => rate(b) - rate(a))[0] || null;
    }
    return options.sort((a, b) => rate(b) - rate(a))[0] || null;
  }
  // Choosing from the party list (after a faint, or to switch): the best one, by the health its button shows.
  // Returns the button, or null if nobody is worth sending out.
  replacement(S, s, buttons, prefer) {
    const foe = this.foe(s);
    const alive = buttons.filter((b) => b.idx != null && !b.disabled).map((b) => {
      const [hp, max] = b.desc.split('/').map((v) => parseInt(v, 10));
      return { b, c: S.party[+b.idx], frac: hp / (max || 1) };
    }).filter((o) => o.c && o.frac > 0);
    const rate = ({ c, frac }) => frac * c.level * Math.max(...c.moves.map((id) => CARDS[id]).filter((m) => m.power)
      .map((m) => total(m) * CM.effectiveness(m.element, foe.element) * (m.element === c.element ? 1.25 : 1)), 1) / CM.effectiveness(foe.element, c.element);
    const wanted = alive.find((o) => o.c.name === prefer && o.frac > 0.4);
    const best = wanted || alive.sort((a, b) => rate(b) - rate(a))[0];
    return best ? best.b : null;
  }
}
const m2h = (m) => m.heal || 0;
