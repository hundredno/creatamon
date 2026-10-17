// Finds the recorder's clapperboard marks in a recording: the frame where the top left corner turns white, and the
// 3 kHz beep in the sound, in a few seconds around each moment a clap was made.
//   node claps.mjs master.mkv 4.1 65.2 ...   (approximate seconds into the file)
import { execFileSync } from 'node:child_process';

export function claps(file, around) {
  const out = [];
  for (const t of around) {
    const from = Math.max(0, t - 1.5), span = 3;
    // Picture: the corner's brightness, one value per frame.
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', from.toFixed(3), '-t', String(span), '-i', file, '-vf', 'crop=100:100:5:5,scale=1:1', '-an',
      '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 26 });
    const f = raw.findIndex((v) => v > 240);
    // Sound: the beep is a pure, loud 3 kHz tone lasting 100 ms. The game's square waves have harmonics there too,
    // but far quieter: look for the 3 kHz level (Goertzel, 5 ms windows) staying high for 60 ms.
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-ss', from.toFixed(3), '-t', String(span), '-i', file, '-vn', '-ac', '1', '-ar', '48000',
      '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
    const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4), win = 240, w = 2 * Math.cos(2 * Math.PI * 3000 / 48000);
    const level = [];
    for (let i = 0; i + win <= x.length; i += win) {
      let s1 = 0, s2 = 0;
      for (let k = i; k < i + win; k++) { const s0 = x[k] + w * s1 - s2; s2 = s1; s1 = s0; }
      level.push(2 * Math.sqrt(s1 * s1 + s2 * s2 - w * s1 * s2) / win);
    }
    let a = -1;
    for (let i = 0; i + 12 <= level.length && a < 0; i++) if (level.slice(i, i + 12).every((v) => v > 0.08)) a = i * win;
    if (f >= 0 && a >= 0) out.push({ video: from + f / 60, audio: from + a / 48000 });
  }
  return out;
}

if (process.argv[1].endsWith('claps.mjs')) {
  for (const p of claps(process.argv[2], process.argv.slice(3).map(Number))) {
    console.log(`video ${p.video.toFixed(3)}  audio ${p.audio.toFixed(3)}  audio - video ${((p.audio - p.video) * 1000).toFixed(0)} ms`);
  }
}
