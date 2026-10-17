// Cuts the videos from a recorded run (master.mkv + telemetry.jsonl):
//   youtube.mp4  1920x1080  the whole run in order, nothing skipped: key moments at 1x, the rest sped up (marked ×N),
//                           with a scoreboard down the side; about --minutes long (default 13)
//   short.mp4    1080x1920  under a minute: the run's highlights, for YouTube Shorts
//   x.mp4        1080x1080  about a minute: the same story, square, for X
//   thumbnail.jpg, upload-notes.md (titles, descriptions, YouTube chapters)
//
//   npm run video -- recordings/<run> [--minutes 13] [--only youtube|short|x]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CM } from '../../src/world.js';
import { recordMusic } from './music.mjs';
import { sampleOf } from './log.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const RUN = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const WORK = path.join(RUN, 'edit');
const ASSETS = path.join(ROOT, 'recordings', 'assets');
const FPS = 60;
// Where the game sits in the 1920x1080 recording (see play.mjs: the game box at its largest, centred).
const BOX = { x: 330, y: 78, w: 1260, h: 924 };
const FONT = 'Noto Sans';
// Every video comes out as standard HD: BT.709 at limited range, and says so. The master is full range BT.601, since
// Chrome's screencast frames are JPEGs, and players that ignore those tags show the colours shifted.
const HD = 'scale=out_range=tv:out_color_matrix=bt709,format=yuv420p';
const HD_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
// Where the game is played.
const SITE = 'cmon.maize.live';
const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a.flat()], { stdio: ['ignore', 'ignore', 'inherit'] });
const probe = (file) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString();
// The party's highest level, or a dash before the first Creatamon is forged.
const topLevel = (party) => (party && party.length ? `${Math.max(...party.map((p) => p[1]))}` : '—');
const clock = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor(s / 60) % 60).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`; };

// ---------- What happened when, in seconds of the master ----------
function readRun() {
  const rows = fs.readFileSync(path.join(RUN, 'telemetry.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const vs = rows.find((r) => r.kind === 'video_start');
  const at = (r) => (r.wall - vs.wall) / 1000;
  const lines = rows.filter((r) => r.kind === 'line').map((r) => ({ t: at(r), text: r.text }));
  const samples = rows.filter((r) => r.kind === 'sample').map((r) => ({ ...r, t: at(r) }));
  const events = rows.filter((r) => !['line', 'sample'].includes(r.kind)).map((r) => ({ ...r, t: at(r) }));
  const duration = probe(path.join(RUN, 'master.mkv'));
  // End on the final save: the run's last change can come after the last sample (in recordings made before play.mjs
  // took a sample at the end, the title Champion I came 2 s after it). It shows from the last line of text on.
  const saved = path.join(RUN, 'final-save.json');
  if (fs.existsSync(saved) && samples.length) {
    const t = Math.min(duration, Math.max(samples[samples.length - 1].t, lines.length ? lines[lines.length - 1].t : 0));
    samples.push({ ...sampleOf(JSON.parse(fs.readFileSync(saved, 'utf8'))), t });
  }
  const find = (re) => lines.filter((l) => re.test(l.text));
  return { rows, lines, samples, events, duration, find };
}

// Moments worth seeing at (or near) real speed: [from, to, speed, label]. Sized so that, for a run of a few hours,
// they fill a little over half of a 13-minute video and the rest of the run fits the remainder.
function keyMoments(run) {
  const out = [];
  const add = (t, before, after, speed, label) => out.push([Math.max(0, t - before), Math.min(run.duration, t + after), speed, label]);
  const first = (re) => run.find(re)[0];
  // The start: the character and the first Creatamon.
  add(0, 0, 20, 1, 'start');
  const forged = run.events.find((e) => e.kind === 'forge');
  if (forged) add(forged.t, 18, 6, 1, 'first forge');
  const finn = first(/^Finn wants to battle!/);
  if (finn) add(finn.t, 2, 25, 2, 'first battle');
  // Every badge: the last blows of the Leader battle, and the badge itself.
  for (const l of run.find(/^You received the \w+ Badge/)) add(l.t, 10, 4, 1, 'badge');
  // Gym puzzles at four times speed.
  for (const e of run.events.filter((e) => e.kind === 'puzzle_plan' && e.key === 'leader')) add(e.t, 1, 24, 4, 'puzzle');
  // Story set pieces.
  for (const re of [/^The fog closes in/, /^Two great wolves bound/, /^Eternox bursts into light/]) {
    const l = first(re);
    if (l) add(l.t, 6, 10, 1, 'story');
  }
  // The Cup final, cut short by the Blackest Night: from Vex walking out to the sky turning black.
  const night = first(/^Champion Vex walks out/), sky = first(/^The sky turns black/);
  if (night) add(night.t, 2, sky ? sky.t - night.t + 8 : 24, 1, 'story');
  // The Champion battle, from the stadium filling three days later.
  const champ = first(/is the new Champion of Galdra!$/), rematch = first(/^Three days later, the stadium/);
  if (champ) add(champ.t, rematch && rematch.t < champ.t ? Math.min(90, champ.t - rematch.t + 1) : 45, 8, 1, 'champion');
  // The headline ranks: entry to the Cup, the top tier, and the Champion title.
  for (const l of run.find(/^Your Champion rank rose to (Warlord I|Mythic I|Champion I)!$/)) add(l.t, 8, 3, 1, 'rank');
  // The end: the final title and level.
  add(run.duration, 25, 0, 1, 'end');
  return out;
}

// The cut: consecutive stretches of the master, each with a speed. `target` is the output length in seconds.
export function plan(run, target) {
  const n = Math.ceil(run.duration);
  const speed = new Float64Array(n).fill(Infinity);
  for (const [a, b, k] of keyMoments(run)) for (let s = Math.floor(a); s < Math.min(n, Math.ceil(b)); s++) speed[s] = Math.min(speed[s], k);
  // Everything else goes at one fast speed, chosen to land on the target length (at most 64x).
  const slow = [...speed].filter(Number.isFinite), fast = n - slow.length;
  let slowOut = slow.reduce((sum, k) => sum + 1 / k, 0);
  // If the key moments alone are too long, speed them up evenly.
  let squeeze = 1;
  if (slowOut > target * 0.75) { squeeze = slowOut / (target * 0.75); slowOut = target * 0.75; }
  const F = Math.min(64, Math.max(4, fast / Math.max(1, target - slowOut)));
  const segs = [];
  for (let s = 0; s < n; s++) {
    const k = Number.isFinite(speed[s]) ? speed[s] * squeeze : F;
    const last = segs[segs.length - 1];
    if (last && Math.abs(last.k - k) < 1e-6) last.b = s + 1; else segs.push({ a: s, b: s + 1, k });
  }
  segs[segs.length - 1].b = Math.min(segs[segs.length - 1].b, run.duration);
  // Output times.
  let t = 0;
  for (const g of segs) { g.out = t; t += (g.b - g.a) / g.k; }
  return { segs, length: t, fast: F, squeeze };
}
// Where a moment of the master lands in the cut.
const outTime = (cut, t) => { const g = cut.segs.find((s) => t >= s.a && t < s.b) || cut.segs[cut.segs.length - 1]; return g.out + (Math.min(t, g.b) - g.a) / g.k; };

// ---------- Rendering ----------
// One stretch of the master at a speed: the picture, and either its own sound (up to 3x) or a piece of the music bed.
function renderSegment(g, i, bedFile, bedLen) {
  const len = g.b - g.a, outLen = len / g.k;
  const own = g.k <= 3.01;
  // Named after what is in it (sped-up stretches take their music from where they land), so a changed cut never
  // reuses a stale stretch.
  const file = path.join(WORK, `seg${String(i).padStart(4, '0')}-${g.a}-${g.b}-${+g.k.toFixed(4)}${own ? '' : `-${g.out.toFixed(2)}`}.mkv`);
  if (fs.existsSync(file)) return file;
  const video = `setpts=(PTS-STARTPTS)/${g.k},fps=${FPS}`;
  const fade = Math.min(0.08, outLen / 4);
  const audio = own
    ? `${g.k > 1 ? `atempo=${g.k},` : ''}aresample=48000,afade=t=in:d=${fade},afade=t=out:st=${Math.max(0, outLen - fade)}:d=${fade}`
    : `aresample=48000,afade=t=in:d=0.3,afade=t=out:st=${Math.max(0, outLen - 0.3)}:d=0.3`;
  const inputs = own ? ['-ss', g.a.toFixed(3), '-t', len.toFixed(3), '-i', path.join(RUN, 'master.mkv')]
    : ['-ss', g.a.toFixed(3), '-t', len.toFixed(3), '-i', path.join(RUN, 'master.mkv'), '-stream_loop', '-1', '-ss', (g.out % bedLen).toFixed(3), '-i', bedFile];
  ff(inputs, '-filter_complex', `[0:v]${video}[v];[${own ? 0 : 1}:a]${audio},atrim=0:${outLen.toFixed(3)}[a]`, '-map', '[v]', '-map', '[a]',
    '-t', outLen.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', file);
  return file;
}

// The scoreboard and captions, as an ASS subtitle file over the cut.
function scoreboard(run, cut) {
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Label,${FONT},22,&H00B8A9A0,&H0,&H0,&H0,1,0,0,0,100,100,2,0,1,0,0,7,0,0,0,1
Style: Value,${FONT},40,&H00FFFFFF,&H0,&H0,&H0,1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Small,${FONT},26,&H00FFFFFF,&H0,&H0,&H0,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Title,${FONT},46,&H00FFFFFF,&H0,&H0,&H0,1,0,0,0,100,100,3,0,1,0,0,7,0,0,0,1
Style: Speed,${FONT},64,&H004F38E8,&H0,&H0,&H0,1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const ts = (s) => { s = Math.max(0, s); const cs = Math.round(s * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
  const ev = [];
  const put = (a, b, style, x, y, text) => { if (b > a) ev.push(`Dialogue: 0,${ts(a)},${ts(b)},${style},,0,0,0,,{\\pos(${x},${y})}${text}`); };
  const end = cut.length;
  // Left: the title, and which part of the story this is.
  put(0, end, 'Title', 36, 110, 'CREATAMON');
  put(0, end, 'Small', 38, 172, 'One run from New Game,\\Nplayed by a bot.\\NNo cheats, no cuts.');
  put(0, end, 'Label', 38, 950, 'PLAY IT FREE');
  put(0, end, 'Value', 38, 976, SITE);
  const chapters = chapterList(run, cut);
  chapters.forEach((c, i) => {
    const b = i + 1 < chapters.length ? chapters[i + 1].out : end;
    put(c.out, b, 'Label', 38, 330, 'NOW');
    put(c.out, b, 'Small', 38, 362, c.name.replace(/ · /, '\\N'));
  });
  // Right: the scoreboard, refreshed from the save every few seconds.
  const X = 1626;
  const rows = run.samples;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], a = outTime(cut, r.t), b = i + 1 < rows.length ? outTime(cut, rows[i + 1].t) : end;
    if (b - a < 0.05) continue;
    const title = CM.title(r.alphas, r.champion) || 'Unranked';
    const lines = [['PLAY TIME', clock(r.play / 1000)], ['BADGES', `${r.badges} / 14`], ['TOP LEVEL', topLevel(r.party)],
      ['CHAMPION RANK', title], ['ALPHAS BEATEN', `${r.alphas}`], ['BATTLES WON', `${r.wins}`]];
    lines.forEach(([k, v], j) => { put(a, b, 'Label', X, 100 + j * 96, k); put(a, b, 'Value', X, 124 + j * 96, v); });
    put(a, b, 'Label', X, 690, 'TEAM');
    r.party.slice(0, 3).forEach((p, j) => put(a, b, 'Small', X, 720 + j * 34, `${p[0]} · Lv ${p[1]}`));
  }
  // The speed marker, whenever the picture is not at real speed.
  for (const g of cut.segs) {
    const b = g.out + (g.b - g.a) / g.k;
    put(g.out, b, 'Speed', X, 900, g.k > 1.01 ? `▶▶ ×${g.k >= 10 ? Math.round(g.k) : g.k.toFixed(g.k % 1 ? 1 : 0)}` : '');
    put(g.out, b, 'Label', X, 980, g.k > 1.01 ? 'SPED UP · NOTHING SKIPPED' : 'REAL TIME');
  }
  const file = path.join(WORK, 'youtube.ass');
  fs.writeFileSync(file, head + ev.join('\n') + '\n');
  return file;
}

// YouTube chapters: the start, then every badge and the big story moments.
function chapterList(run, cut) {
  const list = [{ out: 0, name: 'New game · Hearthwick' }];
  const badgeAt = run.find(/^You received the (\w+) Badge/);
  CM.GYM_ORDER.forEach((el, n) => {
    // A chapter for each gym starts when the previous badge was won.
    const from = n ? badgeAt[n - 1] : run.find(/^Finn wants to battle!/)[0];
    if (from) list.push({ out: outTime(cut, from.t + (n ? 8 : 0)), name: `Gym ${n + 1} · ${CM.GYMS[n].town} (${el})` });
  });
  const add = (re, name, before = 0) => { const l = run.find(re)[0]; if (l) list.push({ out: outTime(cut, l.t - before), name }); };
  add(/^Every badge in Galdra!/, 'The Champion Cup');
  // The Cup final ends as soon as Vex walks out: the Blackest Night falls.
  add(/^Champion Vex walks out/, 'The Blackest Night', 2);
  add(/^Eternox bursts into light/, 'Dawn · hunting alphas for rank');
  add(/^Three days later, the stadium/, 'Champion Vex');
  add(/is the new Champion of Galdra!$/, 'Champion · climbing the ranks');
  list.sort((a, b) => a.out - b.out);
  // YouTube wants chapters at least 10 s apart.
  return list.filter((c, i) => i === 0 || c.out - list[i - 1].out >= 10);
}

async function youtube(run, minutes) {
  const cut = plan(run, minutes * 60);
  console.log(`YouTube cut: ${cut.segs.length} stretches, ${clock(cut.length)} long, fast parts at ×${cut.fast.toFixed(1)}${cut.squeeze > 1 ? `, key moments ×${cut.squeeze.toFixed(2)}` : ''}`);
  const bed = path.join(ASSETS, 'music-world.wav'), bedLen = probe(bed);
  const parts = cut.segs.map((g, i) => renderSegment(g, i, bed, bedLen));
  fs.writeFileSync(path.join(WORK, 'parts.txt'), parts.map((f) => `file '${f}'`).join('\n'));
  ff('-f', 'concat', '-safe', '0', '-i', path.join(WORK, 'parts.txt'), '-c', 'copy', path.join(WORK, 'youtube-raw.mkv'));
  const ass = scoreboard(run, cut);
  // Panels over the dark margins (hiding the recorder's clap mark too), the scoreboard on top, sound at -14 LUFS.
  const panels = `drawbox=x=0:y=0:w=${BOX.x - 14}:h=1080:color=0x1d2437:t=fill,drawbox=x=${BOX.x + BOX.w + 14}:y=0:w=${1920 - BOX.x - BOX.w - 14}:h=1080:color=0x1d2437:t=fill,`
    + `drawbox=x=0:y=0:w=${BOX.x - 14}:h=8:color=0xe8384f:t=fill,drawbox=x=${BOX.x + BOX.w + 14}:y=0:w=${1920 - BOX.x - BOX.w - 14}:h=8:color=0xe8384f:t=fill`;
  ff('-i', path.join(WORK, 'youtube-raw.mkv'), '-vf', `${HD},${panels},ass=${ass}`, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS), HD_TAGS,
    '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', path.join(RUN, 'youtube.mp4'));
  return { cut, chapters: chapterList(run, cut) };
}

// The Champion's last Creatamon fainting: the run's big moment. (Lines are logged as shown: the speaker's name runs
// straight into what they say.)
function finalBlow(run) {
  const won = run.find(/^Champion Vex:? ?\.\.\.My unbeaten run ends here/)[0];
  return won && run.find(/^Champion Vex's .+ fainted!$/).filter((l) => l.t < won.t).pop();
}

// ---------- Short and X: highlights ----------
// Clips: [master time, seconds, caption].
function highlights(run, long) {
  const clips = [];
  const at = (re, before, len, caption) => { const l = run.find(re)[0]; if (l) clips.push([l.t - before, len, caption]); return !!l; };
  // Hook: the final blow against the Champion, else the last badge.
  const blow = finalBlow(run);
  if (blow) clips.push([blow.t - 2.5, 4, 'Can a bot beat the Champion?']);
  else {
    const last = run.find(/^You received the \w+ Badge/).pop();
    if (last) clips.push([last.t - 4, 4, 'A bot plays Creatamon']);
  }
  const forged = run.events.find((e) => e.kind === 'forge');
  if (forged) clips.push([forged.t - 3, long ? 4 : 3, 'It builds its own team at the Forge']);
  at(/^Finn wants to battle!/, -6, long ? 4 : 3, 'and battles its way through the story');
  run.find(/^You received the (\w+) Badge/).forEach((l, i) => {
    const el = /the (\w+) Badge/.exec(l.text)[1];
    clips.push([l.t - (long ? 2.6 : 2.0), long ? 2.6 : 1.9, `Badge ${i + 1} of 14 · ${el}`]);
  });
  at(/^Two great wolves bound/, 1, long ? 5 : 3.5, 'saves Galdra from Eternox');
  const rank = run.find(/^Your Champion rank rose to Warlord I!$/)[0];
  if (rank) clips.push([rank.t - 2, 3, 'climbs the alpha ranks']);
  at(/is the new Champion of Galdra!$/, 1, long ? 5 : 4, 'and becomes Champion');
  const lastRank = run.find(/^Your Champion rank rose to/).pop();
  if (lastRank) clips.push([lastRank.t - 1, 3.5, /rose to (.+)!$/.exec(lastRank.text)[1]]);
  return clips.filter(([t]) => t >= 0 && t < run.duration - 1);
}
async function montage(run, kind) {
  const square = kind === 'x', W = 1080, H = square ? 1080 : 1920;
  const clips = highlights(run, square);
  const gameH = Math.round(BOX.h * W / BOX.w), gameY = square ? 150 : 420;
  const parts = clips.map(([t, len], i) => {
    const file = path.join(WORK, `${kind}${String(i).padStart(2, '0')}.mkv`);
    ff('-ss', t.toFixed(3), '-t', len.toFixed(3), '-i', path.join(RUN, 'master.mkv'), '-vf', `crop=${BOX.w}:${BOX.h}:${BOX.x}:${BOX.y},scale=${W}:${gameH}:out_range=tv:out_color_matrix=bt709,fps=${FPS},setpts=PTS-STARTPTS`,
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', HD_TAGS, file);
    return file;
  });
  fs.writeFileSync(path.join(WORK, `${kind}.txt`), parts.map((f) => `file '${f}'`).join('\n'));
  const joined = path.join(WORK, `${kind}-raw.mkv`);
  ff('-f', 'concat', '-safe', '0', '-i', path.join(WORK, `${kind}.txt`), '-c', 'copy', joined);
  const len = probe(joined);
  // Captions above, the score so far below; a red bar like the title screen's.
  const ts = (s) => { const cs = Math.round(s * 100); return `0:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
  const ev = [];
  let t = 0;
  // The score at each clip: from the save sample nearest after it.
  const scoreAt = (mt) => run.samples.find((r) => r.t >= mt) || run.samples[run.samples.length - 1];
  clips.forEach(([mt, l, caption]) => {
    ev.push(`Dialogue: 0,${ts(t)},${ts(t + l)},Cap,,0,0,0,,{\\an5\\pos(540,${square ? 75 : 300})}${caption}`);
    const r = !square && scoreAt(mt + l);
    if (r) {
      const cols = [['BADGES', `${r.badges}/14`], ['TOP LEVEL', topLevel(r.party)], ['RANK', CM.title(r.alphas, r.champion) || '—']];
      cols.forEach(([k, v], i) => {
        const x = 180 + i * 360;
        ev.push(`Dialogue: 0,${ts(t)},${ts(t + l)},Label,,0,0,0,,{\\an5\\pos(${x},1290)}${k}`);
        ev.push(`Dialogue: 0,${ts(t)},${ts(t + l)},Big,,0,0,0,,{\\an5\\pos(${x},1360)}${v}`);
      });
    }
    t += l;
  });
  ev.push(`Dialogue: 0,${ts(0)},${ts(len)},Brand,,0,0,0,,{\\an5\\pos(540,${square ? 1020 : 1620})}CREATAMON`);
  ev.push(`Dialogue: 0,${ts(0)},${ts(len)},Note,,0,0,0,,{\\an5\\pos(540,${square ? 1060 : 1700})}One run · no cheats · play free at ${SITE}`);
  const ass = path.join(WORK, `${kind}.ass`);
  fs.writeFileSync(ass, `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 0\n\n[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${FONT},${square ? 50 : 66},&H00FFFFFF,&H0,&H00372419,&H0,1,0,0,0,100,100,0,0,1,4,0,5,40,40,0,1
Style: Brand,${FONT},${square ? 44 : 72},&H00FFFFFF,&H0,&H0,&H0,1,0,0,0,100,100,6,0,1,0,0,5,0,0,0,1
Style: Note,${FONT},${square ? 26 : 36},&H00B8A9A0,&H0,&H0,&H0,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: Label,${FONT},30,&H00B8A9A0,&H0,&H0,&H0,1,0,0,0,100,100,3,0,1,0,0,5,0,0,0,1
Style: Big,${FONT},${square ? 40 : 64},&H00FFFFFF,&H0,&H0,&H0,1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${ev.join('\n')}\n`);
  const bed = path.join(ASSETS, 'music-battle.wav');
  const out = path.join(RUN, `${kind === 'x' ? 'x' : 'short'}.mp4`);
  ff('-f', 'lavfi', '-i', `color=c=0x1d2437:s=${W}x${H}:r=${FPS}:d=${len.toFixed(3)}`, '-i', joined, '-stream_loop', '-1', '-i', bed,
    '-filter_complex', `[0:v]drawbox=x=0:y=${gameY - 12}:w=${W}:h=6:color=0xe8384f:t=fill,drawbox=x=0:y=${gameY + gameH + 6}:w=${W}:h=6:color=0xe8384f:t=fill[bg];`
      + `[bg][1:v]overlay=0:${gameY}:shortest=1,ass=${ass}[v];[2:a]atrim=0:${len.toFixed(3)},afade=t=out:st=${(len - 1.2).toFixed(3)}:d=1.2,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
    '-map', '[v]', '-map', '[a]', '-t', len.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', HD_TAGS,
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', out);
  return { len, clips };
}

function thumbnail(run) {
  // The Champion's last Creatamon just before the final blow, else the last Leader battle.
  const blow = finalBlow(run), badge = run.find(/^You received the \w+ Badge/).pop();
  const t = blow ? blow.t - 2 : badge ? badge.t - 6 : run.duration / 2;
  const ass = path.join(WORK, 'thumb.ass');
  fs.writeFileSync(ass, `[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\n\n[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Big,${FONT},92,&H00FFFFFF,&H0,&H00372419,&H0,1,0,0,0,100,100,2,0,1,8,0,5,0,0,0,1
\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.00,0:00:10.00,Big,,0,0,0,,{\\an5\\pos(640,600)}ONE RUN · NO CHEATS\n`);
  // The top of the game box, clear of the dialog box.
  ff('-ss', t.toFixed(3), '-i', path.join(RUN, 'master.mkv'), '-frames:v', '1', '-vf', `crop=${BOX.w}:${BOX.h}:${BOX.x}:${BOX.y},scale=1280:-1,crop=1280:720:0:0,ass=${ass}`,
    '-q:v', '2', path.join(RUN, 'thumbnail.jpg'));
}

function notes(run, yt, short, x) {
  const final = run.samples[run.samples.length - 1] || {};
  const title = CM.title(final.alphas, final.champion) || 'unranked';
  const md = `# Upload notes

Final result: ${final.badges}/14 badges, top level ${topLevel(final.party)}, ${final.champion ? 'Champion beaten, ' : ''}rank ${title} (${final.alphas} alphas), ${final.wins} battles won, ${clock((final.play || 0) / 1000)} of play.

## YouTube (youtube.mp4, ${clock(yt.cut.length)})

**Title:** A bot plays Creatamon: New Game to ${final.champion ? 'Champion' : `${final.badges} badges`} in one run

**Description:**

One continuous run of Creatamon, a creature-battling RPG where you build your team from Power Cards. A script plays it like a person would: keyboard and mouse only, no cheats, no developer tools, and never the secret character. Nothing is cut: the slow stretches are sped up (the ×N in the corner), and the key battles play at real speed. The scoreboard on the right comes from the game's own save.

Play it free in your browser: https://${SITE}

${yt.chapters.map((c) => `${clock(c.out)} ${c.name}`).join('\n')}

## YouTube Short (short.mp4, ${short ? short.len.toFixed(1) : '-'} s)

**Title:** This bot played my whole game in one go #shorts

## X (x.mp4, ${x ? x.len.toFixed(1) : '-'} s)

A bot plays Creatamon from New Game to ${final.champion ? 'Champion' : `${final.badges} badges`}: one run, keyboard only, no cheats. Free in your browser: https://${SITE}
`;
  fs.writeFileSync(path.join(RUN, 'upload-notes.md'), md);
}

async function main() {
  fs.mkdirSync(WORK, { recursive: true });
  if (!fs.existsSync(path.join(ASSETS, 'music-world.wav'))) { fs.mkdirSync(ASSETS, { recursive: true }); await recordMusic(ASSETS); }
  const run = readRun();
  const only = opt('only', null);
  const yt = !only || only === 'youtube' ? await youtube(run, +opt('minutes', 13)) : null;
  const short = !only || only === 'short' ? await montage(run, 'short') : null;
  const x = !only || only === 'x' ? await montage(run, 'x') : null;
  thumbnail(run);
  if (yt) notes(run, yt, short, x);
  console.log(`Done: ${['youtube.mp4', 'short.mp4', 'x.mp4', 'thumbnail.jpg', 'upload-notes.md'].filter((f) => fs.existsSync(path.join(RUN, f))).join(', ')} in ${RUN}`);
}

if (process.argv[1].endsWith('video.mjs')) main();
