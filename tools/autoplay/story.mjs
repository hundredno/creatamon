// The story: what to do next, mirroring quest() in game.js (the objective the HUD shows), and how strong the
// opponents waiting there are, so the bot knows when its team is ready.
import { CM } from '../../src/world.js';

const { NPCS, GYMS, TEAMS, MAPS } = CM;
const npc = (id) => NPCS.find((n) => n.id === id);

// The next goal: { text, npc } (go and talk to them), { gym: el }, or { alphas: n } (alpha wins still needed);
// { done: true } once the Champion is beaten.
export function nextGoal(S) {
  const f = S.f, b = S.badges;
  const steps = [
    [!S.party.length, { forge: true }],
    [!f.rival1, { npc: 'finn_home' }],
    [!f.grove, { npc: 'beast' }],
    [!f.endorsed, { npc: 'finn_wedge' }],
    [!f.ceremony, { npc: 'staff' }],
    ...['Grass', 'Water'].map((el) => [!b[el], { gym: el }]),
    [!b.Fire && !f.nettie1 && b.Water, { npc: 'nettie_kiln' }],
    ...['Fire', 'Wind', 'Rock'].map((el) => [!b[el], { gym: el }]),
    [!f.mural, { npc: 'cyril_mural' }],
    ...['Electric', 'Metal'].map((el) => [!b[el], { gym: el }]),
    [!f.rival3, { npc: 'finn_r7' }],
    [!b.Ice, { gym: 'Ice' }],
    [!f.surf, { npc: 'wren_bath' }],
    [!b.Shadow && !f.holler, { npc: 'holler_gate' }],
    [!b.Shadow && !f.nettie2, { npc: 'nettie_thorn' }],
    ...['Shadow', 'Mind', 'Robot', 'Light', 'Toxic', 'Normal'].map((el) => [!b[el], { gym: el }]),
    [!f.semis, { npc: 'registrar' }],
    [!f.opaline, { npc: 'opaline' }],
    [!f.night, { npc: 'registrar' }],
    [!f.blade, { npc: 'altar' }],
    [!f.sterling, { npc: 'sterling' }],
    [!f.dawn, { npc: 'eternox' }],
    [CM.alphaRank(S.alphaWins) < CM.CUP_RANK, { alphas: CM.ALPHA_NEED[CM.CUP_RANK - 1] - (S.alphaWins || 0) }],
    [!f.champion, { npc: 'registrar' }],
  ];
  const next = steps.find((st) => st[0]);
  return next ? next[1] : { done: true };
}

// Where a goal is: [map, x, y] of the person to talk to.
export function placeOf(goal) {
  if (goal.npc) { const n = npc(goal.npc); return [n.map, n.x, n.y]; }
  if (goal.gym) return [`gym_${goal.gym}`, ...MAPS[`gym_${goal.gym}`].leader];
  return null;
}

// The level of the strongest Creatamon waiting at a goal (0 if there is no battle).
const STORY = {
  finn_home: ['finn1'], finn_wedge: ['finn2'], cyril_mine: ['cyril1'], nettie_kiln: ['nettie1'], cyril_mural: ['cyril2'], finn_r7: ['finn3'],
  holler_gate: ['holler'], nettie_thorn: ['nettie2'], opaline: ['opaline'], sterling: ['sterling'], eternox: ['eternox1', 'eternox2'],
};
export function foeLevel(S, goal) {
  const top = (keys) => Math.max(0, ...keys.flatMap((k) => TEAMS[k].map((t) => t[1])));
  if (goal.gym) return Math.max(...GYMS.find((g) => g.el === goal.gym).team.map((t) => t[1]));
  if (goal.npc === 'registrar') {
    if (!S.f.semis) return top(['nettie3', 'finn4']);
    if (!S.f.night) return top(['cyril3', 'marina2', 'gneiss2', 'brann2']);
    return top(['vex']);
  }
  if (STORY[goal.npc]) return top(STORY[goal.npc]);
  const n = goal.npc && npc(goal.npc);
  return n && n.team ? Math.max(...n.team.map((t) => t[1])) : 0;
}
// How many battles in a row the goal holds before any healing.
export function chainOf(goal) {
  if (goal.gym) return GYMS.find((g) => g.el === goal.gym).trainers.length + 1;
  return 1;
}
