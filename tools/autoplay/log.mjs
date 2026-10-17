// What happened, for the record and for cutting the videos: telemetry.jsonl (events, lines of text, and a sample of
// the save every few seconds) and inputs.jsonl (every key press and click the bot made).
import fs from 'node:fs';
import path from 'node:path';

export class Log {
  constructor(dir, clock) {
    fs.mkdirSync(dir, { recursive: true });
    this.dir = dir;
    this.clock = clock;
    this.t0 = Date.now();
    this.events = fs.createWriteStream(path.join(dir, 'telemetry.jsonl'), { flags: 'a' });
    this.inputs = fs.createWriteStream(path.join(dir, 'inputs.jsonl'), { flags: 'a' });
    this.quiet = false;
  }
  // t: game time (ms) since the run began; wall: real time since the run began.
  stamp() { return { t: Math.round(this.clock()), wall: Date.now() - this.t0 }; }
  event(kind, data = {}) {
    const row = { ...this.stamp(), ...data, kind };
    this.events.write(`${JSON.stringify(row)}\n`);
    if (!this.quiet && !['line', 'sample'].includes(kind)) console.log(`[${fmt(row.t)}] ${kind} ${JSON.stringify(data).slice(0, 160)}`);
  }
  line(text) { this.event('line', { text }); }
  input(kind, what, value) { this.inputs.write(`${JSON.stringify({ ...this.stamp(), kind, what, ...(value != null ? { value } : {}) })}\n`); }
  sample(S) { if (S && S.party) this.event('sample', sampleOf(S)); }
  close() { return Promise.all([this.events, this.inputs].map((s) => new Promise((r) => s.end(r)))); }
}
// The numbers the scoreboard shows, from the save.
export const sampleOf = (S) => ({
  map: S.map, x: S.x, y: S.y, play: Math.round(S.stats.time), badges: Object.keys(S.badges).length, money: S.money,
  alphas: S.alphaWins || 0, wins: S.stats.wins, trainers: S.stats.trainers, champion: !!S.f.champion,
  party: S.party.map((c) => [c.name, c.level, c.element]), trophies: Object.keys(S.trophies).length,
  cards: Object.values(S.cards).reduce((a, b) => a + b, 0) + S.party.reduce((n, c) => n + c.moves.length + c.hpCards.length, 0),
});
export const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
