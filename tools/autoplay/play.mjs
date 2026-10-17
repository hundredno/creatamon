// Autoplay: a bot plays Creatamon in Chrome through the keyboard and mouse, and optionally records it.
//
//   npm run autoplay -- [--turbo] [--record] [--from save.json] [--until ...] [--out dir] [--wall minutes] [--headed]
//
//   --turbo   practice run: the game's clock runs as fast as the page can draw (flat 2D view, no sound, no recording)
//   --record  real-time run in the 3D view, recorded with its sound into <out>/master.mkv (see record.mjs)
//   --from    start from a saved game (practice only: a recording always starts from New Game)
//   --until   badges=N | champion | alphas=N | minutes=N, or by default champion-i: the Champion beaten, the title
//             Champion I, and the whole party at the level limit
//   --wall    stop after this many real minutes; --port / --url: where the game is served; --name: the player's name
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { CM } from '../../src/world.js';
import { Game } from './game.mjs';
import { Brain } from './brain.mjs';
import { Log } from './log.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const turbo = !!opt('turbo'), record = !!opt('record');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const out = path.resolve(opt('out', path.join(ROOT, 'recordings', `${stamp}${turbo ? '-turbo' : ''}`)));
const until = String(opt('until', 'champion-i'));
const port = +opt('port', 4317);

// When to stop: a number of badges, the Champion beaten, a Champion rank title, or a time limit.
const stopAt = (S, minutes) => {
  if (!S) return false;
  const [what, n] = until.split('=');
  if (what === 'badges') return CM.badgeCount(S) >= +n;
  if (what === 'champion') return !!S.f.champion;
  if (what === 'champion-i') return !!S.f.champion && CM.title(S.alphaWins, true).startsWith('Champion') && S.party.every((c) => c.level >= CM.levelCap(14));
  if (what === 'alphas') return (S.alphaWins || 0) >= +n;
  if (what === 'minutes') return minutes >= +n;
  return false;
};

async function serve() {
  if (opt('url')) return { url: opt('url'), stop: () => {} };
  execSync('npx vite build', { cwd: ROOT, stdio: 'ignore' });
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url)).ok) break; } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url, stop: () => { try { process.kill(-proc.pid); } catch (e) { /* gone */ } } };
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({
    channel: 'chrome', headless: !opt('headed'),
    // Real time runs on the GPU (the Intel one here: the kind of graphics the spec targets). Turbo draws the flat view on the CPU.
    args: turbo ? ['--disable-webgl'] : ['--enable-gpu', '--use-angle=gl', '--autoplay-policy=no-user-gesture-required'],
    ignoreDefaultArgs: record ? ['--mute-audio'] : [],
  });
  // The screencast delivers frames at the page's CSS size, so a recording uses a 1920x1080 page: the game box is then
  // 1260x924, its largest scale.
  const context = await browser.newContext({ viewport: record ? { width: 1920, height: 1080 } : { width: 1280, height: 720 } });
  if (opt('from')) {
    // Practice runs may start part-way through, from a checkpoint an earlier run saved.
    const save = fs.readFileSync(path.resolve(opt('from')), 'utf8');
    await context.addInitScript((s) => { if (!sessionStorage.getItem('loaded')) { sessionStorage.setItem('loaded', '1'); localStorage.setItem('creatamon-save-v1', s); } }, save);
  }
  const page = await context.newPage();
  let log = null;
  const game = new Game(page, { turbo });
  log = new Log(out, () => game.clock());
  game.log = log;
  page.on('pageerror', (e) => log.event('error', { message: e.message }));
  page.on('console', (m) => { if (m.type() === 'error') log.event('console', { text: m.text() }); });
  page.on('dialog', async (d) => {
    log.event('alert', { message: d.message() });
    if (!turbo) await new Promise((r) => setTimeout(r, 700));
    await d.accept();
  });
  if (turbo) {
    await page.clock.install();
    // Frames every 50 ms of game time (the most the game's own frame step allows), so the clock can run ahead quickly.
    await context.addInitScript(() => { window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 50); });
  }
  let recorder = null;
  if (record) {
    const { Recorder } = await import('./record.mjs');
    recorder = new Recorder(page, out, log);
    await recorder.prepare();
  }
  await page.goto(server.url);
  if (turbo) await page.clock.pauseAt(Date.now() + 1000);
  if (recorder) await recorder.start();
  log.event('start', { turbo, record, from: opt('from') || null, until, url: server.url });

  const brain = new Brain(game, log, { resume: !!opt('from'), name: opt('name', 'Robin'), stop: (S) => stopAt(S, game.clock() / 60000) });
  const t0 = Date.now();
  let sampled = -1e9, badges = -1, flags = -1, reason = 'done';
  try {
    for (;;) {
      const before = game.clock();
      await brain.step();
      // In turbo the game only moves on when the bot waits: never let a step pass without some time going by.
      if (game.clock() === before) await game.wait(30);
      const S = game.last && game.last.save;
      if (game.clock() - sampled > 5000) { sampled = game.clock(); log.sample(S); }
      // A clap for lining up sound and picture: as soon as there is sound, then every ten minutes.
      if (recorder && game.clock() - (recorder.clappedAt ?? -1e9) > (+opt('clap-every') || 600000) && await recorder.clap()) recorder.clappedAt = game.clock();
      if (S && (CM.badgeCount(S) !== badges || Object.keys(S.f).length !== flags)) {
        // A checkpoint at every badge and story step, for practice runs to start from.
        badges = CM.badgeCount(S); flags = Object.keys(S.f).length;
        fs.mkdirSync(path.join(out, 'checkpoints'), { recursive: true });
        fs.writeFileSync(path.join(out, 'checkpoints', `b${String(badges).padStart(2, '0')}-f${String(flags).padStart(2, '0')}.json`), JSON.stringify(S));
      }
      if (brain.finished || stopAt(S, game.clock() / 60000)) break;
      if (brain.stuck >= 5) { reason = 'stuck'; break; }
      if (opt('wall') && Date.now() - t0 > +opt('wall') * 60000) { reason = 'wall clock limit'; break; }
    }
  } catch (e) {
    reason = `error: ${e.message}`;
    log.event('crash', { message: e.message, stack: e.stack });
    await page.screenshot({ path: path.join(out, 'crash.png') }).catch(() => {});
  }
  const S = game.last && game.last.save;
  // The last change (often the very thing the run stopped for) can come between two samples.
  log.sample(S);
  if (recorder) await recorder.stop();
  const audit = fairPlay(S);
  fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify({ reason, ...audit }, null, 2));
  if (S) fs.writeFileSync(path.join(out, 'final-save.json'), JSON.stringify(S));
  log.event('end', { reason, ...audit, wall: Date.now() - t0 });
  await page.screenshot({ path: path.join(out, 'final.png') }).catch(() => {});
  await log.close();
  await browser.close();
  server.stop();
  console.log(`\n${reason}. Output in ${out}`);
}

// Checks, on the final save, that the run was played straight: no developer tools, no easter egg, no secret cards.
function fairPlay(S) {
  if (!S) return { fair: false, why: 'no save' };
  const all = [...S.party, ...S.storage];
  const checks = {
    devModeNeverOpened: S.dev == null,
    noEasterEgg: !all.some((c) => CM.isEgg(c) || c.name.trim() === CM.EGG.name),
    noSecretCards: !Object.keys(S.cards).some((id) => S.cards[id] > 0 && CM.CARDS[id].tier === CM.SECRET) && !all.some((c) => c.moves.some((id) => CM.CARDS[id].tier === CM.SECRET)),
  };
  return {
    fair: Object.values(checks).every(Boolean), checks,
    badges: CM.badgeCount(S), champion: !!S.f.champion, alphaWins: S.alphaWins || 0, title: CM.title(S.alphaWins, S.f.champion),
    levels: S.party.map((c) => c.level), playTimeMs: Math.round(S.stats.time), wins: S.stats.wins,
  };
}

main();
