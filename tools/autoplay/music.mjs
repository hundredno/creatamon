// Records the game's two tunes on their own (no sound effects), for the fast-forwarded stretches of the videos:
// <dir>/music-world.wav and <dir>/music-battle.wav, each exactly two loops long, so they repeat seamlessly.
// It runs src/sfx.js by itself in a blank page and taps its output, the same way the recorder does.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// One loop is 16 bars of 8 steps (see TUNES in src/sfx.js).
const LOOP = { world: 128 * 0.326, battle: 128 * 0.1875 };

export async function recordMusic(dir) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.goto('about:blank');
  // Everything connected to the speakers also goes to a tap.
  await page.evaluate(() => {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (d, ...rest) {
      const r = connect.call(this, d, ...rest);
      if (d instanceof AudioDestinationNode) { window.tap = window.tap || d.context.createMediaStreamDestination(); connect.call(this, window.tap); }
      return r;
    };
  });
  const src = fs.readFileSync(path.join(ROOT, 'src/sfx.js'), 'utf8').replace(/export \{ SFX \};\s*$/, 'window.SFX = SFX;');
  await page.addScriptTag({ content: src });
  for (const tune of ['world', 'battle']) {
    const file = path.join(dir, `music-${tune}.wav`), webm = `${file}.webm`;
    // Three loops; the first is dropped, so the kept two start mid-flow with the echo tails already sounding.
    const b64 = await page.evaluate(async ({ tune, secs }) => {
      SFX.music(tune);
      const rec = new MediaRecorder(window.tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
      const parts = [];
      rec.ondataavailable = (e) => parts.push(e.data);
      const started = new Promise((r) => { rec.onstart = r; });
      rec.start();
      await started;
      await new Promise((r) => setTimeout(r, secs * 1000));
      await new Promise((r) => { rec.onstop = r; rec.stop(); });
      SFX.music(null);
      const buf = new Uint8Array(await new Blob(parts).arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, { tune, secs: LOOP[tune] * 3 + 1 });
    fs.writeFileSync(webm, Buffer.from(b64, 'base64'));
    // The tune's first step comes 0.12 s after it is asked for.
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', (0.12 + LOOP[tune]).toFixed(3), '-i', webm, '-t', (LOOP[tune] * 2).toFixed(3), '-ar', '48000', '-ac', '2', file]);
    fs.rmSync(webm);
    await page.waitForTimeout(800);
  }
  await browser.close();
}

if (process.argv[1].endsWith('music.mjs')) recordMusic(path.resolve(process.argv[2] || '.'));
